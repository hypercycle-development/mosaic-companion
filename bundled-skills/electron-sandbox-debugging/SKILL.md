---
name: electron-sandbox-debugging
description: Patterns for debugging Electron sandbox rendering issues, IPC bridges, child-process lifecycle, and port readiness in renderer-main communication.
title: Electron Sandbox & IPC Debugging
triggers:
  - Debugging blank windows or external-link failures in Electron desktop apps
  - Renderer clicks produce white/empty popups instead of opening URLs
  - Child process spawned from Electron main process dies when parent exits
  - Need to expose main-process APIs securely to sandboxed renderer
  - IPC handler returns before spawned server is actually listening
---

# Electron Sandbox & IPC Debugging

## 1. The `window.open` noopener trap

**Symptom:** `window.open(url, '_blank', 'noopener,noreferrer')` opens an `about:blank` popup and never navigates.

**Root cause:** In a sandboxed renderer, `noopener` severs the opener reference. The popup loses its navigation channel and stays blank.

**Fix:** Route external links through the main process.

```ts
// renderer (e.g., React component)
const openWindow = (url: string) => {
  const eapi = (window as any).electronAPI;
  if (eapi?.window?.openExternal) {
    eapi.window.openExternal(url);        // ✅ opens in system browser
  } else {
    window.open(url, "_blank");           // fallback without noopener
  }
};
```

Corresponding `preload.ts` exposure:
```ts
contextBridge.exposeInMainWorld("electronAPI", {
  window: {
    openExternal: (url: string) => ipcRenderer.send("open-external", url),
  },
});
```

Corresponding `main.ts` handler:
```ts
ipcMain.on("open-external", (event, url) => {
  // Security filter: drop localhost:* and file://, allow 127.0.0.1:*
  if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
    shell.openExternal(url);
  }
});
```

> **Pitfall:** `http://127.0.0.1:9119` passes the filter above; `http://localhost:9119` is silently dropped. Always use `127.0.0.1` in renderer URLs when relying on `open-external`.

---

## 2. Spawning long-lived child processes from the main process

**Symptom:** Dashboard/server process starts but dies when Electron restarts or closes.

**Fix:** Spawn detached with ignored stdio so the child outlives the parent.

```ts
const child = spawn(command, args, {
  detached: true,
  stdio: "ignore",
  env: { ...process.env, PORT: String(port) },
});
child.unref();
```

---

## 3. HTTP readiness probe before returning to renderer

**Symptom:** Renderer opens URL immediately after IPC call but gets connection refused because the server hasn't bound yet.

**Fix:** In the `ipcMain.handle` handler, poll the HTTP port before resolving.

```ts
ipcMain.handle("service:start", async (_event, port: number) => {
  const child = spawn('my-server', ['--port', String(port)], { detached: true, stdio: 'ignore' });
  child.unref();

  // Poll up to N seconds for HTTP 200
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.status === 200) return { status: 'ready' };
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  return { status: 'started-but-not-ready' };
});
```

> **Pitfall:** Returning `'started'` immediately after `spawn()` is almost always wrong for user-facing URLs. Wait for the bind.

---

## 4. Preload contextBridge patterns

Never expose raw `ipcRenderer` methods. Wrap every channel in a typed API object.

```ts
contextBridge.exposeInMainWorld("electronAPI", {
  hermes: {
    startDashboard: (port?: number) => ipcRenderer.invoke("hermes:start-dashboard", port),
    stopDashboard:  () => ipcRenderer.invoke("hermes:stop-dashboard"),
    dashboardStatus: () => ipcRenderer.invoke("hermes:dashboard-status"),
  },
});
```

---

## 5. Renderer-Safe File Loading: The 5-Layer IPC Bridge

**Symptom:** A service in `src/services/` loads files using `fs`/`path`/`os`. It works in development (Electron main process can run it) but crashes in production when imported by renderer components because Vite replaces Node.js modules with browser externals.

**The 5-layer bridge:**

