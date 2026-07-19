---
name: mosaic-discovery-first-aim-orchestration
title: mosaic-discovery-first-aim-orchestration
description: Discovery-First Orchestration pattern for Mosaic Companion's Stargate → HyperCycle AIM integration. Probes existing runtime before any build, connects when found, rebuilds only on opt-in.
trigger:
  - "Aimify Hermes"
  - "Discovery mode"
  - "AIM orchestration"
  - "Stargate AIM build fails"
  - "mosaic-companion AIM pipeline"
  - "HyperCycle node manager localhost:8000"
pitfalls:
  - "Patch mode='patch' can fail on hunk mismatches — use write_file as fallback for critical files"
  - "The ElectronNodeManagerAdapter must hit port 8000 (API), NOT port 8006 (Admin UI)"
  - "Node Manager manifest expects 'methods' not 'input_methods'"
  - "Dockerfile EXPOSE must use literal port number, not escaped variable like \\${PORT}"
  - "AIM verification must use manifest.project_port || 9000, not hardcoded 8000+aimIndex"
  - "StargateAIMPanel.tsx needs fallback probe to localhost:9000 when Node Manager /info is empty"
  - "Always verify with grep after write_file when patch validator warns about mismatches"
  - "Discovery logic must probe /health AND /manifest.json AND /costs — Node Manager needs /costs for routing"
  - "AimifierService.ts must emit 'discovery:complete' event so UI can update before pipeline branches"
  - "forceRebuild must be false by default — build path is opt-in only"
  - "Public Base RPCs (llamarpc, alchemy) return 429/525 when rate-limited — red herrings, do not block localhost:9000 discovery"
  - "StargatePoolService.ts:getANFEInfo() short-circuits to zero when !window.ethereum — must add _rpcEthCall fallback"
  - "HermesAimPanel.tsx useEffect auto-select must depend on [agents, selectedAgent] NOT [hermesAgents, selectedAgent] to avoid TDZ error"
  - "Multi-line patch on large TS files (StargatePoolService.ts >1000 lines) corrupts brace balance — use execute_code + Python replace instead"
---

## Command Reference

```bash
# 1. Rebuild image
docker build -t localhost:5000/mosaic-hermes-aim:embedded .

# 2. Stop old container
docker stop hermes-embedded-test && docker rm hermes-embedded-test

# 3. Deploy with host networking (proven path)
docker run -d --name hermes-embedded-test --network host \
  -v /home/mauricio/.hermes:/root/.hermes:rw \
  -v /home/mauricio/hermes:/container_mount:ro \
  -e HERMES_PROVIDER=ollama \
  -e HERMES_MODEL=kimi-k2.5:cloud \
  -e HERMES_BASE_URL=http://127.0.0.1:11434 \
  localhost:5000/mosaic-hermes-aim:embedded

# 4. Verify
for ep in health agent/status; do
  curl -s http://127.0.0.1:9000/$ep | jq .
done

# 5. Test tool loop
time curl -s -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Use the terminal tool to run: date"}' | jq .
```

## Post-Deployment Quick Check (v3 Verified)

| Model | Mode | Latency | Tool | Memory | Kanban |
|-------|------|---------|------|--------|--------|
| `llama3.2:3b` | embedded | ~112s | ⚠️ | ✅ | ✅ |
| `kimi-k2.5:cloud` | embedded | **3.3s** | ✅ | ✅ | ✅ |

Session date: 2026-05-29
Image: `0a58141020aa`
Container: `2712733717be`
Status: **All verifications PASSED**

---

## Node Manager Reintegration

## Architectural Principle

**Runtime truth takes precedence over generated assumptions.**

Before building anything, discover what already exists. If an AIM is healthy on a known port, connect to it. Only rebuild when the user explicitly opts in via "Force Rebuild".

## File Map

