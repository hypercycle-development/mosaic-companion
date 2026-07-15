#!/usr/bin/env node
// index.ts — spo-axi CLI entry point
import { boxes } from "./commands/boxes.js";
import { deploy } from "./commands/deploy.js";
import { logs } from "./commands/logs.js";
import { scale } from "./commands/scale.js";
import { status } from "./commands/status.js";

const VERSION = "0.9.0";

function showHelp(): void {
  console.log(`spo-axi v${VERSION} — Stargate Pool Orchestrator CLI`);
  console.log();
  console.log("USAGE:");
  console.log("  spo-axi [COMMAND] [OPTIONS]");
  console.log();
  console.log("COMMANDS:");
  console.log("  status              SPO health and pool overview");
  console.log("  boxes               List registered boxes");
  console.log("  boxes --full        Full per-box details");
  console.log("  deploy <module>     Deploy AIM module");
  console.log("  deploy <module> --node <n> Deploy to specific node");
  console.log("  scale <module> <n>   Scale to N instances");
  console.log("  logs                Tail SPO server logs");
  console.log("  logs --module <m>   Show module session logs");
  console.log();
  console.log("OPTIONS:");
  console.log("  --help, -h          Show this help");
  console.log("  --version, -v       Show version");
  console.log();
  console.log("ENV:");
  console.log("  SPO_HOST            SPO hostname (default: 192.168.0.112)");
  console.log("  SPO_PORT            SPO port (default: 9100)");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

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
      console.log(`spo-axi v${VERSION}`);
      break;
    case "status":
      await status({ full: args.includes("--full") });
      break;
    case "boxes":
      await boxes({ full: args.includes("--full") });
      break;
    case "deploy": {
      const moduleId = args[1];
      const nodeIdx = args.indexOf("--node");
      const node = nodeIdx >= 0 ? args[nodeIdx + 1] : undefined;
      await deploy({ module: moduleId, node });
      break;
    }
    case "scale": {
      const moduleId = args[1];
      const count = parseInt(args[2], 10);
      await scale({ module: moduleId, count });
      break;
    }
    case "logs": {
      const modIdx = args.indexOf("--module");
      const moduleId = modIdx >= 0 ? args[modIdx + 1] : undefined;
      await logs({ module: moduleId, follow: args.includes("--follow") });
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
