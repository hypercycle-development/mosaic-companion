/**
 * Multi-Agent Execution Viewer
 * Displays each agent's output with critique and improvements
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Bot,
  MessageSquare,
  ThumbsUp,
  Lightbulb,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface AgentExecutionResult {
  agentId: string;
  agentName: string;
  output: string;
  critique?: string;
  improvements?: string;
  timestamp: number;
  duration: number;
}

export interface MultiAgentExecutionViewerProps {
  /** Array of agent execution results */
  results: AgentExecutionResult[];
  /** Callback when viewer should be closed */
  onClose?: () => void;
  /** Optional final synthesis */
  finalSynthesis?: string;
}

// =============================================================================
// Helper: Parse structured output from agent response
// =============================================================================

function parseStructuredOutput(rawOutput: string): {
  answer: string;
  critique: string;
  improvements: string;
} {
  try {
    // Try JSON parsing first
    const parsed = JSON.parse(rawOutput);
    return {
      answer: parsed.answer || parsed.response || rawOutput,
      critique: parsed.critique || '',
      improvements: parsed.improvements || '',
    };
  } catch {
    // Fallback: treat entire response as answer
    return {
      answer: rawOutput,
      critique: '',
      improvements: '',
    };
  }
}

// =============================================================================
// Agent Result Card Component
// =============================================================================

const AgentResultCard: React.FC<{
  result: AgentExecutionResult;
  index: number;
  isFirst: boolean;
  color: string;
}> = ({ result, index, isFirst, color }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const parsed = parseStructuredOutput(result.output);

  return (
    <div
      className={`border-l-4 ${isExpanded ? 'mb-4' : 'mb-2'} rounded-r-lg`}
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-opacity-50 transition-colors"
        style={{ backgroundColor: `${color}15` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: color }}
          >
            {index + 1}
          </div>
          <div>
            <h4 className="font-semibold text-gray-100">{result.agentName}</h4>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock size={12} />
              <span>{result.duration}ms</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <span className="text-xs px-2 py-1 bg-purple-900 text-purple-200 rounded">
              Sequential
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={18} className="text-gray-400" />
          ) : (
            <ChevronRight size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Answer */}
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-1">
              <MessageSquare size={14} />
              <span>Answer</span>
            </div>
            <div className="text-gray-200 text-sm whitespace-pre-wrap bg-gray-900 p-3 rounded-lg">
              {parsed.answer}
            </div>
          </div>

          {/* Critique (not for first agent) */}
          {!isFirst && parsed.critique && parsed.critique !== 'none' && (
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-amber-400 mb-1">
                <ThumbsUp size={14} />
                <span>Critique of Previous Agents</span>
              </div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap bg-gray-900 p-3 rounded-lg border-l-2 border-amber-500">
                {parsed.critique}
              </div>
            </div>
          )}

          {/* Improvements */}
          {parsed.improvements && (
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-green-400 mb-1">
                <Lightbulb size={14} />
                <span>Improvements</span>
              </div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap bg-gray-900 p-3 rounded-lg border-l-2 border-green-500">
                {parsed.improvements}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Agent Colors
// =============================================================================

const AGENT_COLORS = [
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

function getAgentColor(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

// =============================================================================
// Main Component
// =============================================================================

export const MultiAgentExecutionViewer: React.FC<MultiAgentExecutionViewerProps> = ({
  results,
  onClose,
  finalSynthesis,
}) => {
  const [showSynthesis, setShowSynthesis] = useState(true);

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-purple-400" />
          <h3 className="font-semibold text-white">Multi-Agent Execution</h3>
          <span className="text-xs px-2 py-1 bg-purple-900 text-purple-200 rounded">
            {results.length} agents
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Agent Results */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {results.map((result, index) => (
          <AgentResultCard
            key={result.agentId}
            result={result}
            index={index}
            isFirst={index === 0}
            color={getAgentColor(index)}
          />
        ))}
      </div>

      {/* Final Synthesis (optional) */}
      {finalSynthesis && (
        <div className="border-t border-gray-700">
          <button
            onClick={() => setShowSynthesis(!showSynthesis)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-300" />
              <span className="font-medium text-white">Final Synthesis</span>
            </div>
            {showSynthesis ? (
              <ChevronDown size={18} className="text-purple-300" />
            ) : (
              <ChevronRight size={18} className="text-purple-300" />
            )}
          </button>
          {showSynthesis && (
            <div className="p-4 bg-gray-900">
              <div className="text-gray-200 text-sm whitespace-pre-wrap">
                {finalSynthesis}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiAgentExecutionViewer;