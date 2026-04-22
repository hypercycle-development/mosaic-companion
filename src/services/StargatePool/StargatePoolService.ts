// StargatePoolService.ts — Stargate Pool v1: Compute Discovery & Delegation System
// =============================================================================
// NFT-gated access to HyperCycle Node Factories
// Read + Registration only (no agent spawning, no capacity enforcement yet)

// =============================================================================
// Data Models
// =============================================================================

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isConnected?: () => Promise<boolean>;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export type ChainType = 'ethereum' | 'base' | 'cardano';
export type FactoryStatus = 'active' | 'inactive';
export type AccessType = 'public' | 'nft-gated';

export interface DelegationConfig {
  is_public: boolean;
  access_type: AccessType;
}

export interface NodeFactory {
  factory_id: string;
  name: string;
  chain: ChainType;
  network: string;
  owner_wallet: string;
  collection_access: string[]; // collection_ids that can access
  total_capacity: number;
  available_capacity: number;
  skills_supported: string[];
  status: FactoryStatus;
  delegation: DelegationConfig;
  // ANFE Level Requirements (NEW)
  min_anfe_level?: number; // Minimum ANFE level required (1-11)
  required_collections?: string[]; // Specific NFT collections required
  created_at: number;
  updated_at: number;
}

export interface FactoryRegistrationInput {
  name: string;
  chain: ChainType;
  network: string;
  owner_wallet: string;
  collection_access?: string[];
  total_capacity: number;
  skills_supported: string[];
  is_public?: boolean;
  // ANFE Level Requirements (NEW)
  min_anfe_level?: number;
  required_collections?: string[];
}

export interface UserNFT {
  contractAddress: string;
  tokenId: string;
  collectionId: string;
  chain: ChainType;
  metadata?: {
    name?: string;
    level?: number;
    imageUrl?: string;
  };
}

// ANFE Level info
export interface ANFEInfo {
  balance: number;
  contractAddress: string;
  levels: number[]; // Level 1-11
  tokenIds: string[];
  totalPower: number; // Sum of levels
}

export interface WalletNFTs {
  address: string;
  nfts: UserNFT[];
  fetchedAt: number;
}

// =============================================================================
// Constants
// =============================================================================

// ANFE Contract on Ethereum Mainnet
const ANFE_CONTRACT_ADDRESS = '0x8c0075D087de9588DdF5c1441dF39828d695bc2f'.toLowerCase();

// ERC-721 ABI for balanceOf + tokenOfOwnerByIndex + tokenURI
const ERC721_ABI = {
  balanceOf: '0xf242deda', // balanceOf(address)
  tokenOfOwnerByIndex: '0x2f745c59', // tokenOfOwnerByIndex(address,uint256)
  tokenUri: '0x0e89341c', // tokenURI(uint256)
  ownerOf: '0x6352211e', // ownerOf(uint256)
};

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEY = 'stargate_pool_factories';

// =============================================================================
// Stargate Pool Service
// =============================================================================

class StargatePoolService {
  private factories: Map<string, NodeFactory> = new Map();
  private walletNFTsCache: Map<string, WalletNFTs> = new Map();
  private walletAddress: string | null = null;
  private initialized = false;

