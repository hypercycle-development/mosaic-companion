/**
 * Multi-Agent Panel - Production-Ready Orchestration Control Tower
 * Compact, clean, native-feeling multi-agent workflow management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Users,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Bot,
  X,
  Workflow,
  Clock,
  Zap,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export type OrchestrationMode = 'parallel' | 'sequential' | 'collaborative' | 'orchestrator';

export interface Agent {
  id: string;
  name: string;
  role?: string;
  status?: AgentStatus;
  model?: string;
}

/** Extended agent with all required fields */
export interface AgentWithStatus extends Agent {
  role: string;
  status: AgentStatus;
}

/** Convert app's AIAgentConfig to panel's Agent type */
export const toPanelAgent = (agent: { id: string; name: string; model?: string; description?: string; role?: string; isActive?: boolean }): AgentWithStatus => ({
  id: agent.id,
  name: agent.name,
  role: agent.role || agent.description || 'Agent',
  status: 'ready',
  model: agent.model,
});

export type AgentStatus = 'idle' | 'ready' | 'running' | 'done' | 'error';

export interface MultiAgentPanelProps {
  /** Callback when user clicks Run */
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode) => void;
  /** Callback when panel should collapse */
  onCollapse?: () => void;
  /** Pre-selected agent IDs */
  initialSelected?: string[];
  /** Available agents */
  agents?: Agent[];
}

// =============================================================================
// Constants
// =============================================================================

const MODE_INFO: Record<OrchestrationMode, { label: string; description: string }> = {
  parallel: { label: 'Parallel', description: 'All agents run simultaneously' },
  sequential: { label: 'Sequential', description: 'Agents run one after another' },
  collaborative: { label: 'Collaborative', description: 'Agents share context' },
  orchestrator: { label: 'Orchestrator', description: 'Lead agent coordinates others' },
};

const MAX_VISIBLE_AGENTS = 6;

// =============================================================================
// Helper Components
// =============================================================================

