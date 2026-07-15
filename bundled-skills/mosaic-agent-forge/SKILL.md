---
title: Mosaic Agent Forge
name: mosaic-agent-forge
version: '2.5'
description: Complete reference for the IDE-as-Agent-Forge feature in Mosaic Companion — the Code → Test → Deploy pipeline for agent development inside the built-in IDE. Now includes the Skill Delivery Pipeline (v2.5) that actually delivers skill files to fleet nodes.
version: '2.5.1'
author: Hermes Agent
summary: Complete reference for the IDE-as-Agent-Forge feature in Mosaic Companion — Code → Test → Deploy pipeline + Skill Delivery to fleet nodes + Skill Injection into local AI agents.
prerequisites:
  - Mosaic Companion codebase
  - Node.js 18+
  - esbuild
  - Docker (optional, for sandbox deploy)
  - WASM runtime (wasmer / wasmtime / javy — optional)
---

# Mosaic Agent Forge — IDE-as-Agent-Forge

## What It Does

The built-in IDE now has an agent template system. Users can write agent code in Monaco, test it in an isolated VM, and deploy it — either locally as a Node process, to a Docker sandbox, or across a fleet of nodes via SSH. Every action is logged to an append-only Chronicle for auditability.

**Before:** No way to develop agents inside Mosaic.
**After:** Built-in templates (ANFE minter, Fleet node, MCP server) with test runner, health monitoring, and one-click deploy.

**Where to find it:** Open Mosaic → IDE Page (top toolbar) → Click "Forge Agent" (Rocket icon).

---

## Architecture: 4 Layers Across the Process Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: RENDERER (React / TypeScript)                         │
│  ─────────────────────────────────────────────────────────────  │
│  IDEAgentForge.ts        → Session mgmt, UI state, IPC calls   │
│  FleetChronicleLogger.ts → Audit trail (renderer-side mirror)  │
│  FleetSandboxLauncher.ts → Docker dispatch via mesh:SSH        │
└──────────────────────────┬──────────────────────────────────────┘
                             │  IPC (ipcRenderer.invoke)
┌──────────────────────────▼──────────────────────────────────────┐
│  LAYER 2: PRELOAD (Context Bridge)                              │
│  ─────────────────────────────────────────────────────────────  │
│  preload.ts → Exposes window.electronAPI.stargate.* methods    │
└──────────────────────────┬──────────────────────────────────────┘
                             │
┌──────────────────────────▼──────────────────────────────────────┐
│  LAYER 3: MAIN PROCESS (Node / Electron)                        │
│  ─────────────────────────────────────────────────────────────  │
│  main.ts               → IPC handlers, dispatches to engine     │
│  AgentForgeEngine.ts   → Real bundler + VM + spawn + Docker    │
│  chronicle.ts          → Append-only JSONL audit log            │
│  wasm-launcher.ts      → Extism WASM sandbox (existing infra)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Code → Test → Deploy Pipeline

### Phase 1: Edit

```typescript
// Renderer: IDEAgentForge.ts
const session = ideAgentForge.createSession('anfe-minter', '/projects/my-agent');
// → Generates starter code from template library
// → Monaco editor edits session.code
// → Auto-persists to localStorage (forge_sessions_v2)
```

**Template Library** (defined in `IDEAgentForge.ts`):
- `anfe-minter` — Mints ANFE NFTs on Cardano using MeshJS
- `fleet-node` — Registers a node with the fleet mesh
- `mcp-adapter` — Starts an MCP (Model Context Protocol) adapter
- `custom` — Blank template

Each template defines expected exported functions for validation.

### Phase 2: Test

```typescript
// Renderer calls via IPC
const result = await ideAgentForge.runTest(session.id);
```

**Main process: `AgentForgeEngine.runTest()`**

```
1. esbuild.build()        → Bundle code into single JS
2. _bundleCodeWithDeps()  → Extract imports, install deps, resolve versions
3. vm.Script()            → Execute in isolated VM (no require, no fs, no network)
4. _validateTemplate()    → Check exported functions match template contract
5. Returns: { success, output, stage, durationMs, logs }
```

