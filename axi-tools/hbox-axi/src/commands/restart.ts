// commands/restart.ts — Service restart with auto-heal
// AXI Principle #6: Structured errors — exit codes 10=SSH, 20=HBA, 30=tiller

import { toon, nextStep } from "../lib/toon.js";
import { getNode, unknownNode } from "../lib/config.js";
import { execSync } from "node:child_process";

interface ServiceConfig {
  pidFile?: string;
  command: string;
  logPath: string;
  preRestart?: string[];
}

const SERVICES: Record<string, ServiceConfig> = {
  hba: {
    pidFile: "/home/hyperai/stargate/hba.pid",
    command: "cd /home/hyperai/stargate && nohup python3 hba_agent.py > hba.log 2>&1 &",
    logPath: "/home/hyperai/stargate/hba.log",
    preRestart: [
      "rm -f /home/hyperai/stargate/hba.pid",
      "pkill -f 'python3.*hba_agent' 2>/dev/null || true",
    ],
  },
  tiller: {
    command: "systemctl restart tiller 2>/dev/null || docker restart tiller",
    logPath: "/var/log/tiller.log",
  },
  node: {
    command: "systemctl restart node-manager 2>/dev/null || docker restart node-manager",
    logPath: "/var/log/node-manager.log",
  },
  docker: {
    command: "sudo systemctl restart docker",
    logPath: "/var/log/docker.log",
  },
};

export async function restart(args: {
  service: string;
  node: string;
}): Promise<void> {
  const node = getNode(args.node);
  if (!node) {
    console.log(unknownNode(args.node));
    process.exit(1);
  }

  const svc = SERVICES[args.service];
  if (!svc) {
    console.log(toon({
      title: "Unknown Service",
      headers: ["Service", "Status"],
      rows: [[args.service, "not configured"]],
      footer: `Known: ${Object.keys(SERVICES).join(", ")}`,
    }));
    process.exit(20);
  }

  try {
    const sshPrefix = `ssh -o ConnectTimeout=3 -i "${node.sshKey}" ${node.sshUser}@${node.ip}`;

    // Pre-restart cleanup
    if (svc.preRestart) {
      for (const cmd of svc.preRestart) {
        try {
          execSync(`${sshPrefix} "${cmd}"`, { timeout: 10000 });
        } catch {
          // Cleanup commands are best-effort
        }
      }
    }

    // Restart
    execSync(`${sshPrefix} "${svc.command}"`, { timeout: 15000 });

    // Verify
    await new Promise((r) => setTimeout(r, 2000)); // Give service time to start

    let verifyStatus = "unknown";
    try {
      if (args.service === "hba") {
        const out = execSync(
          `${sshPrefix} "curl -s --connect-timeout 3 http://localhost:${node.hbaPort}/ 2>&1 || echo 'fail'"`,
          { timeout: 5000, encoding: "utf-8" }
        );
        verifyStatus = out.includes("ok") || out.includes('"status"') ? "ok" : "fail";
      } else if (args.service === "tiller") {
        const out = execSync(
          `${sshPrefix} "curl -s --connect-timeout 3 http://localhost:${node.tillerPort}/list 2>&1 || echo 'fail'"`,
          { timeout: 5000, encoding: "utf-8" }
        );
        verifyStatus = out.includes("slots") ? "ok" : "fail";
      } else {
        const out = execSync(
          `${sshPrefix} "systemctl is-active ${args.service} 2>/dev/null || docker ps -q -f name=${args.service} 2>/dev/null || echo 'unknown'"`,
          { timeout: 5000, encoding: "utf-8" }
        );
        verifyStatus = out.includes("active") || out.includes("running") ? "ok" : "fail";
      }
    } catch {
      verifyStatus = "fail";
    }

    console.log(toon({
      title: `${node.name} — Restart ${args.service}`,
      headers: ["Step", "Status"],
      rows: [
        ["Restart", "sent"],
        ["Verify", verifyStatus === "ok" ? "✓" : verifyStatus === "fail" ? "✗" : "?"],
      ],
      footer: verifyStatus === "ok"
        ? nextStep(`hbox-axi logs ${node.id} --service ${args.service} --tail 5`)
        : "Restart may need manual intervention",
    }));
  } catch (e) {
    console.error(`Restart failed: ${(e as Error).message}`);
    process.exit(20);
  }
}
