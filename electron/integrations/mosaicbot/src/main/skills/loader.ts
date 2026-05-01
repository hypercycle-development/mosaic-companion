// ─────────────────────────────────────────────────────────────────────────────
// SKILL.md discovery and loading
// Mirrors src/agents/skills/workspace.ts (loadSkillEntries) from OpenMosaic
//
// Skills are Markdown files with YAML frontmatter at {dir}/{skillName}/SKILL.md.
// Multiple source directories are supported; later sources (higher precedence)
// overwrite earlier ones by skill name.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import type {
  SkillEntry,
  OpenMosaicSkillMetadata,
  SkillInvocationPolicy,
  SkillCommandDispatch,
} from "./types.js";

const MAX_SKILL_FILE_BYTES = 256_000;
const MAX_PER_SOURCE = 200;
const SKILL_FILENAME = "SKILL.md";

export type SkillSource = {
  dir: string;
  source: SkillEntry["source"];
};

/**
 * Load skills from multiple source directories.
 * Precedence: bundled < managed < workspace (later overwrites by name).
 */
export async function loadSkillEntries(
  sources: SkillSource[],
): Promise<SkillEntry[]> {
  const seen = new Map<string, SkillEntry>(); // keyed by lowercased name
  for (const src of sources) {
    for (const entry of await loadFromDir(src.dir, src.source)) {
      seen.set(entry.name.toLowerCase(), entry);
    }
  }
  return [...seen.values()];
}

async function loadFromDir(
  dir: string,
  source: SkillEntry["source"],
): Promise<SkillEntry[]> {
  let subdirs: string[];
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    subdirs = ents
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }

  const skills: SkillEntry[] = [];
  for (const subdir of subdirs.slice(0, MAX_PER_SOURCE)) {
    const skillPath = path.join(subdir, SKILL_FILENAME);
    try {
      const stat = await fs.stat(skillPath);
      if (stat.size > MAX_SKILL_FILE_BYTES) continue;
      const content = await fs.readFile(skillPath, "utf-8");
      const entry = parseSkillFile(skillPath, subdir, source, content);
      if (entry) skills.push(entry);
    } catch {
      /* no SKILL.md */
    }
  }
  return skills;
}

function parseSkillFile(
  filePath: string,
  baseDir: string,
  source: SkillEntry["source"],
  content: string,
): SkillEntry | null {
  const fm = extractFrontmatter(content);
  if (!fm) return null;

  const name = fm.name?.trim();
  const description = fm.description?.trim();
  if (!name || !description) return null;

  let metadata: OpenMosaicSkillMetadata = {};
  try {
    if (fm.metadata) {
      const parsed = JSON.parse(fm.metadata);
      metadata = parsed?.OpenMosaic ?? {};
    }
  } catch {
    /* malformed metadata */
  }

  const policy: SkillInvocationPolicy = {
    userInvocable: fm["user-invocable"] !== "false",
    disableModelInvocation: fm["disable-model-invocation"] === "true",
  };

  let dispatch: SkillCommandDispatch | undefined;
  const dispatchKind = fm["command-dispatch"] ?? fm["command_dispatch"];
  if (dispatchKind === "tool") {
    const toolName = fm["command-tool"] ?? fm["command_tool"];
    if (toolName) {
      dispatch = {
        kind: "tool",
        toolName,
        argMode: fm["command-arg-mode"] === "raw" ? "raw" : undefined,
      };
    }
  }

  return {
    name,
    description,
    filePath,
    source,
    baseDir,
    content,
    metadata,
    policy,
    dispatch,
  };
}

/** Extract YAML frontmatter between --- delimiters. Returns flat string key-value map. */
function extractFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
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
  return out;
}

/** Return default skill source directories for an Electron app. */
export function defaultSkillSources(
  appDir: string,
  workspaceDir: string,
): SkillSource[] {
  return [
    // Bundled with the app binary (lowest precedence)
    { dir: path.join(__dirname, "../../bundled-skills"), source: "bundled" },
    // User-managed skills
    { dir: path.join(appDir, "skills"), source: "managed" },
    // Workspace-local skills (highest precedence)
    { dir: path.join(workspaceDir, "skills"), source: "workspace" },
  ];
}
