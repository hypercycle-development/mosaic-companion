---
name: mosaic-stargate-hermes-debug
description: Debug Mosaic Companion Stargate connectivity, AI Chat failures, Hermes AIM integration, and provider routing issues.
trigger: When the "Aimify Hermes" card in Stargate fails to detect a running Hermes instance, AI Chat returns 400/401/404/405 errors, ActionParser crashes on JSON_ARGS, or provider routing fails between hermes/hermes-aim/ollama-cloud.
---

**Also see:** `references/ada-stops-answering-rpc-storm-tool-chain-2026-06-20.md` — Ada appears frozen while `AssetDiscovery` hammers `base.publicnode.com` with 429/403; tool-chain reaches 107 results before stopping. Hardened fix: lower tool-result cap to 4, add `chainDepth` counter, deduplicate scans, and fail fast when all RPC endpoints are tripped. (2026-06-20)

## Problem Pattern
The Stargate Dashboard filters Hermes agents by strict `provider === 'hermes'` string checks in multiple components. If the stored agent uses `provider: "hermes-aim"` or `provider: "hermes-api"`, the filtered array becomes empty and the UI disables the "Discover & Connect" button.

**Also see:** `references/stargate-dashboard-hand-rolled-fetch-vs-aiservice-2026-06-19.md` — Main AI Chat works but Stargate Dashboard returns 405 because it hand-rolls `fetch` instead of reusing `AIService.sendMessage`. Fix: route all standard providers through `AIService`.

**Also see:** `references/mosaic-agent-tool-chain-loop-recursion.md` — Agent chat loop hits "Max recursion depth reached" after chaining too many tools; fix combines prompt-level synthesis budget, hard tool-result cap, and user-visible limit message. (2026-06-20)
**Also see:** `references/public-rpc-circuit-breaker-asset-discovery-2026-06-19.md` — Dashboard console storms with 403/429 from `base.publicnode.com`; fix adds per-endpoint circuit breakers and debounces `UnifiedAssetPanel` scans.

## Three Hermes Provider Variants in Mosaic
| Provider String | Port | Role |
|---|---|---|
| `hermes` | 8642 | Raw Hermes API server |
| `hermes-aim` | 9000 | AIMified Hermes module (HyperCycle) |
| `hermes-api` | varies | OpenAI-compatible Hermes endpoint |

## Files to Inspect
1. `~/.config/mosaic-companion/ai-agents.json` — Check actual stored `provider` and `baseUrl`
2. `src/components/HermesAimPanel.tsx` — Lines ~88 and ~351 filter `agents` by provider string
3. `src/components/KanbanDashboard.tsx` — Lines ~239, ~462, ~710 pass or filter Hermes agents
4. `src/components/AIAgentsSettings.tsx` — Base URL input field visibility is gated on `provider === 'hermes'`; `hermes-aim`/`hermes-api` lose the field
5. `src/services/AIService.ts` — Health-check `testConnection()` only routes for `=== 'hermes'`; `hermes-aim`/`hermes-api` skip health checks entirely
6. `src/services/HermesAgentService.ts` — Runtime HTTP client; verify `baseUrl` is used correctly
7. `src/services/stargate/AimifierService.ts` — Discovery logic that probes `localhost:9000`
8. `electron/main.ts` — IPC handler registrations for `stargate:*` channels; verify every channel in `preload.ts` has a matching `ipcMain.handle`

## Diagnostic Steps
1. `ss -tlnp | grep -E '9000|8642'` — Confirm which port is listening
2. `curl -s localhost:9000/health` — Verify AIM module responds
3. `cat ~/.config/mosaic-companion/ai-agents.json | jq '.[] | select(.id | contains("hermes"))'` — See stored agent config
4. Read the provider filters in `HermesAimPanel.tsx` and `KanbanDashboard.tsx`
5. If mismatch confirmed: widen filters to `a.provider === 'hermes' || a.provider === 'hermes-aim' || a.provider === 'hermes-api'`

## Fix Pattern
Patch all strict `=== 'hermes'` checks to include the full family:
```tsx
// Before
const hermesAgents = agents.filter(a => a.provider === 'hermes');
// After
const hermesAgents = agents.filter(a => a.provider === 'hermes' || a.provider === 'hermes-aim' || a.provider === 'hermes-api');
```

