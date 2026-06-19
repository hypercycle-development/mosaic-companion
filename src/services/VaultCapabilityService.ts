/**
 * Vault Capability Service
 * 
 * Integrates Mosaic-Companion's Vault with Hermes capabilities.
 * Manages agent access to vault boxes and capability credentials.
 */

import { AgentCapabilityConfig, HermesCapability, SoulGrade } from "../types/soul";
import { 
  getCapability, 
  getCapabilities, 
  buildCapabilitySystemPrompt 
} from "./HermesCapabilityRegistry";
import { gradeSoul, generateDefaultSoul } from "./SoulGraderService";
import { getSoulById, DEFAULT_SOUL } from "../data/predefined-souls";

// =============================================================================
// Types
// =============================================================================

export interface VaultBoxAccess {
  boxId: string;
  boxName: string;
  entries: Array<{
    id: string;
    label?: string;
    content: string;
    createdAt: number;
  }>;
}

export interface AgentCapabilityContext {
  agentId: string;
  agentName: string;
  soulId?: string;
  soulOverride?: string;
  capabilities: AgentCapabilityConfig;
  vaultAccess: VaultBoxAccess[];
}

export interface AgentSystemPromptParts {
  soulContent: string;
  capabilityPrompt: string;
  vaultKnowledge: string;
  skillsPrompt: string;
  toolsPrompt: string;
}

// =============================================================================
// Vault Knowledge Builder
// =============================================================================

/**
 * Build vault knowledge section for system prompt.
 * Injects vault box contents that the agent has access to.
 */
export function buildVaultKnowledgePrompt(vaultAccess: VaultBoxAccess[]): string {
  if (vaultAccess.length === 0) {
    return "";
  }

  const boxes = vaultAccess.map(box => {
    const entries = box.entries
      .map(entry => {
        const label = entry.label ? `[${entry.label}] ` : "";
        return `- ${label}${entry.content.slice(0, 500)}${entry.content.length > 500 ? "..." : ""}`;
      })
      .join("\n");

    return `### ${box.boxName} (ID: ${box.boxId})\n${entries || "(no entries)"}`;
  }).join("\n\n");

  return `\n## Vault Knowledge\n\nYou have access to the following secure vault boxes with user data and credentials:\n\n${boxes}\n\nWhen you need information from the vault, reference it by box name.\n`;
}

// =============================================================================
// SOUL Builder
// =============================================================================

/**
 * Build SOUL content from agent configuration.
 */
export function buildSoulContent(
  soulId?: string,
  soulOverride?: string,
  agentName?: string
): string {
  // Priority: custom override > predefined soul > default
  if (soulOverride?.trim()) {
    return soulOverride.trim();
  }

  const predefinedSoul = soulId ? getSoulById(soulId) : undefined;
  if (predefinedSoul) {
    return predefinedSoul.soulMarkdown;
  }

  if (agentName) {
    return generateDefaultSoul(agentName);
  }

  return DEFAULT_SOUL.soulMarkdown;
}

/**
 * Grade the agent's SOUL if needed.
 */
export async function ensureSoulGrade(
  soulId?: string,
  soulOverride?: string,
  existingGrade?: SoulGrade
): Promise<SoulGrade | undefined> {
  // If we have a recent grade, keep it
  if (existingGrade && Date.now() - existingGrade.gradedAt < 24 * 60 * 60 * 1000) {
    return existingGrade;
  }

  const soulContent = buildSoulContent(soulId, soulOverride);
  if (!soulContent) {
    return undefined;
  }

  return gradeSoul(soulContent);
}

// =============================================================================
// Capability Builder
// =============================================================================

/**
 * Build capability prompt from enabled capabilities.
 */
export function buildCapabilityPrompt(
  enabledCapabilities: string[],
  vaultBoxAccess: string[]
): string {
  const basePrompt = buildCapabilitySystemPrompt(enabledCapabilities);
  
  // Add vault tools if agent has vault access
  const vaultPrompt = vaultBoxAccess.length > 0
    ? `\n## Vault Tools\n\nYou have access to vault tools:\n- list_boxes: List vault boxes you can access\n- read_box: Read contents of a specific vault box\n\nUse these tools when the user references stored data or credentials.\n`
    : "";

  return basePrompt + vaultPrompt;
}

/**
 * Get recommended capabilities for a soul archetype.
 */
