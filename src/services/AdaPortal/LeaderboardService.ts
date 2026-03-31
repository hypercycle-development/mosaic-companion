// ============================================
// ADA PORTAL - Leaderboard Service
// Layer 4: Agent ranking and scoring system
// ============================================

import { 
  LeaderboardCategory, 
  LeaderboardPeriod, 
  LeaderboardEntry,
  AgentProfile 
} from './types';
import { agentMarketplace } from './AgentMarketplaceService';

interface LeaderboardData {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  lastUpdated: number;
}

class LeaderboardService {
  private leaderboards: Map<string, LeaderboardData> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeLeaderboards();
    console.log('[AdaPortal] Leaderboard system initialized');
  }

  private initializeLeaderboards(): void {
    const categories: LeaderboardCategory[] = ['marketing', 'dev', 'uiux', 'roi', 'overall'];
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'all_time'];

    categories.forEach(category => {
      periods.forEach(period => {
        const key = `${category}-${period}`;
        this.leaderboards.set(key, {
          category,
          period,
          entries: this.calculateLeaderboard(category, period),
          lastUpdated: Date.now()
        });
      });
    });
  }

  private calculateLeaderboard(category: LeaderboardCategory, period: LeaderboardPeriod): LeaderboardEntry[] {
    const agents = agentMarketplace.getAgents();
    
    const entries: LeaderboardEntry[] = agents.map((agent, index) => {
      // Calculate component scores
      const skillScore = this.calculateSkillScore(agent);
      const successScore = agent.performance.successRate * 100;
      const ratingScore = agent.performance.averageRating * 20; // 5 * 20 = 100
      const nodeScore = agent.nodeSource === 'hypercycle' ? 95 : 80;

      // Weighted total: (Skill * 0.4) + (Success * 0.3) + (Rating * 0.2) + (Node * 0.1)
      const score = (skillScore * 0.4) + (successScore * 0.3) + (ratingScore * 0.2) + (nodeScore * 0.1);

      return {
        rank: index + 1,
        agentId: agent.agentId,
        agentName: agent.name,
        category,
        score,
        skillScore,
        successScore,
        ratingScore,
        nodeScore,
        period
      };
    });

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score);

    // Update ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Filter by category if not 'overall'
    if (category !== 'overall' && category !== 'roi') {
      return entries.filter(e => {
        const agent = agentMarketplace.getAgent(e.agentId);
        return agent?.roles.includes(category as any);
      });
    }

    return entries.slice(0, 10);
  }

  private calculateSkillScore(agent: AgentProfile): number {
    // Average of all skill levels * 20 (since levels are 1-5)
    const skillValues = Object.values(agent.skills);
    if (skillValues.length === 0) return 0;
    
    const avgLevel = skillValues.reduce((sum, s) => sum + s.level, 0) / skillValues.length;
    return avgLevel * 20; // 0-100 scale
  }

  // Get leaderboard for category and period
  getLeaderboard(category: LeaderboardCategory = 'overall', period: LeaderboardPeriod = 'all_time'): LeaderboardData {
    const key = `${category}-${period}`;
    const leaderboard = this.leaderboards.get(key);
    
    if (!leaderboard) {
      return {
        category,
        period,
        entries: [],
        lastUpdated: Date.now()
      };
    }

    return leaderboard;
  }

  // Refresh specific leaderboard
  refreshLeaderboard(category: LeaderboardCategory, period: LeaderboardPeriod): void {
    const key = `${category}-${period}`;
    const leaderboard = this.leaderboards.get(key);
    
    if (leaderboard) {
      leaderboard.entries = this.calculateLeaderboard(category, period);
      leaderboard.lastUpdated = Date.now();
      console.log(`[AdaPortal] Refreshed leaderboard: ${key}`);
    }
  }

  // Refresh all leaderboards
  refreshAll(): void {
    const categories: LeaderboardCategory[] = ['marketing', 'dev', 'uiux', 'roi', 'overall'];
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'all_time'];

    categories.forEach(category => {
      periods.forEach(period => {
        this.refreshLeaderboard(category, period);
      });
    });

    console.log('[AdaPortal] All leaderboards refreshed');
  }

  // Get top agents for specific category
  getTopAgents(category: LeaderboardCategory, limit: number = 5): LeaderboardEntry[] {
    const leaderboard = this.getLeaderboard(category, 'all_time');
    return leaderboard.entries.slice(0, limit);
  }

  // Get all available categories
  getCategories(): LeaderboardCategory[] {
    return ['marketing', 'dev', 'uiux', 'roi', 'overall'];
  }

  // Get all available periods
  getPeriods(): LeaderboardPeriod[] {
    return ['daily', 'weekly', 'all_time'];
  }
}

export const leaderboard = new LeaderboardService();
export { LeaderboardService };