| File | Role | Key Symbols |
|------|------|-------------|
| `AimifierService.ts` | Orchestration core | `DISCOVERY`, `CONNECT`, `discoverExistingAIM()`, `AIMDiscoveryResult` |
| `AimifierAdapters.ts` | Adapter implementations | `ElectronNodeManagerAdapter`, `ElectronDockerAdapter`, template builders |
| `HermesAimPanel.tsx` | Primary Dashboard UI | Discovery state, Connect mode actions, Force Rebuild toggle |
| `StargateAIMPanel.tsx` | AI Models tab | Fallback probe to `localhost:9000` when NM `/info` empty |

## Discovery Probe Checklist

Probe | Endpoint | Why |
|-----|----------|-----|
| Health | `GET /health` | Runtime alive check |
| Manifest | `GET /manifest.json` | AIM identity, version |
| Costs | `GET /costs` | Node Manager economic routing |
| Root | `GET /` | Dashboard/status page |
| Node Manager | `GET :8000/info` | Orchestration integrity |
| Registry | `GET :5000/v2/{name}/tags/list` | Provenance |
| Container | `docker ps --filter ancestor={image}` | Uptime, port mapping |

**New — AIM Type Detection:** After a successful health probe, check `provider` and `mosaic_aim_type` fields. If `provider: "ollama"` and `mosaic_aim_type: "hermes_bridge"`, the AIM is a **text-in/text-out proxy**, not a real embedded `AIAgent`. The discovery result must carry an `aimType` field (`"proxy"` | `"embedded"` | `"unknown"`) so downstream consumers know which features are available.

| `aimType` | Available Features | Recommended Action |
|-----------|-------------------|-------------------|
| `"proxy"` | Chat only, no tools, no memory, no kanban | Connect with `hermes-aim` provider (Option B thin shim) |
| `"embedded"` | Full tool loop, native skills, kanban, memory | Connect with native bridge or API server (Option C) |
| `"unknown"` | Unknown — assume chat-only until verified | Default to thin shim; log warning |

## Pipeline Branching Logic

```
aimifyAgent() called
  → STAGE DISCOVERY (always runs)
      → probes localhost:9000, NM, registry, container
      → emits discovery:complete
  → IF found AND !forceRebuild:
      → STAGE CONNECT (skip all build/deploy stages)
      → emit pipeline:done with tag "connected-to-existing:9000"
      → UI shows: Open Dashboard, Open Kanban, Restart, Force Rebuild
  → ELSE:
      → STAGE PREFLIGHT → CONFIG_GENERATE → CODE_GENERATE → CODE_FIX
      → VALIDATE_SPEC → BUILD_DOCKER → TEST_LOCAL → DEPLOY_NODE → POST_DEPLOY
```

## Template Fixes (Build Path Only)

| Bug | Before | After |
|-----|--------|-------|
| Manifest field | `input_methods: ['POST']` | `methods: ['POST']` |
| Missing /costs | Not present | Added endpoint manifest |
| Missing / | Not present | Added root endpoint |
| Dockerfile | `EXPOSE \${PORT}` | `EXPOSE 4000` |
| NM API port | `:8006` | `:8000` |
| AIM verify port | `8000 + aimIndex` | `manifest.project_port || 9000` |

## Connect Mode UI Actions (HermesAimPanel)

- **Open AIM Dashboard** → `http://localhost:9000/`
- **Open Kanban** → `http://127.0.0.1:9119`
- **Restart / Re-check** → Re-runs discovery
- **Force Rebuild** → Sets `forceRebuild=true`, re-runs full pipeline

## Fallback Card (StargateAIMPanel)

When Node Manager `/info` returns empty but `localhost:9000/health` responds:
- Render emerald-bordered "Discovery-Fallback" card
- Show: name, version, port 9000, status, model
- Badge: "Discovery-Fallback" (violet)
- Disclaimer: "Discovered via localhost:9000 probe (not in Node Manager /info)"

## Testing Flows

