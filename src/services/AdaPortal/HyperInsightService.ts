// ============================================
// ADA PORTAL - HyperInsight Integration Service
// Real AIM data from HyperInsight MCP + REST API
// ============================================

import {
  AIMInfo,
  AIMPerformance,
  ComputeNode,
  ComputeTier,
  ComputeTierInfo,
  UnifiedLeaderboardEntry,
  UnifiedLeaderboardSection,
  IntentOption,
  UserIntent,
  AutonomousTask,
  SubTask
} from './types';

// ============================================
// HYPERINSIGHT REST API CONFIGURATION
// ============================================
const HYPERINSIGHT_CONFIG = {
  partner: 'Mauricio-HPEC-DAO',
  tier: 'enterprise',
  apiKey: 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk',
  baseUrl: 'https://api.hyperinsight.app/',
  rateLimit: { rpm: 500, daily: 100000 }
};

// Type for HyperInsight API (augments existing window.electronAPI)
interface HyperInsightAPI {
  getStatus: () => Promise<{ registered: boolean; tier?: string; clientId?: string }>;
  ensureKey: () => Promise<{ success: boolean; clientId?: string; error?: string }>;
  resetKey: () => Promise<{ success: boolean; error?: string }>;
  getAims: () => Promise<any[]>;
  getLeaderboard: () => Promise<any[]>;
  getNodes: () => Promise<any[]>;
  getNetworkStats?: () => Promise<any>;
}

