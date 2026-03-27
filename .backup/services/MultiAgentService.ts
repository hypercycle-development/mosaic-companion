/**
 * Multi-Agent Orchestration Service
 * Supports: Parallel, Sequential, Collaborative, Orchestrator modes
 */

export type OrchestrationMode = 'parallel' | 'sequential' | 'collaborative' | 'orchestrator';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'ready' | 'running' | 'idle' | 'done' | 'error';
  model?: string;
  systemPrompt?: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  result?: string;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface OrchestrationResult {
  mode: OrchestrationMode;
  tasks: AgentTask[];
  totalDuration: number;
  success: boolean;
}

export interface MultiAgentState {
  selectedAgents: string[];
  mode: OrchestrationMode;
  isRunning: boolean;
}

class MultiAgentService {
  private agents: Map<string, Agent> = new Map();
  private listeners: ((state: MultiAgentState) => void)[] = [];

  constructor() {
    this.initDefaultAgents();
  }

  private initDefaultAgents() {
    const defaultAgents: Agent[] = [
      { id: 'agent-1', name: 'Architect', role: 'System Design', status: 'ready', model: 'llama3' },
      { id: 'agent-2', name: 'Developer', role: 'Code Generation', status: 'ready', model: 'codellama' },
      { id: 'agent-3', name: 'Reviewer', role: 'Code Review', status: 'idle', model: 'llama3' },
      { id: 'agent-4', name: 'Researcher', role: 'Research & Analysis', status: 'idle', model: 'mistral' },
      { id: 'agent-5', name: 'Writer', role: 'Documentation', status: 'idle', model: 'llama3' }
    ];

    defaultAgents.forEach(agent => this.agents.set(agent.id, agent));
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const agent = this.agents.get(id);
    if (agent) {
      this.agents.set(id, { ...agent, ...updates });
      this.notifyListeners();
    }
  }

  selectAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent && agent.status === 'ready') {
      agent.status = 'ready';
    }
    this.notifyListeners();
  }

  deselectAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = 'idle';
    }
    this.notifyListeners();
  }

  async runOrchestration(
    agentIds: string[],
    prompt: string,
    mode: OrchestrationMode,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    
    // Set agents to running
    agentIds.forEach(id => {
      const agent = this.agents.get(id);
      if (agent) {
        agent.status = 'running';
      }
    });
    this.notifyListeners();

    let results: AgentTask[] = [];
    let success = true;

    try {
      switch (mode) {
        case 'parallel':
          results = await this.runParallel(agentIds, prompt, executeFn);
          break;
        case 'sequential':
          results = await this.runSequential(agentIds, prompt, executeFn);
          break;
        case 'collaborative':
          results = await this.runCollaborative(agentIds, prompt, executeFn);
          break;
        case 'orchestrator':
          results = await this.runOrchestrator(agentIds, prompt, executeFn);
          break;
      }

      // Set agents to done
      agentIds.forEach(id => {
        const agent = this.agents.get(id);
        if (agent) {
          agent.status = 'done';
        }
      });
    } catch (error) {
      success = false;
      agentIds.forEach(id => {
        const agent = this.agents.get(id);
        if (agent) {
          agent.status = 'error';
        }
      });
    }

    this.notifyListeners();

    return {
      mode,
      tasks: results,
      totalDuration: Date.now() - startTime,
      success
    };
  }

  private async runParallel(
    agentIds: string[],
    prompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = agentIds.map(id => ({
      id: `task-${id}-${Date.now()}`,
      agentId: id,
      prompt,
      status: 'pending' as const
    }));

    const promises = agentIds.map(async (agentId, index) => {
      tasks[index].status = 'running';
      try {
        const result = await executeFn(agentId, prompt);
        tasks[index].result = result;
        tasks[index].status = 'completed';
      } catch (error: any) {
        tasks[index].error = error.message;
        tasks[index].status = 'failed';
      }
    });

    await Promise.all(promises);
    return tasks;
  }

  private async runSequential(
    agentIds: string[],
    prompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = agentIds.map(id => ({
      id: `task-${id}-${Date.now()}`,
      agentId: id,
      prompt,
      status: 'pending' as const
    }));

    let context = prompt;

    for (let i = 0; i < agentIds.length; i++) {
      tasks[i].status = 'running';
      try {
        const result = await executeFn(agentIds[i], context);
        tasks[i].result = result;
        tasks[i].status = 'completed';
        // Pass context to next agent
        context = `Previous results:\n${result}\n\nOriginal task: ${prompt}`;
      } catch (error: any) {
        tasks[i].error = error.message;
        tasks[i].status = 'failed';
      }
    }

    return tasks;
  }

  private async runCollaborative(
    agentIds: string[],
    prompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<AgentTask[]> {
    // Collaborative = sequential but with shared context
    return this.runSequential(agentIds, prompt, executeFn);
  }

  private async runOrchestrator(
    agentIds: string[],
    prompt: string,
    executeFn: (agentId: string, prompt: string) => Promise<string>
  ): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];
    
    // First, orchestrator (first agent) plans
    const orchestratorId = agentIds[0];
    const workerIds = agentIds.slice(1);

    tasks.push({
      id: `task-${orchestratorId}-${Date.now()}`,
      agentId: orchestratorId,
      prompt: `Create a detailed plan for: ${prompt}`,
      status: 'running'
    });

    try {
      const plan = await executeFn(orchestratorId, `Create a detailed plan for: ${prompt}`);
      tasks[0].result = plan;
      tasks[0].status = 'completed';

      // Workers execute the plan
      const workerTasks = await this.runSequential(workerIds, plan, executeFn);
      tasks.push(...workerTasks);
    } catch (error: any) {
      tasks[0].error = error.message;
      tasks[0].status = 'failed';
    }

    return tasks;
  }

  addListener(callback: (state: MultiAgentState) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (state: MultiAgentState) => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners(): void {
    const state: MultiAgentState = {
      selectedAgents: Array.from(this.agents.values())
        .filter(a => a.status !== 'idle' && a.status !== 'ready')
        .map(a => a.id),
      mode: 'parallel',
      isRunning: Array.from(this.agents.values()).some(a => a.status === 'running')
    };

    this.listeners.forEach(l => l(state));
  }
}

export const multiAgentService = new MultiAgentService();
export default multiAgentService;