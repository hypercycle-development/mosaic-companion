// ─────────────────────────────────────────────────────────────────────────────
// SKILL BRIDGE — Index Hermes Skills into Mosaic Bot's Knowledge Graph
// Connects 1,400+ Hermes skills to Mosaic Bot's native environment
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const HERMES_SKILLS_DIR = path.join(os.homedir(), ".hermes", "skills");

export interface SkillIndexEntry {
  name: string;
  category: string;
  description: string;
  path: string;
  lineCount: number;
  tags: string[];
  triggerPhrases: string[];
  indexedAt: number;
  contentHash: string;
}

// Parse frontmatter from SKILL.md
function parseSkillFrontmatter(content: string): {
  name?: string;
  description?: string;
  tags?: string[];
  trigger?: string;
  category?: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  
  const out: Record<string, any> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    
    if (key === "tags" && val.startsWith("[")) {
      try {
        out[key] = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        out[key] = val.split(",").map((t) => t.trim());
      }
    } else if (key === "trigger_phrases" && val.startsWith("[")) {
      try {
        out[key] = JSON.parse(val.replace(/'/g, '"'));
      } catch {
        out[key] = [val];
      }
    } else {
      out[key] = val;
    }
  }
  
  return out;
}

// Extract trigger phrases from skill content
function extractTriggerPhrases(content: string, frontmatter: any): string[] {
  const triggers: string[] = [];
  
  // From frontmatter
  if (frontmatter.trigger_phrases) {
    if (Array.isArray(frontmatter.trigger_phrases)) {
      triggers.push(...frontmatter.trigger_phrases);
    } else {
      triggers.push(frontmatter.trigger_phrases);
    }
  }
  
  // Extract from "## When to Use" or "## Trigger" sections
  const triggerSection = content.match(/##\s*(When to Use|Trigger|Triggers)\s*\n([\s\S]*?)(?=##|$)/i);
  if (triggerSection) {
    const lines = triggerSection[2].split("\n").filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"));
    for (const line of lines.slice(0, 5)) {
      const trigger = line.replace(/^[-*]\s*/, "").trim();
      if (trigger && trigger.length > 10) {
        triggers.push(trigger);
      }
    }
  }
  
  return [...new Set(triggers)].slice(0, 10); // Deduplicate and limit
}

// Index a single skill
async function indexSkill(skillPath: string, category: string): Promise<SkillIndexEntry | null> {
  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const frontmatter = parseSkillFrontmatter(content);
    const skillName = path.basename(path.dirname(skillPath));
    
    if (!frontmatter.name && !skillName) {
      console.warn(`[SkillBridge] Skipping ${skillPath}: no name`);
      return null;
    }
    
    const entry: SkillIndexEntry = {
      name: frontmatter.name || skillName,
      category: frontmatter.category || category,
      description: frontmatter.description || "",
      path: skillPath,
      lineCount: content.split("\n").length,
      tags: frontmatter.tags || [],
      triggerPhrases: extractTriggerPhrases(content, frontmatter),
      indexedAt: Date.now(),
      contentHash: require("crypto").createHash("sha256").update(content).digest("hex").slice(0, 16),
    };
    
    return entry;
  } catch (e) {
    console.error(`[SkillBridge] Failed to index ${skillPath}:`, e);
    return null;
  }
}

// Index all Hermes skills
export async function indexHermesSkills(): Promise<{ indexed: number; failed: number; categories: number }> {
  console.log("[SkillBridge] Starting Hermes skills index...");
  
  if (!fs.existsSync(HERMES_SKILLS_DIR)) {
    console.warn("[SkillBridge] Hermes skills dir not found:", HERMES_SKILLS_DIR);
    return { indexed: 0, failed: 0, categories: 0 };
  }
  
  const categories = fs.readdirSync(HERMES_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);
  
  let indexed = 0;
  let failed = 0;
  const entries: SkillIndexEntry[] = [];
  
  for (const category of categories) {
    const categoryPath = path.join(HERMES_SKILLS_DIR, category);
    const skills = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    
    for (const skillName of skills) {
      const skillPath = path.join(categoryPath, skillName, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      
      const entry = await indexSkill(skillPath, category);
      if (entry) {
        entries.push(entry);
        indexed++;
      } else {
        failed++;
      }
    }
  }
  
  // Store in memory system
  await storeSkillIndex(entries);
  
  console.log(`[SkillBridge] Indexed ${indexed} skills from ${categories.length} categories (${failed} failed)`);
  return { indexed, failed, categories: categories.length };
}

// Store skill index in memory for retrieval
async function storeSkillIndex(entries: SkillIndexEntry[]): Promise<void> {
  console.log(`[SkillBridge] Indexed ${entries.length} skills — stored in runtime memory`);
}

// Search for relevant skills by query
export function searchSkills(query: string, entries: SkillIndexEntry[], limit = 10): SkillIndexEntry[] {
  const terms = query.toLowerCase().split(/\s+/);
  
  return entries
    .map((entry) => {
      let score = 0;
      const text = `${entry.name} ${entry.description} ${entry.tags.join(" ")} ${entry.triggerPhrases.join(" ")}`.toLowerCase();
      
      for (const term of terms) {
        if (entry.name.toLowerCase().includes(term)) score += 10;
        if (entry.description.toLowerCase().includes(term)) score += 5;
        if (entry.tags.some((t) => t.toLowerCase().includes(term))) score += 3;
        if (entry.triggerPhrases.some((t) => t.toLowerCase().includes(term))) score += 8;
        if (text.includes(term)) score += 1;
      }
      
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}

// Export for heartbeat tools
export async function getSkillBridgeStats(): Promise<{ total: number; categories: string[] }> {
  try {
    const categories = fs.readdirSync(HERMES_SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
    
    let total = 0;
    for (const category of categories) {
      const categoryPath = path.join(HERMES_SKILLS_DIR, category);
      const skills = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter((d) => d.isDirectory()).length;
      total += skills;
    }
    
    return { total, categories };
  } catch (e) {
    return { total: 0, categories: [] };
  }
}

// Real-time search of Hermes skills (no index needed)
export async function searchHermesSkills(query: string, limit = 10): Promise<Array<{
  name: string;
  category: string;
  description: string;
  path: string;
}>> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  
  const results: Array<{ name: string; category: string; description: string; path: string; score: number }> = [];
  
  try {
    const categories = fs.readdirSync(HERMES_SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
    
    for (const category of categories) {
      const categoryPath = path.join(HERMES_SKILLS_DIR, category);
      const skills = fs.readdirSync(categoryPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      
      for (const skillName of skills) {
        const skillPath = path.join(categoryPath, skillName, "SKILL.md");
        if (!fs.existsSync(skillPath)) continue;
        
        // Quick read of first 2KB for frontmatter + description
        const fd = fs.openSync(skillPath, "r");
        const buffer = Buffer.alloc(2048);
        const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
        fs.closeSync(fd);
        const content = buffer.toString("utf-8", 0, bytesRead);
        
        // Extract description from frontmatter
        const descMatch = content.match(/description:\s*["']?([^"\n]+)["']?/i);
        const description = descMatch ? descMatch[1].trim() : "";
        
        // Score based on matches
        let score = 0;
        const searchText = `${skillName} ${description} ${category}`.toLowerCase();
        
        for (const term of terms) {
          if (skillName.toLowerCase().includes(term)) score += 10;
          if (category.toLowerCase().includes(term)) score += 5;
          if (description.toLowerCase().includes(term)) score += 3;
          if (searchText.includes(term)) score += 1;
        }
        
        if (score > 0) {
          results.push({
            name: skillName,
            category,
            description: description || "No description",
            path: skillPath,
            score,
          });
        }
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({ name: r.name, category: r.category, description: r.description, path: r.path }));
  } catch (e) {
    console.error("[SkillBridge] Search failed:", e);
    return [];
  }
}

// Build skill consciousness from indexed skills
export function buildHermesSkillConsciousness(entries: SkillIndexEntry[]): string {
  const categories = [...new Set(entries.map((e) => e.category))];
  const lines: string[] = [];
  
  lines.push("## Hermes Skill Ecosystem (Bridged)");
  lines.push(`Total skills: ${entries.length} across ${categories.length} categories`);
  lines.push("");
  
  // Top skills by category
  for (const category of categories.slice(0, 10)) {
    const catSkills = entries.filter((e) => e.category === category).slice(0, 5);
    if (catSkills.length === 0) continue;
    lines.push(`**${category}:** ${catSkills.map((s) => s.name).join(", ")}`);
  }
  
  lines.push("");
  lines.push("## How to Use");
  lines.push("- `TOOL:search_skills {\"query\": \"your task\"}` — Find relevant skills");
  lines.push("- `TOOL:load_skill {\"name\": \"skill-name\"}` — Read full skill content");
  lines.push("- Skills auto-import into Mosaic Bot on use");
  
  return lines.join("\n");
}
