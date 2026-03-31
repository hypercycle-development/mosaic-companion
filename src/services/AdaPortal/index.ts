// ============================================
// ADA PORTAL - Main Export
// AI Workforce + Compute + Intelligence Platform for Cardano
// ============================================

// Types
export * from './types';

// Core Services
export { agentMarketplace, AgentMarketplaceService } from './AgentMarketplaceService';
export { marketplaceAdapter, MarketplaceAdapterService } from './MarketplaceAdapterService';
export { agentEconomy, AgentEconomyService } from './AgentEconomyService';
export { leaderboard, LeaderboardService } from './LeaderboardService';
export { trainingMarketplace, TrainingMarketplaceService } from './TrainingMarketplaceService';
export { skillGraph, SkillGraphService } from './SkillGraphService';
export { agentPackages, AgentPackagesService } from './AgentPackagesService';
export { nodeIntelligence, NodeIntelligenceService } from './NodeIntelligenceService';
export { mcpIntegration, MCPIntegrationService } from './MCPIntegrationService';
export { ADA_PORTAL_CONFIG } from './types';
import { mcpIntegration } from './MCPIntegrationService';

// Initialize all services
export function initializeAdaPortal(): void {
  console.log('🚀 Ada Portal initializing...');
  
  // Services auto-initialize via singletons
  const status = mcpIntegration.getSystemStatus();
  
  console.log(`✅ Ada Portal ready:
  - ${status.agents} specialized agents
  - ${status.listings} marketplace listings
  - ${status.externalAgents} external agents
  - ${status.nodes.total} compute nodes (${status.nodes.reliable} reliable)
  - ${status.training.trainers} trainer agents
  - ${status.packages} enterprise packages
  `);
}