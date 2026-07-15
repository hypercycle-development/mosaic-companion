// =============================================================================
// STARGATE POOL — Registry
// All pools self-register. No central file to edit when adding partners.
// =============================================================================

import type { PoolDefinition } from './types';
import BatteryValidatorPool from './BatteryValidatorPool';
import ComputePool from './ComputePool';
import SafeFreightPool from './SafeFreightPool';
import MateriosValidatorPool from './MateriosValidatorPool';
import BatteryLiveBadge from './BatteryLiveBadge';
import ComputeLiveBadge from './ComputeLiveBadge';
import MateriosLiveBadge from './MateriosLiveBadge';

export const STARGATE_POOLS: PoolDefinition[] = [
  {
    id: 'battery',
    name: 'Battery Validator Pool',
    shortName: 'Battery',
    description: 'CometBFT validator fleet for Battery Coin blockchain consensus',
    category: 'validator',
    icon: 'Radio',
    color: 'emerald',
    status: 'active',
    isConfigurable: true,
    liveBadge: BatteryLiveBadge,
    component: BatteryValidatorPool,
  },
  {
    id: 'compute',
    name: 'Community Compute Pool',
    shortName: 'Compute',
    description: 'HyperAIBox node factory compute allocation and tilling sessions',
    category: 'compute',
    icon: 'Server',
    color: 'indigo',
    status: 'active',
    isConfigurable: true,
    liveBadge: ComputeLiveBadge,
    component: ComputePool,
  },
  {
    id: 'safe-rev',
    name: 'SAFE Rev Pool',
    shortName: 'SAFE',
    description: 'Sovereign Autonomous Freight Exchange — AI-powered freight marketplace',
    category: 'freight',
    icon: 'Truck',
    color: 'green',
    status: 'active',
    isConfigurable: false,
    component: SafeFreightPool,
  },
  {
    id: 'materios',
    name: 'Materios Attestor Pool',
    shortName: 'Materios',
    description: 'Materios Preprod certificate attestor fleet — track attestation health & generated certs',
    category: 'validator',
    icon: 'Shield',
    color: 'green',
    status: 'active',
    isConfigurable: true,
    liveBadge: MateriosLiveBadge,
    component: MateriosValidatorPool,
  },
];

export function getPoolById(id: string): PoolDefinition | undefined {
  return STARGATE_POOLS.find((p) => p.id === id);
}

export function getActivePools(): PoolDefinition[] {
  return STARGATE_POOLS.filter((p) => p.status === 'active');
}
