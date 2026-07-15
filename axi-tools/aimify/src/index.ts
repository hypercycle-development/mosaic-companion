#!/usr/bin/env node
import { aimify } from "./wrapper.js";
import { readFileSync } from "node:fs";

function showHelp(): void {
  console.log("aimify — Wrap AXI tools as HyperCycle AIM modules");
  console.log();
  console.log("USAGE:");
  console.log("  aimify <tool-package.json> [--out <dir>]");
  console.log();
  console.log("EXAMPLE:");
  console.log("  aimify ../hbox-axi/package.json --out ./hbox-aim");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help") { showHelp(); return; }

  const pkgPath = args[0];
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : "./aim-output";

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const tool = {
    id: pkg.name,
    name: pkg.name,
    version: pkg.version,
    bin: pkg.bin ? Object.values(pkg.bin)[0] as string : "./dist/index.js",
    commands: ["status", "logs", "restart"],
  };

  aimify(tool, outDir);
}

main().catch((e) => { console.error(e); process.exit(1); });
