// ─────────────────────────────────────────────────────────────────────────────
// QMD memory backend — wraps the `qmd` CLI subprocess
// Mirrors src/memory/qmd-manager.ts from OpenMosaic
//
// QMD is an external tool (https://qmd.dev or similar) that provides:
//   - Local document indexing with BM25 + vector search
//   - Collection management (directories/file patterns to index)
//   - Automatic embedding via local models
//
// Each agent gets isolated XDG directories so indexes don't collide.
// ML models are shared across agents via a symlink to avoid re-downloading.
//
// CLI protocol:
//   qmd collection add <path> --name <name> --mask <pattern>
//   qmd collection list --json
//   qmd collection remove <name>
//   qmd update                         (indexes new/changed files)
//   qmd embed                          (generates embeddings)
//   qmd {search|vsearch|query} <query> --json -n <limit> -c <collection> ...
//
// Dependencies: "better-sqlite3" (read-only access to qmd's own index.sqlite)
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import BetterSqlite3 from "better-sqlite3";
import type { Database as BetterDatabase } from "better-sqlite3";

import type {
  QmdMemoryConfig,
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  SyncParams,
  ReadFileParams,
  SearchOpts,
} from "./types.js";

// ── Internal types ────────────────────────────────────────────────────────────

type ResolvedQmdConfig = Required<QmdMemoryConfig> & {
  update: Required<NonNullable<QmdMemoryConfig["update"]>>;
  limits: Required<NonNullable<QmdMemoryConfig["limits"]>>;
  sessions: Required<NonNullable<QmdMemoryConfig["sessions"]>>;
};

type CollectionDef = { path: string; name: string; pattern: string };

// JSON shape returned by `qmd {search|vsearch|query} --json`
type QmdQueryResult = {
  docid?: string; // document hash, sometimes prefixed with "#"
  score?: number;
  snippet?: string; // "@@ -LINE,COUNT\n...content..."
  file?: string;
  body?: string;
};

const MAX_STDOUT_BYTES = 200_000;

// ── Manager ───────────────────────────────────────────────────────────────────

export class QmdMemoryManager implements MemorySearchManager {
  private readonly cfg: ResolvedQmdConfig;
  private readonly collections: CollectionDef[];
  private readonly xdgConfigHome: string;
  private readonly xdgCacheHome: string;
  private readonly indexPath: string; // qmd's own SQLite index

  private db: BetterDatabase | null = null;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private pendingUpdate: Promise<void> | null = null;
  private lastUpdateAt: number | null = null;
  private closed = false;

