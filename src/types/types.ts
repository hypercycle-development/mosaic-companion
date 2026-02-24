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
    loadProgress?: number; // 0-100
    favicon?: string;
}

export const INTERNAL_HOME_URL = 'browser://home';
export const INTERNAL_SETTINGS_URL = 'browser://settings';
export const INTERNAL_CHAT_URL = 'browser://internal_chat';
export const INTERNAL_MOSAICBOT_URL = 'browser://mosaicbot';
export const INTERNAL_MCP_URL = 'browser://mcp';
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
