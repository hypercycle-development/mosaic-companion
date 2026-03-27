// Multi-Agent Orchestration Types
// Allows multiple agents to work together on complex tasks

export type OrchestrationMode = 
  | 'sequential'  // Agent 1 → Agent 2 → Agent 3 (pipeline)
  | 'parallel'     // All agents work simultaneously
  | 'collaborative' // Agents discuss and iterate together
  | 'orchestrator'; // One agent coordinates others

export type AggregationStrategy = 
  | 'lastWins'      // Last agent's output is final
  | 'concatenate'   // Combine all outputs
  | 'synthesize'    // One agent synthesizes all outputs
  | 'vote';        // Agents vote on best output

export interface OrchestrationTask {
  id: string;
  name: string;
  description: string;
  mode: OrchestrationMode;
  agentIds: string[];
  inputPrompt: string;
  aggregationStrategy: AggregationStrategy;
  synthesisAgentId?: string; // For 'synthesize' strategy
  maxIterations?: number;    // For collaborative mode
  timeout?: number;          // Maximum time per agent
}

export interface AgentResponse {
  agentId: string;
  agentName: string;
  response: string;
  timestamp: number;
  duration: number;
  error?: string;
}

export interface OrchestrationResult {
  taskId: string;
  responses: AgentResponse[];
  finalOutput: string;
  totalDuration: number;
  mode: OrchestrationMode;
  success: boolean;
}

export interface OrchestrationCallbacks {
  onAgentStart?: (agentId: string, agentName: string, order: number, total: number) => void;
  onAgentProgress?: (agentId: string, token: string) => void;
  onAgentComplete?: (agentId: string, response: string, duration: number) => void;
  onAgentError?: (agentId: string, error: string) => void;
  onAllComplete?: (result: OrchestrationResult) => void;
  onSynthesisStart?: (agentId: string) => void;
}

export interface OrchestrationTemplate {
  id: string;
  name: string;
  description: string;
  mode: OrchestrationMode;
  agentRoles: {
    agentId: string;
    role: string;
    order?: number; // For sequential mode
  }[];
  aggregationStrategy: AggregationStrategy;
  systemPromptAddition?: string;
  maxIterations?: number; // For collaborative mode
  timeout?: number; // Maximum time per agent
}

// Pre-built orchestration templates
export const ORCHESTRATION_TEMPLATES: Record<string, OrchestrationTemplate> = {
  codeReview: {
    id: 'codeReview',
    name: 'Code Review Pipeline',
    description: 'Write code → Review → Refine',
    mode: 'sequential',
    agentRoles: [
      { agentId: 'coder', role: 'Write initial implementation', order: 1 },
      { agentId: 'reviewer', role: 'Review code for bugs and improvements', order: 2 },
      { agentId: 'refiner', role: 'Apply improvements', order: 3 },
    ],
    aggregationStrategy: 'lastWins',
    systemPromptAddition: 'You are part of a code review pipeline. Focus on your specific role.',
  },
  
  research: {
    id: 'research',
    name: 'Research Team',
    description: 'Multiple agents research different aspects in parallel',
    mode: 'parallel',
    agentRoles: [
      { agentId: 'researcher1', role: 'Research technical aspects' },
      { agentId: 'researcher2', role: 'Research market aspects' },
      { agentId: 'researcher3', role: 'Research security aspects' },
    ],
    aggregationStrategy: 'synthesize',
    systemPromptAddition: 'You are part of a research team. Focus on your specific area.',
  },
  
  brainstorm: {
    id: 'brainstorm',
    name: 'Brainstorm Session',
    description: 'Agents collaborate and iterate on ideas',
    mode: 'collaborative',
    agentRoles: [
      { agentId: 'creative', role: 'Generate creative ideas' },
      { agentId: 'analyst', role: 'Analyze feasibility' },
      { agentId: 'critic', role: 'Identify weaknesses' },
    ],
    aggregationStrategy: 'lastWins',
    maxIterations: 3,
    systemPromptAddition: 'You are part of a brainstorming session. Build on each other\'s ideas.',
  },
  
  debate: {
    id: 'debate',
    name: 'Debate & Synthesis',
    description: 'Agents debate different viewpoints, then synthesize',
    mode: 'orchestrator',
    agentRoles: [
      { agentId: 'proponent', role: 'Argue for the proposal' },
      { agentId: 'opponent', role: 'Argue against the proposal' },
      { agentId: 'moderator', role: 'Synthesize and find consensus' },
    ],
    aggregationStrategy: 'synthesize',
    systemPromptAddition: 'You are part of a structured debate. Present clear arguments.',
  },
};

export interface MultiAgentState {
  isMultiAgentMode: boolean;
  selectedAgents: string[];
  currentTemplate: OrchestrationTemplate | null;
  orchestrationMode: OrchestrationMode;
  aggregationStrategy: AggregationStrategy;
  isOrchestrating: boolean;
  currentAgentIndex: number;
  responses: AgentResponse[];
}

export const DEFAULT_MULTI_AGENT_STATE: MultiAgentState = {
  isMultiAgentMode: false,
  selectedAgents: [],
  currentTemplate: null,
  orchestrationMode: 'parallel',
  aggregationStrategy: 'concatenate',
  isOrchestrating: false,
  currentAgentIndex: 0,
  responses: [],
};