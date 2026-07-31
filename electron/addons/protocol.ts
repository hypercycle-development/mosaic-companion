/**
 * `mosaic-addon://` protocol handler (§4.1). `mosaic-addon://<id>/<path>`
 * serves files from that addon's `renderer/` directory — but only while the
 * addon is currently activated (403 otherwise), which is what makes
 * "deactivated ⇒ unreachable" airtight regardless of any stale webview still
 * pointed at the URL. Same traversal-guard shape as the existing
 * `mosaic-media` handler in `main.ts`.
 */

import { net, protocol, session, type Session } from "electron";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { getLiveAddonRoot } from "./loader";

/**
 * Privileges for the `mosaic-addon` scheme — added to the existing
 * `protocol.registerSchemesAsPrivileged([...])` call in `main.ts` (alongside
 * `mosaic-media`), not a second call, since Electron expects this to run
 * once before `app.whenReady()`.
 */
export const ADDON_SCHEME_PRIVILEGE = {
  scheme: "mosaic-addon",
  privileges: { standard: true, secure: true, supportFetchAPI: true },
} as const;

function addonProtocolHandler(request: Request): Response | Promise<Response> {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const id = url.host;
  const root = getLiveAddonRoot(id);
  if (!root) {
    // Not installed, not activated, or deactivated mid-session — all the
    // same outcome from the protocol's point of view: unreachable.
    return new Response("Addon not active", { status: 403 });
  }

  const rendererDir = path.join(root, "renderer");
  let requestedPath = decodeURIComponent(url.pathname);
  if (!requestedPath || requestedPath === "/") requestedPath = "/index.html";

  const filePath = path.join(rendererDir, path.normalize(requestedPath));
  if (filePath !== rendererDir && !filePath.startsWith(rendererDir + path.sep)) {
    return new Response("Access Denied", { status: 403 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new Response("Not Found", { status: 404 });
  }

  // Re-check after resolving symlinks: the prefix test above passes for a link
  // that lives under renderer/ but points outside it, and serving that would
  // hand the addon's own page an arbitrary file read over mosaic-addon://.
  const realRendererDir = fs.realpathSync(rendererDir);
  const realFilePath = fs.realpathSync(filePath);
  if (!realFilePath.startsWith(realRendererDir + path.sep)) {
    return new Response("Access Denied", { status: 403 });
  }

  return net.fetch(pathToFileURL(filePath).href);
}

/**
 * Registers the `mosaic-addon://` handler on `session.defaultSession`. Kept
 * for any code path that resolves addon content against the default
 * session, but this alone is NOT sufficient for addon webviews — see
 * `registerAddonProtocolForSession` below.
 */
export function registerAddonProtocolHandler(): void {
  registerAddonProtocolForSession(session.defaultSession);
}

/**
 * `protocol.handle()` (the top-level import) only ever registers on
 * `session.defaultSession` — it is *not* inherited by other sessions. Every
 * addon webview loads via its own `persist:addon:<id>` partition, which is
 * a distinct `Session` object, so without this, `mosaic-addon://` requests
 * from inside an addon webview silently resolve to nothing (the guest page
 * never navigates, no did-fail-load, just an empty document) — the addon
 * looks "activated" everywhere in app state but never actually renders.
 * Idempotent: safe to call repeatedly for the same session (e.g. once per
 * addon webview attach) via `isProtocolHandled` guard.
 */
export function registerAddonProtocolForSession(targetSession: Session): void {
  if (targetSession.protocol.isProtocolHandled("mosaic-addon")) return;
  targetSession.protocol.handle("mosaic-addon", addonProtocolHandler);
}
