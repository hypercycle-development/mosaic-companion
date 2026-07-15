// ipc-handlers.ts — Electron main process IPC for AXI operations
import { ipcMain } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  getAxiDb,
  listTools,
  listForgeSessions,
  getForgeStats,
  startForgeSession,
  completeForgeSession,
  recordDeployment,
  recordAimModule,
  setToolStatus,
} from "./axi-store.js";

const AXI_TOOLS_DIR = join(homedir(), "mosaic-companion", "axi-tools");

const NODE_IPS: Record<string, string> = {
  c3po: "192.168.0.150",
  r2d2: "192.168.0.38",
};

interface AxiResult {
  success: boolean;
  output?: string;
  error?: string;
}

function runNodeScript(scriptArgs: string[]): Promise<AxiResult> {
  return new Promise((resolve) => {
    const proc = spawn("node", scriptArgs);
    let out = "";
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", (e) => resolve({ success: false, error: e.message, output: out }));
    proc.on("close", (code) => resolve({ success: code === 0, output: out }));
  });
}

export function registerAxiIpcHandlers(): void {
  // ── axi:catalog — List tools from the persistent store (fallback: dir scan) ──
  ipcMain.handle("axi:catalog", async (): Promise<AxiResult & { tools?: unknown[] }> => {
    try {
      if (getAxiDb()) {
        return { success: true, tools: listTools() };
      }
      const fs = await import("node:fs");
      const dirs = fs.readdirSync(AXI_TOOLS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      return { success: true, tools: dirs };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

  // ── axi:status — Run hbox-axi status (records a forge-session log line) ──
  ipcMain.handle("axi:status", async (_event, args: { node?: string; full?: boolean } = {}): Promise<AxiResult> => {
    const cmd = [join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"), "status"];
    if (args?.node) cmd.push("--node", args.node);
    if (args?.full) cmd.push("--full");
    return runNodeScript(cmd);
  });

  // ── axi:spo-status — Run spo-axi status ──
  ipcMain.handle("axi:spo-status", async (): Promise<AxiResult> => {
    return runNodeScript([join(AXI_TOOLS_DIR, "spo-axi", "dist", "index.js"), "status"]);
  });

  // ── axi:deploy — Deploy AIM module via spo-axi + record in axi_deployments ──
  ipcMain.handle("axi:deploy", async (_event, args: { module: string; node?: string }): Promise<AxiResult> => {
    if (!args?.module) return { success: false, error: "module is required" };
    const sessionId = startForgeSession(`deploy ${args.module}${args.node ? ` --node ${args.node}` : ""}`);
    const cmd = [join(AXI_TOOLS_DIR, "spo-axi", "dist", "index.js"), "deploy", args.module];
    if (args.node) cmd.push("--node", args.node);
    const result = await runNodeScript(cmd);

    // Record deployment rows for each targeted node
    const targets = args.node ? [args.node] : Object.keys(NODE_IPS);
    for (const nodeId of targets) {
      recordDeployment({
        module_id: args.module,
        node_id: nodeId,
        node_ip: NODE_IPS[nodeId] ?? "unknown",
        status: result.success ? "running" : "failed",
      });
    }
    if (result.success) setToolStatus(args.module, "deployed");
    completeForgeSession(sessionId, {
      status: result.success ? "done" : "failed",
      toolId: args.module,
      error: result.success ? undefined : (result.error ?? "deploy failed"),
    });
    return result;
  });

  // ── axi:aimify — Wrap tool as AIM module + record in aim_modules ──
  ipcMain.handle("axi:aimify", async (_event, args: { tool: string }): Promise<AxiResult> => {
    if (!args?.tool) return { success: false, error: "tool is required" };
    const sessionId = startForgeSession(`aimify ${args.tool}`);
    const pkgPath = join(AXI_TOOLS_DIR, args.tool, "package.json");
    const outDir = join(AXI_TOOLS_DIR, "aim-output", args.tool);
    const result = await runNodeScript([
      join(AXI_TOOLS_DIR, "aimify", "dist", "index.js"),
      pkgPath,
      "--out", outDir,
    ]);

    if (result.success) {
      try {
        const fs = await import("node:fs");
        const manifest = fs.readFileSync(join(outDir, "aim.json"), "utf-8");
        const parsed = JSON.parse(manifest) as { name: string; version: string };
        const moduleId = `${parsed.name}-aim-v${parsed.version}`;
        recordAimModule({
          id: moduleId,
          tool_id: args.tool,
          name: `${parsed.name} AIM`,
          version: parsed.version,
          manifest,
          status: "built",
        });
        setToolStatus(args.tool, "aimified");
        completeForgeSession(sessionId, { status: "done", toolId: args.tool, moduleId });
      } catch (e) {
        completeForgeSession(sessionId, { status: "done", toolId: args.tool, error: `manifest record failed: ${(e as Error).message}` });
      }
    } else {
      completeForgeSession(sessionId, { status: "failed", toolId: args.tool, error: result.error ?? "aimify failed" });
    }
    return result;
  });

  // ── axi:forge-history — The bot's own forge history ──
  ipcMain.handle("axi:forge-history", async (_event, args: { limit?: number } = {}): Promise<AxiResult & { sessions?: unknown[]; stats?: unknown }> => {
    try {
      return {
        success: true,
        sessions: listForgeSessions(args?.limit ?? 20),
        stats: getForgeStats(),
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });
}
