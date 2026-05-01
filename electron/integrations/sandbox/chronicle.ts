/**
 * Chronicle — Append-Only Tool Activity Log
 *
 * Each tool gets its own Chronicle: a JSONL file where every action,
 * output, audit event, and lifecycle change is recorded.
 *
 * Key properties:
 * - Append-only: no update/delete API exists
 * - Per-tool: each tool has its own file, isolated from others
 * - Core-managed: tools write through host functions, Core does the I/O
 * - Auditable: full history for debugging and security reviews
 *
 * Storage: ~/.config/mosaic-companion/chronicles/<tool_id>/chronicle.jsonl
 *
 * See: docs/architecture/data-model.md
 */

import { join } from "path";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "fs";
import type {
  ChronicleEntry,
  ChronicleSource,
  ChronicleEntryType,
  ChronicleQuery,
} from "./types";

// =============================================================================
// Chronicle
// =============================================================================

export class Chronicle {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Write (append-only)
  // ---------------------------------------------------------------------------

  /**
   * Append an entry to a tool's chronicle.
   * This is the ONLY write operation — no update, no delete.
   */
  append(
    toolId: string,
    source: ChronicleSource,
    type: ChronicleEntryType,
    data: Record<string, unknown>,
  ): ChronicleEntry {
    const entry: ChronicleEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      source,
      type,
      data,
    };

    const dir = this.toolDir(toolId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const filePath = this.chroniclePath(toolId);
    appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");

    return entry;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Read all chronicle entries for a tool, with optional filtering.
   */
  read(toolId: string, query?: ChronicleQuery): ChronicleEntry[] {
    const filePath = this.chroniclePath(toolId);
    if (!existsSync(filePath)) return [];

    const raw = readFileSync(filePath, "utf-8");
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);

    let entries: ChronicleEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as ChronicleEntry);
      } catch {
        // Skip malformed lines — never crash on read
        console.warn(`[Chronicle] Skipping malformed line in ${toolId}`);
      }
    }

    // Apply filters
    if (query?.source) {
      entries = entries.filter((e) => e.source === query.source);
    }
    if (query?.type) {
      entries = entries.filter((e) => e.type === query.type);
    }
    if (query?.after) {
      entries = entries.filter((e) => e.timestamp > query.after!);
    }
    if (query?.before) {
      entries = entries.filter((e) => e.timestamp < query.before!);
    }

    // Apply limit (newest entries first if limited)
    const limit = query?.limit ?? 100;
    if (entries.length > limit) {
      entries = entries.slice(-limit);
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Convenience writers
  // ---------------------------------------------------------------------------

  /** Log a tool's own message (source: "tool") */
  logTool(toolId: string, message: string, extra?: Record<string, unknown>): ChronicleEntry {
    return this.append(toolId, "tool", "log", { message, ...extra });
  }

  /** Record a tool's structured output (source: "tool") */
  writeOutput(toolId: string, data: Record<string, unknown>): ChronicleEntry {
    return this.append(toolId, "tool", "output", data);
  }

  /** Record a gatekeeper audit decision (source: "gatekeeper") */
  logAudit(
    toolId: string,
    resource: string,
    action: "ALLOW" | "DENY",
    type: string,
    reason?: string,
  ): ChronicleEntry {
    return this.append(toolId, "gatekeeper", "audit", {
      resource,
      action,
      type,
      reason,
    });
  }

  /** Record a lifecycle event (source: "core") */
  logLifecycle(toolId: string, event: string, details?: Record<string, unknown>): ChronicleEntry {
    return this.append(toolId, "core", "lifecycle", { event, ...details });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toolDir(toolId: string): string {
    return join(this.baseDir, toolId);
  }

  private chroniclePath(toolId: string): string {
    return join(this.toolDir(toolId), "chronicle.jsonl");
  }

  /** Check if a tool has any chronicle entries */
  hasEntries(toolId: string): boolean {
    return existsSync(this.chroniclePath(toolId));
  }

  /** Get the file path for a tool's chronicle (for debugging) */
  getPath(toolId: string): string {
    return this.chroniclePath(toolId);
  }
}

// =============================================================================
// Singleton
// =============================================================================

/**
 * Lazily-initialized singleton. The `require("electron")` call only runs
 * when first accessed, so importing this file in a non-Electron context
 * (e.g. tests) is safe — as long as getChronicle() is not called directly.
 * Tests should use `new Chronicle(tmpDir)` instead.
 */
let _instance: Chronicle | null = null;

export function getChronicle(): Chronicle {
  if (!_instance) {
    // Dynamic require: electron is only available in the main process
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require("electron") as typeof import("electron");
    _instance = new Chronicle(join(app.getPath("userData"), "chronicles"));
  }
  return _instance;
}

/** Override the singleton — used in tests to inject a temp-dir instance. */
export function setChronicleInstance(c: Chronicle): void {
  _instance = c;
}
