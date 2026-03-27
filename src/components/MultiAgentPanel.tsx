/**
 * Multi-Agent Panel Component
 * Agent selection, status, and orchestration controls
 */

import React, { useState, useEffect } from 'react';
import { 
  multiAgentService, 
  Agent, 
  OrchestrationMode,
  MultiAgentState
} from '../services/MultiAgentService';
import { AIAgentConfig } from '../types/ai';

interface MultiAgentPanelProps {
  // New props from Chatview
  agents?: AIAgentConfig[];
  selectedAgentIds?: string[];
  orchestrationMode?: OrchestrationMode;
  isActive?: boolean;
  isRunning?: boolean;
  currentAgentName?: string;
  // Legacy props
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode) => void;
  initialSelected?: string[];
}

export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  agents: externalAgents,
  selectedAgentIds = [],
  orchestrationMode: externalMode = 'parallel',
  isActive = false,
  isRunning: externalRunning = false,
  currentAgentName = '',
  onRun,
  initialSelected = []
}) => {
  const [internalAgents, setInternalAgents] = useState<Agent[]>(multiAgentService.getAgents());
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedAgentIds.length > 0 ? selectedAgentIds : initialSelected);
  const [mode, setMode] = useState<OrchestrationMode>(externalMode);
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(externalRunning);

  useEffect(() => {
    multiAgentService.addListener((state: MultiAgentState) => {
      setInternalAgents(multiAgentService.getAgents());
      setIsRunning(state.isRunning);
    });
    return () => multiAgentService.removeListener(() => {});
  }, []);

  // Use external agents if provided, otherwise use internal agents
  const displayAgents = externalAgents || internalAgents;

  const toggleAgent = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRun = async () => {
    if (selectedIds.length === 0 || !prompt.trim()) return;

    setIsRunning(true);
    try {
      const executeFn = async (agentId: string, taskPrompt: string): Promise<string> => {
        return `Response from ${agentId}: Processed "${taskPrompt}"`;
      };

      await multiAgentService.runOrchestration(selectedIds, prompt, mode, executeFn);
      onRun?.(selectedIds, prompt, mode);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'ready': return '●';
      case 'running': return '⟳';
      case 'idle': return '○';
      case 'done': return '✓';
      case 'error': return '✗';
    }
  };

  const getStatusClass = (status: Agent['status']) => {
    return `status-${status}`;
  };

  // If external agents are provided, render compact status view
  if (externalAgents) {
    return (
      <div className="multi-agent-panel compact">
        <div className="agent-status-bar">
          {isActive && (
            <div className="agent-chips">
              {displayAgents.map((agent: any) => {
                const agentId = agent.id || agent.name;
                const isSelected = selectedIds.includes(agentId);
                return (
                  <div
                    key={agentId}
                    className={`agent-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAgent(agentId)}
                  >
                    <span className="agent-name">{agent.name}</span>
                    {isSelected && <span className="check">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
          {isRunning && currentAgentName && (
            <div className="running-indicator">
              <span className="spinner">⟳</span>
              <span>Running: {currentAgentName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full panel view for standalone use
  return (
    <div className="multi-agent-panel">
      <div className="panel-header">
        <h3>Multi-Agent Orchestration</h3>
        <div className="agent-count">
          {selectedIds.length} selected
        </div>
      </div>

      <div className="mode-selector">
        <label>Mode:</label>
        <div className="mode-buttons">
          {(['parallel', 'sequential', 'collaborative', 'orchestrator'] as OrchestrationMode[]).map(m => (
            <button
              key={m}
              className={`mode-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="agent-list">
        {displayAgents.map((agent: any) => {
          const agentId = agent.id || agent.name;
          const agentStatus = (agent as Agent).status || 'idle';
          const agentModel = (agent as Agent).model || agent.model;
          return (
            <div
              key={agentId}
              className={`agent-chip ${selectedIds.includes(agentId) ? 'selected' : ''}`}
              onClick={() => toggleAgent(agentId)}
            >
              <span className={`status-icon ${getStatusClass(agentStatus as Agent['status'])}`}>
                {getStatusIcon(agentStatus as Agent['status'])}
              </span>
              <span className="agent-name">{agent.name}</span>
              {agentModel && <span className="agent-model">{agentModel}</span>}
            </div>
          );
        })}
      </div>

      <div className="prompt-input">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt for the agents..."
          rows={3}
        />
      </div>

      <div className="panel-actions">
        <button
          className="run-btn"
          onClick={handleRun}
          disabled={selectedIds.length === 0 || !prompt.trim() || isRunning}
        >
          {isRunning ? 'Running...' : `Run (${selectedIds.length})`}
        </button>
      </div>

      <div className="mode-descriptions">
        <details>
          <summary>Mode Info</summary>
          <div className="mode-info">
            <strong>Parallel:</strong> All agents run simultaneously
            <strong>Sequential:</strong> Agents run one after another
            <strong>Collaborative:</strong> Agents share context
            <strong>Orchestrator:</strong> Lead agent coordinates others
          </div>
        </details>
      </div>
    </div>
  );
};

export default MultiAgentPanel;