// Node Status Service
// Fetches real-time status from Hypercycle nodes

import { OwnedNode } from "../types/nodeConfig";

export interface NodeStatus {
  isOnline: boolean;
  lastChecked: Date | null;
  uptime?: number; // Percentage
  lastSeen?: Date;
  version?: string;
  apiPort?: number;
  peers?: number;
  pendingTransactions?: number;
  error?: string;
}

// Node API endpoints
const NODE_API_ENDPOINTS = {
  // Default ports for Hypercycle nodes
  api: 8000,
  admin: 8006,
};

class NodeStatusService {
  // Check if a node is responding
  async checkNodeStatus(
    nodeHost: string,
    apiPort: number = NODE_API_ENDPOINTS.api
  ): Promise<NodeStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `http://${nodeHost}:${apiPort}/info`,
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          isOnline: false,
          lastChecked: new Date(),
          error: `HTTP ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        isOnline: true,
        lastChecked: new Date(),
        uptime: data.uptime ?? undefined,
        version: data.version ?? undefined,
        peers: data.peers ?? undefined,
        pendingTransactions: data.pendingTx ?? undefined,
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : undefined,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          isOnline: false,
          lastChecked: new Date(),
          error: "Connection timeout",
        };
      }

      return {
        isOnline: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Check multiple nodes in parallel
  async checkAllNodes(
    nodes: Array<{ host: string; port?: number }>
  ): Promise<Map<string, NodeStatus>> {
    const results = new Map<string, NodeStatus>();

    const checks = nodes.map(async (node) => {
      const status = await this.checkNodeStatus(node.host, node.port);
      return { key: `${node.host}:${node.port || 8000}`, status };
    });

    const responses = await Promise.all(checks);
    responses.forEach(({ key, status }) => {
      results.set(key, status);
    });

    return results;
  }

  // Get node uptime from blockchain events (simplified - would need indexer)
  // This is a placeholder for querying on-chain uptime data
  async getOnChainUptime(
    contractAddress: string,
    tokenId: string,
    ethereum: typeof window.ethereum
  ): Promise<{ lastActiveBlock: number; isActive: boolean } | null> {
    try {
      // In a real implementation, this would:
      // 1. Query Transfer events for the token
      // 2. Check recent activity in the contract
      // 3. Use an indexer like The Graph for historical data

      // For now, return null - would need proper indexing
      return null;
    } catch (error) {
      console.error("Failed to get on-chain uptime:", error);
      return null;
    }
  }

  // Format uptime for display
  formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Calculate uptime percentage from logs
  calculateUptimePercentage(
    checks: Array<{ time: Date; isOnline: boolean }>
  ): number {
    if (checks.length === 0) return 0;

    const onlineChecks = checks.filter((c) => c.isOnline).length;
    return Math.round((onlineChecks / checks.length) * 100);
  }
}

export const nodeStatusService = new NodeStatusService();
export default nodeStatusService;