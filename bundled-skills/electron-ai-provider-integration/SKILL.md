---
name: electron-ai-provider-integration
description: >-
  Integrate new AI model providers into an Electron+Vite desktop app like Mosaic Companion.
  Covers TypeScript provider definitions, Vite bundle rebuilds, renderer-side Node.js guards,
  default API key fallbacks, and auth patterns for local API servers.
title: Electron + Vite AI Provider Integration
triggers:
  - Adding a new AI provider to an Electron app with Vite bundling
  - PROVIDER_INFO changes not reflected in the built renderer bundle
  - Node.js fs/path/os imports crash when bundled into the renderer
  - AI chat sends empty API key causing 401 Unauthorized from local server
  - Need to add OpenAI-compatible endpoint routing with default auth
---

# Electron + Vite AI Provider Integration

## 1. Adding a new AI provider to PROVIDER_INFO

### Step 1: Update the runtime definitions

TypeScript declarations (`src/types/ai.ts`) are NOT enough if the bundler uses `.js` files.

```ts
// src/types/ai.ts
export type AIProvider =
  | "openai" | "claude" | "gemini" | "ollama" | "custom" | "hypercycle"
  | "hermes" | "hermes-aim" | "hermes-api";

export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  // ... existing entries ...
  hermes:     ["kimi-k2.6", "minimax", "custom"],
  "hermes-aim": ["kimi-k2.6", "minimax", "custom"],
  "hermes-api": ["hermes-agent"],
};

export const PROVIDER_INFO: Record<AIProvider, { name: string; color: string; baseUrl: string }> = {
  // ... existing entries ...
  hermes:     { name: "Hermes Agent",             color: "#7C3AED", baseUrl: "http://localhost:8642" },
  "hermes-aim": { name: "Hermes AIM (HyperCycle Node)", color: "#A78BFA", baseUrl: "http://127.0.0.1:9000" },
  "hermes-api": { name: "Hermes API Server",        color: "#00D4AA", baseUrl: "http://127.0.0.1:8642" },
};
```

### Step 2: Mirror the changes in the JS runtime file

When `tsconfig.json` has `allowJs: true` and the bundler resolves `.js` after `.ts`, the **`.js` file is the source of truth** at build time. Always mirror changes there.

```bash
# After modifying ai.ts, update ai.js
cp src/types/ai.ts src/types/ai.js   # then strip type annotations, or keep JS-compatible export
```

### Step 3: Rebuild renderer AND Electron

```bash
npm run build:renderer   # Vite rebundles → dist/renderer/assets/
npm run build:electron   # esbuild rebundles → dist/*.js
```

> **Pitfall:** Only running `build:electron` skips the Vite renderer bundle. If `index-*.js` in `dist/renderer/assets/` still has an old timestamp, the UI won't see the new provider.

### Step 4: Verify the bundle contents

```bash
grep -o 'name:"Hermes Agent"' dist/renderer/assets/index-*.js | wc -l
```

If zero, the rebuild didn't pick up the new file — check `.js` vs `.ts` resolution order.

---

## 2. Node.js module guards for renderer-safe code

Files imported by both main process (Node.js) and renderer (browser context) must tolerate `fs`/`path`/`os` being `undefined` after Vite externalization.

```ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const NODE_AVAILABLE = typeof (fs as any)?.existsSync === "function";

if (!NODE_AVAILABLE) {
  console.warn("[MyModule] Node.js fs unavailable — running in renderer.");
}

export function someFileOp(skillName: string): string | null {
  if (!NODE_AVAILABLE) return null;
  // safe to use fs, path, os from here on
  const home = os.homedir();
  // ...
}
```

> **Pitfall:** Checking only `typeof fs !== "undefined"` is not enough. Vite may inject a stub object that exists but has no real methods. Always probe a known method like `.existsSync`.

---

## 3. Defensive Record-lookup in React render paths

Any hard-coded `Record<K, V>` lookup using persisted data is a crash hazard. When stored values drift from the key set defined at compile time — stale enums, new schema versions, corrupted state — the lookup returns `undefined`, and accessing `.anyProp` throws `TypeError: Cannot read properties of undefined`.

### 3a. Provider lookup in agent cards

```tsx
// ❌ crashes if persisted provider is unknown
<span style={{ color: PROVIDER_INFO[agent.provider].color }} />

// ✅ graceful fallback
<span style={{ color: PROVIDER_INFO[agent.provider]?.color ?? "#6B7280" }} />
<span>{PROVIDER_INFO[agent.provider]?.name ?? "Unknown"}</span>
```

### 3b. Enum/record lookup in persisted domain objects