export function getRecommendedCapabilities(soulId?: string): string[] {
  const soul = soulId ? getSoulById(soulId) : undefined;
  
  if (!soul) {
    // Default: developer capabilities
    return [
      "file_read",
      "file_write",
      "file_search",
      "terminal",
      "skill_management",
      "memory_management",
      "session_search",
    ];
  }

  switch (soul.archetype) {
    case "executor":
      return [
        "terminal",
        "process_management",
        "file_read",
        "file_write",
        "file_search",
        "file_patch",
        "code_execution",
        "kanban",
        "skill_management",
        "memory_management",
      ];
    
    case "researcher":
      return [
        "web_search",
        "browser_navigation",
        "file_read",
        "file_search",
        "session_search",
        "memory_management",
        "skill_management",
        "vision",
      ];
    
    case "creative":
      return [
        "vision",
        "web_search",
        "browser_navigation",
        "file_read",
        "file_write",
        "memory_management",
        "text_to_speech",
      ];
    
    case "guardian":
      return [
        "file_read",
        "file_search",
        "terminal",
        "skill_management",
        "memory_management",
        "kanban",
      ];
    
    case "navigator":
      return [
        "web_search",
        "browser_navigation",
        "file_read",
        "file_search",
        "skill_management",
        "memory_management",
        "session_search",
        "kanban",
      ];
    
    case "fast":
      return [
        "web_search",
        "file_read",
        "memory_management",
      ];
    
    default:
      return [
        "file_read",
        "memory_management",
      ];
  }
}

// =============================================================================
// Full System Prompt Builder
// =============================================================================

/**
 * Build complete system prompt parts for an agent.
 * This is the main entry point for system prompt construction.
 */
export function buildAgentSystemPrompt(
  context: AgentCapabilityContext
): AgentSystemPromptParts {
  // 1. Build SOUL content
  const soulContent = buildSoulContent(
    context.soulId,
    context.soulOverride,
    context.agentName
  );

  // 2. Build capability prompt
  const capabilityPrompt = buildCapabilityPrompt(
    context.capabilities.enabledCapabilities,
    context.capabilities.vaultBoxAccess
  );

  // 3. Build vault knowledge
  const vaultKnowledge = buildVaultKnowledgePrompt(context.vaultAccess);

  // 4. Skills prompt (placeholder - populated by skillInjector)
  const skillsPrompt = context.capabilities.customSystemPrompt || "";

  // 5. Tools prompt (placeholder - populated by tool registry)
  const toolsPrompt = "";

  return {
    soulContent,
    capabilityPrompt,
    vaultKnowledge,
    skillsPrompt,
    toolsPrompt,
  };
}

/**
 * Assemble full system prompt from parts.
 */
export function assembleSystemPrompt(parts: AgentSystemPromptParts): string {
  const sections = [
    parts.soulContent,
    parts.capabilityPrompt,
    parts.vaultKnowledge,
    parts.skillsPrompt,
    parts.toolsPrompt,
  ].filter(Boolean);

  return sections.join("\n\n---\n\n");
}

// =============================================================================
// Vault Access Helpers
// =============================================================================

/**
 * Check if an agent can access a specific vault box.
 */
export function canAccessVaultBox(
  agentConfig: AgentCapabilityConfig,
  boxId: string
): boolean {
  return agentConfig.vaultBoxAccess.includes(boxId);
}

/**
 * Grant vault box access to an agent.
 */
export function grantVaultBoxAccess(
  config: AgentCapabilityConfig,
  boxId: string
): AgentCapabilityConfig {
  if (config.vaultBoxAccess.includes(boxId)) {
    return config;
  }
  return {
    ...config,
    vaultBoxAccess: [...config.vaultBoxAccess, boxId],
  };
}

/**
 * Revoke vault box access from an agent.
 */
export function revokeVaultBoxAccess(
  config: AgentCapabilityConfig,
  boxId: string
): AgentCapabilityConfig {
  return {
    ...config,
    vaultBoxAccess: config.vaultBoxAccess.filter(id => id !== boxId),
  };
}

// =============================================================================
// Capability Management
// =============================================================================

/**
 * Enable a capability for an agent.
 */
export function enableCapability(
  config: AgentCapabilityConfig,
  capabilityId: string
): AgentCapabilityConfig {
  if (config.enabledCapabilities.includes(capabilityId)) {
    return config;
  }
  return {
    ...config,
    enabledCapabilities: [...config.enabledCapabilities, capabilityId],
  };
}

/**
 * Disable a capability for an agent.
 */
export function disableCapability(
  config: AgentCapabilityConfig,
  capabilityId: string
): AgentCapabilityConfig {
  return {
    ...config,
    enabledCapabilities: config.enabledCapabilities.filter(id => id !== capabilityId),
  };
}

/**
 * Get default capability configuration for a new agent.
 */
export function getDefaultCapabilityConfig(): AgentCapabilityConfig {
  return {
    enabledCapabilities: [
      "file_read",
      "file_search",
      "memory_management",
      "session_search",
    ],
    vaultBoxAccess: [],
  };
}

export default {
  buildVaultKnowledgePrompt,
  buildSoulContent,
  ensureSoulGrade,
  buildCapabilityPrompt,
  getRecommendedCapabilities,
  buildAgentSystemPrompt,
  assembleSystemPrompt,
  canAccessVaultBox,
  grantVaultBoxAccess,
  revokeVaultBoxAccess,
  enableCapability,
  disableCapability,
  getDefaultCapabilityConfig,
};
