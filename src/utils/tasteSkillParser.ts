/**
 * Taste-Skill Parser
 *
 * Parses Taste-Skill SKILL.md files into structured Vault entries.
 * Extracts frontmatter, dials, triggers, and presets from markdown.
 */

// VaultEntry type is available globally from global.d.ts

export interface ParsedTasteSkill {
  installName: string;
  description: string;
  category: string;
  version?: string;
  dials: {
    designVariance: number;
    motionIntensity: number;
    visualDensity: number;
  };
  triggers: Array<{
    signal: string;
    variance: number;
    motion: number;
    density: number;
  }>;
  presets: Array<{
    name: string;
    variance: number;
    motion: number;
    density: number;
  }>;
  outputType: "code" | "images" | "both";
  rawContent: string;
}

const DEFAULT_DIALS = { designVariance: 8, motionIntensity: 6, visualDensity: 4 };

/**
 * Extract YAML frontmatter from SKILL.md content
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return {};
  const frontmatter = match[1];
  const result: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) result[kv[1].trim()] = kv[2].trim();
  }
  return result;
}

/**
 * Extract dial values from the Three Dials section
 */
function parseDials(content: string): typeof DEFAULT_DIALS {
  // Look for inline dial values like `DESIGN_VARIANCE: 8`
  const varianceMatch = content.match(/DESIGN_VARIANCE\s*[:=]\s*(\d+)/i);
  const motionMatch = content.match(/MOTION_INTENSITY\s*[:=]\s*(\d+)/i);
  const densityMatch = content.match(/VISUAL_DENSITY\s*[:=]\s*(\d+)/i);

  return {
    designVariance: varianceMatch ? parseInt(varianceMatch[1], 10) : DEFAULT_DIALS.designVariance,
    motionIntensity: motionMatch ? parseInt(motionMatch[1], 10) : DEFAULT_DIALS.motionIntensity,
    visualDensity: densityMatch ? parseInt(densityMatch[1], 10) : DEFAULT_DIALS.visualDensity,
  };
}

/**
 * Extract signal-to-dial triggers from Dial Inference table
 */
function parseTriggers(content: string): ParsedTasteSkill["triggers"] {
  const triggers: ParsedTasteSkill["triggers"] = [];

  // Match the Dial Inference table rows
  const tableRegex = /\|\s*"?([^|"]+)"?\s*\|\s*(\d+(?:-\d+)?)\s*\|\s*(\d+(?:-\d+)?)\s*\|\s*(\d+(?:-\d+)?)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(content)) !== null) {
    const signal = match[1].trim();
    const variance = parseRange(match[2]);
    const motion = parseRange(match[3]);
    const density = parseRange(match[4]);

    if (!isNaN(variance) && !isNaN(motion) && !isNaN(density)) {
      triggers.push({ signal, variance, motion, density });
    }
  }

  return triggers;
}

/**
 * Parse a range like "5-6" or "7" into a single number (midpoint)
 */
function parseRange(value: string): number {
  if (value.includes("-")) {
    const [min, max] = value.split("-").map(Number);
    return Math.round((min + max) / 2);
  }
  return Number(value);
}

/**
 * Extract preset configurations from Use-Case Presets table
 */
function parsePresets(content: string): ParsedTasteSkill["presets"] {
  const presets: ParsedTasteSkill["presets"] = [];

  // Match preset table rows: | Name | VARIANCE | MOTION | DENSITY |
  const presetRegex = /\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = presetRegex.exec(content)) !== null) {
    const name = match[1].trim();
    const variance = parseInt(match[2], 10);
    const motion = parseInt(match[3], 10);
    const density = parseInt(match[4], 10);

    // Skip header rows and the Dial Inference table (those have ranges)
    if (
      name.toLowerCase().includes("use case") ||
      name.toLowerCase().includes("signal") ||
      name.toLowerCase().includes("variance") ||
      name.includes("—") ||
      name.includes("-"))
      continue;

    if (variance >= 1 && variance <= 10 && motion >= 1 && motion <= 10 && density >= 1 && density <= 10) {
      presets.push({ name, variance, motion, density });
    }
  }

  return presets;
}

/**
 * Determine output type from skill content
 */
function detectOutputType(content: string, installName: string): "code" | "images" | "both" {
  const lower = content.toLowerCase();
  const nameLower = installName.toLowerCase();

  if (nameLower.includes("imagegen") || nameLower.includes("brandkit")) return "images";
  if (nameLower.includes("image-to-code")) return "both";
  if (lower.includes("image-generation")) return "images";
  if (lower.includes("output images only")) return "images";
  if (lower.includes("does not write code")) return "images";
  return "code";
}

/**
 * Parse a Taste-Skill SKILL.md file into structured data
 */
export function parseTasteSkill(markdown: string, folderName: string): ParsedTasteSkill {
  const frontmatter = parseFrontmatter(markdown);
  const installName = frontmatter.name || folderName;
  const description = frontmatter.description || "";

  const dials = parseDials(markdown);
  const triggers = parseTriggers(markdown);
  const presets = parsePresets(markdown);
  const outputType = detectOutputType(markdown, installName);

  // Infer category from install name or folder
  let category = "design";
  if (installName.includes("brutalist")) category = "brutalist";
  else if (installName.includes("minimalist")) category = "minimalist";
  else if (installName.includes("soft")) category = "soft-ui";
  else if (installName.includes("redesign")) category = "redesign";
  else if (installName.includes("output")) category = "output-enforcement";
  else if (installName.includes("imagegen") || installName.includes("brandkit")) category = "image-generation";
  else if (installName.includes("gpt")) category = "gpt-optimized";

  return {
    installName,
    description,
    category,
    dials,
    triggers,
    presets,
    outputType,
    rawContent: markdown,
  };
}

/**
 * Convert a parsed Taste-Skill into a VaultEntry
 */
export function toVaultEntry(skill: ParsedTasteSkill): VaultEntry {
  const now = Date.now();
  return {
    id: `entry-${now}`,
    label: skill.installName,
    content: skill.rawContent,
    metadata: {
      installName: skill.installName,
      category: skill.category,
      sourceRepo: "https://github.com/Leonxlnx/taste-skill",
      isTasteSkill: true,
      dials: skill.dials,
      outputType: skill.outputType,
    },
    createdAt: now,
    updatedAt: now,
  };
}