**Operators trap** — when the provider check is combined with `&&`, parenthesize the OR group:
```tsx
// ❌ wrong precedence
agent.provider === 'hermes' || agent.provider === 'hermes-aim' && col.id !== 'aimified'
// ↑ evaluates as (hermes) OR (hermes-aim && not-aimified)

// ✅ parenthesized
(agent.provider === 'hermes' || agent.provider === 'hermes-aim' || agent.provider === 'hermes-api')
  && col.id !== 'aimified'
```

## Build Verification
```bash
cd /home/mauricio/mosaic-companion
npx tsc --noEmit
npm run build:renderer
```

## Dead IPC Handler Audit ("Wired to Nowhere")

If Stargate features appear in the UI but calls silently fail, the `preload.ts` may expose channels that have **no matching handler** in `electron/main.ts`.

### Canonical preload channels (20 stargate/aimify IPC calls)
- `aimify:exec`, `aimify:read-file`, `aimify:write-file`
- `stargate:deployAgentCode`, `stargate:deployAgentToNode`
- `stargate:dispatchPrompt`, `stargate:forge:disableHealthCheck`
- `stargate:forge:enableHealthCheck`, `stargate:forge:isHealthy`
- `stargate:forge:listDeployed`, `stargate:forge:listRunning`
- `stargate:forge:stopAgent`, `stargate:listAgentTools`
- `stargate:registerAIM`, `stargate:registerAgentTool`
- `stargate:runJob`, `stargate:skill:syncToNode`
- `stargate:testAgentCode`, `stargate:unregisterAIM`
- `stargate:unregisterAgentTool`

### Audit script
```bash
echo "=== Channels exposed in preload.ts ==="
grep -oE 'ipcRenderer\.invoke\("[^"]+"' electron/preload.ts | sed 's/ipcRenderer\.invoke("//;s/"$//' | sort -u

echo "=== Channels handled in main.ts ==="
grep -oE 'ipcMain\.handle\("[^"]+"' electron/main.ts | sed 's/ipcMain\.handle("//;s/"$//' | sort -u

echo "=== Channels handled in sandbox/index.ts ==="
grep -oE 'ipcMain\.handle\("[^"]+"' electron/integrations/sandbox/index.ts | sed 's/ipcMain\.handle("//;s/"$//' | sort -u

echo "=== Channels handled in mcp/index.ts ==="
grep -oE 'ipcMain\.handle\("[^"]+"' electron/integrations/mcp/index.ts | sed 's/ipcMain\.handle("//;s/"$//' | sort -u

# Multi-line handler detection (handler name on line after ipcMain.handle(
awk '/ipcMain\.handle\(/{getline n; if(n ~ /"stargate:/) print n}' electron/main.ts | sed 's/.*"\([^"]*\)".*/\1/' | sort -u
```

**Symptom:** `window.electronAPI?.stargate?.dispatchPrompt(...)` returns `undefined` because the channel has no handler. UI buttons appear functional but produce no side effects.

## Duplicate LLM Call Path Trap: Dashboard vs. AI Chat

**Symptom:** Agent works in the main AI Chat but fails in the Stargate Dashboard with the same provider/model. The Dashboard returns 405/401/404 while the main chat returns 200.

**Root Cause:** Two different components implement the same LLM call. `Chatview.tsx` uses `AIService.sendMessage()`; `KanbanDashboard.tsx` (or another dashboard component) hand-rolls `fetch()` to `/v1/chat/completions`. Any fix in `AIService` (URL redirect, auth guard, headers, streaming) is silently bypassed by the duplicated path.

**Diagnostic Steps:**
1. Confirm both components load the same agent list (`window.electronAPI.aiAgents.get()`).
2. Search for duplicated fetch calls:
   ```bash
   grep -rn "v1/chat/completions" src/ | grep -v AIService
   grep -rn "PROVIDER_INFO\[" src/components/
   ```
3. Compare the failing component's fetch shape with `AIService.sendMessage()`.

**Fix Pattern:** Route the standard providers through the shared service:
```typescript
const AIServiceModule = await import('../services/AIService');
const AIServiceClass = AIServiceModule.AIService || (AIServiceModule as any).default?.AIService || (AIServiceModule as any).default;
if (!AIServiceClass || typeof AIServiceClass.sendMessage !== 'function') {
  throw new Error('AIService.sendMessage not available');
}
const msg = { id: '1', role: 'user' as const, content: prompt, timestamp: Date.now(), agentId: agent.id };
const reply = await AIServiceClass.sendMessage(agent, [msg]);
```

