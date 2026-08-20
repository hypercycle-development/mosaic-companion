/**
 * Addon webview preload — new esbuild entry point, compiled to
 * `dist/main/addon-preload.js`. Deliberately dumb: every `window.addonAPI`
 * call funnels into the single `addon-api:invoke` channel; this file has no
 * business logic of its own beyond theme/env injection and the local event
 * listener table. It must NOT import any integration module (contrast with
 * `electron/preload.ts`, which imports `mcpAPI` etc.) — it is shared by
 * every addon and shipped by the app itself, not by addon authors.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface ThemePayload {
  themeKey: string;
  cssVars: Record<string, string>;
}

interface InitPayload {
  addonId: string;
  manifest: unknown;
  theme: ThemePayload;
  platform: string;
  appVersion: string;
  locale: string;
}

interface ApiResponse {
  ok: boolean;
  data?: unknown;
  code?: string;
  message?: string;
}

function invoke(ns: string, method: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke("addon-api:invoke", { ns, method, args }).then((res: ApiResponse) => {
    if (res && res.ok) return res.data;
    const code = res?.code || "UNKNOWN_ERROR";
    const message = res?.message || "addonAPI call failed";
    // NOTE: contextBridge sanitizes thrown Errors crossing the isolated-world
    // boundary — only the standard `message`/`stack` properties survive; a
    // custom `.code` property set here is silently dropped on the far side
    // (verified empirically). Encoding the code into the message itself
    // (`[CODE] message`) is what actually reaches the addon's page script;
    // `parseAddonApiError()` below is the documented way to recover it.
    throw new Error(`[${code}] ${message}`);
  });
}

/**
 * Recovers `{ code, message }` from an addonAPI error's `.message` — see the
 * contextBridge note in `invoke()` above for why this exists instead of a
 * plain `error.code` property.
 */
function parseAddonApiError(error: unknown): { code: string; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const match = /^\[([A-Z_]+)\] ([\s\S]*)$/.exec(raw);
  return match ? { code: match[1], message: match[2] } : { code: "UNKNOWN_ERROR", message: raw };
}

function applyTheme(theme: ThemePayload | undefined | null): void {
  if (!theme?.cssVars) return;
  // Preload runs at document-start; the init round-trip can resolve before
  // <html> exists yet. Skip silently — the DOMContentLoaded handler below
  // re-applies the (by-then cached) theme once the DOM is actually there.
  const root = document.documentElement;
  if (!root) return;
  for (const [token, value] of Object.entries(theme.cssVars)) {
    root.style.setProperty(`--${token}`, value);
  }
  root.setAttribute("data-theme", theme.themeKey);
}

// ── Local event listener table (addonAPI.events.on) ─────────────────────────
const eventListeners = new Map<string, Set<(payload: unknown) => void>>();

ipcRenderer.on("addon-api:event", (_event: IpcRendererEvent, msg: { channel: string; payload: unknown }) => {
  if (!msg) return;
  if (msg.channel === "theme:changed") {
    applyTheme(msg.payload as ThemePayload);
  }
  const listeners = eventListeners.get(msg.channel);
  if (listeners) {
    for (const cb of listeners) cb(msg.payload);
  }
});

// ── Init: identity, manifest, theme, platform/appVersion/locale ────────────
// DX and display only, never for auth — identity for permission purposes
// is resolved main-side from event.sender, never from this.
let cachedInit: InitPayload | null = null;
const initPromise: Promise<InitPayload | null> = ipcRenderer.invoke("addon-api:init").then(
  async (result: InitPayload | null) => {
    cachedInit = result;
    applyTheme(result?.theme);
    // Auto-subscribe to the always-on channels so theming/env stay live
    // without the addon's own script having to ask.
    try {
      await invoke("events", "subscribe", "theme:changed");
      await invoke("events", "subscribe", "window:focus-changed");
    } catch {
      /* best-effort — a fresh page load will retry via the next init() call */
    }
    return result;
  },
);

document.addEventListener("DOMContentLoaded", async () => {
  const payload = cachedInit ?? (await initPromise);
  applyTheme(payload?.theme);
});

// ── window.addonAPI surface ─────────────────────────────────────────────────
const addonAPI = {
  /** Recovers `{ code, message }` from a rejected addonAPI call — e.g.
   * `catch (e) { const { code } = addonAPI.parseError(e); if (code === 'PERMISSION_DENIED') ... }`.
   * Needed because a thrown Error's custom properties don't survive the
   * contextBridge isolation boundary; only `.message`/`.stack` do. */
  parseError: parseAddonApiError,
  system: {
    getManifest: () => invoke("system", "getManifest"),
    getAppInfo: () => invoke("system", "getAppInfo"),
    getTheme: () => invoke("system", "getTheme"),
  },
  settings: {
    get: () => invoke("settings", "get"),
    set: (patch: Record<string, unknown>) => invoke("settings", "set", patch),
    replace: (value: Record<string, unknown>) => invoke("settings", "replace", value),
    clear: () => invoke("settings", "clear"),
  },
  files: {
    read: (relPath: string) => invoke("files", "read", relPath),
    readBinary: (relPath: string) => invoke("files", "readBinary", relPath),
    write: (relPath: string, contents: string | Uint8Array) => invoke("files", "write", relPath, contents),
    list: (relDir?: string) => invoke("files", "list", relDir ?? "."),
    delete: (relPath: string) => invoke("files", "delete", relPath),
    mkdir: (relDir: string) => invoke("files", "mkdir", relDir),
  },
  events: {
    on: (channel: string, cb: (payload: unknown) => void): (() => void) => {
      let set = eventListeners.get(channel);
      if (!set) {
        set = new Set();
        eventListeners.set(channel, set);
      }
      set.add(cb);
      invoke("events", "subscribe", channel).catch(() => {
        /* surfaced implicitly — no events will arrive if this failed */
      });
      return () => {
        set?.delete(cb);
        if (set && set.size === 0) {
          eventListeners.delete(channel);
          invoke("events", "unsubscribe", channel).catch(() => {});
        }
      };
    },
  },
  ui: {
    setTitle: (title: string) => invoke("ui", "setTitle", title),
    openExternal: (url: string) => invoke("ui", "openExternal", url),
  },
  wallet: {
    getAddress: () => invoke("wallet", "getAddress"),
    getBalance: (tokenSymbol?: string) => invoke("wallet", "getBalance", tokenSymbol),
    getNetworkInfo: () => invoke("wallet", "getNetworkInfo"),
  },
  agents: {
    list: () => invoke("agents", "list"),
    get: (id: string) => invoke("agents", "get", id),
    add: (agent: Record<string, unknown>) => invoke("agents", "add", agent),
    update: (id: string, patch: Record<string, unknown>) => invoke("agents", "update", id, patch),
  },
  mcp: {
    listServers: () => invoke("mcp", "listServers"),
    listTools: (serverId: string) => invoke("mcp", "listTools", serverId),
    callTool: (serverId: string, toolName: string, args: Record<string, unknown>) =>
      invoke("mcp", "callTool", serverId, toolName, args),
  },
  nodes: {
    list: () => invoke("nodes", "list"),
    getSavedAims: (license?: string) => invoke("nodes", "getSavedAims", license),
  },
  /** The addon-main bridge — calls the method the addon's own
   * main/index.js registered via ctx.ipc.handle. */
  invoke: (method: string, ...args: unknown[]) => invoke("invoke", method, ...args),
  /** DX/display only — resolves once, cached thereafter. */
  init: () => initPromise,
};

contextBridge.exposeInMainWorld("addonAPI", addonAPI);
