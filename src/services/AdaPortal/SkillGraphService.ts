// ============================================
// ADA PORTAL - Skill Graph Service
// Layer 6: Skill relationships and evolution tracking
// ============================================

import { SkillNode, SkillRelationship, AgentSkillHistory } from './types';

class SkillGraphService {
  private skills: Map<string, SkillNode> = new Map();
  private relationships: SkillRelationship[] = [];
  private skillHistory: Map<string, AgentSkillHistory[]> = new Map();

  constructor() {
    this.initializeSkillGraph();
    console.log('[AdaPortal] Skill graph initialized');
  }

  private initializeSkillGraph(): void {
    // Initialize skill nodes
    const nodes: SkillNode[] = [
      { skillId: 'smart-contracts', name: 'Smart Contracts', category: 'development', description: 'Blockchain contract development', relatedSkills: ['solidity', 'security-audit'] },
      { skillId: 'solidity', name: 'Solidity', category: 'development', description: 'EVM smart contract language', relatedSkills: ['smart-contracts', 'typescript'] },
      { skillId: 'typescript', name: 'TypeScript', category: 'development', description: 'Typed JavaScript', relatedSkills: ['javascript', 'react'] },
      { skillId: 'react', name: 'React', category: 'development', description: 'UI framework', relatedSkills: ['typescript', 'css'] },
      { skillId: 'content-creation', name: 'Content Creation', category: 'marketing', description: 'Marketing content generation', relatedSkills: ['copywriting', 'social-media'] },
      { skillId: 'social-media', name: 'Social Media', category: 'marketing', description: 'Social platform management', relatedSkills: ['community-management', 'content-creation'] },
      { skillId: 'community-management', name: 'Community Management', category: 'marketing', description: 'Community engagement', relatedSkills: ['social-media', 'customer-support'] },
      { skillId: 'ui-design', name: 'UI Design', category: 'design', description: 'User interface design', relatedSkills: ['ux-research', 'figma'] },
      { skillId: 'ux-research', name: 'UX Research', category: 'design', description: 'User experience research', relatedSkills: ['ui-design', 'analytics'] },
      { skillId: 'figma', name: 'Figma', category: 'design', description: 'Design tool', relatedSkills: ['ui-design', 'prototyping'] },
      { skillId: 'data-analysis', name: 'Data Analysis', category: 'data', description: 'Data processing and insights', relatedSkills: ['python', 'visualization'] },
      { skillId: 'python', name: 'Python', category: 'development', description: 'Programming language', relatedSkills: ['data-analysis', 'machine-learning'] },
      { skillId: 'visualization', name: 'Data Visualization', category: 'data', description: 'Data presentation', relatedSkills: ['data-analysis', 'dashboard'] },
      { skillId: 'growth-strategy', name: 'Growth Strategy', category: 'growth', description: 'Growth planning', relatedSkills: ['analytics', 'conversion-optimization'] },
      { skillId: 'analytics', name: 'Analytics', category: 'growth', description: 'Metrics and tracking', relatedSkills: ['data-analysis', 'growth-strategy'] },
      { skillId: 'conversion-optimization', name: 'Conversion Optimization', category: 'growth', description: 'Conversion rate improvement', relatedSkills: ['analytics', 'ab-testing'] }
    ];

    nodes.forEach(node => this.skills.set(node.skillId, node));

    // Initialize relationships
    this.relationships = [
      { fromSkill: 'solidity', toSkill: 'smart-contracts', relationshipType: 'prerequisite', weight: 0.9 },
      { fromSkill: 'typescript', toSkill: 'react', relationshipType: 'prerequisite', weight: 0.8 },
      { fromSkill: 'content-creation', toSkill: 'social-media', relationshipType: 'enhances', weight: 0.7 },
      { fromSkill: 'social-media', toSkill: 'community-management', relationshipType: 'enhances', weight: 0.6 },
      { fromSkill: 'ui-design', toSkill: 'ux-research', relationshipType: 'similar', weight: 0.5 },
      { fromSkill: 'figma', toSkill: 'ui-design', relationshipType: 'prerequisite', weight: 0.9 },
      { fromSkill: 'data-analysis', toSkill: 'visualization', relationshipType: 'prerequisite', weight: 0.8 },
      { fromSkill: 'python', toSkill: 'data-analysis', relationshipType: 'prerequisite', weight: 0.9 },
      { fromSkill: 'analytics', toSkill: 'growth-strategy', relationshipType: 'enhances', weight: 0.7 },
      { fromSkill: 'analytics', toSkill: 'conversion-optimization', relationshipType: 'enhances', weight: 0.6 }
    ];

    console.log(`[AdaPortal] Skill graph loaded: ${this.skills.size} skills, ${this.relationships.length} relationships`);
  }

  // Get skill by ID
  getSkill(skillId: string): SkillNode | undefined {
    return this.skills.get(skillId);
  }

  // Get all skills
  getAllSkills(): SkillNode[] {
    return Array.from(this.skills.values());
  }

  // Get skills by category
  getSkillsByCategory(category: string): SkillNode[] {
    return Array.from(this.skills.values()).filter(s => s.category === category);
  }

  // Get related skills
  getRelatedSkills(skillId: string): SkillNode[] {
    const skill = this.skills.get(skillId);
    if (!skill) return [];
    
    return skill.relatedSkills
      .map(id => this.skills.get(id))
      .filter((s): s is SkillNode => s !== undefined);
  }

  // Get relationships for a skill
  getRelationships(skillId: string): SkillRelationship[] {
    return this.relationships.filter(
      r => r.fromSkill === skillId || r.toSkill === skillId
    );
  }

  // Track skill improvement
  recordSkillImprovement(history: AgentSkillHistory): void {
    const key = history.agentId;
    if (!this.skillHistory.has(key)) {
      this.skillHistory.set(key, []);
    }
    this.skillHistory.get(key)!.push(history);
    console.log(`[AdaPortal] Recorded skill improvement for ${history.agentId}: ${history.skillId}`);
  }

  // Get skill history for agent
  getSkillHistory(agentId: string): AgentSkillHistory[] {
    return this.skillHistory.get(agentId) || [];
  }

  // Get categories
  getCategories(): string[] {
    const categories = new Set<string>();
    this.skills.forEach(skill => categories.add(skill.category));
    return Array.from(categories);
  }
}

export const skillGraph = new SkillGraphService();
export { SkillGraphService };