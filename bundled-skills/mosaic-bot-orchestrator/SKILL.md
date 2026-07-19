---
name: mosaic-bot-orchestrator
description: Wire Mosaic Companion's autonomous heartbeat bot (Mosaic Bot) to Vault knowledge, MCP servers, agent configs, infrastructure monitoring, and auto-skill importing. Covers single-agent and multi-agent orchestrator patterns.
version: '2.0'
author: Hermes Agent
summary: |
  Turn Mosaic Bot from a generic timer into a proactive ecosystem monitor. Supports both
  single-agent and multi-agent (Orchestrator + Coder + Local) architectures. Wires
  heartbeat prompts to Vault boxes, MCP servers, AI agents, HyperAIBox fleet health,
  and auto-imports Hermes skills. Covers the full stack: main process, preload bridge,
  and React renderer panel.
prerequisites:
  - Mosaic Companion codebase
  - Node.js 18+
  - TypeScript / esbuild
  - Electron main process familiarity
  - React / Tailwind for renderer panel
---

# Mosaic Bot Orchestrator

## What It Does

Mosaic Bot ships with a basic heartbeat — wakes every 30 minutes, sends a generic prompt to the active LLM, delivers any non-trivial response as an alert. **By default it is blind** to your Vault boxes, your MCP servers, your other agents, your infrastructure, and your skill ecosystem.

The **Orchestrator pattern** fixes this. It reads runtime config files and injects a structured system prompt into every heartbeat tick so the bot:
- Knows which Vault boxes exist and how many entries they have
- Knows which MCP servers are connected and what they do
- Knows which AI agents are configured and which is active
- **Pings Stargate/HyperAIBox infrastructure** and alerts on failures
- **Auto-imports new Hermes skills** as they're added to `~/.hermes/skills/`
- Detects new Vault entries since the last check
- Only alerts when something actually needs attention

**Before:** Generic prompt → generic alerts (or none).
**After:** Ecosystem-aware prompt → targeted, actionable alerts from multiple specialized agents.

---

## Architecture

### Single-Agent Mode (v1)

```
Heartbeat Tick (every 30 min)
    │
    ▼
┌─────────────────────────────────────────────┐
│  onReply() in index.ts                      │
│  1. buildOrchestratorContext()               │
│     ├── read vault.json → box list + counts │
│     ├── read mcp-plugins.json → server list │
│     ├── read ai-agents.json → agent configs │
│     └── detect vault changes since last tick│
│  2. buildSystemPrompt(ctx)                   │
│  3. callActiveLLM(enrichedPrompt, system)   │
│  4. Strip HEARTBEAT_OK → deliver or suppress│
└─────────────────────────────────────────────┘
```

### Multi-Agent Mode (v2)

```
┌─────────────────────────────────────────────┐
│              startHeartbeatRunner()          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  main    │ │  coder   │ │  local   │     │
│  │ 30 min   │ │ 60 min   │ │ 15 min   │     │
│  │ 09-22h   │ │ 10-20h   │ │ 24/7     │     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘     │
│       └─────────────┼─────────────┘         │
│                     ▼                         │
│         buildOrchestratorContext()           │
│         (shared across all agents)           │
│                     │                         │
│       ┌─────────────┼─────────────┐          │
│       ▼             ▼             ▼          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │Orchestr.│  │Code Rev.│  │Lightw.  │     │
│  │system   │  │system   │  │system   │     │
│  │prompt   │  │prompt   │  │prompt   │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       └─────────────┼─────────────┘         │
│                     ▼                         │
│            callActiveLLM()                   │
│            (same agent config)               │
└─────────────────────────────────────────────┘
```

Each agent profile defines:
- `agentId`: "main" | "coder" | "local"
- `intervalMs`: heartbeat frequency
- `activeHours`: { start, end } — time window
- `memorySearch`: { query, maxResults, maxInjectedChars } — per-agent memory context
- `description`: what this agent monitors

The shared `buildOrchestratorContext()` runs once and the result is cached across agents on the same tick.

---

## Files

| File | Role |
|------|------|
| `electron/integrations/mosaicbot/src/main/orchestrator.ts` | Reads configs, builds context, constructs system prompt, pings infrastructure |
| `electron/integrations/mosaicbot/src/main/skill-importer.ts` | Watches `~/.hermes/skills/`, auto-imports Tier 1, queues Tier 2 |
| `electron/integrations/mosaicbot/src/main/index.ts` | Wires orchestrator + importer + multi-agent profiles into heartbeat |
| `electron/integrations/mosaicbot/src/preload.ts` | Bridges main process APIs to renderer (MUST expose new IPC handlers) |
| `src/components/MosaicBotPanel.tsx` | React UI — tabs for Overview, Skills, Importer, Infrastructure |
| `bundled-skills/mosaic-orchestrator/SKILL.md` | Skill definition for agent self-awareness |
| `bundled-skills/stargate-doctor/SKILL.md` | Infrastructure diagnostic skill |
| `bundled-skills/auto-skill-importer/SKILL.md` | Skill importer documentation |
| `~/.config/mosaic-companion/ai-agents.json` | Active agent + `boxAccess` array |
| `~/.config/mosaic-companion/vault.json` | Box metadata |
| `~/.config/mosaic-companion/vault-content/*.json` | Per-box entries |
| `~/.config/mosaic-companion/mcp-plugins.json` | MCP server configs |

---

## Multi-Agent Configuration

### Agent Profiles in `index.ts`

