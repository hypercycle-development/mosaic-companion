/**
 * Multi-Agent Plugin - Renderer
 * React component for multi-agent orchestration
 */

import React, { useState, useEffect } from 'react';
import { Users, Play, Pause, RefreshCw } from 'lucide-react';

type OrchestrationMode = 'parallel' | 'sequential' | 'collaborative' | 'orchestrator';

export function MultiAgentView() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [mode, setMode] = useState<OrchestrationMode>('parallel');
  const [isRunning, setIsRunning] = useState(false);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    if (window.electronAPI?.multiagent) {
      const result = await window.electronAPI.multiagent['get-agents']();
      if (result) setAgents(result);
    }
  };

  const toggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      setSelectedAgents(selectedAgents.filter(id => id !== agentId));
    } else {
      setSelectedAgents([...selectedAgents, agentId]);
    }
  };

  const handleRun = async () => {
    if (selectedAgents.length === 0 || !prompt.trim()) return;
    
    setIsRunning(true);
    try {
      console.log('[MultiAgent] Running:', { agents: selectedAgents, mode, prompt });
      // Call orchestration API
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="multi-agent-panel">
      <div className="panel-header">
        <h3><Users size={20} /> Multi-Agent Orchestration</h3>
        <span className="agent-count">{selectedAgents.length} selected</span>
      </div>

      <div className="mode-selector">
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

      <div className="agent-list">
        {agents.map(agent => (
          <div
            key={agent.id}
            className={`agent-chip ${selectedAgents.includes(agent.id) ? 'selected' : ''}`}
            onClick={() => toggleAgent(agent.id)}
          >
            <span className="name">{agent.name}</span>
            <span className="model">{agent.model}</span>
          </div>
        ))}
      </div>

      <textarea
        className="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt for the agents..."
        rows={4}
      />

      <button
        className="run-btn"
        onClick={handleRun}
        disabled={selectedAgents.length === 0 || !prompt.trim() || isRunning}
      >
        {isRunning ? <><RefreshCw className="spinning" size={16} /> Running...</> : <><Play size={16} /> Run ({selectedAgents.length})</>}
      </button>

      <style>{`
        .multi-agent-panel { padding: 20px; background: #1a1a2e; border-radius: 12px; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .agent-count { background: #333; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
        .mode-selector { display: flex; gap: 8px; margin-bottom: 16px; }
        .mode-btn { padding: 6px 12px; background: #333; border: none; border-radius: 6px; color: #fff; cursor: pointer; }
        .mode-btn.active { background: #7c3aed; }
        .agent-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .agent-chip { padding: 8px 12px; background: #333; border-radius: 16px; cursor: pointer; }
        .agent-chip.selected { background: #7c3aed; }
        .prompt-input { width: 100%; background: #0d0d1a; border: 1px solid #333; border-radius: 8px; padding: 12px; color: #fff; resize: vertical; }
        .run-btn { width: 100%; padding: 12px; background: #7c3aed; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .run-btn:disabled { opacity: 0.5; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default MultiAgentView;