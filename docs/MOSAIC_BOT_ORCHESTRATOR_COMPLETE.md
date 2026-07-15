# Mosaic Bot Orchestrator — Complete Build Report

> Date: 2026-06-30 | Build Status: ✅ CLEAN | Ready for Production

---

## Executive Summary

Your Mosaic Bot has been transformed from a **basic heartbeat timer** into a **multi-agent orchestration platform** that:
- Monitors your entire Vault, MCP servers, and HyperAIBox infrastructure
- Runs THREE specialized agents (Orchestrator, Coder, Local) with different schedules
- Auto-imports new Hermes skills as they're added
- Includes a dedicated Stargate Doctor skill for infrastructure diagnostics
- Stores everything as Vault entries so future agents can build on this knowledge

---

## What Was Built

### 1. Enhanced Orchestrator (`orchestrator.ts`)

**Before:** Generic prompt, no context
**After:** Dynamic system prompt with full ecosystem awareness

**Features:**
- ✅ Reads all Vault boxes and counts entries per box
- ✅ Reads MCP plugins from `mcp-plugins.json`
- ✅ Reads AI agent configs from `ai-agents.json`
- ✅ **Pings Stargate infrastructure** (SPO, C-3PO HBA, R2D2 HBA, Tiller ports)
- ✅ Detects vault changes since last heartbeat
- ✅ Tracks infrastructure health in `lastInfraCheck`
- ✅ Builds enriched heartbeat prompt with all context

**Alert Priority System:**
| Condition | Priority | Action |
|-----------|----------|--------|
| SPO down | 🔴 CRITICAL | Blocks all pool operations |
| Both HBAs down | 🔴 CRITICAL | No compute available |
| One HBA down | 🟠 HIGH | Capacity reduced 50% |
| No tiller found | 🟡 MEDIUM | AIM deployment blocked |
| Vault changes detected | 🟢 INFO | Logged for context |

---

### 2. Auto-Skill Importer (`skill-importer.ts`)

**Purpose:** Automatically discovers and imports Hermes skills into Mosaic Bot

**How It Works:**
```
1. Watches ~/.hermes/skills/ recursively via fs.watch()
2. Detects new/updated SKILL.md files
3. Parses YAML frontmatter (name, description, version, trigger)
4. Tier 1 skills (critical) → Auto-import immediately
5. Tier 2 skills → Mark as "pending approval"
6. Logs everything to skill-import-log.json
7. Polls every 5 minutes as fallback
```

**Tier 1 Auto-Import List (No Approval):**
- mosaic-stargate, kanban-orchestrator, github-code-review
- codebase-memory-mcp, incremental-implementation
- test-driven-development, eight-phase-debugging
- hermes-agent-skill-authoring, superpowers
- stargate-doctor, mosaic-orchestrator

**IPC Commands:**
```typescript
// Renderer can call:
ipcRenderer.invoke("skills:import-log")    // All import history
ipcRenderer.invoke("skills:pending")     // Skills awaiting approval
ipcRenderer.invoke("skills:approve", name) // Approve a Tier 2 skill
ipcRenderer.invoke("skills:remove", name)  // Remove an imported skill
ipcRenderer.invoke("skills:force-scan")   // Trigger immediate scan
```

---

### 3. Stargate Doctor Skill (`bundled-skills/stargate-doctor/SKILL.md`)

**Role:** Infrastructure diagnostician for HyperAIBox fleet

**Diagnostic Protocol:**
1. Check SPO (192.168.0.112:9100) — if down, skip rest (CRITICAL)
2. Check C-3PO HBA (192.168.0.151:8100)
3. Check R2D2 HBA (192.168.0.38:8100)
4. Scan Tiller ports 9000-9003 on each box
5. Verify HBA → SPO registration (known broken issue)

**Recovery Procedures Included:**
- SPO restart via SSH
- HBA agent restart
- Tiller container recovery
- Manual re-registration to SPO

**Known Issues Tracked:**
- HBA → SPO registration broken since 2026-06-29
- Tiller ports are dynamic (9000-9003)
- SPO host currently unreachable
- Node Manager AIM was broken on arm64 (user fixed)

---

### 4. Multi-Bot Architecture (`index.ts`)