```tsx
// Vault box card rendering sourceType badge
const SOURCE_LABELS: Record<BoxSourceType, { label: string; color: string }> = {
  manual:    { label: "Manual", color: "text-gray-400" },
  import:    { label: "Import", color: "text-blue-400" },
  connector: { label: "Connector", color: "text-emerald-400" },
};

// ❌ crashes when box.sourceType ∉ {manual, import, connector}
<span className={SOURCE_LABELS[box.sourceType].color}>{SOURCE_LABELS[box.sourceType].label}</span>

// ✅ graceful fallback — preserves UI and logs no error
const sourceInfo = SOURCE_LABELS[box.sourceType] ?? { label: box.sourceType ?? "Unknown", color: "text-gray-500" };
<span className={sourceInfo.color}>{sourceInfo.label}</span>
```

### 3c. Audit rule

Search every `SomeRecord[expr].prop` pattern inside `src/components/**/*.tsx`. Replace ALL of them with:
- `SomeRecord[expr]?.prop ?? fallbackValue`  (for optional chaining)
- or `const info = SomeRecord[expr] ?? defaultValue; info.prop` (for destructured usage)

> **Pitfall:** A single `TypeError: Cannot read properties of undefined (reading 'color')` inside a `.map()` or conditional render silently unmounts the entire component subtree, leaving a blank white panel. The minified stack trace is useless because the property name is mangled in the bundle.

> **Pattern:** This failure mode is identical for `PROVIDER_INFO`, `SOURCE_LABELS`, `STATUS_STYLES`, `ROLE_COLORS`, or any `Record<>` used with data from `localStorage`, `userData/`, or IPC-driven state.

---

## 4. Default API key fallback for local servers

Local API servers (e.g., Hermes standalone, Ollama, Jan) often ship with a default shared key. When the user's agent config leaves `apiKey` empty, the provider method should inject the default.

```ts
// AIService.ts — inside sendToOpenAI or sendToHermes
const actualApiKey =
  config.provider === "hermes-api" && !config.apiKey?.trim()
    ? "mosaic-hermes-2025"
    : config.apiKey?.trim() || config.apiKey;

fetch(url, {
  headers: {
    "Content-Type": "application/json",
    ...(actualApiKey ? { Authorization: `Bearer ${actualApiKey}` } : {}),
  },
});
```

> **Pitfall:** Sending `Authorization: Bearer undefined` or `Bearer ` (empty) causes opaque 401s. Always handle the empty-string case explicitly.

---

## 5. Fixing corrupted persisted agent configs

Electron apps store agent state in `userData/ai-agents.json`. After provider changes, stale entries may have:
- Wrong `provider` value (e.g., agent ID instead of provider key)
- Wrong `baseUrl` (default dev port instead of production port)
- Missing `apiKey` where one is now required

```bash
# Inspect the file
cat ~/.config/<app>/ai-agents.json | jq '.[] | {id, provider, baseUrl}'
```

Fix inline or via the app’s Configuration UI. After fixing, **restart the app** — the renderer reads agents.at startup.

> **Pitfall:** If a persisted agent lists `provider: "ollama"` but its ID says `hermes`, the UI dropdown will show "ollama" even though the agent was meant to be Hermes. Update both `provider` and `baseUrl`.

---

## 6. Hermes API Server Integration — End-to-End Check

When integrating a local Hermes API server as an OpenAI-compatible provider, failures cascade through multiple layers. Use this checklist before blaming the Electron app.

### 6a. Verify the server independently

```bash
# 1. Health
curl http://127.0.0.1:8642/health
# Expected: {"status": "ok", "platform": "hermes-agent"}

# 2. Model listing
curl -H "Authorization: Bearer mosaic-hermes-2025" \
  http://127.0.0.1:8642/v1/models

# 3. Chat completions (non-streaming)
curl -X POST http://127.0.0.1:8642/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mosaic-hermes-2025" \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"ping"}],"stream":false}'
```

If any of these returns `500` / `502` / `Internal server error`, the problem is **server-side**, not Mosaic.

### 6b. Check for process lock conflicts on `state.db`

Hermes standalone API server spawns an `AIAgent` which opens `state.db`. If another Hermes process (gateway, chat, etc.) already holds WAL locks, the agent cannot start.

```bash
# See who holds the database files
lsof /home/<user>/.hermes/state.db /home/<user>/.hermes/kanban.db

# Kill conflicting processes (gateway, chat) — keep only the API server
kill <gateway-pid> <chat-pid>

# Wait for file locks to release, then retest curl
sleep 2 && curl ...
```

