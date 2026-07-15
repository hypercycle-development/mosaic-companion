// vaultSkillCache.ts — Watch for vault changes and notify skillInjector to refresh
//
// Since vault.json and vault-content/*.json can change at runtime (user edits),
// this module provides a lightweight polling mechanism to clear the skill cache
// when the vault is modified.
//
// OPTIMIZATION: Uses SHA-256 content hashing instead of mtime to avoid false
// positives from file system touches. Includes 60s cooldown after clears.

import { skillInjector } from "./skillInjector";
import * as crypto from "crypto";

let watchInterval: ReturnType<typeof setInterval> | null = null;
let lastContentHash = "";
let cooldownUntil = 0;
const COOLDOWN_MS = 60000; // 60 seconds
const DEFAULT_POLL_MS = 30000; // 30 seconds (was 5000ms)

/**
 * Start polling the vault file for changes. When changed, clears skillInjector's
 * cache so the next prompt rebuild picks up fresh vault skills.
 *
 * Uses SHA-256 content hashing instead of mtime to avoid false positives
 * from file system touches, Electron writes, and auto-save operations.
 */
export function startVaultSkillWatcher(pollMs = DEFAULT_POLL_MS): void {
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

    lastContentHash = computeContentHash(fs, path, vaultPath, contentDir);

    watchInterval = setInterval(() => {
      try {
        // Skip if in cooldown period
        if (Date.now() < cooldownUntil) {
          return;
        }

        const currentHash = computeContentHash(fs, path, vaultPath, contentDir);
        if (currentHash !== lastContentHash) {
          lastContentHash = currentHash;
          skillInjector.clearCache();
          // Enter cooldown period
          cooldownUntil = Date.now() + COOLDOWN_MS;
          console.debug("[VaultSkillCache] Vault content changed — skill cache cleared");
        }
      } catch {
        // ignore stat/read errors
      }
    }, pollMs);

    console.debug(`[VaultSkillCache] Watching ${vaultPath} + ${contentDir} (${pollMs}ms poll)`);
  } catch {
    // fs unavailable — probably renderer context; no watch needed there
  }
}

/**
 * Compute SHA-256 hash of vault.json + all vault-content/*.json files.
 * This catches actual content changes while ignoring mtime-only modifications.
 */
function computeContentHash(
  fs: typeof import("fs"),
  pathModule: typeof import("path"),
  vaultPath: string,
  contentDir: string,
): string {
  const hash = crypto.createHash("sha256");

  // Hash vault.json
  try {
    const vaultContent = fs.readFileSync(vaultPath);
    hash.update(vaultContent);
  } catch {
    // If we can't read vault.json, return empty hash to trigger re-read
    hash.update("vault-unavailable");
  }

  // Hash all vault-content/*.json files (sorted for consistency)
  if (fs.existsSync(contentDir)) {
    try {
      const files = fs.readdirSync(contentDir)
        .filter(f => f.endsWith(".json"))
        .sort();
      for (const f of files) {
        try {
          const fileContent = fs.readFileSync(pathModule.join(contentDir, f));
          hash.update(fileContent);
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // ignore readdir errors
    }
  }

  return hash.digest("hex");
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
