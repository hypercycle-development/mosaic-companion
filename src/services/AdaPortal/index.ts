// ============================================
// ADA PORTAL - Main Export
// AI Workforce + Compute + Intelligence Platform for Cardano
// UPGRADED: Claw Code patterns - AgentRegistry integration
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
export { hyperInsight, HyperInsightService, checkHyperInsightConnection, connectToHyperInsight } from './HyperInsightService';
export { cardanoWallet, CardanoWalletService } from './CardanoWalletService';
export { skillMarketplace, SkillMarketplaceService, SKILL_CATEGORIES, type SkillInfo, type SkillCategory, type AgentSkillAttachment } from './SkillMarketplaceService';
export { accessControl, AccessControlService, type AccessCheck, type AccessLevel, type AccessType, type WalletState, type NFTHoldings, type NFTGatingConfig } from './AccessControlService';
export { stargatePoolService, type NodeFactory, type ChainType, type FactoryStatus, type AccessType as StargateAccessType, type FactoryRegistrationInput, type WalletNFTs, type UserNFT, type ANFEInfo } from '../StargatePool';
export { ADA_PORTAL_CONFIG } from './types';
import { mcpIntegration } from './MCPIntegrationService';
import { hyperInsight } from './HyperInsightService';
import { agentMarketplace } from './AgentMarketplaceService';
import { skillMarketplace } from './SkillMarketplaceService';
import { accessControl } from './AccessControlService';
import { PermissionContext, agentRegistry } from '../AgentRegistry';

// Initialize all services
export function initializeAdaPortal(): void {
  console.log('🚀 Ada Portal initializing...');
  
  // Services auto-initialize via singletons
  const status = mcpIntegration.getSystemStatus();
  const hsStats = hyperInsight.getStats();
  const activeAims = hyperInsight.getActiveAIMs();
  const skillStats = skillMarketplace.getStats();
  
  // Load persisted skill attachments
  skillMarketplace.loadAttachments();
  
  // Check access control for AI Agents, humans, NFT holders
  const accessCheck = accessControl.initialize();
  accessCheck.then(result => {
    console.log(`[AdaPortal] Access check: ${result.type || 'none'} - ${result.level} (${result.reason})`);
    if (!result.hasAccess) {
      console.log('[AdaPortal] Warning: Limited access - no wallet, NFT, or AI agent detected');
    }
  });
  
  // Claw Code: Register agents with AgentRegistry
  const defaultContext: PermissionContext = {
    sessionId: 'adaportal-init',
    allowedPermissions: new Set(['chat:read', 'chat:send', 'content:create']),
    blockedPermissions: new Set(),
    trustLevel: 'medium'
  };
  
  agentMarketplace.registerWithRegistry(defaultContext);
  
  console.log(`✅ Ada Portal ready:
  - ${status.agents} specialized agents
  - ${status.listings} marketplace listings
  - ${status.externalAgents} external agents
  - ${status.nodes.total} compute nodes (${status.nodes.reliable} reliable)
  - ${status.training.trainers} trainer agents
  - ${status.packages} enterprise packages
  - ${hsStats.totalAIMs} AI models (${activeAims.length} active)
  - ${hsStats.activeNodes} active nodes with ${hsStats.totalComputeTFLOPS} TFLOPS
  - ${skillStats.totalSkills} skills from skills.sh (${skillStats.totalInstalls.toLocaleString()} installs)
  - Registered with AgentRegistry (Claw Code patterns)
  `);
}

// ASP Gateway exports
export { aspGateway } from '../AspGateway';

// Re-export registry for external access
export { agentRegistry } from '../AgentRegistry';