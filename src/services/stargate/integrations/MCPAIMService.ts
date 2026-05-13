// =============================================================================
// STARGATE INTEGRATIONS — MCP AIM Service
// Renderer-side bridge: HyperCycle AIM → MCP Server
// =============================================================================

import type { AIMInfo } from '../../AdaPortal/types';

// =============================================================================
// MCP Server Config (inline, renderer-safe)
// =============================================================================

interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
}

interface MCPRegisterResult {
  success: boolean;
  serverName: string;
  error?: string;
}

interface AIMServerStatus {
  name: string;
  connected: boolean;
  url: string;
  tools: string[];
}

// =============================================================================
// MCP AIM Service
// =============================================================================

class MCPAIMService {
  private registered: Map<string, MCPServerConfig> = new Map();

  /** Convert an AIMInfo into an MCP HTTP server config */
  buildServerConfig(aim: AIMInfo, overrides?: Partial<MCPServerConfig>): MCPServerConfig {
    const baseUrl = aim.bestEndpointUrl || this.inferEndpoint(aim);
    const safeName = this.sanitizeName(aim.name);

    return {
      name: safeName,
      transport: 'http',
      url: baseUrl,
      apiKey: undefined,
      ...overrides,
    };
  }

  /** Register an AIM as an MCP server via main-process bridge */
  async registerAIM(aim: AIMInfo): Promise<MCPRegisterResult> {
    try {
      const config = this.buildServerConfig(aim);
      const ipc = (window as any).electronAPI?.stargate;

      if (!ipc?.registerAIM) {
        throw new Error('electronAPI.stargate.registerAIM not available');
      }

      const result = await ipc.registerAIM(config);

      if (result.success) {
        this.registered.set(config.name, config);
      }

      return {
        success: result.success,
        serverName: config.name,
        error: result.error,
      };
    } catch (e: any) {
      return {
        success: false,
        serverName: this.sanitizeName(aim.name),
        error: e.message,
      };
    }
  }

  /** Batch register multiple AIMs */
  async registerAIMs(aims: AIMInfo[]): Promise<MCPRegisterResult[]> {
    const results: MCPRegisterResult[] = [];
    for (const aim of aims) {
      const result = await this.registerAIM(aim);
      results.push(result);
    }
    return results;
  }

  /** Deregister an AIM MCP server */
  async unregisterAIM(serverName: string): Promise<boolean> {
    try {
      const ipc = (window as any).electronAPI?.stargate;
      if (!ipc?.unregisterAIM) return false;

      await ipc.unregisterAIM(serverName);
      this.registered.delete(serverName);
      return true;
    } catch {
      return false;
    }
  }

  /** List all registered AIM MCP servers */
  getRegisteredServers(): MCPServerConfig[] {
    return Array.from(this.registered.values());
  }

  /** Check if an AIM is registered */
  isRegistered(aimName: string): boolean {
    return this.registered.has(this.sanitizeName(aimName));
  }

  /** Build a tool schema from AIM info (for external MCP clients) */
  buildToolSchema(aim: AIMInfo): Record<string, unknown> {
    return {
      name: this.sanitizeName(aim.name),
      description: aim.description || `HyperCycle AIM: ${aim.name}`,
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Input prompt for the AI model',
          },
          temperature: {
            type: 'number',
            description: 'Sampling temperature (0.0 - 1.0)',
            default: 0.7,
          },
          maxTokens: {
            type: 'number',
            description: 'Maximum tokens to generate',
            default: 2048,
          },
        },
        required: ['prompt'],
      },
      metadata: {
        rank: aim.rank,
        computeTFLOPS: aim.computeTFLOPS,
        cpuCores: aim.cpuCores,
        ramGB: aim.ramGB,
        estimatedCost: aim.estimatedCostUsdc,
      },
    };
  }

  /** Refresh all registered AIM connections */
  async refreshAll(): Promise<{ refreshed: number; failed: number }> {
    let refreshed = 0;
    let failed = 0;

    for (const entry of Array.from(this.registered.entries())) {
      const [name, config] = entry;
      try {
        const ipc = (window as any).electronAPI?.stargate;
        if (ipc?.registerAIM) {
          await ipc.registerAIM(config);
          refreshed++;
        }
      } catch {
        failed++;
      }
    }

    return { refreshed, failed };
  }

  /** Adapter: register a BridgeAIM (from LocalNodeBridge) as MCP server */
  async registerAIMFromBridge(bridgeAim: any): Promise<MCPRegisterResult> {
    const aimInfo: AIMInfo = {
      name: bridgeAim.name || 'Unnamed AIM',
      version: '1.0',
      description: `HyperCycle AIM on port ${bridgeAim.port}`,
      origin: 'hypercycle',
      hypercycle_id: bridgeAim.imageId,
      isActive: bridgeAim.status === 'running',
      bestEndpointUrl: `http://localhost:${bridgeAim.port}`,
    };
    return this.registerAIM(aimInfo);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 64);
  }

  private inferEndpoint(aim: AIMInfo): string {
    // HyperCycle AIM endpoints follow this pattern:
    // https://api.hypercycle.io/v1/aim/{aim-name}
    const safeName = this.sanitizeName(aim.name);
    return `https://api.hypercycle.io/v1/aim/${safeName}`;
  }
}

// =============================================================================
// Singletons
// =============================================================================

export const mcpAIMService = new MCPAIMService();
export default MCPAIMService;
export type { MCPServerConfig, MCPRegisterResult, AIMServerStatus };
