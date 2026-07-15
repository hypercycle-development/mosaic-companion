---
name: stargate-debug-playbook
description: Debugging playbook for Mosaic-Companion Stargate module — agent connectivity, UI wiring, provider routing, and infrastructure verification.
version: 1.0.0
metadata:
  hermes:
    tags: [mosaic, stargate, debugging, troubleshooting, agent-connectivity]
---

# Stargate Debug Playbook

## Agent Not Responding in Chat Rooms

### Phase 1: Understand
Symptom: User sends message to agent in Chat Rooms, no response.

### Phase 2: Hypothesize
Possible causes:
1. Agent runner not activated (no @mention or direct message)
2. Wrong serverUrl in multi-machine setup
3. Ollama model timeout (slow local models like qwen2.5:32b)
4. `HeadersTimeoutError` on HTTP requests
5. `hermes-aim` heartbeat on wrong port (8642 vs 9000)
6. Invalid empty `Bearer ` auth header
7. Literal `JSON_ARGS` in tool prompts (breaks tool calling)

### Phase 3: Isolate
Check these in order:

```bash
# 1. Agent runner activation
grep -n "activateRunner\|agent-runner" electron/integrations/chat/index.ts

# 2. Server URL configuration
grep -n "serverUrl\|localhost" src/components/ChatPage.tsx | head -20

# 3. Ollama connectivity
curl http://localhost:11434/api/tags

# 4. AIM container health
curl http://localhost:9000/health

# 5. Gateway health
curl http://localhost:8642/api/status
```

### Phase 4: Verify
- Check browser DevTools Network tab for failed requests
- Check Electron main process logs for IPC errors
- Verify `agent-runner.ts` is receiving messages

### Phase 5: Apply Minimal Fix
| Issue | Fix |
|-------|-----|
| Timeout on slow model | Increase timeout in `fetch()` call, or switch to cloud model (`:cloud` suffix) |
| Wrong port for hermes-aim | Route to 9000, not 8642 |
| Empty Bearer header | Add null check before setting Authorization |
| JSON_ARGS literal | Remove from system prompt template |

### Phase 6: Test
Send test message to agent, verify response arrives within 10s.

### Phase 7: Prevent
Add health check probe to agent startup sequence.

### Phase 8: Detective
Document root cause in skill reference for future incidents.

---

## Button Opens Wrong Tab (AI Chat instead of Target)

### Pattern
User clicks button in Stargate tab, AI Chat opens instead of intended destination.

### Root Causes
1. **Handler fallbacks**: `else if (onNavigateToChat)` runs on success path
2. **Parent override**: Callback prop wired to `onCreateNewChatTab` in parent
3. **Intent card grid**: Card calls `onNavigateToChat` in `onClick`

### Diagnostic Steps

```typescript
// 1. Log the callback prop in child component
console.log("onAction prop:", props.onAction);
// If undefined → trace upward through parent chain

// 2. Check parent instantiation
// In ContentArea.tsx or AdaPortalPanel.tsx:
<MyComponent
  onAction={onCreateNewChatTab}  // ❌ Wrong - overrides child
  onAction={handleTabNavigation}  // ✅ Correct
/>

// 3. Check intent card onClick
// In Start tab:
onClick={() => {
  setActiveTab(intent.tab);        // ✅ Correct
  onNavigateToChat?.();            // ❌ Wrong - removes this
}}
```

### Fix
Remove `onNavigateToChat` from **success paths**. Only use it for:
- Wallet missing
- Wrong wallet
- Insufficient funds

---

## Provider Routing Issues

### Pattern
Model with `:cloud` suffix not routing correctly, or `hermes-aim` not detected.

### Rules
1. Use `provider.startsWith('hermes')` not `=== 'hermes'`
2. `:cloud` suffix must route through `ollama-cloud` provider, not `ollama`
3. `hermes-aim` uses port 9000, not 8642

