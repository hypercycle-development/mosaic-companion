/**
 * Stargate Soul Integration
 * 
 * Integrates SOUL.md identity layer with Stargate module features.
 * Provides soul-aware AIM management, skill marketplace integration,
 * and agent fleet coordination.
 */

import { AgentSoul, SoulGrade, SoulArchetype } from "../../types/soul";
import { AIAgentConfig } from "../../types/ai";
import { getSoulById, PREDEFINED_SOULS } from "../../data/predefined-souls";
import { getCapabilitySet } from "../HermesCapabilityRegistry";

// =============================================================================
// Stargate Soul Types
// =============================================================================

export interface StargateAgentIdentity {
  agentId: string;
  name: string;
  soulId: string;
  soulArchetype: SoulArchetype;
  soulGrade?: SoulGrade;
  capabilities: string[];
  vaultBoxAccess: string[];
  anfeTokenId?: string;
  deployedAt?: number;
  lastActive?: number;
}

export interface SoulAwareSkill {
  skillId: string;
  name: string;
  description: string;
  compatibleSouls: SoulArchetype[];
  recommendedFor: SoulArchetype[];
  requiredCapabilities: string[];
  category: string;
}

export interface SoulMarketplaceFilter {
  soulArchetype?: SoulArchetype;
  minSoulGrade?: number;
  requiredCapabilities?: string[];
}

// =============================================================================
// Soul-AIM Mapping
// =============================================================================

/**
 * Map soul archetypes to optimal Stargate AIM configurations.
 */
export const SOUL_AIM_CONFIGS: Record<SoulArchetype, {
  preferredProvider: string;
  recommendedModel: string;
  minMemory: number;
  timeoutMs: number;
}> = {
  executor: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 4096,
    timeoutMs: 120000, // 2 minutes for thorough execution
  },
  researcher: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 8192, // Larger context for research
    timeoutMs: 300000, // 5 minutes for deep research
  },
  creative: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 4096,
    timeoutMs: 180000, // 3 minutes for ideation
  },
  guardian: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 4096,
    timeoutMs: 60000, // Quick safety checks
  },
  navigator: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 4096,
    timeoutMs: 120000,
  },
  fast: {
    preferredProvider: "hermes-aim",
    recommendedModel: "minimax",
    minMemory: 2048,
    timeoutMs: 30000, // 30 seconds for rapid response
  },
  custom: {
    preferredProvider: "hermes-aim",
    recommendedModel: "kimi-k2.6",
    minMemory: 4096,
    timeoutMs: 120000,
  },
};

/**
 * Get optimal AIM configuration for a soul archetype.
 */
export function getSoulAimConfig(soulArchetype: SoulArchetype) {
  return SOUL_AIM_CONFIGS[soulArchetype] || SOUL_AIM_CONFIGS.custom;
}

/**
 * Recommend AIM deployment settings based on agent configuration.
 */
export function recommendAimDeployment(
  agentConfig: AIAgentConfig
): {
  provider: string;
  model: string;
  memory: number;
  timeout: number;
  recommended: boolean;
} {
  const soulId = agentConfig.soulId;
  if (!soulId) {
    return {
      provider: agentConfig.provider,
      model: agentConfig.model,
      memory: agentConfig.maxTokens || 4096,
      timeout: 120000,
      recommended: false,
    };
  }

  const soul = getSoulById(soulId);
  if (!soul) {
    return {
      provider: agentConfig.provider,
      model: agentConfig.model,
      memory: agentConfig.maxTokens || 4096,
      timeout: 120000,
      recommended: false,
    };
  }

  const config = getSoulAimConfig(soul.archetype);
  return {
    provider: config.preferredProvider,
    model: config.recommendedModel,
    memory: Math.max(config.minMemory, agentConfig.maxTokens || 4096),
    timeout: config.timeoutMs,
    recommended: true,
  };
}

// =============================================================================
// Soul-Aware Skill Matching
// =============================================================================

/**
 * Skills compatible with each soul archetype.
 */
export const SOUL_SKILL_COMPATIBILITY: Record<
  SoulArchetype,
  {
    compatible: string[];
    recommended: string[];
  }
