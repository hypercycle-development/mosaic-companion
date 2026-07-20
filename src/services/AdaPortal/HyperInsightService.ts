// ============================================
// ADA PORTAL - HyperInsight Integration Service
// Uses the Electron IPC bridge (NOT direct fetch)
// All calls go through window.electronAPI.hyperinsight.*
// ============================================

import {
  AIMInfo,
  ComputeTier,
  ComputeTierInfo,
  UnifiedLeaderboardEntry,
  UnifiedLeaderboardSection,
  IntentOption,
  UserIntent,
  AutonomousTask
} from './types';

// Safe access to the Electron IPC bridge
function getAPI(): any | undefined {
  return (window as any).electronAPI?.hyperinsight;
}

// Extract .data array/object from the HyperInsight API envelope
function unwrapData<T>(response: any): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data as T;
  }
  // Fallback: if no envelope, return as-is (for backward compat)
  return response as T;
}

// ============================================
// SERVICE CLASS
// ============================================
class HyperInsightService {
  private aims: AIMInfo[] = [];
  private nodes: Map<string, any> = new Map();
  private computeTiers: ComputeTierInfo[] = [];
  private isInitialized: boolean = false;
  private loadError: string | null = null;

  constructor() {
    this.initializeComputeTiers();
    console.log('[AdaPortal] HyperInsight Service initialized');
  }

  private initializeComputeTiers(): void {
    this.computeTiers = [
      {
        tier: 'standard',
        label: 'Standard',
        description: 'Balanced compute for everyday tasks',
        minTFLOPS: 50,
        maxPricePerHour: 0.15,
        features: ['Basic AI tasks', 'Standard response times', 'Shared resources']
      },
      {
        tier: 'high_performance',
        label: 'High Performance',
        description: 'Enhanced compute for complex operations',
        minTFLOPS: 100,
        maxPricePerHour: 0.35,
        features: ['Complex AI tasks', 'Fast response times', 'Priority queue', 'Dedicated memory']
      },
      {
        tier: 'dedicated',
        label: 'Dedicated',
        description: 'Full node resources for mission-critical work',
        minTFLOPS: 200,
        maxPricePerHour: 0.75,
        features: ['Maximum performance', 'Exclusive resources', 'SLA guarantee', '24/7 support']
      }
    ];
  }

  // ============================================
  // REAL DATA FETCHING FROM HYPERINSIGHT (IPC)
  // ============================================

  async fetchFromHyperInsight(): Promise<void> {
    const api = getAPI();
    if (!api) {
      this.loadError = 'HyperInsight IPC bridge not available — restart app';
      this.isInitialized = true;
      console.error('[AdaPortal]', this.loadError);
      return;
    }

    try {
      // Ensure key is registered (uses provided enterprise key)
      const ensure = await api.ensureKey();
      if (!ensure.success) {
        throw new Error(ensure.error || 'HyperInsight key registration failed');
      }
      console.log(`[AdaPortal] HyperInsight key ready (tier: ${ensure.tier || 'unknown'})`);

      // Parallel fetch: aims catalog, leaderboard, nodes, network status
      // NOTE: Using method names that match the IPC bridge in electron/preload.ts
      const [catalogRes, leaderboardRes, nodesRes, statusRes] = await Promise.all([
        api.getAims().catch((e: any) => ({ error: e.message })),
        api.getLeaderboard().catch((e: any) => ({ error: e.message })),
        api.getNodes({ gpuOnly: 'true', onlineOnly: 'true', sortBy: 'computeTflops', pageSize: '50' }).catch((e: any) => ({ error: e.message })),
        api.getNetworkStats().catch((e: any) => ({ error: e.message }))
      ]);

      if (catalogRes.error) console.error('[AdaPortal] Catalog error:', catalogRes.error);
      if (leaderboardRes.error) console.error('[AdaPortal] Leaderboard error:', leaderboardRes.error);
      if (nodesRes.error) console.error('[AdaPortal] Nodes error:', nodesRes.error);
      if (statusRes.error) console.error('[AdaPortal] Network status error:', statusRes.error);

      // Process AIMs from /aims catalog (results[]) or /aims/leaderboard (data[])
      const catalogData = unwrapData<{ results?: any[] }>(catalogRes);
      const catalogAims = Array.isArray(catalogData?.results) ? catalogData.results : [];

      const leaderboardData = unwrapData<any[]>(leaderboardRes);
      const leaderboardAims = Array.isArray(leaderboardData) ? leaderboardData : [];

      // Prefer catalog data; augment with leaderboard data
      this.aims = this.processAIMs(catalogAims, leaderboardAims);

      // Process Nodes
      const nodesData = unwrapData<any[]>(nodesRes);
      this.nodes.clear();
      (Array.isArray(nodesData) ? nodesData : []).forEach((node: any) => {
        this.nodes.set(String(node.licenseKey || node.license || node.id), node);
      });

      this.isInitialized = true;
      this.loadError = null;

      console.log(`[AdaPortal] Loaded ${this.aims.length} AIMs and ${this.nodes.size} nodes from HyperInsight`);

      // Log network summary if available
      const statusData = unwrapData<any>(statusRes);
      if (statusData) {
        console.log(`[AdaPortal] Network: ${statusData.activeNodes || '?'} active nodes, ${statusData.activeAims || '?'} active AIMs, pass rate ${statusData.healthProbePassRatePct || '?'}%`);
      }
    } catch (error: any) {
      console.error('[AdaPortal] Error fetching from HyperInsight:', error);
      this.loadError = error.message || 'Failed to load HyperInsight data';
      this.isInitialized = true;
    }
  }

