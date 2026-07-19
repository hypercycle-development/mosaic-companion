// @ts-nocheck
// ============================================
// ADA PORTAL - Access Control Service
// Layer 1: Gate access for AI Agents, Humans, NFT Holders
// ============================================

import { agentMarketplace } from './AgentMarketplaceService';
import { hyperInsight } from './HyperInsightService';

export type AccessLevel = 'none' | 'basic' | 'premium' | 'enterprise';
export type AccessType = 'human' | 'ai_agent' | 'nft_holder';

interface AccessCheck {
  hasAccess: boolean;
  level: AccessLevel;
  type?: AccessType;
  reason?: string;
}

interface WalletState {
  address: string | null;
  network: string;
  balance: string;
}

interface NFTHoldings {
  hasNfts: boolean;
  collections: string[];
  totalValue: number;
}

// NFT-gated access configuration
interface NFTGatingConfig {
  // Policy IDs that grant premium access
  premiumPolicyIds: string[];
  // Policy IDs that grant access to specific agents/nodes
  agentPolicyMappings: Record<string, string[]>; // agentId -> policyIds
  nodePolicyMappings: Record<string, string[]>; // nodeId -> policyIds
}

class AccessControlService {
  private accessLevel: AccessLevel = 'none';
  private accessType: AccessType | null = null;
  private walletState: WalletState | null = null;
  private nftHoldings: NFTHoldings | null = null;
  private isInitialized: boolean = false;
  private tokeoConnected: boolean = false;
  private tokeoAddress: string | null = null;
  
  // NFT gating configuration - configurable for different collections
  private nftConfig: NFTGatingConfig = {
    premiumPolicyIds: [], // Set this to grant premium access to NFT holders
    agentPolicyMappings: {},
    nodePolicyMappings: {}
  };

  constructor() {
    console.log('[AdaPortal] Access Control initialized');
  }

  // Configure NFT gating
  setNFTConfig(config: Partial<NFTGatingConfig>): void {
    this.nftConfig = { ...this.nftConfig, ...config };
    console.log('[AdaPortal] NFT config updated:', this.nftConfig);
  }

  getNFTConfig(): NFTGatingConfig {
    return this.nftConfig;
  }

  // Check access based on wallet, NFTs, or AI agent identity
  async checkAccess(): Promise<AccessCheck> {
    try {
      // Try Tokeo wallet first (NFT-gated access)
      const tokeoAccess = await this.checkTokeoAccess();
      if (tokeoAccess.hasAccess) {
        return tokeoAccess;
      }

      // Try Lace wallet as fallback
      const walletAddress = await this.getWalletAddress();
      
      if (walletAddress) {
        // Human with wallet - check balance and NFTs
        const balance = await this.getBalance();
        const nfts = await this.getNFTs();
        
        // Determine access level based on holdings
        if (nfts.hasNfts && nfts.totalValue > 0) {
          this.accessLevel = 'premium';
          this.accessType = 'nft_holder';
          return {
            hasAccess: true,
            level: 'premium',
            type: 'nft_holder',
            reason: 'NFT holder access granted'
          };
        }
        
        // Check if balance meets minimum
        if (this.parseBalance(balance) > 0) {
          this.accessLevel = 'basic';
          this.accessType = 'human';
          return {
            hasAccess: true,
            level: 'basic',
            type: 'human',
            reason: 'Wallet access granted'
          };
        }
      }
      
      // Check for AI agent identity via HyperInsight
      const agentIdentity = await this.getAIAgentIdentity();
      if (agentIdentity) {
        this.accessLevel = 'enterprise';
        this.accessType = 'ai_agent';
        return {
          hasAccess: true,
          level: 'enterprise',
          type: 'ai_agent',
          reason: 'AI Agent access granted'
        };
      }
      
      // No access found
      this.accessLevel = 'none';
      return {
        hasAccess: false,
        level: 'none',
        reason: 'No wallet, NFT, or AI agent identity detected'
      };
    } catch (e) {
      console.error('[AdaPortal] Access check failed:', e);
      return {
        hasAccess: false,
        level: 'none',
        reason: 'Access check error'
      };
    }
  }

  // Check Tokeo wallet for NFT-gated access (DEPRECATED — Tokeo removed, returns not available)
  private async checkTokeoAccess(): Promise<AccessCheck> {
    return { hasAccess: false, level: 'none', reason: 'Tokeo wallet integration removed' };
  }

  // Connect Tokeo wallet (DEPRECATED — Tokeo removed)
  async connectTokeo(wallet?: string): Promise<{ success: boolean; address?: string; error?: string }> {
    return { success: false, error: 'Tokeo wallet integration removed' };
  }

  // Verify NFT access for specific agent or node (DEPRECATED — Tokeo removed)
  async verifyNFTAccess(policyIds: string[], requireAll: boolean = false): Promise<{ hasAccess: boolean; matchedPolicies: string[] }> {
    return { hasAccess: false, matchedPolicies: [] };
  }

