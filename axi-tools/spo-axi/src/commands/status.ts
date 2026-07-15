// commands/status.ts — SPO and pool health status
import { toon, nextStep } from "../lib/toon.js";
import { getConfig } from "../lib/config.js";

export async function status(args: { full?: boolean }): Promise<void> {
  const config = getConfig();

  try {
    const [healthRes, poolRes] = await Promise.all([
      fetch(`${config.spoUrl}/api/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
      fetch(`${config.spoUrl}/api/pool`, { signal: AbortSignal.timeout(3000) }).catch(() => null),
    ]);

    const health = healthRes?.ok ? await healthRes.json() : { status: "unreachable" };
    const pool = poolRes?.ok ? await poolRes.json() : { total_nodes: 0, online_nodes: 0 };

    console.log(toon({
      title: "SPO Status",
      headers: ["Component", "Status", "Detail"],
      rows: [
        ["SPO Health", health.status === "ok" ? "✓" : "✗", health.status],
        ["SPO URL", "-", config.spoUrl],
        ["Nodes", String(pool.total_nodes || 0), `${pool.online_nodes || 0} online`],
        ["Fleet", "-", config.nodes.map((n) => n.name).join(", ")],
      ],
      footer: args.full
        ? `Checked at: ${new Date().toISOString()}`
        : nextStep("spo-axi boxes for per-node details"),
    }));
  } catch (e) {
    console.error(`SPO unreachable: ${(e as Error).message}`);
    process.exit(10);
  }
}
