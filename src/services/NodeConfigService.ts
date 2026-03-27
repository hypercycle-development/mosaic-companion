// Node Configuration Service
// Links on-chain nodes/ANFEs to AI models

import { ChainId, SUPPORTED_CHAINS, HYPERCYCLE_CONTRACTS } from "../types/wallet";
import { OwnedNode, NodeModelConfig, NODE_CONFIGS_KEY } from "../types/nodeConfig";
import { AIAgentConfig } from "../types/ai";

// Minimal ERC-721 function signatures for reading
const ERC721_ABI = {
  balanceOf: "0x70a08231", // balanceOf(address)
  tokenOfOwnerByIndex: "0x2f745c59", // tokenOfOwnerByIndex(address,uint256) - ERC721Enumerable
  ownerOf: "0x6352211e", // ownerOf(uint256)
  tokenURI: "0xc87b56dd", // tokenURI(uint256)
  name: "0x06fdde03", // name()
  symbol: "0x95d89b41", // symbol()
  totalSupply: "0x18160ddd", // totalSupply()
};

// Store for node configurations (persists to localStorage)
class NodeConfigService {
  private configs: Map<string, NodeModelConfig> = new Map();
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  // Load configurations from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(NODE_CONFIGS_KEY);
      if (stored) {
        const configs: NodeModelConfig[] = JSON.parse(stored);
        configs.forEach((config) => {
          this.configs.set(config.id, config);
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error("Failed to load node configs:", error);
    }
  }

  // Save configurations to localStorage
  private saveToStorage(): void {
    try {
      const configs = Array.from(this.configs.values());
      localStorage.setItem(NODE_CONFIGS_KEY, JSON.stringify(configs));
    } catch (error) {
      console.error("Failed to save node configs:", error);
    }
  }

  // Get all configurations
  getAllConfigs(): NodeModelConfig[] {
    return Array.from(this.configs.values());
  }

  // Get configuration for a specific node
  getConfig(nodeId: string): NodeModelConfig | undefined {
    return this.configs.get(nodeId);
  }

  // Get configurations for a specific agent
  getConfigsForAgent(agentId: string): NodeModelConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.agentId === agentId);
  }

  // Get configurations for a specific chain
  getConfigsForChain(chainId: ChainId): NodeModelConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.chainId === chainId);
  }

  // Create or update a node-model configuration
  setConfig(
    tokenId: string,
    chainId: ChainId,
    contractAddress: string,
    agentId: string
  ): NodeModelConfig {
    const id = `${chainId}-${contractAddress}-${tokenId}`;
    const existing = this.configs.get(id);
    const now = Date.now();

    const config: NodeModelConfig = {
      id,
      tokenId,
      chainId,
      contractAddress,
      agentId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.configs.set(id, config);
    this.saveToStorage();
    return config;
  }

  // Remove a configuration
  removeConfig(nodeId: string): boolean {
    const deleted = this.configs.delete(nodeId);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  // Remove all configurations for an agent (when agent is deleted)
  removeConfigsForAgent(agentId: string): void {
    const configsToRemove = this.getConfigsForAgent(agentId);
    configsToRemove.forEach((c) => this.configs.delete(c.id));
    if (configsToRemove.length > 0) {
      this.saveToStorage();
    }
  }

  // Create a unique node ID
  createNodeId(chainId: ChainId, contractAddress: string, tokenId: string): string {
    return `${chainId}-${contractAddress}-${tokenId}`;
  }

  // Parse node ID to components
  parseNodeId(nodeId: string): { chainId: ChainId; contractAddress: string; tokenId: string } | null {
    const parts = nodeId.split("-");
    if (parts.length !== 3) return null;
    return {
      chainId: parseInt(parts[0]) as ChainId,
      contractAddress: parts[1],
      tokenId: parts[2],
    };
  }

  // Get contract info for a chain
  getContractInfo(chainId: ChainId) {
    return HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
  }

  // Get chain info
  getChainInfo(chainId: ChainId) {
    return SUPPORTED_CHAINS[chainId];
  }
}

// Service for fetching owned nodes from blockchain
class NodeOwnershipService {
  private ethereum: typeof window.ethereum | null = null;

  setProvider(provider: typeof window.ethereum) {
    this.ethereum = provider;
  }

  // Get the number of tokens owned by an address
  async getTokenBalance(
    contractAddress: string,
    ownerAddress: string
  ): Promise<number> {
    if (!this.ethereum) throw new Error("No Ethereum provider");

    try {
      // Encode balanceOf(address) call
      const data =
        ERC721_ABI.balanceOf +
        ownerAddress.slice(2).toLowerCase().padStart(64, "0");

      const result = await this.ethereum.request({
        method: "eth_call",
        params: [{ to: contractAddress, data }, "latest"],
      });

      // Parse the hex result to number
      return parseInt(result as string, 16);
    } catch (error) {
      console.error("Failed to get token balance:", error);
      return 0;
    }
  }

  // Get token ID by index (ERC721Enumerable)
  async getTokenIdByIndex(
    contractAddress: string,
    ownerAddress: string,
    index: number
  ): Promise<string | null> {
    if (!this.ethereum) throw new Error("No Ethereum provider");

    try {
      // Encode tokenOfOwnerByIndex(address, uint256) call
      const data =
        ERC721_ABI.tokenOfOwnerByIndex +
        ownerAddress.slice(2).toLowerCase().padStart(64, "0") +
        index.toString(16).padStart(64, "0");

      const result = await this.ethereum.request({
        method: "eth_call",
        params: [{ to: contractAddress, data }, "latest"],
      });

      return (result as string).slice(2); // Remove 0x prefix
    } catch (error) {
      console.error("Failed to get token ID:", error);
      return null;
    }
  }

  // Get owner of a specific token
  async getTokenOwner(
    contractAddress: string,
    tokenId: string
  ): Promise<string | null> {
    if (!this.ethereum) throw new Error("No Ethereum provider");

    try {
      // Encode ownerOf(uint256) call
      const data = ERC721_ABI.ownerOf + tokenId.padStart(64, "0");

      const result = await this.ethereum.request({
        method: "eth_call",
        params: [{ to: contractAddress, data }, "latest"],
      });

      return result as string;
    } catch (error) {
      console.error("Failed to get token owner:", error);
      return null;
    }
  }

  // Get token URI for metadata
  async getTokenURI(
    contractAddress: string,
    tokenId: string
  ): Promise<string | null> {
    if (!this.ethereum) throw new Error("No Ethereum provider");

    try {
      // Encode tokenURI(uint256) call
      const data = ERC721_ABI.tokenURI + tokenId.padStart(64, "0");

      const result = await this.ethereum.request({
        method: "eth_call",
        params: [{ to: contractAddress, data }, "latest"],
      });

      // Decode the URI (it's returned as a string)
      const hex = (result as string).slice(2);
      // Remove padding and decode
      const uri = decodeURIComponent(
        hex
          .replace(/0+$/, "") // Remove trailing zeros
          .match(/.{1,2}/g)
          ?.map((byte) => String.fromCharCode(parseInt(byte, 16)))
          .join("") || ""
      );

      return uri;
    } catch (error) {
      console.error("Failed to get token URI:", error);
      return null;
    }
  }

  // Fetch all owned tokens for a wallet on a specific chain
  async getOwnedNodes(
    ownerAddress: string,
    chainId: ChainId
  ): Promise<OwnedNode[]> {
    const contract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
    if (!contract) return [];

    const balance = await this.getTokenBalance(contract.address, ownerAddress);
    if (balance === 0) return [];

    const nodes: OwnedNode[] = [];

    for (let i = 0; i < balance; i++) {
      const tokenId = await this.getTokenIdByIndex(contract.address, ownerAddress, i);
      if (tokenId) {
        const node: OwnedNode = {
          tokenId,
          chainId,
          contractAddress: contract.address,
          owner: ownerAddress,
        };

        // Try to fetch metadata
        const tokenURI = await this.getTokenURI(contract.address, tokenId);
        if (tokenURI) {
          node.tokenUri = tokenURI;
          // Could fetch and parse metadata here if needed
        }

        nodes.push(node);
      }
    }

    return nodes;
  }
}

export const nodeConfigService = new NodeConfigService();
export const nodeOwnershipService = new NodeOwnershipService();
export default nodeConfigService;