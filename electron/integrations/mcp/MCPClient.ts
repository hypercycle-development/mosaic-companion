/**
 * Standalone MCP Client Library
 *
 * A TypeScript MCP client that can be used in any Node.js or Electron environment.
 * Supports both STDIO and HTTP transports.
 *
 * This is the single source of truth for all MCP protocol logic.
 * The Electron main process (index.ts) wraps this with IPC handlers.
 */

import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";
import { EventEmitter } from "events";

// =============================================================================
// Type Definitions
// =============================================================================

export interface MCPServerCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
  experimental?: Record<string, unknown>;
}

export interface MCPClientOptions {
  timeout?: number;
  debug?: boolean;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo?: { name: string; version: string };
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPToolResultContent {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface MCPToolResult {
  content: MCPToolResultContent[];
  isError?: boolean;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPContent {
  type: string;
  text?: string;
  data?: string;
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

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface ServerConnection {
  config: MCPServerConfig;
  transport: "stdio" | "http";
  process?: ChildProcess;
  url?: string;
  apiKey?: string;
  requestId: number;
  pendingRequests: Map<number | string, PendingRequest>;
  capabilities: MCPServerCapabilities;
  serverInfo?: { name: string; version: string };
  initialized: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

// =============================================================================
// Event Types
// =============================================================================

export interface MCPClientEvents {
  connected: { server: string; capabilities: MCPInitializeResult };
  disconnected: { server: string; code?: number };
  error: { server: string; error: Error };
  notification: { server: string; method: string; params?: unknown };
  "tools-changed": { server: string };
  "resources-changed": { server: string };
  "prompts-changed": { server: string };
}

// =============================================================================
// MCP Client
// =============================================================================

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

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to an MCP server via STDIO transport
   */
  async connectStdio(
    name: string,
    command: string,
    args: string[] = [],
    env?: Record<string, string>,
  ): Promise<MCPInitializeResult> {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via STDIO: ${command} ${args.join(" ")}`);

    const connection: ServerConnection = {
      config: { name, transport: "stdio", command, args, env },
      transport: "stdio",
      requestId: 0,
      pendingRequests: new Map(),
      capabilities: {},
      initialized: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    const childProcess = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    connection.process = childProcess;

    const rl = readline.createInterface({
      input: childProcess.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line: string) => {
      this.handleStdioMessage(name, line);
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      this.log(`${name} stderr:`, data.toString().trim());
    });

    childProcess.on("exit", (code: number | null, signal: string | null) => {
      this.log(`${name} exited with code ${code}, signal ${signal}`);
      this.handleDisconnect(name, code ?? 0);
    });

    childProcess.on("error", (error: Error) => {
      this.log(`${name} error:`, error);
      this.emit("error", { server: name, error });
    });

    this.connections.set(name, connection);

    return this.initializeConnection(name);
  }

  /**
   * Connect to an MCP server via HTTP transport (Streamable HTTP)
   */
  async connectHttp(
    name: string,
    url: string,
    apiKey?: string,
  ): Promise<MCPInitializeResult> {
    if (this.connections.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via HTTP: ${url}`);

    const connection: ServerConnection = {
      config: { name, transport: "http", url, apiKey },
      transport: "http",
      url,
      apiKey,
      requestId: 0,
      pendingRequests: new Map(),
      capabilities: {},
      initialized: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    this.connections.set(name, connection);

    return this.initializeConnection(name);
  }

  /**
   * Connect using a config object (convenience for Electron IPC)
   */
  async connect(config: MCPServerConfig): Promise<MCPInitializeResult> {
    if (config.transport === "stdio") {
      if (!config.command) {
        throw new Error("STDIO transport requires a command");
      }
      return this.connectStdio(
        config.name,
        config.command,
        config.args,
        config.env,
      );
    } else {
      if (!config.url) {
        throw new Error("HTTP transport requires a URL");
      }
      return this.connectHttp(config.name, config.url, config.apiKey);
    }
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

    for (const [, pending] of connection.pendingRequests) {
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
   * Check if a server is connected and initialized
   */
  isConnected(name: string): boolean {
    return (
      this.connections.has(name) && this.connections.get(name)!.initialized
    );
  }

  /**
   * Get list of connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get detailed server info (for IPC/UI)
   */
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
      transport: conn.transport,
      initialized: conn.initialized,
      tools: conn.tools,
      resources: conn.resources,
      prompts: conn.prompts,
    }));
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private async initializeConnection(
    name: string,
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
      },
    );

    const connection = this.connections.get(name)!;
    connection.capabilities = result.capabilities;
    connection.serverInfo = result.serverInfo;

    await this.sendNotification(name, "notifications/initialized", {});

    connection.initialized = true;

    // Fetch capabilities after init
    await this.refreshCapabilities(name);

    this.emit("connected", { server: name, capabilities: result });

    return result;
  }

  /**
   * Refresh tools, resources, and prompts from a server
   */
  async refreshCapabilities(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);

    // Fetch tools
    try {
      const toolsResult = await this.sendRequest<{ tools: MCPTool[] }>(
        serverName,
        "tools/list",
        {},
      );
      connection.tools = toolsResult.tools || [];
      this.log(
        `${serverName} tools:`,
        connection.tools.map((t) => t.name),
      );
    } catch {
      this.log(`${serverName} does not support tools`);
      connection.tools = [];
    }

    // Fetch resources
    try {
      const resourcesResult = await this.sendRequest<{
        resources: MCPResource[];
      }>(serverName, "resources/list", {});
      connection.resources = resourcesResult.resources || [];
      this.log(
        `${serverName} resources:`,
        connection.resources.map((r) => r.uri),
      );
    } catch {
      this.log(`${serverName} does not support resources`);
      connection.resources = [];
    }

    // Fetch prompts
    try {
      const promptsResult = await this.sendRequest<{ prompts: MCPPrompt[] }>(
        serverName,
        "prompts/list",
        {},
      );
      connection.prompts = promptsResult.prompts || [];
      this.log(
        `${serverName} prompts:`,
        connection.prompts.map((p) => p.name),
      );
    } catch {
      this.log(`${serverName} does not support prompts`);
      connection.prompts = [];
    }
  }

