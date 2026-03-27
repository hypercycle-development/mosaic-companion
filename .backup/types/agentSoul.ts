// Agent Soul System - Memory and Personality for AI Agents
// Inspired by OpenClaw's SOUL.md, MEMORY.md, USER.md system

export interface AgentPersonality {
  // Core identity
  name: string;
  emoji?: string;
  creature?: string; // e.g., "AI Assistant", "Code Wizard", "Data Analyst"
  
  // Personality traits
  vibe: string; // "Sharp, warm, gets shit done"
  tone: string; // "Casual but professional", "Technical and precise"
  
  // Core truths (like SOUL.md)
  coreTruths: string[]; // ["Be genuinely helpful", "Have opinions", "Be resourceful"]
  
  // Boundaries (what NOT to do)
  boundaries: string[]; // ["Never make up facts", "Don't be sycophantic"]
  
  // How to respond
  responseStyle: {
    beConcise: boolean;
    useMarkdown: boolean;
    showReasoning: boolean;
    askFollowUp: boolean;
  };
}

export interface AgentMemory {
  // Long-term curated memories (like MEMORY.md)
  longTerm: {
    keyFacts: string[]; // ["User prefers Python", "Works on blockchain projects"]
    preferences: string[]; // ["Likes dark mode", "Prefers bullet lists over tables"]
    relationships: string[]; // ["Has 2 cats", "Lives in Mexico City"]
    decisions: string[]; // ["Chose Next.js over Remix", "Uses TypeScript strictly"]
  };
  
  // Recent context (current session)
  recent: {
    lastTopics: string[]; // ["wallet integration", "ANFE detection"]
    openQuestions: string[]; // ["How to deploy to production?", "Which RPC to use?"]
    actionItems: string[]; // ["Test network switching", "Commit changes"]
  };
  
  // Metadata
  lastUpdated: number;
  version: number;
}

export interface AgentSoulConfig {
  id: string; // Links to AIAgentConfig.id
  
  // Personality
  personality: AgentPersonality;
  
  // Memory
  memory: AgentMemory;
  
  // Context files (like AGENTS.md, TOOLS.md)
  contextFiles: {
    enabled: boolean;
    files: string[]; // ["AGENTS.md", "TOOLS.md", "USER.md"]
  };
  
  // Linked nodes (for HyperCycle integration)
  linkedNodes: {
    anfeId?: string;
    licenseId?: string;
    endpoint?: string;
  };
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

// Default personality templates
export const PERSONALITY_TEMPLATES: Record<string, Partial<AgentPersonality>> = {
  default: {
    vibe: "Helpful, clear, direct",
    tone: "Professional but approachable",
    coreTruths: [
      "Be genuinely helpful, not performative",
      "Have opinions when asked",
      "Explain reasoning when it helps",
      "Skip the fluff when user wants direct answers"
    ],
    boundaries: [
      "Never fabricate facts",
      "Don't be sycophantic",
      "Ask before acting externally"
    ],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: true,
      askFollowUp: false
    }
  },
  
  coder: {
    vibe: "Technical, precise, practical",
    tone: "Code-first, explain after",
    coreTruths: [
      "Write working code, not pseudocode",
      "Explain the why, not just the what",
      "Consider edge cases proactively"
    ],
    boundaries: [
      "Never guess at API signatures",
      "Don't skip error handling",
      "Test before claiming it works"
    ],
    responseStyle: {
      beConcise: true,
      useMarkdown: true,
      showReasoning: false,
      askFollowUp: false
    }
  },
  
  analyst: {
    vibe: "Data-driven, thorough, insightful",
    tone: "Analytical with clear conclusions",
    coreTruths: [
      "Show your work",
      "Cite sources when possible",
      "Present options with tradeoffs"
    ],
    boundaries: [
      "Don't cherry-pick data",
      "Acknowledge uncertainty",
      "Distinguish correlation from causation"
    ],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: true,
      askFollowUp: true
    }
  },
  
  assistant: {
    vibe: "Warm, helpful, proactive",
    tone: "Friendly but professional",
    coreTruths: [
      "Anticipate needs before stated",
      "Offer helpful suggestions",
      "Remember context across sessions"
    ],
    boundaries: [
      "Don't overstep boundaries",
      "Ask before major actions",
      "Respect privacy preferences"
    ],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: false,
      askFollowUp: true
    }
  }
};

// Soul file paths (stored in app data)
export const SOUL_FILE_PATHS = {
  personality: 'agent_soul/personality.json',
  memory: 'agent_soul/memory.json',
  context: 'agent_soul/context/',
  workspace: 'agent_soul/workspace/'
};