> = {
  executor: {
    compatible: ["planning-and-task-breakdown", "incremental-implementation", "test-driven-development", "git-workflow-and-versioning", "code-review-and-quality"],
    recommended: ["planning-and-task-breakdown", "incremental-implementation", "code-review-and-quality"],
  },
  researcher: {
    compatible: ["web_search", "browser_navigation", "session_search", "skill_management"],
    recommended: ["session_search", "web_search", "skill_management"],
  },
  creative: {
    compatible: ["design-md", "excalidraw", "sketch", "claude-design"],
    recommended: ["excalidraw", "sketch", "design-md"],
  },
  guardian: {
    compatible: ["source-security-audit", "code-review-and-quality", "systematic-debugging"],
    recommended: ["source-security-audit", "code-review-and-quality"],
  },
  navigator: {
    compatible: ["hermes-agent", "planning-and-task-breakdown", "incremental-implementation"],
    recommended: ["hermes-agent", "planning-and-task-breakdown"],
  },
  fast: {
    compatible: ["web_search", "file_read", "memory_management"],
    recommended: ["web_search", "file_read"],
  },
  custom: {
    compatible: [],
    recommended: [],
  },
};

/**
 * Get compatible skills for a soul archetype.
 */
export function getCompatibleSkills(soulArchetype: SoulArchetype): string[] {
  return SOUL_SKILL_COMPATIBILITY[soulArchetype]?.compatible || [];
}

/**
 * Get recommended skills for a soul archetype.
 */
export function getRecommendedSkills(soulArchetype: SoulArchetype): string[] {
  return SOUL_SKILL_COMPATIBILITY[soulArchetype]?.recommended || [];
}

/**
 * Filter skills by soul compatibility.
 */
export function filterSkillsBySoul(
  skills: string[],
  soulArchetype: SoulArchetype
): {
  compatible: string[];
  incompatible: string[];
} {
  const compatibleSet = new Set(getCompatibleSkills(soulArchetype));
  
  const compatible: string[] = [];
  const incompatible: string[] = [];
  
  for (const skill of skills) {
    if (compatibleSet.has(skill) || soulArchetype === "custom") {
      compatible.push(skill);
    } else {
      incompatible.push(skill);
    }
  }
  
  return { compatible, incompatible };
}

// =============================================================================
// Soul Fleet Management
// =============================================================================

/**
 * Define soul archetype roles in a multi-agent fleet.
 */
export const FLEET_SOUL_ROLES: Record<SoulArchetype, {
  role: string;
  responsibilities: string[];
  reportsTo: SoulArchetype[];
  canDelegateTo: SoulArchetype[];
}> = {
  executor: {
    role: "Implementation Agent",
    responsibilities: ["Execute tasks", "Verify completion", "Produce artifacts"],
    reportsTo: ["guardian", "navigator"],
    canDelegateTo: ["researcher", "fast"],
  },
  researcher: {
    role: "Research Agent",
    responsibilities: ["Investigate", "Cite sources", "Provide evidence"],
    reportsTo: ["executor", "navigator"],
    canDelegateTo: ["fast"],
  },
  creative: {
    role: "Creative Agent",
    responsibilities: ["Generate options", "Explore ideas", "Refine concepts"],
    reportsTo: ["executor", "navigator"],
    canDelegateTo: [],
  },
  guardian: {
    role: "Safety Agent",
    responsibilities: ["Review for risks", "Enforce constraints", "Block unsafe actions"],
    reportsTo: [],
    canDelegateTo: ["executor", "researcher"],
  },
  navigator: {
    role: "Orchestrator Agent",
    responsibilities: ["Coordinate", "Delegate", "Integrate", "Teach"],
    reportsTo: [],
    canDelegateTo: ["executor", "researcher", "creative", "guardian", "fast"],
  },
  fast: {
    role: "Quick Response Agent",
    responsibilities: ["Answer quickly", "Provide drafts", "Flag uncertainty"],
    reportsTo: ["executor", "researcher", "navigator"],
    canDelegateTo: [],
  },
  custom: {
    role: "Specialized Agent",
    responsibilities: ["Custom domain tasks"],
    reportsTo: ["navigator"],
    canDelegateTo: [],
  },
};

/**
 * Get fleet role for a soul archetype.
 */
export function getFleetRole(soulArchetype: SoulArchetype) {
  return FLEET_SOUL_ROLES[soulArchetype];
}

/**
 * Recommend fleet composition for a project type.
 */
