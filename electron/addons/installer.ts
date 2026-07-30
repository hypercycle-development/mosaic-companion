/**
 * Registry fetch/verify, install/uninstall/upgrade pipelines (§6.7, §3.1,
 * §3.2). This is the *only* module that talks to the network or unpacks a
 * tarball — everything downstream (loader.ts) only ever deals with already-
 * validated, already-unpacked addon directories.
 *
 * Install pipeline (§6.7): fetch registry.json + .sig → verify signature →
 * download tarball → sha256 verify → unpack to staging → validate manifest →
 * cross-check id/version/permissions against the (now-trusted) registry
 * entry → consent → atomic move → state entry → activate.
 */

import { app, session } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import semver from "semver";
import * as tar from "tar";
import { getErrorMessage } from "../utils";
import { verifyRegistry, trustedPublisherKeys, type RegistrySignatureEnvelope } from "./signing";
import { validateManifest, type AddonManifest } from "./manifest";
import {
  getAddonEntry,
  listAddonEntries,
  recordInstall,
  recordUpgrade,
  removeAddonEntry,
  setGrantedPermissions,
  type AddonSource,
} from "./state";
import { activateAddon, deactivateAddon, isAddonActivated, getAddonRoot } from "./loader";
import { dirSizeBytes } from "./api/files";

// =============================================================================
// Registry location. Build constants, deliberately not renderer-overridable
// (see the `addons:fetch-catalogue` handler in main.ts) — the `opts` params
// below are for main-process callers and tests only.
//
// No signed catalogue is published yet: the production signing key doesn't
// exist, so `trustedPublisherKeys()` is empty in a packaged build and
// `fetchCatalogue` reports the catalogue as unavailable rather than failing
// verification against a URL that may not even be serving a registry.
// =============================================================================

export const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/hypercycle-development/mosaic-addons/main/addon-registry.json";
export const DEFAULT_REGISTRY_SIG_URL =
  "https://raw.githubusercontent.com/hypercycle-development/mosaic-addons/main/addon-registry.json.sig";

// The `MOSAIC_ADDON_REGISTRY_TOKEN` shim that used to live here existed only
// because mosaic-addons was a private repo, so unauthenticated fetches to
// raw.githubusercontent.com 404'd. The repo is public now, so registry
// fetches are plain unauthenticated `fetch` again and the app carries no
// credential for the catalogue at all.

// =============================================================================
// Types
// =============================================================================

export interface CatalogueEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  minAppVersion?: string;
  tarballUrl: string;
  sha256: string;
  permissions: string[];
  icon?: string;
  homepage?: string;
}

interface RegistryFile {
  schemaVersion: number;
  addons: CatalogueEntry[];
}

// Cached from the last successful fetchCatalogue() — install/upgrade look
// entries up here rather than re-fetching, matching "on-demand... no
// background polling" (§6.7).
let cachedCatalogue: Record<string, CatalogueEntry> = {};
let cachedVerifiedKeyId: string | undefined;

export function getCachedCatalogueEntry(id: string): CatalogueEntry | undefined {
  return cachedCatalogue[id];
}

// =============================================================================
// Catalogue fetch + signature verification
// =============================================================================

export async function fetchCatalogue(opts?: {
  registryUrl?: string;
  sigUrl?: string;
}): Promise<{ success: boolean; addons?: CatalogueEntry[]; error?: string; unavailable?: boolean }> {
  // Distinguish "no catalogue is published yet" from "the catalogue is
  // broken". With no trust anchor there is nothing a registry could say that
  // we'd believe, so don't fetch at all — and let the UI say so plainly
  // rather than showing a signature-verification failure.
  if (trustedPublisherKeys().length === 0) {
    return {
      success: false,
      unavailable: true,
      error: "No addon catalogue is published yet — addons are installed manually for now.",
    };
  }

  const registryUrl = opts?.registryUrl ?? DEFAULT_REGISTRY_URL;
  const sigUrl = opts?.sigUrl ?? DEFAULT_REGISTRY_SIG_URL;

  let registryBytes: Buffer;
  let sigJson: unknown;
  try {
    const [registryResp, sigResp] = await Promise.all([fetch(registryUrl), fetch(sigUrl)]);
    if (!registryResp.ok) return { success: false, error: `Failed to fetch registry: HTTP ${registryResp.status}` };
    if (!sigResp.ok) return { success: false, error: `Failed to fetch registry signature: HTTP ${sigResp.status}` };
    registryBytes = Buffer.from(await registryResp.arrayBuffer());
    sigJson = await sigResp.json();
  } catch (error) {
    return { success: false, error: `Network error fetching registry: ${getErrorMessage(error)}` };
  }

  // Unrecognized keyId or failed verification both reject outright — no
  // unsigned fallback, no "try anyway" (§6.7).
  const verifyResult = verifyRegistry(registryBytes, sigJson as RegistrySignatureEnvelope);
  if (!verifyResult.verified) {
    return { success: false, error: `Registry signature verification failed: ${verifyResult.reason}` };
  }

  let registry: RegistryFile;
  try {
    registry = JSON.parse(registryBytes.toString("utf8"));
  } catch (error) {
    return { success: false, error: `Malformed registry JSON: ${getErrorMessage(error)}` };
  }
  if (!Array.isArray(registry.addons)) {
    return { success: false, error: "Malformed registry: addons must be an array" };
  }

  const nextCache: Record<string, CatalogueEntry> = {};
  for (const entry of registry.addons) {
    if (entry && typeof entry.id === "string") nextCache[entry.id] = entry;
  }
  cachedCatalogue = nextCache;
  cachedVerifiedKeyId = verifyResult.keyId;

  return { success: true, addons: registry.addons };
}

