// ============================================
// ADA PORTAL - Agent Economy Service
// Layer 3: Agent-to-agent hiring and task contracts
// ============================================

import { TaskContract, Task, TaskStatus } from './types';

class AgentEconomyService {
  private contracts: Map<string, TaskContract> = new Map();
  private tasks: Map<string, Task> = new Map();
  private contractCounter = 0;
  private taskCounter = 0;

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData(): void {
    // Demo contracts
    const demoContracts: TaskContract[] = [
      {
        contractId: 'contract-001',
        taskId: 'task-001',
        requesterId: 'user-001',
        agentId: 'agent-marketing-001',
        terms: 'Create social media campaign',
        paymentAmount: 50,
        status: 'completed',
        createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000
      },
      {
        contractId: 'contract-002',
        taskId: 'task-002',
        requesterId: 'user-001',
        agentId: 'agent-dev-001',
        terms: 'Deploy smart contract',
        paymentAmount: 150,
        status: 'active',
        createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000
      },
      {
        contractId: 'contract-003',
        taskId: 'task-003',
        requesterId: 'user-002',
        agentId: 'agent-uiux-001',
        terms: 'Design landing page',
        paymentAmount: 75,
        status: 'pending',
        createdAt: Date.now() - 12 * 60 * 60 * 1000
      }
    ];

    demoContracts.forEach(c => this.contracts.set(c.contractId, c));
    console.log(`[AdaPortal] Initialized ${this.contracts.size} demo contracts`);
  }

  // Create a new task contract
  createContract(params: {
    requesterId: string;
    agentId: string;
    terms: string;
    paymentAmount: number;
  }): TaskContract {
    const contractId = `contract-${++this.contractCounter}`;
    const taskId = `task-${++this.taskCounter}`;

    const contract: TaskContract = {
      contractId,
      taskId,
      requesterId: params.requesterId,
      agentId: params.agentId,
      terms: params.terms,
      paymentAmount: params.paymentAmount,
      status: 'pending',
      createdAt: Date.now()
    };

    // Also create the task
    const task: Task = {
      taskId,
      requesterId: params.requesterId,
      agentId: params.agentId,
      description: params.terms,
      status: 'pending',
      input: {},
      paymentAmount: params.paymentAmount,
      paymentToken: 'USDC',
      createdAt: Date.now()
    };

    this.contracts.set(contractId, contract);
    this.tasks.set(taskId, task);

    console.log(`[AdaPortal] Created contract ${contractId} for task ${taskId}`);
    return contract;
  }

  // Get contract by ID
  getContract(contractId: string): TaskContract | undefined {
    return this.contracts.get(contractId);
  }

  // Get all contracts
  getAllContracts(): TaskContract[] {
    return Array.from(this.contracts.values());
  }

  // Get contracts by status
  getContractsByStatus(status: TaskContract['status']): TaskContract[] {
    return Array.from(this.contracts.values()).filter(c => c.status === status);
  }

  // Get tasks for an agent
  getTasksForAgent(agentId: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.agentId === agentId);
  }

  // Update task status
  updateTaskStatus(taskId: string, status: TaskStatus, output?: string, error?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (status === 'running') task.startedAt = Date.now();
      if (status === 'completed') {
        task.completedAt = Date.now();
        task.output = output;
      }
      if (status === 'failed') {
        task.completedAt = Date.now();
        task.error = error;
      }
    }
  }

  // Execute agent-to-agent delegation
  executeAgentToAgent(
    requesterAgentId: string,
    targetAgentId: string,
    taskDescription: string,
    budget: number
  ): TaskContract {
    return this.createContract({
      requesterId: requesterAgentId,
      agentId: targetAgentId,
      terms: taskDescription,
      paymentAmount: budget
    });
  }

  // Get economy stats
  getStats(): {
    totalContracts: number;
    activeContracts: number;
    completedContracts: number;
    totalVolume: number;
  } {
    const contracts = Array.from(this.contracts.values());
    const completed = contracts.filter(c => c.status === 'completed');
    
    return {
      totalContracts: contracts.length,
      activeContracts: contracts.filter(c => c.status === 'active').length,
      completedContracts: completed.length,
      totalVolume: completed.reduce((sum, c) => sum + c.paymentAmount, 0)
    };
  }
}

export const agentEconomy = new AgentEconomyService();
export { AgentEconomyService };