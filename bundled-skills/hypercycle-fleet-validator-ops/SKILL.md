---
name: hypercycle-fleet-validator-ops
description: Deploy blockchain validators (CometBFT / Battery Coin) on HyperAIBox RK3588 nodes, wire P2P meshes, and integrate validator telemetry into Mosaic Companion's Stargate Pool dashboard.
trigger: HyperCycle validator deployment, fleet discovery, node readiness audit, CometBFT peer mesh wiring, or Stargate Pool dashboard telemetry integration.
dependencies: [terminal, file, computer_use]
---

# HyperCycle Fleet Validator Operations

End-to-end validator lifecycle on HyperCycle HyperAIBox edge nodes: fleet discovery → readiness audit → bundle deployment → `.env` configuration → container startup → peer mesh wiring → Stargate UI integration.

## Pre-conditions
- SSH access to target nodes as `hyperai` user (key-based auth preferred).
- Battery validator install bundle cloned locally (or access to `Battery-Movement/batteryagi-validator-install`).
- Offline Docker image tar (`batteryagid-v0.1.0-linux-arm64.tar`) available for nodes that cannot pull from GHCR.
- Tailscale mesh active between nodes (for cross-node P2P).

## Phase 1 — Fleet Discovery

1. Ping sweep the known LAN range (`192.168.0.0/24`) for live HyperAIBox nodes.
2. Confirm each node responds to SSH and collect basic facts:
   ```bash
   ssh hyperai@<IP> "uname -m; docker --version; docker compose version; df -h /; ntpq -p || chronyc tracking"
   ```
3. Record node identity (moniker), LAN IP, Tailscale IP, and hardware profile (e.g. RK3588).

## Phase 2 — Readiness Audit (per node)

| Check | Command | Pass Criteria |
|-------|---------|---------------|
| Architecture | `uname -m` | `aarch64` |
| Docker Engine | `docker --version` | v28+ installed |
| Docker Compose | `docker compose version` | v2 plugin present |
| Disk | `df -h /` | ≥20 GB free (alert at 95%) |
| Ports | `ss -tlnp` | 26656, 26657, 1317, 9090 not bound by others |
| NTP | `ntpq -p` or `chronyc tracking` | Synchronized |

**Pitfall:** If disk is >95% full, stop and clean up before proceeding. Typical reclaim targets: old Docker images (`docker images`), builder cache (`docker builder prune -af`), inference AIM tarballs, and rotated logs.

## Phase 3 — Bundle Deployment

1. Clone or refresh the install bundle locally.
2. Verify genesis integrity against `genesis.sha256`:
   ```bash
   sha256sum genesis/genesis.json
   cat genesis/genesis.sha256
   ```
3. `rsync` bundle to node `~/batterycoin-validator/` (exclude `.git` to save space).
4. Load Docker image from offline tar:
   ```bash
   ssh hyperai@<IP> "cd ~/batterycoin-validator && docker load -i image/batteryagid-v0.1.0-linux-arm64.tar"
   ```

## Phase 4 — Per-Node Configuration

Create a `.env` from `validator.env.example` with these required fields:

| Var | Value |
|-----|-------|
| `MONIKER` | Unique per node (e.g. `batteryagi-validator-1`) |
| `CHAIN_ID` | `batterycoin-1` |
| `BATTERYAGI_EXTERNAL_ADDRESS` | Node's Tailscale IP + `:26656` |
| `BATTERYAGI_PERSISTENT_PEERS` | Comma-separated `id@tailscale-ip:26656` of **other** validators |
| `BATTERYAGI_IMAGE` | `ghcr.io/battery-movement/batterycoin-node:v0.1.0` |
| `GENESIS_SHA256` | Canonical SHA-256 of `genesis.json` |

**Pitfall:** Do NOT set `PERSISTENT_PEERS` to include the node's own address. The entrypoint script (`/usr/local/bin/entrypoint.sh`) reads `.env` and rewrites `config.toml` at startup. If `MONIKER` is wrong, run `batteryagid init <moniker> --chain-id <chain-id>` **inside** the container to regenerate config dirs.

## Phase 5 — Container Lifecycle

```bash
# Start
ssh hyperai@<IP> "cd ~/batterycoin-validator && docker compose -f compose.validator.yaml up -d"

# Check health
ssh hyperai@<IP> "docker ps | grep batteryagi-validator"
ssh hyperai@<IP> "curl -s http://127.0.0.1:26657/status | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get(\"result\",{}); print(\"Peers:\",r.get(\"n_peers\"),\"Moniker:\",r.get(\"node_info\",{}).get(\"moniker\"),\"Height:\",r.get(\"sync_info\",{}).get(\"latest_block_height\"))'"
```

