/**
 * Tools API — Shared Types for Renderer
 *
 * These types are used in the renderer to get proper IntelliSense
 * when calling tool functions through the Electron IPC bridge.
 *
 * Each module exports its own ToolArgs interface. This file imports
 * and unions them so the renderer gets typed execute() calls.
 */

// Import per-module arg types — each module is the source of truth for its own args
import type { GmailToolArgs } from "../../electron/integrations/tools/modules/gmail";
import type { Web3ToolArgs } from "../../electron/integrations/web3";

// Re-export for convenience
export type { GmailToolArgs, Web3ToolArgs };

// =============================================================================
// Core Tool Types
// =============================================================================

/** Result returned by any tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Info about a registered tool module (for UI display) */
export interface ModuleInfo {
  name: string;
  displayName: string;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
}

/** Serialized action pattern (RegExps can't cross IPC) */
export interface SerializedActionPattern {
  moduleName: string;
  toolName: string;
  pattern: string;
  flags: string;
}

// =============================================================================
// Combined Tool Arg Map
// =============================================================================

/** Union of all known tool arg maps — add new modules here */
export type ToolArgMap = GmailToolArgs & Web3ToolArgs;

// =============================================================================
// Tools API (exposed via window.electronAPI.tools)
// =============================================================================

export interface ToolsAPI {
  /** Execute a known tool — typed args and autocomplete */
  execute<K extends keyof ToolArgMap>(fullName: K, args: ToolArgMap[K]): Promise<ToolResult>;
  /** Execute a dynamic/unknown tool — untyped fallback */
  execute(fullName: string, args: Record<string, unknown>): Promise<ToolResult>;

  /** List all registered modules and their tools */
  listModules: () => Promise<ModuleInfo[]>;
  /** Get combined system prompt for all available modules */
  getSystemPrompt: () => Promise<string>;
  /** Get all action patterns (serialized RegExps, for ActionParser) */
  getActionPatterns: () => Promise<SerializedActionPattern[]>;
}
