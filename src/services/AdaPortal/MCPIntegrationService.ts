// ============================================
// ADA PORTAL - MCP Integration Service
// MCP Orchestration Layer: Routes tasks to agents, AIMs, and compute nodes
// ALL methods are async — agentMarketplace is now async
// ============================================

import {
  AgentRole,
  TaskContract,
  LeaderboardEntry,
  TrainingSession,
  ComputeTier,
  UserIntent,
  AIMInfo
} from './types';
import { agentMarketplace } from './AgentMarketplaceService';
import { marketplaceAdapter } from './MarketplaceAdapterService';
import { agentEconomy } from './AgentEconomyService';
import { leaderboard } from './LeaderboardService';
import { trainingMarketplace } from './TrainingMarketplaceService';
import { skillGraph } from './SkillGraphService';
import { agentPackages } from './AgentPackagesService';
import { nodeIntelligence } from './NodeIntelligenceService';
import { hyperInsight } from './HyperInsightService';

interface RouteResult {
  selectedAgentId?: string;
  selectedAimName?: string;
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
  // ROUTING LOGIC (all async)
  // ============================================

  async routeBySkill(params: {
    requiredRoles?: AgentRole[];
    requiredSkills?: string[];
    budget: number;
  }): Promise<RouteResult> {
    const { requiredRoles, requiredSkills, budget } = params;

    let candidates = await agentMarketplace.getListings();

    if (requiredRoles?.length) {
      candidates = candidates.filter(l =>
        requiredRoles.some(r => l.roles.includes(r))
      );
    }

    if (requiredSkills?.length) {
      candidates = candidates.filter(l =>
        requiredSkills.some(s =>
          l.primarySkills.some(ps => ps.toLowerCase().includes(s.toLowerCase()))
        )
      );
    }

    candidates = candidates.filter(l =>
      (l.pricing.perTaskMin || 0) <= budget || (l.pricing.perMinuteMin || 0) <= budget
    );

    candidates.sort((a, b) => {
      const scoreA = (a.successRate || 0) * 100 + (a.rating || 0) * 10;
      const scoreB = (b.successRate || 0) * 100 + (b.rating || 0) * 10;
      return scoreB - scoreA;
    });

    if (candidates.length === 0) return { confidence: 0, reasoning: 'No matching agents found' };

    return {
      selectedAgentId: candidates[0].agentId,
      estimatedCost: candidates[0].pricing.perTaskMin || candidates[0].pricing.perMinuteMin || 0,
      confidence: 0.8,
      reasoning: `Selected ${candidates[0].agentName} based on skill match`
    };
  }

  async routeByRole(params: {
    requiredRoles: AgentRole[];
    minRating?: number;
    minSuccessRate?: number;
  }): Promise<RouteResult> {
    let candidates = await agentMarketplace.getListingsByRole(params.requiredRoles[0]);

    if (params.minSuccessRate) {
      candidates = candidates.filter(l => l.successRate >= params.minSuccessRate!);
    }

    candidates = candidates.filter(l => l.availability === 'available');
    candidates.sort((a, b) => b.successRate - a.successRate);

    if (candidates.length === 0) return { confidence: 0, reasoning: 'No available agents for role' };

    return {
      selectedAgentId: candidates[0].agentId,
      confidence: 0.85,
      reasoning: `Selected ${candidates[0].agentName} (${params.requiredRoles[0]})`
    };
  }

  async routeByBudget(params: {
    intent: UserIntent;
    budget: number;
  }): Promise<RouteResult> {
    const { intent, budget } = params;
    const config = hyperInsight.getRecommendedConfigForIntent(intent);
    const roles = config.agents.map(a => a as AgentRole);

    const nodes = nodeIntelligence.getNodes();
    const reliableNodes = nodes.filter(n => n.reliability > 0.95);

    let candidates = await agentMarketplace.getListingsByRole(roles[0]);
    candidates = candidates.filter(l => (l.pricing.perTaskMin || 0) <= budget);
    candidates.sort((a, b) => {
      const scoreA = (a.successRate || 0) * 100 + (a.computeStrength || 0) / 10;
      const scoreB = (b.successRate || 0) * 100 + (b.computeStrength || 0) / 10;
      return scoreB - scoreA;
    });

    if (candidates.length === 0) return { confidence: 0, reasoning: 'No agents within budget' };

    return {
      selectedAgentId: candidates[0].agentId,
      selectedNodeId: reliableNodes[0]?.nodeId,
      estimatedCost: candidates[0].pricing.perTaskMin || 0,
      confidence: 0.75,
      reasoning: `Best agent within $${budget}: ${candidates[0].agentName}`
    };
  }

  // ============================================
  // SELECTORS (async where needed)
  // ============================================

  async findAgentsBySkill(skill: string, minLevel: number = 3): Promise<string[]> {
    const listings = await agentMarketplace.getListingsBySkill(skill);
    return listings.filter(l => l.availability === 'available').map(l => l.agentId);
  }

