/**
 * Common LLM Provider Types
 *
 * Shared interfaces for LLM integration. Provider adapters implement
 * the LLMProvider interface so recipes stay provider-agnostic.
 */

import type { MCPTool } from "../MCPClient";

// =============================================================================
// Message Types
// =============================================================================

/** An image attached to a message (e.g. from an MCP tool result) */
export interface MessageImage {
  /** MIME type, e.g. "image/png" */
  mimeType: string;
  /** Base64-encoded image data (no data: URI prefix) */
  base64: string;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  /** Optional images carried by this message (tool results can return images) */
  images?: MessageImage[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// =============================================================================
// Provider Interface
// =============================================================================

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export interface LLMProviderOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Abstract interface all LLM providers must implement.
 * Recipes depend only on this interface, never on a specific provider.
 */
export interface LLMProvider {
  /**
   * Send a conversation with available tools and get a response.
   * If the LLM wants to call tools, they'll be in `toolCalls`.
   */
  chat(
    messages: Message[],
    tools: MCPTool[],
    options?: LLMProviderOptions,
  ): Promise<LLMResponse>;
}
