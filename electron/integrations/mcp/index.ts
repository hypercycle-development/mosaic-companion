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

const mcpClient = new MCPClient({ debug: true, timeout: 60000 }); // 60s timeout for slow npx startups
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
          STARGATE_MARKETPLACE_URL: process.env.STARGATE_MARKETPLACE_URL || "http://127.0.0.1:13000/api",
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
  // The Python server file is BUNDLED inside this repo so it works on any PC
  // without a separate Hermes repository checkout.
  const hasHermesTools = existing.some((p) => p.name === "hermes-tools");
  if (!hasHermesTools) {
    // Use environment variable for custom path, fallback to default path
    const hermesToolsPath = process.env.HERMES_TOOLS_MCP_PATH 
      || path.join(home, "mosaic-companion", "electron", "integrations", "mcp", "servers", "hermes-tools-mcp-server.py");
    if (fs.existsSync(hermesToolsPath)) {
      // Use the system Python3 — the script is self-contained and imports
      // model_tools at runtime via PYTHONPATH if Hermes is available.
      const pyCmd = require("node:child_process").execSync("which python3", { encoding: "utf-8" }).trim();
      const hermesEnv: Record<string, string> = {
        HERMES_HOME: process.env.HERMES_HOME || `${home}/.hermes`,
        // If Hermes repo exists alongside Mosaic, add it to PYTHONPATH so
        // model_tools imports succeed. Otherwise the server runs with a
        // reduced toolset (skills_list, skill_view, etc. via built-in fallbacks).
        PYTHONPATH: [
          path.join(home, "hermes"),
          process.env.PYTHONPATH || "",
        ].filter(Boolean).join(path.delimiter),
      };
      pluginManager.add({
        name: "hermes-tools",
        description: "Hermes Agent — ALL tools and skills (terminal, web, file, skills, kanban, cron, etc.)",
        transport: "stdio",
        command: pyCmd,
        args: [hermesToolsPath],
        env: hermesEnv,
        autoConnect: true,
      });
      console.log(`[MCP] Registered default plugin: hermes-tools (bridge: ${hermesToolsPath})`);
    } else {
      console.warn(`[MCP] hermes-tools bridge not found at ${hermesToolsPath}; skipping`);
    }
  }

  // ── Midnight Wallet MCP Server ──
  // Exposes Midnight blockchain wallet operations via MCP.
  // Uses the published npm package midnight-wallet-cli which provides
  // the midnight-wallet-mcp binary for stdio transport.
  const hasMidnight = existing.some((p) => p.name === "midnight-wallet");
  if (!hasMidnight) {
    // Try to find the MCP server binary in node_modules first
    const { execSync } = require("node:child_process");
    let cmd: string;
    let args: string[];
    let env: Record<string, string> = {
      // Optional: configure default network
      MIDNIGHT_NETWORK: process.env.MIDNIGHT_NETWORK || "",
    };

    try {
      // Check if midnight-wallet-cli is available in node_modules
      // Use __dirname to ensure we look from the correct location
      const resolvePath = require.resolve("midnight-wallet-cli/package.json", { paths: [__dirname, process.cwd()] });
      console.log(`[MCP] Resolved midnight-wallet-cli at: ${resolvePath}`);
      const pkgDir = path.dirname(resolvePath);
      const mcpPath = path.join(pkgDir, "dist", "mcp-server.js");
      console.log(`[MCP] Checking MCP server path: ${mcpPath}`);
      if (fs.existsSync(mcpPath)) {
        cmd = "node";
        args = [mcpPath];
        console.log(`[MCP] ✓ Found local midnight-wallet-cli MCP server at: ${mcpPath}`);
      } else {
        // Fall back to npx - use the correct MCP launch syntax
        cmd = "npx";
        args = ["-y", "midnight-wallet-cli@latest", "--mcp"];
        console.log(`[MCP] ⚠ Local MCP server not found at ${mcpPath}, using npx fallback (slower startup)`);
      }
    } catch (e) {
      // Fall back to npx - use the correct MCP launch syntax
      cmd = "npx";
      args = ["-y", "midnight-wallet-cli@latest", "--mcp"];
      console.log(`[MCP] ⚠ Could not resolve midnight-wallet-cli locally (${e}), using npx fallback (slower startup)`);
    }

    pluginManager.add({
      name: "midnight-wallet",
      description: "Midnight Blockchain Wallet — manage wallets, check balances, transfer NIGHT tokens, deploy contracts",
      transport: "stdio",
      command: cmd,
      args: args,
      env: env,
      autoConnect: true,
    });
    console.log(`[MCP] Registered default plugin: midnight-wallet`);
  }

  // ── Midnight Development MCP Server ──
  // Exposes Compact language tools, contract generation, compilation,
  // analysis, documentation search, and example discovery for Midnight
  // blockchain development. Complements midnight-wallet (operations).
  const hasMidnightDev = existing.some((p) => p.name === "midnight-mcp");
  if (!hasMidnightDev) {
    let devCmd: string;
    let devArgs: string[];
    try {
      // Prefer a local midnight-mcp install in Mosaic's node_modules.
      // The stdio entry point is dist/bin.js (dist/index.js only exports helpers).
      const resolvePath = require.resolve("midnight-mcp/package.json", { paths: [__dirname, process.cwd()] });
      const pkgDir = path.dirname(resolvePath);
      const mcpEntry = path.join(pkgDir, "dist", "bin.js");
      if (fs.existsSync(mcpEntry)) {
        devCmd = "node";
        devArgs = [mcpEntry];
        console.log(`[MCP] ✓ Found local midnight-mcp at: ${mcpEntry}`);
      } else {
        devCmd = "npx";
        devArgs = ["-y", "midnight-mcp@latest"];
        console.log(`[MCP] ⚠ Local midnight-mcp entry not found at ${mcpEntry}, using npx fallback`);
      }
    } catch (e) {
      devCmd = "npx";
      devArgs = ["-y", "midnight-mcp@latest"];
      console.log(`[MCP] ⚠ Could not resolve midnight-mcp locally (${e}), using npx fallback`);
    }

    pluginManager.add({
      name: "midnight-mcp",
      description: "Midnight Development MCP — Compact language, contract generation, compilation, analysis, docs search, examples",
      transport: "stdio",
      command: devCmd,
      args: devArgs,
      env: {
        // Silence ChromaDB tenant warnings; server falls back to in-memory vector store
        CHROMA_SERVER_HOST: process.env.CHROMA_SERVER_HOST || "",
      },
      autoConnect: true,
    });
    console.log(`[MCP] Registered default plugin: midnight-mcp`);
  }

  // ── Codebase Memory MCP Server ──
  // High-performance code-intelligence knowledge graph. Static binary, no deps.
  const hasCodebaseMemory = existing.some((p) => p.name === "codebase-memory");
  if (!hasCodebaseMemory) {
    const cbmBinary = process.env.CODEBASE_MEMORY_MCP_PATH
      || path.join(home, ".local", "bin", "codebase-memory-mcp");
    if (fs.existsSync(cbmBinary)) {
      pluginManager.add({
        name: "codebase-memory",
        description: "Codebase Memory — persistent code knowledge graph via MCP (search, call chains, architecture, blast radius)",
        transport: "stdio",
        command: cbmBinary,
        args: [],
        env: {},
        autoConnect: true,
      });
      console.log(`[MCP] Registered default plugin: codebase-memory (${cbmBinary})`);
    } else {
      console.warn(`[MCP] codebase-memory-mcp binary not found at ${cbmBinary}; run the installer to enable it`);
    }
  }

  // ── Atomic Mail MCP Server ──
  // Agentic @atomicmail.ai inboxes: autonomous email signup, send/receive, drafts,
  // search, and attachments via JMAP. Each Mosaic agent can get its own inbox.
  const hasAtomicMail = existing.some((p) => p.name === "atomicmail");
  if (!hasAtomicMail) {
    let amCmd: string;
    let amArgs: string[];
    try {
      // Prefer a local @atomicmail/mcp-github install in Mosaic's node_modules.
      // The published package uses ESM under esm/mcp/main.js with bin entry
      // atomicmail-mcp pointing to the same file.
      const resolvePath = require.resolve("@atomicmail/mcp-github/package.json", { paths: [__dirname, process.cwd()] });
      const pkgDir = path.dirname(resolvePath);
      const mcpEntry = path.join(pkgDir, "esm", "mcp", "main.js");
      if (fs.existsSync(mcpEntry)) {
        amCmd = "node";
        amArgs = [mcpEntry];
        console.log(`[MCP] ✓ Found local @atomicmail/mcp-github at: ${mcpEntry}`);
      } else {
        amCmd = "npx";
        amArgs = ["-y", "@atomicmail/mcp-github"];
        console.log(`[MCP] ⚠ Local @atomicmail/mcp-github entry not found at ${mcpEntry}, using npx fallback`);
      }
    } catch (e) {
      amCmd = "npx";
      amArgs = ["-y", "@atomicmail/mcp-github"];
      console.log(`[MCP] ⚠ Could not resolve @atomicmail/mcp-github locally (${e}), using npx fallback`);
    }

    pluginManager.add({
      name: "atomicmail",
      description: "Atomic Mail — autonomous @atomicmail.ai inboxes for agents (signup, send, receive, search, drafts, attachments via JMAP)",
      transport: "stdio",
      command: amCmd,
      args: amArgs,
      env: {},
      autoConnect: true,
    });
    console.log(`[MCP] Registered default plugin: atomicmail`);
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
      // Log available tools for debugging
      try {
        const tools = await mcpClient.listTools(plugin.name);
        console.log(`[MCP] ${plugin.name} has ${tools.length} tools:`, tools.slice(0, 5).map((t: any) => t.name));
      } catch (toolErr) {
        console.warn(`[MCP] Could not list tools for ${plugin.name}:`, toolErr);
      }
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
      // Add timeout handling for slow tool calls (npx downloads, etc.)
      const timeoutMs = 120000; // 120s for tool calls
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tool call timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      const resultPromise = mcpClient.callTool(serverName, toolName, args);
      const result = await Promise.race([resultPromise, timeoutPromise]);
      return { success: true, result };
    } catch (error) {
      console.error(`[MCP] callTool error for ${serverName}/${toolName}:`, error);
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
