---
name: stargate-pool-integration
trigger: |
  Adding a new validator, attestor, compute, or partner pool to the Mosaic Companion
  Stargate Pool dashboard. Any task that says "integrate X into Stargate Pool" or
  "add a new pool tab alongside Battery / Compute / Materios".
description: |
  End-to-end pattern for adding a new pool to the Stargate Pool hub in Mosaic Companion.
  Covers telemetry hook, card component, live badge, registry entry, hub wiring,
  config modal, and barrel exports. Verified against TypeScript strict mode.
---

# Stargate Pool Integration

## Overview

The Stargate Pool dashboard in Mosaic Companion is a multi-pool grid. Each pool is a
self-contained vertical: telemetry hook → card UI → live badge → registry entry.
This skill captures the exact mechanical steps so the next pool (Midnight validator,
Iagon storage node, etc.) can be added without rediscovering the wiring.

## Files to create / modify

| # | File path | Action | Purpose |
|---|-----------|--------|---------|
| 1 | `src/components/stargate/pools/use<Name>Telemetry.ts` | **Create** | Poll endpoint(s), parse real data, return typed telemetry array |
| 2 | `src/components/stargate/pools/<Name>PoolCard.tsx` | **Create** | Card UI: status, operator differentiation, explorer link, stats |
| 3 | `src/components/stargate/pools/<Name>LiveBadge.tsx` | **Create** | Hub-card real-time badge (online count / slot utilization) |
| 4 | `src/components/stargate/pools/<Name>ValidatorPool.tsx` | **Create** | Full pool view with header + stats grid + card layout |
| 5 | `src/components/stargate/pools/registry.ts` | **Patch** | Add `PoolDefinition` to `STARGATE_POOLS` array |
| 6 | `src/components/stargate/pools/index.ts` | **Patch** | Barrel-export new types, hooks, components |
| 7 | `src/components/stargate/StargatePoolHub.tsx` | **Patch** | Add lucide icon name to `ICONS` map |
| 8 | `src/components/stargate/pools/PoolConfigModal.tsx` | **Patch** | Add config form fields for the new pool |

## Telemetry Hook Pattern (`use<Name>Telemetry.ts`)

### Principles
- **Poll multiple endpoints** if the daemon exposes them: `/health`, `/status`, `/metrics`.
- **Parse Prometheus text** when available — it is the most reliable source of counters.
- **Return REAL data** from live endpoints. Never hardcode estimates in the hook.
- **Support multi-node fleet** via an `Endpoint[]` array. Each community member appends their node.
- **Include `operatorAddress`** on the endpoint type so cards can differentiate wallets.

### Minimum hook shape
```typescript
export interface <Name>Endpoint {
  id: string;
  name: string;
  host: string;
  healthPort: number;
  operatorAddress?: string;   // SS58 / ETH / etc.
}

export interface <Name>Telemetry {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  bestBlock: number;
  finalizedBlock: number;
  // ... pool-specific counters
  endpoint: <Name>Endpoint;
  metrics?: Record<string, number>;
}
```

### Prometheus parser (copy-paste)
```typescript
function parsePrometheusMetrics(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/);
    if (m) out[m[1]] = parseFloat(m[2]);
  }
  return out;
}
```

### Verified data sources for Materios (reference)
See `references/materios-endpoints.md` for live URLs and what each returns.

## Card Component Pattern (`<Name>PoolCard.tsx`)

### Must-haves
1. **Operator differentiation** — show `operatorAddress` with a `Fingerprint` icon when present.
2. **Explorer link** — an `<a href="..." target="_blank">` labeled "Explorer" or "View" that opens the chain's committee/explorer page. Never link to the local `/health` endpoint as a primary action.
3. **Real stats only** — read from telemetry props. No placeholder/hallucinated numbers.
4. **Shortened addresses** — `5CtBFsSx8…bMPW2d` style with full value in `title` tooltip.

### Stat layout convention
- Top row (3-col): **Submitted** / **Stored** / **Updated**
- Second row (2-col): **Best Block** / **Finalized**
- Footer: chain badge, version badge, latency badge, Explorer link

## Live Badge Pattern (`<Name>LiveBadge.tsx`)

- Poll the same `/health` endpoint every 15s.
- Show `{online}/{total} online` with a pulse animation.
- Keep it lightweight — no heavy state, no bridge dependencies.

## Registry Entry (`registry.ts`)

```typescript
{
  id: 'materios',               // kebab-case slug
  name: 'Materios Attestor Pool',
  shortName: 'Materios',
  description: '...',
  category: 'validator',        // validator | compute | freight | liquidity | storage | ai
  icon: 'Shield',               // lucide icon name
  color: 'green',               // tailwind color token
  status: 'active',
  isConfigurable: true,
  liveBadge: MateriosLiveBadge,
  component: MateriosValidatorPool,
}
```

## Hub Icon Map (`StargatePoolHub.tsx`)

Add the lucide icon name to `ICONS` dictionary. If missing, the hub falls back to `Activity`.

## Config Modal (`PoolConfigModal.tsx`)

Add a `case 'pool-id':` branch with inputs relevant to the pool:
- Health/metrics URL
- Polling interval
- Explorer URL
- Operator address (optional)

## Barrel Export (`pools/index.ts`)