/** Compact status indicator */
const StatusDot = ({ status, size = 'sm' }: { status: AgentStatus; size?: 'sm' | 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const colors: Record<AgentStatus, string> = {
    idle: 'bg-gray-500',
    ready: 'bg-emerald-500',
    running: 'bg-amber-500 animate-pulse',
    done: 'bg-emerald-400',
    error: 'bg-red-500',
  };
  return <span className={`${sizeClass} rounded-full ${colors[status]}`} />;
};

/** Mode button */
const ModeButton = ({
  mode,
  active,
  onClick,
}: {
  mode: OrchestrationMode;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`
      px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
      ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
      }
    `}
  >
    {MODE_INFO[mode].label}
  </button>
);

// =============================================================================
// Main Component
// =============================================================================

export const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({
  onRun,
  onCollapse,
  initialSelected = [],
  agents: externalAgents,
}) => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [internalAgents, setInternalAgents] = useState<Agent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
  const [mode, setMode] = useState<OrchestrationMode>(() => {
    // Load persisted mode from localStorage
    const saved = localStorage.getItem('multiAgentMode');
    return (saved as OrchestrationMode) || 'parallel';
  });
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showModeInfo, setShowModeInfo] = useState(false);

  // Persist mode choice to localStorage
  useEffect(() => {
    localStorage.setItem('multiAgentMode', mode);
  }, [mode]);

  // Use external agents if provided, otherwise use internal
  const agents = externalAgents?.length ? externalAgents : internalAgents;

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load agents from API
  useEffect(() => {
    if (externalAgents?.length) return; // Skip if external agents provided

    const loadAgents = async () => {
      try {
        const realAgents = await window.electronAPI.aiAgents.get();
        const activeAgents = realAgents.filter((a: any) => a.isActive !== false);

        const mapped: Agent[] = activeAgents.map((a: any) => ({
          id: a.id,
          name: a.name,
          role: a.role || a.description || 'Agent',
          status: 'ready' as const,
          model: a.model,
        }));

        setInternalAgents(mapped);
      } catch (e) {
        console.error('[MultiAgentPanel] Failed to load agents:', e);
        // Fallback to empty - will show empty state
        setInternalAgents([]);
      }
    };

    loadAgents();
  }, [externalAgents]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleAgent = useCallback((id: string) => {
    if (isRunning) return; // Prevent changes while running

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, [isRunning]);

  const handleRun = useCallback(async () => {
    if (selectedIds.length === 0 || !prompt.trim() || isRunning) return;

    setIsRunning(true);
    onCollapse?.();

    try {
      onRun?.(selectedIds, prompt.trim(), mode);
    } finally {
      // Keep running state until parent updates
      setTimeout(() => setIsRunning(false), 1500);
    }
  }, [selectedIds, prompt, isRunning, mode, onRun, onCollapse]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const selectedAgents = agents.filter((a) => selectedIds.includes(a.id));
  const canRun = selectedIds.length > 0 && prompt.trim() && !isRunning;
  const hasAgents = agents.length > 0;
  const showMoreAgents = agents.length > MAX_VISIBLE_AGENTS;

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
      <Bot size={32} className="mb-3 opacity-50" />
      <p className="text-sm">No agents available</p>
      <p className="text-xs mt-1 opacity-70">Configure agents in Settings to get started</p>
    </div>
  );

  const renderAgentChip = (agent: Agent, isSelected: boolean) => (
    <button
      key={agent.id}
      onClick={() => toggleAgent(agent.id)}
      disabled={isRunning}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-150
        ${
          isSelected
            ? 'bg-indigo-900/40 border border-indigo-500/50 text-indigo-100'
            : 'bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:bg-gray-700/50'
        }
        ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <StatusDot status={agent.status} size="md" />
      <span className="text-sm font-medium truncate max-w-[120px]">{agent.name}</span>
      {isSelected && <CheckCircle2 size={14} className="text-indigo-400 ml-auto" />}
    </button>
  );

  const renderRunningIndicator = () => (
    <div
      onClick={() => setIsExpanded(true)}
      className="flex items-center gap-3 px-4 py-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg cursor-pointer hover:bg-emerald-900/30 transition-colors"
    >
      <Loader2 size={16} className="text-emerald-400 animate-spin" />
      <div className="flex-1">
        <span className="text-sm font-medium text-emerald-100">
          Running {selectedIds.length} agents
        </span>
        <span className="text-xs text-emerald-400/70 ml-2 capitalize">{mode}</span>
      </div>
      <ChevronDown size={14} className="text-emerald-400/70" />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm">
      {/* Collapsed Running State */}
      {!isExpanded && isRunning && renderRunningIndicator()}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow size={18} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-gray-100">Multi-Agent Control</h3>
              {selectedIds.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-indigo-600/20 text-indigo-300 rounded-full">
                  {selectedIds.length}
                </span>
              )}
            </div>
            <button
              onClick={onCollapse}
              className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              title="Collapse"
            >
              <ChevronDown size={16} className="rotate-180" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Orchestration Mode
              </span>
              <button
                onClick={() => setShowModeInfo(!showModeInfo)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <Zap size={12} />
                Info
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODE_INFO) as OrchestrationMode[]).map((m) => (
                <ModeButton key={m} mode={m} active={mode === m} onClick={() => setMode(m)} />
              ))}
            </div>
            {showModeInfo && (
              <div className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3">
                {MODE_INFO[mode].description}
              </div>
            )}
          </div>

          {/* Agent Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Select Agents
              </span>
              {selectedIds.length > 0 && (
                <button
                  onClick={clearSelection}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>

            {!hasAgents ? (
              renderEmptyState()
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {agents.slice(0, MAX_VISIBLE_AGENTS).map((agent) =>
                  renderAgentChip(agent, selectedIds.includes(agent.id))
                )}
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agents do?"
              disabled={isRunning}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:opacity-50"
            />
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={!canRun}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200
              ${
                canRun
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-[1.02] shadow-lg shadow-indigo-500/20'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play size={16} />
                Run {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiAgentPanel;