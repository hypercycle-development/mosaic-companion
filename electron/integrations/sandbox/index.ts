/**
 * Sandbox — Tool Manager (Entry Point)
 *
 * Orchestrates the tool sandbox subsystem:
 * - Manages installed tools (manifest persistence)
 * - Launches/stops tools via the ToolLauncher
 * - Creates ToolModule bridges for the ToolRegistry
 * - Exposes IPC handlers for the renderer
 *
 * This module is runtime-agnostic. It uses ToolLauncher, which is
 * WasmLauncher now and could be DockerLauncher later.
 */

import { app, ipcMain } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import type { ToolModule } from "../tools/types";
import type { InstalledTool, ToolLauncher, RunningTool } from "./types";
import { WasmLauncher } from "./wasm-launcher";
import { createToolBridge } from "./tool-bridge";
import { getChronicle } from "./chronicle";
import type { ChronicleQuery } from "./types";

// =============================================================================
// Tool Manager
// =============================================================================

export class ToolManager {
  private launcher: ToolLauncher;
  private installed: Map<string, InstalledTool> = new Map();
  private bridges: Map<string, ToolModule> = new Map();
  private dataDir: string;
  private persistPath: string;

  /** Callbacks for registering/unregistering modules from ToolRegistry */
  private onRegister?: (module: ToolModule) => void;
  private onUnregister?: (name: string) => void;