// =============================================================================
// Shared download → sha256 → unpack → validate step
// =============================================================================

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

interface StagedTarball {
  stagingDir: string;
  manifest: AddonManifest;
}

/** Downloads `entry.tarballUrl`, verifies sha256, unpacks to a fresh staging
 * dir under `userData/addon-tmp/`, and validates the manifest inside it.
 * Throws on any failure — callers wrap in try/catch and clean up staging. */
async function downloadVerifyUnpack(entry: CatalogueEntry): Promise<StagedTarball> {
  let tarballBuf: Buffer;
  try {
    const resp = await fetch(entry.tarballUrl);
    if (!resp.ok) throw new Error(`Failed to download tarball: HTTP ${resp.status}`);
    tarballBuf = Buffer.from(await resp.arrayBuffer());
  } catch (error) {
    throw new Error(`Network error downloading tarball: ${getErrorMessage(error)}`);
  }

  const actualSha256 = sha256Hex(tarballBuf);
  if (actualSha256.toLowerCase() !== entry.sha256.toLowerCase()) {
    throw new Error(`Tarball sha256 mismatch (expected ${entry.sha256}, got ${actualSha256}) — aborting install`);
  }

  const tmpRoot = path.join(app.getPath("userData"), "addon-tmp");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const tarballPath = path.join(tmpRoot, `${entry.id}-${uniqueSuffix}.tgz`);
  const stagingDir = path.join(tmpRoot, `${entry.id}-${uniqueSuffix}`);

  fs.writeFileSync(tarballPath, tarballBuf);
  fs.mkdirSync(stagingDir, { recursive: true });
  try {
    await tar.extract({ file: tarballPath, cwd: stagingDir });
  } finally {
    fs.rmSync(tarballPath, { force: true });
  }

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(fs.readFileSync(path.join(stagingDir, "manifest.json"), "utf8"));
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(`Tarball has no valid manifest.json: ${getErrorMessage(error)}`);
  }

  const result = validateManifest(manifestJson, entry.id);
  if (!result.valid) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(`Invalid manifest in tarball: ${result.errors.join("; ")}`);
  }

  // Cross-check against the (now-trusted) registry entry — mismatch aborts (§6.7).
  const manifest = result.manifest;
  if (manifest.id !== entry.id) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(`Manifest id "${manifest.id}" does not match registry entry "${entry.id}"`);
  }
  if (manifest.version !== entry.version) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error(`Manifest version "${manifest.version}" does not match registry entry "${entry.version}"`);
  }
  const permsMatch =
    manifest.permissions.length === entry.permissions.length &&
    manifest.permissions.every((p) => entry.permissions.includes(p));
  if (!permsMatch) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw new Error("Manifest permissions do not match the registry entry — install aborted");
  }

  return { stagingDir, manifest };
}

function sourceFor(entry: CatalogueEntry): AddonSource {
  return {
    type: "registry",
    tarballUrl: entry.tarballUrl,
    sha256: entry.sha256,
    registrySignatureVerified: true,
    verifiedKeyId: cachedVerifiedKeyId || "",
  };
}

// =============================================================================
// Install (needsConsent → confirm, §6.2)
// =============================================================================

export function beginInstall(id: string): { success: boolean; needsConsent?: string[]; error?: string } {
  const catalogueEntry = cachedCatalogue[id];
  if (!catalogueEntry) return { success: false, error: `Addon "${id}" not found in catalogue — fetch it first` };
  if (getAddonEntry(id)) return { success: false, error: `Addon "${id}" is already installed` };
  return { success: true, needsConsent: catalogueEntry.permissions };
}

