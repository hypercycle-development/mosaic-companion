/**
 * Orchestration Controls Component
 * Mode selector, prompt input, and run controls
 */

import React from 'react';
import { Play, Square, Users, GitBranch, Network, Crown } from 'lucide-react';
import { OrchestrationMode } from '../../hooks/useMultiAgentOrchestration';

interface OrchestrationControlsProps {
  mode: OrchestrationMode;
  onModeChange: (mode: OrchestrationMode) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onRun: () => void;
  onAbort: () => void;
  isRunning: boolean;
  selectedCount: number;
  disabled?: boolean;
}

const MODE_CONFIG: Record<OrchestrationMode, { icon: React.ReactNode; label: string; description: string }> = {
  parallel: {
    icon: <Users className="w-3.5 h-3.5" />,
    label: 'Parallel',
    description: 'All agents respond simultaneously'
  },
  sequential: {
    icon: <GitBranch className="w-3.5 h-3.5" />,
    label: 'Sequential',
    description: 'Agents respond one after another'
  },
  collaborative: {
    icon: <Network className="w-3.5 h-3.5" />,
    label: 'Collaborative',
    description: 'Agents share context between responses'
  },
  orchestrator: {
    icon: <Crown className="w-3.5 h-3.5" />,
    label: 'Orchestrator',
    description: 'Lead agent coordinates the others'
  }
};

export const OrchestrationControls: React.FC<OrchestrationControlsProps> = ({
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  onRun,
  onAbort,
  isRunning,
  selectedCount,
  disabled = false
}) => {
  const canRun = selectedCount > 0 && prompt.trim().length > 0 && !isRunning && !disabled;

  return (
    <div className="orchestration-controls">
      {/* Mode Selector */}
      <div className="mode-section">
        <div className="mode-buttons">
          {(Object.entries(MODE_CONFIG) as [OrchestrationMode, typeof MODE_CONFIG.parallel][]).map(([key, config]) => (
            <button
              key={key}
              className={`mode-btn ${mode === key ? 'active' : ''}`}
              onClick={() => onModeChange(key)}
              disabled={isRunning}
              title={config.description}
            >
              {config.icon}
              <span>{config.label}</span>
            </button>
          ))}
        </div>
        <div className="mode-hint">
          {MODE_CONFIG[mode].description}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="prompt-section">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Enter your prompt for all selected agents..."
          className="prompt-input"
          disabled={isRunning || disabled}
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="action-section">
        {isRunning ? (
          <button
            className="abort-btn"
            onClick={onAbort}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            className="run-btn"
            onClick={onRun}
            disabled={!canRun}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run {selectedCount > 0 ? `(${selectedCount})` : ''}</span>
          </button>
        )}
      </div>

      <style>{`
        .orchestration-controls {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Mode Section */
        .mode-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mode-buttons {
          display: flex;
          gap: 4px;
        }

        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 8px;
          background: #12121c;
          border: 1px solid #1e1e2e;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mode-btn:hover:not(:disabled) {
          background: #1a1a28;
          color: #e0e0e0;
        }

        .mode-btn.active {
          background: #1e1e2e;
          border-color: #4f46e5;
          color: #e0e0e0;
        }

        .mode-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mode-hint {
          font-size: 10px;
          color: #6b7280;
          text-align: center;
        }

        /* Prompt Section */
        .prompt-section {
          display: flex;
        }

        .prompt-input {
          width: 100%;
          padding: 8px 10px;
          background: #0c0c14;
          border: 1px solid #1e1e2e;
          border-radius: 6px;
          color: #e0e0e0;
          font-size: 12px;
          resize: none;
          outline: none;
          transition: border-color 0.15s;
        }

        .prompt-input:focus {
          border-color: #4f46e5;
        }

        .prompt-input::placeholder {
          color: #6b7280;
        }

        .prompt-input:disabled {
          opacity: 0.6;
        }

        /* Action Section */
        .action-section {
          display: flex;
          justify-content: flex-end;
        }

        .run-btn, .abort-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .run-btn {
          background: #4f46e5;
          border: none;
          color: white;
        }

        .run-btn:hover:not(:disabled) {
          background: #4338ca;
        }

        .run-btn:disabled {
          background: #2d2d3d;
          color: #6b7280;
          cursor: not-allowed;
        }

        .abort-btn {
          background: #dc2626;
          border: none;
          color: white;
        }

        .abort-btn:hover {
          background: #b91c1c;
        }
      `}</style>
    </div>
  );
};

export default OrchestrationControls;