/**
 * Soul Grader Service
 * 
 * Implements SOUL.md grading based on the soul-grader-skill standard.
 * Evaluates agent identity documents on an 100-point rubric.
 */

import { SoulGrade, SoulCategoryScore, SoulVerdict } from "../types/soul";

// =============================================================================
// Grading Weights (from soul-grader-skill standard)
// =============================================================================

const CATEGORY_WEIGHTS = {
  missionClarity: { points: 15, keywords: ["mission", "purpose", "outcome", "serve"] },
  identityNegations: { points: 12, keywords: ["you are not", "not a", "never", "negation"] },
  coreThesis: { points: 10, keywords: ["thesis", "because", "so", "therefore", "must"] },
  optimizationHierarchy: { points: 10, keywords: ["optimize", "priority", "rank", "1.", "2.", "3."] },
  hardConstraints: { points: 10, keywords: ["hard rule", "no", "without", "unless", "do not", "never"] },
  softPreferences: { points: 8, keywords: ["prefer", "default", "when", "unless"] },
  authorityEscalation: { points: 10, keywords: ["approve", "escalate", "ask", "allowed", "gate"] },
  voiceTruthfulness: { points: 10, keywords: ["voice", "tone", "truth", "never claim", "evidence"] },
  successArtifacts: { points: 8, keywords: ["success", "done", "artifact", "verify", "evidence", "not done unless"] },
  artifactSeparation: { points: 5, keywords: ["separate", "belongs", "elsewhere", "not in"] },
  runtimeHygiene: { points: 2, keywords: ["hermes", "session", "cache", "reload"] },
};

// =============================================================================
// Automatic Fail Conditions
// =============================================================================

const AUTOMATIC_FAIL_PATTERNS = [
  { pattern: /api[_-]?key|apikey|token|password|secret|private[_-]?key/i, message: "Secrets/credentials detected in SOUL" },
  { pattern: /deployed|published|live|production|working.*fine/i, message: "Unverified deployment claims" },
  { pattern: /always.*right|never.*wrong|perfect|infallible/i, message: "Overconfident truth claims without evidence thresholds" },
  { pattern: /---\s*\n.*:\s*\n.*:\s*\n/s, message: "Excessive YAML frontmatter that may be treated as visible prompt" },
  { pattern: /helpful assistant|friendly|professional|proactive|best practices/i, message: "Generic virtue language without behavior specifics" },
];

// =============================================================================
// Grade Calculation
// =============================================================================

function calculateCategoryScore(
  markdown: string,
  keywords: string[],
  maxPoints: number
): number {
  const lower = markdown.toLowerCase();
  let score = 0;
  
  // Check for section headers
  const hasSection = keywords.some(kw => {
    const sectionPattern = new RegExp(`^##.*${kw}`, "im");
    return sectionPattern.test(lower);
  });
  
  if (hasSection) {
    score += maxPoints * 0.4;
  }
  
  // Check for content
  const keywordMatches = keywords.filter(kw => lower.includes(kw.toLowerCase()));
  const matchRatio = keywordMatches.length / keywords.length;
  score += maxPoints * 0.5 * matchRatio;
  
  // Check for specificity (behavioral language)
  const behavioralPatterns = [
    /without|unless|until|when|if.*then/,
    /\d+\.|\d+\)|\* |\- /,
  ];
  
  const hasBehavioral = behavioralPatterns.some(p => p.test(markdown));
  if (hasBehavioral) {
    score += maxPoints * 0.1;
  }
  
  return Math.min(Math.round(score), maxPoints);
}

function checkAutomaticFails(markdown: string): string[] {
  const blockers: string[] = [];
  
  for (const { pattern, message } of AUTOMATIC_FAIL_PATTERNS) {
    if (pattern.test(markdown)) {
      blockers.push(message);
    }
  }
  
  // Check for missing critical sections
  const lower = markdown.toLowerCase();
  if (!lower.includes("mission") && !lower.includes("purpose")) {
    blockers.push("Missing mission/purpose section");
  }
  
  if (!lower.includes("you are") && !lower.includes("identity")) {
    blockers.push("Missing identity definition");
  }
  
  if (!lower.includes("optimize") && !lower.includes("priority")) {
    blockers.push("Missing optimization hierarchy");
  }
  
  if (!lower.match(/no\s+\w+\s+without|do\s+not|never\s+\w+\s+unless/)) {
    blockers.push("Missing hard constraints with approval gates");
  }
  
  return blockers;
}

function calculateVerdict(score: number, hasBlockers: boolean): SoulVerdict {
  if (hasBlockers) return "Not deployable";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Operational";
  if (score >= 60) return "Scaffold";
  return "Needs rewrite";
}

function calculateDeployability(score: number, hasBlockers: boolean): "Approved" | "Approved with fixes" | "Not approved" {
  if (hasBlockers) return "Not approved";
  if (score >= 90) return "Approved";
  if (score >= 75) return "Approved with fixes";
  return "Not approved";
}

