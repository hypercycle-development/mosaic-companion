// ─────────────────────────────────────────────────────────────────────────────
// Evolution Engine — Skill Creation Pipeline
// Detects patterns → Proposes skills → User approves → Creates → Verifies
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const EVOLUTION_DIR = path.join(app.getPath("userData"), "mosaicbot", "evolution");
const PENDING_SKILLS_FILE = path.join(EVOLUTION_DIR, "pending-skills.json");
const SKILL_HISTORY_FILE = path.join(EVOLUTION_DIR, "skill-history.json");
const PATTERNS_FILE = path.join(EVOLUTION_DIR, "detected-patterns.json");

// Ensure directories exist
function ensureEvolutionDir() {
  if (!fs.existsSync(EVOLUTION_DIR)) {
    fs.mkdirSync(EVOLUTION_DIR, { recursive: true });
  }
}

// ── Pattern Detection ───────────────────────────────────────────────────────

export interface DetectedPattern {
  id: string;
  pattern: string;
  category: "infra" | "code" | "workflow" | "debug";
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  relatedAlerts: string[];
  proposedSkillId?: string;
  status: "detected" | "proposed" | "approved" | "rejected" | "implemented";
}

function loadPatterns(): DetectedPattern[] {
  try {
    if (fs.existsSync(PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[EvolutionEngine] Failed to load patterns:", e);
  }
  return [];
}

// Re-export for IPC
export { loadPatterns };

export function detectPattern(alertText: string, toolCalls: any[]): DetectedPattern | null {
  ensureEvolutionDir();
  
  const patterns: Record<string, { category: DetectedPattern["category"], template: string }> = {
    "fleet_down": { 
      category: "infra", 
      template: "fleet-health-monitor" 
    },
    "c3po_unreachable": { 
      category: "infra", 
      template: "dynamic-ip-handler" 
    },
    "spo_down": { 
      category: "infra", 
      template: "spo-health-monitor" 
    },
    "skill_not_found": { 
      category: "workflow", 
      template: "skill-discovery" 
    },
    "test_failing": { 
      category: "code", 
      template: "test-debugger" 
    },
    "build_error": { 
      category: "code", 
      template: "build-fixer" 
    },
    "pr_stale": { 
      category: "workflow", 
      template: "pr-reminder" 
    },
  };

  const normalized = alertText.toLowerCase();
  
  // Pattern matching
  for (const [key, config] of Object.entries(patterns)) {
    const matches = {
      "fleet_down": normalized.includes("fleet down") || normalized.includes("all hyperaibox"),
      "c3po_unreachable": normalized.includes("c-3po unreachable") || normalized.includes("c3po unreachable"),
      "spo_down": normalized.includes("spo is down") || normalized.includes("spo down"),
      "skill_not_found": normalized.includes("skill not found") || normalized.includes("no skill for"),
      "test_failing": normalized.includes("test failing") || normalized.includes("tests failing"),
      "build_error": normalized.includes("build error") || normalized.includes("build failed"),
      "pr_stale": normalized.includes("pr stale") || normalized.includes("pull request"),
    };
    
    if (matches[key as keyof typeof matches]) {
      return loadOrCreatePattern(key, config.category, config.template, alertText);
    }
  }
  
  return null;
}

function loadOrCreatePattern(
  key: string, 
  category: DetectedPattern["category"], 
  template: string,
  alertText: string
): DetectedPattern {
  const patterns = loadPatterns();
  const existing = patterns.find(p => p.id === key);
  
  const now = Date.now();
  
  if (existing) {
    existing.occurrences++;
    existing.lastSeen = now;
    existing.relatedAlerts.push(alertText.slice(0, 100));
    if (existing.relatedAlerts.length > 10) {
      existing.relatedAlerts.shift(); // Keep last 10
    }
    savePatterns(patterns);
    return existing;
  }
  
  const newPattern: DetectedPattern = {
    id: key,
    pattern: template,
    category,
    occurrences: 1,
    firstSeen: now,
    lastSeen: now,
    relatedAlerts: [alertText.slice(0, 100)],
    status: "detected",
  };
  
  patterns.push(newPattern);
  savePatterns(patterns);
  
  console.log(`[EvolutionEngine] New pattern detected: ${key} (${category})`);
  
  return newPattern;
}

function savePatterns(patterns: DetectedPattern[]) {
  ensureEvolutionDir();
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2));
}

