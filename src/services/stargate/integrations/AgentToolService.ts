// =============================================================================
// STARGATE INTEGRATIONS — Agent-as-Tool Manifest Service
// Renderer-side bridge: ANFE → ToolManifest → ToolManager
// =============================================================================

import type { ANFE, ANFEAttributes } from '../../StargatePool/ANFETypes';

// =============================================================================
// Inline ToolManifest subset (renderer-safe, avoids cross-bundle imports)
// =============================================================================

interface ManifestTool {
  description: string;
  inputSchema?: Record<string, unknown>;
  displayHint?: 'display' | 'analyze';
}

interface ManifestInput {
  type: 'secret' | 'string';
  description: string;
  required?: boolean;
  default?: string;
}

interface ToolPermissions {
  internet: boolean;
  allowed_domains: string[];
  files: string[];
  services: string[];
}

interface ToolResources {
  memory: string;
  timeout: string;
}

interface ToolRuntime {
  type: 'wasm' | 'docker';
  entry: string;
}

interface ToolUIPanel {
  id: string;
  title: string;
  description?: string;
  defaultHeight?: number;
  icon?: string;
  hidden?: boolean;
}

/** Self-contained manifest type for renderer-side generation.
 *  The main-process ToolManager casts this to its internal ToolManifest.
 */
export interface AgentToolManifest extends Record<string, unknown> {
  manifestVersion: string;
  id: string;
  version: string;
  displayName: string;
  description: string;
  author?: string;
  license?: string;
  runtime: ToolRuntime;
  permissions: ToolPermissions;
  resources: ToolResources;
  tools: Record<string, ManifestTool>;
  inputs?: Record<string, ManifestInput>;
  ui?: { panels: ToolUIPanel[] };
  anfeTokenId: string;
  anfeChainId: number;
  anfeOwner: string;
  computeTFLOPS?: number;
  walletCapable: boolean;
  aiModules: string[];
  nodeFactoryId?: string;
  delegated: boolean;
  tier: 'basic' | 'standard' | 'advanced' | 'premium';
}

export interface AgentToolRegistrationResult {
  success: boolean;
  toolId: string;
  manifest: AgentToolManifest;
  error?: string;
}

// =============================================================================
// Agent Tool Service
// =============================================================================

class AgentToolService {
  private registeredManifests: Map<string, AgentToolManifest> = new Map();

  /** Generate a ToolManifest from an ANFE */
  generateManifest(anfe: ANFE, overrides?: Partial<AgentToolManifest>): AgentToolManifest {
    const level = this.getLevel(anfe.attributes);
    const tier = this.levelToTier(level);
    const aiModules = this.getAIModules(anfe.attributes);

    // Build allowed domains from ANFE metadata → HyperCycle endpoints
    const allowedDomains = this.buildAllowedDomains(anfe);

    // Build a display name from metadata → ANFE token name
    const displayName = anfe.metadata?.name || `Stargate Agent #${anfe.tokenId}`;

    const manifest: AgentToolManifest = {
      manifestVersion: '1.0',
      id: `stargate-anfe-${anfe.tokenId}`,
      version: '1.0.0',
      displayName,
      description: this.buildDescription(anfe, aiModules, tier),
      author: anfe.owner,
      license: 'HyperCycle ANFE License',

      runtime: {
        type: 'docker',
        entry: `hypercycle/aim-node:latest`,
      },

      permissions: {
        internet: true,
        allowed_domains: allowedDomains,
        files: [],
        services: ['hypercycle'],
      },

      resources: {
        memory: this.getMemoryForTier(tier),
        timeout: '10m',
      },

      tools: {
        chat: {
          description: 'Chat with the agent using its assigned AI module',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The user message' },
              module: { type: 'string', description: 'Which AI module to use', enum: aiModules },
            },
            required: ['prompt'],
          },
          displayHint: 'analyze' as const,
        },
        verify: {
          description: 'Verify agent uptime via HyperInsight',
          inputSchema: {
            type: 'object',
            properties: { check: { type: 'boolean' } },
          },
          displayHint: 'display' as const,
        },
        delegate: {
          description: 'Delegate this agent to a node factory',
          inputSchema: {
            type: 'object',
            properties: {
              factoryId: { type: 'string' },
              duration: { type: 'number', description: 'Delegation duration in seconds' },
            },
            required: ['factoryId'],
          },
          displayHint: 'analyze' as const,
        },
      },

