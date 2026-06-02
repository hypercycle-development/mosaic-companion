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

/** Ensure default built-in plugins are registered in the plugin manager. */
function ensureDefaultPlugins(): void {
  const existing = pluginManager.list();

  // Shared Node.js built-ins used by multiple plugin registrations below
  const path = require("node:path");
  const os = require("node:os");
  const fs = require("node:fs");
  const home = os.homedir();

  // Register gbrain MCP server if not already present
  // Uses the Node.js bridge script (bundled in repo source) that wraps gbrain
  // CLI commands. Native `gbrain serve` is blocked by PGLite WASM abort on Linux
  // (upstream issue #223); the bridge is the reliable path until that's fixed.
  const hasGbrain = existing.some((p) => p.name === "gbrain");
  if (!hasGbrain) {
    // esbuild bundles TS entry points but does NOT copy raw JS assets,
    // so require.resolve("./servers/...") fails in dist/main/. Use absolute
    // path from the source tree. This resolves relative to user home.
    const gbrainPath = path.join(home, "mosaic-companion", "electron", "integrations", "mcp", "servers", "gbrain-mcp-server.js");
    if (fs.existsSync(gbrainPath)) {
      pluginManager.add({
        name: "gbrain",
        description: "Personal knowledge graph — Query Stargate development history, commits, and architecture",
        transport: "stdio",
        command: "node",
        args: [gbrainPath],
        env: {},
        autoConnect: true,
      });
      console.log(`[MCP] Registered default plugin: gbrain (bridge: ${gbrainPath})`);
    } else {
      console.warn(`[MCP] gbrain bridge not found at ${gbrainPath}; skipping`);
    }
  }

  // ── Stargate Skills Marketplace MCP Server ──
  // Exposes marketplace search, skill detail, security scanning, and agent
  // attachment as MCP tools. Bridge talks directly to localhost:3000/api
  // and localhost:8001 (scanner) via built-in Node.js http — zero deps.
  const hasMarketplace = existing.some((p) => p.name === "stargate-marketplace");
  if (!hasMarketplace) {
    const marketplacePath = path.join(home, "mosaic-companion", "electron", "integrations", "mcp", "servers", "stargate-marketplace-mcp-server.js");
    if (fs.existsSync(marketplacePath)) {
      pluginManager.add({
        name: "stargate-marketplace",
        description: "Stargate Skills Marketplace — search skills, scan security, attach to agents",
        transport: "stdio",
        command: "node",
        args: [marketplacePath],
        env: {
          STARGATE_MARKETPLACE_URL: process.env.STARGATE_MARKETPLACE_URL || "http://localhost:3000/api",
          STARGATE_SCANNER_URL: process.env.STARGATE_SCANNER_URL || "http://localhost:8001",
        },
        autoConnect: true,
      });
      console.log(`[MCP] Registered default plugin: stargate-marketplace (bridge: ${marketplacePath})`);
    } else {
      console.warn(`[MCP] stargate-marketplace bridge not found at ${marketplacePath}; skipping`);
    }
  }

  // ── Hermes Tools MCP Server ──
  // Exposes ALL Hermes tools (skills, terminal, web, file, kanban, cron, etc.)
  // over MCP so every Mosaic agent can invoke them transparently.

  // Resolve the *correct* command first (venv python + main.py is the only
  // reliable way inside Electron — the `hermes` wrapper relies on sys.path
  // being correct and `dotenv` being importable, which isn't true here).
  const venvCand = path.join(home, "hermes", "venv", "bin", "python3");
  const mainPyCand = path.join(home, "hermes", "hermes_cli", "main.py");
  let hermesCmd: string = "";
  let hermesArgs: string[] = [];
  if (fs.existsSync(venvCand) && fs.existsSync(mainPyCand)) {
    hermesCmd = venvCand;
    hermesArgs = [mainPyCand, "mcp", "serve-tools", "--accept-hooks"];
  } else {
    try {
      hermesCmd = require("node:child_process").execSync("which hermes", { encoding: "utf-8" }).trim();
      hermesArgs = ["mcp", "serve-tools", "--accept-hooks"];
    } catch {
      hermesCmd = "";
    }
  }

  if (!hermesCmd) {
    console.warn("[MCP] Hermes not found; skipping hermes-tools registration");
    return;
  }

  const existingHermes = existing.find((p) => p.name === "hermes-tools");
  const isStale = existingHermes && (
    // The old buggy registration used a `hermes` wrapper that crashes
    // inside Electron (dotenv not on sys.path without the venv active).
    existingHermes.command === "hermes" ||
    existingHermes.command.endsWith("bin/hermes") ||
    existingHermes.command !== hermesCmd
  );

  const hermesEnv: Record<string, string> = {
    HERMES_HOME: process.env.HERMES_HOME || `${home}/.hermes`,
    // Hermes modules (model_tools, mcp_serve_tools, etc.) live in
    // the project root, not in site-packages. PYTHONPATH adds it.
    // Do NOT set PYTHONHOME — it corrupts the venv interpreter.
    PYTHONPATH: path.join(home, "hermes"),
  };

  if (!existingHermes) {
    // Fresh registration on first run
    pluginManager.add({
      name: "hermes-tools",
      description: "Hermes Agent — ALL tools and skills (terminal, web, file, skills, kanban, cron, etc.)",
      transport: "stdio",
      command: hermesCmd,
      args: hermesArgs,
      env: hermesEnv,
      autoConnect: true,
    });
    console.log(`[MCP] Registered default plugin: hermes-tools (cmd: ${hermesCmd}, args: ${JSON.stringify(hermesArgs)})`);
  } else if (isStale) {
    // Re-register with corrected command so initPlugins() can connect
    console.warn(
      `[MCP] hermes-tools config is stale (cmd: ${existingHermes.command}); ` +
      `replacing with corrected command: ${hermesCmd}`
    );
    pluginManager.remove(existingHermes.id);
    pluginManager.add({
      name: "hermes-tools",
      description: "Hermes Agent — ALL tools and skills (terminal, web, file, skills, kanban, cron, etc.)",
      transport: "stdio",
      command: hermesCmd,
      args: hermesArgs,
      env: hermesEnv,
      autoConnect: true,
    });
    console.log(`[MCP] Re-registered hermes-tools (cmd: ${hermesCmd}, args: ${JSON.stringify(hermesArgs)})`);
  } else {
    console.log(`[MCP] hermes-tools already registered with correct command: ${hermesCmd}`);
  }
}

