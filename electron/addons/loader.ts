/**
 * Addon loader core (§3.2, §5.4, §6). Main-process only in this phase — no
 * webview/protocol/renderer surface yet (that's Phase 2). This module owns:
 *  - the in-memory live-addon registry (what's actually loaded right now)
 *  - the activate/deactivate state-machine transitions
 *  - the `ctx` object handed to an addon's `main/index.js`
 *  - the dev-unpacked install path (§6.7) — the only install mechanism that
 *    exists before Phase 4's registry/signing installer.
 *
 * `initAddons()` is called once at app startup; it converges the live
 * registry to whatever `addon-state.json` says is `activated: true` (§3.2
 * rule 3) — a failure to converge never crashes the app, it just leaves that
 * addon inactive with `lastError` set for the next attempt.
 */

import { app, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import semver from "semver";
import { getErrorMessage } from "../utils";
import { getTabVisibility, setTabVisibility as setCoreTabVisibility } from "../settings";
import { ADDON_TAB_ID_PREFIX } from "../../src/tabs/registry";
import { validateManifest, type AddonManifest } from "./manifest";
import {
  getAddonEntry,
  listAddonEntries,
  recordInstall,
  setActivated,
  setLastError,
  setGrantedPermissions,
  setLinkVisibilityToActivation,
  setUpdateCheckMode,
  recordUpgrade,
  removeAddonEntry,
  refreshManifestMeta,
  type AddonStateEntry,
} from "./state";

// Re-exported so callers (e.g. a future Settings consent flow, installer.ts,
// or a test harness) only need to import from loader.ts, not reach into
// state.ts too.
export { setGrantedPermissions, setLinkVisibilityToActivation, setUpdateCheckMode, recordUpgrade, removeAddonEntry };
import { broadcastAddonEvent } from "./webviews";

// =============================================================================
// ctx — the addon-main contract (§5.4)
// =============================================================================

export interface AddonCtx {
  manifest: Readonly<AddonManifest>;
  ipc: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => void;
    removeHandler: (name: string) => void;
  };
  events: {
    send: (name: string, payload: unknown) => void;
  };
  paths: { root: string; data: string };
  settings: {
    get: () => Record<string, unknown>;
    set: (patch: Record<string, unknown>) => void;
  };
  log: (...args: unknown[]) => void;
}

interface AddonMainModule {
  activate?: (ctx: AddonCtx) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}

interface LiveAddon {
  manifest: AddonManifest;
  root: string;
  mainModule?: AddonMainModule;
  /** Full ipcMain channel names this addon registered, e.g. "addon:ping-addon:ping" — tracked for teardown on deactivate/crash. */
  channels: Set<string>;
  /** Method name -> raw handler fn, so addonAPI.invoke (§5.3) can call
   * straight into an addon's own ctx.ipc.handle registration without a
   * second IPC round-trip (Electron has no main-to-main ipcMain.invoke). */
  handlersByMethod: Map<string, (...args: unknown[]) => unknown>;
  granted: Set<string>;
}

const liveAddons = new Map<string, LiveAddon>();

const DEACTIVATE_TIMEOUT_MS = 5000;
const ADDON_SETTINGS_MAX_BYTES = 64 * 1024;

// =============================================================================
// Retained-settings store (§5.3/§5.4's ctx.settings — the store the renderer
// will also read from once addonAPI.settings exists in a later phase).
// =============================================================================

function addonSettingsPath(id: string): string {
  return path.join(app.getPath("userData"), "addon-settings", `${id}.json`);
}

