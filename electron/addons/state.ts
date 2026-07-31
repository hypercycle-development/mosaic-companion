/**
 * `addon-state.json` — the install/activation registry (§3.1). Owned entirely
 * by this module; atomic write-temp-then-rename (the same pattern the
 * HyperInsight addon's own main/index.js uses for its tool-scores cache).
 *
 * `grantedPermissions` on each entry is the enforcement source, not the
 * manifest — `loader.ts` checks a manifest's declared permissions against
 * this snapshot at activation time, never the other way around.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "../utils";
import type { AddonManifest, UpdateCheckMode } from "./manifest";

// =============================================================================
// Types
// =============================================================================

export type AddonSource =
  | {
      type: "registry";
      tarballUrl: string;
      sha256: string;
      registrySignatureVerified: boolean;
      verifiedKeyId: string;
    }
  | { type: "dev"; path: string }
  | {
      /** Copied from mosaic-companion's own `bundled-addons/<id>/` at
       * auto-install time (§9.2, §10 Phase 7) — never downloaded, never
       * network-verified, trusted because it shipped inside this app
       * release. Root resolves the same as "registry" (a real copy under
       * userData/addons/<id>/, safe to delete on uninstall) — see
       * loader.ts's getAddonRoot and installer.ts's uninstall code-deletion
       * check, both of which treat "bundled" the same as "registry". */
      type: "bundled";
      bundledFromVersion: string;
    };

export interface AddonStateEntry {
  version: string;
  /** Desired state — the startup loader converges to this; a failed
   * convergence attempt records `lastError` without flipping this back. */
  activated: boolean;
  installedAt: string;
  updatedAt: string;
  /** Snapshot approved at install/upgrade time — the enforcement source. */
  grantedPermissions: string[];
  linkVisibilityToActivation: boolean;
  updateCheckMode: UpdateCheckMode;
  source: AddonSource;
  lastError?: string;
  /** Display name/description, persisted here (not read live off the
   * manifest cache) so a deactivated addon still shows its real name in
   * Settings — `listAddons()` used to fall back to the bare id and drop the
   * description entirely for anything not currently in the live registry,
   * which read as "the addon is broken/gone" right when a user deactivates
   * it. Kept in sync on every successful activate() (loader.ts), seeded at
   * install time below. Optional only for entries written before this field
   * existed — `listAddons()` still falls back to the live manifest / id for
   * those until their next activation refreshes it. */
  name?: string;
  description?: string;
}

interface AddonStateFile {
  schemaVersion: 1;
  addons: Record<string, AddonStateEntry>;
  /**
   * Addon id → app version that first auto-installed it from the bundled
   * payload. Separate from `addons` because it must survive uninstall: it is
   * what stops a bundled addon reappearing on the next launch after the user
   * deliberately removed it.
   */
  bundledInstalled?: Record<string, string>;
}

// =============================================================================
// Storage
// =============================================================================

const addonStatePath = path.join(app.getPath("userData"), "addon-state.json");

let state: AddonStateFile = { schemaVersion: 1, addons: {} };

export function loadAddonState(): AddonStateFile {
  try {
    if (fs.existsSync(addonStatePath)) {
      const raw = fs.readFileSync(addonStatePath, "utf8");
      const parsed = JSON.parse(raw);
      state = {
        schemaVersion: 1,
        addons: parsed && typeof parsed.addons === "object" && parsed.addons !== null ? parsed.addons : {},
        bundledInstalled:
          parsed && typeof parsed.bundledInstalled === "object" && parsed.bundledInstalled !== null
            ? parsed.bundledInstalled
            : {},
      };
    } else {
      state = { schemaVersion: 1, addons: {} };
    }
  } catch (error) {
    console.error("[addons/state] Failed to load addon-state.json:", getErrorMessage(error));
    state = { schemaVersion: 1, addons: {} };
  }
  return state;
}

