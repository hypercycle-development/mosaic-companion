---
title: Electron Agent Forge
description: >
  Build a Code → Test → Deploy pipeline inside an Electron app.
  Covers sandboxed bundling (esbuild), isolated VM testing (vm.Script),
  real process deployment (child_process.spawn), and agent lifecycle
  management (deploy, list, stop, persist) within a Monaco/IDE context.
name: electron-agent-forge
trigger: |
  When building or debugging an IDE-as-Agent-Forge feature in an Electron app,
  or any Electron app that needs to bundle, sandbox-test, and deploy user-written
  TypeScript/JavaScript code with real execution.
---

# Electron Agent Forge

## When to use

- Electron app has a built-in IDE/Monaco editor where users write agent code
- Need to **test** user code safely without network/fs access
- Need to **deploy** tested code as a real running process
- Need **lifecycle management** (list deployed, list running, stop agents)
- Current implementation is "type-check only" or "file-save only" — not real execution

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐   │
│  │ Monaco IDE  │ → │ IDEAgentForge │ → │ ipc to main     │   │
│  │ (user code) │   │ (sessions,    │   │ (test/deploy)   │   │
│  │             │   │  persistence) │   │                 │   │
│  └─────────────┘   └─────────────┘   └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AgentForgeEngine                                    │   │
│  │ ├─ runTest():  syntax → bundle → VM → validate      │   │
│  │ ├─ deploy():   bundle → disk → spawn → register     │   │
│  │ ├─ getDeployedAgents():  read manifest.json files   │   │
│  │ ├─ getRunningAgents():   read in-memory Map         │   │
│  │ └─ stopAgent():          process.kill(SIGTERM)      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Test Pipeline (4 Stages)

| Stage | What | Tool | Safety |
|-------|------|------|--------|
| 1. Syntax | V8 parse, no execution | `new vm.Script(code)` | Zero side effects |
| 2. Bundle | Transpile + tree-shake | `esbuild.build({bundle:true, external:['*']})` | No dep resolution |
| 3. Runtime | Execute in isolated VM | `script.runInNewContext({console,exports,require})` | 5s timeout, no network/fs |
| 4. Template Val. | Check expected exports | String search in bundled output | Validates contract |

**VM Sandbox Context:**
```javascript
const context = {
  console: { log, error, warn },
  process: { env: {} },
  Buffer: { from: () => ({}) },
  setTimeout: () => 0,
  exports: {},
  module: { exports: {} },
  require: () => { throw new Error("require() not available in test VM"); },
};
```

## Deploy Pipeline (4 Steps)

| Step | Action | Output |
|------|--------|--------|
| 1. Bundle | Same esbuild as test + `npm install` for deps | `agent.js` (CJS) + resolved node_modules |
| 2. Write Disk | `agent.js` + `manifest.json` + `package.json` | `~/forge-agents/<id>/` |
| 3. Spawn | `child_process.spawn(node, ['agent.js'])` | Real PID |
| 4. Register | Add to `Map<string, {pid, manifest}>` | Lifecycle tracking |

**Dependency Resolution** (must run before esbuild for production deploys):
```typescript
// 1. Parse imports from source
const imports = [...code.matchAll(/import\s+.*?\s+from\s+["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((id) => !id.startsWith(".") && !id.startsWith("/"));

// 2. Write package.json with exact versions
fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
  name: agentId, version: "1.0.0", type: "module",
  dependencies: Object.fromEntries(
    imports.map((id) => [id, LATEST_KNOWN_VERSIONS[id] || "^1.0.0"])
  ),
}, null, 2));

// 3. Install before bundling
execSync(`cd "${dir}" && npm install --production`, { timeout: 120000, stdio: "pipe" });

// 4. Now esbuild can resolve real modules
const bundled = await esbuild.build({ entryPoints: [entryPath], bundle: true, format: "cjs", ... });
```

**Agent Directory Structure:**
```
~/forge-agents/forge-anfe-minter-1715864400000/
├── agent.js          # esbuild-bundled code
├── manifest.json     # ForgeAgentMetadata
└── package.json      # Node module stub (type: "module")
```

## Extended Deploy Targets (v2.1+)

### Cross-Node Deploy (SSH)
Push agent to a remote fleet node via SSH/SCP:
```typescript
async deployToNode(code, {
  templateId, nodeConfig: { host, user, agentDir }, autoStart, tier
}): Promise<ForgeDeployResult> {
  // 1. Bundle locally
  // 2. SCP bundle + manifest to remote
  // 3. SSH: npm install → node agent.js
  // 4. Return taskId for mesh:dispatch tracking
}
```

