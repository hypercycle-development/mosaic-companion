---
title: HyperAIBox Fleet Diagnostics
name: hyperaibox-fleet-manager
description: Discover, diagnose, fix, and manage HyperAIBox compute nodes for Stargate Pool
author: Mosaic Bot
version: 1.0.0
tags: [hyperaibox, stargate, fleet, diagnostics, ssh, tiller, hba]
---

# HyperAIBox Fleet Diagnostics & Management

## What Are HyperAIBoxes?

Arm64 compute nodes running HyperCycle Node software. Each box runs:
- **Node Manager** (:8006) — HyperCycle node API
- **HBA Agent** (:8100) — Stargate Pool heartbeat agent
- **Tiller** (:9000-9003) — AIM slot provisioning service (Docker container)
- **Docker** — Container runtime

## Live Fleet (as of last check)

| Box | IP | Status | Tiller | Slots | Box ID | Notes |
|-----|-----|--------|--------|-------|--------|-------|
| C-3PO | 192.168.0.150 | 🟢 Online | :9000 | **128** | e1d0fab6aba3a3c1 | IP changed from .151 after reboot |
| R2D2 | 192.168.0.38 | 🟢 Online | :9001 | 8 | r2d2-80ad4ea14c33cd2a | Stable IP |

**SPO** (Stargate Pool Orchestrator) at 192.168.0.112:9100 is **DEPLOYED and RUNNING** as systemd user service `spo-server.service`.

## Critical Discovery: IP Address Behavior

**C-3PO CHANGES IP AFTER REBOOT**
- DHCP lease not renewed with same IP
- Scan subnet .100-.160 after any reboot
- Update `stargate-registry.ts` with new IP
- **Also update hardcoded `status: "down"` → `status: "operational"`** ~~in the registry or the UI will show everything as down~~
+ *(Fixed: Registry now has dynamic health checking)*

## Step-by-Step Diagnostics

### ⚠️ PITFALL: Registry Status is NOT Live (FIXED)

~~The `stargate-registry.ts` file has **hardcoded** `status: "down"` for infra components. This means the Mosaic Bot UI will show SPO, C-3PO, and R2D2 as DOWN even when they're actually online.~~

**FIXED (2026-07-02)**: The registry now has dynamic health checking via `syncRegistryStatus()`. 

**Legacy Fix (if needed for reference)**: After verifying boxes are actually working, manually update the registry:
```typescript
// stargate-registry.ts
{ id: "spo-host", status: "operational", ... }
{ id: "c3po-hba", status: "operational", healthEndpoint: "http://192.168.0.150:8100/health", ... }
{ id: "r2d2-hba", status: "operational", healthEndpoint: "http://192.168.0.38:8100/health", ... }
```

**Note**: The HBA health endpoint is `/health` (returns `{"status":"ok"}`), NOT `/api/health` (returns 404).

### Dynamic Health Sync (NEW)

The registry now auto-updates status via health checks:

```typescript
// Import from stargate-registry.ts
import { syncRegistryStatus, getRegistryStatusReport } from "./stargate-registry";

// One-shot sync
const results = await syncRegistryStatus(5000); // 5s timeout

// Or use the CLI script
npx tsx scripts/sync-stargate-registry.ts --once

// Get status report
const report = getRegistryStatusReport();
// → { components: {...}, fleet: {...}, downComponents: [...] }
```

**Run as daemon:**
```bash
npx tsx scripts/sync-stargate-registry.ts --interval 30000 --verbose
```

### 1. Check if Boxes are Alive

```bash
# Ping known IPs
ping -c 3 192.168.0.150  # C-3PO
ping -c 3 192.168.0.38   # R2D2

# If no response, scan subnet
for i in $(seq 100 160); do
  ping -c 1 -W 0.5 192.168.0.$i > /dev/null 2>&1 && echo "192.168.0.$i ALIVE"
done
```

### 2. Verify SSH Access

```bash
ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
  -i ~/.ssh/id_ed25519 hyperai@192.168.0.150 "hostname; uptime"
```

### 3. Check HBA (HyperAIBox Agent)

```bash
# External check
curl -s --connect-timeout 5 http://192.168.0.150:8100/health
# Expected: {"status": "ok", "agent": "hba", "version": "1.0.0"}

# If not responding, SSH in and check:
ssh hyperai@192.168.0.150 "ps aux | grep hba_agent | grep -v grep"
ssh hyperai@192.168.0.150 "ss -tlnp | grep 8100"
```

