import { gmailAPI } from "./integrations/gmail/gmailAPI";
import { mcpAPI, osAPI } from "./integrations/mcp/MCPAPI";
import { chatAPI } from "./integrations/chat/CHATAPI";
import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import "./integrations/mosaicbot/src/preload";

// =============================================================================
// Type Definitions
// =============================================================================

interface Node {
  id: string;
  name: string;
  apiHost: string;
  apiPort: string;
  hasAdminPanel: boolean;
  adminHost: string;
  adminPort: string;
  isActive: boolean;
}

interface AIAgent {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ChatSession {
  id: string;
  agentId: string;
  [key: string]: unknown;
}

interface UpdateSettings {
  autoDownload?: boolean;
  titleBarStyle?: string;
}

// =============================================================================
// Expose API to Renderer
// =============================================================================

contextBridge.exposeInMainWorld("electronAPI", {
  logInput: (text: string) => ipcRenderer.invoke("log-input", text),
  getCsvPath: () => ipcRenderer.invoke("get-csv-path"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  getUpdateSettings: () => ipcRenderer.invoke("get-update-settings"),
  setUpdateSettings: (settings: UpdateSettings) =>
    ipcRenderer.invoke("set-update-settings", settings),
  getUpdateLogs: () => ipcRenderer.invoke("get-update-logs"),
  getUpdateLogPath: () => ipcRenderer.invoke("get-update-log-path"),
  restartWindow: () => ipcRenderer.invoke("restart-window"),
  showTitleBarConfirm: () => ipcRenderer.invoke("show-title-bar-confirm"),
  nodes: {
    get: () => ipcRenderer.invoke("nodes:get"),
    add: (node: Partial<Omit<Node, "id">>) =>
      ipcRenderer.invoke("nodes:add", node),
    update: (id: string, updates: Partial<Omit<Node, "id">>) =>
      ipcRenderer.invoke("nodes:update", id, updates),
    delete: (id: string) => ipcRenderer.invoke("nodes:delete", id),
    onChanged: (callback: (nodes: Node[]) => void) => {
      ipcRenderer.on(
        "nodes-changed",
        (_event: IpcRendererEvent, nodes: Node[]) => callback(nodes),
      );
      // Return cleanup
      return () => ipcRenderer.removeAllListeners("nodes-changed");
    },
  },
  aiAgents: {
    get: () => ipcRenderer.invoke("ai-agents:get"),
    set: (agents: AIAgent[]) => ipcRenderer.invoke("ai-agents:set", agents),
    add: (agent: Omit<AIAgent, "id">) =>
      ipcRenderer.invoke("ai-agents:add", agent),
    update: (id: string, updates: Partial<Omit<AIAgent, "id">>) =>
      ipcRenderer.invoke("ai-agents:update", id, updates),
    delete: (id: string) => ipcRenderer.invoke("ai-agents:delete", id),
    clear: () => ipcRenderer.invoke("ai-agents:clear"),
  },
  themes: {
    get: () => ipcRenderer.invoke("themes:get"),
    set: (activeTheme: string) => ipcRenderer.invoke("themes:set", activeTheme),
  },
  aiAgentsHistory: {
    getAll: (agentId: string) =>
      ipcRenderer.invoke("ai-agents-history:get-all", agentId),
    get: (agentId: string, sessionId: string) =>
      ipcRenderer.invoke("ai-agents-history:get", agentId, sessionId),
    save: (chatSession: ChatSession) =>
      ipcRenderer.invoke("ai-agents-history:save", chatSession),
    delete: (agentId: string, sessionId: string) =>
      ipcRenderer.invoke("ai-agents-history:delete", agentId, sessionId),
    deleteAll: (agentId: string) =>
      ipcRenderer.invoke("ai-agents-history:delete-all", agentId),
  },
  mcpAPI,
  osAPI,
  gmail: gmailAPI,
  // Linux AppImage sandbox state (read-only)
  sandbox: {
    getState: () => ipcRenderer.invoke("sandbox:get-state"),
  },
  // Window controls (for custom title bar)
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  },
});

contextBridge.exposeInMainWorld("chatAPI", chatAPI);
