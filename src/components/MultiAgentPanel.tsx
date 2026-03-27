/**
 * Multi-Agent Orchestration Panel
 * Production-ready control tower for multi-agent workflows
 * 
 * Features:
 * - Compact bounded panel
 * - Collapsible header
 * - Agent roster with status
 * - Activity feed
 * - Output summary
 * - All orchestration modes
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Users, Sparkles } from 'lucide-react';
import { AgentRoster, ActivityFeed, OrchestrationControls, OutputSummary } from './multi-agent';
import { useMultiAgentOrchestration, OrchestrationMode, AgentTask } from '../hooks/useMultiAgentOrchestration';
import { AIAgentConfig } from '../types/ai';

interface MultiAgentPanelProps {
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode, results: AgentTask[]) => void;
  onCollapse?: () => void;
  initialSelected?: string[];
  initialMode?: OrchestrationMode;
  initialPrompt?: string;
}

export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  onRun,
  onCollapse,
  initialSelected = [],
  initialMode = 'parallel',
  initialPrompt = ''
}) => {
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [isExpanded, setIsExpanded] = useState(true);
  const [prompt, setPrompt] = useState(initialPrompt);

  const { state, setMode, run, abort, reset } = useMultiAgentOrchestration();

  // Load agents from API
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const loadedAgents = await window.electronAPI.aiAgents.get();
        const activeAgents = loadedAgents.filter((a: AIAgentConfig) => a.isActive !== false);
        setAgents(activeAgents);
        
        // Auto-select first agents if none selected
        if (selectedIds.length === 0 && activeAgents.length > 0) {
          setSelectedIds([activeAgents[0].id]);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    };
    loadAgents();
  }, []);

  // Set initial mode
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, setMode]);

  const toggleAgent = (id: string) => {
    if (state.isRunning) return;
    
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRun = async () => {
    if (selectedIds.length === 0 || !prompt.trim()) return;

    const selectedAgents = agents.filter(a => selectedIds.includes(a.id));
    
    const result = await run(selectedAgents, prompt);
    
    if (onRun) {
      onRun(selectedIds, prompt, state.mode, result.tasks);
    }
  };

  const handleAbort = () => {
    abort();
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    onCollapse?.();
  };

  const getTaskStatusMap = () => {
    const map = new Map<string, AgentTask['status']>();
    state.tasks.forEach(task => {
      map.set(task.agentId, task.status);
    });
    return map;
  };

  // Collapsed state - running indicator
  if (!isExpanded) {
    return (
      <div className="multi-agent-panel collapsed" onClick={() => setIsExpanded(true)}>
        <div className="collapsed-header">
          {state.isRunning ? (
            <>
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="running-text">
                Running {state.currentAgentId ? `(${state.currentAgentId.split('-').pop()})` : ''}
              </span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              <span className="idle-text">
                {selectedIds.length} agent{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
            </>
          )}
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </div>

        <style>{`
          .multi-agent-panel.collapsed {
            padding: 8px 12px;
            background: #12121c;
            border: 1px solid #1e1e2e;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .multi-agent-panel.collapsed:hover {
            background: #1a1a28;
            border-color: #2a2a3e;
          }

          .collapsed-header {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #9ca3af;
          }

          .running-text {
            color: #818cf8;
          }

          .idle-text {
            color: #9ca3af;
          }
        `}</style>
      </div>
    );
  }

  // Expanded state - full panel
  return (
    <div className="multi-agent-panel expanded">
      {/* Header */}
      <div className="panel-header">
        <div className="header-left">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="panel-title">Multi-Agent</span>
          {state.isRunning && (
            <span className="running-badge">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Running
            </span>
          )}
        </div>
        <button className="collapse-btn" onClick={handleCollapse}>
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Agent Roster */}
      <div className="panel-section">
        <div className="section-label">
          <span>Agents</span>
          <span className="count">{selectedIds.length}/{agents.length}</span>
        </div>
        <AgentRoster
          agents={agents.map(a => ({ id: a.id, name: a.name, model: a.model, provider: a.provider }))}
          selectedIds={selectedIds}
          onToggle={toggleAgent}
          disabled={state.isRunning}
          taskStatus={getTaskStatusMap()}
        />
      </div>

      {/* Orchestration Controls */}
      <div className="panel-section">
        <OrchestrationControls
          mode={state.mode}
          onModeChange={setMode}
          prompt={prompt}
          onPromptChange={setPrompt}
          onRun={handleRun}
          onAbort={handleAbort}
          isRunning={state.isRunning}
          selectedCount={selectedIds.length}
          disabled={selectedIds.length === 0}
        />
      </div>

      {/* Activity Feed (when running) */}
      {state.tasks.length > 0 && (
        <div className="panel-section">
          <ActivityFeed
            tasks={state.tasks}
            isRunning={state.isRunning}
          />
        </div>
      )}

      {/* Output Summary (when completed) */}
      {!state.isRunning && state.tasks.some(t => t.result || t.error) && (
        <div className="panel-section">
          <OutputSummary
            tasks={state.tasks}
          />
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="panel-error">
          <span className="error-text">{state.error}</span>
        </div>
      )}

      <style>{`
        .multi-agent-panel.expanded {
          background: #0c0c14;
          border: 1px solid #1e1e2e;
          border-radius: 10px;
          overflow: hidden;
        }

        /* Header */
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: #12121c;
          border-bottom: 1px solid #1e1e2e;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-title {
          font-size: 13px;
          font-weight: 600;
          color: #e0e0e0;
        }

        .running-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #4f46e520;
          color: #818cf8;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }

        .collapse-btn {
          padding: 4px;
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
        }

        .collapse-btn:hover {
          background: #1e1e2e;
          color: #9ca3af;
        }

        /* Sections */
        .panel-section {
          padding: 10px 12px;
          border-bottom: 1px solid #1e1e2e;
        }

        .panel-section:last-child {
          border-bottom: none;
        }

        .section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
        }

        .count {
          font-weight: 500;
          color: #9ca3af;
        }

        /* Error */
        .panel-error {
          padding: 8px 12px;
          background: #ef444410;
          border-bottom: 1px solid #1e1e2e;
        }

        .error-text {
          font-size: 11px;
          color: #f87171;
        }
      `}</style>
    </div>
  );
};

export default MultiAgentPanel;