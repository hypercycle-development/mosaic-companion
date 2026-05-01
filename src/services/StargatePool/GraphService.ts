// @ts-nocheck
// =============================================================================
// STARGATE POOL - Graph Service
// Primary data source: The Graph for ANFE queries
// =============================================================================

export interface GraphConfig {
  ethereum: string;
  base: string;
}

export interface ANFEGraphData {
  id: string;
  tokenId: string;
  contractAddress: string;
  owner: string;
  chainId: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
}

// Default config using environment variables
const DEFAULT_GRAPH_URLS: GraphConfig = {
  ethereum: import.meta.env.VITE_GRAPH_URL || 'https://api.studio.thegraph.com/query/90034/hypercycle-ethereum/version/latest',
  base: import.meta.env.VITE_GRAPH_URL_BASE || 'https://api.studio.thegraph.com/query/90034/hypercycle-base/version/latest'
};

class GraphService {
  private config: GraphConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 30000; // 30 seconds

  constructor(config?: Partial<GraphConfig>) {
    this.config = { ...DEFAULT_GRAPH_URLS, ...config };
    console.log('[GraphService] Initialized with config:', this.config);
  }

  /**
   * Get Graph URL for a chain
   */
  private getGraphUrl(chainId: string | number): string {
    const chain = parseInt(chainId.toString()) === 1 ? 'ethereum' : 'base';
    return this.config[chain] || this.config.ethereum;
  }

  /**
   * Query The Graph subgraph
   */
  async query<T>(query: string, chainId: string | number = 1): Promise<T | null> {
    const url = this.getGraphUrl(chainId);
    const cacheKey = `${chainId}:${query}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('[GraphService] Cache hit for query');
      return cached.data as T;
    }

    try {
      console.log('[GraphService] Querying:', url, 'Query:', query.substring(0, 100));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Graph query failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[GraphService] Raw result:', JSON.stringify(result).substring(0, 500));

      if (result.errors) {
        console.error('[GraphService] Graph errors:', result.errors);
        throw new Error(result.errors.map((e: any) => e.message).join(', '));
      }

      // Cache successful result
      this.cache.set(cacheKey, { data: result.data, timestamp: Date.now() });

      return result.data as T;
    } catch (error) {
      console.error('[GraphService] Query failed:', error);
      return null;
    }
  }

  /**
   * Fetch ANFEs owned by an address (multi-chain)
   */
  async getANFEsByOwner(ownerAddress: string): Promise<ANFEGraphData[]> {
    const allANFEs: ANFEGraphData[] = [];

    // Query Ethereum
    const ethQuery = `
      {
        anfes(where: { owner: "${ownerAddress.toLowerCase()}" }) {
          id
          tokenId
          contractAddress
          owner
          chainId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    // Query Base
    const baseQuery = `
      {
        anfes(where: { owner: "${ownerAddress.toLowerCase()}" }) {
          id
          tokenId
          contractAddress
          owner
          chainId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    try {
      // Execute both queries in parallel
      const [ethResult, baseResult] = await Promise.all([
        this.query<{ anfes: ANFEGraphData[] }>(ethQuery, 1),
        this.query<{ anfes: ANFEGraphData[] }>(baseQuery, 8453),
      ]);

      console.log('[GraphService] Eth query result:', JSON.stringify(ethResult).substring(0, 500));
      console.log('[GraphService] Base query result:', JSON.stringify(baseResult).substring(0, 500));
      console.log('[GraphService] Raw ethResult:', ethResult);
      console.log('[GraphService] Raw baseResult:', baseResult);

      if (ethResult?.anfes) {
        allANFEs.push(...ethResult.anfes);
      }
      if (baseResult?.anfes) {
        allANFEs.push(...baseResult.anfes);
      }

      console.log(`[GraphService] Found ${allANFEs.length} ANFEs for ${ownerAddress.slice(0, 8)}... (Eth: ${ethResult?.anfes?.length || 0}, Base: ${baseResult?.anfes?.length || 0})`);
    } catch (error) {
      console.error('[GraphService] Failed to fetch ANFEs:', error);
    }

    return allANFEs;
  }

  /**
   * Fetch all ANFEs (for marketplace/registry)
   */
  async getAllANFEs(limit = 100): Promise<ANFEGraphData[]> {
    const query = `
      {
        anfes(first: ${limit}, orderBy: blockTimestamp, orderDirection: desc) {
          id
          tokenId
          contractAddress
          owner
          chainId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    const result = await this.query<{ anfes: ANFEGraphData[] }>(query, 1);
    return result?.anfes || [];
  }

  /**
   * Fetch ANFE by ID
   */
  async getANFEById(anfeId: string): Promise<ANFEGraphData | null> {
    const query = `
      {
        anfe(id: "${anfeId.toLowerCase()}") {
          id
          tokenId
          contractAddress
          owner
          chainId
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    const result = await this.query<{ anfe: ANFEGraphData }>(query, 1);
    return result?.anfe || null;
  }

  /**
   * Get ANFE count for a wallet
   */
  async getANFECount(ownerAddress: string): Promise<number> {
    const query = `
      {
        anfes(where: { owner: "${ownerAddress.toLowerCase()}" }) {
          id
        }
      }
    `;

    const result = await this.query<{ anfes: any[] }>(query, 1);
    return result?.anfes?.length || 0;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[GraphService] Cache cleared');
  }

  /**
   * Check if Graph is available
   */
  async healthCheck(): Promise<boolean> {
    const query = `{ __schema { types { name } } }`;
    try {
      const result = await this.query<any>(query, 1);
      return result !== null;
    } catch {
      return false;
    }
  }
}

// Singleton
export const graphService = new GraphService();
export default graphService;
