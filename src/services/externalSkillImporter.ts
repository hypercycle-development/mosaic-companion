/**
 * External Skill Repository Importer
 *
 * Imports SKILL.md (and supporting references) from public GitHub repos
 * into the Mosaic Vault. Supports:
 *   - Hermes-style SKILL.md repos (frontmatter + markdown body)
 *   - Taste-Skill format with dials/triggers/presets
 *   - Plain markdown skill files
 *
 * All content lands in a Vault box so agents can access it via boxAccess.
 */

import type { VaultEntry } from "../../electron/integrations/vault/types";

export interface ExternalRepoRef {
  owner: string;
  repo: string;
  /** Branch or tag, default "main" */
  branch?: string;
  /** Subdirectory where SKILL.md lives, e.g. "skills/my-skill" or "" for root */
  skillPath?: string;
  /** Optional install name used for Taste-Skill metadata */
  installName?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  entries: Array<{ label: string; installName: string; category?: string }>;
  errors: string[];
}

const RAW_BASE = "https://raw.githubusercontent.com";
const API_BASE = "https://api.github.com/repos";

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return r.status === 200 ? await r.text() : null;
  } catch (e) {
    return null;
  }
}

function parseFrontmatter(md: string): { frontmatter: Record<string, any>; body: string } {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: md };
  const raw = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};
  // Very small YAML parser for the keys we care about
  const lines = raw.split("\n");
  let currentKey: string | null = null;
  let currentValue: string[] = [];
  const flush = () => {
    if (currentKey) {
      const joined = currentValue.join("\n").trim();
      frontmatter[currentKey] = joined;
      currentKey = null;
      currentValue = [];
    }
  };
  for (const line of lines) {
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      flush();
      currentKey = keyMatch[1];
      currentValue.push(keyMatch[2]);
    } else if (/^\s+/.test(line) && currentKey) {
      currentValue.push(line.trim());
    } else {
      flush();
    }
  }
  flush();
  return { frontmatter, body };
}

function detectCategory(frontmatter: Record<string, any>, repoName: string): string {
  const raw = String(frontmatter.category || "").toLowerCase();
  if (raw) return raw;
  if (repoName.includes("mcp")) return "mcp";
  if (/(forecast|timeseries|data|ml|ai|model)/.test(repoName)) return "data-science";
  if (/(agent|flue|code|codex|claude)/.test(repoName)) return "autonomous-ai-agents";
  return "external-skills";
}

function detectOutputType(md: string): "code" | "images" | "both" {
  const low = md.toLowerCase();
  const hasCode = low.includes("```") || low.includes("install") || low.includes("npm install");
  const hasImages = low.includes("image") || low.includes("png") || low.includes("generate image");
  if (hasCode && hasImages) return "both";
  if (hasImages) return "images";
  return "code";
}

function parseDials(md: string): { designVariance?: number; motionIntensity?: number; visualDensity?: number } | undefined {
  const variance = md.match(/DESIGN_VARIANCE[^\d]*(\d+)/)?.[1];
  const motion = md.match(/MOTION_INTENSITY[^\d]*(\d+)/)?.[1];
  const density = md.match(/VISUAL_DENSITY[^\d]*(\d+)/)?.[1];
  if (!variance && !motion && !density) return undefined;
  return {
    designVariance: variance ? parseInt(variance, 10) : undefined,
    motionIntensity: motion ? parseInt(motion, 10) : undefined,
    visualDensity: density ? parseInt(density, 10) : undefined,
  };
}

export async function importRepoSkill(
  ref: ExternalRepoRef,
  addEntry: (entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; entry?: VaultEntry; error?: string }>,
): Promise<ImportResult> {
  const branch = ref.branch || "main";
  const skillPath = (ref.skillPath || "").replace(/^\/+|\/+$/g, "");
  const skillMdPath = skillPath ? `${skillPath}/SKILL.md` : "SKILL.md";
  const url = `${RAW_BASE}/${ref.owner}/${ref.repo}/${branch}/${skillMdPath}`;
  const md = await fetchText(url);
  if (!md) {
    return { success: false, imported: 0, failed: 1, entries: [], errors: [`Failed to fetch ${url}`] };
  }

  const { frontmatter, body } = parseFrontmatter(md);
  const name = String(frontmatter.name || ref.installName || skillPath || ref.repo);
  const installName = ref.installName || name;
  const category = detectCategory(frontmatter, ref.repo);
  const description = String(frontmatter.description || "");

  // Build metadata compatible with TasteSkillMetadata shape in Vault types
  const dials = parseDials(md);
  const metadata: VaultEntry["metadata"] = {
    installName,
    category,
    sourceRepo: `https://github.com/${ref.owner}/${ref.repo}`,
    isTasteSkill: !!dials,
    version: String(frontmatter.version || "1.0.0"),
    dials,
    outputType: detectOutputType(md),
  };

  const result = await addEntry({
    label: name,
    content: md,
    metadata,
  });

  if (!result.success) {
    return { success: false, imported: 0, failed: 1, entries: [], errors: [result.error || "addEntry failed"] };
  }

  return {
    success: true,
    imported: 1,
    failed: 0,
    entries: [{ label: name, installName, category }],
    errors: [],
  };
}

/**
 * Bulk import a list of external repo skills into a target Vault box.
 */
export async function importRepoSkills(
  refs: ExternalRepoRef[],
  addEntry: (entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => Promise<{ success: boolean; entry?: VaultEntry; error?: string }>,
): Promise<ImportResult> {
  const merged: ImportResult = { success: true, imported: 0, failed: 0, entries: [], errors: [] };
  for (const ref of refs) {
    const r = await importRepoSkill(ref, addEntry);
    merged.imported += r.imported;
    merged.failed += r.failed;
    merged.entries.push(...r.entries);
    merged.errors.push(...r.errors);
  }
  merged.success = merged.failed === 0;
  return merged;
}

/**
 * Canonical preset of external superpower repos the user asked to integrate.
 */
export function defaultExternalRepoPresets(): ExternalRepoRef[] {
  return [
    { owner: "Kilo-Org", repo: "kilocode", skillPath: "", installName: "kilocode" },
    { owner: "obra", repo: "superpowers", skillPath: "", installName: "superpowers" },
    { owner: "DeusData", repo: "codebase-memory-mcp", skillPath: "", installName: "codebase-memory-mcp" },
    { owner: "google-research", repo: "timesfm", skillPath: "timesfm-forecasting", installName: "timesfm-forecasting" },
    { owner: "withastro", repo: "flue", skillPath: "skills/flue", installName: "flue" },
  ];
}
