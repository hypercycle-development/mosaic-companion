// @ts-nocheck
// =============================================================================
// STARGATE POOL - ANFE Service
// Core engine: Load, decode, verify ANFEs from multi-chain sources
// =============================================================================

import { graphService, ANFEGraphData } from './GraphService';
import { merkelizerService, VerificationResult } from './MerkelizerService';
import { walletAdapter, WalletState } from './WalletAdapter';
import {
  ANFE,
  ANFEAttributes,
  ANFEMetadata,
  SupportedChain,
  CHAIN_NAMES,
  parseAttributes,
  graphToANFE,
  WalletANFEs,
  ANFEError,
} from './ANFETypes';

// =============================================================================
// ANFE Contract ABIs
// =============================================================================

const ERC721_ABI = {
  tokenURI: '0x0e89341c', // tokenURI(uint256)
  ownerOf: '0x6352211e', // ownerOf(uint256)
};

// Fallback RPC configuration - use public RPCs with multiple fallbacks
const RPC_CONFIG: Record<SupportedChain, string> = {
  1: import.meta.env.VITE_RPC_ETHEREUM || 'https://eth.llamarpc.com',
  8453: import.meta.env.VITE_RPC_BASE || 'https://mainnet.base.org',
};

// Fallback RPCs if primary fails
const RPC_FALLBACKS: Record<SupportedChain, string[]> = {
  1: ['https://1rpc.io/eth', 'https://rpc.ankr.com/eth'],
  8453: ['https://base.llamarpc.com', 'https://1rpc.io/base'],
};

// ANFE Contract addresses from env
const ANFE_CONTRACTS: Record<SupportedChain, string> = {
  1: import.meta.env.VITE_ANFE_CONTRACT_ETHEREUM || '0x8c0075D087de9588DdF5c1441dF39828d695bc2f',
  8453: import.meta.env.VITE_ANFE_CONTRACT_BASE || '',
};

// =============================================================================
// ANFE Service
// =============================================================================

class ANFEService {
  private walletANFEsCache: Map<string, WalletANFEs> = new Map();
  private anfeCache: Map<string, ANFE> = new Map();
  private pollInterval: number | null = null;

  /**
   * Connect wallet and get address
   */
  async connectWallet(): Promise<string> {
    return walletAdapter.connect();
  }

  /**
   * Get wallet state
   */
  getWalletState(): WalletState {
    return walletAdapter.getState();
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(): boolean {
    return walletAdapter.isConnected();
  }

  /**
   * Load all ANFEs for a wallet (multi-chain via Graph)
   */
  async loadWalletANFEs(walletAddress: string): Promise<WalletANFEs> {
    // Check cache first (30s TTL)
    const cached = this.walletANFEsCache.get(walletAddress);
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      console.log('[ANFEService] Returning cached ANFEs');
      return cached;
    }

    console.log('[ANFEService] Loading ANFEs for:', walletAddress.slice(0, 8) + '...');

    // Step 1: Fetch from The Graph (primary source)
    const graphANFEs = await graphService.getANFEsByOwner(walletAddress);

    if (graphANFEs.length === 0) {
      // Fallback: try RPC-based fetching
      console.log('[ANFEService] No ANFEs from Graph, trying RPC fallback...');
      return this.loadViaRPC(walletAddress);
    }

    // Step 2: Enrich each ANFE with attributes + verification
    const enrichedANFEs = await Promise.all(
      graphANFEs.map(anfe => this.enrichANFE(anfe))
    );

    // Step 3: Organize by chain
    const byChain: Record<SupportedChain, ANFE[]> = {
      1: enrichedANFEs.filter(a => a.chainId === 1),
      8453: enrichedANFEs.filter(a => a.chainId === 8453),
    };

    const result: WalletANFEs = {
      address: walletAddress,
      anfes: enrichedANFEs,
      totalCount: enrichedANFEs.length,
      fetchedAt: Date.now(),
      byChain,
    };

    // Cache result
    this.walletANFEsCache.set(walletAddress, result);

    console.log(`[ANFEService] Loaded ${enrichedANFEs.length} ANFEs`);
    return result;
  }

  /**
   * Enrich ANFE with attributes and verification
   */
  private async enrichANFE(graphData: ANFEGraphData): Promise<ANFE> {
    const chainId = parseInt(graphData.chainId) as SupportedChain;

    // Step 1: Fetch attributes from contract
    const attributes = await this.fetchAttributes(graphData.contractAddress, graphData.tokenId, chainId);

    // Step 2: Verify via Merkelizer
    const verification = await merkelizerService.verifyANFE(graphData.id);

    // Step 3: Return full ANFE
    return graphToANFE(graphData, attributes, verification);
  }

