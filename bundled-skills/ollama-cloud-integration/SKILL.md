---
name: ollama-cloud-integration
title: Ollama Cloud Integration
description: Complete guide for integrating Ollama Cloud APIs into Mosaic-Companion, including routing fixes, authentication, and common pitfalls.
trigger: ollama cloud, 405 error, api.ollama.com, unauthorized, agent not responding
version: 1.0
---

# Ollama Cloud Integration

## Overview
Guide for integrating Ollama Cloud APIs into Mosaic-Companion, including routing fixes, authentication, and common pitfalls discovered during the epic 2026-06-19 debugging session.

## Critical Configuration

### Correct Endpoint
- **Use**: `https://ollama.com/v1/chat/completions`
- **NOT**: `https://api.ollama.com` (returns 301 redirect)

The redirect from `api.ollama.com` → `ollama.com` converts POST to GET, causing 405 Method Not Allowed errors.

### Code Locations to Patch in Mosaic Companion

When fixing this issue in Mosaic Companion, update these two files:

1. **`src/services/AIService.ts`** (line ~134)
   ```typescript
   // CRITICAL FIX: Use ollama.com directly, NOT api.ollama.com (which 301 redirects)
   url = 'https://ollama.com/v1/chat/completions';
   ```

2. **`electron/integrations/mosaicbot/src/main/llm.ts`** (line ~270)
   ```typescript
   // CRITICAL FIX: Use ollama.com directly, NOT api.ollama.com (which 301 redirects)
   const res = await fetch("https://ollama.com/v1/chat/completions", ...)
   ```

> ⚠️ **Note**: The code may have a "safety check" that rewrites `ollama.com` → `api.ollama.com`. Remove or bypass this check—it causes the 405 error.

### API Key Format
Ollama Cloud uses Bearer token authentication:
```
Authorization: Bearer <api_key>
```

API keys can be generated at: https://ollama.com/settings/api-keys

## Common Errors and Solutions

### 405 Method Not Allowed
There are **two** distinct causes for a 405 from Ollama Cloud.

#### Cause A: Redirect from `api.ollama.com`
Using `https://api.ollama.com` returns a 301 redirect that many HTTP clients convert to a GET, producing a 405.

**Fix**: Use `https://ollama.com/v1/chat/completions` directly.

```typescript
// WRONG
const url = "https://api.ollama.com/v1/chat/completions";

// CORRECT
const url = "https://ollama.com/v1/chat/completions";
```

#### Cause B: Missing or empty API key
Ollama Cloud requires a valid `Authorization: Bearer <key>` header. If the request is sent with a missing/empty key, Cloudflare may reject it as an invalid request and return **405 Method Not Allowed** (instead of 401). This commonly happens in agent-selection UIs where the agent config object is present but `apiKey` is blank.

**Fix**: Validate the API key **before** calling fetch and throw a clear, user-facing error.

```typescript
if (provider === "ollama-cloud" && !apiKey) {
  throw new Error(
    `Ollama Cloud API key is missing for agent "${agentName}". Add a key at https://ollama.com/settings/api-keys and paste it into the agent settings.`
  );
}
```
## References
- `references/stargate-405-missing-key.md` — Reproduction case from Stargate Dashboard (2026-06-19)
- `references/405-method-not-allowed-debug-2025-07-02.md` — Full debug session log with curl tests and code locations (2025-07-02)

### 401 Unauthorized
**Cause**: Invalid or expired API key.

**Fix**: Generate new API key from https://ollama.com/settings/api-keys

### Agent "Thinking" But Not Responding
**Cause**: When using XHR (non-streaming), callbacks.onComplete() is never called.

**Fix**: Manually invoke callbacks when not using streaming:
```typescript
if (callbacks) {
  callbacks.onToken(content);
  callbacks.onComplete(content);
}
```

## Implementation Pattern

### XHR Implementation (Recommended for Ollama Cloud)
```typescript
const response = await new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
  
  xhr.onload = () => {
    resolve({
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      json: () => Promise.resolve(JSON.parse(xhr.responseText)),
    });
  };
  
  xhr.onerror = () => reject(new Error('XHR request failed'));
  xhr.send(body);
});

const data = await response.json();
const content = data.choices[0].message.content;

// CRITICAL: Call callbacks for non-streaming response
if (callbacks) {
  callbacks.onToken(content);
  callbacks.onComplete(content);
}
```

## Debugging Checklist

1. ✅ Verify URL is `https://ollama.com/v1/chat/completions`
2. ✅ Check API key is valid (test with curl)
3. ✅ Ensure callbacks are called even for non-streaming responses
4. ✅ Add debug logging at each step:
   - Before request
   - Response received
   - JSON parsed
   - Callbacks invoked
5. ✅ Check browser Network tab for actual request/response

## Testing with curl
```bash
curl -X POST https://ollama.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"claude-sonnet-4-5-20250929","messages":[{"role":"user","content":"Hello"}]}'
```

## Models Available on Ollama Cloud
- `claude-sonnet-4-5-20250929`
- `kimi-k2.5`
- `minimax-m2.5`
- `gpt-oss:20b`

## Integration with Mosaic-Companion

### Provider Configuration
```typescript
{
  provider: "ollama-cloud",
  baseUrl: "https://ollama.com",  // NOT api.ollama.com
  apiKey: "YOUR_API_KEY",
  model: "claude-sonnet-4-5-20250929"
}
```

### Migration from Other Providers
When migrating agents from OpenAI or other providers:
1. Change provider to "ollama-cloud"
2. Update baseUrl to "https://ollama.com"
3. Replace API key with Ollama Cloud key
4. Update model to Ollama Cloud supported model
