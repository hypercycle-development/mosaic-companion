// Electron API types - optional in browser mode

interface NetworkFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface NetworkFetchResponse {
  success: boolean;
  status?: number;
  headers?: Record<string, string>;
  data?: string;
  error?: string;
}

interface GraphqlResponse {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  raw?: string;
}

interface ShellExecuteOptions {
  cwd?: string;
  timeout?: number;
}

interface ShellExecuteResponse {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// Midnight API types
interface MidnightApi {
  init: () => Promise<{ success: boolean; error?: string }>;
  createNode: (config: {
    type: "validator" | "full" | "light";
    stake: number;
    privacy: "public" | "shielded" | "private";
    delegation: "user" | "agent" | "hybrid";
    agentId?: string;
  }) => Promise<{
    success: boolean;
    node?: {
      nodeId: string;
      endpoint: string;
      privacyKey: string;
      status: "deploying" | "active" | "stopped" | "error";
      createdAt: number;
    };
    error?: string;
  }>;
  delegate: (nodeId: string, agentId: string) => Promise<{
    success: boolean;
    delegation?: {
      delegationId: string;
      nodeId: string;
      agentId: string;
      permissions: string[];
      createdAt: number;
    };
    error?: string;
  }>;
  getStatus: (nodeId: string) => Promise<{
    success: boolean;
    status?: {
      nodeId: string;
      endpoint: string;
      privacyKey: string;
      status: "deploying" | "active" | "stopped" | "error";
      createdAt: number;
    };
    error?: string;
  }>;
  stopNode: (nodeId: string) => Promise<{ success: boolean; error?: string }>;
  restartNode: (nodeId: string) => Promise<{ success: boolean; error?: string }>;
  getNetworkInfo: () => Promise<{
    success: boolean;
    info?: {
      blockHeight: number;
      blockTime: number;
      sessionLength: number;
      validators: number;
      totalNodes: number;
    };
    error?: string;
  }>;
  listNodes: () => Promise<{
    success: boolean;
    nodes: Array<{
      nodeId: string;
      endpoint: string;
      privacyKey: string;
      status: "deploying" | "active" | "stopped" | "error";
      createdAt: number;
    }>;
  }>;
  getConfig: () => Promise<{
    success: boolean;
    config?: {
      network: string;
      provider: string;
      rpcEndpoint?: string;
    };
  }>;
  saveConfig: (config: {
    network?: "testnet" | "mainnet";
    provider?: "cardano-partnerchain";
    rpcEndpoint?: string;
  }) => Promise<{ success: boolean }>;
}

interface ElectronAPI {
  logInput: (text: string) => Promise<void>;
  getCsvPath: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  getUpdateSettings: () => Promise<{ autoDownload?: boolean; titleBarStyle?: string }>;
  setUpdateSettings: (settings: { autoDownload?: boolean; titleBarStyle?: string }) => Promise<void>;
  getUpdateLogs: () => Promise<string[]>;
  getUpdateLogPath: () => Promise<string>;
  restartWindow: () => Promise<void>;
  showTitleBarConfirm: () => Promise<boolean>;
  nodes: {
    get: () => Promise<Array<{ id: string; name: string; apiHost: string; apiPort: string; isActive: boolean }>>;
    add: (node: Partial<{ id: string; name: string; apiHost: string; apiPort: string; isActive: boolean }>) => Promise<void>;
    update: (id: string, updates: Partial<{ id: string; name: string; apiHost: string; apiPort: string; isActive: boolean }>) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  aiAgents: {
    get: () => Promise<Array<{ id: string; name: string; provider: string; model: string; isActive: boolean }>>;
    set: (agents: Array<{ id: string; name: string; provider: string; model: string; isActive: boolean }>) => Promise<void>;
    add: (agent: Omit<{ id: string; name: string; provider: string; model: string; isActive: boolean }, 'id'>) => Promise<void>;
    update: (id: string, updates: Partial<{ id: string; name: string; provider: string; model: string; isActive: boolean }>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  themes: {
    get: () => Promise<string>;
    set: (theme: string) => Promise<void>;
  };
  aiAgentsHistory: {
    getAll: (agentId: string) => Promise<Array<{ id: string; agentId: string }>>;
    get: (agentId: string, sessionId: string) => Promise<{ id: string; agentId: string }>;
    save: (session: { id: string; agentId: string }) => Promise<void>;
    delete: (agentId: string, sessionId: string) => Promise<void>;
    deleteAll: (agentId: string) => Promise<void>;
  };
  mcpAPI: unknown;
  gmailAPI: unknown;
  sandbox: {
    getState: () => Promise<{ isSandbox: boolean }>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  network: {
    fetch: (url: string, options?: NetworkFetchOptions) => Promise<NetworkFetchResponse>;
    graphql: (url: string, query: string, variables?: Record<string, any>) => Promise<GraphqlResponse>;
  };
  shell: {
    execute: (command: string, options?: ShellExecuteOptions) => Promise<ShellExecuteResponse>;
  };
  midnight: MidnightApi;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};