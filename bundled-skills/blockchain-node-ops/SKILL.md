---
name: blockchain-node-ops
description: "Operate, update, and troubleshoot blockchain nodes, attestation daemons, and node-manager services. Covers Substrate-based chains (Materios), Cardano, oracle nodes, HyperCycle Node Manager, and remote SSH-accessible nodes."
version: 1.7.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [blockchain, docker, node, substrate, cardano, attestor, cert-daemon, infra]
    related_skills: []
---

# Blockchain Node Operations

Operate and maintain blockchain infrastructure nodes managed via Docker Compose on the user's workstation. The primary live systems are:

- **materios-attestor** — Substrate preprod attestation node (cert-daemon only)
- **merkle-oracle-node** — Oracle node
- **cardano-preview** — Cardano preview network node

All live under `/home/mauricio/` as individual compose projects.

## Quick Reference

| Node | Compose Dir | Health Port | Key Service |
|------|-------------|-------------|-------------|
| materios-attestor | `~/materios-attestor` | `:8080` | `cert-daemon` |
| merkle-oracle-node | `~/merkle-oracle-node` | varies | TBD |
| cardano-preview | `~/cardano-preview` | varies | TBD |
| pondora-echo-node | **IMAGE ONLY** (no compose) | N/A | `echo-client` (dormant) |

> See `references/pondora-echo-node.md` for full forensics on the dormant `pondora/echo-client:latest` image (Cardano WebSocket relay, 400MB, never launched).

## Remote Node SSH Connectivity (hbox / hbox1 / hbox2)

The user's infrastructure includes SSH-accessible remote nodes (`hbox`, `hbox1`, `hbox2`). These may be HyperCycle hardware nodes (Orange Pi / RISC-V edge devices) or other always-on hosts in the LAN or VPN.

### Configuration Inventory

| Host | ~/.ssh/config entry | HostName / IP | User | IdentityFile |
|------|---------------------|---------------|------|--------------|
| hbox2 | Yes | 192.168.0.10 | molt | ~/.ssh/molt_donbenito2 |
| hbox | No | hbox (fallback) | mauricio | default |
| hbox1 | No | hbox1 (fallback) | mauricio | default |

### Quick Connectivity Check

Run in order:

```bash
# 1. Does SSH know about the host?
ssh -G hbox2 | grep -E '^(hostname|user|port)'

# 2. TCP port open?
timeout 5 bash -c '> /dev/tcp/192.168.0.10/22' && echo OPEN || echo CLOSED

# 3. ICMP reachability?
ping -c 1 -W 3 192.168.0.10

# 4. Layer-2 neighbor known?
ip neigh | grep 192.168.0.10

# 5. DNS / mDNS resolution?
getent hosts hbox
resolvectl query hbox.local 2>/dev/null || true

# 6. VPN overlay peers?
tailscale status | grep hbox
zerotier-cli peers | grep hbox
```

### Self-Referential Target Check

Before concluding a target is remote, check if the current machine IS the target:
```bash
hostname                                    # e.g. cmhpec-wk-01
getent hosts <hostname> 2>/dev/null         # reverse-check
git config --get user.email                 # may contain AtomMan in the address
```
If the target name appears in `hostname`, git config, Chrome profile locks, or `/proc/version`, treat the local machine as the target and inject the key locally.

### Offline Diagnosis Tree

```
ssh -G resolves the host?
├── NO → Missing ~/.ssh/config entry; ask user for correct hostname/IP/user.
└── YES →
    ping replies?
    ├── NO → Target is down, on a different subnet/VLAN, or IP changed.
    │          Check neighbor table and router/DHCP lease table.
    └── YES → SSH daemon not running, firewall blocking 22, or auth rejection.
              Check: ss -tlnp | grep 22 on target; tail /var/log/auth.log.
```

### SSH Rejection Auth-Log Diagnosis

When a client reports "AtomMan is rejecting" despite a valid key being installed, **always check `/var/log/auth.log`** (or `journalctl -u ssh`) on the target before assuming a key or network problem:

```bash
sudo tail -50 /var/log/auth.log | grep -i "ssh\|auth\|fail\|invalid"
```

**Common rejection signatures:**

| Log Pattern | Root Cause | Fix |
|-------------|------------|-----|
| `Invalid user <name> from <IP>` | Client is using a **non-existent username** | Correct the SSH command to use an existing user (e.g., `mauricio@host` not `molt-atomman@host`) |
| `Connection closed by authenticating user root` | Root login attempted and blocked | Use non-root user; check `PermitRootLogin` |
| `Failed publickey for ...` | Key installed but wrong permissions | `chmod 600 authorized_keys; chmod 700 ~/.ssh` |
| `Connection closed by <IP> [preauth]` | Client disconnects before auth completes | Check client-side SSH config and key path |

**Pitfall:** Users often provide a public key for user X but the connecting agent uses a different username derived from the key comment or local user. Always verify the SSH command's target user matches an existing account on the host.

### Authorized-Keys Hardening

When injecting a public key on the target:
```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAA... comment' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```
**Warning:** `sshd` silently rejects pubkey auth if `authorized_keys` or `~/.ssh/` permissions are too permissive.

### SSH Persistence Across Reboots

The `ssh.service` may be active (via systemd socket activation) but **disabled**, meaning it will not survive reboot:
```bash
sudo systemctl status ssh --no-pager -l     # check Loaded: line
sudo systemctl enable ssh                     # persist after reboot
```

### Key Safety

`~/.ssh/molt_donbenito2` is a per-host identity for hbox2. Do not use the user's default `id_ed25519` for `molt@` accounts unless explicitly instructed.

> See `references/hbox-connectivity-transcript.md` for a worked diagnostic session on an unreachable hbox2.

## Cert-Daemon Monitoring & Failure Diagnosis

