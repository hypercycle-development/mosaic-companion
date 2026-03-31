// ============================================
// LAYER 1: AGENT MARKETPLACE SERVICE
// Skill-Based Hiring System
// ============================================

import type {
  AgentProfile,
  AgentRole,
  MarketplaceListing,
  PerformanceMetrics,
  SkillProfile,
  PricingModel,
  AvailabilityStatus
} from './types';
import { HYPERCYCLE_CONFIG } from './hypercycleConfig';

// In-memory agent registry
const agentRegistry = new Map<string, AgentProfile>();
const marketplaceListings = new Map<string, MarketplaceListing>();

// Default skills per role
const DEFAULT_SKILLS: Record<AgentRole, string[]> = {
  marketing: ['content_creation', 'seo', 'social_media', 'email_marketing', 'analytics'],
  developer: ['frontend', 'backend', 'devops', 'api_design', 'testing'],
  uiux: ['ui_design', 'ux_research', 'prototyping', 'accessibility', 'design_systems'],
  data_analyst: ['data Visualization', 'statistical_analysis', 'sql', 'python', 'reporting'],
  growth: ['conversion_optimization', 'ab_testing', 'funnel_analysis', 'cohort_analysis', 'attribution']
};

// Initialize with demo agents
function initializeDemoAgents(): void {
  const demoAgents: AgentProfile[] = [
    {
      agentId: 'agent_marketing_001',
      name: 'Marketing Maven',
      roles: ['marketing'],
      skills: {
        content_creation: { level: 4, endorsements: 28, recentTasks: 45 },
        seo: { level: 3, endorsements: 15, recentTasks: 30 },
        social_media: { level: 5, endorsements: 42, recentTasks: 60 },
        email_marketing: { level: 4, endorsements: 22, recentTasks: 35 },
        analytics: { level: 3, endorsements: 18, recentTasks: 25 }
      },
      performance: {
        successRate: 0.89,
        totalTasks: 156,
        completedTasks: 139,
        averageRating: 4.7,
        totalEarnings: 4500,
        responseTimeMs: 2300
      },
      nodeSource: 'hc_node_eth_001',
      chain: 'ethereum',
      pricing: {
        model: 'per_task',
        perTaskMin: 15,
        perTaskMax: 150,
        perMinuteMin: 0.5,
        perMinuteMax: 2.5
      },
      availability: 'available',
      createdAt: Date.now() - 86400000 * 30,
      lastActive: Date.now() - 300000
    },
    {
      agentId: 'agent_dev_001',
      name: 'Code Craftsman',
      roles: ['developer'],
      skills: {
        frontend: { level: 5, endorsements: 56, recentTasks: 80 },
        backend: { level: 4, endorsements: 38, recentTasks: 65 },
        devops: { level: 3, endorsements: 20, recentTasks: 40 },
        api_design: { level: 5, endorsements: 45, recentTasks: 55 },
        testing: { level: 4, endorsements: 30, recentTasks: 50 }
      },
      performance: {
        successRate: 0.94,
        totalTasks: 234,
        completedTasks: 220,
        averageRating: 4.9,
        totalEarnings: 8200,
        responseTimeMs: 1800
      },
      nodeSource: 'hc_node_base_001',
      chain: 'base',
      pricing: {
        model: 'per_task',
        perTaskMin: 30,
        perTaskMax: 500,
        perMinuteMin: 1.0,
        perMinuteMax: 5.0
      },
      availability: 'available',
      createdAt: Date.now() - 86400000 * 45,
      lastActive: Date.now() - 120000
    },
    {
      agentId: 'agent_uiux_001',
      name: 'Pixel Perfect',
      roles: ['uiux'],
      skills: {
        ui_design: { level: 5, endorsements: 62, recentTasks: 70 },
        ux_research: { level: 4, endorsements: 35, recentTasks: 45 },
        prototyping: { level: 5, endorsements: 48, recentTasks: 60 },
        accessibility: { level: 4, endorsements: 25, recentTasks: 35 },
        design_systems: { level: 4, endorsements: 30, recentTasks: 40 }
      },
      performance: {
        successRate: 0.91,
        totalTasks: 189,
        completedTasks: 172,
        averageRating: 4.8,
        totalEarnings: 6100,
        responseTimeMs: 2500
      },
      nodeSource: 'hc_node_eth_001',
      chain: 'ethereum',
      pricing: {
        model: 'per_task',
        perTaskMin: 25,
        perTaskMax: 300,
        perMinuteMin: 0.8,
        perMinuteMax: 4.0
      },
      availability: 'available',
      createdAt: Date.now() - 86400000 * 60,
      lastActive: Date.now() - 600000
    },
    {
      agentId: 'agent_data_001',
      name: 'Data Dynamo',
      roles: ['data_analyst'],
      skills: {
        data_Visualization: { level: 5, endorsements: 40, recentTasks: 50 },
        statistical_analysis: { level: 4, endorsements: 28, recentTasks: 35 },
        sql: { level: 5, endorsements: 55, recentTasks: 70 },
        python: { level: 4, endorsements: 32, recentTasks: 45 },
        reporting: { level: 5, endorsements: 45, recentTasks: 55 }
      },
      performance: {
        successRate: 0.92,
        totalTasks: 198,
        completedTasks: 182,
        averageRating: 4.6,
        totalEarnings: 5200,
        responseTimeMs: 3200
      },
      nodeSource: 'hc_node_base_002',
      chain: 'base',
      pricing: {
        model: 'per_task',
        perTaskMin: 20,
        perTaskMax: 250,
        perMinuteMin: 0.7,
        perMinuteMax: 3.5
      },
      availability: 'available',
      createdAt: Date.now() - 86400000 * 25,
      lastActive: Date.now() - 180000
    },
    {
      agentId: 'agent_growth_001',
      name: 'Growth Guru',
      roles: ['growth'],
      skills: {
        conversion_optimization: { level: 5, endorsements: 50, recentTasks: 65 },
        ab_testing: { level: 5, endorsements: 42, recentTasks: 55 },
        funnel_analysis: { level: 4, endorsements: 30, recentTasks: 40 },
        cohort_analysis: { level: 4, endorsements: 25, recentTasks: 35 },
        attribution: { level: 3, endorsements: 18, recentTasks: 25 }
      },
      performance: {
        successRate: 0.87,
        totalTasks: 145,
        completedTasks: 126,
        averageRating: 4.5,
        totalEarnings: 3800,
        responseTimeMs: 2100
      },
      nodeSource: 'hc_node_base_001',
      chain: 'base',
      pricing: {
        model: 'per_task',
        perTaskMin: 25,
        perTaskMax: 200,
        perMinuteMin: 0.9,
        perMinuteMax: 3.0
      },
      availability: 'busy',
      createdAt: Date.now() - 86400000 * 20,
      lastActive: Date.now() - 600000
    }
  ];

  demoAgents.forEach(agent => {
    agentRegistry.set(agent.agentId, agent);
    const listing = createListingFromAgent(agent);
    marketplaceListings.set(listing.listingId, listing);
  });

  console.log(`[AgentMarketplace] Initialized ${demoAgents.length} demo agents`);
}

