---
name: hypercycle-stargate-ops
description: Operations, debugging, and extension work inside the HyperCycle AI ecosystem (Mosaic Companion, Node Manager, AIM modules, Stargate integrations, and Mosaic Bot).
title: HyperCycle Stargate Operations
version: 1.0.0
triggers:
  - explore hypercycle ecosystem
  - understand mosaic companion
  - analyze stargate module
  - inspect node manager
  - discover fleet nodes
  - aimify an agent
  - deploy to node factory
  - work with mosaic bot
  - stargate architecture
  - hypercycle node ops
---

# HyperCycle Stargate Operations

Operations, debugging, and extension work inside the **HyperCycle AI ecosystem** as represented by the Mosaic Companion codebase and the local Node Manager runtime.

This skill covers:
1. The Node Manager REST API and local node discovery
2. AIM (Agent Interface Module) lifecycle — discovery-first, build, deploy
3. Stargate's 8 integration patterns
4. Fleet discovery without SSH
5. Mosaic Bot identity and heartbeat architecture
6. AXI tool forge pipeline
7. Key codebase landmarks

---

## 1. Node Manager Local Discovery

When Mosaic Companion runs on the same host as a HyperCycle node, **no wallet or blockchain lookup is needed** to discover the node.

### API Endpoints

| Endpoint | Port | Purpose |
|----------|------|---------|
| `/api/info` | 8006 (UI) | Node status, hardware, AIM slots |
| `/api/config` | 8006 (UI) | Node address, seeds, merklizer hosts |
| `/info` | 8005 (admin) | Admin-level info |
| `/config` | 8005 (admin) | Admin-level config |

### Normalized Data Shapes

The `LocalNodeBridge.ts` normalizes raw Node Manager JSON into:
- `BridgeComputeNode` — uptime, reliability, hardware specs
- `BridgeANFE` — license-as-NFT with computed rarity
- `BridgeAIM` — slot, port, whitelisted status

### Electron vs Browser Mode

- **Electron** (`file://` protocol): must use absolute `http://localhost:PORT` URLs
- **Browser dev** (`npm run dev`): can use `/api/*` via Vite proxy
- Always probe multiple URLs with 5s timeout and `AbortController`

---

## 2. AIM Lifecycle — Discovery-First Orchestration

The `AimifierService.ts` follows **discovery-first** logic:

```
1. DISCOVERY → Probe existing AIM on expected port (default 9000)
   - Check /health, /manifest.json, /costs, /
   - Inspect Docker container
   - Query Node Manager routing table
   - Check local registry for image digest

2. BRANCH:
   - IF found AND NOT forceRebuild → CONNECT mode (skip build)
   - IF not found OR forceRebuild → BUILD mode

3. BUILD path:
   - PREFLIGHT (Docker + aim-py-gen availability)
   - CONFIG_GENERATE (HermesAIMSpec v1 config.yml)
   - CODE_GENERATE (aim-py-gen generate.py)
   - CODE_FIX (template bug fixes, cost variable patch)
   - VALIDATE_SPEC (spec validator)
   - BUILD_DOCKER (docker build)
   - TEST_LOCAL (spin up container, probe endpoints)
   - DEPLOY_NODE (push to Node Manager, get slot)
   - POST_DEPLOY (verify on node)
```

### Embedded vs Proxy Mode

The `HermesAIMWrapper` (in `mosaic_hermes_wrapper.py`) has two runtime modes:

| Mode | Trigger | Capabilities |
|------|---------|--------------|
| **embedded** | Host has `run_agent.py` at known paths | Full AIAgent with tools, kanban, sessions |
| **proxy** | Container mode or missing Hermes repo | Ollama forwarding only (chat, no tools) |

Known mount paths for Hermes repo detection:
- `/container_mount` (Node Manager PERSIST_DIRECTORY)
- `/opt/hermes-agent`
- `/hermes`
- `/home/mauricio/hermes`

### Pragmatic Context Fix

