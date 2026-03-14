/**
 * WASM Launcher — ToolLauncher Implementation
 *
 * Implements the ToolLauncher interface using Extism (WebAssembly plugin framework).
 * This is the ONLY file that knows about Extism/WASM specifics.
 *
 * Security: WASM modules have ZERO access to network, filesystem, or OS
 * by default. All capabilities are provided through host functions,
 * which are gated by the GatekeeperPolicy.
 */

import createPlugin, { type Plugin, type CallContext } from "@extism/extism";
import { readFileSync } from "fs";
import type {
  ToolLauncher,
  ToolManifest,
  RunningTool,
  ToolCallResult,
} from "./types";
import {
  gatekeeperPolicy,
  createHostFunctions,
} from "./gatekeeper";

// =============================================================================
// Constants
// =============================================================================

/** Default memory limit if not specified in manifest (64MB) */
const DEFAULT_MEMORY_MB = 64;

/** Default timeout if not specified in manifest (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * No-op host functions used during manifest extraction.
 * The WASM module declares imports for all host functions at load time —
 * the runtime refuses to instantiate the module if any import is missing,
 * even when we only intend to call mosaic_manifest().
 * These stubs satisfy the import requirements without doing anything.
 */
const STUB_HOST_FUNCTIONS = {
  "extism:host/user": {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mosaic_log(_cp: CallContext, _msgOffs: bigint) {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mosaic_write_output(_cp: CallContext, _dataOffs: bigint) {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mosaic_read_input(_cp: CallContext, _keyOffs: bigint): bigint { return 0n; },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async mosaic_http_request(
      _cp: CallContext,
      _urlOffs: bigint,
      _methodOffs: bigint,
      _headersOffs: bigint,
      _bodyOffs: bigint,
    ): Promise<bigint> { return 0n; },
  },
} as const;

// =============================================================================
// Internal state for a loaded WASM tool
// =============================================================================

interface LoadedWasmTool {
  plugin: Plugin;
  runningTool: RunningTool;
  timeoutMs: number;
}

// =============================================================================
// WASM Launcher
// =============================================================================

export class WasmLauncher implements ToolLauncher {
  private loaded: Map<string, LoadedWasmTool> = new Map();

  // ---------------------------------------------------------------------------
  // ToolLauncher interface
  // ---------------------------------------------------------------------------

  /**
   * Extract the manifest from a WASM binary by calling its mosaic_manifest() export.
   * This is the single source of truth — no external manifest file is trusted.
   */
  async extractManifest(wasmPath: string): Promise<ToolManifest> {
    console.log(`[WasmLauncher] Extracting manifest from: ${wasmPath}`);

    const wasmData = this.resolveWasmSourceFromPath(wasmPath);

    // Load the plugin temporarily with stub host functions — just to read the manifest.
    // Must wrap in Extism manifest format; passing raw Uint8Array causes
    // "Expected 'wasm' key in manifest" if Extism attempts JSON parsing.
    // Stubs are required because the WASM module declares imports for all host
    // functions (mosaic_log etc.) and the runtime refuses to load if any import
    // is unresolved, even when we only intend to call mosaic_manifest().
    const plugin = await createPlugin(
      { wasm: [{ data: wasmData }] },
      { useWasi: true, runInWorker: true, functions: STUB_HOST_FUNCTIONS },
    );
    try {
      const result = await plugin.call("mosaic_manifest");
      if (!result) {
        throw new Error(
          "WASM module does not export mosaic_manifest() or it returned no data",
        );
      }

      const manifestJson = result.text();
      let manifest: ToolManifest;

      try {
        manifest = JSON.parse(manifestJson) as ToolManifest;
      } catch {
        throw new Error("mosaic_manifest() returned invalid JSON");
      }

      this.validateManifest(manifest);

      // Override runtime.entry with the actual file path we loaded from
      manifest.runtime.entry = wasmPath;

      console.log(
        `[WasmLauncher] Extracted manifest for "${manifest.id}" v${manifest.version}`,
      );
      return manifest;
    } finally {
      await plugin.close();
    }
  }

  async launch(manifest: ToolManifest, inputData?: Map<string, string>): Promise<RunningTool> {
    console.log(`[WasmLauncher] Loading tool: ${manifest.id}`);

    if (this.loaded.has(manifest.id)) {
      throw new Error(`Tool "${manifest.id}" is already loaded`);
    }

    // Register manifest with gatekeeper for policy enforcement
    gatekeeperPolicy.registerTool(manifest);

    // Pre-materialized data injected by Core (e.g. API keys, Vault entries)
    const resolvedInputData = inputData ?? new Map<string, string>();

    // Create host functions gated by the gatekeeper
    const hostFns = createHostFunctions(manifest, gatekeeperPolicy, resolvedInputData);

    // Load the WASM module
    const wasmData = this.resolveWasmSource(manifest);
    const timeoutMs = this.parseTimeout(manifest.resources.timeout);

    // Build Extism host functions in the format Extism expects
    const extismFunctions = this.buildExtismFunctions(manifest.id, hostFns);

    const plugin = await createPlugin(
      { wasm: [{ data: wasmData }] },
      { useWasi: true, runInWorker: true, functions: extismFunctions },
    );

    const runningTool: RunningTool = {
      toolId: manifest.id,
      status: "running",
      startedAt: new Date(),
      manifest,
    };

    this.loaded.set(manifest.id, {
      plugin,
      runningTool,
      timeoutMs,
    });

    console.log(`[WasmLauncher] Tool "${manifest.id}" loaded and ready`);
    return runningTool;
  }

  async callFunction(
    toolId: string,
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const loaded = this.loaded.get(toolId);
    if (!loaded) {
      return { success: false, error: `Tool "${toolId}" is not loaded` };
    }

    if (loaded.runningTool.status !== "running") {
      return {
        success: false,
        error: `Tool "${toolId}" is not running (status: ${loaded.runningTool.status})`,
      };
    }

    try {
      // Call the WASM function with JSON input
      const input = JSON.stringify(args);
      const output = await loaded.plugin.call(functionName, input);

      if (!output) {
        return { success: true, data: null };
      }

      // Parse the output
      const resultText = output.text();
      try {
        const parsed = JSON.parse(resultText);
        return {
          success: true,
          data: parsed.data ?? parsed,
          ui: parsed.ui,
          displayHint: parsed.displayHint,
        };
      } catch {
        // If not JSON, return as string
        return { success: true, data: resultText };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WasmLauncher] Error calling ${toolId}:${functionName}:`, message);
      return {
        success: false,
        error: `Tool function error: ${message}`,
      };
    }
  }

  async stop(toolId: string): Promise<void> {
    const loaded = this.loaded.get(toolId);
    if (!loaded) {
      console.warn(`[WasmLauncher] Tool "${toolId}" not found`);
      return;
    }

    try {
      loaded.runningTool.status = "stopping";
      await loaded.plugin.close();
      gatekeeperPolicy.unregisterTool(toolId);
      console.log(`[WasmLauncher] Tool "${toolId}" stopped`);
    } catch (err) {
      console.error(`[WasmLauncher] Error stopping ${toolId}:`, err);
    } finally {
      loaded.runningTool.status = "stopped";
      this.loaded.delete(toolId);
    }
  }

  listRunning(): RunningTool[] {
    return Array.from(this.loaded.values()).map((l) => l.runningTool);
  }

  async isAvailable(): Promise<boolean> {
    // WASM is always available — no external dependencies
    return true;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  async stopAll(): Promise<void> {
    const toolIds = Array.from(this.loaded.keys());
    console.log(`[WasmLauncher] Stopping all tools (${toolIds.length})...`);
    await Promise.allSettled(toolIds.map((id) => this.stop(id)));
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the WASM source from a file path.
   * Returns the Uint8Array of the WASM binary.
   */
  private resolveWasmSourceFromPath(wasmPath: string): Uint8Array {
    try {
      const buffer = readFileSync(wasmPath);
      return new Uint8Array(buffer);
    } catch (err) {
      throw new Error(
        `Failed to load WASM file "${wasmPath}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Resolve the WASM source from the manifest.
   * Returns the Uint8Array of the WASM binary.
   */
  private resolveWasmSource(manifest: ToolManifest): Uint8Array {
    return this.resolveWasmSourceFromPath(manifest.runtime.entry);
  }

  /**
   * Build Extism-compatible host functions from our WasmHostFunctions.
   *
   * Extism expects functions in the format:
   * { "namespace": { functionName(cp: CurrentPlugin, ...offsets) } }
   */
  private buildExtismFunctions(
    toolId: string,
    hostFns: ReturnType<typeof createHostFunctions>,
  ) {
    const ctx = { toolId };

    return {
      "extism:host/user": {
        // HTTP request: tool passes URL, method, headers, body as offsets
        async mosaic_http_request(
          cp: CallContext,
          urlOffs: bigint,
          methodOffs: bigint,
          headersOffs: bigint,
          bodyOffs: bigint,
        ) {
          const url = cp.read(urlOffs)?.text() ?? "";
          const method = cp.read(methodOffs)?.text() ?? "GET";
          const headers = cp.read(headersOffs)?.text() ?? "{}";
          const body = cp.read(bodyOffs)?.text() ?? "";

          const result = await hostFns.http_request(ctx, url, method, headers, body);
          return cp.store(result);
        },

        // Read input data
        mosaic_read_input(cp: CallContext, keyOffs: bigint) {
          const key = cp.read(keyOffs)?.text() ?? "";
          const result = hostFns.read_input(ctx, key);
          return cp.store(result);
        },

        // Log message
        mosaic_log(cp: CallContext, msgOffs: bigint) {
          const message = cp.read(msgOffs)?.text() ?? "";
          hostFns.log(ctx, message);
        },

        // Write output
        mosaic_write_output(cp: CallContext, dataOffs: bigint) {
          const data = cp.read(dataOffs)?.text() ?? "";
          hostFns.write_output(ctx, data);
        },
      },
    };
  }

  /**
   * Parse a timeout string like "30s" or "5m" into milliseconds.
   */
  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)\s*(s|m|ms)?$/i);
    if (!match) return DEFAULT_TIMEOUT_MS;

    const value = parseInt(match[1], 10);
    const unit = (match[2] || "s").toLowerCase();

    if (unit === "ms") return value;
    if (unit === "m") return value * 60_000;
    return value * 1000; // seconds
  }

  /**
   * Validate that a manifest extracted from WASM has all required fields.
   * Throws if the manifest is invalid.
   */
  private validateManifest(manifest: ToolManifest): void {
    const required: (keyof ToolManifest)[] = [
      "manifestVersion",
      "id",
      "version",
      "displayName",
      "description",
      "runtime",
      "permissions",
      "resources",
      "tools",
    ];

    for (const field of required) {
      if (manifest[field] === undefined || manifest[field] === null) {
        throw new Error(`Manifest missing required field: "${field}"`);
      }
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.id)) {
      throw new Error(
        `Manifest id "${manifest.id}" must be kebab-case (e.g. "my-tool")`,
      );
    }

    if (!manifest.runtime?.type) {
      throw new Error('Manifest missing runtime.type (expected "wasm" or "docker")');
    }

    if (!manifest.tools || Object.keys(manifest.tools).length === 0) {
      throw new Error("Manifest must declare at least one tool function");
    }
  }
}
