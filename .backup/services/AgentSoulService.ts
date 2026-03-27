// Agent Soul Service - Manages personality and memory for AI agents
// Inspired by OpenClaw's SOUL.md, MEMORY.md, USER.md system

import { AgentSoulConfig, AgentPersonality, AgentMemory, PERSONALITY_TEMPLATES } from '../types/agentSoul';

const SOUL_STORAGE_KEY = 'mosaic_agent_souls';
const MEMORY_STORAGE_KEY = 'mosaic_agent_memory';

export class AgentSoulService {
  // Get all agent souls
  static async getAllSouls(): Promise<AgentSoulConfig[]> {
    try {
      const stored = localStorage.getItem(SOUL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[AgentSoul] Error loading souls:', e);
      return [];
    }
  }

  // Get soul for a specific agent
  static async getSoul(agentId: string): Promise<AgentSoulConfig | null> {
    const souls = await this.getAllSouls();
    return souls.find(s => s.id === agentId) || null;
  }

  // Create a new soul for an agent
  static async createSoul(agentId: string, agentName: string, template: string = 'default'): Promise<AgentSoulConfig> {
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
        recent: {
          lastTopics: [],
          openQuestions: [],
          actionItems: []
        },
        lastUpdated: Date.now(),
        version: 1
      },
      contextFiles: {
        enabled: false,
        files: []
      },
      linkedNodes: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const souls = await this.getAllSouls();
    souls.push(newSoul);
    localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(souls));

