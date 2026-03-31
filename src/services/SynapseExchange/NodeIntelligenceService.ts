// ============================================
// LAYER 8: NODE INTELLIGENCE SERVICE
// HyperCycle Subgraph + Merkelizer Integration
// ============================================

import type { NodeInfo, NodeType, SubgraphNode, UptimeReport } from './types';
import { HYPERCYCLE_CONFIG } from './hypercycleConfig';

// External API endpoints
const HYPERCYCLE_SUBGRAPH_URL = HYPERCYCLE_CONFIG.chains.ethereum.subgraph;
const BASE_SUBGRAPH_URL = HYPERCYCLE_CONFIG.chains.base.subgraph;
const MERKELIZER_URL = HYPERCYCLE_CONFIG.merkelizer.url;

// Node registry
const nodeRegistry = new Map<string, NodeInfo>();
const uptimeCache = new Map<string, UptimeReport>();

// Mock nodes for when APIs are unavailable
const MOCK_NODES: NodeInfo[] = [
  {
    nodeId: 'node_factory_001',
    owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f8eE1a',
    type: 'NodeFactory',
    licenses: ['lic_001', 'lic_002'],
    uptime: 0.98,
    reliabilityScore: 0.95,
    lastUpdated: Date.now()
  },
  {
    nodeId: 'node_factory_002',
    owner: '0x8Ba1f109551bD432803012645Hc136E7aF176bF',
    type: 'NodeFactory',
    licenses: ['lic_003', 'lic_004', 'lic_005'],
    uptime: 0.96,
    reliabilityScore: 0.92,
    lastUpdated: Date.now()
  },
  {
    nodeId: 'node_factory_003',
    owner: '0x123dE821D012645Hc136E7aF176bF8Ba1f109',
    type: 'NodeFactory',
    licenses: ['lic_006'],
    uptime: 0.99,
    reliabilityScore: 0.98,
    lastUpdated: Date.now()
  },
  {
    nodeId: 'anfe_001',
    owner: '0xABCdE821D012645Hc136E7aF176bF8Ba1f109',
    type: 'ANFE',
    licenses: ['lic_007'],
    uptime: 0.94,
    reliabilityScore: 0.88,
    lastUpdated: Date.now()
  },
  {
    nodeId: 'anfe_002',
    owner: '0xDEFdE821D012645Hc136E7aF176bF8Ba1f109',
    type: 'ANFE',
    licenses: ['lic_008', 'lic_009'],
    uptime: 0.97,
    reliabilityScore: 0.91,
    lastUpdated: Date.now()
  }
];

export class NodeIntelligenceService {
  private initialized = false;
  private subgraphAvailable = false;
  private merkelizerAvailable = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize with config nodes (Ethereum + Base)
    for (const factory of HYPERCYCLE_CONFIG.nodeFactories) {
      nodeRegistry.set(factory.nodeId, {
        nodeId: factory.nodeId,
        owner: factory.owner,
        type: factory.type as NodeType,
        licenses: [factory.licenseId],
        uptime: 0.95,
        reliabilityScore: 0.90,
        lastUpdated: Date.now()
      });
    }

    for (const anfe of HYPERCYCLE_CONFIG.anfeNodes) {
      nodeRegistry.set(anfe.nodeId, {
        nodeId: anfe.nodeId,
        owner: anfe.owner,
        type: anfe.type as NodeType,
        licenses: [anfe.licenseId],
        uptime: 0.97,
        reliabilityScore: 0.93,
        lastUpdated: Date.now()
      });
    }

    // Fallback to mock nodes if needed
    MOCK_NODES.forEach(node => {
      if (!nodeRegistry.has(node.nodeId)) {
        nodeRegistry.set(node.nodeId, node);
      }
    });

    // Try to connect to external APIs
    await this.checkSubgraphHealth();
    await this.checkMerkelizerHealth();

    // Fetch real node data if APIs available
    if (this.subgraphAvailable) {
      await this.fetchRealNodes();
    }

