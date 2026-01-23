/**
 * Standalone MCP Client Library
 *
 * A TypeScript MCP client that can be used in any Node.js or Electron environment.
 * Supports both STDIO and HTTP transports.
 *
 * Usage:
 * ```typescript
 * import { MCPClient } from './mcp-client';
 *
 * const client = new MCPClient();
 *
 * // Connect to a local MCP server via STDIO
 * await client.connectStdio('my-server', 'python', ['server.py']);
 *
 * // Or connect to a remote server via HTTP
 * await client.connectHttp('remote-server', 'http://localhost:8000/mcp');
 *
 * // List tools
 * const tools = await client.listTools('my-server');
 *
 * // Call a tool
 * const result = await client.callTool('my-server', 'web_fetch', { url: 'https://example.com' });
 * ```
 */

import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import { EventEmitter } from "events";
import {
  MCPServerCapabilities,
  MCPClientOptions,
  MCPInitializeResult,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceTemplate,
  MCPContent,
  MCPPrompt,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from "@/src/types/integrations/mcp";

// ============ TYPE DEFINITIONS ============

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ServerConnection {
  transport: "stdio" | "http";
  process?: ChildProcess;
  url?: string;
  apiKey?: string;
  requestId: number;
  pendingRequests: Map<number | string, PendingRequest>;
  capabilities: MCPServerCapabilities;
  serverInfo?: { name: string; version: string };
  initialized: boolean;
}

// ============ MCP CLIENT ============

export class MCPClient extends EventEmitter {
  private connections: Map<string, ServerConnection> = new Map();
  private options: Required<MCPClientOptions>;

  constructor(options: MCPClientOptions = {}) {
    super();
    this.options = {
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
    };
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.error("[MCP]", ...args);
    }
  }

  // ============ CONNECTION MANAGEMENT ============

  /**
   * Connect to an MCP server via STDIO transport
   */
  async connectStdio(
    name: string,
    command: string,
    args: string[] = [],
    env?: Record<string, string>
  ): Promise<MCPInitializeResult> {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via STDIO: ${command} ${args.join(" ")}`);

    const connection: ServerConnection = {
      transport: "stdio",
      requestId: 0,
      pendingRequests: new Map(),
      capabilities: {},
      initialized: false,
    };

    // Spawn the process
    const childProcess = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    connection.process = childProcess;

    // Set up message handling
    const rl = readline.createInterface({
      input: childProcess.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      this.handleStdioMessage(name, line);
    });

    childProcess.stderr?.on("data", (data) => {
      this.log(`${name} stderr:`, data.toString().trim());
    });

    childProcess.on("exit", (code, signal) => {
      this.log(`${name} exited with code ${code}, signal ${signal}`);
      this.handleDisconnect(name, code ?? 0);
    });

    childProcess.on("error", (error) => {
      this.log(`${name} error:`, error);
      this.emit("error", { server: name, error });
    });

    this.connections.set(name, connection);

    // Initialize the connection
    return this.initializeConnection(name);
  }

  /**
   * Connect to an MCP server via HTTP transport (Streamable HTTP)
   */
  async connectHttp(
    name: string,
    url: string,
    apiKey?: string
  ): Promise<MCPInitializeResult> {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via HTTP: ${url}`);

    const connection: ServerConnection = {
      transport: "http",
      url,
      apiKey,
      requestId: 0,
      pendingRequests: new Map(),
      capabilities: {},
      initialized: false,
    };

    this.connections.set(name, connection);

    // Initialize the connection
    return this.initializeConnection(name);
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) return;

    if (connection.process) {
      connection.process.kill();
    }

    // Reject all pending requests
    for (const [id, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }

    this.connections.delete(name);
    this.log(`Disconnected from ${name}`);
    this.emit("disconnected", { server: name });
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.connections.keys());
    await Promise.all(names.map((name) => this.disconnect(name)));
  }

  /**
   * Check if a server is connected
   */
  isConnected(name: string): boolean {
    return (
      this.connections.has(name) && this.connections.get(name)!.initialized
    );
  }

  /**
   * Get list of connected servers
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  // ============ INITIALIZATION ============

  private async initializeConnection(
    name: string
  ): Promise<MCPInitializeResult> {
    const result = await this.sendRequest<MCPInitializeResult>(
      name,
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: "typescript-mcp-client",
          version: "1.0.0",
        },
      }
    );

    const connection = this.connections.get(name)!;
    connection.capabilities = result.capabilities;
    connection.serverInfo = result.serverInfo;

    // Send initialized notification
    await this.sendNotification(name, "notifications/initialized", {});

    connection.initialized = true;
    this.emit("connected", { server: name, capabilities: result });

    return result;
  }

  // ============ TOOLS ============

  /**
   * List available tools from a server
   */
  async listTools(serverName: string): Promise<MCPTool[]> {
    const result = await this.sendRequest<{ tools: MCPTool[] }>(
      serverName,
      "tools/list",
      {}
    );
    return result.tools || [];
  }

  /**
   * Call a tool on a server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<MCPToolResult> {
    return this.sendRequest<MCPToolResult>(serverName, "tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  // ============ RESOURCES ============

  /**
   * List available resources from a server
   */
  async listResources(serverName: string): Promise<MCPResource[]> {
    const result = await this.sendRequest<{ resources: MCPResource[] }>(
      serverName,
      "resources/list",
      {}
    );
    return result.resources || [];
  }

  /**
   * List resource templates from a server
   */
  async listResourceTemplates(
    serverName: string
  ): Promise<MCPResourceTemplate[]> {
    const result = await this.sendRequest<{
      resourceTemplates: MCPResourceTemplate[];
    }>(serverName, "resources/templates/list", {});
    return result.resourceTemplates || [];
  }

  /**
   * Read a resource from a server
   */
  async readResource(
    serverName: string,
    uri: string
  ): Promise<{ contents: MCPContent[] }> {
    return this.sendRequest(serverName, "resources/read", { uri });
  }

  // ============ PROMPTS ============

  /**
   * List available prompts from a server
   */
  async listPrompts(serverName: string): Promise<MCPPrompt[]> {
    const result = await this.sendRequest<{ prompts: MCPPrompt[] }>(
      serverName,
      "prompts/list",
      {}
    );
    return result.prompts || [];
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string> = {}
  ): Promise<{
    description?: string;
    messages: Array<{
      role: "user" | "assistant";
      content: MCPContent;
    }>;
  }> {
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args,
    });
  }

  // ============ MESSAGE HANDLING ============

  private async sendRequest<T>(
    serverName: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server "${serverName}" is not connected`);
    }

    const id = ++connection.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    this.log(`→ ${serverName}:`, method, params);

    if (connection.transport === "http") {
      return this.sendHttpRequest(connection, request);
    }

    // STDIO transport
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(
          new Error(
            `Request "${method}" timed out after ${this.options.timeout}ms`
          )
        );
      }, this.options.timeout);

      connection.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      connection.process?.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  private async sendHttpRequest<T>(
    connection: ServerConnection,
    request: JsonRpcRequest
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (connection.apiKey) {
      headers["Authorization"] = `Bearer ${connection.apiKey}`;
    }

    const response = await fetch(connection.url!, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as JsonRpcResponse;

    if (result.error) {
      const error = new Error(result.error.message) as Error & {
        code?: number;
        data?: unknown;
      };
      error.code = result.error.code;
      error.data = result.error.data;
      throw error;
    }

    this.log(`← HTTP:`, result.result);
    return result.result as T;
  }

  private async sendNotification(
    serverName: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    const notification: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    if (connection.transport === "stdio" && connection.process) {
      connection.process.stdin?.write(JSON.stringify(notification) + "\n");
    } else if (connection.transport === "http") {
      // Fire and forget for HTTP notifications
      fetch(connection.url!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connection.apiKey && {
            Authorization: `Bearer ${connection.apiKey}`,
          }),
        },
        body: JSON.stringify(notification),
      }).catch(() => {}); // Ignore errors for notifications
    }
  }

  private handleStdioMessage(serverName: string, line: string): void {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    try {
      const message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
      this.log(`← ${serverName}:`, message);

      if ("id" in message && message.id !== null) {
        // It's a response
        const pending = connection.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          connection.pendingRequests.delete(message.id);

          if (message.error) {
            const error = new Error(message.error.message) as Error & {
              code?: number;
              data?: unknown;
            };
            error.code = message.error.code;
            error.data = message.error.data;
            pending.reject(error);
          } else {
            pending.resolve(message.result);
          }
        }
      } else {
        // It's a notification
        this.handleNotification(serverName, message as JsonRpcNotification);
      }
    } catch (error) {
      this.log(`Failed to parse message from ${serverName}:`, error);
    }
  }

  private handleNotification(
    serverName: string,
    notification: JsonRpcNotification
  ): void {
    this.emit("notification", {
      server: serverName,
      method: notification.method,
      params: notification.params,
    });

    // Handle specific notifications
    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.emit("tools-changed", { server: serverName });
        break;
      case "notifications/resources/list_changed":
        this.emit("resources-changed", { server: serverName });
        break;
      case "notifications/prompts/list_changed":
        this.emit("prompts-changed", { server: serverName });
        break;
    }
  }

  private handleDisconnect(serverName: string, code: number): void {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    // Reject all pending requests
    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Server disconnected with code ${code}`));
    }

    this.connections.delete(serverName);
    this.emit("disconnected", { server: serverName, code });
  }
}

// ============ UTILITY FUNCTIONS ============

/**
 * Convert MCP tools to OpenAI function calling format
 */
export function mcpToolsToOpenAI(tools: MCPTool[]): Array<{
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: MCPTool["inputSchema"];
  };
}> {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * Convert MCP tool result to a string suitable for LLM context
 */
export function mcpResultToString(result: MCPToolResult): string {
  return result.content
    .map((content) => {
      if (content.type === "text" && content.text) {
        return content.text;
      }
      if (content.type === "image" && content.data) {
        return `[Image: ${content.mimeType || "unknown type"}]`;
      }
      if (content.type === "resource" && content.uri) {
        return `[Resource: ${content.uri}]`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export default MCPClient;
