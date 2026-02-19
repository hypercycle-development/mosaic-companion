// ─────────────────────────────────────────────────────────────────────────────
// Skill registry: eligibility checking, snapshot building, command matching
// Mirrors src/agents/skills/workspace.ts (buildWorkspaceSkillSnapshot, buildWorkspaceSkillCommandSpecs)
// and src/auto-reply/skill-commands.ts from OpenClaw
// ─────────────────────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import type {
  SkillEntry,
  SkillCommandSpec,
  SkillSnapshot,
  SkillEligibilityContext,
} from "./types.js";

const execFileAsync = promisify(execFile);

const MAX_SKILLS_IN_PROMPT = 150;
const MAX_SKILLS_PROMPT_CHARS = 30_000;

// ── Eligibility ───────────────────────────────────────────────────────────────

/** Probe the current runtime environment. Call once at startup. */
export async function buildEligibilityContext(
  binsToProbe = ["git", "gh", "node", "python3", "docker", "curl"],
): Promise<SkillEligibilityContext> {
  const availableBins = new Set<string>();
  await Promise.all(
    binsToProbe.map(async (bin) => {
      try {
        await execFileAsync(process.platform === "win32" ? "where" : "which", [bin]);
        availableBins.add(bin);
      } catch { /* not found */ }
    }),
  );
  return {
    platform: os.platform(),
    availableBins,
    availableEnv: new Set(Object.keys(process.env)),
  };
}

export function isSkillEligible(skill: SkillEntry, ctx: SkillEligibilityContext): boolean {
  const { metadata } = skill;
  if (metadata.always) return true;
  if (metadata.os?.length && !metadata.os.includes(ctx.platform)) return false;
  if (metadata.requires?.bins) {
    for (const bin of metadata.requires.bins) {
      if (!ctx.availableBins.has(bin)) return false;
    }
  }
  if (metadata.requires?.anyBins?.length) {
    if (!metadata.requires.anyBins.some((b) => ctx.availableBins.has(b))) return false;
  }
  if (metadata.requires?.env) {
    for (const v of metadata.requires.env) {
      if (!ctx.availableEnv.has(v)) return false;
    }
  }
  return true;
}

// ── Command spec generation ───────────────────────────────────────────────────

/** Sanitize a skill name to a valid /command name (lowercase, alphanumeric + _). */
function sanitizeCommandName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 32) || "skill"
  );
}

export function buildSkillCommandSpecs(
  skills: SkillEntry[],
  reservedNames: Set<string> = new Set(),
): SkillCommandSpec[] {
  const usedNames = new Set<string>(reservedNames);
  const specs: SkillCommandSpec[] = [];

  for (const skill of skills) {
    if (!skill.policy.userInvocable) continue;
    let name = sanitizeCommandName(skill.name);
    // Deduplicate: append _2, _3, ...
    if (usedNames.has(name)) {
      let n = 2;
      while (usedNames.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    usedNames.add(name);
    specs.push({ name, skillName: skill.name, description: skill.description, dispatch: skill.dispatch });
  }
  return specs;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/**
 * Build the skill snapshot injected into the agent system prompt.
 * Filters by eligibility and enforces character budget.
 * Mirrors buildWorkspaceSkillSnapshot() in OpenClaw.
 */
export function buildSkillSnapshot(
  skills: SkillEntry[],
  ctx: SkillEligibilityContext,
  filter?: string[],
): SkillSnapshot {
  let eligible = skills.filter(
    (s) => !s.policy.disableModelInvocation && isSkillEligible(s, ctx),
  );

  if (filter?.length) {
    const set = new Set(filter.map((n) => n.toLowerCase()));
    eligible = eligible.filter((s) => set.has(s.name.toLowerCase()));
  }

  eligible = eligible.slice(0, MAX_SKILLS_IN_PROMPT);

  const lines: string[] = [];
  let chars = 0;
  let truncated = 0;
  for (const s of eligible) {
    const line = `- **${s.name}**: ${s.description}`;
    if (chars + line.length > MAX_SKILLS_PROMPT_CHARS) { truncated++; continue; }
    lines.push(line);
    chars += line.length + 1;
  }

  let prompt = `## Available Skills\n\n${lines.join("\n")}`;
  if (truncated > 0) prompt += `\n\n_(${truncated} skills omitted — context budget reached)_`;

  return { prompt, skills: eligible, commandSpecs: buildSkillCommandSpecs(eligible) };
}

// ── Command matching ──────────────────────────────────────────────────────────

/**
 * Match user input to a skill command.
 * Supports two patterns:
 *   /commandname [args]
 *   /skill skillname [args]
 *
 * Mirrors resolveSkillCommandInvocation() in src/auto-reply/skill-commands.ts.
 */
export function resolveSkillCommand(
  input: string,
  specs: SkillCommandSpec[],
): { spec: SkillCommandSpec; args?: string } | null {
  const text = input.trim();
  for (const spec of specs) {
    const p1 = `/${spec.name}`;
    if (text === p1 || text.startsWith(`${p1} `)) {
      return { spec, args: text.slice(p1.length).trim() || undefined };
    }
    const p2 = `/skill ${spec.skillName}`;
    if (text === p2 || text.startsWith(`${p2} `)) {
      return { spec, args: text.slice(p2.length).trim() || undefined };
    }
  }
  return null;
}
