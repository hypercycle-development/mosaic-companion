// ============================================
// ADA PORTAL - Node Intelligence Service
// Layer 8: Compute node registry and tracking
// ============================================

import { ComputeNode, NodeMetrics } from './types';

class NodeIntelligenceService {
  private nodes: Map<string, ComputeNode> = new Map();
  private metrics: Map<string, NodeMetrics> = new Map();

  constructor() {
    this.initializeNodes();
    console.log('[AdaPortal] Node intelligence initialized');
  }

  private initializeNodes(): void {
    // NOTE: No demo / fake nodes seeded here.
    // Real nodes are loaded from:
    //   1. HyperInsight API (on-chain compute nodes)
    //   2. HyperAIBox appliances (local hardware)
    //   3. ANFE-backed node factories (ERC-721 / ERC-1155)
    // Demo data removed per user request — only verified on-chain data is displayed.
    console.log(`[AdaPortal] Node intelligence initialized (no demo nodes)`);
  }

  // Get all nodes
  getNodes(): ComputeNode[] {
    return Array.from(this.nodes.values());
  }

  // Get node by ID
  getNode(nodeId: string): ComputeNode | undefined {
    return this.nodes.get(nodeId);
  }

  // Get online nodes
  getOnlineNodes(): ComputeNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === 'online');
  }

  // Get nodes by type
  getNodesByType(type: string): ComputeNode[] {
    return Array.from(this.nodes.values()).filter(n => 
      n.nodeId.toLowerCase().includes(type.toLowerCase())
    );
  }

  // Get metrics for node
  getNodeMetrics(nodeId: string): NodeMetrics | undefined {
    return this.metrics.get(nodeId);
  }

  // Get best node based on criteria
  getBestNode(criteria?: {
    maxPrice?: number;
    minUptime?: number;
    minReliability?: number;
  }): ComputeNode | null {
    let candidates = this.getOnlineNodes();

    if (criteria?.maxPrice) {
      candidates = candidates.filter(n => n.pricePerHour <= criteria.maxPrice!);
    }
    if (criteria?.minUptime) {
      candidates = candidates.filter(n => n.uptime >= criteria.minUptime!);
    }
    if (criteria?.minReliability) {
      candidates = candidates.filter(n => n.reliability >= criteria.minReliability!);
    }

    // Sort by reliability * availability
    candidates.sort((a, b) => {
      const scoreA = a.reliability * a.availableCompute;
      const scoreB = b.reliability * b.availableCompute;
      return scoreB - scoreA;
    });

    return candidates[0] || null;
  }

  // Update node status
  updateNodeStatus(nodeId: string, status: ComputeNode['status']): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.lastChecked = Date.now();
    }
  }

  // Allocate compute to task
  allocateCompute(nodeId: string, hours: number): { allocated: boolean; cost: number } {
    const node = this.nodes.get(nodeId);
    if (!node || node.status !== 'online') {
      return { allocated: false, cost: 0 };
    }

    if (node.availableCompute < hours) {
      return { allocated: false, cost: 0 };
    }

    node.availableCompute -= hours;
    return { allocated: true, cost: hours * node.pricePerHour };
  }

  // Get node stats
  getStats(): {
    totalNodes: number;
    onlineNodes: number;
    busyNodes: number;
    offlineNodes: number;
    averageUptime: number;
    averageReliability: number;
  } {
    const nodes = Array.from(this.nodes.values());

    return {
      totalNodes: nodes.length,
      onlineNodes: nodes.filter(n => n.status === 'online').length,
      busyNodes: nodes.filter(n => n.status === 'busy').length,
      offlineNodes: nodes.filter(n => n.status === 'offline').length,
      averageUptime: nodes.reduce((sum, n) => sum + n.uptime, 0) / nodes.length,
      averageReliability: nodes.reduce((sum, n) => sum + n.reliability, 0) / nodes.length
    };
  }
}

export const nodeIntelligence = new NodeIntelligenceService();
export { NodeIntelligenceService };