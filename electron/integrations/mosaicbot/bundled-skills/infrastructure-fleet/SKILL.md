---
name: infrastructure-fleet
description: Knowledge for HyperAIBox fleet (C-3PO, R2-D2), SPO, and Materios Attestor hardware attestation
version: 1.0.0
author: master
date: 2026-07-03
tags: [infrastructure, materios, attestor, hyperaibox, fleet, c3po, r2d2, monitoring]
trigger_phrases:
  - "materios attestor"
  - "materios-attestor"
  - "cert daemon"
  - "C-3PO"
  - "C3PO"
  - "R2-D2"
  - "R2D2"
  - "HyperAIBox"
  - "HBA"
  - "fleet"
  - "SPO"
  - "Stargate Pool Operator"
  - "hardware attestation"
  - "attestation service"
  - "is materios running"
  - "check attestor"
---

# Infrastructure Fleet & Materios Attestor Skill

## Quick Answer: What is materios-attestor?

**Materios Attestor** is a **Zero-Knowledge Hardware Attestation Service** by Flux Point Studios. It generates cryptographic certificates proving HyperAIBox hardware is genuine, untampered, and authentic.

**Purpose**: Proof of Physical Work + Anti-sybil protection for decentralized compute networks.

## Where does it run?

| Location | IP | Path/Container |
|----------|-----|----------------|
| **This appliance** (cmhpec-wk-01) | localhost | `/home/mauricio/materios-attestor/` (Docker) |
| **C-3PO** | 192.168.0.150 | `materios-attestor-cert-daemon-1` container |
| **R2-D2** | 192.168.0.38 | `materios-attestor-cert-daemon-1` container |

## Current Status (2026-07-03)

| Component | Status | Details |
|-----------|--------|---------|
| C-3PO | ✅ healthy | 192.168.0.150, 128 slots, 0 BATT |
| R2-D2 | ✅ healthy | 192.168.0.38, 8 slots, 0 BATT |
| SPO | ⚠️ responding | 192.168.0.112:9100 — no health endpoint |
| Materios (this) | ✅ HEALTHY | Block 824,101, 1,093 certs |
| Materios (C-3PO) | ✅ Running | Container up 47h |
| Materios (R2-D2) | ✅ Running | Container up 47h |

## How to check if it's working

### On this appliance:
```bash
python3 ~/materios-attestor/track_certs.py
```

### On HyperAIBoxes:
```bash
# C-3PO
ssh hyperai@192.168.0.150 "docker exec materios-attestor-cert-daemon-1 ls /data/certs | wc -l"

# R2-D2
ssh hyperai@192.168.0.38 "docker exec materios-attestor-cert-daemon-1 ls /data/certs | wc -l"
```

## C-3PO Known Issues

**IP Changes After Reboot**: C-3PO's IP is **dynamic** in the `.100-.160` range.
- Last known: `.150` (was `.151`)
- If SSH fails: Scan with `for ip in 192.168.0.{100..160}; do timeout 2 bash -c "echo > /dev/tcp/$ip/22" 2>/dev/null && echo "Found: $ip"; done`
- Update `~/.ssh/config`: `Host c3po` → `HostName 192.168.0.XXX`

## SSH Config

```ssh-config
Host c3po
    HostName 192.168.0.150  # ⚠️ UPDATE THIS if IP changes
    User hyperai
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking accept-new

Host r2d2
    HostName 192.168.0.38
    User hyperai
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking accept-new
```

## SPO (Stargate Pool Operator)

- **IP**: 192.168.0.112
- **Port**: 9100
- **Status**: HTTP responds, but has **no health endpoint**
- **SSH Access**: Unknown user (hyperai, mauricio, root, admin all failed)
- **Monitoring**: TCP connectivity only

## Materios Attestor Architecture

**What it does**:
1. Polls `wss://materios.fluxpointstudios.com/preprod-rpc` for attestation requests
2. Generates ZK proofs of hardware state (TPM quotes, measurements)
3. Stores certificates in CBOR format at `/data/certs/`
4. Posts heartbeats every 30 seconds
5. Tracks block progress in `daemon-state.json`

**Key Files**:
- `~/materios-attestor/docker-compose.yml` — Container config
- `~/materios-attestor/track_certs.py` — Monitoring script
- `~/materios-attestor/cert_tracker_state.json` — Latest state
- `~/materios-attestor/cert_tracker.log` — History log

