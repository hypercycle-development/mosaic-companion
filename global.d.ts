import { AIAgentConfig } from "./types/ai";

declare global {
  // Update settings configuration
  interface UpdateSettings {
    autoDownload: boolean;
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
      checkForUpdates: () => Promise<{ triggered: boolean; reason?: string }>;
      getUpdateSettings: () => Promise<UpdateSettings>;
      setUpdateSettings: (settings: Partial<UpdateSettings>) => Promise<{
        success: boolean;
        settings: UpdateSettings;
        error?: string;
      }>;
      getUpdateLogs: () => Promise<string>;
      getUpdateLogPath: () => Promise<string>;

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
          updates: Partial<HypercycleNode>
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

      // AI Agents methods
      aiAgents: {
        get: () => Promise<AIAgentConfig[]>;
        set: (
          agents: AIAgentConfig[]
        ) => Promise<{ success: boolean; error?: string }>;
        add: (
          agent: AIAgentConfig
        ) => Promise<{ success: boolean; error?: string }>;
        update: (
          id: string,
          updates: Partial<AIAgentConfig>
        ) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        clear: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}

export {};
