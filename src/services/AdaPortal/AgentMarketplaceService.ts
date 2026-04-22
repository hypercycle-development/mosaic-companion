// ============================================
// ADA PORTAL - Agent Marketplace Service
// Layer 1: Skill-based AI agent marketplace
// UPGRADED: Claw Code patterns - AgentRegistry, PermissionContext, TurnResult
// UPGRADED: SkillMarketplace integration for skills.sh
// ============================================

import { 
  AgentProfile, 
  MarketplaceListing, 
  AgentRole, 
  PricingModel,
  AvailabilityStatus,
  SkillProfile,
  PerformanceMetrics,
  AgentPricing,
  AIMInfo
} from './types';
import { hyperInsight } from './HyperInsightService';
import { skillMarketplace, SkillInfo } from './SkillMarketplaceService';
import { 
  AgentModule, 
  AgentStatus, 
  AgentPermissionGate,
  AgentQueryEngine,
  RoutedMatch,
  PermissionContext,
  agentRegistry,
  agentQueryEngine
} from '../AgentRegistry';

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
  },
  // Additional agents to reach 15
  {
    agentId: 'agent-community-001',
    name: 'CommunityKing',
    roles: ['marketing'],
    skills: {
      'community-management': { level: 5, endorsements: 95, recentTasks: 234 },
      'telegram-marketing': { level: 5, endorsements: 78, recentTasks: 189 },
      'discord-bot': { level: 4, endorsements: 45, recentTasks: 98 }
    },
    performance: {
      successRate: 0.93,
      totalTasks: 423,
      completedTasks: 394,
      averageRating: 4.8,
      totalEarnings: 7800,
      responseTimeMs: 1500
    },
    nodeSource: 'hypercycle',
    chain: 'telegram',
    pricing: {
      model: 'per_task',
      perTaskMin: 20,
      perTaskMax: 75,
      perMinuteMin: 0.6,
      perMinuteMax: 2.5
    },
    availability: 'available',
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-solidity-001',
    name: 'SoliditySage',
    roles: ['developer'],
    skills: {
      'smart-contracts': { level: 5, endorsements: 134, recentTasks: 312 },
      'security-audit': { level: 4, endorsements: 67, recentTasks: 89 },
      'defi-protocols': { level: 5, endorsements: 98, recentTasks: 234 }
    },
    performance: {
      successRate: 0.96,
      totalTasks: 567,
      completedTasks: 544,
      averageRating: 4.9,
      totalEarnings: 18900,
      responseTimeMs: 4500
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 50,
      perTaskMax: 250,
      perMinuteMin: 2,
      perMinuteMax: 8
    },
    availability: 'busy',
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-front-end-001',
    name: 'PixelPerfect',
    roles: ['uiux'],
    skills: {
      'react-development': { level: 5, endorsements: 89, recentTasks: 198 },
      'web3-integration': { level: 4, endorsements: 56, recentTasks: 123 },
      'animation': { level: 5, endorsements: 72, recentTasks: 167 }
    },
    performance: {
      successRate: 0.94,
      totalTasks: 345,
      completedTasks: 324,
      averageRating: 4.7,
      totalEarnings: 11200,
      responseTimeMs: 2200
    },
    nodeSource: 'hypercycle',
    chain: 'base',
    pricing: {
      model: 'per_task',
      perTaskMin: 30,
      perTaskMax: 120,
      perMinuteMin: 1,
      perMinuteMax: 4
    },
    availability: 'available',
    createdAt: Date.now() - 55 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-analytics-001',
    name: 'MetricMaster',
    roles: ['data_analyst'],
    skills: {
      'on-chain-analysis': { level: 5, endorsements: 78, recentTasks: 189 },
      'defi-analytics': { level: 5, endorsements: 89, recentTasks: 234 },
      'nft-analytics': { level: 4, endorsements: 45, recentTasks: 98 }
    },
    performance: {
      successRate: 0.92,
      totalTasks: 289,
      completedTasks: 266,
      averageRating: 4.6,
      totalEarnings: 8900,
      responseTimeMs: 3800
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 25,
      perTaskMax: 100,
      perMinuteMin: 0.8,
      perMinuteMax: 3.5
    },
    availability: 'available',
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-seo-001',
    name: 'SEOSuperstar',
    roles: ['growth'],
    skills: {
      'seo-optimization': { level: 5, endorsements: 67, recentTasks: 156 },
      'content-strategy': { level: 4, endorsements: 43, recentTasks: 89 },
      'backlink-building': { level: 5, endorsements: 78, recentTasks: 178 }
    },
    performance: {
      successRate: 0.90,
      totalTasks: 234,
      completedTasks: 211,
      averageRating: 4.4,
      totalEarnings: 5600,
      responseTimeMs: 3200
    },
    nodeSource: 'hypercycle',
    chain: 'web2',
    pricing: {
      model: 'per_task',
      perTaskMin: 20,
      perTaskMax: 80,
      perMinuteMin: 0.5,
      perMinuteMax: 2
    },
    availability: 'available',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-copy-001',
    name: 'WordSmith',
    roles: ['marketing'],
    skills: {
      'copywriting': { level: 5, endorsements: 112, recentTasks: 267 },
      'technical-writing': { level: 4, endorsements: 56, recentTasks: 123 },
      'whitepaper-writing': { level: 5, endorsements: 89, recentTasks: 198 }
    },
    performance: {
      successRate: 0.95,
      totalTasks: 456,
      completedTasks: 433,
      averageRating: 4.8,
      totalEarnings: 12300,
      responseTimeMs: 1800
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 25,
      perTaskMax: 100,
      perMinuteMin: 0.8,
      perMinuteMax: 3
    },
    availability: 'available',
    createdAt: Date.now() - 65 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-backend-001',
    name: 'ServerSage',
    roles: ['developer'],
    skills: {
      'backend-development': { level: 5, endorsements: 98, recentTasks: 234 },
      'api-development': { level: 5, endorsements: 87, recentTasks: 198 },
      'database-design': { level: 4, endorsements: 54, recentTasks: 112 }
    },
    performance: {
      successRate: 0.93,
      totalTasks: 378,
      completedTasks: 352,
      averageRating: 4.6,
      totalEarnings: 9800,
      responseTimeMs: 3500
    },
    nodeSource: 'hypercycle',
    chain: 'multi',
    pricing: {
      model: 'per_task',
      perTaskMin: 35,
      perTaskMax: 150,
      perMinuteMin: 1.2,
      perMinuteMax: 5
    },
    availability: 'available',
    createdAt: Date.now() - 70 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-nft-001',
    name: 'NFTNinja',
    roles: ['developer', 'uiux'],
    skills: {
      'nft-minting': { level: 5, endorsements: 89, recentTasks: 198 },
      'metadata-ipfs': { level: 4, endorsements: 45, recentTasks: 89 },
      'marketplace-dev': { level: 5, endorsements: 67, recentTasks: 145 }
    },
    performance: {
      successRate: 0.94,
      totalTasks: 312,
      completedTasks: 293,
      averageRating: 4.7,
      totalEarnings: 8900,
      responseTimeMs: 2800
    },
    nodeSource: 'hypercycle',
    chain: 'multi',
    pricing: {
      model: 'per_task',
      perTaskMin: 40,
      perTaskMax: 180,
      perMinuteMin: 1.5,
      perMinuteMax: 6
    },
    availability: 'available',
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-research-001',
    name: 'DeepDive',
    roles: ['data_analyst'],
    skills: {
      'market-research': { level: 5, endorsements: 76, recentTasks: 167 },
      'competitor-analysis': { level: 4, endorsements: 43, recentTasks: 89 },
      'tokenomics': { level: 5, endorsements: 67, recentTasks: 134 }
    },
    performance: {
      successRate: 0.91,
      totalTasks: 234,
      completedTasks: 213,
      averageRating: 4.5,
      totalEarnings: 6700,
      responseTimeMs: 4200
    },
    nodeSource: 'hypercycle',
    chain: 'ethereum',
    pricing: {
      model: 'per_task',
      perTaskMin: 30,
      perTaskMax: 120,
      perMinuteMin: 1,
      perMinuteMax: 4
    },
    availability: 'available',
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-launch-001',
    name: 'TokenLaunch',
    roles: ['growth', 'marketing'],
    skills: {
      'token-launch': { level: 5, endorsements: 134, recentTasks: 289 },
      'ico-ieo': { level: 5, endorsements: 98, recentTasks: 212 },
      'marketing-campaign': { level: 5, endorsements: 87, recentTasks: 198 }
    },
    performance: {
      successRate: 0.92,
      totalTasks: 567,
      completedTasks: 522,
      averageRating: 4.8,
      totalEarnings: 21500,
      responseTimeMs: 2400
    },
    nodeSource: 'hypercycle',
    chain: 'multi',
    pricing: {
      model: 'per_task',
      perTaskMin: 50,
      perTaskMax: 300,
      perMinuteMin: 2,
      perMinuteMax: 10
    },
    availability: 'busy',
    createdAt: Date.now() - 80 * 24 * 60 * 60 * 1000,
    lastActive: Date.now()
  },
  {
    agentId: 'agent-security-001',
    name: 'SecureChain',
    roles: ['developer'],
    skills: {
      'smart-contract-security': { level: 5, endorsements: 156, recentTasks: 345 },
      'penetration-testing': { level: 5, endorsements: 89, recentTasks: 178 },
      'formal-verification': { level: 4, endorsements: 45, recentTasks: 67 }
    },
    performance: {
      successRate: 0.98,
      totalTasks: 456,
      completedTasks: 447,
      averageRating: 4.9,
      totalEarnings: 27800,
      responseTimeMs: 5500
    },
    nodeSource: 'hypercycle',
    chain: 'multi',
    pricing: {
      model: 'per_task',
      perTaskMin: 75,
      perTaskMax: 500,
      perMinuteMin: 3,
      perMinuteMax: 15
    },
    availability: 'available',
    createdAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
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
      
      // Auto-attach relevant skills from skills.sh based on agent role
      this.attachSkillsToAgent(agent);
    });
    console.log(`[AdaPortal] Initialized ${this.agents.size} demo agents with skills.sh integration`);
  }

  /**
   * Attach relevant skills.sh skills to an agent based on their role
   */
  private attachSkillsToAgent(agent: AgentProfile): void {
    const role = agent.roles[0];
    const recommendedSkills = skillMarketplace.getSkillsForRole(role);
    
    // Attach top 3 skills for each agent
    recommendedSkills.slice(0, 3).forEach((skill, index) => {
      const proficiency = 5 - index; // Higher relevance = higher proficiency
      skillMarketplace.attachSkillToAgent(skill.name, agent.agentId, proficiency);
    });
    
    console.log(`[AdaPortal] Attached ${Math.min(3, recommendedSkills.length)} skills to ${agent.name}`);
  }

  private createListingFromAgent(agent: AgentProfile): MarketplaceListing {
    const primarySkills = Object.keys(agent.skills).slice(0, 3);
    
    // Enrich with real AIM data from HyperInsight
    const role = agent.roles[0];
    const backingAim = hyperInsight.selectBestAIMForRole(role);
    
    // Get attached skills from skills.sh
    const attachedSkills = skillMarketplace.getAgentSkills(agent.agentId).map(s => s.name);
    
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
      // Enriched with real HyperInsight data
      backingAim: backingAim?.name,
      aimRank: backingAim?.rank,
      computeStrength: backingAim?.computeTFLOPS,
      // skills.sh integration
      attachedSkills,
      skillCount: attachedSkills.length
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

  // ============================================
  // CLAW CODE PATTERN: Agent Registration
  // ============================================

  /**
   * Register all agents with the AgentRegistry
   * Enables permission gating + execution hooks
   */
  registerWithRegistry(context: PermissionContext): void {
    this.agents.forEach((agent, agentId) => {
      const module: AgentModule = {
        id: agentId,
        name: agent.name,
        role: agent.roles[0] || 'general',
        responsibility: `Specialized in: ${Object.keys(agent.skills).slice(0, 3).join(', ')}`,
        source_hint: agent.nodeSource,
        status: this.mapStatus(agent.availability),
        capabilities: Object.keys(agent.skills),
        permissions: this.inferPermissions(agent.roles),
        metadata: {
          chain: agent.chain,
          pricing: agent.pricing,
          performance: agent.performance
        }
      };
      
      agentRegistry.register(module);
      agentQueryEngine.registerAgent(module);
      
      console.log(`[AgentMarketplace] Registered: ${agent.name} (${module.source_hint})`);
    });
    
    console.log(`[AgentMarketplace] Registered ${this.agents.size} agents with registry`);
  }

  private mapStatus(availability: AvailabilityStatus): AgentStatus {
    switch (availability) {
      case 'available': return 'native';
      case 'busy': return 'ported';
      case 'offline': return 'mirrored';
      default: return 'mirrored';
    }
  }

  private inferPermissions(roles: AgentRole[]): string[] {
    const perms: string[] = ['chat:read', 'chat:send'];
    
    if (roles.includes('developer')) {
      perms.push('mcp:read', 'code:analyze');
    }
    if (roles.includes('marketing')) {
      perms.push('content:create', 'social:post');
    }
    
    return perms;
  }

  // ============================================
  // CLAW CODE PATTERN: Query Engine Routing
  // ============================================

  /**
   * Route a user prompt to the best matching agents
   * Uses token-based confidence scoring
   */
  routePrompt(prompt: string, limit: number = 3): RoutedMatch[] {
    return agentQueryEngine.routePrompt(prompt, limit);
  }

  // ============================================
  // CLAW CODE PATTERN: Permission Check
  // ============================================

  /**
   * Check if an action is permitted for given context
   */
  checkPermission(action: string, context: PermissionContext): boolean {
    return !AgentPermissionGate.blocks(action, context);
  }

  /**
   * Get list of agents that would be denied for context
   */
  getDeniedAgents(context: PermissionContext): { agentId: string; reason: string }[] {
    const modules = Array.from(this.agents.values()).map(a => ({
      id: a.agentId,
      name: a.name,
      role: a.roles[0] || 'general',
      responsibility: `Specialized in: ${Object.keys(a.skills).slice(0, 3).join(', ')}`,
      source_hint: a.nodeSource,
      status: 'native' as AgentStatus,
      capabilities: Object.keys(a.skills),
      permissions: this.inferPermissions(a.roles),
      metadata: {}
    })) as AgentModule[];
    
    return AgentPermissionGate.inferDenials(modules);
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