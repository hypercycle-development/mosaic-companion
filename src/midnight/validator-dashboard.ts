/**
 * Midnight Validator Dashboard Module
 * Display and manage validator/stake pool data
 */

import type { WalletBalance } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ValidatorData {
  id: string;
  name: string;
  description?: string;
  /** Stake in Lovelace */
  stake: bigint;
  /** Total stake capacity */
  capacity: bigint;
  /** Uptime percentage (0-100) */
  uptime: number;
  /** Blocks produced in current epoch */
  blocksProduced: number;
  /** Total lifetime blocks */
  totalBlocks: number;
  /** Commission rate (0-100) */
  commission: number;
  /** Registration epoch */
  registeredEpoch: number;
  /** Is permissioned validator */
  permissioned: boolean;
  /** Pool relays */
  relays: ValidatorRelay[];
  /** Rewards earned (last epoch) */
  lastEpochRewards: bigint;
  /** Pool pledge */
  pledge: bigint;
  /** Margin */
  margin: number;
  /** Ticker */
  ticker?: string;
  /** Homepage */
  homepage?: string;
}

export interface ValidatorRelay {
  iana: number;
  hostname?: string;
  ipv4?: string;
  ipv6?: string;
  port: number;
  /** Relay metadata */
  description?: string;
}

export interface ValidatorMetrics {
  id: string;
  /** Live stake */
  liveStake: bigint;
  /** Active stake */
  activeStake: bigint;
  /** Saturated percentage */
  saturated: number;
  /** Delegator count */
  delegators: number;
  /** Blocks in last epoch */
  lastEpochBlocks: number;
  /** Performance score (0-100) */
  performance: number;
  /** Cost (in Lovelace per epoch) */
  cost: bigint;
}

export interface DelegationInfo {
  validatorId: string;
  walletAddress: string;
  /** Delegated amount in Lovelace */
  amount: bigint;
  /** Rewards earned so far */
  rewards: bigint;
  /** Pending rewards */
  pendingRewards: bigint;
}

export interface RewardCalculation {
  /** Annual percentage return */
  apy: number;
  /** Monthly return */
  monthlyReturn: bigint;
  /** Yearly return */
  yearlyReturn: bigint;
  /** After commission */
  netApy: number;
}

// ============================================================================
// Mock Data (Development)
// ============================================================================

const MOCK_VALIDATORS: ValidatorData[] = [
  {
    id: 'pool1abc123',
    name: 'Midnight Foundation',
    description: 'Official Midnight Network validator',
    stake: 50_000_000_000n,
    capacity: 100_000_000_000n,
    uptime: 99.8,
    blocksProduced: 12,
    totalBlocks: 4523,
    commission: 3.0,
    registeredEpoch: 1,
    permissioned: true,
    relays: [{ iana: 1, hostname: 'relay1.midnight.network', port: 3000 }],
    lastEpochRewards: 250_000_000n,
    pledge: 10_000_000_000n,
    margin: 0.03,
    ticker: 'MIDN',
    homepage: 'https://midnight.network',
  },
  {
    id: 'pool1def456',
    name: 'HPEC DAO Validator',
    description: 'Community validator operated by HPEC DAO',
    stake: 25_000_000_000n,
    capacity: 50_000_000_000n,
    uptime: 99.5,
    blocksProduced: 8,
    totalBlocks: 2156,
    commission: 4.0,
    registeredEpoch: 2,
    permissioned: true,
    relays: [{ iana: 1, ipv4: '192.168.0.10', port: 3001 }],
    lastEpochRewards: 125_000_000n,
    pledge: 5_000_000_000n,
    margin: 0.04,
    ticker: 'HPEC',
    homepage: 'https://hpec.dao',
  },
  {
    id: 'pool1ghi789',
    name: 'Cardano Pool Europe',
    description: 'European community validator',
    stake: 15_000_000_000n,
    capacity: 30_000_000_000n,
    uptime: 99.2,
    blocksProduced: 5,
    totalBlocks: 1234,
    commission: 5.0,
    registeredEpoch: 5,
    permissioned: false,
    relays: [{ iana: 724, hostname: 'eu.cardanopool.eu', port: 3000 }],
    lastEpochRewards: 75_000_000n,
    pledge: 2_000_000_000n,
    margin: 0.05,
    ticker: 'CPE',
  },
];

// ============================================================================
// Validator Service
// ============================================================================

export class ValidatorService {
  private useMock: boolean;

  constructor(useMock = true) {
    this.useMock = useMock;
  }