**Prevention:**
- After fixing a provider in `AIService`, grep for any other `fetch(...v1/chat/completions...)` calls outside that file.
- Prefer a single service method for the same LLM operation across all UI surfaces.
- If a component must hand-roll a fetch, add a code comment justifying why `AIService` is bypassed and audit it on every provider change.

**See:** `references/stargate-dashboard-hand-rolled-fetch-vs-aiservice-2026-06-19.md` for the full session details.

---

## Related: Ollama Cloud baseUrl Migration (2026-06-10)

**Symptom:** AI Chat returns HTTP 405 "Method Not Allowed" from `ollama.com/v1/chat/completions`. The agent was saved with wrong baseUrl; migration code existed but wasn't catching all code paths.

**Root Cause:** Saved agents had `baseUrl: "https://ollama.com/v1"` (public website) instead of `"https://api.ollama.com/v1"` (actual API). Multiple provider code paths bypassed the migration.

**Fix Pattern:** Defense-in-depth with 4 layers:
1. Entry point migration in `sendMessage()`
2. Re-routing in `openai`/`custom`/`hermes-api` switch cases  
3. Final safety check in `sendToOpenAI()` right before fetch
4. Direct fetch fix in `KanbanDashboard`

**See:** `references/ollama-cloud-baseurl-migration-patterns.md` for the aggressive 4-layer fix pattern and diagnostic logging.
**See:** `references/ollama-cloud-api-key-fix-soul-integration-session-2026-06-19.md` — Complete session log for Ollama Cloud 401 fix and SOUL integration commit to stargate-module, including BatteryOrg stub fix.
**See:** `references/xhr-streaming-callback-emulation-2026-06-19.md` — When API returns 200 but agent never responds: XHR doesn't support streaming, so manually invoke `onToken` and `onComplete` callbacks with the full response.
**See:** `references/ollama-cloud-auth-and-hermes-aim-404-session-2026-06-12.md` for full session details on 401 + 404 errors.
**See:** `references/ollama-cloud-redirect-post-get-301-session-2026-06-19.md` for the 301 redirect POST→GET conversion issue and the `api.ollama.com` → `ollama.com` endpoint correction.
**See:** `references/ollama-cloud-301-redirect-post-to-get-session-2026-06-19.md` for the complete 301 redirect POST→GET conversion pattern, XHR bypass technique, and verification commands.

---

## Ollama Cloud 301 Redirect: POST→GET Conversion (2026-06-19)

**Symptom:** Console shows `POST https://api.ollama.com/v1/chat/completions` but Network tab shows `GET https://ollama.com/v1/chat/completions 405`.

**Root Cause:** Ollama Cloud returns **301 Moved Permanently** redirect from `api.ollama.com` to `ollama.com`. Browsers convert POST to GET on 301/302 redirects per RFC 7231.

**Verification:**
```bash
# Check for redirect
curl -X POST -L -I https://api.ollama.com/v1/chat/completions
# HTTP/2 301
# location: https://ollama.com/v1/chat/completions
```

**Fix:** Use the final endpoint directly:
```typescript
// BEFORE (causes redirect)
const url = 'https://api.ollama.com/v1/chat/completions';

// AFTER (direct)
const url = 'https://ollama.com/v1/chat/completions';
```

**Secondary Issue:** External CDN (aistudiocdn.com) was intercepting fetch(). Use XHR to bypass:
```typescript
const xhr = new XMLHttpRequest();
xhr.open('POST', url, true);
xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
xhr.send(body);
```

**See:** `references/fetch-interception-bypass-xhr-technique.md` — When fetch() is intercepted by external CDN scripts, use XMLHttpRequest to bypass the interception.

---

**Symptom:** AI Chat returns HTTP 401 Unauthorized from `api.ollama.com/api/chat` when using Ollama Cloud models (e.g., `minimax-m2.5`, `kimi-k2:1t`). Browser console shows: `Ollama error (model: X): Unauthorized`

