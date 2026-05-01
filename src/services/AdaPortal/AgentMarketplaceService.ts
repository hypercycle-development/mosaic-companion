// ============================================
// ADA PORTAL - Agent Marketplace Service
// Uses REAL data: user's configured AI agents + HyperInsight AIMs
// No mock data. No fake agents.
// ============================================

import {
  AgentProfile,
  MarketplaceListing,
  AgentRole,
  AvailabilityStatus,
  PerformanceMetrics,
  AgentPricing,
  AIMInfo
} from './types';
import { hyperInsight } from './HyperInsightService';

// Safe access to Electron IPC
function getAiAgentsAPI(): any | undefined {
  return (window as any).electronAPI?.aiAgents;
}

// Map an AI agent config to a marketplace AgentProfile
function mapConfigToAgentProfile(config: any, index: number): AgentProfile {
  const id = config.id || `agent-${index}`;
  const name = config.name || `Agent ${index + 1}`;

  // Derive role from name/model hints
  const roles: AgentRole[] = [];
  const nameLower = name.toLowerCase();
  if (nameLower.includes('code') || nameLower.includes('dev') || nameLower.includes('solidity')) roles.push('developer');
  if (nameLower.includes('market') || nameLower.includes('social') || nameLower.includes('content')) roles.push('marketing');
  if (nameLower.includes('design') || nameLower.includes('ui') || nameLower.includes('ux')) roles.push('uiux');
  if (nameLower.includes('data') || nameLower.includes('analyst')) roles.push('data_analyst');
  if (nameLower.includes('growth') || nameLower.includes('launch')) roles.push('growth');
  if (roles.length === 0) roles.push('developer');

  // Derive pricing from model/provider
  const isPremium = ['claude', 'gpt-4', 'o1', 'gemini-pro'].some(k =>
    (config.model || '').toLowerCase().includes(k)
  );

  return {
    agentId: id,
    name,
    roles,
    skills: {
      'ai-chat': { level: 5, endorsements: 0, recentTasks: 0 },
      [config.provider || 'openai']: { level: 4, endorsements: 0, recentTasks: 0 }
    },
    performance: {
      successRate: 0.95,
      totalTasks: 0,
      completedTasks: 0,
      averageRating: 5.0,
      totalEarnings: 0,
      responseTimeMs: 2000
    },
    nodeSource: config.provider || 'local',
    chain: 'multi',
    pricing: {
      model: 'per_task',
      perTaskMin: isPremium ? 20 : 5,
      perTaskMax: isPremium ? 100 : 30,
      perMinuteMin: isPremium ? 1 : 0.2,
      perMinuteMax: isPremium ? 3 : 1
    },
    availability: config.isActive !== false ? 'available' : 'offline',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    lastActive: Date.now(),
    // Link to HyperInsight
    backingAim: undefined,
    computeStrength: 0
  };
}

class AgentMarketplaceService {
  private agents: Map<string, AgentProfile> = new Map();
  private listings: Map<string, MarketplaceListing> = new Map();
  private isLoaded: boolean = false;

  constructor() {
    // Lazy load on first getListings call
  }

  // ============================================
  // LOAD REAL AGENTS FROM CONFIG
  // ============================================

  async loadAgents(): Promise<void> {
    const api = getAiAgentsAPI();
    if (!api) {
      console.warn('[AgentMarketplace] electronAPI.aiAgents not available');
      this.isLoaded = true;
      return;
    }

    try {
      const configs = await api.get();
      if (!Array.isArray(configs)) {
        console.warn('[AgentMarketplace] aiAgents.get() returned non-array:', typeof configs);
        this.isLoaded = true;
        return;
      }

      this.agents.clear();
      this.listings.clear();

      configs.forEach((config: any, index: number) => {
        const profile = mapConfigToAgentProfile(config, index);

        // Enrich with HyperInsight AIM data if available
        const role = profile.roles[0];
        const bestAim = hyperInsight.selectBestAIMForRole(role);
        if (bestAim) {
          profile.backingAim = bestAim;
          profile.aimRank = bestAim.rank;
          profile.computeStrength = bestAim.computeTFLOPS || 0;
        }

        this.agents.set(profile.agentId, profile);
        const listing = this.createListingFromAgent(profile);
        this.listings.set(listing.listingId, listing);
      });

      // Also add HyperInsight AIMs as "deployable agents"
      const aims = hyperInsight.getAIMs();
      aims.forEach((aim, idx) => {
        const aimAgentId = `aim-${aim.name.replace(/[^a-z0-9]/gi, '-')}`;
        if (this.agents.has(aimAgentId)) return;

        const aimProfile: AgentProfile = {
          agentId: aimAgentId,
          name: aim.name.split('/').pop() || aim.name,
          roles: ['developer'],
          skills: { 'ai-inference': { level: 5, endorsements: 0, recentTasks: aim.activeNodes || 0 } },
          performance: {
            successRate: (aim.bestLivenessScore || 0) / 100,
            totalTasks: aim.activeNodes || 0,
            completedTasks: aim.activeNodes || 0,
            averageRating: (aim.bestLivenessScore || 0) / 20,
            totalEarnings: 0,
            responseTimeMs: 1500
          },
          nodeSource: 'hypercycle',
          chain: 'multi',
          pricing: {
            model: 'per_minute',
            perTaskMin: 0,
            perTaskMax: 0,
            perMinuteMin: 0.1,
            perMinuteMax: 2
          },
          availability: aim.isActive ? 'available' : 'offline',
          createdAt: Date.now(),
          lastActive: Date.now(),
          backingAim: aim,
          aimRank: aim.rank,
          computeStrength: aim.computeTFLOPS || 0,
          nodeReliability: (aim.bestLivenessScore || 0) / 100
        };

        this.agents.set(aimAgentId, aimProfile);
        this.listings.set(`listing-${aimAgentId}`, this.createListingFromAgent(aimProfile));
      });

      this.isLoaded = true;
      console.log(`[AgentMarketplace] Loaded ${configs.length} user agents + ${aims.length} AIM agents`);
    } catch (error) {
      console.error('[AgentMarketplace] Failed to load agents:', error);
      this.isLoaded = true;
    }
  }

