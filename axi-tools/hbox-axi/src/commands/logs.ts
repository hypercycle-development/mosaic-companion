// commands/logs.ts — Remote log tailing with truncation
// AXI Principle #3: Content truncation — default tail N lines, --full for all

import { toon, nextStep } from "../lib/toon.js";
import { getNode, unknownNode } from "../lib/config.js";
import { execSync } from "node:child_process";

const SERVICE_PATHS: Record<string, string> = {
  hba: "/home/hyperai/stargate/hba.log",
  tiller: "/var/log/tiller.log",
  node: "/var/log/node-manager.log",
  docker: "/var/log/docker.log",
};

export async function logs(args: {
  node: string;
  service?: string;
  tail?: number;
  follow?: boolean;
  full?: boolean;
}): Promise<void> {
  const node = getNode(args.node);
  if (!node) {
    console.log(unknownNode(args.node));
    process.exit(1);
  }

  const service = args.service || "hba";
  const path = SERVICE_PATHS[service] || `/var/log/${service}.log`;
  const tailLines = args.full ? "" : `-${args.tail || 20}`;

  try {
    const sshPrefix = `ssh -o ConnectTimeout=3 -i "${node.sshKey}" ${node.sshUser}@${node.ip}`;

    if (args.follow) {
      // Streaming mode — can't use TOON, just pipe through
      const { spawn } = await import("node:child_process");
      const child = spawn("ssh", [
        "-o", "StrictHostKeyChecking=no",
        "-i", node.sshKey,
        `${node.sshUser}@${node.ip}`,
        `tail -f ${path}`,
      ], { stdio: "inherit" });

      return new Promise((resolve, reject) => {
        child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`tail exited ${code}`)));
      });
    }

    const output: string = execSync(
      `${sshPrefix} "tail ${tailLines} ${path} 2>/dev/null || echo 'LOG_NOT_FOUND'"`,
      { timeout: 10000, encoding: "utf-8" }
    );

    if (output.includes("LOG_NOT_FOUND")) {
      console.log(toon({
        title: `Logs: ${node.name}`,
        headers: ["Status", "Path"],
        rows: [["not found", path]],
        footer: nextStep(`ssh ${node.id} "ls /home/hyperai/stargate/logs/"`),
      }));
      return;
    }

    const logLines: string[] = output.trim().split("\n");
    console.log(toon({
      title: `${node.name} — ${service} (${logLines.length} lines)`,
      headers: ["Line"],
      rows: logLines.map((l: string) => [l.slice(0, 55)]),
      footer: args.full
        ? "End of log"
        : nextStep(`hbox-axi logs ${node.id} --service ${service} --full`),
    }));
  } catch (e) {
    console.error(`Failed to fetch logs: ${(e as Error).message}`);
    process.exit(10);
  }
}