export async function initPlugins(): Promise<void> {
  // Ensure default built-in plugins are registered
  ensureDefaultPlugins();

  const plugins = pluginManager.list().filter((p) => p.autoConnect);
  for (const plugin of plugins) {
    try {
      const result = await mcpClient.connect({
        name: plugin.name,
        transport: plugin.transport,
        command: plugin.command,
        args: plugin.args,
        env: plugin.env,
        url: plugin.url,
        apiKey: plugin.apiKey,
      });
      console.log(`[MCP] Connected: ${plugin.name} (${result.serverInfo?.name} v${result.serverInfo?.version})`);
      notifyRenderer("mcp:server-connected", {
        name: plugin.name,
        tools: result.capabilities.tools ? [] : undefined,
        resources: result.capabilities.resources ? [] : undefined,
        prompts: result.capabilities.prompts ? [] : undefined,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[MCP] Auto-connect failed for plugin "${plugin.name}":`, e);
      notifyRenderer("mcp:server-error", {
        name: plugin.name,
        error: errMsg,
      });
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
    // For auth-required plugins, disconnect means clearing the stored key from disk
    if (plugin.oauthRequired) {
      pluginManager.update(id, { apiKey: undefined });
    }
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

// Stargate AIM-as-MCP bridge: register AIM nodes as MCP servers
ipcMain.handle("stargate:registerAIM", async (_event, config: Record<string, unknown>) => {
  try {
    const mcpConfig = config as unknown as MCPServerConfig;
    const aimServerName = `aim-${mcpConfig.name}`;

    // Prevent duplicate registration
    if (mcpClient.isConnected(aimServerName)) {
      return { success: true, serverName: aimServerName, alreadyConnected: true };
    }

    await mcpClient.connect({
      name: aimServerName,
      transport: mcpConfig.transport,
      url: mcpConfig.url,
      apiKey: mcpConfig.apiKey,
    });

    console.log(`[MCP-Bridge] Registered AIM as server: ${aimServerName} (${mcpConfig.url})`);

    // Also persist as plugin for auto-reconnect (id is auto-generated by pluginManager.add)
    pluginManager.add({
      name: aimServerName,
      description: `HyperCycle AIM node: ${mcpConfig.name}`,
      transport: mcpConfig.transport,
      url: mcpConfig.url,
      apiKey: mcpConfig.apiKey,
      autoConnect: true,
      role: 'stargate-aim',
    });

    return { success: true, serverName: aimServerName };
  } catch (error) {
    console.error(`[MCP-Bridge] Failed to register AIM:`, error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("stargate:unregisterAIM", async (_event, serverName: string) => {
  try {
    await mcpClient.disconnect(serverName);

    // Remove from plugin manager if present
    const plugins = pluginManager.list().filter(p => p.name === serverName);
    for (const p of plugins) {
      pluginManager.remove(p.id);
    }

    console.log(`[MCP-Bridge] Unregistered AIM server: ${serverName}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

export { mcpClient, pluginManager };