// ── Skill Proposal ───────────────────────────────────────────────────────────

export interface SkillProposal {
  id: string;
  name: string;
  patternId: string;
  description: string;
  category: string;
  trigger: string;
  solution: string;
  commands: string[];
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "implemented" | "failed";
  proposedAt: number;
  decidedAt?: number;
  implementedAt?: number;
  skillPath?: string;
  outcome?: string;
}

export async function proposeSkill(
  pattern: DetectedPattern,
  alertText: string,
  toolCalls: any[]
): Promise<SkillProposal> {
  ensureEvolutionDir();
  
  const proposalId = `skill-${pattern.id}-${Date.now()}`;
  
  // Generate skill based on pattern
  const skillTemplate = generateSkillTemplate(pattern, alertText);
  
  const proposal: SkillProposal = {
    id: proposalId,
    name: skillTemplate.name,
    patternId: pattern.id,
    description: skillTemplate.description,
    category: pattern.category,
    trigger: skillTemplate.trigger,
    solution: skillTemplate.solution,
    commands: skillTemplate.commands,
    priority: pattern.occurrences >= 3 ? "high" : "medium",
    status: "pending",
    proposedAt: Date.now(),
  };
  
  // Store proposal
  const proposals = loadProposals();
  proposals.push(proposal);
  saveProposals(proposals);
  
  // Update pattern
  pattern.proposedSkillId = proposalId;
  pattern.status = "proposed";
  savePatterns(loadPatterns().map(p => p.id === pattern.id ? pattern : p));
  
  // Record to vault
  await recordToVault("Skill Proposal", 
    `Proposed skill "${proposal.name}" for pattern "${pattern.pattern}"\n\n` +
    `Occurrences: ${pattern.occurrences}\n` +
    `Priority: ${proposal.priority}\n` +
    `Trigger: ${proposal.trigger}\n` +
    `Solution: ${proposal.solution}`
  );
  
  console.log(`[EvolutionEngine] Proposed skill: ${proposal.name} (${proposal.priority})`);
  
  return proposal;
}

function generateSkillTemplate(pattern: DetectedPattern, alertText: string) {
  const templates: Record<string, { name: string; description: string; trigger: string; solution: string; commands: string[] }> = {
    "fleet-health-monitor": {
      name: "fleet-health-monitor",
      description: "Monitors HyperAIBox fleet health with correct endpoints (handles Docker proxy 404s)",
      trigger: "User asks about fleet status or C-3PO/R2-D2 unreachable",
      solution: "Use track_fleet.py or SSH-tunnel health checks. Check ports 9000/9001 not 8100. SPO :9100 any response = healthy.",
      commands: ["fleet:status", "fleet:check", "hbox:health"],
    },
    "dynamic-ip-handler": {
      name: "dynamic-ip-handler",
      description: "Handles C-3PO IP changes after reboot (DHCP lease renewal)",
      trigger: "C-3PO unreachable or SSH connection failed",
      solution: "Scan subnet 192.168.0.100-160 to find new IP, update ~/.ssh/config",
      commands: ["c3po:find", "c3po:update-ip", "fleet:discover"],
    },
    "spo-health-monitor": {
      name: "spo-health-monitor",
      description: "Correctly checks SPO health (no /health endpoint, any TCP response = healthy)",
      trigger: "User asks about SPO status or bot reports SPO down",
      solution: "Check TCP :9100. Any response = healthy. No HTTP 200 expected.",
      commands: ["spo:status", "spo:health"],
    },
    "skill-discovery": {
      name: "skill-discovery",
      description: "Discovers available skills when user asks for unimplemented capability",
      trigger: "User asks for something no skill handles",
      solution: "Search bundled skills, Hermes skills, propose creation if gap persists",
      commands: ["skills:search", "skills:propose", "skills:discover"],
    },
    "test-debugger": {
      name: "test-debugger",
      description: "Debugs failing tests with systematic approach",
      trigger: "Test failures detected",
      solution: "8-phase debugging: reproduce, isolate, inspect, hypothesize, patch, verify, document, monitor",
      commands: ["test:debug", "test:isolate", "test:verify"],
    },
    "build-fixer": {
      name: "build-fixer",
      description: "Fixes build errors with dependency and configuration checks",
      trigger: "Build fails",
      solution: "Check deps, clear cache, verify configs, retry with verbose logging",
      commands: ["build:fix", "build:clean", "build:retry"],
    },
    "pr-reminder": {
      name: "pr-reminder",
      description: "Reminds about stale PRs and suggests reviewers",
      trigger: "PR untouched for >3 days",
      solution: "Check PR status, suggest reviewers, ping author",
      commands: ["pr:remind", "pr:reviewers", "pr:status"],
    },
  };
  
  return templates[pattern.pattern] || {
    name: `auto-skill-${pattern.id}`,
    description: `Auto-generated skill for pattern: ${pattern.pattern}`,
    trigger: `Pattern detected: ${pattern.pattern}`,
    solution: "Implement solution based on observed pattern",
    commands: ["auto:fix"],
  };
}

