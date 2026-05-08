// =============================================================================
// UNIFIED LEADERBOARD SERVICE — Merge on-chain + off-chain rankings for Stargate
// =============================================================================
// Combines Merkelizer uptime, HyperInsight scores, local node telemetry, and
// skill completion into a single ranked leaderboard.
// =============================================================================

export interface UnifiedRankEntry {
  id: string;
  name: string;
  type: 'node' | 'aim' | 'agent' | 'skill' | 'anfe';
  chain?: 'ethereum' | 'base' | 'cardano' | 'local';
  rank: number;
  score: number; // 0-100 composite
  uptime: number;
  reliability: number;
  computeTFLOPS?: number;
  activeNodes?: number;
  lastUpdated: number;
  badge?: 'legendary' | 'epic' | 'rare' | 'common';
  metadata?: Record<string, any>;
}

interface RankSource {
  name: string;
  weight: number; // 0-1
  fetcher: () => Promise<UnifiedRankEntry[]>;
}

class UnifiedLeaderboardService {
  private cache: UnifiedRankEntry[] = [];
  private lastFetch = 0;
  private cacheTTL = 60000; // 1 minute
  private activePromise: Promise<UnifiedRankEntry[]> | null = null;

  // ---------------------------------------------------------------------------
  // Refresh with promise-gate to prevent stampede
  // ---------------------------------------------------------------------------
  async refresh(): Promise<UnifiedRankEntry[]> {
    if (Date.now() - this.lastFetch < this.cacheTTL) {
      return this.cache;
    }
    if (this.activePromise) {
      return this.activePromise;
    }
    this.activePromise = this._doRefresh();
    try {
      const result = await this.activePromise;
      return result;
    } finally {
      this.activePromise = null;
    }
  }

  private async _doRefresh(): Promise<UnifiedRankEntry[]> {
    const sources: RankSource[] = [
      { name: 'local', weight: 0.2, fetcher: () => this.fetchLocalRanks() },
      { name: 'hyperinsight', weight: 0.35, fetcher: () => this.fetchHyperInsightRanks() },
      { name: 'merkelizer', weight: 0.35, fetcher: () => this.fetchMerkelizerRanks() },
      { name: 'skills', weight: 0.1, fetcher: () => this.fetchSkillRanks() },
    ];

    const results = await Promise.all(
      sources.map(async (s) => {
        try {
          const entries = await s.fetcher();
          return { source: s, entries };
        } catch (e: any) {
          console.error(`[Leaderboard] ${s.name} failed:`, e.message);
          return { source: s, entries: [] };
        }
      })
    );

    // Merge by ID, averaging scores weighted by source
    const merged = new Map<string, UnifiedRankEntry>();
    for (const { source, entries } of results) {
      for (const e of entries) {
        const existing = merged.get(e.id);
        if (existing) {
          existing.score = (existing.score * existing.lastUpdated + e.score * source.weight) /
                           (existing.lastUpdated + source.weight);
          existing.uptime = Math.max(existing.uptime, e.uptime);
          existing.reliability = Math.max(existing.reliability, e.reliability);
          if (e.computeTFLOPS != null) existing.computeTFLOPS = Math.max(existing.computeTFLOPS || 0, e.computeTFLOPS);
          if (e.activeNodes != null) existing.activeNodes = Math.max(existing.activeNodes || 0, e.activeNodes);
        } else {
          merged.set(e.id, { ...e, score: e.score * source.weight });
        }
      }
    }

    const scored = Array.from(merged.values())
      .map((e) => ({ ...e, badge: this._assignBadge(e.score) }))
      .sort((a, b) => b.score - a.score);

    this.cache = scored.map((e, i) => ({ ...e, rank: i + 1 }));
    this.lastFetch = Date.now();
    return this.cache;
  }

  getCache(): UnifiedRankEntry[] {
    return this.cache;
  }

  getByType(type: UnifiedRankEntry['type']): UnifiedRankEntry[] {
    return this.cache.filter((e) => e.type === type);
  }

  getById(id: string): UnifiedRankEntry | undefined {
    return this.cache.find((e) => e.id === id);
  }

