/**
 * Electron stub for node-side unit tests.
 *
 * Modules under `electron/` import `electron` directly and resolve their file
 * paths from `app.getPath("userData")` **at module load** — `vault/index.ts:19`
 * is the case this stub was written for. Bundling a test with
 *
 *   npx esbuild <test>.ts --bundle --platform=node --alias:electron=./tests/stubs/electron.ts
 *
 * substitutes this module for the real one, so the module under test runs
 * unmodified against a throwaway directory. No path injection, no refactor.
 *
 * The temp directory is created when this stub loads, which is before any
 * importer's module body runs — so the constants they capture are already
 * pointing at it.
 */

import fs from "fs";
import os from "os";
import path from "path";

/** Throwaway userData root for this process. Created at stub load. */
export const userDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "mosaic-vault-test-"),
);

export const app = {
  getPath(name: string): string {
    if (name === "userData") return userDataDir;
    const dir = path.join(userDataDir, name);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },
  getName(): string {
    return "mosaic-companion";
  },
};

/**
 * Empty `userDataDir` without replacing it — the paths the modules under test
 * captured at load must stay valid. Call between tests.
 */
export function resetUserData(): void {
  for (const entry of fs.readdirSync(userDataDir)) {
    fs.rmSync(path.join(userDataDir, entry), { recursive: true, force: true });
  }
}

// =============================================================================
// safeStorage
// =============================================================================

/**
 * The shape the vault crypto wrapper will use. `getSelectedStorageBackend` is
 * Linux-only on the real API and absent elsewhere, which is exactly why the
 * availability signal cannot be a boolean: `isEncryptionAvailable()` returns
 * true for the `basic_text` backend, which only obfuscates.
 */
export interface SafeStorageStub {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/**
 * Defaults are deliberately hostile in one direction: `decryptString` throws
 * unless a test overrides it. A test that means "this box decrypts" has to say
 * so, so a test that composes a read path without thinking about decryption
 * fails rather than silently passing against an accidental identity function.
 *
 * `encryptString` is a reversible marker, not encryption — enough to assert
 * that plaintext did not reach the file, and enough for a paired override of
 * `decryptString` to undo.
 */
const STUB_PREFIX = "stub-enc:";

function defaultSafeStorage(): SafeStorageStub {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptString: (plainText: string) =>
      Buffer.from(STUB_PREFIX + plainText, "utf8"),
    decryptString: () => {
      throw new Error(
        "safeStorage.decryptString stub: override it in the test that needs it",
      );
    },
  };
}

/** Mutable on purpose: tests reassign individual methods per case. */
export const safeStorage: SafeStorageStub = defaultSafeStorage();

/** The inverse of the default `encryptString`. Tests opt into it explicitly. */
export function decryptStub(encrypted: Buffer): string {
  const text = encrypted.toString("utf8");
  if (!text.startsWith(STUB_PREFIX)) {
    throw new Error("stub decrypt: not produced by this stub's encryptString");
  }
  return text.slice(STUB_PREFIX.length);
}

/** Restore every default. Call between tests, alongside `resetUserData`. */
export function resetSafeStorage(): void {
  Object.assign(safeStorage, defaultSafeStorage());
}