### 4. Check Node Manager

```bash
curl -s http://192.168.0.150:8006/api/info | python3 -m json.tool | head -40
```
Returns: node_version, node_id, hardware specs, uptime, AIM slots.

### 5. Check Tiller

```bash
# IMPORTANT: Tiller endpoint is /list, NOT /health
curl -s http://192.168.0.150:9000/list
# Expected: {"available":8,"tillers":[]}

# /health returns 404 — this is normal, not a bug
```

### 6. Check HBA from HBA Logs (on the box itself)

```bash
ssh hyperai@192.168.0.150 "tail -5 /home/hyperai/stargate/hba.log | strings | grep -E 'Heartbeat|WARNING'"
```

Note: HBA log may be binary (contains null bytes). Use `strings` to extract readable text.

## HBA Heartbeat Endpoints

The real HBA agent sends heartbeats to:
```
POST /api/v1/boxes/{box_id}/heartbeat
```

NOT to `/api/heartbeat` (the older flat endpoint). The SPO server must support both:
- `/api/heartbeat` — Legacy/test heartbeats
- `/api/v1/boxes/{box_id}/heartbeat` — Real HBA agent heartbeats

## SPO Deployment

### Standalone SPO Server (for testing)

```bash
# Run directly (not as part of Electron)
cd ~/mosaic-companion
node spo-server-standalone.js
```

### Systemd Service (production)

```bash
# Service file: ~/.config/systemd/user/spo-server.service
# Already installed — just check status:
systemctl --user status spo-server.service
systemctl --user restart spo-server.service

# View logs:
journalctl --user -u spo-server.service -f
```

### ⚠️ PITFALL: Dual SPO = EADDRINUSE Crash Dialog

Mosaic Companion's `electron/main.ts` ALSO starts an embedded SPO on :9100. With the systemd `spo-server.service` running, the embedded `server.listen()` fails — and **the failure is an async `error` event, NOT a throw**, so a `try/catch` around `startSPOServer()` does NOT catch it. Result: "Uncaught Exception: listen EADDRINUSE 0.0.0.0:9100" error dialog in the main process.

**Fix (two layers, both needed):**
1. In `main.ts`: probe `http://127.0.0.1:9100/api/health` (1.5s timeout) BEFORE calling `startSPOServer()`; if an external SPO responds, skip the embedded server.
2. In `SPOServer.ts`: attach `server.on("error", (err) => { if (err.code === "EADDRINUSE") { warn + set server=null } })` **before** `server.listen()` as a race-condition safety net.

This pattern applies to ANY embedded HTTP server in Electron that might conflict with a system service.

### ⚠️ PITFALL: Persisted MCP plugin config overrides code defaults

`midnight-mcp` boots with "Failed to initialize vector store ... 'Method Not Allowed' is not valid JSON" because it defaults Chroma to `localhost:8000` — but on this host **port 8000 is HyperCycle `controller_serve`, NOT ChromaDB** (identify owners with `ss -tlnp | grep :8000`). Fix by setting `CHROMA_URL` to an unused port (connection refused → clean in-memory fallback).

**Footgun**: fixing the env in `electron/integrations/mcp/index.ts` is NOT enough — plugin definitions are **persisted** to `~/.config/mosaic-companion/mcp-plugins.json` at first registration, and the persisted copy wins on subsequent boots. Update BOTH the code default AND the persisted JSON.

### SPO Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/heartbeat` | POST | Legacy heartbeat (for testing) |
| `/api/v1/boxes/{id}/heartbeat` | POST | Real HBA heartbeat |
| `/api/register` | POST | Register a box |
| `/api/unregister` | POST | Unregister a box |
| `/api/v1/boxes` | GET | List all boxes |
| `/api/v1/boxes/{id}` | GET | Get single box |
| `/api/pool` | GET | Pool status summary |
| `/api/v1/tilling/provision` | POST | Provision tilling |
| `/api/v1/tilling/stop` | POST | Stop tilling session |
| `/api/v1/tilling/sessions` | GET | List sessions |
| `/api/v1/tilling/resume` | POST | Resume session |
| `/api/v1/tilling/lock` | POST | Lock/unlock session |
| `/api/v1/tilling/{id}/create` | POST | Create session |
| `/api/v1/tilling/{id}/message` | GET | Send message |
| `/api/v1/tilling/{id}/update` | POST | Update session |