| Test | Pre-state | Expected |
|------|-----------|----------|
| A: AIM already running | Container on 9000 | CONNECT mode, no rebuild, links work |
| B: AIM missing | Nothing on 9000 | Full build pipeline, templates fixed |
| C: Force Rebuild | Container on 9000 | Ignores discovery, rebuilds, deploys |
| D: NM empty metadata | /info empty, 9000 alive | Fallback card appears in AI Models |

## Fix Log (v2.1)

| Issue | File | Fix |
|-------|------|-----|
| No Hermes agents → button disabled | `defaultAiAgents.ts` | Added `MOSAIC_DEFAULT_HERMES_ID` with `provider: 'hermes'` |
| Auto-selection missing | `HermesAimPanel.tsx` | Added `useEffect` to auto-select first `provider === 'hermes'` agent |
| Hardcoded port 9000 | `HermesAimPanel.tsx` | Added `discoveryPort` state (default 9000, user-editable) |

## Fix Log (v2.2)

| Issue | File | Fix |
|-------|------|-----|
| `getANFEInfo` fails without `window.ethereum` | `StargatePoolService.ts` | Added `_rpcEthCall()` + `BASE_RPC_FALLBACKS` for direct public-RPC `eth_call` |
| Empty circles in CONNECT mode | `HermesAimPanel.tsx` | Mark build stages as `'skipped'` in `stageStates` when branch is CONNECT |

## Fix Log (v2.3 — Embedded Runtime Upgrade)

| Issue | File | Fix |
|-------|------|-----|
| Strict provider string excluded `hermes-aim` | `HermesAimPanel.tsx` | Widened filter to `['hermes', 'hermes-aim', 'hermes-api']` |
| Strict provider string in KanbanDashboard | `KanbanDashboard.tsx` | Widened runtime execution check to include all three Hermes-family providers |
| AIM wrapper rejected small models | `mosaic_hermes_wrapper.py` | Forced `MINIMUM_CONTEXT_LENGTH = 4096` and post-init override `context_length = 64000` |
| Old proxy code running in container | Node Manager slot 0 | Updated slot image to `localhost:5000/mosaic-hermes-aim:embedded` + stop/start slot |
| `base_url` overridden to `127.0.0.1` in container | `AIAgent.__init__` / Ollama provider adapter | Workaround A: `--network host` (proven 2026-05-29). Workaround B: post-init patch `client.base_url` back to `172.17.0.1`. Root fix: upstream patch in `agent/provider_adapter.py`. |
| Missing Python deps in container (`httpx`) | `python:3.11-slim` base image | **Runtime path proven:** mount host venv site-packages by having `HermesAIMWrapper` inject `/container_mount/venv/lib/python3.X/site-packages` into `sys.path` at import time. This resolves `httpx`, `openai`, `anthropic`, `pydantic`, and all transitive deps without rebuilding the image. |

## Fix Log (v3.0 — Provider Routing and Dependency Injection)

**Date:** 2026-05-29
**Status:** All verifications PASSED

| Issue | File | Fix |
|-------|------|-----|
| `:cloud` models routed to wrong provider | `mosaic_hermes_wrapper.py` | **Initial fix (WRONG):** `provider = "ollama-cloud"` → **Correct fix:** `provider = "ollama"`. Your local Ollama (`127.0.0.1:11434`) already relays `:cloud`-suffixed models to ollama.com internally. Using `"ollama-cloud"` provider tells Hermes to use the cloud API endpoint (`https://ollama.com/api`) directly, producing HTTP 404 because that's not the local relay path. |
| `httpx` and transitive deps missing in container | `mosaic_hermes_wrapper.py` | **Auto-inject host venv site-packages.** At import time, the wrapper searches `/container_mount/venv/lib/python3.{10,11,12,13}/site-packages` and inserts the first match into `sys.path[0]`. This makes `httpx`, `openai`, `anthropic`, `pydantic`, etc. available inside the container without installing anything into the image. |
| `AIAgent` import fails inside container | `mosaic_hermes_wrapper.py` | Ensure `sys.path.insert(0, '/container_mount')` is done **before** any Hermes import. Chdir to `/opt/app/app` first so relative imports work, then inject the repo path, then `from run_agent import AIAgent`. |
| Node Manager auto-heal kills manual container | MongoDB `node_manager.aims` | Set `virtual: true` and `status: "virtual"` on the slot document. The compiled Node Manager controller checks `status` and skips auto-restart when it equals `"virtual"`. |

