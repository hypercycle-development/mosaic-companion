
import React from 'react';

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
  LIGHT = 'light',
  DARK = 'dark'
}

export interface Tab {
  id: string;
  title: string;
  history: HistoryState;
  isLoading?: boolean;
  favicon?: string;
}

export const INTERNAL_HOME_URL = 'browser://home';
export const INTERNAL_SETTINGS_URL = 'browser://settings';

export interface AppSettings {
  homeUrl: string;
  customGreeting: string;
  showUrlBar: boolean;
}

// Add definition for Electron webview tag
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'webview': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 
        src?: string;
        allowpopups?: boolean | string;
        // Removed webpreferences as we are using defaults
      }, HTMLElement>;
    }
  }

  // Update settings configuration
  interface UpdateSettings {
    autoDownload: boolean;
  }

  interface ElectronAPI {
    logInput: (text: string) => Promise<{ success: boolean; path: string }>;
    getCsvPath: () => Promise<string>;
    checkForUpdates: () => Promise<{ triggered: boolean; reason?: string }>;
    getUpdateSettings: () => Promise<UpdateSettings>;
    setUpdateSettings: (settings: Partial<UpdateSettings>) => Promise<UpdateSettings>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