When the cert-daemon is running but **not producing certificates**, it is often one of three failure modes rather than outright crash. Always check logs with the noise stripped:

```bash
docker compose logs --since=60m cert-daemon | grep -v "Already in attestation committee"
```

### Failure Mode A: Merkle Root Mismatch (Receipt REJECTED)
**Signature:** `CRITICAL daemon.blob_verifier: Merkle root mismatch` → `Verification REJECTED`
**Impact:** Receipt skipped. No cert emitted.
**Fix:** Likely upstream data drift. Pull latest image; clear blob cache if corrupted. Not directly fixable by operator.

### Failure Mode B: `claimed_hash` Parameter Not Specified (Submission Failed)
**Signature:** `ERROR daemon.substrate_client: Unexpected error submitting cert: Parameter 'claimed_hash' not specified` (3 retries, then abandoned)
**Impact:** Cert saved locally but **never submitted on-chain**.
**Fix:** Update image + verify `CHAIN_ID` matches live genesis. If persists, report upstream.

### Failure Mode C: Ogmios Unreachable (Cardano Epoch Skip)
**Signature:** `WARNING daemon.cert_daemon: Failed to get Cardano epoch from Ogmios: ... NameResolutionError`
**Impact:** Epoch anchoring skipped. Non-fatal for basic cert generation.
**Fix:** Optional. Configure `OGMIOS_URL` or keep `CHECKPOINT_ENABLED: "false"`.

### Automated Monitoring

Deploy `scripts/track-certs.py` as a periodic job. It checks:
- Container liveness (`docker compose ps`)
- Newest cert age (alert if >90 min)
- Block progress (`daemon-state.json`)
- Error/warning count in last 60m
- Heartbeat submission failures in last 60m

Output is JSON appended to `cert_tracker.log` and the latest state written to `cert_tracker_state.json`. Exit code 0 = HEALTHY, 2 = ALERT.

See `references/materios-cert-daemon-error-taxonomy.md` for full log signatures and diagnostic commands.

## Cert-Daemon Update Workflow (Materios)

A canonical cert-daemon update has **two steps**: verify chain identity, then bump the image.

### Step 1 — Verify CHAIN_ID

Fetch the live chain genesis and compare to the local `CHAIN_ID` env:

```bash
# Live genesis (no 0x prefix)
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"chain_getBlockHash","params":[0]}' \
  https://materios.fluxpointstudios.com/preprod-rpc | jq -r '.result' | sed 's/^0x//'

# Local value
docker exec materios-attestor-cert-daemon-1 sh -c 'echo CHAIN_ID=$CHAIN_ID'
```

If they differ, update `CHAIN_ID` in `~/materios-attestor/docker-compose.yml` before proceeding.

### Step 2 — Pull & Restart

```bash
cd ~/materios-attestor
docker compose pull cert-daemon
docker compose up -d cert-daemon
```

Note: `docker compose up -d` may be flagged as a long-lived process by some terminal backends. If so, run it with `timeout=60` or `background=true` and verify via `docker compose ps`.

**Slow-Registry Workaround**  
GHCR layers can take 3-8 minutes on slow links. The `docker compose pull` command will often timeout at 180s. Use a background process with polling:
```bash
# Background pull (notify when layer extraction completes)
terminal command="cd ~/materios-attestor && docker compose pull cert-daemon" background=true notify_on_complete=true

# Poll until extraction complete, then explicitly recreate:
docker compose up -d --force-recreate cert-daemon
```
If even `up -d --force-recreate` is rejected by the terminal backend, override with `timeout=60` on the terminal call.

### Step 3 — Verify Restart

```bash
# Container status
docker compose ps

# Health endpoint
curl -s http://127.0.0.1:8080/health
# Expected: {"status": "ok"}

# Recent logs
docker compose logs --tail=20 cert-daemon
```

Look for these log lines confirming healthy state:
- `Connected to wss://...` with chain name
- `Already in attestation committee as <SS58>`
- `Starting poll loop, interval=...`

### What to Ignore

`evidence_submitter: not configured` — **expected** on this node. Evidence pipeline is optional and disabled here.

## HyperCycle Node Manager Upgrade (systemd/x86)

Maintain and upgrade the HyperCycle Node Manager on Ubuntu 24.04 x86 workstations. This section covers the canonical upgrade path from 0.4.x to 0.5.x.

### Environment

- **Home dir**: `/home/hypercycle`
- **Config dir**: `/home/hypercycle/config` (contains `config.yaml` and `.env`)
- **Active version dir pattern**: `hypercycle-manager-<VERSION>`
- **Service**: `hypercycle` (systemd/sysvinit hybrid via `/etc/init.d/hypercycle`)
- **User**: `hypercycle` (group `hypercycle`, also in `docker` and `sudo`)

### Pre-Upgrade Checks

1. **Ubuntu version** — must be 24.04. Do not upgrade if still on 22.04.
2. **Architecture** — must be x86_64. Arm64/HyperBoxes follow a different path.
3. **No persistent_volume at `/container_mount`** — safe to proceed if all AIMs were deployed via standard guides.

```bash
# Verify OS
cat /etc/os-release | grep VERSION_ID
# Must show 24.04

# Verify architecture
uname -m
# Must show x86_64
```

### Upgrade Workflow (0.4.17 -> 0.5.1-x86)

#### Step 1 — Stop the service
```bash
sudo systemctl stop hypercycle
```

#### Step 2 — Backup config
```bash
sudo su hypercycle -c 'cd ~/config && cp config.yaml config.backup'
```

#### Step 3 — Update upgrade_bucket_url in config.yaml
Add or replace the `upgrade_bucket_url:` line:
```yaml
upgrade_bucket_url: "https://hypercycle-release.s3.us-east-2.amazonaws.com/"
```

The old value was `https://education-node-manager.hyperpg.site/`.

