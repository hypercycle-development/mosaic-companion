// =============================================================================
// STARGATE INTEGRATIONS — Barrel Export
// =============================================================================

export {
  agentToolService,
  default as AgentToolService,
  type AgentToolManifest,
  type AgentToolRegistrationResult,
} from './AgentToolService';

export {
  mcpAIMService,
  default as MCPAIMService,
  type MCPServerConfig,
  type MCPRegisterResult,
  type AIMServerStatus,
} from './MCPAIMService';

// P1 integrations:
export {
  unifiedOrchestrator,
  default as UnifiedOrchestrator,
  type FleetNode,
  type FleetJobConfig,
  type FleetJobResult,
  type HybridOrchestrationResult,
} from './UnifiedOrchestrator';

export {
  ideAgentForge,
  default as IDEAgentForge,
  type AgentTemplate,
  type AgentForgeSession,
  type ForgeDeployConfig,
} from './IDEAgentForge';

// P2 integrations:
export {
  fleetSandboxLauncher,
  default as FleetSandboxLauncher,
} from './FleetSandboxLauncher';

// export { secureAspGateway } from './SecureAspGateway';     // P2-6
// export { fleetGatekeeperFilter } from './FleetGatekeeperFilter'; // P2-7
// export { fleetChronicleLogger } from './FleetChronicleLogger'; // P2-8