**Critical:** If you change the compose port binding (e.g. from `127.0.0.1:26657` to `0.0.0.0:26657` for LAN polling), a `docker compose restart` is **insufficient** — the container must be recreated:
```bash
docker compose -f compose.validator.yaml down && docker compose -f compose.validator.yaml up -d
```

## Phase 6 — Peer Mesh Verification

After both validators are running, verify bidirectional P2P:

```bash
# On each node, check peer count
curl -s http://127.0.0.1:26657/net_info | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["n_peers"])'

# Cross-node reachability (from any node)
timeout 5 bash -c 'echo > /dev/tcp/<OTHER_TAILSCALE_IP>/26656' && echo "OK" || echo "FAIL"
```

Each validator should report `n_peers = N-1` for an N-node mesh. For a 2-node mesh, expect `1`; for 3-node, expect `2`.

### Adding a 3rd-Party Validator (e.g. Mike's node)

When a new validator is operated by someone else, their box may be on a **different Tailscale tailnet**. Tailscale IPs (`100.x.x.x`) do not route across tailnets.

1. **Have the owner share their node** into your tailnet:
   ```bash
   # On Mike's HyperAIBox
   sudo tailscale share 100.72.251.124 mauricio240887@gmail.com
   ```
2. **Verify reachability** from your existing validators:
   ```bash
   ssh hyperai@192.168.0.150 "ping -c 1 100.72.251.124"
   ```
3. **Update `BATTERYAGI_PERSISTENT_PEERS` on ALL validators** to include the new node:
   | Box | Updated `BATTERYAGI_PERSISTENT_PEERS` |
   |-----|--------------------------------------|
   | C-3PO | `100.94.115.120:26656,100.72.251.124:26656` |
   | R2-D2 | `100.92.116.49:26656,100.72.251.124:26656` |
   | Mike  | `100.92.116.49:26656,100.94.115.120:26656` |
4. **Recreate containers** on all boxes (not just restart):
   ```bash
   ssh hyperai@<IP> "cd ~/batterycoin-validator && docker compose -f compose.validator.yaml down && docker compose -f compose.validator.yaml up -d"
   ```
5. **Verify full mesh:** every box reports `n_peers = N-1`.

**Reference:** `references/tailnet-peering-for-multi-party-meshes.md` for full details.

## Phase 7 — Stargate UI Integration

### 7a — Direct Validator Polling (MANDATORY)

**CRITICAL:** `EnhancedLocalNodeBridge.getTelemetry().validatorPool` is **always null** for remote validators. The bridge only tracks the local Node Manager (`localhost:8006`), which has zero knowledge of CometBFT containers running on other nodes. Any UI that reads `validatorPool` from the bridge will show **0 validators online** even when all nodes are healthy.

**Correct pattern:** Poll CometBFT `/status` directly from the dashboard host to each validator's RPC port, then supplement with `/net_info` for peer count:

```typescript
const DEFAULT_VALIDATOR_ENDPOINTS = [
  { id: 'c3po', name: 'C-3PO', host: '192.168.0.150', rpcPort: 26657, network: 'batterycoin-1' },
  { id: 'r2d2', name: 'R2-D2', host: '192.168.0.38',  rpcPort: 26657, network: 'batterycoin-1' },
];

async function fetchStatus(endpoint) {
  const base = `http://${endpoint.host}:${endpoint.rpcPort}`;
  // 1. /status — moniker, height, sync state
  const statusRes = await fetch(`${base}/status`, { signal: AbortSignal.timeout(3000) });
  const statusData = await statusRes.json();
  const syncInfo = statusData.result.sync_info;
  const nodeInfo = statusData.result.node_info;

  // 2. /net_info — peer count (NOT present in /status)
  const netRes = await fetch(`${base}/net_info`, { signal: AbortSignal.timeout(3000) });
  const netData = await netRes.json();
  const nPeers = netData?.result?.n_peers ?? 0;

  return {
    id: endpoint.id,
    name: nodeInfo.moniker,
    status: syncInfo.catching_up ? 'catching_up' : 'synced',
    blockHeight: parseInt(syncInfo.latest_block_height, 10),
    peerCount: nPeers,
    network: endpoint.network,
  };
}
```

**Pitfall:** `/status` does NOT contain `n_peers`. CometBFT splits peer count across a separate endpoint. If you only poll `/status`, peer count will always be `0` even when nodes are fully meshed.

**Reference:** `references/telemetry-direct-polling.md` for full hook + badge implementation.

### 7b — Battery Dashboard Cross-Verification Pattern

When partnering with a team that operates the same validators (e.g. Battery AGI), establish a read-only JSON feed so both dashboards consume the **same source of truth**:

```
Battery Dashboard polls validators → exposes GET /api/runtime/cosmos/validator-pool?format=stargate
                                                              ↓
