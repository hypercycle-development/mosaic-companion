/**
 * Agent Roster Component
 * Compact agent selection with status indicators
 */

import React from 'react';
import { Check, Loader2, AlertCircle, Clock } from 'lucide-react';
import { PROVIDER_INFO } from '../../types/ai';

interface Agent {
  id: string;
  name: string;
  model: string;
  provider: string;
}

interface AgentRosterProps {
  agents: Agent[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  taskStatus?: Map<string, 'pending' | 'running' | 'completed' | 'error'>;
}

export const AgentRoster: React.FC<AgentRosterProps> = ({
  agents,
  selectedIds,
  onToggle,
  disabled = false,
  taskStatus = new Map()
}) => {
  const getStatusIcon = (agentId: string, isSelected: boolean) => {
    const status = taskStatus.get(agentId);
    
    if (status === 'running') {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />;
    }
    if (status === 'completed') {
      return <Check className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (status === 'error') {
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    }
    if (status === 'pending') {
      return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
    if (isSelected) {
      return <Check className="w-3.5 h-3.5 text-indigo-400" />;
    }
    return null;
  };

  const getProviderColor = (provider: string) => {
    return PROVIDER_INFO[provider]?.color || '#6B7280';
  };

  return (
    <div className="agent-roster">
      <div className="roster-grid">
        {agents.map(agent => {
          const isSelected = selectedIds.includes(agent.id);
          const status = taskStatus.get(agent.id);
          const isRunning = status === 'running';
          const providerColor = getProviderColor(agent.provider);

          return (
            <button
              key={agent.id}
              className={`agent-chip ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''}`}
              onClick={() => onToggle(agent.id)}
              disabled={disabled || isRunning}
              style={{
                '--provider-color': providerColor
              } as React.CSSProperties}
            >
              <div className="chip-left">
                <div 
                  className="provider-dot"
                  style={{ backgroundColor: providerColor }}
                />
                <span className="agent-name">{agent.name}</span>
              </div>
              <div className="chip-right">
                {getStatusIcon(agent.id, isSelected)}
              </div>
            </button>
          );
        })}
      </div>

      <style>{`
        .agent-roster {
          width: 100%;
        }

        .roster-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-height: 120px;
          overflow-y: auto;
          padding: 2px;
        }

        .roster-grid::-webkit-scrollbar {
          width: 4px;
        }

        .roster-grid::-webkit-scrollbar-track {
          background: transparent;
        }

        .roster-grid::-webkit-scrollbar-thumb {
          background: #3b3b4f;
          border-radius: 2px;
        }

        .agent-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 10px;
          background: #12121c;
          border: 1px solid #1e1e2e;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          min-width: 0;
        }

        .agent-chip:hover:not(:disabled) {
          background: #1a1a28;
          border-color: #2a2a3e;
        }

        .agent-chip.selected {
          background: #1e1e2e;
          border-color: var(--provider-color, #4f46e5);
        }

        .agent-chip.running {
          animation: pulse-border 1.5s infinite;
        }

        @keyframes pulse-border {
          0%, 100% { border-color: var(--provider-color, #4f46e5); }
          50% { border-color: transparent; }
        }

        .agent-chip:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chip-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .provider-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .agent-name {
          font-size: 12px;
          font-weight: 500;
          color: #e0e0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chip-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};

export default AgentRoster;