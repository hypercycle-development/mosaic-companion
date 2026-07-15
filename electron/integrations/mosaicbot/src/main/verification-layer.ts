// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION LAYER — Prevent Hallucination in Mosaic Bot
// Every "I created X" claim must be verified against filesystem reality
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

// PRIMARY: 198 imported skills (auto-skill-importer → ~/mosaic-companion/bundled-skills/)
const MAIN_BUNDLED_SKILLS = path.join(__dirname, "../../../../../../bundled-skills");
// LEGACY: 8 runtime skills (keep for backwards compatibility)
const BUNDLED_SKILLS_PATH = path.join(__dirname, "../bundled-skills");
const USER_SKILLS_PATH = path.join(app.getPath("userData"), "mosaicbot", "skills", "mosaicbot-authored");

export interface SkillVerificationResult {
  name: string;
  claimed: boolean;
  exists: boolean;
  path: string | null;
  lineCount: number;
  actualContent: string | null;
  hallucination: boolean;
}

export function verifySkillExists(skillName: string): SkillVerificationResult {
  const result: SkillVerificationResult = {
    name: skillName,
    claimed: true,
    exists: false,
    path: null,
    lineCount: 0,
    actualContent: null,
    hallucination: false,
  };

  // Check PRIMARY bundled skills (198 imported)
  const mainBundledPath = path.join(MAIN_BUNDLED_SKILLS, skillName, "SKILL.md");
  if (fs.existsSync(mainBundledPath)) {
    result.exists = true;
    result.path = mainBundledPath;
    const content = fs.readFileSync(mainBundledPath, "utf-8");
    result.lineCount = content.split("\n").length;
    result.actualContent = content.slice(0, 500);
    return result;
  }

  // Check LEGACY bundled skills (8 runtime)
  const bundledPath = path.join(BUNDLED_SKILLS_PATH, skillName, "SKILL.md");
  if (fs.existsSync(bundledPath)) {
    result.exists = true;
    result.path = bundledPath;
    const content = fs.readFileSync(bundledPath, "utf-8");
    result.lineCount = content.split("\n").length;
    result.actualContent = content.slice(0, 500);
    return result;
  }

  // Check user-authored skills
  const userPath = path.join(USER_SKILLS_PATH, skillName, "SKILL.md");
  if (fs.existsSync(userPath)) {
    result.exists = true;
    result.path = userPath;
    const content = fs.readFileSync(userPath, "utf-8");
    result.lineCount = content.split("\n").length;
    result.actualContent = content.slice(0, 500);
    return result;
  }

  // Skill claimed but doesn't exist = HALLUCINATION
  result.hallucination = true;
  return result;
}

export function verifyAllSkills(claimedSkills: string[]): {
  real: SkillVerificationResult[];
  hallucinated: SkillVerificationResult[];
  summary: string;
} {
  const results = claimedSkills.map(verifySkillExists);
  const real = results.filter(r => r.exists);
  const hallucinated = results.filter(r => r.hallucination);

  const summary = `
=== SKILL VERIFICATION REPORT ===
Total claimed: ${claimedSkills.length}
Actually exist: ${real.length}
HALLUCINATED: ${hallucinated.length}

${hallucinated.length > 0 ? `⚠️ HALLUCINATED SKILLS (do not exist):\n${hallucinated.map(h => `  - ${h.name}`).join("\n")}` : "✅ All skills verified real"}

${real.length > 0 ? `✅ REAL SKILLS:\n${real.map(r => `  - ${r.name}: ${r.lineCount} lines at ${r.path}`).join("\n")}` : ""}
`.trim();

  return { real, hallucinated, summary };
}

// Pre-flight check before claiming skill creation
export function requireSkillProof(skillName: string): void {
  const result = verifySkillExists(skillName);
  if (!result.exists) {
    throw new Error(
      `SKILL CREATION VERIFICATION FAILED: "${skillName}" does not exist on filesystem. ` +
      `Bot attempted to claim success without actually creating the file. ` +
      `Paths checked: ${MAIN_BUNDLED_SKILLS}/${skillName}/SKILL.md, ${BUNDLED_SKILLS_PATH}/${skillName}/SKILL.md, ${USER_SKILLS_PATH}/${skillName}/SKILL.md`
    );
  }
}

// Force bot to only report what actually exists
export function getActualSkillCount(): { mainBundled: number; legacyBundled: number; user: number; total: number } {
  // PRIMARY: 198 imported skills
  const mainBundled = fs.existsSync(MAIN_BUNDLED_SKILLS) 
    ? fs.readdirSync(MAIN_BUNDLED_SKILLS).filter(d => fs.statSync(path.join(MAIN_BUNDLED_SKILLS, d)).isDirectory()).length
    : 0;
  
  // LEGACY: 8 runtime skills
  const legacyBundled = fs.existsSync(BUNDLED_SKILLS_PATH) 
    ? fs.readdirSync(BUNDLED_SKILLS_PATH).filter(d => fs.statSync(path.join(BUNDLED_SKILLS_PATH, d)).isDirectory()).length
    : 0;
  
  // USER: Bot-authored skills
  const user = fs.existsSync(USER_SKILLS_PATH)
    ? fs.readdirSync(USER_SKILLS_PATH).filter(d => fs.statSync(path.join(USER_SKILLS_PATH, d)).isDirectory()).length
    : 0;

  return { mainBundled, legacyBundled, user, total: mainBundled + legacyBundled + user };
}

// Log verification to console (for debugging)
export function logSkillVerification(): void {
  const counts = getActualSkillCount();
  console.log(`[SkillVerification] Total: ${counts.total} (${counts.mainBundled} main bundled + ${counts.legacyBundled} legacy + ${counts.user} user-authored)`);
}