  private constructor(cfg: ResolvedQmdConfig, collections: CollectionDef[]) {
    this.cfg = cfg;
    this.collections = collections;

    const agentQmdDir = path.join(cfg.stateDir, "agents", cfg.agentId, "qmd");
    this.xdgConfigHome = path.join(agentQmdDir, "xdg-config");
    this.xdgCacheHome = path.join(agentQmdDir, "xdg-cache");
    this.indexPath = path.join(this.xdgCacheHome, "qmd", "index.sqlite");
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  /**
   * Returns null if the `qmd` binary is unavailable, so callers can fall back
   * to the builtin SQLite backend without throwing.
   */
  static async create(cfg: QmdMemoryConfig): Promise<QmdMemoryManager | null> {
    const resolved = resolveQmdConfig(cfg);

    const collections: CollectionDef[] = [
      // Default: index the whole workspace for *.md files
      { path: cfg.workspaceDir, name: "memory-root", pattern: "**/*.md" },
      ...resolved.paths.map((p, i) => ({
        path: path.isAbsolute(p.path)
          ? p.path
          : path.join(cfg.workspaceDir, p.path),
        name: p.name ?? `custom-${i}`,
        pattern: p.pattern ?? "**/*.md",
      })),
    ];

    const agentQmdDir = path.join(
      resolved.stateDir,
      "agents",
      resolved.agentId,
      "qmd",
    );
    const xdgConfigHome = path.join(agentQmdDir, "xdg-config");
    const xdgCacheHome = path.join(agentQmdDir, "xdg-cache");

    // Probe that the qmd binary exists before committing
    try {
      await runQmdCommand(resolved.command, ["--version"], {
        xdgConfigHome,
        xdgCacheHome,
        workspaceDir: cfg.workspaceDir,
        timeoutMs: 5_000,
      });
    } catch {
      return null; // qmd not installed
    }

    const manager = new QmdMemoryManager(resolved, collections);
    await manager.initialize();
    return manager;
  }

  private async initialize(): Promise<void> {
    await fs.mkdir(this.xdgConfigHome, { recursive: true });
    await fs.mkdir(path.join(this.xdgCacheHome, "qmd"), { recursive: true });

    // Share ML model downloads across agents (download once → reuse)
    await symlinkSharedModels(this.xdgCacheHome);

    await this.ensureCollections();

    if (this.cfg.update.onBoot) {
      // Non-blocking — search will wait up to 500ms for this to finish
      this.pendingUpdate = this.runUpdate("boot", true).finally(() => {
        this.pendingUpdate = null;
      });
    }

    if (this.cfg.update.intervalMs > 0) {
      this.updateTimer = setInterval(() => {
        if (!this.pendingUpdate) {
          this.pendingUpdate = this.runUpdate("interval", false).finally(() => {
            this.pendingUpdate = null;
          });
        }
      }, this.cfg.update.intervalMs);
      this.updateTimer.unref?.();
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(
    query: string,
    opts: SearchOpts = {},
  ): Promise<MemorySearchResult[]> {
    // Give the boot update a brief head-start
    if (this.pendingUpdate) {
      await Promise.race([this.pendingUpdate, sleep(500)]);
    }

    const maxResults = opts.maxResults ?? this.cfg.limits.maxResults;
    const args = buildSearchArgs(
      this.cfg.searchMode,
      query,
      maxResults,
      this.collections.map((c) => c.name),
    );

    const { stdout } = await runQmdCommand(this.cfg.command, args, {
      xdgConfigHome: this.xdgConfigHome,
      xdgCacheHome: this.xdgCacheHome,
      workspaceDir: this.cfg.workspaceDir,
      timeoutMs: this.cfg.limits.timeoutMs,
    });

    const raw = parseQmdJson(stdout);
    return raw
      .slice(0, maxResults)
      .map((r) => this.resolveResult(r))
      .filter((r): r is MemorySearchResult => r !== null);
  }

  private resolveResult(r: QmdQueryResult): MemorySearchResult | null {
    const score = r.score ?? 0;
    const { startLine, endLine } = extractLineNumbers(r.snippet ?? "");
    const snippetText = extractSnippetText(r.snippet ?? r.body ?? "");

    // Resolve document path: try r.file first, then look up docid in qmd's SQLite
    let docPath = r.file ?? "";
    if (!docPath && r.docid) {
      docPath = this.lookupDocPath(r.docid) ?? "";
    }
    if (!docPath) return null;

    const relPath = path.isAbsolute(docPath)
      ? path.relative(this.cfg.workspaceDir, docPath)
      : docPath;

    return {
      path: relPath,
      startLine,
      endLine,
      score,
      snippet: snippetText.slice(0, this.cfg.limits.maxSnippetChars),
      source: "memory",
    };
  }

  // Read-only access to qmd's own index.sqlite to resolve document paths from hashes
  private lookupDocPath(docid: string): string | null {
    if (!this.db) {
      try {
        this.db = new BetterSqlite3(this.indexPath, { readonly: true });
        this.db.pragma("busy_timeout = 1"); // non-blocking — respect qmd's writer lock
      } catch {
        return null;
      }
    }
    try {
      const clean = docid.replace(/^#/, "");
      const row = this.db
        .prepare(
          "SELECT path FROM documents WHERE hash = ? AND active = 1 LIMIT 1",
        )
        .get(clean) as { path?: string } | undefined;
      return row?.path ?? null;
    } catch {
      return null;
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  async sync(params: SyncParams = {}): Promise<void> {
    this.pendingUpdate = this.runUpdate(
      params.reason ?? "manual",
      params.force ?? true,
    );
    await this.pendingUpdate;
    this.pendingUpdate = null;
  }

  private async runUpdate(reason: string, embed: boolean): Promise<void> {
    try {
      await runQmdCommand(this.cfg.command, ["update"], {
        xdgConfigHome: this.xdgConfigHome,
        xdgCacheHome: this.xdgCacheHome,
        workspaceDir: this.cfg.workspaceDir,
        timeoutMs: this.cfg.update.updateTimeoutMs,
      });

      if (embed) {
        await runQmdCommand(this.cfg.command, ["embed"], {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: this.cfg.update.embedTimeoutMs,
        });
      }

      this.lastUpdateAt = Date.now();
    } catch (err) {
      console.warn(`[QMD] update failed (${reason}):`, err);
    }
  }

  // ── Collection management ──────────────────────────────────────────────────

  private async ensureCollections(): Promise<void> {
    let existing: string[] = [];
    try {
      const { stdout } = await runQmdCommand(
        this.cfg.command,
        ["collection", "list", "--json"],
        {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: 10_000,
        },
      );
      const parsed = JSON.parse(stdout || "[]") as Array<{ name?: string }>;
      existing = parsed.map((c) => c.name ?? "").filter(Boolean);
    } catch {
      /* first run */
    }

    const desired = new Set(this.collections.map((c) => c.name));

    // Remove stale collections
    for (const name of existing) {
      if (!desired.has(name)) {
        await runQmdCommand(this.cfg.command, ["collection", "remove", name], {
          xdgConfigHome: this.xdgConfigHome,
          xdgCacheHome: this.xdgCacheHome,
          workspaceDir: this.cfg.workspaceDir,
          timeoutMs: 10_000,
        }).catch(() => {
          /* ignore */
        });
      }
    }

    // Add missing collections
    for (const col of this.collections) {
      if (!existing.includes(col.name)) {
        await runQmdCommand(
          this.cfg.command,
          [
            "collection",
            "add",
            col.path,
            "--name",
            col.name,
            "--mask",
            col.pattern,
          ],
          {
            xdgConfigHome: this.xdgConfigHome,
            xdgCacheHome: this.xdgCacheHome,
            workspaceDir: this.cfg.workspaceDir,
            timeoutMs: 10_000,
          },
        ).catch(() => {
          /* ignore if already exists */
        });
      }
    }
  }

  // ── readFile ───────────────────────────────────────────────────────────────

  async readFile(
    params: ReadFileParams,
  ): Promise<{ text: string; path: string }> {
    const rel = params.relPath
      .trim()
      .replace(/^[./]+/, "")
      .replace(/\\/g, "/");
    const abs = path.isAbsolute(rel)
      ? rel
      : path.join(this.cfg.workspaceDir, rel);
    const content = await fs.readFile(abs, "utf-8");

    if (params.from === undefined) return { text: content, path: rel };
    const lines = content.split("\n");
    const start = Math.max(0, params.from - 1);
    const end = params.lines ? start + params.lines : lines.length;
    return { text: lines.slice(start, end).join("\n"), path: rel };
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  status(): MemoryProviderStatus {
    let files = 0;
    try {
      if (!this.db) {
        this.db = new BetterSqlite3(this.indexPath, { readonly: true });
        this.db.pragma("busy_timeout = 1");
      }
      const row = this.db
        .prepare("SELECT COUNT(*) AS n FROM documents WHERE active = 1")
        .get() as { n: number };
      files = row.n;
    } catch {
      /* index not yet created */
    }

    return {
      backend: "qmd",
      provider: "qmd",
      model: "qmd",
      files,
      chunks: files,
      dirty: false,
      workspaceDir: this.cfg.workspaceDir,
      dbPath: this.indexPath,
      sources: ["memory"],
      vector: { enabled: true, available: true },
    };
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.updateTimer) clearInterval(this.updateTimer);
    await this.pendingUpdate?.catch(() => {
      /* ignore */
    });
    this.db?.close();
  }
}

// ── Subprocess helpers ────────────────────────────────────────────────────────

type RunOpts = {
  xdgConfigHome: string;
  xdgCacheHome: string;
  workspaceDir: string;
  timeoutMs: number;
};

function runQmdCommand(
  command: string,
  args: string[],
  opts: RunOpts,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      XDG_CONFIG_HOME: opts.xdgConfigHome,
      XDG_CACHE_HOME: opts.xdgCacheHome,
      NO_COLOR: "1",
    };

    const proc = spawn(command, args, { env, cwd: opts.workspaceDir });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;

    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_STDOUT_BYTES) stdoutChunks.push(chunk);
    });
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`qmd timed out: ${command} ${args.join(" ")}`));
    }, opts.timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`qmd exited ${code}: ${stderr.slice(0, 500)}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function buildSearchArgs(
  mode: "query" | "search" | "vsearch",
  query: string,
  limit: number,
  collections: string[],
): string[] {
  const args = [mode, query, "--json", "-n", String(limit)];
  for (const c of collections) args.push("-c", c);
  return args;
}

function parseQmdJson(stdout: string): QmdQueryResult[] {
  try {
    const parsed = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Extract 1-indexed start/end line from QMD snippet header: "@@ -LINE,COUNT" */
function extractLineNumbers(snippet: string): {
  startLine: number;
  endLine: number;
} {
  const m = snippet.match(/@@ -(\d+),(\d+)/);
  if (!m) return { startLine: 1, endLine: 1 };
  const start = parseInt(m[1], 10);
  const count = parseInt(m[2], 10);
  return { startLine: start, endLine: start + count - 1 };
}

/** Strip "@@ -LINE,COUNT\n" header from snippet, leaving only the text */
function extractSnippetText(snippet: string): string {
  return snippet.replace(/^@@[^\n]*\n/, "").trim();
}

// Share ML models across agents: symlink ~/.cache/qmd/models → per-agent xdg-cache/qmd/models
async function symlinkSharedModels(xdgCacheHome: string): Promise<void> {
  const sharedModels = path.join(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    ".cache",
    "qmd",
    "models",
  );
  const agentModels = path.join(xdgCacheHome, "qmd", "models");

  try {
    await fs.access(agentModels);
    return; // already exists
  } catch {
    /* create symlink */
  }

  try {
    await fs.mkdir(sharedModels, { recursive: true });
    await fs.symlink(sharedModels, agentModels, "dir");
  } catch {
    // Symlink failed (Windows EPERM, etc.) — models will be downloaded per-agent
  }
}

function resolveQmdConfig(cfg: QmdMemoryConfig): ResolvedQmdConfig {
  return {
    command: cfg.command ?? "qmd",
    searchMode: cfg.searchMode ?? "search",
    paths: cfg.paths ?? [],
    sessions: { enabled: false, retentionDays: 30, ...cfg.sessions },
    update: {
      intervalMs: 5 * 60_000,
      onBoot: true,
      updateTimeoutMs: 120_000,
      embedTimeoutMs: 120_000,
      ...cfg.update,
    },
    limits: {
      maxResults: 6,
      maxSnippetChars: 700,
      timeoutMs: 4_000,
      ...cfg.limits,
    },
    workspaceDir: cfg.workspaceDir,
    agentId: cfg.agentId,
    stateDir: cfg.stateDir,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
