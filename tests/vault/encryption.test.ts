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
 * Everything asserted here passes against the vault as it stands today. The
 * tests that cannot yet pass — an undecryptable box surviving an open-and-save
 * cycle byte-identical, a corrupt file refusing writes instead of presenting as
 * an empty editable box — arrive with the read contract that makes them true.
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

const vaultPath = path.join(userDataDir, "vault.json");
const contentDir = path.join(userDataDir, "vault-content");
const contentPath = (boxId: string) => path.join(contentDir, `${boxId}.json`);

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
  assert.equal(getBoxContent(id)[0].content, "kept");
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
  assert.deepEqual(getBoxContent(id), []);
});

check("an entry round-trips content and label", () => {
  const id = makeBox();
  const result = addEntry(id, { content: "  hunter2  ", label: "  wifi  " });
  assert.equal(result.success, true);
  const entries = getBoxContent(id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].content, "hunter2");
  assert.equal(entries[0].label, "wifi");
  assert.equal(entries[0].id, result.entry!.id);
});

check("empty content is refused", () => {
  const id = makeBox();
  assert.equal(addEntry(id, { content: "   " }).success, false);
  assert.deepEqual(getBoxContent(id), []);
});

check("entry ids survive an update, and updatedAt moves", () => {
  const id = makeBox();
  const created = addEntry(id, { content: "one" }).entry!;
  const result = updateEntry(id, created.id, { content: "two" });
  assert.equal(result.success, true);
  const entries = getBoxContent(id);
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
  const entries = getBoxContent(id);
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
    getBoxContent(id).map((e) => e.content),
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
    // Read-only vault.json: loadVault still reads, saveVault fails. The box is
    // therefore still listed on disk after the failure, and unlinking its
    // content now would leave a box whose entries are gone.
    fs.chmodSync(vaultPath, 0o444);
    try {
      const result = deleteBox(id);
      assert.equal(result.success, false, "the save was expected to fail");
      assert.equal(fs.existsSync(contentPath(id)), true, "content file was deleted anyway");
    } finally {
      fs.chmodSync(vaultPath, 0o644);
    }
    assert.equal(getBoxContent(id)[0].content, "must survive");
  });
}

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