```typescript
const AGENT_PROFILES = [
  {
    agentId: "main",
    heartbeat: {
      enabled: true,
      intervalMs: 30 * 60_000,        // 30 minutes
      channel: "ipc",
      to: "renderer",
      ackMaxChars: 300,
      activeHours: { start: "09:00", end: "22:00" },
      memorySearch: {
        query: "pending tasks actions reminders urgent deadline stargate",
        maxResults: 5,
        maxInjectedChars: 2000,
      },
    },
    description: "Orchestrator — monitors vault, MCPs, infrastructure...",
  },
  {
    agentId: "coder",
    heartbeat: {
      enabled: true,
      intervalMs: 60 * 60_000,        // 60 minutes
      ackMaxChars: 500,
      activeHours: { start: "10:00", end: "20:00" },
      memorySearch: {
        query: "github pull request review code quality test failing build error",
        maxResults: 5,
        maxInjectedChars: 2000,
      },
    },
    description: "Code Review — monitors code quality, PRs, tests...",
  },
  {
    agentId: "local",
    heartbeat: {
      enabled: true,
      intervalMs: 15 * 60_000,        // 15 minutes
      ackMaxChars: 200,
      activeHours: { start: "00:00", end: "23:59" },
      memorySearch: {
        query: "quick status check health ping alive",
        maxResults: 3,
        maxInjectedChars: 1000,
      },
    },
    description: "Local — lightweight qwen-based rapid status checks...",
  },
];
```

### Agent-Specific System Prompt Overlays

Each agent gets a different overlay appended to the shared system prompt:

```typescript
function getAgentOverlay(agentId: string): string {
  switch (agentId) {
    case "main":
      return "You are the Mosaic Orchestrator...";
    case "coder":
      return "You are the Code Review Agent...";
    case "local":
      return "You are the Local Agent (qwen)...";
  }
}
```

---

## Enabling Orchestrator Mode

### 1. Ensure an Active Agent Exists

Settings → AI Agents → Create agent → Toggle **Active**.

### 2. Grant Vault Access via `boxAccess`

Edit `ai-agents.json` and add the `boxAccess` field:

```json
{
  "id": "mosaic-main",
  "name": "Mosaic Orchestrator",
  "provider": "ollama",
  "model": "llama3.1",
  "isActive": true,
  "boxAccess": ["skills", "taste-skills", "training-logs", "midnight-quest"]
}
```

Box IDs must match the boxes created in the Vault UI.

### 3. Create Vault Boxes

In Mosaic Companion → Vault, create boxes with descriptive names. The orchestrator counts entries per box and reports this to the LLM.

**Programmatic creation** (from the session):
```typescript
const sgBox = {
  id: `box-stargate-doctor-${Date.now()}`,
  name: "Stargate Doctor",
  description: "Diagnostic knowledge for Stargate Pool...",
  sourceType: "manual",
  createdAt: Date.now(),
  updatedAt: Date.now()
};
vaultConfig.boxes.push(sgBox);
// Also create vault-content/${box.id}.json with { boxId, entries: [] }
```

### 4. Add MCP Servers

In Settings → MCP, add servers. The orchestrator auto-discovers them from `mcp-plugins.json` — no code changes needed.

### 5. Restart the App

The bot will load all skills and begin enriched monitoring on the next tick.

---

## Auto-Skill Importer

### How It Works

The `skill-importer.ts` module:
1. Uses `fs.watch()` on `~/.hermes/skills/` (recursive) — ⚠️ MUST attach an `error` handler or an EACCES in the watched tree crashes the whole main process (see pitfall below)
2. Detects new/updated `SKILL.md` files
3. Parses YAML frontmatter for name, description, version, trigger
4. **Tier 1** (critical skills) → auto-copied to `bundled-skills/`
5. **Tier 2** (all others) → queued as "pending approval"
6. Polls every 5 minutes as fallback

### Skill Auto-Import Strategy: Blacklist-First (User Preference)

**User preference (established session):** Auto-import ALL skills except an explicit blacklist. Whitelist approaches leave 90%+ of skills stuck in "pending approval" and frustrate users who expect their full skill library to be available immediately.

```typescript
// ✅ CORRECT — Blacklist-only: import everything except dangerous ones
const BLACKLIST = new Set(["godmode"]);
const MAX_FILE_BYTES = 512_000;
// All non-blacklisted skills auto-import immediately
```

**Wrong approach (do NOT use):**
```typescript
// ❌ WRONG — Whitelist leaves most skills pending
const TIER1_AUTO_IMPORT = new Set(["mosaic-stargate", ...]); // Only 11 of 181 imported
```

### Learning Layer — Pattern Memory

The bot records every heartbeat and auto-detects patterns. ⚠️ Patterns MUST be full-rebuilt from the latest window each cycle, never appended — see the "Learning Layer — Pattern Memory (MUST reconcile, never append)" section below for the memory-poisoning pitfall.

```typescript
recordHeartbeatObservation(alertText, infraState);
```

Auto-detected patterns (injected into future system prompts):
- **Recurring failures**: "X has failed N/M recent checks — chronic issue suspected"
- **Alert frequency**: "High alert frequency: N/M recent heartbeats triggered alerts"
- **Time clustering**: "Alerts cluster around HH:00 (N times in last 10 checks)"

These patterns evolve the bot's understanding over time without code changes.

### IPC Commands (Renderer → Main)

```typescript
ipcRenderer.invoke("skills:import-log")     // All import history
ipcRenderer.invoke("skills:pending")        // Skills awaiting approval
ipcRenderer.invoke("skills:approve", name)   // Approve a Tier 2 skill
ipcRenderer.invoke("skills:remove", name)    // Remove an imported skill
ipcRenderer.invoke("skills:force-scan")     // Trigger immediate scan
```

### Pitfall: Recursive `fs.watch` MUST Have an Error Handler (main-process crash, hit 2026-07-01)

`fs.watch(dir, { recursive: true })` emits **async errors on the watcher's event emitter** — e.g. `EACCES` when the recursive walker hits an unreadable (root-owned) subdirectory that appears at runtime. With no `error` handler, Node escalates it to an **uncaught exception that crashes the entire Electron main process** ("A JavaScript error occurred in the main process" dialog).

