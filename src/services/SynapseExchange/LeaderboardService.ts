// ============================================
// LAYER 4: LEADERBOARD SERVICE
// Agent Ranking System
// ============================================

import type { AgentRole, LeaderboardCategory, LeaderboardEntry, LeaderboardTimeframe, LeaderboardSnapshot } from './types';
import { agentMarketplace } from './AgentMarketplaceService';
import { nodeIntelligence } from './NodeIntelligenceService';

// Leaderboard cache
const leaderboards = new Map<string, LeaderboardSnapshot>();
const history = new Map<string, LeaderboardEntry[]>();

// Category weights for scoring
const SCORE_WEIGHTS = {
  skillScore: 0.4,
  successRate: 0.3,
  clientRating: 0.2,
  nodeReliability: 0.1
};

export class LeaderboardService {
  constructor() {
    console.log('[Leaderboard] Service initialized');
  }

  // Calculate agent score
  calculateAgentScore(agentId: string): number {
    const agent = agentMarketplace.getAgent(agentId);
    if (!agent) return 0;

    // Get skill score (average of skill levels)
    const skillScores = Object.values(agent.skills).map(s => s.level);
    const skillScore = skillScores.reduce((a, b) => a + b, 0) / skillScores.length;

    // Get node reliability
    const nodeScore = nodeIntelligence.getNodeScore(agent.nodeSource);
    const nodeReliability = nodeScore?.reliabilityScore || 0.5;

    // Calculate weighted score
    const score = 
      (skillScore * SCORE_WEIGHTS.skillScore) +
      (agent.performance.successRate * SCORE_WEIGHTS.successRate) +
      (agent.performance.averageRating / 5 * SCORE_WEIGHTS.clientRating) +
      (nodeReliability * SCORE_WEIGHTS.nodeReliability);

    return Math.round(score * 100) / 100;
  }

  // Build leaderboard for category + timeframe
  buildLeaderboard(category: LeaderboardCategory, timeframe: LeaderboardTimeframe): LeaderboardSnapshot {
    const agents = agentMarketplace.getAllAgents();
    
    // Filter by category if needed (roi is special - all agents)
    const categoryAgents = category === 'overall' || category === 'roi'
      ? agents 
      : agents.filter(a => a.roles.includes(category as AgentRole));

    // Calculate scores and create entries
    const entries: LeaderboardEntry[] = categoryAgents.map((agent, index) => {
      const skillScore = this.calculateAgentScore(agent.agentId);
      const nodeScore = nodeIntelligence.getNodeScore(agent.nodeSource);
      
      return {
        rank: 0, // Will be set after sorting
        agentId: agent.agentId,
        agentName: agent.name,
        category,
        score: skillScore,
        skillScore,
        successRate: agent.performance.successRate,
        clientRating: agent.performance.averageRating,
        nodeReliability: nodeScore?.reliabilityScore || 0.5,
        timeframe,
        updatedAt: Date.now()
      };
    });

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const snapshot: LeaderboardSnapshot = {
      category,
      timeframe,
      entries,
      updatedAt: Date.now()
    };

    // Cache it
    const cacheKey = `${category}_${timeframe}`;
    leaderboards.set(cacheKey, snapshot);

    // Add to history
    if (!history.has(cacheKey)) {
      history.set(cacheKey, []);
    }
    const historyEntries = history.get(cacheKey)!;
    historyEntries.push(...entries);

    console.log(`[Leaderboard] Built ${category} leaderboard (${entries.length} agents)`);
    return snapshot;
  }

  // Get leaderboard
  getLeaderboard(category: LeaderboardCategory, timeframe: LeaderboardTimeframe): LeaderboardSnapshot {
    const cacheKey = `${category}_${timeframe}`;
    const cached = leaderboards.get(cacheKey);

    if (cached && Date.now() - cached.updatedAt < 300000) { // 5 min cache
      return cached;
    }

    return this.buildLeaderboard(category, timeframe);
  }

  // Get top N agents
  getTopAgents(category: LeaderboardCategory, limit: number = 10): LeaderboardEntry[] {
    const snapshot = this.getLeaderboard(category, 'all_time');
    return snapshot.entries.slice(0, limit);
  }

  // Get agent rank
  getAgentRank(agentId: string, category: LeaderboardCategory): number {
    const snapshot = this.getLeaderboard(category, 'all_time');
    const entry = snapshot.entries.find(e => e.agentId === agentId);
    return entry?.rank || -1;
  }

  // Update scores after task completion
  updateScoresAfterTask(agentId: string, success: boolean, rating: number): void {
    const agent = agentMarketplace.getAgent(agentId);
    if (!agent) return;

    // Update success rate
    const newTotal = agent.performance.totalTasks + 1;
    const newCompleted = agent.performance.completedTasks + (success ? 1 : 0);
    agent.performance.successRate = newCompleted / newTotal;
    agent.performance.totalTasks = newTotal;
    agent.performance.completedTasks = newCompleted;

    // Update rating (rolling average)
    const currentRating = agent.performance.averageRating;
    agent.performance.averageRating = ((currentRating * agent.performance.totalTasks) + rating) / (agent.performance.totalTasks + 1);

    // Clear cache to force rebuild
    leaderboards.clear();
    console.log(`[Leaderboard] Updated scores for agent ${agentId}`);
  }

  // Get all categories
  getCategories(): LeaderboardCategory[] {
    return ['marketing', 'developer', 'uiux', 'roi', 'overall'];
  }
}

export const leaderboard = new LeaderboardService();