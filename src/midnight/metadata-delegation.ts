/**
 * Simplified Delegation Mapping using NFT Metadata
 * 
 * Instead of a complex smart contract, we use the NFT's on-chain metadata
 * to store delegation information directly in the Cardano NFT.
 * 
 * This approach:
 * - No smart contract deployment needed
 * - Metadata is immutable once minted
 * - Easy to query via cardano-graphql or blockfrost
 */

import { CardanoWallet, connectWallet, getDelegationRights } from './cardano-wallet';

// CIP-68 Metadata Standard for NFT delegation
interface HyperSharePassMetadata {
  // Standard CIP-68 fields
  name: string;
  image: string;
  description: string;
  
  // Custom delegation fields
  delegation?: {
    nodeFactoryIds: number[];    // Delegated HyperCycle ETH nodes
    anfeIds: number[];           // Delegated Base ANFEs  
    totalWeight: number;         // Delegation weight
    createdAt: number;           // Slot when delegation was set
    lastUpdated: number;         // Last update slot
  };
  
  // Access rights derived from delegation
  access?: {
    canChat: boolean;
    canCreateAgents: number;     // Max agents allowed
    canDelegate: boolean;
    canRentCompute: boolean;
  };
}

// Default access rights based on holding any HyperSharePass
const DEFAULT_ACCESS = {
  canChat: true,
  canCreateAgents: 1,
  canDelegate: true,
  canRentCompute: false
};

const PREMIUM_ACCESS = {
  canChat: true,
  canCreateAgents: 10,
  canDelegate: true,
  canRentCompute: true
};

/**
 * Fetch NFT metadata from Cardano blockchain
 * Uses cardano-graphql or blockfrost API
 */
export async function fetchNftMetadata(
  policyId: string,
  assetName: string,
  provider: 'blockfrost' | 'graphql' = 'blockfrost',
  apiKey?: string
): Promise<HyperSharePassMetadata | null> {
  const baseUrl = provider === 'blockfrost' 
    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
    : 'https://cardano-graphql.mainnet.api.iohk.io';
  
  const headers = provider === 'blockfrost' && apiKey
    ? { 'project_id': apiKey }
    : {};

  try {
    const response = await fetch(
      `${baseUrl}/assets/${policyId}${assetName}`,
      { headers }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Parse on-chain metadata (CIP-68 format)
    const metadata = data.onchain_metadata || data.metadata || {};
    
    return {
      name: metadata.name || '',
      image: metadata.image || '',
      description: metadata.description || '',
      delegation: metadata.delegation,
      access: metadata.access
    };
  } catch (error) {
    console.error('Failed to fetch NFT metadata:', error);
    return null;
  }
}

/**
 * Get all HyperSharePass NFTs for a wallet with their metadata
 */
export async function getWalletDelegations(
  wallet: CardanoWallet
): Promise<DelegationInfo[]> {
  const rights = await getDelegationRights();
  const delegations: DelegationInfo[] = [];
  
  // For each HyperSharePass, fetch its metadata
  // In production, batch this query
  for (let i = 0; i < rights.hyperSharePassCount; i++) {
    const assetName = `HyperSharePassHolder${String(i).padStart(4, '0')}`;
    
    const metadata = await fetchNftMetadata(
      'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46',
      assetName
    );
    
    if (metadata) {
      delegations.push({
        assetName,
        metadata,
        access: metadata.access || DEFAULT_ACCESS
      });
    }
  }
  
  return delegations;
}

/**
 * Aggregate access rights across all NFTs
 */
export function aggregateAccessRights(delegations: DelegationInfo[]): AggregatedAccess {
  if (delegations.length === 0) {
    return { ...DEFAULT_ACCESS, totalNfts: 0, totalWeight: 0 };
  }

  let canChat = false;
  let maxAgents = 0;
  let canDelegate = false;
  let canRentCompute = false;
  let totalWeight = 0;

  for (const d of delegations) {
    canChat = canChat || d.access.canChat;
    maxAgents += d.access.canCreateAgents;
    canDelegate = canDelegate || d.access.canDelegate;
    canRentCompute = canRentCompute || d.access.canRentCompute;
    
    if (d.metadata.delegation) {
      totalWeight += d.metadata.delegation.totalWeight;
    }
  }

  return {
    canChat,
    canCreateAgents: maxAgents,
    canDelegate,
    canRentCompute,
    totalNfts: delegations.length,
    totalWeight
  };
}

interface DelegationInfo {
  assetName: string;
  metadata: HyperSharePassMetadata;
  access: typeof DEFAULT_ACCESS;
}

interface AggregatedAccess {
  canChat: boolean;
  canCreateAgents: number;
  canDelegate: boolean;
  canRentCompute: boolean;
  totalNfts: number;
  totalWeight: number;
}

/**
 * Complete authentication flow
 */
export async function authenticateWithHyperSharePass(
  walletName: 'eternl' | 'lace' | 'nami' | 'yoroi' | 'flint'
): Promise<AuthenticationResult> {
  // 1. Connect wallet
  await connectWallet(walletName);
  
  // 2. Get rights
  const rights = await getDelegationRights();
  
  // 3. Fetch metadata for all NFTs
  const delegations = await getWalletDelegations(walletName);
  
  // 4. Aggregate access
  const access = aggregateAccessRights(delegations);
  
  return {
    connected: true,
    wallet: walletName,
    address: rights.walletAddress,
    hyperSharePassCount: rights.hyperSharePassCount,
    access,
    canUseChat: access.canChat,
    canCreateAgents: access.canCreateAgents > 0,
    maxAgents: access.canCreateAgents
  };
}

interface AuthenticationResult {
  connected: boolean;
  wallet: string;
  address: string;
  hyperSharePassCount: number;
  access: AggregatedAccess;
  canUseChat: boolean;
  canCreateAgents: boolean;
  maxAgents: number;
}