### Verified E2E Cloud Model Results

| Model | Provider | Latency | Tool Loop | Memory | Kanban |
|-------|----------|---------|-----------|--------|--------|
| `llama3.2:3b` | `ollama` | ~112s | ⚠️ Weak (raw text, no JSON) | ✅ Yes | ✅ Yes |
| `kimi-k2.5:cloud` | `ollama` (local relay) | **3.3s** | ✅ Works (`terminal`, `kanban_create`, `memory`) | ✅ Yes | ✅ Yes |

**Key takeaway:** When your local Ollama has cloud models registered, the Hermes provider should be `"ollama"` (local) — the `:cloud` suffix on the model name is what tells Ollama to relay to the cloud. The `"ollama-cloud"` provider in Hermes is for direct cloud API access (like OpenRouter), not for a local relay.

## Embedded Runtime Upgrade Path (Proxy → Embedded)

When an existing AIM is a thin proxy (text-in/text-out via Ollama forwarding) but the user wants a full `AIAgent` runtime with tools, memory, kanban, and subagents, follow this upgrade path.

### Step 0 — Verify Host Prerequisites

```bash
# Hermes repo and venv
[ -d /home/mauricio/hermes ] && echo "repo: OK"
[ -d /home/mauricio/hermes/venv ] && echo "venv: OK"

# Ollama listening
ss -tlnp | grep 11434

# Hermes dashboard running
ss -tlnp | grep 9119
```

### Step 1 — Update AIM Wrapper to Embed AIAgent

Modify `aim-images/mosaic-hermes-aim/mosaic_hermes_wrapper.py`:
- Replace thin proxy with `AIAgent` initialization
- Force `MINIMUM_CONTEXT_LENGTH = 4096` (allows small models like `llama3.2:3b` to start)
- Set `num_ctx: 65536` in `request_overrides`
- Post-init override: `context_compressor.context_length = 64000` and `self._agent._ollama_num_ctx = 64000`

### Step 2 — Update main.py with /agent/run + /agent/status

Add endpoints:
- `POST /agent/run` — accepts `{"prompt": "..."}`, runs `AIAgent.chat()`, returns JSON
- `GET /agent/status` — returns `{"mode": "embedded", "agent_initialized": true}`

### Step 3 — Build and Tag Docker Image

```bash
cd /home/mauricio/mosaic-companion/aim-images/mosaic-hermes-aim
docker build -t mosaic-hermes-aim:embedded .
docker tag mosaic-hermes-aim:embedded localhost:5000/mosaic-hermes-aim:embedded
docker push localhost:5000/mosaic-hermes-aim:embedded
```

#### Step 4 — Update Node Manager Slot (Manual UI or API)

**Critical discovery:** HyperCycle Node Manager 0.5.x stores slot configuration in **MongoDB** (`localhost:27017`), not in flat YAML/JSON files. The controller is a **compiled PyInstaller binary** (`controller_serve`, ~60MB), so runtime slot modification requires either:
- The Node Manager Admin UI (`http://localhost:8005`)
- The Node Manager REST API (`POST /api/update_aim/<slot>`)
- Direct MongoDB mutation (not recommended)

**Registry resolution pitfall:** Node Manager's `DockerService.get_full_name()` prepends `hypercycle/` to bare image names when `aim_registry="hub.docker.com/u/hypercycle"`. If you build `mosaic-hermes-aim:embedded`, you **must** also tag it as `hypercycle/mosaic-hermes-aim:embedded` so Docker can resolve the computed name:

