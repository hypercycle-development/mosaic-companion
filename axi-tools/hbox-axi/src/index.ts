#!/usr/bin/env node
// index.ts — hbox-axi CLI entry point
// AXI Principle #8: Content first — no args = live fleet data
// AXI Principle #10: Consistent help — per-subcommand reference

import { status } from "./commands/status.js";
import { ssh } from "./commands/ssh.js";
import { logs } from "./commands/logs.js";
import { restart } from "./commands/restart.js";

const VERSION = "1.0.0";

function showHelp(): void {
  console.log(`hbox-axi v${VERSION} — HyperAIBox Fleet Manager`);
  console.log();
  console.log("USAGE:");
  console.log("  hbox-axi [COMMAND] [OPTIONS]");
  console.log();
  console.log("COMMANDS:");
  console.log("  status              Fleet overview (default when no command)");
  console.log("  status --node <name> Single node deep check");
  console.log("  status --full       Full per-node breakdown");
  console.log("  ssh <node>         Interactive SSH session");
  console.log("  ssh <node> --cmd   Run single command via SSH");
  console.log("  logs <node>         Tail HBA logs (default service)");
  console.log("  logs <node> --service <svc> Tail specific service logs");
  console.log("  logs <node> --follow Live tail with follow");
  console.log("  logs <node> --full  Full log (no truncation)");
  console.log("  restart <svc> <node> Restart service on node");
  console.log();
  console.log("OPTIONS:");
  console.log("  --help, -h          Show this help");
  console.log("  --version, -v       Show version");
  console.log();
  console.log("EXAMPLES:");
  console.log("  hbox-axi                           # Show fleet status");
  console.log("  hbox-axi status --node c3po         # Deep check C-3PO");
  console.log("  hbox-axi ssh c3po                   # SSH into C-3PO");
  console.log("  hbox-axi logs c3po --service hba    # Tail HBA logs");
  console.log("  hbox-axi restart hba c3po           # Restart HBA on C-3PO");
  console.log();
  console.log("ENV:");
  console.log("  SSH_USER            Default SSH user (default: hyperai)");
  console.log("  SSH_TIMEOUT         Connection timeout ms (default: 5000)");
  console.log("  SPO_HOST            SPO hostname (default: 192.168.0.112)");
  console.log("  SPO_PORT            SPO port (default: 9100)");
}

function showVersion(): void {
  console.log(`hbox-axi v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // No args = content first (fleet status)
  if (args.length === 0) {
    await status({});
    return;
  }

  const command = args[0];

  switch (command) {
    case "--help":
    case "-h":
      showHelp();
      break;

    case "--version":
    case "-v":
      showVersion();
      break;

    case "status": {
      const full = args.includes("--full");
      const nodeIdx = args.indexOf("--node");
      const node = nodeIdx >= 0 ? args[nodeIdx + 1] : undefined;
      await status({ full, node });
      break;
    }

    case "ssh": {
      const node = args[1];
      const cmdIdx = args.indexOf("--cmd");
      const command = cmdIdx >= 0 ? args.slice(cmdIdx + 1).join(" ") : undefined;
      if (!node) {
        console.error("Usage: hbox-axi ssh <node> [--cmd <command>]");
        process.exit(1);
      }
      await ssh({ node, command });
      break;
    }

    case "logs": {
      const node = args[1];
      if (!node) {
        console.error("Usage: hbox-axi logs <node> [--service <svc>] [--follow] [--full]");
        process.exit(1);
      }
      const serviceIdx = args.indexOf("--service");
      const service = serviceIdx >= 0 ? args[serviceIdx + 1] : undefined;
      const follow = args.includes("--follow") || args.includes("-f");
      const full = args.includes("--full");
      const tailIdx = args.indexOf("--tail");
      const tail = tailIdx >= 0 ? parseInt(args[tailIdx + 1], 10) : undefined;
      await logs({ node, service, follow, full, tail });
      break;
    }

    case "restart": {
      const service = args[1];
      const node = args[2];
      if (!service || !node) {
        console.error("Usage: hbox-axi restart <service> <node>");
        process.exit(1);
      }
      await restart({ service, node });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'hbox-axi --help' for usage.");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
