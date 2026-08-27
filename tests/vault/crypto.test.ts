/**
 * The vault crypto wrapper — seal, open, and the three-state availability
 * signal. Run with:
 *
 *   npm run test:vault-crypto
 *
 * Both paths are wired into the vault as of 0.1.13; sealEntries writes; this is the module on its own.
 *
 * The stub's `decryptString` throws unless a test says otherwise, so any test
 * that expects a successful seal has to call `enableStubRoundTrip()` first —
 * `sealEntries` verifies its own output by decrypting it, and would otherwise
 * (correctly) fall back to plaintext.
 */

import assert from "assert";
import {
  app,
  enableStubRoundTrip,
  resetSafeStorage,
  safeStorage,
} from "../stubs/electron";
import {
  encryptionStatus,
  openRecord,
  sealEntries,
  statusFor,
  type OpenedRecord,
} from "../../electron/integrations/vault/crypto";
import type { VaultEntry } from "../../electron/integrations/vault/types";

let passed = 0;
function check(name: string, fn: () => void): void {
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

const ENTRIES: VaultEntry[] = [
  { id: "entry-1", label: "wifi", content: "hunter2", createdAt: 1, updatedAt: 2 },
  { id: "entry-2", content: "no label", createdAt: 3, updatedAt: 4 },
];

/** Seal for real, asserting that it actually encrypted. */
function sealOk(entries: VaultEntry[] = ENTRIES): string {
  enableStubRoundTrip();
  const sealed = sealEntries("box-1", entries);
  assert.equal(sealed.encrypted, true, "expected this seal to encrypt");
  return sealed.json;
}

function opened(record: OpenedRecord): VaultEntry[] {
  assert.notEqual(
    record.state,
    "unreadable",
    `unreadable: ${(record as { reason?: string }).reason}`,
  );
  return (record as { entries: VaultEntry[] }).entries;
}

function reasonOf(record: OpenedRecord): string {
  assert.equal(record.state, "unreadable");
  return (record as { reason: string }).reason;
}

// =============================================================================

console.log("\nAvailability is three-state");

check("no backend at all is unavailable", () => {
  assert.equal(statusFor(false), "unavailable");
  assert.equal(statusFor(false, "basic_text"), "unavailable");
});

check("Linux basic_text is obfuscated, NOT protected", () => {
  // isEncryptionAvailable() returns true here. A boolean would show this user a
  // green light over data an OS keyring never touched.
  assert.equal(statusFor(true, "basic_text"), "obfuscated");
});

check("a real keyring is protected", () => {
  assert.equal(statusFor(true, "gnome_libsecret"), "protected");
  assert.equal(statusFor(true, "kwallet6"), "protected");
  assert.equal(statusFor(true), "protected");
});

check("encryptionStatus is unavailable before the app is ready", () => {
  app.isReady = () => false;
  assert.equal(encryptionStatus(), "unavailable");
});

check("encryptionStatus survives a backend query that throws", () => {
  safeStorage.getSelectedStorageBackend = () => {
    throw new Error("not supported");
  };
  assert.equal(encryptionStatus(), "protected");
});

console.log("\nSealing");

check("a sealed record carries no plaintext", () => {
  const json = sealOk();
  assert.equal(json.includes("hunter2"), false, "content leaked into the file");
  assert.equal(json.includes("wifi"), false, "a label leaked into the file");
  assert.equal(json.includes("entry-1"), false, "an entry id leaked into the file");
  const parsed = JSON.parse(json);
  assert.equal(parsed.boxId, "box-1");
  assert.equal(typeof parsed.enc, "string");
  assert.equal("entries" in parsed, false, "plaintext entries sit next to the ciphertext");
});

check("labels, ids and timestamps all round-trip", () => {
  assert.deepEqual(opened(openRecord("box-1", sealOk())), ENTRIES);
});

check("an empty box seals and opens", () => {
  assert.deepEqual(opened(openRecord("box-1", sealOk([]))), []);
});

check("unavailable encryption falls back to a legacy-shaped plaintext file", () => {
  safeStorage.isEncryptionAvailable = () => false;
  const sealed = sealEntries("box-1", ENTRIES);
  assert.equal(sealed.encrypted, false, "the caller must be able to see the downgrade");
  const parsed = JSON.parse(sealed.json);
  assert.deepEqual(parsed.entries, ENTRIES);
  assert.equal("enc" in parsed, false);
});

check("an encryptString that throws falls back rather than losing the box", () => {
  enableStubRoundTrip();
  safeStorage.encryptString = () => {
    throw new Error("keychain says no");
  };
  const sealed = sealEntries("box-1", ENTRIES);
  assert.equal(sealed.encrypted, false);
  assert.deepEqual(JSON.parse(sealed.json).entries, ENTRIES);
});

check("a seal that reads back as something else is never returned as encrypted", () => {
  // The caller is about to replace the user's plaintext file with this. A blob
  // that does not open again is the one outcome with no recovery, so the seal
  // is verified before it is handed back.
  safeStorage.decryptString = () => "something else entirely";
  const sealed = sealEntries("box-1", ENTRIES);
  assert.equal(sealed.encrypted, false);
  assert.deepEqual(JSON.parse(sealed.json).entries, ENTRIES);
});

check("a seal whose verification throws is never returned as encrypted", () => {
  // The stub default: decryptString throws. Same verdict by a different route.
  const sealed = sealEntries("box-1", ENTRIES);
  assert.equal(sealed.encrypted, false);
  assert.deepEqual(JSON.parse(sealed.json).entries, ENTRIES);
});

console.log("\nOpening");

check("a legacy plaintext file opens as legacy", () => {
  const record = openRecord("box-1", JSON.stringify({ boxId: "box-1", entries: ENTRIES }));
  assert.equal(record.state, "legacy");
  assert.deepEqual(opened(record), ENTRIES);
});

check("an entry whose content looks like ciphertext is still just an entry", () => {
  // Discrimination is out-of-band — which key is present — so nothing a user
  // can type is ever read as a blob.
  const hostile: VaultEntry[] = [
    { id: "e", content: "enc:v1:AAAA", createdAt: 1, updatedAt: 1 },
    { id: "f", content: "MOSAIC-VAULT-V1\n{}", createdAt: 1, updatedAt: 1 },
  ];
  const record = openRecord("box-1", JSON.stringify({ boxId: "box-1", entries: hostile }));
  assert.equal(record.state, "legacy");
  assert.deepEqual(opened(record), hostile);
});

check("a file that is not JSON is unreadable", () => {
  assert.equal(openRecord("box-1", "{ this is not json").state, "unreadable");
  assert.equal(openRecord("box-1", "").state, "unreadable");
});

check("a JSON file with neither shape is unreadable, not empty", () => {
  assert.equal(openRecord("box-1", JSON.stringify({ boxId: "box-1" })).state, "unreadable");
  assert.equal(openRecord("b", JSON.stringify({ boxId: "b", entries: "nope" })).state, "unreadable");
  assert.equal(openRecord("box-1", "[]").state, "unreadable");
  assert.equal(openRecord("box-1", "null").state, "unreadable");
});

check("a blob that will not decrypt is unreadable, in the user's terms", () => {
  const json = sealOk();
  resetSafeStorage(); // back to the default: decryptString throws, as on a machine without the key
  assert.match(reasonOf(openRecord("box-1", json)), /could not be unlocked on this device/);
});

check("a wrong key that happens to pass padding is caught by the canary", () => {
  // Roughly 1 in 256 of these decrypt "successfully" into garbage under AES-CBC
  // with no MAC. Without the canary, migrate-on-open would re-seal the garbage
  // and destroy the original permanently.
  const json = sealOk();
  safeStorage.decryptString = () => "£ÿ garbage that happened to unpad";
  assert.match(reasonOf(openRecord("box-1", json)), /could not be unlocked on this device/);
});

check("a truncated blob fails the inner parse and is unreadable, not empty", () => {
  const parsed = JSON.parse(sealOk());
  parsed.enc = parsed.enc.slice(0, Math.floor(parsed.enc.length / 2));
  assert.equal(openRecord("box-1", JSON.stringify(parsed)).state, "unreadable");
});

check("valid ciphertext wrapping something that is not a box is unreadable", () => {
  safeStorage.decryptString = () =>
    'MOSAIC-VAULT-V1\n{"boxId":"b","entries":"not an array"}';
  assert.equal(openRecord("b", JSON.stringify({ boxId: "b", enc: "AAAA" })).state, "unreadable");
});

check("valid ciphertext wrapping invalid JSON is unreadable", () => {
  safeStorage.decryptString = () => "MOSAIC-VAULT-V1\n{ not json";
  assert.equal(openRecord("b", JSON.stringify({ boxId: "b", enc: "AAAA" })).state, "unreadable");
});

check("one box's blob cannot be opened from another box's file", () => {
  // The canary proves only "sealed by this keychain key" — every box on a device
  // shares that key, so it passes for any of them. Without boxId inside the
  // envelope, copying box A's file over box B's gives an agent authorised only
  // for B a clean read of A's contents, which is the whole per-box access
  // control defeated. This is the test that pins that shut.
  const stolen = sealOk();
  assert.deepEqual(opened(openRecord("box-1", stolen)), ENTRIES, "sanity: opens in its own box");
  assert.match(reasonOf(openRecord("box-2", stolen)), /belongs to a different box/);
});

check("a sealed record still carries its box id in the clear, and that copy is not trusted", () => {
  // Rewriting the outer boxId is not enough to make a stolen blob open, because
  // the id that counts is the sealed one.
  const parsed = JSON.parse(sealOk());
  parsed.boxId = "box-2";
  assert.match(reasonOf(openRecord("box-2", JSON.stringify(parsed))), /belongs to a different box/);
});

check("an unavailable backend cannot silently read a sealed box as empty", () => {
  const json = sealOk();
  safeStorage.isEncryptionAvailable = () => false;
  assert.equal(openRecord("box-1", json).state, "unreadable");
});

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