  constructor() {
    this.launcher = new WasmLauncher();

    // Persistence directory
    this.dataDir = join(app.getPath("userData"), "sandbox");
    this.persistPath = join(this.dataDir, "installed-tools.json");

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the tool manager.
   *
   * @param onRegister - Called when a tool module should be added to the ToolRegistry
   * @param onUnregister - Called when a tool module should be removed from the ToolRegistry
   */
  async initialize(
    onRegister: (module: ToolModule) => void,
    onUnregister: (name: string) => void,
  ): Promise<void> {
    this.onRegister = onRegister;
    this.onUnregister = onUnregister;

    console.log("[ToolManager] Initializing...");

    // Load persisted installed tools
    this.loadInstalled();

    // Auto-launch tools that were enabled when the app last closed
    await this.autoLaunchEnabled();

    // Register IPC handlers
    this.registerIPC();

    console.log(
      `[ToolManager] Ready. ${this.installed.size} tool(s) installed.`,
    );
  }

  async cleanup(): Promise<void> {
    console.log("[ToolManager] Cleaning up...");
    if (this.launcher instanceof WasmLauncher) {
      await this.launcher.stopAll();
    }
    this.bridges.clear();
  }

  // ---------------------------------------------------------------------------
  // Tool Installation
  // ---------------------------------------------------------------------------

  /**
   * Install a tool from its WASM file.
   * Extracts the manifest from the binary via mosaic_manifest(), then persists.
   * The manifest embedded in the WASM is the single source of truth.
   */
  async installTool(wasmFilePath: string): Promise<InstalledTool> {
    // Extract manifest directly from the WASM binary
    const manifest = await this.launcher.extractManifest(wasmFilePath);

    if (this.installed.has(manifest.id)) {
      throw new Error(`Tool "${manifest.id}" is already installed`);
    }

    const installedTool: InstalledTool = {
      manifest,
      installedAt: new Date().toISOString(),
      enabled: true,
      entryPath: wasmFilePath,
    };

    this.installed.set(manifest.id, installedTool);
    this.saveInstalled();

    console.log(`[ToolManager] Installed: ${manifest.displayName} (${manifest.id})`);
    return installedTool;
  }

  /**
   * Uninstall a tool. Stops it if running, removes from registry.
   */
  async uninstallTool(toolId: string): Promise<void> {
    const installed = this.installed.get(toolId);
    if (!installed) {
      throw new Error(`Tool "${toolId}" is not installed`);
    }

    // Stop if running
    if (this.bridges.has(`ext:${toolId}`)) {
      await this.stopTool(toolId);
    }

    this.installed.delete(toolId);
    this.saveInstalled();

    console.log(`[ToolManager] Uninstalled: ${toolId}`);
  }

  // ---------------------------------------------------------------------------
  // Tool Launching
  // ---------------------------------------------------------------------------

  /**
   * Launch an installed tool and register it in the ToolRegistry.
   * Re-extracts the manifest from the WASM binary to ensure integrity.
   */
  async launchTool(toolId: string): Promise<RunningTool> {
    const installed = this.installed.get(toolId);
    if (!installed) {
      throw new Error(`Tool "${toolId}" is not installed`);
    }

    const moduleName = `ext:${toolId}`;
    if (this.bridges.has(moduleName)) {
      throw new Error(`Tool "${toolId}" is already running`);
    }

    // Re-extract the manifest from the WASM binary (source of truth)
    const manifest = await this.launcher.extractManifest(installed.entryPath);

    // Launch via the ToolLauncher (WasmLauncher)
    const runningTool = await this.launcher.launch(manifest);

    // Log lifecycle event
    getChronicle().logLifecycle(toolId, "launched", {
      version: manifest.version,
      runtime: manifest.runtime.type,
    });

    // Create a ToolModule bridge
    const bridge = createToolBridge(manifest, this.launcher);

    this.bridges.set(moduleName, bridge);

    // Register in the ToolRegistry
    if (this.onRegister) {
      this.onRegister(bridge);
      console.log(`[ToolManager] Registered tool module: ${moduleName}`);
    }

    return runningTool;
  }

  /**
   * Stop a running tool and unregister from the ToolRegistry.
   */
  async stopTool(toolId: string): Promise<void> {
    const moduleName = `ext:${toolId}`;
    const bridge = this.bridges.get(moduleName);

    if (!bridge) {
      console.warn(`[ToolManager] Tool "${toolId}" is not running`);
      return;
    }

    // Unregister from ToolRegistry
    if (this.onUnregister) {
      this.onUnregister(moduleName);
    }

    // Stop the tool
    await this.launcher.stop(toolId);
    this.bridges.delete(moduleName);

    // Log lifecycle event
    getChronicle().logLifecycle(toolId, "stopped");

    console.log(`[ToolManager] Stopped: ${toolId}`);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getInstalledTools(): InstalledTool[] {
    return Array.from(this.installed.values());
  }

  getRunningTools(): RunningTool[] {
    return this.launcher.listRunning();
  }

  isToolRunning(toolId: string): boolean {
    return this.bridges.has(`ext:${toolId}`);
  }

  // ---------------------------------------------------------------------------
  // IPC Handlers
  // ---------------------------------------------------------------------------

  private registerIPC(): void {
    ipcMain.handle("toolSandbox:install", async (_event, wasmPath: string) => {
      try {
        return { success: true, data: await this.installTool(wasmPath) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle("toolSandbox:uninstall", async (_event, toolId: string) => {
      try {
        await this.uninstallTool(toolId);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle("toolSandbox:launch", async (_event, toolId: string) => {
      try {
        const running = await this.launchTool(toolId);
        return { success: true, data: running };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle("toolSandbox:stop", async (_event, toolId: string) => {
      try {
        await this.stopTool(toolId);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle("toolSandbox:listInstalled", async () => {
      return { success: true, data: this.getInstalledTools() };
    });

    ipcMain.handle("toolSandbox:listRunning", async () => {
      return { success: true, data: this.getRunningTools() };
    });

    ipcMain.handle("toolSandbox:isAvailable", async () => {
      const available = await this.launcher.isAvailable();
      return { success: true, data: available };
    });

    // ─── Panel Rendering IPC ───

    ipcMain.handle(
      "toolSandbox:renderPanel",
      async (_event, toolId: string, panelId: string) => {
        try {
          if (!this.isToolRunning(toolId)) {
            return { success: false, error: `Tool "${toolId}" is not running` };
          }
          const result = await this.launcher.callFunction(toolId, "mosaic_render_panel", { panelId });
          return result;
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    ipcMain.handle(
      "toolSandbox:callFunction",
      async (_event, toolId: string, functionName: string, args: Record<string, unknown>) => {
        try {
          if (!this.isToolRunning(toolId)) {
            return { success: false, error: `Tool "${toolId}" is not running` };
          }
          const result = await this.launcher.callFunction(toolId, functionName, args);
          return result;
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    // ─── Chronicle IPC ───

    ipcMain.handle(
      "chronicle:read",
      async (_event, toolId: string, query?: ChronicleQuery) => {
        try {
          const entries = getChronicle().read(toolId, query);
          return { success: true, data: entries };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    ipcMain.handle(
      "chronicle:hasEntries",
      async (_event, toolId: string) => {
        return { success: true, data: getChronicle().hasEntries(toolId) };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private async autoLaunchEnabled(): Promise<void> {
    const enabled = Array.from(this.installed.values()).filter((t) => t.enabled);
    if (enabled.length === 0) return;

    console.log(`[ToolManager] Auto-launching ${enabled.length} enabled tool(s)...`);

    await Promise.allSettled(
      enabled.map(async (tool) => {
        try {
          await this.launchTool(tool.manifest.id);
          console.log(`[ToolManager] Auto-launched: ${tool.manifest.id}`);
        } catch (err) {
          console.error(`[ToolManager] Failed to auto-launch "${tool.manifest.id}":`, err);
        }
      }),
    );
  }

  private loadInstalled(): void {
    if (!existsSync(this.persistPath)) return;

    try {
      const raw = readFileSync(this.persistPath, "utf-8");
      const data = JSON.parse(raw) as InstalledTool[];

      for (const tool of data) {
        this.installed.set(tool.manifest.id, tool);
      }

      console.log(`[ToolManager] Loaded ${data.length} installed tool(s)`);
    } catch (err) {
      console.error("[ToolManager] Failed to load installed tools:", err);
    }
  }

  private saveInstalled(): void {
    try {
      const data = Array.from(this.installed.values());
      writeFileSync(this.persistPath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[ToolManager] Failed to save installed tools:", err);
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const toolManager = new ToolManager();