### Verification
```typescript
// Correct provider check
if (provider.startsWith('hermes')) { ... }

// Correct cloud routing
if (model.endsWith(':cloud')) {
  return ollamaCloudProvider;  // Not ollamaProvider
}
```

---

## Static Method Import Trap

### Pattern
TS2339 error when importing `AIService.sendToHermesAIM`.

### Wrong
```typescript
const { sendToHermesAIM } = await import('../services/AIService');
sendToHermesAIM(...);  // ❌ TS2339
```

### Correct
```typescript
const { AIService } = await import('../services/AIService');
AIService.sendToHermesAIM(...);  // ✅ Static method on class
```

---

## Gateway Process Binding Issues

### Symptom
Gateway process exists (`pgrep` shows PID) but port 8642 not accepting connections.

### Root Cause
Stale gateway processes from previous runs holding the port.

### Diagnostic
```bash
# Check if port is in use
sudo lsof -i :8642

# Check for multiple gateway processes
pgrep -f "hermes gateway"
```

### Fix
```bash
# Kill all stale gateway processes
pkill -f "hermes gateway"

# Verify port is free
sudo lsof -i :8642  # Should show nothing

# Restart gateway
hermes gateway run
```

### Verification
```bash
curl http://localhost:8642/api/status
# Should return 200 OK
```

---

## Quick Diagnostic Script

Run the comprehensive health check:

```bash
~/.hermes/skills/mosaic-stargate/stargate-debug-playbook/scripts/stargate-health-check.sh
```

This checks:
- **Infrastructure:** AIM (9000), Dashboard (9119), Ollama (11434), Marketplace (3000), Scanner (8001)
- **Gateway:** Process running, kanban board set
- **AI Providers:** Ollama models loaded, cloud vs local routing, gateway providers API
- **AIM Endpoint:** Chat endpoint responding to test requests

## Service Port Reference

| Service | Port | Health Check |
|---------|------|--------------|
| AIM container | 9000 | `curl localhost:9000/health` |
| Gateway | 8642 | `pgrep -f "hermes gateway"` |
| Dashboard | 9119 | `curl localhost:9119/api/status` |
| Ollama | 11434 | `curl localhost:11434/api/tags` |
| Skills Marketplace | 3000 | `curl localhost:3000/health` |
| MarketplaceService | 13000 | `curl localhost:13000/api/health` |
| Scanner | 8001 | `curl localhost:8001/health` |

## Known Error Patterns

### Stale Closure in useCallback with State
- **Symptom:** Button sets state (e.g., `connected = true`) then calls a callback that reads the same state — callback sees old value, exits early.
- **Cause:** React `useCallback` captures state from closure at creation time. If state changes after creation, the callback still references the old closure.
- **Fix:** Use `useRef` guards that bypass React's closure mechanism. See `references/stale-closure-refs.md` for the complete pattern, verification steps, and 2 additional anti-patterns.
- **Files affected:** Any React component using `useCallback` + state reads inside async/event handlers. Specifically: `MidnightCityCommandPanel.tsx` (`refreshState`, `submitAction`, `doDisconnect`, heartbeat interval).

### 405 Method Not Allowed on ollama.com
- **Symptom:** AI Chat returns 405 when using cloud models (`kimi-k2.5:cloud`)
- **Cause:** ollama-cloud provider using wrong endpoint (`/v1/chat/completions` instead of `/api/chat`)
- **Fix:** See `references/405-ollama-cloud-endpoint-fix.md`

---

## Render Crash → RPC Cascade Pattern

**Symptom:** Clicking Connect in Midnight City tab → AdaPortal initializes → wallet detected → then console floods with 429/403 from `base.publicnode.com`. React render crash cascades into uncoordinated RPC retry loops.