    console.log('[AgentSoul] Created soul for agent:', agentId);
    return newSoul;
  }

  // Update agent personality
  static async updatePersonality(agentId: string, updates: Partial<AgentPersonality>): Promise<boolean> {
    try {
      const souls = await this.getAllSouls();
      const index = souls.findIndex(s => s.id === agentId);
      
      if (index >= 0) {
        souls[index].personality = { ...souls[index].personality, ...updates };
        souls[index].updatedAt = Date.now();
        localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(souls));
        console.log('[AgentSoul] Updated personality for agent:', agentId);
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AgentSoul] Error updating personality:', e);
      return false;
    }
  }

  // Add a memory (key fact, preference, etc.)
  static async addMemory(agentId: string, category: keyof AgentMemory['longTerm'], memory: string): Promise<boolean> {
    try {
      const souls = await this.getAllSouls();
      const index = souls.findIndex(s => s.id === agentId);
      
      if (index >= 0) {
        const memories = souls[index].memory.longTerm[category];
        if (!memories.includes(memory)) {
          memories.push(memory);
          souls[index].memory.lastUpdated = Date.now();
          souls[index].updatedAt = Date.now();
          localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(souls));
          console.log('[AgentSoul] Added memory to agent:', agentId, category, memory);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AgentSoul] Error adding memory:', e);
      return false;
    }
  }

  // Update recent context
  static async updateRecentContext(
    agentId: string, 
    context: Partial<AgentMemory['recent']>
  ): Promise<boolean> {
    try {
      const souls = await this.getAllSouls();
      const index = souls.findIndex(s => s.id === agentId);
      
      if (index >= 0) {
        souls[index].memory.recent = { ...souls[index].memory.recent, ...context };
        souls[index].memory.lastUpdated = Date.now();
        souls[index].updatedAt = Date.now();
        localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(souls));
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AgentSoul] Error updating recent context:', e);
      return false;
    }
  }

  // Generate system prompt from soul
  static generateSystemPrompt(soul: AgentSoulConfig, builderEnabled: boolean = false): string {
    const { personality, memory } = soul;
    
    const parts: string[] = [];
    
    // Core identity
    parts.push(`You are ${personality.name}${personality.emoji ? ` ${personality.emoji}` : ''}.`);
    if (personality.creature) {
      parts.push(`You are a ${personality.creature}.`);
    }
    
    // Vibe and tone
    parts.push(`\nYour vibe: ${personality.vibe}`);
    parts.push(`Your tone: ${personality.tone}`);
    
    // Core truths
    if (personality.coreTruths.length > 0) {
      parts.push('\nCore truths (always follow):');
      personality.coreTruths.forEach(truth => {
        parts.push(`- ${truth}`);
      });
    }
    
    // Boundaries
    if (personality.boundaries.length > 0) {
      parts.push('\nBoundaries (never do):');
      personality.boundaries.forEach(boundary => {
        parts.push(`- ${boundary}`);
      });
    }
    
    // Response style
    const { responseStyle } = personality;
    parts.push('\nResponse style:');
    if (responseStyle.beConcise) parts.push('- Be concise and direct');
    if (responseStyle.useMarkdown) parts.push('- Use markdown formatting');
    if (responseStyle.showReasoning) parts.push('- Show your reasoning');
    if (responseStyle.askFollowUp) parts.push('- Ask follow-up questions');
    
    // Builder mode instructions
    if (builderEnabled) {
      parts.push('\n## 🔧 BUILDER MODE ENABLED');
      parts.push('\nYou have EXECUTION CAPABILITIES. You can:');
      parts.push('\n### Shell Commands');
      parts.push('Execute any shell command:');
      parts.push('```json');
      parts.push('{"action": "shell", "command": "ls -la"}');
      parts.push('```');
      parts.push('\n### File Operations');
      parts.push('```json');
      parts.push('{"action": "read", "path": "./file.txt"}');
      parts.push('{"action": "write", "path": "./file.txt", "content": "text here"}');
      parts.push('{"action": "list", "path": "./directory"}');
      parts.push('```');
      parts.push('\n### Network Requests');
      parts.push('```json');
      parts.push('{"action": "fetch", "url": "https://api.example.com/data"}');
      parts.push('{"action": "graphql", "url": "https://api.studio.thegraph.com/query/.../latest", "query": "{ ... }"}');
      parts.push('```');
      parts.push('\n### Git Operations');
      parts.push('```json');
      parts.push('{"action": "clone", "repo": "https://github.com/user/repo.git", "target": "./directory"}');
      parts.push('```');
      parts.push('\n### Memory (Persistent)');
      parts.push('```json');
      parts.push('{"action": "remember", "type": "fact", "key": "user_name", "value": "Mauri", "importance": 8}');
      parts.push('{"action": "recall", "query": "user preferences"}');
      parts.push('```');
      parts.push('\n**Format**: Always use JSON code blocks for execution requests. I will execute them and return results.');
      parts.push('\n**Safety**: You can execute commands, read/write files, fetch URLs, and clone repos.');
    }
    
    // Long-term memory
    const longTerm = memory.longTerm;
    if (longTerm.keyFacts.length > 0 || longTerm.preferences.length > 0) {
      parts.push('\nWhat you remember about this user:');
      longTerm.keyFacts.forEach(fact => parts.push(`- ${fact}`));
      longTerm.preferences.forEach(pref => parts.push(`- Prefers: ${pref}`));
      if (longTerm.relationships.length > 0) {
        longTerm.relationships.forEach(rel => parts.push(`- ${rel}`));
      }
      if (longTerm.decisions.length > 0) {
        parts.push('\nPast decisions:');
        longTerm.decisions.forEach(dec => parts.push(`- ${dec}`));
      }
    }
    
    // Recent context
    const recent = memory.recent;
    if (recent.lastTopics.length > 0) {
      parts.push('\nRecent topics discussed:');
      recent.lastTopics.slice(-5).forEach(topic => parts.push(`- ${topic}`));
    }
    
    parts.push('\nRemember: You are genuinely helpful. You have opinions. You remember context across this conversation.');
    
    return parts.join('\n');
  }

  // Get or create soul for an agent
  static async getOrCreateSoul(agentId: string, agentName: string): Promise<AgentSoulConfig> {
    const existing = await this.getSoul(agentId);
    if (existing) return existing;
    return this.createSoul(agentId, agentName);
  }

  // Delete soul
  static async deleteSoul(agentId: string): Promise<boolean> {
    try {
      const souls = await this.getAllSouls();
      const filtered = souls.filter(s => s.id !== agentId);
      localStorage.setItem(SOUL_STORAGE_KEY, JSON.stringify(filtered));
      console.log('[AgentSoul] Deleted soul for agent:', agentId);
      return true;
    } catch (e) {
      console.error('[AgentSoul] Error deleting soul:', e);
      return false;
    }
  }

  // Extract memories from conversation
  static extractMemories(userMessage: string, assistantResponse: string): {
    facts: string[];
    preferences: string[];
    topics: string[];
  } {
    const facts: string[] = [];
    const preferences: string[] = [];
    const topics: string[] = [];
    
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = assistantResponse.toLowerCase();
    
    // Extract preferences (I like, I prefer, I want)
    const preferencePatterns = [
      /i (?:really )?(?:like|love|prefer|want) (.+)/gi,
      /my (?:favorite|preferred) (.+) is (.+)/gi,
      /i'd rather (.+)/gi,
    ];
    
    preferencePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(userMessage)) !== null) {
        if (match[0] && match[0].length < 100) {
          preferences.push(match[0]);
        }
      }
    });
    
    // Extract facts (I am, I have, I work)
    const factPatterns = [
      /i (?:am|have|work|live|use) (.+)/gi,
      /my (.+) is (.+)/gi,
    ];
    
    factPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(userMessage)) !== null) {
        if (match[0] && match[0].length < 100) {
          facts.push(match[0]);
        }
      }
    });
    
    // Extract topics (key technical terms)
    const techTerms = lowerMessage.match(/\b(?:wallet|blockchain|ethereum|base|anfe|license|contract|agent|model|api|token|nft)\w*\b/gi);
    if (techTerms) {
      topics.push(...[...new Set(techTerms.map(t => t.toLowerCase()))]);
    }
    
    return { facts, preferences, topics };
  }
}

export default AgentSoulService;