  private processAIMs(discoverAims: any[], leaderboardAims: any[]): AIMInfo[] {
    const seen = new Set<string>();
    const output: AIMInfo[] = [];

    // 1) Process /discover results
    for (const aim of discoverAims) {
      const name = aim.aimName || aim.aim_name || aim.name || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);

      output.push({
        name,
        version: aim.manifestVersion || null,
        description: aim.description || null,
        rank: aim.rank || undefined,
        activeNodes: aim.activeNodeCount || aim.activeNodes || 0,
        computeTFLOPS: aim.computeTflops || 0,
        cpuCores: 0,
        ramGB: 0,
        vramGB: aim.estimatedVramGB || 0,
        origin: aim.sourceName || 'hypercycle',
        hypercycle_id: String(aim.aimId || ''),
        license: null,
        isActive: (aim.bestLivenessScore || 0) > 0,
        // Additional HyperInsight fields for UI
        bestLivenessScore: aim.bestLivenessScore || 0,
        bestEndpointUrl: aim.bestEndpointUrl || '',
        estimatedCostUsdc: aim.estimatedCostUsdc || null,
        manifestVersion: aim.manifestVersion || null
      });
    }

    // 2) Augment with leaderboard data (compute totals)
    for (const lb of leaderboardAims) {
      const name = lb.aimName || lb.name || '';
      if (!name) continue;
      const existing = output.find(a => a.name === name);
      if (existing) {
        existing.computeTFLOPS = lb.computeTflops || lb.totalComputeTflops || existing.computeTFLOPS;
        existing.activeNodes = lb.activeNodes || existing.activeNodes;
        existing.isActive = lb.isVerified || existing.isActive;
        existing.ramGB = lb.totalRamBytes ? Math.round(lb.totalRamBytes / 1073741824) : existing.ramGB;
        existing.vramGB = lb.totalVramBytes ? Math.round(lb.totalVramBytes / 1073741824) : existing.vramGB;
      } else if (!seen.has(name)) {
        seen.add(name);
        output.push({
          name,
          version: null,
          description: null,
          rank: lb.rank || undefined,
          activeNodes: lb.activeNodes || 0,
          computeTFLOPS: lb.computeTflops || lb.totalComputeTflops || 0,
          cpuCores: lb.totalCpu || 0,
          ramGB: lb.totalRamBytes ? Math.round(lb.totalRamBytes / 1073741824) : 0,
          vramGB: lb.totalVramBytes ? Math.round(lb.totalVramBytes / 1073741824) : 0,
          origin: 'hypercycle',
          hypercycle_id: String(lb.aimId || ''),
          license: null,
          isActive: lb.isVerified || false
        });
      }
    }

    return output.sort((a, b) => (b.activeNodes || 0) - (a.activeNodes || 0));
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  async refreshData(): Promise<void> {
    await this.fetchFromHyperInsight();
  }

  getAIMs(): AIMInfo[] {
    return this.aims;
  }

  getAIMByName(name: string): AIMInfo | undefined {
    return this.aims.find(a => a.name === name);
  }

  getTopAIMs(count: number = 10): AIMInfo[] {
    return this.aims.slice(0, count);
  }

  getAIMsByRank(minRank: number, maxRank: number): AIMInfo[] {
    return this.aims.filter(a => a.rank && a.rank >= minRank && a.rank <= maxRank);
  }

