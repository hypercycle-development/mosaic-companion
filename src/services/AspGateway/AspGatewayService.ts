// ============================================
// ASP GATEWAY - Core Service
// Company Onboarding Door for Agentic System Packages
// ============================================

import { nodeIntelligence } from '../AdaPortal/NodeIntelligenceService';
import type { ComputeNode } from '../AdaPortal/types';
import type {
  AspRole,
  AspPermission,
  Company,
  AspAgent,
  AspPackage,
  AspWorkflow,
  UsageRecord,
  ComplianceConfig,
  NodeBinding,
  ExecutionResult,
  ExecutionRequest,
  ExecutionMode,
  ResourceRequirements,
  BillingConfig
} from './types';
import { ROLE_PERMISSIONS, HORIZONHUB_SYSTEM } from './types';

class AspGatewayService {
  private companies: Map<string, Company> = new Map();
  private aspPackages: Map<string, AspPackage> = new Map();
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private nodeBindings: Map<string, NodeBinding[]> = new Map();
  private companyCounter = 0;
  private aspCounter = 0;
  private usageCounter = 0;

  constructor() {
    this.initializeHorizonHub();
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private initializeHorizonHub(): void {
    // Create HorizonHub company
    const horizonHubCompany: Company = {
      id: 'horizonhub',
      name: 'HorizonHub',
      walletAddress: undefined,
      apiKeys: ['demo-key-horizonhub'],
      systems: ['horizonhub-driving-system'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      role: 'company',
      compliance: {
        gdprMode: true,
        dataLoggingEnabled: true,
        restrictedExecutionZones: ['EU'],
        auditRetentionDays: 365
      }
    };

    this.companies.set('horizonhub', horizonHubCompany);
    this.aspPackages.set('horizonhub-driving-system', HORIZONHUB_SYSTEM);

    console.log(`[AspGateway] Initialized HorizonHub ASP with ${HORIZONHUB_SYSTEM.agents.length} agents`);
  }

  // ============================================
  // COMPANY MANAGEMENT
  // ============================================

  createCompany(params: {
    name: string;
    walletAddress?: string;
    role?: AspRole;
  }): Company {
    const id = `company-${++this.companyCounter}`;
    const now = Date.now();

    const company: Company = {
      id,
      name: params.name,
      walletAddress: params.walletAddress,
      apiKeys: [],
      systems: [],
      createdAt: now,
      updatedAt: now,
      role: params.role || 'company',
      compliance: {
        gdprMode: false,
        dataLoggingEnabled: true,
        restrictedExecutionZones: [],
        auditRetentionDays: 90
      }
    };

    this.companies.set(id, company);
    console.log(`[AspGateway] Created company: ${params.name} (${id})`);
    return company;
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  getAllCompanies(): Company[] {
    return Array.from(this.companies.values());
  }

  updateCompany(id: string, updates: Partial<Company>): Company | undefined {
    const company = this.companies.get(id);
    if (company) {
      Object.assign(company, updates, { updatedAt: Date.now() });
      console.log(`[AspGateway] Updated company: ${id}`);
    }
    return company;
  }

  deleteCompany(id: string): boolean {
    const result = this.companies.delete(id);
    if (result) {
      console.log(`[AspGateway] Deleted company: ${id}`);
    }
    return result;
  }

  // Generate API key for company
  generateApiKey(companyId: string): string | undefined {
    const company = this.companies.get(companyId);
    if (company) {
    const apiKey = `asp_${companyId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    company.apiKeys.push(apiKey);
    company.updatedAt = Date.now();
    console.log(`[AspGateway] Generated API key for company: ${companyId}`);
    return apiKey;
    }
    return undefined;
  }

  // ============================================
  // ASP PACKAGE MANAGEMENT
  // ============================================

  createAsp(params: {
    name: string;
    description: string;
    companyId: string;
    executionMode: ExecutionMode;
    resourceRequirements?: ResourceRequirements;
    billingConfig?: BillingConfig;
    complianceFlags?: ComplianceConfig;
  }): AspPackage | undefined {
    const company = this.companies.get(params.companyId);
    if (!company) {
      console.error(`[AspGateway] Company not found: ${params.companyId}`);
      return undefined;
    }

    const id = `asp-${++this.aspCounter}`;
    const now = Date.now();

    const asp: AspPackage = {
      id,
      name: params.name,
      description: params.description,
      companyId: params.companyId,
      agents: [],
      workflows: [],
      resourceRequirements: params.resourceRequirements || {},
      executionMode: params.executionMode,
      complianceFlags: params.complianceFlags || company.compliance,
      billingConfig: params.billingConfig || { billingModel: 'per_compute' },
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    this.aspPackages.set(id, asp);
    company.systems.push(id);
    company.updatedAt = now;

    console.log(`[AspGateway] Created ASP: ${params.name} (${id}) for company: ${params.companyId}`);
    return asp;
  }

  getAsp(id: string): AspPackage | undefined {
    return this.aspPackages.get(id);
  }

  getAllAsp(): AspPackage[] {
    return Array.from(this.aspPackages.values());
  }

  getAspByCompany(companyId: string): AspPackage[] {
    return Array.from(this.aspPackages.values()).filter(asp => asp.companyId === companyId);
  }

  updateAsp(id: string, updates: Partial<AspPackage>): AspPackage | undefined {
    const asp = this.aspPackages.get(id);
    if (asp) {
      Object.assign(asp, updates, { updatedAt: Date.now() });
      console.log(`[AspGateway] Updated ASP: ${id}`);
    }
    return asp;
  }

  deleteAsp(id: string): boolean {
    const asp = this.aspPackages.get(id);
    if (asp) {
      const company = this.companies.get(asp.companyId);
      if (company) {
        company.systems = company.systems.filter(s => s !== id);
        company.updatedAt = Date.now();
      }
      const result = this.aspPackages.delete(id);
      if (result) {
        console.log(`[AspGateway] Deleted ASP: ${id}`);
      }
      return result;
    }
    return false;
  }

  // Activate ASP
  activateAsp(id: string): AspPackage | undefined {
    return this.updateAsp(id, { status: 'active' });
  }

  suspendAsp(id: string): AspPackage | undefined {
    return this.updateAsp(id, { status: 'suspended' });
  }

  // ============================================
  // AGENT MANAGEMENT WITHIN ASP
  // ============================================

  addAgentToAsp(aspId: string, agent: AspAgent): AspPackage | undefined {
    const asp = this.aspPackages.get(aspId);
    if (asp) {
      asp.agents.push(agent);
      asp.updatedAt = Date.now();
      console.log(`[AspGateway] Added agent ${agent.name} to ASP ${aspId}`);
    }
    return asp;
  }

  removeAgentFromAsp(aspId: string, agentId: string): AspPackage | undefined {
    const asp = this.aspPackages.get(aspId);
    if (asp) {
      asp.agents = asp.agents.filter(a => a.id !== agentId);
      asp.updatedAt = Date.now();
      console.log(`[AspGateway] Removed agent ${agentId} from ASP ${aspId}`);
    }
    return asp;
  }

  updateAgentInAsp(aspId: string, agentId: string, updates: Partial<AspAgent>): AspPackage | undefined {
    const asp = this.aspPackages.get(aspId);
    if (asp) {
      const agent = asp.agents.find(a => a.id === agentId);
      if (agent) {
        Object.assign(agent, updates);
        asp.updatedAt = Date.now();
        console.log(`[AspGateway] Updated agent ${agentId} in ASP ${aspId}`);
      }
    }
    return asp;
  }

  // ============================================
  // EXECUTION BINDING (CRITICAL)
  // ============================================

  async routeExecution(request: ExecutionRequest): Promise<ExecutionResult> {
    const { aspId, agentId, preferredMode, companyId } = request;

    // 1. Identify ASP
    const asp = this.aspPackages.get(aspId);
    if (!asp) {
      return {
        requestId: request.requestId,
        success: false,
        error: 'ASP not found',
        computeUsed: 0,
        cost: 0,
        executedAt: Date.now()
      };
    }

    // 2. Check ASP status
    if (asp.status !== 'active') {
      return {
        requestId: request.requestId,
        success: false,
        error: `ASP is ${asp.status}`,
        computeUsed: 0,
        cost: 0,
        executedAt: Date.now()
      };
    }

    // 3. Identify agent
    const agent = agentId ? asp.agents.find(a => a.id === agentId) : undefined;

    // 4. Determine execution mode
    const executionMode = preferredMode || asp.executionMode;

    // 5. Route to NodeFactory or Cloud
    let nodeId: string | undefined;
    let computeUsed = 0;
    let cost = 0;

    try {
      if (executionMode === 'cloud' || !agent || agent.executionPreference === 'cloud') {
        // Cloud execution (external SaaS)
        console.log(`[AspGateway] Routing ${asp.name} agent to cloud`);
        
        // Simulate cloud execution
        computeUsed = 1;
        cost = 0.01;
        
        // Record usage
        this.recordUsage({
          companyId,
          aspId,
          agentId: agentId || 'unknown',
          computeUnits: computeUsed,
          totalCost: cost
        });

        return {
          requestId: request.requestId,
          success: true,
          output: { message: 'Executed via cloud', agent: agent?.name },
          computeUsed,
          cost,
          executedAt: Date.now()
        };
      } else {
        // NodeFactory execution (preferred)
        const node = await this.findSuitableNode(asp.resourceRequirements);
        if (node) {
          nodeId = node.nodeId;
          computeUsed = 2;
          cost = node.pricePerHour / 3600; // Proportional cost
          
          console.log(`[AspGateway] Routing ${asp.name} to node ${nodeId}`);
          
          // Record usage
          this.recordUsage({
            companyId,
            aspId,
            agentId: agentId || 'unknown',
            nodeId,
            computeUnits: computeUsed,
            totalCost: cost
          });

          return {
            requestId: request.requestId,
            success: true,
            output: { message: 'Executed via NodeFactory', nodeId },
            nodeId,
            computeUsed,
            cost,
            executedAt: Date.now()
          };
        } else {
          // Fallback to cloud
          console.log(`[AspGateway] No suitable node, falling back to cloud`);
          computeUsed = 1;
          cost = 0.01;
          
          this.recordUsage({
            companyId,
            aspId,
            agentId: agentId || 'unknown',
            computeUnits: computeUsed,
            totalCost: cost
          });

          return {
            requestId: request.requestId,
            success: true,
            output: { message: 'Executed via cloud (fallback)', agent: agent?.name },
            computeUsed,
            cost,
            executedAt: Date.now()
          };
        }
      }
    } catch (error) {
      return {
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        computeUsed: 0,
        cost: 0,
        executedAt: Date.now()
      };
    }
  }

  private async findSuitableNode(requirements: ResourceRequirements): Promise<ComputeNode | null> {
    const nodes = nodeIntelligence.getNodes();
    
    // Filter by requirements
    let suitable = nodes.filter(node => {
      if (node.status !== 'online') return false;
      if (requirements.minTflops && node.reliability < requirements.minTflops) return false;
      if (requirements.minRamGB && node.ramGB && node.ramGB < requirements.minRamGB) return false;
      return true;
    });

    // Sort by reliability and price
    suitable.sort((a, b) => {
      if (b.reliability !== a.reliability) return b.reliability - a.reliability;
      return a.pricePerHour - b.pricePerHour;
    });

    return suitable[0] || null;
  }

  // ============================================
  // USAGE & BILLING
  // ============================================

  private recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): void {
    const id = `usage-${++this.usageCounter}`;
    const fullRecord: UsageRecord = {
      ...record,
      id,
      timestamp: Date.now()
    };

    const companyRecords = this.usageRecords.get(record.companyId) || [];
    companyRecords.push(fullRecord);
    this.usageRecords.set(record.companyId, companyRecords);

    console.log(`[AspGateway] Recorded usage: ${record.computeUnits} units, $${record.totalCost}`);
  }

  getUsageForCompany(companyId: string): UsageRecord[] {
    return this.usageRecords.get(companyId) || [];
  }

  getUsageForAsp(aspId: string): UsageRecord[] {
    const allRecords: UsageRecord[] = [];
    this.usageRecords.forEach(records => {
      allRecords.push(...records.filter(r => r.aspId === aspId));
    });
    return allRecords;
  }

  getBillingSummary(companyId: string): {
    totalCalls: number;
    totalComputeUnits: number;
    totalCost: number;
    byAsp: Record<string, { calls: number; computeUnits: number; cost: number }>;
  } {
    const records = this.usageRecords.get(companyId) || [];
    
    const byAsp: Record<string, { calls: number; computeUnits: number; cost: number }> = {};
    let totalCalls = 0;
    let totalComputeUnits = 0;
    let totalCost = 0;

    records.forEach(record => {
      totalCalls++;
      totalComputeUnits += record.computeUnits;
      totalCost += record.totalCost;

      if (!byAsp[record.aspId]) {
        byAsp[record.aspId] = { calls: 0, computeUnits: 0, cost: 0 };
      }
      byAsp[record.aspId].calls++;
      byAsp[record.aspId].computeUnits += record.computeUnits;
      byAsp[record.aspId].cost += record.totalCost;
    });

    return { totalCalls, totalComputeUnits, totalCost, byAsp };
  }

  // ============================================
  // PERMISSION CHECKING
  // ============================================

  hasPermission(role: AspRole, permission: keyof AspPermission): boolean {
    return ROLE_PERMISSIONS[role][permission];
  }

  checkPermission(role: AspRole, requiredPermissions: (keyof AspPermission)[]): {
    allowed: boolean;
    missing: string[];
  } {
    const missing: string[] = [];
    for (const perm of requiredPermissions) {
      if (!this.hasPermission(role, perm)) {
        missing.push(perm);
      }
    }
    return { allowed: missing.length === 0, missing };
  }

  // ============================================
  // NODE FACTORY BINDING
  // ============================================

  bindNodeToAsp(aspId: string, nodeId: string, factoryId: string, capacity: number): void {
    const bindings = this.nodeBindings.get(aspId) || [];
    
    // Check if already bound
    const existing = bindings.find(b => b.nodeId === nodeId);
    if (!existing) {
      bindings.push({
        nodeId,
        factoryId,
        capacity,
        available: capacity,
        approved: false // Requires operator approval
      });
      this.nodeBindings.set(aspId, bindings);
      console.log(`[AspGateway] Bound node ${nodeId} to ASP ${aspId}`);
    }
  }

  approveNodeBinding(aspId: string, nodeId: string): boolean {
    const bindings = this.nodeBindings.get(aspId);
    if (bindings) {
      const binding = bindings.find(b => b.nodeId === nodeId);
      if (binding) {
        binding.approved = true;
        console.log(`[AspGateway] Approved node binding: ${nodeId} for ASP ${aspId}`);
        return true;
      }
    }
    return false;
  }

  getBindingsForAsp(aspId: string): NodeBinding[] {
    return this.nodeBindings.get(aspId) || [];
  }

  // ============================================
  // COMPLIANCE
  // ============================================

  setComplianceConfig(companyId: string, config: ComplianceConfig): Company | undefined {
    const company = this.companies.get(companyId);
    if (company) {
      company.compliance = config;
      company.updatedAt = Date.now();
      console.log(`[AspGateway] Updated compliance for company ${companyId}`);
    }
    return company;
  }

  getComplianceConfig(companyId: string): ComplianceConfig | undefined {
    const company = this.companies.get(companyId);
    return company?.compliance;
  }

  // ============================================
  // STATS
  // ============================================

  getStats(): {
    totalCompanies: number;
    totalAsp: number;
    activeAsp: number;
    totalUsageRecords: number;
    horizonHubReady: boolean;
  } {
    const allAsp = Array.from(this.aspPackages.values());
    
    return {
      totalCompanies: this.companies.size,
      totalAsp: allAsp.length,
      activeAsp: allAsp.filter(a => a.status === 'active').length,
      totalUsageRecords: Array.from(this.usageRecords.values()).reduce((sum, r) => sum + r.length, 0),
      horizonHubReady: this.aspPackages.has('horizonhub-driving-system')
    };
  }

  // ============================================
  // CONVENIENCE GETTERS
  // ============================================

  getHorizonHub(): AspPackage | undefined {
    return this.aspPackages.get('horizonhub-driving-system');
  }

  // Execute an ASP workflow
  async executeWorkflow(aspId: string, workflowId: string, input: Record<string, unknown>): Promise<ExecutionResult> {
    const asp = this.aspPackages.get(aspId);
    if (!asp) {
      return {
        requestId: `exec-${Date.now()}`,
        success: false,
        error: 'ASP not found',
        computeUsed: 0,
        cost: 0,
        executedAt: Date.now()
      };
    }

    const workflow = asp.workflows.find(w => w.id === workflowId);
    if (!workflow) {
      return {
        requestId: `exec-${Date.now()}`,
        success: false,
        error: 'Workflow not found',
        computeUsed: 0,
        cost: 0,
        executedAt: Date.now()
      };
    }

    // Execute steps sequentially
    let stepOutput: Record<string, unknown> = { ...input };
    let totalCompute = 0;
    let totalCost = 0;

    for (const step of workflow.steps) {
      const result = await this.routeExecution({
        requestId: `step-${step.stepId}-${Date.now()}`,
        aspId,
        agentId: step.agentId,
        input: stepOutput,
        preferredMode: asp.executionMode,
        companyId: asp.companyId,
        requestedAt: Date.now()
      });

      if (!result.success) {
        return result;
      }

      totalCompute += result.computeUsed;
      totalCost += result.cost;

      // Map outputs to next step inputs
      if (result.output) {
        Object.entries(step.outputMapping).forEach(([outputKey, inputKey]) => {
          const output = result.output as Record<string, unknown>;
          if (output[outputKey]) {
            stepOutput[inputKey] = output[outputKey];
          }
        });
      }
    }

    return {
      requestId: `workflow-${workflowId}-${Date.now()}`,
      success: true,
      output: stepOutput,
      computeUsed: totalCompute,
      cost: totalCost,
      executedAt: Date.now()
    };
  }
}

export const aspGateway = new AspGatewayService();
export { AspGatewayService };