**Root Cause:** `sendToOllama()` in `src/services/AIService.ts` (lines 189-230) was designed for local Ollama instances which don't require authentication. Ollama Cloud **requires** Bearer token authentication via `Authorization` header.

**Fix Pattern:** Add conditional Authorization header when calling Ollama Cloud:
```typescript
static async sendToOllama(
  config: AIAgentConfig,
  messages: ChatMessage[],
  callbacks?: StreamCallbacks
): Promise<string> {
  const isOllamaCloud = config.baseUrl?.includes("api.ollama.com");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Ollama Cloud requires Bearer authentication
  if (isOllamaCloud && config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  
  const response = await fetch(
    `${config.baseUrl || "http://localhost:11434"}/api/chat`,
    {
      method: "POST",
      headers,  // Now includes Authorization for cloud
      body: JSON.stringify({...}),
    }
  );
  // ... rest unchanged
}
```

**Verification:**
```bash
# Without auth - returns 401
curl -X POST https://api.ollama.com/api/chat \
  -d '{"model": "minimax-m2.5", "messages": [{"role": "user", "content": "test"}]}'
# → {"error":"Unauthorized"}

# With auth - succeeds
curl -X POST https://api.ollama.com/api/chat \
  -H "Authorization: Bearer <key>" \
  -d '{"model": "minimax-m2.5", "messages": [{"role": "user", "content": "test"}]}'
# → {"model":"minimax-m2.5",...}
```

**Related Issues:** This is the flip side of the 405 error. After fixing the endpoint (from `/v1/chat/completions` to `/api/chat`), the auth requirement surfaces because the native Ollama endpoint requires Bearer tokens for cloud access.

---

## Related: Hermes Provider Port Routing (2026-06-08)

When debugging AI Chat failures from the main process (MosaicBot heartbeat, background agent execution), the default port for Hermes-family providers is wrong for `hermes-aim`.

**Symptom:** Main process logs:
```
[MosaicBot/LLM] Call failed (hermes-aim): Error: Hermes 404:
```

**Root Cause:** `electron/integrations/mosaicbot/src/main/llm.ts` hardcodes **all** Hermes variants to port 8642, but `hermes-aim` runs on 9000.

| Provider | Required Port | Endpoint |
|----------|---------------|----------|
| `hermes` | 8642 | `/v1/chat/completions` |
| `hermes-api` | 8642 (or custom) | `/v1/chat/completions` |
| `hermes-aim` | **9000** | `/chat` (native AIM format) |

**Fix Pattern:** Create separate handler for `hermes-aim` that uses `/chat` endpoint:
```typescript
async function callHermesAIM(agent: AgentConfig, messages: Message[], systemPrompt?: string): Promise<string> {
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content || "";
  const system = systemPrompt || messages.find((m) => m.role === "system")?.content || "";
  const res = await fetch(`${agent.baseUrl || "http://127.0.0.1:9000"}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: lastUser, system_prompt: system }),
  });
  if (!res.ok) throw new Error(`HermesAIM ${res.status}: ${await res.text()}`);
  const data = await res.json() as { response?: string };
  return data.response || "";
}
// Update switch: case "hermes-aim": return await callHermesAIM(...);
```

**See:** `references/ai-chat-failure-patterns.md` for the full fix including hardening `ActionParser` against literal `JSON_ARGS` and fixing the empty `Bearer ` auth header in `sendToOpenAI`.

**Fix:** Add minimal handlers in `electron/main.ts` for every exposed channel, even if the initial implementation is a stub or passthrough. A stub handler that throws is better than no handler — it produces a visible error instead of silent no-op.

## TypeScript Stub Pattern for Missing Modules

**Symptom:** Build fails with `TS2307: Cannot find module '../services/TasteSkillService'` or similar.

**When to use:** When merging code that references non-existent modules, create minimal stubs to unblock the build.

**Pattern:**
```typescript
// Stub for ModuleName - placeholder until actual implementation

export interface ModuleInterface {
  id: string;
  name: string;
  // Match the expected interface from the component
}

export const moduleService = {
  init: async () => {
    console.log('[ModuleName] Stub initialized');
    return { success: true, error: null };
  },
  getData: (): ModuleInterface[] => {
    return [];
  },
};
```

**Real Example (BatteryOrg stub):**
```typescript
export interface BatteryPoolNode {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'online' | 'maintenance';
  capacity: number;
  used: number;
  tflops: number;
  location: { region: string; city?: string };
  gpuCount: number;
  gpuModel: string;
  energySource: string;
  pricePerHourUsd: number;
  isAvailable: boolean;
}