Local models (gemma:2b, qwen2.5:32b) report <64K context, which breaks Hermes init. The wrapper temporarily lowers `MINIMUM_CONTEXT_LENGTH` to 4096, then forces Ollama `num_ctx=65536` via `extra_body` so the KV cache still allocates full size.

---

## 3. Stargate's 8 Integrations

All are production-ready (E2E tested 9/9). Each has a dedicated service under `src/services/stargate/integrations/`:

| # | Service | File | User Action |
|---|---------|------|-------------|
| 1 | AgentToolService | `AgentToolService.ts` | "Register as Tool" in AIM Panel |
| 2 | MCPAIMService | `MCPAIMService.ts` | "Expose as MCP Server" |
| 3 | UnifiedOrchestrator | `UnifiedOrchestrator.ts` | "Deploy to Fleet" → Parallel/Sequential/Pipeline/Hybrid |
| 4 | IDEAgentForge | `IDEAgentForge.ts` | "Forge Agent" (rocket icon) in IDE |
| 5 | FleetSandboxLauncher | `FleetSandboxLauncher.ts` | "Sandbox" on fleet node row |
| 6 | SecureAspGateway | `SecureAspGateway.ts` | Auto-vault-backed on company creation |
| 7 | FleetGatekeeperFilter | `FleetGatekeeperFilter.ts` | "Filter" on fleet node row |
| 8 | FleetChronicleLogger | `FleetChronicleLogger.ts` | "Log" on fleet node row |

---

## 4. Fleet Discovery (No SSH Between Nodes)

`FleetDiscoveryService.ts` discovers nodes via **registry polling**, not SSH:

1. **Explicit registry URL** — JSON endpoint the user controls (never hardcoded)
2. **Local Hypercycle Nodes** — from Settings → Hypercycle Nodes (via `electronAPI.nodes.get`)
3. **Polling** — `GET /api/info` on each node, 5s timeout
4. **Enrichment** — merge with HyperInsight telemetry if available

Security rule: **never use someone else's Merkelizer endpoint**. ANFE license IDs and node status must stay private.

---

## 5. Mosaic Bot Identity Architecture

Mosaic Bot is **not Hermes**. It runs on Hermes infrastructure but has its own identity layer.

### Identity Enforcement

- `SOUL.md` — complete personality definition at repo root
- `orchestrator.ts` — injects identity **FIRST** in system prompt
- `index.ts` — adds SOUL.md overlay to **all** agent configs (main, coder, local)
- `mosaic_hermes_wrapper.py` — MOSAIC_BOT_IDENTITY string injected into system prompts

### Heartbeat Architecture

```
Every 30 minutes:
  1. Read vault.json → count entries per box
  2. Read mcp-plugins.json → list MCP servers
  3. Read ai-agents.json → list active agents
  4. Build enriched system prompt
  5. Send to LLM
  6. If response != "HEARTBEAT_OK" → deliver alert via IPC to renderer
```

### Silent Monitoring Rule

> "Alert on crashes/errors, not routine success. Stop ack-ing every watch."

---

## 6. AXI Tool Forge Pipeline

Under `axi-tools/`:

| Tool | Purpose |
|------|---------|
| `hbox-axi` | Fleet management (status, ssh, logs, restart, deploy, aimify) |
| `spo-axi` | Pool orchestrator (boxes, deploy, aimify, scale, logs, drain) |
| `aimify` | Wrapper (tool → AIM module manifest + Docker image) |

Pipeline: **User Need → axi-forge skill → AXI Tool → AIMify → SPO Deploy → Node Factory**

Key principle: **TOON format** for token-efficient output, minimal schemas (3-4 fields), pre-computed aggregates.

---

## 7. Battery / Batterycoin Blockchain Layer

The HyperCycle ecosystem includes a **Cosmos SDK (CometBFT)** blockchain called Batterycoin, deployed via the `Battery-Movement` GitHub org.

