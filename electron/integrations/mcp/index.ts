/**
 * Electron Main Process - MCP Integration
 *
 * Thin wrapper that connects MCPClient and MCPPluginManager to Electron's IPC.
 * All protocol logic lives in MCPClient.ts — this file only handles:
 * - IPC handler registration
 * - Plugin persistence (MCPPluginManager)
 * - Forwarding MCPClient events to the renderer
 */

import { BrowserWindow, ipcMain } from "electron";
import { MCPClient } from "./MCPClient";
import { MCPPluginManager } from "./plugin";
import type { MCPServerConfig } from "./MCPClient";

// =============================================================================
// Singletons
// =============================================================================

const mcpClient = new MCPClient({ debug: true });
const pluginManager = new MCPPluginManager();

let mainWindow: BrowserWindow | null = null;

/** Called from main.ts after the window is created */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

// =============================================================================
// Auto-connect plugins
// =============================================================================

export async function initPlugins(): Promise<void> {
  const plugins = pluginManager.list().filter((p) => p.autoConnect);
  for (const plugin of plugins) {
    try {
      await mcpClient.connect({
        name: plugin.name,
        transport: plugin.transport,
        command: plugin.command,
        args: plugin.args,
        env: plugin.env,
        url: plugin.url,
        apiKey: plugin.apiKey,
      });
    } catch (e) {
      console.error(`[MCP] Auto-connect failed for plugin "${plugin.name}":`, e);
    }
  }
}

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
  notifyRenderer("mcp:server-error", { name: server, error: error.message });
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
// IPC Handlers — Plugin Management
// =============================================================================

ipcMain.handle("mcp:reload-plugins", () => {
  pluginManager.reload();
});

ipcMain.handle("mcp:list-plugins", () => {
  return pluginManager.list();
});

ipcMain.handle(
  "mcp:add-plugin",
  (_event, plugin: Omit<import("./plugin").MCPPlugin, "id">) => {
    return pluginManager.add(plugin);
  },
);

ipcMain.handle(
  "mcp:update-plugin",
  (
    _event,
    id: string,
    updates: Partial<Omit<import("./plugin").MCPPlugin, "id">>,
  ) => {
    return pluginManager.update(id, updates);
  },
);

ipcMain.handle("mcp:remove-plugin", (_event, id: string) => {
  return pluginManager.remove(id);
});

ipcMain.handle("mcp:connect-plugin", async (_event, id: string) => {
  const plugin = pluginManager.get(id);
  if (!plugin) return { success: false, error: `Plugin "${id}" not found` };
  try {
    await mcpClient.connect({
      name: plugin.name,
      transport: plugin.transport,
      command: plugin.command,
      args: plugin.args,
      env: plugin.env,
      url: plugin.url,
      apiKey: plugin.apiKey,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("mcp:disconnect-plugin", async (_event, id: string) => {
  const plugin = pluginManager.get(id);
  if (!plugin) return { success: false, error: `Plugin "${id}" not found` };
  try {
    await mcpClient.disconnect(plugin.name);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// =============================================================================
// IPC Handlers — Role-based OS Access
//
// The "os" role designates one plugin as the system-level tool provider
// (e.g. @modelcontextprotocol/server-filesystem).
// These handlers are a stable interface that routes through whatever MCP
// server currently holds the "os" role — swap the plugin, nothing else changes.
// =============================================================================

/** Resolve the connected OS plugin's server name, or throw */
function requireOsServer(): string {
  const plugin = pluginManager.byRole("os");
  if (!plugin) throw new Error("No plugin has role 'os'. Assign it in the MCP Servers panel.");
  if (!mcpClient.isConnected(plugin.name))
    throw new Error(`OS plugin "${plugin.name}" is not connected. Connect it in the MCP Servers panel.`);
  return plugin.name;
}

/** Status of the OS role: which plugin holds it and whether it's connected */
ipcMain.handle("os:status", () => {
  const plugin = pluginManager.byRole("os");
  if (!plugin) return { configured: false, connected: false };
  return {
    configured: true,
    connected: mcpClient.isConnected(plugin.name),
    pluginName: plugin.name,
    pluginId: plugin.id,
  };
});

/** List all tools exposed by the OS plugin */
ipcMain.handle("os:list-tools", async () => {
  try {
    const serverName = requireOsServer();
    const tools = await mcpClient.listTools(serverName);
    return { success: true, tools, serverName };
  } catch (error) {
    return { success: false, error: (error as Error).message, tools: [] };
  }
});

/**
 * Call any tool on the OS plugin.
 * The renderer doesn't need to know which MCP server backs this —
 * it just calls os:call with the tool name and args.
 */
ipcMain.handle(
  "os:call",
  async (_event, toolName: string, args: Record<string, unknown> = {}) => {
    try {
      const serverName = requireOsServer();
      const result = await mcpClient.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);

export { mcpClient, pluginManager };
