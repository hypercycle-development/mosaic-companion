---
name: midnight-city-continuous-miner
description: "Use when a Midnight City miner agent must mine ore continuously without stopping, moving between rocks, or selling early. Provides a fast-loop Python daemon and troubleshooting recipes for contested nodes."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [gaming, midnight-city, miner, daemon, automation]
    related_skills: [midnight-city-direct-control]
---

# Midnight City Continuous Miner

## Overview

This skill keeps a Midnight City **miner** agent mining ore in a tight, non-stop loop.
It solves the common failure modes:

- Agent stops for minutes between harvests.
- Agent keeps walking from rock to rock instead of camping one node.
- Agent sells ore too early.
- Multiple daemons issue conflicting commands.
- Hunger interrupts mining when it is not critical.

The core artifact is a fast-loop Python daemon. It issues `harvest mines-worksite mine ore` repeatedly with a ~0.5 s retry on contention, reads agent state only every 60–120 s, and only pauses for critical hunger or to sell at the configured batch target.

**User preference from this environment:** sell ore in **1,000-ore batches** and accumulate crystals until **+100,000**, rather than holding ore to a single large target.

## When to Use

- User says "mine continuously", "never stop mining", "don't move from rock to rock", or "camp the node".
- The agent is at the Central mines but throughput is low compared to other agents.
- The user wants to accumulate ore before selling (e.g. 1,000 ore batches for crystals).
- Agent messages need a friendly win/win reply while mining.

## Do NOT Use For

- Non-miner professions (lumberjack, fisher, etc.) — the `harvest` activity and fallback `work` command are miner-specific.
- One-shot mining tasks — use the direct-control CLI instead.
- Agents that should actively trade/craft/socialize — this daemon is tuned for pure mining, although it does sell batches and reply to deals.

## Required Files

- `scripts/donbenito-miner.py` — the daemon source.
- `references/continuous-miner-pitfalls.md` — deep troubleshooting and the 24/7 watchdog pattern.
- A shell watchdog script (e.g. `~/.hermes/scripts/restart_donbenito.sh`) if the daemon must be self-healing.
- The Midnight City direct-control skill must be installed at `~/.hermes/skills/midnight-city-direct-control/midnight-city-direct-control/scripts/mcity-control.mjs`.
- A writable log directory at `~/.midnight-daemon/`.

## Installation

1. Copy `scripts/donbenito-miner.py` to `~/.midnight-daemon/donbenito-miner.py`.
2. Ensure the script is executable:
   ```bash
   chmod +x ~/.midnight-daemon/donbenito-miner.py
   python3 -m py_compile ~/.midnight-daemon/donbenito-miner.py
   ```
3. Edit the `CONFIG` block at the top with the correct agent name/ID.

## Starting the Daemon

Kill any old or conflicting daemons first, then start the new one:

```bash
pkill -f donbenito-miner
pkill -f midnight-agent-strategy
pkill -f mcity-control.mjs
sleep 2
nohup python3 -u ~/.midnight-daemon/donbenito-miner.py > ~/.midnight-daemon/donbenito.stdout 2>&1 &
disown
```

For Hermes-managed background processes, use `terminal(background=True, watch_patterns=["Entering main loop", "Position validated", "Mined", "MOVE-TO-MINE"])` to monitor daemon events without manual polling. Use `process(action='poll')` for quick health checks without waiting for completion. Set `notify_on_complete=False` because mining daemons run indefinitely.

For 24/7 unattended operation, do not rely only on the background process — add the watchdog recipe under **24/7 Self-Healing** below.

## Architecture

### Implementation Options

**Option A: Direct HTTP API (Recommended)**
Pure Python implementation using `requests` library directly against Midnight City observer API. No Node.js dependency, no subprocess overhead.

```python
import requests

OBSERVER_URL = "https://midnight.city/observer"
API_TOKEN = os.getenv("MCITY_API_TOKEN")
AGENT_ID = "user-agent-..."

def api_call(method, endpoint, data=None):
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    if data:
        headers["Content-Type"] = "application/json"
    url = f"{OBSERVER_URL}{endpoint}"
    return requests.request(method, url, headers=headers, json=data).json()

# Get session
session = api_call("POST", "/api/local-control/session", {
    "agentId": AGENT_ID,
    "clientInstanceId": "my-daemon:instance-1"
})
token = session["token"]

# Harvest
result = api_call("POST", "/api/actions", {
    "type": "harvest",
    "agentId": AGENT_ID,
    "areaId": "mines-worksite",
    "activity": "mine ore"
}, token=token)
```

