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

interface MultiAgentPanelProps {
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode) => void;
  onCollapse?: () => void;
  initialSelected?: string[];
}

export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  onRun,
  onCollapse,
  initialSelected = []
}) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [mode, setMode] = useState<OrchestrationMode>('parallel');
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Load real agents from API
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const realAgents = await window.electronAPI.aiAgents.get();
        const activeAgents = realAgents.filter((a: any) => a.isActive !== false);
        
        const mappedAgents: Agent[] = activeAgents.map((a: any) => ({
          id: a.id,
          name: a.name,
          role: a.role || a.description || 'Agent',
          status: 'ready' as const,
          model: a.model
        }));
        
        setAgents(mappedAgents);
      } catch (e) {
        console.error('Failed to load agents:', e);
        setAgents(multiAgentService.getAgents());
      }
    };
    loadAgents();
  }, []);

  useEffect(() => {
    multiAgentService.addListener((state: MultiAgentState) => {
      setIsRunning(state.isRunning);
    });
    return () => multiAgentService.removeListener(() => {});
  }, []);

  const toggleAgent = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
      multiAgentService.deselectAgent(id);
    } else {
      setSelectedIds([...selectedIds, id]);
      multiAgentService.selectAgent(id);
    }
  };

  const handleRun = async () => {
    if (selectedIds.length === 0 || !prompt.trim()) return;

    setIsRunning(true);
    setIsExpanded(false); // Collapse locally to show running indicator
    
    // Notify parent to collapse the panel
    onCollapse?.();
    
    // Mark selected agents as running
    selectedIds.forEach(id => {
      const agent = agents.find(a => a.id === id);
      if (agent) {
        agent.status = 'running';
      }
    });
    setAgents([...agents]);

    try {
      const executeFn = async (agentId: string, prompt: string): Promise<string> => {
        const agent = agents.find(a => a.id === agentId);
        try {
          const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: agent?.model || 'llama3',
              prompt: prompt,
              stream: false
            })
          });
          const data = await response.json();
          return data.response || `Response from ${agent?.name}`;
        } catch (e) {
          return `Error from ${agent?.name}: ${e}`;
        }
      };

      await multiAgentService.runOrchestration(selectedIds, prompt, mode, executeFn);
      onRun?.(selectedIds, prompt, mode);
    } finally {
      setIsRunning(false);
      setAgents(agents.map(a => ({
        ...a,
        status: selectedIds.includes(a.id) ? 'done' as const : a.status
      })));
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

  return (
    <div className="multi-agent-panel">
      {/* Collapsed state: Show green running indicator */}
      {!isExpanded && (
        <div className="running-indicator" onClick={() => setIsExpanded(true)}>
          <span className="green-light"></span>
          <span className="indicator-text">
            Multi-Agent Running ({selectedIds.length} agents)
          </span>
          <span className="expand-hint">Click to expand</span>
        </div>
      )}

      {/* Expanded state: Show full configuration */}
      {isExpanded && (
        <>
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
            {agents.map(agent => (
              <div
                key={agent.id}
                className={`agent-chip ${selectedIds.includes(agent.id) ? 'selected' : ''}`}
                onClick={() => toggleAgent(agent.id)}
              >
                <span className={`status-icon ${getStatusClass(agent.status)}`}>
                  {getStatusIcon(agent.status)}
                </span>
                <span className="agent-name">{agent.name}</span>
                <span className="agent-role">{agent.role}</span>
                {agent.model && <span className="agent-model">{agent.model}</span>}
              </div>
            ))}
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
        </>
      )}
    </div>
  );
};

export default MultiAgentPanel;