**Chain Info**:
- **Chain ID**: `0e46e33f639a56cc8780fd871d9a15e16d99af248526f907cb560cb40849f7bf`
- **Genesis**: `0x0e46e33f639a56`
- **RPC**: `wss://materios.fluxpointstudios.com/preprod-rpc`
- **Blobs**: `https://materios.fluxpointstudios.com/preprod-blobs`

**Operator Info**:
- **SS58 Address**: `5CtBFsSx8HzX272AGNb764sv4sBLQUwb6GfHQjk8YdbMPW2d`
- **Install Date**: 2026-04-29
- **Mode**: `attestor`

## Monitoring Infrastructure

**Cron Jobs**:
| Job | Schedule | Script | Purpose |
|-----|----------|--------|---------|
| `materios-cert-tracker` | Every 10 min | `track_certs.py` | Track this appliance's attestor |
| `hba-fleet-monitor` | Every 15 min | `track_fleet.py` | Track C-3PO, R2-D2, SPO health |

**Alert Conditions**:
- No new certificates in >90 minutes
- Container not running
- High error/warning count (>50 in 60m)
- Heartbeat failures
- Box unreachable via SSH

## Common Questions

### "Is materios-attestor running?"

Check:
```bash
# This appliance
docker ps | grep materios

# C-3PO
ssh hyperai@192.168.0.150 "docker ps | grep materios"

# R2-D2
ssh hyperai@192.168.0.38 "docker ps | grep materios"
```

**Expected**: All three should show `materios-attestor-cert-daemon-1` as `Up`

### "Why is C-3PO unreachable?"

Most likely: **IP changed after reboot**

**Fix**:
```bash
# Scan for new IP
for ip in 192.168.0.{100..160}; do timeout 2 bash -c "echo > /dev/tcp/$ip/22" 2>/dev/null && echo "Found: $ip"; done

# Update SSH config
# Edit ~/.ssh/config: Host c3po → HostName [NEW_IP]
```

### "How many certificates have been generated?"

**This appliance**:
```bash
cat ~/materios-attestor/cert_tracker_state.json | jq '.certs.total'
```

**C-3PO**:
```bash
ssh hyperai@192.168.0.150 "docker exec materios-attestor-cert-daemon-1 ls /data/certs | wc -l"
```

**R2-D2**:
```bash
ssh hyperai@192.168.0.38 "docker exec materios-attestor-cert-daemon-1 ls /data/certs | wc -l"
```

### "What is the current block progress?"

```bash
# This appliance
docker exec materios-attestor-cert-daemon-1 cat /data/daemon-state.json | jq '.last_processed_block'
```

### "Why is SPO showing as unhealthy?"

**SPO is NOT unhealthy** — it just has **no health endpoint**.

It responds on HTTP :9100 but returns `{"error":"Not found"}` for all paths. This is a documentation gap with HyperCycle — the service is running but we don't know the proper health check URL.

**Action**: Consider SPO healthy if TCP :9100 responds.

## Troubleshooting Commands

**Restart Materios (this appliance)**:
```bash
cd ~/materios-attestor
docker compose restart cert-daemon
docker compose logs -f cert-daemon
```

**Check logs for errors**:
```bash
docker compose logs --since=1h cert-daemon | grep -i error
```

**Verify chain sync**:
```bash
docker exec materios-attestor-cert-daemon-1 cat /data/daemon-state.json | jq
```

**SSH to C-3PO**:
```bash
ssh hyperai@192.168.0.150  # Update IP if needed
```

**SSH to R2-D2**:
```bash
ssh hyperai@192.168.0.38
```

## References

- **Full Documentation**: `~/Vault/02-PROJECTS/infrastructure-fleet-materios.md`
- **Quick Reference**: `~/Vault/02-PROJECTS/infrastructure-fleet-quickref.md`
- **Fleet Monitor Script**: `~/fleet-monitor/track_fleet.py`
- **Materios Tracker**: `~/materios-attestor/track_certs.py`
- **SSH Config**: `~/.ssh/config`

## Version History

- **v1.0.0** (2026-07-03): Initial skill — C-3PO IP updated to .150, SPO status clarified, Materios documented
