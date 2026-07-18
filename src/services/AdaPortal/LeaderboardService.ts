// ============================================
// ADA PORTAL - Leaderboard Service
// Layer 4: Agent ranking and scoring system
// NOW: Uses hyperInsight.getUnifiedLeaderboard() for real data
// ============================================

import {
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardEntry,
  AgentProfile
} from './types';
import { hyperInsight } from './HyperInsightService';

interface LeaderboardData {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  lastUpdated: number;
}

class LeaderboardService {
  private leaderboards: Map<string, LeaderboardData> = new Map();

  constructor() {
    // Defer initialization until data is requested
    console.log('[AdaPortal] Leaderboard system initialized (deferred load)');
  }

  // Build leaderboard from real HyperInsight data
  private buildFromHyperInsight(category: LeaderboardCategory): LeaderboardEntry[] {
    const section = category === 'overall' ? undefined : (category === 'dev' ? 'aims' : 'nodes');
    const entries = hyperInsight.getUnifiedLeaderboard(section as any);

    return entries.slice(0, 20).map((e, index) => ({
      rank: index + 1,
      agentId: e.id,
      agentName: e.name,
      category,
      score: e.score,
      skillScore: e.type === 'aims' ? (e.activeNodes || 0) * 10 : 0,
      successScore: e.uptime || (e.reliability || 0) * 100,
      ratingScore: e.type === 'aims' ? (e.score || 0) : 0,
      nodeScore: e.type === 'nodes' ? (e.score || 0) : 0,
      period: 'all_time' as LeaderboardPeriod
    }));
  }

  // Get leaderboard for category and period
  getLeaderboard(category: LeaderboardCategory = 'overall', period: LeaderboardPeriod = 'all_time'): LeaderboardData {
    const key = `${category}-${period}`;
    let data = this.leaderboards.get(key);

    if (!data || Date.now() - data.lastUpdated > 60000) {
      // Rebuild from HyperInsight data
      const entries = this.buildFromHyperInsight(category);
      data = { category, period, entries, lastUpdated: Date.now() };
      this.leaderboards.set(key, data);
    }

    return data;
  }

  // Refresh specific leaderboard
  refreshLeaderboard(category: LeaderboardCategory, period: LeaderboardPeriod): void {
    const key = `${category}-${period}`;
    const entries = this.buildFromHyperInsight(category);
    this.leaderboards.set(key, { category, period, entries, lastUpdated: Date.now() });
    console.log(`[AdaPortal] Refreshed leaderboard: ${key} (${entries.length} entries)`);
  }

  // Refresh all leaderboards
  refreshAll(): void {
    const categories: LeaderboardCategory[] = ['marketing', 'dev', 'uiux', 'roi', 'overall'];
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'all_time'];
    for (const category of categories) {
      for (const period of periods) {
        this.refreshLeaderboard(category, period);
      }
    }
    console.log('[AdaPortal] All leaderboards refreshed');
  }

  // Get top agents for specific category
  getTopAgents(category: LeaderboardCategory, limit: number = 5): LeaderboardEntry[] {
    return this.getLeaderboard(category, 'all_time').entries.slice(0, limit);
  }

  getCategories(): LeaderboardCategory[] {
    return ['marketing', 'dev', 'uiux', 'roi', 'overall'];
  }

  getPeriods(): LeaderboardPeriod[] {
    return ['daily', 'weekly', 'all_time'];
  }
}

export const leaderboard = new LeaderboardService();
export { LeaderboardService };
