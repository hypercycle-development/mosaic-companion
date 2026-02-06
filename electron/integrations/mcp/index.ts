/**
 * Electron Main Process - MCP Integration
 *
 * Thin wrapper that connects the standalone MCPClient to Electron's IPC.
 * All protocol logic lives in MCPClient.ts — this file only handles:
 * - Electron app lifecycle
 * - IPC handler registration
 * - Forwarding MCPClient events to the renderer
 * - Running agent loops in the main process (where API keys live)
 */

import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { MCPClient } from "./MCPClient";
import type { MCPServerConfig } from "./MCPClient";
import { runAgentLoop } from "./recipes/agentLoop";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import type { LLMProvider } from "./providers/types";

// =============================================================================
// MCP Client (single instance)
// =============================================================================

const mcpClient = new MCPClient({ debug: true });
let mainWindow: BrowserWindow | null = null;

// =============================================================================
// Renderer Notification Helper
// =============================================================================

function notifyRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// =============================================================================
// Forward MCPClient Events → Renderer
// =============================================================================

mcpClient.on("connected", ({ server }) => {
  // Send full server info so the renderer can update its UI
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:server-connected", {
    name: server,
    tools: serverInfo?.tools ?? [],
    resources: serverInfo?.resources ?? [],
    prompts: serverInfo?.prompts ?? [],
  });
});

mcpClient.on("disconnected", ({ server, code }) => {
  notifyRenderer("mcp:server-disconnected", { name: server, code });
});

mcpClient.on("error", ({ server, error }) => {
  notifyRenderer("mcp:server-error", {
    name: server,
    error: error.message,
  });
});

mcpClient.on("notification", ({ server, method, params }) => {
  notifyRenderer("mcp:notification", { server, method, params });
});

mcpClient.on("tools-changed", ({ server }) => {
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:tools-changed", {
    name: server,
    tools: serverInfo?.tools ?? [],
  });
});

mcpClient.on("resources-changed", ({ server }) => {
  const servers = mcpClient.getServers();
  const serverInfo = servers.find((s) => s.name === server);
  notifyRenderer("mcp:resources-changed", {
    name: server,
    resources: serverInfo?.resources ?? [],
  });
});

// =============================================================================
// IPC Handlers — Server Management
// =============================================================================

ipcMain.handle("mcp:connect", async (_event, config: MCPServerConfig) => {
  try {
    await mcpClient.connect(config);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("mcp:disconnect", async (_event, serverName: string) => {
  try {
    await mcpClient.disconnect(serverName);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("mcp:list-servers", () => {
  return mcpClient.getServers();
});

// =============================================================================
// IPC Handlers — Tool Operations
// =============================================================================

ipcMain.handle(
  "mcp:call-tool",
  async (
    _event,
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    try {
      const result = await mcpClient.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

ipcMain.handle("mcp:list-tools", async (_event, serverName: string) => {
  try {
    const tools = await mcpClient.listTools(serverName);
    return { success: true, tools };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =============================================================================
// IPC Handlers — Resource Operations
// =============================================================================

ipcMain.handle(
  "mcp:read-resource",
  async (_event, serverName: string, uri: string) => {
    try {
      const result = await mcpClient.readResource(serverName, uri);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

ipcMain.handle("mcp:list-resources", async (_event, serverName: string) => {
  try {
    const resources = await mcpClient.listResources(serverName);
    return { success: true, resources };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =============================================================================
// IPC Handlers — Prompt Operations
// =============================================================================

ipcMain.handle(
  "mcp:get-prompt",
  async (
    _event,
    serverName: string,
    promptName: string,
    args: Record<string, string>,
  ) => {
    try {
      const result = await mcpClient.getPrompt(serverName, promptName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

ipcMain.handle("mcp:list-prompts", async (_event, serverName: string) => {
  try {
    const prompts = await mcpClient.listPrompts(serverName);
    return { success: true, prompts };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =============================================================================
// IPC Handlers — Agent Loop (runs in main process where API keys live)
// =============================================================================

interface AgentRequest {
  query: string;
  serverNames: string[];
  provider: "openai" | "anthropic";
  model?: string;
  systemPrompt?: string;
  maxIterations?: number;
}

ipcMain.handle("mcp:run-agent", async (_event, request: AgentRequest) => {
  try {
    const provider = createProvider(request.provider, request.model);

    const result = await runAgentLoop(
      mcpClient,
      provider,
      request.serverNames,
      request.query,
      {
        maxIterations: request.maxIterations,
        systemPrompt: request.systemPrompt,
        onToolResult: (toolName, resultText, serverName) => {
          // Stream tool results to the renderer for live UI updates
          notifyRenderer("mcp:agent-tool-result", {
            toolName,
            result: resultText,
            server: serverName,
          });
        },
        onText: (text) => {
          notifyRenderer("mcp:agent-text", { text });
        },
      },
    );

    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

function createProvider(
  provider: "openai" | "anthropic",
  model?: string,
): LLMProvider {
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY environment variable not set");
    return new OpenAIProvider(apiKey, model);
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error("ANTHROPIC_API_KEY environment variable not set");
    return new AnthropicProvider(apiKey, model);
  }
}

// =============================================================================
// Electron App Lifecycle
// =============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  mcpClient.disconnectAll();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  mcpClient.disconnectAll();
});

export { mcpClient };
