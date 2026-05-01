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
  // Need licenseKey to connect to node manifests in hyperinsight-aims.json
  licenseKey?: string;
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
  // Tool sandbox management (WASM tools)
  toolSandbox: {
    inspectManifest: (wasmPath: string) =>
      ipcRenderer.invoke("toolSandbox:inspectManifest", wasmPath),
    install: (wasmPath: string, approval: { approved: boolean }) =>
      ipcRenderer.invoke("toolSandbox:install", wasmPath, approval),
    update: (wasmPath: string, approval: { approved: boolean }) =>
      ipcRenderer.invoke("toolSandbox:update", wasmPath, approval),
    uninstall: (toolId: string) =>
      ipcRenderer.invoke("toolSandbox:uninstall", toolId),
    launch: (toolId: string) =>
      ipcRenderer.invoke("toolSandbox:launch", toolId),
    stop: (toolId: string) =>
      ipcRenderer.invoke("toolSandbox:stop", toolId),
    listInstalled: () =>
      ipcRenderer.invoke("toolSandbox:listInstalled"),
    listRunning: () =>
      ipcRenderer.invoke("toolSandbox:listRunning"),
    setPinned: (toolId: string, pinned: boolean) =>
      ipcRenderer.invoke("toolSandbox:setPinned", toolId, pinned),
    setInput: (toolId: string, key: string, value: string) =>
      ipcRenderer.invoke("toolSandbox:setInput", toolId, key, value),
    deleteInput: (toolId: string, key: string) =>
      ipcRenderer.invoke("toolSandbox:deleteInput", toolId, key),
    getInputStatus: (toolId: string) =>
      ipcRenderer.invoke("toolSandbox:getInputStatus", toolId),
    isAvailable: () =>
      ipcRenderer.invoke("toolSandbox:isAvailable"),
    renderPanel: (toolId: string, panelId: string, context?: Record<string, unknown>) =>
      ipcRenderer.invoke("toolSandbox:renderPanel", toolId, panelId, context),
    callFunction: (toolId: string, functionName: string, args: Record<string, unknown>) =>
      ipcRenderer.invoke("toolSandbox:callFunction", toolId, functionName, args),
  },
  // Chronicle (tool activity log)
  chronicle: {
    read: (toolId: string, query?: Record<string, unknown>) =>
      ipcRenderer.invoke("chronicle:read", toolId, query),
    hasEntries: (toolId: string) =>
      ipcRenderer.invoke("chronicle:hasEntries", toolId),
  },
  // File dialog
  dialog: {
    openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke("dialog:open-file", options),
  },
  // Window controls (for custom title bar)
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    // HyperCycle Node status (from community installer)
    getNodeStatus: () => ipcRenderer.invoke("get-node-status"),
    openExternal: (url: string) => ipcRenderer.send("open-external", url),
  },
  // Web3 wallet & address book bridge
  trading: {
    saveWallet: (key: string) =>
      ipcRenderer.invoke("tools:execute", "web3:save-wallet", {
        privateKey: key,
      }),
    importFromClipboard: () =>
      ipcRenderer.invoke("web3:import-from-clipboard"),
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
    importFromClipboard: () =>
      ipcRenderer.invoke("web3:import-from-clipboard"),
    openSecureImportWindow: () =>
      ipcRenderer.invoke("web3:open-secure-import-window"),
    onWalletImported: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on("wallet:imported", handler);
      return () => ipcRenderer.removeListener("wallet:imported", handler);
    },
    // TODA
    saveTodaApiKey: (apiKey: string) =>
      ipcRenderer.invoke("web3:save-toda-api-key", apiKey),
    deleteTodaApiKey: () => ipcRenderer.invoke("web3:delete-toda-api-key"),
    todaHasConfig: () => ipcRenderer.invoke("web3:toda-has-config"),
    signHypercycleNonce: (nonce: string) =>
      ipcRenderer.invoke("web3:sign-hypercycle-nonce", nonce),
  },
  // HyperInsight plugin
  hyperinsight: {
    getStatus: () => ipcRenderer.invoke("hyperinsight:get-status"),
    ensureKey: () => ipcRenderer.invoke("hyperinsight:ensure-key"),
    resetKey: () => ipcRenderer.invoke("hyperinsight:reset-key"),
    // AIM Discovery
    getAims: () => ipcRenderer.invoke("hyperinsight:get-aims"),
    getDiscover: (params?: any) => ipcRenderer.invoke("hyperinsight:get-discover", params),
    getCatalog: () => ipcRenderer.invoke("hyperinsight:get-catalog"),
    getLeaderboard: () => ipcRenderer.invoke("hyperinsight:get-leaderboard"),
    compareAims: (names: string[]) => ipcRenderer.invoke("hyperinsight:compare-aims", names),
    // AIM Details
    getAimProfile: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-profile", name),
    getAimDetails: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-details", name),
    getAimCapabilities: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-capabilities", name),
    getAimNodes: (name: string, params?: any) => ipcRenderer.invoke("hyperinsight:get-aim-nodes", name, params),
    getAimReleases: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-releases", name),
    getAimReleaseDetail: (name: string, tag: string) => ipcRenderer.invoke("hyperinsight:get-aim-release-detail", name, tag),
    getAimReleaseRequirements: (name: string, tag: string) => ipcRenderer.invoke("hyperinsight:get-aim-release-requirements", name, tag),
    // Stats
    getAimStats: (name: string, range?: string) => ipcRenderer.invoke("hyperinsight:get-aim-stats", name, range),
    getAimStatsCurrent: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-stats-current", name),
    // Nodes
    getNodes: (params?: any) => ipcRenderer.invoke("hyperinsight:get-nodes", params),
    getNodeDetail: (license: string) => ipcRenderer.invoke("hyperinsight:get-node-detail", license),
    getNodeCapabilities: (license: string, includeDeployed?: boolean) => ipcRenderer.invoke("hyperinsight:get-node-capabilities", license, includeDeployed),
    getAimManifest: (license: string, aimName: string) => ipcRenderer.invoke("hyperinsight:get-node-aim-manifest", license, aimName),
    // Network
    getNetworkStats: () => ipcRenderer.invoke("hyperinsight:get-network-stats"),
    getNetworkHistory: () => ipcRenderer.invoke("hyperinsight:get-network-history"),
    getNetworkStatus: () => ipcRenderer.invoke("hyperinsight:get-network-status"),
    getNetworkRegions: () => ipcRenderer.invoke("hyperinsight:get-network-regions"),
    // Storage
    saveGeneratedImage: (base64Data: string) => ipcRenderer.invoke("hyperinsight:save-generated-image", base64Data),
    // AIM Nodes data
    saveNodeData: (license: string, data: any) => ipcRenderer.invoke("aimnodes:save-node-data", license, data),
    deleteNodeData: (license: string) => ipcRenderer.invoke("aimnodes:delete-node-data", license),
    getSavedAims: (license?: string) => ipcRenderer.invoke("aimnodes:get-saved-aims", license),
    handlePayment: (paymentData: any) => ipcRenderer.invoke("aimnodes:handle-payment", paymentData),
  },
  // Media — safe data: URI delivery for tool-generated media files
  media: {
    readAsDataUri: (mediaUrl: string) => ipcRenderer.invoke("media:read-as-data-uri", mediaUrl),
    getAutoDisplay: () => ipcRenderer.invoke("media:get-auto-display"),
    setAutoDisplay: (enabled: boolean) => ipcRenderer.invoke("media:set-auto-display", enabled),
  },
  // JIT Payments plugin
  paymentsJit: {
    onRequestApproval: (handler: (data: any) => void) => {
      const wrappedHandler = (_event: IpcRendererEvent, data: any) => handler(data);
      ipcRenderer.on('payments-jit:request_approval', wrappedHandler);
      return () => ipcRenderer.removeListener('payments-jit:request_approval', wrappedHandler);
    },
    approveResult: (requestId: string, approved: boolean) =>
      ipcRenderer.invoke('payments-jit:approve_tx_result', { requestId, approved }),
  },
  // IDE integration
  ide: {
    fs: {
      readDir: (dirPath: string) => ipcRenderer.invoke("ide:fs:read-dir", dirPath),
      readFile: (filePath: string) => ipcRenderer.invoke("ide:fs:read-file", filePath),
      writeFile: (filePath: string, content: string) => ipcRenderer.invoke("ide:fs:write-file", filePath, content),
      createFile: (filePath: string, content?: string) => ipcRenderer.invoke("ide:fs:create-file", filePath, content),
      createDir: (dirPath: string) => ipcRenderer.invoke("ide:fs:create-dir", dirPath),
      delete: (targetPath: string) => ipcRenderer.invoke("ide:fs:delete", targetPath),
      rename: (oldPath: string, newPath: string) => ipcRenderer.invoke("ide:fs:rename", oldPath, newPath),
      stat: (targetPath: string) => ipcRenderer.invoke("ide:fs:stat", targetPath),
      openFolder: () => ipcRenderer.invoke("ide:fs:open-folder"),
    },
    pty: {
      create: (cwd: string) => ipcRenderer.invoke("ide:pty:create", cwd),
      write: (id: string, data: string) => ipcRenderer.invoke("ide:pty:write", id, data),
      resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke("ide:pty:resize", id, cols, rows),
      destroy: (id: string) => ipcRenderer.invoke("ide:pty:destroy", id),
      onData: (callback: (data: { id: string; data: string }) => void) => {
        const handler = (_e: IpcRendererEvent, data: { id: string; data: string }) => callback(data);
        ipcRenderer.on("ide:pty:data", handler);
        return () => ipcRenderer.removeListener("ide:pty:data", handler);
      },
      onExit: (callback: (data: { id: string; code: number }) => void) => {
        const handler = (_e: IpcRendererEvent, data: { id: string; code: number }) => callback(data);
        ipcRenderer.on("ide:pty:exit", handler);
        return () => ipcRenderer.removeListener("ide:pty:exit", handler);
      },
    },
    project: {
      getRecent: () => ipcRenderer.invoke("ide:project:get-recent"),
      saveRecent: (projectPath: string) => ipcRenderer.invoke("ide:project:save-recent", projectPath),
      getGitStatus: (cwd: string) => ipcRenderer.invoke("ide:project:get-git-status", cwd),
      getGitBranch: (cwd: string) => ipcRenderer.invoke("ide:project:get-git-branch", cwd),
    },
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
