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
    nodeFactoryLicenses?: string[]; // License IDs for HyperInsight live lookup
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
      // Computed: sumNodeFactories(nodeFactoryLicenses) === 148 (74 ETH + 74 BASE)
      nodeFactories: 148,
      nodeFactoryLicenses: [
        // Ethereum (74 factories)
        '2251937252696722', '2251937252696723', '2251937252698800', '281492156587987',
        '281492156594455', '1125968626377606', '281492156594452', '281492156594453',
        // Base (74 factories)
        '2324779898053522', '2324779898053523', '2324779898055600', '290597487257587',
        '290597487264052', '1162389949056006', '290597487264053', '290597487264055',
      ],
      activeNodes: 151552,
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
      nodeFactoryLicenses: [], // TODO: populate from CMHPEC DAO PASS CSV when available
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
      nodeFactoryLicenses: [], // TODO: populate from HyperDegens node-factory CSV when available
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
// NODE FACTORY TABLE — License ID prefix → multiplier
// ============================================================
// To derive Node-Factory count for any license, grab its first
// 3 digits and match against the table below.
//
// Column A: ANFE (BASE network) first-3-digit signatures
// Column B: NF   (ETH network)   first-3-digit signatures
// Multiplier = max number of physical Node Factories held by that licence.

export const NODE_FACTORY_TABLE = [
  { level: 10, multiplier:  1,  anfePrefix: '464', nfPrefix: '450' },
  { level: 11, multiplier:  2,  anfePrefix: '232', nfPrefix: '225' },
  { level: 12, multiplier:  4,  anfePrefix: '116', nfPrefix: '112' },
  { level: 13, multiplier:  8,  anfePrefix: '581', nfPrefix: '562' },
  { level: 14, multiplier: 16,  anfePrefix: '290', nfPrefix: '281' },
  { level: 15, multiplier: 32,  anfePrefix: '145', nfPrefix: '140' },
  { level: 16, multiplier: 64,  anfePrefix: '726', nfPrefix: '703' },
  { level: 17, multiplier: 128, anfePrefix: '363', nfPrefix: '351' },
  { level: 18, multiplier: 256, anfePrefix: '181', nfPrefix: '175' },
  { level: 19, multiplier: 512, anfePrefix: '908', nfPrefix: '879' },
] as const;

export function getNodeFactoryCountFromLicenseId(licenseId: string): number {
  const prefix = licenseId.trim().slice(0, 3);
  const row = NODE_FACTORY_TABLE.find(
    r => r.anfePrefix === prefix || r.nfPrefix === prefix
  );
  return row?.multiplier ?? 0;
}

export function sumNodeFactories(licenseIds: string[]): number {
  return licenseIds.reduce((sum, id) => sum + getNodeFactoryCountFromLicenseId(id), 0);
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
