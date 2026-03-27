/**
 * Midnight Governance Dashboard
 * 
 * Midnight governance model uses four phases:
 * - Hilo (Proposal): Ideas are submitted and discussed
 * - Kūkolu (Voting): Token holders cast votes on proposals
 * - Mōhalu (Execution): Approved proposals are implemented
 * - Hua (Review): Post-implementation review and feedback
 */

import type { WalletApi, SignedTransaction, TransactionMetadata } from './types';

/**
 * Vote types for governance
 */
export type VoteType = 'For' | 'Against' | 'Abstain';

/**
 * Proposal status in the governance lifecycle
 */
export type ProposalStatus = 'hilo' | 'kukolu' | 'mohalu' | 'hua' | 'passed' | 'rejected';

/**
 * Vote record for a single voter
 */
export interface Vote {
  voter: string;
  vote: VoteType;
  weight: bigint;
  timestamp: Date;
  txHash?: string;
}

/**
 * Governance proposal interface
 */
export interface Proposal {
  /** Unique proposal identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Current status in governance lifecycle */
  status: ProposalStatus;
  /** Current vote counts */
  voteCount: {
    for: bigint;
    against: bigint;
    abstain: bigint;
  };
  /** Block number when voting ends (for Kūkolu phase) */
  endBlock: number;
  /** Current block (for calculating time remaining) */
  currentBlock: number;
  /** Address of the proposer */
  proposer: string;
  /** Proposal metadata (optional) */
  metadata?: {
    category?: string;
    fundingRequest?: bigint;
    implementationTimeline?: string;
    affectedContracts?: string[];
  };
  /** List of votes cast */
  votes: Vote[];
}

/**
 * AI Analysis result (placeholder)
 */
export interface ProposalAnalysis {
  proposalId: string;
  summary: string;
  riskAssessment: 'low' | 'medium' | 'high';
  communitySentiment: number; // -100 to 100
  technicalFeasibility: number; // 0 to 100
  recommendedAction?: 'support' | 'oppose' | 'abstain';
}

/**
 * Governance action result
 */
export interface GovernanceActionResult {
  success: boolean;
  txHash?: string;
  message: string;
  timestamp: Date;
}

/**
 * GovernanceService class
 * Handles all governance operations for the Midnight network
 */
export class GovernanceService {
  private proposals: Map<string, Proposal> = new Map();
  private walletApi: WalletApi | null = null;
  private currentBlock: number = 0;
  private governanceTokenPolicyId: string = '';
  private governanceScriptAddress: string = '';

  constructor(options?: {
    governanceTokenPolicyId?: string;
    governanceScriptAddress?: string;
    initialBlock?: number;
  }) {
    if (options?.governanceTokenPolicyId) {
      this.governanceTokenPolicyId = options.governanceTokenPolicyId;
    }
    if (options?.governanceScriptAddress) {
      this.governanceScriptAddress = options.governanceScriptAddress;
    }
    if (options?.initialBlock) {
      this.currentBlock = options.initialBlock;
    }
    
    // Initialize with mock data for development
    this.initializeMockProposals();
  }

  /**
   * Set the wallet API for signing transactions
   */
  setWallet(api: WalletApi): void {
    this.walletApi = api;
  }

  /**
   * Update current block number
   */
  setCurrentBlock(block: number): void {
    this.currentBlock = block;
  }

  /**
   * Get all proposals
   */
  getProposals(): Proposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Get proposals filtered by status
   */
  getProposalsByStatus(status: ProposalStatus): Proposal[] {
    return this.getProposals().filter(p => p.status === status);
  }

  /**
   * Get active proposals (in Kūkolu voting phase)
   */
  getActiveProposals(): Proposal[] {
    return this.getProposals().filter(p => p.status === 'kukolu');
  }

  /**
   * Get passed proposals
   */
  getPassedProposals(): Proposal[] {
    return this.getProposals().filter(p => p.status === 'passed');
  }

  /**
   * Get rejected proposals
   */
  getRejectedProposals(): Proposal[] {
    return this.getProposals().filter(p => p.status === 'rejected');
  }

  /**
   * Get proposal by ID
   */
  getProposal(id: string): Proposal | undefined {
    return this.proposals.get(id);
  }

