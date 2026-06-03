// ============================================
// ADA PORTAL - Core Types
// AI Workforce + Compute + Intelligence Platform for Cardano
// ============================================

// ============================================
// AIM (AI MODEL) TYPES - HyperInsight Integration
// ============================================

export interface AIMInfo {
  name: string;
  version: string | null;
  description: string | null;
  rank?: number;
  activeNodes?: number;
  computeTFLOPS?: number;
  cpuCores?: number;
  ramGB?: number;
  vramGB?: number;
  // HyperInsight extended fields
  origin?: string;        // "hypercycle" for verified AIMs
  hypercycle_id?: string; // HyperCycle ID
  license?: string;       // License type
  isActive?: boolean;     // Whether AIM is actively running on nodes
  // Additional HyperInsight fields
  bestLivenessScore?: number;
  bestEndpointUrl?: string;
  estimatedCostUsdc?: number | null;
  manifestVersion?: string | null;
  // ----- Community / Remote AIM fields (v0.2) -----
  isRemote?: boolean;              // true if registered by external operator
  operatorName?: string;           // e.g. "Dory"
  operatorContact?: string;       // email, tg, handle
  endpointUrl?: string;           // public base URL
  healthUrl?: string;             // health check endpoint
  manifestUrl?: string;           // manifest.json URL
  requestUrl?: string;             // POST /request or equivalent
  pricePerCall?: number;           // in USDC
  priceToken?: string;             // "USDC"
  nodeId?: string;                // HyperCycle node ID
  licenseId?: string;             // ANFE license ID
  supportedQueries?: string[];     // e.g. ["dao", "factory", "license", "info"]
}

export interface AIMPerformance {
  aimName: string;
  rank: number;
  totalRequests: number;
  avgResponseTime: number;
  successRate: number;
  activeNodes: number;
  computeTFLOPS: number;
}

// ============================================

// ============================================
// LAYER 1: Agent Marketplace Types
// ============================================

export type AgentRole = 'marketing' | 'developer' | 'uiux' | 'data_analyst' | 'growth';

export type PricingModel = 'per_task' | 'per_minute';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

export interface SkillLevel {
  level: number; // 1-5
  endorsements: number;
  recentTasks: number;
}

export interface SkillProfile {
  [skill: string]: SkillLevel;
}

export interface PerformanceMetrics {
  successRate: number;
  totalTasks: number;
  completedTasks: number;
  averageRating: number;
  totalEarnings: number;
  responseTimeMs: number;
}

export interface AgentPricing {
  model: PricingModel;
  perTaskMin: number;
  perTaskMax: number;
  perMinuteMin: number;
  perMinuteMax: number;
}

export interface AgentProfile {
  agentId: string;
  name: string;
  roles: AgentRole[];
  skills: SkillProfile;
  performance: PerformanceMetrics;
  nodeSource: string;
  chain?: 'ethereum' | 'base' | 'polygon' | 'solana' | 'multi' | 'web2' | 'telegram';
  pricing: AgentPricing;
  availability: AvailabilityStatus;
  createdAt: number;
  lastActive: number;
  // HyperInsight enrichment
  backingAim?: AIMInfo;
  aimRank?: number;
  computeStrength?: number; // TFLOPS
  nodeReliability?: number;
}

export interface MarketplaceListing {
  listingId: string;
  agentId: string;
  agentName: string;
  roles: AgentRole[];
  primarySkills: string[];
  pricing: AgentPricing;
  rating: number;
  successRate: number;
  availability: AvailabilityStatus;
  nodeSource?: string;
  chain?: 'ethereum' | 'base' | 'polygon' | 'solana' | 'multi' | 'web2' | 'telegram';
  // Enriched with real HyperInsight data
  backingAim?: string;
  aimRank?: number;
  computeStrength?: number;
  // skills.sh integration
  attachedSkills?: string[];  // skill names from skills.sh
  skillCount?: number;
}

// ============================================
// LAYER 2: Multi-Marketplace Adapter Types
// ============================================

export type AdapterType = 'masumi' | 'sokosumi' | 'generic';

export interface AdapterConfig {
  adapter: AdapterType;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
}

export interface ExternalAgent {
  externalId: string;
  source: AdapterType;
  name: string;
  skills: string[];
  pricing: number;
  rating: number;
}

// ============================================
// LAYER 3: Agent Economy Types
// ============================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  taskId: string;
  requesterId: string;
  agentId: string;
  description: string;
  status: TaskStatus;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  paymentAmount: number;
  paymentToken: 'USDC';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskContract {
  contractId: string;
  taskId: string;
  requesterId: string;
  agentId: string;
  terms: string;
  paymentAmount: number;
  status: 'pending' | 'active' | 'completed' | 'disputed';
  createdAt: number;
}

// ============================================
// LAYER 4: Leaderboard Types
// ============================================

export type LeaderboardCategory = 'marketing' | 'dev' | 'uiux' | 'roi' | 'overall';

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  category: LeaderboardCategory;
  score: number;
  skillScore: number;
  successScore: number;
  ratingScore: number;
  nodeScore: number;
  period: LeaderboardPeriod;
}