**Root Cause (layered):**
1. **Layer 1:** `listing.rating.toFixed(1)` throws `TypeError: Cannot read properties of null` because HyperInsight API returns `rating: null` for unrated agents.
2. **Layer 2 (2026-06-25 — deeper):** `anfe.verification` itself is `null` (not just `.uptime`). `anfe.verification.uptime` throws **before** `??` is evaluated because `null.uptime` is an immediate TypeError.
3. **Layer 3:** React unmounts the broken component tree, orphaning in-flight promises (wallet ANFE discovery, balance loading).
4. **Layer 4:** Orphaned promises retry in an uncoordinated loop, hammering `base.publicnode.com` with no backoff/throttle.

**Fix Pattern — Null-safe rendering (guard PARENT object first):**

```tsx
// WRONG: ?? only protects null PROPERTY, not null PARENT
{anfe.verification.uptime !== undefined && (
  <span>Uptime: {((anfe.verification.uptime ?? 0) * 100).toFixed(1)}%</span>
)}  // Throws: Cannot read properties of null (reading 'uptime')

// RIGHT: guard parent object BEFORE accessing property
{anfe.verification && anfe.verification.uptime !== undefined && anfe.verification.uptime !== null && (
  <span>Uptime: {((anfe.verification.uptime ?? 0) * 100).toFixed(1)}%</span>
)}
```

**Fix Pattern — Then coalesce the property:**
```tsx
{(listing.rating ?? 0).toFixed(1)}
{(listing.successRate ?? 0) * 100}%
```

**Fix Pattern — Per-service RPC throttle:**
```ts
for (let i = 0; i < balance; i++) {
  const result = await this.callContract(...);
  if (i < balance - 1) {
    await new Promise(r => setTimeout(r, 300)); // throttle
  }
}
```

**Fix Pattern — Circuit Breaker + Exponential Backoff:**
```ts
// In ANFEService class:
private rpcFailCounts = new Map<string, number>();
private rpcCircuitOpen = new Map<string, number>();
private readonly CIRCUIT_THRESHOLD = 5;
private readonly CIRCUIT_COOLDOWN_MS = 30000;

private async exponentialBackoff<T>(fn: () => Promise<T>, retries = 3, baseDelay = 800, rpcUrl?: string): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await this.withRateLimit(fn, rpcUrl);
    } catch (err: any) {
      const status = err?.status || 0;
      const isRetryable = status === 429 || status === 403 || status === 502 || status === 503 || status === 504;
      if (!isRetryable || i === retries) throw err;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
}
```

**See:** `references/shared-rpc-limiter-multi-service-cascade.md` — Full session details, file patches, and prevention checklist (2026-06-25).

**See also:** `references/mcp-bridge-resilience-pattern.md` — MCP bridge fast-fail and session-level health caching (2026-06-27).

**See:** `references/soul-capability-array-guard-pattern.md` — Reusable `Array.isArray()` guard pattern for agent config builders (2026-06-30).

**See:** `references/hyperaibox-tiller-infrastructure.md` — HyperAIBox tiller setup, HBA agent fixes, SPO tiller endpoints, non-custodial signing flow (2026-06-29).

**See:** `references/hyperaibox-network-access-diagnostic.md` — Live network diagnostics when HyperAIBoxes are unreachable despite being powered on. Covers ping, ARP, SSH key auth, Tailscale, WireGuard, and the "no route to host" root-cause map (2026-07-01).

**See:** `references/auto-skill-importer-full-autonomy.md` — Removing TIER1_AUTO_IMPORT whitelist in favor of blacklist-only auto-import. User preference for full autonomy (2026-07-01).

**See:** `references/stargate-component-registry-self-awareness.md` — Building a component registry for bot self-awareness: 38 components, orchestrator injection, IPC exposure, knowledge persistence (2026-07-01).

## Port Collision Crashes & Persisted Plugin Config