### Docker Sandbox (Fleet-grade isolation)
Run agent inside a Docker container with resource limits:
```typescript
async deployToSandbox(code, {
  templateId, nodeId, image = "node:22-alpine",
  memoryLimit = "512m", cpuLimit = 1.0, networkMode = "bridge"
}): Promise<ForgeDeployResult> {
  // 1. Bundle → write Dockerfile → docker build
  // 2. docker run --memory=512m --cpus=1.0 --network bridge
  // 3. Log containerId to Chronicle
}
```

### WASM Runtime (wasmer / wasmtime / javy)
Test/execute agent in a WASI sandbox with zero host access:
```typescript
async runTestWASM(code, templateId, { engine = "auto", timeoutMs = 10000 }) {
  const selected = engine === "auto" ? this._detectWasmEngine() : engine;
  if (!selected) return this.runTest(code, templateId); // fallback to Node VM
  // javy: compile JS → WASM → run
  // wasmer: run JS directly in WASI context
  // wasmtime: run with --dir mount
}
```

## Health Monitoring (v2.2)

Enable periodic heartbeat checks on spawned agents:
```typescript
enableHealthCheck(agentId, manifest, { intervalMs = 10000, maxRestarts = 3 }): void {
  // setInterval checks runningAgents Map
  // If missing and restarts < max → _spawnAgent(manifest)
  // If max restarts reached → disableHealthCheck(agentId)
}
```

**Always enable after successful spawn** in the deploy flow:
```typescript
if (autoStart) {
  const proc = this._spawnAgent(manifest);
  if (proc.success) {
    this.runningAgents.set(agentId, { pid: proc.pid, manifest });
    this.enableHealthCheck(agentId, manifest); // <-- critical
  }
}
```

## IPC Wiring (Required — v2 base + v2.1+ extensions)

**Main → Preload (v2 base):**
```typescript
// main.ts
ipcMain.handle("stargate:testAgentCode", async (_e, code, templateId) =>
  agentForgeEngine.runTest(code, templateId));
ipcMain.handle("stargate:deployAgentCode", async (_e, code, config) =>
  agentForgeEngine.deploy(code, config));
ipcMain.handle("stargate:forge:listDeployed", async () =>
  ({ success: true, agents: agentForgeEngine.getDeployedAgents() }));
ipcMain.handle("stargate:forge:listRunning", async () =>
  ({ success: true, agents: agentForgeEngine.getRunningAgents() }));
ipcMain.handle("stargate:forge:stopAgent", async (_e, agentId) =>
  ({ success: agentForgeEngine.stopAgent(agentId) }));
```

**v2.1+ Cross-Node Deploy:**
```typescript
ipcMain.handle("stargate:deployAgentToNode", async (_e, code, config) =>
  agentForgeEngine.deployToNode(code, config));
```

**v2.2+ Health Monitoring:**
```typescript
ipcMain.handle("stargate:forge:enableHealth", async (_e, agentId, interval, maxRestarts) => {
  const manifest = agentForgeEngine.getDeployedAgents().find(a => a.id === agentId);
  if (!manifest) return { success: false, error: "Agent not found" };
  agentForgeEngine.enableHealthCheck(agentId, manifest, { intervalMs: interval, maxRestarts });
  return { success: true };
});
ipcMain.handle("stargate:forge:disableHealth", async (_e, agentId) => {
  agentForgeEngine.disableHealthCheck(agentId);
  return { success: true };
});
ipcMain.handle("stargate:forge:isHealthy", async (_e, agentId) =>
  ({ healthy: agentForgeEngine.isHealthy(agentId) }));
```

**preload.ts exposure:**
```typescript
listDeployedAgents: () => ipcRenderer.invoke("stargate:forge:listDeployed"),
listRunningAgents: () => ipcRenderer.invoke("stargate:forge:listRunning"),
stopAgent: (id) => ipcRenderer.invoke("stargate:forge:stopAgent", id),
deployToNode: (code, cfg) => ipcRenderer.invoke("stargate:deployAgentToNode", code, cfg),
enableHealthCheck: (id, i, m) => ipcRenderer.invoke("stargate:forge:enableHealth", id, i, m),
disableHealthCheck: (id) => ipcRenderer.invoke("stargate:forge:disableHealth", id),
isHealthy: (id) => ipcRenderer.invoke("stargate:forge:isHealthy", id),
```

## Renderer Service Pattern

**Typed IPC helper** (avoids repetitive `window.electronAPI` checks):
```typescript
private _ipc(method: string, ...args: any[]): Promise<any> {
  const api = (window as any).electronAPI?.stargate;
  if (!api?.[method]) {
    return Promise.reject(new Error(`IPC method stargate.${method} not available`));
  }
  return api[method](...args);
}
```

