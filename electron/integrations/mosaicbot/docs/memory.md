# Memory Backend

Semantic search over Markdown files, faithful to the OpenMosaic architecture.

## Architecture

```
getMemoryManager(cfg)
        │
        ├─ backend: "builtin"  → SqliteMemoryManager
        │                            │
        │                            ├─ file watcher (chokidar)
        │                            ├─ chunker  (~400 tok, 80 tok overlap)
        │                            ├─ EmbeddingProvider (OpenAI / Ollama / null)
        │                            ├─ SQLite (better-sqlite3)
        │                            │    ├─ chunks          (text + embeddings)
        │                            │    ├─ chunks_fts      (FTS5 virtual table)
        │                            │    ├─ chunks_vec      (vec0 virtual table)
        │                            │    ├─ files           (hash change-detection)
        │                            │    └─ embedding_cache
        │                            └─ hybrid search
        │                                 ├─ vector  (cosine via sqlite-vec or JS)
        │                                 ├─ BM25    (FTS5)
        │                                 ├─ merge   (vectorW * vScore + textW * tScore)
        │                                 ├─ temporal decay  (exp(-λ·age))
        │                                 └─ MMR re-rank     (Jaccard diversity)
        │
        └─ backend: "qmd"      → QmdMemoryManager
                                     │
                                     ├─ qmd subprocess
                                     │    ├─ qmd collection add/list/remove
                                     │    ├─ qmd update   (index files)
                                     │    ├─ qmd embed    (generate embeddings)
                                     │    └─ qmd search --json
                                     ├─ XDG dirs isolated per agent
                                     ├─ shared ML models symlink
                                     └─ FallbackMemoryManager
                                          └─ on first error → SqliteMemoryManager
```

## Files

| File                | Mirrors OpenMosaic                                                                           | Purpose                          |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- |
| `types.ts`          | `src/memory/types.ts`                                                                        | All interfaces and config types  |
| `schema.ts`         | `src/memory/memory-schema.ts`                                                                | SQLite DDL (tables, FTS5, vec0)  |
| `chunker.ts`        | `src/memory/embedding-chunk-limits.ts`                                                       | Text → overlapping chunks        |
| `scoring.ts`        | `src/memory/hybrid.ts` + `temporal-decay.ts` + `mmr.ts`                                      | Scoring algorithms               |
| `embedding.ts`      | `src/memory/embeddings.ts`                                                                   | OpenAI / Ollama / null providers |
| `sqlite-backend.ts` | `src/memory/manager.ts` + `manager-search.ts` + `manager-embedding-ops.ts` + `sync-index.ts` | Main SQLite manager              |
| `qmd-backend.ts`    | `src/memory/qmd-manager.ts`                                                                  | QMD subprocess manager           |
| `index.ts`          | `src/memory/search-manager.ts`                                                               | Factory + FallbackMemoryManager  |

## Setup

### Install dependencies

```bash
npm install better-sqlite3 chokidar
npm install --save-dev @types/better-sqlite3

# Optional: vector search (recommended)
npm install sqlite-vec

# Rebuild native modules for your Electron version
npx electron-rebuild
```

### Indexed files

By default the manager indexes:

- `{workspaceDir}/MEMORY.md`
- `{workspaceDir}/memory.md`
- `{workspaceDir}/memory/**/*.md`
- Any paths in `extraPaths`

Files are watched via chokidar and re-indexed on change (debounced 1.5 s).

## Usage

### Builtin SQLite backend

```typescript
import { getMemoryManager } from "./memory/index.js";
import path from "node:path";
import os from "node:os";

const mem = await getMemoryManager({
  backend: "builtin",
  config: {
    workspaceDir: process.cwd(),
    dbPath: path.join(os.homedir(), ".myapp", "memory", "main.sqlite"),
    embedding: {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY!,
      // model: "text-embedding-3-small",  // default
      // dimensions: 1536,                 // default
    },
    search: {
      vectorWeight: 0.7,
      textWeight: 0.3,
      temporalDecay: { enabled: true, halfLifeDays: 30 },
      mmr: { enabled: true, lambda: 0.7 },
    },
  },
});

const results = await mem.search("python asyncio patterns");
// → MemorySearchResult[]
```

### Local embeddings via Ollama

```typescript
const mem = await getMemoryManager({
  backend: "builtin",
  config: {
    workspaceDir: process.cwd(),
    dbPath: "...",
    embedding: {
      provider: "ollama",
      model: "nomic-embed-text",
      // baseUrl: "http://localhost:11434",  // default
    },
  },
});
```

### FTS-only (no embeddings)

```typescript
const mem = await getMemoryManager({
  backend: "builtin",
  config: {
    workspaceDir: process.cwd(),
    dbPath: "...",
    embedding: { provider: "none" },
  },
});
// Vector search disabled; only BM25 full-text search used.
```

### QMD backend with SQLite fallback

```typescript
const mem = await getMemoryManager({
  backend: "qmd",
  config: {
    workspaceDir: process.cwd(),
    agentId: "main",
    stateDir: path.join(os.homedir(), ".myapp"),
    command: "qmd", // must be in PATH
    searchMode: "search",
    update: { onBoot: true, intervalMs: 5 * 60_000 },
  },
  fallback: {
    workspaceDir: process.cwd(),
    dbPath: "...",
    embedding: { provider: "none" }, // FTS-only if qmd fails
  },
});
// Automatically switches to SQLite if qmd errors or is not installed.
```

## Scoring

### Hybrid merge

```
finalScore = vectorWeight × cosineSimilarity + textWeight × bm25Score

bm25Score  = 1 / (1 + |bm25Rank|)     // maps rank [0,∞) → (0,1]
```

Default weights: `vectorWeight=0.7`, `textWeight=0.3`.

### Temporal decay

Applied only to dated files (`memory/YYYY-MM-DD.md`).
Evergreen files (`MEMORY.md`, undated notes) are unaffected.

```
λ           = ln(2) / halfLifeDays     // e.g. 0.0231 for 30-day half-life
decayedScore = score × e^(−λ × ageInDays)
```

After `halfLifeDays` days the score is halved.

### MMR (Maximal Marginal Relevance)

Reduces redundant results while preserving relevance.

```
mmrScore(c) = λ × relevance(c) − (1−λ) × max similarity to already-selected
```

Similarity = Jaccard on alphanumeric tokens.
`lambda=1.0` → pure relevance, `lambda=0.0` → pure diversity.

## SQLite schema

```sql
files         -- path, source, hash, mtime, size
chunks        -- id, path, source, start_line, end_line, hash, model, text, embedding
chunks_fts    -- FTS5 virtual table (BM25 search)
chunks_vec    -- vec0 virtual table (cosine similarity via sqlite-vec)
embedding_cache -- provider, model, hash → embedding (avoids re-embedding)
meta          -- schema_version
```

## QMD CLI protocol

```bash
# Collection management
qmd collection add <path> --name <name> --mask <pattern>
qmd collection list --json
qmd collection remove <name>

# Indexing
qmd update                    # scan and index changed files
qmd embed                     # generate embeddings for indexed files

# Search (returns JSON array of QmdQueryResult)
qmd search  <query> --json -n <limit> -c <collection> ...
qmd vsearch <query> --json -n <limit> -c <collection> ...
qmd query   <query> --json -n <limit> -c <collection> ...
```

JSON response shape:

```json
[
  {
    "docid": "#abc123",
    "score": 0.85,
    "snippet": "@@ -42,10\nContent text...",
    "file": "/abs/path/to/file.md"
  }
]
```

Line numbers are extracted from the `@@ -LINE,COUNT` header in `snippet`.
