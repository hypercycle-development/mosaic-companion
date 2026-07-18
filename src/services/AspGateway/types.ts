// ============================================
// ASP GATEWAY - Types
// Company Onboarding Door for Agentic System Packages
// ============================================

import type { ComputeNode } from '../AdaPortal/types';

// ============================================
// ROLES & PERMISSIONS
// ============================================

export type AspRole = 'operator' | 'company' | 'admin';

export interface AspPermission {
  canDeploy: boolean;
  canExecute: boolean;
  canApproveWorkload: boolean;
  canViewBilling: boolean;
  canManageCompany: boolean;
}

export const ROLE_PERMISSIONS: Record<AspRole, AspPermission> = {
  operator: {
    canDeploy: true,
    canExecute: true,
    canApproveWorkload: true,
    canViewBilling: true,
    canManageCompany: true
  },
  company: {
    canDeploy: true,
    canExecute: true,
    canApproveWorkload: false,
    canViewBilling: true,
    canManageCompany: true
  },
  admin: {
    canDeploy: true,
    canExecute: true,
    canApproveWorkload: true,
    canViewBilling: true,
    canManageCompany: true
  }
};

// ============================================
// COMPANY
// ============================================

export interface Company {
  id: string;
  name: string;
  walletAddress?: string;
  apiKeys: string[];
  systems: string[]; // ASP IDs
  createdAt: number;
  updatedAt: number;
  role: AspRole;
  compliance: ComplianceConfig;
}

// ============================================
// AGENT DEFINITION
// ============================================

export type AgentType = 'voice' | 'llm' | 'workflow' | 'api';
export type ExecutionPreference = 'node' | 'cloud' | 'hybrid';

export interface AspAgent {
  id: string;
  name: string;
  type: AgentType;
  endpoint: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  executionPreference: ExecutionPreference;
  capabilities: string[];
}

// ============================================
// WORKFLOW
// ============================================

export interface AspWorkflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  stepId: string;
  agentId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  condition?: string;
}

// ============================================
// COMPLIANCE
// ============================================

export interface ComplianceConfig {
  gdprMode: boolean;
  dataLoggingEnabled: boolean;
  restrictedExecutionZones: string[];
  auditRetentionDays: number;
}

// ============================================
// BILLING
// ============================================

export interface BillingConfig {
  billingModel: 'per_call' | 'per_compute' | 'per_minute';
  budgetLimit?: number;
  autoRecharge?: boolean;
}

export interface UsageRecord {
  id: string;
  companyId: string;
  aspId: string;
  agentId: string;
  nodeId?: string;
  computeUnits: number;
  totalCost: number;
  timestamp: number;
}

// ============================================
// ASP (AGENTIC SYSTEM PACKAGE)
// ============================================

export type ExecutionMode = 'node' | 'cloud' | 'hybrid';

export interface AspPackage {
  id: string;
  name: string;
  description: string;
  companyId: string;
  agents: AspAgent[];
  workflows: AspWorkflow[];
  resourceRequirements: ResourceRequirements;
  executionMode: ExecutionMode;
  complianceFlags: ComplianceConfig;
  billingConfig: BillingConfig;
  status: 'pending' | 'active' | 'suspended';
  createdAt: number;
  updatedAt: number;
}

export interface ResourceRequirements {
  minTflops?: number;
  minRamGB?: number;
  gpuRequired?: boolean;
  maxLatencyMs?: number;
}

// ============================================
// EXECUTION REQUEST
// ============================================

export interface ExecutionRequest {
  requestId: string;
  aspId: string;
  agentId?: string;
  workflowId?: string;
  input: Record<string, unknown>;
  preferredMode: ExecutionMode;
  companyId: string;
  requestedAt: number;
}

export interface ExecutionResult {
  requestId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  nodeId?: string;
  computeUsed: number;
  cost: number;
  executedAt: number;
}

// ============================================
// NODE FACTORY BINDING
// ============================================

export interface NodeBinding {
  nodeId: string;
  factoryId: string;
  capacity: number;
  available: number;
  approved: boolean;
}

// ============================================
// HORIZONHUB IMPLEMENTATION
// ============================================

export const HORIZONHUB_SYSTEM: AspPackage = {
  id: 'horizonhub-driving-system',
  name: 'HorizonHub Driving System',
  description: 'AI-powered driving coaching system with voice agent and coaching agent',
  companyId: 'horizonhub',
  agents: [
    {
      id: 'horizonhub-voice-agent',
      name: 'HorizonHub Voice Agent',
      type: 'voice',
      endpoint: 'https://api.genspark.ai/voice', // External SaaS placeholder
      inputSchema: { spokenCommand: 'string' },
      outputSchema: { response: 'string', action: 'string' },
      executionPreference: 'cloud',
      capabilities: ['voice-input', 'voice-output', 'speech-recognition']
    },
    {
      id: 'horizonhub-coaching-agent',
      name: 'HorizonHub Coaching Agent',
      type: 'llm',
      endpoint: 'https://api.personaplex.ai/coaching', // External SaaS placeholder
      inputSchema: { driverId: 'string', sessionData: 'object' },
      outputSchema: { coachingTips: 'array', improvementAreas: 'array' },
      executionPreference: 'hybrid',
      capabilities: ['driving-analysis', 'coaching', 'performance-tracking']
    }
  ],
  workflows: [
    {
      id: 'horizonhub-session-workflow',
      name: 'Driving Session Workflow',
      steps: [
        {
          stepId: 'voice-input',
          agentId: 'horizonhub-voice-agent',
          inputMapping: {},
          outputMapping: { command: 'spokenCommand' }
        },
        {
          stepId: 'coaching',
          agentId: 'horizonhub-coaching-agent',
          inputMapping: { sessionData: 'command' },
          outputMapping: { tips: 'coachingTips', areas: 'improvementAreas' }
        }
      ]
    }
  ],
  resourceRequirements: {
    minTflops: 1,
    minRamGB: 4,
    maxLatencyMs: 2000
  },
  executionMode: 'hybrid',
  complianceFlags: {
    gdprMode: true,
    dataLoggingEnabled: true,
    restrictedExecutionZones: ['EU'],
    auditRetentionDays: 365
  },
  billingConfig: {
    billingModel: 'per_compute',
    budgetLimit: 1000
  },
  status: 'active',
  createdAt: Date.now(),
  updatedAt: Date.now()
};