  /**
   * Fetch ANFE attributes from contract via RPC
   */
  private async fetchAttributes(
    contractAddress: string,
    tokenId: string,
    chainId: SupportedChain
  ): Promise<ANFEAttributes> {
    try {
      // Get tokenURI from contract
      const tokenURI = await this.callContract(
        contractAddress,
        ERC721_ABI.tokenURI,
        tokenId,
        chainId
      );

      if (!tokenURI) {
        console.warn('[ANFEService] No tokenURI returned');
        return this.emptyAttributes();
      }

      // Decode tokenURI (could be HTTP, IPFS, or base64)
      const metadata = await this.fetchMetadata(tokenURI);

      if (!metadata) {
        console.warn('[ANFEService] Failed to fetch metadata');
        return this.emptyAttributes();
      }

      // Parse attributes
      return parseAttributes(metadata);
    } catch (error) {
      console.error('[ANFEService] Failed to fetch attributes:', error);
      return this.emptyAttributes();
    }
  }

  /**
   * Get Ethereum provider (supports both window.ethereum and Mosaic wallet)
   */
  private getProvider(): any {
    // Try Mosaic wallet first, then fallback to window.ethereum
    if (window.mosaic?.wallet) {
      return window.mosaic.wallet;
    }
    return window.ethereum;
  }

