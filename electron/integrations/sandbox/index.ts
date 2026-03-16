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

import { app, ipcMain, safeStorage } from "electron";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { createHash } from "crypto";
import type { ToolModule } from "../tools/types";
import type { InstalledTool, ToolLauncher, ToolManifest, RunningTool, ApprovalRecord } from "./types";
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
  private inputsDir: string;

  /** Callbacks for registering/unregistering modules from ToolRegistry */
  private onRegister?: (module: ToolModule) => void;
  private onUnregister?: (name: string) => void;

  constructor() {
    this.launcher = new WasmLauncher();

    // Persistence directory
    this.dataDir = join(app.getPath("userData"), "sandbox");
    this.persistPath = join(this.dataDir, "installed-tools.json");
    this.inputsDir = join(this.dataDir, "tool-inputs");

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    if (!existsSync(this.inputsDir)) {
      mkdirSync(this.inputsDir, { recursive: true });
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

    const sourceBytes = readFileSync(wasmFilePath);
    const fileHash = this.sha256(sourceBytes);
    const storedPath = this.persistApprovedArtifact(wasmFilePath, manifest, fileHash);

    const installedTool: InstalledTool = {
      manifest,
      installedAt: new Date().toISOString(),
      enabled: true,
      pinned: false,
      entryPath: storedPath,
      sourcePath: wasmFilePath,
      fileHash,
      approvals: [this.createApprovalRecord(manifest, fileHash, "install")],
    };

    this.installed.set(manifest.id, installedTool);
    this.saveInstalled();

    console.log(`[ToolManager] Installed: ${manifest.displayName} (${manifest.id})`);
    return installedTool;
  }

  /**
   * Update an installed tool from a newly approved WASM file.
   * Replaces the stored artifact metadata and relaunches if it was running.
   */
  async updateTool(wasmFilePath: string): Promise<InstalledTool> {
    const manifest = await this.launcher.extractManifest(wasmFilePath);
    const existing = this.installed.get(manifest.id);
    if (!existing) {
      throw new Error(`Tool "${manifest.id}" is not installed`);
    }

    const sourceBytes = readFileSync(wasmFilePath);
    const fileHash = this.sha256(sourceBytes);
    if (existing.fileHash && existing.fileHash === fileHash) {
      throw new Error(`Tool "${manifest.id}" is already at this exact build`);
    }

    const storedPath = this.persistApprovedArtifact(wasmFilePath, manifest, fileHash);
    const wasRunning = this.isToolRunning(manifest.id);

    if (wasRunning) {
      await this.stopTool(manifest.id);
    }

    const updatedTool: InstalledTool = {
      ...existing,
      manifest,
      entryPath: storedPath,
      sourcePath: wasmFilePath,
      fileHash,
      approvals: [
        this.createApprovalRecord(manifest, fileHash, "update"),
        ...(existing.approvals ?? []),
      ],
    };

    this.installed.set(manifest.id, updatedTool);
    this.saveInstalled();

    if (wasRunning && updatedTool.enabled) {
      await this.launchTool(manifest.id);
    }

    console.log(`[ToolManager] Updated: ${manifest.displayName} (${manifest.id})`);
    return updatedTool;
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

    // Verify persisted artifact integrity before launch.
    // If this fails, the stored file was modified after install approval.
    const currentHash = this.sha256(readFileSync(installed.entryPath));
    if (installed.fileHash && installed.fileHash !== currentHash) {
      throw new Error(
        `Tool integrity check failed for "${toolId}". Expected ${installed.fileHash.slice(0, 12)}..., got ${currentHash.slice(0, 12)}...`,
      );
    }
    // Backfill missing hash for legacy installs.
    if (!installed.fileHash) {
      installed.fileHash = currentHash;
      this.installed.set(toolId, installed);
      this.saveInstalled();
    }

    // Re-extract the manifest from the WASM binary (source of truth)
    const manifest = await this.launcher.extractManifest(installed.entryPath);

    // Pre-materialize tool-specific input data (secrets, config)
    const inputData = this.resolveInputData(manifest);

    // Launch via the ToolLauncher (WasmLauncher)
    const runningTool = await this.launcher.launch(manifest, inputData);

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

  // ---------------------------------------------------------------------------
  // Input Data Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve pre-materialized input data for a tool.
   * Reads the manifest's declared inputs and resolves stored values.
   * Secrets are decrypted from safeStorage; plain strings stored as-is.
   */
  private resolveInputData(manifest: ToolManifest): Map<string, string> {
    const data = new Map<string, string>();

    if (!manifest.inputs) return data;

    const inputsFile = join(this.inputsDir, `${manifest.id}.json`);
    let stored: Record<string, { type: string; value: string }> = {};
    if (existsSync(inputsFile)) {
      try { stored = JSON.parse(readFileSync(inputsFile, "utf-8")); } catch { /* start fresh */ }
    }

    for (const [key, decl] of Object.entries(manifest.inputs)) {
      const entry = stored[key];

      if (entry) {
        // User-configured value
        if (decl.type === "secret") {
          if (safeStorage.isEncryptionAvailable()) {
            const encBuf = Buffer.from(entry.value, "base64");
            data.set(key, safeStorage.decryptString(encBuf));
          }
        } else {
          data.set(key, entry.value);
        }
      } else if (decl.default !== undefined) {
        // Manifest-declared default fallback
        data.set(key, decl.default);
      }
    }

    return data;
  }

  /**
   * Store an input value for a tool. Secrets are encrypted via safeStorage.
   */
  setToolInput(toolId: string, key: string, value: string): void {
    const installed = this.installed.get(toolId);
    if (!installed) throw new Error(`Tool "${toolId}" is not installed`);

    const decl = installed.manifest.inputs?.[key];
    if (!decl) throw new Error(`Tool "${toolId}" does not declare input "${key}"`);

    const inputsFile = join(this.inputsDir, `${toolId}.json`);
    let stored: Record<string, { type: string; value: string }> = {};
    if (existsSync(inputsFile)) {
      try { stored = JSON.parse(readFileSync(inputsFile, "utf-8")); } catch { /* start fresh */ }
    }

    if (decl.type === "secret") {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Encryption not available");
      const encrypted = safeStorage.encryptString(value);
      stored[key] = { type: "secret", value: encrypted.toString("base64") };
    } else {
      stored[key] = { type: "string", value };
    }

    writeFileSync(inputsFile, JSON.stringify(stored, null, 2), "utf-8");
    console.log(`[ToolManager] Saved input "${key}" for ${toolId}`);
  }

  /**
   * Delete an input value for a tool.
   */
  deleteToolInput(toolId: string, key: string): void {
    const inputsFile = join(this.inputsDir, `${toolId}.json`);
    if (!existsSync(inputsFile)) return;

    try {
      const stored = JSON.parse(readFileSync(inputsFile, "utf-8")) as Record<string, unknown>;
      delete stored[key];
      writeFileSync(inputsFile, JSON.stringify(stored, null, 2), "utf-8");
    } catch { /* file gone or corrupt — ignore */ }
  }

  /**
   * Get which input keys have stored values for a tool (does NOT return values).
   */
  getToolInputStatus(toolId: string): Record<string, boolean> {
    const installed = this.installed.get(toolId);
    if (!installed) return {};

    const declared = installed.manifest.inputs ?? {};
    const inputsFile = join(this.inputsDir, `${toolId}.json`);
    let stored: Record<string, unknown> = {};
    if (existsSync(inputsFile)) {
      try { stored = JSON.parse(readFileSync(inputsFile, "utf-8")); } catch { /* empty */ }
    }

    const status: Record<string, boolean> = {};
    for (const key of Object.keys(declared)) {
      status[key] = key in stored;
    }
    return status;
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

  setToolPinned(toolId: string, pinned: boolean): void {
    const installed = this.installed.get(toolId);
    if (!installed) {
      throw new Error(`Tool "${toolId}" is not installed`);
    }
    installed.pinned = pinned;
    this.installed.set(toolId, installed);
    this.saveInstalled();
  }

  // ---------------------------------------------------------------------------
  // IPC Handlers
  // ---------------------------------------------------------------------------

  private registerIPC(): void {
    ipcMain.handle("toolSandbox:inspectManifest", async (_event, wasmPath: string) => {
      try {
        const manifest = await this.launcher.extractManifest(wasmPath);
        const fileHash = this.sha256(readFileSync(wasmPath));
        return { success: true, data: { manifest, fileHash } };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle(
      "toolSandbox:install",
      async (_event, wasmPath: string, approval?: { approved?: boolean }) => {
      try {
        // Enforce explicit approval in the install flow.
        // This is a UX safety gate for manual .wasm installs.
        if (!approval?.approved) {
          return { success: false, error: "Installation requires explicit permission approval" };
        }
        return { success: true, data: await this.installTool(wasmPath) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
      },
    );

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

    ipcMain.handle(
      "toolSandbox:update",
      async (_event, wasmPath: string, approval?: { approved?: boolean }) => {
        try {
          if (!approval?.approved) {
            return { success: false, error: "Update requires explicit permission approval" };
          }
          return { success: true, data: await this.updateTool(wasmPath) };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    ipcMain.handle("toolSandbox:setPinned", async (_event, toolId: string, pinned: boolean) => {
      try {
        this.setToolPinned(toolId, pinned);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle(
      "toolSandbox:setInput",
      async (_event, toolId: string, key: string, value: string) => {
        try {
          this.setToolInput(toolId, key, value);
          return { success: true };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    ipcMain.handle(
      "toolSandbox:deleteInput",
      async (_event, toolId: string, key: string) => {
        try {
          this.deleteToolInput(toolId, key);
          return { success: true };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
    );

    ipcMain.handle("toolSandbox:getInputStatus", async (_event, toolId: string) => {
      try {
        return { success: true, data: this.getToolInputStatus(toolId) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    });

    ipcMain.handle("toolSandbox:isAvailable", async () => {
      const available = await this.launcher.isAvailable();
      return { success: true, data: available };
    });

    // ─── Panel Rendering IPC ───

    ipcMain.handle(
      "toolSandbox:renderPanel",
      async (_event, toolId: string, panelId: string, context?: Record<string, unknown>) => {
        try {
          if (!this.isToolRunning(toolId)) {
            return { success: false, error: `Tool "${toolId}" is not running` };
          }
          const result = await this.launcher.callFunction(toolId, "mosaic_render_panel", { panelId, context });
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

  private persistApprovedArtifact(
    wasmFilePath: string,
    manifest: ToolManifest,
    fileHash: string,
  ): string {
    const toolsDir = join(this.dataDir, "tools", manifest.id);
    if (!existsSync(toolsDir)) {
      mkdirSync(toolsDir, { recursive: true });
    }
    const storedFileName = `${manifest.id}-${manifest.version}-${fileHash.slice(0, 12)}.wasm`;
    const storedPath = join(toolsDir, storedFileName);
    if (!existsSync(storedPath)) {
      copyFileSync(wasmFilePath, storedPath);
    }
    return storedPath;
  }

  private createApprovalRecord(
    manifest: ToolManifest,
    fileHash: string,
    action: "install" | "update",
  ): ApprovalRecord {
    return {
      approvedAt: new Date().toISOString(),
      approvedVersion: manifest.version,
      approvedFileHash: fileHash,
      approvedPermissions: { ...manifest.permissions },
      approvedFunctions: Object.keys(manifest.tools),
      action,
    };
  }

  private sha256(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const toolManager = new ToolManager();
