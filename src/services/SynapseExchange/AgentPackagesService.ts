// ============================================
// LAYER 7: AGENT PACKAGES SERVICE
// Enterprise Multi-Agent Bundles
// ============================================

import type { AgentPackage, PackageSubscription } from './types';
import { agentMarketplace } from './AgentMarketplaceService';

// Storage
const packages = new Map<string, AgentPackage>();
const subscriptions = new Map<string, PackageSubscription>();

export class AgentPackagesService {
  constructor() {
    this.initializePackages();
  }

  private initializePackages(): void {
    const defaultPackages: AgentPackage[] = [
      {
        packageId: 'pkg_startup_kit',
        name: 'Startup Kit',
        description: 'Complete AI team for startups - Marketing, Development, and UI/UX all in one',
        agentIds: ['agent_marketing_001', 'agent_dev_001', 'agent_uiux_001'],
        roles: ['marketing', 'developer', 'uiux'],
        pricing: 299,
        features: [
          'Marketing Agent (content, SEO, social media)',
          'Developer Agent (frontend, backend, APIs)',
          'UI/UX Agent (design, prototyping)',
          'Basic orchestration',
          'Email support'
        ],
        popularity: 245
      },
      {
        packageId: 'pkg_growth_accelerator',
        name: 'Growth Accelerator',
        description: 'Maximum growth with marketing, data analysis, and growth optimization',
        agentIds: ['agent_marketing_001', 'agent_data_001', 'agent_growth_001'],
        roles: ['marketing', 'data_analyst', 'growth'],
        pricing: 399,
        features: [
          'Marketing Agent with advanced analytics',
          'Data Analyst Agent (visualization, reporting)',
          'Growth Agent (A/B testing, conversion)',
          'Advanced orchestration',
          'Priority support',
          'Weekly strategy calls'
        ],
        popularity: 189
      },
      {
        packageId: 'pkg_full_stack_team',
        name: 'Full-Stack Team',
        description: 'Complete development team with design and data capabilities',
        agentIds: ['agent_dev_001', 'agent_uiux_001', 'agent_data_001'],
        roles: ['developer', 'uiux', 'data_analyst'],
        pricing: 449,
        features: [
          'Full-Stack Developer Agent',
          'UI/UX Design Agent',
          'Data Analyst Agent',
          'DevOps integration',
          'Design system management',
          'Analytics dashboard'
        ],
        popularity: 156
      },
      {
        packageId: 'pkg_enterprise_ai',
        name: 'Enterprise AI Suite',
        description: 'Premium package with all 5 specialized agents',
        agentIds: ['agent_marketing_001', 'agent_dev_001', 'agent_uiux_001', 'agent_data_001', 'agent_growth_001'],
        roles: ['marketing', 'developer', 'uiux', 'data_analyst', 'growth'],
        pricing: 799,
        features: [
          'All 5 specialized agents',
          'Advanced multi-agent orchestration',
          'Custom workflows',
          'Dedicated account manager',
          'SLA guarantees',
          'API access',
          'White-label options'
        ],
        popularity: 78
      },
      {
        packageId: 'pkg_marketing_only',
        name: 'Marketing Powerhouse',
        description: 'Dedicated marketing team for growth-focused companies',
        agentIds: ['agent_marketing_001', 'agent_growth_001'],
        roles: ['marketing', 'growth'],
        pricing: 199,
        features: [
          'Marketing Agent',
          'Growth Agent',
          'Campaign management',
          'A/B testing suite',
          'Social media automation'
        ],
        popularity: 312
      }
    ];

    defaultPackages.forEach(pkg => {
      packages.set(pkg.packageId, pkg);
    });

    console.log(`[AgentPackages] Initialized ${defaultPackages.length} packages`);
  }

  // Get all packages
  getPackages(filters?: { minPrice?: number; maxPrice?: number; requiredRoles?: string[] }): AgentPackage[] {
    let result = Array.from(packages.values());

    if (filters?.minPrice) {
      result = result.filter(p => p.pricing >= filters.minPrice!);
    }
    if (filters?.maxPrice) {
      result = result.filter(p => p.pricing <= filters.maxPrice!);
    }
    if (filters?.requiredRoles) {
      result = result.filter(p => 
        filters.requiredRoles!.some(role => p.roles.includes(role as any))
      );
    }

    return result.sort((a, b) => b.popularity - a.popularity);
  }

  // Get package by ID
  getPackage(packageId: string): AgentPackage | null {
    return packages.get(packageId) || null;
  }

  // Get package for specific roles
  findPackageForRoles(roles: string[]): AgentPackage | null {
    for (const pkg of packages.values()) {
      const hasAllRoles = roles.every(role => pkg.roles.includes(role as any));
      if (hasAllRoles) return pkg;
    }
    return null;
  }

  // Subscribe to package
  subscribe(userId: string, packageId: string): PackageSubscription | null {
    const pkg = packages.get(packageId);
    if (!pkg) {
      console.warn(`[AgentPackages] Package not found: ${packageId}`);
      return null;
    }

    const subscription: PackageSubscription = {
      subscriptionId: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      packageId,
      userId,
      startDate: Date.now(),
      status: 'active'
    };

    subscriptions.set(subscription.subscriptionId, subscription);

    // Update popularity
    pkg.popularity++;

    console.log(`[AgentPackages] ${userId} subscribed to ${pkg.name}`);
    return subscription;
  }

  // Get subscription
  getSubscription(subscriptionId: string): PackageSubscription | null {
    return subscriptions.get(subscriptionId) || null;
  }

  // Get subscriptions for user
  getUserSubscriptions(userId: string): PackageSubscription[] {
    return Array.from(subscriptions.values())
      .filter(s => s.userId === userId && s.status === 'active');
  }

  // Cancel subscription
  cancelSubscription(subscriptionId: string): boolean {
    const sub = subscriptions.get(subscriptionId);
    if (!sub) return false;

    sub.status = 'cancelled';
    sub.endDate = Date.now();
    console.log(`[AgentPackages] Cancelled subscription ${subscriptionId}`);
    return true;
  }

  // Get package agents
  getPackageAgents(packageId: string): string[] {
    const pkg = packages.get(packageId);
    return pkg?.agentIds || [];
  }

  // Get popular packages
  getPopularPackages(limit: number = 5): AgentPackage[] {
    return Array.from(packages.values())
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  // Create custom package
  createPackage(name: string, description: string, agentIds: string[], pricing: number, features: string[]): AgentPackage {
    const roles = new Set<string>();
    agentIds.forEach(agentId => {
      const agent = agentMarketplace.getAgent(agentId);
      if (agent) {
        agent.roles.forEach(role => roles.add(role));
      }
    });

    const pkg: AgentPackage = {
      packageId: `pkg_custom_${Date.now()}`,
      name,
      description,
      agentIds,
      roles: Array.from(roles) as any,
      pricing,
      features,
      popularity: 0
    };

    packages.set(pkg.packageId, pkg);
    console.log(`[AgentPackages] Created custom package: ${name}`);
    return pkg;
  }
}

export const agentPackages = new AgentPackagesService();