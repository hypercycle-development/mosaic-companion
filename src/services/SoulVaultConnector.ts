/**
 * Soul Vault Connector
 * 
 * Connects agent SOUL identity with vault knowledge access.
 * Enables agents to access vault boxes based on their soul archetype.
 */

import { AgentCapabilityConfig } from "../types/soul";
import { getSoulById } from "../data/predefined-souls";

// =============================================================================
// Soul-Aware Vault Configuration
// =============================================================================

/**
 * Default vault boxes for each soul archetype.
 * Maps soul types to recommended vault access.
 */
export const SOUL_VAULT_PRESETS: Record<string, {
  recommendedBoxes: string[];
  requiredBoxes: string[];
  description: string;
}> = {
  executor: {
    recommendedBoxes: ["credentials", "deployment", "secrets"],
    requiredBoxes: [],
    description: "Access to deployment credentials and execution secrets",
  },
  researcher: {
    recommendedBoxes: ["references", "documentation", "archives"],
    requiredBoxes: [],
    description: "Access to research materials and documentation",
  },
  creative: {
    recommendedBoxes: ["assets", "templates", "inspiration"],
    requiredBoxes: [],
    description: "Access to creative assets and templates",
  },
  guardian: {
    recommendedBoxes: ["security", "audit", "compliance"],
    requiredBoxes: ["security"],
    description: "Required access to security policies and audit logs",
  },
  navigator: {
    recommendedBoxes: ["guides", "documentation", "templates"],
    requiredBoxes: [],
    description: "Access to guides and educational materials",
  },
  fast: {
    recommendedBoxes: ["quickrefs", "cheatsheets"],
    requiredBoxes: [],
    description: "Access to quick reference materials",
  },
  custom: {
    recommendedBoxes: [],
    requiredBoxes: [],
    description: "Custom vault configuration based on user needs",
  },
};

// =============================================================================
// Vault Box Categories
// =============================================================================

export interface VaultBoxCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sensitivity: "low" | "medium" | "high" | "critical";
  applicableSouls: string[];
}

export const VAULT_BOX_CATEGORIES: VaultBoxCategory[] = [
  {
    id: "credentials",
    name: "API Credentials",
    description: "API keys, tokens, and authentication secrets",
    icon: "🔑",
    sensitivity: "critical",
    applicableSouls: ["executor", "guardian"],
  },
  {
    id: "deployment",
    name: "Deployment Config",
    description: "Production deployment settings and endpoints",
    icon: "🚀",
    sensitivity: "high",
    applicableSouls: ["executor", "guardian"],
  },
  {
    id: "secrets",
    name: "Secrets",
    description: "Sensitive configuration and passwords",
    icon: "🔒",
    sensitivity: "critical",
    applicableSouls: ["executor", "guardian"],
  },
  {
    id: "references",
    name: "References",
    description: "Research papers, articles, and citations",
    icon: "📚",
    sensitivity: "low",
    applicableSouls: ["researcher", "navigator"],
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Technical docs, guides, and manuals",
    icon: "📖",
    sensitivity: "low",
    applicableSouls: ["researcher", "navigator", "executor"],
  },
  {
    id: "archives",
    name: "Archives",
    description: "Historical data and past project files",
    icon: "📁",
    sensitivity: "medium",
    applicableSouls: ["researcher"],
  },
  {
    id: "assets",
    name: "Creative Assets",
    description: "Images, designs, and creative materials",
    icon: "🎨",
    sensitivity: "low",
    applicableSouls: ["creative"],
  },
  {
    id: "templates",
    name: "Templates",
    description: "Reusable templates and patterns",
    icon: "📋",
    sensitivity: "low",
    applicableSouls: ["creative", "navigator", "executor"],
  },
  {
    id: "inspiration",
    name: "Inspiration",
    description: "Mood boards, examples, and references",
    icon: "✨",
    sensitivity: "low",
    applicableSouls: ["creative"],
  },
  {
    id: "security",
    name: "Security Policy",
    description: "Security policies and compliance rules",
    icon: "🛡️",
    sensitivity: "high",
    applicableSouls: ["guardian"],
  },
  {
    id: "audit",
    name: "Audit Logs",
    description: "Security audit trails and reviews",
    icon: "📊",
    sensitivity: "high",
    applicableSouls: ["guardian"],
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "Compliance rules and regulations",
    icon: "⚖️",
    sensitivity: "high",
    applicableSouls: ["guardian"],
  },
  {
    id: "guides",
    name: "User Guides",
    description: "User manuals and how-to guides",
    icon: "🧭",
    sensitivity: "low",
    applicableSouls: ["navigator"],
  },
  {
    id: "quickrefs",
    name: "Quick References",
    description: "Cheat sheets and quick lookup materials",
    icon: "⚡",
    sensitivity: "low",
    applicableSouls: ["fast", "executor"],
  },
  {
    id: "cheatsheets",
    name: "Cheat Sheets",
    description: "Command references and shortcuts",
    icon: "📝",
    sensitivity: "low",
    applicableSouls: ["fast", "executor", "researcher"],
  },
];