**4 Test Stages:**
1. Syntax check (esbuild compilation)
2. Bundle validation (output size, no undefined refs)
3. Runtime execution (vm.Script with 5s timeout)
4. Export validation (template contract enforcement)

### Phase 3: Deploy (Local)

```typescript
// Renderer calls via IPC
const result = await ideAgentForge.deployToFleet(session.id, {
  nodeId: 'node-42',
  autoStart: true,
  enableWallet: false,
  tier: 'standard',
});
```

**Main process: `AgentForgeEngine.deploy()`**

```
1. _bundleCodeWithDeps() → Production bundle + dependency install
2. Write to ~/.config/mosaic-companion/agents/<agentId>/
   - agent.js (bundled code)
   - manifest.json (runtime, permissions, tier, templateId)
   - package.json stub (for Node require resolution)
3. _spawnAgent() → spawn node agent.js
   - Env: FORGE_AGENT_ID, FORGE_TEMPLATE_ID, FORGE_TIER, NODE_ENV=production
4. Register in runningAgents Map
5. Enable health check (auto-restart)
6. Log to Chronicle
```

### Phase 4: Deploy (Docker Sandbox)

```typescript
// AgentForgeEngine.deployToSandbox()
1. Bundle code
2. Write to temp dir + generate Dockerfile
3. docker build -t forge-agent-<nodeId>:<timestamp>
4. docker run --memory=512m --cpus=1.0 --network=bridge ...
5. Log container ID to Chronicle
6. Clean up temp files
```

### Phase 5: Deploy (Cross-Node via SSH)

```typescript
// AgentForgeEngine.deployToNode()
1. Bundle code
2. scp bundle to remote host ~/.stargate/agents/<agentId>/
3. ssh <host> "node agent.js &"
4. Log deployment to Chronicle
```

Uses `UnifiedOrchestrator.dispatchToFleet()` for fleet-wide parallel deploy.

---

## Key Files and Their Roles

| File | Layer | Role |
|------|-------|------|
| `src/services/stargate/integrations/IDEAgentForge.ts` | Renderer | Session management, UI state, IPC delegation, persistence |
| `src/services/stargate/integrations/FleetChronicleLogger.ts` | Renderer | Audit trail wrapper, integrity hashing, query API |
| `src/services/stargate/integrations/FleetSandboxLauncher.ts` | Renderer | Docker command builder, mesh dispatch, tier management |
| `electron/preload.ts` | Preload | Exposes `stargate.*` methods to renderer via `ipcRenderer.invoke` |
| `electron/main.ts` | Main | IPC handlers, imports engine, dispatches calls |
| `electron/integrations/forge/AgentForgeEngine.ts` | Main | Core engine: bundle, test, deploy, health, WASM, Chronicle |
| `electron/integrations/sandbox/chronicle.ts` | Main | Append-only JSONL log, per-tool isolation, read/query API |
| `electron/integrations/forge/test-smoke.js` | Test | Structural validation (52 checks across all layers) |

---

## IPC Handler Registry (main.ts)

```typescript
ipcMain.handle("stargate:testAgentCode", async (_, code, templateId) =>
  agentForgeEngine.runTest(code, templateId));

ipcMain.handle("stargate:deployAgentCode", async (_, code, config) =>
  agentForgeEngine.deploy(code, config));

ipcMain.handle("stargate:deployAgentToNode", async (_, code, config) =>
  agentForgeEngine.deployToNode(code, config));

ipcMain.handle("stargate:forge:listDeployed", async () =>
  agentForgeEngine.getDeployedAgents());

ipcMain.handle("stargate:forge:listRunning", async () =>
  agentForgeEngine.getRunningAgents());

ipcMain.handle("stargate:forge:stopAgent", async (_, agentId) =>
  agentForgeEngine.stopAgent(agentId));

ipcMain.handle("stargate:forge:health:enable", async (_, agentId, intervalMs, maxRestarts) =>
  agentForgeEngine.enableHealthCheck(agentId, manifest, { intervalMs, maxRestarts }));

ipcMain.handle("stargate:forge:health:disable", async (_, agentId) =>
  agentForgeEngine.disableHealthCheck(agentId));

ipcMain.handle("stargate:forge:health:check", async (_, agentId) =>
  ({ healthy: agentForgeEngine.isHealthy(agentId) }));
```

