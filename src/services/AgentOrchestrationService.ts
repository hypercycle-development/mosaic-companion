// Agent Orchestration Service
// Coordinates multiple AI agents working together on complex tasks

import { AIAgentConfig, ChatMessage } from '../types/ai';
import { AIService } from './AIService';
import { AgentSoulService } from './AgentSoulService';

// Extend messages with Soul context for each agent
async function enrichWithSoul(agent: AIAgentConfig, messages: ChatMessage[]): Promise<ChatMessage[]> {
  try {
    const soulContext = await AgentSoulService.getSoulContext(agent.id);
    if (soulContext) {
      // Add system message with Soul context at the beginning
      const soulSystemMessage: ChatMessage = {
        id: `soul-${Date.now()}`,
        role: 'system',
        content: soulContext,
        timestamp: Date.now(),
        agentId: agent.id
      };
      return [soulSystemMessage, ...messages];
    }
  } catch (e) {
    console.log(`[Soul] No soul context for agent ${agent.id}`);
  }
  return messages;
}
import {
  OrchestrationMode,
  AggregationStrategy,
  OrchestrationResult,
  AgentResponse,
  OrchestrationCallbacks,
  OrchestrationTemplate,
  ORCHESTRATION_TEMPLATES,
} from '../types/agentOrchestration';

export class AgentOrchestrationService {
  /**
   * Run multiple agents in sequence (pipeline)
   * Each agent receives the output of the previous agent
   */
  static async runSequential(
    agents: AIAgentConfig[],
    prompt: string,
    callbacks?: OrchestrationCallbacks
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const responses: AgentResponse[] = [];
    let currentInput = prompt;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentStart = Date.now();

      callbacks?.onAgentStart?.(agent.id, agent.name, i + 1, agents.length);

      try {
        const baseMessages: ChatMessage[] = [
          {
            id: `context-${Date.now()}`,
            role: 'user',
            content: currentInput,
            timestamp: Date.now(),
            agentId: agent.id,
          },
        ];

        // Enrich with Soul context
        const messages = await enrichWithSoul(agent, baseMessages);

        if (i > 0 && responses.length > 0) {
          const prevResponse = responses[responses.length - 1];
          messages.unshift({
            id: `prev-${Date.now()}`,
            role: 'assistant',
            content: `Previous agent (${prevResponse.agentName}) output:\n${prevResponse.response}`,
            timestamp: Date.now() - 1,
            agentId: agent.id,
          });
        }

        let fullResponse = '';
        const response = await AIService.sendMessage(agent, messages, {
          onToken: (token) => {
            fullResponse += token;
            callbacks?.onAgentProgress?.(agent.id, token);
          },
          onComplete: () => {},
          onError: (error) => {
            throw error;
          },
        });

        const duration = Date.now() - agentStart;
        responses.push({
          agentId: agent.id,
          agentName: agent.name,
          response,
          timestamp: agentStart,
          duration,
        });

        callbacks?.onAgentComplete?.(agent.id, response, duration);
        currentInput = response;

      } catch (error) {
        const duration = Date.now() - agentStart;
        responses.push({
          agentId: agent.id,
          agentName: agent.name,
          response: '',
          timestamp: agentStart,
          duration,
          error: (error as Error).message,
        });
        callbacks?.onAgentError?.(agent.id, (error as Error).message);
      }
    }

    const result: OrchestrationResult = {
      taskId: `task-${Date.now()}`,
      responses,
      finalOutput: responses[responses.length - 1]?.response || '',
      totalDuration: Date.now() - startTime,
      mode: 'sequential',
      aggregationStrategy: 'lastWins',
      success: !responses.some(r => r.error),
    };