> **Symptom:** `{"error": {"message": "Internal server error: [Errno 32] Broken pipe"}}`  
> **Root cause:** SQLite disk I/O error inside `AIAgent.run_conversation()` (WAL mode conflict).

### 6c. Port, auth, and API key alignment

| Provider | Expected port | Auth header | Notes |
|----------|--------------|-------------|-------|
| `hermes` (Hermes Agent) | `8642` | `Bearer mosaic-hermes-2025` | Routes to `sendToHermes` |
| `hermes-aim` | `9000` | None | Direct `/chat` endpoint; simpler |
| `hermes-api` | `8642` | `Bearer mosaic-hermes-2025` | Routes to `sendToOpenAI` (OpenAI-compatible) |

> **Pitfall:** Using `localhost:3000` for `hermes` is the old CLI agent port. The standalone API server runs on port `8642` by default.

### 6d. Hidden API key — why 401 can persist even when `API_SERVER_KEY` looks empty

The server reads `self._api_key` from `extra.get("key")` (startup args) first, then `os.getenv("API_SERVER_KEY", "")`. If the server was launched by systemd, supervisor, or a background wrapper, its environment is frozen at fork time. The user's shell may show the variable as empty, but the running process still holds a key.

Quick check:
```bash
# Find the PID
ss -tlnp | grep 8642      # → PID 179208

# Inspect the *process* environment, not your shell
cat /proc/179208/environ | tr '\0' '\n' | grep API_SERVER_KEY
```

If this prints a value, that is the real key the server expects.

**Fix paths:**
1. Restart the server in your current shell (no `--key`, no env var) to make it truly open.
2. Copy the hidden key into Mosaic's API Key field for the Hermes provider.
3. If Mosaic spawned the server, search its code for the key injection point.

> See `references/hermes-empty-key-401-debug.md` for full reproduction steps and a decision flowchart.

### 6e. Streaming vs non-streaming

The standalone server handles both, but `!callbacks` in `AIService.sendToHermes` sends `stream: false`. Verify the non-streaming path works first (simpler, no SSE queue); then test streaming.

---

## 7. MosaicBot Hermes Provider Integration (Main-Process LLM)

When Hermes Agent is used as a provider inside Mosaic Companion's Electron main process (`MosaicBot`), three files must be updated to enable both the UI config and the LLM dispatch.

### 7a. Add provider to the main-process union

`electron/integrations/mosaicbot/src/main/llm.ts`:
- Extend `AgentConfig.provider` union to include `"hermes" | "hermes-aim" | "hermes-api"`
- Add `case "hermes"`, `case "hermes-aim"`, `case "hermes-api"` routing to `callHermes()`
- Remove any `console.warn("skipping")` or `return null` for Hermes providers

### 7b. Implement `callHermes()`

```typescript
async function callHermes(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const allMessages: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const baseUrl = (agent.baseUrl || "http://localhost:8642").trim();
  const apiKey = agent.apiKey?.trim() || "mosaic-hermes-2025";

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: agent.model || "default",
      messages: allMessages,
      max_tokens: agent.maxTokens ?? 4096,
      temperature: agent.temperature ?? 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Hermes ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}
```

### 7c. Add health check in `AIService.ts`

```typescript
// Inside testConnection()
case "hermes":
  const hermesUrl = `${agentConfig.baseUrl || "http://localhost:8642"}/health`;
  const res = await fetch(hermesUrl);
  if (!res.ok) throw new Error(`Hermes health check failed: ${res.status}`);
  const data = await res.json();
  return {
    status: "success",
    provider: "Hermes Agent",
    server: data,
  };
```

### 7d. Render Base URL field in settings UI

`src/components/AIAgentsSettings.tsx`:
- Add `"hermes"` to the list of providers that show the Base URL input
- Use `"Hermes Base URL"` as the label
- Use `http://127.0.0.1:8642` as the placeholder

### 7e. Full tool access gap

The implementation above routes chat to a standalone Hermes API server via HTTP. This gives the agent access to the toolsets configured on that standalone server, NOT to Mosaic Bot's own tools (Gmail, Web3, Vault) registered in `electron/integrations/tools/registry.ts`.

To give Hermes agents access to Mosaic Bot tools, one of these architectures is needed:

1. **Run Hermes inside Mosaic's main process** — Spawn `AIAgent` directly in `llm.ts` using `new AIAgent({...})` from a bundled `run_agent.py`. The agent then calls tools via the same Node.js process that has the tool registry loaded.
2. **Bridge pattern** — The standalone Hermes server makes HTTP callbacks to a local endpoint exposed by MosaicBot to execute tools, then returns results.
3. **Tool proxy** — Map Mosaic Bot tool IPC handlers to tool schemas that the standalone Hermes server can call via its own `execute_code` or `browser` tools.