---

## Health Monitoring (v2.2)

```typescript
// Enable: checks every 10s, restarts up to 3 times
agentForgeEngine.enableHealthCheck(agentId, manifest, {
  intervalMs: 10000,
  maxRestarts: 3,
});

// Logic:
// setInterval(() => {
//   if (!runningAgents.has(agentId)) {
//     if (restarts < maxRestarts) { spawn(); restarts++; }
//     else { disableHealthCheck(); log "max restarts reached"; }
//   }
// }, intervalMs);
```

**Renderer API:**
```typescript
await ideAgentForge.enableHealthCheck(agentId, 10000, 3);
await ideAgentForge.disableHealthCheck(agentId);
const { healthy } = await ideAgentForge.isHealthy(agentId);
```

---

## WASM Runtime (v2.4)

```typescript
// Auto-detect available engine, fallback to Node VM if none
const result = await agentForgeEngine.runTestWASM(code, templateId, {
  engine: "auto",  // or "javy" | "wasmer" | "wasmtime"
  timeoutMs: 10000,
});
```

**Detection priority:** javy → wasmer → wasmtime → null (fallback)

**WASI runner generation:** Wraps bundled code in IIFE with console.log output capture. Host functions: `mosaic_log`, `mosaic_write_output`.

**Why WASM:** True sandbox isolation — no filesystem, no network, memory-constrained. Node VM is a softer sandbox (no require by default but can be bypassed).

---

## Chronicle Integration (v2.4)

Every engine operation writes to `~/.config/mosaic-companion/chronicles/forge/chronicle.jsonl`:

```jsonl
{"id":"entry-...","timestamp":"2026-05-16T12:00:00Z","source":"core","type":"lifecycle","data":{"nodeId":"forge-anfe-minter-123","event":"forge:deploy","status":"success","detail":"agentId=..."}}
```

**Properties:**
- Append-only — no update/delete API
- Per-tool isolation (separate JSONL per tool ID)
- Chain-hash integrity (renderer-side `computeHash()` with prevHash linking)
- Graceful degradation — falls back to console.log if Chronicle unavailable

**API:**
```typescript
// Write
chronicle.append(toolId, source, type, data);
chronicle.logLifecycle(toolId, event, details);

// Read
chronicle.read(toolId, { source, type, after, before, limit });
```

---

## Testing Methodology

### Structural Smoke Test
```bash
cd electron/integrations/forge
node test-smoke.js
```

Validates 52 structural checks across all 4 layers:
- **AgentForgeEngine:** 34 checks (imports, methods, types, validation)
- **IDEAgentForge:** 9 checks (IPC delegation, persistence, lifecycle)
- **main.ts:** 6 checks (handlers, imports)
- **preload.ts:** 3 checks (exposed APIs)

### Functional Runtime Test
```bash
cd electron/integrations/forge
node test-functional.js
```

Tests actual execution (7 checks):
1. Syntax error detection
2. Bundle success
3. Timeout enforcement (5s)
4. Template export validation
5. Deploy manifest creation
6. Agent spawn + env vars
7. Stop/cleanup

**Always run both before pushing changes.** The structural test catches wiring issues; the functional test catches runtime bugs.

---

## Common Issues & Fixes

### Issue: `MODULE_NOT_FOUND` at runtime
**Cause:** Dependencies not installed before bundle.
**Fix:** Use `_bundleCodeWithDeps()` which calls `npm install --production` in a temp dir before esbuild.

### Issue: Agent spawns but exits immediately
**Cause:** Missing env vars or unhandled exception in bundled code.
**Fix:** Check `FORGE_AGENT_ID`, `FORGE_TEMPLATE_ID` env vars. Add `try/catch` at top level of agent code. Check `~/.config/mosaic-companion/logs/agent-forge.log`.

