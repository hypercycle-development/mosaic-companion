// ============================================
// LAYER 6: SKILL GRAPH + EVOLUTION SERVICE
// Agent Skill Tracking + Evolution
// ============================================

import type { AgentRole, AgentSkillHistory, PerformanceImprovement, SkillNode, SkillEdge } from './types';
import { agentMarketplace } from './AgentMarketplaceService';

// Skill graph storage
const skillNodes = new Map<string, SkillNode>();
const skillEdges: SkillEdge[] = [];
const agentSkillHistory = new Map<string, AgentSkillHistory>();
const performanceLogs: { agentId: string; timestamp: number; metrics: PerformanceImprovement[] }[] = [];

export class SkillGraphService {
  constructor() {
    this.initializeSkillGraph();
  }

  private initializeSkillGraph(): void {
    // Define skill nodes by role
    const skillDefinitions: Record<AgentRole, { skill: string; difficulty: number; related: string[] }[]> = {
      marketing: [
        { skill: 'content_creation', difficulty: 3, related: ['seo', 'social_media'] },
        { skill: 'seo', difficulty: 4, related: ['content_creation', 'analytics'] },
        { skill: 'social_media', difficulty: 2, related: ['content_creation', 'email_marketing'] },
        { skill: 'email_marketing', difficulty: 3, related: ['content_creation', 'analytics'] },
        { skill: 'analytics', difficulty: 4, related: ['seo', 'email_marketing'] }
      ],
      developer: [
        { skill: 'frontend', difficulty: 3, related: ['backend', 'testing'] },
        { skill: 'backend', difficulty: 4, related: ['frontend', 'devops', 'api_design'] },
        { skill: 'devops', difficulty: 5, related: ['backend', 'testing'] },
        { skill: 'api_design', difficulty: 4, related: ['backend', 'frontend'] },
        { skill: 'testing', difficulty: 3, related: ['frontend', 'backend', 'devops'] }
      ],
      uiux: [
        { skill: 'ui_design', difficulty: 3, related: ['prototyping', 'design_systems'] },
        { skill: 'ux_research', difficulty: 4, related: ['ui_design', 'accessibility'] },
        { skill: 'prototyping', difficulty: 3, related: ['ui_design', 'design_systems'] },
        { skill: 'accessibility', difficulty: 4, related: ['ui_design', 'ux_research'] },
        { skill: 'design_systems', difficulty: 5, related: ['ui_design', 'prototyping'] }
      ],
      data_analyst: [
        { skill: 'data_visualization', difficulty: 3, related: ['reporting', 'sql'] },
        { skill: 'statistical_analysis', difficulty: 5, related: ['python', 'data_visualization'] },
        { skill: 'sql', difficulty: 3, related: ['python', 'reporting'] },
        { skill: 'python', difficulty: 4, related: ['sql', 'statistical_analysis'] },
        { skill: 'reporting', difficulty: 3, related: ['data_visualization', 'sql'] }
      ],
      growth: [
        { skill: 'conversion_optimization', difficulty: 4, related: ['ab_testing', 'funnel_analysis'] },
        { skill: 'ab_testing', difficulty: 4, related: ['conversion_optimization', 'attribution'] },
        { skill: 'funnel_analysis', difficulty: 3, related: ['conversion_optimization', 'cohort_analysis'] },
        { skill: 'cohort_analysis', difficulty: 4, related: ['funnel_analysis', 'attribution'] },
        { skill: 'attribution', difficulty: 5, related: ['ab_testing', 'cohort_analysis'] }
      ]
    };

    // Create skill nodes
    Object.entries(skillDefinitions).forEach(([role, skills]) => {
      skills.forEach(({ skill, difficulty, related }) => {
        const node: SkillNode = {
          skillId: skill,
          name: skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: role as AgentRole,
          difficulty,
          relatedSkills: related
        };
        skillNodes.set(skill, node);
      });
    });

    // Create skill edges
    skillNodes.forEach(node => {
      node.relatedSkills.forEach(related => {
        skillEdges.push({
          from: node.skillId,
          to: related,
          weight: 0.8
        });
      });
    });

    console.log(`[SkillGraph] Initialized ${skillNodes.size} skills, ${skillEdges.length} relationships`);
  }