  selectBestAIMForRole(role: string): AIMInfo | undefined {
    const roleWeights: Record<string, { compute: number; vram: number; nodes: number }> = {
      'developer': { compute: 0.6, vram: 0.3, nodes: 0.1 },
      'marketing': { compute: 0.3, vram: 0.2, nodes: 0.5 },
      'growth': { compute: 0.4, vram: 0.2, nodes: 0.4 },
      'uiux': { compute: 0.3, vram: 0.6, nodes: 0.1 },
      'data_analyst': { compute: 0.7, vram: 0.2, nodes: 0.1 }
    };

    const weights = roleWeights[role] || { compute: 0.4, vram: 0.3, nodes: 0.3 };
    if (this.aims.length === 0) return undefined;

    const maxCompute = Math.max(...this.aims.map(a => a.computeTFLOPS || 1), 1);
    const maxVRAM = Math.max(...this.aims.map(a => a.vramGB || 1), 1);
    const maxNodes = Math.max(...this.aims.map(a => a.activeNodes || 1), 1);

    let bestAIM: AIMInfo | undefined;
    let bestScore = -1;

    for (const aim of this.aims) {
      const cs = maxCompute > 0 ? ((aim.computeTFLOPS || 0) / maxCompute) * weights.compute : 0;
      const vs = maxVRAM > 0 ? ((aim.vramGB || 0) / maxVRAM) * weights.vram : 0;
      const ns = maxNodes > 0 ? ((aim.activeNodes || 0) / maxNodes) * weights.nodes : 0;
      const total = cs + vs + ns;
      if (total > bestScore) {
        bestScore = total;
        bestAIM = aim;
      }
    }
    return bestAIM;
  }

  // ============================================
  // COMPUTE TIER METHODS
  // ============================================

  getComputeTiers(): ComputeTierInfo[] {
    return this.computeTiers;
  }

  getComputeTier(tier: ComputeTier): ComputeTierInfo | undefined {
    return this.computeTiers.find(t => t.tier === tier);
  }

  getRecommendedTierForIntent(intent: UserIntent): ComputeTier {
    switch (intent) {
      case 'build_dapp':
      case 'launch_project':
        return 'high_performance';
      case 'automate_workflows':
        return 'standard';
      case 'grow_dao':
        return 'high_performance';
      default:
        return 'standard';
    }
  }

  // ============================================
  // NODE METHODS
  // ============================================

  setNodes(nodes: any[]): void {
    this.nodes.clear();
    nodes.forEach(node => {
      this.nodes.set(String(node.licenseKey || node.license || node.id), node);
    });
  }

  getNodes(): any[] {
    return Array.from(this.nodes.values());
  }

  getNodeByLicenseKey(licenseKey: string): any | undefined {
    return this.nodes.get(licenseKey);
  }

  getOnlineNodes(): any[] {
    return Array.from(this.nodes.values()).filter(n => n.isAlive !== false);
  }

  getBestNodeForTier(tier: ComputeTier): any | null {
    const tierInfo = this.getComputeTier(tier);
    if (!tierInfo) return null;

    const candidates = this.getOnlineNodes().filter(n => {
      const tflops = n.computeTflops || n.computeTFLOPS || 0;
      return tflops >= tierInfo.minTFLOPS;
    });

    candidates.sort((a, b) => {
      const scoreA = (a.uptimePercent || a.measuredUptime7d || 0) * (a.isAlive !== false ? 1 : 0);
      const scoreB = (b.uptimePercent || b.measuredUptime7d || 0) * (b.isAlive !== false ? 1 : 0);
      return scoreB - scoreA;
    });

    return candidates[0] || null;
  }

  // ============================================
  // UNIFIED LEADERBOARD
  // ============================================

  getUnifiedLeaderboard(section?: UnifiedLeaderboardSection): UnifiedLeaderboardEntry[] {
    const entries: UnifiedLeaderboardEntry[] = [];

    if (!section || section === 'nodes') {
      const nodes = this.getOnlineNodes();
      nodes.forEach((node, index) => {
        entries.push({
          type: 'nodes',
          id: String(node.licenseKey || node.license || index),
          name: node.name || String(node.licenseKey || '').slice(0, 8) || `Node-${index + 1}`,
          rank: index + 1,
          score: (node.compositeScore || node.composite_score || 0),
          uptime: node.measuredUptime7d || node.uptimePercent || 0,
          reliability: node.isAlive !== false ? 0.99 : 0,
          availableCompute: node.computeTflops || node.computeTFLOPS || 0
        });
      });
    }

    if (!section || section === 'aims') {
      this.aims.forEach((aim, index) => {
        entries.push({
          type: 'aims',
          id: aim.name,
          name: aim.name.split('/')[1] || aim.name,
          rank: index + 1,
          score: (aim.bestLivenessScore as number) || (aim.activeNodes || 0) * 10,
          activeNodes: aim.activeNodes,
          computeTFLOPS: aim.computeTFLOPS
        });
      });
    }

    return entries.sort((a, b) => b.score - a.score);
  }

  // ============================================
  // INTENT-BASED ENTRY
  // ============================================

