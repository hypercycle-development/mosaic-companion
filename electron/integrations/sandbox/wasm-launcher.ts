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

  async launch(manifest: ToolManifest): Promise<RunningTool> {
    console.log(`[WasmLauncher] Loading tool: ${manifest.id}`);

    if (this.loaded.has(manifest.id)) {
      throw new Error(`Tool "${manifest.id}" is already loaded`);
    }

    // Register manifest with gatekeeper for policy enforcement
    gatekeeperPolicy.registerTool(manifest);

    // Prepare input data (empty for now — will be populated from Vault/pre-materialization)
    const inputData = new Map<string, string>();

    // Create host functions gated by the gatekeeper
    const hostFns = createHostFunctions(manifest, gatekeeperPolicy, inputData);

    // Load the WASM module
    const wasmSource = this.resolveWasmSource(manifest);
    const timeoutMs = this.parseTimeout(manifest.resources.timeout);

    // Build Extism host functions in the format Extism expects
    const extismFunctions = this.buildExtismFunctions(manifest.id, hostFns);

    const plugin = await createPlugin(wasmSource, {
      useWasi: true,
      functions: extismFunctions,
    });

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
   * Resolve the WASM source from the manifest.
   * Returns the Uint8Array of the WASM binary.
   */
  private resolveWasmSource(manifest: ToolManifest): Uint8Array {
    const wasmPath = manifest.runtime.entry;

    // If it's a URL, let Extism handle it
    // For now, we only support local file paths
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
}
