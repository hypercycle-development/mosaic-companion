/**
 * Startup auto-install of HyperInsight from the bundled payload.
 *
 * HyperInsight used to be part of core; on this branch it is an addon. Until
 * a signed catalogue exists there is no way for a user to install an addon
 * themselves, so shipping it as an addon without installing it would simply
 * remove the feature — from upgrading users who never happened to open the
 * tab (the old in-core state file was only written on first registration),
 * and from every fresh install.
 *
 * So it is installed for everyone, once per profile. **When the addon
 * repository is public and HyperInsight can be installed from the catalogue,
 * this should stop running for fresh profiles** — at that point not
 * installing it is a choice the user can reverse, which today it isn't.
 *
 * This is not the distribution channel (`installer.ts`'s
 * fetchCatalogue/confirmInstall, which needs a live signed registry over the
 * network). It calls the install/activate pipeline directly —
 * `recordInstall()` + `activateAddon()`, the same two calls `confirmInstall()`
 * makes internally — skipping download and signature verification because the
 * content isn't downloaded at all: it is copied out of the app bundle, which
 * the app's own code signing already covers.
 *
 * Runs before `initAddons()`'s activation convergence so the newly installed
 * addon activates in the same pass as everything else.
 *
 * The install is recorded in `bundledInstalled` (state.ts) rather than
 * inferred from `addons`, so that uninstalling HyperInsight keeps it
 * uninstalled instead of resurrecting it on the next launch.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "../utils";
import { getAddonEntry, recordInstall, hasBundledBeenInstalled, markBundledInstalled } from "./state";
import { activateAddon } from "./loader";
import { validateManifest } from "./manifest";

const ADDON_ID = "hyperinsight";

function bundledAddonRoot(): string {
  // __dirname here is dist/main (dev) or resources/app.asar/dist/main
  // (packaged) — mirrors main.ts's own PROJECT_ROOT resolution exactly, so
  // this stays correct under both dev and packaged builds without needing
  // its own asar-awareness.
  return path.join(__dirname, "..", "..", "bundled-addons", ADDON_ID);
}

/**
 * Recursive copy that works when the source is inside `app.asar`.
 *
 * `fs.cpSync` is NOT asar-aware: Electron's shim patches the read family
 * (readdirSync, readFileSync, statSync...) but not `cp`/`cpSync`, which
 * lstats the archive itself and fails with ENOTDIR. Verified against a real
 * packaged build — readdirSync and readFileSync on `bundled-addons/` both
 * succeed while cpSync throws, so the migration would create `addons/` and
 * then abort, and an upgrading user would silently lose HyperInsight.
 *
 * Built from the patched primitives instead, so it works whether the payload
 * is packed in the archive or sitting unpacked in a dev tree. Deliberately
 * not solved with `asarUnpack`, which would fix it only for packaged builds
 * and only while the copy relies on Electron's unpacked-path redirection.
 */
function copyOutOfAsar(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyOutOfAsar(from, to);
    } else {
      fs.writeFileSync(to, fs.readFileSync(from));
    }
  }
}

/** Only used to distinguish "carried across from the in-core version" from
 * "installed fresh" in the log line — no longer gates the install. */
function legacyFilesPresent(): boolean {
  const userData = app.getPath("userData");
  return (
    fs.existsSync(path.join(userData, "hyperinsight.json")) ||
    fs.existsSync(path.join(userData, "hyperinsight-tool-scores.json"))
  );
}

/** In-memory only, reset every launch — answers "did *this* launch just
 * auto-install HyperInsight", for the one-time non-blocking notice
 * (`addons:was-hyperinsight-just-migrated` IPC handler in main.ts). Never
 * persisted: the notice is meant to be seen once, this session, not
 * re-derived from state on a later launch. */
let justAutoInstalled = false;

export function wasHyperInsightJustAutoInstalled(): boolean {
  return justAutoInstalled;
}

export async function runHyperInsightAutoInstallMigration(): Promise<void> {
  justAutoInstalled = false;

  if (getAddonEntry(ADDON_ID)) {
    // Installed already — but backfill the marker if it's missing, otherwise
    // the "a deliberate uninstall sticks" guarantee below doesn't hold for
    // profiles that got HyperInsight some other way: the legacy-gated
    // migration this replaced, or a dev-corner install. Neither sets the
    // marker, so without this the first uninstall would be undone on the
    // next launch and only the second would stick.
    if (!hasBundledBeenInstalled(ADDON_ID)) markBundledInstalled(ADDON_ID, app.getVersion());
    return;
  }
  // Once per profile, not once per launch: this is what makes a deliberate
  // uninstall stick. Without it, removing HyperInsight would simply reinstall
  // it on the next start.
  if (hasBundledBeenInstalled(ADDON_ID)) return;

  const root = bundledAddonRoot();
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[hyperinsight] Bundled payload missing at ${manifestPath} — cannot auto-install`);
    return;
  }

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    console.error("[hyperinsight-migration] Failed to read bundled manifest.json:", getErrorMessage(error));
    return;
  }

  const result = validateManifest(manifestJson, ADDON_ID);
  if (!result.valid) {
    console.error("[hyperinsight-migration] Bundled manifest is invalid:", result.errors.join("; "));
    return;
  }
  const manifest = result.manifest;

  const targetRoot = path.join(app.getPath("userData"), "addons", ADDON_ID);
  try {
    if (fs.existsSync(targetRoot)) {
      // Shouldn't happen (getAddonEntry already returned above if truly
      // installed) but guard against a stray leftover directory from a
      // previously-interrupted attempt rather than fs.cpSync-ing on top of it.
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
    copyOutOfAsar(root, targetRoot);
  } catch (error) {
    console.error("[hyperinsight-migration] Failed to copy bundled addon into userData:", getErrorMessage(error));
    return;
  }

  const installResult = recordInstall(
    manifest,
    { type: "bundled", bundledFromVersion: app.getVersion() },
    manifest.permissions,
  );
  if (!installResult.success) {
    console.error("[hyperinsight-migration] recordInstall failed:", installResult.error);
    fs.rmSync(targetRoot, { recursive: true, force: true });
    return;
  }

  const activateResult = await activateAddon(ADDON_ID);
  if (!activateResult.success) {
    // Installed but not activated — the addon's own next activation attempt
    // (retry, or the user flipping it on in Settings → Addons) can still
    // lastError is recorded by activateAddon itself and surfaces in
    // Settings → Addons, where the user can toggle it on. There is no
    // automatic retry: recordInstall left it activated:false, so initAddons
    // skips it on subsequent launches.
    console.error("[hyperinsight-migration] Auto-activation failed:", activateResult.error);
  }

  markBundledInstalled(ADDON_ID, app.getVersion());
  console.log(
    legacyFilesPresent()
      ? "[hyperinsight] Auto-installed from the bundled payload, carrying across in-core HyperInsight state"
      : "[hyperinsight] Auto-installed from the bundled payload (no prior in-core state)",
  );
  justAutoInstalled = true;
}
