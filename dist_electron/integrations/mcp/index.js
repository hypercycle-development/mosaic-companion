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
import { spawn } from "child_process";
import * as path from "path";
import * as readline from "readline";
// ============ MCP CLIENT CLASS ============
class MCPClient {
    connections = new Map();
    mainWindow = null;
    setMainWindow(window) {
        this.mainWindow = window;
    }
    // ============ STDIO TRANSPORT ============
    async connectStdio(config) {
        if (!config.command) {
            throw new Error("STDIO transport requires a command");
        }
        console.log(`[MCP] Connecting to ${config.name} via STDIO...`);
        const connection = {
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
            input: childProcess.stdout,
            crlfDelay: Infinity,
        });
        rl.on("line", (line) => {
            try {
                const message = JSON.parse(line);
                this.handleMessage(config.name, message);
            }
            catch (error) {
                console.error(`[MCP] Failed to parse message from ${config.name}:`, error);
            }
        });
        // Handle stderr (logging)
        childProcess.stderr?.on("data", (data) => {
            console.log(`[MCP] ${config.name} stderr:`, data.toString());
        });
        // Handle process exit
        childProcess.on("exit", (code) => {
            console.log(`[MCP] ${config.name} exited with code ${code}`);
            this.connections.delete(config.name);
            this.notifyRenderer("mcp:server-disconnected", {
                name: config.name,
                code,
            });
        });
        childProcess.on("error", (error) => {
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
    async connectHttp(config) {
        if (!config.url) {
            throw new Error("HTTP transport requires a URL");
        }
        console.log(`[MCP] Connecting to ${config.name} via HTTP at ${config.url}...`);
        const connection = {
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
    async initializeConnection(serverName) {
        const connection = this.connections.get(serverName);
        if (!connection)
            throw new Error(`Server ${serverName} not found`);
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
    async refreshCapabilities(serverName) {
        const connection = this.connections.get(serverName);
        if (!connection)
            throw new Error(`Server ${serverName} not found`);
        // Fetch tools
        try {
            const toolsResult = (await this.sendRequest(serverName, "tools/list", {}));
            connection.tools = toolsResult.tools || [];
            console.log(`[MCP] ${serverName} tools:`, connection.tools.map((t) => t.name));
        }
        catch (error) {
            console.log(`[MCP] ${serverName} does not support tools`);
        }
        // Fetch resources
        try {
            const resourcesResult = (await this.sendRequest(serverName, "resources/list", {}));
            connection.resources = resourcesResult.resources || [];
            console.log(`[MCP] ${serverName} resources:`, connection.resources.map((r) => r.uri));
        }
        catch (error) {
            console.log(`[MCP] ${serverName} does not support resources`);
        }
        // Fetch prompts
        try {
            const promptsResult = (await this.sendRequest(serverName, "prompts/list", {}));
            connection.prompts = promptsResult.prompts || [];
            console.log(`[MCP] ${serverName} prompts:`, connection.prompts.map((p) => p.name));
        }
        catch (error) {
            console.log(`[MCP] ${serverName} does not support prompts`);
        }
    }
    async disconnect(serverName) {
        const connection = this.connections.get(serverName);
        if (!connection)
            return;
        if (connection.process) {
            connection.process.kill();
        }
        this.connections.delete(serverName);
        console.log(`[MCP] Disconnected from ${serverName}`);
    }
    async disconnectAll() {
        for (const name of this.connections.keys()) {
            await this.disconnect(name);
        }
    }
    // ============ MESSAGE HANDLING ============
    async sendRequest(serverName, method, params) {
        const connection = this.connections.get(serverName);
        if (!connection)
            throw new Error(`Server ${serverName} not found`);
        const id = ++connection.requestId;
        const request = {
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
            }
            else if (connection.config.transport === "http") {
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
            const originalResolve = connection.pendingRequests.get(id).resolve;
            connection.pendingRequests.set(id, {
                resolve: (value) => {
                    clearTimeout(timeout);
                    originalResolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
            });
        });
    }
    async sendHttpRequest(connection, request) {
        const headers = {
            "Content-Type": "application/json",
        };
        if (connection.config.apiKey) {
            headers["Authorization"] = `Bearer ${connection.config.apiKey}`;
        }
        const response = await fetch(connection.config.url, {
            method: "POST",
            headers,
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = (await response.json());
        if (result.error) {
            throw new Error(`MCP Error: ${result.error.message}`);
        }
        return result.result;
    }
    async sendNotification(serverName, method, params) {
        const connection = this.connections.get(serverName);
        if (!connection)
            throw new Error(`Server ${serverName} not found`);
        const notification = {
            jsonrpc: "2.0",
            method,
            params,
        };
        if (connection.config.transport === "stdio" && connection.process) {
            connection.process.stdin?.write(JSON.stringify(notification) + "\n");
        }
        else if (connection.config.transport === "http") {
            // HTTP notifications are fire-and-forget
            fetch(connection.config.url, {
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
    handleMessage(serverName, message) {
        const connection = this.connections.get(serverName);
        if (!connection)
            return;
        // Check if it's a response (has id)
        if ("id" in message && message.id !== null) {
            const pending = connection.pendingRequests.get(message.id);
            if (pending) {
                connection.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message));
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
    handleNotification(serverName, notification) {
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
    notifyRenderer(channel, data) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data);
        }
    }
    // ============ PUBLIC API (exposed via IPC) ============
    async callTool(serverName, toolName, args) {
        console.log(`[MCP] Calling tool ${toolName} on ${serverName}`);
        return this.sendRequest(serverName, "tools/call", {
            name: toolName,
            arguments: args,
        });
    }
    async readResource(serverName, uri) {
        console.log(`[MCP] Reading resource ${uri} from ${serverName}`);
        return this.sendRequest(serverName, "resources/read", { uri });
    }
    async getPrompt(serverName, promptName, args) {
        console.log(`[MCP] Getting prompt ${promptName} from ${serverName}`);
        return this.sendRequest(serverName, "prompts/get", {
            name: promptName,
            arguments: args,
        });
    }
    getServers() {
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
// ============ ELECTRON APP ============
const mcpClient = new MCPClient();
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mcpClient.setMainWindow(mainWindow);
    // Load your app
    if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// ============ IPC HANDLERS ============
// Connect to MCP server
ipcMain.handle("mcp:connect", async (_event, config) => {
    try {
        if (config.transport === "stdio") {
            await mcpClient.connectStdio(config);
        }
        else {
            await mcpClient.connectHttp(config);
        }
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Disconnect from MCP server
ipcMain.handle("mcp:disconnect", async (_event, serverName) => {
    await mcpClient.disconnect(serverName);
    return { success: true };
});
// List connected servers
ipcMain.handle("mcp:list-servers", () => {
    return mcpClient.getServers();
});
// Call a tool
ipcMain.handle("mcp:call-tool", async (_event, serverName, toolName, args) => {
    try {
        const result = await mcpClient.callTool(serverName, toolName, args);
        return { success: true, result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Read a resource
ipcMain.handle("mcp:read-resource", async (_event, serverName, uri) => {
    try {
        const result = await mcpClient.readResource(serverName, uri);
        return { success: true, result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Get a prompt
ipcMain.handle("mcp:get-prompt", async (_event, serverName, promptName, args) => {
    try {
        const result = await mcpClient.getPrompt(serverName, promptName, args);
        return { success: true, result };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// ============ APP LIFECYCLE ============
app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on("window-all-closed", () => {
    mcpClient.disconnectAll();
    if (process.platform !== "darwin") {
        app.quit();
    }
});
app.on("before-quit", () => {
    mcpClient.disconnectAll();
});
export { mcpClient };
