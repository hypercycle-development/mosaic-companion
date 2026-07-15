/**
 * `mosaic-addon://` protocol handler (§4.1). `mosaic-addon://<id>/<path>`
 * serves files from that addon's `renderer/` directory — but only while the
 * addon is currently activated (403 otherwise), which is what makes
 * "deactivated ⇒ unreachable" airtight regardless of any stale webview still
 * pointed at the URL. Same traversal-guard shape as the existing
 * `mosaic-media` handler in `main.ts`.
 */

import { net, protocol } from "electron";
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

export function registerAddonProtocolHandler(): void {
  protocol.handle("mosaic-addon", (request) => {
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

    return net.fetch(pathToFileURL(filePath).href);
  });
}