| Repo | Purpose |
|------|---------|
| `Battery-Movement/batteryagi-validator-install` | Validator install bundle for HyperAiBox (RK3588, arm64) |
| `Battery-Movement/battery-coin-official` | Core Batterycoin node software |
| `Battery-Movement/battery-coin-smart-contracts` | Smart contracts |

### Validator Bundle Structure

The `batteryagi-validator-install` bundle is a **signed delivery artifact** (not source). It contains:

| Path | Purpose |
|------|---------|
| `compose.validator.yaml` | Docker Compose validator service |
| `compose.monitoring.yaml` | Optional Prometheus + Grafana |
| `validator.env.example` | Per-node config template |
| `genesis/genesis.json` + `genesis.sha256` | Canonical genesis (same on all 5 nodes) |
| `scripts/preflight.sh` | Fail-closed env check |
| `scripts/verify-bundle.sh` | Checksums + image signature |
| `scripts/load-image.sh` | Offline `docker load` helper |
| `image-digest.txt` | GHCR image pinned by sha256 digest |
| `docs/five-node-setup.md` | Full 5-node runbook |

### Network Ports

| Port | Bind | Purpose |
|------|------|---------|
| `26656` | `0.0.0.0` | P2P — must be reachable from other 4 validators |
| `26657` | `127.0.0.1` | RPC — private (SSH/VPN) |
| `1317` | `127.0.0.1` | REST — private |
| `9090` | `127.0.0.1` | gRPC — private |

**For Stargate dashboard polling:** change `26657` to `0.0.0.0` in `compose.validator.yaml` so the bridge can reach `/status` across the LAN. See `references/stargate-pool-validator-integration.md` for the full pattern.

### Quick Per-Node Install

```bash
bash scripts/verify-bundle.sh                 # 1. integrity
cp validator.env.example .env && nano .env    # 2. moniker + peers
bash scripts/preflight.sh                      # 3. must pass
sha256sum -c genesis/genesis.sha256            # 4. verify genesis
docker compose -f compose.validator.yaml up -d # 5. start
```

Set in `.env`:
- `MONIKER` — unique per node
- `BATTERYAGI_EXTERNAL_ADDRESS` — this node's `host:26656`
- `BATTERYAGI_PERSISTENT_PEERS` — the other 4 nodes, comma-separated
- `BATTERYAGI_IMAGE` — digest from `image-digest.txt`
- `CHAIN_ID` — `batterycoin-1`
- `GENESIS_SHA256` — `d60a0b190406d4983d75a1c1059783e5e0a2a085f44b873a28c926e92bc73e90`

---

### Validator Dashboard Cross-Verification Pattern (2026-07-09)

When both you and a partner (e.g. Battery AGI) operate dashboards for the same validators, establish a canonical data source:

1. **Origin dashboard** (Battery): polls validators directly, exposes read-only JSON feed
2. **Cross-verification dashboard** (Mosaic): consumes the feed

**Battery JSON Feed:**
```
GET /api/runtime/cosmos/validator-pool?format=stargate
```

Benefits:
- Single source of truth — no drift between dashboards
- Battery owns the origin (they run the nodes/Hermes)
- Mosaic provides operator cross-verification view
- Both scale automatically as validators 3–5 come online

**Prerequisite — Tailscale sharing:**
Partner's dashboard machine must reach validator RPC ports. Share nodes without inviting them to your tailnet:
```bash
sudo tailscale share 100.92.116.49 harris.warren@gmail.com
sudo tailscale share 100.94.115.120 harris.warren@gmail.com
```

**Critical telemetry fix:** `/status` does NOT contain `n_peers`. You MUST also poll `/net_info` for peer count. See `references/stargate-pool-validator-integration.md` for the full hook + `/status` + `/net_info` implementation.

---

## 8. Fleet Discovery — The Tailscale Mesh

The HyperAIBox fleet spans **multiple LAN subnets** (e.g., `192.168.0.x` and `192.168.1.x`). Local subnet scanning with `nmap` or `ping` will miss nodes on different subnets. **Tailscale is the discovery fabric** — every node has a `tailscale0` interface with a `100.x` address.

