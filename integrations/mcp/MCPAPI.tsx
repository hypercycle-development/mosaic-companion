import {
  MCPServerConfig,
  MCPResult,
  MCPServer,
  MCPToolResult,
  MCPTool,
  MCPResource,
  MCPPrompt,
} from "@/src/types/integrations/mcp";
import { ipcRenderer, IpcRendererEvent } from "electron";

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
    args: Record<string, unknown>
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
    args: Record<string, string>
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
    }) => void
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as any);
    ipcRenderer.on("mcp:server-connected", listener);
    return () => ipcRenderer.removeListener("mcp:server-connected", listener);
  },

  onServerDisconnected: (
    callback: (data: { name: string; code: number }) => void
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as any);
    ipcRenderer.on("mcp:server-disconnected", listener);
    return () =>
      ipcRenderer.removeListener("mcp:server-disconnected", listener);
  },

  onServerError: (
    callback: (data: { name: string; error: string }) => void
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as any);
    ipcRenderer.on("mcp:server-error", listener);
    return () => ipcRenderer.removeListener("mcp:server-error", listener);
  },

  onNotification: (
    callback: (data: {
      server: string;
      method: string;
      params: unknown;
    }) => void
  ) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      callback(data as any);
    ipcRenderer.on("mcp:notification", listener);
    return () => ipcRenderer.removeListener("mcp:notification", listener);
  },
};