## Reference Files

- [`references/actual-hba-configs.md`](references/actual-hba-configs.md) — Live box IDs, IPs, licenses, and config locations discovered during actual deployment
- [`references/mosaic-bot-ui-pitfalls.md`](references/mosaic-bot-ui-pitfalls.md) — UI behaviors: "Send to Agent" location, registry status footgun, chronic alert accumulation
- [`references/axi-integration-architecture.md`](references/axi-integration-architecture.md) — Full blueprint for integrating AXI (Agent eXperience Interface) into Mosaic Bot → Stargate → Node Factories pipeline
- [`references/hbox-axi-tool.md`](references/hbox-axi-tool.md) — Complete hbox-axi CLI reference: commands, TOON output format, SSH ambient auth, restart-with-PID-cleanup pattern
- [`templates/axi-cli-scaffold.ts`](templates/axi-cli-scaffold.ts) — Template for scaffolding new AXI-compliant CLI tools with TOON output, ambient context, and content-first design
- [`scripts/verify-spo.sh`](scripts/verify-spo.sh) — Run this script to verify SPO + HBA ecosystem health

## Key Files in Mosaic Companion

- `electron/integrations/pool/orchestrator/SPOServer.ts` — TypeScript SPO server (for Electron integration)
- `electron/integrations/pool/orchestrator/StargatePoolOrchestrator.ts` — Core orchestrator class
- `spo-server-standalone.js` — Standalone SPO server (currently running)

## Alert Thresholds

```bash
ssh -o ConnectTimeout=5 -i ~/.ssh/id_ed25519 hyperai@192.168.0.150 "
  echo '=== Node Info ==='
  curl -s http://localhost:8006/api/info | head -c 500
  echo
  echo '=== Docker ==='
  docker ps | head -5
  echo '=== HBA ==='
  curl -s http://localhost:8100/health
  echo
  echo '=== Tiller ==='
  curl -s http://localhost:9000/list
"
```

## Fixing Common Issues

### HBA Zombie Process (Process exists but not listening)

**Symptoms**: `ps aux | grep hba_agent` shows PID, but `ss -tlnp | grep 8100` shows nothing.

**Fix**:
```bash
ssh hyperai@192.168.0.150 "
  rm -f /home/hyperai/stargate/hba.pid
  pkill -f hba_agent
  sleep 2
  cd /home/hyperai/stargate
  nohup python3 hba_agent.py --config config/hba.json >> logs/hba.log 2>&1 &
  sleep 3
  ss -tlnp | grep 8100
"
```

### Box Not Found After Reboot

**Symptoms:** Ping to old IP fails.

**Fix**:
1. Scan subnet: `for i in $(seq 100 160); do ping -c 1 -W 0.5 192.168.0.$i > /dev/null 2>&1 && echo "192.168.0.$i ALIVE"; done`
2. Check each alive IP for HBA: `curl http://192.168.0.$i:8100/health`
3. Update `stargate-registry.ts` with new IP
4. Rebuild and restart Mosaic Companion

**Historical IP Migration:**
- C-3PO moved from 192.168.0.151 → 192.168.0.150 after reboot (2026-07-01 → 2026-07-03)
- Always verify with `ssh hyperai@<new_ip> "curl -s http://localhost:4000/health"` — returns nested JSON `{result: {status, worker_id, balance_batt, chain_connected}}`
- Update `~/.ssh/config` with new IP (credential file protected — manual edit required)

## Fleet Monitoring Automation

Deploy automated health tracking for the entire fleet:

```bash
# ~/fleet-monitor/track_fleet.py — monitors C-3PO, R2D2, SPO
cd ~/fleet-monitor && python3 track_fleet.py
```

**Multi-layer health checks:**
1. Direct HTTP to `:9000/health` or `:9001/health` (often fails due to port binding)
2. SSH fallback: `ssh hyperai@<ip> "curl -s http://localhost:4000/health"` — parses nested `{result: {...}}`
3. Docker fallback: Check container status if HTTP fails
4. SPO check: `:9100/` returns `{"error": "Not found"}` but proves HTTP is up

