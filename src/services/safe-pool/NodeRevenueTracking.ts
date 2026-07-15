/**
 * SAFE Rev Pool — Node Revenue Tracking System
 * Implements Desire Munga's node revenue sharing model
 * 
 * Every transaction:
 * - Driver: 96.5%
 * - Platform: 1.5%
 * - Node Operator: 1.5%
 * - Tiller: 0.5%
 */

export interface TransactionRecord {
  id: string;                    // TX-001, etc.
  timestamp: Date;
  loadId: string;
  
  // Financial
  loadValue: number;             // Total shipper payment
  currency: 'GBP' | 'USDC';
  
  // Revenue Distribution
  distribution: {
    driver: {
      amount: number;            // 96.5%
      walletAddress: string;
      paidAt: Date;
    };
    platform: {
      amount: number;            // 1.5%
      walletAddress: string;
      paidAt: Date;
    };
    nodeOperator: {
      amount: number;            // 1.5%
      walletAddress: string;
      nodeId: string;            // Which node processed
      paidAt: Date;
    };
    tiller: {
      amount: number;            // 0.5%
      walletAddress: string;
      paidAt: Date;
    };
  };
  
  // Node Intelligence
  nodeIntelligence: {
    nodeId: string;              // C-3PO, C-3PO-B, etc.
    matchingScore: number;         // How well the match scored
    negotiationRounds: number;     // A2A rounds used
    settlementTime: number;       // Seconds to settle
    routeEfficiency: number;       // vs optimal route
  };
  
  // Smart Contract
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
}

// Revenue Configuration
export const REVENUE_SHARES = {
  driver: 0.965,        // 96.5%
  platform: 0.015,    // 1.5%
  nodeOperator: 0.015,  // 1.5%
  tiller: 0.005,        // 0.5%
} as const;

// Calculate revenue split
export function calculateRevenueSplit(loadValue: number): {
  driver: number;
  platform: number;
  nodeOperator: number;
  tiller: number;
} {
  return {
    driver: Math.floor(loadValue * REVENUE_SHARES.driver * 100) / 100,
    platform: Math.floor(loadValue * REVENUE_SHARES.platform * 100) / 100,
    nodeOperator: Math.floor(loadValue * REVENUE_SHARES.nodeOperator * 100) / 100,
    tiller: Math.floor(loadValue * REVENUE_SHARES.tiller * 100) / 100,
  };
}

// Node Intelligence Accumulator
export interface NodeIntelligence {
  nodeId: string;
  totalTransactions: number;
  totalRevenue: number;
  totalLoadsMatched: number;
  
  // Pattern Learning
  successfulRoutes: Map<string, number>;      // route -> count
  optimalPrices: Map<string, { min: number; max: number; avg: number }>; // route -> price range
  driverPreferences: Map<string, string[]>; // driverId -> preferred routes
  shipperPatterns: Map<string, { frequency: number; avgLoadValue: number }>; // shipperId -> pattern
  
  // Performance Metrics
  avgMatchTime: number;        // seconds
  avgNegotiationRounds: number;
  settlementSuccessRate: number;
  driverRetentionRate: number;
  
  // Intelligence Score (0-100)
  intelligenceScore: number;
}

// Factory spawning logic
export interface NodeFactory {
  parentNodeId: string;
  spawnThreshold: {
    capacityPercent: number;     // Spawn when >70% capacity
    minTransactions: number;       // Min 500 transactions
    minRevenue: number;           // Min £5,000 revenue
    intelligenceScore: number;    // Min 70 intelligence
  };
  
  // Spawned nodes inherit from parent
  inheritance: {
    config: boolean;              // Copy config
    patterns: boolean;            // Copy learned patterns
    reputation: boolean;          // Copy reputation (with decay)
    franchiseFee: number;          // 0.25% to parent
  };
}

// Check if node should spawn child
export function shouldSpawnChildNode(
  node: NodeIntelligence,
  factory: NodeFactory
): { shouldSpawn: boolean; reason?: string } {
  const checks = [
    { 
      pass: node.totalTransactions >= factory.spawnThreshold.minTransactions,
      msg: `Transactions: ${node.totalTransactions}/${factory.spawnThreshold.minTransactions}` 
    },
    { 
      pass: node.totalRevenue >= factory.spawnThreshold.minRevenue,
      msg: `Revenue: £${node.totalRevenue}/£${factory.spawnThreshold.minRevenue}` 
    },
    { 
      pass: node.intelligenceScore >= factory.spawnThreshold.intelligenceScore,
      msg: `Intelligence: ${node.intelligenceScore}/${factory.spawnThreshold.intelligenceScore}` 
    },
  ];
  
  const failed = checks.filter(c => !c.pass);
  
  if (failed.length === 0) {
    return { shouldSpawn: true };
  }
  
  return {
    shouldSpawn: false,
    reason: `Thresholds not met: ${failed.map(f => f.msg).join(', ')}`
  };
}

// Revenue tracking storage
export class NodeRevenueTracker {
  private transactions: TransactionRecord[] = [];
  private nodes: Map<string, NodeIntelligence> = new Map();
  
  // Record new transaction
  recordTransaction(tx: TransactionRecord): void {
    this.transactions.push(tx);
    this.updateNodeIntelligence(tx);
  }
  
