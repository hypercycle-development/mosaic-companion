---
name: electron-async-app-ready
version: 1.0.0
description: Properly handle async initialization in Electron's app.whenReady(). Covers the critical pattern of making the callback async to support dynamic imports and async operations during startup.
author: Hermes Agent
---

# Electron Async App Ready Pattern

## The Problem

**Error:** `TS1308: 'await' expressions are only allowed within async functions`

```typescript
// ❌ WRONG - This causes TypeScript error
app.whenReady().then(() => {
  const { module } = await import("./module");  // Error!
});
```

**Error Message:**
```
electron/main.ts(421,41): error TS1308: 'await' expressions are only allowed within async functions and at the top levels of modules.

Did you mean to mark this function as 'async'?
```

## The Solution

**Pattern:** Make the arrow function `async`:

```typescript
// ✅ CORRECT
app.whenReady().then(async () => {
  const { module } = await import("./module");  // Works!
});
```

## Why This Matters

Electron's `app.whenReady()` returns a Promise. The `.then()` callback can be async, allowing:
- Dynamic imports (`await import()`)
- Async initialization of modules
- Proper error handling with try/catch
- Sequential startup of dependent services

## Common Use Cases

### 1. Dynamic Module Import
```typescript
app.whenReady().then(async () => {
  // Import initialization modules dynamically
  const { initializeVault } = await import("./integrations/vault");
  const { initializePlugins } = await import("./integrations/plugins");
  
  await initializeVault();
  await initializePlugins();
});
```

### 2. Sequential Service Initialization
```typescript
app.whenReady().then(async () => {
  // Services must start in order
  const db = await initializeDatabase();
  const cache = await initializeCache(db);
  const api = await initializeAPI(cache);
  
  console.log("[App] All services initialized");
});
```

### 3. Parallel Initialization with Error Handling
```typescript
app.whenReady().then(async () => {
  try {
    // Start independent services in parallel
    const [vault, plugins, tools] = await Promise.all([
      import("./integrations/vault").then(m => m.initialize()),
      import("./integrations/plugins").then(m => m.init()),
      import("./integrations/tools").then(m => m.initialize()),
    ]);
    
    console.log("[App] Parallel init complete");
  } catch (e) {
    console.error("[App] Initialization failed:", e);
  }
});
```

## User Quote to Remember

> "im getting this error while trying to open thru npm run start"
> 
> "electron/main.ts(421,41) - error TS1308: 'await' expressions are only allowed within async functions"

**Lesson:** When adding async operations to `app.whenReady()`, always use `.then(async () => { ... })` not `.then(() => { ... })`.

## Related Skills

- `mosaic-vault-box-integration` — Uses this pattern for vault initialization