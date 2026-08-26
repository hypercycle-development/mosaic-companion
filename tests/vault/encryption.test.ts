/**
 * Vault persistence — the behaviour encryption at rest (#110) has to preserve.
 * Run with:
 *
 *   npm run test:vault
 *
 * Plain assertions, no test framework, same shape as
 * `tests/addons/withdrawal.test.ts`. What is new here is the electron stub:
 * `vault/index.ts` resolves its paths from `app.getPath` at module load, so it
 * is bundled with `--alias:electron=./tests/stubs/electron.ts` and runs
 * unmodified against a temp directory.
 *
 * The two tests this file was written waiting for — an undecryptable box
 * surviving an open-and-save cycle byte-identical, and a corrupt file refusing
 * writes instead of presenting as an empty editable box — arrived with the read
 * contract (WP2) and are at the bottom.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { resetSafeStorage, resetUserData, userDataDir } from "../stubs/electron";
import {
  addBox,
  addEntry,
  deleteBox,
  deleteEntry,
  getBox,
  getBoxContent,
  getBoxes,
  loadVault,
  updateBox,
  updateEntry,
} from "../../electron/integrations/vault";
import type { VaultEntry } from "../../electron/integrations/vault/types";

const vaultPath = path.join(userDataDir, "vault.json");
const contentDir = path.join(userDataDir, "vault-content");
const contentPath = (boxId: string) => path.join(contentDir, `${boxId}.json`);

/**
 * `getBoxContent` returns a discriminated result now (WP2). Every test below
 * that was written against the old `VaultEntry[]` asserts readability through
 * this helper, so a test that expected entries fails loudly if the box has
 * become unreadable rather than silently comparing against an empty array.
 */
function entriesOf(boxId: string): VaultEntry[] {
  const loaded = getBoxContent(boxId);
  assert.equal(loaded.state, "ok", `box ${boxId} was expected to be readable`);
  return (loaded as { state: "ok"; entries: VaultEntry[] }).entries;
}