// ============================================
// LAYER 5: Training Marketplace Types
// ============================================

export interface TrainerProfile {
  trainerId: string;
  agentId: string;
  name: string;
  specializations: string[];
  pricePerSession: number;
  sessionsCompleted: number;
  rating: number;
}

export interface TrainingListing {
  listingId: string;
  trainerId: string;
  trainerName: string;
  specializations: string[];
  pricePerSession: number;
  description: string;
  rating: number;
}

export interface TrainingSession {
  sessionId: string;
  trainerId: string;
  traineeAgentId: string;
  skills: string[];
  status: 'pending' | 'active' | 'completed';
  price: number;
  createdAt: number;
}

// ============================================
// LAYER 6: Skill Graph Types
// ============================================

export interface SkillNode {
  skillId: string;
  name: string;
  category: string;
  description: string;
  relatedSkills: string[];
}

export interface SkillRelationship {
  fromSkill: string;
  toSkill: string;
  relationshipType: 'prerequisite' | 'enhances' | 'similar';
  weight: number;
}

export interface AgentSkillHistory {
  agentId: string;
  skillId: string;
  beforeLevel: number;
  afterLevel: number;
  improvement: number;
  trainedAt: number;
}

// ============================================
// LAYER 7: Agent Packages Types
// ============================================

export interface PackageAgent {
  agentId: string;
  name: string;
  role: AgentRole;
  included: boolean;
}

export interface AgentPackage {
  packageId: string;
  name: string;
  description: string;
  agents: PackageAgent[];
  computeAllocation?: number; // hours
  price: number;
  popular: boolean;
}

// ============================================
// LAYER 8: Node Intelligence Types (Enhanced with HyperInsight)
// ============================================

export interface ComputeNode {
  nodeId: string;
  address: string;
  uptime: number;
  reliability: number;
  availableCompute: number;
  pricePerHour: number;
  status: 'online' | 'offline' | 'busy';
  lastChecked: number;
  // HyperInsight enrichment
  licenseKey?: string;
  gpuName?: string;
  cpuCount?: number;
  gpuCount?: number;
  ramGB?: number;
  vramGB?: number;
  runningAims?: string[];
  platform?: string;
}

export interface NodeMetrics {
  nodeId: string;
  uptime: number;
  successRate: number;
  avgResponseTime: number;
  totalTasks: number;
}

// Compute tier abstraction
export type ComputeTier = 'standard' | 'high_performance' | 'dedicated';

export interface ComputeTierInfo {
  tier: ComputeTier;
  label: string;
  description: string;
  minTFLOPS: number;
  maxPricePerHour: number;
  features: string[];
}

// ============================================
// UNIFIED LEADERBOARD TYPES
// ============================================

export type UnifiedLeaderboardSection = 'agents' | 'aims' | 'nodes';

export interface UnifiedLeaderboardEntry {
  type: UnifiedLeaderboardSection;
  id: string;
  name: string;
  rank: number;
  score: number;
  // Agent fields
  role?: AgentRole;
  rating?: number;
  successRate?: number;
  // AIM fields
  activeNodes?: number;
  computeTFLOPS?: number;
  // Node fields
  uptime?: number;
  reliability?: number;
  availableCompute?: number;
}

// ============================================
// INTENT-BASED ENTRY TYPES
// ============================================

export type UserIntent = 
  | 'launch_project'
  | 'grow_dao'
  | 'build_dapp'
  | 'automate_workflows'
  | 'rankings'
  | 'bundles'
  | 'compute_nodes'
  | 'dashboard'
  | 'stargate_pool'
  | 'deploy_system'
  | 'custom';

export interface IntentOption {
  intent: UserIntent;
  label: string;
  description: string;
  icon: string;
  recommendedAgents: AgentRole[];
  recommendedAims?: string[];
  computeTier?: ComputeTier;
}

// ============================================
// AUTONOMOUS EXECUTION TYPES
// ============================================

export interface AutonomousTask {
  taskId: string;
  description: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  selectedAgentId?: string;
  selectedAim?: string;
  selectedNodeId?: string;
  subtasks: SubTask[];
  progress: number;
  createdAt: number;
}

export interface SubTask {
  subTaskId: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assignedAgentId?: string;
  result?: string;
}

// ============================================
// SYSTEM CONFIG
// ============================================

export interface AdaPortalConfig {
  name: string;
  tagline: string;
  version: string;
}

export const ADA_PORTAL_CONFIG: AdaPortalConfig = {
  name: "Ada Portal",
  tagline: "AI + Compute + Intelligence Layer for Cardano",
  version: "1.0.0"
};

// ============================================
// ACCESS CONTROL TYPES
// ============================================

export type AccessLevel = 'none' | 'basic' | 'premium' | 'enterprise';
export type AccessType = 'human' | 'ai_agent' | 'nft_holder';

export interface AccessCheck {
  hasAccess: boolean;
  level: AccessLevel;
  type?: AccessType;
  reason?: string;
}

export interface WalletState {
  address: string | null;
  network: string;
  balance: string;
}

export interface NFTHoldings {
  hasNfts: boolean;
  collections: string[];
  totalValue: number;
}