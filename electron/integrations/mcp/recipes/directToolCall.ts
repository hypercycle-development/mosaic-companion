/**
 * Recipe: Direct Tool Call
 *
 * The simplest MCP usage pattern: connect to a server, call a tool, get a result.
 * No LLM involved. Useful for scripted automation or when you know exactly
 * which tool to call.
 *
 * Usage:
 *   import { directToolCall } from './recipes/directToolCall';
 *
 *   const result = await directToolCall(mcp, 'my-server', 'get_weather', {
 *     location: 'Tokyo',
 *   });
 *   console.log(result); // "Sunny, 22°C"
 */

import type { MCPClient, MCPToolResult } from "../MCPClient";
import { mcpResultToString } from "../MCPClient";

// =============================================================================
// Simple Direct Call
// =============================================================================

/**
 * Call a single tool and return the string result
 */
export async function directToolCall(
  mcp: MCPClient,
  serverName: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await mcp.callTool(serverName, toolName, args);

  if (result.isError) {
    const errorText = mcpResultToString(result);
    throw new Error(`Tool "${toolName}" returned error: ${errorText}`);
  }

  return mcpResultToString(result);
}

/**
 * Call a tool and return the raw MCP result (for binary data, images, etc.)
 */
export async function directToolCallRaw(
  mcp: MCPClient,
  serverName: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<MCPToolResult> {
  return mcp.callTool(serverName, toolName, args);
}

// =============================================================================
// Batch Tool Calls
// =============================================================================

interface BatchToolCall {
  server: string;
  tool: string;
  args?: Record<string, unknown>;
}

interface BatchResult {
  server: string;
  tool: string;
  result?: string;
  error?: string;
}

/**
 * Call multiple tools in parallel and collect results.
 * Errors are captured per-call, not thrown.
 */
export async function batchToolCalls(
  mcp: MCPClient,
  calls: BatchToolCall[],
): Promise<BatchResult[]> {
  const promises = calls.map(async (call): Promise<BatchResult> => {
    try {
      const result = await directToolCall(mcp, call.server, call.tool, call.args);
      return { server: call.server, tool: call.tool, result };
    } catch (error) {
      return {
        server: call.server,
        tool: call.tool,
        error: (error as Error).message,
      };
    }
  });

  return Promise.all(promises);
}

// =============================================================================
// Discover and Call
// =============================================================================

/**
 * Find a tool by name across all connected servers and call it.
 * Throws if the tool is not found on any server.
 */
export async function findAndCallTool(
  mcp: MCPClient,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<{ server: string; result: string }> {
  const toolMap = await mcp.buildToolMap();
  const server = toolMap.get(toolName);

  if (!server) {
    const allServers = mcp.getConnectedServers();
    throw new Error(
      `Tool "${toolName}" not found on any server. ` +
        `Connected servers: ${allServers.join(", ")}`,
    );
  }

  const result = await directToolCall(mcp, server, toolName, args);
  return { server, result };
}