export async function confirmInstall(
  id: string,
  acceptedPermissions: string[],
): Promise<{ success: boolean; error?: string }> {
  const catalogueEntry = cachedCatalogue[id];
  if (!catalogueEntry) return { success: false, error: `Addon "${id}" not found in catalogue — fetch it first` };
  if (getAddonEntry(id)) return { success: false, error: `Addon "${id}" is already installed` };

  let staged: StagedTarball;
  try {
    staged = await downloadVerifyUnpack(catalogueEntry);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }

  const missing = staged.manifest.permissions.filter((p) => !acceptedPermissions.includes(p));
  if (missing.length > 0) {
    fs.rmSync(staged.stagingDir, { recursive: true, force: true });
    return { success: false, error: `Missing consent for: ${missing.join(", ")}` };
  }

  const finalRoot = path.join(app.getPath("userData"), "addons", id);
  try {
    fs.mkdirSync(path.dirname(finalRoot), { recursive: true });
    if (fs.existsSync(finalRoot)) {
      fs.rmSync(staged.stagingDir, { recursive: true, force: true });
      return { success: false, error: `Addon directory already exists for "${id}"` };
    }
    fs.renameSync(staged.stagingDir, finalRoot);
  } catch (error) {
    fs.rmSync(staged.stagingDir, { recursive: true, force: true });
    return { success: false, error: getErrorMessage(error) };
  }

  // Reinstall: restore any retained data left from a prior uninstall (§3.1).
  const retainedDataDir = path.join(app.getPath("userData"), "addon-data-retained", id);
  if (fs.existsSync(retainedDataDir)) {
    const targetDataDir = path.join(finalRoot, "data");
    fs.rmSync(targetDataDir, { recursive: true, force: true });
    fs.renameSync(retainedDataDir, targetDataDir);
  }

  const installResult = recordInstall(staged.manifest, sourceFor(catalogueEntry), acceptedPermissions);
  if (!installResult.success) {
    return { success: false, error: installResult.error };
  }

  const activateResult = await activateAddon(id);
  if (!activateResult.success) {
    return { success: true, error: `Installed but failed to activate: ${activateResult.error}` };
  }
  return { success: true };
}

// =============================================================================
// Data size (uninstall dialog, §3.1)
// =============================================================================

export function getDataSize(id: string): number {
  const entry = getAddonEntry(id);
  if (!entry) return 0;
  const root = getAddonRoot(id, entry);
  return dirSizeBytes(path.join(root, "data"));
}

// =============================================================================
// Uninstall (independently-selectable retention, §3.1)
// =============================================================================

