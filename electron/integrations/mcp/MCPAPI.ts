import { ipcRenderer, IpcRendererEvent } from "electron";

// =============================================================================
// Type Definitions
// =============================================================================

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

interface MCPServerConfig {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
}

interface MCPServer {
  name: string;
  transport: string;
  initialized: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

interface MCPResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// =============================================================================
// MCP API
// =============================================================================

export const mcpAPI = {
  // Server management
  connect: (config: MCPServerConfig): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:connect", config);
  },

  disconnect: (serverName: string): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:disconnect", serverName);
  },

  listServers: (): Promise<MCPServer[]> => {
    return ipcRenderer.invoke("mcp:list-servers");
  },

  // Tool operations
  callTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPResult<MCPToolResult>> => {
    return ipcRenderer.invoke("mcp:call-tool", serverName, toolName, args);
  },

  // Resource operations
  readResource: (serverName: string, uri: string): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:read-resource", serverName, uri);
  },

  // Prompt operations
  getPrompt: (
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ): Promise<MCPResult> => {
    return ipcRenderer.invoke("mcp:get-prompt", serverName, promptName, args);
  },

  // Event listeners
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
};
