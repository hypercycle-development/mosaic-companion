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

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
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