### Issue: Health check fires but agent doesn't restart
**Cause:** `enableHealthCheck()` not called after deploy.
**Fix:** Ensure `deploy()` calls `enableHealthCheck(agentId, manifest)` when `autoStart: true`.

### Issue: Chronicle entries not persisting
**Cause:** `getChronicle()` throws in non-Electron context (e.g., test).
**Fix:** In tests, call `setChronicleInstance(new Chronicle(tmpDir))` before engine operations.

### Issue: WASM test fails with "command not found"
**Cause:** No WASM runtime installed.
**Fix:** Install `javy` (`cargo install javy-cli`) or `wasmtime` (brew/apt). Engine auto-falls back to Node VM if none available.

### Issue: Cross-node deploy hangs
**Cause:** SSH key not configured or node unreachable.
**Fix:** Ensure `~/.ssh/id_rsa` is present and node is in `fleetNodes.json`. Check `UnifiedOrchestrator.dispatchToFleet()` logs.

### Issue: Docker sandbox fails with permission denied
**Cause:** Docker daemon not running or user not in docker group.
**Fix:** `sudo usermod -aG docker $USER` then re-login. Verify `docker ps` works.

### Issue: "Open Service" button does nothing — port is down but URL opens anyway
**Cause:** A UI button calls `window.open('http://127.0.0.1:PORT')` but nothing ever spawned the external service on that port. In dev, the developer often runs the service manually; in production, no code ever starts it.
**Fix Pattern:**
1. Add IPC method in `preload.ts` to delegate spawn to main process.
2. In `main.ts`, add IPC handler that spawns a `detached: true` + `.unref()` child process so the service survives app exit.
3. In the renderer component, replace direct `window.open` with async IPC `start` → wait → then open URL.
4. Add Docker-aware URL fallback (`host.docker.internal` instead of `127.0.0.1` when inside a container, via `/.dockerenv` or `/proc/self/cgroup`).
5. **CRITICAL — for `hermes dashboard` specifically:** add `--skip-build` to the spawn args. Without it, the dashboard tries to run `npm run build` internally, which often fails silently in production Electron contexts (npm/Node missing from env or web dist already exists), causing the server to never bind its port.
**Reference:** `references/electron-service-spawn-debugging.md` — full reproduction steps, code patterns, and verification checklist (2026-05-25 session).

### Issue: "Open Service" button always opens URL even when spawn fails — blind fallthrough masking real errors
**Cause:** The renderer click handler calls `openWindow('http://127.0.0.1:PORT')` in every branch — success, failure, and the catch block. This means the user sees a browser "site can't be reached" page instead of a clear error message, making debugging impossible.
**Fix Pattern:**
```typescript
// BEFORE (bad — opens dead URL on failure)
if (result.success && [...]) { openWindow(url); }
else { console.warn(...); openWindow(url); }   // ← still opens!

// AFTER (good — only open when verified ready)
if (result.success && (status === 'ready' || status === 'already-running')) {
  openWindow(url);
} else if (result.success && status === 'started-but-not-ready') {
  await new Promise(r => setTimeout(r, 1500));
  openWindow(url); // optimistic — already waited
} else {
  console.warn(...);
  alert('Service failed to start: ' + result.error); // ← user sees actual error
}
```
**Verification:** Temporarily break the IPC handler (e.g., change the command path to a non-existent binary). The UI should show an alert, NOT open a blank browser tab.

---

## Security Model

| Phase | Isolation Level | Notes |
|-------|-----------------|-------|
| Edit | None | User code in Monaco editor |
| Test | vm.Script | No context, 5s timeout, no require/fs/network |
| Deploy (local) | child_process | Limited env vars, stdio pipes, exit monitoring |
| Deploy (Docker) | Container | `--memory`, `--cpus`, `--network` constraints |
| Deploy (WASM) | WASI | Zero capabilities by default, host functions gated |
| Deploy (cross-node) | SSH | Runs on remote host with same Node constraints |

