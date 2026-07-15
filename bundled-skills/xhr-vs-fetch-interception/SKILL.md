---
name: xhr-vs-fetch-interception
title: XHR vs Fetch Interception Patterns
description: When to use XMLHttpRequest vs fetch() to bypass request interception, and how to diagnose external fetch wrappers.
trigger: fetch interception, url mutation, external wrapper, request rewrite, 301 redirect, XHR bypass
version: 1.0
---

# XHR vs Fetch Interception Patterns

## Overview
When fetch() requests are being intercepted and modified by external code (browser extensions, Electron webRequest handlers, CDN importmaps), switching to XMLHttpRequest (XHR) can bypass the interception.

## The Problem

### Symptoms
- URL changes between JavaScript code and actual network request
- POST becomes GET
- Domain changes (e.g., `api.ollama.com` → `ollama.com`)
- Impossible discrepancies in console logs

### Example from Mosaic-Companion
```
[AIService.WRAPPED_FETCH] Original URL: https://api.ollama.com/v1/chat/completions
[AIService.WRAPPED_FETCH] Init method: POST
GET https://ollama.com/v1/chat/completions 405 (Method Not Allowed)
[AIService.WRAPPED_FETCH] Response URL: https://ollama.com/v1/chat/completions
```

**The JavaScript sent `https://api.ollama.com` but the request went to `https://ollama.com`**

## Root Cause Analysis

### Possible Interceptors
1. **Browser extensions** - Can wrap global fetch()
2. **Electron webRequest API** - Can redirect/modify requests
3. **CDN importmaps** - May inject fetch wrappers
4. **Service workers** - Can intercept and rewrite requests
5. **Proxy/VPN** - Can rewrite at network level

### Detection Method
Wrap fetch() to capture before/after:
```typescript
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('[FETCH WRAP] Original:', args[0]);
  const response = await originalFetch.apply(window, args);
  console.log('[FETCH WRAP] Response URL:', response.url);
  return response;
};
```

## The Solution: XHR Bypass

### Why XHR Works
- XHR is less commonly wrapped than fetch()
- Harder to globally intercept
- Lower-level API

### XHR Implementation Pattern
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
      text: () => Promise.resolve(xhr.responseText),
    });
  };
  
  xhr.onerror = () => reject(new Error('XHR request failed'));
  xhr.send(body);
});
```

## When to Use XHR vs Fetch

### Use XHR When:
- ✅ Requests are being mysteriously modified
- ✅ URL changes between code and network tab
- ✅ Method changes (POST → GET)
- ✅ Debugging external interception
- ✅ Need guaranteed request integrity

### Use Fetch When:
- ✅ Streaming responses needed
- ✅ Modern APIs (ReadableStream)
- ✅ No interception issues
- ✅ Simple request/response

## Important: Streaming Callbacks with XHR

**CRITICAL**: XHR doesn't support streaming. If your UI expects streaming callbacks, manually invoke them:

```typescript
const data = await response.json();
const content = data.choices[0].message.content;

// MUST call callbacks for non-streaming XHR
if (callbacks) {
  callbacks.onToken(content);  // Send full content as "token"
  callbacks.onComplete(content);  // Signal completion
}
```

Without this, the UI will show "thinking" but never display the response.

## Debugging Checklist

1. **Wrap fetch()** - Log original URL vs response URL
2. **Check for discrepancies** - If they differ, interception is happening
3. **Try XHR** - Implement XHR version
4. **Verify callbacks** - Ensure streaming callbacks are called
5. **Remove external scripts** - Check for CDN imports that might wrap fetch()

## Testing

### Test for Interception
```javascript
// In browser console
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  console.log('Fetch called with:', args[0]);
  return originalFetch.apply(window, args);
};
```

### Verify XHR Works
```javascript
// In browser console
const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://httpbin.org/get', true);
xhr.onload = () => console.log('XHR Response:', xhr.responseText);
xhr.send();
```

## Related Skills
- ollama-cloud-integration
- api-debugging-methodology