// ============================================
// REST API CLIENT
// ============================================
class HyperInsightAPIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = HYPERINSIGHT_CONFIG.apiKey;
    this.baseUrl = HYPERINSIGHT_CONFIG.baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Partner': HYPERINSIGHT_CONFIG.partner,
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`HyperInsight API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  // Get all AIMs (AI Models)
  async getAIMs(): Promise<any[]> {
    try {
      return await this.request<any[]>('v1/aims');
    } catch (e) {
      console.warn('[HyperInsight] Failed to fetch AIMs:', e);
      return [];
    }
  }

  // Get AIM leaderboard/rankings
  async getLeaderboard(category?: string): Promise<any[]> {
    try {
      const params = category ? `?category=${category}` : '';
      return await this.request<any[]>(`v1/leaderboard${params}`);
    } catch (e) {
      console.warn('[HyperInsight] Failed to fetch leaderboard:', e);
      return [];
    }
  }

  // Get compute nodes
  async getNodes(): Promise<any[]> {
    try {
      return await this.request<any[]>('v1/nodes');
    } catch (e) {
      console.warn('[HyperInsight] Failed to fetch nodes:', e);
      return [];
    }
  }

  // Get network stats
  async getNetworkStats(): Promise<any> {
    try {
      return await this.request<any>('v1/stats');
    } catch (e) {
      console.warn('[HyperInsight] Failed to fetch stats:', e);
      return null;
    }
  }

  // Check API status
  async getStatus(): Promise<{ connected: boolean; tier: string; aims: number }> {
    try {
      const aims = await this.getAIMs();
      return {
        connected: true,
        tier: HYPERINSIGHT_CONFIG.tier,
        aims: aims.length
      };
    } catch (e) {
      return {
        connected: false,
        tier: 'none',
        aims: 0
      };
    }
  }
}

// Singleton instance
const hyperInsightAPI = new HyperInsightAPIClient();

// Safe access to HyperInsight API
function getHyperInsightAPI(): HyperInsightAPI | undefined {
  return (window as any).electronAPI?.hyperinsight;
}

// Check if HyperInsight is connected
export async function checkHyperInsightConnection(): Promise<boolean> {
  try {
    const api = getHyperInsightAPI();
    if (!api) return false;
    
    const status = await api.getStatus();
    return status.registered === true;
  } catch (error) {
    console.error('[AdaPortal] Connection check failed:', error);
    return false;
  }
}

// Connect to HyperInsight (register client)
export async function connectToHyperInsight(): Promise<{ success: boolean; clientId?: string; error?: string }> {
  try {
    const api = getHyperInsightAPI();
    if (!api) {
      return { success: false, error: 'HyperInsight API not available' };
    }
    
    const result = await api.ensureKey();
    return result;
  } catch (error) {
    console.error('[AdaPortal] Connection failed:', error);
    return { success: false, error: String(error) };
  }
}

class HyperInsightService {
  private aims: AIMInfo[] = [];
  private nodes: Map<string, any> = new Map();
  private computeTiers: ComputeTierInfo[] = [];
  private isInitialized: boolean = false;
  private loadError: string | null = null;

  constructor() {
    this.initializeComputeTiers();
    console.log('[AdaPortal] HyperInsight Service initialized ( awaiting data )');
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
  // REAL DATA FETCHING FROM HYPERINSIGHT
  // Uses REST API with provided credentials
  // ============================================

  async fetchFromHyperInsight(): Promise<void> {
    try {
      // First try REST API with provided credentials
      const status = await hyperInsightAPI.getStatus();
      
      if (status.connected) {
        console.log('[AdaPortal] Connected to HyperInsight REST API:', status);
        
        // Fetch data from REST API
        const [aimsRaw, nodesRaw, leaderboardRaw] = await Promise.all<any>([
          hyperInsightAPI.getAIMs().catch(e => {
            console.error('[AdaPortal] Failed to fetch AIMs:', e);
            return [];
          }),
          hyperInsightAPI.getNodes().catch(e => {
            console.error('[AdaPortal] Failed to fetch nodes:', e);
            return [];
          }),
          hyperInsightAPI.getLeaderboard().catch(e => {
            console.error('[AdaPortal] Failed to fetch leaderboard:', e);
            return [];
          })
        ]);

        // Process AIMs from HyperInsight
        this.aims = this.processAIMs(aimsRaw);
        
        // Process Nodes from HyperInsight
        this.nodes.clear();
        nodesRaw.forEach((node: any) => {
          this.nodes.set(node.licenseKey, node);
        });

        this.isInitialized = true;
        this.loadError = null;
        
        console.log(`[AdaPortal] Loaded ${this.aims.length} AIMs and ${this.nodes.size} nodes from HyperInsight REST API`);
        return;
      }
      
      // Fallback: Try Electron MCP API
      const api = getHyperInsightAPI();
      if (!api) {
        console.warn('[AdaPortal] HyperInsight API not available');
        this.loadFallbackData();
        return;
      }

      // Fetch real data from HyperInsight MCP
      const [aimsRaw, nodesRaw, leaderboardRaw] = await Promise.all<any>([
        api.getAims().catch(e => {
          console.error('[AdaPortal] Failed to fetch AIMs:', e);
          return { error: e.message };
        }),
        api.getNodes().catch(e => {
          console.error('[AdaPortal] Failed to fetch nodes:', e);
          return { error: e.message };
        }),
        api.getLeaderboard().catch(e => {
          console.error('[AdaPortal] Failed to fetch leaderboard:', e);
          return { error: e.message };
        })
      ]);

      // Handle error wrapper responses from plugin
      const aims = aimsRaw && aimsRaw.error ? [] : (aimsRaw || []);
      const nodes = nodesRaw && nodesRaw.error ? [] : (nodesRaw || []);
      const leaderboard = leaderboardRaw && leaderboardRaw.error ? [] : (leaderboardRaw || []);

      if (aimsRaw?.error) console.error('[AdaPortal] AIMs error:', aimsRaw.error);
      if (nodesRaw?.error) console.error('[AdaPortal] Nodes error:', nodesRaw.error);
      if (leaderboardRaw?.error) console.error('[AdaPortal] Leaderboard error:', leaderboardRaw.error);

      // Process AIMs from HyperInsight
      this.aims = this.processAIMs(aims);
      
      // Process Nodes from HyperInsight
      this.nodes.clear();
      nodes.forEach((node: any) => {
        this.nodes.set(node.licenseKey, node);
      });

      this.isInitialized = true;
      this.loadError = null;
      
      console.log(`[AdaPortal] Loaded ${this.aims.length} AIMs and ${this.nodes.size} nodes from HyperInsight`);
      
    } catch (error) {
      console.error('[AdaPortal] Error fetching from HyperInsight:', error);
      this.loadError = 'Failed to load HyperInsight data';
      this.loadFallbackData();
    }
  }

  private processAIMs(aims: any[]): AIMInfo[] {
    // No fake data — only real AIMs from HyperInsight
    if (!Array.isArray(aims) || aims.length === 0) {
      console.warn('[AdaPortal] No AIMs from HyperInsight — empty state');
      return [];  // Return empty, not fake data
    }

    // Process all AIMs with extended fields from HyperInsight
    const processedAims = aims.map((aim, index) => {
      const activeNodes = aim.active_nodes || aim.activeNodes || aim.nodeCount || 0;
      
      return {
        name: aim.name || aim.aimName || `aim-${index}`,
        version: aim.version || null,
        description: aim.description || null,
        rank: aim.rank || aim.position || index + 1,
        activeNodes: activeNodes,
        computeTFLOPS: aim.compute_tflops || aim.computeTflops || aim.tflops || this.estimateTFLOPS(aim),
        cpuCores: aim.cpu || aim.cpuCores || 0,
        ramGB: aim.ram || aim.ramGB || 0,
        vramGB: aim.vram || aim.vramGB || 0,
        // Extended fields from HyperInsight
        origin: aim.origin || null,
        hypercycle_id: aim.hypercycle_id || aim.hypercycleId || null,
        license: aim.license || null,
        // Active if running on at least one node
        isActive: activeNodes > 0
      };
    });

    // Debug logging for verification
    const hypercycleAims = processedAims.filter(a => a.origin === 'hypercycle');
    const activeAims = processedAims.filter(a => a.isActive);
    
    console.log(`[AdaPortal] Raw AIM count: ${processedAims.length}`);
    console.log(`[AdaPortal] HyperCycle verified AIMs: ${hypercycleAims.length}`);
    console.log(`[AdaPortal] Active AIMs (with nodes): ${activeAims.length}`);
    
    // Log rejected AIMs for debugging
    if (processedAims.length !== hypercycleAims.length) {
      const rejected = processedAims
        .filter(a => a.origin !== 'hypercycle')
        .slice(0, 5)
        .map(a => ({ name: a.name, origin: a.origin || 'missing' }));
      console.log(`[AdaPortal] Rejected AIMs (first 5):`, JSON.stringify(rejected));
    }

    return processedAims
      .filter(a => a.origin === 'hypercycle')  // ONLY verified HyperCycle AIMs
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));
  }

  private estimateTFLOPS(node: any): number {
    const gpuCount = node.gpuCount || node.gpu_count || 0;
    const gpuName = node.gpuName?.toLowerCase() || node.gpu_name?.toLowerCase() || '';
    
    if (gpuName.includes('a100')) return gpuCount * 312;
    if (gpuName.includes('a10')) return gpuCount * 125;
    if (gpuName.includes('v100')) return gpuCount * 112;
    if (gpuName.includes('t4')) return gpuCount * 65;
    if (gpuName.includes('3090')) return gpuCount * 35;
    if (gpuName.includes('4090')) return gpuCount * 82;
    
    return gpuCount * 50;
  }

  private loadFallbackData(): void {
    // NO FAKE DATA — only real AIMs from HyperInsight
    // If HyperInsight is unavailable, show empty state to user
    this.aims = [];
    this.isInitialized = true;
    console.warn('[AdaPortal] No fallback data — HyperInsight unavailable');
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
    return [...this.aims]
      .filter(a => a.rank)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))
      .slice(0, count);
  }

  getAIMsByRank(minRank: number, maxRank: number): AIMInfo[] {
    return this.aims.filter(a => a.rank && a.rank >= minRank && a.rank <= maxRank);
  }

  selectBestAIMForRole(role: string): AIMInfo | undefined {
    // DYNAMIC selection based on real AIM data from HyperInsight
    // No hardcoded fallback names — select based on actual AIM properties
    
    // Role-based scoring weights for selection
    const roleWeights: Record<string, { compute: number; vram: number; nodes: number }> = {
      'developer': { compute: 0.6, vram: 0.3, nodes: 0.1 },    // High compute for coding
      'marketing': { compute: 0.3, vram: 0.2, nodes: 0.5 },    // Need available nodes
      'growth': { compute: 0.4, vram: 0.2, nodes: 0.4 },        // Balance
      'uiux': { compute: 0.3, vram: 0.6, nodes: 0.1 },         // High VRAM for images
      'data_analyst': { compute: 0.7, vram: 0.2, nodes: 0.1 }  // High compute for analysis
    };

    const weights = roleWeights[role] || { compute: 0.4, vram: 0.3, nodes: 0.3 };
    
    if (this.aims.length === 0) return undefined;

    // Normalize and score each AIM
    const maxCompute = Math.max(...this.aims.map(a => a.computeTFLOPS || 1));
    const maxVRAM = Math.max(...this.aims.map(a => a.vramGB || 1));
    const maxNodes = Math.max(...this.aims.map(a => a.activeNodes || 1));

    let bestAIM: AIMInfo | undefined;
    let bestScore = -1;

    for (const aim of this.aims) {
      const computeScore = maxCompute > 0 ? ((aim.computeTFLOPS || 0) / maxCompute) * weights.compute : 0;
      const vramScore = maxVRAM > 0 ? ((aim.vramGB || 0) / maxVRAM) * weights.vram : 0;
      const nodesScore = maxNodes > 0 ? ((aim.activeNodes || 0) / maxNodes) * weights.nodes : 0;
      const totalScore = computeScore + vramScore + nodesScore;

      if (totalScore > bestScore) {
        bestScore = totalScore;
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
      this.nodes.set(node.licenseKey, node);
    });
  }

  getNodes(): any[] {
    return Array.from(this.nodes.values());
  }

  getNodeByLicenseKey(licenseKey: string): any | undefined {
    return this.nodes.get(licenseKey);
  }

  getOnlineNodes(): any[] {
    return Array.from(this.nodes.values()).filter(n => n.isAlive);
  }

  getBestNodeForTier(tier: ComputeTier): any | null {
    const tierInfo = this.getComputeTier(tier);
    if (!tierInfo) return null;

    const candidates = this.getOnlineNodes().filter(n => {
      const tflops = this.estimateTFLOPS(n);
      return tflops >= tierInfo.minTFLOPS;
    });

    candidates.sort((a, b) => {
      const scoreA = (a.uptimePercent || 0) * (a.isAlive ? 1 : 0);
      const scoreB = (b.uptimePercent || 0) * (b.isAlive ? 1 : 0);
      return scoreB - scoreA;
    });

    return candidates[0] || null;
  }

  // ============================================
  // UNIFIED LEADERBOARD
  // ============================================

  getUnifiedLeaderboard(section?: UnifiedLeaderboardSection): UnifiedLeaderboardEntry[] {
    const entries: UnifiedLeaderboardEntry[] = [];

    // Nodes from HyperInsight
    if (!section || section === 'nodes') {
      const nodes = this.getOnlineNodes();
      nodes.forEach((node, index) => {
        entries.push({
          type: 'nodes',
          id: node.licenseKey,
          name: node.name || node.licenseKey?.slice(0, 8) || `Node-${index + 1}`,
          rank: index + 1,
          score: (node.uptimePercent || 0) * 100,
          uptime: node.uptimePercent,
          reliability: node.isAlive ? 0.99 : 0,
          availableCompute: this.estimateTFLOPS(node)
        });
      });
    }

    // AIMs from HyperInsight
    if (!section || section === 'aims') {
      this.aims.forEach(aim => {
        if (aim.rank) {
          entries.push({
            type: 'aims',
            id: aim.name,
            name: aim.name.split('/')[1] || aim.name,
            rank: aim.rank,
            score: (10 - aim.rank) * 10,
            activeNodes: aim.activeNodes,
            computeTFLOPS: aim.computeTFLOPS
          });
        }
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
        recommendedAims: [],  // Dynamically selected based on role weights
        computeTier: 'high_performance'
      },
      {
        intent: 'grow_dao',
        label: 'Grow My DAO',
        description: 'Expand community and governance',
        icon: '🌱',
        recommendedAgents: ['marketing', 'growth'],
        recommendedAims: [],  // Dynamically selected
        computeTier: 'standard'
      },
      {
        intent: 'build_dapp',
        label: 'Build a dApp',
        description: 'Develop and deploy decentralized applications',
        icon: '🔧',
        recommendedAgents: ['developer', 'uiux'],
        recommendedAims: [],  // Dynamically selected
        computeTier: 'dedicated'
      },
      {
        intent: 'automate_workflows',
        label: 'Automate Workflows',
        description: 'Set up automated processes and tasks',
        icon: '⚡',
        recommendedAgents: ['data_analyst', 'developer'],
        recommendedAims: [],  // Dynamically selected
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

    if (!option) {
      return { agents: [], aims: [], computeTier: 'standard' };
    }

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
    
    // Get recommended AIM
    const aim = params.role 
      ? this.selectBestAIMForRole(params.role) 
      : this.getTopAIMs(1)[0];
    
    // Get compute tier
    const compute = this.getComputeTier(config.computeTier)!;
    
    // Build reasoning
    const reasoningLines = [
      `Best ${params.role || 'overall'} agent for ${params.intent.replace('_', ' ')}`,
      `Top-ranked AIM: ${aim?.name.split('/')[1]} (#${aim?.rank}) with ${aim?.computeTFLOPS} TFLOPS`,
      `${compute.label} compute tier for optimal performance`
    ];

    // Estimate cost and time
    const cost = compute.maxPricePerHour * 1; // 1 hour baseline
    const time = params.intent === 'build_dapp' ? 5 : 2; // minutes

    return {
      agent: {
        id: params.agentId || 'recommended',
        name: params.agentName || config.agents[0] || 'Best Agent',
        rank: 1,
        successRate: 0.94
      },
      aim: aim || this.aims[0],
      compute,
      cost,
      time,
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
    activeAIMs: number;  // AIMs tracked by HyperInsight (running on nodes)
    activeNodes: number;
    totalComputeTFLOPS: number;
    averageUptime: number;
    dataSource: 'hyperinsight' | 'fallback';
  } {
    const nodes = this.getOnlineNodes();
    const totalTFLOPS = nodes.reduce((sum, n) => sum + this.estimateTFLOPS(n), 0);
    const avgUptime = nodes.length > 0
      ? nodes.reduce((sum, n) => sum + (n.uptimePercent || 0), 0) / nodes.length
      : 0;

    // Active AIMs = those tracked by HyperInsight (running on at least one node)
    const activeAIMs = this.aims.filter(a => (a.activeNodes || 0) > 0).length;

    return {
      totalAIMs: this.aims.length,
      activeAIMs: activeAIMs,
      activeNodes: nodes.length,
      totalComputeTFLOPS: totalTFLOPS,
      averageUptime: avgUptime,
      dataSource: this.loadError ? 'fallback' : 'hyperinsight'
    };
  }

  // Get all AIMs (including non-verified)
  getAllAIMs(): AIMInfo[] {
    // This would need to store unfiltered AIMs separately
    // For now, return filtered list
    return this.aims;
  }

  // Get active AIMs (running on nodes)
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