// ── Proposal Management ───────────────────────────────────────────────────────

export function loadProposals(): SkillProposal[] {
  try {
    if (fs.existsSync(PENDING_SKILLS_FILE)) {
      return JSON.parse(fs.readFileSync(PENDING_SKILLS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[EvolutionEngine] Failed to load proposals:", e);
  }
  return [];
}

function saveProposals(proposals: SkillProposal[]) {
  ensureEvolutionDir();
  fs.writeFileSync(PENDING_SKILLS_FILE, JSON.stringify(proposals, null, 2));
}

export function getPendingProposals(): SkillProposal[] {
  return loadProposals().filter(p => p.status === "pending");
}

export function getProposalById(id: string): SkillProposal | undefined {
  return loadProposals().find(p => p.id === id);
}

// ── User Approval Actions ────────────────────────────────────────────────────

export async function approveSkill(proposalId: string): Promise<SkillProposal | null> {
  const proposals = loadProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  
  if (!proposal) return null;
  
  proposal.status = "approved";
  proposal.decidedAt = Date.now();
  saveProposals(proposals);
  
  console.log(`[EvolutionEngine] Skill approved: ${proposal.name}`);
  
  // Auto-implement after approval
  return await implementSkill(proposalId);
}

export function rejectSkill(proposalId: string, reason?: string): SkillProposal | null {
  const proposals = loadProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  
  if (!proposal) return null;
  
  proposal.status = "rejected";
  proposal.decidedAt = Date.now();
  proposal.outcome = reason || "User rejected";
  saveProposals(proposals);
  
  console.log(`[EvolutionEngine] Skill rejected: ${proposal.name} - ${reason}`);
  
  return proposal;
}

// ── Skill Implementation ─────────────────────────────────────────────────────

export async function implementSkill(proposalId: string): Promise<SkillProposal | null> {
  const proposals = loadProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  
  if (!proposal || proposal.status !== "approved") return null;
  
  try {
    // Create skill directory
    const skillDir = path.join(
      app.getPath("userData"), 
      "mosaicbot", 
      "skills", 
      proposal.name
    );
    fs.mkdirSync(skillDir, { recursive: true });
    
    // Generate SKILL.md content
    const skillContent = generateSkillMarkdown(proposal);
    const skillPath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(skillPath, skillContent);
    
    // Create manifest
    const manifestPath = path.join(skillDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      name: proposal.name,
      version: "1.0.0",
      created: Date.now(),
      createdBy: "mosaic-bot-evolution",
      proposalId: proposal.id,
      pattern: proposal.patternId,
    }, null, 2));
    
    proposal.status = "implemented";
    proposal.implementedAt = Date.now();
    proposal.skillPath = skillPath;
    saveProposals(proposals);
    
    // Record to history
    recordSkillHistory(proposal);
    
    // Record to vault
    await recordToVault("Skill Implemented",
      `Created skill "${proposal.name}" at ${skillPath}\n\n` +
      `Pattern: ${proposal.patternId}\n` +
      `Commands: ${proposal.commands.join(", ")}`
    );
    
    console.log(`[EvolutionEngine] Skill implemented: ${proposal.name} at ${skillPath}`);
    
    return proposal;
  } catch (e) {
    console.error("[EvolutionEngine] Failed to implement skill:", e);
    proposal.status = "failed";
    proposal.outcome = `Error: ${e}`;
    saveProposals(proposals);
    return proposal;
  }
}

function generateSkillMarkdown(proposal: SkillProposal): string {
  return `---
name: ${proposal.name}
description: ${proposal.description}
version: 1.0.0
created: ${new Date().toISOString()}
createdBy: mosaic-bot-evolution
proposalId: ${proposal.id}
pattern: ${proposal.patternId}
category: ${proposal.category}
---

# ${proposal.name}

${proposal.description}

## Trigger

${proposal.trigger}

## Solution

${proposal.solution}

## Commands

${proposal.commands.map(c => `- \`${c}\``).join("\n")}

