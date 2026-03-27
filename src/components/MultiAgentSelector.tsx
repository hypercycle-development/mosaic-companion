/**
 * Multi-Agent Selector Component
 * UI for selecting and orchestrating multiple AI agents
 */

import React, { useState } from "react";
import { 
  Users, 
  Play, 
  ArrowRight, 
  GitBranch, 
  Zap, 
  MessagesSquare,
  Check,
  X
} from "lucide-react";
import { AIAgentConfig } from "../types/ai";
import {
  OrchestrationMode,
  AggregationStrategy,
  ORCHESTRATION_TEMPLATES,
  OrchestrationTemplate,
} from "../types/agentOrchestration";

interface MultiAgentSelectorProps {
  agents: AIAgentConfig[];
  selectedAgentIds: string[];
  onAgentToggle: (agentId: string) => void;
  mode: OrchestrationMode;
  onModeChange: (mode: OrchestrationMode) => void;
  aggregation: AggregationStrategy;
  onAggregationChange: (agg: AggregationStrategy) => void;
  onRun: () => void;
  isRunning: boolean;
}

export function MultiAgentSelector({
  agents,
  selectedAgentIds,
  onAgentToggle,
  mode,
  onModeChange,
  aggregation,
  onAggregationChange,
  onRun,
  isRunning,
}: MultiAgentSelectorProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const modes: { value: OrchestrationMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: "sequential", label: "Sequential", icon: <ArrowRight size={14} />, desc: "Pipeline A → B → C" },
    { value: "parallel", label: "Parallel", icon: <Zap size={14} />, desc: "All at once" },
    { value: "collaborative", label: "Collaborative", icon: <MessagesSquare size={14} />, desc: "Iterate together" },
    { value: "orchestrator", label: "Orchestrated", icon: <GitBranch size={14} />, desc: "One coordinates" },
  ];

  const aggregations: { value: AggregationStrategy; label: string }[] = [
    { value: "lastWins", label: "Last wins" },
    { value: "concatenate", label: "Combine all" },
    { value: "synthesize", label: "Synthesize" },
    { value: "vote", label: "Vote" },
  ];

  const applyTemplate = (template: OrchestrationTemplate) => {
    onModeChange(template.mode);
    onAggregationChange(template.aggregationStrategy);
    setShowTemplates(false);
  };

  return (
    <div className="bg-gray-900 border border-purple-500/30 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-purple-400" />
          <span className="font-medium text-gray-100">Multi-Agent Mode</span>
        </div>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          {showTemplates ? "Hide templates" : "Templates"}
        </button>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="grid grid-cols-2 gap-2">
          {Object.values(ORCHESTRATION_TEMPLATES).map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className="text-left p-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/20 rounded-lg transition-colors"
            >
              <div className="text-sm font-medium text-purple-300">{template.name}</div>
              <div className="text-xs text-gray-500">{template.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Agent Selection */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Select agents ({selectedAgentIds.length} selected)</div>
        <div className="flex flex-wrap gap-2">
          {agents.filter(a => a.isActive).map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => onAgentToggle(agent.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  isSelected
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {isSelected && <Check size={12} className="inline mr-1" />}
                {agent.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Orchestration mode</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={`p-2 rounded-lg text-center transition-all ${
                mode === m.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <div className="flex justify-center mb-1">{m.icon}</div>
              <div className="text-xs font-medium">{m.label}</div>
              <div className="text-[10px] text-gray-400">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Aggregation */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400">Combine responses:</span>
        <div className="flex gap-1">
          {aggregations.map((agg) => (
            <button
              key={agg.value}
              onClick={() => onAggregationChange(agg.value)}
              className={`px-2 py-1 rounded text-xs ${
                aggregation === agg.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {agg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Run Button */}
      <button
        onClick={onRun}
        disabled={isRunning || selectedAgentIds.length < 2}
        className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
      >
        {isRunning ? (
          <>
            <span className="animate-spin">⟳</span>
            Running...
          </>
        ) : (
          <>
            <Play size={16} />
            Run Multi-Agent
          </>
        )}
      </button>

      {selectedAgentIds.length < 2 && (
        <p className="text-xs text-yellow-500 text-center">Select at least 2 agents to run</p>
      )}
    </div>
  );
}