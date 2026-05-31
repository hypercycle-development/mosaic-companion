/**
 * Taste-Skill Import Service
 *
 * Fetches Taste-Skill skills from GitHub and imports them into the Vault
 * as structured entries with metadata (dials, triggers, presets).
 */

import { parseTasteSkill, toVaultEntry, type ParsedTasteSkill } from "../utils/tasteSkillParser";

const TASTE_SKILL_REPO = "https://api.github.com/repos/Leonxlnx/taste-skill";
const RAW_BASE = "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills";

/** The list of skills in the repo from llms.txt */
const SKILL_INDEX: Array<{ folder: string; installName: string; category: string }> = [
  { folder: "taste-skill", installName: "design-taste-frontend", category: "design" },
  { folder: "taste-skill-v1", installName: "design-taste-frontend-v1", category: "design" },
  { folder: "gpt-tasteskill", installName: "gpt-taste", category: "gpt-optimized" },
  { folder: "image-to-code-skill", installName: "image-to-code", category: "image-code" },
  { folder: "redesign-skill", installName: "redesign-existing-projects", category: "redesign" },
  { folder: "soft-skill", installName: "high-end-visual-design", category: "soft-ui" },
  { folder: "output-skill", installName: "full-output-enforcement", category: "output" },
  { folder: "minimalist-skill", installName: "minimalist-ui", category: "minimalist" },
  { folder: "brutalist-skill", installName: "industrial-brutalist-ui", category: "brutalist" },
  { folder: "stitch-skill", installName: "stitch-design-taste", category: "design" },
  { folder: "imagegen-frontend-web", installName: "imagegen-frontend-web", category: "image-gen" },
  { folder: "imagegen-frontend-mobile", installName: "imagegen-frontend-mobile", category: "image-gen" },
  { folder: "brandkit", installName: "brandkit", category: "image-gen" },
];

/**
 * Fetch a single SKILL.md from GitHub raw content
 */
async function fetchSkillMarkdown(folder: string): Promise<string | null> {
  const url = `${RAW_BASE}/${folder}/SKILL.md`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) {
      console.warn(`[TasteSkillImport] Failed to fetch ${folder}: ${r.status}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.warn(`[TasteSkillImport] Error fetching ${folder}:`, e);
    return null;
  }
}

/**
 * Import all Taste-Skill entries into a Vault box
 *
 * @param vaultAddEntry - callback to add entry to vault (ipc)
 * @param targetBoxId - the vault box ID to import into
 * @returns summary of import results
 */
export async function importTasteSkills(
  vaultAddEntry: (boxId: string, entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => Promise<VaultEntry | null>,
  targetBoxId: string = "box-taste-skills",
): Promise<{
  imported: number;
  failed: number;
  skills: Array<{ installName: string; label: string; dials: ParsedTasteSkill["dials"] }>;
}> {
  const results: Array<{ installName: string; label: string; dials: ParsedTasteSkill["dials"] }> = [];
  let imported = 0;
  let failed = 0;

  // Fetch all skills in parallel
  const fetches = SKILL_INDEX.map(async (skillInfo) => {
    const markdown = await fetchSkillMarkdown(skillInfo.folder);
    if (!markdown) {
      failed++;
      return;
    }

    try {
      const parsed = parseTasteSkill(markdown, skillInfo.folder);
      // Override category from known index for consistency
      parsed.category = skillInfo.category;

      const entry = toVaultEntry(parsed);

      // Use the provided callback to persist to vault
      const saved = await vaultAddEntry(targetBoxId, {
        label: entry.label,
        content: entry.content,
        metadata: entry.metadata,
      });

      if (saved) {
        imported++;
        results.push({
          installName: parsed.installName,
          label: entry.label || parsed.installName,
          dials: parsed.dials,
        });
        console.log(`[TasteSkillImport] ✓ Imported: ${parsed.installName} (dials: ${parsed.dials.designVariance}/${parsed.dials.motionIntensity}/${parsed.dials.visualDensity})`);
      } else {
        failed++;
        console.warn(`[TasteSkillImport] ✗ Failed to save: ${parsed.installName}`);
      }
    } catch (e) {
      failed++;
      console.error(`[TasteSkillImport] ✗ Parse error for ${skillInfo.folder}:`, e);
    }
  });

  await Promise.all(fetches);

  return { imported, failed, skills: results };
}

/**
 * Quick import — fetches only the default taste-skill (v2)
 */
export async function importDefaultTasteSkill(
  vaultAddEntry: (boxId: string, entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => Promise<VaultEntry | null>,
  targetBoxId: string = "box-taste-skills",
): Promise<ParsedTasteSkill | null> {
  const markdown = await fetchSkillMarkdown("taste-skill");
  if (!markdown) return null;

  const parsed = parseTasteSkill(markdown, "taste-skill");
  const entry = toVaultEntry(parsed);

  await vaultAddEntry(targetBoxId, {
    label: entry.label,
    content: entry.content,
    metadata: entry.metadata,
  });

  return parsed;
}

/**
 * Get available Taste-Skill presets for UI display
 */
export function getTasteSkillPresets(skill: ParsedTasteSkill): Array<{
  name: string;
  dials: { designVariance: number; motionIntensity: number; visualDensity: number };
}> {
  return skill.presets.map((p) => ({
    name: p.name,
    dials: {
      designVariance: p.variance,
      motionIntensity: p.motion,
      visualDensity: p.density,
    },
  }));
}

/**
 * Format a skill with specific dial values for prompt injection
 */
export function formatSkillWithDials(
  skill: ParsedTasteSkill,
  dials?: { designVariance?: number; motionIntensity?: number; visualDensity?: number },
): string {
  const effectiveDials = {
    designVariance: dials?.designVariance ?? skill.dials.designVariance,
    motionIntensity: dials?.motionIntensity ?? skill.dials.motionIntensity,
    visualDensity: dials?.visualDensity ?? skill.dials.visualDensity,
  };

  // Build dial override block
  const dialBlock = `\n---\n## CURRENT DIALS (User Override)\n- DESIGN_VARIANCE: ${effectiveDials.designVariance}\n- MOTION_INTENSITY: ${effectiveDials.motionIntensity}\n- VISUAL_DENSITY: ${effectiveDials.visualDensity}\n---\n`;

  return skill.rawContent + dialBlock;
}