function generateDriftRisks(markdown: string): string[] {
  const risks: string[] = [];
  const lower = markdown.toLowerCase();
  
  if (!lower.includes("not ") && !lower.includes("never ")) {
    risks.push("No negations — agent may drift into wrong roles");
  }
  
  if (!lower.includes("evidence") && !lower.includes("verify")) {
    risks.push("No evidence requirement — agent may claim success without proof");
  }
  
  if (!lower.match(/approve|ask|gate|escalate/)) {
    risks.push("No approval gates — agent may take risky actions autonomously");
  }
  
  if (lower.includes("be careful") || lower.includes("use discretion")) {
    risks.push("Vague constraint language ('be careful') — not behaviorally specific");
  }
  
  if (!lower.match(/\d+\..*\n\d+\./)) {
    risks.push("No numbered priorities — flat virtue list may cause drift under pressure");
  }
  
  if (lower.includes("helpful assistant")) {
    risks.push("Generic 'helpful assistant' identity — may default to wrong behavior");
  }
  
  return risks.slice(0, 3);
}

function generateFixes(markdown: string): string[] {
  const fixes: string[] = [];
  const lower = markdown.toLowerCase();
  
  if (!lower.includes("## mission") && !lower.includes("## purpose")) {
    fixes.push("Add '## Mission' section naming concrete outcomes");
  }
  
  if (!lower.match(/you are not|not a|never become/)) {
    fixes.push("Add identity negations: 'You are not X, not Y'");
  }
  
  if (!lower.match(/\d+\..*\n\d+\..*\n\d+\./)) {
    fixes.push("Add numbered optimization hierarchy (1-3 priorities)");
  }
  
  if (!lower.match(/no \w+ without|do not \w+ until|never \w+ unless/)) {
    fixes.push("Add hard constraints: 'No X without Y approval'");
  }
  
  if (!lower.includes("## voice")) {
    fixes.push("Add '## Voice' section with tone rules, not adjectives");
  }
  
  if (!lower.includes("truth") && !lower.includes("evidence")) {
    fixes.push("Add truthfulness policy with evidence thresholds");
  }
  
  if (!lower.includes("success") && !lower.includes("done")) {
    fixes.push("Add success criteria: what 'done' looks like");
  }
  
  return fixes.slice(0, 3);
}

function generateStrengths(markdown: string): string[] {
  const strengths: string[] = [];
  const lower = markdown.toLowerCase();
  
  if (lower.includes("you are not") && lower.includes("you are")) {
    strengths.push("Clear identity with negations");
  }
  
  if (lower.match(/\d+\..*\n\d+\..*\n\d+\./)) {
    strengths.push("Prioritized optimization hierarchy");
  }
  
  if (lower.match(/no \w+ without|do not \w+ until/)) {
    strengths.push("Hard constraints with approval gates");
  }
  
  if (lower.includes("evidence") || lower.includes("verify")) {
    strengths.push("Evidence-based truthfulness policy");
  }
  
  if (lower.includes("artifact") || lower.includes("not done unless")) {
    strengths.push("Durable success criteria");
  }
  
  return strengths.slice(0, 3);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Grade a SOUL.md document according to the soul-grader-skill standard.
 * 
 * @param soulMarkdown The SOUL.md content to grade
 * @returns A SoulGrade object with score, verdict, and recommendations
 */
export async function gradeSoul(soulMarkdown: string): Promise<SoulGrade> {
  // Check automatic fails
  const blockers = checkAutomaticFails(soulMarkdown);
  const hasBlockers = blockers.length > 0;
  
  // Calculate category scores
  const categoryScores: SoulCategoryScore[] = [
    {
      category: "Mission clarity",
      points: CATEGORY_WEIGHTS.missionClarity.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.missionClarity.keywords, CATEGORY_WEIGHTS.missionClarity.points),
      notes: "Names who/what the agent serves"
    },
    {
      category: "Identity + negations",
      points: CATEGORY_WEIGHTS.identityNegations.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.identityNegations.keywords, CATEGORY_WEIGHTS.identityNegations.points),
      notes: "What it is and must not become"
    },
    {
      category: "Core thesis",
      points: CATEGORY_WEIGHTS.coreThesis.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.coreThesis.keywords, CATEGORY_WEIGHTS.coreThesis.points),
      notes: "Durable decision lens"
    },
    {
      category: "Optimization hierarchy",
      points: CATEGORY_WEIGHTS.optimizationHierarchy.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.optimizationHierarchy.keywords, CATEGORY_WEIGHTS.optimizationHierarchy.points),
      notes: "Ranked tradeoffs"
    },
    {
      category: "Hard constraints",
      points: CATEGORY_WEIGHTS.hardConstraints.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.hardConstraints.keywords, CATEGORY_WEIGHTS.hardConstraints.points),
      notes: "True filters with approval"
    },
    {
      category: "Soft preferences",
      points: CATEGORY_WEIGHTS.softPreferences.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.softPreferences.keywords, CATEGORY_WEIGHTS.softPreferences.points),
      notes: "Defaults, not bans"
    },
    {
      category: "Authority + escalation",
      points: CATEGORY_WEIGHTS.authorityEscalation.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.authorityEscalation.keywords, CATEGORY_WEIGHTS.authorityEscalation.points),
      notes: "Allowed/ask-before/never"
    },
    {
      category: "Voice + truthfulness",
      points: CATEGORY_WEIGHTS.voiceTruthfulness.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.voiceTruthfulness.keywords, CATEGORY_WEIGHTS.voiceTruthfulness.points),
      notes: "Tone, evidence thresholds"
    },
    {
      category: "Success / artifacts",
      points: CATEGORY_WEIGHTS.successArtifacts.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.successArtifacts.keywords, CATEGORY_WEIGHTS.successArtifacts.points),
      notes: "Verifiable completion"
    },
    {
      category: "Artifact separation",
      points: CATEGORY_WEIGHTS.artifactSeparation.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.artifactSeparation.keywords, CATEGORY_WEIGHTS.artifactSeparation.points),
      notes: "Keeps commands elsewhere"
    },
    {
      category: "Runtime hygiene",
      points: CATEGORY_WEIGHTS.runtimeHygiene.points,
      score: calculateCategoryScore(soulMarkdown, CATEGORY_WEIGHTS.runtimeHygiene.keywords, CATEGORY_WEIGHTS.runtimeHygiene.points),
      notes: "Fits Hermes loading"
    },
  ];
  
  // Calculate total score
  const totalScore = categoryScores.reduce((sum, cat) => sum + cat.score, 0);
  
  // Generate verdict
  const verdict = calculateVerdict(totalScore, hasBlockers);
  const deployability = calculateDeployability(totalScore, hasBlockers);
  
  // Generate analysis
  const driftRisks = generateDriftRisks(soulMarkdown);
  const strengths = generateStrengths(soulMarkdown);
  const fixes = generateFixes(soulMarkdown);
  
  return {
    score: totalScore,
    verdict,
    deployability,
    scope: "business-internal", // Default scope, could be detected
    automaticBlockers: blockers,
    categoryScores,
    topDriftRisks: driftRisks,
    strengths,
    fixes,
    gradedAt: Date.now(),
  };
}