#### Step 4 — Download new release tarball
```bash
cd /home/hypercycle
rm -f *.tar
wget https://hypercycle-release.s3.us-east-2.amazonaws.com/hypercycle-0.5.1-x86.tar
```

#### Step 5 — Run upgrade script from the CURRENT version dir
The `upgrade.sh` lives in the **old** version folder and is self-contained — it extracts the new tarball, creates a virtualenv, runs migrations, installs dependencies, and switches the service.

```bash
sudo su hypercycle -c 'cd /home/hypercycle/hypercycle-manager-0.4.17 && ./upgrade.sh 0.4.17 0.5.1-x86'
```

Replace `0.4.17` with whatever your current version actually is.

#### Step 6 — Verify upgrade
```bash
# Service status
sudo systemctl status hypercycle --no-pager -l

# Health endpoint
curl -s http://localhost:8006/info
# Should return HTTP 200
```

#### Step 7 — Reboot (manual)
The node's init script attempts to restart old processes. Reboot the host to guarantee a clean state:
```bash
sudo reboot
```
Do this manually; the agent does not execute reboot.

### Post-Reboot Verification

After the node comes back:
1. Open the NM web UI and check the node version field
2. Verify tilling / AIM status
3. Confirm all expected machines show as online

### Post-Upgrade Stabilization (0.5.x)

If the service fails to start after upgrading to 0.5.x, the most likely cause is **missing MongoDB**. The 0.5.1-x86 `controller_serve` binary requires a running `mongod` on `localhost:27017` to create startup indexes. 0.4.x did not have this hard dependency.

#### Check for the MongoDB failure signature
```bash
sudo tail -n 50 /home/hypercycle/hypercycle-manager-0.5.1-x86/node_manager_server.out
```
Look for:
```text
pymongo.errors.ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused
Application startup failed
```

#### Install and start MongoDB
Use the vendor script provided in the package:
```bash
sudo /home/hypercycle/hypercycle-manager-0.5.1-x86/scripts/install_mongo.sh
sudo systemctl enable --now mongod
```

#### Clean up orphaned processes before restart
Failed starts may leave `controller_serve`, `node`, `vite`, or `esbuild` processes bound to ports 8000/8005/8006. If `systemctl stop hypercycle` errors out because PIDs are already missing, kill them manually:
```bash
sudo pkill -9 -f controller_serve
sudo pkill -9 -f "node.*vite"
```
Then start cleanly:
```bash
sudo systemctl start hypercycle
```

#### Verify full stack
```bash
# Port listeners
sudo ss -tlnp | grep -E '8000|8005|8006|27017'

# Health endpoints
curl -s -o /dev/null -w "%{http_code}" http://localhost:8006/info
# Expected: 200

curl -s http://localhost:8006/info
# Should return JSON
```

### Pitfalls
- **Wrong upgrade script location**: `upgrade.sh` is inside the *old* `hypercycle-manager-<OLD>` directory, not the new one. Running from the new dir will fail because the script assumes `..` is `/home/hypercycle`.
- **su auth failures inside the script**: The upgrade script tries `sudo service hypercycle stop` internally. If you pre-stopped the service, this produces harmless `su: Authentication failure` messages.
- **MongoDB is NOT optional on 0.5.x**: `mongod.service not found` was harmless on 0.4.x but is **runtime-fatal** on 0.5.1-x86. The init script calls `service mongod start`; if MongoDB is absent, `controller_serve` crashes in a loop until installed.
- **Production uses host MongoDB, not docker-compose mongo**: The package contains a `docker-compose.yaml` with a `db` service, but the systemd/sysvinit path relies on the host-level `mongod` service, not a container.
- **Stale port bindings from orphaned processes**: After a crashloop, `node` (vite) may hold `*:8006` and `controller_serve` may hold `*:8000`. The init.d stop logic can return FAILURE if PIDs vanished unexpectedly, leaving stale listeners. Manual `pkill` clears them.
- **chown errors during node_modules install**: The script runs `sudo -u hypercycle yarn` and then `chown -R $SUDO_USER`. If `hypercycle` is already the owner, this produces many "Operation not permitted" lines. Cosmetic only.
- **Healthcheck timing**: The script internally verifies `http://localhost:8006/info` before declaring success. If it passes, the upgrade is clean even if preceding stderr looks noisy.
- **No `--no-sandbox` needed**: Unlike Electron apps, NM does not use sandboxing.

## AIM Slot Image Update (Node Manager 0.5.x)

Update the Docker image running in a specific Node Manager slot **without rebooting the entire node**. This is the canonical path for upgrading an AIM from proxy to embedded runtime.

### Discovery: Node Manager 0.5.x Internals

| Aspect | Finding |
|--------|---------|
| Controller | Compiled PyInstaller binary (`controller_serve`, ~60MB) — **no editable source** |
| Slot state | Stored in **MongoDB** (`localhost:27017`, DB `node_manager`, collection `aims`) |
| Admin UI | React+Vite on port 8005 |
| API server | Compiled binary on port 8000 |
| Log output | `node_manager_server.out` (binary — use `grep -a`) |
| Registry | `aim_registry` defaults to `hub.docker.com/u/hypercycle`; `get_full_name()` prepends `hypercycle/` to bare image names |

**Implication:** You cannot `patch` or `sed` the Node Manager's slot configuration. You must use the Admin UI, REST API, or direct MongoDB operations. See `references/node-manager-05x-architecture.md` for full forensics on the compiled binary and registry resolution.

### Update Path (Step B — Image Swap + Slot Restart)

#### Step 1 — Build, Tag, and Push New Image

```bash
cd /home/mauricio/mosaic-companion/aim-images/mosaic-hermes-aim
docker build -t mosaic-hermes-aim:embedded .
docker tag mosaic-hermes-aim:embedded localhost:5000/mosaic-hermes-aim:embedded
docker push localhost:5000/mosaic-hermes-aim:embedded
```