**Worst-case escape:** Docker container breakout (mitigated by rootless Docker / user namespaces). Node VM breakout is theoretically possible but requires V8 exploit.

---

## Extension Points

### Adding a New Template
1. Add entry to `TEMPLATES` array in `IDEAgentForge.ts`
2. Define `id`, `name`, `description`, `fileName`, `defaultCode`, `icon`, `inputs`
3. Add export validation in `AgentForgeEngine.TEMPLATE_EXPORTS`
4. Update smoke test if adding new exports

### Adding a New Deploy Target
1. Add method to `AgentForgeEngine` (e.g., `deployToKubernetes()`)
2. Add IPC handler in `main.ts`
3. Expose in `preload.ts`
4. Add renderer wrapper in `IDEAgentForge.ts`
5. Log to Chronicle via `_logToChronicle()`

### Adding a New WASM Engine
1. Add detection in `_detectWasmEngine()`
2. Add execution branch in `runTestWASM()`
3. Test with `test-smoke.js` regex update

### Removing a Third-Party Integration (Surgical Excision)
When a third-party MCP server or tool module must be cleanly removed from Mosaic without breaking the build, perform the following operations in order:

1. **Identify footprint** — Search all source (`electron/`, `src/`) for the integration name. Typical files:
   - Tool module: `electron/integrations/tools/modules/<name>.ts`
   - Registry import: `electron/integrations/tools/index.ts`
   - MCP auto-plugin: `electron/integrations/mcp/index.ts` (`ensureDefaultPlugins()` block)
   - Renderer UI: `src/components/AdaPortalPanel.tsx` or similar
   - Package manifest: `package.json` / `package-lock.json` (if npm dependency)

2. **Remove imports and registrations** — Delete `import { XxxModule }` and `registry.register(new XxxModule())` from the tool registry entry point.

3. **Strip MCP auto-plugin** — Delete the entire default-plugin registration block inside `ensureDefaultPlugins()`. Leave an empty stub or a comment indicating no default plugins are registered.

4. **Delete the module file** — Remove `modules/<name>.ts` entirely.

5. **Verify with build** — Run `npm run build` (or `tsc --noEmit` if available). The build must exit 0 with no new TypeScript errors introduced by the removal.

6. **Check for strays** — Re-run a case-insensitive search (`grep -ri '<name>' electron/ src/`) to confirm zero remaining references in source code (time-of-day comments in heartbeat types are false-positives and safe to ignore).

7. **Do NOT touch `package.json` unless asked** — If the dependency remains in `node_modules` but is no longer imported, it is harmless. Removing it from `package.json` is a separate concern that can break other transitive deps. Only remove if explicitly instructed.

**Reference:** See `references/surgical-integration-removal.md` for the exact Midnight excision example (file paths, line numbers, and diff patterns).

---

## Version History

| Version | Changes |
|---------|---------|
| v1.0 | Basic test + deploy (local Node only) |
| v2.0 | Template validation, 4-stage test, manifest system |
| v2.1 | Cross-node deploy via SSH (`deployToNode`) |
| v2.2 | Dependency resolution (`_bundleCodeWithDeps`), health monitoring |
| v2.3 | Docker sandbox deploy (`deployToSandbox`) |
| v2.4 | WASM runtime (`runTestWASM`), Chronicle integration (`_logToChronicle`) |
| v2.4.1 | Documented skill attachment cosmetic bug (see `references/skill-attachment-cosmetic-bug.md`) |
| v2.5.1 | Local AI Agent skill injection — agents like Basho (Claude, OpenAI, Ollama) now acquire skills via `SkillInjector` that reads `~/.hermes/skills/<skill>/SKILL.md` into system prompts before each `AIService.sendMessage()`. See `references/skill-injection-local-agents.md`. Also fleet sync via `HermesAgentOrchestrator._syncSkillsToNode()` (SCP). Test suite expanded from 52 to 82 checks. |
| **v2.6 (2026-05-26)** | **Vault Skills Bridge** — `SkillInjector` now falls back to the Mosaic Vault "Skills" box when a Hermes skill is not found. Skills can be defined and edited live in the Mosaic Vault UI. IPC-based main-process skill building ensures reliable file system access. See `references/vault-skills-bridge.md`. |

