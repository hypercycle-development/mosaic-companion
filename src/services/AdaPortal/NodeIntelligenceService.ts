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
    // Initialize demo compute nodes
    const demoNodes: ComputeNode[] = [
      {
        nodeId: 'node-hc-001',
        address: '0x7a...3f2e',
        uptime: 0.998,
        reliability: 0.995,
        availableCompute: 45,
        pricePerHour: 0.15,
        status: 'online',
        lastChecked: Date.now()
      },
      {
        nodeId: 'node-hc-002',
        address: '0x8b...4d3f',
        uptime: 0.992,
        reliability: 0.988,
        availableCompute: 30,
        pricePerHour: 0.12,
        status: 'online',
        lastChecked: Date.now()
      },
      {
        nodeId: 'node-hc-003',
        address: '0x9c...5e4g',
        uptime: 0.985,
        reliability: 0.980,
        availableCompute: 60,
        pricePerHour: 0.10,
        status: 'online',
        lastChecked: Date.now()
      },
      {
        nodeId: 'node-merkelizer-001',
        address: '0x1a...2b3c',
        uptime: 0.999,
        reliability: 0.997,
        availableCompute: 25,
        pricePerHour: 0.20,
        status: 'online',
        lastChecked: Date.now()
      },
      {
        nodeId: 'node-merkelizer-002',
        address: '0x2d...4e5f',
        uptime: 0.996,
        reliability: 0.992,
        availableCompute: 40,
        pricePerHour: 0.18,
        status: 'online',
        lastChecked: Date.now()
      },
      {
        nodeId: 'node-hc-004',
        address: '0x3e...5f6g',
        uptime: 0.890,
        reliability: 0.850,
        availableCompute: 10,
        pricePerHour: 0.08,
        status: 'busy',
        lastChecked: Date.now()
      }
    ];

    demoNodes.forEach(node => {
      this.nodes.set(node.nodeId, node);
      // Initialize metrics
      this.metrics.set(node.nodeId, {
        nodeId: node.nodeId,
        uptime: node.uptime,
        successRate: node.reliability,
        avgResponseTime: 150 + Math.random() * 200,
        totalTasks: Math.floor(Math.random() * 500) + 100
      });
    });

    console.log(`[AdaPortal] Initialized ${this.nodes.size} compute nodes`);
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