/**
 * Tools API — Shared Types for Renderer
 *
 * These types are used in the renderer to get proper IntelliSense
 * when calling tool functions through the Electron IPC bridge.
 * They mirror the types from electron/integrations/tools/types.ts
 * but are importable from the renderer side.
 */

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
// Tools API (exposed via window.electronAPI.tools)
// =============================================================================

export interface ToolsAPI {
  /** Execute a tool: "moduleName:toolName" — generic, untyped */
  execute: (fullName: string, args: Record<string, unknown>) => Promise<ToolResult>;
  /** List all registered modules and their tools */
  listModules: () => Promise<ModuleInfo[]>;
  /** Get combined system prompt for all available modules */
  getSystemPrompt: () => Promise<string>;
  /** Get all action patterns (serialized RegExps, for ActionParser) */
  getActionPatterns: () => Promise<SerializedActionPattern[]>;
}