function createListingFromAgent(agent: AgentProfile): MarketplaceListing {
  const primarySkills = Object.entries(agent.skills)
    .sort((a, b) => b[1].level - a[1].level)
    .slice(0, 3)
    .map(([skill]) => skill);

  return {
    listingId: `listing_${agent.agentId}`,
    agentId: agent.agentId,
    agentName: agent.name,
    roles: agent.roles,
    primarySkills,
    pricing: agent.pricing,
    rating: agent.performance.averageRating,
    successRate: agent.performance.successRate,
    availability: agent.availability
  };
}

export class AgentMarketplaceService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;
    initializeDemoAgents();
    this.initialized = true;
  }

  // Get all marketplace listings
  getListings(filters?: {
    role?: AgentRole;
    minRating?: number;
    availability?: AvailabilityStatus;
  }): MarketplaceListing[] {
    let listings = Array.from(marketplaceListings.values());

    if (filters?.role) {
      listings = listings.filter(l => l.roles.includes(filters.role!));
    }
    if (filters?.minRating) {
      listings = listings.filter(l => l.rating >= filters.minRating!);
    }
    if (filters?.availability) {
      listings = listings.filter(l => l.availability === filters.availability!);
    }

    return listings.sort((a, b) => b.rating - a.rating);
  }

  // Get agent by ID
  getAgent(agentId: string): AgentProfile | null {
    return agentRegistry.get(agentId) || null;
  }

  // Select best agent for role + skills
  selectBestAgent(role: AgentRole, preferredSkills: string[], budget: number): AgentProfile | null {
    const listings = this.getListings({ role, availability: 'available' });
    
    let bestAgent: AgentProfile | null = null;
    let bestScore = -1;

    for (const listing of listings) {
      const agent = this.getAgent(listing.agentId);
      if (!agent) continue;

      // Check budget
      const avgPrice = (agent.pricing.perTaskMin + agent.pricing.perTaskMax) / 2;
      if (avgPrice > budget) continue;

      // Calculate skill match score
      let skillScore = 0;
      for (const prefSkill of preferredSkills) {
        const skillLevel = agent.skills[prefSkill];
        if (skillLevel) {
          skillScore += skillLevel.level;
        }
      }

      // Combined score: skill match * rating * success rate
      const combinedScore = (skillScore / preferredSkills.length) * listing.rating * listing.successRate;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestAgent = agent;
      }
    }

    if (bestAgent) {
      console.log(`[AgentMarketplace] Selected agent: ${bestAgent.name} (score: ${bestScore.toFixed(2)})`);
    }

    return bestAgent;
  }

  // Register new agent
  registerAgent(agent: AgentProfile): void {
    agentRegistry.set(agent.agentId, agent);
    const listing = createListingFromAgent(agent);
    marketplaceListings.set(listing.listingId, listing);
    console.log(`[AgentMarketplace] Registered agent: ${agent.name}`);
  }

  // Update agent performance
  updatePerformance(agentId: string, update: Partial<PerformanceMetrics>): void {
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      console.warn(`[AgentMarketplace] Agent not found: ${agentId}`);
      return;
    }

    agent.performance = { ...agent.performance, ...update };
    const listing = marketplaceListings.get(`listing_${agentId}`);
    if (listing) {
      listing.rating = agent.performance.averageRating;
      listing.successRate = agent.performance.successRate;
    }
    console.log(`[AgentMarketplace] Updated performance for: ${agent.name}`);
  }

  // Update availability
  setAvailability(agentId: string, availability: AvailabilityStatus): void {
    const agent = agentRegistry.get(agentId);
    if (!agent) return;

    agent.availability = availability;
    const listing = marketplaceListings.get(`listing_${agentId}`);
    if (listing) {
      listing.availability = availability;
    }
  }

  // Get default skills for role
  getDefaultSkills(role: AgentRole): string[] {
    return DEFAULT_SKILLS[role] || [];
  }

  // Get all agents
  getAllAgents(): AgentProfile[] {
    return Array.from(agentRegistry.values());
  }
}

export const agentMarketplace = new AgentMarketplaceService();