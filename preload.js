const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text) => ipcRenderer.invoke("log-input", text),
  getCsvPath: () => ipcRenderer.invoke("get-csv-path"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  getUpdateSettings: () => ipcRenderer.invoke("get-update-settings"),
  setUpdateSettings: (settings) => ipcRenderer.invoke("set-update-settings", settings),
  getUpdateLogs: () => ipcRenderer.invoke("get-update-logs"),
  getUpdateLogPath: () => ipcRenderer.invoke("get-update-log-path"),
  nodes: {
    get: () => ipcRenderer.invoke("nodes:get"),
    add: (node) => ipcRenderer.invoke("nodes:add", node),
    update: (id, updates) => ipcRenderer.invoke("nodes:update", id, updates),
    delete: (id) => ipcRenderer.invoke("nodes:delete", id),
    onChanged: (callback) => {
      ipcRenderer.on("nodes-changed", (event, nodes) => callback(nodes));
      // Return cleanup function
      return () => ipcRenderer.removeAllListeners("nodes-changed");
    },
  },
  aiAgents: {
    get: () => ipcRenderer.invoke("ai-agents:get"),
    set: (agents) => ipcRenderer.invoke("ai-agents:set", agents),
    add: (agent) => ipcRenderer.invoke("ai-agents:add", agent),
    update: (id, updates) =>
      ipcRenderer.invoke("ai-agents:update", id, updates),
    delete: (id) => ipcRenderer.invoke("ai-agents:delete", id),
    clear: () => ipcRenderer.invoke("ai-agents:clear"),
  },
  gmail: {
    signIn: () => ipcRenderer.invoke("gmail:sign-in"),
    signOut: () => ipcRenderer.invoke("gmail:sign-out"),
    getStatus: () => ipcRenderer.invoke("gmail:get-status"),
    getEmails: (count) => ipcRenderer.invoke("gmail:get-emails", count),
    getEmailDetails: (messageId) => ipcRenderer.invoke("gmail:get-email-details", messageId),
    searchEmails: (query, count) => ipcRenderer.invoke("gmail:search-emails", query, count),
  },
});
