// ============================================================
// STARGATE VERIFIED NFT COLLECTION REGISTRY
// ============================================================
// Maps verified Cardano policy IDs to rich collection metadata,
// social links, infrastructure stats, and HyperCycle/Stargate
// utility configuration.
//
// This is the source of truth for verified collections in the
// Stargate module. Only collections listed here get:
//   - Verified badge
//   - Enhanced metadata cards
//   - Infrastructure panels
//   - Utility unlocks
// ============================================================

export interface StargateCollectionConfig {
  policyId: string;
  collectionName: string;
  verified: boolean;
  projectType: 'Node Factory' | 'DAO' | 'AI Workforce' | 'Infrastructure' | 'Community' | 'Other';
  description: string;
  bannerImage?: string;        // IPFS / https URL
  logoImage?: string;          // IPFS / https URL
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  // HyperCycle / Stargate infrastructure metadata
  infrastructure?: {
    nodeFactories: number;
    activeNodes: number;
    computePowerTFLOPS: number;
    rewardPoolHYPC: number;
    delegatedSince?: string;   // ISO date
  };
  // Utility gates
  utility: {
    stargateAccess: boolean;
    nodeFactoryControl: boolean;
    governanceVoting: boolean;
    premiumAIMs: boolean;
    computeCredits: boolean;
  };
  // Display config
  display: {
    accentColor: string;         // Tailwind color class or hex
    glowEffect: boolean;
    cardVariant: 'premium' | 'standard' | 'minimal';
  };
}

// ============================================================
// VERIFIED COLLECTIONS
// ============================================================

export const STARGATE_VERIFIED_COLLECTIONS: StargateCollectionConfig[] = [
  {
    policyId: 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46',
    collectionName: 'HPEC DAO PASS',
    verified: true,
    projectType: 'Node Factory',
    description: 'HPEC Corn AI Land DAO — Cardano-based AI infrastructure governance token. Grants access to node factory delegation, compute pools, and DAO governance.',
    website: 'https://hpecdao.net/',
    twitter: 'https://x.com/HPEC_DAO',
    infrastructure: {
      nodeFactories: 24,
      activeNodes: 180,
      computePowerTFLOPS: 2400,
      rewardPoolHYPC: 125000,
      delegatedSince: '2024-03-15',
    },
    utility: {
      stargateAccess: true,
      nodeFactoryControl: true,
      governanceVoting: true,
      premiumAIMs: true,
      computeCredits: true,
    },
    display: {
      accentColor: '#8b5cf6',     // violet-500
      glowEffect: true,
      cardVariant: 'premium',
    },
  },
  {
    policyId: '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5',
    collectionName: 'CMHPEC DAO PASS',
    verified: true,
    projectType: 'Node Factory',
    description: 'CMHPEC DAO PASS — Premium infrastructure governance NFT for Corn AI Land ecosystem. Multi-factory delegation rights with enhanced compute allocation.',
    website: 'https://hpecdao.net/',
    twitter: 'https://x.com/HPEC_DAO',
    infrastructure: {
      nodeFactories: 36,
      activeNodes: 320,
      computePowerTFLOPS: 4800,
      rewardPoolHYPC: 280000,
      delegatedSince: '2024-06-01',
    },
    utility: {
      stargateAccess: true,
      nodeFactoryControl: true,
      governanceVoting: true,
      premiumAIMs: true,
      computeCredits: true,
    },
    display: {
      accentColor: '#ec4899',     // pink-500
      glowEffect: true,
      cardVariant: 'premium',
    },
  },
  {
    policyId: 'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65',
    collectionName: 'HyperDegens',
    verified: true,
    projectType: 'Community',
    description: 'HyperDegens — Cardano-native community collection with HyperCycle ecosystem integrations. Community governance and shared compute pool access.',
    twitter: 'https://x.com/HyperDegens',
    infrastructure: {
      nodeFactories: 8,
      activeNodes: 64,
      computePowerTFLOPS: 640,
      rewardPoolHYPC: 45000,
      delegatedSince: '2024-08-20',
    },
    utility: {
      stargateAccess: true,
      nodeFactoryControl: false,
      governanceVoting: true,
      premiumAIMs: false,
      computeCredits: true,
    },
    display: {
      accentColor: '#f59e0b',     // amber-500
      glowEffect: true,
      cardVariant: 'standard',
    },
  },
];

// ============================================================
// LOOKUP HELPERS
// ============================================================

export function getVerifiedCollection(policyId: string): StargateCollectionConfig | undefined {
  return STARGATE_VERIFIED_COLLECTIONS.find(
    c => c.policyId.toLowerCase() === policyId.toLowerCase()
  );
}

export function isVerifiedCollection(policyId: string): boolean {
  return STARGATE_VERIFIED_COLLECTIONS.some(
    c => c.policyId.toLowerCase() === policyId.toLowerCase() && c.verified
  );
}

export function getCollectionDisplayName(policyId: string): string {
  const config = getVerifiedCollection(policyId);
  return config?.collectionName || `Policy ${policyId.slice(0, 8)}...`;
}

export function getCollectionAccentColor(policyId: string): string {
  const config = getVerifiedCollection(policyId);
  return config?.display.accentColor || '#3b82f6'; // default blue-500
}

export function getAllVerifiedPolicyIds(): string[] {
  return STARGATE_VERIFIED_COLLECTIONS.map(c => c.policyId);
}

// ============================================================
// PROJECT TYPE LABELS
// ============================================================

export const PROJECT_TYPE_LABELS: Record<StargateCollectionConfig['projectType'], string> = {
  'Node Factory': 'Node Factory',
  'DAO': 'DAO Governance',
  'AI Workforce': 'AI Workforce',
  'Infrastructure': 'Infrastructure',
  'Community': 'Community',
  'Other': 'Collection',
};