## Usage

When this pattern is detected, the bot should:
1. ${proposal.solution.split(". ")[0]}
2. Execute appropriate commands
3. Verify outcome
4. Report results

## History

- Created: ${new Date().toISOString()} (auto-generated from pattern "${proposal.patternId}")
- Occurrences before creation: ${loadPatterns().find(p => p.id === proposal.patternId)?.occurrences || "unknown"}
`;
}

function recordSkillHistory(proposal: SkillProposal) {
  const history = loadSkillHistory();
  history.push({
    proposalId: proposal.id,
    name: proposal.name,
    patternId: proposal.patternId,
    category: proposal.category,
    implementedAt: proposal.implementedAt,
    skillPath: proposal.skillPath,
  });
  fs.writeFileSync(SKILL_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function loadSkillHistory(): any[] {
  try {
    if (fs.existsSync(SKILL_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(SKILL_HISTORY_FILE, "utf-8"));
    }
  } catch (e) {}
  return [];
}

import { recordToVault as vaultRecordInternal } from "./heartbeat-tools.js";

// ── Vault Recording ───────────────────────────────────────────────────────────

async function recordToVault(label: string, content: string) {
  try {
    vaultRecordInternal(label, content);
  } catch (e) {
    console.log(`[EvolutionEngine] Vault record: ${label}`);
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

export function getEvolutionStats(): {
  patternsDetected: number;
  proposalsPending: number;
  proposalsApproved: number;
  proposalsRejected: number;
  skillsImplemented: number;
  skillsFailed: number;
} {
  const patterns = loadPatterns();
  const proposals = loadProposals();
  
  return {
    patternsDetected: patterns.length,
    proposalsPending: proposals.filter(p => p.status === "pending").length,
    proposalsApproved: proposals.filter(p => p.status === "approved" || p.status === "implemented").length,
    proposalsRejected: proposals.filter(p => p.status === "rejected").length,
    skillsImplemented: proposals.filter(p => p.status === "implemented").length,
    skillsFailed: proposals.filter(p => p.status === "failed").length,
  };
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export async function processEvolutionTrigger(
  alertText: string,
  toolCalls: any[]
): Promise<SkillProposal | null> {
  // Detect pattern
  const pattern = detectPattern(alertText, toolCalls);
  if (!pattern) return null;
  
  // Only propose if pattern seen >= 2 times or is critical
  const isCritical = pattern.category === "infra" && pattern.occurrences >= 2;
  const shouldPropose = pattern.occurrences >= 3 || isCritical;
  
  if (!shouldPropose) {
    console.log(`[EvolutionEngine] Pattern "${pattern.id}" seen ${pattern.occurrences}x, waiting for more occurrences...`);
    return null;
  }
  
  // Check if already proposed
  if (pattern.proposedSkillId && pattern.status !== "detected") {
    console.log(`[EvolutionEngine] Pattern "${pattern.id}" already has proposal: ${pattern.proposedSkillId}`);
    return getProposalById(pattern.proposedSkillId);
  }
  
  // Create proposal
  return await proposeSkill(pattern, alertText, toolCalls);
}
