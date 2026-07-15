import type { AIAgentConfig, ChatSession } from './types/ai';
import type { ChatSettings, Room, StoredMessage, Member } from './types/chat';
import type { ToolManifest, InstalledTool, ChronicleSource, ChronicleEntryType, ChronicleEntry, ChronicleQuery } from './electron/integrations/sandbox/types';

declare global {
  // Vault types
  type BoxSourceType = "manual" | "import" | "connector";

  // IPC-adapted variant of RunningTool: Date → string, ToolStatus → string (JSON transport)
  interface RunningToolInfo {
    toolId: string;
    status: string;
    startedAt: string;
    manifest: ToolManifest;
  }

  interface VaultBox {
    id: string;
    name: string;
    description?: string;
    sourceType: BoxSourceType;
    createdAt: number;
    updatedAt: number;
  }

  interface VaultEntry {
    id: string;
    label?: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }

  // Update settings configuration
  interface UpdateSettings {
    autoDownload: boolean;
    titleBarStyle?: "hidden" | "default";
    nodes: HypercycleNode[];
  }

  // Hypercycle Node configuration
  interface HypercycleNode {
    id: string;
    name: string;
    apiHost: string;
    apiPort?: string;
    hasAdminPanel: boolean;
    adminHost?: string;
    adminPort?: string;
    isActive: boolean;
    licenseKey?: string;
  }

  interface Window {
    electronAPI: {
      // Existing methods
      logInput: (text: string) => Promise<{ success: boolean; path: string }>;
      getCsvPath: () => Promise<string>;

      // Update methods
      checkForUpdates: () => Promise<{
        triggered: boolean;
        reason?: string;
      }>;
      getUpdateSettings: () => Promise<UpdateSettings>;
      setUpdateSettings: (settings: Partial<UpdateSettings>) => Promise<{
        success: boolean;
        settings: UpdateSettings;
        error?: string;
      }>;
      getUpdateLogs: () => Promise<string>;
      getUpdateLogPath: () => Promise<string>;
      restartWindow: () => Promise<{ success: boolean }>;
      showTitleBarConfirm: () => Promise<{ buttonIndex: number }>;

      // Hypercycle Nodes methods
      nodes: {
        get: () => Promise<HypercycleNode[]>;
        add: (node: Partial<HypercycleNode>) => Promise<{
          success: boolean;
          nodes?: HypercycleNode[];
          error?: string;
        }>;
        update: (
          id: string,
          updates: Partial<HypercycleNode>,
        ) => Promise<{
          success: boolean;
          nodes?: HypercycleNode[];
          error?: string;
        }>;
        delete: (id: string) => Promise<{
          success: boolean;
          nodes?: HypercycleNode[];
          error?: string;
        }>;
        onChanged: (callback: (nodes: HypercycleNode[]) => void) => () => void;
      };

      // Gmail methods
      gmail: {
        signIn: () => Promise<{
          success: boolean;
          email?: string;
          error?: string;
        }>;
        signOut: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{
          authenticated: boolean;
          email?: string;
          error?: string;
        }>;
        getEmails: (count?: number) => Promise<{
          success: boolean;
          emails?: Array<{
            id: string;
            threadId: string;
            snippet: string;
            subject: string;
            from: string;
            date: string;
            isUnread: boolean;
          }>;
          error?: string;
        }>;
        getEmailDetails: (messageId: string) => Promise<{
          success: boolean;
          email?: {
            id: string;
            threadId: string;
            snippet: string;
            subject: string;
            from: string;
            to: string;
            date: string;
            body: string;
            isUnread: boolean;
          };
          error?: string;
        }>;
        searchEmails: (
          query: string,
          count?: number,
        ) => Promise<{
          success: boolean;
          emails?: Array<{
            id: string;
            threadId: string;
            snippet: string;
            subject: string;
            from: string;
            date: string;
            isUnread: boolean;
          }>;
          error?: string;
        }>;
        markRead: (messageId: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        markUnread: (messageId: string) => Promise<{
          success: boolean;
          error?: string;
        }>;
        getAutoMarkRead: () => Promise<{
          enabled: boolean;
        }>;
        setAutoMarkRead: (enabled: boolean) => Promise<{
          success: boolean;
          enabled: boolean;
          error?: string;
        }>;
      };

      // AI Agents methods
      aiAgents: {
        get: () => Promise<AIAgentConfig[]>;
        set: (
          agents: AIAgentConfig[],
        ) => Promise<{ success: boolean; error?: string }>;
        add: (
          agent: AIAgentConfig,
        ) => Promise<{ success: boolean; error?: string }>;
        update: (
          id: string,
          updates: Partial<AIAgentConfig>,
        ) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        clear: () => Promise<{ success: boolean; error?: string }>;
      };
      themes: {
        get: () => Promise<{ activeTheme: string }>;
        set: (activeTheme: string) => Promise<{ success: boolean }>;
      };
      aiAgentsHistory: {
        getAll: (agentId: string) => Promise<ChatSession[]>;
        get: (
          agentId: string,
          sessionId: string,
        ) => Promise<ChatSession | null>;
        save: (
          chatSession: ChatSession,
        ) => Promise<{ success: boolean; error?: string }>;
        delete: (
          agentId: string,
          sessionId: string,
        ) => Promise<{ success: boolean; error?: string }>;
        deleteAll: (
          agentId: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };

      // Sandbox state
      sandbox: {
        getState: () => Promise<{
          isFallback: boolean;
          isLinux: boolean;
          isAppImage: boolean;
          noSandboxFlag: boolean;
        }>;
      };

      // Window controls (for custom title bar)
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };

      // Trading Agent (backward compat)
      trading: {
          saveWallet: (key: string) => Promise<{ success: boolean }>;
          deleteWallet: () => Promise<{ success: boolean }>;
          walletExists: () => Promise<{ exists: boolean }>;
          getAddress: () => Promise<{ success: boolean; data?: { address: string }; error?: string }>;
      };

      // Web3 bridge
      web3: {
          getAddress: () => Promise<{ success: boolean; data?: { address: string }; error?: string }>;
          getBalance: (address?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
          getContacts: () => Promise<{ success: boolean; data?: string; error?: string }>;
          saveContact: (name: string, address: string) => Promise<{ success: boolean; data?: string; error?: string }>;
          deleteContact: (id: string) => Promise<{ success: boolean; error?: string }>;
          lookupContact: (name: string) => Promise<{ success: boolean; data?: { name: string; address: string }; error?: string }>;
          getNetworkInfo: () => Promise<{ success: boolean; data?: string; error?: string }>;
          switchNetwork: (network: string) => Promise<{ success: boolean; data?: string; error?: string }>;
          lookupToken: (contractAddress: string) => Promise<{ success: boolean; data?: string; error?: string }>;
          getConfig: () => Promise<any>;
          updateConfig: (updates: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
          importFromClipboard: () => Promise<{ success: boolean; error?: string }>;
          openSecureImportWindow: () => Promise<void>;
          onWalletImported: (callback: () => void) => () => void;
          saveTodaApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
          deleteTodaApiKey: () => Promise<{ success: boolean }>;
          todaHasConfig: () => Promise<{ configured: boolean }>;
          signHypercycleNonce: (
            nonce: string,
          ) => Promise<{ success: boolean; signature?: string; error?: string }>;
      };

      // Tools registry bridge
      tools: {
          execute: (fullName: string, args: Record<string, unknown>, context?: { agentId?: string }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
          listModules: () => Promise<Array<{ name: string; displayName: string; toolCount: number; tools: Array<{ name: string; description: string }> }>>;
          getSystemPrompt: () => Promise<string>;
          getActionPatterns: () => Promise<Array<{ moduleName: string; toolName: string; pattern: string; flags: string }>>;
      };

      // IDE integration
      ide: {
        fs: {
          readDir: (dirPath: string) => Promise<{ success: boolean; entries?: Array<{ name: string; type: "file" | "directory" | "symlink"; size: number; modifiedMs: number }>; error?: string }>;
          readFile: (filePath: string) => Promise<{ success: boolean; content?: string; isBinary?: boolean; error?: string }>;
          writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
          createFile: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
          createDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
          delete: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
          rename: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
          stat: (targetPath: string) => Promise<{ success: boolean; stat?: { size: number; isDirectory: boolean; isFile: boolean; modifiedMs: number }; error?: string }>;
          openFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
        };
        pty: {
          create: (cwd: string) => Promise<{ success: boolean; id?: string; error?: string }>;
          write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
          resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
          destroy: (id: string) => Promise<{ success: boolean }>;
          onData: (callback: (data: { id: string; data: string }) => void) => () => void;
          onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        };
        project: {
          getRecent: () => Promise<string[]>;
          saveRecent: (projectPath: string) => Promise<{ success: boolean }>;
          getGitStatus: (cwd: string) => Promise<{ success: boolean; files?: Array<{ path: string; status: string }>; error?: string }>;
          getGitBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>;
        };
      };

      // Vault (named boxes & agent access)
      vault: {
        getBoxes: () => Promise<VaultBox[]>;
        getBox: (id: string) => Promise<VaultBox | null>;
        addBox: (input: { name: string; description?: string; sourceType?: BoxSourceType }) => Promise<{
          success: boolean;
          box?: VaultBox;
          error?: string;
        }>;
        updateBox: (id: string, updates: { name?: string; description?: string; sourceType?: BoxSourceType }) => Promise<{
          success: boolean;
          box?: VaultBox;
          error?: string;
        }>;
        deleteBox: (id: string) => Promise<{ success: boolean; error?: string }>;
        getAgentBoxes: (agentId: string) => Promise<VaultBox[]>;
        // Content
        getBoxContent: (boxId: string) => Promise<VaultEntry[]>;
        addEntry: (boxId: string, input: { content: string; label?: string }) => Promise<{
          success: boolean;
          entry?: VaultEntry;
          error?: string;
        }>;
        updateEntry: (boxId: string, entryId: string, updates: { content?: string; label?: string }) => Promise<{
          success: boolean;
          entry?: VaultEntry;
          error?: string;
        }>;
        deleteEntry: (boxId: string, entryId: string) => Promise<{ success: boolean; error?: string }>;
      };

      // HyperInsight plugin
      hyperinsight: {
        getStatus: () => Promise<{ registered: boolean; tier?: string; clientId?: string }>;
        ensureKey: () => Promise<{ success: boolean; clientId?: string; error?: string }>;
        resetKey: () => Promise<{ success: boolean; error?: string }>;
        getAims: () => Promise<any>;
        getLeaderboard: () => Promise<any>;
        getNodes: (params?: any) => Promise<any>;
        getNodeDetail: (license: string) => Promise<any>;
        getAimManifest: (license: string, aimName: string) => Promise<any>;
        getNetworkStats: () => Promise<any>;
        getNetworkHistory: () => Promise<any>;
        getAimStats: (name: string, range?: string) => Promise<any>;
        getAimStatsCurrent: (name: string) => Promise<any>;
        getAimDetails: (name: string) => Promise<any>;
        getAimReleases: (name: string) => Promise<any>;
        getAimReleaseDetail: (name: string, tag: string) => Promise<any>;
        saveGeneratedImage: (base64Data: string) => Promise<{ success: boolean; url?: string; error?: string }>;
        // AIM Nodes data
        saveNodeData: (license: string, data: any) => Promise<{ success: boolean; error?: string }>;
        deleteNodeData: (license: string) => Promise<{ success: boolean; error?: string }>;
        getSavedAims: (license?: string) => Promise<any>;
        handlePayment: (paymentData: any) => Promise<{ success: boolean; error?: string; result?: any }>;
        // Stage 7B: Node profile
        getNodeProfile: (license: number | string) => Promise<any>;
        // Stage 7C: Tool score cache
        getToolScore: (endpointUrl: string) => Promise<any>;
        getAllToolScores: () => Promise<any>;
        getToolScoresLastUpdated: () => Promise<any>;
        // Stage 8A: AIM profile / nodes
        getAimProfile:  (name: string) => Promise<any>;
        getAimNodes:    (name: string, opts?: { version?: string; userLat?: number; userLng?: number }) => Promise<any>;
        getAimBestNode: (name: string, opts?: { version?: string; userLat?: number; userLng?: number }) => Promise<any>;
        // Stage 8B / Stage 7 probe data
        getAimDeployments: (aimId: number) => Promise<any[]>;
        getToolStatus: (toolId: string) => Promise<any>;
        subscribe: (payload: { endpointUrl: string; aimId?: number; nodeLicense?: number }) => Promise<any>;
        getSubscriptions: () => Promise<any[]>;
        unsubscribe: (subscriptionId: string) => Promise<any>;
        getVerificationHistory: (subscriptionId: string) => Promise<any[]>;
        clearCache: () => Promise<void>;
      };

      // AIM Nodes (separate namespace for new hooks/components)
      aimNodes: {
        saveNodeData: (license: string, data: any) => Promise<{ success: boolean; error?: string }>;
        deleteNodeData: (license: string) => Promise<{ success: boolean; error?: string }>;
        getSavedAims: (license?: string) => Promise<any>;
        /** Handle a __payment_required signal from MCP. Shows approval modal, executes JIT payment if approved, retries tool call. */
        handlePayment: (paymentData: any) => Promise<{ success: boolean; result?: any; error?: string }>;
      };

      // Media — safe data: URI delivery for tool-generated media
      media: {
        /** Read a mosaic-media:// file from disk and return it as a base64 data: URI */
        readAsDataUri: (mediaUrl: string) => Promise<{ success: boolean; dataUri?: string; error?: string }>;
        /** Get the auto-display-media setting */
        getAutoDisplay: () => Promise<{ enabled: boolean }>;
        /** Set the auto-display-media setting */
        setAutoDisplay: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean; error?: string }>;
      };

      // Addon management (renderer-side management bridge — §6.2)
      addons: {
        list: () => Promise<Array<{
          id: string;
          name: string;
          description?: string;
          version: string;
          activated: boolean;
          lastError?: string;
          source: { type: "registry"; tarballUrl: string; sha256: string; registrySignatureVerified: boolean; verifiedKeyId: string } | { type: "dev"; path: string };
          permissions: string[];
          linkVisibilityToActivation: boolean;
          updateCheckMode: "manual" | "automatic";
          updateAvailable?: string;
        }>>;
        listTabs: () => Promise<Array<{
          tabId: string;
          addonId: string;
          label: string;
          icon: string;
          order: number;
          activated: boolean;
          visible: boolean;
          rendererEntry: string;
          deepLinkParam?: string;
        }>>;
        activate: (id: string) => Promise<{ success: boolean; error?: string }>;
        deactivate: (id: string) => Promise<{ success: boolean; error?: string }>;
        setEnabled: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        installDev: (devPath: string) => Promise<{ success: boolean; id?: string; error?: string }>;
        getPreloadPath: () => Promise<string>;
        fetchCatalogue: (opts?: { registryUrl?: string; sigUrl?: string }) => Promise<{
          success: boolean;
          addons?: Array<{
            id: string;
            name: string;
            description: string;
            version: string;
            minAppVersion?: string;
            tarballUrl: string;
            sha256: string;
            permissions: string[];
            icon?: string;
            homepage?: string;
          }>;
          error?: string;
        }>;
        install: (id: string) => Promise<{ success: boolean; needsConsent?: string[]; error?: string }>;
        installConfirm: (id: string, acceptedPermissions: string[]) => Promise<{ success: boolean; error?: string }>;
        uninstall: (id: string, opts: { keepSettings: boolean; keepData: boolean }) => Promise<{ success: boolean; error?: string }>;
        getDataSize: (id: string) => Promise<number>;
        upgrade: (id: string, acceptedPermissions?: string[]) => Promise<{ success: boolean; needsConsent?: string[]; error?: string }>;
        setVisibilityLink: (id: string, linked: boolean) => Promise<{ success: boolean; error?: string }>;
        setUpdateCheckMode: (id: string, mode: "manual" | "automatic") => Promise<{ success: boolean; error?: string }>;
        onChanged: (callback: (tabs: unknown[]) => void) => () => void;
        onTitleChanged: (callback: (data: { addonId: string; title: string }) => void) => () => void;
      };

      // Sidebar tab visibility preferences (keyed by tab id; absent = visible)
      tabPrefs: {
        get: () => Promise<Record<string, boolean>>;
        setVisibility: (tabId: string, visible: boolean) => Promise<{
          success: boolean;
          error?: string;
          tabVisibility?: Record<string, boolean>;
        }>;
        onChanged: (callback: (visibility: Record<string, boolean>) => void) => () => void;
      };

      // JIT Payments plugin
      paymentsJit: {
        onRequestApproval: (handler: (data: any) => void) => () => void;
        approveResult: (requestId: string, approved: boolean) => Promise<{ success: boolean }>;
      };

      // MCP API
      mcpAPI: {
          listServers: () => Promise<any[]>;
          callTool: (server: string, tool: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
          connect: (config: any) => Promise<{ success: boolean; error?: string }>;
          disconnect: (server: string) => Promise<{ success: boolean }>;
          readResource: (server: string, uri: string) => Promise<{ success: boolean; result?: any; error?: string }>;
      };

      // Tool Sandbox (WASM tools)
      toolSandbox: {
        inspectManifest: (wasmPath: string) => Promise<{ success: boolean; data?: { manifest: ToolManifest; fileHash: string }; error?: string }>;
        install: (wasmPath: string, approval: { approved: boolean }) => Promise<{ success: boolean; data?: { manifest: ToolManifest; installedAt: string; enabled: boolean; pinned?: boolean; entryPath: string; sourcePath?: string; fileHash?: string }; error?: string }>;
        update: (wasmPath: string, approval: { approved: boolean }) => Promise<{ success: boolean; data?: { manifest: ToolManifest; installedAt: string; enabled: boolean; pinned?: boolean; entryPath: string; sourcePath?: string; fileHash?: string }; error?: string }>;
        uninstall: (toolId: string) => Promise<{ success: boolean; error?: string }>;
        launch: (toolId: string) => Promise<{ success: boolean; error?: string }>;
        stop: (toolId: string) => Promise<{ success: boolean; error?: string }>;
        listInstalled: () => Promise<{ success: boolean; data?: InstalledTool[] }>;
        listRunning: () => Promise<{ success: boolean; data?: RunningToolInfo[] }>;
        setPinned: (toolId: string, pinned: boolean) => Promise<{ success: boolean; error?: string }>;
        setInput: (toolId: string, key: string, value: string) => Promise<{ success: boolean; error?: string }>;
        deleteInput: (toolId: string, key: string) => Promise<{ success: boolean; error?: string }>;
        getInputStatus: (toolId: string) => Promise<{ success: boolean; data?: Record<string, boolean>; error?: string }>;
        isAvailable: () => Promise<{ success: boolean; data?: boolean }>;
        renderPanel: (toolId: string, panelId: string, context?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; ui?: Array<{ type: string; [key: string]: unknown }>; error?: string }>;
        callFunction: (toolId: string, functionName: string, args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; ui?: Array<{ type: string; [key: string]: unknown }>; error?: string }>;
      };

      // Chronicle (tool activity log)
      chronicle: {
        read: (toolId: string, query?: ChronicleQuery) => Promise<{ success: boolean; data?: ChronicleEntry[]; error?: string }>;
        hasEntries: (toolId: string) => Promise<{ success: boolean; data?: boolean }>;
      };

      // File dialog
      dialog: {
        openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
        openDirectory: () => Promise<string | null>;
      };
    };

    chatAPI: {
      getSettings: () => Promise<ChatSettings>;
      saveSettings: (s: ChatSettings) => Promise<{ success: boolean; error?: string }>;
      connect: () => Promise<{ success: boolean; error?: string }>;
      disconnect: () => Promise<{ success: boolean }>;
      status: () => Promise<{ status: string; memberId?: string }>;
      listRooms: () => Promise<{ success: boolean; error?: string }>;
      createRoom: (name: string, visibility?: string) => Promise<{ success: boolean; error?: string }>;
      joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
      leaveRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
      deleteRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
      sendMessage: (roomId: string, text: string) => Promise<{ success: boolean; error?: string }>;
      assignAgent: (roomId: string, agentId: string, agentName: string) => Promise<{ success: boolean }>;
      removeAgent: (roomId: string, agentId: string) => Promise<{ success: boolean }>;
      listAssignedAgents: (roomId: string) => Promise<string[]>;
      onConnectionChanged: (cb: (data: { status: string; memberId?: string }) => void) => () => void;
      onRoomsUpdated: (cb: (rooms: Room[]) => void) => () => void;
      onRoomCreated: (cb: (room: Room) => void) => () => void;
      onJoined: (cb: (data: { room: Room; history: StoredMessage[] }) => void) => () => void;
      onLeft: (cb: (data: { roomId: string }) => void) => () => void;
      onRoomDeleted: (cb: (data: { roomId: string }) => void) => () => void;
      onMessage: (cb: (message: StoredMessage) => void) => () => void;
      onMemberJoined: (cb: (data: { roomId: string; member: Member }) => void) => () => void;
      onMemberLeft: (cb: (data: { roomId: string; memberId: string; username: string }) => void) => () => void;
      onError: (cb: (data: { message: string }) => void) => () => void;
    };

    // MosaicBot agent API
    agent?: {
      send: (text: string) => Promise<{ type: string; skill?: string; args?: string; text?: string }>;
      triggerHeartbeat: (agentId?: string) => Promise<{ ok: boolean }>;
      listSkills: () => Promise<Array<{ name: string; description: string }>>;
      onMessage: (cb: (msg: { to: string; text: string; channel: string; messageId: string }) => void) => void;
    };

    // MosaicBot memory API
    memory?: {
      search: (query: string, opts?: { maxResults?: number; minScore?: number }) => Promise<Array<{
        path: string;
        startLine: number;
        endLine: number;
        score: number;
        snippet: string;
        source: string;
      }>>;
      read: (relPath: string, from?: number, lines?: number) => Promise<{ text: string; path: string }>;
      sync: () => Promise<{
        backend: string; provider: string; model: string;
        files: number; chunks: number; dirty: boolean;
        workspaceDir: string; dbPath: string;
        vector: { enabled: boolean; available: boolean };
      }>;
      status: () => Promise<{
        backend: string; provider: string; model: string;
        files: number; chunks: number; dirty: boolean;
        workspaceDir: string; dbPath: string;
        vector: { enabled: boolean; available: boolean };
      }>;
    };
  }
}

export {};