/** Atomic write: temp file → rename (prevents partial reads on crash). */
function saveAddonState(): { success: boolean; error?: string } {
  try {
    const tmpPath = `${addonStatePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmpPath, addonStatePath);
    return { success: true };
  } catch (error) {
    console.error("[addons/state] Failed to save addon-state.json:", getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

// =============================================================================
// Accessors
// =============================================================================

export function getAddonEntry(id: string): AddonStateEntry | undefined {
  return state.addons[id];
}

export function listAddonEntries(): Record<string, AddonStateEntry> {
  return { ...state.addons };
}

/**
 * Records a fresh install: seeds `linkVisibilityToActivation` and
 * `updateCheckMode` from the manifest's defaults (§2, §3.1), sets
 * `activated: false` (a separate `activate` call turns it on — §3.2), and
 * snapshots `grantedPermissions` as the enforcement source going forward.
 */
export function recordInstall(
  manifest: AddonManifest,
  source: AddonSource,
  grantedPermissions: string[],
): { success: boolean; entry?: AddonStateEntry; error?: string } {
  const now = new Date().toISOString();
  const entry: AddonStateEntry = {
    version: manifest.version,
    activated: false,
    installedAt: now,
    updatedAt: now,
    grantedPermissions: [...grantedPermissions],
    linkVisibilityToActivation: manifest.linkVisibilityToActivation,
    updateCheckMode: manifest.updates.checkMode,
    source,
    name: manifest.name,
    description: manifest.description,
  };
  state.addons[manifest.id] = entry;
  const result = saveAddonState();
  return { ...result, entry };
}

export function setActivated(id: string, activated: boolean): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.activated = activated;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

export function setLastError(id: string, error: string | undefined): void {
  const entry = state.addons[id];
  if (!entry) return;
  if (error) {
    entry.lastError = error;
  } else {
    delete entry.lastError;
  }
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/** Refreshes the persisted display name/description from a freshly-loaded
 * manifest — called on every successful `activateAddon()` (loader.ts), which
 * already re-reads manifest.json from disk. Keeps Settings → Addons showing
 * the real name for a deactivated addon (not the bare id) and picks up a
 * dev addon's edited name/description on its next "Reload" without a
 * separate migration step. Deliberately does not bump `updatedAt` or write
 * to disk when nothing changed, so a routine activation isn't a guaranteed
 * disk write. */
export function refreshManifestMeta(id: string, name: string, description: string | undefined): void {
  const entry = state.addons[id];
  if (!entry) return;
  if (entry.name === name && entry.description === description) return;
  entry.name = name;
  entry.description = description;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/**
 * Overwrites the granted-permissions snapshot — the enforcement source
 * (§3.1), independent of whatever the manifest currently requests. This is
 * what a future Settings → Addons consent flow (Phase 4) will call after the
 * user approves a permission set; it's also what makes the
 * upgrade-escalation pause (§3.1: "if an upgrade's manifest requests
 * permissions beyond the granted snapshot, the addon stays deactivated
 * until the user re-consents") a real, testable state rather than an
 * aspirational note — `activateAddon` already refuses to activate when
 * `manifest.permissions ⊄ grantedPermissions`.
 */
export function setGrantedPermissions(id: string, permissions: string[]): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.grantedPermissions = [...permissions];
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

export function removeAddonEntry(id: string): void {
  delete state.addons[id];
  saveAddonState();
}

/** §3.4's per-addon "Advanced: control activation and visibility
 * independently" override — flipping it takes no action on current state,
 * it only changes how future `setAddonEnabled` toggles behave. */
export function setLinkVisibilityToActivation(id: string, linked: boolean): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.linkVisibilityToActivation = linked;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/** §7.2/decision 7 — per-addon manual/automatic update-*check* mode (never
 * auto-*install*). */
export function setUpdateCheckMode(id: string, mode: UpdateCheckMode): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.updateCheckMode = mode;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/**
 * Records a completed upgrade in place: bumps `version`, replaces `source`
 * (new tarballUrl/sha256/signature bookkeeping), and — critically — does
 * **not** touch `grantedPermissions`. The caller (`installer.ts`) is
 * responsible for having already confirmed `newManifest.permissions ⊆
 * grantedPermissions` (or collected fresh consent and called
 * `setGrantedPermissions` first) before calling this; that ordering is what
 * makes the upgrade-escalation pause real.
 */
export function recordUpgrade(id: string, version: string, source: AddonSource): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.version = version;
  entry.source = source;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

// Load on module initialization, mirroring electron/settings.ts.
loadAddonState();

// =============================================================================
// Bundled auto-install bookkeeping
// =============================================================================

/** Has this addon ever been auto-installed from the app's bundled payload?
 * True keeps it uninstalled once the user removes it — without this the
 * startup auto-install would put it back on the next launch. */
export function hasBundledBeenInstalled(id: string): boolean {
  return Boolean(state.bundledInstalled?.[id]);
}

export function markBundledInstalled(id: string, appVersion: string): void {
  state.bundledInstalled = { ...(state.bundledInstalled ?? {}), [id]: appVersion };
  saveAddonState();
}
