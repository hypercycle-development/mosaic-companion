// =============================================================================
// STARGATE POOL - ANFE Types
// Data models for ANFE (AI Node Factory Entity) integration
// =============================================================================

import { ANFEGraphData } from './GraphService';
import { VerificationResult } from './MerkelizerService';

// =============================================================================
// Validator Fleet — Battery/CometBFT Node Telemetry
// =============================================================================

export interface ValidatorNode {
  moniker: string;
  nodeId: string;
  address: string;
  blockHeight: number;
  maxBlockHeight: number;
  peerCount: number;
  syncStatus: 'synced' | 'catching_up' | 'offline';
  lastSeen: number; // timestamp ms
  isOnline: boolean;
  cometBftVersion?: string;
  network?: string;
  earliestBlockHeight?: number;
}

export interface ValidatorPoolStatus {
  validators: ValidatorNode[];
  totalValidators: number;
  onlineValidators: number;
  syncedValidators: number;
  highestBlock: number;
  lastUpdated: number;
}

export interface ANFEAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

export interface ANFEMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: ANFEAttribute[];
}

// Core ANFE attributes
export interface ANFECoreAttributes {
  primaryLicense?: ANFEAttribute;  // HyPC - HyperCycle Primary License
  level?: ANFEAttribute;           // Level 1-11
  computeToken?: ANFEAttribute;    // Compute token allocation
}

// AI Module attributes (c_ prefix)
export interface AIModuleAttribute extends ANFEAttribute {
  trait_type: `c_${string}`;  // c_OpnAI, c_IAlf, etc.
}

export interface ANFEAIAttributes {
  aiModules: AIModuleAttribute[];
  // Common module types
  openAI?: AIModuleAttribute;
  claudeAI?: AIModuleAttribute;
  geminiAI?: AIModuleAttribute;
  localAI?: AIModuleAttribute;
}

// Full attribute set
export interface ANFEAttributes {
  core: ANFECoreAttributes;
  ai: ANFEAIAttributes;
  raw: ANFEAttribute[];
}

// =============================================================================
// Chain Types
// =============================================================================

export type SupportedChain = 1 | 8453;  // Ethereum | Base

export const CHAIN_IDS: Record<SupportedChain, string> = {
  1: 'ethereum',
  8453: 'base',
};

export const CHAIN_NAMES: Record<SupportedChain, string> = {
  1: 'Ethereum',
  8453: 'Base',
};

// =============================================================================
// ANFE Data Model (Full)
// =============================================================================

export interface ANFE {
  // From Graph
  id: string;
  tokenId: string;
  contractAddress: string;
  owner: string;
  chainId: SupportedChain;
  chainName: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionHash: string;

  // Decoded attributes
  attributes: ANFEAttributes;

  // Optional runtime fields
  name?: string;
  rarity?: string;
  status?: string;
  level?: number;
  computeUnits?: string;
  chain?: string;
  // Verification
  verification: VerificationResult;

  // Metadata
  metadata?: ANFEMetadata;
  tokenURI?: string;
}

// =============================================================================
// ANFE with Factory Delegation
// =============================================================================

export interface ANFEDelegation {
  anfe: ANFE;
  factoryId?: string;
  delegatedAgents: string[];
  delegatedAIMs: string[];
  canDelegate: boolean;
}

// =============================================================================
// Attribute Parser
// =============================================================================

/**
 * Parse ANFE attributes from metadata
 */
export function parseAttributes(metadata: ANFEMetadata): ANFEAttributes {
  const attrs = metadata.attributes || [];

  // Core attributes
  const core: ANFECoreAttributes = {
    primaryLicense: attrs.find(a => a.trait_type === 'Primary License'),
    level: attrs.find(a => a.trait_type === 'Level'),
    computeToken: attrs.find(a => a.trait_type === 'Compute Token'),
  };

  // AI Modules (c_ prefix)
  const aiModules = attrs.filter(a => a.trait_type?.startsWith('c_')) as AIModuleAttribute[];

  const ai: ANFEAIAttributes = {
    aiModules,
    openAI: aiModules.find(m => m.trait_type === 'c_OpnAI'),
    claudeAI: aiModules.find(m => m.trait_type === 'c_IAlf' || m.trait_type === 'c_IAlb'),
    geminiAI: aiModules.find(m => m.trait_type === 'c_IAlr'),
    localAI: aiModules.find(m => m.trait_type === 'c_IAls'),
  };

  return { core, ai, raw: attrs };
}

