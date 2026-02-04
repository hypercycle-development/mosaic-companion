/**
 * Standalone MCP Client Library
 *
 * A TypeScript MCP client that can be used in any Node.js or Electron environment.
 * Supports both STDIO and HTTP transports.
 */
import { spawn } from "child_process";
import * as readline from "readline";
import { EventEmitter } from "events";
// ============ MCP CLIENT ============
export class MCPClient extends EventEmitter {
    connections = new Map();
    options;
    constructor(options = {}) {
        super();
        this.options = {
            timeout: options.timeout ?? 30000,
            debug: options.debug ?? false,
        };
    }
    log(...args) {
        if (this.options.debug) {
            console.error("[MCP]", ...args);
        }
    }
    // ============ CONNECTION MANAGEMENT ============
    /**
     * Connect to an MCP server via STDIO transport
     */
    async connectStdio(name, command, args = [], env) {
        if (this.connections.has(name)) {
            throw new Error(`Server "${name}" is already connected`);
        }
        this.log(`Connecting to ${name} via STDIO: ${command} ${args.join(" ")}`);
        const connection = {
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
            input: childProcess.stdout,
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
    async connectHttp(name, url, apiKey) {
        if (this.connections.has(name)) {
            throw new Error(`Server "${name}" is already connected`);
        }
        this.log(`Connecting to ${name} via HTTP: ${url}`);
        const connection = {
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
    async disconnect(name) {
        const connection = this.connections.get(name);
        if (!connection)
            return;
        if (connection.process) {
            connection.process.kill();
        }
        // Reject all pending requests
        for (const [_id, pending] of connection.pendingRequests) {
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
    async disconnectAll() {
        const names = Array.from(this.connections.keys());
        await Promise.all(names.map((name) => this.disconnect(name)));
    }
    /**
     * Check if a server is connected
     */
    isConnected(name) {
        return (this.connections.has(name) && this.connections.get(name).initialized);
    }
    /**
     * Get list of connected servers
     */
    getConnectedServers() {
        return Array.from(this.connections.keys());
    }
    // ============ INITIALIZATION ============
    async initializeConnection(name) {
        const result = await this.sendRequest(name, "initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {
                roots: { listChanged: true },
                sampling: {},
            },
            clientInfo: {
                name: "typescript-mcp-client",
                version: "1.0.0",
            },
        });
        const connection = this.connections.get(name);
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
    async listTools(serverName) {
        const result = await this.sendRequest(serverName, "tools/list", {});
        return result.tools || [];
    }
    /**
     * Call a tool on a server
     */
    async callTool(serverName, toolName, args = {}) {
        return this.sendRequest(serverName, "tools/call", {
            name: toolName,
            arguments: args,
        });
    }
    // ============ RESOURCES ============
    /**
     * List available resources from a server
     */
    async listResources(serverName) {
        const result = await this.sendRequest(serverName, "resources/list", {});
        return result.resources || [];
    }
    /**
     * List resource templates from a server
     */
    async listResourceTemplates(serverName) {
        const result = await this.sendRequest(serverName, "resources/templates/list", {});
        return result.resourceTemplates || [];
    }
    /**
     * Read a resource from a server
     */
    async readResource(serverName, uri) {
        return this.sendRequest(serverName, "resources/read", { uri });
    }
    // ============ PROMPTS ============
    /**
     * List available prompts from a server
     */
    async listPrompts(serverName) {
        const result = await this.sendRequest(serverName, "prompts/list", {});
        return result.prompts || [];
    }
    /**
     * Get a prompt from a server
     */
    async getPrompt(serverName, promptName, args = {}) {
        return this.sendRequest(serverName, "prompts/get", {
            name: promptName,
            arguments: args,
        });
    }
    // ============ MESSAGE HANDLING ============
    async sendRequest(serverName, method, params) {
        const connection = this.connections.get(serverName);
        if (!connection) {
            throw new Error(`Server "${serverName}" is not connected`);
        }
        const id = ++connection.requestId;
        const request = {
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
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                connection.pendingRequests.delete(id);
                reject(new Error(`Request "${method}" timed out after ${this.options.timeout}ms`));
            }, this.options.timeout);
            connection.pendingRequests.set(id, {
                resolve: resolve,
                reject,
                timeout,
            });
            connection.process?.stdin?.write(JSON.stringify(request) + "\n");
        });
    }
    async sendHttpRequest(connection, request) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (connection.apiKey) {
            headers["Authorization"] = `Bearer ${connection.apiKey}`;
        }
        const response = await fetch(connection.url, {
            method: "POST",
            headers,
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = (await response.json());
        if (result.error) {
            const error = new Error(result.error.message);
            error.code = result.error.code;
            error.data = result.error.data;
            throw error;
        }
        this.log(`← HTTP:`, result.result);
        return result.result;
    }
    async sendNotification(serverName, method, params) {
        const connection = this.connections.get(serverName);
        if (!connection)
            return;
        const notification = {
            jsonrpc: "2.0",
            method,
            params,
        };
        if (connection.transport === "stdio" && connection.process) {
            connection.process.stdin?.write(JSON.stringify(notification) + "\n");
        }
        else if (connection.transport === "http") {
            // Fire and forget for HTTP notifications
            fetch(connection.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(connection.apiKey && {
                        Authorization: `Bearer ${connection.apiKey}`,
                    }),
                },
                body: JSON.stringify(notification),
            }).catch(() => { }); // Ignore errors for notifications
        }
    }
    handleStdioMessage(serverName, line) {
        const connection = this.connections.get(serverName);
        if (!connection)
            return;
        try {
            const message = JSON.parse(line);
            this.log(`← ${serverName}:`, message);
            if ("id" in message && message.id !== null) {
                // It's a response
                const pending = connection.pendingRequests.get(message.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    connection.pendingRequests.delete(message.id);
                    if (message.error) {
                        const error = new Error(message.error.message);
                        error.code = message.error.code;
                        error.data = message.error.data;
                        pending.reject(error);
                    }
                    else {
                        pending.resolve(message.result);
                    }
                }
            }
            else {
                // It's a notification
                this.handleNotification(serverName, message);
            }
        }
        catch (error) {
            this.log(`Failed to parse message from ${serverName}:`, error);
        }
    }
    handleNotification(serverName, notification) {
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
    handleDisconnect(serverName, code) {
        const connection = this.connections.get(serverName);
        if (!connection)
            return;
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
export function mcpToolsToOpenAI(tools) {
    return tools.map((tool) => ({
        type: "function",
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
export function mcpResultToString(result) {
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
