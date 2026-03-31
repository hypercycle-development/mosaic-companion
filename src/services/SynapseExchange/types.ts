// ============================================
// SYNAPSE EXCHANGE - Core Types
// Decentralized AI Workforce + Intelligence Economy
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
  chain?: 'ethereum' | 'base';
  pricing: AgentPricing;
  availability: AvailabilityStatus;
  createdAt: number;
  lastActive: number;
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
  chain?: 'ethereum' | 'base';
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

export interface ExternalAgentMetadata {
  externalAgentId: string;
  marketplace: AdapterType;
  name: string;
  roles: AgentRole[];
  skills: string[];
  price: number;
  performance: number;
}

export interface ExecutionRequest {
  adapter: AdapterType;
  agentId: string;
  task: string;
  budget: number;
  context?: Record<string, unknown>;
}

export interface ExecutionResponse {
  success: boolean;
  result?: string;
  error?: string;
  executionTime: number;
}

// ============================================
// LAYER 3: Agent-to-Agent Economy Types
// ============================================

export type TaskStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface TaskContract {
  contractId: string;
  fromAgent: string;
  toAgent: string;
  task: string;
  budget: number;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  result?: string;
}

export interface PaymentTransaction {
  transactionId: string;
  fromAgent: string;
  toAgent: string;
  amount: number;
  currency: 'USDC';
  contractId?: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: number;
}

// ============================================
// LAYER 4: Leaderboard Types
// ============================================

export type LeaderboardCategory = 'marketing' | 'developer' | 'uiux' | 'roi' | 'overall';

export type LeaderboardTimeframe = 'daily' | 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  category: LeaderboardCategory;
  score: number;
  skillScore: number;
  successRate: number;
  clientRating: number;
  nodeReliability: number;
  timeframe: LeaderboardTimeframe;
  updatedAt: number;
}

export interface LeaderboardSnapshot {
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  entries: LeaderboardEntry[];
  updatedAt: number;
}

// ============================================
// LAYER 5: Training Marketplace Types
// ============================================

export type TrainingType = 'strategy' | 'replay';

export interface TrainingListing {
  listingId: string;
  trainerAgentId: string;
  trainerName: string;
  rank: number;
  trainingPrice: number;
  trainingType: TrainingType;
  skills: string[];
  description: string;
  successStories: number;
}

export interface TrainingSession {
  sessionId: string;
  buyerAgentId: string;
  trainerAgentId: string;
  listingId: string;
  trainingType: TrainingType;
  price: number;
  status: 'paid' | 'in_progress' | 'completed';
  improvements: PerformanceImprovement[];
  completedAt?: number;
}

export interface PerformanceImprovement {
  metric: keyof PerformanceMetrics;
  before: number;
  after: number;
  delta: number;
}

// ============================================
// LAYER 6: Skill Graph Types
// ============================================

export interface SkillNode {
  skillId: string;
  name: string;
  category: AgentRole;
  difficulty: number;
  relatedSkills: string[];
}

export interface SkillEdge {
  from: string;
  to: string;
  weight: number;
}

export interface AgentSkillHistory {
  agentId: string;
  skillId: string;
  taskHistory: {
    taskId: string;
    success: boolean;
    rating: number;
    timestamp: number;
  }[];
  performanceDelta: PerformanceImprovement[];
}

// ============================================
// LAYER 7: Agent Packages Types
// ============================================

export interface AgentPackage {
  packageId: string;
  name: string;
  description: string;
  agentIds: string[];
  roles: AgentRole[];
  pricing: number;
  features: string[];
  popularity: number;
}

export interface PackageSubscription {
  subscriptionId: string;
  packageId: string;
  userId: string;
  startDate: number;
  endDate?: number;
  status: 'active' | 'expired' | 'cancelled';
}

// ============================================
// LAYER 8: Node Intelligence Types
// ============================================

export type NodeType = 'ANFE' | 'NodeFactory';

export interface NodeInfo {
  nodeId: string;
  owner: string;
  type: NodeType;
  licenses: string[];
  uptime: number;
  reliabilityScore: number;
  lastUpdated: number;
}

export interface UptimeReport {
  licenseId: string;
  uptime: number;
  totalChecks: number;
  successfulChecks: number;
  periodStart: number;
  periodEnd: number;
}

export interface SubgraphNode {
  id: string;
  owner: string;
  nodeType: string;
  licenses: string[];
  createdAt: number;
}

// ============================================
// MCP Integration Types
// ============================================

export interface MCPSkillRouting {
  requiredRoles: AgentRole[];
  requiredSkills: string[];
  budget: number;
  deadline?: number;
}

export interface MCPRoutingDecision {
  selectedAgentId: string;
  alternativeAgents: string[];
  reasoning: string;
  estimatedCost: number;
}

// ============================================
// Event Types
// ============================================

export interface SynapseEvent {
  type: string;
  timestamp: number;
  data: unknown;
}