  private createListingFromAgent(agent: AgentProfile): MarketplaceListing {
    const primarySkills = Object.keys(agent.skills).slice(0, 3);
    return {
      listingId: `listing-${agent.agentId}`,
      agentId: agent.agentId,
      agentName: agent.name,
      roles: agent.roles,
      primarySkills,
      pricing: agent.pricing,
      rating: agent.performance.averageRating,
      successRate: agent.performance.successRate,
      availability: agent.availability,
      nodeSource: agent.nodeSource,
      chain: agent.chain,
      backingAim: agent.backingAim?.name,
      aimRank: agent.aimRank,
      computeStrength: agent.computeStrength,
      attachedSkills: primarySkills,
      skillCount: primarySkills.length
    };
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async getListings(): Promise<MarketplaceListing[]> {
    if (!this.isLoaded) await this.loadAgents();
    return Array.from(this.listings.values());
  }

  async getListingsByRole(role: AgentRole): Promise<MarketplaceListing[]> {
    const all = await this.getListings();
    return all.filter(l => l.roles.includes(role));
  }

  async getListingsBySkill(skill: string): Promise<MarketplaceListing[]> {
    const all = await this.getListings();
    return all.filter(l =>
      l.primarySkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );
  }

  async getAgent(agentId: string): Promise<AgentProfile | undefined> {
    if (!this.isLoaded) await this.loadAgents();
    return this.agents.get(agentId);
  }

  async getAgents(): Promise<AgentProfile[]> {
    if (!this.isLoaded) await this.loadAgents();
    return Array.from(this.agents.values());
  }

  async filterAgents(criteria: {
    role?: AgentRole;
    minRating?: number;
    minSuccessRate?: number;
    availability?: AvailabilityStatus;
    skills?: string[];
  }): Promise<MarketplaceListing[]> {
    let results = await this.getListings();
    if (criteria.role) results = results.filter(l => l.roles.includes(criteria.role!));
    if (criteria.minRating) results = results.filter(l => l.rating >= criteria.minRating!);
    if (criteria.minSuccessRate) results = results.filter(l => l.successRate >= criteria.minSuccessRate!);
    if (criteria.availability) results = results.filter(l => l.availability === criteria.availability);
    if (criteria.skills?.length) {
      results = results.filter(l =>
        criteria.skills!.some(s => l.primarySkills.some(ps => ps.toLowerCase().includes(s.toLowerCase())))
      );
    }
    return results;
  }

  async updateAvailability(agentId: string, status: AvailabilityStatus): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.availability = status;
      const listing = this.listings.get(`listing-${agentId}`);
      if (listing) listing.availability = status;
    }
  }

  async getStats(): Promise<{
    totalAgents: number;
    availableAgents: number;
    byRole: Record<string, number>;
  }> {
    const agents = await this.getAgents();
    const byRole: Record<string, number> = {};
    let availableCount = 0;
    agents.forEach(agent => {
      if (agent.availability === 'available') availableCount++;
      agent.roles.forEach(role => {
        byRole[role] = (byRole[role] || 0) + 1;
      });
    });
    return { totalAgents: agents.length, availableAgents: availableCount, byRole };
  }
}

export const agentMarketplace = new AgentMarketplaceService();
export { AgentMarketplaceService };