  getIntentOptions(): IntentOption[] {
    return [
      {
        intent: 'launch_project',
        label: 'Launch a Project',
        description: 'Start a new blockchain project or dApp',
        icon: '🚀',
        recommendedAgents: ['developer', 'uiux'],
        recommendedAims: [],
        computeTier: 'high_performance'
      },
      {
        intent: 'grow_dao',
        label: 'Grow My DAO',
        description: 'Expand community and governance',
        icon: '🌱',
        recommendedAgents: ['marketing', 'growth'],
        recommendedAims: [],
        computeTier: 'standard'
      },
      {
        intent: 'build_dapp',
        label: 'Build a dApp',
        description: 'Develop and deploy decentralized applications',
        icon: '🔧',
        recommendedAgents: ['developer', 'uiux'],
        recommendedAims: [],
        computeTier: 'dedicated'
      },
      {
        intent: 'automate_workflows',
        label: 'Automate Workflows',
        description: 'Set up automated processes and tasks',
        icon: '⚡',
        recommendedAgents: ['data_analyst', 'developer'],
        recommendedAims: [],
        computeTier: 'standard'
      }
    ];
  }

  getRecommendedConfigForIntent(intent: UserIntent): {
    agents: string[];
    aims: string[];
    computeTier: ComputeTier;
  } {
    const options = this.getIntentOptions();
    const option = options.find(o => o.intent === intent);
    if (!option) return { agents: [], aims: [], computeTier: 'standard' };
    return {
      agents: option.recommendedAgents,
      aims: option.recommendedAims || [],
      computeTier: option.computeTier || 'standard'
    };
  }

  // ============================================
  // EXECUTION PLAN LAYER
  // ============================================

  buildExecutionPlan(params: {
    intent: UserIntent;
    agentId?: string;
    agentName?: string;
    role?: string;
  }): {
    agent: { id: string; name: string; rank: number; successRate: number };
    aim: AIMInfo;
    compute: ComputeTierInfo;
    cost: number;
    time: number;
    reasoning: string;
  } {
    const config = this.getRecommendedConfigForIntent(params.intent);
    const aim = params.role
      ? this.selectBestAIMForRole(params.role)
      : this.getTopAIMs(1)[0];
    const compute = this.getComputeTier(config.computeTier)!;

    const reasoningLines = [
      `Best ${params.role || 'overall'} agent for ${params.intent.replace('_', ' ')}`,
      `Top AIM: ${aim?.name.split('/')[1] || aim?.name || 'unknown'} with ${aim?.computeTFLOPS || 0} TFLOPS`,
      `${compute.label} compute tier for optimal performance`
    ];

    return {
      agent: {
        id: params.agentId || 'recommended',
        name: params.agentName || config.agents[0] || 'Best Agent',
        rank: 1,
        successRate: 0.94
      },
      aim: aim || this.aims[0],
      compute,
      cost: compute.maxPricePerHour * 1,
      time: params.intent === 'build_dapp' ? 5 : 2,
      reasoning: reasoningLines.join('\n• ')
    };
  }

  // ============================================
  // AUTONOMOUS EXECUTION
  // ============================================

  createAutonomousTask(description: string): AutonomousTask {
    return {
      taskId: `auto-${Date.now()}`,
      description,
      status: 'planning',
      subtasks: [],
      progress: 0,
      createdAt: Date.now()
    };
  }

  // ============================================
  // STATS
  // ============================================

  getStats(): {
    totalAIMs: number;
    activeAIMs: number;
    activeNodes: number;
    totalComputeTFLOPS: number;
    averageUptime: number;
    dataSource: 'hyperinsight' | 'fallback';
  } {
    const nodes = this.getOnlineNodes();
    const totalTFLOPS = nodes.reduce((sum, n) => sum + (n.computeTflops || n.computeTFLOPS || 0), 0);
    const avgUptime = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + (n.measuredUptime7d || n.uptimePercent || 0), 0) / nodes.length
      : 0;
    const activeAIMs = this.aims.filter(a => (a.activeNodes || 0) > 0).length;

    return {
      totalAIMs: this.aims.length,
      activeAIMs,
      activeNodes: nodes.length,
      totalComputeTFLOPS: totalTFLOPS,
      averageUptime: avgUptime,
      dataSource: this.loadError ? 'fallback' : 'hyperinsight'
    };
  }

  getAllAIMs(): AIMInfo[] {
    return this.aims;
  }

  getActiveAIMs(): AIMInfo[] {
    return this.aims.filter(a => (a.activeNodes || 0) > 0);
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getLoadError(): string | null {
    return this.loadError;
  }
}

export const hyperInsight = new HyperInsightService();
export { HyperInsightService };
