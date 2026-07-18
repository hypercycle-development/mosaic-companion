/**
 * Soul Types for Mosaic-Companion
 * 
 * Defines the SOUL.md identity layer for agents.
 * Based on the soul-grader-skill standard.
 */

export type SoulArchetype = 
  | 'executor' 
  | 'researcher' 
  | 'creative' 
  | 'guardian' 
  | 'navigator' 
  | 'fast' 
  | 'custom';

export type SoulVerdict = 
  | 'Excellent' 
  | 'Operational' 
  | 'Scaffold' 
  | 'Needs rewrite' 
  | 'Not deployable';

export interface AgentSoul {
  id: string;
  name: string;
  archetype: SoulArchetype;
  description: string;
  icon: string;
  color: string;
  soulMarkdown: string;
  customizable: boolean;
  recommendedFor: string[];
  tags?: string[];
}

export interface SoulGrade {
  score: number;
  verdict: SoulVerdict;
  deployability: 'Approved' | 'Approved with fixes' | 'Not approved';
  scope: string;
  automaticBlockers: string[];
  categoryScores: SoulCategoryScore[];
  topDriftRisks: string[];
  strengths: string[];
  fixes: string[];
  gradedAt: number;
}

export interface SoulCategoryScore {
  category: string;
  points: number;
  score: number;
  notes: string;
}

export interface SoulOverride {
  soulId: string;
  customMarkdown?: string;
  lastGraded?: SoulGrade;
}

// Hermes Capability Types
export interface HermesCapability {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'web' | 'file' | 'terminal' | 'agent' | 'custom';
  toolNames: string[];
  requiresVault?: boolean;
  vaultBoxIds?: string[];
  systemPromptAddition?: string;
}

export interface AgentCapabilityConfig {
  enabledCapabilities: string[];
  vaultBoxAccess: string[];
  customSystemPrompt?: string;
}

// Extended AIAgentConfig will include:
// soulId?: string;
// soulOverride?: string;
// soulGrade?: SoulGrade;
// capabilities?: AgentCapabilityConfig;