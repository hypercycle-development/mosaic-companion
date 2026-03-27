/**
 * Multi-Agent Orchestration Hook
 * Manages state, execution, and results for multi-agent workflows
 */

import { useState, useCallback, useRef } from 'react';
import { AIAgentConfig, ChatMessage } from '../types/ai';
import { AIService } from '../services/AIService';

export type OrchestrationMode = 'parallel' | 'sequential' | 'collaborative' | 'orchestrator';

export interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  prompt: string;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface MultiAgentState {
  mode: OrchestrationMode;
  tasks: AgentTask[];
  isRunning: boolean;
  currentAgentId: string | null;
  error: string | null;
}

export interface MultiAgentResult {
  success: boolean;
  tasks: AgentTask[];
  totalDuration: number;
}

export function useMultiAgentOrchestration() {
  const [state, setState] = useState<MultiAgentState>({
    mode: 'parallel',
    tasks: [],
    isRunning: false,
    currentAgentId: null,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const setMode = useCallback((mode: OrchestrationMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const executeAgent = useCallback(async (
    agent: AIAgentConfig,
    prompt: string,
    signal?: AbortSignal
  ): Promise<string> => {
    const messages: ChatMessage[] = [
      { id: `msg-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now(), agentId: agent.id }
    ];

    try {
      const response = await AIService.sendMessage(agent, messages);
      return response;
    } catch (error: any) {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      throw error;
    }
  }, []);

  const runParallel = useCallback(async (
    agents: AIAgentConfig[],
    prompt: string,
    onProgress?: (task: AgentTask) => void
  ): Promise<AgentTask[]> => {
    const tasks: AgentTask[] = agents.map(agent => ({
      id: `task-${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      status: 'pending' as const,
      prompt
    }));

    // Run all agents simultaneously
    const promises = agents.map(async (agent, index) => {
      const task = tasks[index];
      
      // Update to running
      task.status = 'running';
      task.startTime = Date.now();
      onProgress?.(task);

      try {
        const result = await executeAgent(agent, prompt, abortControllerRef.current?.signal);
        task.status = 'completed';
        task.result = result;
        task.endTime = Date.now();
      } catch (error: any) {
        task.status = 'error';
        task.error = error.message;
        task.endTime = Date.now();
      }

      onProgress?.(task);
      return task;
    });

    await Promise.all(promises);
    return tasks;
  }, [executeAgent]);

  const runSequential = useCallback(async (
    agents: AIAgentConfig[],
    prompt: string,
    onProgress?: (task: AgentTask) => void
  ): Promise<AgentTask[]> => {
    const tasks: AgentTask[] = agents.map(agent => ({
      id: `task-${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      status: 'pending' as const,
      prompt
    }));

    let context = prompt;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const task = tasks[i];

      if (abortControllerRef.current?.signal.aborted) {
        task.status = 'error';
        task.error = 'Aborted';
        break;
      }

      task.status = 'running';
      task.startTime = Date.now();
      onProgress?.(task);

      try {
        const result = await executeAgent(agent, context, abortControllerRef.current?.signal);
        task.status = 'completed';
        task.result = result;
        task.endTime = Date.now();
        
        // Pass context to next agent
        context = `Previous agent (${agents[i].name}) response:\n${result}\n\nOriginal task: ${prompt}`;
      } catch (error: any) {
        task.status = 'error';
        task.error = error.message;
        task.endTime = Date.now();
      }

      onProgress?.(task);
    }

    return tasks;
  }, [executeAgent]);

  const runOrchestrator = useCallback(async (
    agents: AIAgentConfig[],
    prompt: string,
    onProgress?: (task: AgentTask) => void
  ): Promise<AgentTask[]> => {
    const tasks: AgentTask[] = [];
    
    if (agents.length === 0) return tasks;

    const orchestrator = agents[0];
    const workers = agents.slice(1);

    // Orchestrator creates a plan
    const orchestratorTask: AgentTask = {
      id: `task-${orchestrator.id}-${Date.now()}`,
      agentId: orchestrator.id,
      agentName: orchestrator.name,
      status: 'running',
      prompt: `Create a detailed plan for: ${prompt}`
    };
    tasks.push(orchestratorTask);
    onProgress?.(orchestratorTask);

    try {
      const plan = await executeAgent(orchestrator, orchestratorTask.prompt, abortControllerRef.current?.signal);
      orchestratorTask.status = 'completed';
      orchestratorTask.result = plan;
      orchestratorTask.endTime = Date.now();
      onProgress?.(orchestratorTask);

      // Workers execute the plan
      if (workers.length > 0) {
        const workerTasks = await runSequential(workers, plan, onProgress);
        tasks.push(...workerTasks);
      }
    } catch (error: any) {
      orchestratorTask.status = 'error';
      orchestratorTask.error = error.message;
      orchestratorTask.endTime = Date.now();
      onProgress?.(orchestratorTask);
    }

    return tasks;
  }, [executeAgent, runSequential]);

  const run = useCallback(async (
    agents: AIAgentConfig[],
    prompt: string
  ): Promise<MultiAgentResult> => {
    if (agents.length === 0) {
      return { success: false, tasks: [], totalDuration: 0 };
    }

    const startTime = Date.now();
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isRunning: true,
      error: null,
      tasks: agents.map(agent => ({
        id: `task-${agent.id}-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        status: 'pending',
        prompt
      }))
    }));

    let tasks: AgentTask[] = [];

    try {
      switch (state.mode) {
        case 'parallel':
          tasks = await runParallel(agents, prompt, (task) => {
            setState(prev => ({
              ...prev,
              currentAgentId: task.agentId,
              tasks: prev.tasks.map(t => t.agentId === task.agentId ? task : t)
            }));
          });
          break;
        case 'sequential':
        case 'collaborative':
          tasks = await runSequential(agents, prompt, (task) => {
            setState(prev => ({
              ...prev,
              currentAgentId: task.agentId,
              tasks: prev.tasks.map(t => t.agentId === task.agentId ? task : t)
            }));
          });
          break;
        case 'orchestrator':
          tasks = await runOrchestrator(agents, prompt, (task) => {
            setState(prev => ({
              ...prev,
              currentAgentId: task.agentId,
              tasks: prev.tasks.map(t => t.agentId === task.agentId ? task : t)
            }));
          });
          break;
      }

      const success = tasks.every(t => t.status === 'completed');
      const totalDuration = Date.now() - startTime;

      setState(prev => ({
        ...prev,
        isRunning: false,
        currentAgentId: null,
        tasks
      }));

      return { success, tasks, totalDuration };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        currentAgentId: null,
        error: error.message
      }));

      return { success: false, tasks, totalDuration: Date.now() - startTime };
    }
  }, [state.mode, runParallel, runSequential, runOrchestrator]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(prev => ({
      ...prev,
      isRunning: false,
      currentAgentId: null,
      error: 'Aborted by user'
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      mode: 'parallel',
      tasks: [],
      isRunning: false,
      currentAgentId: null,
      error: null
    });
  }, []);

  return {
    state,
    setMode,
    run,
    abort,
    reset
  };
}

export default useMultiAgentOrchestration;