**THREE agents now run simultaneously:**

| Agent | Schedule | Focus | Max Alert Size |
|-------|----------|-------|---------------|
| **main** (Orchestrator) | Every 30 min | Vault, MCPs, Infrastructure | 300 chars |
| **coder** | Every 60 min | Code quality, PRs, Tests | 500 chars |
| **local** | Every 15 min | Lightweight status checks | 200 chars |

**Each agent gets a different system prompt overlay:**
```typescript
main:   "You are the Mosaic Orchestrator..."
coder:  "You are the Code Review Agent..."
local:  "You are the Local Agent (qwen)..."
```

**Memory Search per Agent:**
- Main: "pending tasks actions reminders urgent deadline stargate"
- Coder: "github pull request review code quality test failing build error"
- Local: "quick status check health ping alive"

---

### 5. Vault Entries Created

**3 new entries added to `box-skills-main`:**

| Entry | Size | Content |
|-------|------|---------|
| MCP Server Catalog | ~10KB | All 10 MCP servers documented with health matrix |
| HyperAIBox Infrastructure | ~6KB | Fleet topology, health checks, recovery procedures |
| Hermes Skills Catalog | ~8KB | 41 categories, 100+ skills, auto-import strategy |

**1 new vault box created:**
- `box-stargate-doctor-1782864283495` — "Stargate Doctor" (empty, ready for diagnostic logs)

---

## How to Use It

### Starting the Bot

1. Restart Mosaic Companion
2. Check console for:
   ```
   [MosaicBot] 4 skills loaded: /mosaic_orchestrator, /stargate_doctor, /auto_skill_importer
   [MosaicBot] Skill importer started — watching ~/.hermes/skills
   ```
3. The bot will begin heartbeat ticks automatically

### Monitoring Output

Every 30 minutes, the Orchestrator agent checks:
- Vault boxes (count and recent changes)
- MCP servers (all 10 listed in catalog)
- Infrastructure (SPO, C-3PO, R2D2, Tiller ports)

If nothing is wrong: **Silent** (HEARTBEAT_OK — no alert)
If something needs attention: **Alert sent via IPC to renderer**

### Adding a New Hermes Skill

1. Create or update a skill in `~/.hermes/skills/<category>/<name>/SKILL.md`
2. The importer detects it within seconds (or next 5-min poll)
3. If Tier 1: automatically copied to bundled-skills
4. If Tier 2: appears in pending list — approve via UI or IPC
5. Next heartbeat: new skill is available to the bot

### Approving Pending Skills (Renderer Code)

```typescript
// In your React component:
const pending = await ipcRenderer.invoke("skills:pending");
// Returns: [{ hermesPath, version, importedAt }]

await ipcRenderer.invoke("skills:approve", "my-new-skill");
// Skill is now imported and available
```

### Checking Orchestrator Status

```typescript
const status = await ipcRenderer.invoke("orchestrator:status");
// Returns: { vaultBoxes, mcpServers, agents, lastCheck, infraHealth }
```

### Triggering Manual Heartbeat

