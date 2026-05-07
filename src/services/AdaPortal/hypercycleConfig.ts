// ============================================
// ADA PORTAL - HyperCycle Configuration
// DEPRECATED: Use `src/services/HyperCycleContracts.ts` as the single source of truth.
// This file now re-exports from the canonical contract registry for backward compatibility.
// ============================================

export {
  ETH_CONTRACTS,
  BASE_CONTRACTS,
  HYPERCYCLE_CONTRACTS,
  HYPERCYCLE_SUBGRAPHS,
  MERKELIZER_API,
  HYPERCYCLE_TOKENS,
  encodeBalanceOf,
  encodeOwnerOf,
  encodeERC1155BalanceOf,
  decodeUint256,
  decodeAddress,
} from '../HyperCycleContracts';

// Legacy export names preserved for existing imports
import { ETH_CONTRACTS, BASE_CONTRACTS, HYPERCYCLE_SUBGRAPHS, MERKELIZER_API } from '../HyperCycleContracts';

export const HYPERCYCLE_CONTRACTS_LEGACY = {
  ethereum: ETH_CONTRACTS,
  base: BASE_CONTRACTS,
};

export const HYPERCYCLE_CONFIG = {
  subgraph: HYPERCYCLE_SUBGRAPHS,
  merkelizer: MERKELIZER_API,
  payment: {
    token: 'USDC',
    chain: 'ethereum',
    decimals: 6
  },
  mcp: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  // Contract addresses imported from canonical registry
  contracts: HYPERCYCLE_CONTRACTS_LEGACY,
};

export default HYPERCYCLE_CONFIG;
