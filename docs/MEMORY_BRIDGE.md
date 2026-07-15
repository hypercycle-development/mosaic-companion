# Memory Bridge — Codebase Memory MCP Integration

> Connects Mosaic Bot to the codebase-memory MCP knowledge graph (194,667+ nodes indexed from ~/.hermes)

---

## Problem Solved

**Before:**
- Mosaic Bot showed **0 files** in memory
- Bot had no knowledge of our work history, skills, or session context
- Skills were isolated — bot couldn't learn from past sessions

**After:**
- Bot queries the **codebase-memory MCP** with 194,667 indexed nodes
- Bot injects **recent session context** (skills touched, projects active) into heartbeat prompts
- Bot can **index new sessions** back into the knowledge graph
- Skills created in sessions automatically become discoverable

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Mosaic Bot (Electron)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │   SQLite     │  │   Memory     │  │   Session      │   │
│  │   (local)    │  │   Bridge     │  │   Vault        │   │
│  │              │  │              │  │   (local)      │   │
│  │  files: 0    │  │              │  │                │   │
│  │  chunks: 0   │  │  Query MCP   │  │  session-*.json│   │
│  │              │  │  Index sessions│                │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────────┘   │
│         │                 │                                 │
│         └─────────────────┘                                 │
│                    │                                        │
└────────────────────┼────────────────────────────────────────┘
                     │ IPC / HTTP
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              Codebase Memory MCP Server                       │
│              (Neo4j: bolt://localhost:7687)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Projects Indexed:                                           │
│  ├─ home-mauricio-.hermes (194,667 nodes) ← ALL our skills   │
│  ├─ home-mauricio-mosaic-companion-docs (883 nodes)        │
│  ├─ home-mauricio-midnight-expert (8,421 nodes)              │
│  └─ ...                                                      │
│                                                              │
│  Query APIs:                                                 │
│  ├─ search_graph: BM25 + semantic search                    │
│  ├─ query_graph: Cypher queries                             │
│  └─ trace_path: Call chains, data flow                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## APIs Added

### Main Process (IPC Handlers)

| Handler | Input | What It Does |
|---------|-------|-------------|
| `memory:query-context` | project, query, limit | Searches knowledge graph for context |
| `memory:session-context` | — | Gets recent skills/projects/patterns |
| `memory:index-session` | sessionId, summary, skills[], projects[] | Saves session to graph |

### Preload Script (Renderer Access)

```typescript
// In MosaicBotPanel.tsx or any renderer component:
const results = await window.agent?.queryContext(
  "home-mauricio-.hermes",
  "orchestrator stargate",
  10
);
// Returns: [{ qualified_name, name, label, file, score }, ...]

const context = await window.agent?.getSessionContext();
// Returns: { recentSkills, recentProjects, activeBoxes, recentTasks, patterns }

await window.agent?.indexSession(
  "session-2026-06-30",
  "Built Mosaic Bot Orchestrator with multi-agent support",
  ["mosaic-orchestrator", "stargate-doctor", "auto-skill-importer"],
  ["mosaic-companion"]
);
```

---

## Orchestrator Integration

The `buildSystemPrompt()` now injects **Recent Activity** from the knowledge graph:

```
## Recent Activity (From Knowledge Graph)
- Recently touched skills: mosaic-stargate, kanban-orchestrator, github-code-review, codebase-memory-mcp, incremental-implementation...
- Active projects: mosaic-companion, midnight-expert, free-tier-arbitrage-repo
- Detected patterns: SPO has failed 7/10 recent checks — chronic issue suspected
```

This means:
1. **Every heartbeat** knows what we've been working on
2. **Every alert** can reference recent skills and projects
3. **The bot evolves** as we work — it sees our skill growth

---

## How to Use

### 1. Query Context (In Renderer)

Add this to MosaicBotPanel.tsx or any component:

```tsx
const [contextResults, setContextResults] = useState([]);

useEffect(() => {
  window.agent?.queryContext("home-mauricio-.hermes", "stargate pool", 5)
    .then(setContextResults);
}, []);
```

### 2. Index a Session (After Each Work Session)

At the end of a work session:

```typescript
await window.agent?.indexSession(
  "session-2026-06-30-evening",     // unique session ID
  "Built multi-agent orchestrator, wired memory bridge, fixed skill importer",  // summary
  ["mosaic-orchestrator", "memory-bridge", "skill-importer"],  // skills touched
  ["mosaic-companion", "electron"]  // projects touched
);
```

### 3. Auto-Index (Cron Job)

Set up a cron job to auto-index sessions:

```yaml
cron:
  - name: mosaic-session-indexer
    schedule: "0 */6 * * *"  # Every 6 hours
    prompt: >
      Read recent session history from ~/.hermes/sessions/.
      Summarize skills and projects touched.
      Call window.agent?.indexSession() with the summary.
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/main/memory-bridge.ts` | Bridge to codebase-memory MCP |
| `src/main/orchestrator.ts` | Injects session context into prompts |
| `src/main/index.ts` | IPC handlers for memory bridge |
| `src/preload.ts` | Exposes APIs to renderer |
| `global.d.ts` | TypeScript types for renderer |

---

## What the Bot Knows Now

After this integration, the bot's heartbeat prompt includes:

1. **Vault boxes** — all knowledge entries
2. **MCP servers** — connected tools
3. **Agent profiles** — main/coder/local configs
4. **Infrastructure health** — SPO, C-3PO, R2D2
5. **Learned patterns** — recurring issues from heartbeats
6. **Recent skills** — what we've been building (from knowledge graph)
7. **Active projects** — where our focus is (from knowledge graph)
8. **Detected patterns** — time clusters, failure rates

---

## Next Steps

| Action | How |
|--------|-----|
| **Query graph in UI** | Add `queryContext()` call to MosaicBotPanel |
| **Auto-index sessions** | Set up cron job or trigger on `/done` command |
| **Skill recommendations** | Query graph for related skills we haven't imported |
| **Project health** | Query graph for project complexity, test coverage |
| **Cross-project insights** | "What skills from midnight-expert apply to mosaic-companion?" |

---

## Verification

After restart, check console for:
```
[Orchestrator] Built context: vault=4, mcp=10, agents=3, infra=3, patterns=0, sessions={recentSkills: [...]}
[MemoryBridge] Queried session context: X skills, Y projects
```

The bot is now **truly aware** of our ecosystem. 🧠