#### Step 2 — Tag for Node Manager Registry Resolution

Node Manager 0.5.x resolves `image_name="mosaic-hermes-aim", image_tag="embedded"` through `DockerService.get_full_name()` which produces `hypercycle/mosaic-hermes-aim:embedded` when `aim_registry="hub.docker.com/u/hypercycle"`. You **must** tag the local image so Docker can find it under that computed name:

```bash
docker tag localhost:5000/mosaic-hermes-aim:embedded hypercycle/mosaic-hermes-aim:embedded
```

Get the image ID for the MongoDB update:
```bash
docker inspect hypercycle/mosaic-hermes-aim:embedded --format='{{.Id}}'
# → sha256:22ebd46ff051...
```

#### Step 3 — Update Slot via Admin UI (Safest)

1. Open `http://localhost:8005`
2. Navigate to **AIMS → Slot 0**
3. Change image to: `localhost:5000/mosaic-hermes-aim:embedded`
4. Save

#### Step 4 — Stop and Start ONLY the Slot (Never Reboot Node)

```bash
# Stop slot 0 container
docker stop HYPC_80ad4ea14c33cd2a_9000

# Start slot 0 again (Node Manager respawns with new image)
docker start HYPC_80ad4ea14c33cd2a_9000
```

#### Alternative: Direct MongoDB Slot Update (No UI)

If the Admin UI is inaccessible, update the AIM document directly:

```bash
# Get current AIM state
mongosh node_manager --quiet --eval 'JSON.stringify(db.aims.findOne({_id: 9000}))'

# Update image references and force re-download
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

The AIMLoop will see `status != "running"`, check if the new image exists locally, pull it if needed, and start the container with the updated `image_id`. `_id` is always the port number (9000 for slot 0).

### Preventing Node Manager Auto-Heal Loops

When a container is started manually (bypassing Node Manager's `controller_serve`), the AIMLoop periodically reconciles slot state. If it sees `status: "starting"` or `status: "error"` but a container is already running on that port, it may force-stop and restart it, destroying your manual work.

**Fix:** Set both `virtual: true` and `status: "virtual"` in MongoDB:
```bash
mongosh node_manager --quiet --eval '
  db.aims.updateOne(
    {_id: 9000},
    {$set: {
      virtual: true,
      status: "virtual"
    }}
  )
'
```
- `virtual: true` — AIMLoop skips this slot entirely (it thinks the AIM is virtual/placeholder)
- `status: "virtual"` — prevents the `if status != "running"` restart path

**When Node Manager restarts in a loop anyway:** The compiled binary may still try to stop containers bound to port 9000 if it detects a "rogue" container. In that case, also kill the controller's Docker CLI subprocesses:
```bash
# Emergency: pause AIMLoop by setting tries=99, status=error
mongosh node_manager --quiet --eval '
  db.aims.updateOne({_id: 9000}, {$set: {tries: 99, status: "error"}})
'
# Then stop the container manually when you want
```

## Why stop/start only the slot?
- Clean Python memory (old proxy modules flushed)
- Clean embedded runtime (new AIAgent instance)
- Proper environment loading (new ENV from image)
- Node Manager heartbeat and other slots unaffected

### Verification Steps

```bash
# Check embedded mode
curl -s http://127.0.0.1:9000/agent/status | jq .
# Expected: {"mode": "embedded", "agent_initialized": true}

# Test tool loop
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello in exactly 5 words"}'

# Test memory
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Remember my name is Mauricio"}'

curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is my name?"}'

# Test kanban tool
curl -X POST http://127.0.0.1:9000/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a kanban task called Test embedded runtime"}'
```

### Slot Update via REST API (Alternative)

If programmatic access is available:
```bash
curl -X POST http://localhost:8000/api/update_aim/0 \
  -H "Content-Type: application/json" \
  -d '{"image_name":"mosaic-hermes-aim","image_tag":"embedded"}'