  // ---------------------------------------------------------------------------
  // Source fetchers
  // ---------------------------------------------------------------------------
  private async fetchLocalRanks(): Promise<UnifiedRankEntry[]> {
    // Import dynamically to avoid circular deps in browser
    const { localNodeBridge } = await import('./LocalNodeBridge');
    const info = localNodeBridge.getRawInfo();
    if (!info) return [];
    const compute = localNodeBridge.getLocalComputeNode();
    const anfe = localNodeBridge.getLocalANFE();
    const entries: UnifiedRankEntry[] = [];
    if (compute) {
      entries.push({
        id: `local-node:${compute.nodeId}`,
        name: compute.nodeName || 'Local Node',
        type: 'node',
        chain: 'local',
        rank: 0,
        score: (compute.uptime * 40) + (compute.reliability * 30) + (Math.min(compute.availableCompute || 0, 500) / 500 * 30),
        uptime: compute.uptime,
        reliability: compute.reliability,
        computeTFLOPS: compute.availableCompute,
        lastUpdated: Date.now(),
      });
    }
    if (anfe) {
      entries.push({
        id: anfe.id,
        name: anfe.name,
        type: 'anfe',
        chain: 'base',
        rank: 0,
        score: (anfe.verification.uptime * 50) + (anfe.verification.reliability * 50),
        uptime: anfe.verification.uptime,
        reliability: anfe.verification.reliability,
        lastUpdated: anfe.verification.lastUpdated,
        metadata: { license: anfe.license },
      });
    }
    return entries;
  }

  private async fetchHyperInsightRanks(): Promise<UnifiedRankEntry[]> {
    try {
      const api = (window as any).electronAPI?.hyperinsight;
      if (!api) return [];
      const [nodesRes, aimsRes] = await Promise.all([
        api.getNodes({ gpuOnly: 'true', onlineOnly: 'true', sortBy: 'computeTflops', pageSize: '50' }).catch(() => null),
        api.getLeaderboard().catch(() => null),
      ]);
      const entries: UnifiedRankEntry[] = [];
      // Nodes
      const nodesData = nodesRes?.data || [];
      for (const n of nodesData) {
        entries.push({
          id: `hi-node:${n.licenseKey || n.license || n.id}`,
          name: n.name || `Node ${(n.licenseKey || '').slice(0, 8)}`,
          type: 'node',
          chain: 'base',
          rank: 0,
          score: (n.compositeScore || n.composite_score || 0),
          uptime: n.measuredUptime7d || n.uptimePercent || 0,
          reliability: n.isAlive !== false ? 0.99 : 0,
          computeTFLOPS: n.computeTflops || n.computeTFLOPS || 0,
          lastUpdated: Date.now(),
        });
      }
      // AIMs
      const aimsData = Array.isArray(aimsRes) ? aimsRes : aimsRes?.data || [];
      for (const a of aimsData) {
        entries.push({
          id: `hi-aim:${a.aimId || a.name}`,
          name: a.aimName || a.name || 'Unknown AIM',
          type: 'aim',
          rank: 0,
          score: (a.bestLivenessScore || 0) + (a.activeNodes || 0) * 5,
          uptime: a.bestLivenessScore || 0,
          reliability: a.isVerified ? 0.95 : 0.6,
          activeNodes: a.activeNodes || 0,
          computeTFLOPS: a.computeTflops || 0,
          lastUpdated: Date.now(),
        });
      }
      return entries;
    } catch {
      return [];
    }
  }

  private async fetchMerkelizerRanks(): Promise<UnifiedRankEntry[]> {
    try {
      const { merkelizerService } = await import('../StargatePool/MerkelizerService');
      const cfg = (await import('../AdaPortal/hypercycleConfig')).default;
      const report = await merkelizerService.getUptimeReport(
        cfg.NEW_ANFE_CONTRACT_BASE,
        cfg.NEW_ANFE_CONTRACT_BASE
      );
      if (!report || report.error) return [];
      // In practice, Merkelizer returns per-ANFE data that we map
      return [
        {
          id: `merkle:${report.factoryId || 'local'}`,
          name: report.factoryId || 'Local ANFE',
          type: 'anfe',
          chain: 'base',
          rank: 0,
          score: (report.uptime || 0) * 50 + (report.reliability || 0) * 50,
          uptime: report.uptime || 0,
          reliability: report.reliability || 0,
          lastUpdated: Date.now(),
        },
      ];
    } catch {
      return [];
    }
  }

  private async fetchSkillRanks(): Promise<UnifiedRankEntry[]> {
    try {
      const { stargateSkillRegistry } = await import('../StargateSkillRegistry');
      const skills = stargateSkillRegistry.getInstalledSkills();
      return skills.map((s) => ({
        id: `skill:${s.id}`,
        name: s.name,
        type: 'skill',
        rank: 0,
        score: Math.min((s.usageCount || 0) * 2 + (s.endorsements || 0) * 5, 100),
        uptime: 1,
        reliability: 1,
        lastUpdated: s.lastUpdated || Date.now(),
        metadata: { provider: s.provider, category: s.category },
      }));
    } catch {
      return [];
    }
  }

  private _assignBadge(score: number): UnifiedRankEntry['badge'] {
    if (score >= 85) return 'legendary';
    if (score >= 70) return 'epic';
    if (score >= 50) return 'rare';
    return 'common';
  }
}

export const unifiedLeaderboardService = new UnifiedLeaderboardService();
export default UnifiedLeaderboardService;
