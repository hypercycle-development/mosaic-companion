/**
 * Recipe: Agent Loop
 *
 * A provider-agnostic agent loop that lets an LLM discover and call MCP tools.
 * Works with any provider that implements the LLMProvider interface.
 *
 * Usage:
 *   import { runAgentLoop } from './recipes/agentLoop';
 *   import { OpenAIProvider } from './providers/openai';
 *
 *   const provider = new OpenAIProvider(process.env.OPENAI_API_KEY!);
 *   const result = await runAgentLoop(mcp, provider, ['my-server'], 'What time is it in Tokyo?');
 */

import type { MCPClient, MCPTool, MCPToolResult } from "../MCPClient";
import { mcpResultToString } from "../MCPClient";
import type { LLMProvider, Message, MessageImage, ToolCall } from "../providers/types";

// =============================================================================
// Options
// =============================================================================

export interface AgentLoopOptions {
  /** Max tool-call iterations before stopping (default: 10) */
  maxIterations?: number;
  /** System prompt prepended to conversation (default: auto-generated from tools) */
  systemPrompt?: string;
  /** Called before each tool call — return false to skip/block it */
  onBeforeToolCall?: (
    toolName: string,
    args: Record<string, unknown>,
    serverName: string,
  ) => Promise<boolean> | boolean;
  /** Called after each tool call with the result */
  onToolResult?: (
    toolName: string,
    result: string,
    serverName: string,
  ) => void;
  /** Called on each iteration with the full message history */
  onIteration?: (iteration: number, messages: Message[]) => void;
  /** Called when the LLM responds with text (may happen multiple times) */
  onText?: (text: string) => void;
}

// =============================================================================
// Agent Loop
// =============================================================================

/**
 * Run an agentic conversation loop.
 *
 * The LLM receives the user query + all available MCP tools, then iteratively
 * calls tools until it has enough information to respond, or maxIterations is hit.
 */
export async function runAgentLoop(
  mcp: MCPClient,
  provider: LLMProvider,
  serverNames: string[],
  userQuery: string,
  options: AgentLoopOptions = {},
): Promise<{ content: string; messages: Message[]; iterations: number }> {
  const {
    maxIterations = 10,
    onBeforeToolCall,
    onToolResult,
    onIteration,
    onText,
  } = options;

  // Gather all tools and build routing map
  const toolMap = new Map<string, string>(); // toolName → serverName
  const allTools: MCPTool[] = [];

  for (const serverName of serverNames) {
    const tools = await mcp.listTools(serverName);
    for (const tool of tools) {
      if (toolMap.has(tool.name)) {
        // Prefix with server name to avoid collisions
        const prefixed = `${serverName}__${tool.name}`;
        toolMap.set(prefixed, serverName);
        allTools.push({ ...tool, name: prefixed });
      } else {
        toolMap.set(tool.name, serverName);
        allTools.push(tool);
      }
    }
  }

  // Build system prompt
  const systemPrompt =
    options.systemPrompt ??
    buildDefaultSystemPrompt(allTools);

  // Initialize conversation
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userQuery },
  ];

  // Agent loop
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    onIteration?.(iteration, messages);

    const response = await provider.chat(messages, allTools);

    // Build assistant message
    const assistantMessage: Message = {
      role: "assistant",
      content: response.content,
    };

    if (response.toolCalls && response.toolCalls.length > 0) {
      assistantMessage.tool_calls = response.toolCalls;
    }

    messages.push(assistantMessage);

    if (response.content) {
      onText?.(response.content);
    }

    // If no tool calls, the agent is done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return { content: response.content, messages, iterations: iteration };
    }

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      const outcome = await executeToolCall(
        mcp,
        toolMap,
        toolCall,
        onBeforeToolCall,
        onToolResult,
      );

      messages.push({
        role: "tool",
        content: outcome.text,
        tool_call_id: toolCall.id,
        ...(outcome.images.length > 0 ? { images: outcome.images } : {}),
      });
    }
  }

  // Max iterations reached — return whatever we have
  const lastAssistant = messages
    .filter((m) => m.role === "assistant")
    .pop();

  return {
    content:
      lastAssistant?.content ||
      "[Agent reached maximum iterations without a final response]",
    messages,
    iterations: maxIterations,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract image blocks from an MCP tool result (base64 + mime type) */
function extractImages(result: MCPToolResult): MessageImage[] {
  if (!result?.content) return [];
  const images: MessageImage[] = [];
  for (const c of result.content) {
    if (c.type === "image" && typeof c.data === "string" && c.data.length > 0) {
      images.push({ mimeType: c.mimeType || "image/png", base64: c.data });
    }
  }
  return images;
}

interface ToolCallOutcome {
  text: string;
  images: MessageImage[];
}

async function executeToolCall(
  mcp: MCPClient,
  toolMap: Map<string, string>,
  toolCall: ToolCall,
  onBeforeToolCall?: AgentLoopOptions["onBeforeToolCall"],
  onToolResult?: AgentLoopOptions["onToolResult"],
): Promise<ToolCallOutcome> {
  // Resolve which server owns this tool
  const serverName = toolMap.get(toolCall.name);
  if (!serverName) {
    return { text: `Error: Unknown tool "${toolCall.name}"`, images: [] };
  }

  // Strip server prefix if we added one
  const actualToolName = toolCall.name.includes("__")
    ? toolCall.name.split("__").slice(1).join("__")
    : toolCall.name;

  // Gate-check: let caller approve/deny the call
  if (onBeforeToolCall) {
    const approved = await onBeforeToolCall(
      actualToolName,
      toolCall.arguments,
      serverName,
    );
    if (!approved) {
      return {
        text: `Tool call "${actualToolName}" was blocked by user.`,
        images: [],
      };
    }
  }

  try {
    const result = await mcp.callTool(serverName, actualToolName, toolCall.arguments);
    const resultText = mcpResultToString(result);
    const resultImages = extractImages(result);

    onToolResult?.(actualToolName, resultText, serverName);

    if (result.isError) {
      return { text: `Tool error: ${resultText}`, images: [] };
    }

    return { text: resultText, images: resultImages };
  } catch (error) {
    const errorMsg = `Tool execution error: ${(error as Error).message}`;
    return { text: errorMsg, images: [] };
  }
}

function buildDefaultSystemPrompt(tools: MCPTool[]): string {
  const toolDescriptions = tools
    .map((t) => `- ${t.name}: ${t.description || "No description"}`)
    .join("\n");

  return `You are a helpful assistant with access to tools. Use them to help answer the user's questions.

Available tools:
${toolDescriptions}

When you need information or need to perform an action, use the appropriate tool. You can call multiple tools in sequence. Once you have enough information, provide a clear, helpful answer.`;
}
