/**
 * Bucket store — single-writer feeds shared between addons.
 *
 * A bucket belongs to exactly one addon: the one that declared it in its
 * manifest. Readers reach it only through a grant the user made against that
 * specific bucket. Reading is voluntary — nothing here invokes anything in
 * another addon — so no capability ever crosses between them, which is the
 * property that makes this safe to build on rather than a feature bolted on.
 *
 * One writer per bucket is enforced by construction: every write path derives
 * its file from `ctx.addonId`, and there is no argument through which a caller
 * can name the owner it writes as. That also makes provenance free — a reader
 * never has to be told who wrote an item, because only one party could have.
 *
 * ## Handlers are synchronous on purpose
 *
 * Every operation is read file → merge → check caps → `writeFileAtomic`, with
 * no `await` anywhere in between. Node's event loop then serialises every
 * bucket operation against every other one, including a revoke arriving from
 * Settings on a different IPC channel. A single `await` between the read and
 * the rename would reintroduce a lost-update race between two webviews of the
 * same addon. Do not make these async.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "../utils";
import { writeFileAtomic } from "../utils/atomicWrite";
import type { ManifestBucketsConfig } from "./manifest";
import {
  getAddonEntry,
  listAddonEntries,
  findBucketGrant,
  hasDeclinedBucket,
  removeBucketGrantsAgainst,
  dropBucketGrant,
} from "./state";

// =============================================================================
// Shapes
// =============================================================================

/** What a publisher hands to `write`. `data` is any JSON value. */
export interface BucketItemInput {
  id: string;
  data: unknown;
}

/** What a reader gets back. `writtenAt` is host-assigned, never caller-supplied. */
export interface BucketItem {
  id: string;
  writtenAt: string;
  data: unknown;
}

export interface BucketStats {
  itemCount: number;
  bytes: number;
}

export interface BucketSummary {
  owner: string;
  bucket: string;
  kind: string;
  label: string;
  /** true for the caller's own declared buckets, false for granted ones. */
  own: boolean;
  itemCount: number;
  /** null until the first write. */
  updatedAt: string | null;
}

export interface BucketContents {
  owner: string;
  bucket: string;
  kind: string;
  label: string;
  items: BucketItem[];
}

/** A connection the host can offer the user, computed from declarations. */
export interface BucketProposal {
  readerId: string;
  readerName: string;
  owner: string;
  ownerName: string;
  bucket: string;
  kind: string;
  label: string;
}

/** On-disk shape. `owner`/`bucket`/`kind` are stored so a file that has been
 * moved, copied or hand-edited into the wrong slot is detectable. */
interface BucketFile {
  schemaVersion: 1;
  owner: string;
  bucket: string;
  kind: string;
  updatedAt: string;
  items: BucketItem[];
}

export const MAX_BUCKET_ITEMS = 2000;
/** Per bucket file — the same ceiling files.ts uses per file. */
export const MAX_BUCKET_BYTES = 10 * 1024 * 1024;
/** All of one publisher's buckets — the same ceiling files.ts uses per addon. */
export const MAX_PUBLISHER_BUCKET_BYTES = 200 * 1024 * 1024;
export const ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const ID_SEGMENT = /^[a-z][a-z0-9-]{1,40}$/;

// =============================================================================
// Paths
// =============================================================================

function bucketsRoot(): string {
  return path.join(app.getPath("userData"), "addon-buckets");
}

/**
 * Both segments have already passed `ID_SEGMENT`, which admits no separator
 * and no `..`, so this cannot escape the root. Callers must validate first;
 * this re-checks anyway, because a path builder that trusts its inputs is one
 * refactor away from being a traversal.
 */
function bucketPath(owner: string, bucket: string): string {
  if (!ID_SEGMENT.test(owner) || !ID_SEGMENT.test(bucket)) {
    throw new Error(`Refusing to build a bucket path from ${JSON.stringify([owner, bucket])}`);
  }
  return path.join(bucketsRoot(), owner, `${bucket}.json`);
}

// =============================================================================
// Reading and writing files
// =============================================================================

/**
 * Read a bucket file, or null when it does not exist or does not describe the
 * slot it was found in. A file whose stored `owner`/`bucket` disagree with its
 * path has been moved or edited, so it is quarantined rather than served:
 * serving it would attribute one addon's items to another.
 */
