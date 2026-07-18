// =============================================================================
// STARGATE POOLS — Barrel Export
// =============================================================================

export { default as ValidatorPoolCard } from './ValidatorPoolCard';
export type { ValidatorPoolCardProps } from './ValidatorPoolCard';

export { default as ValidatorFleetGrid } from './ValidatorFleetGrid';
export type { ValidatorFleetGridProps } from './ValidatorFleetGrid';

export { default as ValidatorStatusBadge } from './ValidatorStatusBadge';
export type { ValidatorStatusBadgeProps } from './ValidatorStatusBadge';

export { default as useValidatorTelemetry } from './useValidatorTelemetry';
export type { ValidatorEndpoint, UseValidatorTelemetryResult } from './useValidatorTelemetry';

export { default as useMateriosTelemetry } from './useMateriosTelemetry';
export type { MateriosEndpoint, MateriosAttestorTelemetry, UseMateriosTelemetryResult } from './useMateriosTelemetry';

export { default as MateriosPoolCard } from './MateriosPoolCard';
export type { MateriosPoolCardProps } from './MateriosPoolCard';

export { default as MateriosLiveBadge } from './MateriosLiveBadge';

export { default as MateriosValidatorPool } from './MateriosValidatorPool';

// Pool registry + types + live badges
export * from './types';
export { STARGATE_POOLS, getPoolById, getActivePools } from './registry';
export { default as BatteryLiveBadge } from './BatteryLiveBadge';
export { default as ComputeLiveBadge } from './ComputeLiveBadge';
export { default as PoolConfigModal } from './PoolConfigModal';