See `references/mosaicbot-hermes-all-tools-access.md` for the current session's implementation details and the architectural gap.

> **Pitfall:** Simply adding `callHermes` that POSTs to `/v1/chat/completions` does NOT automatically give the agent access to Mosaic Bot's native tools. The agent only has access to whatever toolsets are enabled on the standalone server it talks to.

---

## 8. Vite Renderer Bundle: Node.js Externals Trap

**Symptom:** Code in `src/services/` crashes in production with `TypeError: (void 0) is not a function` when calling `fs.existsSync()`, `path.join()`, or `os.homedir()`.

**Root cause:** Vite's renderer build replaces `fs`, `path`, `os`, and other Node.js built-ins with `__vite-browser-external` stubs. The stub object exists (`typeof fs !== "undefined"` is true) but has no methods.

### 8a. Detection

Check the built renderer bundle:

```bash
grep -c "__vite-browser-external" dist/renderer/assets/index-*.js
```

If the count is > 0, Node.js modules were externalized and any file-system code in that bundle is dead.

### 8b. The `NODE_AVAILABLE` guard (insufficient alone)

```ts
import * as fs from "fs";

// ❌ Not enough — Vite stub passes this check
const BAD = typeof fs !== "undefined";

// ✅ Correct — probe a known method
const NODE_AVAILABLE = typeof (fs as any)?.existsSync === "function";
```

With `NODE_AVAILABLE`, the code degrades gracefully in the renderer:

```ts
export function loadFromDisk(): string | null {
  if (!NODE_AVAILABLE) {
    console.warn("[MyService] Node fs unavailable — running in renderer.");
    return null;
  }
  // safe to use fs from here on
}
```

> **Pitfall:** The guard prevents crashes but does NOT make file-system code work in the renderer. If the feature requires disk access, it **must** run in the main process.

### 8c. IPC Bridge Pattern (the real fix)

Move all Node.js code to the **main process** and expose it via IPC:

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

```ts
// electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
  skills: {
    buildSystemPrompt: (payload: any) =>
      ipcRenderer.invoke("skill:buildSystemPrompt", payload),
  },
});
```

```ts
// src/services/AIService.ts (renderer)
const ipcResult = await (window as any).electronAPI?.skills?.buildSystemPrompt({
  baseSystemPrompt: "",
  skillNames: config.skills,
});
```

### 8d. Build verification checklist

After adding the bridge, verify BOTH bundles:

```bash
# 1. Main bundle has real fs code
grep -c "_loadVaultSkill" dist/main/main.js

# 2. Renderer bundle uses IPC (not fs)
grep -c "electron.*skills.*buildSystemPrompt" dist/renderer/assets/index-*.js

# 3. No __vite-browser-external in main bundle
grep -c "__vite-browser-external" dist/main/main.js   # expect 0

# 4. Typecheck passes
npx tsc --noEmit | grep -c "error TS" || echo "0"
```

> **Rule of thumb:** Any service in `src/services/` that imports `fs`/`path`/`os` is **renderer-unsafe** unless it is ONLY imported by `electron/main.ts` (which esbuild bundles with Node externals preserved). If `src/services/X.ts` is imported by any React component, its file-system paths will break in production.

---

## 9. Skill reference loading: EISDIR crash on subdirectories

When `_loadSkill()` reads a skill's `references/` directory to inline reference files into the system prompt, it iterates over `fs.readdirSync(referencesDir)`. If any entry is a subdirectory (e.g., `images/`, `templates/`), `fs.readFileSync()` throws `EISDIR`. The catch block suppresses the error and treats the skill as failed, returning an empty skill set to the renderer.

**Symptom in logs:**
```
[AIService] IPC skill build failed or returned empty for Hermes Master Agent, using local fallback
```
The IPC call itself succeeds (no exception), but `loadedSkills.length === 0`.

**Fix:**
```ts
for (const refFile of refFiles) {
  const refPath = path.join(referencesDir, refFile);
  if (!fs.statSync(refPath).isFile()) continue;  // skip subdirectories
  try {
    const content = fs.readFileSync(refPath, "utf8");
    references.set(refFile, content);
  } catch {
    // handle individual file errors
  }
}
```

> **Pitfall:** `fs.readdirSync()` returns directories. Always guard with `Dirent.isFile()` or `fs.statSync(path).isFile()` before reading. This is common in skills that ship reference assets in subdirectories. See `references/skill-injector-eisdir-subdirectory-crash.md` for the full session chain.

---

## 10. Provider Variant Mismatch in Discovery / Dispatch UI Filters