**Cron schedule:**
```bash
hermes cronjob create --name hba-fleet-monitor --schedule "*/15 * * * *" \
  --script "python3 /home/mauricio/fleet-monitor/track_fleet.py 2>&1" --no-agent
```

**Alert thresholds:**
- Box unreachable for 2 consecutive checks → ALERT
- BATT balance = 0 (informational, not an error)
- SPO HTTP responding but endpoint unknown (investigate further)

## SPO Deployment

### Standalone SPO Server (for testing)

**Fix**:
```bash
ssh hyperai@<ip> "docker ps | grep tiller"
# If not running:
ssh hyperai@<ip> "docker start HYPC_<node_id>_9000"
```

## What is NOT a HyperAIBox

**192.168.0.90** — This is a Windows PC (OpenSSH, MAC c4:3a:da...). Only port 22 open. No HBA, no tiller, no Node Manager.

## AXI Tool Forge — How Mosaic Bot Builds Tools Autonomously

### The Pattern

When Mosaic Bot detects a missing capability, it follows the AXI Tool Forge workflow:

```
Detect Gap → Scaffold → Build → Test → Register → Aimify → Deploy → Monitor
```

### Step 1: Detect Missing Tools

The bot auto-detects tool gaps by checking if required binaries exist:

```typescript
const AXI_TOOL_GAPS = [
  { need: "fleet status", tool: "hbox-axi", command: "hbox-axi status" },
  { need: "pool orchestration", tool: "spo-axi", command: "spo-axi status" },
  { need: "AIM deployment", tool: "aimify", command: "aimify" },
];
```

When gaps are found, the bot injects a forge hint into heartbeat prompts:
```
🔧 TOOL GAPS DETECTED: fleet status, pool orchestration.
Consider forging AXI tools via the AXI Forge skill.
```

### Step 2: Scaffold Tool (Batch Write Strategy)

**IMPORTANT — Tool-Call Limit Workaround:**
Hermes has a 50 tool-call limit per turn. When building multiple files, use `execute_code` to batch all file writes into a single Python script call. This writes 5-10 files in one tool call instead of 5-10 individual calls.

Example batch script:
```python
import os
files = {
    "src/lib/toon.ts": "...",
    "src/lib/config.ts": "...",
    "src/commands/status.ts": "...",
    "src/index.ts": "...",
}
for path, content in files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
```

### Step 3: Build with TOON Format

All AXI tools use TOON (Tabular Output Optimized for Networks):

```typescript
// lib/toon.ts
export interface ToonTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}

export function toon(table: ToonTable): string {
  // Produces:
  // ┌─ Title ──────────────────────┐
  // │ Col1 │ Col2 │ Col3          │
  // ├──────────────────────────────┤
  // │ val1 │ val2 │ val3          │
  // └──────────────────────────────┘
}
```

**Principles:**
- Content-first: No args = live data, not help text
- Default output ≤ 10 lines, ≤ 80 chars per line
- Footer suggests next step (contextual disclosure)
- `--full` escape hatch for detailed output
- `--follow` for streaming (logs, tail)

### Step 4: Ambient Context

AXI tools never prompt interactively. Credentials come from:
- `~/.ssh/id_ed25519` for SSH
- `SPO_HOST` / `SPO_PORT` env vars
- `~/.config/mosaic-companion/` for app config

### Step 5: Auto-Heal on Restart

Learned from C-3PO incident: HBA restart must remove stale PID files:

```typescript
const preRestart = [
  "rm -f /home/hyperai/stargate/hba.pid",
  "pkill -f 'python3.*hba_agent' 2>/dev/null || true",
];
```

### Step 6: Register in AXI Catalog

After building, the tool is registered in Mosaic Bot's SQLite:

```sql
INSERT INTO axi_tools (id, name, domain, version, commands, status, created_at)
VALUES ('hbox-axi', 'HyperAIBox Manager', 'infra', '1.0.0',
        '["status","ssh","logs","restart"]', 'built', unixepoch());
```

### Step 7: Aimify (Wrap as AIM Module)

```bash
# Generate AIM manifest + Dockerfile
aimify ../hbox-axi/package.json --out ./hbox-aim

# Produces:
#   aim.json     — HyperCycle AIM manifest
#   Dockerfile   — Alpine-based container
```

### Step 8: Deploy via SPO