```bash
docker tag localhost:5000/mosaic-hermes-aim:embedded hypercycle/mosaic-hermes-aim:embedded
```

Get the image SHA for MongoDB verification:
```bash
docker inspect hypercycle/mosaic-hermes-aim:embedded --format='{{.Id}}'
# → sha256:22ebd46ff051...
```

**Manual slot update via Admin UI:**
1. Open `http://localhost:8005`
2. Navigate to **AIMS → Slot 0**
3. Change image to: `localhost:5000/mosaic-hermes-aim:embedded`
4. Save

**API slot update (if programmatic access is available):**
```bash
curl -X POST http://localhost:8000/api/update_aim/0 \
  -H "Content-Type: application/json" \
  -d '{"image_name":"mosaic-hermes-aim","image_tag":"embedded"}'
```

**Direct MongoDB update (emergency only):**
```bash
# Read current AIM document
mongosh node_manager --quiet --eval 'JSON.stringify(db.aims.findOne({_id: 9000}))'

# Update image and force re-download
mongosh node_manager --quiet --eval '
  db.aims.updateOne(
    {_id: 9000},
    {$set: {
      image_name: "mosaic-hermes-aim",
      image_tag: "embedded",
      image_id: "22ebd46ff051b00e39e3483c288e110ec0edd7be78cb76f3a561af8da9c2be50",
      status: "starting"
    }}
  )
'
```

#### Step 5 — Stop and Start ONLY the Slot (Never Reboot Node)

```bash
# Stop slot 0 container
docker stop HYPC_80ad4ea14c33cd2a_9000

# Start slot 0 again (Node Manager will respawn with new image)
docker start HYPC_80ad4ea14c33cd2a_9000
```

**Why stop/start only the slot?**
- Clean Python memory (old proxy modules flushed)
- Clean embedded runtime (new `AIAgent` instance)
- Proper environment loading (new `ENV` from image)
- Node Manager heartbeat and other slots unaffected

**Consent guard warning:** The user's system has a **terminal consent guard** that blocks `docker stop`, `docker restart`, and `docker rm` unless explicitly approved in real-time. `docker inspect`, `docker tag`, and `docker push` are allowed. If automated deployment is blocked, provide exact manual commands and ask for explicit consent before proceeding.

**Critical: Docker Healthcheck Port Mismatch**
If the app port was changed from `4000` to `9000` (or any other value), the `Dockerfile` `HEALTHCHECK` must be updated to probe the **same** port. If it still probes `:4000`, Docker marks the container `unhealthy` and may restart it in a loop. Verify after build:
```bash
docker inspect <container> --format='{{json .Config.Healthcheck.Test}}'
# Must contain "localhost:9000", NOT "localhost:4000"
```

**Critical: Linux Docker Networking (`host.docker.internal` Does Not Resolve)**
On **native Linux Docker**, `host.docker.internal` is **not** added to `/etc/hosts` by default. The container cannot reach host services (Ollama, dashboard, kanban) via that hostname. Use the docker0 gateway IP instead:
```bash
# Find docker0 gateway (usually 172.17.0.1)
ip -4 addr show docker0 | grep inet
# → 172.17.0.1/16
```
Set container environment variables to use `172.17.0.1`:
```bash
-e HERMES_BASE_URL="http://172.17.0.1:11434" \
-e KANBAN_URL="http://172.17.0.1:9119" \
-e KANBAN_URL_EXTERNAL="http://127.0.0.1:9119"  # for browser links
```
Also patch `mosaic_hermes_wrapper.py` and `app/main.py` to substitute `host.docker.internal` → `172.17.0.1` when `/.dockerenv` exists.

**Critical: `base_url` Override Bug Inside `AIAgent.__init__`**
When `provider="ollama"`, `AIAgent.__init__` may override the passed `base_url` to `http://127.0.0.1:11434/v1/` (container loopback), ignoring the environment value `http://172.17.0.1:11434`. This causes `Connection refused` because Ollama is on the **host**, not inside the container.

