// commands/ssh.ts — SSH wrapper with ambient context
// AXI Principle #7: Ambient context — SSH key from ~/.ssh/id_ed25519

import { getNode, unknownNode } from "../lib/config.js";
import { spawn } from "node:child_process";

export async function ssh(args: { node: string; command?: string }): Promise<void> {
  const node = getNode(args.node);
  if (!node) {
    console.log(unknownNode(args.node));
    process.exit(1);
  }

  const sshArgs = [
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=5",
    "-i", node.sshKey || `${process.env.HOME}/.ssh/id_ed25519`,
    `${node.sshUser}@${node.ip}`,
  ];

  if (args.command) {
    sshArgs.push(args.command);
  }

  const child = spawn("ssh", sshArgs, {
    stdio: "inherit",
    env: process.env,
  });

  return new Promise((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SSH exited with code ${code}`));
    });
    child.on("error", reject);
  });
}
