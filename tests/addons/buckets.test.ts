/**
 * The bucket store — who may read what, and what the caps actually do. Run with:
 *
 *   npx esbuild tests/addons/buckets.test.ts --bundle --platform=node \
 *     --alias:electron=./tests/stubs/electron.ts \
 *     --outfile=dist/buckets.test.cjs && node dist/buckets.test.cjs
 *
 * The negative cases are the point of this file. A bucket is one addon's data
 * exposed to another, so "a reader without a grant gets nothing" and "it gets
 * the *same* nothing whether or not the bucket exists" are the properties that
 * have to hold; the happy paths are here to stop those being vacuous.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { userDataDir, resetUserData } from "../stubs/electron";
import type { AddonManifest, ManifestBucketsConfig } from "../../electron/addons/manifest";
import {
  loadAddonState,
  recordInstall,
  setActivated,
  grantBucket,
  revokeBucket,
  declineBucket,
  findBucketGrant,
  removeAddonEntry,
  getBucketGrants,
  setBucketsSnapshot,
} from "../../electron/addons/state";
import { methods as api } from "../../electron/addons/api/buckets";
import {
  writeItems,
  clearItems,
  listFor,
  readFor,
  canRead,
  listBucketProposals,
  listDeclinedBucketConnections,
  reconcileBucketsForAddon,
  purgeBucketsForOwner,
  MAX_BUCKET_ITEMS,
  MAX_BUCKET_BYTES,
} from "../../electron/addons/buckets";

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    reset();
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────

const buckets = (b: Partial<ManifestBucketsConfig>): ManifestBucketsConfig => ({
  publishes: b.publishes ?? [],
  reads: b.reads ?? [],
});

function manifest(id: string, b: ManifestBucketsConfig): AddonManifest {
  return {
    manifestVersion: 1,
    id,
    version: "1.0.0",
    name: id,
    description: `${id} addon`,
    ipcNamespace: id,
    mountPoint: "tab",
    tab: { label: id, icon: "box", order: 100 },
    renderer: { entry: "renderer/index.html" },
    permissions: b.publishes.length ? ["buckets:publish"] : [],
    updates: { checkMode: "manual" },
    linkVisibilityToActivation: true,
    buckets: b,
  } as AddonManifest;
}

function install(id: string, b: ManifestBucketsConfig, activated = true): void {
  const m = manifest(id, b);
  recordInstall(m, { type: "dev", path: `/tmp/${id}` }, m.permissions);
  setActivated(id, activated);
}

const GRAPH = buckets({ publishes: [{ id: "loop-drafts", kind: "loop-draft", history: "all", label: "Loop drafts" }] });
const LOOPS = buckets({ reads: ["loop-draft"] });

function reset(): void {
  resetUserData();
  loadAddonState();
}

/** Both addons installed, loops granted read on graph's bucket. */
function connectedPair(): void {
  install("graph", GRAPH);
  install("loops", LOOPS);
  grantBucket("loops", { owner: "graph", bucket: "loop-drafts", kind: "loop-draft" });
}

const item = (id: string, data: unknown = { n: 1 }) => ({ id, data });

console.log("\nbucket store\n");

// ── writing: upsert, ordering, provenance ───────────────────────────────────

check("a write creates the file and reports its stats", () => {
  install("graph", GRAPH);
  const stats = writeItems("graph", "loop-drafts", "loop-draft", [item("a"), item("b")]);
  assert.strictEqual(stats.itemCount, 2);
  assert.ok(stats.bytes > 0);
  assert.ok(fs.existsSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json")));
});

check("new items are appended in call order", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a"), item("b"), item("c")]);
  const contents = readFor("graph", "graph", "loop-drafts");
  assert.deepStrictEqual(contents?.items.map((i) => i.id), ["a", "b", "c"]);
});

check("an upsert keeps position and replaces data", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a", { v: 1 }), item("b")]);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a", { v: 2 })]);
  const items = readFor("graph", "graph", "loop-drafts")?.items ?? [];
  assert.deepStrictEqual(items.map((i) => i.id), ["a", "b"], "position must be kept");
  assert.deepStrictEqual(items[0].data, { v: 2 });
});