  // ==========================================================================
  // Tools
  // ==========================================================================

  /**
   * List available tools from a server
   */
  async listTools(serverName: string): Promise<MCPTool[]> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.tools;
  }

  /**
   * Fetch fresh tools from a server (bypasses cache)
   */
  async fetchTools(serverName: string): Promise<MCPTool[]> {
    const result = await this.sendRequest<{ tools: MCPTool[] }>(
      serverName,
      "tools/list",
      {},
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.tools = result.tools || [];
    }
    return result.tools || [];
  }

  /**
   * Call a tool on a server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<MCPToolResult> {
    return this.sendRequest<MCPToolResult>(serverName, "tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  // ==========================================================================
  // Resources
  // ==========================================================================

  /**
   * List available resources from a server
   */
  async listResources(serverName: string): Promise<MCPResource[]> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.resources;
  }

  /**
   * Fetch fresh resources from a server (bypasses cache)
   */
  async fetchResources(serverName: string): Promise<MCPResource[]> {
    const result = await this.sendRequest<{ resources: MCPResource[] }>(
      serverName,
      "resources/list",
      {},
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.resources = result.resources || [];
    }
    return result.resources || [];
  }

  /**
   * List resource templates from a server
   */
  async listResourceTemplates(
    serverName: string,
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
    uri: string,
  ): Promise<{ contents: MCPContent[] }> {
    return this.sendRequest(serverName, "resources/read", { uri });
  }

  // ==========================================================================
  // Prompts
  // ==========================================================================

  /**
   * List available prompts from a server
   */
  async listPrompts(serverName: string): Promise<MCPPrompt[]> {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server "${serverName}" is not connected`);
    return connection.prompts;
  }

  /**
   * Fetch fresh prompts from a server (bypasses cache)
   */
  async fetchPrompts(serverName: string): Promise<MCPPrompt[]> {
    const result = await this.sendRequest<{ prompts: MCPPrompt[] }>(
      serverName,
      "prompts/list",
      {},
    );
    const connection = this.connections.get(serverName);
    if (connection) {
      connection.prompts = result.prompts || [];
    }
    return result.prompts || [];
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string> = {},
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

  // ==========================================================================
  // Aggregate Helpers (multi-server)
  // ==========================================================================

  /**
   * Get all tools from all connected servers, with server origin tracking
   */
  async getAllTools(): Promise<
    Array<MCPTool & { _serverName: string }>
  > {
    const allTools: Array<MCPTool & { _serverName: string }> = [];
    for (const name of this.getConnectedServers()) {
      const tools = await this.listTools(name);
      for (const tool of tools) {
        allTools.push({ ...tool, _serverName: name });
      }
    }
    return allTools;
  }

  /**
   * Build a tool-name → server-name map for routing tool calls
   */
  async buildToolMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const name of this.getConnectedServers()) {
      const tools = await this.listTools(name);
      for (const tool of tools) {
        map.set(tool.name, name);
      }
    }
    return map;
  }

  // ==========================================================================
  // Message Handling (private)
  // ==========================================================================

  private async sendRequest<T>(
    serverName: string,
    method: string,
    params: Record<string, unknown>,
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
            `Request "${method}" timed out after ${this.options.timeout}ms`,
          ),
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
    request: JsonRpcRequest,
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
    params: Record<string, unknown>,
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
      fetch(connection.url!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(connection.apiKey && {
            Authorization: `Bearer ${connection.apiKey}`,
          }),
        },
        body: JSON.stringify(notification),
      }).catch(() => {});
    }
  }

  private handleStdioMessage(serverName: string, line: string): void {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    try {
      const message = JSON.parse(line) as
        | JsonRpcResponse
        | JsonRpcNotification;
      this.log(`← ${serverName}:`, message);

      if ("id" in message && message.id !== null) {
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
        this.handleNotification(serverName, message as JsonRpcNotification);
      }
    } catch (error) {
      this.log(`Failed to parse message from ${serverName}:`, error);
    }
  }

  private handleNotification(
    serverName: string,
    notification: JsonRpcNotification,
  ): void {
    this.emit("notification", {
      server: serverName,
      method: notification.method,
      params: notification.params,
    });

    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("tools-changed", { server: serverName });
        break;
      case "notifications/resources/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("resources-changed", { server: serverName });
        break;
      case "notifications/prompts/list_changed":
        this.refreshCapabilities(serverName);
        this.emit("prompts-changed", { server: serverName });
        break;
    }
  }

  private handleDisconnect(serverName: string, code: number): void {
    const connection = this.connections.get(serverName);
    if (!connection) return;

    for (const [, pending] of connection.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Server disconnected with code ${code}`));
    }

    this.connections.delete(serverName);
    this.emit("disconnected", { server: serverName, code });
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

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
 * Convert MCP tools to Anthropic tool format
 */
export function mcpToolsToAnthropic(
  tools: MCPTool[],
): Array<{
  name: string;
  description: string;
  input_schema: MCPTool["inputSchema"];
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema,
  }));
}

/**
 * Convert MCP tool result to a string suitable for LLM context
 */
export function mcpResultToString(result: MCPToolResult): string {
  return result.content
    .map((content: MCPToolResultContent) => {
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