## Skill Delivery: Two Paths

Mosaic has **two different agent types**, each with its own skill delivery mechanism:

### Path A: Local AI Agents (e.g., Basho) — System Prompt Injection
See `references/skill-injection-local-agents.md` for full details.

These are chatbot providers (Claude, OpenAI, Hermes, Ollama) stored in `ai-agents.json`. Skills are loaded from `~/.hermes/skills/` by `SkillInjector` and injected as a `system` role message before every API call. The agent "acquires" the skill transiently — just for that conversation.

**Key files:** `src/services/skillInjector.ts`, `src/services/AIService.ts` (sendMessage hook)

### Path B: Fleet/Forge Agents — SCP File Delivery
See "Skill Delivery Pipeline (v2.5)" section below for full details.

These are Hermes kanban workers spawned on remote nodes via SSH. Skills are SCP'd to `~/.hermes/skills/stargate-incoming/`, verified, activated, and referenced in the kanban task body. The agent "acquires" the skill persistently — available for all future tasks.

**Key files:** `src/services/stargate/HermesAgentOrchestrator.ts`

---

## Skill Delivery Pipeline (v2.5)

### The Problem (v2.4 and earlier)

Skill attachment was **cosmetic only**. When a user attached `github-code-review` to an agent and deployed to fleet:

1. UI stored the attachment in a `Map<agentId, SkillAttachment>` — metadata only
2. `HermesAgentOrchestrator.hireAgent()` sent skill names as **plain text** in the kanban body
3. Remote Hermes received `"Skills: github-code-review"` as a sentence, not actual skill files
4. The agent ran with **generic context** — skill never loaded

### The Fix (v2.5): 4-Phase Delivery

```
User selects skill in AdaPortalPanel
         ↓
Renderer: window.electronAPI.skills.syncToNode({ skillNames, nodeId })
         ↓
Preload: ipcRenderer.invoke("stargate:skill:syncToNode", payload)
         ↓
Main Process: resolves skill path → SCP → verify → activate
         ↓
Remote node: skill files now exist in ~/.hermes/skills/<name>/
         ↓
Kanban dispatch: task body contains structured META: {...} JSON
         ↓
Remote worker: parses META, calls skill_view() before execution
```

### Phase 1: Skill File Sync (`_syncSkillsToNode()`)

```typescript
// HermesAgentOrchestrator.ts
private async _syncSkillsToNode(skillNames, nodeId, nodeHost?) {
  const remoteSkillDir = '~/.hermes/skills/stargate-incoming';
  for (const skillName of skillNames) {
    // 1. Resolve path: ~/.hermes/skills/<name>/ or ~/.hermes/skills/<cat>/<name>/
    const skillPath = this._resolveSkillPath(skillName);
    // 2. Resolve host from fleet registry
    const host = this._resolveNodeHost(nodeId);
    // 3. SSH: mkdir -p <remoteSkillDir>/<skillName>
    // 4. SCP -r entire directory (SKILL.md + references/ + scripts/)
  }
  return { synced, failed, remoteSkillDir };
}
```

**Path resolution** searches category subdirectories:
- Direct: `~/.hermes/skills/github-code-review/SKILL.md`
- Nested: `~/.hermes/skills/software-development/github-code-review/SKILL.md`

### Phase 2: Structured Dispatch

The kanban task body now embeds machine-readable metadata:

```typescript
const skillPayload = {
  __stargate_skills__: {
    required: ["github-code-review", "systematic-debugging"],
    synced: ["github-code-review"],
    verified: ["github-code-review"],
    remoteSkillDir: "~/.hermes/skills/stargate-incoming",
    computeTier: "standard",
    skillDelivery: "scp+activate",
  }
};
const taskBody = `Skills: ... | META: ${JSON.stringify(skillPayload)}`;
```