check("writtenAt is host-assigned and a caller-supplied one is ignored", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [
    { id: "a", data: { x: 1 }, writtenAt: "1999-01-01T00:00:00.000Z" } as never,
  ]);
  const items = readFor("graph", "graph", "loop-drafts")?.items ?? [];
  assert.notStrictEqual(items[0].writtenAt, "1999-01-01T00:00:00.000Z");
});

// ── caps ────────────────────────────────────────────────────────────────────

check("exceeding the item cap is rejected and the file is unchanged", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("keep")]);
  const tooMany = Array.from({ length: MAX_BUCKET_ITEMS + 1 }, (_, i) => item(`x${i}`));
  assert.throws(() => writeItems("graph", "loop-drafts", "loop-draft", tooMany), /2000-item/);
  const items = readFor("graph", "graph", "loop-drafts")?.items ?? [];
  assert.deepStrictEqual(items.map((i) => i.id), ["keep"], "a rejected write must change nothing");
});

check("exceeding the per-bucket byte cap is rejected", () => {
  install("graph", GRAPH);
  const big = "x".repeat(MAX_BUCKET_BYTES);
  assert.throws(() => writeItems("graph", "loop-drafts", "loop-draft", [item("a", big)]), /per-bucket cap/);
  assert.strictEqual(fs.existsSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json")), false);
});

check("after a clear, a write that had hit the item cap succeeds", () => {
  install("graph", GRAPH);
  const full = Array.from({ length: MAX_BUCKET_ITEMS }, (_, i) => item(`x${i}`));
  writeItems("graph", "loop-drafts", "loop-draft", full);
  assert.throws(() => writeItems("graph", "loop-drafts", "loop-draft", [item("one-more")]), /2000-item/);
  clearItems("graph", "loop-drafts", "loop-draft");
  const stats = writeItems("graph", "loop-drafts", "loop-draft", [item("one-more")]);
  assert.strictEqual(stats.itemCount, 1);
});

// ── curation ────────────────────────────────────────────────────────────────

check("clear with no ids empties the bucket but keeps the file", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a"), item("b")]);
  const stats = clearItems("graph", "loop-drafts", "loop-draft");
  assert.strictEqual(stats.itemCount, 0);
  assert.ok(fs.existsSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json")));
  assert.deepStrictEqual(readFor("graph", "graph", "loop-drafts")?.items, []);
});

check("clear with ids removes only those, and ignores unknown ones", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a"), item("b"), item("c")]);
  clearItems("graph", "loop-drafts", "loop-draft", ["b", "nope"]);
  assert.deepStrictEqual(readFor("graph", "graph", "loop-drafts")?.items.map((i) => i.id), ["a", "c"]);
});

check("clear on a never-written bucket is a no-op and creates no file", () => {
  install("graph", GRAPH);
  const stats = clearItems("graph", "loop-drafts", "loop-draft");
  assert.deepStrictEqual(stats, { itemCount: 0, bytes: 0 });
  assert.strictEqual(fs.existsSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json")), false);
});

// ── access: the negative cases are the point ────────────────────────────────

check("a reader with no grant gets null for a populated bucket", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.strictEqual(readFor("loops", "graph", "loop-drafts"), null);
});

check("a reader gets the SAME null for a bucket that does not exist", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  const denied = readFor("loops", "graph", "loop-drafts");
  const absent = readFor("loops", "graph", "no-such-bucket");
  const noOwner = readFor("loops", "nobody", "loop-drafts");
  assert.strictEqual(denied, null);
  assert.strictEqual(absent, null);
  assert.strictEqual(noOwner, null);
});

