/**
 * Encryption at rest for Vault box content (#110).
 *
 * A box content file is one of two shapes, told apart by which key is present:
 *
 *   legacy     { "boxId": "...", "entries": [ ... ] }
 *   encrypted  { "boxId": "...", "enc": "<base64 of CANARY + {boxId,entries}>" }
 *
 * Discrimination is out-of-band — a key that is present or absent, never a
 * prefix on a user-supplied string — so no entry a user types can ever be
 * mistaken for ciphertext.
 *
 * The box id appears twice: outside the envelope, where it is unauthenticated
 * and only a convenience, and inside it, where it is what actually binds a blob
 * to its box. See `sealEntries`.
 *
 * The whole entries array is sealed as one blob rather than field by field.
 * That puts labels, ids and timestamps inside the envelope for free, costs one
 * `encryptString` call per save instead of one per entry (Windows DPAPI is
 * priced per call), and makes a decryption failure whole-box and obvious
 * instead of scattered and invisible.
 *
 * Deliberately out of scope: `vault.json`. Box names and descriptions stay
 * readable, because decrypting to render the box list is where the complexity
 * would be.
 *
 * This is a vault-specific wrapper rather than a reuse of `agentKeyCrypto.ts`,
 * whose one-shot `warnedEncryptionUnavailable` singleton may already have been
 * consumed by the agent-key path — which would make the Vault's downgrade to
 * plaintext completely silent.
 */

import { app, safeStorage } from "electron";
import type { VaultEntry } from "./types";

/**
 * First line of the sealed plaintext. It is an integrity check, not decoration.
 *
 * safeStorage on macOS and Linux is AES-128-CBC via Chromium's OSCrypt with no
 * MAC, so decrypting with the wrong key does not reliably throw — roughly 1 in
 * 256 times the PKCS#7 padding is accidentally valid and `decryptString`
 * returns garbage with no error. On a restore-from-backup or a copied profile,
 * where the ciphertext exists but the keychain item does not, that is a real
 * rate. Requiring an exact prefix reduces it to negligible, and carries the
 * format version for free.
 *
 * (Windows DPAPI is authenticated and does not have this problem. The format
 * should not depend on the platform.)
 *
 * What the canary does NOT do is bind a blob to its box — every box on a device
 * is sealed with the same keychain key, so the canary passes for any of them.
 * That is what the sealed `boxId` is for.
 */
const CANARY = "MOSAIC-VAULT-V1";

/**
 * Whether box content written now is actually protected.
 *
 * Three-state, not a boolean, and no caller may reduce it to one.
 * `safeStorage.isEncryptionAvailable()` returns **true** on Linux when the
 * selected backend is `basic_text`, which obfuscates rather than encrypts — a
 * boolean would show that user a green light over data that is not protected.
 */
export type EncryptionStatus = "protected" | "obfuscated" | "unavailable";

/**
 * The decision, isolated from how the values are obtained so it can be tested
 * without faking a platform.
 */
export function statusFor(
  available: boolean,
  linuxBackend?: string,
): EncryptionStatus {
  if (!available) return "unavailable";
  if (linuxBackend === "basic_text") return "obfuscated";
  return "protected";
}

/** Current encryption status. Never throws. */
export function encryptionStatus(): EncryptionStatus {
  try {
    if (!app.isReady()) return "unavailable";
    if (!safeStorage.isEncryptionAvailable()) return "unavailable";
    let backend: string | undefined;
    if (process.platform === "linux") {
      try {
        backend = safeStorage.getSelectedStorageBackend?.();
      } catch {
        // Older Electron, or a backend query that failed. Absent, not fatal.
      }
    }
    return statusFor(true, backend);
  } catch {
    return "unavailable";
  }
}

// =============================================================================
// Sealing
// =============================================================================

/** The file body to write, and whether it actually came out encrypted. */
export interface SealedRecord {
  /** JSON to write to the box content file. */
  json: string;
  /**
   * The three-state status this seal was produced under.
   *
   * Returned rather than recomputed by the caller, for two reasons. Asking
   * again costs a second `isEncryptionAvailable()` — which on macOS can raise a
   * second OS password prompt inside one save. And `encrypted` alone is the
   * boolean this module refuses to be reduced to: on a Linux `basic_text`
   * backend a seal genuinely succeeds, so `encrypted` is true while the data is
   * obfuscated rather than protected. A caller with only the boolean shows that
   * user a green light over data nothing is guarding.
   */
  status: EncryptionStatus;
  /**
   * False when this fell back to plaintext. Callers must gate
   * upgrade-on-open on this being true: without the gate, a machine with no
   * keychain rewrites every legacy box in plaintext on every open, forever,
   * and the file stays legacy-shaped so the condition never clears.
   */
  encrypted: boolean;
}

/**
 * The unencrypted file body. Exported because the read contract (WP2) ships a
 * release before encryption is switched on (WP4), and during that release the
 * vault writes plaintext — but the *shape* of a content file must still have
 * exactly one owner, this module. WP4 changes the vault's write path from this
 * to `sealEntries` and nothing else moves.
 */
export function plaintextRecord(
  boxId: string,
  entries: VaultEntry[],
  status: EncryptionStatus,
): SealedRecord {
  return {
    json: JSON.stringify({ boxId, entries }, null, 2),
    encrypted: false,
    status,
  };
}