Real trigger: a kanban worker running as root created `~/.hermes/skills/.../.hermes-tmp.*` and root-owned skill dirs inside the watched tree; the watcher walked into them minutes after boot and killed the app.

```typescript
// ✅ CORRECT — degrade to polling instead of crashing
try {
  watcher = watch(HERMES_SKILLS_DIR, { recursive: true }, onChange);
  watcher.on("error", (err: NodeJS.ErrnoException) => {
    console.warn(`[SkillImporter] Watcher error (${err.code}) — disabling watcher, polling still active`);
    try { watcher?.close(); } catch { /* dead */ }
    watcher = null;
  });
} catch (e) {
  watcher = null; // sync failure — polling fallback covers us
}
```

Cleanup + prevention: `chown -R user:user ~/.hermes/skills/`, then hunt the root-run process (`ps aux | grep hermes` for root-owned hermes workers) — root-owned files in a user home watched tree are the config smell to fix at the source. Same rule applies to ANY `fs.watch`/`server.listen` style API with async error events: attach the handler or the main process dies (see also the EADDRINUSE pitfall in `references/heartbeat-tool-loop.md`).

### Pitfall: `scanAndImport` Must Be Exported

The `forceScan` IPC handler calls `scanAndImport()` from the skill-importer module. If `scanAndImport` is not exported, the IPC call fails silently:

```typescript
// ❌ WRONG — internal function, IPC fails
async function scanAndImport(): Promise<...> { ... }

// ✅ CORRECT — exported for IPC
export async function scanAndImport(): Promise<...> { ... }
```

---

## Infrastructure Monitoring (Stargate Doctor)

### Health Check Endpoints — CRITICAL BUG FIX (2026-07-03)

**⚠️ PITFALL:** The bot was reporting "[CRITICAL] Fleet Down" when services were actually UP.
Root cause: Wrong health check endpoints in orchestrator.ts lines 387-393.

**Wrong endpoints (causing false alerts):**
- SPO: `:9100/api/health` (expects 200) → Actually returns 404, ANY response = healthy
- C-3PO: `:8100/health` (expects 200) → Connection refused, use `:9000/` (Docker proxy)
- R2-D2: `:8100/health` (expects 200) → Connection refused, use `:9001/` (Docker proxy)

**Correct endpoints:**
```typescript
const checks: InfrastructureCheck[] = [
  // SPO: ANY response on :9100 = healthy (no /health endpoint exists)
  { name: "SPO", url: "http://192.168.0.112:9100/", expectedStatus: 404, timeout: 5000 },
  // HBA Tiller: ANY TCP response = healthy (Docker proxy returns 404)
  { name: "C-3PO Tiller", url: "http://192.168.0.150:9000/", expectedStatus: 404, timeout: 3000 },
  { name: "R2-D2 Tiller", url: "http://192.168.0.38:9001/", expectedStatus: 404, timeout: 3000 },
];
```

**Health check logic fix:**
```typescript
// For HBA tiller ports (404 expected), treat ANY response as healthy
const isHealthy = check.name.includes("Tiller") || check.name === "SPO" 
  ? result.latencyMs !== undefined  // Got any response = healthy
  : result.healthy;                // Normal HTTP check for others
```

**Dynamic IP discovery for C-3PO:**
C-3PO's IP changes after reboot (DHCP lease). Last known: .150 (was .151).
If SSH fails, scan: `for ip in 192.168.0.{100..160}; do timeout 2 bash -c "echo >/dev/tcp/$ip/22" 2>/dev/null && echo "Found: $ip"; done`

**Verification:** After restart, bot should show ✅ for all services, not 🔴 CRITICAL alerts.

---

## Evolution Wiring — From Alerts to Skill Creation (2026-07-03)

**Problem:** Bot has `create_skill: true` and `forge_tool: true` in allowlist but NEVER uses them.
Heartbeats only alert, never propose skill creation.

**Root cause:** No evolution trigger. Bot detects patterns but doesn't act on them.

**Fix applied in heartbeat-tools.ts:**
```typescript
// Evolution trigger: if alert contains repeated pattern, propose skill creation
const finalText = loop.finalText || "HEARTBEAT_OK";
if (finalText !== "HEARTBEAT_OK" && !finalText.startsWith("ok")) {
  const shouldPropose = await checkEvolutionTrigger(finalText, toolCalls);
  if (shouldPropose) {
    console.log(`[EvolutionTrigger] Detected repeated pattern, proposing skill...`);
  }
}

// Detects: "SPO is down", "C-3PO unreachable", "fleet down", "IP changed", etc.
async function checkEvolutionTrigger(alertText: string, toolCalls: any[]): Promise<boolean> {
  const repeatedPatterns = [
    "SPO is down", "C-3PO unreachable", "R2-D2 unreachable",
    "fleet down", "network partition", "IP changed", "C-3PO IP",
  ];
  return repeatedPatterns.some(p => alertText.toLowerCase().includes(p.toLowerCase()));
}
```

**Next steps for full evolution:**
1. Add `propose_skill` tool → Queue proposals in SQLite pending table
2. Create UI for user approval → Review proposals, approve/reject
3. Implement actual skill creation → After approval, write SKILL.md to `~/mosaicbot/skills/`
4. Add outcome verification → Did the skill solve the problem?

**Evolution pipeline:**
```
Heartbeat → Detect pattern → Propose skill → User approves → Create skill → Verify → Repeat
```

---

## Critical Fix: Load 198 Skills into Runtime (2026-07-03)

**Problem:** Bot only loaded 8 skills from `.../mosaicbot/bundled-skills/` while 198 skills existed in `~/mosaic-companion/bundled-skills/`