**Option B: Node.js Wrapper (Legacy)**
Shell out to `mcity-control.mjs` script. Requires Node.js and handles JSON serialization overhead. Use only if direct HTTP is blocked.

```python
result = subprocess.run(
    ["node", "mcity-control.mjs", "harvest", "mines-worksite", "mine ore"],
    capture_output=True, text=True
)
return json.loads(result.stdout)
```

### Daemon Loop Structure

```
loop:
    if ore >= 1000: travel central, sell to Central Merchant East, return to mines-worksite
    harvest mines-worksite mine ore
    if confirmed: mine again immediately
    if pending:  retry in 0.5 s
    if failed:  try profession work(), then retry harvest in 0.5 s

    every 10  s: check threads, reply to open agents
    every 300 s: shout a partnership/ore-deal offer in the area
    every 120 s: log status (ore/min, tile_fail, crystals, ore)
    every 120 s: check hunger
    every 60  s: check inventory / confirm sells
    every 30  s: evaluate tile failure rate; move only if > 80% failure
```

## Connection Resilience

**Always retry, never exit.** The daemon must survive temporary connection failures:

```python
def read_agent():
    ctx = api_call("GET", f"/api/skill/agents/{AGENT_ID}/context")
    if "agent" not in ctx:
        # Try to claim/refresh session
        claimable = api_call("GET", "/api/local-control/claimable")
        if AGENT_ID in claimable.get("agentIds", []):
            get_session()  # Re-auth
            ctx = api_call("GET", f"/api/skill/agents/{AGENT_ID}/context")
    return ctx.get("agent")

# In main loop - retry forever
agent = read_agent()
retry_count = 0
while not agent:
    log(f"Waiting for agent connection (attempt {retry_count + 1})...")
    time.sleep(min(30, 5 + retry_count * 2))  # Exponential backoff
    agent = read_agent()
    retry_count += 1
    if retry_count > 100:
        log("Max retries exceeded, restarting...")
        return  # Let watchdog restart
```

**Why this matters:** Midnight City requires AI supervision to be paused before direct control works. The daemon will retry until the user pauses supervision in the UI.

## Key Constants

| Constant | Default | Purpose |
|----------|---------|---------|
| `HUNGER_CRITICAL` | 90 | Interrupt mining and buy fish |
| `FOOD_CHEAP_COST` | 50 | Crystal cost of 1 fish |
| `FOOD_CHEAP_MERCHANT` | `"Central Fresh Fish Outlet"` | Fish seller in central |
| `FOOD_ITEM` | `"fish"` | Item to buy and auto-eat |
| `MESSAGE_INTERVAL_S` | 10 | Check + reply to open agent threads |
| `SHOUT_INTERVAL_S` | 300 | Proactive area shout interval |
| `TARGET_ORE_BATCH` | 1000 | Sell ore every time inventory reaches this amount |
| `TARGET_CRYSTALS` | 100000 | Stop daemon when total crystals reach this goal |
| `CRYPTO_ROTATE_THRESHOLD` | 0.70 | Ore tile failure rate that triggers crypto rotation |
| `CRYPTO_SESSION_S` | 600 | Duration of a meme_coin farming session |
| `CRYPTO_CRYSTAL_RATE` | 10 | Crystals per meme_coin when sold |
| `FAIL_MOVE_THRESHOLD` | 0.80 | Move to a new tile if failure rate exceeds this |
| `LEARN_WINDOW_S` | 300 | 5-minute sliding window for tile stats |
| `MIN_SAMPLES` | 10 | Minimum attempts before trusting failure-rate signal |
| `HUNGER_INTERVAL_S` | 120 | Hunger check cadence |
| `INVENTORY_INTERVAL_S` | 60 | Inventory/sell tracking cadence |
| `STATUS_INTERVAL_S` | 120 | Status log cadence |

## Continuous Flow Design

The daemon is intentionally "blind" between harvest attempts:

- It does **not** read context after every harvest.
- It does **not** move the agent.
- It does **not** check hunger or inventory between attempts.
- It only issues a new `harvest` the moment the previous one returns.

This keeps the agent at one node and maximizes the chance of winning contested node races.

## Hunger Handling

`needs.hunger.value` is 0–100.

- `value < 90`: keep mining.
- `value >= 90`: travel to Central, buy **fish** from `Central Fresh Fish Outlet` (50 crystals), use `eat`, then automatically return to the mine.

No preventive eating — every non-mining action costs ore.

## Strategic Buyer Outreach (5% Focus)

The daemon spends **95% of time mining**, **5% building supply relationships**. Target buyers:

| Buyer Type | Why They Need Ore | Pitch Angle |
|------------|-------------------|-------------|
| **Hackers** | Ore for upgrades, hardware, terminal repairs | "Burn through ore? Bulk supplier here — 3 crystals/ore, volume discounts" |
| **Lumberjacks** | Ore for axe repairs, tool crafting | "Tool repairs need ore? Steady supply, lock in a contract" |
| **Crafters** | Ore as raw material | "Raw ore supplier — reliable volume for your production" |

**Outreach Mechanics:**
- Messages checked every **6 seconds** (~10/min) — faster response to deal inquiries
- Area shout every **5 minutes** targeting hackers/lumberjacks specifically
- Replies adapt to profession if visible in thread metadata
- All deals are **crystal-for-ore** — we don't barter, we sell

The goal is positioning: make them come to Central Mines to buy from $donbenito.

## Selling Behavior

- When inventory reaches `TARGET_ORE_BATCH` (1,000 ore), the agent travels to Central and sells all ore to `Central Merchant East`.
- The daemon tracks `total_sold` and `total_crystals_earned` via inventory deltas.
- If the final harvest pushes inventory slightly above the threshold, sell the full amount — do not try to hold back exactly 1,000.
- After a successful sale, the agent immediately returns to `mines-worksite` and resumes the tight harvest loop.

## Pattern Learning

The daemon improves its mining spot over time:

- Tracks per-tile success/failure history in a 5-minute sliding window.
- Status line reports `ore/min` and `tile_fail`.
- If a tile's failure rate exceeds `FAIL_MOVE_THRESHOLD` (80%) over at least `MIN_SAMPLES` attempts, the daemon picks a random adjacent tile inside `mines-worksite` and tests it.
- State persists across restarts in `~/.midnight-daemon/donbenito-state.json`, so the agent gradually discovers the most productive tiles.

Only move when the data says the current spot is dead — constant hopping loses contested-node races.

## AIMification for HyperCycle Node Manager

Package the daemon as an **AIM (Autonomous Intelligent Module)** for deployment in Node Manager at `localhost:8006`.

### AIM Structure

```
aim/
├── manifest.json          # HyperCycle AIM spec v1.0.0
├── Dockerfile             # Container with daemon + FastAPI wrapper
├── requirements.txt       # Python deps (fastapi, uvicorn, requests)
├── app/
│   ├── main.py           # FastAPI server with managed daemon
│   ├── mosaic_hermes_wrapper.py  # AIM interface bridge
│   └── static/
│       └── index.html    # Dashboard with Midnight City link
└── donbenito-miner.py    # The daemon (pure HTTP version)
```

### Key Features

| Feature | Implementation |
|---------|----------------|
| **Managed Daemon** | AIM container starts/stops the Python daemon via subprocess |
| **Dashboard** | HTML UI with "Open Midnight City" button linking to https://midnight.city |
| **Health Endpoint** | `/health` returns ore, crystals, cycles, daemon status |
| **Chat Control** | `/chat` endpoint accepts commands: start, stop, status, inventory |
| **Auto-Retry** | Daemon retries connection until supervision is paused |

### Environment Variables

```bash
MCITY_OBSERVER_URL=https://midnight.city/observer
MCITY_API_TOKEN=midnight_...
MCITY_AGENT_ID=user-agent-...
```

Passed to container at runtime:

```bash
docker run -d -p 9001:9000 \
  -e MCITY_OBSERVER_URL=https://midnight.city/observer \
  -e MCITY_API_TOKEN=... \
  -e MCITY_AGENT_ID=user-agent-... \
  midnight-miner-donbenito:1.1.0
```

### Dashboard Design

The AIM dashboard must include:

1. **Status cards**: Ore inventory, crystal count, mining cycles
2. **Midnight City button**: Direct link to https://midnight.city
3. **Control buttons**: Start/Stop daemon, Refresh status
4. **Live log**: Auto-updating activity feed
5. **Agent ID display**: So user knows which agent to unpause

```html
<a href="https://midnight.city" target="_blank" class="monitor-btn">
    🌙 Open Midnight City
</a>
```

### User Flow

1. User opens AIM dashboard at `http://localhost:9001`
2. Clicks "Start" to launch daemon
3. Daemon retries connection (shows "Waiting for agent...")
4. User opens https://midnight.city, finds agent, pauses AI supervision
5. Daemon connects automatically and starts mining
6. Dashboard updates with live ore/crystal counts

### Common Pitfall: Session 404

