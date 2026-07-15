/**
 * `addon-state.json` — the install/activation registry (§3.1). Owned entirely
 * by this module; atomic write-temp-then-rename, mirroring the pattern
 * `plugins/hyperinsight/main/index.js` already uses for
 * `hyperinsight-tool-scores.json`.
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
  | { type: "dev"; path: string };

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
}

interface AddonStateFile {
  schemaVersion: 1;
  addons: Record<string, AddonStateEntry>;
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

export function removeAddonEntry(id: string): void {
  delete state.addons[id];
  saveAddonState();
}

// Load on module initialization, mirroring electron/settings.ts.
loadAddonState();
