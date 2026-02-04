// electron/integrations/gmail/gmailAPI.ts
var import_electron = require("electron");
var gmailAPI = {
  signIn: () => import_electron.ipcRenderer.invoke("gmail:sign-in"),
  signOut: () => import_electron.ipcRenderer.invoke("gmail:sign-out"),
  getStatus: () => import_electron.ipcRenderer.invoke("gmail:get-status"),
  getEmails: (count) => import_electron.ipcRenderer.invoke("gmail:get-emails", count),
  getEmailDetails: (messageId) => import_electron.ipcRenderer.invoke("gmail:get-email-details", messageId),
  searchEmails: (query, count) => import_electron.ipcRenderer.invoke("gmail:search-emails", query, count),
  markRead: (messageId) => import_electron.ipcRenderer.invoke("gmail:mark-read", messageId),
  markUnread: (messageId) => import_electron.ipcRenderer.invoke("gmail:mark-unread", messageId),
  getAutoMarkRead: () => import_electron.ipcRenderer.invoke("gmail:get-auto-mark-read"),
  setAutoMarkRead: (enabled) => import_electron.ipcRenderer.invoke("gmail:set-auto-mark-read", enabled)
};

// electron/integrations/mcp/MCPAPI.ts
var import_electron2 = require("electron");
var mcpAPI = {
  // Server management
  connect: (config) => {
    return import_electron2.ipcRenderer.invoke("mcp:connect", config);
  },
  disconnect: (serverName) => {
    return import_electron2.ipcRenderer.invoke("mcp:disconnect", serverName);
  },
  listServers: () => {
    return import_electron2.ipcRenderer.invoke("mcp:list-servers");
  },
  // Tool operations
  callTool: (serverName, toolName, args) => {
    return import_electron2.ipcRenderer.invoke("mcp:call-tool", serverName, toolName, args);
  },
  // Resource operations
  readResource: (serverName, uri) => {
    return import_electron2.ipcRenderer.invoke("mcp:read-resource", serverName, uri);
  },
  // Prompt operations
  getPrompt: (serverName, promptName, args) => {
    return import_electron2.ipcRenderer.invoke("mcp:get-prompt", serverName, promptName, args);
  },
  // Event listeners
  onServerConnected: (callback) => {
    const listener = (_event, data) => callback(
      data
    );
    import_electron2.ipcRenderer.on("mcp:server-connected", listener);
    return () => import_electron2.ipcRenderer.removeListener("mcp:server-connected", listener);
  },
  onServerDisconnected: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("mcp:server-disconnected", listener);
    return () => import_electron2.ipcRenderer.removeListener("mcp:server-disconnected", listener);
  },
  onServerError: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("mcp:server-error", listener);
    return () => import_electron2.ipcRenderer.removeListener("mcp:server-error", listener);
  },
  onNotification: (callback) => {
    const listener = (_event, data) => callback(data);
    import_electron2.ipcRenderer.on("mcp:notification", listener);
    return () => import_electron2.ipcRenderer.removeListener("mcp:notification", listener);
  }
};

// electron/preload.ts
var import_electron3 = require("electron");
import_electron3.contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text) => import_electron3.ipcRenderer.invoke("log-input", text),
  getCsvPath: () => import_electron3.ipcRenderer.invoke("get-csv-path"),
  checkForUpdates: () => import_electron3.ipcRenderer.invoke("check-for-updates"),
  getUpdateSettings: () => import_electron3.ipcRenderer.invoke("get-update-settings"),
  setUpdateSettings: (settings) => import_electron3.ipcRenderer.invoke("set-update-settings", settings),
  getUpdateLogs: () => import_electron3.ipcRenderer.invoke("get-update-logs"),
  getUpdateLogPath: () => import_electron3.ipcRenderer.invoke("get-update-log-path"),
  restartWindow: () => import_electron3.ipcRenderer.invoke("restart-window"),
  showTitleBarConfirm: () => import_electron3.ipcRenderer.invoke("show-title-bar-confirm"),
  nodes: {
    get: () => import_electron3.ipcRenderer.invoke("nodes:get"),
    add: (node) => import_electron3.ipcRenderer.invoke("nodes:add", node),
    update: (id, updates) => import_electron3.ipcRenderer.invoke("nodes:update", id, updates),
    delete: (id) => import_electron3.ipcRenderer.invoke("nodes:delete", id),
    onChanged: (callback) => {
      import_electron3.ipcRenderer.on(
        "nodes-changed",
        (_event, nodes) => callback(nodes)
      );
      return () => import_electron3.ipcRenderer.removeAllListeners("nodes-changed");
    }
  },
  aiAgents: {
    get: () => import_electron3.ipcRenderer.invoke("ai-agents:get"),
    set: (agents) => import_electron3.ipcRenderer.invoke("ai-agents:set", agents),
    add: (agent) => import_electron3.ipcRenderer.invoke("ai-agents:add", agent),
    update: (id, updates) => import_electron3.ipcRenderer.invoke("ai-agents:update", id, updates),
    delete: (id) => import_electron3.ipcRenderer.invoke("ai-agents:delete", id),
    clear: () => import_electron3.ipcRenderer.invoke("ai-agents:clear")
  },
  themes: {
    get: () => import_electron3.ipcRenderer.invoke("themes:get"),
    set: (activeTheme) => import_electron3.ipcRenderer.invoke("themes:set", activeTheme)
  },
  aiAgentsHistory: {
    getAll: (agentId) => import_electron3.ipcRenderer.invoke("ai-agents-history:get-all", agentId),
    get: (agentId, sessionId) => import_electron3.ipcRenderer.invoke("ai-agents-history:get", agentId, sessionId),
    save: (chatSession) => import_electron3.ipcRenderer.invoke("ai-agents-history:save", chatSession),
    delete: (agentId, sessionId) => import_electron3.ipcRenderer.invoke("ai-agents-history:delete", agentId, sessionId),
    deleteAll: (agentId) => import_electron3.ipcRenderer.invoke("ai-agents-history:delete-all", agentId)
  },
  mcpAPI,
  gmailAPI
});