When a codebase supports multiple provider variants (e.g. `hermes`, `hermes-aim`, `hermes-api`), strict equality checks in UI filter logic cause agents stored under a variant string to become invisible. The symptom is a discovery panel that never populates, buttons that stay disabled, or a dispatch branch that never executes — even though the backend service is healthy.

### 10a. Symptom chain

1. `ai-agents.json` stores the active agent with `"provider": "hermes-aim"`
2. `HermesAimPanel.tsx` filters agents with `agents.filter(a => a.provider === 'hermes')`
3. `hermesAgents` array is empty → `selectedAgent` stays `null`
4. `disabled={!selectedAgent}` prevents the "Discover & Connect" button from unlocking
5. User sees an apparently broken discovery panel despite the AIM server on port 9000 returning 200 for every endpoint

### 10b. Audit pattern

Search the codebase for **every** strict `provider === 'hermes'` (or whichever base string) inside `src/components/**/*.tsx` and `src/pages/**/*.tsx`:

```bash
grep -rn "provider === 'hermes'" src/components/ src/pages/
grep -rn "provider === \"hermes\"" src/components/ src/pages/
```

Any hit that is used for:
- **Discovery filtering** (e.g. `hermesAgents = agents.filter(...)`)
- **Auto-selection** (e.g. `useEffect` picking the default agent)
- **Dispatch routing** (e.g. `if (provider === 'hermes')` inside an execution path)
- **Button visibility** (e.g. conditional rendering of an Aimify button)

...must be widened to include all family variants.

### 10c. Minimal fix pattern

Replace a single-string check with an OR chain, and **parenthesize the group** when it is combined with other operators:

```tsx
// ❌ strict — misses hermes-aim and hermes-api
const hermesAgents = agents.filter(a => a.provider === 'hermes');

// ✅ widened — all family variants visible
const hermesAgents = agents.filter(
  a => a.provider === 'hermes' || a.provider === 'hermes-aim' || a.provider === 'hermes-api'
);

// ❌ operator precedence trap
agent.provider === 'hermes' || agent.provider === 'hermes-aim' && col.id !== 'aimified'
//      ↑ this evaluates as (hermes) OR (hermes-aim && not-aimified)

// ✅ parenthesized OR group
(agent.provider === 'hermes' || agent.provider === 'hermes-aim' || agent.provider === 'hermes-api')
  && col.id !== 'aimified'
```

### 10d. Fix checklist — all sites must be updated together

A partial fix creates a worse UX: the agent appears in the selector but cannot be aimified, or the aimify button shows but the runtime dispatch still skips it. Update **symmetrically** across:

| Site | File | Pattern to widen |
|------|------|-----------------|
| Discovery filter | `HermesAimPanel.tsx` | `agents.filter(...)` |
| Auto-select effect | `HermesAimPanel.tsx` | `useEffect` default selection |
| Prop filter (parent) | `KanbanDashboard.tsx` | `<HermesAimPanel agents={...}>` |
| Runtime dispatch | `KanbanDashboard.tsx` | execution branch by provider |
| Button visibility | `KanbanDashboard.tsx` | conditional Aimify button render |

> **Pitfall:** Fixing only the discovery filter (line 351) but missing the auto-select effect (line 88) means `hermesAgents` is populated but nothing is pre-selected, so the action button remains `disabled`.

### 10e. Future-proofing: central family check helper

Instead of scattering OR chains, add a single helper:

```ts
// src/types/ai.ts
export const HERMES_FAMILY = new Set<AIProvider>(["hermes", "hermes-aim", "hermes-api"]);
export const isHermesFamily = (p: AIProvider): boolean => HERMES_FAMILY.has(p);
```

Then every UI filter becomes:

```tsx
const hermesAgents = agents.filter(a => isHermesFamily(a.provider));
```

This prevents future variant additions from requiring shotgun surgery across components.

---

## 12. Adding a Cloud Variant of an Existing Local Provider

When a service (e.g., Ollama, Jan, LM Studio) offers both a **local runtime** and a **cloud API**, the two endpoints usually expose different protocol shapes. Local Ollama uses `/api/generate` and `/api/chat`; Ollama Cloud exposes an OpenAI-compatible `/v1/chat/completions`. Because the dispatch logic, base URL, authentication, and dynamic model-listing endpoints differ, they MUST be modeled as **separate providers** in the TypeScript union, not as extra models under the local provider.

### 12a. When to split

