/**
 * §9.2 / §10 Phase 7 — one-time "auto-install HyperInsight for upgrading
 * profiles" migration.
 *
 * Runs once at startup, before `initAddons()`'s regular activation
 * convergence (§8) — that ordering is what makes the newly-installed addon
 * activate in the very same pass as everything else, not a separate later
 * step.
 *
 * This is NOT the distribution channel (`installer.ts`'s
 * fetchCatalogue/confirmInstall, which needs a live signed registry over the
 * network) — mosaic-addons has no real published registry yet, and even
 * once it does, an upgrading user must get continuity offline, on the very
 * first launch after the app update, with zero network dependency and zero
 * consent dialog (decision 1). Instead this calls the install/activate
 * *pipeline* directly: `recordInstall()` (state.ts) + `activateAddon()`
 * (loader.ts), the same two calls `confirmInstall()` makes internally,
 * skipping only the download/sha256/signature-verification steps — because
 * the content isn't downloaded at all, it's copied from
 * `bundled-addons/hyperinsight/`, which ships inside this app release and
 * is therefore already trusted by the app's own code-signing, the same way
 * every other file in the app bundle is.
 *
 * Detection: legacy core files (`userData/hyperinsight.json` and/or
 * `userData/hyperinsight-tool-scores.json`) existing is exactly the signal
 * that this profile pre-dates Phase 7 — the same signal the addon's own
 * `main/index.js` uses (on its first `activate()`) to migrate the
 * encrypted key/clientId and score cache into its own storage and remove
 * those legacy files. A fresh profile at or above the Phase-7 app version
 * never had those files, so it never triggers this path — it sees
 * HyperInsight in the addon catalogue like any other addon (once
 * mosaic-addons has a real published registry to list it in).
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "../utils";
import { getAddonEntry, recordInstall } from "./state";
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

  if (getAddonEntry(ADDON_ID)) return; // already installed — nothing to do, every launch after the first
  if (!legacyFilesPresent()) return; // fresh profile — no prior HyperInsight experience to preserve

  const root = bundledAddonRoot();
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`[hyperinsight-migration] Legacy files present but ${manifestPath} is missing — cannot auto-install`);
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
    // pick this up; lastError is already recorded by activateAddon itself.
    console.error("[hyperinsight-migration] Auto-activation failed:", activateResult.error);
  }

  console.log("[hyperinsight-migration] Auto-installed HyperInsight for an upgrading profile");
  justAutoInstalled = true;
}
