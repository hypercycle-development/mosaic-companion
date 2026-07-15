// =============================================================================
// VALIDATOR TYPES — Shared types for Stargate validator pool dashboard
// =============================================================================

export type ValidatorSyncStatus = 'synced' | 'catching_up' | 'offline';

export interface ValidatorTelemetry {
  /** Unique validator identifier (license id, node id, or custom tag) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Current sync status */
  status: ValidatorSyncStatus;
  /** Latest known block height */
  blockHeight: number;
  /** Number of connected peers */
  peerCount: number;
  /** Chain or network identifier */
  network: string;
  /** Timestamp (ms) of the last successful telemetry update */
  lastUpdate: number;
  /** Optional: node manager URL for deep-linking */
  nodeManagerUrl?: string;
  /** Optional: compute grade (High / Medium / Standard) */
  computeGrade?: string;
  /** Optional: latency in ms */
  latencyMs?: number;
  /** Optional: error message when status is offline */
  error?: string;
}

export interface ValidatorPool {
  poolId: string;
  poolName: string;
  validators: ValidatorTelemetry[];
  /** Pool-level aggregate: total validators */
  totalValidators: number;
  /** Pool-level aggregate: validators currently synced */
  syncedCount: number;
  /** Pool-level aggregate: validators catching up */
  catchingUpCount: number;
  /** Pool-level aggregate: validators offline */
  offlineCount: number;
}

export interface ValidatorStatusResponse {
  /** Raw status from the /status endpoint or IPC bridge */
  status: string;
  blockHeight?: number;
  peerCount?: number;
  network?: string;
  timestamp?: number;
  error?: string;
}
