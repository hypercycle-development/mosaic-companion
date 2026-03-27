/**
 * Activity Feed Component
 * Real-time task progress display
 */

import React from 'react';
import { Check, Loader2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { AgentTask } from '../../hooks/useMultiAgentOrchestration';

interface ActivityFeedProps {
  tasks: AgentTask[];
  isRunning: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  tasks,
  isRunning
}) => {
  if (tasks.length === 0) {
    return null;
  }

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />;
      case 'completed':
        return <Check className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: AgentTask['status']) => {
    switch (status) {
      case 'running': return 'border-indigo-500/50 bg-indigo-500/10';
      case 'completed': return 'border-emerald-500/50 bg-emerald-500/10';
      case 'error': return 'border-red-500/50 bg-red-500/10';
      case 'pending': return 'border-gray-700/50 bg-gray-800/50';
    }
  };

  return (
    <div className="activity-feed">
      <div className="feed-header">
        <span className="feed-title">Activity</span>
        {isRunning && (
          <span className="feed-status running">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running...
          </span>
        )}
      </div>
      <div className="feed-list">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            className={`feed-item ${getStatusColor(task.status)}`}
          >
            <div className="item-left">
              {getStatusIcon(task.status)}
              <span className="agent-name">{task.agentName}</span>
            </div>
            {task.status === 'running' && (
              <ChevronRight className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            )}
            {task.status === 'completed' && task.endTime && task.startTime && (
              <span className="duration">
                {((task.endTime - task.startTime) / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .activity-feed {
          background: #0c0c14;
          border-radius: 8px;
          overflow: hidden;
        }

        .feed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid #1e1e2e;
        }

        .feed-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
        }

        .feed-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #9ca3af;
        }

        .feed-status.running {
          color: #818cf8;
        }

        .feed-list {
          max-height: 100px;
          overflow-y: auto;
        }

        .feed-list::-webkit-scrollbar {
          width: 4px;
        }

        .feed-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .feed-list::-webkit-scrollbar-thumb {
          background: #3b3b4f;
          border-radius: 2px;
        }

        .feed-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          border-left: 2px solid;
          transition: all 0.2s;
        }

        .item-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .agent-name {
          font-size: 11px;
          color: #e0e0e0;
        }

        .duration {
          font-size: 10px;
          color: #6b7280;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
};

export default ActivityFeed;