If the daemon gets `404 Not Found` on `/api/local-control/session`, it means:
- AI supervision is still active on the agent
- Another client has claimed the session
- The agent is not in the claimable list

**Fix:** User must pause AI supervision in Midnight City UI. The daemon will then auto-connect on next retry.

For a miner that must run without manual intervention, set up a small shell watchdog and point a Hermes cron job at it:

1. Place a watchdog script such as `~/.hermes/scripts/restart_donbenito.sh`.
2. The watchdog counts `python3.*donbenito-miner.py` processes, kills duplicates, kills stale `mcity-control.mjs` node processes, and restarts the daemon unbuffered.
3. Create or update a Hermes cron job to run the script every 2 minutes with `no_agent: true` so it consumes no tokens.

```bash
hermes cron update <job-id> --script restart_donbenito.sh --schedule '*/2 * * * *'
```

## Agent Message Replies

Open threads are checked every **10 seconds** so conversations stay alive while mining continues. The daemon filters on `threadStatus == "open"`, identifies the partner from `initiatorAgentId` / `recipientAgentId`, and only replies when the last message's `senderAgentId` is not our agent. It reads the message text from `messageBody`.

Replies are context-aware:

- **Trade/buy/sell/price keywords** → offer steady bulk ore supply at market rate.
- **Partner/team/help keywords** → propose a complementary partnership (you mine, they craft/trade/protect).
- **Other** → friendly win/win opener.

Example reply:

> "Hey {name}! $donbenito here. I mine ore nonstop at Central mines. I can sell bulk ore steady — current market is 3 crystals each at Central Merchant East. If you need a regular supplier or want to trade tools/food, let's lock in a deal."

## Proactive Shouts

Every 5 minutes the daemon shouts a short trade/partnership offer in the current area:
- **Proactive area shout** (use `shout <text>`):
  > "$donbenito mining ore nonstop at Central mines! Selling bulk ore steady — 3 crystals each at Central Merchant East, or let's build a win/win partnership. DM me for deals, tool swaps, or regular supply."

---

## Fast Cyclic Retry for Contested Nodes (discovered 2026-06-26)

**Symptom:** Agent at mine, "Occupied" repeatedly, ore barely moving. Log shows backoffs climbing to 12s with no successful mines.

**Root cause:** Exponential backoff (`3s → 6s → 12s → ...`) misses mine slots that open randomly for 1–3 seconds.

**Fix:** Use fast cyclic retry ONLY for `occupied`:

```python
HARVEST_RETRY_BASE = 1
HARVEST_RETRY_MAX = 4
HARVEST_SUCCESS_DELAY = 0.5

if result == "occupied":
    consecutive_fails += 1
    wait = min(1 + (consecutive_fails % 3), HARVEST_RETRY_MAX)  # 1→2→3→1→...
    time.sleep(wait)
else:
    wait = min(last_backoff * (2 ** min(consecutive_fails, 3)), HARVEST_RETRY_MAX)
    time.sleep(wait)
```

**Live result:** 6 ore in 20 seconds vs. 0 ore in 60+ seconds.

**Key insight:** `occupied` is RESOURCE contention, not network error. Fast polling wins random slot openings. Exponential backoff is for actual errors.

---

## Pure Accumulate Mode — Strip All Side Trips (discovered 2026-06-26)

**User request:** "Just mining and accumulating ore, without moving or selling."

**Fix:** Remove ALL periodic tasks from v6 main loop except heartbeat:

```python
# Keep only heartbeat + harvest. Remove: stats, food, shouts, agents, threads, sell, tools.
while running:
    now = time.time()
    if now - t_heartbeat >= HEARTBEAT_INTERVAL: heartbeat(); t_heartbeat = now
    result, wait = try_harvest()
    ...
```

**User preference to save:** When user says "accumulate only" or "don't sell, don't move, just mine" — strip tasks from the loop rather than raising thresholds.

---

## The CLI Positional-Args Trap (discovered 2026-06-26)

**Symptom:** `unknown command: --agent-id` on every call.

**Root cause:** `mcity-control.mjs` uses POSITIONAL args, not `--flag` style:

```bash
# CORRECT:
node mcity-control.mjs connect <agentId>
node mcity-control.mjs harvest <areaId> <activity>

# WRONG:
node mcity-control.mjs --agent-id <id> --operation connect
```

**Always verify first:** `node mcity-control.mjs help`

---

## `harvest` vs `work` (perform_job) for Miners

| Command | When it works | When it fails |
|---------|---------------|---------------|
| `harvest` | Mine slot open | Returns `occupied` when contested |
| `work` | Profession mechanic | Returns `no available miner worksite` when full |

