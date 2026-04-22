// @ts-nocheck
// =============================================================================
// STARGATE POOL - Merkelizer Service
// ANFE verification via Merkelizer API
// =============================================================================

export interface VerificationResult {
  valid: boolean;
  anfeId: string;
  merkleRoot?: string;
  proof?: string;
  lastUpdated?: number;
  error?: string;
}

export interface NodeInfo {
  nodeId: string;
  address: string;
  uptime: number;
  status: 'online' | 'offline' | 'busy';
  lastVerified: number;
}

export interface UptimeInfo {
  totalNodes: number;
  onlineNodes: number;
  avgUptime: number;
}

// Merkelizer API response types
interface MerkelizerVerifyResponse {
  valid: boolean;
  anfeId: string;
  merkleRoot?: string;
  proof?: string;
}

interface MerkelizerNodesResponse {
  nodes: Array<{
    id: string;
    address: string;
    uptime: string;
    status: string;
    lastVerified: string;
  }>;
}

interface MerkelizerUptimeResponse {
  totalNodes: number;
  onlineNodes: number;
  avgUptime: number;
}

// Default config
const DEFAULT_MERKELIZER_URL = import.meta.env.VITE_MERKELIZER_URL_MAINNET || 'http://YOUR_HYPERCYCLE_NODE_IP:8003';

class MerkelizerService {
  private baseUrl: string;
  private cache: Map<string, { data: VerificationResult; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache for verifications

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DEFAULT_MERKELIZER_URL;
    console.log('[MerkelizerService] Initialized with baseUrl:', this.baseUrl);
  }

  /**
   * Verify an ANFE using Merkelizer
   */
  async verifyANFE(anfeId: string): Promise<VerificationResult> {
    const cacheKey = `verify:${anfeId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('[MerkelizerService] Cache hit for verification:', anfeId);
      return cached.data;
    }

    try {
      console.log('[MerkelizerService] Verifying ANFE:', anfeId);

      const response = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ anfeId }),
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`);
      }

      const result: VerificationResult = await response.json();
      
      // Add metadata
      result.lastUpdated = Date.now();
      result.anfeId = anfeId;

      // Cache result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      console.log('[MerkelizerService] Verification result:', result.valid ? 'VALID' : 'INVALID');
      return result;
    } catch (error) {
      console.error('[MerkelizerService] Verification error:', error);
      
      // Return unverified on error (graceful degradation)
      return {
        valid: false,
        anfeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Batch verify multiple ANFEs
   */
  async verifyANFEs(anfeIds: string[]): Promise<VerificationResult[]> {
    const results = await Promise.all(
      anfeIds.map(id => this.verifyANFE(id))
    );
    return results;
  }

  /**
   * Get all registered nodes from Merkelizer
   */
  async getNodes(): Promise<NodeInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/nodes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get nodes: ${response.status}`);
      }

      const data: MerkelizerNodesResponse = await response.json();

      return data.nodes.map(node => ({
        nodeId: node.id,
        address: node.address,
        uptime: parseFloat(node.uptime),
        status: node.status as 'online' | 'offline' | 'busy',
        lastVerified: parseInt(node.lastVerified) * 1000,
      }));
    } catch (error) {
      console.error('[MerkelizerService] Failed to get nodes:', error);
      return [];
    }
  }

  /**
   * Get Merkelizer uptime stats
   */
  async getUptime(): Promise<UptimeInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/uptime`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get uptime: ${response.status}`);
      }

      const data: MerkelizerUptimeResponse = await response.json();

      return {
        totalNodes: data.totalNodes,
        onlineNodes: data.onlineNodes,
        avgUptime: data.avgUptime,
      };
    } catch (error) {
      console.error('[MerkelizerService] Failed to get uptime:', error);
      return null;
    }
  }

  /**
   * Request compute from a node
   */
  async requestCompute(anfeId: string, nodeId: string, task: any): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          anfeId,
          nodeId,
          task,
        }),
      });

      if (!response.ok) {
        throw new Error(`Compute request failed: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, result };
    } catch (error) {
      console.error('[MerkelizerService] Compute request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if Merkelizer is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/uptime`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[MerkelizerService] Cache cleared');
  }

  /**
   * Get cached verification for an ANFE (without making API call)
   */
  getCachedVerification(anfeId: string): VerificationResult | null {
    const cached = this.cache.get(`verify:${anfeId}`);
    return cached?.data || null;
  }
}

// Singleton
export const merkelizerService = new MerkelizerService();
export default merkelizerService;
