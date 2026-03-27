// Web mode: Provide electronAPI stub BEFORE React loads
// This must be set up synchronously before any component tries to use it
if (typeof window !== 'undefined' && !window.electronAPI) {
  console.log('[Web] Initializing electronAPI stub...');
  (window as any).electronAPI = {
    logInput: async (text: string) => console.log('[Web]', text),
    getCsvPath: async () => '',
    checkForUpdates: async () => console.log('[Web] Updates not available'),
    getUpdateSettings: async () => ({ autoDownload: false, titleBarStyle: 'hidden' }),
    setUpdateSettings: async () => {},
    getUpdateLogs: async () => [],
    getUpdateLogPath: async () => '',
    restartWindow: async () => window.location.reload(),
    showTitleBarConfirm: async () => false,
    nodes: {
      get: async () => {
        try {
          const stored = localStorage.getItem('mosaic_nodes');
          console.log('[Web] Loading nodes:', stored);
          return stored ? JSON.parse(stored) : [];
        } catch (e) {
          console.error('[Web] Error loading nodes:', e);
          return [];
        }
      },
      add: async (node: any) => {
        try {
          const stored = localStorage.getItem('mosaic_nodes');
          const nodes = stored ? JSON.parse(stored) : [];
          const newNode = { ...node, id: node.id || 'node_' + Date.now() };
          nodes.push(newNode);
          localStorage.setItem('mosaic_nodes', JSON.stringify(nodes));
          console.log('[Web] Node saved:', newNode);
          return { success: true, nodes };
        } catch (e: any) {
          console.error('[Web] Error saving node:', e);
          return { success: false, error: e.message, nodes: [] };
        }
      },
      update: async (id: string, updates: any) => {
        try {
          const stored = localStorage.getItem('mosaic_nodes');
          const nodes = stored ? JSON.parse(stored) : [];
          const index = nodes.findIndex((n: any) => n.id === id);
          if (index >= 0) {
            nodes[index] = { ...nodes[index], ...updates };
            localStorage.setItem('mosaic_nodes', JSON.stringify(nodes));
            console.log('[Web] Node updated:', nodes[index]);
            return { success: true, nodes };
          }
          return { success: false, error: 'Not found', nodes };
        } catch (e: any) {
          console.error('[Web] Error updating node:', e);
          return { success: false, error: e.message, nodes: [] };
        }
      },
      delete: async (id: string) => {
        try {
          const stored = localStorage.getItem('mosaic_nodes');
          const nodes = stored ? JSON.parse(stored) : [];
          const filtered = nodes.filter((n: any) => n.id !== id);
          localStorage.setItem('mosaic_nodes', JSON.stringify(filtered));
          console.log('[Web] Node deleted:', id);
          return { success: true, nodes: filtered };
        } catch (e: any) {
          console.error('[Web] Error deleting node:', e);
          return { success: false, error: e.message, nodes: [] };
        }
      },
    },
    aiAgents: {
      get: async () => {
        try {
          const stored = localStorage.getItem('mosaic_ai_agents');
          console.log('[Web] Loading agents:', stored);
          return stored ? JSON.parse(stored) : [];
        } catch (e) {
          console.error('[Web] Error loading agents:', e);
          return [];
        }
      },
      set: async (agents: any[]) => {
        try {
          localStorage.setItem('mosaic_ai_agents', JSON.stringify(agents));
          return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
      },
      add: async (agent: any) => {
        try {
          const stored = localStorage.getItem('mosaic_ai_agents');
          const agents = stored ? JSON.parse(stored) : [];
          const newAgent = agent.id ? agent : { ...agent, id: 'agent_' + Date.now() };
          agents.push(newAgent);
          localStorage.setItem('mosaic_ai_agents', JSON.stringify(agents));
          console.log('[Web] Agent saved:', newAgent);
          return { success: true };
        } catch (e: any) {
          console.error('[Web] Error saving agent:', e);
          return { success: false, error: e.message };
        }
      },
      update: async (id: string, updates: any) => {
        try {
          const stored = localStorage.getItem('mosaic_ai_agents');
          const agents = stored ? JSON.parse(stored) : [];
          const index = agents.findIndex((a: any) => a.id === id);
          if (index >= 0) {
            agents[index] = { ...agents[index], ...updates };
            localStorage.setItem('mosaic_ai_agents', JSON.stringify(agents));
            return { success: true };
          }
          return { success: false, error: 'Agent not found' };
        } catch (e: any) { return { success: false, error: e.message }; }
      },
      delete: async (id: string) => {
        try {
          const stored = localStorage.getItem('mosaic_ai_agents');
          const agents = stored ? JSON.parse(stored) : [];
          localStorage.setItem('mosaic_ai_agents', JSON.stringify(agents.filter((a: any) => a.id !== id)));
          return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
      },
      clear: async () => {
        try {
          localStorage.removeItem('mosaic_ai_agents');
          return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
      },
    },
    themes: {
      get: async () => localStorage.getItem('mosaic_theme') || 'dark',
      set: async (theme: string) => { localStorage.setItem('mosaic_theme', theme); },
    },
    aiAgentsHistory: {
      getAll: async (agentId?: string) => {
        try {
          const stored = localStorage.getItem('mosaic_chat_history');
          const sessions = stored ? JSON.parse(stored) : [];
          // Filter by agentId if provided
          if (agentId) {
            return sessions.filter((s: any) => s.agentId === agentId);
          }
          return sessions;
        } catch (e) {
          console.error('[Web] Error loading chat history:', e);
          return [];
        }
      },
      get: async (agentId: string, sessionId: string) => {
        try {
          const stored = localStorage.getItem('mosaic_chat_history');
          const sessions = stored ? JSON.parse(stored) : [];
          return sessions.find((s: any) => s.id === sessionId) || { id: '', agentId: '' };
        } catch (e) {
          return { id: '', agentId: '' };
        }
      },
      save: async (session: any) => {
        try {
          const stored = localStorage.getItem('mosaic_chat_history');
          const sessions = stored ? JSON.parse(stored) : [];
          // Update existing or add new
          const index = sessions.findIndex((s: any) => s.id === session.id);
          if (index >= 0) {
            sessions[index] = session;
          } else {
            sessions.unshift(session);
          }
          localStorage.setItem('mosaic_chat_history', JSON.stringify(sessions));
          console.log('[Web] Chat session saved:', session.id);
          return { success: true };
        } catch (e) {
          console.error('[Web] Error saving chat session:', e);
          return { success: false, error: e.message };
        }
      },
      delete: async (agentId: string, sessionId: string) => {
        try {
          const stored = localStorage.getItem('mosaic_chat_history');
          const sessions = stored ? JSON.parse(stored) : [];
          const filtered = sessions.filter((s: any) => s.id !== sessionId);
          localStorage.setItem('mosaic_chat_history', JSON.stringify(filtered));
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      deleteAll: async (agentId: string) => {
        try {
          const stored = localStorage.getItem('mosaic_chat_history');
          const sessions = stored ? JSON.parse(stored) : [];
          const filtered = sessions.filter((s: any) => s.agentId !== agentId);
          localStorage.setItem('mosaic_chat_history', JSON.stringify(filtered));
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
    },
    mcpAPI: {},
    gmailAPI: {},
    sandbox: {
      getState: async () => ({ isSandbox: false }),
    },
    window: {
      minimize: async () => {},
      maximize: async () => {},
      close: async () => window.close(),
      isMaximized: async () => false,
    },
  };
  console.log('[Web] electronAPI stub ready');
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./ThemeProvider";
import "./theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);