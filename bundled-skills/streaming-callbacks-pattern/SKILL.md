---
name: streaming-callbacks-pattern
title: Streaming Callbacks Pattern for AI Agents
description: How to properly implement streaming and non-streaming response handling for AI chat interfaces.
trigger: agent not responding, onComplete not called, streaming callbacks, thinking but no response, chat not displaying
version: 1.0
---

# Streaming Callbacks Pattern for AI Agents

## Overview
When building AI chat interfaces, streaming responses provide better UX but require careful callback management. This skill covers both streaming and non-streaming patterns.

## The Problem: Agent "Thinking" But Not Responding

### Symptoms
- Agent shows "thinking" indicator indefinitely
- Network tab shows 200 OK response
- Console shows response received
- But message never appears in chat

### Root Cause
The `onComplete` callback is never called because:
1. Streaming was expected but response.body is null
2. Non-streaming response returned but callbacks weren't invoked
3. Response parsing failed silently

## Response Handling Patterns

### Pattern 1: Streaming with fetch()
```typescript
const response = await fetch(url, {
  method: 'POST',
  body: JSON.stringify({ stream: true, ... })
});

if (callbacks && response.body) {
  // Stream the response
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = new TextDecoder().decode(value);
    callbacks.onToken(chunk);
  }
  callbacks.onComplete(fullResponse);
}
```

### Pattern 2: Non-Streaming with fetch()
```typescript
const response = await fetch(url, {
  method: 'POST',
  body: JSON.stringify({ stream: false, ... })
});

const data = await response.json();
const content = data.choices[0].message.content;

// CRITICAL: Must call callbacks even for non-streaming!
if (callbacks) {
  callbacks.onToken(content);  // Optional: send as single "token"
  callbacks.onComplete(content);  // REQUIRED: signal completion
}
```

### Pattern 3: XHR (No Streaming Support)
```typescript
const response = await new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.onload = () => {
    resolve({
      json: () => Promise.resolve(JSON.parse(xhr.responseText))
    });
  };
  xhr.send(body);
});

const data = await response.json();
const content = data.choices[0].message.content;

// XHR doesn't support streaming - MUST call callbacks manually
if (callbacks) {
  callbacks.onToken(content);  // Simulate streaming
  callbacks.onComplete(content);  // REQUIRED!
}
```

## Critical Implementation Details

### Always Call onComplete
**The onComplete callback MUST be called** for the UI to update:
```typescript
// WRONG - UI will hang
return data.choices[0].message.content;

// CORRECT - UI updates
const content = data.choices[0].message.content;
if (callbacks) {
  callbacks.onComplete(content);
}
return content;
```

### Handle Both Streaming and Non-Streaming
```typescript
if (callbacks && response.body) {
  // Streaming path
  return this.handleStream(response.body, callbacks, provider);
} else {
  // Non-streaming path - MUST call callbacks
  const content = await parseResponse(response);
  if (callbacks) {
    callbacks.onToken(content);
    callbacks.onComplete(content);
  }
  return content;
}
```

## Error Handling

### Wrap Everything in Try-Catch
```typescript
try {
  const response = await makeRequest();
  const content = await parseResponse(response);
  
  if (callbacks) {
    callbacks.onComplete(content);
  }
  
  return content;
} catch (error) {
  if (callbacks) {
    callbacks.onError(error);
  }
  throw error;
}
```

### Always Call onError on Failure
```typescript
catch (error) {
  console.error('[AIService] Request failed:', error);
  if (callbacks?.onError) {
    callbacks.onError(error);
  }
  throw error;
}
```

## Debugging Streaming Issues

### Add Logging at Each Step
```typescript
console.log('[AIService] Request starting...');
const response = await fetch(url, options);
console.log('[AIService] Response received:', response.status);

const data = await response.json();
console.log('[AIService] JSON parsed:', data);

const content = data.choices[0]?.message?.content;
console.log('[AIService] Content extracted:', content?.substring(0, 100));

if (callbacks) {
  console.log('[AIService] Calling callbacks...');
  callbacks.onToken(content);
  callbacks.onComplete(content);
  console.log('[AIService] Callbacks completed');
}
```

### Check Callback Registration
```typescript
// In the calling code (e.g., ChatView)
await AIService.sendMessage(config, messages, {
  onToken: (token) => {
    console.log('[ChatView] onToken called:', token?.substring(0, 50));
    setStreamingContent(prev => prev + token);
  },
  onComplete: (response) => {
    console.log('[ChatView] onComplete called:', response?.substring(0, 100));
    // Update UI with final response
  },
  onError: (error) => {
    console.error('[ChatView] onError called:', error);
    // Show error to user
  }
});
```

## Testing Pattern

### Unit Test for Callbacks
```typescript
const mockCallbacks = {
  onToken: jest.fn(),
  onComplete: jest.fn(),
  onError: jest.fn()
};

await AIService.sendMessage(config, messages, mockCallbacks);

expect(mockCallbacks.onComplete).toHaveBeenCalled();
expect(mockCallbacks.onComplete.mock.calls[0][0]).toContain('expected response');
```

## Common Pitfalls

### ❌ Forgetting Callbacks for Non-Streaming
```typescript
// WRONG - UI hangs forever
if (callbacks && response.body) {
  return handleStream(response.body, callbacks);
}
return response.json(); // callbacks never called!
```

### ✅ Always Call Callbacks
```typescript
// CORRECT
if (callbacks && response.body) {
  return handleStream(response.body, callbacks);
}

const content = await parseResponse(response);
if (callbacks) {
  callbacks.onToken(content);
  callbacks.onComplete(content);
}
return content;
```

### ❌ Checking response.body After XHR
```typescript
// WRONG - XHR response has no body property
if (callbacks && response.body) {
  // This will never execute for XHR!
}
```

### ✅ Handle XHR Separately
```typescript
// CORRECT - XHR returns different structure
if (usingXHR) {
  const content = await parseXHRResponse(response);
  if (callbacks) {
    callbacks.onComplete(content);
  }
  return content;
}
```

## Related Skills
- ollama-cloud-integration
- xhr-vs-fetch-interception
