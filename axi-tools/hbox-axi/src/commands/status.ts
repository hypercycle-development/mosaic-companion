// commands/status.ts — Fleet status with TOON output
// AXI Principle #8: Content first — no args = live fleet data
// AXI Principle #4: Pre-computed aggregates
// AXI Principle #9: Contextual disclosure — next-step hints

import { toon, nextStep, emptyState } from "../lib/toon.js";
import { getConfig, getNode, unknownNode } from "../lib/config.js";
import { execSync } from "node:child_process";

interface NodeStatus {
  name: string;
  id: string;
  ip: string;
  ssh: "ok" | "fail" | "unknown";
  hba: "ok" | "fail" | "unknown";
  tiller: "ok" | "fail" | "unknown";
  nodeManager: "ok" | "fail" | "unknown";
  docker: "ok" | "fail" | "unknown";
  freeDisk: string;
  slots: string;
  architecture: string;
}

async function checkNode(node: ReturnType<typeof getNode>): Promise<NodeStatus | null> {
  if (!node) return null;

  const status: NodeStatus = {
    name: node.name,
    id: node.id,
    ip: node.ip,
    ssh: "unknown",
    hba: "unknown",
    tiller: "unknown",
    nodeManager: "unknown",
    docker: "unknown",
    freeDisk: "?",
    slots: "?",
    architecture: node.architecture,
  };

  // SSH check
  try {
    execSync(`ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -i "${node.sshKey}" ${node.sshUser}@${node.ip} "echo ok"`, { timeout: 3000 });
    status.ssh = "ok";
  } catch {
    status.ssh = "fail";
    return status; // Can't check further without SSH
  }

  // HBA check
  try {
    const hbaOut = execSync(`ssh -o ConnectTimeout=2 -i "${node.sshKey}" ${node.sshUser}@${node.ip} "curl -s --connect-timeout 2 http://localhost:${node.hbaPort}/health 2>/dev/null || echo 'fail'"`, { timeout: 5000, encoding: "utf-8" });
    status.hba = hbaOut.includes('"status"') || hbaOut.includes("ok") ? "ok" : "fail";
  } catch {
    status.hba = "fail";
  }

  // Tiller check
  try {
    const tillerOut = execSync(`ssh -o ConnectTimeout=2 -i "${node.sshKey}" ${node.sshUser}@${node.ip} "curl -s --connect-timeout 2 http://localhost:${node.tillerPort}/list 2>/dev/null || echo 'fail'"`, { timeout: 5000, encoding: "utf-8" });
    status.tiller = tillerOut.includes("available") ? "ok" : "fail";
    const match = tillerOut.match(/"available":(\d+)/);
    if (match) status.slots = `${match[1]} avail`;
  } catch {
    status.tiller = "fail";
  }

  // Node Manager check
  try {
    const nmOut = execSync(`ssh -o ConnectTimeout=2 -i "${node.sshKey}" ${node.sshUser}@${node.ip} "curl -s --connect-timeout 2 http://localhost:${node.nodeManagerPort}/api/info 2>&1 || echo 'fail'"`, { timeout: 5000, encoding: "utf-8" });
    status.nodeManager = nmOut.includes("node_id") ? "ok" : "fail";
  } catch {
    status.nodeManager = "fail";
  }

  // Disk usage
  try {
    const dfOut = execSync(`ssh -o ConnectTimeout=2 -i "${node.sshKey}" ${node.sshUser}@${node.ip} "df -h / | tail -1 | awk '{print \$4}'"`, { timeout: 5000, encoding: "utf-8" });
    status.freeDisk = dfOut.trim();
  } catch {
    status.freeDisk = "?";
  }

  return status;
}

export async function status(args: { full?: boolean; node?: string }): Promise<void> {
  const config = getConfig();

  if (args.node) {
    const node = getNode(args.node);
    if (!node) {
      console.log(unknownNode(args.node));
      process.exit(1);
    }
    const s = await checkNode(node);
    if (!s) {
      console.log(`Failed to check node ${args.node}`);
      process.exit(1);
    }

    console.log(toon({
      title: `${s.name} (${s.id})`,
      headers: ["Check", "Status", "Detail"],
      rows: [
        ["SSH", s.ssh, s.ssh === "ok" ? "✓" : "✗"],
        ["HBA", s.hba, s.hba === "ok" ? "✓" : "✗"],
        ["Tiller", s.tiller, s.slots !== "?" ? `${s.slots} slots` : "?"],
        ["Node Mgr", s.nodeManager, s.nodeManager === "ok" ? "✓" : "✗"],
        ["Disk", "free", s.freeDisk],
        ["Arch", "-", s.architecture],
      ],
      footer: s.ssh === "fail"
        ? "SSH failed — check network or key"
        : nextStep("hbox-axi logs " + s.id + " --service hba"),
    }));
    return;
  }

  // Fleet-wide status
  const results = await Promise.all(config.nodes.map((n) => checkNode(n)));
  const nodes = results.filter((r): r is NodeStatus => r !== null);

  if (nodes.length === 0) {
    console.log(emptyState("HyperAIBox Fleet", "hbox-axi status --node c3po"));
    process.exit(0);
  }

  const online = nodes.filter((n) => n.ssh === "ok").length;
  const total = nodes.length;

  console.log(toon({
    title: `HyperAIBox Fleet (${online}/${total} online)`,
    headers: ["Name", "SSH", "HBA", "Tiller", "Disk", "Slots"],
    rows: nodes.map((n) => [
      n.name,
      n.ssh === "ok" ? "✓" : "✗",
      n.hba === "ok" ? "✓" : "✗",
      n.tiller === "ok" ? "✓" : "✗",
      n.freeDisk,
      n.slots,
    ]),
    footer: args.full
      ? `Last check: ${new Date().toISOString()} | Arch: ${nodes.map((n) => n.architecture).join(", ")}`
      : nextStep("hbox-axi status --full for per-node details"),
  }));
}