export function readAddonSettings(id: string): Record<string, unknown> {
  try {
    const p = addonSettingsPath(id);
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (error) {
    console.error(`[addons] Failed to read settings for "${id}":`, getErrorMessage(error));
    return {};
  }
}

/** Thrown by `writeAddonSettingsValue` on the 64 KB cap — a distinct class
 * (rather than a plain Error) so `electron/addons/api/settings.ts` can map
 * this specifically to `BAD_ARGS` (a caller-input problem) instead of the
 * dispatcher's generic `HANDLER_ERROR`. `ctx.settings.set` (addon-main
 * callers, §5.4) doesn't care about this distinction — it's still just an
 * Error to them. */
export class AddonSettingsSizeError extends Error {}

function writeAddonSettingsValue(id: string, value: Record<string, unknown>): void {
  const json = JSON.stringify(value, null, 2);
  if (Buffer.byteLength(json, "utf8") > ADDON_SETTINGS_MAX_BYTES) {
    throw new AddonSettingsSizeError(`Addon settings for "${id}" would exceed ${ADDON_SETTINGS_MAX_BYTES} bytes`);
  }
  const p = addonSettingsPath(id);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmpPath = `${p}.tmp`;
  fs.writeFileSync(tmpPath, json, "utf8");
  fs.renameSync(tmpPath, p);
}

/** Shallow-merge write — the shape both `ctx.settings.set` and
 * `addonAPI.settings.set` use (§5.3, §5.4). */
export function writeAddonSettings(id: string, patch: Record<string, unknown>): void {
  writeAddonSettingsValue(id, { ...readAddonSettings(id), ...patch });
}

export function replaceAddonSettings(id: string, value: Record<string, unknown>): void {
  writeAddonSettingsValue(id, value);
}

export function clearAddonSettings(id: string): void {
  writeAddonSettingsValue(id, {});
}

// =============================================================================
// Root resolution + manifest (re-)loading
// =============================================================================

/** Resolves the addon's on-disk root regardless of whether it's currently
 * live — `getLiveAddonRoot` (below) only answers for active addons, which
 * isn't enough for installer.ts operations (uninstall, data-size) that must
 * work on an installed-but-deactivated addon too. */
export function getAddonRoot(id: string, entry: AddonStateEntry): string {
  if (entry.source.type === "dev") return entry.source.path;
  return path.join(app.getPath("userData"), "addons", id);
}

/** Always re-reads manifest.json from disk — dev addons are edited between
 * activations (§7.4's "Reload" dev loop), and this keeps that path honest. */
function loadAndValidateManifest(root: string, expectedId: string): { manifest?: AddonManifest; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  } catch (error) {
    return { errors: [`Failed to read manifest.json: ${getErrorMessage(error)}`] };
  }

  const result = validateManifest(json, path.basename(root));
  if (!result.valid) {
    return { errors: result.errors };
  }
  if (result.manifest.id !== expectedId) {
    return { errors: [`Manifest id "${result.manifest.id}" does not match installed id "${expectedId}"`] };
  }
  return { manifest: result.manifest, errors: [] };
}

// =============================================================================
// ctx construction
// =============================================================================

function buildCtx(
  manifest: AddonManifest,
  root: string,
): { ctx: AddonCtx; channels: Set<string>; handlersByMethod: Map<string, (...args: unknown[]) => unknown> } {
  const channels = new Set<string>();
  const handlersByMethod = new Map<string, (...args: unknown[]) => unknown>();
  const dataDir = path.join(root, "data");
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (error) {
    console.warn(`[addons] Failed to ensure data dir for "${manifest.id}":`, getErrorMessage(error));
  }

  const ctx: AddonCtx = {
    manifest: Object.freeze({ ...manifest }),
    ipc: {
      handle: (name, fn) => {
        const channel = `addon:${manifest.ipcNamespace}:${name}`;
        ipcMain.handle(channel, (_event, ...args: unknown[]) => fn(...args));
        channels.add(channel);
        // Also reachable via addonAPI.invoke() from the addon's own webview
        // (§5.3) — same handler, no second registration needed.
        handlersByMethod.set(name, fn);
      },
      removeHandler: (name) => {
        const channel = `addon:${manifest.ipcNamespace}:${name}`;
        ipcMain.removeHandler(channel);
        channels.delete(channel);
        handlersByMethod.delete(name);
      },
    },
    events: {
      // Pushes to this addon's own live webview(s) as `self:<name>` (§5.4).
      send: (name, payload) => broadcastAddonEvent(`self:${name}`, payload, { onlyAddonId: manifest.id }),
    },
    paths: { root, data: dataDir },
    settings: {
      get: () => readAddonSettings(manifest.id),
      set: (patch) => writeAddonSettings(manifest.id, patch),
    },
    log: (...args: unknown[]) => console.log(`[addon:${manifest.id}]`, ...args),
  };

  return { ctx, channels, handlersByMethod };
}

