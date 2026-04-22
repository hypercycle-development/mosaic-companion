/**
 * HyperInsight ↔ Stargate Bridge Service
 * 
 * Integrates HyperInsight network data with Stargate Pool factories:
 * - Queries verified AIMs from HyperInsight API
 * - Maps verified AIMs to NodeFactories
 * - Shows reputation scores on factory cards
 * - Enriches ANFE metadata with network stats
 */

import { ipcRenderer } from 'electron';

// Types
export interface HyperInsightAIM {
  name: string;
  version: string;
  owner: string;
  license: string;
  status: 'active' | 'inactive';
  total_requests: number;
  avg_response_time: number;
  uptime_percent: number;
  created_at: string;
}

export interface HyperInsightNode {
  node_id: string;
  license: string;
  address: string;
  status: string;
  aims: string[];
  uptime_percent: number;
  total_requests: number;
}

export interface HyperInsightLeaderboardEntry {
  rank: number;
  license: string;
  owner: string;
  total_requests: number;
  uptime_percent: number;
  aims_count: number;
}

export interface HyperInsightStats {
  total_aims: number;
  total_nodes: number;
  total_requests: number;
  avg_uptime: number;
}

export interface VerifiedFactory {
  factory_id: string;
  factory_name: string;
  verified: boolean;
  reputation_score: number;
  linked_aims: string[];
  node_info?: HyperInsightNode;
  leaderboard_rank?: number;
}

export interface BridgeConfig {
  enableVerification: boolean;
  cacheTimeoutMs: number;
  minReputationScore: number;
}

const DEFAULT_CONFIG: BridgeConfig = {
  enableVerification: true,
  cacheTimeoutMs: 300000, // 5 minutes
  minReputationScore: 50,
};

class HyperInsightStargateBridge {
  private config: BridgeConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  
  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if HyperInsight API is available and licensed
   */
  async checkStatus(): Promise<{ available: boolean; registered: boolean; license?: string }> {
    try {
      const status = await ipcRenderer.invoke('hyperinsight:get-status');
      return {
        available: true,
        registered: status.registered || false,
        license: status.license,
      };
    } catch (e) {
      return { available: false, registered: false };
    }
  }

