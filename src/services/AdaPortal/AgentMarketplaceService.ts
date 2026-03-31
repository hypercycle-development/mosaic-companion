// ============================================
// ADA PORTAL - Agent Marketplace Service
// Layer 1: Skill-based AI agent marketplace
// ============================================

import { 
  AgentProfile, 
  MarketplaceListing, 
  AgentRole, 
  PricingModel,
  AvailabilityStatus,
  SkillProfile,
  PerformanceMetrics,
  AgentPricing
} from './types';

// Demo specialized agents
const DEMO_AGENTS: AgentProfile[] = [
  {
    agentId: 'agent-marketing-001',
    name: 'CryptoMark',
    roles: ['marketing'],
    skills: {
      'content-creation': { level: 4, endorsements: 28, recentTasks: 45 },
      'social-media': { level: 5, endorsements: 52, recentTasks: 120 },
      'community-management': { level: 4, endorsements: 31, recentTasks: 67 }
    },
    performance: {
      successRate: 0.94,
      totalTasks: 156,
      completedTasks: 147,
      averageRating: 4.8,
      totalEarnings: 4500,
      responseTimeMs: 2500
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 15,
      perTaskMax: 50,
      perMinuteMin: 0.5,
      perMinuteMax: 2
    },
    availability: 'available',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-dev-001',
    name: 'CodeCraft',
    roles: ['developer'],
    skills: {
      'smart-contracts': { level: 5, endorsements: 89, recentTasks: 234 },
      'solidity': { level: 5, endorsements: 112, recentTasks: 312 },
      'typescript': { level: 4, endorsements: 67, recentTasks: 189 }
    },
    performance: {
      successRate: 0.97,
      totalTasks: 445,
      completedTasks: 432,
      averageRating: 4.9,
      totalEarnings: 12500,
      responseTimeMs: 3200
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 30,
      perTaskMax: 150,
      perMinuteMin: 1,
      perMinuteMax: 5
    },
    availability: 'available',
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-uiux-001',
    name: 'DesignFlow',
    roles: ['uiux'],
    skills: {
      'ui-design': { level: 5, endorsements: 73, recentTasks: 167 },
      'ux-research': { level: 4, endorsements: 45, recentTasks: 89 },
      'figma': { level: 5, endorsements: 91, recentTasks: 203 }
    },
    performance: {
      successRate: 0.92,
      totalTasks: 278,
      completedTasks: 256,
      averageRating: 4.7,
      totalEarnings: 8200,
      responseTimeMs: 1800
    },
    nodeSource: 'hypercycle',
    chain: 'base',
    pricing: {
      model: 'per_task',
      perTaskMin: 25,
      perTaskMax: 100,
      perMinuteMin: 0.8,
      perMinuteMax: 3.5
    },
    availability: 'available',
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-data-001',
    name: 'DataPulse',
    roles: ['data_analyst'],
    skills: {
      'data-analysis': { level: 5, endorsements: 56, recentTasks: 134 },
      'visualization': { level: 4, endorsements: 42, recentTasks: 98 },
      'python': { level: 4, endorsements: 38, recentTasks: 87 }
    },
    performance: {
      successRate: 0.95,
      totalTasks: 189,
      completedTasks: 180,
      averageRating: 4.6,
      totalEarnings: 5600,
      responseTimeMs: 4100
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 20,
      perTaskMax: 80,
      perMinuteMin: 0.6,
      perMinuteMax: 2.5
    },
    availability: 'busy',
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-growth-001',
    name: 'GrowthRocket',
    roles: ['growth'],
    skills: {
      'growth-strategy': { level: 5, endorsements: 81, recentTasks: 198 },
      'analytics': { level: 4, endorsements: 54, recentTasks: 145 },
      'conversion-optimization': { level: 5, endorsements: 67, recentTasks: 178 }
    },
    performance: {
      successRate: 0.91,
      totalTasks: 312,
      completedTasks: 284,
      averageRating: 4.5,
      totalEarnings: 9800,
      responseTimeMs: 2800
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 35,
      perTaskMax: 120,
      perMinuteMin: 1.2,
      perMinuteMax: 4
    },
    availability: 'available',
    createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  }
];

class AgentMarketplaceService {
  private agents: Map<string, AgentProfile> = new Map();
  private listings: Map<string, MarketplaceListing> = new Map();

  constructor() {
    this.initializeDemoAgents();
  }

  private initializeDemoAgents(): void {
    DEMO_AGENTS.forEach(agent => {
      this.agents.set(agent.agentId, agent);
      const listing = this.createListingFromAgent(agent);
      this.listings.set(listing.listingId, listing);
    });
    console.log(`[AdaPortal] Initialized ${this.agents.size} demo agents`);
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
      chain: agent.chain
    };
  }

  // Get all marketplace listings
  getListings(): MarketplaceListing[] {
    return Array.from(this.listings.values());
  }

  // Get listings filtered by role
  getListingsByRole(role: AgentRole): MarketplaceListing[] {
    return Array.from(this.listings.values()).filter(l => l.roles.includes(role));
  }

  // Get listings filtered by skill
  getListingsBySkill(skill: string): MarketplaceListing[] {
    return Array.from(this.listings.values()).filter(l => 
      l.primarySkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );
  }

  // Get agent profile by ID
  getAgent(agentId: string): AgentProfile | undefined {
    return this.agents.get(agentId);
  }

  // Get all agents
  getAgents(): AgentProfile[] {
    return Array.from(this.agents.values());
  }

  // Filter agents by multiple criteria
  filterAgents(criteria: {
    role?: AgentRole;
    minRating?: number;
    minSuccessRate?: number;
    availability?: AvailabilityStatus;
    skills?: string[];
  }): MarketplaceListing[] {
    let results = Array.from(this.listings.values());
    
    if (criteria.role) {
      results = results.filter(l => l.roles.includes(criteria.role!));
    }
    if (criteria.minRating) {
      results = results.filter(l => l.rating >= criteria.minRating!);
    }
    if (criteria.minSuccessRate) {
      results = results.filter(l => l.successRate >= criteria.minSuccessRate!);
    }
    if (criteria.availability) {
      results = results.filter(l => l.availability === criteria.availability);
    }
    if (criteria.skills?.length) {
      results = results.filter(l => 
        criteria.skills!.some(s => l.primarySkills.some(ps => ps.toLowerCase().includes(s.toLowerCase())))
      );
    }
    
    return results;
  }

  // Update agent availability
  updateAvailability(agentId: string, status: AvailabilityStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.availability = status;
      const listing = this.listings.get(`listing-${agentId}`);
      if (listing) {
        listing.availability = status;
      }
    }
  }

  // Get marketplace stats
  getStats(): {
    totalAgents: number;
    availableAgents: number;
    byRole: Record<string, number>;
  } {
    const byRole: Record<string, number> = {};
    let availableCount = 0;

    this.agents.forEach(agent => {
      if (agent.availability === 'available') availableCount++;
      agent.roles.forEach(role => {
        byRole[role] = (byRole[role] || 0) + 1;
      });
    });

    return {
      totalAgents: this.agents.size,
      availableAgents: availableCount,
      byRole
    };
  }
}

export const agentMarketplace = new AgentMarketplaceService();
export { AgentMarketplaceService };