**Session persistence** (survives page refresh):
```typescript
private readonly PERSIST_KEY = 'forge_sessions_v2';
private _persistSessions(): void {
  localStorage.setItem(this.PERSIST_KEY, JSON.stringify(Array.from(this.sessions.values())));
}
restoreSessions(): void {
  const raw = localStorage.getItem(this.PERSIST_KEY);
  if (raw) JSON.parse(raw).forEach((s) => this.sessions.set(s.id, s));
}
```

## Chronicle Integration (v2.3+)

All forge operations must log to the main-process **Chronicle** (append-only JSONL):
```typescript
import { getChronicle } from "../sandbox/chronicle";

private _logToChronicle(nodeId, event, status, detail) {
  try {
    const chronicle = getChronicle();
    chronicle.append("forge", "core", "lifecycle", {
      nodeId, event, status, detail,
      category: "ide", timestamp: Date.now(),
    });
  } catch {
    console.log(`[Chronicle-fallback] ${event} ${status}`);
  }
}
```

Log points:
- `forge:test` (success/failed) — after VM execution
- `forge:deploy` (success/failed) — after spawn
- `forge:health:restart` (warning) — when auto-restart fires
- `forge:wasm:test` (success/failed) — after WASM execution
- `forge:sandbox:deploy` (success/failed) — after Docker run

## Pitfalls

1. **esbuild is a runtime dependency** — The engine calls `require("esbuild")` at runtime, not just at build time. Ensure esbuild is in `dependencies`, not just `devDependencies`.
2. **VM timeout is mandatory** — Never run user code in `vm` without a timeout. `runInNewContext` with `timeout: 5000` prevents infinite loops.
3. **External all imports during bundle** — `external: ["*"]` prevents esbuild from trying to resolve user imports during the test phase. The deployed process handles real imports; the test VM stubs them.
4. **Type module vs commonjs mismatch** — esbuild `format: "cjs"` for bundling, but the agent directory's `package.json` should have `"type": "module"` only if the agent code is ESM. Match the bundle format to the spawn format.
5. **localStorage persistence size limit** — Session code can be large. If >5MB, localStorage throws. Consider `indexedDB` or writing to disk via IPC for large sessions.
6. **`os` import required for WASM temp dirs** — `runTestWASM` uses `os.tmpdir()` for WASI runner staging. Ensure `import * as os from "os"` is present in `AgentForgeEngine.ts`.
7. **Health check must be explicitly enabled after spawn** — `enableHealthCheck()` is NOT automatic. Call it immediately after `this.runningAgents.set()` in the deploy flow.
8. **WASM fallback must delegate to `runTest`** — When `_detectWasmEngine()` returns `null`, `runTestWASM` should `return this.runTest(code, templateId)` — not throw. The Node VM fallback is the guaranteed baseline.
9. **Chronicle writes from main process only** — The `getChronicle()` singleton uses `require("electron")` internally and crashes if called from the renderer. Always log from main; renderer uses `FleetChronicleLogger` as a read/query mirror.
10. **Dependency resolution is a separate pre-bundle step** — `npm install` must run BEFORE `esbuild.build()` for production deploys. Test bundles use `external: ["*"]`; deploy bundles need real module resolution.

## Verification Steps

After implementation, validate with these structural checks:

```bash
cd electron/integrations/forge && node test-smoke.js
```

Expected: all groups pass (AgentForgeEngine, IDEAgentForge, main.ts, preload.ts).
v2.4 adds 11 new checks for: `deployToNode`, `deployToSandbox`, `enableHealthCheck`,
`_extractImports`, `_bundleCodeWithDeps`, `_logToChronicle`, `runTestWASM`, `_buildWasiRunner`.

Then validate the functional pipeline:

```bash
node test-functional.js
```

Expected: esbuild bundles sample code → VM executes without error → exports detected.

### Smoke Test Regex Reference
The smoke test uses string-includes checks. If you rename a method, update the test:
```javascript
{ group: "AgentForgeEngine", name: "imports child_process.spawn",
  test: (s) => s.includes('import { spawn, execSync } from "child_process"') }
```

## References

- `references/agent-forge-architecture.md` — Full session transcript with root cause analysis and ADRs
- `references/v2-extensions.md` — Cross-node deploy, Docker sandbox, WASM runtime, health monitoring, Chronicle wiring (this session)
- `templates/AgentForgeEngine.ts` — Production-ready engine template
- `templates/IDEAgentForge.ts` — Renderer-side service template with persistence
- `scripts/test-smoke.js` — Structural validator (v2.4: 52 checks across 4 groups)
- `scripts/test-functional.js` — esbuild+VM functional pipeline validator