```

### Consent Requirement for Docker Commands

The user's system has a **consent guard** on Docker commands that mutate running containers. Any `docker restart`, `docker stop`, or `docker rm` requires explicit user approval. The agent must:
1. State the exact command needed
2. Ask for explicit consent
3. If blocked, provide manual instructions and continue with verification steps

## Pitfalls

- **PipeWire audio conflict on shared workstations**: The `hypercycle` user (HyperCycle Node Manager) has a systemd user session that auto-starts `pipewire` + `wireplumber` + `pipewire-pulse` via socket activation. On a desktop workstation where the main user ALSO runs PipeWire, this creates BlueZ profile registration contention (`Address already in use`, `RegisterProfile() failed: org.bluez.Error.NotPermitted`). Bluetooth devices connect but produce no audio sink in `wpctl status`. Fix: `sudo -u hypercycle systemctl --user mask pipewire wireplumber pipewire-pulse pipewire.socket pipewire-pulse.socket`. See `references/pipewire-multi-user-conflict.md` for the full session transcript.
- **Stale CHAIN_ID after chain reset**: Some nodes had a cached value from a prior reset. Certs silently mismatch if `CHAIN_ID` is stale. Always verify live genesis before pulling a new image.
- **Image pin vs `:latest`**: The compose file currently uses `:latest`. If upstream releases a breaking change, pin to a digest in the `image:` line and document the pin reason in a compose comment.
- **Restart required, not just pull**: `docker compose pull` alone does not restart the container. Always follow with `up -d`.
- **Health port bound to 127.0.0.1**: The health endpoint is not exposed externally. Check from the host, not from another machine.
- **Dormant images without compose files**: A pulled image with no running container, no compose project, and no source references is a **dead asset** — not a live node. Verify with `docker ps -a --filter ancestor=<image>` and `docker compose ls` before concluding connectivity. See `references/pondora-echo-node.md` for a worked example.

## References

- `references/materios-attestor-update.md` — Session transcript of a live cert-daemon update including exact curl commands, log output, and verification steps.
- `references/materios-cert-daemon-error-taxonomy.md` — Three failure-mode signatures (Merkle root mismatch, `claimed_hash` missing, Ogmios unreachable) with log snippets, impacts, and diagnostic commands.
- `references/node-manager-05x-architecture.md` — Deep architecture forensics for Node Manager 0.5.x compiled binary, MongoDB slot schema, registry resolution, AIMLoop mechanics, and Docker container lifecycle.
- `references/hypercycle-mongodb-recovery.md` — MongoDB failure signature and recovery steps for 0.5.x runtime crashes after upgrade.
- `references/ssh-authorization-remote-nodes.md` — Pattern for authorized_keys injection, SSH persistence, self-referential target pitfall, and diagnostic tree.
- `references/ssh-rejection-invalid-user-transcript.md` — SSH rejection diagnosis via auth logs: distinguishing invalid user vs key mismatch vs network failure.
- `references/pondora-echo-node.md` — Dormant image forensics and connectivity verification checklist for a Dockerized Cardano WebSocket relay node (Pond/Pondora echo-client).
- `references/hbox-connectivity-transcript.md` — Worked diagnostic session on an unreachable hbox2.
- `references/pipewire-multi-user-conflict.md` — Full session transcript: Bluetooth earbuds connected but silent; WirePlumber `Address already in use` due to second `hypercycle` user PipeWire instance; masking and restart fix.

## Integration with MLOps Skills

When running AI/ML workloads alongside blockchain nodes (e.g., HyperCycle AIMs that use fine-tuned models):

- **TRL + Unsloth:** For RLHF training of node-attached models, use TRL skill with Unsloth optimizations. See `mlops/training/trl-fine-tuning` and `mlops/training/unsloth` skills.
- **Outlines:** For structured output from node APIs (e.g., schema-validated JSON responses from oracle nodes), use `mlops/inference/outlines`.
- **vLLM:** For high-throughput inference serving in AIMs, see `mlops/inference/vllm`.

Always verify GPU availability before scheduling training on node hosts:
```bash
nvidia-smi
```

## HyperAIBox Tiller Discovery & Verification

The HyperAIBox Tiller is a HyperCycle AIM (AI Module) that provides cryptographic tilling slots for Node Factory licenses. It runs as a Docker container on the HyperAIBox, managed by the Node Manager.

### The "Check UI First" Rule

**When investigating whether a Tiller is running, always check the Node Manager UI FIRST** (`http://<BOX>:8006/aims`), not MongoDB, logs, or Docker API. The UI is the authoritative source for AIM deployment status. The agent wasted 2+ hours checking MongoDB (`db.aims.find()` returned empty — wrong database), logs (showing AIM loop errors from a different process), and Docker API (grepping for `tiller` didn't match the auto-generated container name `HYPC_80ad4ea14c33cd2a_9000`) before the user prompted: "There is a tab inside Node Manager called AIMs."

### Three-Layer Verification

| Layer | Command | What It Tells You | Trust Level |
|-------|---------|-------------------|-------------|
| **Node Manager UI** | `http://<BOX>:8006/aims` | Is the Tiller listed? Status? Port? | **Primary** — authoritative |
| **Docker API** | `docker ps \| grep -i tiller` | Is the container actually running? | **Secondary** — verifies UI |
| **Tiller API** | `curl http://<PORT>/list` | Are slots available? Any active tillers? | **Tertiary** — functional check |

**Warning:** UI status, database status, and container status can diverge. The UI may show an old cached container name (e.g., `d0bd7ffa026d`) while `docker ps` shows a newer container (e.g., `6590a25bfe09`). The UI may show port 9001 while the actual container is on 9000. Always verify all three layers.

### What "Running" Means (And Doesn't Mean)

A Tiller container showing `running` in the UI means:
- ✅ The Docker container is alive
- ✅ The API endpoint (`GET /list`) responds
- ✅ Slots are available (e.g., `"available": 128`)
- ❌ **No actual tilling work is happening**
- ❌ **No slots are occupied** (`"tillers": []`)

The Tiller is a **host service** — it provides cryptographic slots but doesn't activate them automatically. Each slot must be:
1. `POST /create` — Reserved (costs money, ~$5/month)
2. `GET /get_message` — Message to sign retrieved
3. **User signs with wallet** — Non-custodial, we cannot do this
4. `POST /update` — Signature submitted, tiller activates

### Node Manager UI vs MongoDB Reality

The Node Manager UI (`:8006/aims`) and MongoDB (`node_manager` DB on `localhost:27017`) can show completely different data:

| Data Source | What It Shows | Our Finding |
|-------------|---------------|-------------|
| Node Manager UI (`:8006`) | AIMs deployed on THIS box | `hyperbox-tiller` on port 9000/9001, `running` ✅ |
| MongoDB `node_manager` | Network-wide node registry (ALL operators) | Our node shows `status: "dead"` ❌ |
| `docker ps` | Actual containers on THIS host | `HYPC_80ad4ea14c33cd2a_9000` on port 9000 ✅ |

**Key insight:** The `node_manager` MongoDB contains nodes from OTHER operators (AWS IPs like `18.236.42.238`, `185.196.203.188`). It's a **shared network registry**, not a local state store. The `db.aims.find()` check the agent performed was looking at the wrong data source entirely. The UI's "AIMs" tab comes from a **Docker socket scan + internal config**, not MongoDB.

### Tiller API Endpoints (Verified Live on C-3PO, 2026-06-29)

