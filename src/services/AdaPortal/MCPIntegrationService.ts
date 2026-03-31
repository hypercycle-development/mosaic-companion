// ============================================
// ADA PORTAL - MCP Integration Service
// MCP Orchestration Layer: Routes tasks to agents and compute nodes
// ============================================

import { 
  AgentRole, 
  TaskContract,
  LeaderboardEntry,
  TrainingSession
} from './types';
import { agentMarketplace } from './AgentMarketplaceService';
import { marketplaceAdapter } from './MarketplaceAdapterService';
import { agentEconomy } from './AgentEconomyService';
import { leaderboard } from './LeaderboardService';
import { trainingMarketplace } from './TrainingMarketplaceService';
import { skillGraph } from './SkillGraphService';
import { agentPackages } from './AgentPackagesService';
import { nodeIntelligence } from './NodeIntelligenceService';

interface RouteResult {
  selectedAgentId?: string;
  selectedNodeId?: string;
  estimatedCost?: number;
  confidence?: number;
  reasoning?: string;
}

interface SystemStatus {
  agents: number;
  listings: number;
  externalAgents: number;
  nodes: {
    total: number;
    reliable: number;
  };
  training: {
    trainers: number;
    sessions: number;
  };
  packages: number;
}

class MCPIntegrationService {
  constructor() {
    console.log('[AdaPortal] MCP Integration initialized');
  }

  // ============================================
  // ROUTING LOGIC
  // ============================================

  // Route based on skill requirements
  async routeBySkill(params: {
    requiredRoles?: AgentRole[];
    requiredSkills?: string[];
    budget: number;
  }): Promise<RouteResult> {
    const { requiredRoles, requiredSkills, budget } = params;

    let candidates = agentMarketplace.getListings();

    // Filter by roles
    if (requiredRoles?.length) {
      candidates = candidates.filter(l => 
        requiredRoles.some(r => l.roles.includes(r))
      );
    }

    // Filter by skills
    if (requiredSkills?.length) {
      candidates = candidates.filter(l =>
        requiredSkills.some(s => 
          l.primarySkills.some(ps => ps.toLowerCase().includes(s.toLowerCase()))
        )
      );
    }

    // Filter by budget
    candidates = candidates.filter(l => 
      l.pricing.perTaskMin <= budget
    );

    // Sort by composite score
    candidates.sort((a, b) => {
      const scoreA = a.rating * a.successRate;
      const scoreB = b.rating * b.successRate;
      return scoreB - scoreA;
    });

    if (candidates.length === 0) {
      return { 
        selectedAgentId: undefined,
        reasoning: 'No agents match the required skills/budget'
      };
    }

    const selected = candidates[0];
    return {
      selectedAgentId: selected.agentId,
      estimatedCost: selected.pricing.perTaskMin,
      confidence: selected.rating / 5,
      reasoning: `Selected ${selected.agentName} based on skill match and rating`
    };
  }

  // Route with performance consideration
  async routeByPerformance(params: {
    requiredRoles: AgentRole[];
    budget: number;
    minSuccessRate?: number;
  }): Promise<RouteResult> {
    let candidates = agentMarketplace.getListingsByRole(params.requiredRoles[0]);

    if (params.minSuccessRate) {
      candidates = candidates.filter(l => l.successRate >= params.minSuccessRate!);
    }

    candidates = candidates.filter(l => 
      l.pricing.perTaskMin <= params.budget
    );

    // Sort by success rate
    candidates.sort((a, b) => b.successRate - a.successRate);

    if (candidates.length === 0) {
      return { 
        selectedAgentId: undefined,
        reasoning: 'No agents meet performance requirements'
      };
    }

    const selected = candidates[0];
    return {
      selectedAgentId: selected.agentId,
      estimatedCost: selected.pricing.perTaskMin,
      confidence: selected.successRate,
      reasoning: `Selected ${selected.agentName} with ${(selected.successRate * 100).toFixed(0)}% success rate`
    };
  }

