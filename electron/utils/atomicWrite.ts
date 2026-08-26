/**
 * Write-temp-then-rename, with fsync.
 *
 * `fs.writeFileSync` truncates the target and then writes into it, so a crash,
 * a power loss or a full disk mid-write leaves a truncated or empty file where
 * the user's data was. That is tolerable for a cache and not for the Vault,
 * where the first open after an upgrade rewrites the user's largest file.
 *
 * `electron/addons/state.ts` does write-then-rename without an fsync. Do not
 * copy that: rename is atomic with respect to *readers*, but without fsyncing
 * the temp file first a power loss can leave the rename durable and the
 * contents not — a zero-length file at the target, which is the exact failure
 * the atomicity is for.
 *
 * Two honest limits. Node's `fsyncSync` is `fsync(2)`, which on macOS flushes to
 * the drive's cache and not to the platter — closing that window needs
 * `F_FULLFSYNC`, which Node does not expose. So on the primary desktop platform
 * this narrows the power-loss window rather than closing it. And a symlinked
 * target is *replaced* by a regular file here, where `writeFileSync` would have
 * followed the link: anyone who symlinked a box file into a synced folder stops
 * syncing, silently, with the old target left holding stale content.
 *
 * There is no test for the fsync. Nothing at this level can assert it — which is
 * worth knowing, because it is the single property that distinguishes this
 * module from the precedent above.
 */

import fs from "fs";
import path from "path";

let counter = 0;

/**
 * Replace `filePath` with `data` atomically. Throws on failure, having left
 * the existing file untouched.
 *
 * `mode` defaults to 0o600 — these files hold user data that no other account
 * on the machine has any business reading.
 */
export function writeFileAtomic(
  filePath: string,
  data: string,
  mode = 0o600,
): void {
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${counter++}.tmp`,
  );

  try {
    const fd = fs.openSync(tmp, "w", mode);
    try {
      fs.writeFileSync(fd, data, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    // A renamed-over target takes the temp file's mode, so this is what the
    // final file ends up with; `open` alone would have let umask narrow it.
    // Note the side effect: the first atomic rewrite of an existing 0o644 file
    // silently tightens it to 0o600, which is the intent but is still a change
    // to a file the user may have set permissions on.
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // Nothing to clean up, or nothing we can do about it.
    }
    throw error;
  }

  // Make the rename itself durable. Not supported on every platform — Windows
  // cannot open a directory this way — and the rename is still atomic without
  // it, so a failure here is not a failure of the write.
  try {
    const dirFd = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(dirFd);
    } finally {
      fs.closeSync(dirFd);
    }
  } catch {
    // Best effort.
  }
}
