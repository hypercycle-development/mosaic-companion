import { AIAgentConfig, ChatSession } from "./types/ai";

declare global {
    // Update settings configuration
    interface UpdateSettings {
        autoDownload: boolean;
        titleBarStyle?: "hidden" | "default";
        nodes: HypercycleNode[];
        screenpipe?: {
            enabled: boolean;
            url: string;
            command?: string;
            args?: string[];
            healthPath?: string;
        };
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
            screenpipe: {
                getSettings: () => Promise<{
                    enabled: boolean;
                    url: string;
                    command?: string;
                    args?: string[];
                    healthPath?: string;
                }>;
                setSettings: (
                    partial: Partial<{
                        enabled: boolean;
                        url: string;
                        command?: string;
                        args?: string[];
                        healthPath?: string;
                    }>,
                ) => Promise<{
                    success: boolean;
                    screenpipe?: {
                        enabled: boolean;
                        url: string;
                        command?: string;
                        args?: string[];
                        healthPath?: string;
                    };
                    error?: string;
                }>;
                install: () => Promise<{
                    success: boolean;
                    installed: boolean;
                    stdout?: string;
                    stderr?: string;
                }>;
                checkInstalled: () => Promise<{ installed: boolean }>;
                start: () => Promise<{
                    success: boolean;
                    running: boolean;
                    healthy?: boolean;
                    alreadyRunning?: boolean;
                    error?: string;
                }>;
                stop: () => Promise<{ success: boolean; running: boolean }>;
                isRunning: () => Promise<{ running: boolean }>;
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
        };
    }
}

export { };
