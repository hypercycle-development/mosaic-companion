// =============================================================================
// STARGATE POOL - Service Index
// =============================================================================

// Core Pool Service (Node Factories)
export { stargatePoolService, default } from './StargatePoolService';
export type { 
  ChainType, 
  FactoryStatus, 
  AccessType, 
  DelegationConfig, 
  NodeFactory, 
  FactoryRegistrationInput,
  UserNFT,
  WalletNFTs,
  ANFEInfo
} from './StargatePoolService';

// Graph Service (The Graph integration)
export { graphService } from './GraphService';
export type { GraphConfig, ANFEGraphData } from './GraphService';

// Merkelizer Service (ANFE verification)
export { merkelizerService } from './MerkelizerService';
export type { VerificationResult, NodeInfo, UptimeInfo } from './MerkelizerService';

// NEW: Directly attach ANFE singleton to window so plugin renderer can consume it
// This replaces the broken `window.anfeService = ???` pattern that was never wired.
import { anfeService } from './ANFEService';
if (typeof window !== 'undefined') { (window as any).anfeService = anfeService; }

// Wallet Adapter (Mosaic wallet)
export { walletAdapter } from './WalletAdapter';
export type { WalletState, WalletProvider } from './WalletAdapter';

// ANFE Types
export type {
  ANFE,
  ANFEAttributes,
  ANFEMetadata,
  ANFEAttribute,
  ANFECoreAttributes,
  ANFEAIAttributes,
  AIModuleAttribute,
  SupportedChain,
  CHAIN_IDS,
  CHAIN_NAMES,
  ANFEDelegation,
  DelegationInput,
  DelegationResult,
  WalletANFEs,
  ANFEError,
  GraphError,
  MerkelizerError,
} from './ANFETypes';

export {
  parseAttributes,
  getLevelFromAttributes,
  getPrimaryLicense,
  getAIModuleNames,
  formatANFEForDisplay,
  graphToANFE,
} from './ANFETypes';

// ANFE Service (Core Engine)
export { anfeService } from './ANFEService';
export { hboxPoolService } from './HBoxPoolService';
export type { HBoxComputeNode, HypercycleNode } from './HBoxPoolService';

// Asset Discovery (Multi-chain scanner)
export { assetDiscovery } from './HyperCycleAssetDiscovery';
export type { HyperCycleAsset, AssetChain, AssetStandard, AssetCategory } from './HyperCycleAssetDiscovery';

export type {
  ValidatorNode,
  ValidatorPoolStatus,
} from './ANFETypes';

// Core resilience utilities
export {
  calculateBackoffDelay,
  executeWithFallback,
  withRetry,
  withCircuitBreaker,
  getCircuitState,
  resetAllCircuits,
  checkRPCEndpoint,
  hotRouteCache,
} from './RPCResilience';

export type { RPCResult, EndpointConfig } from './RPCResilience';

// Alchemy key management
export {
  alchemyKeyManager,
  getRPCEndpoints,
  getRPCEndpointConfigs,
  DEFAULT_RPC_ENDPOINTS,
} from './AlchemyKeyManager';

export type { AlchemyConfig, KeyValidationResult } from './AlchemyKeyManager';

// Shared RPC limiter with new resilience features
export {
  rpcCall,
  rpcCallWithRetry,
  isEndpointTripped,
  areAllEndpointsTripped,
  areAllEndpointsTrippedForChain,
  withGlobalRateLimit,
  recordRpcFailure,
  recordRpcSuccess,
  acquireRPCToken,
  releaseRPCToken,
  throttleNextRequest,
  debugCircuitState,
  resetGlobalCircuit,
  // Degraded mode
  isDegradedMode,
  enterDegradedMode,
  exitDegradedMode,
  getDegradedModeStatus,
  // Doctor check
  doctorCheck,
} from './SharedRPCLimiter';

export type { RPCCircuitState } from './SharedRPCLimiter';