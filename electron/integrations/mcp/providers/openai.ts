/**
 * OpenAI Provider Adapter
 *
 * Implements the LLMProvider interface using the OpenAI Chat Completions API.
 */

import { mcpToolsToOpenAI } from "../MCPClient";
import type { MCPTool } from "../MCPClient";
import type {
  LLMProvider,
  LLMResponse,
  LLMProviderOptions,
  Message,
  ToolCall,
} from "./types";

// =============================================================================
// OpenAI-specific types
// =============================================================================

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: OpenAIMessage;
  }>;
}

// =============================================================================
// Provider
// =============================================================================

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = "gpt-4-turbo-preview") {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async chat(
    messages: Message[],
    tools: MCPTool[],
    options?: LLMProviderOptions,
  ): Promise<LLMResponse> {
    // Convert messages to OpenAI format
    const openaiMessages: OpenAIMessage[] = messages.map((m) => {
      const msg: OpenAIMessage = {
        role: m.role,
        content: m.content,
      };
      if (m.tool_calls) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }
      if (m.tool_call_id) {
        msg.tool_call_id = m.tool_call_id;
      }
      return msg;
    });

    const body: Record<string, unknown> = {
      model: options?.model ?? this.defaultModel,
      messages: openaiMessages,
    };

    if (tools.length > 0) {
      body.tools = mcpToolsToOpenAI(tools);
      body.tool_choice = "auto";
    }

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices[0];

    // Convert tool calls to common format
    let toolCalls: ToolCall[] | undefined;
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      toolCalls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));
    }

    return {
      content: choice.message.content || "",
      toolCalls,
    };
  }
}