### Discovery Procedure

```bash
# On ANY reachable node, list all mesh members
ssh r2d2 "tailscale status"   # shows all connected nodes

# Typical output:
# 100.94.115.120  r2d2   mauricio240887@  linux  -
# 100.92.116.49   c-3po  mauricio240887@  linux  -
```

This gives you:
- **Tailscale IP** (the overlay address for P2P)
- **Hostname** (r2d2, c-3po, etc.)
- **Platform** (linux)

### Using Tailscale IPs for Cross-Subnet Validator Peering

In `validator.env`, `BATTERYAGI_EXTERNAL_ADDRESS` and `BATTERYAGI_PERSISTENT_PEERS` **must use Tailscale IPs**, not LAN IPs. Example for a 3-node set:

```
MONIKER=batteryagi-validator-1
BATTERYAGI_EXTERNAL_ADDRESS=100.92.116.49:26656
BATTERYAGI_PERSISTENT_PEERS=100.94.115.120:26656,100.72.251.124:26656
```

### ⚠️ Cross-Tailnet Node Sharing Pitfall

When a partner shares their node to your tailnet (`mauricio240887@`), **your other nodes on that tailnet can reach it**, but your **dev machine may be on a different tailnet** and cannot.

| Machine | Tailnet | Can Reach Mike (`100.72.251.124`)? |
|---------|---------|-----------------------------------|
| C-3PO | `mauricio240887@` | ✅ Yes (same tailnet) |
| R2-D2 | `mauricio240887@` | ✅ Yes (same tailnet) |
| AtomMan (dev, before) | `computeportal.net` | ❌ No (different tailnet) |
| AtomMan (dev, after) | `mauricio240887@` | ✅ Yes (switched 2026-07-11) |

**Symptom:** Nodes peer to each other fine, but your dev machine (where Mosaic runs) shows "signal timed out" for the shared node.

**Fix Options:**

| Option | Command | Trade-off |
|--------|---------|-----------|
| A. SSH tunnel | `ssh -f -N -L 26658:100.72.251.124:26657 hyperai@192.168.0.150` | Works immediately; tunnel dies on reboot |
| B. Join dev machine to partner tailnet | `sudo tailscale --socket /var/snap/tailscale/common/socket/tailscaled.sock login` → auth as `mauricio240887@gmail.com` | Cleanest; loses access to original work tailnet |
| C. Run Mosaic on a node IN the tailnet | SSH to C-3PO, run Mosaic there | Heavy; requires GUI or X11 |

**Recommended:** Option B for permanent development. After login, `tailscale status` on AtomMan shows C-3PO, R2-D2, and Mike directly. For snap-installed tailscale, use `--socket /var/snap/tailscale/common/socket/tailscaled.sock`.

### SSH Access Pattern

```bash
# ~/.ssh/config
Host r2d2
    HostName 192.168.0.38
    User hyperai
    IdentityFile ~/.ssh/id_ed25519

Host c3p0
    HostName 192.168.0.150
    User hyperai
    IdentityFile ~/.ssh/id_ed25519
```

Note: `c3p0` has **two LAN interfaces** (`eth1` on `192.168.1.100` and `wlan0` on `192.168.0.150`). The SSH config uses the reachable IP.

---

## 9. Node Readiness Audit — Preflight Script

The bundle's `scripts/preflight.sh` performs 8 checks. **All MUST pass** before `docker compose up`:

| # | Check | Fatal? | Typical HyperAIBox Value |
|---|-------|--------|--------------------------|
| 1 | Architecture `aarch64/arm64` | **YES** | `aarch64` (RK3588) |
| 2 | Docker daemon reachable | **YES** | `Docker 28.1.1` |
| 3 | Docker Compose v2 plugin | **YES** | `v2.35.1` |
| 4 | `.env` fully populated (no `REPLACE_` placeholders) | **YES** | Must set manually |
| 5 | `genesis.json` present + SHA256 matches | **YES** | `d60a0b19...` |
| 6 | Port 26656 availability | WARN | May already be in use |
| 7 | NTP synchronized | WARN | `timedatectl` → `yes` |
| 8 | Disk ≥ 20GB free | WARN | **Critical on some nodes** |

