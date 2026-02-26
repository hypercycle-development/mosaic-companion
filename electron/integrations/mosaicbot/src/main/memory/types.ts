// ─────────────────────────────────────────────────────────────────────────────
// Memory backend — shared types
// Mirrors src/memory/types.ts + config types from OpenMosaic
// ─────────────────────────────────────────────────────────────────────────────

export type MemorySource = "memory" | "sessions";

// Result returned by every search() call
export type MemorySearchResult = {
  path: string; // relative path, e.g. "MEMORY.md" or "memory/2024-01-15.md"
  startLine: number; // 1-indexed
  endLine: number; // 1-indexed
  score: number; // 0–1 (higher = more relevant)
  snippet: string; // text excerpt, ≤ snippetMaxChars
  source: MemorySource;
};

export type MemorySyncProgress = {
  completed: number;
  total: number;
  label?: string;
};

export type MemoryProviderStatus = {
  backend: "builtin" | "qmd";
  provider: string; // "openai" | "ollama" | "none" | "qmd"
  model: string;
  files: number;
  chunks: number;
  dirty: boolean;
  workspaceDir: string;
  dbPath: string;
  sources: MemorySource[];
  vector: { enabled: boolean; available: boolean };
  fallback?: { from: string; reason: string };
};

// ── Manager interface ─────────────────────────────────────────────────────────

export interface MemorySearchManager {
  search(query: string, opts?: SearchOpts): Promise<MemorySearchResult[]>;
  readFile(params: ReadFileParams): Promise<{ text: string; path: string }>;
  sync(params?: SyncParams): Promise<void>;
  status(): MemoryProviderStatus;
  close(): Promise<void>;
}

export type SearchOpts = {
  maxResults?: number;
  minScore?: number;
};

export type ReadFileParams = {
  relPath: string;
  from?: number; // 1-indexed line to start from
  lines?: number; // number of lines to return
};

export type SyncParams = {
  reason?: string;
  force?: boolean;
  progress?: (u: MemorySyncProgress) => void;
};

// ── Internal chunk type ───────────────────────────────────────────────────────

export type MemoryChunk = {
  id: string; // sha256(path:startLine:endLine:textHash)
  path: string; // relative file path
  source: MemorySource;
  startLine: number;
  endLine: number;
  hash: string; // sha256(text)
  text: string;
};

// ── Embedding provider ────────────────────────────────────────────────────────

export type EmbeddingProvider = {
  id: string;
  model: string;
  dimensions: number; // 0 = FTS-only mode
  embed(texts: string[]): Promise<number[][]>;
};

// ── Config types ──────────────────────────────────────────────────────────────

export type EmbeddingConfig =
  | {
      provider: "openai";
      model?: string; // default: "text-embedding-3-small"
      apiKey: string;
      dimensions?: number; // default: 1536
      baseUrl?: string; // default: "https://api.openai.com/v1"
    }
  | {
      provider: "ollama";
      model?: string; // default: "nomic-embed-text"
      baseUrl?: string; // default: "http://localhost:11434"
      dimensions?: number; // probed on first call if not set
    }
  | { provider: "none" };

export type BuiltinMemoryConfig = {
  workspaceDir: string;
  dbPath: string; // e.g. path.join(appDir, "memory", agentId + ".sqlite")
  embedding?: EmbeddingConfig;
  chunking?: {
    tokens?: number; // target chunk size in tokens (~4 bytes each). default: 400
    overlap?: number; // overlap in tokens. default: 80
  };
  search?: {
    maxResults?: number; // default: 6
    minScore?: number; // default: 0.0
    vectorWeight?: number; // default: 0.7
    textWeight?: number; // default: 0.3
    mmr?: {
      enabled?: boolean; // default: false
      lambda?: number; // 1.0=pure relevance, 0.0=pure diversity. default: 0.7
    };
    temporalDecay?: {
      enabled?: boolean; // default: false
      halfLifeDays?: number; // score halves every N days. default: 30
    };
  };
  sync?: {
    watchDebounceMs?: number; // debounce before marking dirty. default: 1500
  };
  extraPaths?: string[]; // additional dirs/files to index
};

export type QmdMemoryConfig = {
  workspaceDir: string;
  agentId: string;
  stateDir: string; // app state root, e.g. ~/.myapp
  command?: string; // qmd binary. default: "qmd"
  searchMode?: "query" | "search" | "vsearch"; // default: "search"
  paths?: Array<{
    path: string; // absolute or relative to workspaceDir
    name?: string;
    pattern?: string; // glob. default: "**/*.md"
  }>;
  sessions?: {
    enabled?: boolean; // index session transcripts. default: false
    retentionDays?: number; // default: 30
  };
  update?: {
    intervalMs?: number; // background update interval. default: 5 * 60_000
    onBoot?: boolean; // run update+embed on startup. default: true
    updateTimeoutMs?: number; // default: 120_000
    embedTimeoutMs?: number; // default: 120_000
  };
  limits?: {
    maxResults?: number; // default: 6
    maxSnippetChars?: number; // default: 700
    timeoutMs?: number; // search subprocess timeout. default: 4_000
  };
};
