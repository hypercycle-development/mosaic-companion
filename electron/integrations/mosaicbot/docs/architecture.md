# OpenMosaic Electron — Architecture

Port of the three core OpenMosaic subsystems into a standalone Electron + TypeScript application.

## File tree

```
src/
  main/
    heartbeat/
      types.ts          Heartbeat config, event, wake-request types
      wake.ts           Priority-based coalescing wake queue
      runner.ts         Interval scheduler + HEARTBEAT_OK token stripping

    channels/
      types.ts          ChannelPlugin, ChannelOutboundAdapter, ChannelDock interfaces
      registry.ts       Plugin registration + outbound adapter cache
      deliver.ts        deliverMessage() with paragraph-aware chunking
      adapters/
        ipc.ts          Electron IPC channel (BrowserWindow.webContents.send)
        http.ts         HTTP webhook channel (fetch POST)

    skills/
      types.ts          SkillEntry, SkillCommandSpec, SkillSnapshot types
      loader.ts         SKILL.md discovery + frontmatter parse
      registry.ts       Eligibility check, command spec generation, /command matching

    memory/
      types.ts          MemorySearchManager interface, config types
      schema.ts         SQLite DDL (chunks, FTS5, vec0, embedding_cache)
      chunker.ts        ~400-token overlapping markdown chunker
      scoring.ts        Hybrid merge + temporal decay + MMR re-ranking
      embedding.ts      OpenAI / Ollama / null embedding providers
      sqlite-backend.ts Full SQLite manager (watch → chunk → embed → search)
      qmd-backend.ts    QMD subprocess manager
      index.ts          getMemoryManager() factory + FallbackMemoryManager

    index.ts            Electron main entry — wires all subsystems

  preload.ts            contextBridge: agent, memory, skills, heartbeat APIs

docs/
  architecture.md       This file
  memory.md             Memory backend deep-dive
```

## Subsystem summaries

### Heartbeat (`heartbeat/`)

Periodic LLM call to check for pending tasks. If the reply is only
`HEARTBEAT_OK`, the turn is suppressed. Real alerts are delivered via the
configured channel.

- `wake.ts` — priority queue (retry=0, interval=1, default=2, action=3)
  with 250 ms coalescing and 1 s retry cooldown
- `runner.ts` — one `AgentState` per agent; schedules next tick after each run;
  strips `HEARTBEAT_OK` variants; respects active-hours window

### Channel adapters (`channels/`)

Plugin-based messaging abstraction. Each channel implements `ChannelPlugin<Account, Cfg>`:

- `config` — account resolution
- `outbound` — `sendText()`, `sendMedia()`, `sendPoll()`
- `security` — DM policy

`deliver.ts` → `loadChannelOutboundAdapter(id)` → chunk text → `sendText()`.

Built-in adapters: IPC (Electron windows) and HTTP webhook.

### Skill registry (`skills/`)

Discovers `SKILL.md` files from multiple source directories (bundled < managed < workspace).
Each file has YAML frontmatter with name, description, OS/binary requirements,
and optional tool-dispatch config.

`buildSkillSnapshot()` filters by eligibility and budget (150 skills, 30 K chars),
produces a prompt block for the agent and a list of `SkillCommandSpec` for `/command` matching.

### Memory (`memory/`)

Two backends, same `MemorySearchManager` interface:

**Builtin SQLite** (`sqlite-backend.ts`)

- File watcher (chokidar) marks index dirty on change
- Incremental sync: hash-compare → chunk → embed → upsert
- Hybrid search: sqlite-vec cosine + FTS5 BM25 → weighted merge
- Post-processing: temporal decay (exp(-λ·age)) + MMR (Jaccard diversity)

**QMD** (`qmd-backend.ts`)

- Spawns `qmd` subprocess with per-agent XDG dirs
- `qmd update` + `qmd embed` on boot and interval
- `qmd search --json` returns `[{docid, score, snippet}]`
- Resolves doc paths from qmd's own `index.sqlite` (read-only)
- `FallbackMemoryManager` transparently switches to builtin on first error

## OpenMosaic source mapping

| This file                  | OpenMosaic source                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `heartbeat/wake.ts`        | `src/infra/heartbeat-wake.ts`                                                                       |
| `heartbeat/runner.ts`      | `src/infra/heartbeat-runner.ts`                                                                     |
| `channels/types.ts`        | `src/channels/plugins/types.adapters.ts` + `types.plugin.ts`                                        |
| `channels/registry.ts`     | `src/channels/plugins/index.ts` + `load.ts`                                                         |
| `channels/deliver.ts`      | `src/infra/outbound/deliver.ts`                                                                     |
| `skills/loader.ts`         | `src/agents/skills/workspace.ts` (loadSkillEntries)                                                 |
| `skills/registry.ts`       | `src/agents/skills/workspace.ts` (buildWorkspaceSkillSnapshot) + `src/auto-reply/skill-commands.ts` |
| `memory/schema.ts`         | `src/memory/memory-schema.ts`                                                                       |
| `memory/chunker.ts`        | `src/memory/embedding-chunk-limits.ts`                                                              |
| `memory/scoring.ts`        | `src/memory/hybrid.ts` + `temporal-decay.ts` + `mmr.ts`                                             |
| `memory/embedding.ts`      | `src/memory/embeddings.ts`                                                                          |
| `memory/sqlite-backend.ts` | `src/memory/manager.ts` + `manager-search.ts` + `manager-embedding-ops.ts` + `sync-index.ts`        |
| `memory/qmd-backend.ts`    | `src/memory/qmd-manager.ts`                                                                         |
| `memory/index.ts`          | `src/memory/search-manager.ts`                                                                      |

## IPC surface (preload.ts)

```typescript
window.agent.send(text)           // route message, match skill commands
window.agent.triggerHeartbeat()   // fire heartbeat immediately
window.agent.listSkills()         // [{name, description}]
window.agent.onMessage(cb)        // receive delivered messages

window.memory.search(query, opts) // MemorySearchResult[]
window.memory.read(path, from?, lines?) // {text, path}
window.memory.sync()              // force re-index
window.memory.status()            // MemoryProviderStatus
```