```bash
spo-axi deploy hbox-aim-v1.0 --node c3po
spo-axi deploy hbox-aim-v1.0 --node r2d2
```

### Step 9: Monitor

```bash
spo-axi logs hbox-aim-v1.0 --follow
hbox-axi status --node c3po
```

### Complete File Structure

```
axi-tools/
├── hbox-axi/              # Fleet manager
│   ├── src/
│   │   ├── lib/toon.ts    # TOON serializer
│   │   ├── lib/config.ts  # Fleet registry
│   │   ├── commands/
│   │   │   ├── status.ts  # Fleet overview
│   │   │   ├── ssh.ts     # SSH wrapper
│   │   │   ├── logs.ts    # Remote tail
│   │   │   └── restart.ts # Service restart
│   │   └── index.ts       # CLI entry
│   ├── package.json
│   └── tsconfig.json
├── spo-axi/               # Pool orchestrator
│   ├── src/
│   │   ├── commands/
│   │   │   ├── boxes.ts   # List SPO boxes
│   │   │   ├── deploy.ts  # Deploy modules
│   │   │   ├── logs.ts    # SPO logs
│   │   │   ├── scale.ts   # Scale instances
│   │   │   └── status.ts  # SPO health
│   │   └── index.ts
│   └── package.json
└── aimify/                # AXI → AIM wrapper
    ├── src/
    │   ├── wrapper.ts     # Manifest generator
    │   └── index.ts       # CLI entry
    └── package.json
```

### IPC Wiring Pattern

```typescript
// electron/integrations/mosaicbot/src/main/axi/ipc-handlers.ts
export function registerAxiIpcHandlers(): void {
  ipcMain.handle("axi:catalog", async () => { ... });
  ipcMain.handle("axi:status", async (_e, args) => { ... });
  ipcMain.handle("axi:spo-status", async () => { ... });
  ipcMain.handle("axi:deploy", async (_e, args) => { ... });
  ipcMain.handle("axi:aimify", async (_e, args) => { ... });
}

// Register in initMosaicBot():
import { registerAxiIpcHandlers } from "./axi/ipc-handlers.js";
registerAxiIpcHandlers();
```

### Preload Bridge

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing methods ...
  axiCatalog: () => ipcRenderer.invoke("axi:catalog"),
  axiStatus: (args) => ipcRenderer.invoke("axi:status", args),
  axiSpoStatus: () => ipcRenderer.invoke("axi:spo-status"),
  axiDeploy: (args) => ipcRenderer.invoke("axi:deploy", args),
  axiAimify: (args) => ipcRenderer.invoke("axi:aimify", args),
});
```

### React UI Integration

```tsx
// src/components/axi/AxiCatalogPanel.tsx
export function AxiCatalogPanel(): React.ReactElement {
  const [tools, setTools] = useState([...]);
  const runCommand = async (tool, cmd) => {
    const result = await window.electronAPI.axiStatus({ node: "c3po" });
    setOutput(result.output);
  };
  // Render tool cards with status badges and Run buttons
}

