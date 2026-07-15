// SkillInjector — Load Hermes skill files and inject into agent system prompts
//
// NOTE: This file imports "fs" and "path" which are Node.js modules.
// When bundled for the Electron renderer (browser context), these imports
// are externalized by Vite and become undefined. In that case, all
// operations gracefully return empty results and log a warning once.
// The Electron main process has a real skill loader via IPC.
//

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const NODE_AVAILABLE = typeof (fs as any)?.existsSync === "function";

if (!NODE_AVAILABLE) {
  console.warn("[SkillInjector] Node.js fs/path/os unavailable — running in renderer context. Skills will not be loaded from disk.");
}

export interface SkillContent {
  name: string;
  skillMd: string;
  references: Map<string, string>; // filename -> content
  loadedAt: number;
}

export interface SkillInjectResult {
  systemPrompt: string;
  loadedSkills: string[];
  failedSkills: string[];
  totalTokens: number;
}

export interface BuildSystemPromptOptions {
  includeReferences?: boolean;
  maxTokens?: number;
  /** Dial overrides for Taste-Skill format skills */
  dialOverrides?: {
    designVariance?: number;
    motionIntensity?: number;
    visualDensity?: number;
  };
}

class SkillInjector {
  private skillCache: Map<string, SkillContent> = new Map();
  private cacheMaxAgeMs = 5 * 60 * 1000; // 5 minutes
  private _nodeUnavailableWarned = false;