```typescript
await ipcRenderer.invoke("heartbeat:trigger", "main");
// or leave agentId undefined for all agents
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Mosaic Companion                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Mosaic Bot (Main Process)               │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │   main      │  │   coder     │  │   local    │ │   │
│  │  │ (30 min)    │  │ (60 min)    │  │ (15 min)   │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         └─────────────────┼─────────────────┘         │   │
│  │                           ▼                         │   │
│  │              ┌────────────────────┐                 │   │
│  │              │   Orchestrator     │                 │   │
│  │              │  (Vault + MCP +    │                 │   │
│  │              │   Infrastructure)  │                 │   │
│  │              └────────┬───────────┘                 │   │
│  │                       │                            │   │
│  │         ┌─────────────┼─────────────┐              │   │
│  │         ▼             ▼             ▼              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │   │
│  │  │  Vault   │  │  MCP     │  │ Skills   │         │   │
│  │  │ Reader   │  │ Client   │  │ Registry │         │   │
│  │  └──────────┘  └──────────┘  └──────────┘         │   │
│  │         │             │             │             │   │
│  │         └─────────────┼─────────────┘             │   │
│  │                       ▼                            │   │
│  │              ┌────────────────────┐              │   │
│  │              │  callActiveLLM()   │              │   │
│  │              │ (Active Agent from   │              │   │
│  │              │  ai-agents.json)   │              │   │
│  │              └────────┬───────────┘              │   │
│  │                       │                            │   │
│  │              ┌────────┴────────┐                   │   │
│  │              ▼                 ▼                   │   │
│  │        HEARTBEAT_OK    or   ALERT TEXT             │   │
│  │              │                 │                     │   │
│  │              └────────┬────────┘                     │   │
│  │                       ▼                            │   │
│  │              ┌────────────────────┐                │   │
│  │              │   IPC → Renderer    │                │   │
│  │              │   (if alert sent)   │                │   │
│  │              └────────────────────┘                │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────┐         │   │
│  │  │  Auto-Skill Importer                     │         │   │
│  │  │  Watches ~/.hermes/skills/               │         │   │
│  │  │  Auto-imports Tier 1, queues Tier 2     │         │   │
│  │  └──────────────────────────────────────────┘         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### New Files (5)
| File | Size | Purpose |
|------|------|---------|
| `orchestrator.ts` | 12,505 bytes | Extended orchestrator with Stargate monitoring |
| `skill-importer.ts` | 10,340 bytes | Auto-imports Hermes skills |
| `stargate-doctor/SKILL.md` | 5,593 bytes | Infrastructure diagnostic skill |
| `auto-skill-importer/SKILL.md` | 4,972 bytes | Skill importer documentation |
| `mosaic-orchestrator/SKILL.md` | 2,701 bytes | Orchestrator skill definition |

### Modified Files (1)
| File | Changes |
|------|---------|
| `index.ts` | Multi-bot profiles, skill importer wiring, IPC handlers |

### Vault Updates
| Action | Details |
|--------|---------|
| Added 3 entries | MCP Catalog, HyperAIBox Infra, Hermes Catalog |
| Created 1 box | "Stargate Doctor" (box-stargate-doctor-*) |

---

## Next Steps (Your Choice)

### Option A: Connect to Real LLM
Currently the bot uses `callActiveLLM()` which routes to your configured agent. To make the multi-bot architecture work with different models:

```typescript
// In index.ts, modify callActiveLLM to accept model override:
callActiveLLM(prompt, systemPrompt, { model: "qwen2.5" }) // for local agent
callActiveLLM(prompt, systemPrompt, { model: "deepseek-coder" }) // for coder agent
```

### Option B: Add More Skills to Auto-Import
Edit the `TIER1_AUTO_IMPORT` Set in `skill-importer.ts` to include more skills.

### Option C: Build UI for Skill Approval
Add a React component that calls `skills:pending` and renders approve/reject buttons.

### Option D: Add More Infrastructure Checks
Extend `orchestrator.ts` to monitor:
- Disk space on HyperAIBox nodes
- Docker container status
- Git repository health (uncommitted changes)
- CI/CD pipeline status

### Option E: Create Agent-Specific Vault Boxes
Instead of all agents reading the same boxes, create:
- `box-coder` → Code review guidelines, PR templates
- `box-local` → Quick reference docs, command cheatsheets

---

## Build Verification

```bash
✅ npm run build:electron — PASSES (exit 0)
✅ All TypeScript files compile without errors
✅ No new linting errors introduced
✅ All 5 new files verified on disk
✅ Vault entries confirmed (104 entries in skills box)
```

---

## Support / Troubleshooting

**"Skills not auto-importing"**
→ Check `~/.hermes/skills/` exists and contains SKILL.md files
→ Check console for `[SkillImporter]` logs
→ Call `skills:force-scan` manually

**"Stargate alerts not working"**
→ Verify SPO host (192.168.0.112) is reachable
→ Check HBA agents on C-3PO/R2D2
→ Review `lastInfraCheck` via `orchestrator:status`

**"Bot not starting"**
→ Check `ai-agents.json` has an active agent with `isActive: true`
→ Verify `vault.json` exists and has valid boxes
→ Check console for `[MosaicBot]` startup logs

---

**Your Mosaic Bot is now a true ecosystem orchestrator.** 🎯
