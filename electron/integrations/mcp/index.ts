/**
 * Electron Main Process - MCP Client Integration
 *
 * This demonstrates how to integrate MCP (Model Context Protocol) into an Electron app.
 * The main process handles MCP server connections and exposes them to the renderer via IPC.
 *
 * Supports:
 * - STDIO transport (local MCP servers)
 * - Streamable HTTP transport (remote MCP servers like Open WebUI)
 * - Multiple concurrent server connections
 */

import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as readline from "readline";

// =============================================================================
// Type Definitions
// =============================================================================

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

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

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface MCPServerConnection {
  config: MCPServerConfig;
  process?: ChildProcess;
  requestId: number;
  pendingRequests: Map<number, PendingRequest>;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  initialized: boolean;
}

// ============ MCP CLIENT CLASS ============

class MCPClient {
  private connections: Map<string, MCPServerConnection> = new Map();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // ============ STDIO TRANSPORT ============

  async connectStdio(config: MCPServerConfig): Promise<void> {
    if (!config.command) {
      throw new Error("STDIO transport requires a command");
    }

    console.log(`[MCP] Connecting to ${config.name} via STDIO...`);

    const connection: MCPServerConnection = {
      config,
      requestId: 0,
      pendingRequests: new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false,
    };

    // Spawn the MCP server process
    const childProcess = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    connection.process = childProcess;

    // Handle stdout (JSON-RPC responses)
    const rl = readline.createInterface({
      input: childProcess.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line: string) => {
      try {
        const message = JSON.parse(line) as
          | JsonRpcResponse
          | JsonRpcNotification;
        this.handleMessage(config.name, message);
      } catch (error) {
        console.error(
          `[MCP] Failed to parse message from ${config.name}:`,
          error,
        );
      }
    });

    // Handle stderr (logging)
    childProcess.stderr?.on("data", (data: Buffer) => {
      console.log(`[MCP] ${config.name} stderr:`, data.toString());
    });

    // Handle process exit
    childProcess.on("exit", (code: number | null) => {
      console.log(`[MCP] ${config.name} exited with code ${code}`);
      this.connections.delete(config.name);
      this.notifyRenderer("mcp:server-disconnected", {
        name: config.name,
        code,
      });
    });

    childProcess.on("error", (error: Error) => {
      console.error(`[MCP] ${config.name} error:`, error);
      this.notifyRenderer("mcp:server-error", {
        name: config.name,
        error: error.message,
      });
    });

    this.connections.set(config.name, connection);

    // Initialize the connection
    await this.initializeConnection(config.name);
  }

  // ============ HTTP TRANSPORT ============

  async connectHttp(config: MCPServerConfig): Promise<void> {
    if (!config.url) {
      throw new Error("HTTP transport requires a URL");
    }

    console.log(
      `[MCP] Connecting to ${config.name} via HTTP at ${config.url}...`,
    );

    const connection: MCPServerConnection = {
      config,
      requestId: 0,
      pendingRequests: new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false,
    };

    this.connections.set(config.name, connection);

    // Initialize the connection
    await this.initializeConnection(config.name);
  }

  // ============ CONNECTION MANAGEMENT ============

  private async initializeConnection(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);

