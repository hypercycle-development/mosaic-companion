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
    getAims: () => ipcRenderer.invoke("hyperinsight:get-aims"),
    getLeaderboard: () => ipcRenderer.invoke("hyperinsight:get-leaderboard"),
    getNodes: (params?: any) => ipcRenderer.invoke("hyperinsight:get-nodes", params),
    getNodeDetail: (license: string) => ipcRenderer.invoke("hyperinsight:get-node-detail", license),
    getNodeProfile: (license: number | string) => ipcRenderer.invoke("hyperinsight:get-node-profile", license),
    getAimManifest: (license: string, aimName: string) => ipcRenderer.invoke("hyperinsight:get-node-aim-manifest", license, aimName),
    getNetworkStats: () => ipcRenderer.invoke("hyperinsight:get-network-stats"),
    getNetworkHistory: () => ipcRenderer.invoke("hyperinsight:get-network-history"),
    getAimStats: (name: string, range?: string) => ipcRenderer.invoke("hyperinsight:get-aim-stats", name, range),
    getAimStatsCurrent: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-stats-current", name),
    getAimDetails: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-details", name),
    getAimReleases: (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-releases", name),
    getAimReleaseDetail: (name: string, tag: string) => ipcRenderer.invoke("hyperinsight:get-aim-release-detail", name, tag),
    saveGeneratedImage: (base64Data: string) => ipcRenderer.invoke("hyperinsight:save-generated-image", base64Data),
    // Stage 8A: AIM profile endpoints
    getAimProfile:  (name: string) => ipcRenderer.invoke("hyperinsight:get-aim-profile", name),
    getAimNodes:    (name: string, opts?: any) => ipcRenderer.invoke("hyperinsight:get-aim-nodes", name, opts),
    getAimBestNode: (name: string, opts?: any) => ipcRenderer.invoke("hyperinsight:get-aim-best-node", name, opts),
    // Stage 7C: score cache access
    getToolScore: (endpointUrl: string) => ipcRenderer.invoke("hyperinsight:get-tool-score", endpointUrl),
    getAllToolScores: () => ipcRenderer.invoke("hyperinsight:get-all-tool-scores"),
    getToolScoresLastUpdated: () => ipcRenderer.invoke("hyperinsight:get-tool-scores-last-updated"),
    // Stage 8B: new endpoint bridge
    getAimDeployments:      (aimId: number) => ipcRenderer.invoke("hyperinsight:get-aim-deployments", aimId),
    getToolStatus:          (toolId: string) => ipcRenderer.invoke("hyperinsight:get-tool-status", toolId),
    subscribe:              (payload: any) => ipcRenderer.invoke("hyperinsight:subscribe", payload),
    getSubscriptions:       () => ipcRenderer.invoke("hyperinsight:get-subscriptions"),
    unsubscribe:            (subscriptionId: string) => ipcRenderer.invoke("hyperinsight:unsubscribe", subscriptionId),
    getVerificationHistory: (subscriptionId: string) => ipcRenderer.invoke("hyperinsight:get-verification-history", subscriptionId),
    clearCache:             () => ipcRenderer.invoke("hyperinsight:clear-cache"),
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
  // ─── Stargate Platform APIs ───
  stargate: {
    registerAgentTool: (manifest: any) =>
      ipcRenderer.invoke("stargate:registerAgentTool", manifest),
    unregisterAgentTool: (toolId: string) =>
      ipcRenderer.invoke("stargate:unregisterAgentTool", toolId),
    listAgentTools: () =>
      ipcRenderer.invoke("stargate:listAgentTools"),
    registerAIM: (config: any) =>
      ipcRenderer.invoke("stargate:registerAIM", config),
    unregisterAIM: (serverName: string) =>
      ipcRenderer.invoke("stargate:unregisterAIM", serverName),
    dispatchPrompt: (nodeId: string, prompt: string) =>
      ipcRenderer.invoke("stargate:dispatchPrompt", nodeId, prompt),
    runJob: (jobType: string, params: any) =>
      ipcRenderer.invoke("stargate:runJob", jobType, params),
    testAgentCode: (code: string, templateId: string) =>
      ipcRenderer.invoke("stargate:testAgentCode", code, templateId),
    deployAgentCode: (code: string, config: any) =>
      ipcRenderer.invoke("stargate:deployAgentCode", code, config),
    listDeployed: () =>
      ipcRenderer.invoke("stargate:forge:listDeployed"),
    listRunning: () =>
      ipcRenderer.invoke("stargate:forge:listRunning"),
    stopAgent: (agentId: string) =>
      ipcRenderer.invoke("stargate:forge:stopAgent", agentId),
    enableHealthCheck: (agentId: string, intervalMs: number, maxRestarts: number) =>
      ipcRenderer.invoke("stargate:forge:enableHealthCheck", agentId, intervalMs, maxRestarts),
    disableHealthCheck: (agentId: string) =>
      ipcRenderer.invoke("stargate:forge:disableHealthCheck", agentId),
    isHealthy: (agentId: string) =>
      ipcRenderer.invoke("stargate:forge:isHealthy", agentId),
    deployAgentToNode: (code: string, config: any) =>
      ipcRenderer.invoke("stargate:deployAgentToNode", code, config),
    tillingProvision: (payload: any) =>
      ipcRenderer.invoke("stargate:tilling:provision", payload),
    tillingStop: (tenantId: string) =>
      ipcRenderer.invoke("stargate:tilling:stop", tenantId),
    tillingGetSessions: (wallet: string) =>
      ipcRenderer.invoke("stargate:tilling:getSessions", wallet),
    tillingResume: (tenantId: string) =>
      ipcRenderer.invoke("stargate:tilling:resume", tenantId),
    tillingLock: (tenantId: string, locked: boolean) =>
      ipcRenderer.invoke("stargate:tilling:lock", tenantId, locked),
    tillingCreate: (tenantId: string) =>
      ipcRenderer.invoke("stargate:tilling:create", tenantId),
    tillingGetMessage: (tenantId: string, number: number, license: string, chypc: string) =>
      ipcRenderer.invoke("stargate:tilling:getMessage", tenantId, number, license, chypc),
    tillingUpdate: (tenantId: string, payload: any) =>
      ipcRenderer.invoke("stargate:tilling:update", tenantId, payload),
    skillSyncToNode: (payload: any) =>
      ipcRenderer.invoke("stargate:skill:syncToNode", payload),
    aimify: {
      exec: (command: string, args: string[], options?: { cwd?: string; timeout?: number }) =>
        ipcRenderer.invoke("stargate:aimify:exec", command, args, options),
      readFile: (filePath: string) =>
        ipcRenderer.invoke("stargate:aimify:readFile", filePath),
      writeFile: (filePath: string, content: string) =>
        ipcRenderer.invoke("stargate:aimify:writeFile", filePath, content),
    },
  },
  skills: {
    buildSystemPrompt: (payload: {
      baseSystemPrompt?: string;
      skillNames: string[];
      includeReferences?: boolean;
      maxTokens?: number;
      dialOverrides?: {
        designVariance?: number;
        motionIntensity?: number;
        visualDensity?: number;
      };
    }) => ipcRenderer.invoke("skill:buildSystemPrompt", payload),
  },
  // Krea AI Image Generation
  krea: {
    generate: (payload: any) =>
      ipcRenderer.invoke("krea:generate", payload),
    checkStatus: (generationId: string) =>
      ipcRenderer.invoke("krea:checkStatus", generationId),
    downloadImage: (imageUrl: string, destPath: string) =>
      ipcRenderer.invoke("krea:downloadImage", imageUrl, destPath),
  },
  // ─── Cardano / Tokeo Wallet Bridge ───
  cardano: {
    detectWallets: () =>
      ipcRenderer.invoke("cardano:detectWallets"),
    connectWallet: (walletKey: string) =>
      ipcRenderer.invoke("cardano:connectWallet", walletKey),
    getWalletAssets: () =>
      ipcRenderer.invoke("cardano:getWalletAssets"),
    signTx: (walletKey: string, txHex: string, partialSign?: boolean) =>
      ipcRenderer.invoke("cardano:signTx", walletKey, txHex, partialSign),
    getBridgeStatus: () =>
      ipcRenderer.invoke("cardano:getBridgeStatus"),
    disconnectWallet: () =>
      ipcRenderer.invoke("cardano:disconnectWallet"),
  },
  // ─── 1AM Wallet (Midnight Network) ───
  oneam: {
    detect: () => ipcRenderer.invoke("oneam:detect"),
    connect: () => ipcRenderer.invoke("oneam:connect"),
    disconnect: () => ipcRenderer.invoke("oneam:disconnect"),
    getSession: () => ipcRenderer.invoke("oneam:getSession"),
    fetchData: () => ipcRenderer.invoke("oneam:fetchData"),
    signTx: (txHex: string, partialSign?: boolean) =>
      ipcRenderer.invoke("oneam:signTx", txHex, partialSign),
    submitTx: (txHex: string) =>
      ipcRenderer.invoke("oneam:submitTx", txHex),
    createAgentWallet: (agentId: string, agentName: string) =>
      ipcRenderer.invoke("oneam:createAgentWallet", agentId, agentName),
    delegateAgent: (agentId: string, permissions: string[]) =>
      ipcRenderer.invoke("oneam:delegateAgent", agentId, permissions),
    revokeAgent: (agentId: string) =>
      ipcRenderer.invoke("oneam:revokeAgent", agentId),
    listAgentWallets: () => ipcRenderer.invoke("oneam:listAgentWallets"),
    openExternal: () => ipcRenderer.invoke("oneam:openExternal"),
    generateDust: () => ipcRenderer.invoke("oneam:generateDust"),
  },
  // ─── 1AM CLI (Midnight Wallet Backend) ───
  oneamCli: {
    createWallet: (name: string, options?: any) =>
      ipcRenderer.invoke("oneam-cli:createWallet", name, options),
    listWallets: () => ipcRenderer.invoke("oneam-cli:listWallets"),
    showWallet: (name?: string) =>
      ipcRenderer.invoke("oneam-cli:showWallet", name),
    syncWallet: (name: string, network: string, options?: any) =>
      ipcRenderer.invoke("oneam-cli:syncWallet", name, network, options),
    useWallet: (name: string) =>
      ipcRenderer.invoke("oneam-cli:useWallet", name),
    explorerSummary: () =>
      ipcRenderer.invoke("oneam-cli:explorerSummary"),
    explorerAddressActivity: (identifier: string) =>
      ipcRenderer.invoke("oneam-cli:explorerAddressActivity", identifier),
  },
  // ─── Hermes Dashboard ───
  hermes: {
    startDashboard: (port?: number) =>
      ipcRenderer.invoke("hermes:start-dashboard", port),
    stopDashboard: () => ipcRenderer.invoke("hermes:stop-dashboard"),
    dashboardStatus: () => ipcRenderer.invoke("hermes:dashboard-status"),
  },
  // ─── Midnight City ───
  midnightCity: {
    connect: (params: { agentId: string }) =>
      ipcRenderer.invoke("midnight:connect", params),
    disconnect: (params?: { force?: boolean }) =>
      ipcRenderer.invoke("midnight:disconnect", params),
    getStatus: () =>
      ipcRenderer.invoke("midnight:getStatus"),
    getLogs: () =>
      ipcRenderer.invoke("midnight:getLogs"),
    setLock: (locked: boolean) =>
      ipcRenderer.invoke("midnight:setLock", locked),
    call: (params: { endpoint: string; method: "GET" | "POST"; body?: any }) =>
      ipcRenderer.invoke("midnight:apiCall", params),
    readScript: (filePath: string) =>
      ipcRenderer.invoke("midnight:readScript", filePath),
    writeScript: (params: { path: string; content: string }) =>
      ipcRenderer.invoke("midnight:writeScript", params),
    restartMiner: () =>
      ipcRenderer.invoke("midnight:restartMiner"),
    deployAgent: (params: { name: string; profession: string; baseImage: string }) =>
      ipcRenderer.invoke("midnight:deployAgent", params),
    getConfig: () => ipcRenderer.invoke("midnight:getConfig"),
    setConfig: (creds: { agentId: string; apiKey: string; profession: string; apiBase: string }) =>
      ipcRenderer.invoke("midnight:setConfig", creds),
    clearConfig: () => ipcRenderer.invoke("midnight:clearConfig"),
  },
  // ─── Node Factory ───
  nodeFactory: {
    loadJsonFile: (filePath: string) =>
      ipcRenderer.invoke("nodeFactory:loadJsonFile", filePath),
    checkLicense: (licenseId: string, apiBase: string) =>
      ipcRenderer.invoke("nodeFactory:checkLicense", licenseId, apiBase),
  },
});

contextBridge.exposeInMainWorld("chatAPI", chatAPI);