| Condition | Action |
|-----------|--------|
| Cloud endpoint is OpenAI-compatible (`/v1/chat/completions`) but local is native (`/api/generate`) | **Split** into `provider` and `provider-cloud` |
| Cloud requires Bearer auth; local requires none | **Split** |
| Cloud model list requires authenticated fetch; local lists pulled models via `/api/tags` | **Split** |
| Base URLs differ (`http://localhost:11434` vs `https://service.com`) | **Split** |
| Same API shape, same auth, same base URL, just different model IDs | **Keep single provider**, expand `DEFAULT_MODELS` |

### 12b. Type-level changes

Add the cloud variant to the `AIProvider` union, then populate `DEFAULT_MODELS` and `PROVIDER_INFO` with cloud-specific entries. When the project uses `.js` runtime files alongside `.ts` declarations, mirror the changes there too and rebuild BOTH the renderer (Vite) and main (esbuild) bundles.

```ts
// src/types/ai.ts
export type AIProvider = "openai" | "claude" | "gemini" | "ollama" | "ollama-cloud" | "custom";

export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  // ...
  ollama:       ["llama3.2:3b", "qwen2.5:32b", "gemma2:9b"],
  // Real model IDs from the live /v1/models endpoint — no :cloud suffix
  "ollama-cloud": ["kimi-k2.6", "kimi-k2.5", "minimax-m2.5", "deepseek-v4-flash", "qwen3-coder:480b"],
};

export const PROVIDER_INFO: Record<AIProvider, { name: string; color: string; baseUrl: string }> = {
  // ...
  ollama:       { name: "Ollama",       color: "#F97316", baseUrl: "http://localhost:11434" },
  "ollama-cloud": { name: "Ollama Cloud", color: "#22D3EE", baseUrl: "https://api.ollama.com" },
};
```

### 12c. Service dispatch routing

In `AIService.ts`, route the cloud provider through the **OpenAI-compatible sender** with a cloud base URL override. The local provider continues using its native sender.

```ts
// AIService.ts — inside sendMessage() or provider dispatch
case "ollama-cloud":
  return sendToOpenAI(
    { ...config, baseUrl: config.baseUrl || "https://api.ollama.com" },
    messages,
    callbacks
  );
```

> **Pitfall:** Ollama Cloud uses `https://api.ollama.com`, NOT `https://ollama.com/v1`. The latter is the public website, not the API endpoint. Using the wrong URL results in 400 Bad Request errors.

### 12d. Dynamic model fetching

Local and cloud variants need different discovery endpoints:

```ts
// src/components/AIAgentsSettings.tsx — inside fetchProviderModels()
if (provider === "ollama") {
  // Local: list pulled models
  const res = await fetch(`${baseUrl}/api/tags`);
  const data = await res.json();
  models = data.models?.map((m: any) => m.name) ?? [];
} else if (provider === "ollama-cloud") {
  // Cloud: authenticated model listing
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/models`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  const data = await res.json();
  models = normalizeModelList(data);
}
```

> **Pitfall:** Forgetting to pass `apiKey` to the cloud fetch results in a `401` that silently falls back to hardcoded defaults. Always include the auth header when `apiKey` is present.

### 12e. Migration over sanitization in main process

When the app persists agent configs in `userData/ai-agents.json`, previously saved agents may have the wrong provider after the split. Do **not** discard their model choice by resetting to a local default. Instead, **migrate** them to the new provider if their model ID signals cloud usage.

```ts
// electron/main.ts — during agent store loading
for (const agent of agents) {
  if (agent.provider === "ollama" && agent.model?.includes(":cloud")) {
    agent.provider = "ollama-cloud";
    agent.baseUrl = "https://ollama.com";
    console.log(`[Main] Migrated agent ${agent.id} to ollama-cloud`);
  }
}
```

> **Pitfall:** A naive sanitization that resets `model` to `"llama3.2:3b"` silently downgrades the user's selected high-end cloud model. Always prefer migration to data loss.

### 12f. Backend dispatch (MosaicBot LLM)

If the Electron main process also routes LLM calls (e.g., `electron/integrations/mosaicbot/src/main/llm.ts`), extend the provider union and dispatch switch there too.

```ts
// llm.ts — AgentConfig.provider union and switch
type Provider = "openai" | "ollama" | "ollama-cloud" | /* ... */;

switch (agent.provider) {
  case "ollama-cloud":
    return callOllama(agent, messages, systemPrompt); // or callOpenAI if cloud is OpenAI-compatible
}
```

### 12g. Verification checklist

### 12g. Verification checklist

```bash
# 1. TypeScript strict check
npx tsc --noEmit --skipLibCheck

# 2. Bundle contains the new provider
grep -o 'name:"Ollama Cloud"' dist/renderer/assets/index-*.js | wc -l

