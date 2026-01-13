import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AIAgentConfig } from "./types/ai";

declare global {
  interface Window {
    electronAPI: {
      logInput: (text: string) => Promise<{ success: boolean; path: string }>;
      getCsvPath: () => Promise<string>;
      aiAgents: {
        get: () => Promise<any[]>;
        set: (agents: any[]) => Promise<any>;
        add: (agent: any) => Promise<any>;
        update: (id: string, updates: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
        clear: () => Promise<any>;
      };
    };
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
