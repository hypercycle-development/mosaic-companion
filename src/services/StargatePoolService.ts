/**
 * Stargate Pool Service
 * 
 * NFT-gated access system for HyperCycle Node Factories:
 * - Register Node Factories with capacity and skills
 * - Query factories by wallet address
 * - Delegate NFT collection access
 * - Integration with HyperInsight bridge for verification
 */

import { ipcRenderer } from 'electron';

export interface NodeFactory {
  factory_id: string;
  name: string;
  chain: 'ethereum' | 'base' | 'cardano';
  network: string;
  owner_wallet: string;
  collection_access: string[];
  total_capacity: number;
  available_capacity: number;
  skills_supported: string[];
  status: 'active' | 'inactive';
  delegation: {
    is_public: boolean;
    access_type: 'public' | 'nft-gated';
  };
}

export interface WalletFactoryResult {
  factory: NodeFactory;
  isEligible: boolean;
  isVerified?: boolean;
  reputation_score?: number;
  leaderboard_rank?: number;
}

const STORAGE_KEY = 'mosaic_stargate_factories';

class StargatePoolService {
  private factories: Map<string, NodeFactory> = new Map();
  private initialized = false;

  /**
   * Initialize from localStorage
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as NodeFactory[];
        data.forEach(f => this.factories.set(f.factory_id, f));
      }
    } catch (e) {
      console.error('[StargatePool] Failed to load:', e);
    }
    this.initialized = true;
  }

  /**
   * Persist to localStorage
   */
  private persist(): void {
    try {
      const data = Array.from(this.factories.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[StargatePool] Failed to persist:', e);
    }
  }

  /**
   * Register a new Node Factory
   */
  async registerFactory(config: {
    name: string;
    chain: 'ethereum' | 'base' | 'cardano';
    network: string;
    owner_wallet: string;
    total_capacity: number;
    skills_supported?: string[];
    is_public?: boolean;
    collection_access?: string[];
  }): Promise<{ success: boolean; factory_id?: string; error?: string }> {
    await this.init();

    // Validate
    if (!config.name || !config.owner_wallet) {
      return { success: false, error: 'Name and wallet required' };
    }

    const factory_id = `factory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const factory: NodeFactory = {
      factory_id,
      name: config.name,
      chain: config.chain,
      network: config.network,
      owner_wallet: config.owner_wallet,
      collection_access: config.collection_access || [],
      total_capacity: config.total_capacity || 100,
      available_capacity: config.total_capacity || 100,
      skills_supported: config.skills_supported || [],
      status: 'active',
      delegation: {
        is_public: config.is_public ?? true,
        access_type: (config.collection_access?.length ?? 0) > 0 ? 'nft-gated' : 'public',
      },
    };

    this.factories.set(factory_id, factory);
    this.persist();

    return { success: true, factory_id };
  }

  /**
   * Get all factories
   */
  async getFactories(): Promise<NodeFactory[]> {
    await this.init();
    return Array.from(this.factories.values());
  }

  /**
   * Get factory by ID
   */
  async getFactoryById(factory_id: string): Promise<NodeFactory | null> {
    await this.init();
    return this.factories.get(factory_id) || null;
  }

  /**
   * Get factories by chain
   */
  async getFactoriesByChain(chain: string): Promise<NodeFactory[]> {
    await this.init();
    return Array.from(this.factories.values()).filter(f => f.chain === chain);
  }

  /**
   * Get factories by owner wallet
   */
  async getFactoriesByOwner(owner_wallet: string): Promise<NodeFactory[]> {
    await this.init();
    return Array.from(this.factories.values()).filter(f => f.owner_wallet.toLowerCase() === owner_wallet.toLowerCase());
  }

  /**
   * Get factories accessible by a wallet (via NFT or delegation)
   */
  async getFactoriesByWallet(walletAddress: string): Promise<WalletFactoryResult[]> {
    await this.init();
    
    const results: WalletFactoryResult[] = [];
    
    for (const factory of this.factories.values()) {
      // Public factories are accessible to all
      if (factory.delegation.is_public) {
        results.push({
          factory,
          isEligible: true,
        });
        continue;
      }
      
      // Check NFT access for NFT-gated factories
      if (factory.delegation.access_type === 'nft-gated') {
        // For now, check if wallet matches owner
        const isOwner = factory.owner_wallet.toLowerCase() === walletAddress.toLowerCase();
        
        if (isOwner) {
          results.push({
            factory,
            isEligible: true,
          });
        } else {
          results.push({
            factory,
            isEligible: false,
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Delegate factory access to NFT collection
   */
  async delegateFactoryAccess(factory_id: string, collection_id: string): Promise<{ success: boolean; error?: string }> {
    await this.init();
    
    const factory = this.factories.get(factory_id);
    if (!factory) {
      return { success: false, error: 'Factory not found' };
    }
    
    if (!factory.collection_access.includes(collection_id)) {
      factory.collection_access.push(collection_id);
      factory.delegation.access_type = 'nft-gated';
      this.persist();
    }
    
    return { success: true };
  }

  /**
   * Revoke factory access from NFT collection
   */
  async revokeFactoryAccess(factory_id: string, collection_id: string): Promise<{ success: boolean; error?: string }> {
    await this.init();
    
    const factory = this.factories.get(factory_id);
    if (!factory) {
      return { success: false, error: 'Factory not found' };
    }
    
    factory.collection_access = factory.collection_access.filter(c => c !== collection_id);
    if (factory.collection_access.length === 0) {
      factory.delegation.access_type = 'public';
      factory.delegation.is_public = true;
    }
    this.persist();
    
    return { success: true };
  }

  /**
   * Add demo factories for testing
   */
  async addDemoFactories(): Promise<void> {
    await this.init();
    
    const demos: NodeFactory[] = [
      {
        factory_id: 'demo_alpha',
        name: 'HyperCycle Alpha Node',
        chain: 'base',
        network: 'base-mainnet',
        owner_wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f',
        collection_access: [],
        total_capacity: 100,
        available_capacity: 45,
        skills_supported: ['code-generation', 'smart-contracts', 'reasoning'],
        status: 'active',
        delegation: { is_public: true, access_type: 'public' },
      },
      {
        factory_id: 'demo_beta',
        name: 'HyperCycle Beta Node',
        chain: 'ethereum',
        network: 'mainnet',
        owner_wallet: '0x8Ba1f109551bD432803012645Hc136E7a',
        collection_access: ['0xabc123...'],
        total_capacity: 50,
        available_capacity: 12,
        skills_supported: ['image-generation', 'video-generation'],
        status: 'active',
        delegation: { is_public: false, access_type: 'nft-gated' },
      },
      {
        factory_id: 'demo_gamma',
        name: 'HyperCycle Gamma Node',
        chain: 'cardano',
        network: 'mainnet',
        owner_wallet: 'addr1qx...',
        collection_access: [],
        total_capacity: 200,
        available_capacity: 180,
        skills_supported: ['text-generation', 'analysis'],
        status: 'active',
        delegation: { is_public: true, access_type: 'public' },
      },
    ];

    demos.forEach(d => this.factories.set(d.factory_id, d));
    this.persist();
  }

  /**
   * Clear all factories
   */
  async clearAll(): Promise<void> {
    this.factories.clear();
    this.persist();
  }

  /**
   * Fetch wallet's NFTs from chain (using window.ethereum)
   */
  async fetchWalletNFTs(walletAddress: string, collectionAddress: string): Promise<number> {
    try {
      // Use ethereum RPC to query ERC-721 balanceOf
      const { ethereum } = window as any;
      if (!ethereum) return 0;

      const result = await ethereum.request({
        method: 'eth_call',
        params: [{
          to: collectionAddress,
          data: `0x70a08231000000000000000000000000${walletAddress.slice(2)}`
        }, 'latest']
      });

      return parseInt(result, 16) || 0;
    } catch (e) {
      console.error('[StargatePool] NFT fetch error:', e);
      return 0;
    }
  }
}

// Export singleton
export const stargatePoolService = new StargatePoolService();