/**
 * `addonAPI.files` — implicit; jailed to `addons/<id>/data/`. Every
 * path is normalized and re-checked against the resolved data dir main-side;
 * any resolution that escapes it is rejected as `BAD_ARGS` — the renderer
 * never gets to touch the filesystem directly.
 */

import fs from "fs";
import path from "path";
import { getAddonDataDir } from "../loader";
import { assertString, ApiValidationError, type ApiNamespace } from "./types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ADDON_BYTES = 200 * 1024 * 1024;

/**
 * A string-prefix check alone is not a jail: an addon ships whatever it likes
 * inside its own directory, and a symlink at `data/escape -> /` resolves to a
 * path that still *starts with* dataDir while pointing anywhere on disk. Tar
 * extraction preserves symlink entries, so this is shippable in an addon
 * tarball. Since the `files` namespace carries no permission at all, that
 * would be unconsented arbitrary read/write.
 *
 * So resolve symlinks before deciding. For paths that don't exist yet (writes,
 * mkdir) walk up to the nearest existing ancestor and realpath that instead —
 * a link anywhere along the chain is what matters, not the leaf.
 */
function resolveJailedPath(addonId: string, relPath: string): string {
  const dataDir = getAddonDataDir(addonId);
  if (!dataDir) throw new ApiValidationError("Addon data directory unavailable");

  const realDataDir = fs.existsSync(dataDir) ? fs.realpathSync(dataDir) : dataDir;
  const resolved = path.join(dataDir, relPath);

  let probe = resolved;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const realProbe = fs.existsSync(probe) ? fs.realpathSync(probe) : probe;
  const realResolved = path.join(realProbe, path.relative(probe, resolved));

  const escapes = (p: string, root: string) => p !== root && !p.startsWith(root + path.sep);
  if (escapes(resolved, dataDir) || escapes(realResolved, realDataDir)) {
    throw new ApiValidationError("Path escapes the addon's data directory");
  }
  return resolved;
}

/** Exported for installer.ts's uninstall-dialog data-size display
 * (`addons:get-data-size`) — same recursive walk, one implementation. */
export function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function toBuffer(contents: unknown): Buffer {
  if (typeof contents === "string") return Buffer.from(contents, "utf8");
  if (contents instanceof Uint8Array) return Buffer.from(contents);
  if (Array.isArray(contents)) return Buffer.from(contents as number[]);
  throw new ApiValidationError("contents must be a string or a byte array");
}

export const methods: ApiNamespace = {
  read: {
    handler: (ctx, relPath) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relPath, "relPath"));
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
      return fs.readFileSync(p, "utf8");
    },
  },
  readBinary: {
    handler: (ctx, relPath) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relPath, "relPath"));
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
      return new Uint8Array(fs.readFileSync(p));
    },
  },
  write: {
    handler: (ctx, relPath, contents) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relPath, "relPath"));
      const buf = toBuffer(contents);
      if (buf.byteLength > MAX_FILE_BYTES) {
        throw new ApiValidationError(`File exceeds the ${MAX_FILE_BYTES}-byte per-file cap`);
      }
      const dataDir = getAddonDataDir(ctx.addonId);
      if (!dataDir) throw new ApiValidationError("Addon data directory unavailable");
      const existingSize = fs.existsSync(p) ? fs.statSync(p).size : 0;
      const projected = dirSizeBytes(dataDir) - existingSize + buf.byteLength;
      if (projected > MAX_ADDON_BYTES) {
        throw new ApiValidationError(`Write exceeds the ${MAX_ADDON_BYTES}-byte per-addon cap`);
      }
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, buf);
      return null;
    },
  },
  list: {
    handler: (ctx, relDir) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relDir ?? ".", "relDir"));
      if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return [];
      return fs.readdirSync(p, { withFileTypes: true }).map((entry) => {
        const full = path.join(p, entry.name);
        const stat = fs.statSync(full);
        return { name: entry.name, isDir: entry.isDirectory(), size: stat.size, mtime: stat.mtimeMs };
      });
    },
  },
  delete: {
    handler: (ctx, relPath) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relPath, "relPath"));
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
      return null;
    },
  },
  mkdir: {
    handler: (ctx, relDir) => {
      const p = resolveJailedPath(ctx.addonId, assertString(relDir, "relDir"));
      fs.mkdirSync(p, { recursive: true });
      return null;
    },
  },
};
