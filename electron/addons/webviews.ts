/**
 * webContents ↔ addonId identity map, and the main-process attach guards
 * that make it trustworthy (§4.2, §5.1 — "the security core"). The renderer
 * never states which addon it is; the only place an addonId is ever attached
 * to a webContents is here, at `did-attach-webview` time, driven by the
 * `mosaic-addon://<id>/...` URL the *main process* validated in
 * `will-attach-webview` — never by anything the guest page can influence
 * after that point. `electron/addons/api/index.ts`'s dispatcher resolves
 * identity purely by looking up `event.sender.id` in this map.
 */

import path from "path";
import type { BrowserWindow, WebContents } from "electron";
import { isAddonActivated } from "./loader";
import { registerAddonProtocolForSession } from "./protocol";

const ADDON_PROTOCOL_PREFIX = "mosaic-addon://";

/**
 * Absolute filesystem path to the compiled addon preload — resolves inside
 * app.asar via __dirname, same pattern as the existing preload paths in
 * main.ts. Empirically (Electron 39), both `webPreferences.preload` set
 * programmatically here AND the `<webview preload="">` JSX attribute reject
 * a `file://` URL ("preload script must have absolute path" — a hard main
 * process error, not a warning); a plain absolute OS path is what both
 * actually want, despite some Electron docs/examples showing a file: URL.
 */
export const ADDON_PRELOAD_PATH = path.join(__dirname, "addon-preload.js");

interface AddonWebContentsEntry {
  addonId: string;
  webContents: WebContents;
  subscribedChannels: Set<string>;
}

/** Keyed by webContents.id — the only identity the dispatcher ever trusts. */
const registry = new Map<number, AddonWebContentsEntry>();

export function registerAddonWebContents(webContents: WebContents, addonId: string): void {
  registry.set(webContents.id, { addonId, webContents, subscribedChannels: new Set() });
}

export function unregisterAddonWebContents(webContentsId: number): void {
  registry.delete(webContentsId);
}

export function getAddonIdForSender(webContentsId: number): string | undefined {
  return registry.get(webContentsId)?.addonId;
}

export function subscribeChannel(webContentsId: number, channel: string): void {
  registry.get(webContentsId)?.subscribedChannels.add(channel);
}

export function unsubscribeChannel(webContentsId: number, channel: string): void {
  registry.get(webContentsId)?.subscribedChannels.delete(channel);
}

/**
 * Push `{ channel, payload }` as `addon-api:event` to every registered addon
 * webContents subscribed to `channel` — filtered so a subscription never
 * leaks another addon's traffic. Pass `onlyAddonId` for addon-scoped pushes
 * (`self:<name>`, ctx.events.send).
 */
export function broadcastAddonEvent(channel: string, payload: unknown, opts?: { onlyAddonId?: string }): void {
  for (const entry of registry.values()) {
    if (opts?.onlyAddonId && entry.addonId !== opts.onlyAddonId) continue;
    if (!entry.subscribedChannels.has(channel)) continue;
    if (entry.webContents.isDestroyed()) continue;
    entry.webContents.send("addon-api:event", { channel, payload });
  }
}

/**
 * Installs the `will-attach-webview` / `did-attach-webview` guards (§4.2) on
 * the main app window. Main-process enforcement — the renderer's webview
 * attributes (`preload`, `webpreferences`, …) are never trusted; every
 * addon webview gets contextIsolation/sandbox/nodeIntegration and the addon
 * preload forced here, regardless of what the tag asked for. Every
 * *non*-addon webview (the existing external-site BrowserView) has its
 * preload stripped — a deliberate behavior change worth its own test, since
 * nothing should ever get the addon (or any) preload by accident.
 */
export function installWebviewAttachGuards(win: BrowserWindow): void {
  const pendingAttach: string[] = [];

  win.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    if (params.src?.startsWith(ADDON_PROTOCOL_PREFIX)) {
      const id = new URL(params.src).host;
      if (!isAddonActivated(id)) {
        event.preventDefault();
        return;
      }
      webPreferences.preload = ADDON_PRELOAD_PATH;
      webPreferences.contextIsolation = true;
      webPreferences.nodeIntegration = false;
      webPreferences.sandbox = true;
      pendingAttach.push(id);
    } else {
      delete webPreferences.preload;
    }
  });

  win.webContents.on("did-attach-webview", (_event, wc) => {
    const id = pendingAttach.shift();
    if (!id) return;
    // The addon webview's `persist:addon:<id>` partition is its own Session
    // object — protocol.handle() on the module-level `protocol` import only
    // ever reaches session.defaultSession, so without this the guest can
    // never actually load `mosaic-addon://` content (§4.1's protocol is
    // otherwise a no-op from inside the webview).
    registerAddonProtocolForSession(wc.session);
    registerAddonWebContents(wc, id);
    wc.on("will-navigate", (navEvent, url) => {
      if (!url.startsWith(`${ADDON_PROTOCOL_PREFIX}${id}/`)) navEvent.preventDefault();
    });
    wc.setWindowOpenHandler(() => ({ action: "deny" }));
    wc.on("destroyed", () => unregisterAddonWebContents(wc.id));
  });
}
