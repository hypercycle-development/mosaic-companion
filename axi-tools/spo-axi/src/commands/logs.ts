// commands/logs.ts — Tail SPO logs or AIM module logs
import { toon, nextStep } from "../lib/toon.js";
import { getConfig } from "../lib/config.js";
import { execSync } from "node:child_process";

export async function logs(args: {
  module?: string;
  follow?: boolean;
  tail?: number;
}): Promise<void> {
  const config = getConfig();

  if (args.module) {
    // Module-specific logs from SPO
    try {
      const res = await fetch(`${config.spoUrl}/api/v1/tilling`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sessions = data.sessions || [];
      const filtered = sessions.filter((s: any) => s.tenant_id?.includes(args.module));

      console.log(toon({
        title: `Logs: ${args.module}`,
        headers: ["Session", "Node", "Status", "Runtime"],
        rows: filtered.map((s: any) => [
          s.session_id?.slice(0, 8) || "?",
          s.node || "?",
          s.status || "?",
          s.runtime ? `${Math.round(s.runtime)}s` : "?",
        ]),
        footer: filtered.length === 0
          ? "No sessions found"
          : nextStep(`spo-axi logs --follow for live tail`),
      }));
    } catch (e) {
      console.error(`Failed: ${(e as Error).message}`);
      process.exit(10);
    }
    return;
  }

  // SPO server logs (local systemd journal)
  try {
    const tailLines = args.tail || 20;
    const output = execSync(
      `journalctl --user -u spo-server.service --no-pager -n ${tailLines} 2>/dev/null || echo "SPO_LOG_NOT_FOUND"`,
      { timeout: 5000, encoding: "utf-8" }
    );

    if (output.includes("SPO_LOG_NOT_FOUND") || output.trim().length === 0) {
      console.log("SPO logs not available via journalctl");
      return;
    }

    const lines = output.trim().split("\n");
    console.log(toon({
      title: `SPO Logs (${lines.length} lines)`,
      headers: ["Log"],
      rows: lines.map((l) => [l.slice(0, 55)]),
      footer: nextStep("spo-axi logs --follow"),
    }));
  } catch (e) {
    console.error(`Failed to fetch logs: ${(e as Error).message}`);
    process.exit(10);
  }
}
