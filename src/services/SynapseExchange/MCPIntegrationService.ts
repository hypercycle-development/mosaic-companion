// ============================================
// MCP INTEGRATION LAYER
// Skill-Based Routing + Multi-Market Execution
// ============================================

import type {
  AgentRole,
  MCPRoutingDecision,
  MCPSkillRouting,
  TaskContract
} from './types';
import { agentMarketplace } from './AgentMarketplaceService';
import { marketplaceAdapter } from './MarketplaceAdapterService';
import { agentEconomy } from './AgentEconomyService';
import { trainingMarketplace } from './TrainingMarketplaceService';
import { leaderboard } from './LeaderboardService';
import { skillGraph } from './SkillGraphService';
import { nodeIntelligence } from './NodeIntelligenceService';

export class MCPIntegrationService {
  constructor() {
    console.log('[MCPIntegration] Service initialized');
  }

  // ============================================
  // SKILL-BASED ROUTING
  // ============================================

  // Route task to best agent based on skills
  async routeBySkill(routing: MCPSkillRouting): Promise<MCPRoutingDecision> {
    const { requiredRoles, requiredSkills, budget } = routing;

    // Get best internal agent
    const bestAgent = agentMarketplace.selectBestAgent(
      requiredRoles[0],
      requiredSkills,
      budget
    );

    if (bestAgent) {
      const alternatives = agentMarketplace
        .getListings({ role: requiredRoles[0], availability: 'available' })
        .slice(1, 4)
        .map(l => l.agentId);

      const avgCost = (bestAgent.pricing.perTaskMin + bestAgent.pricing.perTaskMax) / 2;

      console.log(`[MCPIntegration] Routed to internal agent: ${bestAgent.name}`);
      
      return {
        selectedAgentId: bestAgent.agentId,
        alternativeAgents: alternatives,
        reasoning: `Selected ${bestAgent.name} based on skill match and performance`,
        estimatedCost: avgCost
      };
    }

    // Fallback to external marketplace
    const externalAgents = marketplaceAdapter.compareAgents(requiredSkills);
    
    if (externalAgents.length > 0) {
      const extAgent = externalAgents[0];
      console.log(`[MCPIntegration] Routed to external agent: ${extAgent.name}`);

      return {
        selectedAgentId: extAgent.externalAgentId,
        alternativeAgents: externalAgents.slice(1, 4).map(a => a.externalAgentId),
        reasoning: `Internal agent not available, selected external: ${extAgent.name}`,
        estimatedCost: extAgent.price
      };
    }

    // No agent available
    return {
      selectedAgentId: '',
      alternativeAgents: [],
      reasoning: 'No available agents match requirements',
      estimatedCost: 0
    };
  }

  // ============================================
  // MULTI-MARKET ROUTING
  // ============================================

  // Route to external marketplace
  async routeToMarket(
    agentId: string,
    task: string,
    marketplace: 'masumi' | 'sokosumi'
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    const result = await marketplaceAdapter.executeViaAdapter({
      adapter: marketplace,
      agentId,
      task,
      budget: 1000 // Default budget
    });

    return {
      success: result.success,
      result: result.result,
      error: result.error
    };
  }

  // Compare across markets
  compareMarkets(requiredSkills: string[]): {
    internal: { agentId: string; name: string; cost: number }[];
    masumi: { agentId: string; name: string; cost: number }[];
    sokosumi: { agentId: string; name: string; cost: number }[];
  } {
    const internal = agentMarketplace.getListings().slice(0, 5).map(l => ({
      agentId: l.agentId,
      name: l.agentName,
      cost: (l.pricing.perTaskMin + l.pricing.perTaskMax) / 2
    }));

    const external = marketplaceAdapter.compareAgents(requiredSkills);
    
    const masumi = external
      .filter(a => a.marketplace === 'masumi')
      .slice(0, 5)
      .map(a => ({ agentId: a.externalAgentId, name: a.name, cost: a.price }));

    const sokosumi = external
      .filter(a => a.marketplace === 'sokosumi')
      .slice(0, 5)
      .map(a => ({ agentId: a.externalAgentId, name: a.name, cost: a.price }));

    return { internal, masumi, sokosumi };
  }

  // ============================================
  // BUDGET ENFORCEMENT
  // ============================================

  // Check budget before execution
  checkBudget(agentId: string, budget: number): { allowed: boolean; estimatedCost: number; remaining: number } {
    const agent = agentMarketplace.getAgent(agentId);
    if (!agent) {
      return { allowed: false, estimatedCost: 0, remaining: 0 };
    }

    const estimatedCost = (agent.pricing.perTaskMin + agent.pricing.perTaskMax) / 2;
    const allowed = budget >= estimatedCost;

    return {
      allowed,
      estimatedCost,
      remaining: budget - estimatedCost
    };
  }

