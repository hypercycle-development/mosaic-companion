// ─────────────────────────────────────────────────────────────────────────────
// SQLite schema for the builtin memory backend
// Mirrors src/memory/memory-schema.ts from OpenClaw
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 3;

// Core tables: always created
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Tracks indexed files with hash-based change detection
  CREATE TABLE IF NOT EXISTS files (
    path   TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'memory',
    hash   TEXT NOT NULL,
    mtime  INTEGER NOT NULL,
    size   INTEGER NOT NULL
  );

  -- Chunked content with optional embeddings (JSON float array, [] when none)
  CREATE TABLE IF NOT EXISTS chunks (
    id         TEXT PRIMARY KEY,
    path       TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'memory',
    start_line INTEGER NOT NULL,
    end_line   INTEGER NOT NULL,
    hash       TEXT NOT NULL,
    model      TEXT NOT NULL,
    text       TEXT NOT NULL,
    embedding  TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Embedding cache: avoids re-embedding unchanged content
  CREATE TABLE IF NOT EXISTS embedding_cache (
    provider     TEXT NOT NULL,
    model        TEXT NOT NULL,
    provider_key TEXT NOT NULL,
    hash         TEXT NOT NULL,
    embedding    TEXT NOT NULL,
    dims         INTEGER,
    updated_at   INTEGER NOT NULL,
    PRIMARY KEY (provider, model, provider_key, hash)
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_path   ON chunks(path);
  CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
  CREATE INDEX IF NOT EXISTS idx_emb_cache_at  ON embedding_cache(updated_at);
`;

// FTS5 virtual table for BM25 full-text search
export const CREATE_FTS_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    text,
    id         UNINDEXED,
    path       UNINDEXED,
    source     UNINDEXED,
    model      UNINDEXED,
    start_line UNINDEXED,
    end_line   UNINDEXED
  );
`;

// vec0 virtual table for cosine similarity search (requires sqlite-vec extension)
// dimensions must be known at table creation time — matches embedding provider output
export function createVecTableSQL(dimensions: number): string {
  return `
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      id        TEXT PRIMARY KEY,
      embedding FLOAT[${dimensions}]
    );
  `;
}

export const SET_SCHEMA_VERSION_SQL = `
  INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
`;
