/**
 * Tool Registry — Entry Point
 *
 * Creates the registry, registers built-in modules, and provides
 * initialization/cleanup functions for the app lifecycle.
 *
 * Usage in main.ts:
 *   import { initializeTools, cleanupTools } from "./integrations/tools";
 *   app.whenReady().then(() => { initializeTools(); });
 *   app.on("before-quit", () => { cleanupTools(); });
 */

import { ToolRegistry } from "./registry";
import { GmailModule } from "./modules/gmail";

// =============================================================================
// Registry Singleton
// =============================================================================

const registry = new ToolRegistry();

// =============================================================================
// Module Registration
// =============================================================================

// Layer 1: Built-in modules
registry.register(new GmailModule());
// registry.register(new Web3Module());         // Phase 4 (if built-in)

// =============================================================================
// Lifecycle
// =============================================================================

/** Initialize all registered modules. Call from app.whenReady() */
async function initializeTools(): Promise<void> {
  console.log("[Tools] Initializing tool registry...");
  await registry.initializeAll();
  console.log("[Tools] Registry ready");
}

/** Cleanup all modules. Call from app before-quit */
async function cleanupTools(): Promise<void> {
  console.log("[Tools] Cleaning up...");
  await registry.cleanupAll();
}

// =============================================================================
// Exports
// =============================================================================

export { registry, initializeTools, cleanupTools };

// Re-export types for convenience
export type { ToolModule, ToolDefinition, ToolResult, ActionPattern } from "./types";