    callbacks?.onAllComplete?.(result);
    return result;
  }

  /**
   * Run multiple agents in parallel
   * All agents receive the same prompt, results aggregated
   */
  static async runParallel(
    agents: AIAgentConfig[],
    prompt: string,
    callbacks?: OrchestrationCallbacks
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const responses: AgentResponse[] = [];

    const promises = agents.map(async (agent, index) => {
      const agentStart = Date.now();
      callbacks?.onAgentStart?.(agent.id, agent.name, index + 1, agents.length);

      try {
        const baseMessages: ChatMessage[] = [
          {
            id: `msg-${Date.now()}-${index}`,
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
            agentId: agent.id,
          },
        ];

        // Enrich with Soul context
        const messages = await enrichWithSoul(agent, baseMessages);

        let fullResponse = '';
        const response = await AIService.sendMessage(agent, messages, {
          onToken: (token) => {
            fullResponse += token;
            callbacks?.onAgentProgress?.(agent.id, token);
          },
          onComplete: () => {},
          onError: (error) => {
            throw error;
          },
        });

        const duration = Date.now() - agentStart;
        callbacks?.onAgentComplete?.(agent.id, response, duration);

        return {
          agentId: agent.id,
          agentName: agent.name,
          response,
          timestamp: agentStart,
          duration,
        };

      } catch (error) {
        const duration = Date.now() - agentStart;
        callbacks?.onAgentError?.(agent.id, (error as Error).message);
        return {
          agentId: agent.id,
          agentName: agent.name,
          response: '',
          timestamp: agentStart,
          duration,
          error: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(promises);
    responses.push(...results);

    const result: OrchestrationResult = {
      taskId: `task-${Date.now()}`,
      responses,
      finalOutput: this.aggregateResponses(responses, 'concatenate'),
      totalDuration: Date.now() - startTime,
      mode: 'parallel',
      aggregationStrategy: 'concatenate',
      success: !responses.some(r => r.error),
    };

    callbacks?.onAllComplete?.(result);
    return result;
  }

  /**
   * Run collaborative session where agents iterate on each other's work
   */
  static async runCollaborative(
    agents: AIAgentConfig[],
    prompt: string,
    maxIterations: number = 3,
    callbacks?: OrchestrationCallbacks
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const responses: AgentResponse[] = [];
    let currentContent = prompt;
    let iteration = 0;

    while (iteration < maxIterations) {
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const agentStart = Date.now();

        callbacks?.onAgentStart?.(
          agent.id,
          agent.name,
          iteration * agents.length + i + 1,
          maxIterations * agents.length
        );

        try {
          const messages: ChatMessage[] = [
            {
              id: `iter-${iteration}-${i}`,
              role: 'user',
              content: iteration === 0 ? prompt : `Previous iteration:\n${currentContent}\n\nPlease improve or add your perspective.`,
              timestamp: Date.now(),
              agentId: agent.id,
            },
          ];

          let fullResponse = '';
          const response = await AIService.sendMessage(agent, messages, {
            onToken: (token) => {
              fullResponse += token;
              callbacks?.onAgentProgress?.(agent.id, token);
            },
            onComplete: () => {},
            onError: (error) => {
              throw error;
            },
          });

          const duration = Date.now() - agentStart;
          responses.push({
            agentId: agent.id,
            agentName: agent.name,
            response,
            timestamp: agentStart,
            duration,
          });

          callbacks?.onAgentComplete?.(agent.id, response, duration);
          currentContent = response;

        } catch (error) {
          const duration = Date.now() - agentStart;
          responses.push({
            agentId: agent.id,
            agentName: agent.name,
            response: '',
            timestamp: agentStart,
            duration,
            error: (error as Error).message,
          });
          callbacks?.onAgentError?.(agent.id, (error as Error).message);
        }
      }
      iteration++;
    }

    const result: OrchestrationResult = {
      taskId: `task-${Date.now()}`,
      responses,
      finalOutput: currentContent,
      totalDuration: Date.now() - startTime,
      mode: 'collaborative',
      aggregationStrategy: 'lastWins',
      success: !responses.some(r => r.error),
    };

    callbacks?.onAllComplete?.(result);
    return result;
  }

  /**
   * Run with orchestrator - one agent coordinates others
   */
  static async runOrchestrated(
    orchestrator: AIAgentConfig,
    workers: AIAgentConfig[],
    prompt: string,
    callbacks?: OrchestrationCallbacks
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const responses: AgentResponse[] = [];

    callbacks?.onAgentStart?.(orchestrator.id, orchestrator.name, 1, workers.length + 2);

    const orchestratorPrompt = `You are coordinating a team of AI agents to complete a task.

Available agents:
${workers.map(w => `- ${w.name} (ID: ${w.id})`).join('\n')}

Task: ${prompt}

Create a plan to divide this task among the agents.`;

    const orchestratorMessages: ChatMessage[] = [
      {
        id: `orch-${Date.now()}`,
        role: 'user',
        content: orchestratorPrompt,
        timestamp: Date.now(),
        agentId: orchestrator.id,
      },
    ];

    let orchestratorResponse = '';
    await AIService.sendMessage(orchestrator, orchestratorMessages, {
      onToken: (token) => {
        orchestratorResponse += token;
        callbacks?.onAgentProgress?.(orchestrator.id, token);
      },
      onComplete: () => {},
      onError: (error) => {
        throw error;
      },
    });

    callbacks?.onAgentComplete?.(orchestrator.id, orchestratorResponse, Date.now() - startTime);

    const workerResponses: string[] = [];
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      const workerStart = Date.now();

      callbacks?.onAgentStart?.(worker.id, worker.name, i + 2, workers.length + 2);

      try {
        const baseMessages: ChatMessage[] = [
          {
            id: `worker-${i}-${Date.now()}`,
            role: 'user',
            content: `Task: ${prompt}\n\nContext from coordinator:\n${orchestratorResponse}`,
            timestamp: Date.now(),
            agentId: worker.id,
          },
        ];

        // Enrich with Soul context
        const messages = await enrichWithSoul(worker, baseMessages);

        let workerResponse = '';
        const response = await AIService.sendMessage(worker, messages, {
          onToken: (token) => {
            workerResponse += token;
            callbacks?.onAgentProgress?.(worker.id, token);
          },
          onComplete: () => {},
          onError: (error) => {
            throw error;
          },
        });

        const duration = Date.now() - workerStart;
        responses.push({
          agentId: worker.id,
          agentName: worker.name,
          response,
          timestamp: workerStart,
          duration,
        });
        workerResponses.push(response);

        callbacks?.onAgentComplete?.(worker.id, response, duration);

      } catch (error) {
        const duration = Date.now() - workerStart;
        responses.push({
          agentId: worker.id,
          agentName: worker.name,
          response: '',
          timestamp: workerStart,
          duration,
          error: (error as Error).message,
        });
        callbacks?.onAgentError?.(worker.id, (error as Error).message);
      }
    }

    // Orchestrator synthesizes
    callbacks?.onSynthesisStart?.(orchestrator.id);

    const synthesisPrompt = `All workers have completed their tasks. Here are their outputs:

${workers.map((w, i) => `--- ${w.name} ---\n${workerResponses[i]}`).join('\n\n')}

Please synthesize these outputs into a final, coherent result.`;

    const synthesisMessages: ChatMessage[] = [
      {
        id: `synth-${Date.now()}`,
        role: 'user',
        content: synthesisPrompt,
        timestamp: Date.now(),
        agentId: orchestrator.id,
      },
    ];

    let finalOutput = '';
    await AIService.sendMessage(orchestrator, synthesisMessages, {
      onToken: (token) => {
        finalOutput += token;
        callbacks?.onAgentProgress?.(orchestrator.id, token);
      },
      onComplete: () => {},
      onError: (error) => {
        throw error;
      },
    });

    const result: OrchestrationResult = {
      taskId: `task-${Date.now()}`,
      responses,
      finalOutput,
      totalDuration: Date.now() - startTime,
      mode: 'orchestrator',
      aggregationStrategy: 'synthesize',
      success: !responses.some(r => r.error),
    };

    callbacks?.onAllComplete?.(result);
    return result;
  }

  /**
   * Aggregate multiple responses into one
   */
  private static aggregateResponses(
    responses: AgentResponse[],
    strategy: AggregationStrategy
  ): string {
    switch (strategy) {
      case 'lastWins':
        return responses[responses.length - 1]?.response || '';
      
      case 'concatenate':
        return responses.map(r => 
          `=== ${r.agentName} ===\n${r.response}`
        ).join('\n\n---\n\n');
      
      case 'synthesize':
        return responses.map(r => 
          `=== ${r.agentName} ===\n${r.response}`
        ).join('\n\n---\n\n');
      
      case 'vote':
        return responses[0]?.response || '';
      
      default:
        return responses.map(r => r.response).join('\n\n');
    }
  }

  /**
   * Run orchestration with template
   */
  static async runWithTemplate(
    template: OrchestrationTemplate,
    agents: AIAgentConfig[],
    prompt: string,
    callbacks?: OrchestrationCallbacks
  ): Promise<OrchestrationResult> {
    // Sort agentRoles by order for sequential mode
    const sortedRoles = [...template.agentRoles].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const orderedAgents = sortedRoles
      .map(role => agents.find(a => a.id === role.agentId))
      .filter((a): a is AIAgentConfig => a !== undefined);

    const enhancedPrompt = template.systemPromptAddition
      ? `${template.systemPromptAddition}\n\n---\n\n${prompt}`
      : prompt;

    switch (template.mode) {
      case 'sequential':
        return this.runSequential(orderedAgents, enhancedPrompt, callbacks);
      case 'parallel':
        return this.runParallel(orderedAgents, enhancedPrompt, callbacks);
      case 'collaborative':
        return this.runCollaborative(orderedAgents, enhancedPrompt, template.maxIterations || 3, callbacks);
      case 'orchestrator':
        const [orchestrator, ...workers] = orderedAgents;
        if (orchestrator && workers.length > 0) {
          return this.runOrchestrated(orchestrator, workers, enhancedPrompt, callbacks);
        }
        return this.runParallel(orderedAgents, enhancedPrompt, callbacks);
      default:
        return this.runParallel(orderedAgents, enhancedPrompt, callbacks);
    }
  }
}

export default AgentOrchestrationService;