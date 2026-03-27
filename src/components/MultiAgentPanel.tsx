/**
 * Multi-Agent Panel Component
 * Agent selection, status, and orchestration controls
 * 
 * Integrates with ChatView for actual multi-agent execution
 */

import React, { useState, useEffect } from 'react';
import { 
  Users,
  Play,
  Pause,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { 
  multiAgentService, 
  Agent, 
  OrchestrationMode,
  MultiAgentState 
} from '../services/MultiAgentService';
import { AIAgentConfig, PROVIDER_INFO } from '../types/ai';

interface MultiAgentResult {
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  content?: string;
  error?: string;
}

interface MultiAgentPanelProps {
  agents: AIAgentConfig[];
  selectedAgentIds?: string[];
  orchestrationMode?: OrchestrationMode;
  isActive?: boolean;
  isRunning?: boolean;
  currentAgentName?: string;
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode) => Promise<void>;
  onToggle?: () => void;
  prompt?: string;
}

export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  agents,
  selectedAgentIds = [],
  orchestrationMode: externalMode = 'parallel',
  isActive = false,
  isRunning: externalRunning = false,
  currentAgentName = '',
  onRun,
  onToggle,
  prompt = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedAgentIds);
  const [mode, setMode] = useState<OrchestrationMode>(externalMode);
  const [isRunning, setIsRunning] = useState(externalRunning);
  const [results, setResults] = useState<MultiAgentResult[]>([]);

  // Filter to only active agents
  const activeAgents = agents.filter(a => a.isActive);

  useEffect(() => {
    // Auto-select first 2 active agents if none selected
    if (selectedIds.length === 0 && activeAgents.length >= 2) {
      setSelectedIds([activeAgents[0].id, activeAgents[1].id]);
    }
  }, [activeAgents]);

  const toggleAgent = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(activeAgents.map(a => a.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleRun = async () => {
    if (selectedIds.length === 0 || !prompt.trim() || !onRun) return;
    
    setIsRunning(true);
    setResults(selectedIds.map(id => ({
      agentId: id,
      agentName: agents.find(a => a.id === id)?.name || id,
      status: 'pending'
    })));

    try {
      await onRun(selectedIds, prompt, mode);
    } finally {
      setIsRunning(false);
    }
  };

  const getProviderColor = (provider: string) => {
    return PROVIDER_INFO[provider]?.color || '#6B7280';
  };

  const modeDescriptions: Record<OrchestrationMode, string> = {
    parallel: 'All agents respond simultaneously',
    sequential: 'Agents respond one after another',
    collaborative: 'Agents share context between responses',
    orchestrator: 'Lead agent coordinates the others'
  };

  return (
    <div className="multi-agent-panel-wrapper">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="multi-agent-toggle"
      >
        <div className="toggle-left">
          <Users className="w-4 h-4" />
          <span className="toggle-label">Multi-Agent</span>
          {selectedIds.length > 0 && (
            <span className="agent-count">{selectedIds.length}</span>
          )}
        </div>
        <div className="toggle-right">
          {isRunning && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="multi-agent-expanded">
          {/* Mode Selector */}
          <div className="mode-section">
            <label className="section-label">Orchestration</label>
            <div className="mode-buttons">
              {(['parallel', 'sequential', 'collaborative', 'orchestrator'] as OrchestrationMode[]).map(m => (
                <button
                  key={m}
                  className={`mode-btn ${mode === m ? 'active' : ''}`}
                  onClick={() => setMode(m)}
                  disabled={isRunning}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p className="mode-description">{modeDescriptions[mode]}</p>
          </div>

          {/* Agent Selection */}
          <div className="agents-section">
            <div className="section-header">
              <label className="section-label">Select Agents</label>
              <div className="selection-actions">
                <button onClick={selectAll} className="select-btn">All</button>
                <button onClick={deselectAll} className="select-btn">None</button>
              </div>
            </div>
            <div className="agent-grid">
              {activeAgents.map(agent => {
                const isSelected = selectedIds.includes(agent.id);
                const providerColor = getProviderColor(agent.provider);
                
                return (
                  <button
                    key={agent.id}
                    className={`agent-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleAgent(agent.id)}
                    disabled={isRunning}
                    style={{
                      borderColor: isSelected ? providerColor : undefined,
                      boxShadow: isSelected ? `0 0 0 1px ${providerColor}40` : undefined
                    }}
                  >
                    <div 
                      className="agent-status-dot"
                      style={{ backgroundColor: providerColor }}
                    />
                    <span className="agent-name">{agent.name}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Agents Summary */}
          {selectedIds.length > 0 && (
            <div className="selected-summary">
              <div className="summary-label">
                {selectedIds.length} agent{selectedIds.length > 1 ? 's' : ''} selected
              </div>
              <div className="selected-chips">
                {selectedIds.map(id => {
                  const agent = agents.find(a => a.id === id);
                  if (!agent) return null;
                  return (
                    <span 
                      key={id} 
                      className="selected-chip"
                      style={{ 
                        borderColor: getProviderColor(agent.provider),
                        backgroundColor: `${getProviderColor(agent.provider)}15`
                      }}
                    >
                      {agent.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results Preview */}
          {results.length > 0 && (
            <div className="results-section">
              <label className="section-label">Results</label>
              <div className="results-list">
                {results.map(result => (
                  <div key={result.agentId} className={`result-item ${result.status}`}>
                    <div className="result-header">
                      <span className="result-agent">{result.agentName}</span>
                      <span className="result-status">
                        {result.status === 'pending' && 'Waiting...'}
                        {result.status === 'running' && (
                          <><Loader2 className="w-3 h-3 animate-spin inline" /> Running</>
                        )}
                        {result.status === 'completed' && 'Done'}
                        {result.status === 'error' && 'Error'}
                      </span>
                    </div>
                    {result.content && (
                      <div className="result-content">{result.content}</div>
                    )}
                    {result.error && (
                      <div className="result-error">{result.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .multi-agent-panel-wrapper {
          width: 100%;
        }

        /* Toggle Button */
        .multi-agent-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 8px;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s;
        }

        .multi-agent-toggle:hover {
          background: #1e1e2e;
          border-color: #3a3a4e;
          color: #e0e0e0;
        }

        .toggle-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toggle-label {
          font-size: 12px;
          font-weight: 500;
        }

        .agent-count {
          background: #4f46e5;
          color: white;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 600;
        }

        .toggle-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Expanded Panel */
        .multi-agent-expanded {
          margin-top: 8px;
          padding: 12px;
          background: #0c0c14;
          border: 1px solid #2a2a3e;
          border-radius: 8px;
        }

        /* Sections */
        .mode-section,
        .agents-section,
        .selected-summary,
        .results-section {
          margin-bottom: 12px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          margin-bottom: 6px;
          display: block;
        }

        .selection-actions {
          display: flex;
          gap: 4px;
        }

        .select-btn {
          padding: 2px 6px;
          font-size: 10px;
          background: #1e1e2e;
          border: 1px solid #2a2a3e;
          border-radius: 4px;
          color: #9ca3af;
          cursor: pointer;
        }

        .select-btn:hover {
          background: #2a2a3e;
          color: #e0e0e0;
        }

        /* Mode Buttons */
        .mode-buttons {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .mode-btn {
          padding: 4px 10px;
          font-size: 11px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 4px;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-btn:hover:not(:disabled) {
          background: #1e1e2e;
          color: #e0e0e0;
        }

        .mode-btn.active {
          background: #4f46e5;
          border-color: #4f46e5;
          color: white;
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-description {
          font-size: 10px;
          color: #6b7280;
          margin-top: 4px;
        }

        /* Agent Grid */
        .agent-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .agent-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .agent-chip:hover:not(:disabled) {
          background: #1e1e2e;
          border-color: #3a3a4e;
        }

        .agent-chip.selected {
          background: #1e1e2e;
          border-color: #4f46e5;
        }

        .agent-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .agent-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .agent-name {
          font-size: 12px;
          color: #e0e0e0;
        }

        /* Selected Summary */
        .selected-summary {
          padding: 8px;
          background: #12121a;
          border-radius: 6px;
        }

        .summary-label {
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 6px;
        }

        .selected-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .selected-chip {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid;
        }

        /* Results */
        .results-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .result-item {
          padding: 8px;
          background: #16161e;
          border-radius: 6px;
          border: 1px solid #2a2a3e;
        }

        .result-item.running {
          border-color: #4f46e5;
        }

        .result-item.completed {
          border-color: #22c55e;
        }

        .result-item.error {
          border-color: #ef4444;
        }

        .result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .result-agent {
          font-size: 11px;
          font-weight: 500;
          color: #e0e0e0;
        }

        .result-status {
          font-size: 10px;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .result-content {
          margin-top: 6px;
          font-size: 11px;
          color: #9ca3af;
          max-height: 60px;
          overflow: hidden;
        }

        .result-error {
          margin-top: 6px;
          font-size: 11px;
          color: #f87171;
        }

        @media (max-width: 640px) {
          .agent-grid {
            flex-direction: column;
          }

          .mode-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default MultiAgentPanel;