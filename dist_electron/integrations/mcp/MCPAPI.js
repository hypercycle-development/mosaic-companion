import { ipcRenderer } from "electron";
// =============================================================================
// MCP API
// =============================================================================
export const mcpAPI = {
    // Server management
    connect: (config) => {
        return ipcRenderer.invoke("mcp:connect", config);
    },
    disconnect: (serverName) => {
        return ipcRenderer.invoke("mcp:disconnect", serverName);
    },
    listServers: () => {
        return ipcRenderer.invoke("mcp:list-servers");
    },
    // Tool operations
    callTool: (serverName, toolName, args) => {
        return ipcRenderer.invoke("mcp:call-tool", serverName, toolName, args);
    },
    // Resource operations
    readResource: (serverName, uri) => {
        return ipcRenderer.invoke("mcp:read-resource", serverName, uri);
    },
    // Prompt operations
    getPrompt: (serverName, promptName, args) => {
        return ipcRenderer.invoke("mcp:get-prompt", serverName, promptName, args);
    },
    // Event listeners
    onServerConnected: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("mcp:server-connected", listener);
        return () => ipcRenderer.removeListener("mcp:server-connected", listener);
    },
    onServerDisconnected: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("mcp:server-disconnected", listener);
        return () => ipcRenderer.removeListener("mcp:server-disconnected", listener);
    },
    onServerError: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("mcp:server-error", listener);
        return () => ipcRenderer.removeListener("mcp:server-error", listener);
    },
    onNotification: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("mcp:notification", listener);
        return () => ipcRenderer.removeListener("mcp:notification", listener);
    },
};