    this.initialized = true;
    console.log(`[NodeIntelligence] Initialized with ${nodeRegistry.size} nodes`);
    console.log(`[NodeIntelligence] Subgraph: ${this.subgraphAvailable ? 'available' : 'unavailable (using mock)'}`);
    console.log(`[NodeIntelligence] Merkelizer: ${this.merkelizerAvailable ? 'available' : 'unavailable (using mock)'}`);
  }

  // Fetch real nodes from HyperCycle subgraph
  private async fetchRealNodes(): Promise<void> {
    try {
      const query = `
        query GetNodes {
          nodeFactories(first: 10, orderBy: timestamp, orderDirection: desc) {
            id
            owner
            licenseCount
            totalUptime
          }
        }
      `;
      
      const response = await fetch(HYPERCYCLE_SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[NodeIntelligence] Fetched real nodes from subgraph:', data.data?.nodeFactories?.length || 0);
      }
    } catch (error) {
      console.log('[NodeIntelligence] Failed to fetch real nodes:', error);
    }
  }

  // Check HyperCycle subgraph health
  private async checkSubgraphHealth(): Promise<boolean> {
    try {
      const response = await fetch(HYPERCYCLE_SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        signal: AbortSignal.timeout(5000)
      });
      this.subgraphAvailable = response.ok;
      return this.subgraphAvailable;
    } catch (error) {
      console.log('[NodeIntelligence] Subgraph health check failed:', error);
      this.subgraphAvailable = false;
      return false;
    }
  }

  // Check Merkelizer health
  private async checkMerkelizerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${MERKELIZER_URL}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      this.merkelizerAvailable = response.ok;
      return this.merkelizerAvailable;
    } catch (error) {
      console.log('[NodeIntelligence] Merkelizer health check failed:', error);
      this.merkelizerAvailable = false;
      return false;
    }
  }

  // Query HyperCycle subgraph
  async querySubgraph(query: string): Promise<SubgraphNode[]> {
    if (!this.subgraphAvailable) {
      console.log('[NodeIntelligence] Subgraph unavailable, returning mock data');
      return this.getMockSubgraphData();
    }

    try {
      const response = await fetch(HYPERCYCLE_SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`Subgraph error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[NodeIntelligence] Queried subgraph successfully');
      return data.data?.nodes || [];
    } catch (error) {
      console.error('[NodeIntelligence] Subgraph query failed:', error);
      this.subgraphAvailable = false;
      return this.getMockSubgraphData();
    }
  }

  // Get uptime report from Merkelizer
  async getUptimeReport(licenseId: string): Promise<UptimeReport | null> {
    // Check cache first (5 min TTL)
    const cached = uptimeCache.get(licenseId);
    if (cached && Date.now() - cached.periodEnd < 300000) {
      return cached;
    }

    if (!this.merkelizerAvailable) {
      return this.getMockUptimeReport(licenseId);
    }

    try {
      const response = await fetch(`${MERKELIZER_URL}/uptime_report?license=${licenseId}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`Merkelizer error: ${response.status}`);
      }

      const report: UptimeReport = await response.json();
      uptimeCache.set(licenseId, report);
      console.log(`[NodeIntelligence] Retrieved uptime for ${licenseId}: ${report.uptime}`);
      return report;
    } catch (error) {
      console.error('[NodeIntelligence] Merkelizer query failed:', error);
      this.merkelizerAvailable = false;
      return this.getMockUptimeReport(licenseId);
    }
  }

  // Get all nodes
  getNodes(filters?: { type?: NodeType; minUptime?: number }): NodeInfo[] {
    let nodes = Array.from(nodeRegistry.values());

    if (filters?.type) {
      nodes = nodes.filter(n => n.type === filters.type);
    }
    if (filters?.minUptime) {
      nodes = nodes.filter(n => n.uptime >= filters.minUptime!);
    }

    return nodes.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  }

  // Get node by ID
  getNode(nodeId: string): NodeInfo | null {
    return nodeRegistry.get(nodeId) || null;
  }

  // Get node score
  getNodeScore(nodeId: string): { uptime: number; reliabilityScore: number } | null {
    const node = nodeRegistry.get(nodeId);
    if (!node) return null;
    return {
      uptime: node.uptime,
      reliabilityScore: node.reliabilityScore
    };
  }

  // Get reliable nodes (high uptime)
  getReliableNodes(minUptime: number = 0.95): NodeInfo[] {
    return this.getNodes({ minUptime });
  }

  // Update node data from external sources
  async refreshNodeData(): Promise<void> {
    // Query for node factories
    const nodeFactories = await this.querySubgraph(`
      query {
        nodeFactories(first: 10) {
          id
          owner
          licenses
          createdAt
        }
      }
    `);

    // Update registry
    nodeFactories.forEach((nf: SubgraphNode) => {
      const existing = nodeRegistry.get(nf.id);
      nodeRegistry.set(nf.id, {
        nodeId: nf.id,
        owner: nf.owner,
        type: 'NodeFactory',
        licenses: nf.licenses,
        uptime: existing?.uptime || 0.95,
        reliabilityScore: existing?.reliabilityScore || 0.9,
        lastUpdated: Date.now()
      });
    });

    // Update uptime from Merkelizer
    for (const node of nodeRegistry.values()) {
      for (const license of node.licenses) {
        const report = await this.getUptimeReport(license);
        if (report) {
          node.uptime = report.uptime;
          node.reliabilityScore = report.uptime;
          node.lastUpdated = Date.now();
        }
      }
    }

    console.log(`[NodeIntelligence] Refreshed data for ${nodeRegistry.size} nodes`);
  }

  // Register new node
  registerNode(node: NodeInfo): void {
    nodeRegistry.set(node.nodeId, node);
    console.log(`[NodeIntelligence] Registered node: ${node.nodeId}`);
  }

  // Get API status
  getStatus(): { subgraph: boolean; merkelizer: boolean; nodeCount: number } {
    return {
      subgraph: this.subgraphAvailable,
      merkelizer: this.merkelizerAvailable,
      nodeCount: nodeRegistry.size
    };
  }

  // Mock data helpers
  private getMockSubgraphData(): SubgraphNode[] {
    return MOCK_NODES.map(n => ({
      id: n.nodeId,
      owner: n.owner,
      nodeType: n.type,
      licenses: n.licenses,
      createdAt: Date.now() - 86400000 * 30
    }));
  }

  private getMockUptimeReport(licenseId: string): UptimeReport {
    // Generate consistent mock data based on license ID hash
    const hash = licenseId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const uptime = 0.90 + (hash % 10) / 100;

    return {
      licenseId,
      uptime: Math.round(uptime * 100) / 100,
      totalChecks: 1000,
      successfulChecks: Math.floor(1000 * uptime),
      periodStart: Date.now() - 86400000,
      periodEnd: Date.now()
    };
  }
}

export const nodeIntelligence = new NodeIntelligenceService();