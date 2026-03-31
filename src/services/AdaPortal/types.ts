// ============================================
// ADA PORTAL - Core Types
// AI Workforce + Compute + Intelligence Platform for Cardano
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
// LAYER 8: Node Intelligence Types
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
}

export interface NodeMetrics {
  nodeId: string;
  uptime: number;
  successRate: number;
  avgResponseTime: number;
  totalTasks: number;
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