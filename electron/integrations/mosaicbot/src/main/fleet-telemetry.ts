// fleet-telemetry.ts — Live fleet data collection (the bot's action loop)
// ─────────────────────────────────────────────────────────────────────────────
// Instead of relying on the static stargate-registry, the bot runs its own AXI
// tools (hbox-axi, spo-axi) on a schedule, parses the results, records them in
// axi_node_telemetry, and exposes a live summary for the heartbeat prompt.
// This is "Node Factory Ops": autonomous tracking of the compute fleet.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { recordNodeTelemetry, getForgeStats } from "./axi/axi-store.js";

const AXI_TOOLS_DIR = join(homedir(), "mosaic-companion", "axi-tools");

export interface NodeSnapshot {
  nodeId: string;
  nodeIp: string;
  ssh: boolean;
  hba: boolean;
  tiller: boolean;
  slots: string;
}

export interface FleetSnapshot {
  timestamp: number;
  spoHealthy: boolean;
  nodes: NodeSnapshot[];
  raw: string;
  errors: string[];
}

let lastSnapshot: FleetSnapshot | null = null;
let collectTimer: ReturnType<typeof setInterval> | null = null;

function run(scriptArgs: string[], timeoutMs = 30_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", scriptArgs);
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, out: out + "\n[timeout]" });
    }, timeoutMs);
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", () => { clearTimeout(timer); resolve({ ok: false, out }); });
    proc.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, out }); });
  });
}

// Parse hbox-axi TOON table rows: │ C-3PO   │ ✓  │ ✓  │ ✓  │ ... │ 128 avail │
function parseHboxStatus(out: string): NodeSnapshot[] {
  const ipMap: Record<string, string> = { "c-3po": "192.168.0.150", r2d2: "192.168.0.38" };
  const nodes: NodeSnapshot[] = [];
  for (const line of out.split("\n")) {
    const m = line.match(/│\s*(C-3PO|R2D2)\s*│/i);
    if (!m) continue;
    const cells = line.split("│").map((c) => c.trim()).filter(Boolean);
    // cells: [Name, SSH, HBA, Tiller, Disk, Slots]
    const name = cells[0]?.toLowerCase() ?? "";
    nodes.push({
      nodeId: name.replace("-", ""),
      nodeIp: ipMap[name] ?? "unknown",
      ssh: cells[1] === "✓",
      hba: cells[2] === "✓",
      tiller: cells[3] === "✓",
      slots: cells[5] ?? "?",
    });
  }
  return nodes;
}

// ── Collection ───────────────────────────────────────────────────────────────

export async function collectFleetTelemetry(): Promise<FleetSnapshot> {
  const errors: string[] = [];

  const [hbox, spoHealth] = await Promise.all([
    run([join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"), "status"]),
    fetch("http://127.0.0.1:9100/api/health", { signal: AbortSignal.timeout(3000) })
      .then((r) => r.ok)
      .catch(() => false),
  ]);

  if (!hbox.ok) errors.push("hbox-axi status failed");

  const nodes = parseHboxStatus(hbox.out);
  if (nodes.length === 0 && hbox.ok) errors.push("hbox-axi output parse yielded 0 nodes");

  // Record telemetry rows into axi.sqlite
  for (const n of nodes) {
    try {
      recordNodeTelemetry({
        node_id: n.nodeId,
        node_ip: n.nodeIp,
        hba_status: n.hba ? "ok" : "error",
        tiller_status: n.tiller ? "ok" : "error",
      });
    } catch (e) {
      errors.push(`telemetry record failed for ${n.nodeId}: ${(e as Error).message}`);
    }
  }

  lastSnapshot = {
    timestamp: Date.now(),
    spoHealthy: spoHealth,
    nodes,
    raw: hbox.out.slice(0, 2000),
    errors,
  };
  return lastSnapshot;
}

// ── Scheduler (in-app cron: Node Factory Ops) ────────────────────────────────

export function startFleetTelemetryLoop(intervalMinutes = 15): void {
  if (collectTimer) return;
  // First collection shortly after boot (give tools/network time to settle)
  setTimeout(() => {
    collectFleetTelemetry()
      .then((s) => console.log(`[FleetTelemetry] Initial collection: SPO=${s.spoHealthy ? "ok" : "DOWN"}, nodes=${s.nodes.map((n) => `${n.nodeId}:${n.ssh && n.hba && n.tiller ? "ok" : "DEGRADED"}`).join(", ") || "none"}`))
      .catch((e) => console.error("[FleetTelemetry] Initial collection failed:", e));
  }, 20_000);

  collectTimer = setInterval(() => {
    collectFleetTelemetry()
      .then((s) => {
        const degraded = s.nodes.filter((n) => !(n.ssh && n.hba && n.tiller));
        if (!s.spoHealthy || degraded.length > 0) {
          console.warn(`[FleetTelemetry] ⚠ SPO=${s.spoHealthy ? "ok" : "DOWN"}, degraded: ${degraded.map((n) => n.nodeId).join(", ") || "none"}`);
        }
      })
      .catch((e) => console.error("[FleetTelemetry] Collection failed:", e));
  }, intervalMinutes * 60 * 1000);
  console.log(`[FleetTelemetry] Node Factory Ops loop started (every ${intervalMinutes}m)`);
}

export function stopFleetTelemetryLoop(): void {
  if (collectTimer) {
    clearInterval(collectTimer);
    collectTimer = null;
  }
}

// ── Prompt builder: live fleet section for heartbeats ────────────────────────

export function buildLiveFleetSummary(): string {
  const lines: string[] = [];
  lines.push("## LIVE Fleet Telemetry (collected by my own AXI tools — trust this over static registry)");
  if (!lastSnapshot) {
    lines.push("No live collection yet this session. Run collectFleetTelemetry or wait for the 15m loop.");
    return lines.join("\n");
  }
  const age = Math.round((Date.now() - lastSnapshot.timestamp) / 60_000);
  lines.push(`Collected ${age}m ago via hbox-axi + SPO health probe:`);
  lines.push(`- SPO (localhost:9100): ${lastSnapshot.spoHealthy ? "✓ healthy" : "✗ DOWN — CRITICAL"}`);
  for (const n of lastSnapshot.nodes) {
    const all = n.ssh && n.hba && n.tiller;
    lines.push(`- ${n.nodeId.toUpperCase()} (${n.nodeIp}): ${all ? "✓ fully operational" : `⚠ DEGRADED (ssh:${n.ssh ? "✓" : "✗"} hba:${n.hba ? "✓" : "✗"} tiller:${n.tiller ? "✓" : "✗"})`} | slots: ${n.slots}`);
  }
  if (lastSnapshot.errors.length > 0) {
    lines.push(`- Collection errors: ${lastSnapshot.errors.join("; ")}`);
  }
  try {
    const stats = getForgeStats();
    lines.push(`- My forge history: ${stats.tools} tools, ${stats.modules} AIM modules, ${stats.deployments} deployments, ${stats.sessions} sessions`);
  } catch { /* store not ready */ }
  return lines.join("\n");
}

export function getLastFleetSnapshot(): FleetSnapshot | null {
  return lastSnapshot;
}
