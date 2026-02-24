/**
 * Anthropic Provider Adapter
 *
 * Implements the LLMProvider interface using the Anthropic Messages API.
 */

import { mcpToolsToAnthropic } from "../MCPClient";
import type { MCPTool } from "../MCPClient";
import type {
  LLMProvider,
  LLMResponse,
  LLMProviderOptions,
  Message,
  ToolCall,
} from "./types";

// =============================================================================
// Anthropic-specific types
// =============================================================================

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
}

// =============================================================================
// Provider
// =============================================================================

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private apiVersion: string;

  constructor(
    apiKey: string,
    defaultModel = "claude-sonnet-4-20250514",
    apiVersion = "2023-06-01",
  ) {
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.apiVersion = apiVersion;
  }

  async chat(
    messages: Message[],
    tools: MCPTool[],
    options?: LLMProviderOptions,
  ): Promise<LLMResponse> {
    // Extract system message
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";

    // Convert messages to Anthropic format
    const anthropicMessages: AnthropicMessage[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => this.convertMessage(m));

    const body: Record<string, unknown> = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: anthropicMessages,
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    if (tools.length > 0) {
      body.tools = mcpToolsToAnthropic(tools);
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    // Extract text content
    const textContent = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");

    // Extract tool calls
    const toolUses = data.content.filter((c) => c.type === "tool_use");
    let toolCalls: ToolCall[] | undefined;

    if (toolUses.length > 0) {
      toolCalls = toolUses.map((tu) => ({
        id: tu.id!,
        name: tu.name!,
        arguments: (tu.input as Record<string, unknown>) || {},
      }));
    }

    return {
      content: textContent,
      toolCalls,
    };
  }

  private convertMessage(m: Message): AnthropicMessage {
    if (m.role === "tool") {
      // Tool results are sent as user messages in Anthropic's format
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id,
            content: m.content,
          },
        ],
      };
    }

    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      // Assistant message with tool calls
      const content: AnthropicContentBlock[] = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      return { role: "assistant", content };
    }

    return {
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    };
  }
}
