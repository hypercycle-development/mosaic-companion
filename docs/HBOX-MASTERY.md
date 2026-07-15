# Mosaic Bot — HyperAIBox Fleet Mastery

## What We Built

A comprehensive HyperAIBox fleet management system integrated into Mosaic Bot. The bot now understands:

- How to discover, check, and manage HyperAIBox compute nodes
- What to do when boxes go offline or change IPs
- How to restart HBA agents and verify tiller services
- How to distinguish real HyperAIBoxes from other network devices
- How to diagnose and report fleet health

## Live Fleet Status (as of 2026-07-01)

### C-3PO (Primary HyperAIBox)
- **Current IP**: 192.168.0.150 (was .151 before reboot)
- **Status**: 🟢 ONLINE
- **Architecture**: arm64
- **RAM**: 16.5GB
- **CPUs**: 8
- **Disk**: 38GB free of 115GB
- **Tiller**: Port 9000, 8 AIM slots available
- **Node Manager**: Port 8006 responding
- **HBA**: Port 8100 responding (was in zombie state, restarted)
- **Tailscale**: 100.92.116.49
- **Node ID**: 80ad4ea14c33cd2a
- **License**: 2324779898048044
- **Uptime**: 95.7% over 19,739 heartbeats
- **Also Runs**: Cardano node (:3001), Postgres (:5433), Docker registry (:5000)

### R2D2 (Secondary HyperAIBox)
- **Current IP**: 192.168.0.38 (stable)
- **Status**: 🟢 ONLINE
- **Architecture**: arm64
- **Tiller**: Port 9001, 8 AIM slots available
- **Node Manager**: Likely responding
- **HBA**: Port 8100 responding
- **Tailscale**: 100.94.115.120
- **Also Runs**: Hermes agent, Stargate MCP bridge, Ollama
- **Docker**: Registry (:5000), Materios attestor (:8081)

### SPO (Stargate Pool Orchestrator)
- **IP**: 192.168.0.112:9100
- **Status**: 🔴 DOWN
- **Impact**: Both HBAs show heartbeat failures (expected behavior)
- **Action Needed**: Deploy SPO or redirect HBA configs

## Critical Discovery: IP Address Behavior

**C-3PO CHANGES IP AFTER REBOOT**
- Before reboot: 192.168.0.151
- After reboot: 192.168.0.150
- **Reason**: DHCP lease not renewed with same IP
- **Fix**: Scan subnet .100-.160 after any reboot to find C-3PO
- **Registry**: Updated stargate-registry.ts with new IP

## Diagnostic Commands the Bot Knows

### Discover Boxes
```bash
# Scan subnet for alive HyperAIBoxes
for i in $(seq 100 160); do
  ping -c 1 -W 0.5 192.168.0.$i > /dev/null 2>&1 && echo "192.168.0.$i ALIVE"
done

# Check if alive IP is HyperAIBox (HBA responds)
curl -s --connect-timeout 3 http://192.168.0.$i:8100/health
```

### Check Services
```bash
# HBA health
curl http://<ip>:8100/health

# Node Manager (full telemetry)
curl http://<ip>:8006/api/info | python3 -m json.tool

# Tiller (returns available slots)
curl http://<ip>:9000/list  # or 9001 for R2D2

# SSH check
ssh -o ConnectTimeout=5 -i ~/.ssh/id_ed25519 hyperai@<ip> "hostname"
```

### Restart HBA
```bash
# On the HyperAIBox (via SSH):
cd /home/hyperai/stargate
rm -f hba.pid  # Remove stale PID if process is zombie
pkill -f hba_agent  # Kill any existing
nohup python3 hba_agent.py --config config/hba.json >> logs/hba.log 2>&1 &
```

### Full Box Diagnostics (SSH)
```bash
ssh -o ConnectTimeout=5 -i ~/.ssh/id_ed25519 hyperai@<ip> "
  echo '=== Node Info ==='
  curl -s http://localhost:8006/api/info | head -c 500
  echo
  echo '=== Docker ==='
  docker ps | head -5
  echo '=== HBA ==='
  curl -s http://localhost:8100/health
  echo
  echo '=== Tiller ==='
  curl -s http://localhost:9000/list  # or 9001
"
```