### Critical Resource Warning

**R2D2 had 98% disk utilization (2.9GB free of 108GB)** during a live inspection. This blocks validator deployment. Before starting:

```bash
ssh r2d2 "df -h ."   # check root disk
ssh r2d2 "docker system df"   # check Docker storage
```

Cleanup path if disk is full:
1. `docker image prune -a` — remove unused images
2. Remove old inference AIM tarballs (`batterycoin-inference-aim-v0.1.4.tar.gz` is 3.3GB)
3. `docker volume prune` — remove unused volumes
4. Check `overlayroot` status — some HyperAIBoxes use overlayfs; a reboot may clear the overlay

---

## 10. GitHub Repo Map & Branch Status

### Account: `notsoblack` (Mauricio Fabian Prieto Davila)

**Personal repos:**
| Repo | Last Updated | Purpose |
|------|--------------|---------|
| `notsoblack/mosaic-companion` | 2026-03-26 | Personal fork |
| `notsoblack/create-mn-app` | 2026-06-25 | Midnight Network app scaffold |
| `notsoblack/midnight-docs` | 2026-06-25 | Midnight blockchain docs |
| `notsoblack/midnightntwrk` | 2026-03-05 | Midnight tooling |
| `notsoblack/mauricio` | 2026-03-26 | Personal |

**Upstream:**
| Repo | Last Updated | Purpose |
|------|--------------|---------|
| `hypercycle-development/mosaic-companion` | 2026-07-02 | Official Mosaic + Stargate |
| `hypercycle-development/aim-py-gen` | 2025-06-18 | AIM module generator |

### Branch Status (Local Working Tree)

The local checkout (`/home/mauricio/mosaic-companion`) on branch `stargate-module`:
- **Remotes**: `origin` → `notsoblack/mosaic-companion`, `hypercycle` → `hypercycle-development/mosaic-companion`
- **Divergence**: +3,958 insertions / -941 deletions across 37 files vs. upstream
- **Recent local commits**:
  1. `fix(chatview)`: count only trailing tool-chain, not lifetime history
  2. `fix(chat/asset-discovery)`: prevent runaway tool-chain + RPC storm
  3. `fix(stargate)`: unify Dashboard LLM path + RPC circuit breaker + Atomic Mail MCP
  4. `fix(xhr)`: emulate streaming callbacks for non-streaming XHR
  5. `debug(xhr)`: log response body to diagnose silent failures

**Recommendation**: Consider opening PR from `notsoblack/stargate-module` → `hypercycle-development/stargate-module` to upstream the work.

---

## 11. Live Deployment Pitfalls (Confirmed 2026-07-07)

### Genesis SHA256 Mismatch Trap

The `genesis.sha256` file in the bundle uses a **relative path prefix** (`batterycoin-validator/genesis/genesis.json`) when the bundle is cloned inside a parent directory. The container's `entrypoint.sh` computes the SHA256 of `/genesis/genesis.json` (the mounted path), which yields a **different hash** if the path string differs. This causes a fatal restart loop:

```
FATAL: genesis sha256 mismatch for /genesis/genesis.json
sha256sum: WARNING: 1 of 1 computed checksums did NOT match
```

**Fix:** Compute the hash directly on the file, not from `genesis.sha256`:
```bash
sha256sum ~/batterycoin-validator/genesis/genesis.json
# → d60a0b190406d4983d75a1c1059783e5e0a2a085f44b873a28c926e92bc73e90
# Set this exact value in .env as GENESIS_SHA256
```

### Preflight "Empty persistent_peers" Failure

`preflight.sh` treats an empty `BATTERYAGI_PERSISTENT_PEERS=` as a placeholder failure, even though the first validator legitimately has no peers yet.