  /**
   * Get list of validators
   */
  async getValidators(): Promise<ValidatorData[]> {
    if (this.useMock) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      return MOCK_VALIDATORS;
    }

    // TODO: Replace with actual API call
    // const response = await fetch('https://api.midnight.network/validators');
    // return response.json();
    return [];
  }

  /**
   * Get specific validator by ID
   */
  async getValidator(id: string): Promise<ValidatorData | null> {
    const validators = await this.getValidators();
    return validators.find((v) => v.id === id) || null;
  }

  /**
   * Get validator metrics
   */
  async getValidatorMetrics(id: string): Promise<ValidatorMetrics | null> {
    const validator = await this.getValidator(id);
    if (!validator) return null;

    const saturation = Number(validator.stake) / Number(validator.capacity) * 100;

    return {
      id,
      liveStake: validator.stake,
      activeStake: validator.stake,
      saturated: saturation,
      delegators: Math.floor(Number(validator.stake) / 100_000_000), // Approximate
      lastEpochBlocks: validator.blocksProduced,
      performance: validator.uptime,
      cost: 340_000_000n, // 340 ADA per epoch
    };
  }

  /**
   * Calculate expected rewards for a delegation
   */
  calculateExpectedRewards(
    stakeAda: bigint,
    validator: ValidatorData
  ): RewardCalculation {
    const stakeLovelace = stakeAda;
    const totalStake = validator.stake + stakeLovelace;
    
    // Rough APY calculation based on total network stake
    // In reality this would come from network parameters
    const totalNetworkStake = 1_000_000_000_000n; // 1B ADA equivalent
    const epochReward = 1_000_000n; // 1000 ADA per epoch
    
    const share = Number(stakeLovelace) / Number(totalStake);
    const epochsPerYear = 365;
    
    const yearlyReturn = epochReward * BigInt(epochsPerYear) * share;
    const monthlyReturn = yearlyReturn / 12n;
    const grossApy = (Number(yearlyReturn) / Number(stakeLovelace)) * 100;
    
    const netApy = grossApy * (1 - validator.commission / 100);

    return {
      apy: grossApy,
      monthlyReturn,
      yearlyReturn,
      netApy,
    };
  }

  /**
   * Sort validators by different criteria
   */
  sortValidators(
    validators: ValidatorData[],
    criteria: 'stake' | 'uptime' | 'commission' | 'blocks'
  ): ValidatorData[] {
    return [...validators].sort((a, b) => {
      switch (criteria) {
        case 'stake':
          return Number(b.stake - a.stake);
        case 'uptime':
          return b.uptime - a.uptime;
        case 'commission':
          return a.commission - b.commission;
        case 'blocks':
          return b.blocksProduced - a.blocksProduced;
        default:
          return 0;
      }
    });
  }

  /**
   * Filter validators
   */
  filterValidators(
    validators: ValidatorData[],
    options: {
      permissionedOnly?: boolean;
      minUptime?: number;
      maxCommission?: number;
      search?: string;
    }
  ): ValidatorData[] {
    return validators.filter((v) => {
      if (options.permissionedOnly && !v.permissioned) return false;
      if (options.minUptime && v.uptime < options.minUptime) return false;
      if (options.maxCommission && v.commission > options.maxCommission) return false;
      if (options.search) {
        const search = options.search.toLowerCase();
        if (
          !v.name.toLowerCase().includes(search) &&
          !v.ticker?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get delegation info for a wallet
   */
  async getDelegation(walletAddress: string): Promise<DelegationInfo | null> {
    // TODO: Connect to chain to check actual delegation
    // For now, return null (no delegation)
    return null;
  }

  /**
   * Calculate diversification recommendations
   */
  getDiversificationRecommendations(
    totalStake: bigint,
    validators: ValidatorData[]
  ): { validatorId: string; suggestedAmount: bigint }[] {
    // Simple diversification: spread across top validators
    const top = this.sortValidators(validators, 'stake').slice(0, 5);
    const perValidator = totalStake / BigInt(top.length);
    
    return top.map((v) => ({
      validatorId: v.id,
      suggestedAmount: perValidator,
    }));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const validatorService = new ValidatorService();

export async function getTopValidators(count = 10): Promise<ValidatorData[]> {
  const all = await validatorService.getValidators();
  return validatorService.sortValidators(all, 'stake').slice(0, count);
}

export async function getValidatorsByPerformance(minUptime = 95): Promise<ValidatorData[]> {
  const all = await validatorService.getValidators();
  return validatorService.filterValidators(all, { minUptime });
}

export default ValidatorService;