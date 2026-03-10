import { AIAgentConfig, ChatSession } from "./types/ai";
import type { ChatSettings, ConnectionStatus, Room, StoredMessage, Member } from "./types/chat";

declare global {
  // Vault types
  type BoxSourceType = "manual" | "import" | "connector";

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
      };

      // Tools registry bridge
      tools: {
          execute: (fullName: string, args: Record<string, unknown>, context?: { agentId?: string }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
          listModules: () => Promise<Array<{ name: string; displayName: string; toolCount: number; tools: Array<{ name: string; description: string }> }>>;
          getSystemPrompt: () => Promise<string>;
          getActionPatterns: () => Promise<Array<{ moduleName: string; toolName: string; pattern: string; flags: string }>>;
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

      // MCP API
      mcpAPI: {
          listServers: () => Promise<any[]>;
          callTool: (server: string, tool: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
          connect: (config: any) => Promise<{ success: boolean; error?: string }>;
          disconnect: (server: string) => Promise<{ success: boolean }>;
          readResource: (server: string, uri: string) => Promise<{ success: boolean; result?: any; error?: string }>;
      };
    };

    chatAPI: {
      getSettings: () => Promise<ChatSettings>;
      saveSettings: (s: ChatSettings) => Promise<{ success: boolean; error?: string }>;
      connect: () => Promise<{ success: boolean; error?: string }>;
      disconnect: () => Promise<{ success: boolean }>;
      status: () => Promise<{ status: string }>;
      listRooms: () => Promise<{ success: boolean; error?: string }>;
      createRoom: (name: string) => Promise<{ success: boolean; error?: string }>;
      joinRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
      leaveRoom: (roomId: string) => Promise<{ success: boolean; error?: string }>;
      sendMessage: (roomId: string, text: string) => Promise<{ success: boolean; error?: string }>;
      assignAgent: (roomId: string, agentId: string, agentName: string) => Promise<{ success: boolean; error?: string }>;
      removeAgent: (roomId: string, agentId: string) => Promise<{ success: boolean }>;
      listAssignedAgents: (roomId: string) => Promise<string[]>;
      onConnectionChanged: (cb: (data: { status: string }) => void) => () => void;
      onRoomsUpdated: (cb: (rooms: Room[]) => void) => () => void;
      onRoomCreated: (cb: (room: Room) => void) => () => void;
      onJoined: (cb: (data: { room: Room; history: StoredMessage[] }) => void) => () => void;
      onLeft: (cb: (data: { roomId: string }) => void) => () => void;
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
