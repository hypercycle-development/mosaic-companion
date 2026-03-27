/**
 * Multi-Agent Chat Hook
 * Handles multi-agent orchestration in chat
 */

import { useState, useCallback } from 'react';
import { AIAgentConfig, ChatMessage } from '../types/ai';
import { AIService } from '../services/AIService';
import { OrchestrationMode } from '../services/MultiAgentService';

export interface MultiAgentResult {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  content?: string;
  error?: string;
}

export function useMultiAgentChat(
  agents: AIAgentConfig[],
  onMessage?: (agentId: string, content: string) => void
) {
  const [isMultiAgentRunning, setIsMultiAgentRunning] = useState(false);
  const [multiAgentResults, setMultiAgentResults] = useState<MultiAgentResult[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);

  const runMultiAgent = useCallback(async (
    agentIds: string[],
    prompt: string,
    mode: OrchestrationMode,
    systemPrompts?: Map<string, string>
  ) => {
    if (!prompt.trim() || agentIds.length === 0) return;

    setIsMultiAgentRunning(true);
    setMultiAgentResults(agentIds.map(id => {
      const agent = agents.find(a => a.id === id);
      return {
        agentId: id,
        agentName: agent?.name || id,
        status: 'pending' as const
      };
    }));

    const results: MultiAgentResult[] = [];

    try {
      if (mode === 'parallel') {
        // Run all agents simultaneously
        const promises = agentIds.map(async (agentId) => {
          const agent = agents.find(a => a.id === agentId);
          if (!agent) {
            return { agentId, agentName: agentId, status: 'error' as const, error: 'Agent not found' };
          }

          setCurrentAgentId(agentId);
          
          // Update status to running
          setMultiAgentResults(prev => prev.map(r => 
            r.agentId === agentId ? { ...r, status: 'running' } : r
          ));

          try {
            const messages: ChatMessage[] = [
              { id: `msg-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now(), agentId }
            ];

            const response = await AIService.sendMessage(agent, messages);
            
            onMessage?.(agentId, response);
            
            return { 
              agentId, 
              agentName: agent.name, 
              status: 'completed' as const, 
              content: response 
            };
          } catch (error: any) {
            return { 
              agentId, 
              agentName: agent.name, 
              status: 'error' as const, 
              error: error.message || 'Unknown error' 
            };
          }
        });

        const settled = await Promise.all(promises);
        results.push(...settled);
        
      } else if (mode === 'sequential' || mode === 'collaborative') {
        // Run agents one after another
        let contextPrompt = prompt;

        for (const agentId of agentIds) {
          const agent = agents.find(a => a.id === agentId);
          if (!agent) continue;

          setCurrentAgentId(agentId);
          
          setMultiAgentResults(prev => prev.map(r => 
            r.agentId === agentId ? { ...r, status: 'running' } : r
          ));

          try {
            const messages: ChatMessage[] = [
              { id: `msg-${Date.now()}`, role: 'user', content: contextPrompt, timestamp: Date.now(), agentId }
            ];

            const response = await AIService.sendMessage(agent, messages);
            
            onMessage?.(agentId, response);

            setMultiAgentResults(prev => prev.map(r => 
              r.agentId === agentId ? { ...r, status: 'completed', content: response } : r
            ));

            // In collaborative mode, pass context to next agent
            if (mode === 'collaborative') {
              contextPrompt = `Previous agent response:\n${response}\n\nOriginal task: ${prompt}\n\nContinue with your perspective:`;
            }

            results.push({ 
              agentId, 
              agentName: agent.name, 
              status: 'completed', 
              content: response 
            });
          } catch (error: any) {
            setMultiAgentResults(prev => prev.map(r => 
              r.agentId === agentId ? { ...r, status: 'error', error: error.message } : r
            ));
            results.push({ 
              agentId, 
              agentName: agent.name, 
              status: 'error', 
              error: error.message 
            });
          }
        }

      } else if (mode === 'orchestrator') {
        // First agent orchestrates the others
        const orchestratorId = agentIds[0];
        const workerIds = agentIds.slice(1);

        const orchestrator = agents.find(a => a.id === orchestratorId);
        if (!orchestrator) {
          throw new Error('Orchestrator agent not found');
        }

        setCurrentAgentId(orchestratorId);
        setMultiAgentResults(prev => prev.map(r => 
          r.agentId === orchestratorId ? { ...r, status: 'running' } : r
        ));

        try {
          // Orchestrator creates a plan
          const planPrompt = `You are the orchestrator. Create a detailed plan for this task:\n\n${prompt}\n\nBreak it down into steps and assign each step to the available agents: ${workerIds.map(id => agents.find(a => a.id === id)?.name).join(', ')}`;

          const messages: ChatMessage[] = [
            { id: `msg-${Date.now()}`, role: 'user', content: planPrompt, timestamp: Date.now(), agentId: orchestratorId }
          ];

          const plan = await AIService.sendMessage(orchestrator, messages);
          
          setMultiAgentResults(prev => prev.map(r => 
            r.agentId === orchestratorId ? { ...r, status: 'completed', content: plan } : r
          ));

          onMessage?.(orchestratorId, plan);

          // Workers execute the plan (in parallel)
          const workerPromises = workerIds.map(async (agentId) => {
            const agent = agents.find(a => a.id === agentId);
            if (!agent) return null;

            setCurrentAgentId(agentId);
            setMultiAgentResults(prev => prev.map(r => 
              r.agentId === agentId ? { ...r, status: 'running' } : r
            ));

            try {
              const workerPrompt = `Execute your assigned task from this plan:\n\n${plan}\n\nYour task: Focus on your specific role as ${agent.name}.`;
              
              const workerMessages: ChatMessage[] = [
                { id: `msg-${Date.now()}`, role: 'user', content: workerPrompt, timestamp: Date.now(), agentId }
              ];

              const response = await AIService.sendMessage(agent, workerMessages);
              
              setMultiAgentResults(prev => prev.map(r => 
                r.agentId === agentId ? { ...r, status: 'completed', content: response } : r
              ));

              onMessage?.(agentId, response);

              return { agentId, agentName: agent.name, status: 'completed' as const, content: response };
            } catch (error: any) {
              setMultiAgentResults(prev => prev.map(r => 
                r.agentId === agentId ? { ...r, status: 'error', error: error.message } : r
              ));
              return { agentId, agentName: agent.name, status: 'error' as const, error: error.message };
            }
          });

          const workerResults = await Promise.all(workerPromises);
          results.push({ agentId: orchestratorId, agentName: orchestrator.name, status: 'completed', content: plan });
          results.push(...workerResults.filter(Boolean) as MultiAgentResult[]);

        } catch (error: any) {
          setMultiAgentResults(prev => prev.map(r => 
            r.agentId === orchestratorId ? { ...r, status: 'error', error: error.message } : r
          ));
        }
      }

    } finally {
      setIsMultiAgentRunning(false);
      setCurrentAgentId(null);
    }

    return results;
  }, [agents, onMessage]);

  const clearResults = useCallback(() => {
    setMultiAgentResults([]);
    setCurrentAgentId(null);
  }, []);

  return {
    isMultiAgentRunning,
    multiAgentResults,
    currentAgentId,
    runMultiAgent,
    clearResults
  };
}

export default useMultiAgentChat;