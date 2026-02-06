/**
 * MCP API — Renderer Bridge
 *
 * Exposes MCP operations to the renderer process via Electron IPC.
 * This file is used in the preload script (contextBridge.exposeInMainWorld).
 *
 * All methods return promises and match the IPC handlers in index.ts.
 */

import { ipcRenderer, IpcRendererEvent } from "electron";

// =============================================================================
// Type Definitions
// =============================================================================

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPServerConfig {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
}

export interface MCPServer {
  name: string;
  transport: string;
  initialized: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export interface MCPResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface AgentResult {
  success: boolean;
  content?: string;
  iterations?: number;
  error?: string;
}

// =============================================================================
// MCP API
// =============================================================================

export const mcpAPI = {
  // ===========================================================================
  // Server Management
  // ===========================================================================

  connect: (config: MCPServerConfig): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:connect", config);
  },

  disconnect: (serverName: string): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:disconnect", serverName);
  },

  listServers: (): Promise<MCPServer[]> => {
    return ipcRenderer.invoke("mcp:list-servers");
  },

  // ===========================================================================
  // Tool Operations
  // ===========================================================================

  callTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPResult<MCPToolResult>> => {
    return ipcRenderer.invoke("mcp:call-tool", serverName, toolName, args);
  },

  listTools: (
    serverName: string,
  ): Promise<MCPResult<{ tools: MCPTool[] }>> => {
    return ipcRenderer.invoke("mcp:list-tools", serverName);
  },

  // ===========================================================================
  // Resource Operations
  // ===========================================================================

  readResource: (serverName: string, uri: string): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:read-resource", serverName, uri);
  },

  listResources: (
    serverName: string,
  ): Promise<MCPResult<{ resources: MCPResource[] }>> => {
    return ipcRenderer.invoke("mcp:list-resources", serverName);
  },

  // ===========================================================================
  // Prompt Operations
  // ===========================================================================

  getPrompt: (
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:get-prompt", serverName, promptName, args);
  },

  listPrompts: (
    serverName: string,
  ): Promise<MCPResult<{ prompts: MCPPrompt[] }>> => {
    return ipcRenderer.invoke("mcp:list-prompts", serverName);
  },

  // ===========================================================================
  // Agent Loop (runs in main process)
  // ===========================================================================

  runAgent: (request: {
    query: string;
    serverNames: string[];
    provider: "openai" | "anthropic";
    model?: string;
    systemPrompt?: string;
    maxIterations?: number;
  }): Promise<AgentResult> => {
    return ipcRenderer.invoke("mcp:run-agent", request);
  },

  // ===========================================================================
  // Event Listeners
  // ===========================================================================

  onServerConnected: (
    callback: (data: {
      name: string;
      tools: MCPTool[];
      resources: MCPResource[];
      prompts: MCPPrompt[];
    }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(
        data as {
          name: string;
          tools: MCPTool[];
          resources: MCPResource[];
          prompts: MCPPrompt[];
        },
      );
    ipcRenderer.on("mcp:server-connected", listener);
    return () => ipcRenderer.removeListener("mcp:server-connected", listener);
  },

  onServerDisconnected: (
    callback: (data: { name: string; code: number }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { name: string; code: number });
    ipcRenderer.on("mcp:server-disconnected", listener);
    return () =>
      ipcRenderer.removeListener("mcp:server-disconnected", listener);
  },

  onServerError: (
    callback: (data: { name: string; error: string }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { name: string; error: string });
    ipcRenderer.on("mcp:server-error", listener);
    return () => ipcRenderer.removeListener("mcp:server-error", listener);
  },

  onNotification: (
    callback: (data: {
      server: string;
      method: string;
      params: unknown;
    }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { server: string; method: string; params: unknown });
    ipcRenderer.on("mcp:notification", listener);
    return () => ipcRenderer.removeListener("mcp:notification", listener);
  },

  onToolsChanged: (
    callback: (data: { name: string; tools: MCPTool[] }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { name: string; tools: MCPTool[] });
    ipcRenderer.on("mcp:tools-changed", listener);
    return () => ipcRenderer.removeListener("mcp:tools-changed", listener);
  },

  onResourcesChanged: (
    callback: (data: { name: string; resources: MCPResource[] }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { name: string; resources: MCPResource[] });
    ipcRenderer.on("mcp:resources-changed", listener);
    return () =>
      ipcRenderer.removeListener("mcp:resources-changed", listener);
  },

  /** Live tool result events from the agent loop */
  onAgentToolResult: (
    callback: (data: {
      toolName: string;
      result: string;
      server: string;
    }) => void,
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(
        data as { toolName: string; result: string; server: string },
      );
    ipcRenderer.on("mcp:agent-tool-result", listener);
    return () =>
      ipcRenderer.removeListener("mcp:agent-tool-result", listener);
  },

  /** Live text events from the agent loop */
  onAgentText: (callback: (data: { text: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as { text: string });
    ipcRenderer.on("mcp:agent-text", listener);
    return () => ipcRenderer.removeListener("mcp:agent-text", listener);
  },
};