**Root cause:** `defaultSkillSources()` in `skills/loader.ts` pointed to wrong directory:
```typescript
// ❌ WRONG — only 8 legacy runtime skills
{ dir: path.join(__dirname, "../../bundled-skills"), source: "bundled" }

// ✅ CORRECT — 198 imported skills + 8 legacy + user-authored
{ dir: path.join(__dirname, "../../../../../../bundled-skills"), source: "bundled" },      // 198
{ dir: path.join(__dirname, "../../bundled-skills"), source: "extra" },                   // 8
{ dir: path.join(appDir, "skills"), source: "managed" },                                   // user
```

**Files changed:**
- `skills/loader.ts` — Updated `defaultSkillSources()` with correct paths
- `verification-layer.ts` — Added `MAIN_BUNDLED_SKILLS` constant
- `heartbeat-tools.ts` — Updated `findSkillFile()` to check all paths
- `index.ts` — Added `skills:count` and `skills:verify` IPC handlers

**Skill count verification:**
```typescript
// PRIMARY: 198 imported skills (auto-imported from ~/.hermes/skills/)
// LEGACY: 8 runtime skills (backwards compatibility)
// USER: 0 bot-authored (ready for evolution)
// TOTAL: 206 skills (was reporting 8)
```

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `orchestrator.ts` | Fixed health endpoints (lines 387-469) |
| `orchestrator.ts` | Added proper isHealthy logic for non-200 responses |
| `orchestrator.ts` | Added live box status updates |
| `orchestrator.ts` | Added "DO NOT focus on kanban" rule |
| `heartbeat-tools.ts` | Added evolution trigger (lines 556-590) |
| `heartbeat-tools.ts` | Added checkEvolutionTrigger() function |
| `skills/loader.ts` | Fixed skill paths to load 198 imported skills |
| `verification-layer.ts` | Added MAIN_BUNDLED_SKILLS constant |
| `index.ts` | Added skills:count and skills:verify IPC handlers |

---

## Original Infrastructure Section

### Tiller Port Discovery

Tiller ports are dynamic (9000-9003). Must scan all ports:

```typescript
for (let port = 9000; port <= 9003; port++) {
  const result = await pingEndpoint({
    url: `http://${ip}:${port}/health`, timeout: 2000
  });
  if (result.healthy) { /* found tiller */ }
}
```

### Alert Priority

| Condition | Priority |
|-----------|----------|
| SPO down | 🔴 CRITICAL |
| Both HBAs down | 🔴 CRITICAL |
| One HBA down | 🟠 HIGH |
| No tiller found | 🟡 MEDIUM |
| Registration broken | 🟡 MEDIUM |

---

## Preload Script Wiring

### The Problem

The renderer (React) cannot directly call main process IPC. The **preload script** must explicitly expose each handler:

```typescript
// electron/integrations/mosaicbot/src/preload.ts
contextBridge.exposeInMainWorld("agent", {
  // Existing APIs
  send: (text: string) => ipcRenderer.invoke("agent:send", text),
  listSkills: () => ipcRenderer.invoke("skills:list"),
  // ...

  // NEW: Orchestrator APIs
  getOrchestratorStatus: () => ipcRenderer.invoke("orchestrator:status"),
  getAgentProfiles: () => ipcRenderer.invoke("agents:profiles"),

  // NEW: Skill Importer APIs
  getImportLog: () => ipcRenderer.invoke("skills:import-log"),
  getPendingImports: () => ipcRenderer.invoke("skills:pending"),
  approveSkill: (name: string) => ipcRenderer.invoke("skills:approve", name),
  removeSkill: (name: string) => ipcRenderer.invoke("skills:remove", name),
  forceScan: () => ipcRenderer.invoke("skills:force-scan"),
});
```

### The Corresponding IPC Handlers

```typescript
// electron/integrations/mosaicbot/src/main/index.ts
ipcMain.handle("skills:import-log", () => getImportLog());
ipcmain.handle("skills:pending", () => getPendingImports());
ipcmain.handle("skills:approve", (_e, name: string) => approveSkill(name));
ipcmain.handle("skills:remove", (_e, name: string) => removeSkill(name));
ipcmain.handle("skills:force-scan", async () => scanAndImport());
ipcmain.handle("orchestrator:status", () => getOrchestratorStatus());
ipcmain.handle("agents:profiles", () => AGENT_PROFILES.map(...));
```

### TypeScript Types

Update `global.d.ts` to add the new methods to the `Window` interface so TypeScript compiles:

```typescript
interface Window {
  agent?: {
    // ... existing methods ...
    getOrchestratorStatus: () => Promise<{ vaultBoxes, mcpServers, agents, ... }>;
    getAgentProfiles: () => Promise<Array<{ agentId, intervalMin, ... }>>;
    getImportLog: () => Promise<Array<{ hermesPath, version, status }>>;
    getPendingImports: () => Promise<Array<{ hermesPath, version }>>;
    approveSkill: (name: string) => Promise<boolean>;
    removeSkill: (name: string) => Promise<boolean>;
    forceScan: () => Promise<{ imported, pending, skipped }>;
  };
}
```

**Pitfall:** If the preload script is not updated, the UI panel will show "unavailable" or empty values even though the main process has the data.

---

## React Panel Design

### Tab Layout

```
┌───────────────────────────────────────────────┐
│ MOSAIC BOT · Orchestrator · 3 agents · 4 skills│
├────────┬────────┬──────────┬─────────────────┤
│Overview│Skills  │Importer  │ Infrastructure  │
├────────┴────────┴──────────┴─────────────────┤
│                                               │
│  Overview tab:                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │Memory  │ │Skills  │ │Orch.   │ │Importer││
│  │0 files │ │ 4      │ │4 boxes │ │ 0      ││
│  └────────┘ └────────┘ └────────┘ └────────┘│
│                                               │
│  Agent Profiles                               │
│  ┌─────────────────────────────────────┐     │
│  │ main · 30 min · 09:00 → 22:00      │     │
│  │ coder · 60 min · 10:00 → 20:00     │     │
│  │ local · 15 min · 24/7              │     │
│  └─────────────────────────────────────┘     │
└───────────────────────────────────────────────┘
```

### Auto-Refresh

The panel should poll status every 30 seconds:

```typescript
useEffect(() => {
  loadAll();
  const interval = setInterval(loadAll, 30000);
  return () => clearInterval(interval);
}, [loadAll]);
```

---

## Alert Rules Tuning

Edit the system prompt text in `buildSystemPrompt()` to change what the bot considers alert-worthy:

```typescript
lines.push("## Alert Rules");
lines.push("- DO NOT alert on routine success.");
lines.push("- DO alert on: blocked kanban tasks, MCP disconnections, new Vault entries, infra failures...");
lines.push("- SPO down = CRITICAL (blocks all pool operations)");
lines.push("- Both HBAs down = CRITICAL (no compute available)");
lines.push("- If nothing needs attention, reply exactly: HEARTBEAT_OK");
lines.push("- Keep alerts under 300 chars.");
```

---

## Heartbeat Frequency

Edit `index.ts` → change `intervalMs` per agent:

```typescript
heartbeat: {
  enabled: true,
  intervalMs: 30 * 60_000, // 30 minutes for main
  // ...
}
```

---

## Extending with New Data Sources

To add a new data source (e.g., GitHub PR status, CI pipeline health):

### Step 1: Add a reader in `orchestrator.ts`

```typescript
async function readGitHubSummary(): Promise<string> {
  try {
    const resp = await fetch('https://api.github.com/repos/.../pulls?state=open');
    const data = await resp.json();
    return `${data.length} open PRs`;
  } catch {
    return 'GitHub status unavailable';
  }
}
```

### Step 2: Inject into `buildSystemPrompt()`

```typescript
const githubSummary = await readGitHubSummary();
lines.push("## GitHub Status");
lines.push(githubSummary);
lines.push("");
```

### Step 3: Rebuild

```bash
npm run build:electron
```

---

## Vault Entry Creation (Programmatic)

To create vault entries from code (e.g., auto-generated documentation):

```typescript
// Read existing vault.json
const vaultPath = path.join(app.getPath("userData"), "vault.json");
const vaultConfig = JSON.parse(fs.readFileSync(vaultPath, "utf-8"));