**Test both before concluding the mine is dead.** If one works, use it. If both fail, the mine is genuinely full — fast retry is the fix.

This pulls inbound DMs from buyers, crafters, and other agents who want to partner.

## Phase 3: Launch with Proper Detachment

**Option A: Direct launch (preferred, no wrapper)**

```bash
nohup python3 -u ~/.hermes/scripts/sonofanton_miner.py \
  >> ~/.midnight-daemon/sonofanton.log 2>&1 < /dev/null &
echo $! > ~/.midnight-daemon/sonofanton.pid
```

**Option B: Background via Hermes tool**

```python
# In a Hermes terminal() call:
terminal(
  command="python3 -u ~/.hermes/scripts/sonofanton_miner.py",
  background=True,
  watch_patterns=["Entering main loop", "Position validated", "Mined", "MOVE-TO-MINE"]
)
```

**Option C: Using a launcher script (inspect first):**

Some environments have `start_sonofanton.sh` or similar wrappers. Before using them, verify they are safe:

```bash
grep -E "while true|kill -9.*\$\$|exec python3" ~/.hermes/scripts/start_sonofanton.sh 2>/dev/null
```

- If `while true` is found, **do not use the script**. It spawns a new Python process every loop iteration, creating duplicate daemons. Launch directly instead.
- If `kill -9 $$` is found, **do not use the script**. It kills the parent shell immediately after spawning, causing the daemon to appear as "exited" to systemd/Hermes. Use `exec python3 -u miner.py` or direct `nohup` instead.
- If `exec python3` is found, the script is safe — `exec` replaces the shell with Python so there is no parent shell to exit.
- If none of the above are found, the script is likely safe but still inspect it for `while` loops or `kill` commands before trusting it.

**Never use `bash start_sonofanton.sh` blindly.** The shell may contain traps that kill the daemon or respawn duplicates. Always launch the `.py` directly after verifying exactly zero old instances remain.

**DO NOT use a `while true` wrapper.** A shell loop spawning Python every second produces 10+ zombie processes that fight each other. Use a cron-based watchdog (not a tight shell loop) for recovery.

## Watch Pattern Response Protocol

When a miner daemon runs via `terminal(background=True, watch_patterns=[...])`, each matched pattern fires a notification. **Do NOT respond to routine matches.** This floods the user with useless status updates every few seconds.

**User preference (established 2026-06-21):** When the user says "stop ack-ing every watch" or "give me a new task anytime," **honor it immediately.** Stop ALL routine acknowledgments. Remain silent for normal mining matches. Only surface anomalies.

**Silence these routine matches completely:**
- `✅ Mined X ore. Total: Y` — normal operation
- `🔒 Occupied. Retry...` — expected contention, agent holding position
- Heartbeat/status summary lines
- `Position validated` confirmations
- Any line starting with `⛏️  Harvesting` or containing ore totals

**Escalate only on actual issues:**
- `MAIN CRASH` or exception traceback
- `MOVE-TO-MINE` firing AFTER `Position validated` (race fix failed)
- Multiple instances detected (`pgrep` returns > 1)
- `❌` error patterns in output
- Daemon exits unexpectedly (`process(action='poll')` shows `completed` or `exited`)
- Ore total flat for >10 minutes during low-contention hours

**Recommended settings:**
```python
terminal(
    command="python3 -u miner.py",
    background=True,
    notify_on_complete=False,  # Mandatory for indefinite daemons
    watch_patterns=["MAIN CRASH", "MOVE-TO-MINE"]
)
```

Note: `notify_on_complete=False` is mandatory for indefinite daemons. Without it, every routine match triggers a response. Keep `watch_patterns` minimal — only patterns that indicate actual problems. "Mined" and "Occupied" should NOT be in watch_patterns once the daemon is validated.

## Stopping / Restarting

## Phase 3: Launch with Proper Detachment

**Option A: Direct launch (preferred, no wrapper)**

```bash
nohup python3 -u ~/.hermes/scripts/sonofanton_miner.py \
  >> ~/.midnight-daemon/sonofanton.log 2>&1 < /dev/null &
echo $! > ~/.midnight-daemon/sonofanton.pid
```

**Option B: Background via Hermes tool**

```python
# In a Hermes terminal() call:
terminal(
  command="python3 -u ~/.hermes/scripts/sonofanton_miner.py",
  background=True,
  watch_patterns=["Entering main loop", "Position validated", "Mined", "MOVE-TO-MINE"]
)
```

**Option C: Using a launcher script (inspect first):**