### Phase 3: Verification (`_verifySkillsOnNode()`)

```typescript
// SSH to remote, check SKILL.md exists in incoming dir
const check = await this._dispatchViaSSH(
  nodeId,
  `test -f ~/.hermes/skills/stargate-incoming/${skillName}/SKILL.md && echo OK`
);
// Returns: { loaded: [...], missing: [...] }
```

### Phase 4: Activation (`_activateSkillsOnNode()`)

```typescript
// Copy from staging into Hermes skills path
await this._dispatchViaSSH(
  nodeId,
  `mkdir -p ~/.hermes/skills && cp -r ${remoteSkillDir}/${skillName} ~/.hermes/skills/`
);
// Now remote Hermes can skill_view(skillName) — skill is ACTUALLY available
```

### UI Integration (AdaPortalPanel.tsx)

```typescript
// New state
const [selectedSkill, setSelectedSkill] = useState<any | null>(null);
const [skillSyncStatus, setSkillSyncStatus] = useState({ syncing: false, result: undefined });

// Click skill card → selects it
// Click "Deploy to Node" → calls syncToNode via IPC
// Shows: "Syncing..." → "✓ Skills activated: X" or "✗ Failed"
```

### IPC Registry (v2.5 additions)

```typescript
// preload.ts
skills: {
  syncToNode: (payload: { skillNames: string[]; nodeId: string; nodeHost?: string }) =>
    ipcRenderer.invoke("stargate:skill:syncToNode", payload),
}

// main.ts
ipcMain.handle("stargate:skill:syncToNode", async (_, payload) => {
  // Full pipeline: resolve → SCP → verify → activate
  // Returns: { success, synced, failed, verified, activated, remoteSkillDir, logs }
});
```

### Files Modified for v2.5

| File | Change |
|------|--------|
| `src/services/stargate/HermesAgentOrchestrator.ts` | Added _syncSkillsToNode, _verifySkillsOnNode, _activateSkillsOnNode, _resolveSkillPath, _resolveNodeHost, _scpDirectory |
| `electron/main.ts` | Added IPC handler `stargate:skill:syncToNode` |
| `electron/preload.ts` | Exposed `window.electronAPI.skills.syncToNode()` |
| `src/components/AdaPortalPanel.tsx` | Skill selection, sync status UI, "Deploy to Node" button |

### Verification

```bash
# Verify pipeline is wired
grep -n "stargate:skill:syncToNode" electron/main.ts
grep -n "skills.syncToNode" electron/preload.ts
grep -n "_syncSkillsToNode\|_verifySkillsOnNode\|_activateSkillsOnNode" src/services/stargate/HermesAgentOrchestrator.ts
grep -n "skillSyncStatus\|selectedSkill\|Deploy to Node" src/components/AdaPortalPanel.tsx
```

### Known Limitations

1. **Kanban worker preload** — The remote Hermes worker still needs to parse the `META: {...}` block from the task body and call `skill_view()` before execution. This requires modifying the kanban worker initialization in Hermes core.

2. **Node selector** — Currently hardcoded to `nodeId: 'r2d2'`. UI needs a dropdown of available fleet nodes.

3. **Retry logic** — If SCP fails (network blip), no automatic retry. Should add exponential backoff.

4. **Skill updates** — If a skill is updated locally, the remote node keeps the old version until manual re-sync.

---

## Quick Reference: End-to-End Flow

```typescript
// 1. Create
const session = ideAgentForge.createSession('anfe-minter', '/projects/my-agent');

// 2. Edit (Monaco → session.code)

// 3. Test
const test = await ideAgentForge.runTest(session.id);
// → Bundles → VM executes → validates → returns logs

// 4. Deploy (choose one)
const local = await ideAgentForge.deployToFleet(session.id, { nodeId: 'local' });
const remote = await ideAgentForge.deployToNode(session.id, { host: '192.168.1.42', user: 'admin' });

// 4a. Health Check (before querying or if deploy fails)
await ideAgentForge.enableHealthCheck(agentId, 10000, 3);
const { healthy } = await ideAgentForge.isHealthy(agentId);
if (!healthy) {
  // Agent process may have exited immediately or port is unresponsive.
  // Check host-side logs (not container logs) and verify the binary path.
}

// 5. Monitor
await ideAgentForge.enableHealthCheck(agentId, 10000, 3);
const { healthy } = await ideAgentForge.isHealthy(agentId);

// 6. Query
const running = await ideAgentForge.listRunningAgents();
const deployed = await ideAgentForge.listDeployedAgents();

// 7. Stop
await ideAgentForge.stopAgent(agentId);
```

