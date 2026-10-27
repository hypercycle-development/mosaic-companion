/**
 * Web permission handling (camera, microphone, notifications, geolocation, …)
 * for every session. Electron grants every request when no handler is set,
 * which would hand them to addon webviews and to any site in the browser tab.
 *
 * Deny by default. The app's own windows keep everything (the voice recorder
 * needs the microphone); every other page gets only the harmless set below.
 * The one exception is an addon's camera/microphone: it must be declared in
 * the manifest, and the user is asked the first time each launch.
 */

import {
  app,
  BrowserWindow,
  dialog,
  session,
  systemPreferences,
  type MediaAccessPermissionRequest,
  type Session,
  type WebContents,
} from "electron";
import { getAddonIdForSender } from "./addons/webviews";
import { getGrantedPermissions, getLiveManifest } from "./addons/loader";
import { grantsMedia } from "./addons/manifest";

/** Harmless, and expected by ordinary sites in the browser tab. */
const ALWAYS_ALLOWED = new Set(["fullscreen", "clipboard-sanitized-write"]);

const DEVICE = { video: "camera", audio: "microphone" } as const;

/** `<addonId>:<mediaType>` pairs the user allowed since launch. */
const allowedThisLaunch = new Set<string>();

/** webContents ids whose tab currently shows the media indicator. */
const indicated = new Set<number>();

/** Webviews (addons, the browser tab) are type "webview"; only app windows are "window". */
function isAppWindow(wc: WebContents | null): boolean {
  return wc?.getType() === "window";
}

async function requestAddonMedia(wc: WebContents, addonId: string, mediaTypes: Array<"video" | "audio">): Promise<boolean> {
  if (!grantsMedia(getGrantedPermissions(addonId), mediaTypes)) return false;
  const devices = mediaTypes.map((t) => DEVICE[t]);

  if (!mediaTypes.every((t) => allowedThisLaunch.has(`${addonId}:${t}`))) {
    const name = getLiveManifest(addonId)?.name ?? addonId;
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Allow", "Don't Allow"],
      defaultId: 1,
      cancelId: 1,
      message: `${name} wants to use your ${devices.join(" and ")}`,
      detail: "Allowed until you quit MosAIc.",
    });
    if (response !== 0) return false;
    for (const t of mediaTypes) allowedThisLaunch.add(`${addonId}:${t}`);
  }

  if (process.platform === "darwin") {
    for (const d of devices) if (!(await systemPreferences.askForMediaAccess(d))) return false;
  }
  showMediaIndicator(wc, addonId);
  return true;
}

/** Marks the addon's tab until its page navigates or closes. Errs towards showing. */
function showMediaIndicator(wc: WebContents, addonId: string): void {
  const id = wc.id;
  if (indicated.has(id)) return;
  indicated.add(id);
  const send = (active: boolean) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("addons:media-access", { addonId, active });
    }
  };
  const clear = () => {
    if (indicated.delete(id)) send(false);
  };
  send(true);
  wc.once("did-navigate", clear);
  wc.once("destroyed", clear);
}

function installPermissionHandlers(s: Session): void {
  s.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (ALWAYS_ALLOWED.has(permission) || isAppWindow(wc)) return callback(true);
    const addonId = getAddonIdForSender(wc.id);
    if (permission !== "media" || !addonId) return callback(false);
    const mediaTypes = (details as MediaAccessPermissionRequest).mediaTypes ?? [];
    requestAddonMedia(wc, addonId, mediaTypes).then(callback, () => callback(false));
  });
  s.setPermissionCheckHandler((wc, permission, _origin, details) => {
    if (ALWAYS_ALLOWED.has(permission) || isAppWindow(wc)) return true;
    const addonId = wc && getAddonIdForSender(wc.id);
    if (permission !== "media" || !addonId || !details.mediaType) return false;
    return (
      grantsMedia(getGrantedPermissions(addonId), [details.mediaType]) &&
      allowedThisLaunch.has(`${addonId}:${details.mediaType}`)
    );
  });
}

/** Call before `app.whenReady()`, so every session gets handlers before it loads anything. */
export function installPermissionPolicy(): void {
  app.on("session-created", installPermissionHandlers);
  app.whenReady().then(() => installPermissionHandlers(session.defaultSession));
}