  /**
   * Get cached data or fetch fresh
   */
  private async getCachedOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.config.cacheTimeoutMs) {
      return cached.data as T;
    }
    
    const data = await fetchFn();
    this.cache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Fetch all verified AIMs from HyperInsight
   */
  async getVerifiedAIMs(): Promise<HyperInsightAIM[]> {
    return this.getCachedOrFetch('aims', async () => {
      try {
        const aims = await ipcRenderer.invoke('hyperinsight:get-aims');
        return aims?.aims || [];
      } catch (e) {
        console.error('[Bridge] Failed to fetch AIMs:', e);
        return [];
      }
    });
  }

  /**
   * Fetch all nodes from HyperInsight
   */
  async getNodes(params?: { status?: string; limit?: number }): Promise<HyperInsightNode[]> {
    return this.getCachedOrFetch(`nodes:${JSON.stringify(params)}`, async () => {
      try {
        const nodes = await ipcRenderer.invoke('hyperinsight:get-nodes', params);
        return nodes?.nodes || [];
      } catch (e) {
        console.error('[Bridge] Failed to fetch nodes:', e);
        return [];
      }
    });
  }

  /**
   * Fetch leaderboard
   */
  async getLeaderboard(limit: number = 100): Promise<HyperInsightLeaderboardEntry[]> {
    return this.getCachedOrFetch(`leaderboard:${limit}`, async () => {
      try {
        const lb = await ipcRenderer.invoke('hyperinsight:get-leaderboard');
        return (lb?.leaderboard || []).slice(0, limit);
      } catch (e) {
        console.error('[Bridge] Failed to fetch leaderboard:', e);
        return [];
      }
    });
  }

  /**
   * Fetch network stats
   */
  async getNetworkStats(): Promise<HyperInsightStats | null> {
    return this.getCachedOrFetch('stats', async () => {
      try {
        const stats = await ipcRenderer.invoke('hyperinsight:get-network-stats');
        if (stats) {
          return {
            total_aims: stats.total_aims || 0,
            total_nodes: stats.total_nodes || 0,
            total_requests: stats.total_requests || 0,
            avg_uptime: stats.avg_uptime || 0,
          };
        }
        return null;
      } catch (e) {
        console.error('[Bridge] Failed to fetch network stats:', e);
        return null;
      }
    });
  }

  /**
   * Calculate reputation score for a factory based on linked AIMs
   */
  calculateReputationScore(aims: HyperInsightAIM[]): number {
    if (!aims.length) return 0;
    
    const totalRequests = aims.reduce((sum, a) => sum + (a.total_requests || 0), 0);
    const avgUptime = aims.reduce((sum, a) => sum + (a.uptime_percent || 0), 0) / aims.length;
    const avgResponseTime = aims.reduce((sum, a) => sum + (a.avg_response_time || 0), 0) / aims.length;
    
    // Scoring algorithm:
    // - Requests: 0-40 points (log scale)
    // - Uptime: 0-30 points
    // - Response time: 0-30 points (faster = more points)
    const requestScore = Math.min(40, Math.log10(totalRequests + 1) * 10);
    const uptimeScore = (avgUptime / 100) * 30;
    const responseScore = Math.max(0, 30 - (avgResponseTime / 100));
    
    return Math.round(requestScore + uptimeScore + responseScore);
  }

  /**
   * Get leaderboard rank for a license
   */
  async getLeaderboardRank(license: string): Promise<number | null> {
    const leaderboard = await this.getLeaderboard(1000);
    const entry = leaderboard.find(e => e.license === license);
    return entry?.rank || null;
  }

  /**
   * Verify a factory against HyperInsight data
   */
  async verifyFactory(
    factoryId: string,
    factoryName: string,
    linkedAIMNames: string[]
  ): Promise<VerifiedFactory> {
    const verifiedAIMs = await this.getVerifiedAIMs();
    const nodes = await this.getNodes();
    const leaderboard = await this.getLeaderboard();
    
    // Find matching AIMs
    const matchedAIMs = verifiedAIMs.filter(aim => 
      linkedAIMNames.some(name => aim.name.toLowerCase().includes(name.toLowerCase()))
    );
    
    // Find node info
    const nodeInfo = nodes.find(n => 
      n.aims?.some(a => linkedAIMNames.some(name => a.toLowerCase().includes(name.toLowerCase())))
    );
    
    // Calculate reputation
    const reputationScore = this.calculateReputationScore(matchedAIMs);
    
    // Get leaderboard rank if we have a license
    let leaderboardRank: number | undefined;
    if (nodeInfo?.license) {
      const rank = await this.getLeaderboardRank(nodeInfo.license);
      if (rank) leaderboardRank = rank;
    }
    
    return {
      factory_id: factoryId,
      factory_name: factoryName,
      verified: reputationScore >= this.config.minReputationScore,
      reputation_score: reputationScore,
      linked_aims: matchedAIMs.map(a => a.name),
      node_info: nodeInfo,
      leaderboard_rank: leaderboardRank,
    };
  }

  /**
   * Get all factories with verification data (for batch processing)
   */
  async enrichFactories(
    factories: Array<{ factory_id: string; name: string; skills_supported?: string[] }>
  ): Promise<VerifiedFactory[]> {
    const results: VerifiedFactory[] = [];
    
    for (const factory of factories) {
      const verified = await this.verifyFactory(
        factory.factory_id,
        factory.name,
        factory.skills_supported || []
      );
      results.push(verified);
    }
    
    return results;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton
export const hyperInsightBridge = new HyperInsightStargateBridge();