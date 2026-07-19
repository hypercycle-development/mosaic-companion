/**
 * MCP Plugin Manager
 *
 * Persists named server configurations (plugins) to disk so users
 * can define MCP servers once and connect/disconnect them at will.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

// =============================================================================
// Types
// =============================================================================

/**
 * Well-known plugin roles.
 * A role designates a plugin as the canonical provider for a capability.
 * Only one plugin per role is active at a time; the generic IPC handlers
 * (e.g. os:call) route through whichever plugin holds the role.
 */
export type MCPPluginRole = "os" | string;

export interface MCPPlugin {
  id: string;
  name: string;
  description?: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
  autoConnect?: boolean;
  /** Optional role that grants this plugin elevated routing priority */
  role?: MCPPluginRole;
}

// =============================================================================
// Plugin Manager
// =============================================================================

export class MCPPluginManager {
  private filePath: string;
  private plugins: MCPPlugin[] = [];

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "mcp-plugins.json");
    this._load();
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf8");
        this.plugins = JSON.parse(data);
      }
    } catch (e) {
      console.error("[MCPPlugins] Failed to load:", e);
      this.plugins = [];
    }
  }

  private _save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.plugins, null, 2), "utf8");
    } catch (e) {
      console.error("[MCPPlugins] Failed to save:", e);
    }
  }

  reload(): void {
    this._load();
  }

  /** Seed default MCP plugins for new users (plug-and-play) */
  seedDefaults(): void {
    const defaults: Omit<MCPPlugin, "id">[] = [
      {
        name: "gbrain",
        description: "Personal knowledge graph — Query Stargate development history, commits, and architecture",
        transport: "stdio",
        command: "node",
        args: [path.join(__dirname || "", "..", "..", "..", "electron", "integrations", "mcp", "servers", "gbrain-mcp-server.js")],
        env: {},
        autoConnect: true,
      },
      {
        name: "stargate-marketplace",
        description: "Stargate Skills Marketplace — search skills, scan security, attach to agents",
        transport: "stdio",
        command: "node",
        args: [path.join(__dirname || "", "..", "..", "..", "electron", "integrations", "mcp", "servers", "stargate-marketplace-mcp-server.js")],
        env: { STARGATE_MARKETPLACE_URL: "http://localhost:3000/api", STARGATE_SCANNER_URL: "http://localhost:8001" },
        autoConnect: true,
      },
      {
        name: "midnight-wallet",
        description: "Midnight Blockchain Wallet — manage wallets, check balances, transfer NIGHT tokens",
        transport: "stdio",
        command: "node",
        args: [require.resolve("midnight-wallet-cli/dist/mcp-server.js")],
        env: { MIDNIGHT_NETWORK: "" },
        autoConnect: true,
      },
      {
        name: "midnight-mcp",
        description: "Midnight Development MCP — Compact language, contract generation, compilation, analysis",
        transport: "stdio",
        command: "node",
        args: [require.resolve("midnight-mcp/dist/bin.js")],
        env: { CHROMA_URL: "http://127.0.0.1:18790" },
        autoConnect: true,
      },
      {
        name: "midnight-expert",
        description: "Midnight Expert — ALL Hermes skills for Compact development, verification, devnet ops",
        transport: "stdio",
        command: "node",
        args: [path.join(__dirname || "", "..", "..", "..", "electron", "integrations", "mcp", "servers", "midnight-mcp-server.js")],
        env: { HERMES_HOME: path.join(os.homedir(), ".hermes"), MIDNIGHT_EXPERT: path.join(os.homedir(), "midnight-expert") },
        autoConnect: true,
      },
    ];

    for (const plugin of defaults) {
      const exists = this.plugins.some((p) => p.name === plugin.name);
      if (!exists) {
        const newPlugin: MCPPlugin = { ...plugin, id: crypto.randomUUID() };
        this.plugins.push(newPlugin);
        console.log(`[MCPPlugins] Seeded default plugin: ${plugin.name}`);
      }
    }
    this._save();
  }

  list(): MCPPlugin[] {
    return [...this.plugins];
  }

  get(id: string): MCPPlugin | undefined {
    return this.plugins.find((p) => p.id === id);
  }

  add(plugin: Omit<MCPPlugin, "id">): MCPPlugin {
    const newPlugin: MCPPlugin = { ...plugin, id: crypto.randomUUID() };
    this.plugins.push(newPlugin);
    this._save();
    return { ...newPlugin };
  }

  update(id: string, updates: Partial<Omit<MCPPlugin, "id">>): MCPPlugin | null {
    const plugin = this.plugins.find((p) => p.id === id);
    if (!plugin) return null;
    Object.assign(plugin, updates);
    this._save();
    return { ...plugin };
  }

  /** Return the first plugin that has the given role, or undefined */
  byRole(role: MCPPluginRole): MCPPlugin | undefined {
    return this.plugins.find((p) => p.role === role);
  }

  remove(id: string): boolean {
    const idx = this.plugins.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.plugins.splice(idx, 1);
    this._save();
    return true;
  }
}