export const batteryOrgPool = {
  init: async () => {
    console.log('[BatteryOrg] Stub initialized');
    return { success: true, error: null };
  },
  getNodes: (): BatteryPoolNode[] => [],
};
```

**Key Points:**
- Match the interface expected by the component
- Return empty arrays/objects instead of throwing
- Add console logs for visibility
- Replace with real implementation later

Two common mistakes when writing IPC handlers in `electron/main.ts`:

1. **Using `window.electronAPI` inside main process**
   - `window` is undefined in the main process. Accessing `window?.electronAPI?.nodes?.get()` crashes.
   - **Fix:** Import the data source directly (e.g., `import { getNodes } from "../settings.ts"`).

2. **Using `localStorage` inside main process**
   - `localStorage` is a Web Storage API, available only in renderer/browser contexts.
   - **Fix:** Replace with filesystem read/write using `fs` and `path`. For fleet registry, use `~/.config/mosaic-companion/fleet_registry.json`.

## Prevention
- Consider adding `isHermesFamily(provider)` helper in `src/types/ai.ts`
- Derive grouping from `PROVIDER_INFO` metadata instead of hardcoded string checks
- When adding new provider variants, grep for `=== 'hermes'` across `src/components/` and `src/services/`

## Phantom Subpath Trap: `/kanban` on AIM Dashboard

**Symptom:** After fixing the dead port 9119, the "Open Kanban" button opens `http://localhost:9000/kanban` and 404s. The actual AIM dashboard lives at `/` (root).

**Root Cause:** The codebase appended `/kanban` to the base URL because the log label in `AimifierService.ts` calls the URL "Kanban". But the AIM has no `/kanban` HTTP endpoint — the dashboard is served at `/`.

**Verification:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/kanban
# → 404

curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/
# → 200
```

**Fix:** Open the AIM root URL directly. Do not append `/kanban`.
```typescript
// Before (broken — 404)
const baseUrl = connectUrl || `http://localhost:${discoveryPort}`;
const url = baseUrl.endsWith('/kanban') ? baseUrl : `${baseUrl}/kanban`;

// After (correct)
const url = connectUrl || `http://localhost:${discoveryPort}`;
```

**Key Lesson:** Log labels are not API contracts. A developer may label a URL "Kanban" in a log line, but that does not mean the endpoint is `/kanban`. Always verify with `curl` before hardcoding a subpath.

**Deep audit reference:** See `references/route-audit-session-2026-05-31.md` for the full route verification methodology (using Python `urllib` when `curl` is missing inside the container), embedded vs built image path differences, and implementation options for adding a `/kanban` handler if required.

---

**See:** `references/null-parent-object-react-crash-shared-rpc-limiter-2026-06-25.md` — Null parent objects (`anfe.verification`, `area.activities`, `attrs.ai`) cause React crashes BEFORE `.toFixed()` or `.join()` even runs. Also documents the SharedRPCLimiter singleton architecture: 1 concurrent request globally, 400ms spacing, endpoint rotation, throw-on-exhaustion, scan deduplication via `scanLocks`. (2026-06-25)

**See:** `references/null-toFixed-react-render-crash-rpc-cascade-2026-06-25.md` — Null `rating.toFixed()` crashes React render tree, unmounting component orphans in-flight promises → uncoordinated retry loops hammer public RPCs with 429/403. Fix: null-coalesce ALL `.toFixed()` on API data + add throttling/circuit breakers to RPC enumeration.

## Null Parent Object Anti-Pattern in React Renders

**When to suspect:** React crashes with `Cannot read properties of null/undefined (reading 'X')` during `.map()` or conditional render. The stack trace points to a property access like `.toFixed()`, `.join()`, or `.valid`, but the REAL problem is that the PARENT object is null.

**Symptom from this session:**
```
Uncaught TypeError: Cannot read properties of null (reading 'toFixed')
    at index-DJadwiRo.js:2144:8064
    at Array.map