/**
 * Seal a box's entries into the JSON body for its content file.
 *
 * Falls back to plaintext when encryption is unavailable or fails: locking
 * someone out of their own data is worse than storing it the way it is stored
 * today. That fallback is a user-visible fact, not an implementation detail —
 * the status this returns is what the UI must be driven from.
 *
 * The seal is verified by decrypting it again before it is returned. The caller
 * is about to replace the user's plaintext file with this, and a blob that
 * cannot be opened is the one outcome from which there is no recovery.
 */
export function sealEntries(boxId: string, entries: VaultEntry[]): SealedRecord {
  const status = encryptionStatus();
  if (status === "unavailable") {
    console.warn(
      "[Vault] safeStorage encryption unavailable; writing box content as plaintext:",
      boxId,
    );
    return plaintextRecord(boxId, entries, status);
  }

  // boxId goes INSIDE the envelope, and `openRecord` refuses a blob whose
  // sealed id is not the box it was read from. Without that, an attacker who
  // can write to the content directory — or a restored backup — can copy box
  // A's blob over box B's file: it decrypts, the canary passes, and an agent
  // authorised only for B reads A's contents. That defeats the per-box access
  // control, which is the Vault's actual security model.
  //
  // This does not defend replay of an *older* blob for the *same* box, which
  // would need monotonic state somewhere an attacker cannot roll back. Anyone
  // who can write these files can also roll back that state, so the honest
  // scope is: cross-box substitution is prevented, same-box rollback is not.
  const payload = `${CANARY}\n${JSON.stringify({ boxId, entries })}`;
  try {
    const buffer = safeStorage.encryptString(payload);
    if (safeStorage.decryptString(buffer) !== payload) {
      throw new Error("round-trip verification failed");
    }
    return {
      json: JSON.stringify({ boxId, enc: buffer.toString("base64") }, null, 2),
      encrypted: true,
      status,
    };
  } catch (error) {
    console.error(
      "[Vault] Failed to encrypt box content; writing plaintext:",
      boxId,
      error,
    );
    // The seal failed despite the backend reporting itself usable, so the
    // status this record was produced under is not what `encryptionStatus()`
    // said a moment ago. Report it as unavailable: from this box's point of
    // view, encryption was not available to it.
    return plaintextRecord(boxId, entries, "unavailable");
  }
}

// =============================================================================
// Opening
// =============================================================================

/**
 * What a box content file turned out to be.
 *
 * `legacy` is a plaintext file that should be re-sealed on the next write.
 * `unreadable` is a file that exists and cannot be understood: the caller must
 * refuse every write to that box and never touch the file. Presenting it as an
 * empty editable box — which is what the vault does today — invites the next
 * save to overwrite it.
 */
export type OpenedRecord =
  | { state: "legacy"; entries: VaultEntry[] }
  | { state: "encrypted"; entries: VaultEntry[] }
  | { state: "unreadable"; reason: string };

/**
 * Parse and, if necessary, decrypt a box content file's raw text. Never throws.
 *
 * `boxId` is the box the file was read from, and an encrypted record must carry
 * the same id inside its envelope to be accepted.
 */
export function openRecord(boxId: string, raw: string): OpenedRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { state: "unreadable", reason: "the file is not valid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { state: "unreadable", reason: "the file is not a box content record" };
  }

  const record = parsed as { enc?: unknown; entries?: unknown };

  // `enc` wins when both are present. That shape is the `{...content, enc}`
  // accident the (boxId, entries) signature exists to make unrepresentable; if
  // it ever occurs and the blob will not open, the plaintext entries beside it
  // are reported unreadable rather than served. Writes are refused in that
  // state, so nothing is destroyed and manual recovery stays possible.
  if (typeof record.enc === "string") {
    return openEncrypted(boxId, record.enc);
  }
  if (Array.isArray(record.entries)) {
    return { state: "legacy", entries: record.entries as VaultEntry[] };
  }
  return {
    state: "unreadable",
    reason: "the file has neither entries nor an encrypted blob",
  };
}

function openEncrypted(boxId: string, enc: string): OpenedRecord {
  let plain: string;
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage encryption unavailable");
    }
    plain = safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch (error) {
    console.error("[Vault] Failed to decrypt box content:", error);
    return {
      state: "unreadable",
      reason: "the box could not be unlocked on this device",
    };
  }

  // Wrong key, right padding. See CANARY.
  if (!plain.startsWith(`${CANARY}\n`)) {
    return {
      state: "unreadable",
      reason: "the box could not be unlocked on this device",
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(plain.slice(CANARY.length + 1));
  } catch {
    return { state: "unreadable", reason: "the decrypted content is not valid JSON" };
  }
  const sealed = body as { boxId?: unknown; entries?: unknown } | null;
  if (sealed?.boxId !== boxId) {
    // Right key, wrong box: this blob belongs to a different box's file.
    return {
      state: "unreadable",
      reason: "this content belongs to a different box",
    };
  }
  if (!Array.isArray(sealed.entries)) {
    return { state: "unreadable", reason: "the decrypted content has no entries" };
  }
  // Not validated element by element — the legacy path never was either, and a
  // malformed entry is a rendering problem, not a data-loss one.
  return { state: "encrypted", entries: sealed.entries as VaultEntry[] };
}
