import React from "react";

export interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  url: string;
}

export enum BrowserTheme {
  LIGHT = "light",
  DARK = "dark",
}

export interface Tab {
  id: string;
  title: string;
  history: HistoryState;
  isLoading?: boolean;
  loadProgress?: number; // 0-100
  favicon?: string;
}

export const INTERNAL_HOME_URL = "browser://home";
export const INTERNAL_SETTINGS_URL = "browser://settings";
export const INTERNAL_CHAT_URL = "browser://internal_chat";
export const INTERNAL_MOSAICBOT_URL = "browser://mosaicbot";
export const INTERNAL_MCP_URL = "browser://mcp";
export const INTERNAL_MULTI_CHAT_URL = "browser://multi-chat";
export const INTERNAL_WEB3_URL = "browser://web3";
export const INTERNAL_VAULT_URL = "browser://vault";
export const INTERNAL_HYPERINSIGHT_URL = "browser://hyperinsight";
export const INTERNAL_SANDBOX_URL = "browser://sandbox";
export const INTERNAL_ONBOARDING_URL = "browser://onboarding";
export const INTERNAL_IDE_URL = "browser://ide";
export const INTERNAL_SKILL_VAULT_URL = "browser://skill-vault";
/** Dynamic tool panel URL prefix: browser://tool-panel/{toolId} */
export const INTERNAL_TOOL_PANEL_PREFIX = "browser://tool-panel/";

// Stargate URLs
export const INTERNAL_ADAPORTAL_URL = "browser://adaportal";
export const INTERNAL_ADAPORTAL_START_URL = "browser://adaportal/start";
export const INTERNAL_ADAPORTAL_SKILLS_URL = "browser://adaportal/skills";
export const INTERNAL_ADAPORTAL_TRAIN_URL = "browser://adaportal/train";
export const INTERNAL_ADAPORTAL_COMPUTE_URL = "browser://adaportal/compute";
export const INTERNAL_ADAPORTAL_BUNDLES_URL = "browser://adaportal/bundles";
export const INTERNAL_ADAPORTAL_RANKINGS_URL = "browser://adaportal/rankings";
export const INTERNAL_ADAPORTAL_STARGATE_URL = "browser://adaportal/stargate";

// Multi-Agent URL
export const INTERNAL_MULTIAGENT_URL = "browser://multi-agent";

// Mosaic Team URL
export const INTERNAL_MOSAIC_TEAM_URL = "browser://mosaic-team";

export interface AppSettings {
  homeUrl: string;
  customGreeting: string;
  showUrlBar: boolean;
}

// Add definition for Electron webview tag
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          allowpopups?: boolean | string;
          // Removed webpreferences as we are using defaults
        },
        HTMLElement
      >;
    }
  }
}