  // Reserve budget in escrow
  async reserveBudget(agentId: string, budget: number): Promise<{ success: boolean; reservationId?: string }> {
    // In production, this would interact with USDC escrow contract
    const reservationId = `reserve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[MCPIntegration] Reserved ${budget} USDC for ${agentId}: ${reservationId}`);
    return { success: true, reservationId };
  }

  // ============================================
  // AGENT-TO-AGENT EXECUTION
  // ============================================

  // Agent hires another agent
  executeAgentToAgent(
    fromAgentId: string,
    toAgentId: string,
    task: string,
    budget: number
  ): TaskContract {
    // Validate both agents exist
    const fromAgent = agentMarketplace.getAgent(fromAgentId);
    const toAgent = agentMarketplace.getAgent(toAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error('Invalid agent ID(s)');
    }

    // Check budget
    const budgetCheck = this.checkBudget(fromAgentId, budget);
    if (!budgetCheck.allowed) {
      throw new Error('Insufficient budget');
    }

    // Create contract
    const contract = agentEconomy.hireAgent(fromAgentId, toAgentId, task, budget);
    
    // Auto-accept and start (simulated)
    agentEconomy.acceptContract(contract.contractId);
    agentEconomy.startWork(contract.contractId);

    console.log(`[MCPIntegration] A2A execution: ${fromAgent.name} → ${toAgent.name}`);
    return contract;
  }

  // Complete A2A task
  completeAgentToAgent(contractId: string, result: string): TaskContract | null {
    const contract = agentEconomy.completeContract(contractId, result);
    
    if (contract) {
      // Update leaderboard
      leaderboard.updateScoresAfterTask(contract.toAgent, true, 4.5);
      
      // Track skill usage
      skillGraph.trackSkillUsage(contract.toAgent, 'general', true, 4.5);
    }

    return contract;
  }

  // ============================================
  // TRAINING EXECUTION
  // ============================================

  // Execute training
  async executeTraining(buyerAgentId: string, trainerAgentId: string): Promise<{
    success: boolean;
    improvements: { metric: string; before: number; after: number; delta: number }[];
  }> {
    // Validate agents
    const buyer = agentMarketplace.getAgent(buyerAgentId);
    const trainer = trainingMarketplace.getTrainer(trainerAgentId);

    if (!buyer) {
      return { success: false, improvements: [] };
    }

    if (!trainer) {
      return { success: false, improvements: [] };
    }

    // Purchase training
    const session = trainingMarketplace.purchaseTraining(buyerAgentId, trainer.listingId);
    if (!session) {
      return { success: false, improvements: [] };
    }

    // Apply strategy transfer
    const improvements = trainingMarketplace.applyStrategyTransfer(buyerAgentId, trainerAgentId);
    
    // Complete session
    trainingMarketplace.completeTraining(session.sessionId, improvements);

    // Record in skill graph
    skillGraph.recordImprovement(buyerAgentId, improvements);

    console.log(`[MCPIntegration] Training complete: ${buyer.name} trained by ${trainer.trainerName}`);

    return {
      success: true,
      improvements: improvements.map(imp => ({
        metric: imp.metric,
        before: imp.before,
        after: imp.after,
        delta: imp.delta
      }))
    };
  }

  // Get training recommendations
  getTrainingRecommendations(agentId: string): {
    availableTrainers: { trainerId: string; name: string; price: number; rank: number }[];
    skillRecommendations: { skillId: string; name: string; difficulty: number }[];
  } {
    const trainers = trainingMarketplace.getAllTrainers()
      .filter(t => t.rank <= 5)
      .map(t => ({
        trainerId: t.trainerAgentId,
        name: t.trainerName,
        price: t.trainingPrice,
        rank: t.rank
      }));

    const skillRecs = skillGraph.recommendSkills(agentId)
      .slice(0, 5)
      .map(s => ({
        skillId: s.skillId,
        name: s.name,
        difficulty: s.difficulty
      }));

    return {
      availableTrainers: trainers,
      skillRecommendations: skillRecs
    };
  }

  // ============================================
  // NODE-AWARE ROUTING
  // ============================================

  // Route preferring high-uptime nodes
  routeWithNodePreference(requiredRoles: AgentRole[], budget: number): MCPRoutingDecision {
    const agents = agentMarketplace.getListings({ role: requiredRoles[0], availability: 'available' });
    
    // Score by agent + node quality
    let bestAgent: string | null = null;
    let bestScore = -1;

    for (const listing of agents) {
      const agent = agentMarketplace.getAgent(listing.agentId);
      if (!agent) continue;

      const nodeScore = nodeIntelligence.getNodeScore(agent.nodeSource);
      if (!nodeScore) continue;

      const avgPrice = (agent.pricing.perTaskMin + agent.pricing.perTaskMax) / 2;
      if (avgPrice > budget) continue;

      // Combined score: rating * successRate * nodeReliability
      const score = listing.rating * listing.successRate * nodeScore.reliabilityScore;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = listing.agentId;
      }
    }

    if (bestAgent) {
      const agent = agentMarketplace.getAgent(bestAgent)!;
      return {
        selectedAgentId: bestAgent,
        alternativeAgents: [],
        reasoning: `Selected ${agent.name} with high-uptime node backing`,
        estimatedCost: (agent.pricing.perTaskMin + agent.pricing.perTaskMax) / 2
      };
    }

    // Fallback: no agents available
    return {
      selectedAgentId: '',
      alternativeAgents: [],
      reasoning: 'No available agents match requirements',
      estimatedCost: 0
    };
  }

  // ============================================
  // SYSTEM STATUS
  // ============================================

  getSystemStatus(): {
    agents: number;
    listings: number;
    externalAgents: number;
    nodes: { total: number; reliable: number };
    leaderboard: { categories: string[] };
    training: { trainers: number };
    packages: number;
  } {
    return {
      agents: agentMarketplace.getAllAgents().length,
      listings: agentMarketplace.getListings().length,
      externalAgents: marketplaceAdapter.getExternalAgents().length,
      nodes: {
        total: nodeIntelligence.getNodes().length,
        reliable: nodeIntelligence.getReliableNodes().length
      },
      leaderboard: {
        categories: leaderboard.getCategories()
      },
      training: {
        trainers: trainingMarketplace.getAllTrainers().length
      },
      packages: 5 // From AgentPackagesService
    };
  }
}

export const mcpIntegration = new MCPIntegrationService();