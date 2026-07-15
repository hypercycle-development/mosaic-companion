// ─────────────────────────────────────────────────────────────────────────────
// Auto-Skill Importer — Monitors ~/.hermes/skills for new/updated skills
// and automatically imports them into Mosaic Bot's bundled-skills directory.
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { watch } from "node:fs";

// ── Types ───────────────────────────────────────────────────────────────────

interface SkillImportRecord {
  hermesPath: string;
  mosaicPath: string;
  importedAt: number;
  version: string;
  status: "active" | "deprecated" | "pending";
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  category?: string;
  trigger?: string;
  platforms?: string[];
}

// ── Config ────────────────────────────────────────────────────────────────

const HERMES_SKILLS_DIR = path.join(process.env.HOME || "/home/mauricio", ".hermes", "skills");
const MOSAIC_BUNDLED_DIR = path.join(
  __dirname,
  "..",
  "..",
  "bundled-skills",
);
const IMPORT_LOG_FILE = path.join(
  app.getPath("userData"),
  "mosaicbot",
  "skill-import-log.json",
);

const MAX_FILE_BYTES = 512_000;

// Small blacklist of truly dangerous skills — everything else auto-imports
const BLACKLIST = new Set([
  "godmode",           // Red-teaming jailbreak
]);

// ── State ───────────────────────────────────────────────────────────────────

let importLog: SkillImportRecord[] = [];
let watcher: fs.FSWatcher | null = null;

// ── Public API ──────────────────────────────────────────────────────────────

export async function startSkillImporter(): Promise<{ stop(): void }> {
  // Load existing import log
  loadImportLog();

  // Initial scan
  await scanAndImport();

  // Watch for changes. NOTE: recursive fs.watch emits async EACCES errors
  // (e.g. root-owned temp dirs like .hermes-tmp.*) on its emitter — without
  // an 'error' handler that becomes an UNCAUGHT EXCEPTION and crashes the
  // whole Electron main process. Handle it and fall back to polling.
  if (fs.existsSync(HERMES_SKILLS_DIR)) {
    try {
      watcher = watch(HERMES_SKILLS_DIR, { recursive: true }, (eventType, filename) => {
        if (filename?.endsWith("SKILL.md")) {
          console.log(`[SkillImporter] Detected change: ${filename}`);
          // Debounce: wait 2s for file writes to settle
          setTimeout(() => scanAndImport(), 2000);
        }
      });
      watcher.on("error", (err: NodeJS.ErrnoException) => {
        console.warn(`[SkillImporter] Watcher error (${err.code}): ${err.message} — disabling watcher, 5-min polling still active`);
        try { watcher?.close(); } catch { /* already dead */ }
        watcher = null;
      });
    } catch (e) {
      console.warn("[SkillImporter] Could not start watcher, relying on polling:", (e as Error).message);
      watcher = null;
    }
  }

  // Also poll every 5 minutes as fallback
  const pollInterval = setInterval(() => scanAndImport(), 5 * 60 * 1000);

  return {
    stop() {
      watcher?.close();
      clearInterval(pollInterval);
    },
  };
}

export function getImportLog(): SkillImportRecord[] {
  return [...importLog];
}

export function getPendingImports(): SkillImportRecord[] {
  return importLog.filter((r) => r.status === "pending");
}

export function getActiveImports(): SkillImportRecord[] {
  return importLog.filter((r) => r.status === "active");
}

// ── Core Logic ──────────────────────────────────────────────────────────────

