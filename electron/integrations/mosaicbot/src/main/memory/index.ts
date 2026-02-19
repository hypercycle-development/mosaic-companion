// ─────────────────────────────────────────────────────────────────────────────
// Memory manager factory + FallbackMemoryManager facade
// Mirrors src/memory/search-manager.ts from OpenClaw
//
// Usage:
//   // Builtin SQLite (always works):
//   const mem = await getMemoryManager({ backend: "builtin", config: { ... } });
//
//   // QMD with automatic fallback to SQLite:
//   const mem = await getMemoryManager({
//     backend: "qmd",
//     config: { ... },
//     fallback: { ... },   // optional builtin config to fall back to
//   });
//
//   const results = await mem.search("python asyncio");
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  BuiltinMemoryConfig,
  QmdMemoryConfig,
  SyncParams,
  ReadFileParams,
  SearchOpts,
} from "./types.js";
import { SqliteMemoryManager } from "./sqlite-backend.js";
import { QmdMemoryManager } from "./qmd-backend.js";

export type MemoryBackendConfig =
  | { backend: "builtin"; config: BuiltinMemoryConfig }
  | { backend: "qmd"; config: QmdMemoryConfig; fallback?: BuiltinMemoryConfig };

// Simple cache — same config object → same manager instance
const cache = new Map<string, MemorySearchManager>();

/**
 * Get or create a memory manager for the given config.
 * Cached by config identity (JSON-serialised key).
 */
export async function getMemoryManager(
  cfg: MemoryBackendConfig,
): Promise<MemorySearchManager> {
  const key = JSON.stringify(cfg);
  const existing = cache.get(key);
  if (existing) return existing;

  let manager: MemorySearchManager;

  if (cfg.backend === "builtin") {
    manager = await SqliteMemoryManager.create(cfg.config);
  } else {
    const qmd = await QmdMemoryManager.create(cfg.config);
    if (qmd) {
      const fallbackFactory = cfg.fallback
        ? (): Promise<MemorySearchManager> => SqliteMemoryManager.create(cfg.fallback!)
        : undefined;
      manager = fallbackFactory
        ? new FallbackMemoryManager(qmd, fallbackFactory, () => cache.delete(key))
        : qmd;
    } else if (cfg.fallback) {
      console.warn("[Memory] qmd unavailable — using builtin SQLite backend");
      manager = await SqliteMemoryManager.create(cfg.fallback);
    } else {
      throw new Error("qmd unavailable and no fallback configured");
    }
  }

  cache.set(key, manager);
  return manager;
}

/** Remove a manager from the cache (e.g. after config change). Does not close it. */
export function evictMemoryManager(cfg: MemoryBackendConfig): void {
  cache.delete(JSON.stringify(cfg));
}

// ─────────────────────────────────────────────────────────────────────────────
// FallbackMemoryManager
//
// Wraps a primary manager (QMD) and transparently switches to a builtin
// SQLite manager on first failure, then stays on the fallback for the session.
// Mirrors FallbackMemoryManager in src/memory/search-manager.ts.
// ─────────────────────────────────────────────────────────────────────────────

class FallbackMemoryManager implements MemorySearchManager {
  private fallback: MemorySearchManager | null = null;
  private primaryFailed = false;
  private lastError: string | undefined;

  constructor(
    private readonly primary: MemorySearchManager,
    private readonly fallbackFactory: () => Promise<MemorySearchManager>,
    private readonly onEvict?: () => void,
  ) {}

  async search(query: string, opts?: SearchOpts): Promise<MemorySearchResult[]> {
    return this.via((m) => m.search(query, opts));
  }

  async readFile(params: ReadFileParams): Promise<{ text: string; path: string }> {
    return this.via((m) => m.readFile(params));
  }

  async sync(params?: SyncParams): Promise<void> {
    return this.via((m) => m.sync(params));
  }

  status(): MemoryProviderStatus {
    const base = (this.primaryFailed ? this.fallback?.status() : null) ?? this.primary.status();
    return this.primaryFailed
      ? { ...base, fallback: { from: "qmd", reason: this.lastError ?? "unknown" } }
      : base;
  }

  async close(): Promise<void> {
    await this.primary.close().catch(() => { /* ignore */ });
    await this.fallback?.close().catch(() => { /* ignore */ });
  }

  private async via<T>(fn: (m: MemorySearchManager) => Promise<T>): Promise<T> {
    if (!this.primaryFailed) {
      try {
        return await fn(this.primary);
      } catch (err) {
        this.primaryFailed = true;
        this.lastError = String(err);
        console.warn(`[Memory] qmd failed — switching to builtin: ${this.lastError}`);
        this.onEvict?.();
        this.primary.close().catch(() => { /* ignore */ });
      }
    }
    if (!this.fallback) this.fallback = await this.fallbackFactory();
    return fn(this.fallback);
  }
}

// Re-exports for convenience
export { SqliteMemoryManager } from "./sqlite-backend.js";
export { QmdMemoryManager } from "./qmd-backend.js";
export type {
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  BuiltinMemoryConfig,
  QmdMemoryConfig,
} from "./types.js";