// Add new box
const newBox = {
  id: `box-${Date.now()}`,
  name: "My New Box",
  description: "Auto-generated docs",
  sourceType: "manual",
  createdAt: Date.now(),
  updatedAt: Date.now()
};
vaultConfig.boxes.push(newBox);
fs.writeFileSync(vaultPath, JSON.stringify(vaultConfig, null, 2));

// Create content file
const content = {
  boxId: newBox.id,
  entries: [{
    id: `entry-${Date.now()}`,
    label: "my-entry",
    content: "# Documentation\n\n...",
    createdAt: Date.now(),
    updatedAt: Date.now()
  }]
};
const contentDir = path.join(app.getPath("userData"), "vault-content");
fs.writeFileSync(
  path.join(contentDir, `${newBox.id}.json`),
  JSON.stringify(content, null, 2)
);
```

---

## Verification

After restarting, check the Electron console for:

```
[MosaicBot] 4 skills loaded: /mosaic_orchestrator, /stargate_doctor, /auto_skill_importer
[MosaicBot] Skill importer started — watching ~/.hermes/skills
[Heartbeat] main @ 2026-06-30T...
[Orchestrator] Vault: 4 boxes found
[Orchestrator] MCP: 10 servers configured
[Orchestrator] Infrastructure: 1 critical, 1 high
```

If you see `→ sent`, the bot found something worth alerting about.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No active AI agent configured" | No agent with `isActive: true` | Create agent in Settings → AI Agents |
| Heartbeats reply `ok-token`, log shows `Agent "main" not found in ai-agents.json` | Profile ID passed as agentId to callActiveLLM, but profiles aren't ai-agents entries | Fall back to the active agent in llm.ts when named lookup fails (see references/heartbeat-tool-loop.md pitfall 7) |
| "No Vault boxes found" | `vault.json` missing or empty | Create boxes in Vault UI |
| UI shows "unavailable" for all status | Preload script not updated | Restart app completely (quit + reopen) |
| Skills tab empty | No bundled skills or preload broken | Check `bundled-skills/` directory exists |
| Importer shows nothing | No new skills in `~/.hermes/skills/` | Add a skill there or click Force Scan |
| Infrastructure shows "Orchestrator not available" | Main process not initialized | Wait 5-10s after app start |
| `skills:force-scan` fails silently | `scanAndImport` not exported | Add `export` keyword to function |
| Alerts not showing in UI | IPC channel disabled | Ensure `config.channels.ipc.enabled = true` |
| Build fails after adding orchestrator | Import path mismatch | Check `.js` extension in imports (ESM) |

---

## Pitfall: Import Path Resolution

`index.ts` and `orchestrator.ts` are bundled by esbuild as ESM. All relative imports MUST include `.js` extension even though the source files are `.ts`:

```typescript
// ✅ CORRECT
import { buildOrchestratorContext } from "./orchestrator.js";