  /**
   * Initialize - load from localStorage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to connect to injected wallet (Mosaic or MetaMask)
    try {
      if (typeof window !== 'undefined') {
        // Check for Mosaic wallet
        const mosaicWallet = (window as any).mosaic?.wallet;
        if (mosaicWallet?.address) {
          this.walletAddress = mosaicWallet.address;
          console.log('[StargatePool] Connected to Mosaic wallet:', this.walletAddress);
        }
        // Check for MetaMask
        else if ((window as any).ethereum?.selectedAddress) {
          this.walletAddress = (window as any).ethereum.selectedAddress;
          console.log('[StargatePool] Connected to MetaMask:', this.walletAddress);
        }
      }
    } catch (e) {
      console.log('[StargatePool] No wallet detected, manual connect required');
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as NodeFactory[];
        data.forEach(f => this.factories.set(f.factory_id, f));
        console.log(`[StargatePool] Loaded ${this.factories.size} factories from storage`);
      }
    } catch (err) {
      console.error('[StargatePool] Failed to load from storage:', err);
    }

    this.initialized = true;
  }

  /**
   * Persist factories to localStorage
   */
  private persist(): void {
    try {
      const data = Array.from(this.factories.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('[StargatePool] Failed to persist:', err);
    }
  }

  /**
   * Generate unique factory ID
   */
  private generateFactoryId(): string {
    return `factory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate required fields for factory registration
   */
  private validateFactory(data: FactoryRegistrationInput): string[] {
    const errors: string[] = [];

    if (!data.name?.trim()) errors.push('name is required');
    if (!data.chain) errors.push('chain is required');
    if (!data.network?.trim()) errors.push('network is required');
    if (!data.owner_wallet?.trim()) errors.push('owner_wallet is required');
    if (typeof data.total_capacity !== 'number' || data.total_capacity <= 0) {
      errors.push('total_capacity must be a positive number');
    }
    if (!Array.isArray(data.skills_supported) || data.skills_supported.length === 0) {
      errors.push('skills_supported is required');
    }

    return errors;
  }

  // =============================================================================
  // Core Functions
  // =============================================================================

  /**
   * Register a new Node Factory
   */
  async registerFactory(data: FactoryRegistrationInput): Promise<{ success: boolean; factory?: NodeFactory; error?: string }> {
    await this.initialize();

    const errors = this.validateFactory(data);
    if (errors.length > 0) {
      return { success: false, error: errors.join(', ') };
    }

    const now = Date.now();
    const factory: NodeFactory = {
      factory_id: this.generateFactoryId(),
      name: data.name.trim(),
      chain: data.chain,
      network: data.network.trim(),
      owner_wallet: data.owner_wallet.trim().toLowerCase(),
      collection_access: data.collection_access || [],
      total_capacity: data.total_capacity,
      available_capacity: data.total_capacity, // Initially all available
      skills_supported: data.skills_supported,
      status: 'active',
      delegation: {
        is_public: data.is_public ?? false,
        access_type: (data.collection_access?.length ?? 0) > 0 || !(data.is_public ?? false) ? 'nft-gated' : 'public',
      },
      // ANFE Level Requirements
      min_anfe_level: data.min_anfe_level,
      required_collections: data.required_collections,
      created_at: now,
      updated_at: now,
    };

    this.factories.set(factory.factory_id, factory);
    this.persist();

    console.log(`[StargatePool] Registered factory: ${factory.name} (${factory.factory_id})`);
    return { success: true, factory };
  }

  /**
   * Get all registered factories
   */
  async getFactories(): Promise<NodeFactory[]> {
    await this.initialize();
    return Array.from(this.factories.values());
  }

  /**
   * Get factory by ID
   */
  async getFactoryById(factoryId: string): Promise<NodeFactory | null> {
    await this.initialize();
    return this.factories.get(factoryId) || null;
  }

  /**
   * Update factory
   */
  async updateFactory(factoryId: string, updates: Partial<NodeFactory>): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    const factory = this.factories.get(factoryId);
    if (!factory) {
      return { success: false, error: 'Factory not found' };
    }

    const updated: NodeFactory = {
      ...factory,
      ...updates,
      factory_id: factory.factory_id, // Cannot change ID
      updated_at: Date.now(),
    };

    this.factories.set(factoryId, updated);
    this.persist();

    return { success: true };
  }

  /**
   * Delegate factory access to a collection
   */
  async delegateFactoryAccess(factoryId: string, collectionId: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    const factory = this.factories.get(factoryId);
    if (!factory) {
      return { success: false, error: 'Factory not found' };
    }

    // Add collection if not already present
    if (!factory.collection_access.includes(collectionId)) {
      factory.collection_access.push(collectionId);
      factory.delegation.access_type = 'nft-gated';
      factory.delegation.is_public = false;
      factory.updated_at = Date.now();

      this.factories.set(factoryId, factory);
      this.persist();
    }

    console.log(`[StargatePool] Delegated access for ${collectionId} to factory ${factoryId}`);
    return { success: true };
  }

  /**
   * Remove factory access for a collection
   */
  async revokeFactoryAccess(factoryId: string, collectionId: string): Promise<{ success: boolean; error?: string }> {
    await this.initialize();

    const factory = this.factories.get(factoryId);
    if (!factory) {
      return { success: false, error: 'Factory not found' };
    }

    factory.collection_access = factory.collection_access.filter(c => c !== collectionId);
    
    // If no more restricted collections, switch to public
    if (factory.collection_access.length === 0) {
      factory.delegation.access_type = 'public';
      factory.delegation.is_public = true;
    }
    
    factory.updated_at = Date.now();
    this.factories.set(factoryId, factory);
    this.persist();

    return { success: true };
  }

  // =============================================================================
  // Web3 Integration - NFT Reading
  // =============================================================================

  /**
   * Fetch NFTs for a wallet using Ethereum API
   * Uses ERC-721 ownerOf and tokenByIndex to enumerate tokens
   */
  async fetchWalletNFTs(walletAddress: string, chain: ChainType = 'ethereum'): Promise<WalletNFTs> {
    // Check cache first (5 min TTL)
    const cached = this.walletNFTsCache.get(walletAddress);
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached;
    }

    try {
      // Use ERC-721 balanceOf to get count, then enumerate
      const nfts: UserNFT[] = [];

      // Common collection addresses to check (demo/placeholder)
      // In production, this would use an indexer like SimpleHash or Moralis
      const collectionAddresses = await this.getCollectionAddresses(chain);

      for (const contractAddress of collectionAddresses) {
        try {
          const balance = await this.getERC721Balance(walletAddress, contractAddress);
          if (balance > 0) {
            // Get first token (simplified - would iterate in production)
            const tokenId = await this.getFirstTokenId(walletAddress, contractAddress, balance);
            if (tokenId !== null) {
              nfts.push({
                contractAddress,
                tokenId,
                collectionId: contractAddress.toLowerCase(),
                chain,
              });
            }
          }
        } catch (e) {
          // Skip collections that fail
          console.warn(`[StargatePool] Failed to check collection ${contractAddress}:`, e);
        }
      }

      const result: WalletNFTs = {
        address: walletAddress,
        nfts,
        fetchedAt: Date.now(),
      };

      this.walletNFTsCache.set(walletAddress, result);
      return result;
    } catch (err) {
      console.error('[StargatePool] Failed to fetch wallet NFTs:', err);
      return { address: walletAddress, nfts: [], fetchedAt: Date.now() };
    }
  }

  /**
   * Get collection addresses for a chain
   * This would integrate with an indexer in production
   */
  private async getCollectionAddresses(chain: ChainType): Promise<string[]> {
    // HPEC ecosystem collections
    const collections: Record<ChainType, string[]> = {
      ethereum: [
        '0x8c0075D087de9588DdF5c1441dF39828d695bc2f'.toLowerCase(), // ANFE
      ],
      base: [
        // Base NFT collections
      ],
      cardano: [
        // Cardano Policy IDs (stored as lowercase hex)
        'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46', // HPEC DAO PASS
      ],
    };

    return collections[chain] || [];
  }

  /**
   * Check if wallet has NFTs from specific collection
   * Returns the count of NFTs owned
   */
  async checkCollectionOwnership(walletAddress: string, contractAddress: string): Promise<number> {
    try {
      if (!window.ethereum) {
        console.warn('[StargatePool] No window.ethereum available');
        return 0;
      }

      const normalizedOwner = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
      const normalizedContract = contractAddress.toLowerCase();

      // ERC-721 balanceOf
      const balanceResult = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: normalizedContract,
          data: '0xf242deda' + normalizedOwner
        }, 'latest']
      });

      if (balanceResult && typeof balanceResult === 'string' && balanceResult !== '0x') {
        const balance = parseInt(balanceResult, 16);
        console.log(`[StargatePool] Wallet ${walletAddress.slice(0, 6)}... owns ${balance} NFTs from ${normalizedContract.slice(0, 10)}...`);
        return balance;
      }

      return 0;
    } catch (err) {
      console.error('[StargatePool] Failed to check collection ownership:', err);
      return 0;
    }
  }

  /**
   * Check if wallet has ANFE Level 11 NFTs - Returns full ANFE info
   */
  async getANFEInfo(walletAddress: string): Promise<ANFEInfo> {
    try {
      if (!window.ethereum) {
        console.warn('[StargatePool] No window.ethereum available');
        return { balance: 0, contractAddress: ANFE_CONTRACT_ADDRESS, levels: [], tokenIds: [], totalPower: 0 };
      }

      // 1. Get ANFE balance
      const balance = await this.getERC721Balance(walletAddress, ANFE_CONTRACT_ADDRESS);
      
      if (balance === 0) {
        return { balance: 0, contractAddress: ANFE_CONTRACT_ADDRESS, levels: [], tokenIds: [], totalPower: 0 };
      }

      // 2. Enumerate all token IDs
      const tokenIds: string[] = [];
      const levels: number[] = [];
      
      for (let i = 0; i < Math.min(balance, 20); i++) { // Limit to 20 for performance
        try {
          const tokenId = await this.getFirstTokenId(walletAddress, ANFE_CONTRACT_ADDRESS, i);
          if (tokenId !== null) {
            tokenIds.push(tokenId);
            
            // 3. Fetch token URI to get level
            const level = await this.getANFELevel(tokenId);
            if (level > 0) {
              levels.push(level);
            }
          }
        } catch (e) {
          console.warn(`[StargatePool] Failed to get token at index ${i}:`, e);
        }
      }

      const totalPower = levels.reduce((sum, l) => sum + l, 0);
      
      console.log(`[StargatePool] ANFE found: ${balance} tokens, levels: [${levels.join(', ')}], total power: ${totalPower}`);
      
      return {
        balance,
        contractAddress: ANFE_CONTRACT_ADDRESS,
        levels,
        tokenIds,
        totalPower
      };
    } catch (err) {
      console.error('[StargatePool] Failed to get ANFE info:', err);
      return { balance: 0, contractAddress: ANFE_CONTRACT_ADDRESS, levels: [], tokenIds: [], totalPower: 0 };
    }
  }

  /**
   * Get ANFE level from token ID or tokenURI
   * Token ID encodes level: tokenId = level * 1000 + index
   * Or fetch tokenURI for metadata
   */
  private async getANFELevel(tokenId: string): Promise<number> {
    try {
      if (!window.ethereum) return 0;

      // Method 1: Try tokenURI to get metadata
      const tokenIdParam = parseInt(tokenId).toString(16).padStart(64, '0');
      
      try {
        const uriResult = await window.ethereum.request({
          method: 'eth_call',
          params: [{
            to: ANFE_CONTRACT_ADDRESS,
            data: '0x0e89341c' + tokenIdParam // tokenURI(uint256)
          }, 'latest']
        });

        if (uriResult && typeof uriResult === 'string' && uriResult !== '0x') {
          // Parse token URI (likely IPFS URL)
          // Convert hex to string
          const uriHex = uriResult.replace('0x', '');
          if (uriHex.length > 0 && uriHex !== '0000000000000000000000000000000000000000000000000000000000000000') {
            try {
              // Try to decode as ASCII
              let uri = '';
              for (let i = 0; i < uriHex.length; i += 2) {
                const char = String.fromCharCode(parseInt(uriHex.substr(i, 2), 16));
                if (char !== '\0') uri += char;
              }
              uri = uri.trim();
              
              // Try to fetch metadata if it's a URL
              if (uri.startsWith('http')) {
                try {
                  const response = await fetch(uri);
                  const metadata = await response.json();
                  // Try to extract level from attributes
                  if (metadata.attributes) {
                    const levelAttr = metadata.attributes.find((a: any) => a.trait_type === 'Level' || a.trait_type === 'level');
                    if (levelAttr) return parseInt(levelAttr.value) || levelAttr;
                  }
                  if (metadata.level) return parseInt(metadata.level);
                  if (metadata.name) {
                    // Try to parse from name like "ANFE Level 5"
                    const match = metadata.name.match(/Level\s*(\d+)/i);
                    if (match) return parseInt(match[1]);
                  }
                } catch (e) {
                  // Failed to fetch, continue to fallback
                }
              }
            } catch (e) {
              // Continue to fallback
            }
          }
        }
      } catch (e) {
        // tokenURI call failed, continue to fallback
      }

      // Method 2: Derive level from tokenId (tokenId encoding: level * 10000 + uniqueId)
      const idNum = parseInt(tokenId);
      // If token ID is small, it might encode the level directly
      if (idNum > 0 && idNum <= 11) {
        return idNum;
      }
      // If token ID is larger, try to extract level
      const derivedLevel = Math.floor(idNum / 10000);
      if (derivedLevel >= 1 && derivedLevel <= 11) {
        return derivedLevel;
      }

      // Default to 1 if we can't determine
      return 1;
    } catch (err) {
      console.warn('[StargatePool] Failed to get ANFE level:', err);
      return 1; // Default to level 1
    }
  }

  /**
   * Legacy method - returns balance only
   */
  async checkANFEOwnership(walletAddress: string): Promise<number> {
    const info = await this.getANFEInfo(walletAddress);
    return info.balance;
  }

  /**
   * Get ERC-721 balance for an address using window.ethereum directly
   */
  private async getERC721Balance(owner: string, contractAddress: string): Promise<number> {
    try {
      if (!window.ethereum) return 0;

      // Minimal ERC-721 ABI for balanceOf
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0xf242deda' + owner.slice(2).toLowerCase().padStart(64, '0') // balanceOf(address)
        }, 'latest']
      });

      if (result && typeof result === 'string') {
        return parseInt(result, 16);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get first token ID owned by address using ERC-721Enumerable
   */
  private async getFirstTokenId(owner: string, contractAddress: string, balance: number): Promise<string | null> {
    if (balance <= 0) return null;
    
    try {
      if (!window.ethereum) return null;

      // tokenOfOwnerByIndex(address owner, uint256 index)
      const ownerParam = owner.slice(2).toLowerCase().padStart(64, '0');
      const indexParam = '0000000000000000000000000000000000000000000000000000000000000000';
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0x2f745c59' + ownerParam + indexParam // tokenOfOwnerByIndex(address,uint256)
        }, 'latest']
      });

      if (result && typeof result === 'string' && result !== '0x') {
        return parseInt(result, 16).toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Map NFTs to collection IDs
   */
  mapNFTsToCollectionIds(nfts: UserNFT[]): string[] {
    return nfts.map(nft => nft.collectionId);
  }

  // =============================================================================
  // Query by Wallet
  // =============================================================================

  /**
   * Get factories accessible by a wallet
   * 
   * Logic:
   * 1. Fetch NFTs owned by wallet using Web3
   * 2. Extract collection IDs
   * 3. Return factories where:
   *    - factory.delegation.is_public = true
   *    OR
   *    - factory.collection_access includes one of the user's collections
   */
  /**
   * Get factories accessible by wallet (basic - just checks collection ownership)
   */
  async getFactoriesByWallet(walletAddress: string): Promise<{ factory: NodeFactory; isEligible: boolean }[]> {
    // Get ANFE info first for level checking
    const anfeInfo = await this.getANFEInfo(walletAddress);
    return this.getFactoriesByWalletWithLevels(walletAddress, anfeInfo.levels);
  }

  /**
   * Get factories accessible by wallet with ANFE level checking
   * This is the main method that checks min_anfe_level requirements
   */
  async getFactoriesByWalletWithLevels(
    walletAddress: string, 
    userAnfeLevels: number[]
  ): Promise<{ factory: NodeFactory; isEligible: boolean; reason?: string }[]> {
    await this.initialize();

    if (!walletAddress) {
      // No wallet = only public factories
      const allFactories = await this.getFactories();
      return allFactories
        .filter(f => f.delegation.is_public)
        .map(f => ({ factory: f, isEligible: true }));
    }

    // Fetch user's NFTs via indexer
    const walletNFTs = await this.fetchWalletNFTs(walletAddress);
    let userCollections = this.mapNFTsToCollectionIds(walletNFTs.nfts);

    // Also check direct contract calls for known HPEC ecosystem collections
    const anfeInfo = await this.getANFEInfo(walletAddress);
    if (anfeInfo.balance > 0) {
      const anfeCollection = '0x8c0075D087de9588DdF5c1441dF39828d695bc2f'.toLowerCase();
      if (!userCollections.includes(anfeCollection)) {
        userCollections.push(anfeCollection);
      }
      console.log(`[StargatePool] ANFE ownership detected: ${anfeInfo.balance} tokens, levels: [${anfeInfo.levels.join(', ')}]`);
    }

    // Get user's max ANFE level
    const maxUserLevel = anfeInfo.levels.length > 0 ? Math.max(...anfeInfo.levels) : 0;
    console.log(`[StargatePool] Wallet ${walletAddress.slice(0, 8)}... has max ANFE level: ${maxUserLevel}`);
    console.log(`[StargatePool] Wallet has access to ${userCollections.length} collections`);

    // Get all factories and filter
    const allFactories = await this.getFactories();
    
    return allFactories
      .filter(factory => {
        // Include if public
        if (factory.delegation.is_public) return true;
        
        // Include if user has any collection that matches
        if (factory.delegation.access_type === 'nft-gated') {
          const hasCollectionAccess = factory.collection_access.some(col => 
            userCollections.includes(col.toLowerCase())
          );
          if (!hasCollectionAccess) return false;
          
          // Check ANFE level requirement if specified
          if (factory.min_anfe_level !== undefined && factory.min_anfe_level > 0) {
            const hasRequiredLevel = anfeInfo.levels.some(level => level >= factory.min_anfe_level!);
            if (!hasRequiredLevel) {
              console.log(`[StargatePool] Factory ${factory.name} requires level ${factory.min_anfe_level}, user has max ${maxUserLevel}`);
              return false;
            }
          }
          
          return true;
        }
        
        return false;
      })
      .map(factory => {
        // Determine eligibility with reason
        let isEligible = factory.delegation.is_public;
        let reason: string | undefined;
        
        if (!factory.delegation.is_public) {
          const hasCollectionAccess = factory.collection_access.some(col => 
            userCollections.includes(col.toLowerCase())
          );
          
          if (!hasCollectionAccess) {
            isEligible = false;
            reason = 'No matching NFT collection';
          } else if (factory.min_anfe_level !== undefined && factory.min_anfe_level > 0) {
            const hasRequiredLevel = anfeInfo.levels.some(level => level >= factory.min_anfe_level!);
            isEligible = hasRequiredLevel;
            reason = hasRequiredLevel 
              ? `ANFE Level ${anfeInfo.levels.find(l => l >= factory.min_anfe_level!)} meets requirement` 
              : `Requires ANFE Level ${factory.min_anfe_level}+ (you have: ${maxUserLevel})`;
          }
        }
        
        return { factory, isEligible, reason };
      });
  }

  /**
   * Get factories by chain
   */
  async getFactoriesByChain(chain: ChainType): Promise<NodeFactory[]> {
    await this.initialize();
    const all = await this.getFactories();
    return all.filter(f => f.chain === chain && f.status === 'active');
  }

  /**
   * Get factories by owner
   */
  async getFactoriesByOwner(ownerWallet: string): Promise<NodeFactory[]> {
    await this.initialize();
    const all = await this.getFactories();
    return all.filter(f => f.owner_wallet.toLowerCase() === ownerWallet.toLowerCase());
  }

  // =============================================================================
  // Demo Data (for testing)
  // =============================================================================

  /**
   * Add demo factories for testing
   */
  async addDemoFactories(): Promise<void> {
    await this.initialize();

    const demoFactories: FactoryRegistrationInput[] = [
      {
        name: 'HyperCycle Alpha Node',
        chain: 'base',
        network: 'base-mainnet',
        owner_wallet: '0x1234567890123456789012345678901234567890',
        collection_access: [],
        total_capacity: 100,
        skills_supported: ['code-generation', 'smart-contracts', 'defi'],
        is_public: true,
      },
      {
        name: 'HyperCycle Beta Node',
        chain: 'ethereum',
        network: 'ethereum-mainnet',
        owner_wallet: '0x1234567890123456789012345678901234567890',
        collection_access: ['0xabc123def456'], // NFT-gated
        total_capacity: 50,
        skills_supported: ['data-analysis', 'analytics', 'dashboard'],
        is_public: false,
      },
      {
        name: 'HPEC Elite Node (Lv.5+)',
        chain: 'ethereum',
        network: 'ethereum-mainnet',
        owner_wallet: '0x1234567890123456789012345678901234567890',
        collection_access: ['0x8c0075D087de9588DdF5c1441dF39828d695bc2f'], // ANFE contract
        total_capacity: 200,
        skills_supported: ['code-generation', 'smart-contracts', 'defi', 'hypercycle'],
        is_public: false,
        min_anfe_level: 5, // Requires ANFE Level 5+
      },
      {
        name: 'HPEC Premium Node (Lv.11)',
        chain: 'ethereum',
        network: 'ethereum-mainnet',
        owner_wallet: '0x1234567890123456789012345678901234567890',
        collection_access: ['0x8c0075D087de9588DdF5c1441dF39828d695bc2f'], // ANFE contract
        total_capacity: 500,
        skills_supported: ['code-generation', 'smart-contracts', 'defi', 'hypercycle', 'ai-training'],
        is_public: false,
        min_anfe_level: 11, // Requires ANFE Level 11 (max)
      },
      {
        name: 'Cardano Compute Node',
        chain: 'cardano',
        network: 'cardano-mainnet',
        owner_wallet: '0x1234567890123456789012345678901234567890',
        collection_access: [],
        total_capacity: 75,
        skills_supported: ['cardano-sdk', 'plutus', 'arien'],
        is_public: true,
      },
    ];

    for (const factory of demoFactories) {
      await this.registerFactory(factory);
    }

    console.log('[StargatePool] Added demo factories');
  }

  /**
   * Clear all factories (for testing)
   */
  async clearAll(): Promise<void> {
    this.factories.clear();
    this.persist();
    console.log('[StargatePool] Cleared all factories');
  }

  /**
   * Get connected wallet address
   */
  getWalletAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * Connect to Cardano wallet (CIP-30) or Ethereum wallet
   */
  async connectWallet(): Promise<{ success: boolean; address?: string; error?: string }> {
    try {
      // Check for Cardano Tokeo wallet
      if (typeof window !== 'undefined') {
        const tokeo = (window as any).cardano?.tokeo;
        if (tokeo) {
          const address = await tokeo.enable();
          this.walletAddress = address;
          console.log('[StargatePool] Connected to Tokeo wallet:', address);
          return { success: true, address };
        }

        // Check for any Cardano CIP-30 wallet
        const cardano = (window as any).cardano;
        if (cardano) {
          const wallets = Object.keys(cardano).filter(k => k !== 'tokeo');
          if (wallets.length > 0) {
            const firstWallet = cardano[wallets[0]];
            const address = await firstWallet.enable();
            this.walletAddress = address;
            console.log('[StargatePool] Connected to Cardano wallet:', address);
            return { success: true, address };
          }
        }

        // Check for MetaMask/Ethereum
        const ethereum = (window as any).ethereum;
        if (ethereum?.request) {
          const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts.length > 0) {
            this.walletAddress = accounts[0];
            console.log('[StargatePool] Connected to Ethereum wallet:', this.walletAddress);
            return { success: true, address: accounts[0] };
          }
        }
      }

      return { success: false, error: 'No wallet detected. Install Tokeo, Nami, or MetaMask.' };
    } catch (e: any) {
      console.error('[StargatePool] Wallet connection failed:', e);
      return { success: false, error: e.message || 'Failed to connect wallet' };
    }
  }

  /**
   * Disconnect wallet
   */
  disconnectWallet(): void {
    this.walletAddress = null;
    console.log('[StargatePool] Wallet disconnected');
  }

  /**
   * Register HPEC DAO PASS factory with NFT-gated access
   * Requires ANFE NFT (0x8c0075D087de9588DdF5c1441dF39828d695bc2f)
   */
  async registerHPECFactory(ownerWallet: string): Promise<{ success: boolean; factory?: NodeFactory; error?: string }> {
    // HPEC DAO PASS policy ID on Cardano + ANFE Level 11 on Ethereum
    const hpecCollection = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';
    const anfeCollection = '0x8c0075d087de9588ddf5c1441df39828d695bc2f'; // ANFE (lowercase)

    const result = await this.registerFactory({
      name: 'HPEC DAO PASS Node',
      chain: 'ethereum',
      network: 'ethereum-mainnet',
      owner_wallet: ownerWallet,
      collection_access: [anfeCollection, hpecCollection], // Accepts both ANFE (ETH) and HPEC PASS (Cardano)
      total_capacity: 200,
      skills_supported: ['code-generation', 'smart-contracts', 'defi', 'hypercycle'],
      is_public: false, // NFT-gated
    });

    if (result.success) {
      console.log('[StargatePool] Registered HPEC factory:', result.factory?.factory_id);
    }

    return result;
  }

  /**
   * Get or create the HPEC factory
   */
  async getOrCreateHPECFactory(ownerWallet: string): Promise<NodeFactory | null> {
    await this.initialize();

    const existing = await this.getFactoriesByOwner(ownerWallet);
    const hpecFactory = existing.find(f => f.name.includes('HPEC'));

    if (hpecFactory) {
      return hpecFactory;
    }

    const result = await this.registerHPECFactory(ownerWallet);
    return result.factory || null;
  }
}

// Singleton
export const stargatePoolService = new StargatePoolService();
export default stargatePoolService;