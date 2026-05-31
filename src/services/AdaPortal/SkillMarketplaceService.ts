// ============================================
// ADA PORTAL - Skill Marketplace Service
// Layer 9: Skills.sh Integration
// Fetches and manages reusable agent skills from skills.sh
// ============================================

import { AIMInfo } from './types';

// ============================================
// SKILLS.SH TYPES
// ============================================

export interface SkillInfo {
  name: string;
  fullName: string;          // e.g., "vercel-labs/agent-skills/vercel-react-best-practices"
  provider: string;          // e.g., "vercel-labs"
  category: string;
  installs: number;
  description: string;
  tags: string[];
  lastUpdated: number;
  endorsements?: number;       // Community endorsements/votes
}

export interface SkillSearchResult {
  skills: SkillInfo[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface AgentSkillAttachment {
  skillId: string;
  agentId: string;
  proficiency: number;       // 1-5 how well agent uses this skill
  trainedAt?: number;
}

// Skill categories for filtering
export const SKILL_CATEGORIES = [
  'frontend',
  'backend',
  'devops',
  'database',
  'ai-ml',
  'security',
  'testing',
  'marketing',
  'mobile',
  'cloud',
  'web3',
  'design'
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number];

// Mapping from Ada Portal agent roles to skill categories
const ROLE_TO_SKILL_CATEGORIES: Record<string, SkillCategory[]> = {
  marketing: ['marketing', 'frontend', 'design'],
  developer: ['backend', 'frontend', 'devops', 'database', 'security', 'web3'],
  uiux: ['frontend', 'design', 'mobile'],
  data_analyst: ['ai-ml', 'database', 'frontend'],
  growth: ['marketing', 'ai-ml', 'frontend']
};

// ============================================
// SKILL MARKETPLACE SERVICE
// ============================================

class SkillMarketplaceService {
  private skills: Map<string, SkillInfo> = new Map();
  private agentSkillAttachments: Map<string, AgentSkillAttachment> = new Map();
  private initialized: boolean = false;
  private lastFetch: number = 0;
  private cacheTTL: number = 60 * 60 * 1000; // 1 hour cache

  constructor() {
    // Initialize with demo skills (top skills.sh skills)
    this.initializeDemoSkills();
  }

  /**
   * Initialize with top skills from skills.sh (static demo data)
   * In production, this would fetch from skills.sh API
   */
  private initializeDemoSkills(): void {
    const demoSkills: SkillInfo[] = [
      // Top Frontend Skills
      {
        name: 'vercel-react-best-practices',
        fullName: 'vercel-labs/agent-skills/vercel-react-best-practices',
        provider: 'vercel-labs',
        category: 'frontend',
        installs: 261100,
        description: 'Best practices for building React applications with Vercel',
        tags: ['react', 'vercel', 'next.js'],
        lastUpdated: Date.now() - 7 * 24 * 60 * 60 * 1000
      },
      {
        name: 'frontend-design',
        fullName: 'anthropics/skills/frontend-design',
        provider: 'anthropics',
        category: 'frontend',
        installs: 218500,
        description: 'Design principles and patterns for frontend development',
        tags: ['design', 'ui', 'ux'],
        lastUpdated: Date.now() - 14 * 24 * 60 * 60 * 1000
      },
      {
        name: 'web-design-guidelines',
        fullName: 'vercel-labs/agent-skills/web-design-guidelines',
        provider: 'vercel-labs',
        category: 'design',
        installs: 210600,
        description: 'Comprehensive web design guidelines and patterns',
        tags: ['design', 'guidelines', 'ui'],
        lastUpdated: Date.now() - 10 * 24 * 60 * 60 * 1000
      },
      {
        name: 'shadcn',
        fullName: 'shadcn/ui/shadcn',
        provider: 'shadcn',
        category: 'frontend',
        installs: 51300,
        description: 'shadcn/ui component library integration',
        tags: ['components', 'ui', 'react'],
        lastUpdated: Date.now() - 5 * 24 * 60 * 60 * 1000
      },
      {
        name: 'tailwind-design-system',
        fullName: 'wshobson/agents/tailwind-design-system',
        provider: 'wshobson',
        category: 'design',
        installs: 25700,
        description: 'Tailwind CSS design system patterns',
        tags: ['tailwind', 'css', 'design-system'],
        lastUpdated: Date.now() - 21 * 24 * 60 * 60 * 1000
      },
      // Backend Skills
      {
        name: 'nodejs-backend-patterns',
        fullName: 'wshobson/agents/nodejs-backend-patterns',
        provider: 'wshobson',
        category: 'backend',
        installs: 13100,
        description: 'Node.js backend architecture patterns',
        tags: ['nodejs', 'backend', 'api'],
        lastUpdated: Date.now() - 30 * 24 * 60 * 60 * 1000
      },
      {
        name: 'api-design-principles',
        fullName: 'wshobson/agents/api-design-principles',
        provider: 'wshobson',
        category: 'backend',
        installs: 13200,
        description: 'RESTful API design principles and best practices',
        tags: ['api', 'rest', 'design'],
        lastUpdated: Date.now() - 25 * 24 * 60 * 60 * 1000
      },
      // DevOps/Cloud
      {
        name: 'azure-ai',
        fullName: 'microsoft/github-copilot-for-azure/azure-ai',
        provider: 'microsoft',
        category: 'cloud',
        installs: 146500,
        description: 'Azure AI services and integration',
        tags: ['azure', 'ai', 'cloud'],
        lastUpdated: Date.now() - 3 * 24 * 60 * 60 * 1000
      },
      {
        name: 'deploy-to-vercel',
        fullName: 'vercel-labs/agent-skills/deploy-to-vercel',
        provider: 'vercel-labs',
        category: 'devops',
        installs: 17700,
        description: 'Deploy applications to Vercel',
        tags: ['vercel', 'deploy', 'ci-cd'],
        lastUpdated: Date.now() - 8 * 24 * 60 * 60 * 1000
      },
      // AI/ML Skills
      {
        name: 'ai-image-generation',
        fullName: 'inferen-sh/skills/ai-image-generation',
        provider: 'inferen-sh',
        category: 'ai-ml',
        installs: 114500,
        description: 'AI-powered image generation workflows',
        tags: ['ai', 'image', 'generation'],
        lastUpdated: Date.now() - 4 * 24 * 60 * 60 * 1000
      },
      {
        name: 'ai-video-generation',
        fullName: 'inferen-sh/skills/ai-video-generation',
        provider: 'inferen-sh',
        category: 'ai-ml',
        installs: 111700,
        description: 'AI-powered video generation workflows',
        tags: ['ai', 'video', 'generation'],
        lastUpdated: Date.now() - 6 * 24 * 60 * 60 * 1000
      },
      {
        name: 'ai-sdk',
        fullName: 'vercel/ai/ai-sdk',
        provider: 'vercel',
        category: 'ai-ml',
        installs: 14500,
        description: 'Vercel AI SDK integration patterns',
        tags: ['ai', 'sdk', 'vercel'],
        lastUpdated: Date.now() - 12 * 24 * 60 * 60 * 1000
      },
      // Web3 Skills
      {
        name: 'browser-use',
        fullName: 'browser-use/browser-use/browser-use',
        provider: 'browser-use',
        category: 'web3',
        installs: 58400,
        description: 'Browser automation for Web3 interactions',
        tags: ['browser', 'automation', 'web3'],
        lastUpdated: Date.now() - 2 * 24 * 60 * 60 * 1000
      },
      // Marketing Skills
      {
        name: 'seo-audit',
        fullName: 'coreyhaines31/marketingskills/seo-audit',
        provider: 'coreyhaines31',
        category: 'marketing',
        installs: 59800,
        description: 'Comprehensive SEO audit and optimization',
        tags: ['seo', 'marketing', 'audit'],
        lastUpdated: Date.now() - 9 * 24 * 60 * 60 * 1000
      },
      {
        name: 'copywriting',
        fullName: 'coreyhaines31/marketingskills/copywriting',
        provider: 'coreyhaines31',
        category: 'marketing',
        installs: 51600,
        description: 'Persuasive copywriting techniques',
        tags: ['copywriting', 'marketing', 'content'],
        lastUpdated: Date.now() - 11 * 24 * 60 * 60 * 1000
      },
      {
        name: 'content-strategy',
        fullName: 'coreyhaines31/marketingskills/content-strategy',
        provider: 'coreyhaines31',
        category: 'marketing',
        installs: 34100,
        description: 'Content strategy development',
        tags: ['content', 'strategy', 'marketing'],
        lastUpdated: Date.now() - 15 * 24 * 60 * 60 * 1000
      },
      // Testing
      {
        name: 'playwright-best-practices',
        fullName: 'currents-dev/playwright-best-practices-skill/playwright-best-practices',
        provider: 'currents-dev',
        category: 'testing',
        installs: 17700,
        description: 'Playwright E2E testing best practices',
        tags: ['testing', 'playwright', 'e2e'],
        lastUpdated: Date.now() - 13 * 24 * 60 * 60 * 1000
      },
      // Database
      {
        name: 'supabase-postgres-best-practices',
        fullName: 'supabase/agent-skills/supabase-postgres-best-practices',
        provider: 'supabase',
        category: 'database',
        installs: 56800,
        description: 'Supabase and PostgreSQL best practices',
        tags: ['supabase', 'postgres', 'database'],
        lastUpdated: Date.now() - 7 * 24 * 60 * 60 * 1000
      },
      {
        name: 'database-schema-design',
        fullName: 'supercent-io/skills-template/database-schema-design',
        provider: 'supercent-io',
        category: 'database',
        installs: 12100,
        description: 'Database schema design patterns',
        tags: ['database', 'schema', 'design'],
        lastUpdated: Date.now() - 20 * 24 * 60 * 60 * 1000
      },
      // Security
      {
        name: 'security-best-practices',
        fullName: 'supercent-io/skills-template/security-best-practices',
        provider: 'supercent-io',
        category: 'security',
        installs: 14100,
        description: 'Application security best practices',
        tags: ['security', 'best-practices', 'owasp'],
        lastUpdated: Date.now() - 18 * 24 * 60 * 60 * 1000
      },
      // Mobile
      {
        name: 'building-native-ui',
        fullName: 'expo/skills/building-native-ui',
        provider: 'expo',
        category: 'mobile',
        installs: 23000,
        description: 'Native mobile UI development patterns',
        tags: ['mobile', 'native', 'ui'],
        lastUpdated: Date.now() - 16 * 24 * 60 * 60 * 1000
      },
      // Data Analysis
      {
        name: 'data-analysis',
        fullName: 'supercent-io/skills-template/data-analysis',
        provider: 'supercent-io',
        category: 'ai-ml',
        installs: 13800,
        description: 'Data analysis methodologies',
        tags: ['data', 'analysis', 'analytics'],
        lastUpdated: Date.now() - 22 * 24 * 60 * 60 * 1000
      },
      // Tool creation
      {
        name: 'mcp-builder',
        fullName: 'anthropics/skills/mcp-builder',
        provider: 'anthropics',
        category: 'backend',
        installs: 29300,
        description: 'Build Model Context Protocol servers',
        tags: ['mcp', 'tools', 'integration'],
        lastUpdated: Date.now() - 5 * 24 * 60 * 60 * 1000
      },
      // Code Quality
      {
        name: 'code-review',
        fullName: 'supercent-io/skills-template/code-review',
        provider: 'supercent-io',
        category: 'backend',
        installs: 12500,
        description: 'Effective code review practices',
        tags: ['code-review', 'quality', 'best-practices'],
        lastUpdated: Date.now() - 19 * 24 * 60 * 60 * 1000
      },
      // More Marketing
      {
        name: 'ad-creative',
        fullName: 'coreyhaines31/marketingskills/ad-creative',
        provider: 'coreyhaines31',
        category: 'marketing',
        installs: 19000,
        description: 'Advertising creative development',
        tags: ['advertising', 'creative', 'marketing'],
        lastUpdated: Date.now() - 17 * 24 * 60 * 60 * 1000
      },
      {
        name: 'pricing-strategy',
        fullName: 'coreyhaines31/marketingskills/pricing-strategy',
        provider: 'coreyhaines31',
        category: 'marketing',
        installs: 31000,
        description: 'Product pricing strategy development',
        tags: ['pricing', 'strategy', 'marketing'],
        lastUpdated: Date.now() - 23 * 24 * 60 * 60 * 1000
      },
      // Additional Frontend
      {
        name: 'next-best-practices',
        fullName: 'vercel-labs/next-skills/next-best-practices',
        provider: 'vercel-labs',
        category: 'frontend',
        installs: 47800,
        description: 'Next.js application best practices',
        tags: ['next.js', 'react', 'vercel'],
        lastUpdated: Date.now() - 6 * 24 * 60 * 60 * 1000
      },
      {
        name: 'react:components',
        fullName: 'google-labs-code/stitch-skills/react:components',
        provider: 'google-labs-code',
        category: 'frontend',
        installs: 25700,
        description: 'React component patterns',
        tags: ['react', 'components', 'patterns'],
        lastUpdated: Date.now() - 12 * 24 * 60 * 60 * 1000
      }
    ];

    demoSkills.forEach(skill => {
      this.skills.set(skill.name, skill);
    });

    console.log(`[SkillMarketplace] Initialized ${this.skills.size} skills from skills.sh`);
  }

  /**
   * Get all skills
   */
  getSkills(): SkillInfo[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills filtered by category
   */
  getSkillsByCategory(category: SkillCategory): SkillInfo[] {
    return Array.from(this.skills.values()).filter(
      s => s.category === category
    );
  }

  /**
   * Get skills filtered by provider
   */
  getSkillsByProvider(provider: string): SkillInfo[] {
    return Array.from(this.skills.values()).filter(
      s => s.provider.toLowerCase() === provider.toLowerCase()
    );
  }

  /**
   * Search skills by query
   */
  searchSkills(query: string, limit: number = 10): SkillInfo[] {
    const q = query.toLowerCase();
    return Array.from(this.skills.values())
      .filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
      .sort((a, b) => b.installs - a.installs)
      .slice(0, limit);
  }

  /**
   * Get skills recommended for an agent role
   */
  getSkillsForRole(role: string): SkillInfo[] {
    const categories = ROLE_TO_SKILL_CATEGORIES[role] || [];
    const skills: SkillInfo[] = [];
    
    categories.forEach(cat => {
      const catSkills = this.getSkillsByCategory(cat);
      skills.push(...catSkills);
    });
    
    // Deduplicate and sort by installs
    const unique = new Map<string, SkillInfo>();
    skills.forEach(s => unique.set(s.name, s));
    
    return Array.from(unique.values())
      .sort((a, b) => b.installs - a.installs)
      .slice(0, 10);
  }

  /**
   * Get top skills (by installs)
   */
  getTopSkills(limit: number = 10): SkillInfo[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.installs - a.installs)
      .slice(0, limit);
  }

  /**
   * Attach a skill to an agent
   */
  attachSkillToAgent(skillName: string, agentId: string, proficiency: number = 3): void {
    const skill = this.skills.get(skillName);
    if (!skill) {
      console.warn(`[SkillMarketplace] Skill not found: ${skillName}`);
      return;
    }

    const key = `${agentId}:${skillName}`;
    const attachment: AgentSkillAttachment = {
      skillId: skillName,
      agentId,
      proficiency,
      trainedAt: Date.now()
    };
    
    this.agentSkillAttachments.set(key, attachment);
    console.log(`[SkillMarketplace] Attached ${skillName} to agent ${agentId} (proficiency: ${proficiency})`);
  }

  /**
   * Get skills attached to an agent
   */
  getAgentSkills(agentId: string): SkillInfo[] {
    const attachments: SkillInfo[] = [];
    this.agentSkillAttachments.forEach((attachment, key) => {
      if (key.startsWith(`${agentId}:`)) {
        const skill = this.skills.get(attachment.skillId);
        if (skill) attachments.push(skill);
      }
    });
    return attachments.filter((s): s is SkillInfo => !!s);
  }

  /**
   * Get skill statistics
   */
  getStats(): {
    totalSkills: number;
    byCategory: Record<string, number>;
    topProviders: { provider: string; count: number }[];
    totalInstalls: number;
  } {
    const byCategory: Record<string, number> = {};
    const providerCount: Record<string, number> = {};
    let totalInstalls = 0;

    this.skills.forEach(skill => {
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      providerCount[skill.provider] = (providerCount[skill.provider] || 0) + 1;
      totalInstalls += skill.installs;
    });

    const topProviders = Object.entries(providerCount)
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalSkills: this.skills.size,
      byCategory,
      topProviders,
      totalInstalls
    };
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): SkillInfo | undefined {
    return this.skills.get(name);
  }

  /**
   * Fetch live skills from skills.sh API
   * Note: skills.sh doesn't currently have a public API
   * This structure is ready for when/if API becomes available
   */
  async refreshSkills(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetch < this.cacheTTL && this.initialized) {
      console.log('[SkillMarketplace] Cache valid, skipping refresh');
      return;
    }

    // skills.sh does not have a public API; skip external fetch to avoid 404 noise.
    // Skills are loaded from static demo data in initialize() instead.
    console.log('[SkillMarketplace] Using cached/demo skills (skills.sh API unavailable)');

    this.lastFetch = now;
    this.initialized = true;
  }