  // Update node intelligence from transaction
  private updateNodeIntelligence(tx: TransactionRecord): void {
    const nodeId = tx.nodeIntelligence.nodeId;
    let node = this.nodes.get(nodeId);
    
    if (!node) {
      node = this.createInitialNodeIntelligence(nodeId);
      this.nodes.set(nodeId, node);
    }
    
    // Update stats
    node.totalTransactions++;
    node.totalRevenue += tx.distribution.nodeOperator.amount;
    node.totalLoadsMatched++;
    
    // Update running averages
    const n = node.totalTransactions;
    node.avgMatchTime = (node.avgMatchTime * (n - 1) + tx.nodeIntelligence.settlementTime) / n;
    node.avgNegotiationRounds = (node.avgNegotiationRounds * (n - 1) + tx.nodeIntelligence.negotiationRounds) / n;
    
    // Update intelligence score
    node.intelligenceScore = this.calculateIntelligenceScore(node);
  }
  
  private createInitialNodeIntelligence(nodeId: string): NodeIntelligence {
    return {
      nodeId,
      totalTransactions: 0,
      totalRevenue: 0,
      totalLoadsMatched: 0,
      successfulRoutes: new Map(),
      optimalPrices: new Map(),
      driverPreferences: new Map(),
      shipperPatterns: new Map(),
      avgMatchTime: 0,
      avgNegotiationRounds: 0,
      settlementSuccessRate: 0,
      driverRetentionRate: 0,
      intelligenceScore: 0,
    };
  }
  
  private calculateIntelligenceScore(node: NodeIntelligence): number {
    // Weighted scoring
    const scores = [
      Math.min(node.totalTransactions / 100, 1) * 25,  // Volume (25%)
      Math.min(node.totalRevenue / 5000, 1) * 25,        // Revenue (25%)
      (1 - Math.min(node.avgMatchTime / 60, 1)) * 20,   // Speed (20%)
      Math.min(node.settlementSuccessRate, 1) * 20,      // Reliability (20%)
      Math.min(node.driverRetentionRate, 1) * 10,        // Retention (10%)
    ];
    
    return Math.floor(scores.reduce((a, b) => a + b, 0));
  }
  
  // Get node stats
  getNodeStats(nodeId: string): NodeIntelligence | undefined {
    return this.nodes.get(nodeId);
  }
  
  // Get all node stats
  getAllNodeStats(): NodeIntelligence[] {
    return Array.from(this.nodes.values());
  }
  
  // Get revenue summary
  getRevenueSummary(): {
    totalTransactions: number;
    totalVolume: number;
    platformRevenue: number;
    nodeRevenue: number;
    tillerRevenue: number;
  } {
    return this.transactions.reduce((acc, tx) => ({
      totalTransactions: acc.totalTransactions + 1,
      totalVolume: acc.totalVolume + tx.loadValue,
      platformRevenue: acc.platformRevenue + tx.distribution.platform.amount,
      nodeRevenue: acc.nodeRevenue + tx.distribution.nodeOperator.amount,
      tillerRevenue: acc.tillerRevenue + tx.distribution.tiller.amount,
    }), {
      totalTransactions: 0,
      totalVolume: 0,
      platformRevenue: 0,
      nodeRevenue: 0,
      tillerRevenue: 0,
    });
  }
  
  // Export for storage
  export(): {
    transactions: TransactionRecord[];
    nodes: NodeIntelligence[];
  } {
    return {
      transactions: this.transactions,
      nodes: Array.from(this.nodes.values()),
    };
  }
}

// Factory for creating new nodes
export function spawnChildNode(
  parentNode: NodeIntelligence,
  newNodeId: string,
  newLocation: string
): NodeIntelligence {
  const child: NodeIntelligence = {
    nodeId: newNodeId,
    totalTransactions: 0,
    totalRevenue: 0,
    totalLoadsMatched: 0,
    // Inherit patterns from parent (with decay)
    successfulRoutes: new Map(parentNode.successfulRoutes),
    optimalPrices: new Map(parentNode.optimalPrices),
    driverPreferences: new Map(), // Start fresh for new location
    shipperPatterns: new Map(),   // Start fresh
    // Inherit performance expectations (with penalty)
    avgMatchTime: parentNode.avgMatchTime * 1.2, // Expect 20% slower initially
    avgNegotiationRounds: parentNode.avgNegotiationRounds,
    settlementSuccessRate: parentNode.settlementSuccessRate * 0.9, // 10% lower initially
    driverRetentionRate: 0, // Start fresh
    // Starting intelligence (inherited with decay)
    intelligenceScore: Math.floor(parentNode.intelligenceScore * 0.7), // Start at 70% of parent
  };
  
  return child;
}

// Example usage
export const exampleFactory: NodeFactory = {
  parentNodeId: 'C-3PO',
  spawnThreshold: {
    capacityPercent: 70,
    minTransactions: 500,
    minRevenue: 5000,
    intelligenceScore: 70,
  },
  inheritance: {
    config: true,
    patterns: true,
    reputation: true,
    franchiseFee: 0.0025, // 0.25%
  },
};

// Smart contract integration stub
export interface SmartContractConfig {
  address: string;
  abi: string[];
  chainId: number;
}

export async function settlePayment(
  loadValue: number,
  driverWallet: string,
  nodeId: string,
  contractConfig: SmartContractConfig
): Promise<{
  success: boolean;
  transactionHash?: string;
  error?: string;
}> {
  // This would integrate with actual smart contract
  // For now, returns simulated response
  const split = calculateRevenueSplit(loadValue);
  
  return {
    success: true,
    transactionHash: `0x${Math.random().toString(16).substring(2, 42)}`,
  };
}

export default {
  calculateRevenueSplit,
  shouldSpawnChildNode,
  spawnChildNode,
  NodeRevenueTracker,
  REVENUE_SHARES,
  exampleFactory,
};