function teardownChannels(channels: Iterable<string>): void {
  for (const channel of channels) {
    try {
      ipcMain.removeHandler(channel);
    } catch {
      /* already gone — fine */
    }
  }
}

// =============================================================================
// Transitions (§3.2)
// =============================================================================

/**
 * Activate an installed addon. Never throws — failures are caught, recorded
 * as `lastError`, and any partially-registered ipcMain channels are torn
 * down, leaving the app healthy and the addon simply inactive.
 *
 * Note on `activated` in state: this function only ever sets it to `true`
 * (on success). It never sets it to `false` on failure — `activated` is the
 * *desired* state (§3.2 rule 3); a startup convergence failure just means
 * the next attempt (retry or restart) can pick it back up.
 */
export async function activateAddon(id: string): Promise<{ success: boolean; error?: string }> {
  if (liveAddons.has(id)) {
    return { success: true }; // already active — idempotent
  }

  const entry = getAddonEntry(id);
  if (!entry) {
    return { success: false, error: `Addon "${id}" is not installed` };
  }

  let channels: Set<string> | undefined;
  try {
    const root = getAddonRoot(id, entry);
    const { manifest, errors } = loadAndValidateManifest(root, id);
    if (!manifest) {
      throw new Error(`Invalid manifest: ${errors.join("; ")}`);
    }

    if (manifest.minAppVersion && !semver.gte(app.getVersion(), manifest.minAppVersion)) {
      throw new Error(
        `Addon requires app version >= ${manifest.minAppVersion}, current is ${app.getVersion()}`,
      );
    }

    const missingPermissions = manifest.permissions.filter((p) => !entry.grantedPermissions.includes(p));
    if (missingPermissions.length > 0) {
      throw new Error(`Manifest requests permissions beyond what was granted: ${missingPermissions.join(", ")}`);
    }

    for (const [otherId, other] of liveAddons) {
      if (otherId !== id && other.manifest.ipcNamespace === manifest.ipcNamespace) {
        throw new Error(
          `ipcNamespace "${manifest.ipcNamespace}" is already in use by active addon "${otherId}"`,
        );
      }
    }

    const built = buildCtx(manifest, root);
    channels = built.channels;

    let mainModule: AddonMainModule | undefined;
    if (manifest.main?.entry) {
      const entryPath = path.join(root, manifest.main.entry);
      const fileUrl = pathToFileURL(entryPath).href;
      // `?v=` cache-busts Node's ESM module cache so a same-session reload
      // after an upgrade (or a dev "Reload") picks up new code (§3.2).
      mainModule = (await import(`${fileUrl}?v=${encodeURIComponent(manifest.version)}`)) as AddonMainModule;
      if (typeof mainModule.activate === "function") {
        await mainModule.activate(built.ctx);
      }
    }

    liveAddons.set(id, {
      manifest,
      root,
      mainModule,
      channels: built.channels,
      handlersByMethod: built.handlersByMethod,
      granted: new Set(entry.grantedPermissions),
    });

    setActivated(id, true);
    setLastError(id, undefined);
    refreshManifestMeta(id, manifest.name, manifest.description);
    return { success: true };
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[addons] Failed to activate "${id}":`, message);
    setLastError(id, message);
    if (channels) teardownChannels(channels);
    return { success: false, error: message };
  }
}

/**
 * Deactivate a currently-active addon: best-effort `deactivate()` (bounded to
 * 5s so a hung addon can't block the app), then unconditional channel
 * teardown and live-registry removal regardless of whether `deactivate()`
 * succeeded.
 */
export async function deactivateAddon(id: string): Promise<{ success: boolean; error?: string }> {
  const live = liveAddons.get(id);
  if (!live) {
    return { success: false, error: `Addon "${id}" is not active` };
  }

  if (typeof live.mainModule?.deactivate === "function") {
    try {
      await Promise.race([
        Promise.resolve(live.mainModule.deactivate()),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("deactivate() timed out")), DEACTIVATE_TIMEOUT_MS),
        ),
      ]);
    } catch (error) {
      console.warn(`[addons] "${id}" deactivate() failed or timed out:`, getErrorMessage(error));
    }
  }

  teardownChannels(live.channels);
  liveAddons.delete(id);
  setActivated(id, false);
  return { success: true };
}

export async function deactivateAll(): Promise<void> {
  const ids = Array.from(liveAddons.keys());
  for (const id of ids) {
    await deactivateAddon(id);
  }
}

/**
 * Dev-unpacked install (§6.7) — the only install path that exists before
 * Phase 4's registry/signing installer. No consent-dialog machinery exists
 * yet, so a dev install implicitly grants every permission the manifest
 * declares (a deliberate, documented Phase-1 stand-in — see the phase report).
 * Gated to dev builds, matching the design doc's `!app.isPackaged` /
 * `MOSAIC_ADDON_DEV=1` rule.
 */
export async function installDevAddon(devPath: string): Promise<{ success: boolean; id?: string; error?: string }> {
  const devAllowed = !app.isPackaged || process.env.MOSAIC_ADDON_DEV === "1";
  if (!devAllowed) {
    return { success: false, error: "Dev addon install is only available in development builds" };
  }

  const root = path.resolve(devPath);
  const dirName = path.basename(root);

  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  } catch (error) {
    return { success: false, error: `Failed to read manifest.json: ${getErrorMessage(error)}` };
  }

  const result = validateManifest(json, dirName);
  if (!result.valid) {
    return { success: false, error: `Invalid manifest: ${result.errors.join("; ")}` };
  }
  const manifest = result.manifest;

  if (getAddonEntry(manifest.id)) {
    return { success: false, error: `Addon "${manifest.id}" is already installed` };
  }

  const installResult = recordInstall(manifest, { type: "dev", path: root }, manifest.permissions);
  if (!installResult.success) {
    return { success: false, error: installResult.error };
  }
  return { success: true, id: manifest.id };
}

// =============================================================================
// Startup / listing
// =============================================================================

/**
 * Converge the live registry to `addon-state.json`'s desired state. Called
 * once at app startup, after the static core plugin registrations (§8) so
 * reserved-namespace collision checks see reality. A per-addon failure is
 * caught (never crashes the app) and left for `lastError` to surface.
 */
export async function initAddons(): Promise<void> {
  const entries = listAddonEntries();
  for (const [id, entry] of Object.entries(entries)) {
    if (!entry.activated) continue;
    const result = await activateAddon(id);
    if (!result.success) {
      console.error(`[addons] Startup activation failed for "${id}": ${result.error}`);
    }
  }
}

export interface AddonSummary {
  id: string;
  name: string;
  description?: string;
  version: string;
  /** Actually running right now — distinct from the persisted desired state. */
  activated: boolean;
  lastError?: string;
  source: AddonStateEntry["source"];
  permissions: string[];
  linkVisibilityToActivation: boolean;
  updateCheckMode: AddonStateEntry["updateCheckMode"];
}

export function listAddons(): AddonSummary[] {
  const entries = listAddonEntries();
  return Object.entries(entries).map(([id, entry]) => {
    const live = liveAddons.get(id);
    // Prefer the persisted name/description (entry.name/description,
    // refreshed on every activation — see refreshManifestMeta) over the live
    // manifest cache, which is only populated while the addon is actually
    // active. Falling back to `live?.manifest...` covers state entries
    // written before this field existed; falls back to the bare id only if
    // neither is available (never activated even once, shouldn't normally
    // happen since install always activates immediately).
    return {
      id,
      name: entry.name ?? live?.manifest.name ?? id,
      description: entry.description ?? live?.manifest.description,
      version: entry.version,
      activated: liveAddons.has(id),
      lastError: entry.lastError,
      source: entry.source,
      permissions: entry.grantedPermissions,
      linkVisibilityToActivation: entry.linkVisibilityToActivation,
      updateCheckMode: entry.updateCheckMode,
    };
  });
}

// =============================================================================
// Live-registry accessors (Phase 2: protocol, webviews, addonAPI dispatcher)
// =============================================================================

export function isAddonActivated(id: string): boolean {
  return liveAddons.has(id);
}

/** Absolute addon root (dev path or `userData/addons/<id>`) — only returned
 * while the addon is actually live, which is what makes the protocol
 * handler's "deactivated ⇒ unreachable" guarantee (§4.1) hold. */
export function getLiveAddonRoot(id: string): string | undefined {
  return liveAddons.get(id)?.root;
}

export function getAddonDataDir(id: string): string | undefined {
  const live = liveAddons.get(id);
  return live ? path.join(live.root, "data") : undefined;
}

export function getGrantedPermissions(id: string): Set<string> {
  return liveAddons.get(id)?.granted ?? new Set();
}

export function getLiveManifest(id: string): AddonManifest | undefined {
  return liveAddons.get(id)?.manifest;
}

/** Looks up a method the addon's own `main/index.js` registered via
 * `ctx.ipc.handle` — the routing target for `addonAPI.invoke()` (§5.3). */
export function getAddonOwnHandler(
  id: string,
  method: string,
): ((...args: unknown[]) => unknown) | undefined {
  return liveAddons.get(id)?.handlersByMethod.get(method);
}

// =============================================================================
// Sidebar tab list (§6.3) and combined enable/disable (§3.4)
// =============================================================================

export interface AddonTabInfo {
  tabId: string;
  addonId: string;
  label: string;
  icon: string;
  order: number;
  activated: boolean;
  visible: boolean;
  /** manifest.renderer.entry, e.g. "renderer/index.html" — AddonHostView
   * strips the leading "renderer/" since the protocol already serves from
   * that directory. */
  rendererEntry: string;
  deepLinkParam?: string;
}

/**
 * Sidebar-ready addon tabs. Rule 1 (§3.2): "the sidebar shows an addon tab
 * iff installed && activated && visible" — an inactive addon contributes no
 * row at all here (not merely a hidden one), so an unknown/inactive addonId
 * reaching `AddonHostView` is unambiguously the "not available" case.
 */
export function listAddonTabs(): AddonTabInfo[] {
  const visibility = getTabVisibility();
  const tabs: AddonTabInfo[] = [];
  for (const [id, live] of liveAddons) {
    const tabId = `${ADDON_TAB_ID_PREFIX}${id}`;
    tabs.push({
      tabId,
      addonId: id,
      label: live.manifest.tab.label,
      icon: live.manifest.tab.icon,
      order: live.manifest.tab.order,
      activated: true,
      visible: visibility[tabId] !== false,
      rendererEntry: live.manifest.renderer.entry,
      deepLinkParam: live.manifest.tab.deepLink?.param,
    });
  }
  return tabs;
}

/**
 * The default combined on/off switch (§3.4, decision 8). Turning off runs
 * `deactivate()` then hides the tab; turning on runs `activate()` then shows
 * it. These stay two separate primitive calls run back-to-back — nothing
 * about `activateAddon`/`deactivateAddon`/the tab-visibility store changes;
 * this is orchestration on top, not a new transition.
 */
export async function setAddonEnabled(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const tabId = `${ADDON_TAB_ID_PREFIX}${id}`;

  if (enabled) {
    const result = await activateAddon(id);
    if (!result.success) return result;
    setCoreTabVisibility(tabId, true);
    return { success: true };
  }

  if (liveAddons.has(id)) {
    const result = await deactivateAddon(id);
    if (!result.success) return result;
  }
  setCoreTabVisibility(tabId, false);
  return { success: true };
}
