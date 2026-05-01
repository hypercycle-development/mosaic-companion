/**
 * Recipe: Prompt Chaining
 *
 * Uses MCP prompts to dynamically build conversation context for LLMs.
 * MCP prompts are server-defined templates that can inject domain-specific
 * instructions, examples, or context into conversations.
 *
 * Usage:
 *   import { buildPromptContext, chainPrompts } from './recipes/promptChaining';
 *
 *   // Get a single prompt and use it as system context
 *   const context = await buildPromptContext(mcp, 'my-server', 'code-review', {
 *     language: 'typescript',
 *   });
 *   // Use context.messages as the conversation prefix
 *
 *   // Chain multiple prompts together
 *   const messages = await chainPrompts(mcp, [
 *     { server: 'my-server', prompt: 'persona', args: { role: 'senior-dev' } },
 *     { server: 'my-server', prompt: 'code-review', args: { language: 'ts' } },
 *   ]);
 */

import type { MCPClient, MCPContent, MCPPrompt } from "../MCPClient";
import type { Message } from "../providers/types";

// =============================================================================
// Types
// =============================================================================

export interface PromptRef {
  server: string;
  prompt: string;
  args?: Record<string, string>;
}

export interface PromptContext {
  description?: string;
  messages: Message[];
}

// =============================================================================
// Single Prompt
// =============================================================================

/**
 * Fetch an MCP prompt and convert it to LLM-ready messages.
 */
export async function buildPromptContext(
  mcp: MCPClient,
  serverName: string,
  promptName: string,
  args: Record<string, string> = {},
): Promise<PromptContext> {
  const result = await mcp.getPrompt(serverName, promptName, args);

  const messages: Message[] = result.messages.map((m) => ({
    role: m.role,
    content: mcpContentToString(m.content),
  }));

  return {
    description: result.description,
    messages,
  };
}

// =============================================================================
// Prompt Chaining
// =============================================================================

/**
 * Chain multiple MCP prompts together into a single message sequence.
 * Prompts are resolved in order and concatenated.
 *
 * If multiple prompts produce "system"-like user messages, they're merged
 * into a coherent conversation prefix.
 */
export async function chainPrompts(
  mcp: MCPClient,
  prompts: PromptRef[],
): Promise<Message[]> {
  const allMessages: Message[] = [];

  for (const ref of prompts) {
    const context = await buildPromptContext(
      mcp,
      ref.server,
      ref.prompt,
      ref.args,
    );
    allMessages.push(...context.messages);
  }

  return allMessages;
}

/**
 * Build a complete conversation by combining MCP prompts with a user query.
 * Useful as the input to an agent loop or a single LLM call.
 */
export async function buildConversation(
  mcp: MCPClient,
  prompts: PromptRef[],
  userQuery: string,
  systemPrompt?: string,
): Promise<Message[]> {
  const messages: Message[] = [];

  // Optional system prompt
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Chain MCP prompts as conversation context
  const promptMessages = await chainPrompts(mcp, prompts);
  messages.push(...promptMessages);

  // Add the user's actual query
  messages.push({ role: "user", content: userQuery });

  return messages;
}

// =============================================================================
// Prompt Discovery
// =============================================================================

/**
 * List all prompts across all connected servers
 */
export async function discoverPrompts(
  mcp: MCPClient,
): Promise<Array<MCPPrompt & { _serverName: string }>> {
  const allPrompts: Array<MCPPrompt & { _serverName: string }> = [];

  for (const server of mcp.getConnectedServers()) {
    const prompts = await mcp.listPrompts(server);
    for (const prompt of prompts) {
      allPrompts.push({ ...prompt, _serverName: server });
    }
  }

  return allPrompts;
}

/**
 * Find a prompt by name across all servers. Returns the first match.
 */
export async function findPrompt(
  mcp: MCPClient,
  promptName: string,
): Promise<{ server: string; prompt: MCPPrompt } | null> {
  for (const server of mcp.getConnectedServers()) {
    const prompts = await mcp.listPrompts(server);
    const found = prompts.find((p) => p.name === promptName);
    if (found) {
      return { server, prompt: found };
    }
  }
  return null;
}

// =============================================================================
// Helpers
// =============================================================================

function mcpContentToString(content: MCPContent): string {
  if (content.type === "text" && content.text) {
    return content.text;
  }
  if (content.type === "image" && content.data) {
    return `[Image: ${content.mimeType || "image"}]`;
  }
  if (content.type === "resource" && content.text) {
    return content.text;
  }
  return "";
}