  // Get skill node
  getSkill(skillId: string): SkillNode | null {
    return skillNodes.get(skillId) || null;
  }

  // Get all skills
  getAllSkills(): SkillNode[] {
    return Array.from(skillNodes.values());
  }

  // Get skills by category
  getSkillsByCategory(category: AgentRole): SkillNode[] {
    return Array.from(skillNodes.values()).filter(s => s.category === category);
  }

  // Get related skills
  getRelatedSkills(skillId: string): SkillNode[] {
    const skill = skillNodes.get(skillId);
    if (!skill) return [];
    
    return skill.relatedSkills
      .map(related => skillNodes.get(related))
      .filter((s): s is SkillNode => s !== undefined);
  }

  // Track skill usage for an agent
  trackSkillUsage(agentId: string, skillId: string, success: boolean, rating: number): void {
    if (!agentSkillHistory.has(agentId)) {
      agentSkillHistory.set(agentId, {
        agentId,
        skillId,
        taskHistory: [],
        performanceDelta: []
      });
    }

    const history = agentSkillHistory.get(agentId)!;
    
    // Add task to history
    history.taskHistory.push({
      taskId: `task_${Date.now()}`,
      success,
      rating,
      timestamp: Date.now()
    });

    // Keep only last 100 tasks
    if (history.taskHistory.length > 100) {
      history.taskHistory = history.taskHistory.slice(-100);
    }

    console.log(`[SkillGraph] Tracked ${skillId} for ${agentId}: success=${success}, rating=${rating}`);
  }

  // Record performance improvement
  recordImprovement(agentId: string, improvements: PerformanceImprovement[]): void {
    if (!agentSkillHistory.has(agentId)) {
      agentSkillHistory.set(agentId, {
        agentId,
        skillId: '',
        taskHistory: [],
        performanceDelta: []
      });
    }

    const history = agentSkillHistory.get(agentId)!;
    history.performanceDelta.push(...improvements);

    // Log performance improvement
    performanceLogs.push({
      agentId,
      timestamp: Date.now(),
      metrics: improvements
    });

    console.log(`[SkillGraph] Recorded ${improvements.length} improvements for ${agentId}`);
  }

  // Get agent skill history
  getAgentHistory(agentId: string): AgentSkillHistory | null {
    return agentSkillHistory.get(agentId) || null;
  }

  // Calculate skill evolution (before/after training)
  calculateEvolution(agentId: string): { before: number; after: number; delta: number } | null {
    const history = agentSkillHistory.get(agentId);
    if (!history || history.performanceDelta.length < 2) {
      return null;
    }

    const deltas = history.performanceDelta;
    const firstSuccessRate = deltas[0].before;
    const lastSuccessRate = deltas[deltas.length - 1].after;
    
    return {
      before: firstSuccessRate,
      after: lastSuccessRate,
      delta: lastSuccessRate - firstSuccessRate
    };
  }

  // Get performance logs
  getPerformanceLogs(agentId?: string, limit: number = 50): { agentId: string; timestamp: number; metrics: PerformanceImprovement[] }[] {
    let logs = performanceLogs;
    if (agentId) {
      logs = logs.filter(l => l.agentId === agentId);
    }
    return logs.slice(-limit);
  }

  // Recommend skills to learn
  recommendSkills(agentId: string): SkillNode[] {
    const agent = agentMarketplace.getAgent(agentId);
    if (!agent) return [];

    const currentSkills = Object.keys(agent.skills);
    const recommendations: SkillNode[] = [];

    currentSkills.forEach(skillId => {
      const related = this.getRelatedSkills(skillId);
      related.forEach(relatedSkill => {
        if (!currentSkills.includes(relatedSkill.skillId)) {
          recommendations.push(relatedSkill);
        }
      });
    });

    // Deduplicate and sort by difficulty
    const unique = recommendations.filter((v, i, a) => a.findIndex(t => t.skillId === v.skillId) === i);
    return unique.sort((a, b) => a.difficulty - b.difficulty);
  }

  // Get skill graph for visualization
  getGraph(): { nodes: SkillNode[]; edges: SkillEdge[] } {
    return {
      nodes: Array.from(skillNodes.values()),
      edges: skillEdges
    };
  }
}

export const skillGraph = new SkillGraphService();