```
The `.toFixed()` was on `anfe.verification.uptime`. But `anfe.verification` itself was `null` because the graph query failed when all Base RPC endpoints returned 403. The `?? 0` guard (`((anfe.verification.uptime ?? 0) * 100).toFixed(1)`) NEVER EXECUTED because `null.uptime` throws before `??`.

**Fix pattern — guard the parent:**
```tsx
// BEFORE (crash when verification is null)
{anfe.verification.uptime !== undefined && anfe.verification.uptime !== null && (
  <span>{((anfe.verification.uptime ?? 0) * 100).toFixed(1)}%</span>
)}

// AFTER (safe — checks parent exists first)
{anfe.verification && anfe.verification.uptime !== undefined && ...}
// Or: {anfe.verification?.uptime !== undefined ? ... : null}
```

**Same pattern for arrays:**
```tsx
// BEFORE (crash when activities is undefined)
{area.activities.join(", ")}

// AFTER (safe)
{area.activities?.join(", ") || ""}
// Or: {(area.activities || []).join(", ")}
```

**Same pattern for format helpers:**
```typescript
// BEFORE (crash when attrs.ai is null)
export function getAIModuleNames(attrs: ANFEAttributes): string[] {
  return attrs.ai.aiModules.map(m => ...);
}

// AFTER (safe)
export function getAIModuleNames(attrs: ANFEAttributes): string[] {
  if (!attrs?.ai?.aiModules) return [];
  return attrs.ai.aiModules.map(m => ...);
}
```

**Why this happens:** API endpoints (especially graph queries that depend on RPC calls) return partial objects when downstream dependencies fail. The backend doesn't throw — it returns `{ verification: null }` or omits the field. The UI must handle this.

**Diagnostic grep:**
```bash
cd src/
# Find all property access without parent guard in conditional renders
grep -rn 'verification\.' --include="*.tsx" | grep -v '?\.' | grep -v '&&'
# Find all .join() on potentially undefined arrays
grep -rn '\.join(' --include="*.tsx" | grep -v '?\.'
# Find all format helpers accessing nested properties
grep -rn 'function format' --include="*.ts" | grep -v test
```

**See:** `references/null-parent-object-react-crash-shared-rpc-limiter-2026-06-25.md` for the full session details, SharedRPCLimiter architecture, and scan deduplication pattern.

---

## Tool-Chain Recursion Cascade When RPCs Fail

**Symptom:** Ada stops answering; console floods with `base.publicnode.com` 429/403, then `[processAIResponse] Tool-chain limit reached (107 tool results)`. The agent appears frozen because the chat loop is busy processing repeated tool outputs.

**Root cause:** `AssetDiscovery` retries public RPCs for many contracts. Each failed scan can produce a tool output that the chat loop tries to handle, recursing through `processAIResponse`. The old 6-result hard cap is too high when failures generate tool results rapidly.

**Fix pattern — two layers:**
1. **Chat loop guard:** lower the tool-result cap and add an explicit chain depth counter.
2. **Asset discovery guard:** deduplicate concurrent scans and abort early when all RPC endpoints are circuit-broken.

### Chat loop hardening (`src/components/Chatview.tsx`)

```typescript
const processAIResponse = async (
  currentSession: ChatSession,
  currentMessages: ChatMessage[],
  depth: number = 0,
  chainDepth: number = 0,
) => {
  const toolResultCount = currentMessages.filter(
    (m) => m.role === "user" && m.content.startsWith("[Tool Output for")
  ).length;

  if (toolResultCount >= 4 || chainDepth >= 3) {
    console.warn(
      `[processAIResponse] Tool-chain limit reached (${toolResultCount} tool results, chainDepth=${chainDepth}). Stopping loop to force synthesis.`
    );
    const stopMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: "I’ve reached the tool-chain safety limit to prevent runaway loops. I’ll summarize what I know so far, or you can ask a more specific follow-up question.",
      timestamp: Date.now(),
      agentId: selectedAgent!.id,
    };
    // persist stopMsg and setIsGenerating(false)
    return;
  }
  // ... rest of handler
};
```

Pass `chainDepth + 1` on recursive tool-chain calls:

```typescript
await processAIResponse(nextSession, aiMessages, depth + 1, chainDepth + 1);
```

### Asset discovery hardening (`src/services/StargatePool/HyperCycleAssetDiscovery.ts`)

```typescript
function allEndpointsTripped(chain: AssetChain): boolean {
  return RPC_URLS[chain].every(url => isEndpointTripped(url));
}

