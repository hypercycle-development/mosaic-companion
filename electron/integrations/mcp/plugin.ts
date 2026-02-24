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

// =============================================================================
// Types
// =============================================================================

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

  remove(id: string): boolean {
    const idx = this.plugins.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.plugins.splice(idx, 1);
    this._save();
    return true;
  }
}
