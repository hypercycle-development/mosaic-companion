// @ts-nocheck
// =============================================================================
// HBOX POOL SERVICE — Bridge HyperAIBoxes to Stargate Pool
// ---------------------------------------------------------------------------
// Reads HypercycleNode[] from the Electron main process (sidebar nodes),
// wraps them as Stargate-compatible compute nodes, and enables:
//   1. Delegation (public / NFT-gated / private)
//   2. Hermes agent deployment (Docker AIM)
//   3. Health monitoring (reuses sidebar /info pings)
// =============================================================================

/** Minimal shape of a HyperAIBox node returned by the Electron main store. */
export interface HypercycleNode {
  id: string;
  name: string;
  apiHost: string;
  apiPort: number;
  isActive: boolean;
  licenseKey?: string;
}

import { stargatePoolService } from './StargatePoolService';
import type { NodeFactory } from './StargatePoolService';

export interface HBoxComputeNode {
  id: string;                     // HypercycleNode.id
  name: string;
  apiHost: string;
  apiPort: number;
  isLive: boolean;
  licenseKey?: string;          // ANFE tokenId
  status: 'active' | 'inactive' | 'error';
  delegation: {
    isPublic: boolean;
    accessType: 'public' | 'nft-gated' | 'private';
    allowedWallets: string[];     // Whitelist for private mode
  };
  agent?: {
    agentId: string;
    name: string;
    provider: string;
    status: 'idle' | 'running';
  };
  /** True if Hermes AIM Docker image is loaded on this box */
  hasHermes: boolean;
  /** True if user has delegated this box to the Stargate pool */
  isDelegated: boolean;
}

class HBoxPoolService {
  private nodes: Map<string, HBoxComputeNode> = new Map();
  private initialized = false;

  constructor() {
    // Electron environment: verify we're in the renderer process
    if (typeof process !== 'undefined' && process.type && process.type !== 'renderer') {
      throw new Error(
        `[HBoxPoolService] Cannot instantiate in ${process.type} process. ` +
        `This service requires window.electronAPI which only exists in the renderer process. ` +
        `Use IPC handlers in electron/main.ts to proxy calls from main process.`
      );
    }

    // Browser environment: verify window exists
    if (typeof window === 'undefined') {
      throw new Error(
        `[HBoxPoolService] Cannot instantiate outside browser environment. ` +
        `window object is undefined.`
      );
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.refreshFromSidebar();
    this.initialized = true;
  }

  /**
   * Sync from Electron main process nodes store.
   * Called on mount and whenever nodes change.
   */
  async refreshFromSidebar(): Promise<HBoxComputeNode[]> {
    if (!window.electronAPI?.nodes?.get) return [];
    const rawNodes: HypercycleNode[] = await (window as any).electronAPI.nodes.get();

    const wrapped: HBoxComputeNode[] = rawNodes.map((n) => {
      const existing = this.nodes.get(n.id);
      return {
        id: n.id,
        name: n.name,
        apiHost: n.apiHost,
        apiPort: n.apiPort || 8000,
        isLive: existing?.isLive ?? false,
        licenseKey: n.licenseKey,
        status: n.isActive ? 'active' : 'inactive',
        delegation: existing?.delegation ?? {
          isPublic: false,
          accessType: 'private',
          allowedWallets: [],
        },
        agent: existing?.agent,
        hasHermes: existing?.hasHermes ?? false,
        isDelegated: existing?.isDelegated ?? false,
      };
    });

    wrapped.forEach((n) => this.nodes.set(n.id, n));
    return wrapped;
  }

  getNodes(): HBoxComputeNode[] {
    return Array.from(this.nodes.values());
  }

  getLiveNodes(): HBoxComputeNode[] {
    return this.getNodes().filter((n) => n.isLive && n.status === 'active');
  }

  getDelegatedNodes(): HBoxComputeNode[] {
    return this.getNodes().filter((n) => n.isDelegated);
  }

  /**
   * Register a HyperAIBox as a Stargate NodeFactory.
   * This makes it discoverable by other users via the pool.
   */
  async delegateToStargate(nodeId: string, config: {
    accessType: 'public' | 'nft-gated' | 'private';
    allowedWallets?: string[];
  }): Promise<{ success: boolean; error?: string }> {
    const node = this.nodes.get(nodeId);
    if (!node) return { success: false, error: 'Node not found' };

    // Update delegation settings
    node.delegation.accessType = config.accessType;
    node.delegation.isPublic = config.accessType === 'public';
    node.delegation.allowedWallets = config.allowedWallets || [];
    node.isDelegated = true;
    this.nodes.set(nodeId, node);

    // Register as a NodeFactory in StargatePool
    const factoryResult = await stargatePoolService.registerFactory({
      name: node.name,
      chain: 'base',
      network: 'base-mainnet',
      owner_wallet: node.licenseKey ? `anfe:${node.licenseKey}` : node.id,
      total_capacity: 100,
      skills_supported: ['hermes', 'ollama', 'compute'],
      is_public: config.accessType === 'public',
      collection_access: config.accessType === 'nft-gated' ? ['ANFE'] : [],
    });

    return factoryResult.success
      ? { success: true }
      : { success: false, error: factoryResult.error || 'Stargate registration failed' };
  }

  async revokeDelegation(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.isDelegated = false;
    node.delegation.accessType = 'private';
    node.delegation.isPublic = false;
    this.nodes.set(nodeId, node);
  }

  /**
   * Mark a node as having Hermes AIM loaded.
   * Called after Docker image deployment succeeds.
   */
  setHermesLoaded(nodeId: string, loaded: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.hasHermes = loaded;
    this.nodes.set(nodeId, node);
  }

  /**
   * Attach an AI agent to a node.
   */
  attachAgent(nodeId: string, agent: HBoxComputeNode['agent']): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.agent = agent;
    this.nodes.set(nodeId, node);
  }

  /**
   * Update live status from sidebar health checks.
   */
  updateNodeStatus(nodeId: string, isLive: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.isLive = isLive;
    node.status = isLive ? 'active' : 'error';
    this.nodes.set(nodeId, node);
  }
}

export const hboxPoolService = new HBoxPoolService();
export default hboxPoolService;