**Fix:** Either leave the variable commented out in `.env` (the script only checks lines starting with the key), or set it to a dummy value and override later:
```bash
# Option A: comment out until validator-2 joins
# BATTERYAGI_PERSISTENT_PEERS=

# Option B: set empty explicitly (preflight v0.1.0 accepts this)
BATTERYAGI_PERSISTENT_PEERS=""
```

### SSH Pipe JSON Parsing Breaks

Piping `ssh node "curl ... | python3 -c '...'"` into a local Python interpreter fails because **double-quote escaping inside f-strings breaks across the SSH boundary**:
```
SyntaxError: f-string: unmatched '('
```

**Fix:** Always scp a `.py` file to the remote and run it there, or use JSON keys with single quotes:
```bash
# WRONG — double quotes break through ssh
ssh node "curl ... | python3 -c '...f\"Node: {n.get(\"moniker\")}\"...'"

# RIGHT — scp a script and run it on the remote
scp check_status.py node:/tmp/
ssh node "curl -s http://127.0.0.1:26657/status | python3 /tmp/check_status.py"
```

### Registry Auth Required for Docker Pull

The GHCR image `ghcr.io/battery-movement/batterycoin-node:latest` requires authentication. HyperAIBox nodes **cannot pull it without credentials**.

**Fix:** Use the offline tarball shipped in `image/`:
```bash
cd ~/batterycoin-validator
bash scripts/load-image.sh image/batteryagid-v0.1.0-linux-arm64.tar
# Then set BATTERYAGI_IMAGE=ghcr.io/battery-movement/batterycoin-node:v0.1.0 in .env
```

### R2D2 Disk Cleanup (Exact Commands)

R2D2 was at 98% disk (2.9GB free). The largest consumers identified:

```bash
# On R2D2:
docker images
# → batterycoin-inference-aim v0.2.1   5.96GB
# → batterycoin-inference-aim v0.1.4   876MB
# → various old <none> layers          ~843MB

# Cleanup:
docker rm -f batterycoin-inference-aim   # remove exited container
docker rmi batterycoin-inference-aim:v0.2.1  # remove 5.96GB image
docker image prune -a                    # remove dangling images
docker volume prune                      # remove unused volumes
rm /home/hyperai/batterycoin-build/batterycoin-inference-aim-v0.1.4.tar.gz  # 3.3GB tarball
```

After cleanup, expect ~30GB free, which satisfies the preflight ≥20GB requirement.

### Entrypoint Init Idempotency

The container's `entrypoint.sh` runs `batteryagid init` on every start. This is **idempotent for genesis** (re-copies the mounted genesis) but **creates a new validator key** if `keyring-test/` is empty. The validator address `71f1dc445d4853d7fbfb806b95e61a209da6329d` was already in the genesis `accounts` list, so the node immediately got `voting_power: 10`.

**Do NOT** run `docker exec ... batteryagid init` manually after the container is up — it rewrites `config/node_key.json` and `priv_validator_key.json`, which can change the validator identity.

### `n_peers=0` with Non-Empty Peer Array (Inbound-Only Config)

When `/net_info` shows `n_peers: 0` but the `peers` array contains entries with `connected: false`, the validator **accepts inbound connections** but **never initiates outbound** because `BATTERYAGI_PERSISTENT_PEERS` is empty or missing.

| Symptom | Meaning |
|---------|---------|
| `n_peers: 0` | No outbound dials configured |
| `peers` array non-empty | Other nodes have dialed IN |
| `connected: false` | From this node's view, those are inbound listeners, not active peers |
| Other nodes show `connected: true` | Their outbound dials TO this node succeed |

**Fix:** Add ALL OTHER nodes to `BATTERYAGI_PERSISTENT_PEERS` in `.env`:
```bash
BATTERYAGI_PERSISTENT_PEERS=100.92.116.49:26656,100.94.115.120:26656
```
Then `docker compose down && docker compose up -d`.