# 3. Main bundle has dispatch case
grep -c 'case "ollama-cloud"' dist/main/main.js

# 4. No stale :cloud models under local provider
grep -c '"provider":"ollama".*":cloud' dist/main/main.js   # expect 0 after migration

# 5. No stale suffixes in static defaults
grep -c 'kimi-k2.5:cloud' dist/renderer/assets/index-*.js  # expect 0

# 6. Settings UI lists cloud models when selected
grep -c 'ollama-cloud' dist/renderer/assets/index-*.js
```

### 12h. Auto-migration for saved agent configs (critical addendum)

**The default vs. saved config trap:** Changing the provider's default `baseUrl` only affects **new** agents created after the fix. Existing agents stored in `userData/ai-agents.json` retain their old (wrong) `baseUrl`. This causes a "fix deployed but still broken" symptom.

**Solution: Runtime URL correction in dispatch:**

```ts
// AIService.ts — inside provider switch
case "ollama-cloud":
  // Fix: migrate any saved agents that have the old/incorrect baseUrl
  const ollamaCloudBaseUrl = config.baseUrl?.includes("ollama.com") && 
                              !config.baseUrl?.includes("api.ollama.com")
    ? "https://api.ollama.com"
    : (config.baseUrl || "https://api.ollama.com");
  return sendToOpenAI(
    { ...config, baseUrl: ollamaCloudBaseUrl },
    messages,
    callbacks
  );
```

This pattern:
- Detects any URL containing "ollama.com" but NOT "api.ollama.com"
- Automatically corrects the stale URL at runtime
- Falls back to the correct default for new agents

**Permanent fix in main process:**

```ts
// electron/main.ts — during agent store loading
for (const agent of agents) {
  if (agent.provider === "ollama-cloud" && 
      agent.baseUrl?.includes("ollama.com") && 
      !agent.baseUrl?.includes("api.ollama.com")) {
    agent.baseUrl = "https://api.ollama.com";
    console.log(`[Main] Migrated agent ${agent.id} baseUrl to api.ollama.com`);
  }
}
```

> **Pitfall:** Without runtime auto-correction, users must manually "delete and recreate" every affected agent. Auto-migration preserves user data and fixes the issue transparently.

### 12i. Common runtime bugs with Ollama Cloud specifically

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Model fetch returns HTML instead of JSON | Calling `${baseUrl}/models` instead of `/v1/models` | Always append `/v1/models` to the baseUrl |
| Agents silently don't respond in chat | Backend routes `ollama-cloud` through `callOllama()` (native `/api/chat`) instead of `callOpenAI()` (OpenAI-compatible `/v1/chat/completions`) | Use `callOpenAI()` for `ollama-cloud`; only `callOllama()` for local `ollama` |
| Stale `:cloud` suffix in saved configs | Old code used `:cloud` as marker; real API IDs have no suffix | Migration in `electron/main.ts` strip `:cloud` before loading |
| Saved agents still fail after fix deployed | Old `baseUrl` persisted in `ai-agents.json` | Runtime auto-correction or main-process migration (see 12h) |
| Test connection passes but chat fails | Server `/health` may return 200 while chat endpoint 401s | Test with actual `/v1/chat/completions` POST, not just health |
| Generic "OpenAI API error" | Error response not parsed | See reference for better error handling using `response.text()` and JSON parsing |

---

## 13. Common build-time TypeScript traps

### 11a. `await` outside async function after refactoring

When converting a synchronous React event handler to async, TypeScript may not flag the missing `async` keyword if the handler is passed as a callback prop. The error appears only at runtime: `SyntaxError: await is only valid in async functions`.

```tsx
// ❌ crashes at runtime
function handleAgentConfirmed() {
  await someAsyncWork();  // SyntaxError
}

// ✅ correct
async function handleAgentConfirmed() {
  await someAsyncWork();
}
```

> **Tip:** After any refactor that introduces `await` inside a function, verify the `async` keyword is present. The bundler (esbuild/Vite) may not emit a clear error message.

### 11b. Relative import depth in monorepo component directories

Importing from `src/services/` inside `src/components/SomePanel.tsx` requires one `../` to reach `src/`, then `services/`. Using `../../services/` from `src/components/` goes up to the project root and then looks for `services/` at root level, which may resolve in dev (if root has a symlink or alias) but fails in the built bundle.

```tsx
// src/components/AdaPortalPanel.tsx
// ❌ bad relative path
import { tasteSkillPresetDetector } from "../../services/tasteSkillPresetDetector";