  // Route with node preference
  routeWithNodePreference(roles: AgentRole[], budget: number): RouteResult {
    const nodes = nodeIntelligence.getOnlineNodes();
    const reliableNodes = nodes.filter(n => n.reliability > 0.95);

    let candidates = agentMarketplace.getListingsByRole(roles[0]);
    candidates = candidates.filter(l => l.pricing.perTaskMin <= budget);

    // Prefer agents with reliable node sources
    candidates.sort((a, b) => {
      const aReliable = a.nodeSource === 'hypercycle' ? 1 : 0;
      const bReliable = b.nodeSource === 'hypercycle' ? 1 : 0;
      return bReliable - aReliable || b.rating - a.rating;
    });

    const selected = candidates[0];
    const node = reliableNodes[0];

    return {
      selectedAgentId: selected?.agentId,
      selectedNodeId: node?.nodeId,
      estimatedCost: selected?.pricing.perTaskMin,
      confidence: selected ? selected.rating / 5 : 0,
      reasoning: selected 
        ? `Selected ${selected.agentName} with reliable node ${node?.nodeId}`
        : 'No suitable agents found'
    };
  }

  // ============================================
  // EXECUTION LOGIC
  // ============================================

  // Execute a task (creates contract)
  executeTask(params: {
    agentId: string;
    task: string;
    budget: number;
    requesterId?: string;
  }): TaskContract {
    return agentEconomy.createContract({
      requesterId: params.requesterId || 'user-default',
      agentId: params.agentId,
      terms: params.task,
      paymentAmount: params.budget
    });
  }

  // Execute agent-to-agent hiring
  executeAgentToAgent(
    requesterAgentId: string,
    targetAgentId: string,
    task: string,
    budget: number
  ): TaskContract {
    return agentEconomy.executeAgentToAgent(
      requesterAgentId,
      targetAgentId,
      task,
      budget
    );
  }

  // Execute training
  async executeTraining(traineeAgentId: string, trainerId: string): Promise<{
    success: boolean;
    session?: TrainingSession;
    message?: string;
  }> {
    const trainer = trainingMarketplace.getTrainer(trainerId);
    if (!trainer) {
      return { success: false, message: 'Trainer not found' };
    }

    const session = trainingMarketplace.createSession({
      trainerId,
      traineeAgentId,
      skills: trainer.specializations,
      price: trainer.pricePerSession
    });

    return {
      success: true,
      session,
      message: `Training session created with ${trainer.name}`
    };
  }

  // ============================================
  // LEADERBOARD ACCESS
  // ============================================

  getLeaderboardEntries(category?: string, period?: string): LeaderboardEntry[] {
    return leaderboard.getLeaderboard(
      (category as any) || 'overall', 
      (period as any) || 'all_time'
    ).entries;
  }

  getTopAgent(category: string): LeaderboardEntry | null {
    const entries = leaderboard.getTopAgents(category as any, 1);
    return entries[0] || null;
  }

  // ============================================
  // SKILL GRAPH ACCESS
  // ============================================

  getSkillRecommendations(skillId: string): string[] {
    const related = skillGraph.getRelatedSkills(skillId);
    return related.map(s => s.skillId);
  }

  getSkillCategories(): string[] {
    return skillGraph.getCategories();
  }

  // ============================================
  // COMPUTE ACCESS
  // ============================================

  getComputeNodes() {
    return nodeIntelligence.getNodes();
  }

  allocateCompute(nodeId: string, hours: number) {
    return nodeIntelligence.allocateCompute(nodeId, hours);
  }

  getBestComputeNode(criteria?: {
    maxPrice?: number;
    minUptime?: number;
  }) {
    return nodeIntelligence.getBestNode(criteria);
  }

  // ============================================
  // PACKAGES
  // ============================================

  getPackages() {
    return agentPackages.getPackages();
  }

  subscribeToPackage(packageId: string) {
    return agentPackages.subscribe(packageId);
  }

  // ============================================
  // SYSTEM STATUS
  // ============================================

  getSystemStatus(): SystemStatus {
    const nodeStats = nodeIntelligence.getStats();
    const trainingStats = trainingMarketplace.getStats();

    return {
      agents: agentMarketplace.getAgents().length,
      listings: agentMarketplace.getListings().length,
      externalAgents: marketplaceAdapter.getExternalAgents().length,
      nodes: {
        total: nodeStats.totalNodes,
        reliable: nodeStats.onlineNodes
      },
      training: {
        trainers: trainingStats.totalTrainers,
        sessions: trainingStats.totalSessions
      },
      packages: agentPackages.getPackages().length
    };
  }
}

export const mcpIntegration = new MCPIntegrationService();
export { MCPIntegrationService };