Export everything so downstream imports stay one-liners:
```typescript
export { default as use<Name>Telemetry } from './use<Name>Telemetry';
export type { ... } from './use<Name>Telemetry';
export { default as <Name>PoolCard } from './<Name>PoolCard';
export { default as <Name>LiveBadge } from './<Name>LiveBadge';
export { default as <Name>ValidatorPool } from './<Name>ValidatorPool';
```

## Verification

After all changes, run:
```bash
cd /home/mauricio/mosaic-companion
npm run typecheck   # must pass zero errors
```

Do NOT run `npm run build` unless the user explicitly asks — the full build is slow and the typecheck is the gate.

## Main-Process Orchestrator & SPO Server

**Files:** `electron/integrations/pool/orchestrator/StargatePoolOrchestrator.ts`, `electron/integrations/pool/orchestrator/SPOServer.ts`

These run in the Electron main process and expose HTTP endpoints for HBA (HyperAIBox Agent) heartbeats, matchmaking, and tilling operations.

### StargatePoolOrchestrator
- **Registry:** Tracks HyperAIBox registrations with heartbeat-based liveness (120s timeout)
- **Matchmaker:** Scores boxes by geo proximity (40%), capacity match (30%), GPU match (15%), reliability uptime (10%), price (5%)
- **Pricing:** Base $0.50/CPU core/hr + $0.10/GB RAM/hr + $1.00/GPU/hr; 29% commission to Stargate
- **Provisioning:** Sends `/provision` and `/destroy` commands to HBA API on boxes
- **Bookings:** Full lifecycle — `pending_payment` → `payment_confirmed` → `provisioning` → `active` → `expiring` → `expired`

### SPOServer (HTTP on port 9100)
- `POST /api/heartbeat` — HBA telemetry ingestion
- `POST /api/v1/boxes/{boxId}/heartbeat` — Per-box heartbeat (used by real HBA agents)
- `GET /api/v1/boxes` — List all boxes
- `GET /api/pool` — Pool status summary
- **Tilling endpoints:** `/api/v1/tilling/provision`, `/stop`, `/sessions`, `/resume`, `/lock`, `/{tenantId}/create`, `/{tenantId}/message`, `/{tenantId}/update`
- **Crash guard:** `EADDRINUSE` handling — if external SPO (systemd) already owns port 9100, embedded server disables itself gracefully

### When to use main-process vs renderer-side pool code
- **Renderer-side:** Dashboard UI, telemetry hooks, card components, live badges — user-facing
- **Main-process:** Box registry, matchmaking, provisioning, revenue tracking, HBA communication — backend logic
- Both communicate via IPC (`stargate:registerAIM`, `stargate:aimify:exec`) or direct HTTP to SPO server

## Pitfalls

1. **Using `totalCerts` when the type has `storedCerts` / `certsSubmitted`** — the telemetry type must match the card props exactly or TS will error. If the daemon exposes two counts (submitted on-chain vs stored locally), model both fields separately.
2. **Passing `onClick` to a card that no longer accepts it** — if you remove the prop from the card interface, also remove the prop from every call site in the parent pool component.
3. **Missing icon in hub map** — if `icon: 'Shield'` is set in registry but `Shield` is not in `ICONS`, the hub renders nothing. Always patch `StargatePoolHub.tsx` too.
4. **Not polling `/metrics` or `/status`** — relying only on `/health` hides real block heights and cert counts. The hook should opportunistically fetch all available endpoints.
5. **Hardcoding numbers in the UI** — the card must read from telemetry. Any static number belongs in the endpoint `DEFAULT_` array or the config modal defaults, never in JSX.
6. **`AbortSignal.timeout()` silently fails in Electron 39 renderer** — Chromium 124-125 does not support this API inside renderer `fetch`. The request throws immediately into `catch`, reporting the node as offline even when it is reachable. **Fix**: replace every `signal: AbortSignal.timeout(N)` with a manual `AbortController` + `setTimeout(() => ctrl.abort(), N)` pattern. This applies to the telemetry hook, live badge, and any other pool component that polls private-network IPs.
7. **Docker `127.0.0.1` port bindings are LAN-invisible** — if an attestor/validator container exposes `127.0.0.1:8081->8080`, it is only reachable from the host machine itself. The Mosaic Companion on another machine sees it as offline. **Fix**: change compose `ports:` from `"127.0.0.1:8081:8080"` to `"8081:8080"` (binds `0.0.0.0`) so the node becomes LAN-visible.
8. **SSH access uses aliases, not raw IPs** — the user's HyperAIBox fleet is configured in `~/.ssh/config` with aliases (`r2d2`, `c3p0`) and non-default usernames (`hyperai`, `molt`). Direct `ssh user@192.168.x.x` may fail with permission denied even when the host is up. Always check `~/.ssh/config` before attempting remote access.

## Electron-specific fetch notes

When polling private-network endpoints (`192.168.x.x`, `10.x.x.x`) from the Electron renderer:
- `contextIsolation: true` and `nodeIntegration: false` are set — renderer `fetch` is standard browser fetch.
- CORS is **not** the blocker for same-origin or local-network HTTP; the real failure mode is missing `AbortSignal.timeout` support.
- If you ever need to bypass fetch limitations entirely, expose a `materios:poll` IPC handler in `electron/preload.ts` and have the **main process** do the HTTP call with Node's `http` module. That is overkill unless webSecurity is hardened further.