## What We Learned (Mistakes to Remember)

1. **Tiller endpoint is /list, NOT /health**
   - `/health` returns 404 Not Found
   - `/list` returns `{"available":8,"tillers":[]}`

2. **192.168.0.90 is NOT a HyperAIBox**
   - It's a Windows PC running OpenSSH
   - Only port 22 open, no HBA/tiller/Node Manager
   - MAC prefix: c4:3a:da = Raspberry Pi Trading (but this is the desktop)

3. **C-3PO HBA zombie process**
   - Process existed (pid 1419473) but not listening on :8100
   - Fix: Remove stale PID file, kill process, restart
   - Root cause: Previous crash left PID file behind

4. **Network scan revealed actual devices**
   - .1: Router
   - .38: R2D2 (HyperAIBox)
   - .90: Windows PC
   - .112: This desktop (Mosaic Companion)
   - .150: C-3PO (HyperAIBox)
   - .201: Unknown device

5. **SPO is required for HBA heartbeat registration**
   - Without SPO, HBAs show "No route to host" errors
   - This is expected, not a bug
   - Pool operations blocked but individual boxes still work

## Bot Auto-Healing Capabilities

The bot can now:
- Detect offline/degraded boxes via `checkFleetStatus()`
- Attempt HBA restart on zombie processes
- Discover new box IPs after reboot
- Update registry with discovered IPs
- Build teaching summaries for human operators

## Files Modified

1. `stargate-registry.ts` — Updated with correct C-3PO IP (.150), live tiller ports
2. `orchestrator.ts` — Dynamic IP discovery from registry, Node Manager checks
3. `hbox-manager.ts` — NEW: Fleet health checks, auto-healing, discovery
4. `index.ts` — IPC handlers for hbox:* commands

## Next Steps for Full Autonomy

1. Deploy SPO or create local SPO mock
2. Add DHCP reservation for C-3PO (fix .151 permanently)
3. Add box auto-discovery to heartbeat (scan subnet every N minutes)
4. Build tiller provisioning via bot commands
5. Integrate ANFE delegation checks
6. Add "Box Rebooted" detection and auto-reconfiguration

## Teaching the Bot: Key Questions It Can Now Answer

- "Are my HyperAIBoxes online?" → `checkFleetStatus()`
- "Why is C-3PO not responding?" → Scan subnet, check last known IP, update registry
- "How many AIM slots available?" → Sum tiller available slots across fleet
- "Restart HBA on C-3PO" → SSH in, kill stale process, restart
- "What's the tiller endpoint?" → `/list` on port 9000 (C-3PO) or 9001 (R2D2)
- "Is SPO working?" → Check 192.168.0.112:9100/health
- "Why are HBA logs showing errors?" → SPO is down, heartbeats fail (expected)
- "Did C-3PO change IP again?" → Scan .100-.160, update registry if found

## Integration Points

The bot exposes these IPC commands:
- `hbox:check-health` — Single box deep health check
- `hbox:check-fleet` — Full fleet status with recommendations
- `hbox:discover` — Scan subnet for HyperAIBoxes
- `hbox:teaching-summary` — Get this document as text
- `hbox:auto-heal` — Attempt automatic fixes

## Verification Checklist

- [x] C-3PO SSH working
- [x] R2D2 SSH working
- [x] C-3PO HBA responding on :8100
- [x] R2D2 HBA responding on :8100
- [x] C-3PO Tiller on :9000
- [x] R2D2 Tiller on :9001
- [x] C-3PO Node Manager on :8006
- [x] Registry updated with correct IPs
- [x] Build passes (electron + renderer)
- [x] Teaching document created
- [ ] SPO deployed (still down)
- [ ] Bot tested end-to-end via IPC

## Key Insight

**The bot now knows that "working" means:**
1. SSH responds
2. HBA returns `{"status": "ok"}`
3. Tiller returns `{"available": N, "tillers": []}`
4. Node Manager returns full telemetry JSON
5. SPO may be down (expected during setup)

**And "broken" means:**
1. No SSH response → Check network/power
2. HBA not responding → Restart (remove stale PID first)
3. Tiller not found → Check Docker, verify port mapping
4. Wrong IP after reboot → Scan subnet, update registry
