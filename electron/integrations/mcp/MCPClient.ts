/**
 * MCP Client
 *
 * Wraps @modelcontextprotocol/sdk to manage multiple server connections.
 * Keeps the same public API so recipes/providers work without changes.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ToolListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  PromptListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";

// =============================================================================
// Type Definitions (public API — unchanged)
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
// Internal
// =============================================================================

interface ServerEntry {
  config: MCPServerConfig;
  client: Client;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

// =============================================================================
// MCP Client
// =============================================================================

export class MCPClient extends EventEmitter {
  private servers: Map<string, ServerEntry> = new Map();
  private options: Required<MCPClientOptions>;

  constructor(options: MCPClientOptions = {}) {
    super();
    this.options = {
      timeout: options.timeout ?? 30000,
      debug: options.debug ?? false,
    };
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) console.error("[MCP]", ...args);
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  async connectStdio(
    name: string,
    command: string,
    args: string[] = [],
    env?: Record<string, string>,
  ): Promise<MCPInitializeResult> {
    if (this.servers.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via STDIO: ${command} ${args.join(" ")}`);

    const mergedEnv = Object.fromEntries(
      Object.entries({ ...process.env, ...(env ?? {}) }).filter(
        ([, v]) => v !== undefined,
      ),
    ) as Record<string, string>;

    const transport = new StdioClientTransport({ command, args, env: mergedEnv });
    return this._connectWithTransport(
      name,
      { name, transport: "stdio", command, args, env },
      transport,
    );
  }

  async connectHttp(
    name: string,
    url: string,
    apiKey?: string,
  ): Promise<MCPInitializeResult> {
    if (this.servers.has(name)) {
      throw new Error(`Server "${name}" is already connected`);
    }

    this.log(`Connecting to ${name} via HTTP: ${url}`);

    const requestInit: RequestInit = apiKey
      ? { headers: { Authorization: `Bearer ${apiKey}` } }
      : {};

    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit,
    });
    return this._connectWithTransport(
      name,
      { name, transport: "http", url, apiKey },
      transport,
    );
  }

  async connect(config: MCPServerConfig): Promise<MCPInitializeResult> {
    if (config.transport === "stdio") {
      if (!config.command) throw new Error("STDIO transport requires a command");
      return this.connectStdio(config.name, config.command, config.args, config.env);
    } else {
      if (!config.url) throw new Error("HTTP transport requires a URL");
      return this.connectHttp(config.name, config.url, config.apiKey);
    }
  }

  private async _connectWithTransport(
    name: string,
    config: MCPServerConfig,
    transport: StdioClientTransport | StreamableHTTPClientTransport,
  ): Promise<MCPInitializeResult> {
    const client = new Client(
      { name: "mosaic-companion", version: "1.0.0" },
      { capabilities: {} },
    );

    client.onclose = () => {
      if (this.servers.has(name)) {
        this.servers.delete(name);
        this.log(`${name} disconnected`);
        this.emit("disconnected", { server: name, code: 0 });
      }
    };

    client.onerror = (error: Error) => {
      this.log(`${name} error:`, error);
      this.emit("error", { server: name, error });
    };

    await client.connect(transport);

    // Register notification handlers
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      await this.refreshCapabilities(name);
      this.emit("tools-changed", { server: name });
    });

    client.setNotificationHandler(
      ResourceListChangedNotificationSchema,
      async () => {
        await this.refreshCapabilities(name);
        this.emit("resources-changed", { server: name });
      },
    );

    client.setNotificationHandler(
      PromptListChangedNotificationSchema,
      async () => {
        await this.refreshCapabilities(name);
        this.emit("prompts-changed", { server: name });
      },
    );

    const entry: ServerEntry = {
      config,
      client,
      tools: [],
      resources: [],
      prompts: [],
    };
    this.servers.set(name, entry);

    await this.refreshCapabilities(name);

    const caps = (client.getServerCapabilities() ?? {}) as MCPServerCapabilities;
    const serverVersion = client.getServerVersion() as
      | { name: string; version: string }
      | undefined;

    const result: MCPInitializeResult = {
      protocolVersion: "2024-11-05",
      capabilities: caps,
      serverInfo: serverVersion,
    };

    this.emit("connected", { server: name, capabilities: result });
    return result;
  }

  async disconnect(name: string): Promise<void> {
    const entry = this.servers.get(name);
    if (!entry) return;

    try {
      await entry.client.close();
    } catch (e) {
      this.log(`Error closing ${name}:`, e);
    }

    this.servers.delete(name);
    this.emit("disconnected", { server: name });
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(Array.from(this.servers.keys()).map((n) => this.disconnect(n)));
  }

  isConnected(name: string): boolean {
    return this.servers.has(name);
  }

  getConnectedServers(): string[] {
    return Array.from(this.servers.keys());
  }

  getServers(): Array<{
    name: string;
    transport: string;
    initialized: boolean;
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
  }> {
    return Array.from(this.servers.entries()).map(([name, entry]) => ({
      name,
      transport: entry.config.transport,
      initialized: true,
      tools: entry.tools,
      resources: entry.resources,
      prompts: entry.prompts,
    }));
  }

  // ==========================================================================
  // Capabilities
  // ==========================================================================

  async refreshCapabilities(serverName: string): Promise<void> {
    const entry = this.servers.get(serverName);
    if (!entry) return;

    try {
      const r = await entry.client.listTools();
      entry.tools = (r.tools ?? []) as MCPTool[];
      this.log(`${serverName} tools:`, entry.tools.map((t) => t.name));
    } catch {
      entry.tools = [];
    }

    try {
      const r = await entry.client.listResources();
      entry.resources = (r.resources ?? []) as MCPResource[];
    } catch {
      entry.resources = [];
    }

    try {
      const r = await entry.client.listPrompts();
      entry.prompts = (r.prompts ?? []) as MCPPrompt[];
    } catch {
      entry.prompts = [];
    }
  }

  // ==========================================================================
  // Tools
  // ==========================================================================

  async listTools(serverName: string): Promise<MCPTool[]> {
    return this.servers.get(serverName)?.tools ?? [];
  }

  async fetchTools(serverName: string): Promise<MCPTool[]> {
    await this.refreshCapabilities(serverName);
    return this.servers.get(serverName)?.tools ?? [];
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<MCPToolResult> {
    const entry = this.servers.get(serverName);
    if (!entry) throw new Error(`Server "${serverName}" is not connected`);
    const result = await entry.client.callTool({ name: toolName, arguments: args });
    return result as MCPToolResult;
  }

  // ==========================================================================
  // Resources
  // ==========================================================================

  async listResources(serverName: string): Promise<MCPResource[]> {
    return this.servers.get(serverName)?.resources ?? [];
  }

  async fetchResources(serverName: string): Promise<MCPResource[]> {
    await this.refreshCapabilities(serverName);
    return this.servers.get(serverName)?.resources ?? [];
  }

  async readResource(
    serverName: string,
    uri: string,
  ): Promise<{ contents: MCPContent[] }> {
    const entry = this.servers.get(serverName);
    if (!entry) throw new Error(`Server "${serverName}" is not connected`);
    const result = await entry.client.readResource({ uri });
    return result as unknown as { contents: MCPContent[] };
  }

  async listResourceTemplates(
    serverName: string,
  ): Promise<MCPResourceTemplate[]> {
    const entry = this.servers.get(serverName);
    if (!entry) throw new Error(`Server "${serverName}" is not connected`);
    // SDK doesn't have a direct method; fall back to empty list
    return [];
  }

  // ==========================================================================
  // Prompts
  // ==========================================================================

  async listPrompts(serverName: string): Promise<MCPPrompt[]> {
    return this.servers.get(serverName)?.prompts ?? [];
  }

  async fetchPrompts(serverName: string): Promise<MCPPrompt[]> {
    await this.refreshCapabilities(serverName);
    return this.servers.get(serverName)?.prompts ?? [];
  }

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
    const entry = this.servers.get(serverName);
    if (!entry) throw new Error(`Server "${serverName}" is not connected`);
    const result = await entry.client.getPrompt({ name: promptName, arguments: args });
    return result as {
      description?: string;
      messages: Array<{ role: "user" | "assistant"; content: MCPContent }>;
    };
  }

  // ==========================================================================
  // Aggregate Helpers (multi-server)
  // ==========================================================================

  async getAllTools(): Promise<Array<MCPTool & { _serverName: string }>> {
    const all: Array<MCPTool & { _serverName: string }> = [];
    for (const [name, entry] of this.servers) {
      for (const tool of entry.tools) all.push({ ...tool, _serverName: name });
    }
    return all;
  }

  async buildToolMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const [name, entry] of this.servers) {
      for (const tool of entry.tools) map.set(tool.name, name);
    }
    return map;
  }
}

// =============================================================================
// Utility Functions (unchanged)
// =============================================================================

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

export function mcpResultToString(result: MCPToolResult): string {
  return result.content
    .map((content: MCPToolResultContent) => {
      if (content.type === "text" && content.text) return content.text;
      if (content.type === "image" && content.data)
        return `[Image: ${content.mimeType || "unknown type"}]`;
      if (content.type === "resource" && content.uri)
        return `[Resource: ${content.uri}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export default MCPClient;
