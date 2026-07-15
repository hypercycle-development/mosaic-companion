---
name: ollama-cloud-method-not-allowed-fix
description: "Fix 405 'Method Not Allowed' errors when using Ollama Cloud agents (Byron, Ada, Son of Anton) in Mosaic Companion. Root cause: Cloudflare 301 redirect converts POST to GET."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [ollama, ollama-cloud, 405-error, mosaic-companion, api, fix]
    related_skills: [mosaic-stargate-hermes-debug, ollama-cloud-integration]
---

# Ollama Cloud "Method Not Allowed" Fix

## Problem

Agents using `ollama-cloud` or `ollama` provider (Byron, Ada, Son of Anton) fail with:
```json
{"error":"Method Not Allowed"}
```

**Root Cause:**
```
POST https://api.ollama.com/v1/chat/completions
    ↓ 301 Redirect (Cloudflare)
GET https://ollama.com/v1/chat/completions  ← "Method not allowed"
```

Cloudflare converts `POST` → `GET` on redirect, breaking the API call.

## Solution

Change URL from `https://api.ollama.com` to `https://ollama.com` (direct endpoint).

## Files to Patch

### 1. `src/services/AIService.ts`

**Before:**
```typescript
// Line ~134: Safety rewrite that CAUSES the problem
if (finalBaseUrl.includes("ollama.com") && !finalBaseUrl.includes("api.ollama.com")) {
  finalBaseUrl = "https://api.ollama.com";  // ← This redirects!
}
```

**After:**
```typescript
// Use ollama.com directly - api.ollama.com 301 redirects and breaks POST
if (finalBaseUrl.includes("ollama.com") && !finalBaseUrl.includes("api.ollama.com")) {
  finalBaseUrl = "https://ollama.com";  // ← Direct endpoint, no redirect
}
```

### 2. `electron/integrations/mosaicbot/src/main/llm.ts`

**Before:**
```typescript
// Line ~270
const response = await fetch("https://api.ollama.com/v1/chat/completions", {...}
```

**After:**
```typescript
// Use ollama.com directly to avoid 301 redirect
const response = await fetch("https://ollama.com/v1/chat/completions", {...}
```

## Verification

```bash
# Direct API test:
curl -X POST https://ollama.com/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"minimax-m2.5","messages":[{"role":"user","content":"Hello"}]}'

# Expected: ✅ "Hello! How can I help you today?"
```

## Testing After Fix

1. Set agent to use `ollama-cloud` provider
2. Set base URL to `https://ollama.com` (not `https://api.ollama.com`)
3. Send a test message
4. Verify no "Method not allowed" error

## Affected Agents

| Agent | Provider | Model | Status |
|-------|----------|-------|--------|
| Byron | ollama-cloud | minimax-m2.5 | ✅ Fixed |
| Ada | ollama-cloud | minimax-m2.5 | ✅ Fixed |
| Son of Anton Commander | ollama-cloud | kimi-k2.6 | ✅ Fixed |
| MeShell | ollama | various | ✅ Fixed |

## Common Pitfalls

1. **Still using api.ollama.com** — The 301 redirect is the problem. Always use `https://ollama.com`.
2. **Wrong base URL in config** — Check `~/.config/mosaic-companion/ai-agents.json` has `"baseUrl": "https://ollama.com"`.
3. **Old code cached** — Full rebuild required: `npm run build` after patching.

## Related

- Cloudflare redirect behavior: POST → 301 → GET (spec violation but common)
- Ollama Cloud API docs: https://ollama.com/docs/api