check("a granted reader sees the full contents, including items written before the grant", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  writeItems("graph", "loop-drafts", "loop-draft", [item("before")]);
  grantBucket("loops", { owner: "graph", bucket: "loop-drafts", kind: "loop-draft" });
  writeItems("graph", "loop-drafts", "loop-draft", [item("after")]);
  const items = readFor("loops", "graph", "loop-drafts")?.items ?? [];
  assert.deepStrictEqual(items.map((i) => i.id), ["before", "after"], "history:all means pre-grant items are visible");
});

check("a revoked reader gets null on the very next read", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.ok(readFor("loops", "graph", "loop-drafts"));
  revokeBucket("loops", "graph", "loop-drafts");
  assert.strictEqual(readFor("loops", "graph", "loop-drafts"), null);
});

check("a grant does not survive the owner republishing that bucket under a new kind", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.ok(canRead("loops", "graph", "loop-drafts"), "granted before the change");
  // Same bucket id, different meaning. Consent was for loop drafts.
  const changed = buckets({ publishes: [{ id: "loop-drafts", kind: "invoice", history: "all", label: "Invoices" }] });
  reconcileBucketsForAddon("graph", changed);
  assert.strictEqual(canRead("loops", "graph", "loop-drafts"), null);
});

check("a reader that stops declaring the kind loses access", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  reconcileBucketsForAddon("loops", buckets({ reads: ["something-else"] }));
  assert.strictEqual(canRead("loops", "graph", "loop-drafts"), null);
});

check("an owner may read its own bucket without a grant, but only if it declares it", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.ok(readFor("graph", "graph", "loop-drafts"));
  assert.strictEqual(readFor("graph", "graph", "undeclared"), null);
});

check("a granted but never-written bucket reads as empty, not null", () => {
  connectedPair();
  const contents = readFor("loops", "graph", "loop-drafts");
  assert.ok(contents, "a declared, granted bucket is readable before its first write");
  assert.deepStrictEqual(contents?.items, []);
});

// ── list ────────────────────────────────────────────────────────────────────

check("list shows own buckets and granted ones, and marks which is which", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  const graphRows = listFor("graph");
  assert.deepStrictEqual(graphRows.map((r) => [r.bucket, r.own]), [["loop-drafts", true]]);
  const loopsRows = listFor("loops");
  assert.deepStrictEqual(loopsRows.map((r) => [r.bucket, r.own]), [["loop-drafts", false]]);
  assert.strictEqual(loopsRows[0].itemCount, 1);
});

check("a reader with no grants lists nothing", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.deepStrictEqual(listFor("loops"), []);
});

check("a revoked reader's row disappears from list", () => {
  connectedPair();
  assert.strictEqual(listFor("loops").length, 1);
  revokeBucket("loops", "graph", "loop-drafts");
  assert.deepStrictEqual(listFor("loops"), []);
});

// ── proposals ───────────────────────────────────────────────────────────────

check("a matching publisher and reader produce one proposal", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  const proposals = listBucketProposals();
  assert.strictEqual(proposals.length, 1);
  assert.deepStrictEqual(
    [proposals[0].readerId, proposals[0].owner, proposals[0].bucket, proposals[0].kind],
    ["loops", "graph", "loop-drafts", "loop-draft"],
  );
});

check("an already-granted pair is not proposed again", () => {
  connectedPair();
  assert.deepStrictEqual(listBucketProposals(), []);
});

check("a declined pair is not proposed again", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  declineBucket("loops", "graph", "loop-drafts");
  assert.deepStrictEqual(listBucketProposals(), []);
});

check("connecting after declining clears the declined key", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  declineBucket("loops", "graph", "loop-drafts");
  grantBucket("loops", { owner: "graph", bucket: "loop-drafts", kind: "loop-draft" });
  assert.ok(findBucketGrant("loops", "graph", "loop-drafts"));
  assert.ok(canRead("loops", "graph", "loop-drafts"));
});

// The test above proves the STATE layer can clear a decline. It passed while
// the user had no way to reach that path: the IPC handler would only act on a
// live proposal, and declining removed the pair from the proposal list, so a
// "Not now" was unrecoverable short of uninstalling the addon. Found by
// running the dialog, not by reading the code. These cover the route a person
// actually takes.

