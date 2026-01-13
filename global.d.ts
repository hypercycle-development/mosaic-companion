import { AIAgentConfig } from "./types/ai";

declare global {
  // Update settings configuration
  interface UpdateSettings {
    autoDownload: boolean;
  }

  interface Window {
    electronAPI: {
      // Existing methods
      logInput: (text: string) => Promise<{ success: boolean; path: string }>;
      getCsvPath: () => Promise<string>;

      // Update methods
      checkForUpdates: () => Promise<{ triggered: boolean; reason?: string }>;
      getUpdateSettings: () => Promise<UpdateSettings>;
      setUpdateSettings: (
        settings: Partial<UpdateSettings>
      ) => Promise<UpdateSettings>;

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
