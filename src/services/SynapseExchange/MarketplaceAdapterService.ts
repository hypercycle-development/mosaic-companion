// ============================================
// LAYER 2: MULTI-MARKETPLACE ADAPTER SERVICE
// Masumi/Sokosumi Compatible + Extensible
// ============================================

import type {
  AdapterConfig,
  AdapterType,
  ExecutionRequest,
  ExecutionResponse,
  ExternalAgentMetadata
} from './types';

interface Adapter {
  name: AdapterType;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
}

// Active adapters registry
const adapters = new Map<AdapterType, Adapter>();

// External agent cache
const externalAgents = new Map<string, ExternalAgentMetadata>();

// Default Masumi endpoint (MIP-003 compliant)
const DEFAULT_MASUMI_ENDPOINT = 'https://api.masumi.io/v1';
const DEFAULT_SOKOSUMI_ENDPOINT = 'https://api.sokosumi.io/v1';

export class MarketplaceAdapterService {
  constructor() {
    this.initializeDefaultAdapters();
  }

  private initializeDefaultAdapters(): void {
    // Initialize default adapters
    adapters.set('masumi', {
      name: 'masumi',
      enabled: true,
      endpoint: DEFAULT_MASUMI_ENDPOINT
    });
    
    adapters.set('sokosumi', {
      name: 'sokosumi',
      enabled: true,
      endpoint: DEFAULT_SOKOSUMI_ENDPOINT
    });

    // Add some mock external agents
    this.addMockExternalAgents();

    console.log('[MarketplaceAdapter] Initialized with Masumi/Sokosumi adapters');
  }

  private addMockExternalAgents(): void {
    const mockExternalAgents: ExternalAgentMetadata[] = [
      {
        externalAgentId: 'ext_masumi_001',
        marketplace: 'masumi',
        name: 'Elite Marketer Pro',
        roles: ['marketing'],
        skills: ['content_creation', 'seo', 'social_media'],
        price: 85,
        performance: 4.8
      },
      {
        externalAgentId: 'ext_sokosumi_001',
        marketplace: 'sokosumi',
        name: 'Full-Stack Wizard',
        roles: ['developer'],
        skills: ['frontend', 'backend', 'api_design'],
        price: 250,
        performance: 4.9
      },
      {
        externalAgentId: 'ext_masumi_002',
        marketplace: 'masumi',
        name: 'Design Sensei',
        roles: ['uiux'],
        skills: ['ui_design', 'prototyping', 'design_systems'],
        price: 175,
        performance: 4.7
      }
    ];

    mockExternalAgents.forEach(agent => {
      externalAgents.set(agent.externalAgentId, agent);
    });

    console.log(`[MarketplaceAdapter] Loaded ${mockExternalAgents.length} external agents`);
  }

  // Configure adapter
  configureAdapter(config: AdapterConfig): void {
    const adapter: Adapter = {
      name: config.adapter,
      enabled: config.enabled,
      endpoint: config.endpoint,
      apiKey: config.apiKey
    };
    adapters.set(config.adapter, adapter);
    console.log(`[MarketplaceAdapter] Configured adapter: ${config.adapter}`);
  }

  // Get adapter status
  getAdapterStatus(adapterType?: AdapterType): Record<string, { enabled: boolean; endpoint?: string }> {
    if (adapterType) {
      const adapter = adapters.get(adapterType);
      if (!adapter) return {};
      return {
        [adapterType]: {
          enabled: adapter.enabled,
          endpoint: adapter.endpoint
        }
      };
    }

    const status: Record<string, { enabled: boolean; endpoint?: string }> = {};
    adapters.forEach((adapter, key) => {
      status[key] = {
        enabled: adapter.enabled,
        endpoint: adapter.endpoint
      };
    });
    return status;
  }

  // Get external agents
  getExternalAgents(marketplace?: AdapterType): ExternalAgentMetadata[] {
    let agents = Array.from(externalAgents.values());
    if (marketplace) {
      agents = agents.filter(a => a.marketplace === marketplace);
    }
    return agents;
  }

  // Execute task via external marketplace
  async executeViaAdapter(request: ExecutionRequest): Promise<ExecutionResponse> {
    const adapter = adapters.get(request.adapter);
    
    if (!adapter || !adapter.enabled) {
      return {
        success: false,
        error: `Adapter ${request.adapter} not available`,
        executionTime: 0
      };
    }

    const startTime = Date.now();

    // Simulate external execution (in production, this would call actual APIs)
    console.log(`[MarketplaceAdapter] Executing via ${request.adapter}: ${request.task.substring(0, 50)}...`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Mock response
    const success = Math.random() > 0.1; // 90% success rate
    
    const response: ExecutionResponse = {
      success,
      result: success 
        ? `Executed by ${request.adapter} agent ${request.agentId}: ${request.task.substring(0, 100)}...`
        : undefined,
      error: success ? undefined : 'External execution failed',
      executionTime: Date.now() - startTime
    };

    console.log(`[MarketplaceAdapter] Execution ${success ? 'succeeded' : 'failed'} (${response.executionTime}ms)`);
    return response;
  }

  // Compare agents across marketplaces
  compareAgents(requiredSkills: string[]): ExternalAgentMetadata[] {
    return Array.from(externalAgents.values())
      .filter(agent => 
        requiredSkills.some(skill => agent.skills.includes(skill))
      )
      .sort((a, b) => b.performance - a.performance);
  }

  // MIP-003 compliant metadata endpoint
  getMetadata(agentId: string): Record<string, unknown> | null {
    const agent = externalAgents.get(agentId);
    if (!agent) return null;

    return {
      id: agent.externalAgentId,
      name: agent.name,
      marketplace: agent.marketplace,
      capabilities: {
        roles: agent.roles,
        skills: agent.skills
      },
      pricing: {
        basePrice: agent.price,
        currency: 'USDC',
        chain: 'base'
      },
      mip003: {
        version: '1.0',
        compliance: true
      }
    };
  }

  // Get pricing info
  getPricing(agentId: string): { price: number; model: string } | null {
    const agent = externalAgents.get(agentId);
    if (!agent) return null;

    return {
      price: agent.price,
      model: 'per_task'
    };
  }

  // Import external agent (for MCP routing)
  importExternalAgent(metadata: ExternalAgentMetadata): void {
    externalAgents.set(metadata.externalAgentId, metadata);
    console.log(`[MarketplaceAdapter] Imported external agent: ${metadata.name}`);
  }
}

export const marketplaceAdapter = new MarketplaceAdapterService();