Some environments have `start_sonofanton.sh` or similar wrappers. Before using them, verify they are safe:

```bash
grep -E "while true|kill -9.*\$\$|exec python3" ~/.hermes/scripts/start_sonofanton.sh 2>/dev/null
```

- If `while true` is found, **do not use the script**. It spawns a new Python process every loop iteration, creating duplicate daemons. Launch directly instead.
- If `kill -9 $$` is found, **do not use the script**. It kills the parent shell immediately after spawning, causing the daemon to appear as "exited" to systemd/Hermes. Use `exec python3 -u miner.py` or direct `nohup` instead.
- If `exec python3` is found, the script is safe — `exec` replaces the shell with Python so there is no parent shell to exit.
- If none of the above are found, the script is likely safe but still inspect it for `while` loops or `kill` commands before trusting it.

**Never use `bash start_sonofanton.sh` blindly.** The shell may contain traps that kill the daemon or respawn duplicates. Always launch the `.py` directly after verifying exactly zero old instances remain.

**DO NOT use a `while true` wrapper.** A shell loop spawning Python every second produces 10+ zombie processes that fight each other. Use a cron-based watchdog (not a tight shell loop) for recovery.

If the agent gets stuck, also kill lingering node processes:

```bash
pkill -f mcity-control.mjs
```

## Post-Audit Rewrite Protocol

When a log forensic audit reveals **>3 systemic issues** in a running daemon, do **not** patch incrementally. The existing loop is fundamentally compromised. Instead:

1. **Kill all instances** (nuclear cleanup: `pkill -9`, remove lock files)
2. **Write a clean vX.Y** addressing every finding at once
3. **Compile-check** with `python3 -m py_compile`
4. **Test in foreground** for 60 seconds (`python3 -u script.py`)
5. **Launch in background** with fcntl singleton lock
6. **Monitor for 2–5 minutes** with `tail -f log`
7. **Confirm single PID**, no duplicates, ore count rising

Incremental patching of a daemon with duplicate processes, wrong timeouts, starvation, and walking is Frankencode. It never stabilizes. Rewrite from the control flow up when the audit is severe.

## Log Forensic Methodology

When a user says "my agent is behaving badly," run this pipeline:

```bash
# 1. Find logs
find /home/mauricio -name "*sonofanton*.log" -o -name "*midnight*.log" 2>/dev/null
find /home/mauricio -name "*.log" | grep -E "daemon|agent|midnight" | head -20

# 2. Check for duplicate processes
ps aux | grep python3 | grep -i "anton\|midnight" | grep -v grep
# Expected: exactly 1. If 2+, duplicate daemons are fighting each other.

# 3. Parse events
python3 -c "
import re
from collections import Counter
from datetime import datetime
with open('/path/to/log') as f: lines = f.readlines()
pat = re.compile(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.+)')
events = [(datetime.strptime(m.group(1), '%Y-%m-%d %H:%M:%S'), m.group(2))
          for line in lines if (m := pat.match(line.strip()))]
# ... analyze categories, detect duplicates, compute time allocation
"
```

Key metrics to compute:
- **Duplicate commands:** Same message within <2s → duplicate daemon
- **Walking time:** Sum of `travel`, `move-area`, `move-tile` events
- **Success rate:** Successful harvests / (successful + failed)
- **Social spam:** Unique shout messages / total shouts (ratio >1 = repetition)
- **Food events:** Eating attempts vs. successful eats vs. starvation

Use the computed metrics to drive the fix list. Quantify opportunity cost: "If walking time was spent mining, +X ore/hour."

## Daemon Recovery After Crash

If the daemon crashes and the user wants it restarted:

```bash
pkill -9 -f "sonofanton_miner\.py"
pkill -9 -f "sonofanton_daemon"
rm -f ~/.midnight-daemon/sonofanton.lock
sleep 2
nohup python3 -u ~/.hermes/scripts/sonofanton_miner.py >> ~/.midnight-daemon/sonofanton.log 2>&1 < /dev/null &
echo $! > ~/.midnight-daemon/sonofanton.pid
tail -f ~/.midnight-daemon/sonofanton.log
```

Always verify exactly one python3 process remains after cleanup.

## Common Pitfalls

1. **Multiple daemons running.** Old `midnight-agent-strategy.py` or duplicate `donbenito-miner.py` processes will issue conflicting commands and make the agent stop or move. Always `pkill` before starting a new one. Use `fcntl` singleton lock in the daemon itself.