```bash
# List available slots and active tillers
curl http://localhost:9000/list
# → {"available": 128, "tillers": []}

# Create a new tiller slot (costs money)
curl -X POST http://localhost:9000/create
# → {"status": "created", "number": 1}

# Get message to sign for a license + chypc pair
curl "http://localhost:9000/get_message?number=1&license=2324779898048044&chypc=17735637771"
# → {"message": "a08fd..."}

# Update tiller with signature (activates tilling)
curl -X POST http://localhost:9000/update \
  -H "Content-Type: application/json" \
  -d '{
    "number": 1,
    "message": "a08fd...",
    "signature": {"signature": "09beef...", "key": "..."},
    "priority": 1
  }'
# → {"status": "updated"}
```

**Port:** The Tiller API is on port 9000 (the host port mapped from container port 4000). The UI showed 9001 but the actual container runs on 9000. Always check `docker ps --format '{{.Ports}}'` to verify.

**Environment:** Container has `MAX_TILLERS=8` but API returns `available: 128`. The software maximum is 128; the configured limit is 8. Use `MAX_TILLERS` for planning but `available` for actual count.

**Network:** Container runs with `USE_TESTNET=` (empty = mainnet). Real HYPC will be involved in slot creation and payment.

### R2D2 Status (192.168.0.38)

**R2D2 was unreachable during the entire session.** `ssh: connect to host 192.168.0.38 port 22: No route to host`. The Tiller status on R2D2 could not be verified. Common causes:
1. Powered off or in sleep mode
2. Different IP address (DHCP lease changed)
3. Network issue (WiFi down, different subnet)
4. SSH service not running

**Next steps for R2D2:** Check physical power, verify IP with `nmap -sn 192.168.0.0/24` or router admin panel, check if hostname changed.

### Non-Custodial Tiller Activation Flow

For a non-custodial Stargate Pool integration, the user must sign the activation message with their own wallet. The agent cannot hold keys.

```
User clicks "Delegate to Pool"
  → SPO calls POST http://<BOX>:9000/create
    → Returns {number: N} (slot number, ~$5 cost)
  → SPO calls GET http://<BOX>:9000/get_message?number=N&license=L&chypc=C
    → Returns {message: "..."} (cryptographic message to sign)
  → Mosaic-Companion UI shows: "Sign this message to activate tilling"
  → User signs with wallet (MetaMask, hardware wallet, etc.)
  → SPO calls POST http://<BOX>:9000/update with signature
    → Returns {status: "updated"}
  → Tiller slot is now active and doing cryptographic work
  → Monitor calls GET http://<BOX>:9000/list every 30s
    → Reports active tillers to SPO for dashboard display
```

**Key files for this flow:**
- `TILLER_FOUND_RUNNING.md` — High-level summary
- `NODE_MANAGER_FAILURE_ANALYSIS.md` — Deep technical analysis of why Node Manager AIM loop is broken (separate from Tiller being running)
- `TILLINGSERVICE_AIM_ANALYSIS.md` — Tiller manifest API analysis
- `references/hyperaibox-tiller-discovery-transcript.md` — Full session transcript

---

## HyperAIBox Agent (HBA) + Stargate Pool Orchestrator (SPO) Tilling

Manage distributed HyperAIBox appliances that provide compute for Node Factory tilling via the Stargate Pool.

### Architecture

| Component | Role | Port |
|-----------|------|------|
| **SPO** | Central matchmaker + billing | `:9100` |
| **HBA** | Per-box agent (provision/destroy/health) | `:8100` |
| **Node Manager** | Native HyperCycle service (NOT Docker) | `:8000` |
| **Tilling Monitor** | Docker container reporting to SPO | Host networking |

### Network Requirements

The HBA HTTP server listens on `0.0.0.0:8100`, but **UFW blocks incoming by default**. Before SPO can send provision commands:

```bash
# On EACH HyperAIBox:
sudo ufw allow from 192.168.0.0/24 to any port 8100
```

**Verification:** From the SPO host:
```bash
curl -s http://<BOX_IP>:8100/health -m 5
# Expected: {"status": "ok", "agent": "hba", "version": "1.0.0"}
```

### SPO Auto-Registration with Client IP Capture

When HBAs heartbeat to SPO, the SPO must capture the **client IP** for provision commands. The HBA does not advertise its IP in the heartbeat payload — SPO extracts it from the TCP connection.

```javascript
// In SPO heartbeat handler:
const clientIp = req.connection.remoteAddress?.replace(/^::ffff:/, '') || 'localhost';
jsonBody._clientIp = clientIp; // inject before processing
```

The registration object stores:
```javascript
{
  boxId,
  boxName,
  hbaApiHost: clientIp,   // NOT 'localhost'
  hbaApiPort: 8100,
}
```

**Failure mode:** If `hbaApiHost` is `'localhost'`, SPO tries to provision itself instead of the remote box.

### Tilling Provision Pattern

The HyperAIBox already runs Node Manager **natively** (systemd service on port 8000). Do NOT try to Dockerize it.

**Correct flow:**
1. SPO receives `POST /api/v1/tilling/provision`
2. SPO selects best box via matchmaking
3. SPO sends to HBA: `POST /provision` with `tilling_mode: true`
4. HBA verifies Node Manager on `:8000/health`
5. HBA starts a lightweight **Tilling Monitor** Docker container
6. Monitor reports earnings/uptime to SPO every 30s

**HBA provision payload (tilling mode):**
```json
{
  "tenant_id": "till-<uuid>",
  "tilling_mode": true,
  "license_id": "2324779898006116",
  "owner_wallet": "0x...",
  "network": "base",
  "spo_url": "http://192.168.0.112:9100"
}
```

**Critical:** `tilling_mode` is at the TOP LEVEL of the payload, not nested under `config`. The HBA API handler must extract it before routing to `TenantManager.provision()`.

### Tilling Monitor Container

The monitor is a `python:3.11-slim` container that:
- Checks Node Manager health on `:8000/health`
- Checks AIM slot health on `:9000/health`
- Reports to SPO: `POST /api/v1/tilling/heartbeat`

