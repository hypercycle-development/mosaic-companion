/**
 * Multi-Agent Results Viewer Component
 * Displays individual agent outputs with collapsible sections
 * Shows critique and improvements for each agent
 */

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MessageSquare,
  GitBranch,
  Lightbulb,
  XCircle
} from 'lucide-react';
import { AgentOutput } from '../services/SequentialAgentEngine';

interface MultiAgentResultsViewerProps {
  outputs: AgentOutput[];
  synthesis?: AgentOutput;
  totalDuration: number;
  onClose?: () => void;
  onRegenerate?: (agentId: string) => void;
}

const AGENT_COLORS = [
  { bg: 'bg-blue-900/30', border: 'border-blue-500/30', text: 'text-blue-400', accent: 'blue' },
  { bg: 'bg-purple-900/30', border: 'border-purple-500/30', text: 'text-purple-400', accent: 'purple' },
  { bg: 'bg-emerald-900/30', border: 'border-emerald-500/30', text: 'text-emerald-400', accent: 'emerald' },
  { bg: 'bg-amber-900/30', border: 'border-amber-500/30', text: 'text-amber-400', accent: 'amber' },
  { bg: 'bg-rose-900/30', border: 'border-rose-500/30', text: 'text-rose-400', accent: 'rose' },
  { bg: 'bg-cyan-900/30', border: 'border-cyan-500/30', text: 'text-cyan-400', accent: 'cyan' },
];

const AgentCard: React.FC<{
  output: AgentOutput;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ output, index, isExpanded, onToggle }) => {
  const colorScheme = AGENT_COLORS[index % AGENT_COLORS.length];
  const hasCritique = output.critique && output.critique.length > 0;
  const hasImprovements = output.improvements && output.improvements.length > 0;

  return (
    <div className={`rounded-xl border ${colorScheme.border} ${colorScheme.bg} overflow-hidden transition-all`}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg ${colorScheme.bg} border ${colorScheme.border} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${colorScheme.text}`}>
            {index + 1}
          </span>
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${colorScheme.text}`}>
              {output.agentName}
            </span>
            {output.error ? (
              <XCircle size={14} className="text-red-400" />
            ) : (
              <CheckCircle2 size={14} className="text-emerald-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <Clock size={12} />
            <span>{output.duration}ms</span>
          </div>
        </div>

        {isExpanded ? (
          <ChevronDown size={20} className="text-gray-400" />
        ) : (
          <ChevronRight size={20} className="text-gray-400" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Answer section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className={colorScheme.text} />
              <span className={`text-xs font-medium uppercase tracking-wider ${colorScheme.text}`}>
                Answer
              </span>
            </div>
            <div className="p-3 bg-black/30 rounded-lg border border-gray-800">
              {output.error ? (
                <p className="text-red-400 text-sm">{output.error}</p>
              ) : (
                <p className="text-gray-200 text-sm whitespace-pre-wrap">
                  {output.answer}
                </p>
              )}
            </div>
          </div>

          {/* Critique section */}
          {hasCritique && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GitBranch size={14} className="text-amber-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
                  Critique
                </span>
              </div>
              <div className="p-3 bg-amber-900/10 rounded-lg border border-amber-500/20">
                <p className="text-amber-200/80 text-sm whitespace-pre-wrap">
                  {output.critique}
                </p>
              </div>
            </div>
          )}

          {/* Improvements section */}
          {hasImprovements && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={14} className="text-cyan-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-cyan-400">
                  Improvements
                </span>
              </div>
              <ul className="space-y-2">
                {output.improvements.map((imp, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-2 p-2 bg-cyan-900/10 rounded-lg border border-cyan-500/20"
                  >
                    <span className="text-cyan-400 text-xs mt-0.5">•</span>
                    <span className="text-cyan-200/80 text-sm">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SynthesisCard: React.FC<{
  synthesis: AgentOutput;
}> = ({ synthesis }) => {
  const hasInsights = synthesis.improvements && synthesis.improvements.length > 0;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-900/20 overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-indigo-500/20">
        <div className="w-8 h-8 rounded-lg bg-indigo-900/50 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-sm font-bold text-indigo-400">★</span>
        </div>
        <div className="flex-1">
          <span className="font-semibold text-indigo-400">
            {synthesis.agentName}
          </span>
        </div>
        <CheckCircle2 size={14} className="text-indigo-400" />
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={14} className="text-indigo-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
              Final Answer
            </span>
          </div>
          <div className="p-3 bg-black/30 rounded-lg border border-indigo-500/20">
            <p className="text-white text-sm whitespace-pre-wrap">
              {synthesis.answer}
            </p>
          </div>
        </div>

        {hasInsights && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb size={14} className="text-indigo-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                Key Insights
              </span>
            </div>
            <ul className="space-y-2">
              {synthesis.improvements.map((insight, i) => (
                <li 
                  key={i} 
                  className="flex items-start gap-2 p-2 bg-indigo-900/20 rounded-lg border border-indigo-500/20"
                >
                  <span className="text-indigo-400 text-xs mt-0.5">✓</span>
                  <span className="text-indigo-200/80 text-sm">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export const MultiAgentResultsViewer: React.FC<MultiAgentResultsViewerProps> = ({
  outputs,
  synthesis,
  totalDuration,
  onClose,
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(
    new Set(outputs.map((_, i) => i)) // All expanded by default
  );

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCards(new Set(outputs.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedCards(new Set());
  };

  if (outputs.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={24} className="mx-auto text-gray-500 mb-2" />
        <p className="text-gray-400 text-sm">No results to display</p>
      </div>
    );
  }

  return (
    <div className="multi-agent-viewer bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-purple-400">⚡</span>
            Multi-Agent Execution
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {outputs.length} agents • {totalDuration}ms total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
          >
            Collapse All
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 p-1 text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-800 overflow-x-auto">
        {outputs.map((output, index) => (
          <React.Fragment key={output.agentId}>
            <div 
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap
                ${expandedCards.has(index) 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-900/50 text-gray-500 hover:text-gray-300'
                }
              `}
            >
              <span className={`
                w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${AGENT_COLORS[index % AGENT_COLORS.length].bg}
                ${AGENT_COLORS[index % AGENT_COLORS.length].border}
                ${AGENT_COLORS[index % AGENT_COLORS.length].text}
              `}>
                {index + 1}
              </span>
              <span>{output.agentName}</span>
            </div>
            {index < outputs.length - 1 && (
              <ChevronRight size={12} className="text-gray-600 shrink-0" />
            )}
          </React.Fragment>
        ))}
        {synthesis && (
          <>
            <ChevronRight size={12} className="text-gray-600 shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap bg-indigo-900/30 text-indigo-400">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-indigo-900/50 border border-indigo-500/30">
                ★
              </span>
              <span>Synthesizer</span>
            </div>
          </>
        )}
      </div>

      {/* Agent Cards */}
      <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {outputs.map((output, index) => (
          <AgentCard
            key={output.agentId}
            output={output}
            index={index}
            isExpanded={expandedCards.has(index)}
            onToggle={() => toggleCard(index)}
          />
        ))}

        {/* Synthesis */}
        {synthesis && (
          <SynthesisCard synthesis={synthesis} />
        )}
      </div>
    </div>
  );
};

export default MultiAgentResultsViewer;