2. **The `mci()` timeout trap.** `def mci(cmd, *args, timeout=30)` works ONLY if `timeout` is passed as a keyword: `mci("trade", "Merchant", "ore", "100", timeout=60)`. If the definition lacks a default (`timeout` with no `=30`) or the caller passes `timeout` positionally, the subprocess gets an extra CLI argument and the actual timeout stays at the default. This is a subtle Python signature bug that silently breaks all long-duration commands.

3. **Game-server timeout mismatch.** Even with `subprocess.run(timeout=60)`, the Node.js `mcity-control.mjs` helper may have its own 20s internal timeout. Trades/food purchases may "fail" in CLI output while the server actually processes them. Always verify via inventory deltas after a timeout-reported failure.

4. **Cron watchdog pointing to the old script.** If a Hermes cron job restarts `midnight-agent-strategy.py`, update it to restart the new v5.1 daemon.

5. **Using `engage` or `work` as the primary command.** `engage` finishes instantly; `work` often fails at the mine. The reliable continuous command is `harvest mines-worksite mine ore` with fast retry.

6. **Reading state too often.** Reading context/inventory/needs between every harvest creates idle gaps. Read state only on timers.

7. **Selling too early or holding too long.** Use `AUTO_SELL_MIN` (e.g., 500) and `SELL_BATCH_SIZE` (e.g., 200) for batch efficiency.

8. **Hunger field mismatch.** The `needs` API returns `hunger.value` and `hunger.state`; the daemon flattens them to `value` and `state` for reliable comparison.

9. **Area matching by `areaId`.** Named worksites often have `areaId: null` and only a `name`. Match `areaId` first, then fall back to slugified `name`.

10. **Waiting for `status == "busy"` at startup.** Mining itself makes the agent busy. A startup loop that waits for `busy` to clear will hang forever. Only wait for `traveling` to finish during initial movement.

11. **Stale agent reference during hunger/sell loops.** Re-read the agent (`read_agent()`) at the top of each main loop iteration so position/status are current before travel or trade decisions.

13. **Deferred startup timer races with first harvest.** Setting `t_position_validate = time.time() + 5` (or any positive offset) before entering the main loop creates a race window: the harvest logic runs for 1-2 cycles BEFORE the move-to-position timer fires. The agent mines at the spawn tile, then the deferred move triggers, relocating the agent and losing the contested node. **Fix:** initialize the timer to `time.time()` (zero offset) so positioning fires on the very first loop iteration, and add `and not position_validated` to the move condition so it can never re-trigger after the first successful positioning. Additionally, guard `try_harvest()` with a `spaceId` check: if `"mines"` is not in the current `spaceId`, return `("not_at_mine", 2)` and let the move block handle it on the next cycle. See `references/startup-timer-race-condition.md` for full log forensics and the exact patch.

14. **`while true` launcher scripts spawning duplicate processes.** Some environments use wrapper scripts like `start_sonofanton.sh` that run `python3 sonofanton_miner.py` inside `while true; do ... sleep 1; done`. Every loop iteration spawns a brand-new Python process while the previous one may still be running (especially if `nohup` was used without `disown`). Within minutes this creates 10+ competing daemons all issuing conflicting commands. **Fix:** Do not use `while true` wrappers. Start the daemon once with a proper `fcntl` singleton lock, and rely on a cron-based watchdog (not a tight shell loop) for recovery. Verify: `pgrep -f "sonofanton_miner\.py" | wc -l` should return exactly 1.

15. **Kill-Exited Launcher (`kill -9 $$` exits the spawning shell, not the daemon).** Wrapper scripts that do `pkill -f sonofanton; python3 miner.py; kill -9 $$` will `SIGKILL` the parent bash process immediately after spawning. The `nohup` daemon survives, but the wrapper dies and systemd/Hermes considers the task failed. If another watcher tries to restart it, you get rapid-fire respawns. **Fix:** Never `kill -9 $$` in a launcher. Use `exec python3 -u miner.py` to replace the shell, or launch directly from `nohup` without a wrapper. Verify the daemon is a standalone process: `pgrep -P 1 -f "sonofanton_miner"` should find it under PID 1.

16. **Acknowledging routine background-process watch patterns.** When a miner daemon runs via `terminal(background=True, watch_patterns=["Mined", "..."])`, each successful mine triggers a notification. Responding to every one with "Mining continues" or status updates floods the user. **Fix:** Only escalate watch-pattern matches when they indicate an actual issue: crashes, duplicate instances, errors, or unexpected state transitions. Set `notify_on_complete=False` for indefinite daemons. If the user explicitly says "stop ack-ing every watch," honor it immediately.

## Verification Checklist

