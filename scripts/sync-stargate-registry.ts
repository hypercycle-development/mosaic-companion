#!/usr/bin/env node
// sync-stargate-registry.ts — Standalone registry sync script
// Checks actual health of Stargate infrastructure and updates component statuses
//
// Usage:
//   npx tsx scripts/sync-stargate-registry.ts [--once] [--interval <ms>] [--output <path>]
//
// Options:
//   --once        Run once and exit (default: keep running with interval)
//   --interval    Health check interval in ms (default: 30000 = 30s)
//   --output      Write status report to JSON file
//   --verbose     Log all health checks, not just status changes
//
// Examples:
//   npx tsx scripts/sync-stargate-registry.ts --once
//   npx tsx scripts/sync-stargate-registry.ts --interval 60000 --output /tmp/stargate-status.json

import {
  syncRegistryStatus,
  getRegistryStatusReport,
  STARGATE_COMPONENTS,
  HYPERAIBOX_FLEET,
} from "../electron/integrations/mosaicbot/src/main/stargate-registry.js";
import { writeFileSync } from "node:fs";

interface SyncOptions {
  once: boolean;
  interval: number;
  output?: string;
  verbose: boolean;
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    once: args.includes("--once"),
    interval: 30000,
    verbose: args.includes("--verbose"),
  };

  const intervalIdx = args.indexOf("--interval");
  if (intervalIdx >= 0 && args[intervalIdx + 1]) {
    options.interval = parseInt(args[intervalIdx + 1], 10);
  }

  const outputIdx = args.indexOf("--output");
  if (outputIdx >= 0 && args[outputIdx + 1]) {
    options.output = args[outputIdx + 1];
  }

  return options;
}

async function runSync(options: SyncOptions): Promise<void> {
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] Syncing Stargate registry...`);
  
  const results = await syncRegistryStatus(5000);
  const report = getRegistryStatusReport();
  
  const duration = Date.now() - startTime;
  
  // Log results
  if (options.verbose) {
    for (const result of results) {
      const status = result.healthy ? "✅" : "❌";
      const latency = result.healthy ? `${result.responseTimeMs}ms` : "timeout/error";
      console.log(`  ${status} ${result.componentId}: ${latency}`);
    }
  }
  
  // Log summary
  console.log(`[${new Date().toISOString()}] Sync complete (${duration}ms)`);
  console.log(`  Components: ${report.components.operational} operational, ${report.components.degraded} degraded, ${report.components.down} down`);
  console.log(`  Fleet: ${report.fleet.online} online, ${report.fleet.offline} offline, ${report.fleet.unreachable} unreachable`);
  
  // Write output if requested
  if (options.output) {
    writeFileSync(
      options.output,
      JSON.stringify(report, null, 2),
    );
    console.log(`  Report written to ${options.output}`);
  }
  
  // Log any down components
  if (report.downComponents.length > 0) {
    console.log(`  ⚠️  ${report.downComponents.length} component(s) down:`);
    for (const comp of report.downComponents) {
      console.log(`     - ${comp.name} (${comp.id}): ${comp.status}`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  console.log("=== Stargate Registry Sync ===");
  console.log(`Monitoring ${STARGATE_COMPONENTS.length} components, ${HYPERAIBOX_FLEET.length} fleet nodes`);
  
  if (options.once) {
    await runSync(options);
    return;
  }
  
  // Run immediately, then schedule
  await runSync(options);
  
  console.log(`\nStarting sync loop (interval: ${options.interval}ms)...`);
  console.log("Press Ctrl+C to stop\n");
  
  const intervalId = setInterval(() => {
    runSync(options).catch((err) => {
      console.error("Sync error:", err);
    });
  }, options.interval);
  
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nStopping sync...");
    clearInterval(intervalId);
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    clearInterval(intervalId);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