      inputs: {
        HYPERCYCLE_API_KEY: {
          type: 'secret' as const,
          description: 'HyperCycle API key for node communication',
          required: false,
        },
        WALLET_PRIVATE_KEY: {
          type: 'secret' as const,
          description: 'Agent wallet for signing transactions (if walletCapable)',
          required: false,
        },
      },

      ui: {
        panels: [
          {
            id: 'anfe-info',
            title: 'ANFE Details',
            description: 'Token metadata, level, compute tier',
            icon: 'shield',
          },
          {
            id: 'telemetry',
            title: 'Node Telemetry',
            description: 'Live stats for this agent node',
            icon: 'activity',
          },
        ],
      },

      // Agent-specific overrides
      anfeTokenId: anfe.tokenId,
      anfeChainId: anfe.chainId,
      anfeOwner: anfe.owner,
      computeTFLOPS: this.estimateTFLOPS(anfe.attributes),
      walletCapable: true,
      aiModules,
      nodeFactoryId: undefined,
      delegated: false,
      tier,

      // Apply any caller overrides
      ...overrides,
    };

    return manifest;
  }

  /** Register a generated manifest with the main-process ToolManager via IPC */
  async registerManifest(manifest: AgentToolManifest): Promise<AgentToolRegistrationResult> {
    try {
      const toolId = manifest.id;

      // Prevent duplicate registration
      if (this.registeredManifests.has(toolId)) {
        return {
          success: true,
          toolId,
          manifest: this.registeredManifests.get(toolId)!,
        };
      }

      // Call into main process via Electron IPC
      const ipc = (window as any).electronAPI?.stargate;
      if (!ipc?.registerAgentTool) {
        throw new Error('electronAPI.stargate.registerAgentTool not available');
      }

      const result = await ipc.registerAgentTool(manifest);

      if (result.success) {
        this.registeredManifests.set(toolId, manifest);
      }

      return {
        success: result.success,
        toolId,
        manifest,
        error: result.error,
      };
    } catch (e: any) {
      return {
        success: false,
        toolId: manifest.id,
        manifest,
        error: e.message,
      };
    }
  }

  /** Batch register all ANFEs for a wallet */
  async registerWalletAgents(anfes: ANFE[]): Promise<AgentToolRegistrationResult[]> {
    const results: AgentToolRegistrationResult[] = [];
    for (const anfe of anfes) {
      const manifest = this.generateManifest(anfe);
      const result = await this.registerManifest(manifest);
      results.push(result);
    }
    return results;
  }

  /** De-register an agent tool */
  async unregisterManifest(toolId: string): Promise<boolean> {
    try {
      const ipc = (window as any).electronAPI?.stargate;
      if (!ipc?.unregisterAgentTool) return false;

      await ipc.unregisterAgentTool(toolId);
      this.registeredManifests.delete(toolId);
      return true;
    } catch {
      return false;
    }
  }

  /** Get all currently registered agent manifests */
  getRegisteredManifests(): AgentToolManifest[] {
    return Array.from(this.registeredManifests.values());
  }

  /** Get a specific manifest by token ID */
  getManifestByTokenId(tokenId: string): AgentToolManifest | undefined {
    return this.registeredManifests.get(`stargate-anfe-${tokenId}`);
  }

  /** Adapter: generate + register a manifest from a fleet node */
  async registerFromFleetNode(node: {
    nodeId: string;
    label: string;
    host: string;
    port: number;
    computeTier: string;
  }): Promise<AgentToolRegistrationResult> {
    const manifest: AgentToolManifest = {
      manifestVersion: '1.0',
      id: `stargate-fleet-${node.nodeId}`,
      version: '1.0.0',
      displayName: node.label,
      description: `Stargate fleet node @ ${node.host}:${node.port}`,
      author: 'stargate-fleet',
      license: 'Fleet License',
      runtime: { type: 'docker', entry: `http://${node.host}:${node.port}` },
      permissions: {
        internet: true,
        allowed_domains: [node.host, '*.hypercycle.io'],
        files: [],
        services: ['hypercycle'],
      },
      resources: {
        memory: node.computeTier === 'dedicated' ? '2g' : '512m',
        timeout: '10m',
      },
      tools: {
        chat: {
          description: 'Chat with the fleet node agent',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
            },
            required: ['prompt'],
          },
          displayHint: 'analyze' as const,
        },
      },
      ui: {
        panels: [
          { id: 'agent', title: 'Agent', icon: 'server', description: 'Fleet agent panel' },
        ],
      },
      inputs: {
        api_key: { type: 'secret', description: 'Fleet node API key', required: false },
      },
      tier: node.computeTier === 'dedicated' ? 'premium' : 'standard',
      walletCapable: true,
      // Required ANFE fields (using nodeId as tokenId for fleet nodes)
      anfeTokenId: node.nodeId,
      anfeChainId: 0,
      anfeOwner: 'stargate-fleet',
      aiModules: ['chat'],
      delegated: false,
    };
    return this.registerManifest(manifest);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getLevel(attrs: ANFEAttributes): number {
    const levelAttr = attrs.core.level;
    if (!levelAttr) return 1;
    if (typeof levelAttr.value === 'number') return levelAttr.value;
    if (typeof levelAttr.value === 'string') return parseInt(levelAttr.value, 10) || 1;
    return 1;
  }

  private levelToTier(level: number): AgentToolManifest['tier'] {
    if (level >= 9) return 'premium';
    if (level >= 6) return 'advanced';
    if (level >= 3) return 'standard';
    return 'basic';
  }

  private getAIModules(attrs: ANFEAttributes): string[] {
    return attrs.ai.aiModules.map(m => {
      const name = m.trait_type.replace('c_', '');
      const mappings: Record<string, string> = {
        OpnAI: 'OpenAI',
        IAlf: 'Claude',
        IAlb: 'Claude-Balanced',
        IAlr: 'Claude-Reasoning',
        IAIs: 'LocalAI',
        AIMF: 'AIM-Forge',
        QntV: 'Quant-V',
        SpcN: 'SpaceN',
      };
      return mappings[name] || name;
    });
  }

  private buildAllowedDomains(anfe: ANFE): string[] {
    const domains = [
      'api.hyperinsight.app',
      'api.hypercycle.io',
      'rpc.hypercycle.network',
    ];
    // Add chain-specific domains
    if (anfe.chainId === 1) {
      domains.push('rpc.ethereum.org', 'api.etherscan.io');
    } else if (anfe.chainId === 8453) {
      domains.push('rpc.base.org', 'api.basescan.org');
    }
    return domains;
  }

  private buildDescription(anfe: ANFE, modules: string[], tier: string): string {
    const tf = this.estimateTFLOPS(anfe.attributes);
    return `HyperCycle ANFE-backed agent (Level ${this.getLevel(anfe.attributes)}, ${tier}). ` +
      `AI modules: ${modules.join(', ') || 'none'}. ` +
      `Approx ${tf.toFixed(1)} TFLOPS. ` +
      `Owned by ${anfe.owner.slice(0, 8)}...${anfe.owner.slice(-4)}`;
  }

  private estimateTFLOPS(attrs: ANFEAttributes): number {
    const level = this.getLevel(attrs);
    // Rough mapping: level 1 = 1 TFLOP, level 11 = ~100 TFLOPS
    return Math.pow(level, 1.8);
  }

  private getMemoryForTier(tier: string): string {
    switch (tier) {
      case 'premium': return '16g';
      case 'advanced': return '8g';
      case 'standard': return '4g';
      default: return '2g';
    }
  }
}

// =============================================================================
// Singletons
// =============================================================================

export const agentToolService = new AgentToolService();
export default AgentToolService;
