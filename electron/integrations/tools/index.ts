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
import { Web3Module } from "./modules/web3";
import { VaultToolModule } from "./modules/vault-tools";
import { toolManager } from "../sandbox";

// =============================================================================
// Registry Singleton
// =============================================================================

const registry = new ToolRegistry();

// =============================================================================
// Module Registration
// =============================================================================

// Layer 1: Built-in modules
registry.register(new GmailModule());
registry.register(new Web3Module());
registry.register(new VaultToolModule());

// Layer 2: Sandbox tools (WASM) — dynamically registered via ToolManager

// =============================================================================
// Lifecycle
// =============================================================================

/** Initialize all registered modules. Call from app.whenReady() */
async function initializeTools(): Promise<void> {
  console.log("[Tools] Initializing tool registry...");
  await registry.initializeAll();

  // Initialize sandbox tool manager with registry callbacks
  await toolManager.initialize(
    (module) => registry.register(module),
    (name) => registry.unregister(name),
  );

  console.log("[Tools] Registry ready");
}

/** Cleanup all modules. Call from app before-quit */
async function cleanupTools(): Promise<void> {
  console.log("[Tools] Cleaning up...");

  // Stop sandbox tools first
  await toolManager.cleanup();

  // Then clean up built-in modules
  await registry.cleanupAll();
}

// =============================================================================
// Exports
// =============================================================================

export { registry, initializeTools, cleanupTools };

// Re-export types for convenience
export type { ToolModule, ToolDefinition, ToolResult, ActionPattern, ExecutionContext } from "./types";

