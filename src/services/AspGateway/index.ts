// ============================================
// ASP GATEWAY - Main Export
// Company Onboarding Door for Agentic System Packages
// ============================================

import { aspGateway } from './AspGatewayService';

export * from './types';
export { AspGatewayService, aspGateway } from './AspGatewayService';

// Convenience re-exports
export type {
  Company,
  AspPackage,
  AspAgent,
  AspRole,
  AspPermission,
  ExecutionRequest,
  ExecutionResult,
  UsageRecord,
  BillingConfig,
  ComplianceConfig,
  NodeBinding,
  AgentType,
  ExecutionPreference,
  ExecutionMode,
  ResourceRequirements,
  AspWorkflow,
  WorkflowStep
} from './types';

// Initialize function
export function initializeAspGateway(): void {
  console.log('[AspGateway] Initializing...');
  const packages = aspGateway.getAllAsp();
  const companies = aspGateway.getAllCompanies();
  const horizonHub = aspGateway.getHorizonHub();
  
  console.log(`[AspGateway] Ready:
    - ${companies.length} companies
    - ${packages.length} ASPs
    - HorizonHub: ${horizonHub ? 'loaded' : 'not loaded'}
  `);
}