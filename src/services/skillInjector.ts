// SkillInjector — Load Hermes skill files and inject into agent system prompts
// This is how local Mosaic AI agents (Basho, etc.) "acquire" skills.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

class SkillInjector {
  private skillCache: Map<string, SkillContent> = new Map();
  private cacheMaxAgeMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolve the full path to a skill directory.
   * Searches: ~/.hermes/skills/<name>/ and ~/.hermes/skills/<category>/<name>/
   */
  private _resolveSkillPath(skillName: string): string | null {
    const home = os.homedir();
    const skillsRoot = path.join(home, ".hermes", "skills");

    // Direct: ~/.hermes/skills/<name>/
    const directPath = path.join(skillsRoot, skillName);
    if (fs.existsSync(path.join(directPath, "SKILL.md"))) {
      return directPath;
    }

    // Nested: ~/.hermes/skills/<category>/<name>/
    try {
      const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const categoryPath = path.join(skillsRoot, entry.name, skillName);
          if (fs.existsSync(path.join(categoryPath, "SKILL.md"))) {
            return categoryPath;
          }
        }
      }
    } catch {
      // skillsRoot doesn't exist
    }

    return null;
  }

  /**
   * Load a single skill from disk, including SKILL.md and all reference files.
   */
  private _loadSkill(skillName: string): SkillContent | null {
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
   */
  getSkill(skillName: string): SkillContent | null {
    const cached = this.skillCache.get(skillName);
    if (cached && Date.now() - cached.loadedAt < this.cacheMaxAgeMs) {
      return cached;
    }

    const loaded = this._loadSkill(skillName);
    if (loaded) {
      this.skillCache.set(skillName, loaded);
      return loaded;
    }

    return null;
  }

  /**
   * Build a system prompt by loading all specified skills and concatenating their content.
   */
  buildSystemPrompt(
    baseSystemPrompt: string,
    skillNames: string[],
    options?: { includeReferences?: boolean; maxTokens?: number }
  ): SkillInjectResult {
    const loadedSkills: string[] = [];
    const failedSkills: string[] = [];
    const skillParts: string[] = [];

    // Include base system prompt
    if (baseSystemPrompt) {
      skillParts.push(baseSystemPrompt);
    }

    // Load and inject each skill
    for (const skillName of skillNames) {
      const skill = this.getSkill(skillName);
      if (!skill) {
        failedSkills.push(skillName);
        continue;
      }

      const parts: string[] = [];
      parts.push(`--- BEGIN SKILL: ${skillName} ---`);
      parts.push(skill.skillMd);

      // Include reference files if requested
      if (options?.includeReferences !== false && skill.references.size > 0) {
        parts.push(`--- REFERENCES FOR ${skillName} ---`);
        const refsArray = Array.from(skill.references.entries());
        for (let i = 0; i < refsArray.length; i++) {
          const [refName, refContent] = refsArray[i];
          parts.push(`[${refName}]`);
          parts.push(refContent);
        }
      }

      parts.push(`--- END SKILL: ${skillName} ---`);
      skillParts.push(parts.join("\n\n"));
      loadedSkills.push(skillName);
    }

    const systemPrompt = skillParts.join("\n\n");
    const totalTokens = Math.ceil(systemPrompt.length / 4); // Rough estimate: ~4 chars per token

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
    console.log("[SkillInjector] Skill cache cleared");
  }
}

// Singleton export
export const skillInjector = new SkillInjector();