    // Send initialize request
    const initResult = await this.sendRequest(serverName, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: "electron-mcp-client",
        version: "1.0.0",
      },
    });

    console.log(`[MCP] ${serverName} initialized:`, initResult);

    // Send initialized notification
    await this.sendNotification(serverName, "notifications/initialized", {});

    connection.initialized = true;

    // Fetch capabilities
    await this.refreshCapabilities(serverName);

    this.notifyRenderer("mcp:server-connected", {
      name: serverName,
      tools: connection.tools,
      resources: connection.resources,
      prompts: connection.prompts,
    });
  }

  async refreshCapabilities(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);

    // Fetch tools
    try {
      const toolsResult = (await this.sendRequest(
        serverName,
        "tools/list",
        {},
      )) as { tools: MCPTool[] };
      connection.tools = toolsResult.tools || [];
      console.log(
        `[MCP] ${serverName} tools:`,
        connection.tools.map((t: MCPTool) => t.name),
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support tools`);
    }

    // Fetch resources
    try {
      const resourcesResult = (await this.sendRequest(
        serverName,
        "resources/list",
        {},
      )) as { resources: MCPResource[] };
      connection.resources = resourcesResult.resources || [];
      console.log(
        `[MCP] ${serverName} resources:`,
        connection.resources.map((r: MCPResource) => r.uri),
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support resources`);
    }

    // Fetch prompts
    try {
      const promptsResult = (await this.sendRequest(
        serverName,
        "prompts/list",
        {},
      )) as { prompts: MCPPrompt[] };
      connection.prompts = promptsResult.prompts || [];
      console.log(
        `[MCP] ${serverName} prompts:`,
        connection.prompts.map((p: MCPPrompt) => p.name),
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support prompts`);
    }
  }

  async disconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    if (connection.process) {
      connection.process.kill();
    }

    this.connections.delete(serverName);
    console.log(`[MCP] Disconnected from ${serverName}`);
  }

  async disconnectAll(): Promise<void> {
    for (const name of this.connections.keys()) {
      await this.disconnect(name);
    }
  }

  // ============ MESSAGE HANDLING ============

  private async sendRequest(
    serverName: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);

    const id = ++connection.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      connection.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);

      // Send via appropriate transport
      if (connection.config.transport === "stdio" && connection.process) {
        connection.process.stdin?.write(JSON.stringify(request) + "\n");
      } else if (connection.config.transport === "http") {
        this.sendHttpRequest(connection, request)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            clearTimeout(timeout);
            connection.pendingRequests.delete(id);
          });
        return; // HTTP handles its own promise resolution
      }

      // For STDIO, the response comes via handleMessage
      const originalResolve = connection.pendingRequests.get(id)!.resolve;
      connection.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  private async sendHttpRequest(
    connection: MCPServerConnection,
    request: JsonRpcRequest,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (connection.config.apiKey) {
      headers["Authorization"] = `Bearer ${connection.config.apiKey}`;
    }

    const response = await fetch(connection.config.url!, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as JsonRpcResponse;

    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }

    return result.result;
  }

  private async sendNotification(
    serverName: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);

    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    if (connection.config.transport === "stdio" && connection.process) {
      connection.process.stdin?.write(JSON.stringify(notification) + "\n");
    } else if (connection.config.transport === "http") {
      // HTTP notifications are fire-and-forget
      fetch(connection.config.url!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connection.config.apiKey && {
            Authorization: `Bearer ${connection.config.apiKey}`,
          }),
        },
        body: JSON.stringify(notification),
      }).catch(console.error);
    }
  }

  private handleMessage(
    serverName: string,
    message: JsonRpcResponse | JsonRpcNotification,
  ): void {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    // Check if it's a response (has id)
    if ("id" in message && message.id !== null) {
      const pending = connection.pendingRequests.get(message.id);
      if (pending) {
        connection.pendingRequests.delete(message.id);
        if ((message as JsonRpcResponse).error) {
          pending.reject(
            new Error((message as JsonRpcResponse).error!.message),
          );
        } else {
          pending.resolve((message as JsonRpcResponse).result);
        }
      }
    } else {
      // It's a notification
      this.handleNotification(serverName, message as JsonRpcNotification);
    }
  }

  private handleNotification(
    serverName: string,
    notification: JsonRpcNotification,
  ): void {
    console.log(`[MCP] ${serverName} notification:`, notification.method);

    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/resources/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/prompts/list_changed":
        this.refreshCapabilities(serverName);
        break;
      default:
        this.notifyRenderer("mcp:notification", {
          server: serverName,
          method: notification.method,
          params: notification.params,
        });
    }
  }

  private notifyRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  // ============ PUBLIC API (exposed via IPC) ============

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    console.log(`[MCP] Calling tool ${toolName} on ${serverName}`);
    return this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  async readResource(serverName: string, uri: string): Promise<unknown> {
    console.log(`[MCP] Reading resource ${uri} from ${serverName}`);
    return this.sendRequest(serverName, "resources/read", { uri });
  }

  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ): Promise<unknown> {
    console.log(`[MCP] Getting prompt ${promptName} from ${serverName}`);
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args,
    });
  }

  getServers(): Array<{
    name: string;
    transport: string;
    initialized: boolean;
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
  }> {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      transport: conn.config.transport,
      initialized: conn.initialized,
      tools: conn.tools,
      resources: conn.resources,
      prompts: conn.prompts,
    }));
  }
}

// ============ MCP CLIENT INSTANCE ============

const mcpClient = new MCPClient();

// ============ IPC HANDLERS ============

// Connect to MCP server
ipcMain.handle("mcp:connect", async (_event, config: MCPServerConfig) => {
  try {
    if (config.transport === "stdio") {
      await mcpClient.connectStdio(config);
    } else {
      await mcpClient.connectHttp(config);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Disconnect from MCP server
ipcMain.handle("mcp:disconnect", async (_event, serverName: string) => {
  try {
    await mcpClient.disconnect(serverName);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// List connected servers
ipcMain.handle("mcp:list-servers", () => {
  return mcpClient.getServers();
});

// Call a tool
ipcMain.handle(
  "mcp:call-tool",
  async (
    _event,
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    try {
      const result = await mcpClient.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

// Read a resource
ipcMain.handle(
  "mcp:read-resource",
  async (_event, serverName: string, uri: string) => {
    try {
      const result = await mcpClient.readResource(serverName, uri);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

// Get a prompt
ipcMain.handle(
  "mcp:get-prompt",
  async (
    _event,
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ) => {
    try {
      const result = await mcpClient.getPrompt(serverName, promptName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

export { mcpClient };
