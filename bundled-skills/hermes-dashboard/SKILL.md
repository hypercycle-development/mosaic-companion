---
name: hermes-dashboard
description: |
  Start, stop, audit, and troubleshoot the Hermes Agent web dashboard
  (FastAPI/Starlette SPA on port 9119). Covers readiness checks,
  dependency verification, dry-run launch analysis, and safe
  co-existence with the AIM or other Hermes services.
---

# Hermes Dashboard Operations

## Overview
The Hermes Dashboard is a **separate** FastAPI/Starlette process that serves a
Vite/React SPA. It is **NOT** part of the AIM (`main.py`) and does **NOT**
share ports with the embedded agent. It runs on port **9119** by default.

## Prerequisites
- `fastapi`, `uvicorn[standard]`, `starlette` (lazy-installable via `tool.dashboard`)
- Pre-built frontend bundle at `hermes_cli/web_dist/` (from `cd web && npm run build`)
- Node.js + npm only needed if rebuilding; `--skip-build` bypasses this

## Quick Start

```bash
# Default launch (port 9119, auto-open browser)
hermes dashboard

# Headless / SSH / safe co-existence with AIM
hermes dashboard --port 9119 --no-open --skip-build
```

## Readiness Audit Procedure

1. **Verify command availability**: `hermes dashboard --help`
2. **Check Python deps**: `python3 -c "import fastapi, uvicorn"`
3. **Check frontend bundle**: `ls hermes_cli/web_dist/index.html`
4. **Check port availability**: `ss -tlnp | grep 9119`
5. **Dry-run launch analysis**: Simulate `cmd_dashboard()` import → build check → plugin discovery → `start_server` load
6. **Health endpoint**: `GET http://127.0.0.1:9119/api/status`

## Key Flags

| Flag | Purpose |
|------|---------|
| `--port 9119` | Bind port (default 9119) |
| `--host 127.0.0.1` | Bind address (default localhost) |
| `--no-open` | Suppress browser auto-open |
| `--skip-build` | Serve existing `web_dist` without npm |
| `--insecure` | Bind to non-loopback (DANGEROUS) |
| `--tui` | Enable in-browser Chat tab |
| `--stop` | Kill all dashboard processes |
| `--status` | List running dashboard processes |

## Environment Variables

| Variable | Effect |
|----------|--------|
| `HERMES_WEB_DIST` | Override path to built SPA (default: `hermes_cli/web_dist`) |
| `HERMES_DASHBOARD_TUI=1` | Equivalent to `--tui` |

## Persistent Deployment (systemd)

For production or headless hosts where SSH disconnects must not kill the dashboard.

### Controlled Cutover
1. **Audit current state**: record PID, port occupancy, and kill the manual process
2. **Verify port free**: `ss -tlnp | grep 9119`
3. **Write service file**: see `templates/hermes-dashboard.service`
4. **Install & enable**:
   ```bash
   sudo cp hermes-dashboard.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable hermes-dashboard.service
   sudo systemctl start hermes-dashboard.service
   ```
5. **Verify**:
   - `sudo systemctl status hermes-dashboard.service`
   - `curl -s http://127.0.0.1:9119/api/status`
   - `sudo systemctl is-enabled hermes-dashboard.service`

### Why systemd
- Survives SSH disconnect / SIGHUP
- Auto-restart on crash (`Restart=always`)
- Starts on boot (`enabled`)
- Logs in `journalctl -u hermes-dashboard`

### After Reboot Checks
```bash
sudo systemctl status hermes-dashboard.service
curl -s http://127.0.0.1:9119/api/status
sudo journalctl -u hermes-dashboard -n 20 --no-pager
```

## Co-existence Rules
- Dashboard and AIM are separate processes on separate ports
- Dashboard on 9119 does not interfere with AIM on 9000/8006/8642
- No container modifications needed for the AIM

## Troubleshooting

**"Web UI dependencies not installed"**
```bash
cd /path/to/hermes
python3 -m pip install -e .[web]
# or via lazy-install: the dashboard will auto-install on first run
```

**"No web dist found"**
```bash
cd /path/to/hermes/web
npm install && npm run build
```

**Port 9119 in use**
```bash
hermes dashboard --stop
# or find and kill manually: ps aux | grep "hermes dashboard"
```

## References
- `references/readiness-audit.md` — Full step-by-step audit checklist
