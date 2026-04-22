// ============================================
// ADA PORTAL - Marketplace Adapter Service
// Layer 2: External marketplace integration (Masumi, Sokosumi)
// ============================================

import { AdapterConfig, AdapterType, ExternalAgent } from './types';

class MarketplaceAdapterService {
  private adapters: Map<AdapterType, AdapterConfig> = new Map();
  private externalAgents: Map<string, ExternalAgent> = new Map();

  constructor() {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    // Default adapter configs
    const configs: AdapterConfig[] = [
      { adapter: 'masumi', enabled: false },
      { adapter: 'sokosumi', enabled: false },
      { adapter: 'generic', enabled: false }
    ];

    configs.forEach(config => {
      this.adapters.set(config.adapter, config);
    });

    console.log(`[AdaPortal] Initialized ${this.adapters.size} marketplace adapters`);
  }

  // Configure adapter
  configureAdapter(config: AdapterConfig): void {
    this.adapters.set(config.adapter, config);
    console.log(`[AdaPortal] Configured ${config.adapter} adapter: ${config.enabled ? 'enabled' : 'disabled'}`);
  }

  // Get adapter config
  getAdapter(adapter: AdapterType): AdapterConfig | undefined {
    return this.adapters.get(adapter);
  }

  // Get all enabled adapters
  getEnabledAdapters(): AdapterConfig[] {
    return Array.from(this.adapters.values()).filter(a => a.enabled);
  }

  // Import external agent
  importAgent(agent: ExternalAgent): void {
    this.externalAgents.set(agent.externalId, agent);
    console.log(`[AdaPortal] Imported external agent: ${agent.name}`);
  }

  // Get external agents
  getExternalAgents(): ExternalAgent[] {
    return Array.from(this.externalAgents.values());
  }

  // Get external agents by source
  getExternalAgentsBySource(source: AdapterType): ExternalAgent[] {
    return Array.from(this.externalAgents.values()).filter(a => a.source === source);
  }

  // Search external agents
  searchExternalAgents(query: string): ExternalAgent[] {
    const q = query.toLowerCase();
    return Array.from(this.externalAgents.values()).filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.skills.some(s => s.toLowerCase().includes(q))
    );
  }
}

export const marketplaceAdapter = new MarketplaceAdapterService();
export { MarketplaceAdapterService };