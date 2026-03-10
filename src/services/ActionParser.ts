// ActionParser.ts — Parse AI responses for <use_tool> invocations and route
// them to the ToolRegistry (built-in tools) or MCP servers (external tools).
//
// All tools — Gmail, Web3, Vault, MCP, WASM — use the same <use_tool> format.

export type ActionType = "TOOL_CALL" | "NONE";

export interface ParsedAction {
  type: ActionType;
  params?: { server: string; tool: string; args: Record<string, unknown> };
  cleanResponse: string;
  rawTag?: string;
}

/**
 * Parse an AI response for a <use_tool> invocation.
 * Returns the parsed tool call or NONE if no invocation found.
 */
export function parseAction(response: string): ParsedAction {
  const match = response.match(
    /<use_tool\s+server="([^"]+)"\s+tool="([^"]+)">([\s\S]*?)<\/use_tool>/,
  );

  if (match) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(match[3]);
    } catch {
      console.error("[ActionParser] Failed to parse tool args:", match[3]);
    }

    return {
      type: "TOOL_CALL",
      params: { server: match[1], tool: match[2], args },
      cleanResponse: response.replace(/<use_tool[\s\S]*?<\/use_tool>/, "").trim(),
      rawTag: match[0],
    };
  }

  return { type: "NONE", cleanResponse: response };
}

/**
 * Execute a tool call.
 *
 * Routes to the built-in ToolRegistry first (Gmail, Web3, Vault, WASM tools).
 * Falls back to MCP servers if the module isn't found in the registry.
 */
export async function executeToolCall(action: ParsedAction, agentId?: string): Promise<string> {
  if (action.type !== "TOOL_CALL" || !action.params) {
    return "Invalid tool action";
  }

  const { server, tool, args } = action.params;
  const context = agentId ? { agentId } : undefined;

  // 1. Try built-in ToolRegistry first
  try {
    const fullToolName = `${server}:${tool}`;
    const registryResult = await (window as any).electronAPI?.tools?.execute?.(fullToolName, args || {}, context);
    if (registryResult && registryResult.success !== undefined) {
      if (registryResult.success) {
        const data = registryResult.data;
        return typeof data === "string" ? data : JSON.stringify(data, null, 2);
      }
      // "not found" means the module doesn't exist in the registry — try MCP
      if (registryResult.error?.includes("not found")) {
        // Fall through to MCP
      } else {
        return `Error: ${registryResult.error}`;
      }
    }
  } catch (e) {
    console.warn(`[ActionParser] Built-in tool ${server}:${tool} failed, trying MCP:`, e);
  }

  // 2. Fall back to MCP server
  try {
    const result = await window.electronAPI.mcpAPI.callTool(server, tool, args);
    if (result.success) {
      return JSON.stringify(result.result, null, 2);
    } else {
      return `Error calling tool ${tool}: ${result.error}`;
    }
  } catch (e) {
    return `Error calling tool ${tool}: ${(e as Error).message}`;
  }
}

/**
 * Generate system prompt for MCP tools (external servers).
 * Built-in tools get their prompts from ToolRegistry.getSystemPrompt().
 */
export function getMCPSystemPrompt(servers: any[]): string {
  if (!servers || servers.length === 0) return "";

  let prompt = "You have access to the following tools. To use a tool, output its XML tag.\n\n";
  prompt += "CRITICAL RULES:\n";
  prompt += "1. When you want to use a tool, output ONLY a short intro sentence, then the <use_tool> XML tag.\n";
  prompt += "2. You MUST stop writing IMMEDIATELY after the closing </use_tool> tag. Do NOT continue with any text, answers, or guesses.\n";
  prompt += "3. NEVER guess or hallucinate tool results. Wait for the actual tool output before responding.\n";
  prompt += "4. After you receive the [Tool Output], use that data to write your final response to the user.\n\n";

  servers.forEach((server) => {
    if (!server.tools || server.tools.length === 0) return;
    prompt += `Server: ${server.name}\n`;
    server.tools.forEach((tool: any) => {
      prompt += `- Tool: ${tool.name}\n  Description: ${tool.description || "No description"}\n  Input Schema: ${JSON.stringify(tool.inputSchema)}\n`;
      prompt += `  Usage: <use_tool server="${server.name}" tool="${tool.name}">JSON_ARGS</use_tool>\n\n`;
    });
  });

  return prompt;
}

/**
 * Check if Gmail is authenticated.
 */
export async function isGmailAuthenticated(): Promise<boolean> {
  try {
    const status = await window.electronAPI.gmail.getStatus();
    return status.authenticated;
  } catch {
    return false;
  }
}
