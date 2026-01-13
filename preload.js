const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text) => ipcRenderer.invoke("log-input", text),
  getCsvPath: () => ipcRenderer.invoke("get-csv-path"),
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