// ✅ correct path
import { tasteSkillPresetDetector } from "../services/tasteSkillPresetDetector";
```

> **Pitfall:** Vite path aliases (`@/services/...`) are safer than deep relative imports in Electron apps where `PROJECT_ROOT` resolution differs between dev and production.

---

## 11. MCP Server Integration in Electron Apps

When adding an external MCP server to an Electron+Vite app like Mosaic Companion, the registration pattern, timeout handling, and debugging approach follow a consistent workflow.

### 11a. Registration Pattern

Auto-detect a local installation first, then fall back to npx:

```typescript
let cmd: string;
let args: string[];
let env: Record<string, string> = {};

try {
  const resolvePath = require.resolve("midnight-wallet-cli/package.json", { 
    paths: [__dirname, process.cwd()] 
  });
  const pkgDir = path.dirname(resolvePath);
  const mcpPath = path.join(pkgDir, "dist", "mcp-server.js");
  
  if (fs.existsSync(mcpPath)) {
    cmd = "node";
    args = [mcpPath];
  } else {
    cmd = "npx";
    args = ["-y", "midnight-wallet-cli@latest", "--mcp"];
  }
} catch {
  cmd = "npx";
  args = ["-y", "midnight-wallet-cli@latest", "--mcp"];
}

pluginManager.add({
  name: "midnight-wallet",
  description: "Midnight Blockchain Wallet — manage wallets, check balances, transfer NIGHT tokens, deploy contracts",
  transport: "stdio",
  command: cmd,
  args: args,
  env: env,
  autoConnect: true,
});
```

> **Pitfall:** `__dirname` resolution in Electron main process needs `require.resolve` paths, not just `process.cwd()`.

### 11b. Timeout Configuration

MCP tool calls via npx may take 30–60s on first run (package download). Configure extended timeout:

```typescript
const mcpClient = new MCPClient({ debug: true, timeout: 120000 });
```

### 11c. Debugging Checklist

1. **Check Electron terminal** (not browser console) for MCP connection logs.
2. **Verify installation**: `ls node_modules/<package>/dist/mcp-server.js`
3. **Detect local vs npx**: First npx call will be slow; prefer local installation.
4. **Tool call timeout**: Extend to 120s for npx-based servers.
5. **Console error analysis**: Look for `TimeoutError: signal timed out`.

### 11d. Common Pitfalls

- **npx timeout on first call** — Downloads package on first invocation. Use local installation when possible.
- **Missing tools listing** — If tools don't appear after connection, check `listTools()` call in init sequence.
- **Console vs Terminal** — MCP connection logs appear in the Electron terminal, not browser devtools.

> See `references/mcp-midnight-wallet-integration.md` for a worked example with the Midnight Wallet MCP server.

## References

- `references/stale-bundle-provider-missing.md` — Session chain: PROVIDER_INFO had `hermes` in source but stale bundle only showed 6 providers. Rebuild verification steps and `grep` one-liners.
- `references/skill-injector-node-guard.md` — `skillInjector.ts` crashed with `(void 0) is not a function` because Vite externalized `fs`/`path`/`os`. Runtime guard pattern, full IPC bridge implementation, build verification, and the file-system-in-main-process rule. (2026-05-26)
- `references/mosaic-kanban-white-screen.md` — Full session chain: white window on "Open Hermes Kanban" button caused by (1) `hermes dashboard` not running on :9119, (2) `window.open` noopener trap in sandbox, (3) IPC handler returning before HTTP port bound. Includes fix diff summary and verification steps.
- `references/mosaic-skill-injection-arc.md` — Full session: Vault-as-Skills integration, `skillInjector.ts` renderer crash, `__vite-browser-external` discovery, 5-layer IPC bridge (`skill:buildSystemPrompt`), poll-based vault file watcher, case-insensitive vault box/entry matching, and build verification. (2026-05-26)
- `references/hermes-api-server-db-lock-conflict.md` — `Broken pipe` / `disk I/O error` when Hermes gateway or CLI chat holds `state.db` WAL locks, preventing the standalone API server from spawning AIAgent instances. Process detection with `lsof` and recovery steps.
- `references/ollama-cloud-baseurl-fix.md` — Ollama Cloud agents failing with 400/405 errors due to wrong baseUrl (`ollama.com/v1` instead of `api.ollama.com`). Runtime auto-correction pattern and double-layer protection.
- `references/mcp-midnight-wallet-integration.md` — Adding external MCP server via npm package, npx launch patterns, timeout handling for slow startups.
- `references/electron-custom-protocol-static-data.md` — Electron custom protocol pattern for serving static JSON/data files to renderer. Covers `protocol.registerSchemesAsPrivileged()`, `protocol.handle()`, security guards, and use cases like skill libraries. (2026-07-02)