function readBucketFile(owner: string, bucket: string, kind: string): BucketFile | null {
  const file = bucketPath(owner, bucket);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BucketFile>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.owner !== owner ||
      parsed.bucket !== bucket ||
      !Array.isArray(parsed.items)
    ) {
      console.warn(`[addons/buckets] Ignoring a bucket file that does not describe its own slot: ${file}`);
      return null;
    }
    const items = parsed.items.filter(
      (it): it is BucketItem =>
        !!it && typeof it === "object" && typeof it.id === "string" && typeof it.writtenAt === "string",
    );
    return {
      schemaVersion: 1,
      owner,
      bucket,
      kind: typeof parsed.kind === "string" ? parsed.kind : kind,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      items,
    };
  } catch (error) {
    console.warn(`[addons/buckets] Unreadable bucket file ${file}: ${getErrorMessage(error)}`);
    return null;
  }
}

function serialise(file: BucketFile): string {
  return JSON.stringify(file, null, 2);
}

function byteLength(file: BucketFile): number {
  return Buffer.byteLength(serialise(file), "utf8");
}

function writeBucketFile(file: BucketFile): void {
  const target = bucketPath(file.owner, file.bucket);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  writeFileAtomic(target, serialise(file));
}

/** Total bytes across one publisher's buckets. Only ever called for the
 * publisher itself, never on a reader's behalf. */
function publisherBytes(owner: string): number {
  const dir = path.join(bucketsRoot(), owner);
  let total = 0;
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    try {
      total += fs.statSync(path.join(dir, name)).size;
    } catch {
      // A file that vanished between readdir and stat contributes nothing.
    }
  }
  return total;
}

// =============================================================================
// Access
// =============================================================================

/**
 * Live declaration for an addon, from the state snapshot rather than the
 * manifest cache — so it answers for an installed-but-inactive addon too.
 */
function declaredBuckets(id: string): ManifestBucketsConfig | undefined {
  return getAddonEntry(id)?.buckets;
}

/**
 * The caller's own declaration for one bucket, from the state snapshot.
 *
 * Equivalent to reading the live manifest, and deliberately preferred over it:
 * the snapshot is refreshed during `activateAddon` before the addon goes live,
 * and the dispatcher refuses calls from an addon that is not active — so for
 * any caller that can reach this, the two agree. Reading state instead keeps
 * this module independent of `loader.ts`, which drags in the protocol and
 * session machinery.
 */
export function ownBucketSpec(id: string, bucket: string) {
  return declaredBuckets(id)?.publishes.find((b) => b.id === bucket);
}

/**
 * The single access decision. Every input is already in memory, so the answer
 * cannot leak through a filesystem probe or an error path.
 *
 * Four conditions, all required — a grant alone is not enough, because both
 * sides' declarations can change under a grant that still exists:
 *
 *   1. a grant record exists for exactly this (reader, owner, bucket)
 *   2. the reader still declares that kind in `buckets.reads`
 *   3. the owner is still installed and still declares that bucket
 *   4. the owner still declares it under the kind the grant was made for
 *
 * (4) is the one that is easy to miss: consent was given for a feed of loop
 * drafts. If the owner republishes that id as something else, the grant does
 * not carry over to whatever it now means.
 *
 * DEACTIVATION IS DELIBERATELY NOT A FIFTH CONDITION — decided 2026-10-07
 * after this was raised in review. Turning an addon off stops its code
 * running; it does not retract data it already wrote and the user already
 * consented to someone reading. A reader that lost access whenever an
 * unrelated addon was toggled off would start getting `null` with no event
 * explaining it, and `read` cannot explain it by design.
 *
 * This is NOT inconsistent with `connectableBucketPairs()` refusing to OFFER a
 * connection to a deactivated publisher, though the two look alike. Offering
 * asks the user to consent on the strength of a declaration nothing is
 * currently honouring; reading relies on consent already given about data
 * already written. Different acts, different rule.
 */
