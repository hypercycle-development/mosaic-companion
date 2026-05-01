/**
 * Recipe: Multi-Server Fanout
 *
 * Patterns for querying tools across multiple MCP servers simultaneously.
 * Useful for:
 * - Aggregating data from multiple sources
 * - Running the same query against different backends
 * - Building a unified tool surface from many servers
 *
 * Usage:
 *   import { fanoutCall, unifiedToolSurface } from './recipes/multiServerFanout';
 *
 *   // Call the same tool on multiple servers in parallel
 *   const results = await fanoutCall(mcp, ['server-a', 'server-b'], 'search', {
 *     query: 'recent reports',
 *   });
 *
 *   // Build a single flat list of all tools across servers
 *   const surface = await unifiedToolSurface(mcp);
 */

import type { MCPClient, MCPTool, MCPToolResult } from "../MCPClient";
import { mcpResultToString } from "../MCPClient";

// =============================================================================
// Types
// =============================================================================

export interface FanoutResult {
  server: string;
  result?: string;
  raw?: MCPToolResult;
  error?: string;
  durationMs: number;
}

export interface UnifiedTool extends MCPTool {
  /** Which server this tool belongs to */
  serverName: string;
  /** Prefixed name for disambiguation (serverName__toolName) */
  qualifiedName: string;
}

// =============================================================================
// Fanout Call
// =============================================================================

/**
 * Call the same tool on multiple servers in parallel.
 * Returns results for each server, with errors captured (not thrown).
 */
export async function fanoutCall(
  mcp: MCPClient,
  serverNames: string[],
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<FanoutResult[]> {
  const promises = serverNames.map(async (server): Promise<FanoutResult> => {
    const start = Date.now();
    try {
      const raw = await mcp.callTool(server, toolName, args);
      return {
        server,
        result: mcpResultToString(raw),
        raw,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        server,
        error: (error as Error).message,
        durationMs: Date.now() - start,
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Race the same tool across servers — return the first successful result.
 * Useful when you have redundant servers and want the fastest response.
 */
export async function raceCall(
  mcp: MCPClient,
  serverNames: string[],
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<FanoutResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const errors: Error[] = [];

    for (const server of serverNames) {
      const start = Date.now();
      mcp
        .callTool(server, toolName, args)
        .then((raw) => {
          if (!settled) {
            settled = true;
            resolve({
              server,
              result: mcpResultToString(raw),
              raw,
              durationMs: Date.now() - start,
            });
          }
        })
        .catch((error) => {
          errors.push(error as Error);
          if (errors.length === serverNames.length && !settled) {
            reject(
              new Error(
                `All servers failed: ${errors.map((e) => e.message).join("; ")}`,
              ),
            );
          }
        });
    }
  });
}

// =============================================================================
// Unified Tool Surface
// =============================================================================

/**
 * Build a flat list of all tools from all connected servers.
 * Tools are qualified with server name to avoid collisions.
 */
export async function unifiedToolSurface(
  mcp: MCPClient,
): Promise<UnifiedTool[]> {
  const tools: UnifiedTool[] = [];
  const seen = new Set<string>();

  for (const server of mcp.getConnectedServers()) {
    const serverTools = await mcp.listTools(server);

    for (const tool of serverTools) {
      const needsPrefix = seen.has(tool.name);
      const qualifiedName = needsPrefix
        ? `${server}__${tool.name}`
        : tool.name;

      // If we already added an un-prefixed version that now collides,
      // retroactively prefix it
      if (seen.has(tool.name) && !needsPrefix) {
        const existing = tools.find((t) => t.name === tool.name);
        if (existing && !existing.qualifiedName.includes("__")) {
          existing.qualifiedName = `${existing.serverName}__${existing.name}`;
        }
      }

      seen.add(tool.name);

      tools.push({
        ...tool,
        serverName: server,
        qualifiedName,
      });
    }
  }

  return tools;
}

/**
 * Given a qualified tool name, resolve it to server + actual tool name
 */
export function resolveQualifiedTool(
  qualifiedName: string,
  tools: UnifiedTool[],
): { serverName: string; toolName: string } | null {
  const tool = tools.find((t) => t.qualifiedName === qualifiedName);
  if (!tool) return null;
  return { serverName: tool.serverName, toolName: tool.name };
}