/**
 * Quick grade for inline validation.
 * Returns just score and verdict without full analysis.
 */
export async function quickGradeSoul(soulMarkdown: string): Promise<{
  score: number;
  verdict: SoulVerdict;
  deployable: boolean;
}> {
  const blockers = checkAutomaticFails(soulMarkdown);
  const hasBlockers = blockers.length > 0;
  
  // Simplified scoring
  let score = 0;
  const lower = soulMarkdown.toLowerCase();
  
  // Basic presence checks
  if (lower.includes("mission") || lower.includes("purpose")) score += 15;
  if (lower.includes("you are") && lower.includes("you are not")) score += 12;
  if (lower.match(/\d+\..*\n\d+\./)) score += 10;
  if (lower.match(/no \w+ without/)) score += 10;
  if (lower.includes("voice") || lower.includes("tone")) score += 10;
  if (lower.includes("evidence") || lower.includes("verify")) score += 10;
  if (lower.includes("done") || lower.includes("success")) score += 8;
  
  const verdict = calculateVerdict(score, hasBlockers);
  
  return {
    score,
    verdict,
    deployable: !hasBlockers && score >= 75,
  };
}

/**
 * Generate a default SOUL.md for a new custom agent.
 */
export function generateDefaultSoul(agentName: string): string {
  return `---
name: ${agentName.toLowerCase().replace(/\s+/g, "-")}
description: Custom agent identity
---

# SOUL.md — ${agentName}

You are **${agentName}**, the user's custom agent.

You are not a generic assistant, not a black box, and not a mind reader.

## Mission

[What this agent helps the user accomplish — concrete outcomes, not vibes]

## Core thesis

[User/domain pressure], so you must [compensating behavior] without [overcorrection].

## Optimize for

1. **[Priority]** — [concrete meaning].
2. **[Priority]** — [concrete meaning].
3. **[Priority]** — [concrete meaning].

## Hard rules

- No [risky action] without [approval/evidence].
- Do not claim [state/access/outcome] until [verification].
- Do not [prohibited behavior] unless [condition].

## Voice

[Behavioral tone: calm/direct/patient/etc.]. In [context], be [specific]. Never use [banned tone].

## Truthfulness policy

Never claim [status/access/action] unless [evidence source]. If data is incomplete, say what is missing, where you looked, and what would resolve it.

## Success / definition of done

A [task/object] is not done unless [durable artifacts], [evidence], [verification], and [next actions] are recorded.
`;
}

export default {
  gradeSoul,
  quickGradeSoul,
  generateDefaultSoul,
};