**Monitor environment:**
```bash
TENANT_ID=<uuid>
LICENSE_ID=<license>
OWNER_WALLET=<address>
SPO_URL=http://<SPO_HOST>:9100
HEARTBEAT_INTERVAL=30
```

**CRITICAL:** `SPO_URL` must be the **host-accessible IP** (e.g., `http://192.168.0.112:9100`), not `http://localhost:9100`. The monitor runs inside a Docker container; `localhost` resolves to the container's loopback, not the host. Pass the host's LAN IP, Tailscale IP, or WireGuard IP that the box can reach.

**HBA `provision_tilling()` must set `spo_url` correctly:**
```python
spo_url = config.get("spo_url", "")
# Fallback to a configured default if empty
if not spo_url:
    spo_url = "http://192.168.0.112:9100"
```

### Node Manager Health Check (HyperAIBox)

The HyperCycle Node Manager on HyperAIBoxes uses a **different health endpoint** than standard installations:

| Environment | Health Endpoint | Expected Response |
|-------------|----------------|-------------------|
| HyperAIBox (arm64, native) | `GET :8000/info` | `{"status":"alive", "name":"Hypercycle Node", ...}` |
| Standard x86 (systemd) | `GET :8006/info` | Same shape |
| Any | `GET :8000/health` | `405 Method Not Allowed` ❌ |

**Do NOT use `/health`** on HyperAIBoxes — it returns HTTP 405. Use `/info` for liveness checks. In HBA's `provision_tilling()`, verify NM with:

```python
import socket, urllib.request

# Step 1: TCP port check
nm_alive = False
try:
    with socket.create_connection(("127.0.0.1", 8000), timeout=5):
        nm_alive = True
except:
    pass

# Step 2: Verify /info responds
if nm_alive:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/info", timeout=5) as resp:
            nm_alive = resp.status == 200
    except:
        nm_alive = False

if not nm_alive:
    raise RuntimeError("Node Manager not responding on :8000")
```

**Also use `/info` for the Tilling Monitor script** (inside the Docker container running on the box with `--network host`). The monitor checks `http://localhost:8000/info` to determine `node_manager_alive` in its heartbeat payload to SPO.

### Stopping Tilling Sessions

When a user stops tilling, only the **monitor container** is destroyed. The Node Manager stays running for other sessions.

```python
def _destroy_tilling(self, tenant_id, tenant):
    monitor = tenant.get("monitor_container_id", f"till-{tenant_id[:8]}-monitor")
    # Stop ONLY the monitor
    docker stop <monitor>
    docker rm <monitor>
    # Node Manager on :8000 stays running
```

### Session Cleanup Loop

SPO runs a cleanup loop every 60s:
- Session expired (past `expiresAt`) → mark expired, decrement box tenant count
- No heartbeat for 5 minutes → mark `paused`

### Stargate Tilling Dashboard UI

The dashboard UI is a React component at `src/components/stargate/StargateTillingDashboard.tsx` that:
- Shows active/paused/stopped sessions with real-time stats
- Auto-refreshes every 30s via `window.electronAPI.stargate.tilling.getSessions()`
- Allows stopping sessions with a single click
- Displays pricing tiers (Shared $3/mo, Spot $0.01/hr, Dedicated $8/mo)
- Integrated into `AdaPortalPanel.tsx` below `NodeFactoryTrackerPanel`

### Full IPC Wiring Pattern

When adding a new tilling feature, wire through all three layers:
1. **Main process** (`electron/main.ts`): Add `ipcMain.handle("stargate:tilling:<action>", ...)` that proxies to SPO HTTP endpoint
2. **Preload** (`electron/preload.ts`): Add method under `stargate.tilling` namespace
3. **Renderer** (`src/components/stargate/*.tsx`): Call via `window.electronAPI?.stargate?.tilling?.<action>?()`

### Common Pitfalls

| Issue | Symptom | Fix |
|-------|---------|-----|
| UFW blocks HBA port | SPO provision times out with "fetch failed" | `sudo ufw allow from 192.168.0.0/24 to any port 8100` |
| SPO registers box with `localhost` | Provision targets wrong host | Inject `_clientIp` from `req.connection.remoteAddress` |
| Trying to Dockerize Node Manager | `Unable to find image 'hypercycle/node-manager:latest'` | NM runs natively — verify `:8000/info` instead |
| tilling_mode in wrong field | HBA treats as standard tenant | Pass `tilling_mode` at top level, not under `config` |
| Monitor can't reach SPO | Heartbeat failures in logs | Check SPO URL is reachable from box — must use host LAN IP, never `localhost` |
| NM health check uses `/health` | HTTP 405 Method Not Allowed | Use `/info` on HyperAIBoxes; `/health` only on standard x86 installs |
| Type error `b.system.uptime` | TypeScript compile error | Use `b.system.uptimeHours` |
| Chaining `.catch()` on `updateBoxTenant` | TS error: Property 'catch' does not exist | `updateBoxTenant()` returns plain object, not Promise |
| Missing `localIp` in telemetry | TS error: Property 'localIp' is missing | Include `localIp` with fallback in `registerBox()` init |
| Stale monitor container | `Conflict. container name already in use` | `docker rm -f till-<tenant[:8]>-monitor` before re-provision |
| SPO restart loop | Multiple node processes on `:9100` | `pkill -9 -f 'node spo_server.js'` before starting new instance |
| SPO registered boxes lost | `/api/status` shows 0 boxes after restart | HBAs heartbeat every 30s; wait ~45s for auto-registration |
| `node` binary in port 9100 conflict | Multiple node processes on 9100 | Check `ss -tlnp | grep 9100` and `pgrep -f 'node spo_server'` |
| Stale monitor container | `Conflict. container name already in use` | `docker rm -f till-<tenant[:8]>-monitor` before re-provision |
| SPO auto-restarts in loop | SPO process keeps dying and respawning | Check for systemd/cron auto-restart; use `pkill -9` and start manually |
| SPO registered boxes lost | `/api/status` shows 0 boxes after restart | HBAs heartbeat every 30s; wait ~45s for auto-registration |
| `node` binary in port 9100 conflict | Multiple node processes on 9100 | Check `ss -tlnp | grep 9100` and `pgrep -f 'node spo_server'` |

