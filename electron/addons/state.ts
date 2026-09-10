/**
 * `addon-state.json` — the install/activation registry. Owned entirely
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
import type { AddonManifest, ManifestBucketsConfig, UpdateCheckMode } from "./manifest";
import { findIn, type WithdrawalRecord } from "./withdrawal";

export type { WithdrawalRecord } from "./withdrawal";

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
       * auto-install time — never downloaded, never
       * network-verified, trusted because it shipped inside this app
       * release. Root resolves the same as "registry" (a real copy under
       * userData/addons/<id>/, safe to delete on uninstall) — see
       * loader.ts's getAddonRoot and installer.ts's uninstall code-deletion
       * check, both of which treat "bundled" the same as "registry". */
      type: "bundled";
      bundledFromVersion: string;
    };

/**
 * A reader's permission to read one bucket belonging to one publisher.
 *
 * This is the enforcement source for `buckets.read`/`list`, and it is checked
 * live on every call rather than snapshotted at activation — so a revoke in
 * Settings takes effect on the next read, not on the next restart.
 *
 * `kind` records what the user was actually told they were connecting. If the
 * owner later republishes that bucket id under a different kind, the grant no
 * longer matches and access stops: consent was given for a feed of loop
 * drafts, not for whatever else that id comes to mean.
 */
export interface BucketGrant {
  /** Publisher addon id. */
  owner: string;
  /** Bucket id, as the owner declared it. */
  bucket: string;
  /** The kind at grant time. */
  kind: string;
  grantedAt: string;
}

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
  /** Buckets this addon, as a reader, may read. */
  bucketGrants?: BucketGrant[];
  /** `"<owner>/<bucket>"` keys the user declined or revoked, so the host stops
   * re-proposing the same connection at every activation. A later Connect
   * from Settings clears the key. */
  bucketDeclined?: string[];
  /** Snapshot of `manifest.buckets`, refreshed on every activation alongside
   * name/description. Lets proposals and the owner-side checks work for an
   * installed-but-inactive addon without re-reading its manifest.json. */
  buckets?: ManifestBucketsConfig;
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
  /**
   * Rollback defence. Every registry carries a strictly-increasing
   * `sequence`; we persist the highest ever *verified* and refuse anything
   * lower. Without this, a signed registry stays valid forever, so an
   * attacker who can control what we fetch replays a pre-withdrawal registry
   * and the whole mechanism silently does nothing. Signature verification
   * alone proves authenticity, never freshness.
   */
  registrySync?: { highestSequence: number; lastSuccessAt: string };
  /**
   * Addon id → withdrawal. Persisted so a withdrawal survives being offline
   * and is enforced at activation without a fetch. Entries are reconciled —
   * added *and removed* — from each registry that passes the sequence check,
   * which is what makes a withdrawal liftable: a later registry that omits
   * the entry lifts it, and an older one cannot forge that because it is
   * rejected before reconciliation.
   *
   * Not tamper-resistant: this file is plaintext in userData and any process
   * running as the user can edit it. That is not a regression — the same
   * attacker can flip `activated`, rewrite `grantedPermissions`, or replace
   * the addon's code on disk outright.
   */
  withdrawals?: Record<string, WithdrawalRecord>;
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
        registrySync: isPlainRecord(parsed?.registrySync) ? (parsed.registrySync as AddonStateFile["registrySync"]) : undefined,
        withdrawals: isPlainRecord(parsed?.withdrawals) ? (parsed.withdrawals as Record<string, WithdrawalRecord>) : {},
      };
    } else {
      state = { schemaVersion: 1, addons: {} };
    }
  } catch (error) {
    console.error("[addons/state] Failed to load addon-state.json:", getErrorMessage(error));
    state = { schemaVersion: 1, addons: {} };
  }
  normalizeBucketFields();
  return state;
}

const BUCKET_KEY_SEGMENT = /^[a-z][a-z0-9-]{1,40}$/;

/**
 * Drop bucket records that are not the shape we wrote. A grant is an access
 * decision, so anything we cannot fully understand is discarded rather than
 * repaired or trusted — a half-read grant must never be the reason a reader
 * reaches a bucket. Dropping is safe in the direction that matters: the worst
 * case is that the user is asked to connect again.
 */