let passed = 0;
function check(name: string, fn: () => void): void {
  resetUserData();
  resetSafeStorage();
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

/** Create a box and return its id, failing the test if creation failed. */
function makeBox(name = "Box"): string {
  const result = addBox({ name });
  assert.ok(result.success && result.box, result.error ?? "addBox failed");
  return result.box!.id;
}

const isRoot = typeof process.getuid === "function" && process.getuid!() === 0;

// =============================================================================

console.log("\nBox config");

check("a fresh profile has no boxes", () => {
  assert.deepEqual(getBoxes(), []);
  assert.equal(fs.existsSync(vaultPath), false);
});

check("a box round-trips through disk", () => {
  const id = makeBox("Alice's Emails");
  const box = getBox(id);
  assert.ok(box);
  assert.equal(box!.name, "Alice's Emails");
  assert.equal(box!.sourceType, "manual");
  assert.deepEqual(JSON.parse(fs.readFileSync(vaultPath, "utf8")).boxes.length, 1);
});

check("duplicate names are refused, case-insensitively", () => {
  makeBox("Notes");
  const again = addBox({ name: "  notes  " });
  assert.equal(again.success, false);
  assert.equal(getBoxes().length, 1);
});

check("renaming a box keeps its id and entries", () => {
  const id = makeBox("Before");
  addEntry(id, { content: "kept" });
  const result = updateBox(id, { name: "After" });
  assert.equal(result.success, true);
  assert.equal(getBox(id)!.name, "After");
  assert.equal(entriesOf(id)[0].content, "kept");
});

check("loadVault never hands back the module default's array (#133)", () => {
  // With no vault.json on disk, loadVault takes its fall-through. If that
  // returns a shallow copy, the boxes array it exposes IS the module-level
  // default's, and addBox pushes into it permanently — so a later read of an
  // empty profile reports a box that is not on disk.
  makeBox("Leaks?");
  fs.rmSync(vaultPath);
  assert.deepEqual(getBoxes(), [], "the default vault was mutated in place");
  assert.deepEqual(loadVault().boxes, []);
});

console.log("\nBox content");

check("an absent content file reads as an empty box, not an error", () => {
  const id = makeBox();
  assert.deepEqual(getBoxContent(id), { state: "ok", entries: [], encrypted: false });
});

check("an entry round-trips content and label", () => {
  const id = makeBox();
  const result = addEntry(id, { content: "  hunter2  ", label: "  wifi  " });
  assert.equal(result.success, true);
  const entries = entriesOf(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, "hunter2");
  assert.equal(entries[0].label, "wifi");
  assert.equal(entries[0].id, result.entry!.id);
});

check("empty content is refused", () => {
  const id = makeBox();
  assert.equal(addEntry(id, { content: "   " }).success, false);
  assert.deepEqual(entriesOf(id), []);
});

check("entry ids survive an update, and updatedAt moves", () => {
  const id = makeBox();
  const created = addEntry(id, { content: "one" }).entry!;
  const result = updateEntry(id, created.id, { content: "two" });
  assert.equal(result.success, true);
  const entries = entriesOf(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, created.id);
  assert.equal(entries[0].content, "two");
  assert.equal(entries[0].createdAt, created.createdAt);
  assert.ok(entries[0].updatedAt >= created.updatedAt);
});

check("deleting one entry leaves the others", () => {
  const id = makeBox();
  const first = addEntry(id, { content: "one" }).entry!;
  addEntry(id, { content: "two" });
  assert.equal(deleteEntry(id, first.id).success, true);
  const entries = entriesOf(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, "two");
});

check("a missing entry id is an error, not a silent no-op", () => {
  const id = makeBox();
  assert.equal(updateEntry(id, "entry-nope", { content: "x" }).success, false);
  assert.equal(deleteEntry(id, "entry-nope").success, false);
});

check("every mutation re-reads from disk, so nothing is cached across a write", () => {
  // The premise migrate-on-open rests on: an out-of-band change to the content
  // file is visible to the next mutation, which therefore cannot clobber it.
  const id = makeBox();
  addEntry(id, { content: "from the app" });
  const onDisk = JSON.parse(fs.readFileSync(contentPath(id), "utf8"));
  onDisk.entries.push({
    id: "entry-external",
    content: "written behind the app's back",
    createdAt: 1,
    updatedAt: 1,
  });
  fs.writeFileSync(contentPath(id), JSON.stringify(onDisk), "utf8");
  addEntry(id, { content: "after" });
  assert.deepEqual(
    entriesOf(id).map((e) => e.content),
    ["from the app", "written behind the app's back", "after"],
  );
});

console.log("\nDeleting a box");

check("deleting a box removes its content file", () => {
  const id = makeBox();
  addEntry(id, { content: "x" });
  assert.equal(fs.existsSync(contentPath(id)), true);
  assert.equal(deleteBox(id).success, true);
  assert.deepEqual(getBoxes(), []);
  assert.equal(fs.existsSync(contentPath(id)), false);
});

check("deleting an unknown box is an error and touches nothing", () => {
  const id = makeBox();
  addEntry(id, { content: "x" });
  assert.equal(deleteBox("box-nope").success, false);
  assert.equal(fs.existsSync(contentPath(id)), true);
});

if (isRoot) {
  console.log("  skip  a failed config save leaves the content file alone (#132) — running as root");
} else {
  check("a failed config save leaves the content file alone (#132)", () => {
    const id = makeBox();
    addEntry(id, { content: "must survive" });
    // Make the *directory* unwritable, not the file. `saveVault` writes through
    // `writeFileAtomic` now, which creates a temp file beside the target and
    // renames over it — and on POSIX rename needs write permission on the
    // directory, not on the target. A read-only `vault.json` therefore no
    // longer fails a save there, which is a real semantic change atomic replace
    // brings with it: a user who chmod'd their vault.json to protect it is no
    // longer protected by that. (Windows differs — renaming over a read-only
    // target fails — so the change is POSIX-only.)
    // The guard under test is unaffected — the box is still listed on disk after
    // a failed save, so unlinking its content would leave a box whose entries
    // are gone.
    fs.chmodSync(userDataDir, 0o555);
    try {
      const result = deleteBox(id);
      assert.equal(result.success, false, "the save was expected to fail");
      assert.equal(fs.existsSync(contentPath(id)), true, "content file was deleted anyway");
    } finally {
      fs.chmodSync(userDataDir, 0o755);
    }
    assert.equal(entriesOf(id)[0].content, "must survive");
  });
}

console.log("\nUnreadable content — the read contract (WP2)");

/** Write a raw content file for a box, bypassing the module. */
function writeRaw(boxId: string, raw: string): void {
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(contentPath(boxId), raw, "utf8");
}

check("a corrupt content file is unreadable, not an empty box", () => {
  const id = makeBox();
  writeRaw(id, "{ this is not json");
  const loaded = getBoxContent(id);
  assert.equal(loaded.state, "unreadable");
});

check("a file with neither entries nor a blob is unreadable", () => {
  const id = makeBox();
  writeRaw(id, JSON.stringify({ boxId: id, somethingElse: true }));
  assert.equal(getBoxContent(id).state, "unreadable");
});

check("an encrypted blob with no key is unreadable, not empty", () => {
  // The restore-from-backup case: ciphertext present, keychain item absent.
  // The stub's decryptString throws unless a test opts in, which is that.
  const id = makeBox();
  writeRaw(id, JSON.stringify({ boxId: id, enc: Buffer.from("nonsense").toString("base64") }));
  assert.equal(getBoxContent(id).state, "unreadable");
});

check("adding to an unreadable box is refused and the file is untouched", () => {
  const id = makeBox();
  addEntry(id, { content: "the real data" });
  const before = fs.readFileSync(contentPath(id));
  // Corrupt it the way a truncated write would.
  const truncated = before.subarray(0, Math.floor(before.length / 2));
  fs.writeFileSync(contentPath(id), truncated);

  const result = addEntry(id, { content: "would have overwritten everything" });
  assert.equal(result.success, false, "the write should have been refused");
  assert.deepEqual(
    fs.readFileSync(contentPath(id)),
    truncated,
    "the file was modified despite the refusal",
  );
});

check("updating and deleting in an unreadable box are refused too", () => {
  const id = makeBox();
  writeRaw(id, "{ truncated");
  assert.equal(updateEntry(id, "entry-1", { content: "x" }).success, false);
  assert.equal(deleteEntry(id, "entry-1").success, false);
  assert.equal(fs.readFileSync(contentPath(id), "utf8"), "{ truncated");
});

check("an undecryptable box survives an open-and-save-attempt cycle byte-identical", () => {
  // The §8 risk test. The stub reports encryption as available and its
  // decryptString throws unless a test opts in, so this already takes
  // openRecord's ENCRYPTED branch and fails in decryption — not the shape
  // guard. In WP4 the same file meets a real key, and this must be
  // re-asserted through that path there.
  const id = makeBox();
  const raw = JSON.stringify({ boxId: id, enc: Buffer.from("undecryptable").toString("base64") });
  writeRaw(id, raw);
  const digestBefore = fs.readFileSync(contentPath(id));
  getBoxContent(id);
  addEntry(id, { content: "attempt" });
  updateEntry(id, "entry-1", { content: "attempt" });
  deleteEntry(id, "entry-1");
  assert.deepEqual(fs.readFileSync(contentPath(id)), digestBefore);
});

console.log("\nUnreadable config");

check("a corrupt vault.json refuses config writes instead of replacing them", () => {
  const id = makeBox("Real box");
  addEntry(id, { content: "still here" });
  fs.writeFileSync(vaultPath, "{ half a config", "utf8");

  // The read degrades: no boxes are listed.
  assert.deepEqual(getBoxes(), []);
  // The write refuses, so the config on disk is left for recovery.
  const result = addBox({ name: "Would have replaced everything" });
  assert.equal(result.success, false, "the config write should have been refused");
  assert.equal(fs.readFileSync(vaultPath, "utf8"), "{ half a config");
  // And the real box's content was never touched.
  assert.equal(entriesOf(id)[0].content, "still here");
});

check("a vault.json without a box list is unreadable, not an empty vault", () => {
  makeBox("Real box");
  fs.writeFileSync(vaultPath, JSON.stringify({ somethingElse: true }), "utf8");
  assert.deepEqual(getBoxes(), []);
  assert.equal(addBox({ name: "New" }).success, false);
});

check("a recovered vault.json clears the refusal", () => {
  const id = makeBox("Real box");
  const good = fs.readFileSync(vaultPath, "utf8");
  fs.writeFileSync(vaultPath, "{ broken", "utf8");
  assert.equal(addBox({ name: "Refused" }).success, false);
  fs.writeFileSync(vaultPath, good, "utf8");
  assert.equal(addBox({ name: "Accepted" }).success, true, "the refusal should have cleared");
  assert.equal(getBoxes().length, 2);
  assert.ok(getBox(id));
});

check("deleting a box with unreadable content keeps the file rather than destroying it", () => {
  const id = makeBox();
  addEntry(id, { content: "unrecoverable but not disposable" });
  const before = fs.readFileSync(contentPath(id));
  writeRaw(id, "{ corrupted");

  const result = deleteBox(id);
  assert.equal(result.success, true, "the box itself should still be removed");
  assert.ok(result.setAside, "the unreadable content should have been set aside");
  assert.equal(fs.existsSync(contentPath(id)), false, "the original path should be cleared");
  assert.equal(fs.readFileSync(result.setAside!, "utf8"), "{ corrupted");
  assert.notDeepEqual(before, null);
  assert.deepEqual(getBoxes(), []);
});

check("deleting a box with readable content still deletes the file", () => {
  const id = makeBox();
  addEntry(id, { content: "ordinary" });
  const result = deleteBox(id);
  assert.equal(result.success, true);
  assert.equal(result.setAside, undefined, "a readable box should not be set aside");
  assert.equal(fs.existsSync(contentPath(id)), false);
});

check("a readable box reports whether it was encrypted on disk", () => {
  const id = makeBox();
  addEntry(id, { content: "plain" });
  const loaded = getBoxContent(id);
  assert.equal(loaded.state, "ok");
  assert.equal((loaded as { encrypted: boolean }).encrypted, false);
});

check("a file carrying both entries and a blob is unreadable, not half-trusted", () => {
  // The `{ ...content, enc }` accident the (boxId, entries) signature exists to
  // make unrepresentable. If it ever occurs, the plaintext beside the blob must
  // not be served as if it were the box.
  const id = makeBox();
  writeRaw(id, JSON.stringify({
    boxId: id,
    entries: [{ id: "entry-1", content: "should not be served", createdAt: 1, updatedAt: 1 }],
    enc: Buffer.from("unopenable").toString("base64"),
  }));
  assert.equal(getBoxContent(id).state, "unreadable");
});

check("updating and deleting a box under an unreadable config are refused", () => {
  const id = makeBox("Real");
  addEntry(id, { content: "must survive" });
  fs.writeFileSync(vaultPath, "{ half a config", "utf8");
  // Both take the degraded-empty list and report the box as missing rather than
  // writing. Neither may reach saveVault.
  assert.equal(updateBox(id, { name: "Renamed" }).success, false);
  assert.equal(deleteBox(id).success, false);
  assert.equal(fs.readFileSync(vaultPath, "utf8"), "{ half a config");
  assert.equal(fs.existsSync(contentPath(id)), true, "content must survive a refused delete");
});

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
