// =============================================================================
// STARGATE INTEGRATIONS — Unified Orchestration Bus
// Merge MultiAgentService (4 modes) with HermesAgentOrchestrator (fleet mesh)
// =============================================================================

import {
  multiAgentService,
  type Agent,
  type AgentTask,
  type OrchestrationMode,
} from '../../MultiAgentService';
import {
  hermesAgentOrchestrator,
  type OrchestratorTask,
  type HireAgentParams,
  type BookTrainingParams,
  type DeployAgentParams,
} from '../HermesAgentOrchestrator';

// =============================================================================
// Fleet Node Metadata
// =============================================================================

interface FleetNode {
  nodeId: string;
  apiHost: string;
  sshUser?: string;
  status: 'online' | 'offline' | 'busy';
  computeTier: 'standard' | 'high_performance' | 'dedicated';
  availableAgents: string[];
}

interface FleetJobConfig {
  jobType: 'parallel' | 'sequential' | 'pipeline';
  nodes: string[];
  tasks: Array<{
    type: 'hire' | 'train' | 'deploy' | 'prompt';
    params: Record<string, unknown>;
    dependsOn?: number;
  }>;
}

interface FleetJobResult {
  jobId: string;
  overallSuccess: boolean;
  completedAt: number;
  nodeResults: Array<{
    nodeId: string;
    taskId: string;
    status: 'completed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
  }>;
}

interface HybridOrchestrationResult {
  localTasks: AgentTask[];
  fleetTasks: OrchestratorTask[];
  summary: string;
}

// =============================================================================
// UnifiedOrchestrator
// =============================================================================

class UnifiedOrchestrator {
  private fleetNodes: Map<string, FleetNode> = new Map();

  // ---------------------------------------------------------------------------
  // Fleet Discovery
  // ---------------------------------------------------------------------------

  loadFleetFromRegistry(): FleetNode[] {
    try {
      const raw = localStorage.getItem('fleet_registry_nodes') || '[]';
      const nodes: FleetNode[] = JSON.parse(raw);
      nodes.forEach(n => this.fleetNodes.set(n.nodeId, n));
      return nodes;
    } catch {
      return [];
    }
  }

  getFleetNodes(): FleetNode[] {
    return Array.from(this.fleetNodes.values());
  }

  getOnlineNodes(): FleetNode[] {
    return this.getFleetNodes().filter(n => n.status === 'online');
  }

  // ---------------------------------------------------------------------------
  // P1-3: Parallel Fleet Dispatch
  // "Deploy to 5 nodes" = parallel mode
  // ---------------------------------------------------------------------------

  async dispatchToFleet(
    prompt: string,
    nodeIds: string[],
    mode: 'parallel' | 'fanout' = 'parallel',
  ): Promise<FleetJobResult> {
    const jobId = `fleet-${Date.now()}`;
    const nodeResults: FleetJobResult['nodeResults'] = [];

    if (mode === 'parallel') {
      // Fire all at once
      const promises = nodeIds.map(async (nodeId) => {
        const result = await hermesAgentOrchestrator.dispatchPrompt(nodeId, prompt);
        nodeResults.push({
          nodeId,
          taskId: `${jobId}-${nodeId}`,
          status: result.response !== '(no response from node)' ? 'completed' : 'failed',
          output: result.response,
        });
      });
      await Promise.all(promises);
    } else {
      // Fanout: send to each, collect results sequentially
      for (const nodeId of nodeIds) {
        const result = await hermesAgentOrchestrator.dispatchPrompt(nodeId, prompt);
        nodeResults.push({
          nodeId,
          taskId: `${jobId}-${nodeId}`,
          status: result.response !== '(no response from node)' ? 'completed' : 'failed',
          output: result.response,
        });
      }
    }

    const overallSuccess = nodeResults.every(r => r.status === 'completed');

    return {
      jobId,
      overallSuccess,
      completedAt: Date.now(),
      nodeResults,
    };
  }

  // ---------------------------------------------------------------------------
  // P1-3: Sequential Pipeline
  // "Train → Verify → Deploy" = sequential mode
  // ---------------------------------------------------------------------------