export async function uninstallAddon(
  id: string,
  opts: { keepSettings: boolean; keepData: boolean },
): Promise<{ success: boolean; error?: string }> {
  const entry = getAddonEntry(id);
  if (!entry) return { success: false, error: `Addon "${id}" is not installed` };

  if (isAddonActivated(id)) {
    const deactivateResult = await deactivateAddon(id);
    if (!deactivateResult.success) return deactivateResult;
  }

  const root = getAddonRoot(id, entry);
  const dataDir = path.join(root, "data");
  const userDataPath = app.getPath("userData");

  if (opts.keepData && fs.existsSync(dataDir)) {
    const retainedDir = path.join(userDataPath, "addon-data-retained", id);
    fs.mkdirSync(path.dirname(retainedDir), { recursive: true });
    fs.rmSync(retainedDir, { recursive: true, force: true });
    fs.renameSync(dataDir, retainedDir);
  }

  const settingsPath = path.join(userDataPath, "addon-settings", `${id}.json`);
  if (!opts.keepSettings && fs.existsSync(settingsPath)) {
    fs.rmSync(settingsPath, { force: true });
  }

  try {
    const partitionSession = session.fromPartition(`persist:addon:${id}`);
    if (!opts.keepData) {
      await partitionSession.clearStorageData();
    }
  } catch (error) {
    console.warn(`[addons] Failed to handle webview partition for "${id}":`, getErrorMessage(error));
  }

  // Code is always deleted — but only for registry and bundled installs. A
  // dev addon's "root" is the addon author's own working directory; Mosaic
  // must never delete that (§6.7's dev workflow — uninstall just forgets
  // the state entry). "bundled" (§9.2) is a real copy under userData/addons/
  // just like "registry", safe to delete the same way.
  if (entry.source.type === "registry" || entry.source.type === "bundled") {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // tabVisibility["addon:<id>"] is unconditionally retained — harmless,
  // presentational, and nothing here touches electron/settings.ts's map.
  removeAddonEntry(id);
  return { success: true };
}

// =============================================================================
// Upgrade (§3.2) — re-entrant: call once with no `acceptedPermissions` to
// attempt the upgrade; if it pauses for a permission escalation, call again
// with the user's `acceptedPermissions` to complete it. This mirrors
// install's needsConsent/confirm split without inventing a second channel
// name the design doc's §6.2 preload table doesn't list.
// =============================================================================

export async function upgradeAddon(
  id: string,
  acceptedPermissions?: string[],
): Promise<{ success: boolean; needsConsent?: string[]; error?: string }> {
  const entry = getAddonEntry(id);
  if (!entry) return { success: false, error: `Addon "${id}" is not installed` };
  if (entry.source.type !== "registry") {
    return { success: false, error: "Only registry-installed addons can be upgraded" };
  }

  const catalogueEntry = cachedCatalogue[id];
  if (!catalogueEntry) return { success: false, error: `Addon "${id}" not found in catalogue — fetch it first` };

  if (acceptedPermissions) {
    setGrantedPermissions(id, acceptedPermissions);
  }

  let staged: StagedTarball;
  try {
    staged = await downloadVerifyUnpack(catalogueEntry);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }

  // Re-read the entry — setGrantedPermissions above (if called) already
  // landed; grantedPermissions is the enforcement source, not the manifest.
  const currentEntry = getAddonEntry(id);
  const grantedNow = currentEntry?.grantedPermissions ?? [];
  const missing = staged.manifest.permissions.filter((p) => !grantedNow.includes(p));
  if (missing.length > 0) {
    fs.rmSync(staged.stagingDir, { recursive: true, force: true });
    // Pause for re-consent (§3.1) — old version is completely untouched.
    return { success: false, needsConsent: missing };
  }

  if (isAddonActivated(id)) {
    await deactivateAddon(id);
  }

  const root = getAddonRoot(id, entry);
  const dataDir = path.join(root, "data");
  const dataBackupDir = path.join(
    app.getPath("userData"),
    "addon-tmp",
    `${id}-data-backup-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
  );
  const hadData = fs.existsSync(dataDir);

  try {
    if (hadData) fs.renameSync(dataDir, dataBackupDir);
    fs.rmSync(root, { recursive: true, force: true });
    fs.renameSync(staged.stagingDir, root);
    if (hadData) {
      const newDataDir = path.join(root, "data");
      fs.rmSync(newDataDir, { recursive: true, force: true });
      fs.renameSync(dataBackupDir, newDataDir);
    }
  } catch (error) {
    return { success: false, error: `Upgrade failed while swapping files: ${getErrorMessage(error)}` };
  }

  recordUpgrade(id, staged.manifest.version, sourceFor(catalogueEntry));

  const activateResult = await activateAddon(id);
  if (!activateResult.success) {
    return { success: true, error: `Upgraded but failed to reactivate: ${activateResult.error}` };
  }
  return { success: true };
}

// =============================================================================
// Automatic update-check pass (§7.2, decision 7) — once per app launch, not
// a recurring poll. Manual mode (default) only checks when the user opens
// the catalogue or hits Refresh; this only runs for addons that opted into
// "Automatic", and does one registry fetch total (not one per addon).
// =============================================================================

/** id -> latest known available version, populated by the pass below.
 * Purely in-memory — recomputed every launch, never persisted. */
const updateAvailableCache: Record<string, string> = {};

export function getAvailableUpdateVersion(id: string): string | undefined {
  return updateAvailableCache[id];
}

export async function runAutomaticUpdateCheckPass(opts?: {
  registryUrl?: string;
  sigUrl?: string;
}): Promise<void> {
  const entries = listAddonEntries();
  const automaticIds = Object.entries(entries)
    .filter(([, entry]) => entry.updateCheckMode === "automatic" && entry.source.type === "registry")
    .map(([id]) => id);
  if (automaticIds.length === 0) return;

  const result = await fetchCatalogue(opts).catch(() => ({ success: false as const }));
  if (!result.success || !result.addons) return; // best-effort — no error surfaced beyond this

  for (const id of automaticIds) {
    const entry = entries[id];
    const catalogueEntry = result.addons.find((a) => a.id === id);
    if (!catalogueEntry) continue;
    try {
      if (semver.gt(catalogueEntry.version, entry.version)) {
        updateAvailableCache[id] = catalogueEntry.version;
      }
    } catch {
      /* malformed version string somewhere — skip this addon's badge, not fatal */
    }
  }
}
