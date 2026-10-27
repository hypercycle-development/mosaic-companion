/**
 * Web permission handling (camera, microphone, notifications, geolocation, …)
 * for every session. Electron grants every request when no handler is set,
 * which would hand them to addon webviews and to any site in the browser tab.
 *
 * Deny by default. The app's own windows keep everything (the voice recorder
 * needs the microphone); every other page gets only the harmless set below.
 */

import { app, session, type Session, type WebContents } from "electron";

/** Harmless, and expected by ordinary sites in the browser tab. */
const ALWAYS_ALLOWED = new Set(["fullscreen", "clipboard-sanitized-write"]);

/** Webviews (addons, the browser tab) are type "webview"; only app windows are "window". */
function isAppWindow(wc: WebContents | null): boolean {
  return wc?.getType() === "window";
}

function installPermissionHandlers(s: Session): void {
  s.setPermissionRequestHandler((wc, permission, callback) => {
    callback(ALWAYS_ALLOWED.has(permission) || isAppWindow(wc));
  });
  s.setPermissionCheckHandler((wc, permission) => ALWAYS_ALLOWED.has(permission) || isAppWindow(wc));
}

/** Call before `app.whenReady()`, so every session gets handlers before it loads anything. */
export function installPermissionPolicy(): void {
  app.on("session-created", installPermissionHandlers);
  app.whenReady().then(() => installPermissionHandlers(session.defaultSession));
}