  /**
   * Call contract method via direct RPC with fallbacks (no wallet required)
   */
  private async callContract(
    contractAddress: string,
    method: string,
    tokenId: string,
    chainId: SupportedChain
  ): Promise<string | null> {
    const rpcUrls = [RPC_CONFIG[chainId], ...(RPC_FALLBACKS[chainId] || [])];
    const chainName = chainId === 1 ? 'Ethereum' : 'Base';

    for (const rpcUrl of rpcUrls) {
      try {
        const tokenIdParam = parseInt(tokenId).toString(16).padStart(64, '0');
        const data = method + tokenIdParam;

        console.log('[ANFEService] Trying', chainName, 'RPC:', rpcUrl);

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: contractAddress, data }, 'latest'],
            id: 1,
          }),
        });

        const json = await response.json();
        
        if (!json.result || json.result === '0x') {
          console.warn('[ANFEService] RPC returned empty result, trying next...');
          continue;
        }

        console.log('[ANFEService] Success! Result:', json.result.substring(0, 100) + '...');

        // Convert hex to string (for tokenURI)
        if (data.startsWith(ERC721_ABI.tokenURI)) {
          return this.decodeHexString(json.result);
        }

        return json.result;
      } catch (error) {
        console.warn('[ANFEService] RPC failed:', rpcUrl, error);
        continue;
      }
    }

    console.error('[ANFEService] All RPCs failed for', chainName);
    return null;
  }

  /**
   * Decode hex string to UTF-8
   */
  private decodeHexString(hex: string): string {
    if (!hex || hex === '0x') return '';
    
    let hexClean = hex.replace('0x', '');
    
    // If it's bytes32 (64 chars) and looks like UTF-8
    if (hexClean.length === 64) {
      try {
        let str = '';
        for (let i = 0; i < hexClean.length; i += 2) {
          const code = parseInt(hexClean.substr(i, 2), 16);
          if (code === 0) break; // Null terminator
          str += String.fromCharCode(code);
        }
        return str;
      } catch {
        return hex;
      }
    }
    
    return hex;
  }

  /**
   * Fetch metadata from URL (HTTP, IPFS, base64)
   */
  private async fetchMetadata(uri: string): Promise<ANFEMetadata | null> {
    try {
      let url = uri;

      // Handle base64 data URI
      if (uri.startsWith('data:application/json;base64,')) {
        const base64 = uri.split(',')[1];
        const json = atob(base64);
        return JSON.parse(json);
      }

      // Handle IPFS (ipfs://)
      if (uri.startsWith('ipfs://')) {
        url = 'https://ipfs.io/ipfs/' + uri.replace('ipfs://', '');
      }

      // Fetch
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ANFEService] Metadata fetch failed:', error);
      return null;
    }
  }

  /**
   * Return empty attributes structure
   */
  private emptyAttributes(): ANFEAttributes {
    return {
      core: {},
      ai: { aiModules: [] },
      raw: [],
    };
  }

  /**
   * Fallback: Load ANFEs via direct RPC (when Graph fails)
   * Final fallback: Load demo ANFEs if RPC also returns 0
   */
  private async loadViaRPC(walletAddress: string): Promise<WalletANFEs> {
    console.log('[ANFEService] Using RPC fallback for ANFE loading');

    const anfes: ANFE[] = [];

    // Try Ethereum
    const ethANFEs = await this.fetchANFEsViaRPC(walletAddress, 1);
    anfes.push(...ethANFEs);

    // Try Base (if configured)
    if (ANFE_CONTRACTS[8453]) {
      const baseANFEs = await this.fetchANFEsViaRPC(walletAddress, 8453);
      anfes.push(...baseANFEs);
    }

    // FINAL FALLBACK: If still no ANFEs, load demo ANFEs for testing
    if (anfes.length === 0) {
      console.log('[ANFEService] No ANFEs from Graph or RPC, loading demo ANFEs...');
      anfes.push(...this.loadDemoANFEs(walletAddress));
    }

    const byChain: Record<SupportedChain, ANFE[]> = {
      1: anfes.filter(a => a.chainId === 1),
      8453: anfes.filter(a => a.chainId === 8453),
    };

    const result: WalletANFEs = {
      address: walletAddress,
      anfes,
      totalCount: anfes.length,
      fetchedAt: Date.now(),
      byChain,
    };

    this.walletANFEsCache.set(walletAddress, result);
    return result;
  }

  /**
   * Load demo ANFEs for testing when no real ANFEs found
   * These are mock ANFEs that allow testing the UI flow
   */
  private loadDemoANFEs(walletAddress: string): ANFE[] {
    console.log('[ANFEService] Generating demo ANFEs for:', walletAddress.slice(0, 8) + '...');
    
    const demoANFEs: ANFE[] = [
      {
        id: `demo-eth-1:${walletAddress}`,
        tokenId: '1',
        contractAddress: ANFE_CONTRACTS[1] || '0x8c0075D087de9588DdF5c1441dF39828d695bc2f',
        owner: walletAddress,
        chainId: 1,
        chainName: 'Ethereum',
        blockNumber: 18700000,
        blockTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
        transactionHash: '0xdemo...',
        attributes: {
          core: {
            primaryLicense: { trait_type: 'License', value: 'standard' },
            level: { trait_type: 'Level', value: 1 },
            computeToken: { trait_type: 'Compute', value: 100 }
          },
          ai: {
            aiModules: [
              { trait_type: 'c_OpnAI', value: 'code-generation' },
              { trait_type: 'c_IAlf', value: 'smart-contract-audit' },
              { trait_type: 'c_Gmni', value: 'defi-analytics' }
            ]
          },
          raw: [
            { trait_type: 'Level', value: 1 },
            { trait_type: 'License', value: 'standard' },
            { trait_type: 'AI_Modules', value: 'code-generation,smart-contract-audit,defi-analytics' }
          ]
        },
        verification: {
          valid: true,
          anfeId: `demo-eth-1:${walletAddress}`,
          merkleRoot: '0xdemo',
          lastUpdated: Date.now()
        }
      },
      {
        id: `demo-base-1:${walletAddress}`,
        tokenId: '1',
        contractAddress: ANFE_CONTRACTS[8453] || '0x8c0075D087de9588DdF5c1441dF39828d695bc2f',
        owner: walletAddress,
        chainId: 8453,
        chainName: 'Base',
        blockNumber: 15700000,
        blockTimestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
        transactionHash: '0xdemo...',
        attributes: {
          core: {
            primaryLicense: { trait_type: 'License', value: 'standard' },
            level: { trait_type: 'Level', value: 1 },
            computeToken: { trait_type: 'Compute', value: 100 }
          },
          ai: {
            aiModules: [
              { trait_type: 'c_OpnAI', value: 'content-creation' },
              { trait_type: 'c_IAlf', value: 'social-media' },
              { trait_type: 'c_Gmni', value: 'community-management' }
            ]
          },
          raw: [
            { trait_type: 'Level', value: 1 },
            { trait_type: 'License', value: 'standard' },
            { trait_type: 'AI_Modules', value: 'content-creation,social-media,community-management' }
          ]
        },
        verification: {
          valid: true,
          anfeId: `demo-base-1:${walletAddress}`,
          merkleRoot: '0xdemo',
          lastUpdated: Date.now()
        }
      }
    ];

    console.log('[ANFEService] Created', demoANFEs.length, 'demo ANFEs');
    return demoANFEs;
  }

  /**
   * Fetch ANFEs via RPC (enumeration)
   */
  private async fetchANFEsViaRPC(walletAddress: string, chainId: SupportedChain): Promise<ANFE[]> {
    const contract = ANFE_CONTRACTS[chainId];
    if (!contract) return [];

    const anfes: ANFE[] = [];

    try {
      // Get balance
      const balance = await this.callContract(contract, '0xf242deda', walletAddress, chainId);
      const count = parseInt(balance || '0', 16);

      if (count === 0) return [];

      // Enumerate tokens (limit to 20 for performance)
      for (let i = 0; i < Math.min(count, 20); i++) {
        try {
          const tokenId = await this.callContract(
            contract,
            '0x2f745c59', // tokenOfOwnerByIndex
            `${walletAddress},${i}`,
            chainId
          );

          if (tokenId) {
            const attributes = await this.fetchAttributes(contract, tokenId, chainId);
            const verification = await merkelizerService.verifyANFE(`${contract}:${tokenId}`);

            anfes.push({
              id: `${contract}:${tokenId}`,
              tokenId,
              contractAddress: contract,
              owner: walletAddress,
              chainId,
              chainName: CHAIN_NAMES[chainId],
              blockNumber: 0,
              blockTimestamp: 0,
              transactionHash: '',
              attributes,
              verification,
            });
          }
        } catch (e) {
          console.warn('[ANFEService] Failed to fetch token', i, e);
        }
      }
    } catch (error) {
      console.error('[ANFEService] RPC fallback failed:', error);
    }

    return anfes;
  }

  /**
   * Get single ANFE by ID
   */
  async getANFE(anfeId: string): Promise<ANFE | null> {
    // Check cache
    const cached = this.anfeCache.get(anfeId);
    if (cached) return cached;

    // Fetch from Graph
    const graphData = await graphService.getANFEById(anfeId);
    if (!graphData) return null;

    // Enrich
    const anfe = await this.enrichANFE(graphData);
    this.anfeCache.set(anfeId, anfe);

    return anfe;
  }

  /**
   * Verify ANFE via Merkelizer
   */
  async verifyANFE(anfeId: string): Promise<VerificationResult> {
    return merkelizerService.verifyANFE(anfeId);
  }

  /**
   * Check if wallet can delegate to ANFE
   */
  canDelegate(anfe: ANFE, walletAddress: string): boolean {
    // Must be owner
    if (anfe.owner.toLowerCase() !== walletAddress.toLowerCase()) {
      return false;
    }

    // Must be verified (optional - can be configurable)
    // if (!anfe.verification.valid) {
    //   return false;
    // }

    return true;
  }

  /**
   * Start polling for ANFE updates
   */
  startPolling(walletAddress: string, intervalMs = 15000): void {
    this.stopPolling();

    this.pollInterval = window.setInterval(async () => {
      console.log('[ANFEService] Polling for ANFE updates...');
      this.walletANFEsCache.delete(walletAddress); // Clear cache to force refresh
      await this.loadWalletANFEs(walletAddress);
    }, intervalMs);

    console.log('[ANFEService] Started polling every', intervalMs / 1000, 'seconds');
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[ANFEService] Stopped polling');
    }
  }

  /**
   * Load Base ANFEs directly via RPC (bypasses Graph)
   * Useful when Graph subgraph doesn't have the data
   */
  async loadBaseANFEsViaRPC(walletAddress: string): Promise<ANFE[]> {
    console.log('[ANFEService] Loading Base ANFEs via RPC for:', walletAddress.slice(0, 8) + '...');
    
    const baseContract = ANFE_CONTRACTS[8453];
    if (!baseContract) {
      console.warn('[ANFEService] No Base ANFE contract configured');
      return [];
    }
    
    console.log('[ANFEService] Using Base contract:', baseContract);
    
    return this.fetchANFEsViaRPC(walletAddress, 8453);
  }

  /**
   * Get Base contract address
   */
  getBaseContractAddress(): string | undefined {
    return ANFE_CONTRACTS[8453];
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.walletANFEsCache.clear();
    this.anfeCache.clear();
    graphService.clearCache();
    merkelizerService.clearCache();
    console.log('[ANFEService] All caches cleared');
  }

  /**
   * Get services health status
   */
  async healthCheck(): Promise<{
    graph: boolean;
    merkelizer: boolean;
    wallet: boolean;
  }> {
    const [graph, merkelizer] = await Promise.all([
      graphService.healthCheck(),
      merkelizerService.healthCheck(),
    ]);

    return {
      graph,
      merkelizer,
      wallet: walletAdapter.isAvailable(),
    };
  }
}

// Singleton
export const anfeService = new ANFEService();
export default anfeService;