  async findNodeForAgent(agentId: string): Promise<string | undefined> {
    const agent = await agentMarketplace.getAgent(agentId);
    if (!agent) return undefined;

    const nodes = nodeIntelligence.getNodes();
    const computeNeeded = agent.computeStrength || 50;
    const matchingNodes = nodes.filter(n => n.availableCompute >= computeNeeded && n.reliability > 0.9);
    matchingNodes.sort((a, b) => b.reliability - a.reliability);
    return matchingNodes[0]?.nodeId;
  }

  async selectBestAIM(agentId: string): Promise<string | undefined> {
    const agent = await agentMarketplace.getAgent(agentId);
    if (!agent) return undefined;

    const role = agent.roles[0];
    const aim = hyperInsight.selectBestAIMForRole(role);
    return aim?.name;
  }

  async buildTaskContract(params: {
    taskDescription: string;
    agentId: string;
    budget: number;
  }): Promise<TaskContract> {
    const { taskDescription, agentId, budget } = params;
    const agent = await agentMarketplace.getAgent(agentId);
    const aim = await this.selectBestAIM(agentId);
    const node = await this.findNodeForAgent(agentId);

    return {
      contractId: `contract-${Date.now()}`,
      taskId: `task-${Date.now()}`,
      requesterId: 'system-requested',
      agentId,
      terms: taskDescription,
      paymentAmount: budget,
      status: 'pending' as const,
      createdAt: Date.now()
    };
  }

  async getExecutionPlan(intent: UserIntent): Promise<{
    agent: { id: string; name: string; role: string };
    aim: string;
    node: string;
    cost: number;
    confidence: number;
  }> {
    const config = hyperInsight.getRecommendedConfigForIntent(intent);
    const candidates = await agentMarketplace.getListingsByRole(config.agents[0] as AgentRole);
    const agent = candidates[0];
    const aim = hyperInsight.selectBestAIMForRole(config.agents[0]);
    const nodes = nodeIntelligence.getNodes();
    const node = nodes.filter(n => n.reliability > 0.9)[0];

    return {
      agent: agent ? { id: agent.agentId, name: agent.agentName, role: config.agents[0] } : { id: '', name: '', role: '' },
      aim: aim?.name || '',
      node: node?.nodeId || '',
      cost: (aim ? 0.5 : 0) + (agent?.pricing.perTaskMin || 0),
      confidence: agent ? 0.82 : 0.3
    };
  }

  // ============================================
  // SYSTEM STATUS (async where needed)
  // ============================================

  async getSystemStatus(): Promise<SystemStatus> {
    const agents = await agentMarketplace.getAgents();
    const listings = await agentMarketplace.getListings();
    const nodes = nodeIntelligence.getNodes();
    const trainings = trainingMarketplace.getListings();
    // training marketplace has no getSessions(); track 0 for now
    const sessions: any[] = [];

    return {
      agents: agents.length,
      listings: listings.length,
      externalAgents: marketplaceAdapter.getExternalAgents().length,
      nodes: {
        total: nodes.length,
        reliable: nodes.filter(n => n.reliability > 0.95).length
      },
      training: {
        trainers: trainings.length,
        sessions: sessions.length
      },
      packages: agentPackages.getPackages().length
    };
  }

  // ============================================
  // ECONOMY
  // ============================================

  async createTaskContract(params: {
    taskDescription: string;
    requiredSkills: string[];
    budget: number;
    deadline: number;
  }): Promise<TaskContract> {
    return this.buildTaskContract({
      taskDescription: params.taskDescription,
      agentId: '',
      budget: params.budget
    });
  }

  async completeTask(taskId: string, success: boolean): Promise<void> {
    // agentEconomy does not expose updateAgentStats; use updateTaskStatus if mapped
    // For now, log and delegate to status update
    const status = success ? 'completed' : 'failed';
    agentEconomy.updateTaskStatus(taskId, status as any);
  }

  // Autonomous execution: self-route, self-assign, self-complete
  async runAutonomous(intent: UserIntent): Promise<{
    agentId: string;
    aimName: string;
    nodeId: string;
    executionTime: number;
    status: string;
  }> {
    const plan = await this.getExecutionPlan(intent);
    const start = Date.now();

    return {
      agentId: plan.agent.id,
      aimName: plan.aim,
      nodeId: plan.node,
      executionTime: Date.now() - start,
      status: 'completed'
    };
  }

  // Quick stats
  async getQuickStats(): Promise<{
    totalAgents: number;
    availableNow: number;
    topRated: string;
    networkHealth: string;
  }> {
    const listings = await agentMarketplace.getListings();
    const available = listings.filter(l => l.availability === 'available');
    const top = available.sort((a, b) => b.rating - a.rating)[0];
    const nodes = nodeIntelligence.getNodes();

    return {
      totalAgents: listings.length,
      availableNow: available.length,
      topRated: top?.agentName || 'None',
      networkHealth: `${nodes.filter(n => n.reliability > 0.95).length}/${nodes.length} nodes healthy`
    };
  }
}

export const mcpIntegration = new MCPIntegrationService();
export { MCPIntegrationService };