// =============================================================================
// Vault Access Management
// =============================================================================

/**
 * Get recommended vault boxes for a soul archetype.
 */
export function getRecommendedVaultBoxes(soulId?: string): string[] {
  const soul = soulId ? getSoulById(soulId) : undefined;
  if (!soul) {
    return [];
  }
  
  return SOUL_VAULT_PRESETS[soul.archetype]?.recommendedBoxes || [];
}

/**
 * Get required vault boxes for a soul archetype.
 */
export function getRequiredVaultBoxes(soulId?: string): string[] {
  const soul = soulId ? getSoulById(soulId) : undefined;
  if (!soul) {
    return [];
  }
  
  return SOUL_VAULT_PRESETS[soul.archetype]?.requiredBoxes || [];
}

/**
 * Check if a soul archetype needs a specific vault box.
 */
export function isVaultBoxApplicable(
  boxCategoryId: string,
  soulId?: string
): boolean {
  const soul = soulId ? getSoulById(soulId) : undefined;
  if (!soul) {
    return false;
  }
  
  const category = VAULT_BOX_CATEGORIES.find(c => c.id === boxCategoryId);
  if (!category) {
    return false;
  }
  
  return category.applicableSouls.includes(soul.archetype);
}

/**
 * Build vault access configuration for an agent.
 */
export function buildVaultAccessConfig(
  soulId?: string,
  existingAccess: string[] = []
): {
  recommended: string[];
  required: string[];
  current: string[];
  missing: string[];
} {
  const recommended = getRecommendedVaultBoxes(soulId);
  const required = getRequiredVaultBoxes(soulId);
  const missing = required.filter(id => !existingAccess.includes(id));
  
  return {
    recommended,
    required,
    current: existingAccess,
    missing,
  };
}

/**
 * Auto-configure vault access based on soul archetype.
 */
export function autoConfigureVaultAccess(
  soulId?: string,
  config: AgentCapabilityConfig = { enabledCapabilities: [], vaultBoxAccess: [] }
): AgentCapabilityConfig {
  const soul = soulId ? getSoulById(soulId) : undefined;
  if (!soul) {
    return config;
  }
  
  const recommended = getRecommendedVaultBoxes(soulId);
  
  // Merge recommended boxes with existing access
  const mergedAccess = Array.from(
    new Set([...config.vaultBoxAccess, ...recommended])
  );
  
  return {
    ...config,
    vaultBoxAccess: mergedAccess,
  };
}

// =============================================================================
// Capability Integration
// =============================================================================

/**
 * Get capabilities that require vault access.
 */
export function getVaultRequiringCapabilities(): string[] {
  return [
    "web_search", // May need API keys
    "browser_navigation", // May need credentials
    "terminal", // May need environment variables
    "code_execution", // May need secrets
  ];
}

/**
 * Check if a capability configuration needs vault access.
 */
export function needsVaultAccess(config: AgentCapabilityConfig): boolean {
  const vaultRequiring = getVaultRequiringCapabilities();
  return config.enabledCapabilities.some(cap => vaultRequiring.includes(cap));
}

/**
 * Suggest vault boxes for a capability configuration.
 */
export function suggestVaultBoxesForCapabilities(
  capabilities: string[]
): VaultBoxCategory[] {
  const suggested: VaultBoxCategory[] = [];
  
  for (const cap of capabilities) {
    switch (cap) {
      case "web_search":
      case "browser_navigation":
        suggested.push(
          VAULT_BOX_CATEGORIES.find(c => c.id === "credentials")!,
          VAULT_BOX_CATEGORIES.find(c => c.id === "secrets")!
        );
        break;
      case "terminal":
      case "code_execution":
        suggested.push(
          VAULT_BOX_CATEGORIES.find(c => c.id === "deployment")!,
          VAULT_BOX_CATEGORIES.find(c => c.id === "secrets")!
        );
        break;
    }
  }
  
  // Deduplicate by ID
  const seen = new Set<string>();
  return suggested.filter(cat => {
    if (seen.has(cat.id)) return false;
    seen.add(cat.id);
    return true;
  });
}

// =============================================================================
// Export
// =============================================================================

export default {
  SOUL_VAULT_PRESETS,
  VAULT_BOX_CATEGORIES,
  getRecommendedVaultBoxes,
  getRequiredVaultBoxes,
  isVaultBoxApplicable,
  buildVaultAccessConfig,
  autoConfigureVaultAccess,
  getVaultRequiringCapabilities,
  needsVaultAccess,
  suggestVaultBoxesForCapabilities,
};