  async runPipeline(steps: FleetJobConfig['tasks']): Promise<FleetJobResult> {
    const jobId = `pipeline-${Date.now()}`;
    const nodeResults: FleetJobResult['nodeResults'] = [];
    let overallSuccess = true;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Skip if dependency failed
      if (step.dependsOn !== undefined && nodeResults[step.dependsOn]?.status === 'failed') {
        nodeResults.push({
          nodeId: 'local',
          taskId: `${jobId}-step-${i}`,
          status: 'skipped',
        });
        continue;
      }

      let result: OrchestratorTask | null = null;

      try {
        switch (step.type) {
          case 'hire': {
            const p = step.params as unknown as HireAgentParams;
            result = await hermesAgentOrchestrator.hireAgent(p);
            break;
          }
          case 'train': {
            const p = step.params as unknown as BookTrainingParams;
            result = await hermesAgentOrchestrator.bookTraining(p);
            break;
          }
          case 'deploy': {
            const p = step.params as unknown as DeployAgentParams;
            result = await hermesAgentOrchestrator.deployToNode(p);
            break;
          }
          case 'prompt': {
            const nodeId = step.params.nodeId as string;
            const prompt = step.params.prompt as string;
            const out = await hermesAgentOrchestrator.dispatchPrompt(nodeId, prompt);
            nodeResults.push({
              nodeId,
              taskId: `${jobId}-step-${i}`,
              status: 'completed',
              output: out.response,
            });
            continue;
          }
        }

        if (result) {
          nodeResults.push({
            nodeId: result.assignedNode || 'local',
            taskId: result.taskId,
            status: result.status === 'ready' || result.status === 'running' ? 'completed' : 'failed',
            output: result.logs.join('\n'),
          });
        }
      } catch (e: any) {
        nodeResults.push({
          nodeId: step.params.nodeId as string || 'local',
          taskId: `${jobId}-step-${i}`,
          status: 'failed',
          error: e.message,
        });
        overallSuccess = false;
      }
    }

    return {
      jobId,
      overallSuccess,
      completedAt: Date.now(),
      nodeResults,
    };
  }

  // ---------------------------------------------------------------------------
  // P1-3: Hybrid Orchestration
  // MultiAgentService (local) + HermesAgentOrchestrator (fleet)
  // "Deploy to 5 nodes, then analyze results locally"
  // ---------------------------------------------------------------------------

  async runHybrid(
    prompt: string,
    fleetNodeIds: string[],
    localAgentIds: string[],
    mode: OrchestrationMode = 'parallel',
  ): Promise<HybridOrchestrationResult> {
    // Phase 1: Fleet execution
    const fleetResult = await this.dispatchToFleet(prompt, fleetNodeIds, 'parallel');

    // Phase 2: Local aggregation via MultiAgentService
    const aggregatedPrompt = `Fleet results from ${fleetResult.nodeResults.length} nodes:\n\n${
      fleetResult.nodeResults.map(r => `Node ${r.nodeId}: ${r.output || r.error}`).join('\n')
    }\n\nPlease analyze and synthesize.`;

    const localResult = await multiAgentService.runOrchestration(
      localAgentIds,
      aggregatedPrompt,
      mode,
      async (_agentId: string, p: string) => {
        // Local execution: use available models or mock
        return `Local analysis: ${p.substring(0, 200)}...`;
      },
    );

    const fleetTasks: OrchestratorTask[] = fleetResult.nodeResults.map(r => ({
      taskId: r.taskId,
      status: r.status === 'completed' ? 'aimified' : 'failed',
      type: 'deploy',
      params: { nodeId: r.nodeId },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      assignedNode: r.nodeId,
      logs: r.output ? [r.output] : [r.error || ''],
    }));

    return {
      localTasks: localResult.tasks,
      fleetTasks,
      summary: fleetResult.overallSuccess
        ? `Fleet completed. Local ${mode} analysis done by ${localAgentIds.length} agents.`
        : `Fleet partial failure. ${localAgentIds.length} local agents ran fallback analysis.`,
    };
  }

  // ---------------------------------------------------------------------------
  // P1-3: Convert local agent to fleet node
  // ---------------------------------------------------------------------------

  agentToFleetNode(agent: Agent): Partial<FleetNode> {
    return {
      nodeId: agent.id,
      status: agent.status === 'ready' ? 'online' : 'busy',
      computeTier: 'standard',
      availableAgents: [agent.id],
    };
  }

  // ---------------------------------------------------------------------------
  // P1-3: Batch operations
  // ---------------------------------------------------------------------------

  async batchHireToFleet(agents: HireAgentParams[]): Promise<OrchestratorTask[]> {
    const tasks: OrchestratorTask[] = [];
    for (const params of agents) {
      const task = await hermesAgentOrchestrator.hireAgent(params);
      tasks.push(task);
    }
    return tasks;
  }

  async batchDeployToFleet(deployments: DeployAgentParams[]): Promise<OrchestratorTask[]> {
    const tasks: OrchestratorTask[] = [];
    for (const params of deployments) {
      const task = await hermesAgentOrchestrator.deployToNode(params);
      tasks.push(task);
    }
    return tasks;
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const unifiedOrchestrator = new UnifiedOrchestrator();
export default UnifiedOrchestrator;
export type { FleetNode, FleetJobConfig, FleetJobResult, HybridOrchestrationResult };
