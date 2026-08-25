/**
 * writeFileAtomic — the property that matters is that a failed write leaves the
 * previous contents intact, rather than a truncated file where the data was.
 *
 * Run with: npm run test:vault-crypto (bundled alongside the crypto tests).
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { resetUserData, userDataDir } from "../stubs/electron";
import { writeFileAtomic } from "../../electron/utils/atomicWrite";

let passed = 0;
function check(name: string, fn: () => void): void {
  resetUserData();
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

const target = path.join(userDataDir, "thing.json");
const isRoot = typeof process.getuid === "function" && process.getuid!() === 0;
const leftovers = () =>
  fs.readdirSync(userDataDir).filter((f) => f.endsWith(".tmp"));

// Not asserted anywhere below: the fsync. Nothing at this level can observe it,
// and it is the one property that distinguishes this module from the
// addons/state.ts precedent its header warns against.
console.log("\nAtomic write");

check("writes a new file", () => {
  writeFileAtomic(target, "hello");
  assert.equal(fs.readFileSync(target, "utf8"), "hello");
});

check("replaces an existing file", () => {
  writeFileAtomic(target, "first");
  writeFileAtomic(target, "second");
  assert.equal(fs.readFileSync(target, "utf8"), "second");
});

check("leaves no temp file behind on success", () => {
  writeFileAtomic(target, "hello");
  assert.deepEqual(leftovers(), []);
});

check("a new file is not readable by anyone else", () => {
  writeFileAtomic(target, "hello");
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
});

if (isRoot) {
  console.log("  skip  the previous contents survive a failed write — running as root");
} else {
  check("the previous contents survive a failed write", () => {
    // This is the whole point of the exercise. fs.writeFileSync would have
    // truncated the target before discovering it could not finish.
    const dir = path.join(userDataDir, "boxes");
    fs.mkdirSync(dir);
    const file = path.join(dir, "content.json");
    writeFileAtomic(file, "the good data");
    fs.chmodSync(dir, 0o500); // no new files in here
    try {
      assert.throws(() => writeFileAtomic(file, "the replacement"));
      assert.equal(fs.readFileSync(file, "utf8"), "the good data");
    } finally {
      fs.chmodSync(dir, 0o700);
    }
  });
}

check("a write into a directory that does not exist throws and creates nothing", () => {
  const missing = path.join(userDataDir, "no-such-dir", "thing.json");
  assert.throws(() => writeFileAtomic(missing, "hello"));
  assert.equal(fs.existsSync(path.join(userDataDir, "no-such-dir")), false);
  assert.deepEqual(leftovers(), []);
});

check("a write onto a path that is a directory throws and cleans up", () => {
  const asDir = path.join(userDataDir, "iam-a-dir");
  fs.mkdirSync(asDir);
  assert.throws(() => writeFileAtomic(asDir, "hello"));
  assert.equal(fs.statSync(asDir).isDirectory(), true);
  assert.deepEqual(
    fs.readdirSync(userDataDir).filter((f) => f.endsWith(".tmp")),
    [],
    "a temp file was left behind after a failed rename",
  );
});

check("repeated writes to the same target never reuse a temp name", () => {
  // Two writes in flight would otherwise clobber each other's temp file and one
  // would rename a half-written file into place. These two calls are sequential
  // — this pins the naming scheme, not real concurrency.
  const names = new Set<string>();
  const realRename = fs.renameSync;
  (fs as { renameSync: typeof fs.renameSync }).renameSync = (from, to) => {
    names.add(String(from));
    return realRename(from, to);
  };
  try {
    writeFileAtomic(target, "a");
    writeFileAtomic(target, "b");
  } finally {
    (fs as { renameSync: typeof fs.renameSync }).renameSync = realRename;
  }
  assert.equal(names.size, 2, "the same temp path was reused");
});

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
