// =============================================================================
// HERMES AGENT ORCHESTRATOR — Dispatch kanban tasks to fleet nodes
// =============================================================================
// When user clicks "Hire Agent" or "Book Training" in Stargate, this service
// creates a Hermes kanban task that gets picked up by the fleet orchestrator.
//
// NO SSH between nodes. Dispatch uses:
//   1. Electron spawn (hermes kanban create) if available
//   2. Fleet registry task queue (nodes poll registry for tasks)
//   3. Gateway messaging (Telegram/Discord bot) as fallback
// =============================================================================

export interface HireAgentParams {
  agentName: string;
  role: string;
  skills: string[];
  computeTier: 'standard' | 'high_performance' | 'dedicated';
  targetNodeId?: string; // null = "any available fleet node"
  description?: string;
}

export interface BookTrainingParams {
  trainerName: string;
  agentId: string;
  skillName: string;
  targetNodeId?: string;
}

export interface DeployAgentParams {
  agentId: string;
  nodeId: string;
  config?: Record<string, any>;
}

export interface OrchestratorTask {
  taskId: string;
  status: 'backlog' | 'ready' | 'running' | 'aimified' | 'failed';
  type: 'hire' | 'train' | 'deploy';
  params: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  assignedNode?: string;
  logs: string[];
}

const TASK_REGISTRY_URL = 'https://gist.githubusercontent.com/mauro-hyperaibox/fleet-tasks/main/tasks.json';

class HermesAgentOrchestrator {
  // ---------------------------------------------------------------------------
  // Hire Agent → kanban task
  // ---------------------------------------------------------------------------
  async hireAgent(params: HireAgentParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `hire-${Date.now()}`,
      status: 'backlog',
      type: 'hire',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Created hire task for ${params.agentName} (${params.role})`],
    };

    // Try Electron spawn first
    const electronTaskId = await this._spawnKanbanTask(
      `Deploy ${params.agentName} (${params.role})`,
      `Skills: ${params.skills.join(', ')} | Tier: ${params.computeTier} | Node: ${params.targetNodeId || 'any'}`,
      params.targetNodeId
    );

    if (electronTaskId) {
      task.taskId = electronTaskId;
      task.status = 'ready';
      task.logs.push(`Dispatched via Electron to kanban: ${electronTaskId}`);
    } else {
      // Fallback: append to fleet registry task queue
      await this._appendToFleetRegistry(task);
      task.logs.push(`Appended to fleet registry task queue`);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // Book Training → kanban task
  // ---------------------------------------------------------------------------
  async bookTraining(params: BookTrainingParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `train-${Date.now()}`,
      status: 'backlog',
      type: 'train',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Created training task: ${params.skillName} for ${params.agentId}`],
    };

    const electronTaskId = await this._spawnKanbanTask(
      `Train ${params.agentId} on ${params.skillName}`,
      `Trainer: ${params.trainerName}`,
      params.targetNodeId
    );

    if (electronTaskId) {
      task.taskId = electronTaskId;
      task.status = 'ready';
    } else {
      await this._appendToFleetRegistry(task);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // Deploy to specific node
  // ---------------------------------------------------------------------------
  async deployToNode(params: DeployAgentParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `deploy-${Date.now()}`,
      status: 'backlog',
      type: 'deploy',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Deploy ${params.agentId} to ${params.nodeId}`],
    };

    // Try gateway message if node has Telegram/Discord
    const sent = await this._sendViaGateway(params.nodeId, `deploy:${params.agentId}`);
    if (sent) {
      task.status = 'running';
      task.logs.push(`Sent deploy command via gateway`);
    } else {
      await this._appendToFleetRegistry(task);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // Internal: Electron spawn
  // ---------------------------------------------------------------------------
  private async _spawnKanbanTask(title: string, description: string, profile?: string): Promise<string | null> {
    try {
      const spawn = (window as any).electronAPI?.system?.spawn;
      if (!spawn) return null;

      const cmd = `hermes kanban create`;
      const args = [
        '--title', title,
        '--description', description,
      ];
      if (profile) args.push('--profile', profile);

      const result = await spawn(cmd, args);
      return result?.taskId || null;
    } catch (e: any) {
      console.error('[Orchestrator] spawn failed:', e.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Fleet registry task queue (no SSH required)
  // ---------------------------------------------------------------------------
  private async _appendToFleetRegistry(task: OrchestratorTask): Promise<void> {
    try {
      // Pull current tasks
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(TASK_REGISTRY_URL, { signal: ctrl.signal });
      clearTimeout(to);
      const registry = res.ok ? await res.json() : { tasks: [] };
      const tasks: OrchestratorTask[] = registry.tasks || [];

      // Append and push back (read-only in this demo — real impl needs a backend)
      tasks.push(task);

      // In a real DAO, this would be a POST to a coordinator backend
      console.log('[Orchestrator] Would push task to registry:', task.taskId);
      localStorage.setItem('pending_fleet_tasks', JSON.stringify(tasks.slice(-50)));
    } catch (e: any) {
      console.error('[Orchestrator] Registry append failed:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Gateway message (Telegram/Discord bot)
  // ---------------------------------------------------------------------------
  private async _sendViaGateway(nodeId: string, message: string): Promise<boolean> {
    try {
      const gateway = (window as any).electronAPI?.gateway;
      if (!gateway) return false;
      // Lookup node's gateway channel from fleet registry
      const fleet = JSON.parse(localStorage.getItem('fleet_registry') || '[]');
      const node = fleet.find((n: any) => n.nodeId === nodeId);
      if (!node?.gatewayChannel) return false;

      await gateway.sendMessage(node.gatewayChannel, message);
      return true;
    } catch {
      return false;
    }
  }
}

export const hermesAgentOrchestrator = new HermesAgentOrchestrator();
export default HermesAgentOrchestrator;
