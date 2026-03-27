// Factory Status Service
// Fetches status from Hypercycle node factories

import { ChainId, HYPERCYCLE_CONTRACTS } from "../types/wallet";

export interface FactoryStatus {
  chainId: ChainId;
  contractAddress: string;
  name: string;
  totalSupply: number | null;
  activeNodes: number | null;
  lastBlock: number | null;
  isResponsive: boolean;
  lastChecked: Date;
  error?: string;
}

class FactoryStatusService {
  // Get factory contract status
  // This queries the blockchain for factory stats
  async getFactoryStatus(
    chainId: ChainId,
    ethereum: typeof window.ethereum
  ): Promise<FactoryStatus> {
    const contract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
    if (!contract) {
      return {
        chainId,
        contractAddress: "",
        name: "Unknown",
        totalSupply: null,
        activeNodes: null,
        lastBlock: null,
        isResponsive: false,
        lastChecked: new Date(),
        error: "Contract not found for this chain",
      };
    }

    try {
      // Get current block number
      const blockNumber = await ethereum.request({
        method: "eth_blockNumber",
      });

      // Try to get total supply (if contract supports it)
      let totalSupply: number | null = null;
      try {
        // totalSupply() function signature
        const totalSupplyData = "0x18160ddd"; // keccak256(totalSupply())[:4]

        const supplyResult = await ethereum.request({
          method: "eth_call",
          params: [{ to: contract.address, data: totalSupplyData }, "latest"],
        });

        if (supplyResult && supplyResult !== "0x") {
          totalSupply = parseInt(supplyResult as string, 16);
        }
      } catch {
        // totalSupply might not be supported
      }

      return {
        chainId,
        contractAddress: contract.address,
        name: contract.name,
        totalSupply,
        activeNodes: null, // Would need events indexing
        lastBlock: parseInt(blockNumber as string, 16),
        isResponsive: true,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        chainId,
        contractAddress: contract.address,
        name: contract.name,
        totalSupply: null,
        activeNodes: null,
        lastBlock: null,
        isResponsive: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Failed to query factory",
      };
    }
  }

  // Get all factory statuses
  async getAllFactoryStatuses(
    ethereum: typeof window.ethereum
  ): Promise<FactoryStatus[]> {
    const statuses: FactoryStatus[] = [];

    for (const contract of HYPERCYCLE_CONTRACTS) {
      // Note: This requires being on the correct chain
      // In practice, you'd use a multi-chain provider or query each chain separately
      const status = await this.getFactoryStatus(contract.chainId, ethereum);
      statuses.push(status);
    }

    return statuses;
  }

  // Format large numbers for display
  formatNumber(num: number | null): string {
    if (num === null) return "—";
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
  }

  // Calculate uptime percentage (would need historical data)
  calculateUptime(online: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((online / total) * 100);
  }
}

export const factoryStatusService = new FactoryStatusService();
export default factoryStatusService;