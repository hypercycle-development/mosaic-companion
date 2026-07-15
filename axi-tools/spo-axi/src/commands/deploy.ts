// commands/deploy.ts — Deploy AIM modules to nodes
// AXI Principle #9: Contextual disclosure — shows next step after deploy

import { toon, nextStep } from "../lib/toon.js";
import { getConfig } from "../lib/config.js";
import { execSync } from "node:child_process";

export async function deploy(args: {
  module: string;
  node?: string;
  scale?: number;
}): Promise<void> {
  const config = getConfig();

  if (!args.module) {
    console.error("Usage: spo-axi deploy <module-id> [--node <node>] [--scale <n>]");
    process.exit(1);
  }

  const nodeFilter = args.node;
  const targetNodes = nodeFilter
    ? config.nodes.filter((n) => n.id === nodeFilter || n.name.toLowerCase() === nodeFilter.toLowerCase())
    : config.nodes;

  if (targetNodes.length === 0) {
    console.error(`Node "${nodeFilter}" not found in fleet`);
    process.exit(1);
  }

  const results: { node: string; status: string; detail: string }[] = [];

  for (const node of targetNodes) {
    try {
      // Tell SPO to deploy
      const res = await fetch(`${config.spoUrl}/api/v1/tilling`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: args.module,
          node: node.id,
          scale: args.scale || 1,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        results.push({ node: node.name, status: "fail", detail: `HTTP ${res.status}` });
      } else {
        const data = await res.json();
        results.push({
          node: node.name,
          status: "ok",
          detail: data.session_id ? `session ${data.session_id.slice(0, 8)}` : "deployed",
        });
      }
    } catch (e) {
      results.push({ node: node.name, status: "fail", detail: (e as Error).message });
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;

  console.log(toon({
    title: `Deploy: ${args.module}`,
    headers: ["Node", "Status", "Detail"],
    rows: results.map((r) => [r.node, r.status === "ok" ? "✓" : "✗", r.detail]),
    footer: okCount === results.length
      ? nextStep(`spo-axi logs ${args.module} --follow`)
      : `${results.length - okCount} failed — check SPO logs`,
  }));
}
