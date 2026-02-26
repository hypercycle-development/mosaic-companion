import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agent", {
  send: (text: string) =>
    ipcRenderer.invoke("agent:send", text),
  triggerHeartbeat: (agentId?: string) =>
    ipcRenderer.invoke("heartbeat:trigger", agentId),
  listSkills: () =>
    ipcRenderer.invoke("skills:list"),
  onMessage: (cb: (msg: { to: string; text: string; channel: string }) => void) => {
    ipcRenderer.on("agent:message", (_e, msg) => cb(msg));
  },
});

contextBridge.exposeInMainWorld("memory", {
  search: (query: string, opts?: { maxResults?: number; minScore?: number }) =>
    ipcRenderer.invoke("memory:search", query, opts),
  read: (relPath: string, from?: number, lines?: number) =>
    ipcRenderer.invoke("memory:read", relPath, from, lines),
  sync: () =>
    ipcRenderer.invoke("memory:sync"),
  status: () =>
    ipcRenderer.invoke("memory:status"),
});
