# Stargate Dashboard: 405 + RPC Storm — Detective Notes

## Incident Summary
When talking to Ada or Byron inside **Stargate → Dashboard**, the agent responded with **“method not allowed”** and the console entered an endless loop of errors. Two separate failures were visible:

1. `ollama.com/v1/chat/completions` returned **405 (Method Not Allowed)**.
2. `base.publicnode.com` was hammered with **403/429** errors at high frequency.
3. CSP warning at `index.html:34` about blocked inline script.

## Root Causes

### 1. Ollama Cloud 405 in agent chat
There were actually **two layers** to this failure:

**Layer A — missing API key guard:** `AIService.sendToOpenAI` routes `ollama-cloud` to `https://ollama.com/v1/chat/completions`. That endpoint works **only with a valid Bearer API key**. When the agent config used by Ada/Byron had a missing/empty `apiKey`, Cloudflare/Ollama treated the request as invalid and returned **405 Method Not Allowed** instead of a useful auth error.

**Layer B — duplicated, stale LLM caller in the Dashboard:** Even after guarding `AIService`, the **Stargate Dashboard (KanbanDashboard)** did not use `AIService` at all. It hand-rolled a `fetch` to `${agent.baseUrl || PROVIDER_INFO[agent.provider]?.baseUrl}/v1/chat/completions`, which bypassed the URL fix, the auth guard, streaming, and all other logic that makes the main AI Chat work. So the Dashboard got 405 while main AI Chat worked fine for the same agent.

## Fixes Applied

| File | Change |
|------|--------|
| `src/services/AIService.ts` | For `ollama-cloud`, throw a clear error **before** the fetch if `actualApiKey` is missing. |
| `src/components/KanbanDashboard.tsx` | Replaced hand-rolled `fetch` for generic providers with `AIService.sendMessage(agent, [...])` so Stargate Dashboard uses the exact same LLM path as main AI Chat. Removed now-unused `PROVIDER_INFO` import. |
| `src/services/StargatePool/HyperCycleAssetDiscovery.ts` | Added per-endpoint circuit breaker (`rpcFailures` map). After 3 consecutive failures (fewer for 4xx), an RPC is skipped for 30 s. Failures/successes are logged. |
| `src/components/UnifiedAssetPanel.tsx` | Debounced auto-scan: waits 1 s after `walletAddress` changes and cancels the pending timer on re-render. |
| `index.html` | Already contained `'unsafe-inline'`. Rebuilt renderer so `dist/renderer/index.html` picks it up. |

## Verification
- `npx tsc --noEmit -p tsconfig.electron.json` ✅ (only pre-existing plugin `rootDir` errors).
- `npm run build:electron` ✅
- `npm run build:renderer` ✅
- `dist/renderer/index.html` now contains `script-src 'self' https://aistudiocdn.com 'unsafe-inline'`.
- Active Atomic Mail inbox remains `ruby-outreach@atomicmail.ai`.

## Remaining Work
- **End-to-end test**: restart Mosaic Companion, open Stargate → Dashboard, select Ada/Byron, and confirm the chat either works (with a valid Ollama API key) or surfaces the new clear error instead of looping 405s.
- If the 405 persists after adding a valid key, capture the exact request/response body and reopen this investigation.

## Affected Files
- `src/services/AIService.ts`
- `src/services/StargatePool/HyperCycleAssetDiscovery.ts`
- `src/components/UnifiedAssetPanel.tsx`
- `index.html`

Date: 2026-06-19
