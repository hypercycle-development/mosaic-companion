/**
 * Gatekeeper — Filtering Logic + WASM Host Functions
 *
 * Two things in one file:
 * 1. ManifestGatekeeperPolicy — enforces manifest permissions (domain, file, service)
 * 2. createHostFunctions() — builds the WASM host function set using the policy
 *
 * The GatekeeperPolicy is runtime-agnostic. If Docker support is added/desited,
 * the same policy class can be used by a proxy handler — zero rewrite of rules.
 */

import { resolve, normalize } from "path";
import type {
  GatekeeperPolicy,
  GatekeeperDecision,
  AuditEntry,
  ToolManifest,
} from "./types";
import { getChronicle } from "./chronicle";

// =============================================================================
// Manifest-Based Gatekeeper Policy
// =============================================================================

/**
 * Enforces permissions from a tool's manifest.
 * This class holds the LOGIC — which domains/files/services are allowed.
 * It doesn't know about WASM or Docker. It just makes decisions.
 */
export class ManifestGatekeeperPolicy implements GatekeeperPolicy {
  /** Maps toolId → manifest for permission lookups */
  private manifests: Map<string, ToolManifest> = new Map();

  /** Audit log (in-memory for now, Chronicle integration later) */
  private auditLog: AuditEntry[] = [];

  /** Register a tool's manifest for policy enforcement */
  registerTool(manifest: ToolManifest): void {
    this.manifests.set(manifest.id, manifest);
    console.log(
      `[Gatekeeper] Registered policy for: ${manifest.id} ` +
        `(domains: ${manifest.permissions.allowed_domains.join(", ") || "none"})`,
    );
  }

  /** Unregister a tool's manifest */
  unregisterTool(toolId: string): void {
    this.manifests.delete(toolId);
    console.log(`[Gatekeeper] Unregistered policy for: ${toolId}`);
  }

  // ---------------------------------------------------------------------------
  // GatekeeperPolicy interface
  // ---------------------------------------------------------------------------