```
┌─────────────────────────────────────────────┐
│  LAYER 1: Renderer component               │
│  src/services/AIService.ts                  │
│  Calls: window.electronAPI.skills.build...   │
└─────────────────────┬───────────────────────┘
                      │ IPC invoke
┌─────────────────────▼───────────────────────┐
│  LAYER 2: Preload script                    │
│  electron/preload.ts                        │
│  Exposes: ipcRenderer.invoke(channel, ...)  │
└─────────────────────┬───────────────────────┘
                      │ IPC
┌─────────────────────▼───────────────────────┐
│  LAYER 3: Main process handler                │
│  electron/main.ts                             │
│  ipcMain.handle(channel, ...)                 │
└─────────────────────┬───────────────────────┘
                      │ direct import
┌─────────────────────▼───────────────────────┐
│  LAYER 4: Service with real Node.js fs        │
│  src/services/skillInjector.ts                │
│  Imported by main.ts (esbuild, not Vite)      │
└─────────────────────┬───────────────────────┘
                      │ fs.readFileSync
┌─────────────────────▼───────────────────────┐
│  LAYER 5: File system                         │
│  ~/.hermes/skills/                              │
│  ~/.config/mosaic-companion/vault.json          │
└─────────────────────────────────────────────┘
```

### 5a. The preload contract

Never expose raw `ipcRenderer`. Wrap every channel:

```ts
// electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
  skills: {
    buildSystemPrompt: (payload: any) =>
      ipcRenderer.invoke("skill:buildSystemPrompt", payload),
  },
});
```

### 5b. The main handler

```ts
// electron/main.ts
import { skillInjector } from "../src/services/skillInjector";

ipcMain.handle("skill:buildSystemPrompt", async (_event, payload) => {
  const result = skillInjector.buildSystemPrompt(
    payload.baseSystemPrompt,
    payload.skillNames
  );
  return {
    systemPrompt: result.systemPrompt,
    loadedSkills: result.loadedSkills,
    failedSkills: result.failedSkills,
    totalTokens: result.totalTokens,
  };
});
```

> **Key:** `main.ts` imports `skillInjector` from `../src/services/skillInjector`. This works because esbuild (used for the main bundle) preserves Node.js externals. Vite (used for the renderer bundle) would break the same import.

### 5c. The renderer call site

```ts
// src/services/AIService.ts
const ipcResult = await (window as any).electronAPI?.skills?.buildSystemPrompt({
  baseSystemPrompt: "",
  skillNames: config.skills,
});
if (ipcResult?.systemPrompt) {
  messages.unshift({ role: "system", content: ipcResult.systemPrompt });
}
```

### 5d. Build verification

```bash
# 1. Main bundle has real fs-based skill loader
grep -c "_loadVaultSkill" dist/main/main.js

# 2. Renderer bundle has IPC call, no fs stubs
grep -c "electron.*skills.*buildSystemPrompt" dist/renderer/assets/index-*.js
grep -c "__vite-browser-external" dist/renderer/assets/index-*.js  # expect >0 (OK for renderer)

# 3. Preload exposes the channel
grep -c "buildSystemPrompt.*ipcRenderer" dist/main/preload.js

# 4. Typecheck clean
npx tsc --noEmit | grep -c "error TS" || echo "0"
```

### 5e. Pitfalls

- **Don't import `src/services/X.ts` in renderer if X uses `fs`/`path`/`os`.** Even if the import is conditional, the module graph will include it and Vite will externalize the Node.js deps.
- **Don't use `require.resolve` in code that runs through esbuild/Vite.** It resolves at build time to an absolute path that may not exist in production. Use `path.join(os.homedir(), ...)` instead.
- **The `skills` namespace in preload must not collide with existing namespaces.** Check existing `toolSandbox`, `chronicle`, `sandbox`, `vault`, `mcp` namespaces before adding.

---

## References

- `references/mosaic-kanban-white-screen.md` — Full session chain: white window on "Open Hermes Kanban" button caused by (1) `hermes dashboard` not running on :9119, (2) `window.open` noopener trap in sandbox, (3) IPC handler returning before HTTP port bound. Includes fix diff summary and verification steps.
- `references/mosaic-skill-injection-arc.md` — Full session: Vault-as-Skills integration, `skillInjector.ts` renderer crash, `__vite-browser-external` discovery, 5-layer IPC bridge (`skill:buildSystemPrompt`), poll-based vault file watcher, case-insensitive vault box/entry matching, and build verification. (2026-05-26)

> **Related class-level skill:** `electron-ai-provider-integration` — covers Vite bundling quirks, PROVIDER_INFO stale bundles, Node.js module guards in the renderer, and default API key fallbacks for local AI servers.