/**
 * Multi-Agent Plugin - Main Process
 * Handles multi-agent orchestration state and coordination
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'multi-agent' });

// Types
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
  currentAgent: string | null;
}

// Default agents
const DEFAULT_AGENTS: Agent[] = [
  { id: 'agent-1', name: 'Architect', role: 'System Design', status: 'ready', model: 'llama3' },
  { id: 'agent-2', name: 'Developer', role: 'Code Generation', status: 'ready', model: 'codellama' },
  { id: 'agent-3', name: 'Reviewer', role: 'Code Review', status: 'ready', model: 'llama3' },
  { id: 'agent-4', name: 'Tester', role: 'Quality Assurance', status: 'ready', model: 'llama3' },
  { id: 'agent-5', name: 'Analyst', role: 'Data Analysis', status: 'ready', model: 'mistral' },
];

export function registerMultiAgentIpc() {
  // Initialize default agents if none exist
  const storedAgents = store.get('agents', []) as Agent[];
  if (storedAgents.length === 0) {
    store.set('agents', DEFAULT_AGENTS);
  }

  // Get all agents
  ipcMain.handle('multiagent:get-agents', async () => {
    return store.get('agents', DEFAULT_AGENTS);
  });

  // Save agents
  ipcMain.handle('multiagent:set-agents', async (_event, agents: Agent[]) => {
    store.set('agents', agents);
    return { success: true };
  });

  // Get orchestration state
  ipcMain.handle('multiagent:get-state', async () => {
    return store.get('orchestrationState', {
      mode: 'parallel',
      isRunning: false,
      currentAgent: null,
      tasks: []
    });
  });

  // Set orchestration state
  ipcMain.handle('multiagent:set-state', async (_event, state: MultiAgentState) => {
    store.set('orchestrationState', state);
    return { success: true };
  });

  // Run orchestration (parallel mode)
  ipcMain.handle('multiagent:run-parallel', async (_event, agentIds: string[], prompt: string) => {
    const startTime = Date.now();
    const tasks: AgentTask[] = agentIds.map(id => ({
      id: `task-${id}-${Date.now()}`,
      agentId: id,
      prompt,
      status: 'pending' as const
    }));

    // In parallel mode, all agents run simultaneously
    // The actual execution happens in renderer via AIService
    // This just tracks the state
    
    const result: OrchestrationResult = {
      mode: 'parallel',
      tasks,
      totalDuration: Date.now() - startTime,
      success: true
    };

    // Add to history
    const history = store.get('history', []) as any[];
    history.push({ ...result, timestamp: Date.now() });
    if (history.length > 100) history.shift();
    store.set('history', history);

    return result;
  });

  // Run orchestration (sequential mode)
  ipcMain.handle('multiagent:run-sequential', async (_event, agentIds: string[], prompt: string) => {
    const startTime = Date.now();
    const tasks: AgentTask[] = agentIds.map(id => ({
      id: `task-${id}-${Date.now()}`,
      agentId: id,
      prompt,
      status: 'pending' as const
    }));

    // In sequential mode, agents run one after another
    // Context is passed from one to the next
    
    const result: OrchestrationResult = {
      mode: 'sequential',
      tasks,
      totalDuration: Date.now() - startTime,
      success: true
    };

    // Add to history
    const history = store.get('history', []) as any[];
    history.push({ ...result, timestamp: Date.now() });
    if (history.length > 100) history.shift();
    store.set('history', history);

    return result;
  });

  // Get agent history
  ipcMain.handle('multiagent:get-history', async () => {
    return store.get('history', []);
  });

  // Add to history
  ipcMain.handle('multiagent:add-history', async (_event, entry: any) => {
    const history = store.get('history', []) as any[];
    history.push({ ...entry, timestamp: Date.now() });
    if (history.length > 100) history.shift();
    store.set('history', history);
    return { success: true };
  });

  // Get orchestration modes
  ipcMain.handle('multiagent:get-modes', async () => {
    return [
      { id: 'parallel', name: 'Parallel', description: 'All agents run simultaneously' },
      { id: 'sequential', name: 'Sequential', description: 'Agents run one after another, context passed' },
      { id: 'collaborative', name: 'Collaborative', description: 'Agents share context and build on each other' },
      { id: 'orchestrator', name: 'Orchestrator', description: 'Lead agent coordinates other agents' }
    ];
  });

  console.log('[MultiAgent] IPC handlers registered');
}