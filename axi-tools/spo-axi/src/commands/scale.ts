// commands/scale.ts — Scale AIM modules across fleet
import { toon, nextStep } from "../lib/toon.js";
import { getConfig } from "../lib/config.js";

export async function scale(args: {
  module: string;
  count: number;
}): Promise<void> {
  const config = getConfig();

  if (!args.module || args.count === undefined) {
    console.error("Usage: spo-axi scale <module> <count>");
    process.exit(1);
  }

  const results: { node: string; status: string }[] = [];

  // Deploy to N nodes (simple round-robin)
  const targetNodes = config.nodes.slice(0, args.count);

  for (const node of targetNodes) {
    try {
      const res = await fetch(`${config.spoUrl}/api/v1/tilling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: args.module,
          node: node.id,
        }),
        signal: AbortSignal.timeout(10000),
      });
      results.push({ node: node.name, status: res.ok ? "ok" : "fail" });
    } catch {
      results.push({ node: node.name, status: "fail" });
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;

  console.log(toon({
    title: `Scale: ${args.module} → ${args.count} instances`,
    headers: ["Node", "Status"],
    rows: results.map((r) => [r.node, r.status === "ok" ? "✓" : "✗"]),
    footer: okCount === args.count
      ? nextStep(`spo-axi logs ${args.module}`)
      : `${okCount}/${args.count} deployed`,
  }));
}