// ❌ WRONG — build fails with "Cannot find module"
import { buildOrchestratorContext } from "./orchestrator";
```

This is because esbuild outputs `.js` files and the import statements are not rewritten.

---

## Pitfall: `buildSystemPrompt` vs `buildOrchestratorSystemPrompt`

During the session, the first patch mistakenly referenced `buildOrchestratorSystemPrompt` which did not exist. The correct function name is `buildSystemPrompt` (exported from `orchestrator.ts`). Always verify function names with `grep` before patching:

```bash
grep "^export function" electron/integrations/mosaicbot/src/main/orchestrator.ts
```

---

## Pitfall: UI Shows Empty After Code Changes

If you update main-process code but the UI still shows old values:

1. **Check preload script** — did you add the new IPC handlers to `preload.ts`?
2. **Check TypeScript types** — did you update `global.d.ts` with new method signatures?
3. **Full restart** — preload is loaded at app startup, not on renderer reload
4. **Verify IPC handlers** — did you add `ipcMain.handle(...)` in `index.ts`?

The full chain: `UI → preload.ts → IPC → main process → data source`. Any break in this chain causes "unavailable".

---

## Memory Bridge — Codebase Memory MCP Integration

The bot's local SQLite memory only indexes its own workspace (shows 0 files on fresh install). For ecosystem awareness, bridge to the **codebase-memory MCP** knowledge graph:

```typescript
// Query recent session context from the knowledge graph
const context = await getRecentSessionContext();
// Returns: { recentSkills, recentProjects, activeBoxes, recentTasks, patterns }