check("a declined pair is offered again through the declined list", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  declineBucket("loops", "graph", "loop-drafts");

  const declined = listDeclinedBucketConnections();
  assert.strictEqual(declined.length, 1);
  assert.strictEqual(declined[0].readerId, "loops");
  assert.strictEqual(declined[0].owner, "graph");
  assert.strictEqual(declined[0].bucket, "loop-drafts");
  // Settings renders these, so it needs the display names and the label.
  assert.strictEqual(declined[0].kind, "loop-draft");
  assert.ok(declined[0].label);
});

check("a declined pair appears in exactly one of the two lists", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  assert.strictEqual(listBucketProposals().length, 1);
  assert.deepStrictEqual(listDeclinedBucketConnections(), []);

  declineBucket("loops", "graph", "loop-drafts");
  assert.deepStrictEqual(listBucketProposals(), []);
  assert.strictEqual(listDeclinedBucketConnections().length, 1);
});

check("a granted pair is in neither list", () => {
  connectedPair();
  assert.deepStrictEqual(listBucketProposals(), []);
  assert.deepStrictEqual(listDeclinedBucketConnections(), []);
});

check("a declined pair stops being offered when either side deactivates", () => {
  install("graph", GRAPH, false);
  install("loops", LOOPS);
  declineBucket("loops", "graph", "loop-drafts");
  // Otherwise Settings would offer a connection to an addon that is not
  // running, and accepting it would grant access on the strength of a
  // declaration nothing is currently honouring.
  assert.deepStrictEqual(listDeclinedBucketConnections(), []);
});

check("a declined pair stops being offered once the publisher drops the bucket", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  declineBucket("loops", "graph", "loop-drafts");
  // Both halves, because they do different jobs and only together are they
  // what an upgrade actually does: the snapshot is the DECLARATION these
  // lists are computed from, while reconcile clears the files and grants the
  // old declaration left behind. An earlier version of this test called only
  // reconcile and failed — correctly, since reconcile never claimed to
  // retract a declaration.
  setBucketsSnapshot("graph", { publishes: [], reads: [] });
  reconcileBucketsForAddon("graph", { publishes: [], reads: [] });
  assert.deepStrictEqual(listDeclinedBucketConnections(), []);
  assert.deepStrictEqual(listBucketProposals(), []);
});

check("an inactive addon on either side produces no proposal", () => {
  install("graph", GRAPH, false);
  install("loops", LOOPS);
  assert.deepStrictEqual(listBucketProposals(), []);
});

check("an addon is never proposed a connection to itself", () => {
  install("solo", buckets({
    publishes: [{ id: "notes", kind: "note", history: "all", label: "Notes" }],
    reads: ["note"],
  }));
  assert.deepStrictEqual(listBucketProposals(), []);
});

// ── uninstall ───────────────────────────────────────────────────────────────

check("uninstalling the publisher removes its buckets and every grant against them", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  const affected = purgeBucketsForOwner("graph");
  assert.deepStrictEqual(affected, ["loops"]);
  assert.strictEqual(fs.existsSync(path.join(userDataDir, "addon-buckets", "graph")), false);
  assert.deepStrictEqual(getBucketGrants("loops"), []);
});

check("uninstalling the reader takes its grants with it and leaves the feed alone", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  removeAddonEntry("loops");
  assert.deepStrictEqual(getBucketGrants("loops"), []);
  assert.ok(readFor("graph", "graph", "loop-drafts"), "the owner's own feed is untouched");
});

// ── a file that has been tampered with ──────────────────────────────────────

check("a bucket file describing a different slot is ignored, not served", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  const file = path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  parsed.owner = "someone-else";
  fs.writeFileSync(file, JSON.stringify(parsed));
  // Readable (the declaration and grant still stand) but the contents are not
  // attributed to graph, so they are dropped rather than mis-served.
  assert.deepStrictEqual(readFor("loops", "graph", "loop-drafts")?.items, []);
});

