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
  // ── NEW: Team Dispatch — Parallel multi-agent orchestration ──
  teamDispatch: (agentId: string, prompt: string, systemPrompt?: string) =>
    ipcRenderer.invoke("team:dispatch", agentId, prompt, systemPrompt),

  // ── NEW: Skill Importer ──
  getImportLog: () => ipcRenderer.invoke("skills:import-log"),
  getPendingImports: () => ipcRenderer.invoke("skills:pending"),
  approveSkill: (name: string) => ipcRenderer.invoke("skills:approve", name),
  removeSkill: (name: string) => ipcRenderer.invoke("skills:remove", name),
  forceScan: () => ipcRenderer.invoke("skills:force-scan"),
  // ── NEW: Orchestrator ──
  getOrchestratorStatus: () => ipcRenderer.invoke("orchestrator:status"),
  getAgentProfiles: () => ipcRenderer.invoke("agents:profiles"),

  // ── NEW: Memory Bridge — Codebase Memory MCP ──
  queryContext: (project: string, query: string, limit?: number) =>
    ipcRenderer.invoke("memory:query-context", project, query, limit),
  getSessionContext: () => ipcRenderer.invoke("memory:session-context"),
  indexSession: (sessionId: string, summary: string, skills: string[], projects: string[]) =>
    ipcRenderer.invoke("memory:index-session", sessionId, summary, skills, projects),

  // ── NEW: Stargate Registry — Component Self-Awareness ──
  getStargateComponents: () => ipcRenderer.invoke("stargate:components"),
  getStargateFleet: () => ipcRenderer.invoke("stargate:fleet"),
  getStargateContracts: () => ipcRenderer.invoke("stargate:contracts"),
  getStargateDown: () => ipcRenderer.invoke("stargate:down"),
  getStargateSummary: () => ipcRenderer.invoke("stargate:summary"),
  getStargateCapabilities: () => ipcRenderer.invoke("stargate:capabilities"),
  // ── NEW: Stargate Indexer ──
  indexStargate: () => ipcRenderer.invoke("stargate:index-all"),
  getStargateHistory: (limit?: number) => ipcRenderer.invoke("stargate:history", limit),
  getStargateTrend: () => ipcRenderer.invoke("stargate:trend"),
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