class HyperCycleAssetDiscovery {
  private scanLocks: Map<string, Promise<WalletAssets>> = new Map();

  async discover(address: string, chain: AssetChain): Promise<WalletAssets> {
    const key = `${address.toLowerCase()}:${chain}`;
    const existing = this.scanLocks.get(key);
    if (existing) return existing;

    const promise = this._doDiscover(address, chain, key);
    this.scanLocks.set(key, promise);
    promise.finally(() => this.scanLocks.delete(key));
    return promise;
  }

  private async _doDiscover(address: string, chain: AssetChain, key: string): Promise<WalletAssets> {
    // ... cache check
    for (const contract of contracts) {
      if (allEndpointsTripped(chain)) {
        console.warn(`[AssetDiscovery] All ${chain} RPC endpoints tripped — aborting scan early.`);
        break;
      }
      // ... scan contract
    }
  }
}
```

**Prevention:**
- Treat heavy wallet scans as a potential recursion trigger, not just a network call.
- Deduplicate concurrent scans and fail fast once all endpoints are tripped.
- Always surface recursion limits as user-visible messages; silent guards make the agent look frozen.

---

## 8-Phase Structured Debugging Methodology

**Context:** This user requires the 8-phase debugging protocol for ALL debugging, integration, and troubleshooting tasks. Never substitute with default 4-phase summaries.

**The 8 Phases:**
1. **Understand** — Read code, logs, configs; identify the error message and affected components
2. **Hypothesize** — Generate possible root causes based on evidence
3. **Isolate** — Narrow down which code path, config, or component is responsible
4. **Verify** — Add diagnostics, reproduce the issue, confirm the hypothesis
5. **Apply Minimal Fix** — Make the smallest possible change that addresses the root cause
6. **Test** — Verify the fix works; check for regressions
7. **Prevent** — Document the fix; add safeguards against recurrence
8. **Detective Mode** — Review what was learned; update skills/memories

**Application Pattern:**
- Always start with `kanban_show()` when in kanban context
- Evidence-based diagnosis: verify root cause before applying changes
- Systematic thoroughness over speed
- Update skills with lessons learned

**See:** `references/eight-phase-debugging-methodology.md` for full methodology details and examples.

**Symptom:** MCP server connects (`[MCP] Connected: midnight-wallet`) but tool calls fail with `TimeoutError: signal timed out`. First call with npx takes 30-60s to download package.

**Fix Pattern:** Extend timeout to 120s, add Promise.race wrapper, improve path resolution with `__dirname`.

**See:** `references/mcp-server-timeout-troubleshooting.md`

---

## Related Issue: Kanban Button Opens Dead Port 9119 (Legacy)

**Symptom:** Clicking "Open Hermes Kanban" in the Hermes AIM panel opens `http://127.0.0.1:9119` which returns `ERR_CONNECTION_REFUSED` or "This site can't be reached".

**Root Cause (v1 — 2026-05-29):** `hermes dashboard` was not running on port 9119.

**Root Cause (v2 — 2026-05-30):** Port 9119 is **legacy/dead**. The codebase had **4 hardcoded references** to 9119, but nothing ever listened on it. The actual live AIM (with kanban toolset) runs on the discovery port (default 9000). The `openHermesKanban()` function in `HermesAimPanel.tsx` also called `eapi?.hermes?.startDashboard` — but **there is no `hermes` key** in `electronAPI`, so it silently fell through to the dead 9119 URL every time.

**Verification:**
```bash
# Check if ANYTHING listens on 9119
ss -tlnp | grep 9119
lsof -i :9119
# Expected: EMPTY (no listener)

# Check if AIM is alive on its actual port
curl -s http://localhost:9000/health
# Expected: {"status":"ok","toolsets":["...","kanban","..."]}
```

**Fix:** Replace all hardcoded 9119 references with the live AIM URL.

Files to patch:
- `src/components/HermesAimPanel.tsx` — `openHermesKanban()` should open `connectUrl || http://localhost:${discoveryPort}`
- `src/services/stargate/AimifierService.ts` — log line `Kanban: http://127.0.0.1:9119` → `http://localhost:${discoveryPort}/kanban`
- `electron/main.ts` — `hermes:start-dashboard` default port `9119` → `9000`
- `electron/main.ts` — `hermes:dashboard-status` probe `127.0.0.1:9119` → `127.0.0.1:9000`