Mosaic Companion Battery Pool consumes this feed instead of direct polling
```

Benefits:
- Single canonical data source eliminates drift between dashboards
- Battery's dashboard shows origin-of-truth (they run the nodes)
- Mosaic shows cross-verification view (operator view)
- Both dashboards scale automatically as validators 3–5 come online

**Prerequisite:** Battery's dashboard machine must be on the same Tailscale tailnet as the validator boxes, or the boxes must be shared via `tailscale share <ip> user@partner.com`.

### 7c — Registry-Based Pool Architecture

For the Stargate Pool tab, use a registry-driven architecture instead of monolithic god-files:

- `pools/types.ts` — `PoolDefinition`, `PoolProps`, `PoolStatus`
- `pools/registry.ts` — Array of pools; each pool registers its component + live badge
- `StargatePoolHub.tsx` — Orchestrator: selector grid ↔ detail view
- `PoolConfigModal.tsx` — Per-pool settings overlay

Adding a new partner pool requires only **one component file + one registry entry** — no changes to `AdaPortalPanel.tsx`.

### 7c — Build Verification

```bash
cd /home/mauricio/mosaic-companion
npm run typecheck   # tsc --noEmit
npm run build       # vite build
```

Both must pass before declaring the integration complete.

## Pitfalls

- **Bridge telemetry does NOT include remote validators.** `EnhancedLocalNodeBridge.getTelemetry().validatorPool` is null for CometBFT containers running on other nodes. Always poll `/status` directly from the dashboard host. See `references/telemetry-direct-polling.md`.
- **Disk:** R2D2-type nodes often carry large inference AIM images. Always audit disk before deployment.
- **Port binding:** Compose file defaults bind RPC to `127.0.0.1`. For LAN/dashboard polling, change to `0.0.0.0` and recreate the container.
- **Genesis mismatch:** Wrong `GENESIS_SHA256` causes the container to enter a restart loop. Always verify against `genesis.sha256` in the bundle.
- **Duplicate validator address:** The bundle ships a single `keyring-test/validator` key. Multiple nodes using the same key will share the same validator address. Acceptable for dev/test meshes; rotate keys before mainnet.
- **Import cleanup:** When moving `StargatePoolDashboard` between tabs, ensure the import is present in `AdaPortalPanel.tsx` for the tab that renders it, and removed from the old tab to avoid duplication.
- **Cross-tailnet IP translation:** When a node is shared via `tailscale share`, Tailscale assigns a **different 100.x IP** in the recipient's tailnet than the owner's tailnet. E.g. C-3PO is `100.92.116.49` in `mauricio240887@` but `100.92.116.48` in `junglemikesartandprints@`. If a validator's `.env` contains IPs from the wrong tailnet namespace, outbound connections will fail with `connected=False` even though the ports are open. Always use the IPs visible in `tailscale status` on the **dialer's** machine, not the **owner's**.
- **Bogus IP trap:** External collaborators may mention IP addresses that do not actually exist on the network (e.g. `100.106.25.34`). Always verify with `ping`, `python3 socket.connect_ex`, or `curl` before updating `.env`. A non-routable IP in persistent_peers causes `n_peers` to drop silently with no error in logs.
- **SSH host key mismatch across interfaces:** A node reachable via both LAN and Tailscale may have different host keys. Use `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null` when switching between interfaces, or maintain separate `Host` entries in `~/.ssh/config` for LAN vs Tailscale paths.

## References

- `references/node-registry.md` — Live node identities, IPs, and monikers for the current fleet (5 validators across 3 tailnets, 2 fully meshed from our perspective).
- `references/tailnet-peering-for-multi-party-meshes.md` — How to wire validators across different owners' Tailscale tailnets (e.g. Mike's node shared into your tailnet).
- `references/cross-tailnet-ip-verification.md` — **CRITICAL:** IP translation across tailnets, verification protocol before updating `.env`, and the bogus-IP trap. Read this before adding any new validator.
- `references/compose-port-binding.md` — Deep-dive on why `restart` fails to apply port changes.
- `references/telemetry-direct-polling.md` — Full hook + badge implementation for direct CometBFT polling (bypasses bridge null-telemetry issue).
- `references/aim-wrapper-pattern.md` — How to package batteryagi-validator as a HyperCycle AIM for Node Manager distribution.