## Self-Test Scenarios

### Scenario 1: Certified Daemon Update
- **State:** New `cert-daemon` image pushed upstream.
- **Action:** Verify chain ID → pull image → restart → verify health endpoint.
- **Verify:** `curl -s http://127.0.0.1:8080/health` returns `{"status": "ok"}`.

### Scenario 1b: Cert Tracker Cron Job Recovery
- **State:** User asks "remember the materios attestor cron job?" — cron job exists but hasn't logged in weeks.
- **Action:** Check `hermes cronjob list` → verify tracker script exists → recreate with proper schedule → verify current daemon state.
- **Key findings:**
  - Cron jobs can be lost during infrastructure audits/migrations
  - Tracker state file: `~/materios-attestor/cert_tracker_state.json` (last entry may be stale)
  - Block progress: Was 230,226 on 2026-05-18 → 824,101 on 2026-07-03 (daemon kept running)
  - Certs generated: 704 → 1,093 (389 new while tracker was silent)
- **Verify:** Run `python3 track_certs.py` manually → check `cert_tracker_state.json` → confirm `status: HEALTHY`.
- **Recurring job:** `*/10 * * * * cd ~/materios-attestor && python3 track_certs.py --log-file cert_tracker.log --json-out cert_tracker_state.json --alert-threshold-minutes 90`

### Scenario 2: Node Manager Upgrade (0.4.x -> 0.5.x)
- **State:** Old NM service on x86_64 Ubuntu 24.04.
- **Action:** Backup config → download tarball → run upgrade.sh from old dir → install MongoDB if needed → kill orphaned processes → reboot.
- **Verify:** `systemctl status hypercycle --no-pager` shows active. Port 8006 returns JSON.

### Scenario 3: Dormant Image Forensics
- **State:** Suspected dead container/image on host.
- **Action:** `docker images | grep pondora` → check if compose exists (`docker compose ls`) → check running containers (`docker ps -a --filter ancestor=...`).
- **Verify:** Document finding if image is dead asset only.

### Scenario 4: Remote Node SSH Access
- **State:** User asks whether `hbox` nodes are reachable from the current host.
- **Action:** Check `~/.ssh/config` for entries → run `ssh -G` for resolution → test TCP/22 with `/dev/tcp` → verify ICMP → check ARP/ip neigh → query DNS/mDNS → check Tailscale/ZeroTier peers.
- **Verify:** Report configured hosts, reachable vs unreachable targets, offline diagnosis tree, and any missing config entries.

### Scenario 5: SSH Public-Key Authorization
- **State:** User provides a public key and asks to "add it to AtomMan" (or any remote box).
- **Action:** First verify if the current machine IS the target (hostname, git config, Chrome profile). If yes → inject locally with `700 ~/.ssh` + `600 authorized_keys` + `systemctl enable ssh`. If no → provide exact command block for the target and verify SSHD listens on `:22`.
- **Verify:** Run `scripts/verify_ssh_access.py` to confirm pubkey acceptance and daemon persistence.


### Scenario 5: Cert Daemon Monitoring and Failure Diagnosis
- **State:** Daemon running but no new certs for >2 hours; `Already in attestation committee` spam in logs.
- **Action:** Strip noise from logs → grep for `Verification REJECTED` (Merkle mismatch) or `Unexpected error submitting cert` (`claimed_hash` missing) or `Ogmios` unreachable. Run `track-certs.py` to surface alert. If newest cert age >90 min, investigate Failure Mode A/B/C in `references/materios-cert-daemon-error-taxonomy.md`.
- **Verify:** After pulling latest image and verifying `CHAIN_ID`, block progress advances and at least one `Saved cert` appears within the next poll interval.

### Scenario 6: MLOps Model Deployment to AIM
- **State:** Fine-tuned model produced by Unsloth/TRL needs to be served by HyperCycle AIM.
- **Action:** Export to GGUF (`model.save_pretrained_gguf(...)`) → upload to AIM storage → update AIM config → restart AIM service.
- **Verify:** AIM status page shows model online. Inference endpoint responds.

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-05-12 | Initial skill with HyperCycle NM and Materios workflows |
| 1.1.0 | 2026-05-13 | Added MLOps integration, self-test scenarios, version history |
| 1.2.0 | 2026-05-18 | Added hbox connectivity transcript, dormant image forensics |
| 1.3.0 | 2026-05-18 | Added Materios cert-daemon failure taxonomy (A/B/C), automated monitoring with `scripts/track-certs.py`, expanded error diagnosis commands |
| 1.4.0 | 2026-05-18 | Added SSH authorization pattern, self-referential target pitfall, `scripts/verify_ssh_access.py`, `references/ssh-authorization-remote-nodes.md` |
| 1.5.0 | 2026-05-18 | Added SSH rejection auth-log diagnosis with signature table (`Invalid user`, `Failed publickey`, etc.) and `references/ssh-rejection-invalid-user-transcript.md` |
| 1.7.0 | 2026-06-27 | Added SPO restart-loop pitfall, stale container cleanup, monitor `/info` fix for tilling, clarified that monitor script inside container also uses `/info`, and expanded the pitfall table with auto-restart and duplicate-process entries |
| 1.6.0 | 2026-06-27 | Added Stargate Tilling (HBA + SPO) architecture, provision pattern, UFW/firewall requirements, SPO client-IP capture, and `references/stargate-tilling-debug-transcript.md` |
