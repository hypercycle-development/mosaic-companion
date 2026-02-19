// ─────────────────────────────────────────────────────────────────────────────
// SQLite-backed memory index manager (builtin backend)
// Mirrors src/memory/manager.ts + manager-search.ts + manager-embedding-ops.ts
// + sync-index.ts + sync-memory-files.ts from OpenClaw
//
// Dependencies (add to package.json):
//   "better-sqlite3": "^9.0.0"
//   "@types/better-sqlite3": "^7.0.0"
//   "sqlite-vec": "^0.1.7"   (optional — enables vector search)
//   "chokidar": "^3.5.3"     (file watching)
//
// Electron note: better-sqlite3 and sqlite-vec are native modules.
// Rebuild for your Electron version: npx electron-rebuild
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import fs from "node:fs/promises";
import type { Database as BetterDatabase } from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";

import type {
  BuiltinMemoryConfig,
  EmbeddingProvider,
  MemoryChunk,
  MemorySearchManager,
  MemorySearchResult,
  MemoryProviderStatus,
  MemorySource,
  SyncParams,
  ReadFileParams,
  SearchOpts,
} from "./types.js";
import {
  CREATE_TABLES_SQL,
  CREATE_FTS_SQL,
  SET_SCHEMA_VERSION_SQL,
  createVecTableSQL,
} from "./schema.js";
import { chunkText, sha256 } from "./chunker.js";
import {
  buildFtsQuery,
  mergeResults,
  applyTemporalDecay,
  applyMMR,
  type VectorRow,
  type KeywordRow,
} from "./scoring.js";
import { createEmbeddingProvider } from "./embedding.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const SNIPPET_MAX_CHARS = 700;
const EMBED_BATCH_MAX_BYTES = 8_000 * 4; // ~8K tokens × 4 bytes
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

// ── Manager ───────────────────────────────────────────────────────────────────

export class SqliteMemoryManager implements MemorySearchManager {
  private readonly db: BetterDatabase;
  private readonly cfg: ResolvedConfig;
  private readonly provider: EmbeddingProvider;
  private vecAvailable = false;
  private ftsAvailable = false;
  private dirty = true;
  private closed = false;
  private watcher: FSWatcher | null = null;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  private syncPromise: Promise<void> | null = null;

  private constructor(db: BetterDatabase, cfg: ResolvedConfig, provider: EmbeddingProvider) {
    this.db = db;
    this.cfg = cfg;
    this.provider = provider;
  }

  // ── Factory ─────────────────────────────────────────────────────────────────