**Workaround A (quick):** Run container with `--network host` so `127.0.0.1:11434` inside the container resolves to the host's Ollama. Loses port isolation but proves the loop immediately.
```bash
docker run -d --network host ...
```

**Workaround B (proper):** After `AIAgent` instantiation, patch `self._agent.base_url` back to the correct value:
```python
if self._agent and hasattr(self._agent, 'client') and self._agent.client:
    self._agent.client.base_url = "http://172.17.0.1:11434/v1"
```

**Root cause:** The Ollama provider adapter in Hermes defaults to `localhost:11434` when no explicit `base_url` is passed, or when it resolves the provider config from environment. The `HERMES_BASE_URL` env var is not always propagated into the provider adapter's client initialization. A fix in `agent/provider_adapter.py` or `hermes_cli/auth.py` is needed upstream.

**Critical: Missing Python Dependencies in Container**
The Hermes `run_agent.py` and its transitive imports require many packages (`httpx`, `openai`, `anthropic`, `pydantic`, etc.) that are NOT in the base `python:3.11-slim` image. If `AIAgent` is imported from a mounted host repo, the container will crash with `ModuleNotFoundError` unless the host venv's `site-packages` are also mounted, or the dependencies are installed into the image.

**Option A — Mount host venv site-packages (read-only):**
```bash
# Find the host venv Python version and site-packages
ls /home/mauricio/hermes/venv/lib/
# → python3.10

docker run -d \
  -v /home/mauricio/hermes:/container_mount:ro \
  -v /home/mauricio/.hermes:/root/.hermes:rw \
  -v /home/mauricio/hermes/venv/lib/python3.10/site-packages:/opt/hermes-deps:ro \
  -e PYTHONPATH="/opt/hermes-deps:/container_mount" \
  ...
```
**Pitfall:** Container Python 3.11 may not be ABI-compatible with host venv built for Python 3.10. Use only if versions match.

**Option B — Install deps into the image during build:**
Add to `Dockerfile`:
```dockerfile
COPY requirements.txt /opt/hermes-requirements.txt
RUN pip install --no-cache-dir -r /opt/hermes-requirements.txt
```
Where `requirements.txt` is the Hermes repo's full dependency list (or a curated subset: `httpx`, `openai`, `anthropic`, `pydantic`, `aiohttp`, `requests`, `rich`, `prompt-toolkit`, `pyyaml`, `sqlitedict`, `psutil`, etc.).

**Option C — Runtime install (slower but flexible):**
```bash
docker exec <container> pip install httpx openai anthropic pydantic
```

### Step 6 — Verify Runtime

```bash
curl -s http://127.0.0.1:9000/agent/status | jq .
```

Expected:
```json
{
  "mode": "embedded",
  "agent_initialized": true
}
```

### Step 7 — Verify Tool Loop

```bash
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello in exactly 5 words"}'
```

Response must come from `AIAgent.chat()` — not simple Ollama proxy forwarding.

### Step 8 — Verify Memory (SQLite Sessions)

```bash
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Remember my name is Mauricio"}'

curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is my name?"}'
```

### Step 9 — Verify Kanban Tool

```bash
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a kanban task called Test embedded runtime"}'
```

### Architecture Recommendation: Two-Layer Agent Stack

| Layer | Model | Purpose |
|-------|-------|---------|
| **L1 — Stable Production AIM** | `llama3.2:3b` | Orchestration, tools, memory, kanban, workflows, Node Factory operations |
| **L2 — Specialist Models** (future) | `qwen2.5-coder`, `deepseek-r1`, `mistral` | Coding, reasoning, long context, fast utility, MCP-heavy orchestration |

## Node Manager Internals Discovery (0.5.x)

HyperCycle Node Manager 0.5.1-x86 is **not** a Python source tree at runtime. Key findings:

