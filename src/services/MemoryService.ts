// Memory Service
// Provides persistent storage for agent-learned information across sessions

import { AIAgentConfig } from '../types/ai';

interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'fact' | 'preference' | 'skill' | 'context' | 'conversation';
  key: string;
  value: string;
  metadata?: Record<string, any>;
  agentId?: string;
  importance: number; // 1-10, used for retrieval ranking
}

interface AgentMemory {
  agentId: string;
  agentName: string;
  facts: MemoryEntry[];
  preferences: MemoryEntry[];
  skills: MemoryEntry[];
  contexts: MemoryEntry[];
  lastUpdated: number;
}

class MemoryServiceImpl {
  private storageKey = 'mosaic_memory';
  private agentMemories: Map<string, AgentMemory> = new Map();
  private globalMemory: MemoryEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // Load memory from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.globalMemory = data.globalMemory || [];
        
        // Load agent memories
        if (data.agentMemories) {
          for (const [agentId, memory] of Object.entries(data.agentMemories)) {
            this.agentMemories.set(agentId, memory as AgentMemory);
          }
        }
      }
      console.log(`[MemoryService] Loaded ${this.globalMemory.length} global entries, ${this.agentMemories.size} agent memories`);
    } catch (error) {
      console.error('[MemoryService] Failed to load from storage:', error);
    }
  }

  // Save memory to localStorage
  private saveToStorage(): void {
    try {
      const agentMemoriesObj: Record<string, AgentMemory> = {};
      this.agentMemories.forEach((memory, agentId) => {
        agentMemoriesObj[agentId] = memory;
      });

      const data = {
        globalMemory: this.globalMemory,
        agentMemories: agentMemoriesObj,
        lastSaved: Date.now(),
      };

      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log(`[MemoryService] Saved ${this.globalMemory.length} global entries`);
    } catch (error) {
      console.error('[MemoryService] Failed to save to storage:', error);
    }
  }

  // Store a fact
  storeFact(key: string, value: string, agentId?: string, importance: number = 5): void {
    const entry: MemoryEntry = {
      id: `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'fact',
      key,
      value,
      agentId,
      importance,
    };

    if (agentId) {
      this.getOrCreateAgentMemory(agentId).facts.push(entry);
    } else {
      this.globalMemory.push(entry);
    }

    this.saveToStorage();
    console.log(`[MemoryService] Stored fact: ${key} = ${value}`);
  }

  // Store a preference
  storePreference(key: string, value: string, agentId: string): void {
    const entry: MemoryEntry = {
      id: `pref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'preference',
      key,
      value,
      agentId,
      importance: 7,
    };

    const memory = this.getOrCreateAgentMemory(agentId);
    // Remove old preference for same key
    memory.preferences = memory.preferences.filter(p => p.key !== key);
    memory.preferences.push(entry);
    memory.lastUpdated = Date.now();

    this.saveToStorage();
    console.log(`[MemoryService] Stored preference for ${agentId}: ${key} = ${value}`);
  }

  // Store a learned skill
  storeSkill(skillName: string, description: string, agentId: string, code?: string): void {
    const entry: MemoryEntry = {
      id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'skill',
      key: skillName,
      value: description,
      metadata: { code },
      agentId,
      importance: 8,
    };

    this.getOrCreateAgentMemory(agentId).skills.push(entry);
    this.saveToStorage();
    console.log(`[MemoryService] Stored skill for ${agentId}: ${skillName}`);
  }

  // Store context for conversation continuity
  storeContext(context: string, agentId?: string): void {
    const entry: MemoryEntry = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'context',
      key: 'context',
      value: context,
      agentId,
      importance: 4,
    };

    if (agentId) {
      const memory = this.getOrCreateAgentMemory(agentId);
      // Keep only last 10 contexts
      memory.contexts = memory.contexts.slice(-9);
      memory.contexts.push(entry);
    } else {
      this.globalMemory = this.globalMemory.filter(e => e.type !== 'context' || e.timestamp > Date.now() - 3600000);
      this.globalMemory.push(entry);
    }

    this.saveToStorage();
  }

  // Get or create agent memory
  private getOrCreateAgentMemory(agentId: string): AgentMemory {
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, {
        agentId,
        agentName: agentId,
        facts: [],
        preferences: [],
        skills: [],
        contexts: [],
        lastUpdated: Date.now(),
      });
    }
    return this.agentMemories.get(agentId)!;
  }

  // Retrieve facts
  getFacts(agentId?: string): MemoryEntry[] {
    if (agentId) {
      const memory = this.agentMemories.get(agentId);
      return memory ? [...memory.facts, ...this.globalMemory.filter(e => e.type === 'fact')] : [];
    }
    return this.globalMemory.filter(e => e.type === 'fact');
  }

  // Retrieve preferences
  getPreferences(agentId: string): MemoryEntry[] {
    const memory = this.agentMemories.get(agentId);
    return memory ? memory.preferences : [];
  }

  // Retrieve skills
  getSkills(agentId: string): MemoryEntry[] {
    const memory = this.agentMemories.get(agentId);
    return memory ? memory.skills : [];
  }

  // Get recent contexts
  getContexts(agentId?: string, limit: number = 5): MemoryEntry[] {
    if (agentId) {
      const memory = this.agentMemories.get(agentId);
      return memory ? memory.contexts.slice(-limit) : [];
    }
    return this.globalMemory.filter(e => e.type === 'context').slice(-limit);
  }

  // Search memory
  search(query: string, agentId?: string): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    const results: MemoryEntry[] = [];

    // Search global memory
    for (const entry of this.globalMemory) {
      if (entry.key.toLowerCase().includes(queryLower) || 
          entry.value.toLowerCase().includes(queryLower)) {
        results.push(entry);
      }
    }

    // Search agent memory
    if (agentId) {
      const memory = this.agentMemories.get(agentId);
      if (memory) {
        const allEntries = [...memory.facts, ...memory.preferences, ...memory.skills, ...memory.contexts];
        for (const entry of allEntries) {
          if (entry.key.toLowerCase().includes(queryLower) || 
              entry.value.toLowerCase().includes(queryLower)) {
            results.push(entry);
          }
        }
      }
    }

    // Sort by importance and recency
    return results.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return b.timestamp - a.timestamp;
    });
  }

  // Get memory summary for agent
  getMemorySummary(agentId: string): string {
    const memory = this.agentMemories.get(agentId);
    if (!memory) return 'No memory for this agent.';

    const lines: string[] = [];
    
    if (memory.facts.length > 0) {
      lines.push('## Facts');
      for (const fact of memory.facts.slice(-5)) {
        lines.push(`- ${fact.key}: ${fact.value}`);
      }
    }

    if (memory.preferences.length > 0) {
      lines.push('\n## Preferences');
      for (const pref of memory.preferences) {
        lines.push(`- ${pref.key}: ${pref.value}`);
      }
    }

    if (memory.skills.length > 0) {
      lines.push('\n## Skills');
      for (const skill of memory.skills) {
        lines.push(`- ${skill.key}: ${skill.value}`);
      }
    }

    if (memory.contexts.length > 0) {
      lines.push('\n## Recent Context');
      for (const ctx of memory.contexts.slice(-3)) {
        lines.push(`- ${new Date(ctx.timestamp).toLocaleString()}: ${ctx.value.substring(0, 100)}...`);
      }
    }

    return lines.join('\n');
  }

  // Clear memory
  clearMemory(agentId?: string): void {
    if (agentId) {
      this.agentMemories.delete(agentId);
    } else {
      this.globalMemory = [];
      this.agentMemories.clear();
    }
    this.saveToStorage();
    console.log(`[MemoryService] Cleared ${agentId ? 'agent ' + agentId : 'all'} memory`);
  }

  // Initialize agent memory from config
  initAgentMemory(agent: AIAgentConfig): void {
    const memory = this.getOrCreateAgentMemory(agent.id);
    memory.agentName = agent.name;
    memory.lastUpdated = Date.now();
    this.saveToStorage();
  }

  // Export memory for backup
  exportMemory(): string {
    const agentMemoriesObj: Record<string, AgentMemory> = {};
    this.agentMemories.forEach((memory, agentId) => {
      agentMemoriesObj[agentId] = memory;
    });

    return JSON.stringify({
      globalMemory: this.globalMemory,
      agentMemories: agentMemoriesObj,
      exportedAt: Date.now(),
    }, null, 2);
  }

  // Import memory from backup
  importMemory(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      this.globalMemory = data.globalMemory || [];
      
      if (data.agentMemories) {
        for (const [agentId, memory] of Object.entries(data.agentMemories)) {
          this.agentMemories.set(agentId, memory as AgentMemory);
        }
      }

      this.saveToStorage();
      console.log('[MemoryService] Imported memory successfully');
      return true;
    } catch (error) {
      console.error('[MemoryService] Failed to import memory:', error);
      return false;
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryServiceImpl();