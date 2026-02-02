// electron/integrations/mcp/MCPAPI.ts
import { ipcRenderer } from "electron";
var mcpAPI = {
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
    const listener = (_event, data) => callback(
      data
    );
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
  }
};

// electron/preload.ts
import { contextBridge, ipcRenderer as ipcRenderer2 } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text) => ipcRenderer2.invoke("log-input", text),
  getCsvPath: () => ipcRenderer2.invoke("get-csv-path"),
  checkForUpdates: () => ipcRenderer2.invoke("check-for-updates"),
  getUpdateSettings: () => ipcRenderer2.invoke("get-update-settings"),
  setUpdateSettings: (settings) => ipcRenderer2.invoke("set-update-settings", settings),
  getUpdateLogs: () => ipcRenderer2.invoke("get-update-logs"),
  getUpdateLogPath: () => ipcRenderer2.invoke("get-update-log-path"),
  restartWindow: () => ipcRenderer2.invoke("restart-window"),
  showTitleBarConfirm: () => ipcRenderer2.invoke("show-title-bar-confirm"),
  nodes: {
    get: () => ipcRenderer2.invoke("nodes:get"),
    add: (node) => ipcRenderer2.invoke("nodes:add", node),
    update: (id, updates) => ipcRenderer2.invoke("nodes:update", id, updates),
    delete: (id) => ipcRenderer2.invoke("nodes:delete", id),
    onChanged: (callback) => {
      ipcRenderer2.on(
        "nodes-changed",
        (_event, nodes) => callback(nodes)
      );
      return () => ipcRenderer2.removeAllListeners("nodes-changed");
    }
  },
  aiAgents: {
    get: () => ipcRenderer2.invoke("ai-agents:get"),
    set: (agents) => ipcRenderer2.invoke("ai-agents:set", agents),
    add: (agent) => ipcRenderer2.invoke("ai-agents:add", agent),
    update: (id, updates) => ipcRenderer2.invoke("ai-agents:update", id, updates),
    delete: (id) => ipcRenderer2.invoke("ai-agents:delete", id),
    clear: () => ipcRenderer2.invoke("ai-agents:clear")
  },
  themes: {
    get: () => ipcRenderer2.invoke("themes:get"),
    set: (activeTheme) => ipcRenderer2.invoke("themes:set", activeTheme)
  },
  aiAgentsHistory: {
    getAll: (agentId) => ipcRenderer2.invoke("ai-agents-history:get-all", agentId),
    get: (agentId, sessionId) => ipcRenderer2.invoke("ai-agents-history:get", agentId, sessionId),
    save: (chatSession) => ipcRenderer2.invoke("ai-agents-history:save", chatSession),
    delete: (agentId, sessionId) => ipcRenderer2.invoke("ai-agents-history:delete", agentId, sessionId),
    deleteAll: (agentId) => ipcRenderer2.invoke("ai-agents-history:delete-all", agentId)
  },
  mcpAPI
});