  /**
   * Resolve the full path to a skill directory.
   * Searches: ~/.hermes/skills/<name>/ and ~/.hermes/skills/<category>/<name>/
   * Falls back to: bundled-skills/<name>/
   */
  private _resolveSkillPath(skillName: string): string | null {
    if (!NODE_AVAILABLE) return null;
    const home = os.homedir();
    const skillsRoot = path.join(home, ".hermes", "skills");

    // Direct: ~/.hermes/skills/<name>/
    const directPath = path.join(skillsRoot, skillName);
    if (fs.existsSync(path.join(directPath, "SKILL.md"))) {
      return directPath;
    }

    // Nested: ~/.hermes/skills/<category>/<name>/  (one level)
    try {
      const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const categoryPath = path.join(skillsRoot, entry.name, skillName);
          if (fs.existsSync(path.join(categoryPath, "SKILL.md"))) {
            return categoryPath;
          }
          // Deep search: ~/.hermes/skills/<category>/<subcategory>/<name>/
          try {
            const subEntries = fs.readdirSync(path.join(skillsRoot, entry.name), { withFileTypes: true });
            for (const sub of subEntries) {
              if (sub.isDirectory()) {
                const deepPath = path.join(skillsRoot, entry.name, sub.name, skillName);
                if (fs.existsSync(path.join(deepPath, "SKILL.md"))) {
                  return deepPath;
                }
              }
            }
          } catch { /* subdir unreadable */ }
        }
      }
    } catch {
      // skillsRoot doesn't exist - continue to bundled fallback
    }

    // Fallback: Try bundled-skills directory (for packaged app)
    // The bundled-skills directory is relative to the app root in production builds
    // Check multiple possible locations
    const possibleBundledPaths = [
      // Relative to current working directory (dev mode)
      path.join(process.cwd(), "bundled-skills", skillName),
      // Relative to app root (electron main process)
      path.join(__dirname || "", "..", "..", "bundled-skills", skillName),
      // Alternative electron paths
      path.join(__dirname || "", "..", "bundled-skills", skillName),
      // MosaicBot bundled-skills (for electron/integrations path)
      path.join(__dirname || "", "..", "..", "electron", "integrations", "mosaicbot", "bundled-skills", skillName),
    ];

    for (const bundledPath of possibleBundledPaths) {
      if (fs.existsSync(path.join(bundledPath, "SKILL.md"))) {
        console.log(`[SkillInjector] Found skill "${skillName}" in bundled-skills: ${bundledPath}`);
        return bundledPath;
      }
    }

    return null;
  }

  /**
   * Load a single skill from disk, including SKILL.md and all reference files.
   */
  private _loadSkill(skillName: string): SkillContent | null {
    if (!NODE_AVAILABLE) return null;
    const skillPath = this._resolveSkillPath(skillName);
    if (!skillPath) {
      console.warn(`[SkillInjector] Skill not found: ${skillName}`);
      return null;
    }

    const skillMdPath = path.join(skillPath, "SKILL.md");
    const referencesDir = path.join(skillPath, "references");

    let skillMd = "";
    try {
      skillMd = fs.readFileSync(skillMdPath, "utf8");
    } catch {
      console.warn(`[SkillInjector] Cannot read SKILL.md for ${skillName}`);
      return null;
    }

    const references = new Map<string, string>();
    if (fs.existsSync(referencesDir)) {
      try {
        const refFiles = fs.readdirSync(referencesDir);
        for (const refFile of refFiles) {
          const refPath = path.join(referencesDir, refFile);
          try {
            if (!fs.statSync(refPath).isFile()) continue;
            const content = fs.readFileSync(refPath, "utf8");
            references.set(refFile, content);
          } catch {
            console.warn(`[SkillInjector] Cannot read reference ${refFile} for ${skillName}`);
          }
        }
      } catch {
        // references dir exists but unreadable
      }
    }

    return {
      name: skillName,
      skillMd,
      references,
      loadedAt: Date.now(),
    };
  }

  /**
   * Get a skill from cache or load from disk. Respects cache TTL.
   * Falls back to Vault "Skills" box if Hermes skill dir has no match.
   */
  getSkill(skillName: string): SkillContent | null {
    if (!NODE_AVAILABLE) return null;
    const cached = this.skillCache.get(skillName);
    if (cached && Date.now() - cached.loadedAt < this.cacheMaxAgeMs) {
      return cached;
    }

    const loaded = this._loadSkill(skillName);
    if (loaded) {
      this.skillCache.set(skillName, loaded);
      return loaded;
    }

    const vaultLoaded = this._loadVaultSkill(skillName);
    if (vaultLoaded) {
      this.skillCache.set(skillName, vaultLoaded);
      return vaultLoaded;
    }

    return null;
  }

  /**
   * Fallback: load skill from Mosaic Vault's "Skills" box.
   * Each entry in the box has a label matching the skill name.
   */
  private _loadVaultSkill(skillName: string): SkillContent | null {
    if (!NODE_AVAILABLE) return null;
    try {
      // Possible Electron userData paths (in priority order)
      const appPathCandidates = [
        path.join(os.homedir(), ".config", "mosaic-companion"),
        path.join(os.homedir(), "Library", "Application Support", "Mosaic Browser"),
        path.join(os.homedir(), "AppData", "Roaming", "Mosaic Browser"),
        path.join(os.homedir(), ".config", "Mosaic Browser"),
      ];

      let vaultPath: string | null = null;
      for (const candidate of appPathCandidates) {
        const p = path.join(candidate, "vault.json");
        if (fs.existsSync(p)) {
          vaultPath = p;
          break;
        }
      }
      if (!vaultPath) return null;

      const vaultDir = path.dirname(vaultPath);
      const vault = JSON.parse(fs.readFileSync(vaultPath, "utf8")) as {
        boxes?: Array<{ id: string; name: string }>;
      };
      if (!vault.boxes || vault.boxes.length === 0) return null;

      // Find the "Skills" box (case-insensitive)
      const skillsBox = vault.boxes.find(
        (b) => b.name.toLowerCase() === "skills",
      );
      if (!skillsBox) return null;

      const contentPath = path.join(
        vaultDir,
        "vault-content",
        `${skillsBox.id}.json`,
      );
      if (!fs.existsSync(contentPath)) return null;

      const boxContent = JSON.parse(fs.readFileSync(contentPath, "utf8")) as {
        entries?: Array<{ label?: string; content: string }>;
      };
      if (!boxContent.entries || boxContent.entries.length === 0) return null;

      const entry = boxContent.entries.find(
        (e) => e.label?.toLowerCase() === skillName.toLowerCase(),
      );
      if (!entry) return null;

      return {
        name: skillName,
        skillMd: entry.content,
        references: new Map(),
        loadedAt: Date.now(),
      };
    } catch (e) {
      console.warn(`[SkillInjector] Vault fallback error for ${skillName}:`, e);
      return null;
    }
  }

  /**
   * Build a system prompt by loading all specified skills and concatenating their content.
   */
  buildSystemPrompt(
    baseSystemPrompt: string,
    skillNames: string[],
    options?: BuildSystemPromptOptions
  ): SkillInjectResult {
    const loadedSkills: string[] = [];
    const failedSkills: string[] = [];
    const skillParts: string[] = [];

    // Token budget: reserve room for conversation. Default 12k tokens for skill content.
    const maxTokens = options?.maxTokens ?? 12000;
    const perSkillCap = Math.floor(maxTokens / Math.max(skillNames.length, 1));
    let usedTokens = 0;

    // Include base system prompt first (typically small)
    if (baseSystemPrompt) {
      skillParts.push(baseSystemPrompt);
      usedTokens += Math.ceil(baseSystemPrompt.length / 4);
    }

    // Load and inject each skill, respecting budget
    for (const skillName of skillNames) {
      if (usedTokens >= maxTokens) {
        failedSkills.push(skillName);
        console.warn(`[SkillInjector] Skill ${skillName} skipped: token budget exhausted (${usedTokens}/${maxTokens})`);
        continue;
      }

      const skill = this.getSkill(skillName);
      if (!skill) {
        failedSkills.push(skillName);
        continue;
      }

      const parts: string[] = [];
      parts.push(`--- BEGIN SKILL: ${skillName} ---`);

      // Detect Taste-Skill format (has dial markers)
      const hasDials = skill.skillMd.includes("DESIGN_VARIANCE") ||
                       skill.skillMd.includes("MOTION_INTENSITY") ||
                       skill.skillMd.includes("VISUAL_DENSITY");

      if (hasDials && options?.dialOverrides) {
        // Inject current dial values before the skill content
        const dialBlock = [
          "### CURRENT DIALS (Runtime Override)",
          `- DESIGN_VARIANCE: ${options.dialOverrides.designVariance ?? "(default from skill)"}`,
          `- MOTION_INTENSITY: ${options.dialOverrides.motionIntensity ?? "(default from skill)"}`,
          `- VISUAL_DENSITY: ${options.dialOverrides.visualDensity ?? "(default from skill)"}`,
          "",
          "Apply these dial values instead of the skill's baseline defaults.",
          "",
        ].join("\n");
        parts.push(dialBlock);
      }

      // Truncate skill markdown to per-skill cap to stay within budget
      let skillText = skill.skillMd;
      const availableTokens = Math.max(0, Math.min(perSkillCap, maxTokens - usedTokens));
      if (skillText.length > availableTokens * 4) {
        skillText = skillText.slice(0, availableTokens * 4 - 100)
          + "\n\n[... skill content truncated to fit context window ...]";
      }
      parts.push(skillText);

      // Include reference files if requested, but only while budget remains
      if (options?.includeReferences !== false && skill.references.size > 0) {
        parts.push(`--- REFERENCES FOR ${skillName} ---`);
        const refsArray = Array.from(skill.references.entries());
        for (let i = 0; i < refsArray.length; i++) {
          if (usedTokens >= maxTokens) break;
          const [refName, refContent] = refsArray[i];
          const refCap = Math.max(0, maxTokens - usedTokens) * 4;
          const refText = refContent.length > refCap
            ? refContent.slice(0, refCap - 100) + "\n[... reference truncated ...]"
            : refContent;
          parts.push(`[${refName}]`);
          parts.push(refText);
        }
      }

      parts.push(`--- END SKILL: ${skillName} ---`);
      const section = parts.join("\n\n");
      skillParts.push(section);
      loadedSkills.push(skillName);
      usedTokens += Math.ceil(section.length / 4);
    }

    const systemPrompt = skillParts.join("\n\n");
    const totalTokens = Math.ceil(systemPrompt.length / 4);

    return {
      systemPrompt,
      loadedSkills,
      failedSkills,
      totalTokens,
    };
  }

  /**
   * Clear the skill cache. Call after skill files are modified.
   */
  clearCache(): void {
    this.skillCache.clear();
    console.debug("[SkillInjector] Skill cache cleared");
  }
}

// Singleton export
export const skillInjector = new SkillInjector();