/**
 * Get level from ANFE attributes
 */
export function getLevelFromAttributes(attrs: ANFEAttributes): number {
  const levelAttr = attrs?.core?.level;
  if (!levelAttr) return 1;

  if (typeof levelAttr.value === 'number') return levelAttr.value;
  if (typeof levelAttr.value === 'string') return parseInt(levelAttr.value, 10) || 1;
  return 1;
}

/**
 * Get primary license (HyPC) from attributes
 */
export function getPrimaryLicense(attrs: ANFEAttributes): string {
  const license = attrs?.core?.primaryLicense;
  if (!license) return 'None';

  return String(license.value || license);
}

/**
 * Get AI module names from attributes
 */
export function getAIModuleNames(attrs: ANFEAttributes): string[] {
  if (!attrs?.ai?.aiModules) return [];
  return attrs.ai.aiModules.map(m => {
    // Convert c_OpnAI -> OpenAI, c_IAlf -> Claude (Advanced), etc.
    const name = m.trait_type.replace('c_', '');
    const value = String(m.value);

    // Common mappings
    const mappings: Record<string, string> = {
      'OpnAI': 'OpenAI',
      'IAlf': 'Claude (Fast)',
      'IAlb': 'Claude (Balanced)',
      'IAlr': 'Claude (Reasoning)',
      'IAls': 'Local AI',
    };

    return mappings[name] || name;
  });
}

/**
 * Format ANFE for display
 */
export function formatANFEForDisplay(anfe: ANFE): {
  id: string;
  chain: string;
  level: number;
  license: string;
  aiModules: string[];
  verified: boolean;
  displayName: string;
} {
  return {
    id: anfe.id,
    chain: anfe.chainName,
    level: getLevelFromAttributes(anfe.attributes),
    license: getPrimaryLicense(anfe.attributes),
    aiModules: getAIModuleNames(anfe.attributes),
    verified: anfe.verification?.valid ?? false,
    displayName: anfe.metadata?.name || `ANFE #${anfe.tokenId}`,
  };
}

// =============================================================================
// Graph Data Converter
// =============================================================================

/**
 * Convert Graph data to ANFE type
 */
export function graphToANFE(
  graphData: ANFEGraphData,
  attributes: ANFEAttributes,
  verification: VerificationResult,
  metadata?: ANFEMetadata
): ANFE {
  const chainId = parseInt(graphData.chainId) as SupportedChain;

  return {
    id: graphData.id,
    tokenId: graphData.tokenId,
    contractAddress: graphData.contractAddress,
    owner: graphData.owner,
    chainId,
    chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
    blockNumber: parseInt(graphData.blockNumber),
    blockTimestamp: parseInt(graphData.blockTimestamp),
    transactionHash: graphData.transactionHash,
    attributes,
    verification,
    metadata,
  };
}

// =============================================================================
// Delegation Types
// =============================================================================

export interface DelegationInput {
  anfeId: string;
  factoryId: string;
  agents?: string[];
  aims?: string[];
}

export interface DelegationResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// =============================================================================
// Wallet NFT Types
// =============================================================================

export interface WalletANFEs {
  address: string;
  anfes: ANFE[];
  totalCount: number;
  fetchedAt: number;
  byChain: Record<SupportedChain, ANFE[]>;
  // Degraded mode support
  degraded?: boolean;
  degradedMessage?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class ANFEError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ANFEError';
  }
}

export class GraphError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'GraphError';
  }
}

export class MerkelizerError extends Error {
  constructor(message: string, public anfeId?: string) {
    super(message);
    this.name = 'MerkelizerError';
  }
}