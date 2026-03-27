// Multi-Agent Selector Component
// Allows selecting multiple agents and choosing orchestration mode

import React, { useState } from 'react';
import { 
  Users, 
  Layers, 
  GitBranch, 
  Sparkles,
  ChevronDown,
  Check,
  Play,
  Zap
} from 'lucide-react';
import { AIAgentConfig } from '../types/ai';
import { 
  OrchestrationMode, 
  AggregationStrategy
} from '../types/agentOrchestration';

interface MultiAgentSelectorProps {
  agents: AIAgentConfig[];
  selectedAgents: string[];
  onSelectionChange: (agentIds: string[]) => void;
  orchestrationMode: OrchestrationMode;
  onModeChange: (mode: OrchestrationMode) => void;
  aggregationStrategy: AggregationStrategy;
  onAggregationChange: (strategy: AggregationStrategy) => void;
  isOrchestrating: boolean;
  onSave?: () => void;
}

export const MultiAgentSelector: React.FC<MultiAgentSelectorProps> = ({
  agents,
  selectedAgents,
  onSelectionChange,
  orchestrationMode,
  onModeChange,
  aggregationStrategy,
  onAggregationChange,
  isOrchestrating,
  onSave,
}) => {
  const [showAgentList, setShowAgentList] = useState(false);
  const [showModeInfo, setShowModeInfo] = useState(false);

  const activeAgents = agents.filter(a => a.isActive);

  const toggleAgent = (agentId: string) => {
    if (selectedAgents.includes(agentId)) {
      onSelectionChange(selectedAgents.filter(id => id !== agentId));
    } else {
      onSelectionChange([...selectedAgents, agentId]);
    }
  };

  const selectAllAgents = () => {
    onSelectionChange(activeAgents.map(a => a.id));
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const modeIcons: Record<OrchestrationMode, React.ReactNode> = {
    sequential: <Layers className="w-4 h-4" />,
    parallel: <Users className="w-4 h-4" />,
    collaborative: <Sparkles className="w-4 h-4" />,
    orchestrator: <GitBranch className="w-4 h-4" />,
  };

  const modeLabels: Record<OrchestrationMode, string> = {
    sequential: 'Sequential',
    parallel: 'Parallel',
    collaborative: 'Collaborative',
    orchestrator: 'Coordinator',
  };

  const modeDescriptions: Record<OrchestrationMode, string> = {
    sequential: 'Pipeline: Agent 1 → Agent 2 → Agent 3. Each output feeds the next.',
    parallel: 'Team: All agents work simultaneously on the same input. Results combined.',
    collaborative: 'Iterate: Agents build on each other\'s work over multiple rounds.',
    orchestrator: 'Coordinator: One agent delegates and synthesizes results from others.',
  };

  const hasAgents = selectedAgents.length > 0;

  const handleSaveAndRun = () => {
    if (hasAgents && onSave) {
      onSave();
    }
  };

  return (
    <div className="space-y-3">
      {/* Agent Selection */}
      <div className="relative">
        <button
          onClick={() => setShowAgentList(!showAgentList)}
          className="flex items-center justify-between w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-400" />
            <div className="text-left">
              <div className="font-medium text-gray-100">
                {hasAgents 
                  ? `${selectedAgents.length} Agent${selectedAgents.length > 1 ? 's' : ''} Selected`
                  : 'Select Agents'
                }
              </div>
              {hasAgents && (
                <div className="text-xs text-gray-400 truncate max-w-xs">
                  {activeAgents
                    .filter(a => selectedAgents.includes(a.id))
                    .map(a => a.name)
                    .join(', ')}
                </div>
              )}
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAgentList ? 'rotate-180' : ''}`} />
        </button>

        {showAgentList && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50 max-h-64 overflow-y-auto">
            {/* Select All / Clear */}
            <div className="flex gap-2 p-2 border-b border-gray-700">
              <button
                onClick={selectAllAgents}
                className="flex-1 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Agent List */}
            {activeAgents.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No active agents available. Create agents in Settings.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {activeAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      selectedAgents.includes(agent.id)
                        ? 'bg-purple-600/20 border border-purple-500/50'
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedAgents.includes(agent.id)
                        ? 'bg-purple-500 border-purple-500'
                        : 'border-gray-500'
                    }`}>
                      {selectedAgents.includes(agent.id) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-100">{agent.name}</div>
                      <div className="text-xs text-gray-400">
                        {agent.provider} • {agent.model}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint when no agents selected */}
      {!hasAgents && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            Select agents to begin
          </span>
        </div>
      )}

      {/* Orchestration Mode - Show when 2+ agents selected */}
      {hasAgents && selectedAgents.length >= 2 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-400">Orchestration Mode</label>
            <button
              onClick={() => setShowModeInfo(!showModeInfo)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              {showModeInfo ? 'Hide info' : 'Show info'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(modeLabels).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => onModeChange(mode as OrchestrationMode)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  orchestrationMode === mode
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {modeIcons[mode as OrchestrationMode]}
                {label}
              </button>
            ))}
          </div>
          
          {/* Mode Description */}
          {showModeInfo && (
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300">{modeDescriptions[orchestrationMode]}</p>
            </div>
          )}
        </div>
      )}

      {/* Aggregation Strategy - Only for parallel mode */}
      {hasAgents && selectedAgents.length >= 2 && orchestrationMode === 'parallel' && (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Combine Results</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAggregationChange('concatenate')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                aggregationStrategy === 'concatenate'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Show All
            </button>
            <button
              onClick={() => onAggregationChange('lastWins')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                aggregationStrategy === 'lastWins'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Best Only
            </button>
          </div>
        </div>
      )}

      {/* Ready indicator when agents selected */}
      {hasAgents && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300">
            {selectedAgents.length === 1 
              ? 'Single agent mode - add more for orchestration'
              : `Ready: ${selectedAgents.length} agents in ${orchestrationMode} mode`
            }
          </span>
        </div>
      )}

      {/* Save & Run Button */}
      <div className="pt-2 border-t border-gray-700">
        <button
          onClick={handleSaveAndRun}
          disabled={!hasAgents || isOrchestrating}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            hasAgents && !isOrchestrating
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/20'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
          title={hasAgents ? 'Save configuration and start chatting' : 'Select agents first'}
        >
          {isOrchestrating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Running...</span>
            </>
          ) : hasAgents ? (
            <>
              <Play className="w-5 h-5" />
              <span>Save & Run with {selectedAgents.length} Agent{selectedAgents.length > 1 ? 's' : ''}</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Select Agents First</span>
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          {hasAgents 
            ? 'Configuration will be saved. Type your message in the chat.'
            : 'Choose agents from the dropdown above'}
        </p>
      </div>
    </div>
  );
};

export default MultiAgentSelector;