---
name: midnight-city-automation
description: Automate Midnight City agents via the observer/local-control API. Covers session claim, action dispatch, inventory tracking, position validation, and continuous mining loops. Includes known API contracts, Cloudflare workarounds, and position-drift handling.
triggers:
  - user mentions "midnight city" and "mine" or "harvest" or "ore"
  - user asks to automate, script, or daemonize a midnight city agent
  - error with midnight city API (403, 422, occupied, session claim failure)
  - user references Mosaic-Companion midnight city miner or Son of Anton
  - user corrected verbosity — prefers concise, structured summaries with tables and clear section headers
  - user noted "the agent was 100% focused on mining ore" — avoid adding hunger checks, status logging, or peripheral features that reduce mining throughput
  - user noted the script "moves a lot" — the miner should stay-put and only move when genuinely drifted, not on every loop iteration
  - user wants Mosaic-Companion integration to work with the Restart Miner button
  - user expects full ecosystem context before work begins (Node Manager, GitHub repos, branch status)
  - user prefers: ecosystem context gathering → Node Manager inspection → codebase analysis → branch checking as standard first steps
---

# Midnight City Automation

## Architecture

Midnight City exposes an **observer API** for direct agent control. The canonical flow is:

1. **Claim session** — POST `/observer/api/local-control/session`
2. **Poll context** — GET `/observer/api/skill/agents/{agentId}/context`
3. **Dispatch actions** — POST `/observer/api/actions`
4. **Verify via inventory** — GET `/observer/api/skill/agents/{agentId}/inventory`

## API Contracts (July 2026)

**Endpoint migration:** The old `/observer/api/skill/agents/{id}/context` endpoint is now unreliable and may return empty position data. The **current working endpoint** is:
```
GET /observer/api/agents/{agentId}
```
This single call returns `position`, `inventory`, `status`, `activeAction`, and `control` state together.

### Auth Tokens

| Token Type | Where it comes from | Used for |
|------------|---------------------|----------|
| **API token** | Mosaic-Companion config or env var | ONLY `POST /observer/api/local-control/session` |
| **Lease token** | `token` field from session claim response | ALL other endpoints (`/actions`, `/agents/{id}`, etc.) |

**Critical:** Passing the API token to `/actions` returns HTTP 403. Always use the lease token for action dispatch.

**Critical:** The session claim response field is **`token`**, not `leaseToken`. Access it as `data["token"]`.

### Session Claim

```json
POST /observer/api/local-control/session
{
  "agentId": "user-agent-...",
  "mode": "browser_local",
  "clientInstanceId": "any-unique-string"
}
```

Response: `{"sessionId": "...", "token": "local-019f...", ...}`

### Agent State

```
GET /observer/api/agents/{agentId}
```

Returns full agent object including:
- `position: {spaceId, x, y}`
- `inventory: {ore, crystal, ...}`
- `status: "idle" | "traveling" | ...`
- `activeAction: {kind, activity, ...} | null`

### Action Dispatch

```json
POST /observer/api/actions
Authorization: Bearer {lease_token}
{
  "agentId": "user-agent-...",
  "kind": "perform_job",
  "activity": "mine ore",
  "durationMs": 5000
}
```

**The `agentId` field is now mandatory in the action body.** Earlier API versions accepted actions without it.

Response on success: `{"accepted": true, "actionId": "..."}`

### Cloudflare

Python's default `urllib` User-Agent triggers HTTP 403 / Error 1010. Always set:
```python
"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36"
```

## Harvest Verification

Do not trust action acceptance alone. The reliable confirmation method is **inventory delta**:

1. Record `ore_before` from inventory
2. Submit `perform_job`
3. Wait ~5s
4. Read inventory again
5. `delta = ore_after - ore_before`

If `delta > 0`, mining succeeded. If delta is 0 but agent `activeAction.kind == "perform_job"`, wait longer (still mining). Otherwise assume occupied and retry.