---

## Files Modified During v2.4 Wiring

- `electron/integrations/forge/AgentForgeEngine.ts` — Core engine (all phases)
- `electron/integrations/forge/test-smoke.js` — Structural validation (52 checks)
- `electron/integrations/forge/test-functional.js` — Runtime validation (7 checks)
- `src/services/stargate/integrations/IDEAgentForge.ts` — Renderer service
- `electron/preload.ts` — IPC bridge exposure
- `electron/main.ts` — IPC handler registration

---

## Related Pitfalls

- See `systematic-debugging` skill: "Detached process cleanup" for Electron main-process child management.
- See `systematic-debugging/references/electron-popup-blank-window.md` for the **blank `about:blank` popup** pattern: `window.open(url, '_blank', 'noopener,noreferrer')` in Electron's sandboxed renderer fails to navigate because `noopener` severs the `BrowserWindowProxy` opener reference. The fix is to delegate to `shell.openExternal(url)` via IPC (`electronAPI.window.openExternal`).
- See `systematic-debugging/references/electron-popup-blank-window.md` also for the **HTTP readiness probe** pattern: after spawning a service from an IPC handler, poll `curl` for HTTP 200 before returning `'ready'` to the renderer; prevents the renderer from opening a URL on a port that isn't bound yet.
- See `systematic-debugging/references/electron-main-process-stale-build.md` for stale-build false positives when iterating on main-process code.
- `blockchain-node-ops` — For Electron agent deployment and node operations

## Consolidated Skills

This umbrella skill absorbed the following narrower siblings. See `references/` for their session-specific content:

| Absorbed Skill | Where its content lives | What it added |
|---|---|---|
| `electron-agent-forge` | `references/electron-agent-forge-*.md`, `scripts/electron-agent-forge-*.js`, `templates/electron-agent-forge-*.ts` | Sandbox bundling, VM testing, agent lifecycle engine details |
| `electron-linux-setup` | `references/electron-linux-setup-*.md` | Linux sandbox permissions, TypeScript merge fixes, native module rebuilds |

## Reference Files
- `references/skill-delivery-pipeline.md` — Full implementation: 4-phase SCP delivery (sync → kanban META → verify → activate)
- `references/skill-attachment-cosmetic-bug.md` — Historical bug: pre-v2.5 skill attachment was cosmetic only
- `references/skill-injection-local-agents.md` — Full implementation: how Mosaic local AI agents (Basho, etc.) acquire skills via system prompt injection
- `references/surgical-integration-removal.md` — Exact example of cleanly removing a third-party MCP server / tool module from Mosaic without breaking the build (Midnight excision, 2026-05-18)
- `references/electron-service-spawn-debugging.md` — Full pattern: UI "Open Service" button fails because external process was never spawned. Includes IPC bridge code, `detached`/`unref` child process patterns, Docker-aware URL fallback, and verification checklist. (2026-05-25 session)
- `references/mosaic-bot-multi-agent-orchestrator.md` — Multi-agent Mosaic Bot with Vault/MCP awareness, auto-skill importer, and Stargate fleet monitoring. (2026-06-30 session)
- `references/stargate-skill-delivery-debug-2026-05-29.md` — Stargate skill delivery fails with "no host resolved for node r2d2" when fleet registry is empty, plus Vault Record lookup crash during full-component debugging. (2026-05-29 session)

---

*Last updated: 2026-05-16*
*Tested: Structural 52/52, Functional 7/7*