/**
 * Tool Registry — Type Definitions
 *
 * Base interfaces for the MosAIc tool system.
 * ToolModules wrap built-in features (Gmail, etc.) or external MCP servers
 * into a unified interface that the registry can manage.
 */

// =============================================================================
// Tool Definition
// =============================================================================

/** A single tool within a module */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

/** Result returned by any tool handler */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// =============================================================================
// Action Patterns (for parsing LLM responses)
// =============================================================================

/**
 * Regex pattern for detecting tool invocations in LLM text responses.
 * Used by the ActionParser to detect when the AI wants to call a tool
 * via action tags like [GMAIL_RECENT:5] instead of the MCP tool-calling protocol.
 */
export interface ActionPattern {
  pattern: RegExp;
  toolName: string;
  extractArgs: (match: RegExpMatchArray) => Record<string, unknown>;
}

// =============================================================================
// Tool Module
// =============================================================================

/**
 * A self-contained feature module.
 *
 * Each module encapsulates:
 * - Its tools (what it can do)
 * - Its system prompt (how the AI knows about it)
 * - Its action patterns (how to detect tool calls in LLM text)
 * - Its lifecycle (initialize/cleanup)
 *
 * Built-in modules (Gmail, etc.) implement this directly.
 * External MCP servers get wrapped into this via MCPBridge.
 */
export interface ToolModule {
  /** Unique identifier, e.g. "gmail", "mcp:trading-agent" */
  name: string;
  /** Human-readable name, e.g. "Gmail", "Trading Agent" */
  displayName: string;
  /** Tools provided by this module */
  tools: ToolDefinition[];
  /** System prompt fragment that teaches the AI about this module's capabilities */
  getSystemPrompt: () => string;
  /** Regex patterns for detecting tool calls in LLM text responses */
  actionPatterns: ActionPattern[];
  /** Called once at startup to initialize resources (OAuth, connections, etc.) */
  initialize?: () => Promise<void>;
  /** Called at shutdown to release resources */
  cleanup?: () => Promise<void>;
  /** Whether this module is currently usable (e.g. user is authenticated) */
  isAvailable?: () => Promise<boolean>;
}

// =============================================================================
// Info types (for renderer/UI)
// =============================================================================

/** Serializable module info for the renderer */
export interface ModuleInfo {
  name: string;
  displayName: string;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
}

/** Serializable action pattern for IPC transfer (RegExp can't cross IPC) */
export interface SerializedActionPattern {
  moduleName: string;
  toolName: string;
  pattern: string;
  flags: string;
}