export function canRead(readerId: string, owner: string, bucket: string): { kind: string; label: string } | null {
  if (readerId === owner) {
    const spec = ownBucketSpec(readerId, bucket);
    return spec ? { kind: spec.kind, label: spec.label } : null;
  }
  const grant = findBucketGrant(readerId, owner, bucket);
  if (!grant) return null;
  if (!declaredBuckets(readerId)?.reads.includes(grant.kind)) return null;
  const spec = ownBucketSpec(owner, bucket);
  if (!spec || spec.kind !== grant.kind) return null;
  return { kind: spec.kind, label: spec.label };
}

// =============================================================================
// Operations — all synchronous, see the header
// =============================================================================

/** Upsert by id: an existing item keeps its position and gets a fresh
 * `writtenAt`; new items are appended in call order. */
export function writeItems(owner: string, bucket: string, kind: string, items: BucketItemInput[]): BucketStats {
  const existing = readBucketFile(owner, bucket, kind);
  const merged: BucketItem[] = existing ? [...existing.items] : [];
  const now = new Date().toISOString();

  for (const input of items) {
    const i = merged.findIndex((it) => it.id === input.id);
    const next: BucketItem = { id: input.id, writtenAt: now, data: input.data };
    if (i >= 0) merged[i] = next;
    else merged.push(next);
  }

  if (merged.length > MAX_BUCKET_ITEMS) {
    throw new RangeError(`Write exceeds the ${MAX_BUCKET_ITEMS}-item per-bucket cap`);
  }

  const file: BucketFile = { schemaVersion: 1, owner, bucket, kind, updatedAt: now, items: merged };
  const bytes = byteLength(file);
  if (bytes > MAX_BUCKET_BYTES) {
    throw new RangeError(`Write exceeds the ${MAX_BUCKET_BYTES}-byte per-bucket cap`);
  }

  // The publisher's other buckets, plus what this one is about to become.
  const currentSize = existing ? byteLength(existing) : 0;
  if (publisherBytes(owner) - currentSize + bytes > MAX_PUBLISHER_BUCKET_BYTES) {
    throw new RangeError(`Write exceeds the ${MAX_PUBLISHER_BUCKET_BYTES}-byte per-addon bucket cap`);
  }

  writeBucketFile(file);
  return { itemCount: merged.length, bytes };
}

/** `ids` omitted removes everything but keeps the file, so `updatedAt`
 * survives and `list()` still reports a bucket that has been written. */
export function clearItems(owner: string, bucket: string, kind: string, ids?: string[]): BucketStats {
  const existing = readBucketFile(owner, bucket, kind);
  if (!existing) return { itemCount: 0, bytes: 0 };

  const remaining = ids === undefined ? [] : existing.items.filter((it) => !ids.includes(it.id));
  const file: BucketFile = { ...existing, updatedAt: new Date().toISOString(), items: remaining };
  writeBucketFile(file);
  return { itemCount: remaining.length, bytes: byteLength(file) };
}

/**
 * Rows come from declarations and grants; only then is each *named* file
 * stat'ed. No directory is ever listed on a reader's behalf, so this cannot
 * become an oracle for what an addon owns.
 */
export function listFor(callerId: string): BucketSummary[] {
  const rows: BucketSummary[] = [];

  for (const spec of declaredBuckets(callerId)?.publishes ?? []) {
    const file = readBucketFile(callerId, spec.id, spec.kind);
    rows.push({
      owner: callerId,
      bucket: spec.id,
      kind: spec.kind,
      label: spec.label,
      own: true,
      itemCount: file?.items.length ?? 0,
      updatedAt: file?.updatedAt ?? null,
    });
  }

  for (const grant of getAddonEntry(callerId)?.bucketGrants ?? []) {
    const access = canRead(callerId, grant.owner, grant.bucket);
    if (!access) continue;
    const file = readBucketFile(grant.owner, grant.bucket, access.kind);
    rows.push({
      owner: grant.owner,
      bucket: grant.bucket,
      kind: access.kind,
      label: access.label,
      own: false,
      itemCount: file?.items.length ?? 0,
      updatedAt: file?.updatedAt ?? null,
    });
  }

  return rows.sort((a, b) => (a.owner === b.owner ? a.bucket.localeCompare(b.bucket) : a.owner.localeCompare(b.owner)));
}

