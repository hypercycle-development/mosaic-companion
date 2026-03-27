/**
 * Output Summary Component
 * Displays results from multi-agent execution
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, FileText } from 'lucide-react';
import { AgentTask } from '../../hooks/useMultiAgentOrchestration';

interface OutputSummaryProps {
  tasks: AgentTask[];
  totalDuration?: number;
}

export const OutputSummary: React.FC<OutputSummaryProps> = ({
  tasks,
  totalDuration
}) => {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [copiedTask, setCopiedTask] = useState<string | null>(null);

  if (tasks.length === 0 || tasks.every(t => t.status === 'pending')) {
    return null;
  }

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'error');
  const runningTasks = tasks.filter(t => t.status === 'running');

  const copyToClipboard = (text: string, taskId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTask(taskId);
    setTimeout(() => setCopiedTask(null), 2000);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="output-summary">
      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value success">{completedTasks.length}</span>
          <span className="stat-label">Done</span>
        </div>
        <div className="stat">
          <span className="stat-value running">{runningTasks.length}</span>
          <span className="stat-label">Running</span>
        </div>
        <div className="stat">
          <span className="stat-value error">{failedTasks.length}</span>
          <span className="stat-label">Failed</span>
        </div>
        {totalDuration && (
          <div className="stat">
            <span className="stat-value">{formatDuration(totalDuration)}</span>
            <span className="stat-label">Total</span>
        </div>
        )}
      </div>

      {/* Task Outputs */}
      <div className="output-list">
        {tasks.filter(t => t.result || t.error).map(task => (
          <div
            key={task.id}
            className={`output-item ${task.status}`}
          >
            <button
              className="output-header"
              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
            >
              <div className="header-left">
                <FileText className="w-3.5 h-3.5" />
                <span className="agent-name">{task.agentName}</span>
                <span className={`status-badge ${task.status}`}>
                  {task.status}
                </span>
              </div>
              <div className="header-right">
                {task.endTime && task.startTime && (
                  <span className="duration">
                    {formatDuration(task.endTime - task.startTime)}
                  </span>
                )}
                {expandedTask === task.id ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {expandedTask === task.id && (
              <div className="output-content">
                {task.result && (
                  <>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(task.result!, task.id)}
                    >
                      {copiedTask === task.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <pre className="result-text">{task.result}</pre>
                  </>
                )}
                {task.error && (
                  <div className="error-text">{task.error}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .output-summary {
          margin-top: 10px;
          border-top: 1px solid #1e1e2e;
          padding-top: 10px;
        }

        /* Summary Stats */
        .summary-stats {
          display: flex;
          gap: 12px;
          margin-bottom: 10px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #e0e0e0;
          font-variant-numeric: tabular-nums;
        }

        .stat-value.success { color: #22c55e; }
        .stat-value.running { color: #818cf8; }
        .stat-value.error { color: #ef4444; }

        .stat-label {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
        }

        /* Output List */
        .output-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 200px;
          overflow-y: auto;
        }

        .output-item {
          background: #0c0c14;
          border: 1px solid #1e1e2e;
          border-radius: 6px;
          overflow: hidden;
        }

        .output-item.completed { border-left: 2px solid #22c55e; }
        .output-item.error { border-left: 2px solid #ef4444; }
        .output-item.running { border-left: 2px solid #818cf8; }

        .output-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 10px;
          background: transparent;
          border: none;
          color: #e0e0e0;
          cursor: pointer;
          text-align: left;
        }

        .output-header:hover {
          background: #12121c;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .agent-name {
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge {
          font-size: 9px;
          padding: 1px 4px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .status-badge.completed { background: #22c55e20; color: #22c55e; }
        .status-badge.error { background: #ef444420; color: #ef4444; }
        .status-badge.running { background: #818cf820; color: #818cf8; }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
        }

        .duration {
          font-size: 10px;
          font-variant-numeric: tabular-nums;
        }

        .output-content {
          position: relative;
          padding: 10px;
          border-top: 1px solid #1e1e2e;
          background: #08080d;
        }

        .copy-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px;
          background: #1e1e2e;
          border: none;
          border-radius: 4px;
          color: #9ca3af;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .output-content:hover .copy-btn {
          opacity: 1;
        }

        .copy-btn:hover {
          background: #2a2a3e;
          color: #e0e0e0;
        }

        .result-text {
          font-size: 11px;
          line-height: 1.5;
          color: #9ca3af;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
          max-height: 150px;
          overflow-y: auto;
        }

        .error-text {
          font-size: 11px;
          color: #f87171;
        }
      `}</style>
    </div>
  );
};

export default OutputSummary;