| Aspect | Discovery |
|--------|-----------|
| Controller | Compiled PyInstaller binary (`controller_serve`, ~60MB) |
| Config store | MongoDB (`localhost:27017`) — runtime-fatal if missing |
| Slot state | Stored in MongoDB, not flat files |
| Admin UI | React+Vite on port 8005 |
| API server | Compiled binary on port 8000 |
| Log output | `node_manager_server.out` (binary, use `strings` or `grep` with `-a`) |

**Implication:** You cannot `patch` or `sed` the Node Manager's slot configuration. You must use the Admin UI, REST API, or (in emergencies) direct MongoDB operations.

## Stargate Tilling Discovery Pattern

When integrating Node Factory tilling via Stargate Pool, follow discovery-first principles:

### Discovery Probe Checklist (Tilling)

| Probe | Endpoint | Expected |
|-------|----------|----------|
| SPO health | `GET :9100/health` | `{"status":"ok","boxes":N}` |
| HBA health | `GET <BOX_IP>:8100/health` | `{"status":"ok","agent":"hba"}` |
| Node Manager | `GET <BOX_IP>:8000/health` | Alive (native service) |
| NM info | `GET <BOX_IP>:8000/info` | JSON with node_version |
| Docker | `docker ps` on box | Node Manager NOT in Docker |

**Critical:** If Node Manager is already running natively on `:8000`, do NOT try to Dockerize it. The tilling provision should verify the existing NM and start only a monitor container.

### Tilling Provision Sequence

```
User clicks "Stargate Tilling"
  → SPO /api/v1/tilling/provision
    → matchmake best box (online + tenantCount < max)
    → POST <BOX_IP>:8100/provision
      → HBA: verify NM on :8000/health
      → HBA: start monitor container (python:3.11-slim)
      → HBA: return {status: "tilling", monitor_container_id: "..."}
    → SPO: create session, start cleanup loop
    → UI: show "Tilling Active" with earnings/uptime
```

### Pricing Model

| Model | Cost | Use Case |
|-------|------|----------|
| **Shared** | $3.00/mo | Standard factories (40% cheaper than HyperPG $5/mo) |
| **Spot** | $0.01/hr | Pay only when active |
| **Dedicated** | $8.00/mo | High-traffic factories |

## Pipeline UI Skipped Stages (HermesAimPanel)

When CONNECT mode fires (pipeline:done with tag `"connected-to-existing:..."`), the UI must explicitly mark all build/deploy stages as `'skipped'` in `stageStates`. Otherwise `getStageStatus()` returns `'pending'` for missing keys, and the user sees 8 empty circles.

**Fix:** In `onPipelineDone`, when `imageTag` starts with `"connected-to-existing:"`:
```typescript
const buildStages = [
  PipelineStage.PREFLIGHT, PipelineStage.CONFIG_GENERATE,
  PipelineStage.CODE_GENERATE, PipelineStage.CODE_FIX,
  PipelineStage.VALIDATE_SPEC, PipelineStage.BUILD_DOCKER,
  PipelineStage.TEST_LOCAL, PipelineStage.DEPLOY_NODE,
];
buildStages.forEach(stage => setStageStates(prev => new Map(prev).set(stage, 'skipped')));
```

**Verification:**
```bash
grep -n "stage.*skipped\|buildStages\|connected-to-existing" src/components/HermesAimPanel.tsx
```

## ANFE Detection Architecture (v2.2 — Direct RPC Fallback)

Mosaic Companion has **two** independent ANFE discovery paths:

| Path | Source | Needs Wallet? | Used By |
|------|--------|---------------|---------|
| **Node Manager heartbeat** | `LocalNodeBridge.ts:getLocalANFE()` | No | Node Manager panel |
| **Blockchain ERC-721** | `StargatePoolService.ts:getANFEInfo()` (via `_rpcEthCall`) | Yes (address known) | Stargate Pool panel |