/**
 * `null` for every no-access case, indistinguishably: no such owner, no such
 * bucket, never granted, declined, revoked, owner uninstalled, or the owner's
 * manifest no longer declares it. That sameness is the enumeration defence —
 * a reader must not be able to tell "you may not" from "it is not there".
 */
export function readFor(callerId: string, owner: string, bucket: string): BucketContents | null {
  const access = canRead(callerId, owner, bucket);
  if (!access) return null;
  const file = readBucketFile(owner, bucket, access.kind);
  return {
    owner,
    bucket,
    kind: access.kind,
    label: access.label,
    items: file?.items ?? [],
  };
}

// =============================================================================
// Notification
// =============================================================================

export interface BucketChangedPayload {
  owner: string;
  bucket: string;
  kind: string;
  change: "write" | "clear" | "granted" | "revoked";
  /** For "write", the ids written; for a targeted "clear", the ids removed.
   * Omitted for clear-all, "granted" and "revoked". Never item data — a
   * notification must not become a way to read without reading. */
  itemIds?: string[];
  /** After the change; 0 for "revoked". */
  itemCount: number;
}

/**
 * How a notification actually reaches a webview. Injected rather than imported
 * so this module stays about storage and access: pulling `webviews.ts` in
 * directly would drag the protocol and session machinery behind it, and the
 * store has no business knowing how delivery works. `main.ts` wires the real
 * one at startup; until then, and in tests, notifications go nowhere.
 */
export type BucketEventSink = (payload: BucketChangedPayload, addonIds: ReadonlySet<string>) => void;

let sink: BucketEventSink = () => {};

export function setBucketEventSink(next: BucketEventSink): void {
  sink = next;
}

/**
 * Tell the readers who may currently see this bucket that it changed.
 *
 * Recipients are computed per emit against live grants, not from the
 * subscription list — subscribing to the channel is unprivileged, so the
 * filtering has to happen here or an unconnected addon would learn that a
 * bucket exists and how often it changes.
 *
 * The owner is not a recipient of its own write/clear: it already knows, and
 * echoing would just invite a write loop.
 *
 * `explicitRecipients` covers "revoked", where the grant has already gone and
 * `canRead` would (correctly) refuse the very readers who need telling.
 */
export function emitBucketChanged(
  payload: BucketChangedPayload,
  explicitRecipients?: readonly string[],
): void {
  const recipients = new Set<string>(explicitRecipients ?? []);
  if (!explicitRecipients) {
    for (const readerId of Object.keys(listAddonEntries())) {
      if (readerId === payload.owner) continue;
      if (canRead(readerId, payload.owner, payload.bucket)) recipients.add(readerId);
    }
  }
  if (recipients.size === 0) return;
  sink(payload, recipients);
}

// =============================================================================
// Lifecycle
// =============================================================================

/**
 * Every reader/bucket pair connectable on today's declarations — both sides
 * activated, kinds matching, no grant yet — annotated with whether the user
 * has already said no to it.
 *
 * Proposals and declined connections are two filters over ONE list on
 * purpose. As two separate walks of the same four loops they would eventually
 * drift, and a pair the offer logic accepts but the reconnect logic rejects is
 * a connection the user can neither be offered nor reinstate — precisely the
 * deadlock this function exists to end.
 */
function connectableBucketPairs(): Array<BucketProposal & { declined: boolean }> {
  const entries = listAddonEntries();
  const pairs: Array<BucketProposal & { declined: boolean }> = [];

  for (const [readerId, reader] of Object.entries(entries)) {
    if (!reader.activated) continue;
    for (const kind of reader.buckets?.reads ?? []) {
      for (const [ownerId, owner] of Object.entries(entries)) {
        if (ownerId === readerId || !owner.activated) continue;
        for (const spec of owner.buckets?.publishes ?? []) {
          if (spec.kind !== kind) continue;
          if (findBucketGrant(readerId, ownerId, spec.id)) continue;
          pairs.push({
            readerId,
            readerName: reader.name ?? readerId,
            owner: ownerId,
            ownerName: owner.name ?? ownerId,
            bucket: spec.id,
            kind,
            label: spec.label,
            declined: hasDeclinedBucket(readerId, ownerId, spec.id, spec.kind),
          });
        }
      }
    }
  }
  return pairs;
}