  /**
   * Get skill installation command
   */
  getInstallCommand(skillName: string): string {
    return `npx skillsadd ${skillName}`;
  }

  /**
   * Get all unique providers
   */
  getProviders(): string[] {
    const providers = new Set<string>();
    this.skills.forEach(s => providers.add(s.provider));
    return Array.from(providers).sort();
  }

  /**
   * Detach a skill from an agent
   */
  detachSkillFromAgent(skillName: string, agentId: string): void {
    this.agentSkillAttachments.delete(`${agentId}:${skillName}`);
    console.log(`[SkillMarketplace] Detached ${skillName} from ${agentId}`);
  }

  /**
   * Get skills attached to a specific agent
   */
  getSkillsForAgent(agentId: string): AgentSkillAttachment[] {
    const attachments: AgentSkillAttachment[] = [];
    this.agentSkillAttachments.forEach((attachment, key) => {
      if (key.startsWith(`${agentId}:`)) {
        attachments.push(attachment);
      }
    });
    return attachments;
  }

  /**
   * Endorse a skill (simple vote-like system)
   */
  endorseSkill(skillName: string, agentId: string): void {
    const skill = this.skills.get(skillName);
    if (skill) {
      skill.endorsements = (skill.endorsements || 0) + 1;
      console.log(`[SkillMarketplace] Endorsed ${skillName} (now ${skill.endorsements})`);
    }
  }

  /**
   * Save attachments to localStorage
   */
  saveAttachments(): void {
    try {
      const data: Record<string, AgentSkillAttachment> = {};
      this.agentSkillAttachments.forEach((v, k) => { data[k] = v; });
      localStorage.setItem('skillAttachments', JSON.stringify(data));
      console.log('[SkillMarketplace] Attachments saved to storage');
    } catch (e) {
      console.log('[SkillMarketplace] Failed to save attachments:', e);
    }
  }

  /**
   * Load attachments from localStorage
   */
  loadAttachments(): void {
    try {
      const saved = localStorage.getItem('skillAttachments');
      if (saved) {
        const data: Record<string, AgentSkillAttachment> = JSON.parse(saved);
        Object.entries(data).forEach(([k, v]) => {
          this.agentSkillAttachments.set(k, v);
        });
        console.log('[SkillMarketplace] Attachments loaded from storage');
      }
    } catch (e) {
      console.log('[SkillMarketplace] Failed to load attachments:', e);
    }
  }
}

export const skillMarketplace = new SkillMarketplaceService();
export { SkillMarketplaceService };