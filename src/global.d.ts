/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_ETHEREUM?: string;
  readonly VITE_RPC_BASE?: string;
  readonly VITE_ANFE_CONTRACT_ETHEREUM?: string;
  readonly VITE_ANFE_CONTRACT_BASE?: string;
  readonly VITE_GRAPH_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Use more permissive types with index signature
type ElectronAPIAny = {
  [key: string]: any;
};

interface Window {
  electronAPI: ElectronAPIAny & {
    logInput: (text: string) => Promise<{ success: boolean; path: string }>;
    getCsvPath: () => Promise<string>;
    checkForUpdates: () => Promise<{ triggered: boolean; reason?: string }>;
    dialog: ElectronAPIAny & {
      showOpen: (options: any) => Promise<any>;
      showSave: (options: any) => Promise<any>;
      openFile?: (options: any) => Promise<any>;
    };
    fs: {
      readFile: (path: string, options?: any) => Promise<any>;
      writeFile: (path: string, data: string, options?: any) => Promise<any>;
      exists: (path: string) => Promise<boolean>;
      mkdir: (path: string, options?: any) => Promise<any>;
      readdir: (path: string) => Promise<string[]>;
      unlink: (path: string) => Promise<any>;
      rmdir: (path: string) => Promise<any>;
    };
    shell: {
      openExternal: (url: string) => Promise<void>;
      openPath: (path: string) => Promise<string>;
    };
    clipboard: {
      readText: () => Promise<string>;
      writeText: (text: string) => Promise<void>;
    };
    store: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      delete: (key: string) => Promise<void>;
    };
    app: {
      getPath: (name: string) => Promise<string>;
      getVersion: () => Promise<string>;
    };
    window: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
    };
    web3?: ElectronAPIAny & {
      getConfig: () => Promise<any>;
      updateConfig: (config: any) => Promise<void>;
      lookupToken: (address: string) => Promise<any>;
      sendTransaction: (tx: any) => Promise<any>;
      signMessage: (message: string, address: string) => Promise<any>;
      getBalance: (address: string, network: string) => Promise<string>;
      getNetwork: () => Promise<string>;
      switchNetwork: (chainId: string) => Promise<void>;
      [key: string]: any;
    };
    cardano?: ElectronAPIAny & {
      // Legacy methods (kept for backward compatibility)
      detect: () => Promise<boolean>;
      connect: () => Promise<{ success: boolean; address?: string; error?: string }>;
      getBalance: () => Promise<string>;
      getUtxos: () => Promise<any[]>;
      signData: (data: string) => Promise<{ success: boolean; signature?: string; error?: string }>;
      networkId: () => Promise<number>;
      getAddress: () => Promise<string>;
      // ─── Tokeo QR Bridge ───
      tokeoDetect: () => Promise<{ available: boolean; name?: string; message?: string }>;
      tokeoConnect: () => Promise<{ success: boolean; address?: string; error?: string }>;
      tokeoQRPairing: (policyIds?: string[]) => Promise<{ success: boolean; data?: { sessionId: string; uri: string; callbackUrl: string; port: number }; error?: string }>;
      tokeoCheckQR: (sessionId?: string) => Promise<{ success: boolean; data?: { connected: boolean; address?: string; sessionId?: string; status?: string }; error?: string }>;
      tokeoVerifyCollection: (policyIds: string[], strict?: boolean) => Promise<{ success: boolean; data?: { hasAccess: boolean; hasAll: boolean; matchedPolicies: string[]; assets: any[] }; error?: string }>;
      tokeoCancelQR: (sessionId?: string) => Promise<{ success: boolean; error?: string }>;
      tokeoStatus: () => Promise<{ success: boolean; data?: { connected: boolean; address?: string; networkId?: number } }>;
      tokeoDisconnect: () => Promise<{ success: boolean }>;
      // ─── CIP-30 Browser Wallet Bridge (Lace, Eternl, Nami, etc.) ───
      detectWallets: () => Promise<{ success: boolean; data?: { available: boolean; wallets: Array<{ name: string; key: string; version: string }> }; error?: string }>;
      connectWallet: (walletKey: string) => Promise<{ success: boolean; data?: { connected: boolean; walletName: string; address: string; rewardAddress?: string; networkId?: number; assets?: Array<{ policyId: string; assetName: string; fingerprint: string; quantity: number }> }; error?: string }>;
      getWalletAssets: () => Promise<{ success: boolean; data?: { address: string; assets: Array<{ policyId: string; assetName: string; fingerprint: string; quantity: number }> }; error?: string }>;
      signTx: (walletKey: string, txHex: string, partialSign?: boolean) => Promise<{ success: boolean; data?: { signedTx: string }; error?: string }>;
      getBridgeStatus: () => Promise<{ success: boolean; data?: { connected: boolean; state: any } }>;
      disconnectWallet: () => Promise<{ success: boolean }>;
    };
    tokeo?: {
      detect: () => Promise<boolean>;
      connect: () => Promise<{ success: boolean; address?: string; error?: string }>;
      getBalance: () => Promise<string>;
      getUtxos: () => Promise<any[]>;
      verifyNft: (policyId: string) => Promise<{ success: boolean; hasNft?: boolean; error?: string }>;
      verifyCollection: (policyIds: string[]) => Promise<{ success: boolean; hasAll: boolean; matched: string[] }>;
      signData: (data: string) => Promise<{ success: boolean; signature?: string; error?: string }>;
      networkId: () => Promise<number>;
      getAddress: () => Promise<string>;
    };
    nodes?: {
      get: () => Promise<any[]>;
      add: (node: any) => Promise<any>;
      remove: (id: string) => Promise<void>;
      update: (id: string, updates: any) => Promise<any>;
    };
    tools?: ElectronAPIAny & {
      list: () => Promise<any[]>;
      install: (manifest: any) => Promise<{ success: boolean; error?: string }>;
      uninstall: (id: string) => Promise<{ success: boolean; error?: string }>;
      execute?: (toolId: string, args: any) => Promise<any>;
    };
    nodes?: {
      get: () => Promise<any[]>;
      add: (node: any) => Promise<any>;
      remove: (id: string) => Promise<void>;
      update: (id: string, updates: any) => Promise<any>;
      onChanged: (callback: (nodes: any[]) => void) => void;
      delete: (id: string) => Promise<void>;
      [key: string]: any;
    };
    aiAgents?: ElectronAPIAny & {
      list: () => Promise<any[]>;
      history: (sessionId: string) => Promise<any[]>;
      [key: string]: any;
    };
    vault?: ElectronAPIAny & {
      getSecrets: () => Promise<any[]>;
      setSecret: (key: string, value: string) => Promise<void>;
      deleteSecret: (key: string) => Promise<void>;
      [key: string]: any;
    };
    trading?: ElectronAPIAny & {
      getMarkets: () => Promise<any[]>;
      placeOrder: (order: any) => Promise<any>;
      [key: string]: any;
    };
    tokeo?: ElectronAPIAny & {
      detect: () => Promise<boolean>;
      connect: () => Promise<{ success: boolean; address?: string; error?: string }>;
      getBalance: () => Promise<string>;
      getUtxos: () => Promise<any[]>;
      signData: (data: string) => Promise<{ success: boolean; signature?: string; error?: string }>;
      networkId: () => Promise<number>;
      getAddress: () => Promise<string>;
      tokeoDetect?: () => Promise<boolean>;
      tokeoConnect?: (wallet?: string) => Promise<{ success: boolean; address?: string; error?: string }>;
      tokeoDisconnect?: () => Promise<{ success: boolean; error?: string }>;
      tokeoStatus?: () => Promise<{ connected: boolean; address?: string; networkId?: number }>;
      tokeoVerifyCollection?: (policyIds: string[]) => Promise<{ success: boolean; hasAll: boolean; matched: string[] }>;
      tokeoQRPairing?: () => Promise<{ success: boolean; pairingUri?: string; error?: string }>;
      tokeoCheckQR?: (pairingUri: string) => Promise<{ success: boolean; sessionToken?: string; error?: string }>;
      tokeoCancelQR?: () => Promise<{ success: boolean; error?: string }>;
      [key: string]: any;
    };
    mcpAPI?: ElectronAPIAny & {
      listServers: () => Promise<any[]>;
      [key: string]: any;
    };
    themes?: ElectronAPIAny & {
      list: () => Promise<any[]>;
      apply: (theme: string) => Promise<void>;
      [key: string]: any;
    };
    sandbox?: ElectronAPIAny & {
      [key: string]: any;
    };
    toolSandbox?: ElectronAPIAny & {
      inspectManifest: (wasmPath: string) => Promise<any>;
      install: (wasmPath: string, approval: any) => Promise<any>;
      update: (wasmPath: string, approval: any) => Promise<any>;
      uninstall: (toolId: string) => Promise<any>;
      launch: (toolId: string) => Promise<any>;
      stop: (toolId: string) => Promise<any>;
      listInstalled: () => Promise<any[]>;
      listRunning: () => Promise<any[]>;
      setPinned: (toolId: string, pinned: boolean) => Promise<any>;
      setInput: (toolId: string, key: string, value: any) => Promise<any>;
      deleteInput: (toolId: string, key: string) => Promise<any>;
      getInputStatus: (toolId: string) => Promise<any>;
      isAvailable: () => Promise<boolean>;
      renderPanel: (toolId: string, panelId: string, context: any) => Promise<any>;
      callFunction: (toolId: string, functionName: string, args: any[]) => Promise<any>;
      openFile?: (options: any) => Promise<any>;
      [key: string]: any;
    };
    skills?: ElectronAPIAny & {
      buildSystemPrompt: (payload: {
        baseSystemPrompt?: string;
        skillNames: string[];
        includeReferences?: boolean;
        maxTokens?: number;
      }) => Promise<{
        systemPrompt: string;
        loadedSkills: string[];
        failedSkills: string[];
        totalTokens: number;
      }>;
      syncToNode: (payload: {
        skillNames: string[];
        nodeId: string;
        nodeHost?: string;
      }) => Promise<{
        success: boolean;
        synced: string[];
        failed: string[];
        verified: string[];
        activated: string[];
        remoteSkillDir: string;
        logs: string[];
      }>;
    };
  };
}