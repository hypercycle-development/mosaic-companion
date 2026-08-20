/**
 * API-key encryption at rest for AI agent configs (ai-agents.json).
 *
 * Keys are stored as `enc:v1:<base64>` blobs encrypted with Electron's
 * safeStorage (OS keychain / keyring). Plaintext keys are still accepted on
 * read and migrated to encrypted form on the next write.
 */

import { app, safeStorage } from "electron";

const ENC_PREFIX = "enc:v1:";

let loggedLinuxBackend = false;
let warnedEncryptionUnavailable = false;

/** True when the value is an `enc:v1:` blob produced by encryptKey. */
export function isEncryptedKey(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENC_PREFIX);
}

/** True when safeStorage is ready to encrypt (app ready + OS backend available). */
export function canEncrypt(): boolean {
  if (!app.isReady() || !safeStorage.isEncryptionAvailable()) return false;
  if (process.platform === "linux" && !loggedLinuxBackend) {
    loggedLinuxBackend = true;
    const backend = safeStorage.getSelectedStorageBackend();
    console.log(`[AgentKeys] safeStorage backend: ${backend}`);
    if (backend === "basic_text") {
      console.warn(
        "[AgentKeys] safeStorage is using the basic_text backend; stored API keys are only obfuscated, not protected by an OS keyring.",
      );
    }
  }
  return true;
}

/**
 * Encrypt a plaintext API key for storage. Idempotent: empty strings and
 * already-encrypted values are returned as-is. Falls back to plaintext when
 * encryption is unavailable or fails (never lose a key).
 */
export function encryptKey(plain: string): string {
  if (!plain || isEncryptedKey(plain)) return plain;
  if (!canEncrypt()) {
    if (!warnedEncryptionUnavailable) {
      warnedEncryptionUnavailable = true;
      console.warn(
        "[AgentKeys] safeStorage encryption unavailable; storing API keys as plaintext.",
      );
    }
    return plain;
  }
  try {
    return ENC_PREFIX + safeStorage.encryptString(plain).toString("base64");
  } catch (error) {
    console.error("[AgentKeys] Failed to encrypt API key; storing plaintext:", error);
    return plain;
  }
}

/**
 * Decrypt a stored API key. Plaintext (non-prefixed) values pass through
 * unchanged. Returns `failed: true` (with an empty value) when an encrypted
 * blob cannot be decrypted on this machine. Never throws.
 */
export function decryptKey(stored: string): { value: string; failed: boolean } {
  if (!isEncryptedKey(stored)) return { value: stored, failed: false };
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage encryption unavailable");
    }
    const value = safeStorage.decryptString(
      Buffer.from(stored.slice(ENC_PREFIX.length), "base64"),
    );
    return { value, failed: false };
  } catch (error) {
    console.error("[AgentKeys] Failed to decrypt stored API key:", error);
    return { value: "", failed: true };
  }
}