**Confirmed working action payload (July 2026):**
```json
{
  "agentId": "user-agent-...",
  "kind": "perform_job",
  "activity": "mine ore",
  "durationMs": 5000
}
```

The `durationMs` value is not a literal timeout — it is advisory to the game engine. Actual mining completes in 3–8 seconds regardless of this value, but omitting it may cause the action to be rejected.

## Auto-Sell Loop

When ore crosses a threshold (e.g. 50,000), the daemon should:
1. `move_to` "central"
2. `trade` with merchant "Central Merchant East" for item "ore"
3. **Reset session ore accumulator to 0** after sell
4. `move_to` back to mines-worksite

If `ore_total` is not reset, delta calculations will be negative post-sale.

## Daemon Lifecycle

Recommended run via `nohup` or Hermes `terminal(background=True)`. Use `fcntl` file locking to prevent duplicate instances. Log to `~/.midnight-daemon/sonofanton.log`. PID file at `~/.midnight-daemon/sonofanton.pid`.

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| HTTP 403 on actions | Using API token instead of lease token | Use `token` from session claim response |
| HTTP 403 / Error 1010 | Python urllib default User-Agent | Set browser User-Agent header |
| HTTP 422 on claim | Missing `clientInstanceId` | Add `"clientInstanceId": "..."` to claim payload |
| HTTP 422 on actions | Missing `agentId` in action body | Include `"agentId": "..."` in every action payload |
| Action accepted but no ore delta | `engage` no longer produces ore | Use `perform_job {"activity": "mine ore", "durationMs": 5000}` |
| "Occupied" repeatedly | Mine node contested by other agents | Fast cyclic retry (0.3–1.5s backoff) |
| Agent not moving | AI supervision active in UI | Pause supervision manually |
| Position drift | Game engine shifts agent ±1–2 tiles | Use tolerance `abs(x-14) <= 2` |
| No ore delta after accepted action | `perform_job` needs 3–8s to execute | Poll inventory after 5s delay |
| `NameError: is_at_mine` | Function accidentally removed during patch | Reconstruct from SKILL.md or `templates/sonofanton_miner.py` |
| Entire inventory reported as "mined" post-sell | `ore_total` not reset after sell | Set `ore_total = 0` after `trade` succeeds |
| **Duplicate log entries** | Shell `>>` redirect + Python file logging both writing | Redirect shell stdout to `/dev/null`, let Python handle logging exclusively |
| **False "drifted" detections** | API returns `x: null, y: null` intermittently | Skip position check when coordinates are `None` |
| **Sell action accepted but ore count unchanged** | `trade` action doesn't actually reduce inventory | **Remove selling loop** — focus 100% on mining |
| **API returns empty position** | Old `/skill/agents/{id}/context` endpoint deprecated | Use `GET /observer/api/agents/{agentId}` |
| **`'int' object has no attribute 'lower'`** | API returns `status` as integer or null instead of string | Wrap all API field reads in `str()`: `str(agent.get("status", "")).lower()` |
| **`'NoneType' object has no attribute 'lower'`** | `activeAction` is null or `kind` is null | Guard with `active and active.get("kind")` then `str(active.get("kind", "")).lower()` |
| **Session reclaim loop: "Reclaim failed" repeated rapidly** | `claim_session()` returns `True` (boolean), not token string | Change return value to `lease_token` (string) on success, `None` on failure |

## Mosaic-Companion Integration

### React Error #31 in Actions Tab

The Midnight City API returns `needs` fields as **objects** with `{baseAtMs, baseValue, nextPointAtMs, state, value}` instead of raw numbers. Direct JSX rendering like `{needs.hunger > 50}` crashes with React Error #31 because `needs.hunger` is an object, not a number.

**Fix:** Extract `.value` with type-safe fallback:
```tsx
const val = typeof raw === "number" ? raw : typeof raw?.value === "number" ? raw.value : "?";
```