  /**
   * Analyze a proposal (placeholder for AI analysis)
   * In production, this would call an AI service
   */
  async analyzeProposal(id: string): Promise<ProposalAnalysis | null> {
    const proposal = this.proposals.get(id);
    if (!proposal) {
      return null;
    }

    // Placeholder implementation - in production, integrate with AI service
    const totalVotes = proposal.voteCount.for + proposal.voteCount.against + proposal.voteCount.abstain;
    const forPercentage = totalVotes > 0 
      ? Number(proposal.voteCount.for * 100n / totalVotes) 
      : 0;

    return {
      proposalId: id,
      summary: `Proposal "${proposal.title}" is currently in ${proposal.status} phase. ` +
        `Votes: ${forPercentage}% For, ${100 - forPercentage}% Against/Abstain.`,
      riskAssessment: forPercentage > 66 ? 'low' : forPercentage > 33 ? 'medium' : 'high',
      communitySentiment: forPercentage - 50,
      technicalFeasibility: 75, // Placeholder
      recommendedAction: forPercentage > 60 ? 'support' : forPercentage < 40 ? 'oppose' : 'abstain'
    };
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    proposalId: string, 
    vote: VoteType
  ): Promise<GovernanceActionResult> {
    const proposal = this.proposals.get(proposalId);
    
    if (!proposal) {
      return {
        success: false,
        message: `Proposal ${proposalId} not found`,
        timestamp: new Date()
      };
    }

    if (proposal.status !== 'kukolu') {
      return {
        success: false,
        message: `Cannot vote on proposal in ${proposal.status} phase. Voting only allowed during Kūkolu.`,
        timestamp: new Date()
      };
    }

    if (!this.walletApi) {
      return {
        success: false,
        message: 'Wallet not connected. Please connect your wallet to cast votes.',
        timestamp: new Date()
      };
    }

    // In production, this would:
    // 1. Build the governance vote transaction
    // 2. Sign it with the wallet
    // 3. Submit to the network
    
    // Placeholder: simulate vote casting
    const placeholderTxHash = `vote_${proposalId}_${Date.now()}`;
    
    // Update proposal vote counts (in real implementation, this comes from on-chain data)
    // For now, just return success
    return {
      success: true,
      txHash: placeholderTxHash,
      message: `Vote "${vote}" cast successfully for proposal ${proposalId}`,
      timestamp: new Date()
    };
  }

  /**
   * Submit a new proposal (Hilo phase)
   */
  async submitProposal(
    title: string,
    description: string,
    proposer: string,
    metadata?: Proposal['metadata']
  ): Promise<GovernanceActionResult> {
    if (!this.walletApi) {
      return {
        success: false,
        message: 'Wallet not connected to submit proposal',
        timestamp: new Date()
      };
    }

    const id = `prop_${Date.now()}`;
    const endBlock = this.currentBlock + 14400; // ~48 hours at 5s/block
    
    const proposal: Proposal = {
      id,
      title,
      description,
      status: 'hilo',
      voteCount: { for: 0n, against: 0n, abstain: 0n },
      endBlock,
      currentBlock: this.currentBlock,
      proposer,
      metadata,
      votes: []
    };

    this.proposals.set(id, proposal);

    return {
      success: true,
      message: `Proposal "${title}" submitted successfully in Hilo phase`,
      timestamp: new Date()
    };
  }

  /**
   * Update proposal status (simulates phase transitions)
   * In production, this would be based on on-chain data
   */
  updateProposalStatus(id: string, status: ProposalStatus): boolean {
    const proposal = this.proposals.get(id);
    if (!proposal) return false;

    // Validate status transitions
    const validTransitions: Record<ProposalStatus, ProposalStatus[]> = {
      'hilo': ['kukolu', 'rejected'],
      'kukolu': ['mohalu', 'passed', 'rejected'],
      'mohalu': ['hua'],
      'hua': ['passed'],
      'passed': [],
      'rejected': []
    };

    if (!validTransitions[proposal.status].includes(status)) {
      return false;
    }

    proposal.status = status;
    return true;
  }

  /**
   * Get governance statistics
   */
  getStats(): {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    rejectedProposals: number;
    totalVotes: bigint;
  } {
    const proposals = this.getProposals();
    return {
      totalProposals: proposals.length,
      activeProposals: this.getActiveProposals().length,
      passedProposals: this.getPassedProposals().length,
      rejectedProposals: this.getRejectedProposals().length,
      totalVotes: proposals.reduce(
        (acc, p) => acc + p.voteCount.for + p.voteCount.against + p.voteCount.abstain,
        0n
      )
    };
  }