**Base ANFE Contract:** `0x8c0075D087de9588DdF5c1441dF39828d695bc2f`
**ERC-721 `balanceOf` selector:** `0x70a08231`
**Public Base RPCs:** `https://mainnet.base.org`, `https://base.llamarpc.com`, `https://1rpc.io/base`

When `window.ethereum` is absent, `StargatePoolService` falls back to `fetch()`-based `eth_call` against public Base RPCs. This is implemented in a private `_rpcEthCall()` method. **Do not** rely on `window.electronAPI.web3` for actual `eth_call` operations — the Electron web3 bridge requires IPC round-trips and does not expose `eth_call`. Use the direct `_rpcEthCall` approach instead.

**Red Herring Alert:** 429 / 525 errors from `base.llamarpc.com` or `alchemy.com` are **rate limits on public RPCs**. They do **not** block `localhost:9000` discovery. Ignore them during AIM debugging.

## Multi-line Patch Tool

When applying >100-line changes to TypeScript files in mosaic-companion, the native `patch` tool can corrupt brace balance silently (mismatched `{}`), producing hundreds of cascading `TS1128`/`TS1434` errors.

**Workaround:** Use `execute_code` with Python instead. Pattern:
1. Read file with `f.read()`, no line-splitting.
2. Replace via exact string matching (include 20+ chars of surrounding context for uniqueness).
3. Compute brace balance with `text.count('{') - text.count('}')` before writing.
4. Write back with `f.write()`.
5. Run `npx tsc --noEmit --pretty` immediately after. If errors >200 starting at the first patched method, the file was corrupted — `git checkout -- <file>` and retry with tighter context strings.

**Reference:** See `references/scripted-patching-recipe.md`

## New Templates & References

| Support File | Purpose |
|--------------|---------|
| `templates/default-hermes-agent.ts` | Seed agent config for `defaultAiAgents.ts` |
| `templates/hermes-panel-autoselect.tsx` | React `useEffect` snippet for auto-selecting first Hermes agent |
| `references/anfe-wallet-fallback.md` | Full recipe for `_rpcEthCall()` + `BASE_RPC_FALLBACKS` in `StargatePoolService.ts` |
| `references/testing-checklist.md` | Manual test plan (Tests A–F) |
| `references/scripted-patching-recipe.md` | Safe multi-line TypeScript patching via `execute_code` + Python (avoid `patch` tool corruption) |
| `references/session-20260529-slot0-embedded-failure-analysis.md` | **v3 verified** Post-deployment failure analysis—healthcheck port mismatch, `host.docker.internal` on Linux, `base_url` override bug, missing Python deps, model quality findings, with exact fixes and workarounds |
| `references/slot0-embedded-production-checklist.md` | **NEW** Quick verification curl commands, expected response shapes, failure signature matrix, model recommendation table, and Path B rebuild recipe |

## Commands

```bash
# Verify compilation
cd ~/mosaic-companion && npx tsc --noEmit --pretty

# Check our files specifically
grep -n "DISCOVERY\|CONNECT\|discoverExistingAIM" src/services/stargate/AimifierService.ts
grep -n "methods\|/costs\|EXPOSE 4000\|queryNodeInfo" src/services/stargate/AimifierAdapters.ts
grep -n "isConnected\|discoveryResult\|forceRebuild" src/components/HermesAimPanel.tsx
grep -n "FallbackAIM\|fallbackAIM\|localhost:9000" src/components/stargate/StargateAIMPanel.tsx
```

## Related

- `hypercycle-aimifier` skill: AIM module generation, pyhypercycle_aim template fixes, Dockerfile bugs
- `kanban-codex-lane` skill: Kanban integration for multi-agent dispatch

## Version

**v2.1** — Live verification evidence added (2026-05-25). AIM type detection (`proxy` vs `embedded` vs `unknown`) added to discovery probe. Reference document updated to reflect port 4000 internal / port 9000 external mapping for slot 0.