  // Check if user has access to specific agent via NFT
  async checkAgentAccess(agentId: string): Promise<boolean> {
    const policyIds = this.nftConfig.agentPolicyMappings[agentId];
    if (!policyIds || policyIds.length === 0) {
      return true; // No NFT requirement for this agent
    }
    const result = await this.verifyNFTAccess(policyIds);
    return result.hasAccess;
  }

  // Check if user has access to specific node via NFT
  async checkNodeAccess(nodeId: string): Promise<boolean> {
    const policyIds = this.nftConfig.nodePolicyMappings[nodeId];
    if (!policyIds || policyIds.length === 0) {
      return true; // No NFT requirement for this node
    }
    const result = await this.verifyNFTAccess(policyIds);
    return result.hasAccess;
  }

  // Get wallet address from available web3 APIs
  private async getWalletAddress(): Promise<string | null> {
    try {
      // Try Electron API first
      if (window.electronAPI?.web3?.getAddress) {
        try {
          const result = await window.electronAPI.web3.getAddress();
          if (result?.success && result?.data) {
            const data = result.data as any;
            return data.address || data.addressShort || null;
          }
        } catch {}
      }
      
      // Try Cardano wallet
      if (window.electronAPI?.cardano?.getStatus) {
        try {
          const status = await window.electronAPI.cardano.getStatus();
          const s = status as any;
          // Handle: { success: true, data: { connected: true, address: "..." } }
          if (s?.success && s?.data?.connected && s?.data?.address) {
            return s.data.address;
          }
          // Also handle direct address
          if (s?.address) {
            return s.address;
          }
        } catch {}
      }
      
      return null;
    } catch {
      return null;
    }
  }

  // Get wallet balance
  private async getBalance(): Promise<string> {
    try {
      if (window.electronAPI?.web3?.getBalance) {
        const result = await window.electronAPI.web3.getBalance();
        if (result?.success && result?.data) {
          return result.data as string;
        }
      }
      return '0';
    } catch {
      return '0';
    }
  }

  // Get NFT holdings
  private async getNFTs(): Promise<NFTHoldings> {
    try {
      // This would integrate with NFT APIs or wallet
      // For now, return empty - could be enhanced with actual NFT detection
      return {
        hasNfts: false,
        collections: [],
        totalValue: 0
      };
    } catch {
      return {
        hasNfts: false,
        collections: [],
        totalValue: 0
      };
    }
  }

  // Check for AI agent identity via HyperInsight
  private async getAIAgentIdentity(): Promise<boolean> {
    try {
      const stats = hyperInsight.getStats();
      // If HyperInsight is connected and has agents, treat as AI agent access
      return stats.totalAIMs > 0 && stats.activeNodes > 0;
    } catch {
      return false;
    }
  }

  // Parse balance string to number
  private parseBalance(balanceStr: string): number {
    if (!balanceStr) return 0;
    // Extract first numeric value from balance string
    const match = balanceStr.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  // Get current access level
  getAccessLevel(): AccessLevel {
    return this.accessLevel;
  }

  // Get access type
  getAccessType(): AccessType | null {
    return this.accessType;
  }

  // Get Tokeo connection status
  isTokeoConnected(): boolean {
    return this.tokeoConnected;
  }

  // Get Tokeo address
  getTokeoAddress(): string | null {
    return this.tokeoAddress;
  }

  // Check if user has specific tier access
  hasMinAccessLevel(requiredLevel: AccessLevel): boolean {
    const levels: Record<AccessLevel, number> = {
      'none': 0,
      'basic': 1,
      'premium': 2,
      'enterprise': 3
    };
    return levels[this.accessLevel] >= levels[requiredLevel];
  }

  // Grant temporary access for demo/development
  grantDemoAccess(level: AccessLevel = 'basic'): void {
    this.accessLevel = level;
    this.accessType = 'human';
    console.log(`[AdaPortal] Demo access granted: ${level}`);
  }

  // Get accessible features based on access level
  getAllowedFeatures(): string[] {
    const features: Record<AccessLevel, string[]> = {
      'none': [],
      'basic': ['marketplace', 'leaderboard', 'training', 'skills'],
      'premium': ['marketplace', 'leaderboard', 'training', 'skills', 'packages', 'compute'],
      'enterprise': ['marketplace', 'leaderboard', 'training', 'skills', 'packages', 'compute', 'dashboard', 'nodes']
    };
    return features[this.accessLevel];
  }

  // Initialize and check access
  async initialize(): Promise<AccessCheck> {
    this.isInitialized = true;
    return await this.checkAccess();
  }

  // Force refresh access check
  async refreshAccess(): Promise<AccessCheck> {
    return await this.checkAccess();
  }
}

export const accessControl = new AccessControlService();
export { AccessControlService };
export type { AccessCheck, WalletState, NFTHoldings, NFTGatingConfig };