**Symptom A:** Electron popup "Uncaught Exception: listen EADDRINUSE 0.0.0.0:9100" on startup.
**Cause:** Embedded SPO in `electron/main.ts` collides with the standalone systemd `spo-server.service`. `server.listen()` failures arrive as an async `'error'` EVENT — try/catch around the start call catches nothing, so the unhandled event crashes the whole app.
**Fix:** (1) health-probe the port first and skip the embedded server if an external one answers; (2) ALWAYS attach `server.on("error")` before `listen()` on any `http.createServer` in Electron main.

**Symptom B:** `Failed to initialize vector store ... "Method Not Allowed" is not valid JSON` from midnight-mcp.
**Cause:** Port 8000 on this machine is HyperCycle `controller_serve`, NOT ChromaDB. midnight-mcp's default `CHROMA_URL=localhost:8000` hits the wrong service.
**Fix:** Set `CHROMA_URL` to a closed port (e.g. `http://127.0.0.1:18790`) → instant ECONNREFUSED → clean in-memory fallback.

**Symptom C:** Code fix for a plugin's env has no effect after rebuild.
**Cause:** Plugin registrations persist to `~/.config/mosaic-companion/mcp-plugins.json`; the `pluginManager.add()` code path only runs on fresh installs. Patch the persisted JSON too.

**See:** `references/port-collision-and-persisted-config.md` — full diagnostics, code patterns, and the port-ownership recipe (`ss -tlnp` → `ps -p <pid>`) (2026-07-01).

---

## Agent Tool-Chain Limits & MCP Protocol Mismatch

**Symptom:** Agent says "I've reached the tool-chain safety limit" after only 3 tool calls, or console shows `Method not found: notifications/initialized`.

**Quick fixes:**
- Tool-chain limit too low: `src/components/Chatview.tsx` — raise `chainDepth >= 3` → `>= 10`, `synthesisHint` at `chainCount >= 3` → `>= 10`, system prompt wording "3 or more tools" → "10 or more tools"
- MCP protocol mismatch: `midnight-mcp-server.js` — handle `notifications/initialized` in addition to `initialized`
- SOUL/Capability crash: `HermesCapabilityRegistry.ts` + `VaultCapabilityService.ts` — add `Array.isArray()` guards before `.map()` on capability/vault arrays

**See:** `references/tool-chain-safety-limit-mcp-protocol-mismatch.md` — Full session details, file patches, and prevention checklist (2026-06-30).

---

## HyperAIBox Tiller Infrastructure

---

## Multi-Service RPC Storm — When Multiple Services Hammer the Same Endpoint

**Symptom:** Console floods with 429/403 from `base.publicnode.com` BEFORE any user interaction. "Blue screen" crash on tab switch. Logs show simultaneous `[AssetDiscovery]`, `[ANFEService]`, and `[AdaPortal]` RPC calls.

**Root Cause:** Multiple independent services all call the same public RPC endpoint simultaneously, each with their OWN isolated circuit breaker. They all hit the endpoint before ANY breaker trips.

**Affected services (typical AdaPortal initialization):**
| Service | Method | Calls |
|---------|--------|-------|
| `AdaPortalPanel.tsx` `useEffect` | `anfeService.loadWalletANFEs()` | 1 |
| `AdaPortalPanel.tsx` `loadData()` IIFE | `anfeService.loadWalletANFEs()` | 1 |
| `UnifiedAssetPanel` | `assetDiscovery.discoverAll()` | 2 (ethereum + base) |
| `ANFEService.getHyperCycleBalances()` | `callContract()` per token | ~8-15 |
| `ANFEService.getHyperCycleNFTsDetailed()` | `discoverANFEsForContract()` per token | ~3-5 |
| `AssetDiscovery.scanForAssets()` | `rpcCall()` per contract | ~4-6 |

**Result:** 50-100+ RPC requests in the first 3 seconds. PublicNode rate-limits after ~5-10 rapid requests.

**Why per-service breakers fail:**
```ts
// ANFEService has its own breaker
private rpcCircuitOpen = new Map(); // only tracks ANFEService calls

// AssetDiscovery has its own breaker
private endpointCooldowns = new Map(); // only tracks AssetDiscovery calls

// They DON'T coordinate — both hit the endpoint before either trips
```

