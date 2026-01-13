const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text) => ipcRenderer.invoke("log-input", text),
  getCsvPath: () => ipcRenderer.invoke("get-csv-path"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  getUpdateSettings: () => ipcRenderer.invoke("get-update-settings"),
  setUpdateSettings: (settings) => ipcRenderer.invoke("set-update-settings", settings),
  aiAgents: {
    get: () => ipcRenderer.invoke("ai-agents:get"),
    set: (agents) => ipcRenderer.invoke("ai-agents:set", agents),
    add: (agent) => ipcRenderer.invoke("ai-agents:add", agent),
    update: (id, updates) =>
      ipcRenderer.invoke("ai-agents:update", id, updates),
    delete: (id) => ipcRenderer.invoke("ai-agents:delete", id),
    clear: () => ipcRenderer.invoke("ai-agents:clear"),
  },
});