check("an unparseable bucket file reads as empty rather than throwing", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  fs.writeFileSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json"), "{not json");
  assert.deepStrictEqual(readFor("loops", "graph", "loop-drafts")?.items, []);
});

// ── the API layer: argument validation, before anything touches disk ────────

const ctx = (addonId: string) => ({ addonId, webContentsId: 1 });
const call = (m: keyof typeof api, addonId: string, ...args: unknown[]) =>
  api[m].handler(ctx(addonId), ...args);

check("writing to a bucket the caller does not declare is refused", () => {
  install("graph", GRAPH);
  assert.throws(() => call("write", "graph", "not-mine", [item("a")]), /not declared/);
});

check("a caller cannot write to another addon's bucket by naming it", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  // There is no argument for "owner" — the only bucket id loops can pass is
  // one loops itself declares, and it declares none.
  assert.throws(() => call("write", "loops", "loop-drafts", [item("a")]), /not declared/);
  assert.deepStrictEqual(readFor("graph", "graph", "loop-drafts")?.items ?? [], []);
});

check("an empty items array is refused", () => {
  install("graph", GRAPH);
  assert.throws(() => call("write", "graph", "loop-drafts", []), /non-empty array/);
});

check("a malformed item id is refused and nothing is written", () => {
  install("graph", GRAPH);
  assert.throws(() => call("write", "graph", "loop-drafts", [{ id: "has space", data: 1 }]), /items\[0\].id/);
  // A declared bucket reads as empty even before its first write, so the file
  // is what tells us nothing was written.
  assert.strictEqual(
    fs.existsSync(path.join(userDataDir, "addon-buckets", "graph", "loop-drafts.json")),
    false,
    "a rejected write must not create the file",
  );
});

check("a duplicated id within one call is refused", () => {
  install("graph", GRAPH);
  assert.throws(() => call("write", "graph", "loop-drafts", [item("a"), item("a")]), /duplicate id/);
});

check("data of undefined is refused rather than silently dropped", () => {
  install("graph", GRAPH);
  assert.throws(() => call("write", "graph", "loop-drafts", [{ id: "a", data: undefined }]), /must be a JSON value/);
});

check("circular data is refused, not thrown as a handler error", () => {
  install("graph", GRAPH);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => call("write", "graph", "loop-drafts", [{ id: "a", data: circular }]), /must be a JSON value/);
});

check("a cap breach comes back as a validation error, not a handler error", () => {
  install("graph", GRAPH);
  const tooMany = Array.from({ length: MAX_BUCKET_ITEMS + 1 }, (_, i) => item(`x${i}`));
  assert.throws(() => call("write", "graph", "loop-drafts", tooMany), (e: unknown) => {
    assert.strictEqual((e as Error).constructor.name, "ApiValidationError");
    return true;
  });
});

check("read rejects a malformed owner id before any lookup", () => {
  install("loops", LOOPS);
  assert.throws(() => call("read", "loops", "Not An Id", "loop-drafts"), /ownerId must match/);
});

check("read through the API returns the same null for denied and absent", () => {
  install("graph", GRAPH);
  install("loops", LOOPS);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.strictEqual(call("read", "loops", "graph", "loop-drafts"), null);
  assert.strictEqual(call("read", "loops", "graph", "absent-bucket"), null);
});

check("clear rejects a malformed id list without touching the bucket", () => {
  install("graph", GRAPH);
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  assert.throws(() => call("clear", "graph", "loop-drafts", ["ok", "bad id"]), /ids\[1\]/);
  assert.strictEqual(readFor("graph", "graph", "loop-drafts")?.items.length, 1);
});

check("list through the API is scoped to the caller", () => {
  connectedPair();
  writeItems("graph", "loop-drafts", "loop-draft", [item("a")]);
  const rows = call("list", "loops") as Array<{ owner: string; own: boolean }>;
  assert.deepStrictEqual(rows.map((r) => [r.owner, r.own]), [["graph", false]]);
});

console.log(`\n${passed} passed\n`);