export function recommendFleetComposition(projectType: string): {
  required: SoulArchetype[];
  recommended: SoulArchetype[];
  optional: SoulArchetype[];
} {
  const compositions: Record<string, {
    required: SoulArchetype[];
    recommended: SoulArchetype[];
    optional: SoulArchetype[];
  }> = {
    "software-development": {
      required: ["executor", "guardian"],
      recommended: ["navigator", "researcher"],
      optional: ["creative", "fast"],
    },
    "research-project": {
      required: ["researcher"],
      recommended: ["navigator", "executor"],
      optional: ["fast", "creative"],
    },
    "security-audit": {
      required: ["guardian", "executor"],
      recommended: ["researcher"],
      optional: ["navigator"],
    },
    "content-creation": {
      required: ["creative"],
      recommended: ["fast", "navigator"],
      optional: ["researcher", "executor"],
    },
    "onboarding": {
      required: ["navigator"],
      recommended: ["fast", "executor"],
      optional: ["creative", "researcher"],
    },
  };

  return compositions[projectType] || {
    required: ["executor"],
    recommended: ["navigator"],
    optional: ["researcher", "fast"],
  };
}

// =============================================================================
// Soul Quality Gates
// =============================================================================

/**
 * Check if an agent's SOUL meets deployment quality standards.
 */
export function checkSoulDeploymentReadiness(
  agentConfig: AIAgentConfig
): {
  ready: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check if agent has a SOUL
  if (!agentConfig.soulId && !agentConfig.soulOverride) {
    warnings.push("No SOUL configured — agent may drift from intended behavior");
  }

  // Check soul grade
  if (agentConfig.soulGrade) {
    if (agentConfig.soulGrade.verdict === "Not deployable") {
      issues.push(`SOUL grade: ${agentConfig.soulGrade.verdict} — fix automatic blockers before deployment`);
    } else if (agentConfig.soulGrade.score < 60) {
      warnings.push(`SOUL score ${agentConfig.soulGrade.score}/100 — consider strengthening identity`);
    }
  } else {
    warnings.push("SOUL not graded — run grade check before critical deployments");
  }

  // Check capabilities
  if (!agentConfig.capabilities || agentConfig.capabilities.enabledCapabilities.length === 0) {
    warnings.push("No capabilities configured — agent may lack required tools");
  }

  return {
    ready: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Get deployment recommendation for an agent.
 */
export function getDeploymentRecommendation(
  agentConfig: AIAgentConfig
): {
  canDeploy: boolean;
  recommendation: string;
  actions: string[];
} {
  const readiness = checkSoulDeploymentReadiness(agentConfig);
  
  if (!readiness.ready) {
    return {
      canDeploy: false,
      recommendation: "Fix critical issues before deploying",
      actions: readiness.issues,
    };
  }

  if (readiness.warnings.length > 0) {
    return {
      canDeploy: true,
      recommendation: "Deployable with caution — address warnings",
      actions: readiness.warnings,
    };
  }

  return {
    canDeploy: true,
    recommendation: "Ready for deployment",
    actions: ["Deploy to Stargate AIM"],
  };
}

// =============================================================================
// Stargate Marketplace Integration
// =============================================================================

/**
 * Build soul-aware marketplace filters.
 */
export function buildSoulMarketplaceFilters(
  agentConfig: AIAgentConfig
): SoulMarketplaceFilter {
  const soul = agentConfig.soulId ? getSoulById(agentConfig.soulId) : undefined;
  
  return {
    soulArchetype: soul?.archetype,
    minSoulGrade: agentConfig.soulGrade?.score,
    requiredCapabilities: agentConfig.capabilities?.enabledCapabilities,
  };
}

/**
 * Match skills to agent based on soul compatibility.
 */
export function matchSkillsToAgent(
  availableSkills: string[],
  agentConfig: AIAgentConfig
): {
  perfect: string[];
  compatible: string[];
  incompatible: string[];
} {
  const soul = agentConfig.soulId ? getSoulById(agentConfig.soulId) : undefined;
  if (!soul) {
    return {
      perfect: [],
      compatible: availableSkills,
      incompatible: [],
    };
  }

  const recommended = new Set(getRecommendedSkills(soul.archetype));
  const compatible = new Set(getCompatibleSkills(soul.archetype));
  
  const perfect: string[] = [];
  const compat: string[] = [];
  const incompatible: string[] = [];

  for (const skill of availableSkills) {
    if (recommended.has(skill)) {
      perfect.push(skill);
    } else if (compatible.has(skill) || soul.archetype === "custom") {
      compat.push(skill);
    } else {
      incompatible.push(skill);
    }
  }

  return { perfect, compatible: compat, incompatible };
}

// =============================================================================
// Export
// =============================================================================

export default {
  getSoulAimConfig,
  recommendAimDeployment,
  getCompatibleSkills,
  getRecommendedSkills,
  filterSkillsBySoul,
  getFleetRole,
  recommendFleetComposition,
  checkSoulDeploymentReadiness,
  getDeploymentRecommendation,
  buildSoulMarketplaceFilters,
  matchSkillsToAgent,
};