### Restart Miner Button Location

The "Restart Daemon" button (which spawns `sonofanton_miner.py`) is located in the **Script** tab by default. Users looking in the **Actions** tab won't find it. Add a dedicated "Restart V6 Miner" button to the Actions → Quick Actions grid for discoverability.

### Script Spawning Convention

Mosaic-Companion spawns the miner via Electron IPC → `window.electronAPI.midnightCity.restartMiner()`. The Electron main process runs:
```js
spawn("python3", ["-u", path.join(os.homedir(), ".hermes/scripts/sonofanton_miner.py")])
```

**Do NOT use shell redirect (`>>`) when spawning from code** — it causes duplicate log entries when combined with Python's `open(LOG_FILE, "a")`. Redirect to `/dev/null` and let Python handle file logging exclusively.

## Design Principle: Stay-Put Mining

The user explicitly wants the miner **100% focused on mining ore** with minimal movement. The original v6.0 was powerful because it was a tight `perform_job` spam loop — no hunger checks, no status logging, no selling.

### What to remove
- **Sell loop** — the trade action doesn't actually work; it just wastes API calls and movement time
- **Hunger checks** — don't reduce throughput for starvation warnings
- **Status logging every 60s** — log only when something changes (position, ore milestone)
- **Position check every loop** — check every 60s only; the mine is at (14,38) inside "central" space

### What to keep
- Fast cyclic `perform_job` with 0.5s delay between submissions
- Occupied backoff: 0.3s → 1.5s max
- Position validation: every 60s, skip if API returns null
- Single `read_agent()` call per loop using `GET /observer/api/agents/{id}`

## Auto-Sell Loop

**Deprecated (July 2026):** The `trade` action with merchant "Central Merchant East" accepts but does not actually reduce ore inventory. Ore count remains unchanged after "successful" sell. **The current working design is pure accumulation** — mine continuously without selling.

If selling is ever needed:
1. Verify the merchant exists and the trade endpoint works with direct curl
2. `move_to` "central" (optional — agent is already in central space at the mine)
3. `trade` with `merchantName`, `itemId: "ore"`, `quantity`
4. **Reset session ore accumulator to 0** after sell
5. `move_to` back to mines-worksite

If `ore_total` is not reset, delta calculations will be negative post-sale.

## References

- `references/api-contracts.md` — Full endpoint specs including the `GET /observer/api/agents/{id}` migration and `agentId` requirement in action payloads
- `references/sonofanton-v6-reconstruction.md` — Complete script reconstruction from log forensics, including all bugs found and fixes applied
- `references/stay-put-miner-design.md` — Analysis of why the reconstructed miner was worse than v6 and how to build a minimal fast-loop miner
- `references/api-contracts.md` — Full endpoint specs including the `GET /observer/api/agents/{id}` migration and `agentId` requirement in action payloads
- `references/sonofanton-v6-reconstruction.md` — Complete script reconstruction from log forensics, including all bugs found and fixes applied
- `references/stay-put-miner-design.md` — Analysis of why the reconstructed miner was worse than v6 and how to build a minimal fast-loop miner
- `references/session-lease-reclaim.md` — How to handle session lease expiry (~5–7 min TTL) with on-error auto-reclaim pattern
- `references/duplicate-process-prevention.md` — How duplicate log entries happen (shell redirect + Python file logging), detection, and prevention strategies
- `templates/sonofanton_miner.py` — **Minimal working v6.0 miner** (no sell loop, stay-put fire-and-forget, `agentId` in actions, `GET /observer/api/agents/{id}` endpoint, auto-reclaim on lease expiry)
- `templates/sonofanton_miner.py` — **Minimal working v6.0 miner** (no sell loop, stay-put fire-and-forget, `agentId` in actions, `GET /observer/api/agents/{id}` endpoint)
- `scripts/verify-miner.sh` — Quick health-check script to validate API reachability and action acceptance