  static async create(cfg: BuiltinMemoryConfig): Promise<SqliteMemoryManager> {
    await fs.mkdir(path.dirname(cfg.dbPath), { recursive: true });

    const db = new BetterSqlite3(cfg.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");

    // Try loading sqlite-vec extension for vector search
    let vecLoaded = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require("sqlite-vec") as { load(db: unknown): void };
      sqliteVec.load(db);
      vecLoaded = true;
    } catch {
      // Extension unavailable — fall back to in-memory cosine or FTS-only
    }

    // Apply base schema
    db.exec(CREATE_TABLES_SQL);

    // FTS5 virtual table
    let ftsAvailable = false;
    try {
      db.exec(CREATE_FTS_SQL);
      ftsAvailable = true;
    } catch {
      // FTS5 not available in this SQLite build
    }

    const provider = await createEmbeddingProvider(cfg.embedding);

    // Vector table requires extension + known dimensions
    let vecAvailable = false;
    if (vecLoaded && provider.dimensions > 0) {
      try {
        db.exec(createVecTableSQL(provider.dimensions));
        vecAvailable = true;
      } catch {
        // Dimension mismatch with existing table — disable vector search
      }
    }

    db.exec(SET_SCHEMA_VERSION_SQL);

    const resolved = resolveConfig(cfg);
    const mgr = new SqliteMemoryManager(db, resolved, provider);
    mgr.vecAvailable = vecAvailable;
    mgr.ftsAvailable = ftsAvailable;
    mgr.startWatcher();
    return mgr;
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(query: string, opts: SearchOpts = {}): Promise<MemorySearchResult[]> {
    if (this.dirty) await this.sync({ reason: "search" });

    const maxResults = opts.maxResults ?? this.cfg.search.maxResults;
    const minScore = opts.minScore ?? this.cfg.search.minScore;
    const { vectorWeight, textWeight } = this.cfg.search;

    // Run both searches in parallel
    const [vectorRows, keywordRows] = await Promise.all([
      this.vectorSearch(query, maxResults * 2),
      this.keywordSearch(query, maxResults * 2),
    ]);

    let merged = mergeResults(vectorRows, keywordRows, {
      vector: vectorWeight,
      text: textWeight,
    });

    if (this.cfg.search.temporalDecay.enabled) {
      merged = applyTemporalDecay(merged, this.cfg.search.temporalDecay.halfLifeDays);
    }

    if (this.cfg.search.mmr.enabled) {
      merged = applyMMR(merged, this.cfg.search.mmr.lambda, maxResults);
    } else {
      merged = merged.slice(0, maxResults);
    }

    return merged
      .filter((r) => r.finalScore >= minScore)
      .map((r) => ({
        path: r.path,
        startLine: r.startLine,
        endLine: r.endLine,
        score: r.finalScore,
        snippet: r.text.slice(0, SNIPPET_MAX_CHARS),
        source: r.source as MemorySource,
      }));
  }

  // Vector search using sqlite-vec (cosine distance), with JS fallback
  private async vectorSearch(query: string, limit: number): Promise<VectorRow[]> {
    if (!this.vecAvailable || this.provider.dimensions === 0) return [];

    let queryVecs: number[][];
    try {
      queryVecs = await this.embedWithRetry([query]);
    } catch {
      return [];
    }
    const queryVec = queryVecs[0];
    if (!queryVec?.length) return [];

    type Row = {
      id: string; path: string; source: string;
      start_line: number; end_line: number; text: string; dist: number;
    };

    try {
      const rows = this.db.prepare(`
        SELECT c.id, c.path, c.source, c.start_line, c.end_line, c.text,
               vec_distance_cosine(v.embedding, ?) AS dist
          FROM chunks_vec v
          JOIN chunks c ON c.id = v.id
         WHERE c.model = ?
         ORDER BY dist ASC
         LIMIT ?
      `).all(JSON.stringify(queryVec), this.provider.model, limit) as Row[];

      return rows.map((r) => ({
        id: r.id, path: r.path, source: r.source,
        startLine: r.start_line, endLine: r.end_line, text: r.text,
        score: Math.max(0, 1 - r.dist),
      }));
    } catch {
      // sqlite-vec query failed — fall back to in-memory cosine
      return this.vectorSearchFallback(queryVec, limit);
    }
  }

  // In-memory cosine similarity fallback (slower but always works)
  private vectorSearchFallback(queryVec: number[], limit: number): VectorRow[] {
    type Row = {
      id: string; path: string; source: string;
      start_line: number; end_line: number; text: string; embedding: string;
    };

    const rows = this.db.prepare(
      "SELECT id, path, source, start_line, end_line, text, embedding FROM chunks WHERE model = ?",
    ).all(this.provider.model) as Row[];

    return rows
      .map((r) => {
        let emb: number[];
        try { emb = JSON.parse(r.embedding); } catch { return null; }
        const score = cosineSimilarity(queryVec, emb);
        return {
          id: r.id, path: r.path, source: r.source,
          startLine: r.start_line, endLine: r.end_line, text: r.text, score,
        };
      })
      .filter((r): r is VectorRow => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // BM25 full-text search via FTS5
  private keywordSearch(query: string, limit: number): KeywordRow[] {
    if (!this.ftsAvailable) return [];
    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    type Row = {
      id: string; path: string; source: string;
      start_line: number; end_line: number; text: string; rank: number;
    };

    try {
      const rows = this.db.prepare(`
        SELECT id, path, source, start_line, end_line, text, bm25(chunks_fts) AS rank
          FROM chunks_fts
         WHERE chunks_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?
      `).all(ftsQuery, limit) as Row[];

      return rows.map((r) => ({
        id: r.id, path: r.path, source: r.source,
        startLine: r.start_line, endLine: r.end_line, text: r.text,
        score: 0, rank: r.rank,
      }));
    } catch {
      return [];
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  async sync(params: SyncParams = {}): Promise<void> {
    if (!this.dirty && !params.force) return;

    // Deduplicate concurrent sync calls
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = this.doSync(params).finally(() => {
      this.syncPromise = null;
    });
    return this.syncPromise;
  }

  private async doSync(params: SyncParams): Promise<void> {
    this.dirty = false;
    const files = await this.listMemoryFiles();
    const activePaths = new Set(files.map((f) => f.relPath));

    let completed = 0;
    // Index files concurrently (up to 4 at a time)
    const batches = chunk(files, 4);
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (f) => {
          await this.indexFileIfChanged(f.absPath, f.relPath, "memory");
          params.progress?.({ completed: ++completed, total: files.length, label: f.relPath });
        }),
      );
    }

    this.deleteStale(activePaths, "memory");
  }

  private async indexFileIfChanged(
    absPath: string,
    relPath: string,
    source: MemorySource,
  ): Promise<void> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try { stat = await fs.stat(absPath); } catch { return; }

    const content = await fs.readFile(absPath, "utf-8");
    const hash = sha256(content);

    const existing = this.db.prepare(
      "SELECT hash FROM files WHERE path = ? AND source = ?",
    ).get(relPath, source) as { hash: string } | undefined;

    if (existing?.hash === hash) return; // unchanged

    const chunks = chunkText(content, relPath, source, this.cfg.chunking);
    await this.upsertChunks(chunks);

    this.db.prepare(
      "INSERT OR REPLACE INTO files (path, source, hash, mtime, size) VALUES (?, ?, ?, ?, ?)",
    ).run(relPath, source, hash, stat.mtimeMs, stat.size);
  }

  private async upsertChunks(chunks: MemoryChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    // Batch embed to respect ~8K token API limit
    const embeddings =
      this.provider.dimensions > 0
        ? await this.batchEmbed(chunks.map((c) => c.text))
        : chunks.map(() => [] as number[]);

    const now = Date.now();
    const model = this.provider.model;

    this.db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const embJson = JSON.stringify(embeddings[i] ?? []);

        this.db.prepare(`
          INSERT OR REPLACE INTO chunks
            (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(c.id, c.path, c.source, c.startLine, c.endLine, c.hash, model, c.text, embJson, now);

        if (this.vecAvailable && embeddings[i]?.length) {
          try {
            this.db.prepare(
              "INSERT OR REPLACE INTO chunks_vec (id, embedding) VALUES (?, ?)",
            ).run(c.id, embJson);
          } catch { /* vec insert failed — continue */ }
        }

        if (this.ftsAvailable) {
          try {
            this.db.prepare(`
              INSERT OR REPLACE INTO chunks_fts
                (text, id, path, source, model, start_line, end_line)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(c.text, c.id, c.path, c.source, model, c.startLine, c.endLine);
          } catch { /* fts insert failed — continue */ }
        }
      }
    })();
  }

  // Remove chunks whose source files have been deleted
  private deleteStale(activePaths: Set<string>, source: MemorySource): void {
    const indexed = (
      this.db.prepare("SELECT DISTINCT path FROM files WHERE source = ?").all(source) as Array<{ path: string }>
    ).map((r) => r.path);

    for (const p of indexed) {
      if (activePaths.has(p)) continue;

      const ids = (
        this.db.prepare("SELECT id FROM chunks WHERE path = ? AND source = ?").all(p, source) as Array<{ id: string }>
      ).map((r) => r.id);

      this.db.transaction(() => {
        for (const id of ids) {
          if (this.vecAvailable) {
            try { this.db.prepare("DELETE FROM chunks_vec WHERE id = ?").run(id); } catch { /* */ }
          }
          if (this.ftsAvailable) {
            try { this.db.prepare("DELETE FROM chunks_fts WHERE id = ?").run(id); } catch { /* */ }
          }
        }
        this.db.prepare("DELETE FROM chunks WHERE path = ? AND source = ?").run(p, source);
        this.db.prepare("DELETE FROM files WHERE path = ? AND source = ?").run(p, source);
      })();
    }
  }

  // ── File discovery ─────────────────────────────────────────────────────────

  private async listMemoryFiles(): Promise<Array<{ relPath: string; absPath: string }>> {
    const results: Array<{ relPath: string; absPath: string }> = [];
    const seen = new Set<string>();
    const ws = this.cfg.workspaceDir;

    const add = (abs: string, rel: string) => {
      if (!seen.has(abs)) { seen.add(abs); results.push({ absPath: abs, relPath: rel }); }
    };

    // MEMORY.md / memory.md at workspace root
    for (const name of ["MEMORY.md", "memory.md"]) {
      const abs = path.join(ws, name);
      try { await fs.access(abs); add(abs, name); } catch { /* not found */ }
    }

    // memory/ directory (all *.md recursively)
    await walkMd(path.join(ws, "memory"), "memory", add);

    // Extra paths
    for (const extra of this.cfg.extraPaths) {
      const absExtra = path.isAbsolute(extra) ? extra : path.join(ws, extra);
      await walkMd(absExtra, path.relative(ws, absExtra), add);
    }

    return results;
  }

  // ── File watching ──────────────────────────────────────────────────────────

  private startWatcher(): void {
    const ws = this.cfg.workspaceDir;
    const patterns = [
      path.join(ws, "MEMORY.md"),
      path.join(ws, "memory.md"),
      path.join(ws, "memory", "**", "*.md"),
      ...this.cfg.extraPaths.map((p) =>
        path.isAbsolute(p)
          ? path.join(p, "**", "*.md")
          : path.join(ws, p, "**", "*.md"),
      ),
    ];

    this.watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
      ignored: /(node_modules|\.git)/,
    });

    const markDirty = () => {
      if (this.watchTimer) clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => {
        this.dirty = true;
      }, this.cfg.sync.watchDebounceMs);
    };

    this.watcher.on("add", markDirty).on("change", markDirty).on("unlink", markDirty);
  }

  // ── Embedding with batching and retry ──────────────────────────────────────

  private async batchEmbed(texts: string[]): Promise<number[][]> {
    const batches: string[][] = [];
    let current: string[] = [];
    let acc = 0;

    for (const t of texts) {
      const bytes = Buffer.byteLength(t, "utf8");
      if (acc + bytes > EMBED_BATCH_MAX_BYTES && current.length > 0) {
        batches.push(current);
        current = [];
        acc = 0;
      }
      current.push(t);
      acc += bytes;
    }
    if (current.length > 0) batches.push(current);

    const results: number[][] = [];
    for (const batch of batches) {
      const embs = await this.embedWithRetry(batch);
      results.push(...embs);
    }
    return results;
  }

  // Exponential backoff retry for transient API failures
  private async embedWithRetry(texts: string[]): Promise<number[][]> {
    let delay = RETRY_BASE_MS;
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.provider.embed(texts);
      } catch (err) {
        if (attempt === RETRY_ATTEMPTS - 1) throw err;
        await sleep(delay * (1 + Math.random() * 0.2));
        delay = Math.min(delay * 2, 8_000);
      }
    }
    throw new Error("unreachable");
  }

  // ── readFile ───────────────────────────────────────────────────────────────

  async readFile(params: ReadFileParams): Promise<{ text: string; path: string }> {
    const rel = normalizePath(params.relPath);
    if (!isMemoryPath(rel)) throw new Error(`Not a valid memory path: "${rel}"`);

    const abs = path.join(this.cfg.workspaceDir, rel);
    const content = await fs.readFile(abs, "utf-8");

    if (params.from === undefined) return { text: content, path: rel };

    const lines = content.split("\n");
    const start = Math.max(0, params.from - 1);
    const end = params.lines ? start + params.lines : lines.length;
    return { text: lines.slice(start, end).join("\n"), path: rel };
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  status(): MemoryProviderStatus {
    const files = (this.db.prepare("SELECT COUNT(*) AS n FROM files").get() as { n: number }).n;
    const chunks = (this.db.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number }).n;
    return {
      backend: "builtin",
      provider: this.provider.id,
      model: this.provider.model,
      files,
      chunks,
      dirty: this.dirty,
      workspaceDir: this.cfg.workspaceDir,
      dbPath: this.cfg.dbPath,
      sources: ["memory"],
      vector: { enabled: this.provider.dimensions > 0, available: this.vecAvailable },
    };
  }

  // ── Close ──────────────────────────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.watchTimer) clearTimeout(this.watchTimer);
    await this.watcher?.close();
    await this.syncPromise?.catch(() => { /* ignore */ });
    this.db.close();
  }
}