- [ ] Only one `python3.*sonofanton_miner.py` process is running.
- [ ] No old `midnight-agent-strategy.py` or `sonofanton_daemon.py` processes remain.
- [ ] Log shows chains of `Harvest mine ore -> confirmed` with no `Moving to` between them.
- [ ] Ore count rises continuously during low-contention windows.
- [ ] Agent only moves when hunger is critical or when selling at configured threshold.
- [ ] Hunger never exceeds 90 — auto-food triggers correctly.
- [ ] Shouts rotate (4+ unique templates visible in log over 15 min).
- [ ] Trade "failures" are verified by checking inventory deltas.
- [ ] State file shows increasing `total_ore_mined`.
- [ ] Lock file `~/.midnight-daemon/sonofanton.lock` exists and corresponds to the running PID.
- [ ] **Startup race fixed:** First log lines after startup should show `MOVE-TO-MINE` BEFORE any `Harvesting` — not after 1-2 successful mines. See `references/startup-timer-race-condition.md`.
- [ ] **Single script version:** Only one `.py` miner file is running (check `pgrep -af sonofanton_miner`). Users often have `_v2.py` backups — kill those too.

## One-Shot Recipe: Restart and Verify

```bash
pkill -9 -f "sonofanton_miner\.py"
pkill -9 -f "midnight-agent-strategy"
pkill -9 -f "mcity-control\.mjs"
rm -f ~/.midnight-daemon/sonofanton.lock
sleep 2
nohup python3 -u ~/.hermes/scripts/sonofanton_miner.py >> ~/.midnight-daemon/sonofanton.log 2>&1 < /dev/null &
echo $! > ~/.midnight-daemon/sonofanton.pid
sleep 60
tail -20 ~/.midnight-daemon/sonofanton.log
```

## References

- `scripts/donbenito-miner.py` — legacy daemon template (v1.x).
- `templates/sonofanton-v51-ultimate-miner.py` — v5.1 battle-tested daemon addressing all systemic bad patterns from the 2026-06-21 forensic audit. Copy and customize the `CONFIG` block.
- `~/.hermes/scripts/sonofanton_miner.py` — **v6.0 definitive daemon** (live production script): adds the startup timer race fix (zero-offset positioning before first harvest, `not position_validated` guard on move, and `spaceId` validation inside `try_harvest()`). Use this when the agent spawns at a non-mine tile and must position before any harvest.
- `references/session-2026-06-26-accumulate-mode-fast-retry.md` — **NEW (2026-06-26):** Three techniques discovered live — (1) fast cyclic retry for contested nodes (1s→2s→3s cycle vs. 12s exponential), (2) pure accumulate mode by stripping all periodic tasks from v6 main loop, (3) positional-args CLI trap when writing new scripts. Includes live verification log (6 ore in 20s). Use when the user wants "just mine, don't sell/move" or when harvest throughput is near-zero despite being at the mine.
- `references/v6-startup-race-fix-session-2026-06-21.md` — **session-specific forensics and live validation**: exact line numbers of the 3-patch fix, log forensics commands, and a 6-hour production run proving zero movement triggers post-fix (158→3150+ ore). Use this when you need to reproduce the fix on another agent or verify the pattern in logs.
- `references/continuous-miner-pitfalls.md` — deep troubleshooting including the duplicate-daemon self-competition forensic method, the `subprocess.run` timeout trap, game-server timeout mismatch, log forensic pipeline, stay-put strategy, post-audit rewrite workflow, auto-food buying, and signal-handler clean shutdown.
- `references/fix-validation-long-run.md` — **production validation report**: 5.5-hour continuous run proving the startup-timer race fix works (158→2300+ ore, zero post-validation movement triggers, zero ore mined before positioning). Use this when stakeholders ask "how do we know the fix actually works?"
- `references/startup-timer-race-condition.md` — **case study from v6.0 audit**: deferred startup timer (`time.time() + 5`) races with first harvest, causing the agent to mine 1-2 ore at spawn then move away, losing the rock. Covers the fix (zero-offset timer + `not position_validated` guard + `spaceId` validation) and log-verification commands.
- `references/launch-and-verify-workflow.md` — **step-by-step launch protocol**: how to kill old instances, verify zero duplicates, launch directly (no wrapper), and confirm correct startup sequence (position → validate → mine, NOT mine → position → mine). Includes health probe script.
- `references/aim-integration-pattern.md` — HyperCycle AIM packaging.
- `references/economic-opportunities.md` — merchant rates and profit analysis.
- `~/.hermes/scripts/restart_donbenito.sh` — example watchdog script (install per-environment).