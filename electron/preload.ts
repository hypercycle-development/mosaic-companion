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
    resolveKey: (agentId: string) =>
      ipcRenderer.invoke("ai-agents:resolve-key", agentId),
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
  tools: {
    execute: (
      fullName: string,
      args: Record<string, unknown>,
      context?: { agentId?: string },
    ) => ipcRenderer.invoke("tools:execute", fullName, args, context),
    listModules: () => ipcRenderer.invoke("tools:list-modules"),
    getSystemPrompt: () => ipcRenderer.invoke("tools:get-system-prompt"),
    getActionPatterns: () => ipcRenderer.invoke("tools:get-action-patterns"),
  },
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
  // Web3 wallet & address book bridge
  trading: {
    saveWallet: (key: string) =>
      ipcRenderer.invoke("tools:execute", "web3:save-wallet", {
        privateKey: key,
      }),
    deleteWallet: () =>
      ipcRenderer.invoke("tools:execute", "web3:delete-wallet", {}),
    walletExists: () =>
      ipcRenderer.invoke("tools:execute", "web3:wallet-exists", {}),
    getAddress: () =>
      ipcRenderer.invoke("tools:execute", "web3:get_wallet_address", {}),
  },
  web3: {
    // Wallet
    getAddress: () =>
      ipcRenderer.invoke("tools:execute", "web3:get_wallet_address", {}),
    getBalance: (address?: string) =>
      ipcRenderer.invoke("tools:execute", "web3:get_wallet_balance", {
        address,
      }),
    // Address book
    getContacts: () =>
      ipcRenderer.invoke("tools:execute", "web3:list_saved_wallets", {}),
    saveContact: (name: string, address: string) =>
      ipcRenderer.invoke("tools:execute", "web3:save_wallet_contact", {
        name,
        address,
      }),
    deleteContact: (id: string) =>
      ipcRenderer.invoke("tools:execute", "web3:delete_wallet_contact", { id }),
    lookupContact: (name: string) =>
      ipcRenderer.invoke("tools:execute", "web3:lookup_saved_wallet", { name }),
    // Network
    getNetworkInfo: () =>
      ipcRenderer.invoke("tools:execute", "web3:get_network_info", {}),
    switchNetwork: (network: string) =>
      ipcRenderer.invoke("tools:execute", "web3:switch_network", { network }),
    // Token on-chain lookup
    lookupToken: (contractAddress: string) =>
      ipcRenderer.invoke("tools:execute", "web3:lookup_token_onchain", {
        contractAddress,
      }),
    // Config (direct IPC — not through tool registry, needs dedicated handler)
    getConfig: () => ipcRenderer.invoke("web3:get-config"),
    updateConfig: (updates: Record<string, unknown>) =>
      ipcRenderer.invoke("web3:update-config", updates),
  },
  // Vault (named boxes & agent access)
  vault: {
    getBoxes: () => ipcRenderer.invoke("vault:get-boxes"),
    getBox: (id: string) => ipcRenderer.invoke("vault:get-box", id),
    addBox: (input: {
      name: string;
      description?: string;
      sourceType?: string;
    }) => ipcRenderer.invoke("vault:add-box", input),
    updateBox: (
      id: string,
      updates: { name?: string; description?: string; sourceType?: string },
    ) => ipcRenderer.invoke("vault:update-box", id, updates),
    deleteBox: (id: string) => ipcRenderer.invoke("vault:delete-box", id),
    getAgentBoxes: (agentId: string) =>
      ipcRenderer.invoke("vault:get-agent-boxes", agentId),
    // Content
    getBoxContent: (boxId: string) =>
      ipcRenderer.invoke("vault:get-box-content", boxId),
    addEntry: (boxId: string, input: { content: string; label?: string }) =>
      ipcRenderer.invoke("vault:add-entry", boxId, input),
    updateEntry: (
      boxId: string,
      entryId: string,
      updates: { content?: string; label?: string },
    ) => ipcRenderer.invoke("vault:update-entry", boxId, entryId, updates),
    deleteEntry: (boxId: string, entryId: string) =>
      ipcRenderer.invoke("vault:delete-entry", boxId, entryId),
  },
});

contextBridge.exposeInMainWorld("chatAPI", chatAPI);