// Add tab in MosaicBotPanel.tsx:
const [activeTab, setActiveTab] = useState<"overview" | "skills" | "importer" | "infrastructure" | "axi">("overview");
// Tab buttons include "axi"
// Tab content: {activeTab === "axi" && <AxiCatalogPanel />}
```

### SQLite Schema Extensions

```sql
-- New tables for AXI tracking
CREATE TABLE axi_tools (id TEXT PRIMARY KEY, name TEXT, domain TEXT, version TEXT, commands TEXT, status TEXT, aimified INTEGER, created_at INTEGER);
CREATE TABLE aim_modules (id TEXT PRIMARY KEY, tool_id TEXT, version TEXT, manifest TEXT, docker_image TEXT, status TEXT, created_at INTEGER);
CREATE TABLE axi_deployments (id TEXT PRIMARY KEY, module_id TEXT, node_id TEXT, status TEXT, health TEXT, deployed_at INTEGER);
CREATE TABLE axi_sessions (id TEXT PRIMARY KEY, prompt TEXT, tool_id TEXT, module_id TEXT, status TEXT, duration_ms INTEGER, created_at INTEGER);
CREATE TABLE axi_node_telemetry (id INTEGER PRIMARY KEY AUTOINCREMENT, node_id TEXT, cpu_percent REAL, mem_used_mb INTEGER, disk_free_gb INTEGER, aims_running INTEGER, timestamp INTEGER);
```

### Build Verification Checklist

After wiring:
- [ ] `cd axi-tools/hbox-axi && npm install && npx tsc` → exit 0
- [ ] `cd axi-tools/spo-axi && npm install && npx tsc` → exit 0
- [ ] **`npx tsc` at repo root → exit 0** (Electron Forge's `generateAssets` hook runs `npm run build` = `tsc && vite build`; esbuild alone does NOT type-check, so `build:electron` passing does NOT mean `npm run start` will boot)
- [ ] `npm run build:electron` → exit 0
- [ ] `npm run build:renderer` → exit 0
- [ ] Test `hbox-axi status` → shows fleet
- [ ] Test `spo-axi status` → shows SPO health
- [ ] UI shows "AXI Tools" tab with tool cards

**Verify wiring landed in the COMPILED bundles** (build outputs are `dist/main/` from esbuild and `dist/renderer/` from vite — there is NO `dist-electron/` in this repo):

```bash
grep -c "AXI Tool Catalog" dist/renderer/assets/index-*.js   # renderer UI present
grep -c "axi:catalog"      dist/main/main.js                 # IPC handlers in main
grep -c "axiCatalog"       dist/main/preload.js              # preload bridge exposed
```
All three must return ≥1. If any returns 0, that layer wasn't wired (import missing, or edit landed in the wrong `exposeInMainWorld` block — preload.ts has TWO: `electronAPI` and `chatAPI`).

## When to Forge a New Tool

The bot should forge an AXI tool when:
1. A heartbeat prompt reveals a manual operation done > 3 times
2. An operation requires SSH + parsing + aggregation
3. Fleet management tasks need to be scripted
4. A new domain needs agent-native access (e.g. GitHub, databases, APIs)

## When NOT to Forge

- One-off operations (use direct commands)
- Operations already covered by existing AXI tools
- Human-centric TUIs (menus, ncurses, interactive prompts)
- Operations that need real-time bidirectional streaming

## Related Skills

- `axi-forge` — Detailed forge skill for Mosaic Bot's bundled-skills directory
- `stargate-doctor` — Infrastructure health monitoring
- `midnight-expert` — AIM module smart contract integration
- `github-pr-workflow` — CI/CD for AXI tools

## Key Files

- `docs/AXI_INTEGRATION.md` — Architecture blueprint
- `electron/integrations/mosaicbot/src/main/axi/schema.sql.ts` — SQLite extensions
- `electron/integrations/mosaicbot/bundled-skills/axi-forge/SKILL.md` — Bot's forge skill
- `electron/integrations/mosaicbot/src/main/axi/ipc-handlers.ts` — IPC bridge
- `src/components/axi/AxiCatalogPanel.tsx` — React UI
- `axi-tools/hbox-axi/` — Production fleet manager
- `axi-tools/spo-axi/` — Production pool orchestrator
- `axi-tools/aimify/` — AXI → AIM wrapper

## Pitfalls

1. **Tool-call limit**: Use `execute_code` to batch file writes. Single Python script = multiple files in one call.
2. **Tab type mismatch**: When adding React tabs, update the state type annotation AND the tabs array AND the content conditional. All three must match.
3. **Preload bridge**: AXI methods must be added to preload.ts AND ipc-handlers.ts AND main/index.ts import. Three places.
4. **TOON escaping**: When embedding TOON output in template literals, escape backslashes (`\\n` becomes `\n` after compile).
5. **SSH key path**: Use `require("os").homedir()` not `~/` in Node.js paths for cross-platform.
6. **TypeScript async in non-async**: Don't use `await` inside non-async functions. The heartbeat prompt builder is sync — use top-level detection instead.
6b. **Scripted batch edits MUST be followed by an immediate rebuild**: an execute_code script that injects code into existing TS files can silently produce invalid code (e.g. `await` inside a sync function — this broke `build:electron` in practice). After ANY scripted edit: rebuild both targets, and grep the source to confirm each injection landed where intended (string-position heuristics like "insert before last `}`" are fragile when a file has multiple blocks).
7. **HBA endpoint**: HBA serves on `/health`, NOT `/api/health` (that returns 404).
8. **Stale PID files**: Always remove PID files before restarting HBA agents.