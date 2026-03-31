// ============================================
// LAYER 3: AGENT ECONOMY SERVICE
// Agent-to-Agent Hiring + Payments
// ============================================

import type { TaskContract, TaskStatus, PaymentTransaction } from './types';

// In-memory storage
const taskContracts = new Map<string, TaskContract>();
const paymentTransactions = new Map<string, PaymentTransaction>();

// Contract status machine
const validTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'failed'],
  completed: [],
  failed: [],
  cancelled: []
};

export class AgentEconomyService {
  constructor() {
    console.log('[AgentEconomy] Service initialized');
  }

  // Create new task contract
  createContract(
    fromAgent: string,
    toAgent: string,
    task: string,
    budget: number
  ): TaskContract {
    const contract: TaskContract = {
      contractId: `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgent,
      toAgent,
      task,
      budget,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    taskContracts.set(contract.contractId, contract);
    console.log(`[AgentEconomy] Created contract ${contract.contractId}: ${fromAgent} → ${toAgent} ($${budget})`);
    return contract;
  }

  // Update contract status
  updateContractStatus(contractId: string, newStatus: TaskStatus): TaskContract | null {
    const contract = taskContracts.get(contractId);
    if (!contract) {
      console.warn(`[AgentEconomy] Contract not found: ${contractId}`);
      return null;
    }

    const validNextStatuses = validTransitions[contract.status];
    if (!validNextStatuses.includes(newStatus)) {
      console.warn(`[AgentEconomy] Invalid status transition: ${contract.status} → ${newStatus}`);
      return null;
    }

    contract.status = newStatus;
    contract.updatedAt = Date.now();
    
    if (newStatus === 'completed') {
      contract.completedAt = Date.now();
      // Process payment
      this.processPayment(contract.fromAgent, contract.toAgent, contract.budget, contract.contractId);
    }

    console.log(`[AgentEconomy] Contract ${contract.contractId} status: ${newStatus}`);
    return contract;
  }

  // Accept contract
  acceptContract(contractId: string): TaskContract | null {
    return this.updateContractStatus(contractId, 'accepted');
  }

  // Start work
  startWork(contractId: string): TaskContract | null {
    return this.updateContractStatus(contractId, 'in_progress');
  }

  // Complete contract
  completeContract(contractId: string, result?: string): TaskContract | null {
    const contract = taskContracts.get(contractId);
    if (!contract) return null;

    contract.result = result;
    return this.updateContractStatus(contractId, 'completed');
  }

  // Fail contract
  failContract(contractId: string): TaskContract | null {
    return this.updateContractStatus(contractId, 'failed');
  }

  // Cancel contract
  cancelContract(contractId: string): TaskContract | null {
    return this.updateContractStatus(contractId, 'cancelled');
  }

  // Get contract
  getContract(contractId: string): TaskContract | null {
    return taskContracts.get(contractId) || null;
  }

  // Get contracts for agent
  getContractsForAgent(agentId: string, filter?: { role: 'from' | 'to' | 'all'; status?: TaskStatus }): TaskContract[] {
    let contracts = Array.from(taskContracts.values());

    if (filter?.role === 'from') {
      contracts = contracts.filter(c => c.fromAgent === agentId);
    } else if (filter?.role === 'to') {
      contracts = contracts.filter(c => c.toAgent === agentId);
    } else {
      contracts = contracts.filter(c => c.fromAgent === agentId || c.toAgent === agentId);
    }

    if (filter?.status) {
      contracts = contracts.filter(c => c.status === filter.status);
    }

    return contracts;
  }

  // Process payment
  private processPayment(
    fromAgent: string,
    toAgent: string,
    amount: number,
    contractId?: string
  ): PaymentTransaction {
    const transaction: PaymentTransaction = {
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgent,
      toAgent,
      amount,
      currency: 'USDC',
      contractId,
      status: 'completed',
      timestamp: Date.now()
    };

    paymentTransactions.set(transaction.transactionId, transaction);
    console.log(`[AgentEconomy] Payment processed: ${fromAgent} → ${toAgent} (${amount} USDC)`);
    return transaction;
  }

  // Get payment history
  getPaymentHistory(agentId: string): PaymentTransaction[] {
    return Array.from(paymentTransactions.values())
      .filter(t => t.fromAgent === agentId || t.toAgent === agentId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Get total earnings
  getTotalEarnings(agentId: string): number {
    return Array.from(paymentTransactions.values())
      .filter(t => t.toAgent === agentId && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get total spent
  getTotalSpent(agentId: string): number {
    return Array.from(paymentTransactions.values())
      .filter(t => t.fromAgent === agentId && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Agent hires another agent
  hireAgent(hiringAgentId: string, hiredAgentId: string, task: string, budget: number): TaskContract {
    return this.createContract(hiringAgentId, hiredAgentId, task, budget);
  }

  // Get active contracts
  getActiveContracts(agentId: string): TaskContract[] {
    const activeStatuses: TaskStatus[] = ['pending', 'accepted', 'in_progress'];
    return Array.from(taskContracts.values())
      .filter(c => 
        (c.fromAgent === agentId || c.toAgent === agentId) &&
        activeStatuses.includes(c.status)
      );
  }

  // Get all contracts
  getAllContracts(): TaskContract[] {
    return Array.from(taskContracts.values());
  }
}

export const agentEconomy = new AgentEconomyService();