**Prevention:**
1. Audit the codebase for dead ports after any network architecture change: `grep -rn "9119" src/ electron/ plugins/`
2. Verify that preload API keys actually exist before calling them in renderer code. `eapi?.hermes?.startDashboard` is a **phantom API** — it looks safe because of optional chaining but produces silent failure.
3. The `connectUrl` state in `HermesAimPanel` is the single source of truth for the live AIM URL. Any "open" button should consume it, not hardcode a URL.
4. **Do NOT append `/kanban` to the AIM base URL.** The AIM dashboard is served at `/` (root). The `/kanban` path returns HTTP 404 because there is no `@aim_uri(uri="/kanban", ...)` handler in `main.py`. See the "Phantom Subpath Trap" section below for full details.

---

## Dead Port Hardcoding Pattern

**When to suspect:** A button/link that used to work suddenly returns `ERR_CONNECTION_REFUSED` on a specific port, but the underlying service is healthy on a different port.

**Audit command:**
```bash
grep -rnE '127\.0\.0\.1:[0-9]+|localhost:[0-9]+' src/ electron/ plugins/ | grep -vE ':80|:443|:3000'
```

**Fix rule:** All ports in renderer code should come from:
- Component state (e.g. `discoveryPort`, `connectUrl`)
- Stored agent config (`agent.baseUrl`)
- Electron settings API (`nodes:get`)

Never hardcode a port number in a `window.open()`, `<a href>`, or `fetch()` call.

---

## Ghost Listener on Port 9000 (Stale Python Process vs AIM Container)

**Symptom:** `ss -tlnp | grep 9000` shows a listener but `docker ps` shows the AIM container with empty `Ports`. Container is in `host` network mode, yet `fuser 9000/tcp` returns a PID that belongs to a stale `python3 main.py` on the host — not the container.

**Root Cause:** A previous `python3 main.py` (e.g. from an old AIM development run or a detached process) is still bound to port 9000. The new AIM Docker container, even in `host` mode, cannot claim the port because it's already held by the host process.

**Verification:**
```bash
# 1. Find PID holding port 9000
sudo fuser 9000/tcp          # e.g. returns 304750

# 2. Check if PID is inside container or host
ps aux | grep <PID>            # shows "python3 main.py" on host, not inside container

# 3. Confirm container is in host network mode
docker inspect <container> --format '{{.HostConfig.NetworkMode}}'
# → "host"

# 4. Check container's /proc/net/tcp for the port
docker exec <container> sh -c "cat /proc/net/tcp | grep :2328"
# 0x2328 = 9000 decimal. If container sees the same inode, it's sharing the host namespace.
```

**Fix:**
```bash
# Kill the stale host process
sudo kill -9 <PID>
# Then restart the AIM container so it can bind 9000
docker restart hermes-embedded-slot0
```

**Prevention:** When restarting AIM containers, always verify the port is free on the host first. The `host` network mode means the container and host share the same port namespace — collisions are host-level, not container-level.

---

## Electron `openWindow` Pattern in HermesAimPanel

**File:** `src/components/HermesAimPanel.tsx` (~line 292)

```typescript
const openWindow = (url: string) => {
  const eapi = (window as any).electronAPI;
  if (eapi?.window?.openExternal) {
    eapi.window.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
```

**Pitfall:** If `eapi.window.openExternal` exists but throws (e.g. because `shell.openExternal` is not available in the preload), the URL silently fails to open. The fallback `window.open()` works in standard browsers but may be blocked by Electron CSP or sandbox policies.

**Fix:** Add a `try/catch` around the external call and always fallback:
```typescript
const openWindow = (url: string) => {
  try {
    const eapi = (window as any).electronAPI;
    if (eapi?.window?.openExternal) {
      eapi.window.openExternal(url);
      return;
    }
  } catch (e) {
    console.warn('openExternal failed, falling back:', e);
  }
  window.open(url, "_blank", "noopener,noreferrer");
};
```

**Prevention:** Audit all `window.open` or `shell.openExternal` calls in renderer components for missing error handling.