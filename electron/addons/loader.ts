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
import { validateManifest, type AddonManifest } from "./manifest";
import {
  getAddonEntry,
  listAddonEntries,
  recordInstall,
  setActivated,
  setLastError,
  type AddonStateEntry,
} from "./state";

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

function readAddonSettings(id: string): Record<string, unknown> {
  try {
    const p = addonSettingsPath(id);
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (error) {
    console.error(`[addons] Failed to read settings for "${id}":`, getErrorMessage(error));
    return {};
  }
}

function writeAddonSettings(id: string, patch: Record<string, unknown>): void {
  const next = { ...readAddonSettings(id), ...patch };
  const json = JSON.stringify(next, null, 2);
  if (Buffer.byteLength(json, "utf8") > ADDON_SETTINGS_MAX_BYTES) {
    throw new Error(`Addon settings for "${id}" would exceed ${ADDON_SETTINGS_MAX_BYTES} bytes`);
  }
  const p = addonSettingsPath(id);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmpPath = `${p}.tmp`;
  fs.writeFileSync(tmpPath, json, "utf8");
  fs.renameSync(tmpPath, p);
}

// =============================================================================
// Root resolution + manifest (re-)loading
// =============================================================================

function getAddonRoot(id: string, entry: AddonStateEntry): string {
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

function buildCtx(manifest: AddonManifest, root: string): { ctx: AddonCtx; channels: Set<string> } {
  const channels = new Set<string>();
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
      },
      removeHandler: (name) => {
        const channel = `addon:${manifest.ipcNamespace}:${name}`;
        ipcMain.removeHandler(channel);
        channels.delete(channel);
      },
    },
    events: {
      // No live webContents registry exists yet — that's Phase 2's
      // webviews.ts. Accepting the call as a documented no-op means addon
      // mains can call ctx.events.send from day one without a call-site
      // change once Phase 2 wires real delivery.
      send: () => {
        /* no-op until Phase 2 */
      },
    },
    paths: { root, data: dataDir },
    settings: {
      get: () => readAddonSettings(manifest.id),
      set: (patch) => writeAddonSettings(manifest.id, patch),
    },
    log: (...args: unknown[]) => console.log(`[addon:${manifest.id}]`, ...args),
  };

  return { ctx, channels };
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
      granted: new Set(entry.grantedPermissions),
    });

    setActivated(id, true);
    setLastError(id, undefined);
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
  version: string;
  /** Actually running right now — distinct from the persisted desired state. */
  activated: boolean;
  lastError?: string;
  source: AddonStateEntry["source"];
  permissions: string[];
}

export function listAddons(): AddonSummary[] {
  const entries = listAddonEntries();
  return Object.entries(entries).map(([id, entry]) => {
    const live = liveAddons.get(id);
    return {
      id,
      name: live?.manifest.name ?? id,
      version: entry.version,
      activated: liveAddons.has(id),
      lastError: entry.lastError,
      source: entry.source,
      permissions: entry.grantedPermissions,
    };
  });
}