const withoutDeclinedFlag = ({
  declined: _declined,
  ...proposal
}: BucketProposal & { declined: boolean }): BucketProposal => proposal;

/** Every connection the host could offer right now, unprompted. */
export function listBucketProposals(): BucketProposal[] {
  return connectableBucketPairs().filter((p) => !p.declined).map(withoutDeclinedFlag);
}

/**
 * Connections the user declined, which remain connectable if they change
 * their mind. These are surfaced in Settings, never re-prompted: "Not now"
 * must stop the host asking, or it is not a decline — but it must not also
 * mean "never", which would make a misclick unrecoverable short of
 * uninstalling the addon.
 */
export function listDeclinedBucketConnections(): BucketProposal[] {
  return connectableBucketPairs().filter((p) => p.declined).map(withoutDeclinedFlag);
}

/**
 * Bring the store back in line with what an addon now declares. Runs on every
 * activation, so it covers upgrades, dev "Reload" and startup alike.
 *
 * A kind change is treated as remove-then-add rather than a rename: the old
 * feed and its grants go, and the new declaration starts empty. Carrying
 * grants across a kind change would silently repurpose consent the user gave
 * for something else.
 *
 * Returns the reader ids whose grants were dropped, so the caller can tell them.
 */
export function reconcileBucketsForAddon(id: string, buckets: ManifestBucketsConfig): string[] {
  const affected = new Set<string>();
  const declared = new Map(buckets.publishes.map((b) => [b.id, b]));

  // As owner: drop files and grants for buckets no longer declared as they were.
  const dir = path.join(bucketsRoot(), id);
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const bucket = name.slice(0, -".json".length);
    const spec = declared.get(bucket);
    let stale = !spec;
    if (spec) {
      const file = readBucketFile(id, bucket, spec.kind);
      stale = !!file && file.kind !== spec.kind;
    }
    if (stale) {
      try {
        fs.rmSync(path.join(dir, name), { force: true });
      } catch (error) {
        console.warn(`[addons/buckets] Could not remove stale bucket ${name}: ${getErrorMessage(error)}`);
      }
      for (const reader of removeBucketGrantsAgainst(id, bucket)) affected.add(reader);
    }
  }

  // A bucket declared but never written still needs its grants swept if its
  // kind changed — there is no file to notice it by.
  for (const [readerId, entry] of Object.entries(listAddonEntries())) {
    for (const grant of entry.bucketGrants ?? []) {
      if (grant.owner !== id) continue;
      const spec = declared.get(grant.bucket);
      if (!spec || spec.kind !== grant.kind) {
        removeBucketGrantsAgainst(id, grant.bucket);
        affected.add(readerId);
      }
    }
  }

  // As reader: drop grants for kinds this addon no longer reads.
  //
  // ONE reader's grant, not every reader's. `removeBucketGrantsAgainst` sweeps
  // the whole state for a given (owner, bucket), which is right when the
  // PUBLISHER stops offering a feed — everyone loses it together — and wrong
  // here, where only this addon changed what it reads. Using it meant one
  // addon dropping a kind silently revoked every other reader's access to the
  // same bucket, discarding consent the user had given and then re-proposing
  // it, so they were asked to re-approve something they never withdrew.
  //
  // Snapshot the list first: dropBucketGrant writes back to the same array.
  const entry = getAddonEntry(id);
  const stale = (entry?.bucketGrants ?? []).filter((g) => !buckets.reads.includes(g.kind));
  for (const grant of stale) {
    dropBucketGrant(id, grant.owner, grant.bucket);
    affected.add(id);
  }

  return [...affected];
}

/** Uninstalling a publisher takes its buckets with it, regardless of
 * `keepData` — that option is about the addon's own `data/`, and a reader's
 * access to someone else's feed should not outlive the feed. */
export function purgeBucketsForOwner(owner: string): string[] {
  try {
    fs.rmSync(path.join(bucketsRoot(), owner), { recursive: true, force: true });
  } catch (error) {
    console.warn(`[addons/buckets] Could not purge buckets for "${owner}": ${getErrorMessage(error)}`);
  }
  return removeBucketGrantsAgainst(owner);
}
