/**
 * Agent Soul Plugin - Main Process
 * Manages personality and memory for AI agents
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'agent-soul' });

// Types
export interface AgentPersonality {
  name: string;
  emoji: string;
  creature: string;
  vibe: string;
  tone: string;
  coreTruths: string[];
  boundaries: string[];
  responseStyle: {
    beConcise: boolean;
    useMarkdown: boolean;
    showReasoning: boolean;
    askFollowUp: boolean;
  };
}

export interface AgentMemory {
  longTerm: {
    keyFacts: string[];
    preferences: string[];
    relationships: string[];
    decisions: string[];
  };
  shortTerm: {
    lastTopics: string[];
    lastInteractions: string[];
  };
}

export interface AgentSoulConfig {
  id: string;
  personality: AgentPersonality;
  memory: AgentMemory;
  createdAt: number;
  updatedAt: number;
}

// Personality templates
const PERSONALITY_TEMPLATES: Record<string, Partial<AgentPersonality>> = {
  default: {
    vibe: 'Helpful, clear, direct',
    tone: 'Professional but approachable',
    coreTruths: [],
    boundaries: [],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: true,
      askFollowUp: false
    }
  },
  assistant: {
    vibe: 'Helpful, proactive, resourceful',
    tone: 'Warm and professional',
    coreTruths: ['I am here to help', 'I learn from interactions', 'I respect user preferences'],
    boundaries: ['I do not share private data', 'I do not make up facts'],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: false,
      askFollowUp: true
    }
  },
  coder: {
    vibe: 'Precise, efficient, technical',
    tone: 'Direct and clear',
    coreTruths: ['Code quality matters', 'Testing is essential', 'Documentation helps everyone'],
    boundaries: ['I do not write insecure code', 'I explain trade-offs'],
    responseStyle: {
      beConcise: true,
      useMarkdown: true,
      showReasoning: false,
      askFollowUp: false
    }
  },
  analyst: {
    vibe: 'Analytical, thorough, objective',
    tone: 'Factual and measured',
    coreTruths: ['Data drives decisions', 'Context matters', 'Correlation ≠ causation'],
    boundaries: ['I do not speculate without evidence', 'I highlight uncertainty'],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: true,
      askFollowUp: false
    }
  },
  creative: {
    vibe: 'Creative, imaginative, expressive',
    tone: 'Warm and engaging',
    coreTruths: ['Creativity thrives with constraints', 'Every idea has potential'],
    boundaries: ['I do not plagiarize', 'I credit sources'],
    responseStyle: {
      beConcise: false,
      useMarkdown: true,
      showReasoning: false,
      askFollowUp: true
    }
  }
};

export function registerAgentSoulIpc(ipcMain: typeof import('electron').ipcMain) {
  // Get all agent souls
  ipcMain.handle('agentsoul:get-all', async () => {
    return store.get('souls', []);
  });

  // Get soul for a specific agent
  ipcMain.handle('agentsoul:get', async (_event, agentId: string) => {
    const souls = store.get('souls', []) as AgentSoulConfig[];
    return souls.find(s => s.id === agentId) || null;
  });

  // Create a new soul for an agent
  ipcMain.handle('agentsoul:create', async (_event, agentId: string, agentName: string, template: string = 'default') => {
    const souls = store.get('souls', []) as AgentSoulConfig[];
    const existingIndex = souls.findIndex(s => s.id === agentId);
    
    const personalityTemplate = PERSONALITY_TEMPLATES[template] || PERSONALITY_TEMPLATES.default;
    
    const newSoul: AgentSoulConfig = {
      id: agentId,
      personality: {
        name: agentName,
        emoji: '🤖',
        creature: 'AI Assistant',
        vibe: personalityTemplate.vibe || 'Helpful, clear, direct',
        tone: personalityTemplate.tone || 'Professional but approachable',
        coreTruths: personalityTemplate.coreTruths || [],
        boundaries: personalityTemplate.boundaries || [],
        responseStyle: personalityTemplate.responseStyle || {
          beConcise: false,
          useMarkdown: true,
          showReasoning: true,
          askFollowUp: false
        }
      },
      memory: {
        longTerm: {
          keyFacts: [],
          preferences: [],
          relationships: [],
          decisions: []
        },
        shortTerm: {
          lastTopics: [],
          lastInteractions: []
        }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (existingIndex >= 0) {
      souls[existingIndex] = newSoul;
    } else {
      souls.push(newSoul);
    }

    store.set('souls', souls);
    return newSoul;
  });

  // Update personality
  ipcMain.handle('agentsoul:update-personality', async (_event, agentId: string, updates: Partial<AgentPersonality>) => {
    const souls = store.get('souls', []) as AgentSoulConfig[];
    const index = souls.findIndex(s => s.id === agentId);
    
    if (index >= 0) {
      souls[index].personality = { ...souls[index].personality, ...updates };
      souls[index].updatedAt = Date.now();
      store.set('souls', souls);
      return souls[index];
    }
    
    return null;
  });

  // Add memory entry
  ipcMain.handle('agentsoul:add-memory', async (_event, agentId: string, category: keyof AgentMemory['longTerm'], entry: string) => {
    const souls = store.get('souls', []) as AgentSoulConfig[];
    const index = souls.findIndex(s => s.id === agentId);
    
    if (index >= 0) {
      if (!souls[index].memory.longTerm[category]) {
        souls[index].memory.longTerm[category] = [];
      }
      souls[index].memory.longTerm[category].push(entry);
      souls[index].updatedAt = Date.now();
      store.set('souls', souls);
      return souls[index];
    }
    
    return null;
  });

  // Get personality templates
  ipcMain.handle('agentsoul:get-templates', async () => {
    return Object.entries(PERSONALITY_TEMPLATES).map(([key, value]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      ...value
    }));
  });

  // Delete soul
  ipcMain.handle('agentsoul:delete', async (_event, agentId: string) => {
    const souls = store.get('souls', []) as AgentSoulConfig[];
    const filtered = souls.filter(s => s.id !== agentId);
    store.set('souls', filtered);
    return { success: true };
  });

  console.log('[AgentSoul] IPC handlers registered');
}