export async function scanAndImport(): Promise<{ imported: number; pending: number; skipped: number }> {
  let imported = 0;
  let pending = 0;
  let skipped = 0;

  if (!fs.existsSync(HERMES_SKILLS_DIR)) {
    console.warn("[SkillImporter] Hermes skills directory not found:", HERMES_SKILLS_DIR);
    return { imported, pending, skipped };
  }

  // Walk Hermes skills directory
  const categories = fs.readdirSync(HERMES_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const categoryPath = path.join(HERMES_SKILLS_DIR, category);
    const skills = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const skillName of skills) {
      const skillPath = path.join(categoryPath, skillName, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const stat = fs.statSync(skillPath);
      if (stat.size > MAX_FILE_BYTES) {
        console.warn(`[SkillImporter] Skill ${skillName} exceeds size limit (${stat.size} bytes)`);
        skipped++;
        continue;
      }

      const frontmatter = parseSkillFrontmatter(skillPath);
      if (!frontmatter.name) {
        console.warn(`[SkillImporter] Skill ${skillName} has no name in frontmatter`);
        skipped++;
        continue;
      }

      const existingRecord = importLog.find((r) => r.hermesPath === skillPath);
      const hermesMtime = stat.mtimeMs;

      // Check if already imported and up to date
      if (existingRecord) {
        const existingStat = fs.statSync(existingRecord.mosaicPath);
        if (existingStat.mtimeMs >= hermesMtime) {
          continue; // Already up to date
        }
        // Updated skill — re-import
        console.log(`[SkillImporter] Updating skill: ${skillName}`);
      } else {
        // New skill
        console.log(`[SkillImporter] New skill found: ${skillName}`);
      }

      // Determine if skill is safe to auto-import (blacklist only)
      if (BLACKLIST.has(skillName)) {
        console.log(`[SkillImporter] 🚫 Skipped (blacklisted): ${skillName}`);
        skipped++;
        continue;
      }

      // Auto-import all non-blacklisted skills
      const destDir = path.join(MOSAIC_BUNDLED_DIR, skillName);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(skillPath, path.join(destDir, "SKILL.md"));

      const record: SkillImportRecord = {
        hermesPath: skillPath,
        mosaicPath: path.join(destDir, "SKILL.md"),
        importedAt: Date.now(),
        version: frontmatter.version || "1.0.0",
        status: "active",
      };

      if (existingRecord) {
        Object.assign(existingRecord, record);
      } else {
        importLog.push(record);
      }

      imported++;
      console.log(`[SkillImporter] ✅ Imported: ${skillName} (${category})`);
    }
  }

  saveImportLog();
  return { imported, pending: 0, skipped };
}

// ── Approval API ────────────────────────────────────────────────────────────

export function approveSkill(skillName: string): boolean {
  const record = importLog.find((r) => {
    const parts = r.hermesPath.split(path.sep);
    return parts[parts.length - 2] === skillName;
  });

  if (!record || record.status !== "pending") {
    return false;
  }

  const destDir = path.join(MOSAIC_BUNDLED_DIR, skillName);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(record.hermesPath, path.join(destDir, "SKILL.md"));

  record.mosaicPath = path.join(destDir, "SKILL.md");
  record.status = "active";
  record.importedAt = Date.now();

  saveImportLog();
  console.log(`[SkillImporter] ✅ Approved and imported: ${skillName}`);
  return true;
}

export function removeSkill(skillName: string): boolean {
  const record = importLog.find((r) => {
    const parts = r.hermesPath.split(path.sep);
    return parts[parts.length - 2] === skillName;
  });

  if (!record) return false;

  if (record.mosaicPath && fs.existsSync(record.mosaicPath)) {
    fs.unlinkSync(record.mosaicPath);
    const parentDir = path.dirname(record.mosaicPath);
    if (fs.readdirSync(parentDir).length === 0) {
      fs.rmdirSync(parentDir);
    }
  }

  record.status = "deprecated";
  saveImportLog();
  console.log(`[SkillImporter] 🗑️ Removed: ${skillName}`);
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseSkillFrontmatter(skillPath: string): SkillFrontmatter {
  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    const out: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      const val = line
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) out[key] = val;
    }

    return {
      name: out.name,
      description: out.description,
      version: out.version,
      category: out.category,
      trigger: out.trigger,
      platforms: out.platforms ? JSON.parse(out.platforms.replace(/'/g, '"')) : undefined,
    };
  } catch {
    return {};
  }
}

function loadImportLog(): void {
  try {
    if (fs.existsSync(IMPORT_LOG_FILE)) {
      importLog = JSON.parse(fs.readFileSync(IMPORT_LOG_FILE, "utf-8"));
    }
  } catch {
    importLog = [];
  }
}

function saveImportLog(): void {
  fs.mkdirSync(path.dirname(IMPORT_LOG_FILE), { recursive: true });
  fs.writeFileSync(IMPORT_LOG_FILE, JSON.stringify(importLog, null, 2));
}