// ── Config resolution ─────────────────────────────────────────────────────────

type ResolvedConfig = {
  workspaceDir: string;
  dbPath: string;
  chunking: { tokens: number; overlap: number };
  search: {
    maxResults: number;
    minScore: number;
    vectorWeight: number;
    textWeight: number;
    mmr: { enabled: boolean; lambda: number };
    temporalDecay: { enabled: boolean; halfLifeDays: number };
  };
  sync: { watchDebounceMs: number };
  extraPaths: string[];
};

function resolveConfig(cfg: BuiltinMemoryConfig): ResolvedConfig {
  return {
    workspaceDir: cfg.workspaceDir,
    dbPath: cfg.dbPath,
    chunking: { tokens: 400, overlap: 80, ...cfg.chunking },
    search: {
      maxResults: 6,
      minScore: 0.0,
      vectorWeight: 0.7,
      textWeight: 0.3,
      mmr: { enabled: false, lambda: 0.7, ...cfg.search?.mmr },
      temporalDecay: { enabled: false, halfLifeDays: 30, ...cfg.search?.temporalDecay },
      ...cfg.search,
    },
    sync: { watchDebounceMs: 1_500, ...cfg.sync },
    extraPaths: cfg.extraPaths ?? [],
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function walkMd(
  dir: string,
  relPrefix: string,
  add: (abs: string, rel: string) => void,
): Promise<void> {
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walkMd(path.join(dir, entry.name), rel, add);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        add(path.join(dir, entry.name), rel);
      }
    }
  } catch { /* dir not found */ }
}

function normalizePath(value: string): string {
  return value.trim().replace(/^[./]+/, "").replace(/\\/g, "/");
}

function isMemoryPath(rel: string): boolean {
  return rel === "MEMORY.md" || rel === "memory.md" || rel.startsWith("memory/");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