function normalizeBucketFields(): void {
  for (const [id, entry] of Object.entries(state.addons)) {
    if (!entry || typeof entry !== "object") continue;

    if (entry.bucketGrants !== undefined) {
      if (!Array.isArray(entry.bucketGrants)) {
        console.warn(`[addons/state] Dropping non-array bucketGrants for "${id}"`);
        entry.bucketGrants = [];
      } else {
        const kept = entry.bucketGrants.filter((g) => {
          const ok =
            isPlainRecord(g) &&
            typeof g.owner === "string" && BUCKET_KEY_SEGMENT.test(g.owner) &&
            typeof g.bucket === "string" && BUCKET_KEY_SEGMENT.test(g.bucket) &&
            typeof g.kind === "string" && BUCKET_KEY_SEGMENT.test(g.kind) &&
            typeof g.grantedAt === "string";
          if (!ok) console.warn(`[addons/state] Dropping malformed bucket grant on "${id}"`);
          return ok;
        });
        entry.bucketGrants = kept as BucketGrant[];
      }
    }

    if (entry.bucketDeclined !== undefined && !Array.isArray(entry.bucketDeclined)) {
      entry.bucketDeclined = [];
    } else if (Array.isArray(entry.bucketDeclined)) {
      entry.bucketDeclined = entry.bucketDeclined.filter((k) => typeof k === "string");
    }

    if (entry.buckets !== undefined) {
      const b: unknown = entry.buckets;
      const ok = isPlainRecord(b) && Array.isArray(b.publishes) && Array.isArray(b.reads);
      if (!ok) {
        console.warn(`[addons/state] Dropping malformed buckets snapshot for "${id}"`);
        entry.buckets = undefined;
      }
    }
  }
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
 * `updateCheckMode` from the manifest's defaults, sets
 * `activated: false` (a separate `activate` call turns it on), and
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
    buckets: manifest.buckets,
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
export function refreshManifestMeta(
  id: string,
  name: string,
  description: string | undefined,
  buckets?: ManifestBucketsConfig,
): void {
  const entry = state.addons[id];
  if (!entry) return;
  const bucketsChanged = buckets !== undefined && JSON.stringify(entry.buckets) !== JSON.stringify(buckets);
  if (entry.name === name && entry.description === description && !bucketsChanged) return;
  entry.name = name;
  entry.description = description;
  if (buckets !== undefined) entry.buckets = buckets;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

// =============================================================================
// Bucket grants
// =============================================================================
//
// Every accessor here is main-process only. The renderer never sees a grant it
// can act on: Settings sends a (reader, owner, bucket) selector and main
// re-derives the rest, so a renderer cannot mint a grant for a bucket the
// owner does not declare.

const declinedKey = (owner: string, bucket: string): string => `${owner}/${bucket}`;

export function getBucketGrants(readerId: string): BucketGrant[] {
  return state.addons[readerId]?.bucketGrants ?? [];
}

export function findBucketGrant(readerId: string, owner: string, bucket: string): BucketGrant | undefined {
  return getBucketGrants(readerId).find((g) => g.owner === owner && g.bucket === bucket);
}

export function hasDeclinedBucket(readerId: string, owner: string, bucket: string): boolean {
  return (state.addons[readerId]?.bucketDeclined ?? []).includes(declinedKey(owner, bucket));
}

/** Upsert a grant and clear any declined key for it. */
export function grantBucket(readerId: string, grant: Omit<BucketGrant, "grantedAt">): void {
  const entry = state.addons[readerId];
  if (!entry) return;
  const grants = entry.bucketGrants ?? [];
  const next: BucketGrant = { ...grant, grantedAt: new Date().toISOString() };
  const i = grants.findIndex((g) => g.owner === grant.owner && g.bucket === grant.bucket);
  if (i >= 0) grants[i] = next;
  else grants.push(next);
  entry.bucketGrants = grants;
  entry.bucketDeclined = (entry.bucketDeclined ?? []).filter((k) => k !== declinedKey(grant.owner, grant.bucket));
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/** Record a "Not now" so the same connection is not proposed again. */
export function declineBucket(readerId: string, owner: string, bucket: string): void {
  const entry = state.addons[readerId];
  if (!entry) return;
  const key = declinedKey(owner, bucket);
  if (!(entry.bucketDeclined ?? []).includes(key)) {
    entry.bucketDeclined = [...(entry.bucketDeclined ?? []), key];
    entry.updatedAt = new Date().toISOString();
    saveAddonState();
  }
}

/** Remove a grant and record it as declined, so revoking is not undone by the
 * next activation re-proposing the same connection. */
export function revokeBucket(readerId: string, owner: string, bucket: string): void {
  const entry = state.addons[readerId];
  if (!entry) return;
  entry.bucketGrants = (entry.bucketGrants ?? []).filter((g) => !(g.owner === owner && g.bucket === bucket));
  const key = declinedKey(owner, bucket);
  if (!(entry.bucketDeclined ?? []).includes(key)) entry.bucketDeclined = [...(entry.bucketDeclined ?? []), key];
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/**
 * Sweep every reader's grants against one publisher — all of its buckets, or
 * one. Used when a publisher is uninstalled, or stops declaring a bucket, or
 * republishes it under a different kind. Returns the reader ids affected, so
 * the caller can tell them.
 */
export function removeBucketGrantsAgainst(owner: string, bucket?: string): string[] {
  const affected: string[] = [];
  for (const [id, entry] of Object.entries(state.addons)) {
    const grants = entry.bucketGrants ?? [];
    if (grants.length === 0) continue;
    const kept = grants.filter((g) => !(g.owner === owner && (bucket === undefined || g.bucket === bucket)));
    if (kept.length !== grants.length) {
      entry.bucketGrants = kept;
      entry.updatedAt = new Date().toISOString();
      affected.push(id);
    }
  }
  if (affected.length > 0) saveAddonState();
  return affected;
}

/** Refresh the manifest snapshot outside an activation (used on upgrade, to
 * close the window where an upgraded-but-inactive addon's old declaration
 * would still be what proposals are computed from). */
export function setBucketsSnapshot(id: string, buckets: ManifestBucketsConfig): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.buckets = buckets;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/**
 * Overwrites the granted-permissions snapshot — the enforcement source,
 * independent of whatever the manifest currently requests. This is
 * what the Settings → Addons consent flow calls after the user
 * approves a permission set; it's also what makes the
 * upgrade-escalation pause (if an upgrade's manifest requests
 * permissions beyond the granted snapshot, the addon stays deactivated
 * until the user re-consents) a real, testable state rather than an
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

/** The per-addon "Advanced: control activation and visibility
 * independently" override — flipping it takes no action on current state,
 * it only changes how future `setAddonEnabled` toggles behave. */
export function setLinkVisibilityToActivation(id: string, linked: boolean): void {
  const entry = state.addons[id];
  if (!entry) return;
  entry.linkVisibilityToActivation = linked;
  entry.updatedAt = new Date().toISOString();
  saveAddonState();
}

/** Per-addon manual/automatic update-*check* mode (never
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

// =============================================================================
// Registry freshness + withdrawals
// =============================================================================

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getRegistrySync(): { highestSequence: number; lastSuccessAt: string } | undefined {
  return state.registrySync;
}

/** Highest registry sequence ever verified. 0 when nothing has been fetched —
 * a fresh profile trusts the first validly-signed registry it sees (documented
 * TOFU window; it closes at the next fetch). */
export function getHighestRegistrySequence(): number {
  const value = state.registrySync?.highestSequence;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function recordRegistrySync(sequence: number): void {
  state.registrySync = { highestSequence: sequence, lastSuccessAt: new Date().toISOString() };
  saveAddonState();
}

export function getWithdrawals(): Record<string, WithdrawalRecord> {
  return { ...(state.withdrawals ?? {}) };
}

export function getWithdrawal(id: string): WithdrawalRecord | undefined {
  return state.withdrawals?.[id];
}

/**
 * Replaces the whole withdrawal set. Called only after a registry has passed
 * the sequence check, so omissions are a deliberate lift by the publisher
 * rather than something an old or truncated registry can cause.
 */
export function replaceWithdrawals(next: Record<string, WithdrawalRecord>): void {
  state.withdrawals = { ...next };
  saveAddonState();
}

/**
 * Is this exact installed version withdrawn? Returns the record so callers can
 * quote the reason. An unparseable range fails **closed** — a malformed
 * withdrawal still withdraws, because the alternative is that a typo in the
 * registry silently re-enables an addon the publisher meant to pull.
 */
export function findWithdrawal(id: string, version: string): WithdrawalRecord | undefined {
  return findIn(state.withdrawals ?? {}, id, version);
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