**Fix Pattern — Global Shared RPC Limiter:**

Create a module-level singleton that ALL services import:

```ts
// SharedRPCLimiter.ts — module-level singleton
const MIN_INTERVAL_MS = 1500;
const MAX_CONCURRENT = 1;
let lastCallTime = 0;
let activeCalls = 0;

// Per-endpoint circuit breaker (shared across ALL services)
const endpointTrips: Map<string, number> = new Map(); // url -> cooldownUntil
const endpointFailures: Map<string, number> = new Map(); // url -> consecutive failures
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30000;

export async function rpcCall(
  chain: 'ethereum' | 'base',
  payload: { method: string; params: any[] }
): Promise<any> {
  // 1. Throttle: wait until MIN_INTERVAL_MS since last call
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }

  // 2. Backpressure: max 1 concurrent call globally
  while (activeCalls >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 100));
  }

  // 3. Endpoint rotation: skip tripped endpoints, try fallbacks
  const urls = RPC_URLS[chain];
  for (const url of urls) {
    const cooldownUntil = endpointTrips.get(url) || 0;
    if (Date.now() < cooldownUntil) continue; // skip tripped endpoint

    activeCalls++;
    lastCallTime = Date.now();
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', ...payload, id: 1 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json.error) throw new Error(json.error.message);
      endpointFailures.delete(url); // reset on success
      return json.result;
    } catch (err: any) {
      // Track failures for circuit breaker
      const count = (endpointFailures.get(url) || 0) + 1;
      endpointFailures.set(url, count);
      if (count >= CIRCUIT_THRESHOLD) {
        endpointTrips.set(url, Date.now() + CIRCUIT_COOLDOWN_MS);
        endpointFailures.delete(url);
      }
      if (url === urls[urls.length - 1]) throw err; // all endpoints failed
    } finally {
      activeCalls--;
    }
  }
  throw new Error(`All ${chain} RPC endpoints tripped`);
}
```

**Fix Pattern — Scan-level Deduplication:**

When multiple UI components request ANFEs for the same wallet simultaneously:

```ts
class ANFEService {
  private scanLocks: Map<string, Promise<WalletANFEs>> = new Map();

  async loadWalletANFEs(walletAddress: string): Promise<WalletANFEs> {
    // If another caller is already scanning, return the SAME promise
    const existing = this.scanLocks.get(walletAddress);
    if (existing) {
      console.log(`[ANFEService] Deduplicating scan for ${walletAddress.slice(0,8)}...`);
      return existing;
    }

    const promise = this._doLoadWalletANFEs(walletAddress);
    this.scanLocks.set(walletAddress, promise);
    promise.finally(() => this.scanLocks.delete(walletAddress));
    return promise;
  }
}
```

**Fix Pattern — UI-layer Gate:**

Prevent `loadData()` and `useEffect` from both triggering scans:

```ts
// Module-level gate (outside component)
let globalScanPromise: Promise<void> | null = null;

const loadData = useCallback(async () => {
  if (globalScanPromise) {
    await globalScanPromise; // wait for existing scan, don't start new one
    return;
  }
  globalScanPromise = doScan();
  try { await globalScanPromise; } finally { globalScanPromise = null; }
}, []);
```

**See:** `references/shared-rpc-limiter-multi-service-cascade.md` — Full architecture, file list, and implementation details.

---

## Quick Diagnostic Commands

```bash
# Full Stargate health check
echo "=== AIM Container ===" && curl -s http://localhost:9000/health
echo "=== Gateway ===" && pgrep -f "hermes gateway" && echo "running"
echo "=== Ollama ===" && curl -s http://localhost:11434/api/tags | jq '.models | length'
echo "=== Dashboard ===" && curl -s http://localhost:9119/api/status
```