**Rule:** CometBFT `n_peers` counts **bidirectional active connections**. A node that only passively accepts inbound shows `n_peers=0` even though P2P is open and other nodes are connected to it. See `references/multi-validator-peer-wiring.md` for the full diagnostic pattern.

### Tailscale Login with Snap-Installed tailscale

When Tailscale is installed via snap, `sudo tailscale login` fails with "Access denied: profiles access denied". The snap socket path is `/var/snap/tailscale/common/socket/tailscaled.sock`, not the default `/var/run/tailscale/tailscaled.sock`.

**Fix:**
```bash
sudo tailscale --socket /var/snap/tailscale/common/socket/tailscaled.sock login
```

After login, verify with `tailscale status` to confirm all tailnet nodes appear.

---

## 12. Key Codebase Landmarks

| File | Role | Size |
|------|------|------|
| `src/components/AdaPortalPanel.tsx` | Main Stargate UI (~4,200 LOC) | ~216K |
| `src/services/stargate/LocalNodeBridge.ts` | Node Manager REST client | 13K |
| `src/services/stargate/EnhancedLocalNodeBridge.ts` | Telemetry + Ollama + Hermes detection | 6.5K |
| `src/services/stargate/AimifierService.ts` | AIM pipeline orchestrator | 48K |
| `src/services/stargate/AIMForgeService.ts` | Guided AIM builder/generator | 25K |
| `src/services/stargate/HermesAgentOrchestrator.ts` | Kanban dispatch to fleet | 19K |
| `src/services/stargate/FleetDiscoveryService.ts` | Registry-based node discovery | 8K |
| `src/services/stargate/TrainingRoomDeployer.ts` | Chat room training bridge | 7K |
| `electron/integrations/mosaicbot/src/main/index.ts` | Mosaic Bot heartbeat engine | — |
| `SOUL.md` | Identity contract | 7K |
| `stargate-vault/vault-index.json` | 283-skill index | 183K |
| `stargate-vault/component-registry.json` | Named node registry (C-3PO, R2-D2, AtomMan, BB-8) | 5K |
| `aim-images/mosaic-hermes-aim/mosaic_hermes_wrapper.py` | AIM runtime (embedded/proxy) | 17K |
| `aim-images/mosaic-hermes-aim/manifest.json` | AIM module manifest v1.0.4 | 1.7K |
| `docs/AXI_INTEGRATION.md` | AXI Tool Forge architecture | 10K |

### Node Manager Warning

If the Node Manager shows:
> "This license does not belong in the network configured to the node"

This means the node's `network` config (e.g. `mainnet`) doesn't match the license's registered network. Check `node_config.json` on the Node Manager host. The license `#2324779898006116` on node `80ad4ea14c33cd2a` (v0.5.1) showed this exact warning in a live inspection.

---

## References

- `references/stargate-pool-validator-integration.md` — How to wire Battery validator fleet telemetry into the Stargate Pool dashboard (Tailscale IPs, dual `/status` + `/net_info` polling, cross-tailnet reachability)
- `references/cross-tailnet-validator-peering.md` — Cross-tailnet validator mesh: IP asymmetry when nodes are shared across tailnets, bidirectional sharing requirements, onboarding new validators (Adgas pattern)
- `scripts/check_validator_mesh.py` — Standalone Python health check script for the validator mesh
- `references/session-inspection-checklist.md` — Step-by-step for inspecting a Mosaic/HyperCycle environment
- `references/github-repo-map.md` — Full GitHub repo map, branches, PRs, and API commands
- `references/battery-validator-bundle.md` — Session-specific fleet discovery results and node readiness findings
- `references/validator-5-mesh-adgas-pattern.md` — 5-node validator mesh: multi-box-per-operator pattern, 5-node `.env` cascade, Maia diagnostic (`connected=False`), cross-tailnet asymmetry with Adgas
- `references/cross-tailnet-validator-peering.md` — Cross-tailnet validator mesh setup: IP asymmetry when nodes are shared across tailnets, bidirectional sharing requirements, and the full 4-node onboarding workflow (Adgas pattern)