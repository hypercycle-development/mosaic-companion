/** ============================================================
 * Battery Org Integration - Entry Point
 * 
 * Exports:
 * - batteryOrgAdapter: API client for Battery Org
 * - batteryOrgPool: Pool service with discovery + load balancing
 * - Types: BatteryBox, BatteryPoolNode, etc.
 * ============================================================ */

export { batteryOrgAdapter, BatteryOrgAdapter } from './BatteryOrgAdapter';
export { batteryOrgPool, BatteryOrgPoolService } from './BatteryOrgPool';
export type {
  BatteryBox,
  BatteryJobRequest,
  BatteryJobResponse,
  BatteryHealthStatus,
} from './BatteryOrgAdapter';
export type {
  BatteryPoolNode,
  BatteryBoxSelection,
} from './BatteryOrgPool';