// Inject into heartbeat system prompt
if (ctx.sessionContext) {
  lines.push("## Recent Activity (From Knowledge Graph)");
  lines.push(`- Recently touched skills: ${sc.recentSkills.slice(0, 10).join(", ")}`);
}
```

This makes the bot aware of:
- Which skills we've been working on
- Which projects are active
- Patterns detected across sessions

See `references/memory-bridge.md` for full implementation.

## Learning Layer — Pattern Memory (MUST reconcile, never append)

The bot records every heartbeat and auto-detects patterns over time:

```typescript
recordHeartbeatObservation(alertText, infraState);
```

⚠️ **CRITICAL PITFALL (memory poisoning, hit 2026-07-01):** the original `learnFromHistory()` *loaded old patterns and appended new ones forever*. Result: 20 stale entries like "SPO has failed 10/10 recent checks — chronic issue suspected" survived long after SPO was fixed, got injected into every prompt, and the bot confidently reported "SPO DOWN — 8th consecutive failure" while a live `curl` showed SPO healthy and heartbeat-history had 0 failures in 100 records. The LLM picked the scarier stale story over the live fleet summary in the same prompt.

**Correct design (loop-engineering: reconcile state, don't accumulate):**
1. **Full-rebuild each cycle** — start from `[]`, derive patterns only from the latest N-check window, then `saveLearnedPatterns(unique)` replaces the file. Recoveries clear stale claims automatically.
2. **Chronic claims require failing NOW** — only emit "chronic issue" for components unhealthy in the *latest* check AND ≥3 fails in the window.
3. **Emit recovery signals** — components that failed earlier in the window but are healthy now get an explicit "X RECOVERED — do not report as down" pattern, which actively counters LLM anchoring on old alerts.
4. **After deploying the fix, purge the poisoned file** — `learned-patterns.json` keeps stale entries otherwise: `echo '[]' > ~/.config/mosaic-companion/mosaicbot/learned-patterns.json`.

Diagnosis path when the bot reports failures that contradict reality: verify the endpoint live with curl → check `learned-patterns.json` for stale claims → check `heartbeat-history.json` infraState for actual recent failures. If patterns say "down" but history says healthy, memory is poisoned.

Full session detail + loop-engineering primitive mapping: `references/pattern-memory-reconciliation.md`.

## Agent Capability Gap Diagnosis and Repair

When a Mosaic Bot agent appears "repetitive" or "only focuses on X", the root cause is almost always a **narrow skill manifest** in `ai-agents.json`. The bot may have 277 skills available in the codebase, but if only 6 are assigned to the agent, it will be artificially limited.

### Symptom: Agent is "Repetitive" or "Only Focuses on Kanban"

**User signal:** "My Mosaic Bot is repetitive only focusing on Kanban"

**Diagnosis:** Check the agent's `skills` array in `~/.config/mosaic-companion/ai-agents.json`:

```bash
# Quick check
cat ~/.config/mosaic-companion/ai-agents.json | python3 -c "
import json,sys
d = json.load(sys.stdin)
for a in d:
    if a.get('isActive'):
        print(f\"Agent: {a.get('name')} ({a.get('id')})\")
        print(f\"  Skills: {len(a.get('skills', []))}\")
        print(f\"  Boxes: {len(a.get('boxAccess', []))}\")
        print(f\"  First 5 skills: {a.get('skills', [])[:5]}\")
"
```

**Expected:** 50+ skills including stargate, axi, infrastructure categories.
**Problem:** Only 6 skills like `["kanban-orchestrator", "obsidian", "test-driven-development", "Hermes Agent", "Codex CLI", "Claude Code"]`.

### Root Cause: Two bundled-skills Directories

The Mosaic Bot loads skills from **multiple sources** with different content:

| Path | Skills | Purpose |
|------|--------|---------|
| `~/mosaic-companion/bundled-skills/` | ~277 | **Main skill library** (converted from ~/.hermes/skills/) |
| `electron/integrations/mosaicbot/bundled-skills/` | 8 | Legacy runtime skills shipped with the bot |

The `skills/loader.ts` `defaultSkillSources()` function must point to **both**:

```typescript
// ✅ CORRECT — loads all 277 + 8 + user skills
{ dir: path.join(__dirname, "../../../../../../bundled-skills"), source: "bundled" },  // 277
{ dir: path.join(__dirname, "../../bundled-skills"), source: "extra" },                 // 8
{ dir: path.join(appDir, "skills"), source: "managed" },                                // user
```

### The Fix: Expand Agent Skills

Create a Python upgrade script that merges new skills while preserving existing config:

```python
#!/usr/bin/env python3
"""Upgrade agent manifest with full Stargate ecosystem."""
import json
import shutil
from datetime import datetime

CONFIG_PATH = "~/.config/mosaic-companion/ai-agents.json"
BACKUP_PATH = CONFIG_PATH + ".backup"

# Essential skills for a full-capability Mosaic Bot agent
STARGATE_ESSENTIAL_SKILLS = [
    "mosaic-orchestrator",
    "mosaic-bot-orchestrator",
    "stargate-mastery",
    "stargate-doctor-v2",
    "stargate-doctor",
    "auto-skill-importer",
    "infrastructure-fleet",
    "axi-forge",
    "axi-integration",
    "axi-tool-forge",
    "axi-executor",
    "mosaic-stargate",
    "stargate-component-registry-pattern",
    "hypercycle-aimifier",
    "hypercycle-node-manager-ops",
    "ai-agency-architect",
    "agentic-system-evolution",
    "mosaic-bot-multi-agent-orchestrator",
    "mosaic-agent-forge",
    "mosaic-discovery-first-aim-orchestration",
    "mcp-codebase-memory-mcp",
    "codebase-memory-mcp",
    "memory-bridge-connector",
]

STARGATE_ESSENTIAL_BOXES = [
    "box-stargate-doctor",
    "box-stargate-registry",
    "box-stargate-pool",
    "box-stargate-fleet",
    "box-stargate-anfes",
    "box-stargate-aims",
    "box-stargate-bundles",
    "box-stargate-marketplace",
    "box-mosaicbot-discoveries",
    "box-axi-forge-history",
    "box-evolution-proposals",
    "box-pattern-memory",
]

def upgrade_agent(agent_id):
    shutil.copy2(CONFIG_PATH, BACKUP_PATH)
    
    with open(CONFIG_PATH, 'r') as f:
        agents = json.load(f)
    
    for agent in agents:
        if agent.get('id') == agent_id:
            # Merge skills (preserve existing, add new)
            existing = set(agent.get('skills', []))
            added = [s for s in STARGATE_ESSENTIAL_SKILLS if s not in existing]
            agent['skills'] = list(existing.union(STARGATE_ESSENTIAL_SKILLS))
            
            # Merge boxes
            existing_boxes = set(agent.get('boxAccess', []))
            agent['boxAccess'] = list(existing_boxes.union(STARGATE_ESSENTIAL_BOXES))
            
            # Ensure capabilities section
            if 'capabilities' not in agent:
                agent['capabilities'] = {
                    'toolAccess': ['tool-stargate-mastery', 'tool-axi-forge'],
                    'vaultBoxes': ['box-mosaicbot-discoveries'],
                }
            
            print(f"Upgraded {agent['name']}: +{len(added)} skills, +{len(added_boxes)} boxes")
    
    with open(CONFIG_PATH, 'w') as f:
        json.dump(agents, f, indent=2)

if __name__ == "__main__":
    upgrade_agent("agent-1778856633811")  # Basho
```

### Verification After Upgrade

1. **Skill count check:**
   ```bash
   cat ~/.config/mosaic-companion/ai-agents.json | grep -c '"skills"'
   # Should show 50+ entries
   ```

2. **Key skills present:**
   ```bash
   cat ~/.config/mosaic-companion/ai-agents.json | grep -E "(stargate-mastery|axi-forge|mosaic-bot-orchestrator)"
   ```

3. **Restart Mosaic Companion** to reload agent config

4. **Create vault boxes** matching new `boxAccess` entries

### Prevention: Agent Manifest Template

When creating new agents, use this template in `ai-agents.json`:

```json
{
  "id": "agent-<timestamp>",
  "name": "Mosaic Agent",
  "provider": "hermes-aim",
  "model": "kimi-k2.6",
  "isActive": true,
  "skills": [
    "=== CORE ORCHESTRATION ===",
    "mosaic-orchestrator",
    "mosaic-bot-orchestrator",
    "mosaic-bot-multi-agent-orchestrator",
    "=== STARGATE ECOSYSTEM ===",
    "mosaic-stargate",
    "stargate-mastery",
    "stargate-doctor-v2",
    "stargate-component-registry-pattern",
    "=== TOOL FORGING ===",
    "axi-forge",
    "axi-integration",
    "axi-tool-forge",
    "mosaic-agent-forge",
    "=== AI AGENCY ===",
    "ai-agency-architect",
    "agentic-system-evolution",
    "=== INFRASTRUCTURE ===",
    "infrastructure-fleet",
    "hypercycle-aimifier",
    "hypercycle-node-manager-ops",
    "=== KNOWLEDGE ===",
    "mcp-codebase-memory-mcp",
    "memory-bridge-connector",
    "gbrain-project-tracking"
  ],
  "boxAccess": [
    "box-skills-main",
    "box-mosaicbot-discoveries",
    "box-stargate-registry",
    "box-stargate-pool",
    "box-stargate-fleet"
  ],
  "capabilities": {
    "toolAccess": ["tool-stargate-mastery", "tool-axi-forge", "tool-skill-importer"],
    "vaultBoxes": ["box-mosaicbot-discoveries"]
  }
}
```

**Rule of thumb:** An agent with fewer than 20 skills is probably under-capacity for ecosystem work.

## Related Skills

- `mosaic-stargate` — Stargate module (pools, AIMs, marketplace). Add fleet monitoring by reading SPO `/api/v1/boxes`.
- `mosaic-agent-forge` — IDE Code→Test→Deploy pipeline. Bot can alert on failed deployments via Chronicle.
- `vault-tools` — Vault read/write tools for agents. Bot uses these indirectly via context injection.
- `kanban-orchestrator` — Multi-agent task routing. Use when the bot needs to create kanban tasks.
- `mcp/codebase-memory-mcp` — The codebase-memory MCP server itself. Query knowledge graph, index repositories.
- `hypercycle-node-manager-ops` — HyperCycle Node Manager operational knowledge. Use for HyperAIBox fleet diagnostics, tiller discovery, and non-custodial compute delegation.
- `stargate-component-registry-pattern` — Catalog all Stargate components (UI, services, MCPs, infrastructure) in a single registry for bot self-awareness.
- `memory-bridge-pattern` — Bridge local SQLite memory to codebase-memory MCP (194k nodes) for session context injection.

## Reference Files
- `references/mosaic-bot-orchestrator-wiring.md` — Full session transcript: what was built, files touched, build verification, and the complete wiring guide delivered to the user.
- `references/skill-consciousness-pattern.md` — Making the bot aware of its own 150 skills: SKILL_GUIDE families with triggers/bestFor/chains, dual injection (system prompt + searchable `memory/SKILL-CONSCIOUSNESS.md` regenerated each boot), and the 5 meta-rules for autonomous evolution (2026-07-01).
- `references/multi-agent-architecture.md` — Multi-agent profiles, schedules, and system prompt overlays.
- `references/skill-importer.md` — Auto-import implementation, blacklist-first strategy, and IPC API.
- `references/preload-wiring.md` — Preload script patterns, TypeScript type updates, and common UI wiring pitfalls.
- `references/memory-bridge.md` — Codebase-memory MCP integration: querying graph, indexing sessions, injecting context into prompts.
- `references/stargate-component-registry-pattern.md` — How to make the bot self-aware of all Stargate components (38 components, dependency chains, capability reports).
- `references/axi-integration-architecture.md` — AXI (Agent eXperience Interface) integration: teaching Mosaic Bot to scaffold, build, aimify, and deploy agent-native CLI tools through Stargate into HyperAIBox Node Factories.
- Forge history persistence: the bot records every aimify/deploy in its own `axi.sqlite` (init at boot step 10 with idempotent tool seeding, `closeAxiStore()` in `stop()`, `axi:forge-history` IPC for reflection). Full recipe: `axi-forge` skill → `references/forge-history-sqlite-store.md`.
- `references/heartbeat-tool-loop.md` — Provider-agnostic ReAct tool loop for heartbeats (2026-07-01): plain-text `TOOL: <name> {json}` protocol working on all 8 LLM providers, 5-round budget, allowlist-gated write tools (deny-by-default `axi-allowlist.json`), `load_skill` content loading, `vault_record` write-back to a "Mosaic Bot Discoveries" box, 15-min fleet telemetry cron. Includes 7 critical pitfalls (spawn() encoding, Forge strict-tsc, EADDRINUSE async crash, persisted mcp-plugins.json, Electron better-sqlite3, async-in-sync builders, profile-ID vs ai-agents.json lookup failure) + verified first-heartbeat baseline (healthy fleet → zero tool calls is correct).
- `references/pattern-memory-reconciliation.md` — Memory-poisoning incident + fix (2026-07-01): append-only learned patterns caused the bot to hallucinate "SPO DOWN — 8th consecutive failure" against a healthy fleet. Reconcile-don't-append design, recovery signals, purge command, diagnosis recipe, and loop-engineering primitive gap analysis (maker/checker + STATE.md as next upgrades).
- `references/outcome-scoring-self-evolution.md` — Reinforcement layer + self-evolution tools (2026-07-01): `action_outcomes` table scores every write action against ground truth (kanban sqlite / telemetry / filesystem — never ask the LLM if its own action worked), scorecard injected into prompts with a "<50% success → stop" rule; `create_skill` (bot authors SKILL.md), `forge_tool` (delegates AXI tool builds to backend-eng via kanban with axi-forge skill pinned — the skill must exist in the worker profile's skills/ dir or the pin crashes the worker), FACT DISCIPLINE anti-fabrication rule, and the 5-capability gap ranking (build outcome scoring first).
  ⚠️ STORAGE MOVED (user preference, 2026-07-01 final revision): `create_skill` writes to Mosaic's OWN dir `userData/mosaicbot/skills/mosaicbot-authored/<name>/SKILL.md` — NOT `~/.hermes/skills/`. The user wants bot-authored artifacts self-contained inside Mosaic Companion, no Hermes dependency. This path is already scanned by the bot's `defaultSkillSources()` managed source, so authored skills load natively on boot. `load_skill` and the outcome verifier both check the Mosaic path first (highest precedence). `forge_tool` stays hybrid deliberately: Mosaic decides what to build + verifies (specs/tools/history all Mosaic-side); Hermes kanban workers are only the interchangeable execution muscle — future fully-native paths are SPO→AIM fleet builds or an embedded builder agent.
- `references/mosaic-native-skill-storage.md` — create_skill relocation to Mosaic's own userData (2026-07-01): user preference that bot-authored artifacts live inside Mosaic Companion, not ~/.hermes; the existing `defaultSkillSources()` managed dir made native loading free; grep-for-old-path pitfall when a path is referenced across tool + verifier files; forge_tool's deliberate hybrid boundary (Mosaic decides/verifies, Hermes executes).
- `references/kanban-moa-orchestration.md` — STATE.md reconciled world state (NOW BUILT: `world-state.ts`, runtime reconciles issues with firstSeen/lastSeen, "STATE.md wins over memory" rule), kanban-bridge.ts direct SQLite access to `~/.hermes/kanban/boards/<slug>/kanban.db` (read tools + gated comment/unblock), worker "protocol violation" triage rule (rc=0 without kanban_complete = signal missed not work failed; 3+ identical crashes = broken profile, don't unblock-loop), MOA delegation via `hermes kanban create/swarm` CLI with decision ladder, and two pitfalls: standalone `hermes kanban daemon` races the gateway dispatcher (dispatch_in_gateway is default-on — never systemd it alongside a gateway), and Electron stdout buffering can freeze the start log while the app runs fine (verify boot via filesystem artifacts: allowlist mtime, STATE.md, sqlite telemetry timestamps; clear stale Singleton* locks before relaunch). For the systemic worker "protocol violation" epidemic itself (flat `model:` key routing cloud models to the wrong provider → HTTP 404 → rc=0 exit; canary-verify before mass-unblock; never assign the fix task to a broken profile), see `kanban-orchestrator` → `references/model-provider-misrouting-incident.md`.