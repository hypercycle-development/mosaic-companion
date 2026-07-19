---
name: hypercycle-node-manager-ops
description: HyperCycle Node Manager operational knowledge — architecture, license model, config format, non-custodial tilling pitfalls, and the gap between health monitoring and actual compute allocation. Covers Node Manager v0.5.x, single-license constraint, provisioning flow via HBA agent, SPO heartbeat mechanism, and what real license switching requires.
metadata: {"hermes":{"tags":["blockchain","hypercycle","node-manager","compute","tilling","non-custodial"]}}
---

# HyperCycle Node Manager Operations

Operational knowledge for HyperCycle Node Manager v0.5.x — how it actually works,
what current "tilling" implementations do (and don't do), and what non-custodial
compute delegation requires.

## When to Use This Skill

- Building compute delegation / tilling systems for HyperCycle
- Integrating Node Manager status into dashboards
- Debugging why "delegated" licenses aren't actually computing
- Designing non-custodial compute pool architecture
- Understanding the difference between monitoring and actual compute allocation

## Node Manager Architecture

### Runtime Model

| Attribute | Value |
|-----------|-------|
| **Runtime** | Native OS process (NOT Docker container) |
| **API Port** | `:8000` — `GET /info` returns 200; everything else returns 405 |
| **Web UI** | `:8006` — Full admin panel (Settings, License, Monitor, Logs) |
| **License Model** | **ONE license per Node Manager instance** |
| **Config Location** | `/home/hypercycle/config/config.yaml` |
| **Version** | 0.5.1 (observed on C-3PO, 192.168.0.151) |

### Single-License Constraint

Node Manager holds exactly ONE license at a time. Settings UI shows:

> "License Active — Settings Locked. Freelancing settings cannot be modified
> while a license is active. Deactivate or release the license first to
> make changes."

This means:
- **No hot-swapping**: Cannot change license without stopping Node Manager
- **No multi-tenant**: One NM = one license = one revenue stream
- **Grace period**: 30 blocks before deactivation takes effect

### Current Config Format

```yaml
# /home/hypercycle/config/config.yaml
node_address: "187.161.142.27:8000"
node_host: "0.0.0.0"
payment_engine:
  driver: "nullpay"
  address: "00"
  network: "mainnet"
network: "mainnet"
priority: 0
upgrade_bucket_url: "https://hypercycle-release.s3.us-east-2.amazonaws.com/"
```

**Note:** `nullpay` driver means NO real payments. Revenue address is `00`.

### Settings Structure (Web UI)

**Tab: General**
- Node Identity — name, visibility
- Admin API — host, port
- **License Freelancing** — Active (true/false), Expected APR, Revenue Split (0.1 default), Contact, Grace Period Blocks (30)

**Tab: Network & Payments**
- HyperCycle Network (mainnet/testnet)
- Payment Engine (nullpay/ethereum/basechain/toda_micropay)
- Operator Revenue Address

**Tab: Infrastructure**
- Database
- AIM (AI Module) config
- Clustering

**Tab: Advanced**
- Logging, monitoring, system

**Tab: Version**
- Updates & upgrades

---

## What Current "Tilling" Actually Does (UPDATED — 2026-06-29)

### The Current State (Both Boxes Have Tiller Running!)

**CRITICAL UPDATE:** The `hyperbox-tiller` AIM **IS running** on both HyperAIBoxes.

**C-3PO (192.168.0.151):**
```bash
$ docker ps | grep tiller
HYPC_80ad4ea14c33cd2a_9000   0.0.0.0:9000->4000/tcp   hypercycle/hyperbox-tiller:latest

$ curl http://localhost:9000/list
{"available": 128, "tillers": []}
```

**R2D2 (192.168.0.38):**
```bash
$ docker ps | grep tiller
HYPC_89a84e0d731f_9001      0.0.0.0:9001->4000/tcp   hypercycle/hyperbox-tiller:latest

$ curl http://localhost:9001/list
{"available": 8, "tillers": []}
```

| Box | Container | Image | Port | Status | API |
|-----|-----------|-------|------|--------|-----|
| C-3PO | `6590a25bfe09` | `hypercycle/hyperbox-tiller:latest` | **9000** | ✅ running | ✅ responding |
| R2D2 | `89a84e0d731f` | `hypercycle/hyperbox-tiller:latest` | **9001** | ✅ running | ✅ responding |

**Note:** The ports differ between boxes because Node Manager assigns them dynamically based on slot availability. C-3PO got port 9000 (slot 0), R2D2 got port 9001 (slot 1).

### The HBA Agent Provision Flow (What Actually Happens)

When user clicks "Delegate to Pool":

1. **SPO** picks a HyperAIBox (R2D2 or C-3PO)
2. **SPO** sends `POST /provision` to HBA agent (port 8100)
3. **HBA** starts a **monitor container** (`till-{tenantId[:8]}-monitor`)
4. **Monitor** runs a Python script that:
   - Checks `http://localhost:8000/info` → reports `nm_alive`
   - **Checks Tiller API** → discovers port dynamically, calls `/list` → reports `aim_alive` and `active_tillers_count`
   - POSTs heartbeat to SPO every 30s with tiller status

### The Updated Monitor Script (After 2026-06-29 Fix)

```python
TILLER_PORTS = [9000, 9001, 9002, 9003]

def discover_tiller_port():
    """Find which port the hyperbox-tiller AIM is actually listening on."""
    for port in TILLER_PORTS:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/list", timeout=3) as resp:
                if resp.status == 200:
                    return port, json.loads(resp.read().decode())
        except:
            continue
    return None, None

# In send_heartbeat():
tiller_port, tiller_status = discover_tiller_port()
aim_alive = tiller_port is not None

available_slots = tiller_status.get("available", 0) if tiller_status else 0
active_tillers = tiller_status.get("tillers", []) if tiller_status else []
tilling_active = len(active_tillers) > 0

report = {
    "node_manager_alive": nm_alive,
    "aim_alive": aim_alive,
    "tiller_port": tiller_port,
    "available_slots": available_slots,
    "active_tillers_count": len(active_tillers),
    "tilling_active": tilling_active,
    # ... rest of report
}
```

### The Critical Gap: Tiller Running vs. Tilling Active

| Status | Meaning |
|--------|---------|
| **Tiller container running** | ✅ Docker container is up, API responding |
| **Tiller slots available** | ✅ e.g., 128 slots on C-3PO, 8 on R2D2 |
| **Actual tilling happening** | ❌ **NO** — `tillers: []` is empty on both |

**The Tiller is a "host" waiting for someone to rent a slot and provide a signed license assignment. No one has activated a slot yet.**

### Why Tillers Are Empty

The Tiller API requires a **4-step activation flow** (from the manifest):

1. **Create** — `POST /create` → Returns slot number (costs ~$5/month)
2. **Get Message** — `GET /get_message?number=1&license=xxx&chypc=yyy` → Returns message to sign
3. **User Signs** — Wallet signs the message (NON-CUSTODIAL — we cannot do this)
4. **Update** — `POST /update` with signature → Activates actual tilling

Until step 4 completes, `tillers: []` remains empty.

### Verified Live State (C-3PO) — 2026-06-29

```
License:         #2324779898048044 (original, still active)
Network:         Base
Owner:           0x8c0075...95bc2f
Status:          ALIVE
Node Manager:    Running (port 8000)
Tiller Container:  Running (port 9000)
Tiller API:      Responding (GET /list returns 200)
Available Slots: 128
Active Tillers:  0
Payment Driver:  nullpay (disabled)
Revenue Address: 00 (not configured)
```

---

## What Real Tilling Requires

### Option A: License Switching (Preferred for Non-Custodial)

**Sequence:**
1. Stop Node Manager gracefully
2. Update `/home/hypercycle/config/config.yaml` (or binary config) with new license
3. Restart Node Manager
4. Verify new license is active via `GET /info`
5. Monitor reports actual compute for THIS license

**Challenges:**
- Config may be binary (setup.json returned "invalid start byte" error)
- Stopping NM interrupts existing compute sessions
- Grace period of 30 blocks before old license releases
- Need root/sudo access to restart NM service
- Unknown if NM config reloads dynamically

**Research needed:**
- Where is license actually stored? config.yaml? DB? Binary file?
- Does NM support SIGHUP config reload?
- What's the safe shutdown sequence?

### Option B: Multiple Node Manager Instances

Run separate NM process per license on different ports:

```
NM #1: port 8000, license #2324779898006116
NM #2: port 8001, license #2324779898053522
NM #3: port 8002, license #2324779898053523
```

**Challenges:**
- Resource intensive (CPU, RAM per instance)
- Port management complexity
- AIM slots may conflict
- May require separate data directories
- Not tested — feasibility unknown

### Option C: On-Chain Delegation via Merkelizer

Use HyperCycle's on-chain delegation mechanism:

1. User delegates license to Node Operator via Merkelizer smart contract
2. Node Manager automatically recognizes delegation
3. Revenue split enforced by contract (e.g., 90% user, 10% operator)

**Challenges:**
- Requires Merkelizer API knowledge
- User pays gas for delegation tx
- Smart contract interaction
- May not exist in current HyperCycle version

### Option D: Proxy Pattern (Semi-Custodial)

Build a proxy that tracks earnings off-chain:

1. Single NM runs with pool operator license
2. Proxy tracks time slices per delegated license
3. Distribute rewards based on proxy logs
4. Requires trust in proxy operator

**Trade-off:** Less non-custodial, but simpler to implement.

---

## Non-Custodial Design Principles

### What "Non-Custodial" Means Here

| Aspect | Custodial (HyperPG) | Non-Custodial (Stargate Pool) |
|--------|---------------------|-------------------------------|
| **Keys** | User sends keys to operator | User keeps keys |
| **License** | Operator holds license | User retains license ownership |
| **Revenue** | Operator controls payouts | Smart contract or direct to user |
| **Compute** | Operator runs nodes | Community runs nodes |
| **Trust** | Trust operator | Trust protocol + smart contracts |

### Current Gap from Non-Custodial Ideal

The current implementation is **neither custodial nor non-custodial** — it's
**non-functional** for compute:

- User keeps license ✅
- But license is NOT used for compute ❌
- No revenue generated ❌
- No actual work performed ❌

---

## Pitfalls and Anti-Patterns

### ❌ Pitfall 1: Assuming Monitor = Compute

The monitor container checking `/info` does NOT mean the license is computing.
It only means "Node Manager is running."

**Fix:** Always verify the license shown in `GET /info` matches the delegated
license.

### ❌ Pitfall 2: Showing Fake Earnings

Setting `estimated_earnings_hypc: 0.0` in the heartbeat and displaying it as
earnings is misleading.

**Fix:** Remove earnings display until actual revenue API exists.

### ❌ Pitfall 3: "Active" Status Confusion

SPO session status "active" means "monitor is sending heartbeats", not
"license is computing."

**Fix:** Show dual status:
- **Compute**: Monitor running ✅ / Monitor down ❌
- **On-chain**: License active on Merkelizer ✅ / Not activated ❌

### ❌ Pitfall 4: Ignoring the Single-License Constraint

Attempting to "add" licenses to a Node Manager that only supports one.

**Fix:** Implement license queue or instance management.

### ❌ Pitfall 5: Not Distinguishing Pool vs. Merkelizer

User thinks "Delegate to Pool" activates Node Factory on-chain.

**Fix:** Clear messaging: "Pool = compute reservation. Merkelizer = on-chain
activation. Both required for full operation."

### ❌ Pitfall 6: HBA Config Path Wrong → Silent Heartbeat Failure

The HBA agent may be started with `--config /etc/stargate/hba.json` but this path often does not exist. The agent falls back to `DEFAULT_CONFIG` with:
- `orchestrator_url: ""` → heartbeats silently skipped (no error logged)
- `nm_api_port: 8006` → wrong API port (405 errors)

**Fix:** Always verify config file exists before starting HBA:
```bash
ls -la /etc/stargate/hba.json 2>/dev/null || ls -la /home/hyperai/stargate/config/hba.json
```

**Fix:** Add `try/except` around `_send_heartbeat()` in `_heartbeat_loop()`:
```python
def _heartbeat_loop(self):
    interval = self.config.get("heartbeat_interval", 30)
    while self.running:
        try:
            self._send_heartbeat()
        except Exception as e:
            self.logger.error(f"Heartbeat error (will retry in {interval}s): {e}")
        time.sleep(interval)
```

**Fix:** Use port 8000 (not 8006) for Node Manager API calls:
```python
self.nm_url = f"http://{nm_host}:8000/api/info"  # Correct
# NOT: f"http://{nm_host}:8006/api/info"  # Web UI, may 405
```

### ❌ Pitfall 7: Assuming GET /info Means Everything Works

Only `GET /info` returns 200. All other endpoints return 405.
This means:
- Cannot query active license details via API
- Cannot start/stop AIMs via API
- Cannot switch license via API
- The UI at `:8006` shows cached config, not live state

**Fix:** Use `ps`, `ss`, and direct file inspection to verify actual state.
Do not rely solely on `/info` or the web UI.

---

## Files and Paths

| Location | Purpose |
|----------|---------|
| `/home/hypercycle/config/config.yaml` | Node Manager base config |
| `/home/hypercycle/config/setup.json` | License/identity config (may be binary) |
| `/home/hypercycle/hypercycle-manager-0.5.1/` | NM installation directory |
| `/home/hyperai/stargate/hba_agent.py` | HBA agent (needs license config logic) |
| `/tmp/hba-deploy/scripts/spo_server.js` | SPO server (needs earnings query) |
| `http://localhost:8000/info` | NM health/status endpoint |
| `http://localhost:8006/` | NM admin web UI |
| `http://localhost:9000-9003/list` | Tiller API (port varies by box!) |

## Related Skills

- `midnight-node-midnight-node-node-operations` — Running Midnight nodes
- `cardano-node-ops` — Cardano node operations (runs alongside NM)
- `midnight-city-direct-control` — Agent control patterns (similar delegation model)

## References

- `references/tiller-live-status-2026-06-29.md` — Both tillers running, dynamic port discovery, activation flow
- `references/tiller-full-activation-2026-06-29.md` — **COMPLETE FIX SUMMARY**: HBA heartbeat fix, SPO endpoints, UI activation flow, build verification, all systems operational
- `references/tillingservice-aim-analysis.md` — Original manifest analysis (may be outdated since user manually activated Tiller via UI)
- `references/node-manager-arm64-failure-analysis.md` — Original arm64 failure diagnosis (may be partially resolved since AIM system now working)
- `references/infrastructure-live-diagnosis-2026-07-01.md` — **LIVE DIAGNOSIS**: All three endpoints (SPO, C-3PO, R2D2) down for different root causes. SPO never deployed, HyperAIBoxes physically offline.
- `references/hyperaibox-live-diagnosis-2026-07-01.md` — **POST-REBOOT LIVE STATUS**: C-3PO IP changed from .151 to .150, HBA zombie state detected, R2D2 fully operational after restart, tiller endpoints verified on both boxes

---

## Post-Reboot Discovery Patterns (2026-07-01)

### Critical: HyperAIBox IPs Change After Reboot

**Never assume HyperAIBox IPs are stable.** After reboot, DHCP may assign a different IP.

**Discovery pattern:**
```bash
# Scan entire subnet for alive hosts
for i in $(seq 1 254); do
  (ping -c 1 -W 0.5 192.168.0.$i > /dev/null 2>&1 && echo "192.168.0.$i ALIVE") &
done; sleep 8; wait
```

**Verify identity via SSH:**
```bash
ssh -o ConnectTimeout=5 -i ~/.ssh/id_ed25519 hyperai@<IP> "hostname"
```

**Known IP changes:**
- C-3PO: expected .151 → actual .150 (2026-07-01 reboot, DHCP lease changed)
- R2D2: expected .38 → actual .38 (stable, sticky DHCP)

### HBA Zombie State Detection

The HBA agent can enter a **zombie state** where:
- PID file exists (`/home/hyperai/stargate/hba.pid`)
- But process is NOT in `ps aux`
- Port :8100 has NO listener (`ss -tlnp | grep 8100` returns empty)
- Log file has null bytes (corrupted from crash without proper file close)
- Last log entries are old (from before reboot)

**Diagnosis:**
```bash
cat /home/hyperai/stargate/hba.pid      # Check PID file
ps aux | grep hba_agent | grep -v grep  # Verify process exists
ss -tlnp | grep 8100 || echo "NOT LISTENING"
tail -5 /home/hyperai/stargate/hba.log   # Check log freshness
```

**Fix:**
```bash
rm -f /home/hyperai/stargate/hba.pid
cd /home/hyperai/stargate
nohup python3 hba_agent.py --config config/hba.json > logs/hba.log 2>&1 &
```

### R2D2 Post-Reboot Status (192.168.0.38)

After reboot and network fix, R2D2 is **fully operational**:
- SSH: ✅ Responding
- HBA: ✅ Running on :8100 (manually restarted during session)
- Tiller: ✅ Running on :9001, 8 slots available (`{"available":8,"tillers":[]}`)
- Node Manager: ✅ Inferred from services
- Also runs: Hermes Agent, Stargate MCP Bridge, Ollama, Materios Attestor

### C-3PO Post-Reboot Status (192.168.0.150)

After reboot and network fix, C-3PO is **partially operational**:
- SSH: ✅ Responding (but on .150, not .151)
- Node Manager: ✅ Running, :8006/api/info responding
- Tiller: ✅ Running on :9000, 128 slots available
- HBA: 🟡 **ZOMBIE STATE** — PID file exists (1419473) but process gone, :8100 not listening
- Also runs: Cardano node (:3001), Postgres (:5433), Materios Attestor, Registry (:5000)

### Tiller API Verified Endpoints (2026-07-01)

The Tiller uses `@aim_uri` decorators — standard endpoints like `/health` return 404.

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/list` | GET | `{"available": N, "tillers": []}` |
| `/create` | POST | `{"status": "created", "number": N}` |
| `/get_message` | GET | `{"message": "..."}` |
| `/update` | POST | `{"status": "updated"}` |
| `/topup` | POST | `{"status": "topped_up"}` |

**Ports:** C-3PO uses :9000, R2D2 uses :9001. Always verify with `docker ps`.

---

*Last verified: 2026-07-01 against live HyperAIBoxes:*
- *C-3PO: 192.168.0.150 (was .151), NM ✅, Tiller ✅:9000, HBA 🟡 zombie*
- *R2D2: 192.168.0.38, NM ✅, Tiller ✅:9001, HBA ✅ running*

Before claiming a license is "tilled" or "active":

- [ ] Node Manager process is running (check `ps` or `systemctl`)
- [ ] `GET /info` returns 200 with the CORRECT license ID
- [ ] The license shown matches the delegated license
- [ ] AIM slot is allocated (if applicable)
- [ ] Heartbeats include actual metrics (not hardcoded zeros)
- [ ] Revenue/split is configured (not `nullpay` or `00`)

---

## Related Skills

- `midnight-node-midnight-node-node-operations` — Running Midnight nodes
- `cardano-node-ops` — Cardano node operations (runs alongside NM)
- `midnight-city-direct-control` — Agent control patterns (similar delegation model)
- `kanban-orchestrator` — When dispatching HyperCycle deployment tasks to `ops` profile; see `references/axi-tools-external-dirs-configuration.md` for external_dirs fix

---

*Last verified: 2026-06-28 against live Node Manager on C-3PO (192.168.0.151)*