// vaultSkillCache.ts — Watch for vault changes and notify skillInjector to refresh
//
// Since vault.json and vault-content/*.json can change at runtime (user edits),
// this module provides a lightweight polling mechanism to clear the skill cache
// when the vault is modified.

import { skillInjector } from "./skillInjector";

let watchInterval: ReturnType<typeof setInterval> | null = null;
let lastVaultMTime = 0;

/**
 * Start polling the vault file for changes. When changed, clears skillInjector's
 * cache so the next prompt rebuild picks up fresh vault skills.
 */
export function startVaultSkillWatcher(pollMs = 5000): void {
  if (watchInterval) return; // already running

  try {
    // Lazy Node-only — this is safe because this module is only imported in main-process
    // or places where Node is available. The skillInjector already guards NODE_AVAILABLE.
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const os = require("os") as typeof import("os");

    const vaultPath = path.join(os.homedir(), ".config", "mosaic-companion", "vault.json");
    const contentDir = path.join(path.dirname(vaultPath), "vault-content");
    if (!fs.existsSync(vaultPath)) {
      console.warn("[VaultSkillCache] vault.json not found, watcher disabled");
      return;
    }

    lastVaultMTime = getMaxMtime(fs, path, vaultPath, contentDir);

    watchInterval = setInterval(() => {
      try {
        const mtime = getMaxMtime(fs, path, vaultPath, contentDir);
        if (mtime > lastVaultMTime) {
          lastVaultMTime = mtime;
          skillInjector.clearCache();
          console.log("[VaultSkillCache] Vault changed — skill cache cleared");
        }
      } catch {
        // ignore stat errors
      }
    }, pollMs);

    console.log(`[VaultSkillCache] Watching ${vaultPath} + ${contentDir} (${pollMs}ms poll)`);
  } catch {
    // fs unavailable — probably renderer context; no watch needed there
  }
}

/**
 * Compute the maximum mtime of vault.json and all files in vault-content/.
 * This catches edits to both box metadata and individual entry files.
 */
function getMaxMtime(
  fs: typeof import("fs"),
  pathModule: typeof import("path"),
  vaultPath: string,
  contentDir: string,
): number {
  let max = fs.statSync(vaultPath).mtimeMs;
  if (fs.existsSync(contentDir)) {
    try {
      const files = fs.readdirSync(contentDir);
      for (const f of files) {
        if (f.endsWith(".json")) {
          const mtime = fs.statSync(pathModule.join(contentDir, f)).mtimeMs;
          if (mtime > max) max = mtime;
        }
      }
    } catch {
      // ignore readdir errors
    }
  }
  return max;
}

/**
 * Stop the vault watcher.
 */
export function stopVaultSkillWatcher(): void {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
}