  /**
   * Initialize with mock proposal data for development
   */
  private initializeMockProposals(): void {
    const mockProposals: Proposal[] = [
      {
        id: 'prop_001',
        title: 'Treasury Diversification Initiative',
        description: 'Proposal to diversify 10% of treasury holdings into stablecoins to reduce volatility exposure and ensure operational continuity during market downturns.',
        status: 'kukolu',
        voteCount: { for: 1500000n, against: 450000n, abstain: 100000n },
        endBlock: 85200000,
        currentBlock: 85000000,
        proposer: 'addr1qx2...',
        metadata: {
          category: 'Treasury',
          fundingRequest: 50000000n, // 50M in Lovelace
          implementationTimeline: 'Q2 2026'
        },
        votes: [
          { voter: 'addr1qy1...', vote: 'For', weight: 500000n, timestamp: new Date('2026-03-20') },
          { voter: 'addr1qz2...', vote: 'Against', weight: 300000n, timestamp: new Date('2026-03-21') }
        ]
      },
      {
        id: 'prop_002',
        title: 'Privacy Protocol Upgrade v2.1',
        description: 'Upgrade the Midnight privacy protocol to v2.1, implementing zkSNARK optimizations that reduce proving time by 40% and decrease gas costs.',
        status: 'hilo',
        voteCount: { for: 0n, against: 0n, abstain: 0n },
        endBlock: 86000000,
        currentBlock: 85000000,
        proposer: 'addr1qyz...',
        metadata: {
          category: 'Technical',
          implementationTimeline: 'Q3 2026',
          affectedContracts: ['privacy_core_v2', 'zk_prover']
        },
        votes: []
      },
      {
        id: 'prop_003',
        title: 'Developer Grants Program',
        description: 'Establish a quarterly grants program with 100M ADA allocation to incentivize building privacy-preserving applications on the Midnight ecosystem.',
        status: 'mohalu',
        voteCount: { for: 2200000n, against: 200000n, abstain: 50000n },
        endBlock: 84500000,
        currentBlock: 85000000,
        proposer: 'addr1qwx...',
        metadata: {
          category: 'Ecosystem',
          fundingRequest: 100000000n,
          implementationTimeline: 'Q2-Q4 2026'
        },
        votes: [
          { voter: 'addr1qa1...', vote: 'For', weight: 800000n, timestamp: new Date('2026-03-15') },
          { voter: 'addr1qb2...', vote: 'For', weight: 600000n, timestamp: new Date('2026-03-16') },
          { voter: 'addr1qc3...', vote: 'Against', weight: 200000n, timestamp: new Date('2026-03-17') }
        ]
      },
      {
        id: 'prop_004',
        title: 'Cross-Chain Bridge Integration',
        description: 'Integrate with Axelar Network to enable seamless asset bridging between Midnight and Ethereum, Solana, and Cosmos ecosystems.',
        status: 'hua',
        voteCount: { for: 1800000n, against: 150000n, abstain: 50000n },
        endBlock: 84000000,
        currentBlock: 85000000,
        proposer: 'addr1qab...',
        metadata: {
          category: 'Integration',
          implementationTimeline: 'Q1-Q2 2026'
        },
        votes: []
      },
      {
        id: 'prop_005',
        title: 'Mobile Wallet Support',
        description: 'Develop native mobile wallets for iOS and Android to increase user accessibility and daily active usage.',
        status: 'rejected',
        voteCount: { for: 800000n, against: 2100000n, abstain: 300000n },
        endBlock: 83500000,
        currentBlock: 85000000,
        proposer: 'addr1qcd...',
        metadata: {
          category: 'Product',
          fundingRequest: 75000000n
        },
        votes: []
      }
    ];

    mockProposals.forEach(p => this.proposals.set(p.id, p));
  }
}

/**
 * Filter helper functions
 */
export const filterProposals = {
  byStatus: (proposals: Proposal[], status: ProposalStatus): Proposal[] => 
    proposals.filter(p => p.status === status),
  
  active: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'kukolu'),
  
  passed: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'passed'),
  
  rejected: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'rejected'),
  
  inHilo: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'hilo'),
  
  inKukolu: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'kukolu'),
  
  inMohalu: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'mohalu'),
  
  inHua: (proposals: Proposal[]): Proposal[] => 
    proposals.filter(p => p.status === 'hua'),
  
  endingSoon: (proposals: Proposal[], thresholdBlocks: number = 1000): Proposal[] => 
    proposals.filter(p => p.status === 'kukolu' && p.endBlock - p.currentBlock <= thresholdBlocks)
};

/**
 * Get phase display name
 */
export function getPhaseDisplayName(status: ProposalStatus): string {
  const phaseNames: Record<ProposalStatus, string> = {
    'hilo': 'Hilo (Proposal)',
    'kukolu': 'Kūkolu (Voting)',
    'mohalu': 'Mōhalu (Execution)',
    'hua': 'Hua (Review)',
    'passed': 'Passed',
    'rejected': 'Rejected'
  };
  return phaseNames[status];
}

/**
 * Get phase color (for UI)
 */
export function getPhaseColor(status: ProposalStatus): string {
  const colors: Record<ProposalStatus, string> = {
    'hilo': '#3B82F6',    // Blue
    'kukolu': '#10B981',  // Green
    'mohalu': '#F59E0B',  // Amber
    'hua': '#8B5CF6',     // Purple
    'passed': '#22C55E',  // Green
    'rejected': '#EF4444' // Red
  };
  return colors[status];
}

/**
 * Format vote count for display
 */
export function formatVoteCount(votes: bigint): string {
  if (votes >= 1000000n) {
    return `${(Number(votes) / 1000000).toFixed(1)}M`;
  }
  if (votes >= 1000n) {
    return `${(Number(votes) / 1000).toFixed(1)}K`;
  }
  return votes.toString();
}

// Export singleton instance for convenience
export const governanceService = new GovernanceService();