  checkDomain(toolId: string, domain: string): GatekeeperDecision {
    const manifest = this.manifests.get(toolId);
    if (!manifest) {
      return { allowed: false, reason: `Tool "${toolId}" not registered` };
    }

    if (!manifest.permissions.internet) {
      return { allowed: false, reason: "Tool has no internet permission" };
    }

    // Normalize domain to lowercase
    const normalizedDomain = domain.toLowerCase().trim();

    // Check exact match in allowed_domains
    const isAllowed = manifest.permissions.allowed_domains.some(
      (d) => d.toLowerCase().trim() === normalizedDomain,
    );

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Domain "${domain}" not in allowlist [${manifest.permissions.allowed_domains.join(", ")}]`,
      };
    }

    return { allowed: true };
  }

  checkFilePath(toolId: string, filePath: string): GatekeeperDecision {
    const manifest = this.manifests.get(toolId);
    if (!manifest) {
      return { allowed: false, reason: `Tool "${toolId}" not registered` };
    }

    const allowedPaths = manifest.permissions.files;
    if (!allowedPaths || allowedPaths.length === 0) {
      return { allowed: false, reason: "Tool has no file permissions" };
    }

    // Resolve and normalize the requested path
    const resolvedPath = normalize(resolve(filePath));

    // Check path traversal — the resolved path must start with an allowed prefix
    const isAllowed = allowedPaths.some((allowed) => {
      const resolvedAllowed = normalize(resolve(allowed));
      return resolvedPath.startsWith(resolvedAllowed);
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Path "${filePath}" not in allowed paths`,
      };
    }

    return { allowed: true };
  }

  checkService(toolId: string, service: string): GatekeeperDecision {
    const manifest = this.manifests.get(toolId);
    if (!manifest) {
      return { allowed: false, reason: `Tool "${toolId}" not registered` };
    }

    const allowedServices = manifest.permissions.services;
    if (!allowedServices || allowedServices.length === 0) {
      return { allowed: false, reason: "Tool has no service permissions" };
    }

    const isAllowed = allowedServices.includes(service.toLowerCase());

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Service "${service}" not allowed`,
      };
    }

    return { allowed: true };
  }

  logDecision(entry: AuditEntry): void {
    this.auditLog.push(entry);
    const icon = entry.action === "ALLOW" ? "✅" : "🚫";
    console.log(
      `[Gatekeeper] ${icon} ${entry.action} ${entry.type}:${entry.resource} for tool "${entry.toolId}"` +
        (entry.reason ? ` — ${entry.reason}` : ""),
    );

    // Persist to Chronicle
    getChronicle().logAudit(
      entry.toolId,
      entry.resource,
      entry.action,
      entry.type,
      entry.reason,
    );
  }

  /** Get audit log entries for a tool (for Chronicle/UI) */
  getAuditLog(toolId?: string): AuditEntry[] {
    if (!toolId) return [...this.auditLog];
    return this.auditLog.filter((e) => e.toolId === toolId);
  }

  /** Clear audit log (for testing) */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

// =============================================================================
// WASM Host Functions Builder
// =============================================================================

/**
 * Host function context passed to each host function call.
 * Extism provides this — we use it to identify which tool is calling.
 */
export interface HostFunctionContext {
  toolId: string;
}

/**
 * The set of host functions injected into a WASM module.
 * Each function is the tool's ONLY way to do the corresponding action.
 */
export interface WasmHostFunctions {
  /**
   * Make an HTTP request (goes through Gatekeeper).
   * Tool calls this → Gatekeeper checks domain → request is made or denied.
   */
  http_request: (
    ctx: HostFunctionContext,
    url: string,
    method: string,
    headers: string,
    body: string,
  ) => Promise<string>;

  /**
   * Read a pre-approved input data (from /inputs).
   * Tool calls this → data is returned if key exists.
   */
  read_input: (ctx: HostFunctionContext, key: string) => string;

  /**
   * Log a message (append-only, goes to Chronicle).
   */
  log: (ctx: HostFunctionContext, message: string) => void;

  /**
   * Write structured output (goes to Chronicle).
   */
  write_output: (ctx: HostFunctionContext, data: string) => void;
}

/**
 * Create the host functions for a WASM tool module.
 *
 * These are the ONLY things a WASM tool can do beyond pure computation.
 * If a function isn't here, the tool physically cannot do it.
 *
 * The functions use the GatekeeperPolicy for all access decisions,
 * so the same rules apply regardless of runtime.
 */
export function createHostFunctions(
  manifest: ToolManifest,
  policy: GatekeeperPolicy,
  inputData: Map<string, string>,
): WasmHostFunctions {
  const toolId = manifest.id;

  return {
    // ─── NETWORK: the tool's ONLY way to reach the internet ───
    async http_request(
      _ctx: HostFunctionContext,
      url: string,
      method: string,
      headers: string,
      body: string,
    ): Promise<string> {
      // Parse domain from URL
      let domain: string;
      try {
        const parsed = new URL(url);
        domain = parsed.hostname;
      } catch {
        const entry: AuditEntry = {
          timestamp: new Date().toISOString(),
          toolId,
          resource: url,
          action: "DENY",
          reason: "Invalid URL",
          type: "domain",
        };
        policy.logDecision(entry);
        throw new Error(`Invalid URL: "${url}"`);
      }

      // Check domain allowlist
      const decision = policy.checkDomain(toolId, domain);
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        toolId,
        resource: domain,
        action: decision.allowed ? "ALLOW" : "DENY",
        reason: decision.reason,
        type: "domain",
      };
      policy.logDecision(entry);

      if (!decision.allowed) {
        throw new Error(`Domain denied: ${decision.reason}`);
      }

      // Make the actual request (YOUR code, on the host)
      try {
        const parsedHeaders = headers ? JSON.parse(headers) : {};
        const response = await fetch(url, {
          method: method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...parsedHeaders,
          },
          body: method !== "GET" && body ? body : undefined,
          signal: AbortSignal.timeout(30_000),
        });

        const responseBody = await response.text();
        return JSON.stringify({
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        });
      } catch (err) {
        throw new Error(
          `HTTP request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    // ─── DATA: the tool's ONLY way to read approved input ───
    read_input(_ctx: HostFunctionContext, key: string): string {
      const data = inputData.get(key);
      if (data === undefined) {
        throw new Error(`Input key "${key}" not found`);
      }
      return data;
    },

    // ─── LOGGING: append-only output → Chronicle ───
    log(_ctx: HostFunctionContext, message: string): void {
      console.log(`[Tool:${toolId}] ${message}`);
      getChronicle().logTool(toolId, message);
    },

    write_output(_ctx: HostFunctionContext, data: string): void {
      console.log(`[Tool:${toolId}:output] ${data}`);
      try {
        const parsed = JSON.parse(data);
        getChronicle().writeOutput(toolId, parsed);
      } catch {
        getChronicle().writeOutput(toolId, { raw: data });
      }
    },
  };
}

// =============================================================================
// Singleton
// =============================================================================

export const gatekeeperPolicy = new ManifestGatekeeperPolicy();
