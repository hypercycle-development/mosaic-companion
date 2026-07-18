// ============================================
// ADA PORTAL - Agent Packages Service
// Layer 7: Pre-built agent bundles
// ============================================

import { AgentPackage, AgentRole } from './types';

class AgentPackagesService {
  private packages: Map<string, AgentPackage> = new Map();

  constructor() {
    this.initializePackages();
    console.log('[AdaPortal] Agent packages initialized');
  }

  private initializePackages(): void {
    const demoPackages: AgentPackage[] = [
      {
        packageId: 'launch-kit',
        name: 'Launch Kit',
        description: 'Everything you need to launch your Web3 project',
        agents: [
          { agentId: 'agent-marketing-001', name: 'CryptoMark', role: 'marketing', included: true },
          { agentId: 'agent-uiux-001', name: 'DesignFlow', role: 'uiux', included: true },
          { agentId: 'agent-growth-001', name: 'GrowthRocket', role: 'growth', included: true }
        ],
        computeAllocation: 50,
        price: 299,
        popular: true
      },
      {
        packageId: 'growth-accelerator',
        name: 'Growth Accelerator',
        description: 'Scale your project with dedicated growth agents',
        agents: [
          { agentId: 'agent-marketing-001', name: 'CryptoMark', role: 'marketing', included: true },
          { agentId: 'agent-growth-001', name: 'GrowthRocket', role: 'growth', included: true },
          { agentId: 'agent-data-001', name: 'DataPulse', role: 'data_analyst', included: true }
        ],
        computeAllocation: 100,
        price: 499,
        popular: true
      },
      {
        packageId: 'dev-team',
        name: 'Dev Team',
        description: 'Full development power for building dApps',
        agents: [
          { agentId: 'agent-dev-001', name: 'CodeCraft', role: 'developer', included: true },
          { agentId: 'agent-uiux-001', name: 'DesignFlow', role: 'uiux', included: true }
        ],
        computeAllocation: 200,
        price: 599,
        popular: false
      },
      {
        packageId: 'full-stack',
        name: 'Full-Stack Team',
        description: 'Complete AI workforce for enterprise projects',
        agents: [
          { agentId: 'agent-dev-001', name: 'CodeCraft', role: 'developer', included: true },
          { agentId: 'agent-marketing-001', name: 'CryptoMark', role: 'marketing', included: true },
          { agentId: 'agent-uiux-001', name: 'DesignFlow', role: 'uiux', included: true },
          { agentId: 'agent-data-001', name: 'DataPulse', role: 'data_analyst', included: true },
          { agentId: 'agent-growth-001', name: 'GrowthRocket', role: 'growth', included: true }
        ],
        computeAllocation: 500,
        price: 999,
        popular: true
      }
    ];

    demoPackages.forEach(pkg => this.packages.set(pkg.packageId, pkg));
    console.log(`[AdaPortal] Initialized ${this.packages.size} enterprise packages`);
  }

  // Get all packages
  getPackages(): AgentPackage[] {
    return Array.from(this.packages.values());
  }

  // Get package by ID
  getPackage(packageId: string): AgentPackage | undefined {
    return this.packages.get(packageId);
  }

  // Get popular packages
  getPopularPackages(): AgentPackage[] {
    return Array.from(this.packages.values()).filter(p => p.popular);
  }

  // Get packages by price range
  getPackagesByPrice(min: number, max: number): AgentPackage[] {
    return Array.from(this.packages.values()).filter(p => p.price >= min && p.price <= max);
  }

  // Get packages containing specific role
  getPackagesByRole(role: AgentRole): AgentPackage[] {
    return Array.from(this.packages.values()).filter(p =>
      p.agents.some(a => a.role === role)
    );
  }

  // Subscribe to package (returns mock subscription)
  subscribe(packageId: string): { subscriptionId: string; packageId: string; status: string } {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`);
    }

    return {
      subscriptionId: `sub-${Date.now()}`,
      packageId,
      status: 'active'
    };
  }

  // Get package stats
  getStats(): {
    totalPackages: number;
    popularCount: number;
    averagePrice: number;
    totalAgentsIncluded: number;
  } {
    const packages = Array.from(this.packages.values());

    return {
      totalPackages: packages.length,
      popularCount: packages.filter(p => p.popular).length,
      averagePrice: packages.reduce((sum, p) => sum + p.price, 0) / packages.length,
      totalAgentsIncluded: packages.reduce((sum, p) => sum + p.agents.length, 0)
    };
  }
}

export const agentPackages = new AgentPackagesService();
export { AgentPackagesService };