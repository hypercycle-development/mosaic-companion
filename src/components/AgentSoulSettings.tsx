// Agent Soul Settings Component - Manage personality and memory for AI agents
import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Settings2, Trash2, Plus, Save, X } from 'lucide-react';
import { AgentSoulConfig, AgentPersonality, PERSONALITY_TEMPLATES } from '../types/agentSoul';
import { AgentSoulService } from '../services/AgentSoulService';

interface AgentSoulSettingsProps {
  agentId: string;
  agentName: string;
  onSave?: () => void;
}

export const AgentSoulSettings: React.FC<AgentSoulSettingsProps> = ({
  agentId,
  agentName,
  onSave
}) => {
  const [soul, setSoul] = useState<AgentSoulConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'personality' | 'memory'>('personality');
  const [newMemory, setNewMemory] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<'keyFacts' | 'preferences' | 'relationships' | 'decisions'>('keyFacts');

  useEffect(() => {
    loadSoul();
  }, [agentId]);

  const loadSoul = async () => {
    const loadedSoul = await AgentSoulService.getOrCreateSoul(agentId, agentName);
    setSoul(loadedSoul);
  };

  const updatePersonality = async (updates: Partial<AgentPersonality>) => {
    if (!soul) return;
    await AgentSoulService.updatePersonality(agentId, updates);
    await loadSoul();
  };

  const addMemory = async () => {
    if (!newMemory.trim() || !soul) return;
    await AgentSoulService.addMemory(agentId, memoryCategory, newMemory.trim());
    setNewMemory('');
    await loadSoul();
  };

  const applyTemplate = async (templateName: string) => {
    const template = PERSONALITY_TEMPLATES[templateName];
    if (!template) return;
    
    await updatePersonality({
      vibe: template.vibe || '',
      tone: template.tone || '',
      coreTruths: template.coreTruths || [],
      boundaries: template.boundaries || [],
      responseStyle: template.responseStyle || {
        beConcise: false,
        useMarkdown: true,
        showReasoning: true,
        askFollowUp: false
      }
    });
  };

  if (!soul) {
    return <div className="text-gray-400">Loading...</div>;
  }

  const memoryCategories = [
    { key: 'keyFacts' as const, label: 'Key Facts', placeholder: 'e.g., User works on blockchain projects' },
    { key: 'preferences' as const, label: 'Preferences', placeholder: 'e.g., Prefers TypeScript over JavaScript' },
    { key: 'relationships' as const, label: 'Relationships', placeholder: 'e.g., Has 2 cats named Luna and Mars' },
    { key: 'decisions' as const, label: 'Decisions', placeholder: 'e.g., Chose Next.js over Remix for the project' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h4 className="font-medium text-gray-100">Agent Soul</h4>
          <span className="text-xs text-gray-500">v{soul.memory.version}</span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('personality')}
          className={`px-3 py-2 text-sm transition-colors ${
            activeTab === 'personality'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Personality
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`px-3 py-2 text-sm transition-colors ${
            activeTab === 'memory'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Memory
        </button>
      </div>

      {/* Personality Tab */}
      {activeTab === 'personality' && (
        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Personality Template</label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(PERSONALITY_TEMPLATES).map((template) => (
                <button
                  key={template}
                  onClick={() => applyTemplate(template)}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {template.charAt(0).toUpperCase() + template.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Vibe</label>
            <input
              type="text"
              value={soul.personality.vibe}
              onChange={(e) => updatePersonality({ vibe: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              placeholder="e.g., Helpful, clear, direct"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tone</label>
            <input
              type="text"
              value={soul.personality.tone}
              onChange={(e) => updatePersonality({ tone: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              placeholder="e.g., Professional but approachable"
            />
          </div>

          {/* Core Truths */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Core Truths</label>
            <div className="space-y-2">
              {soul.personality.coreTruths.map((truth, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">• {truth}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Boundaries */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Boundaries</label>
            <div className="space-y-2">
              {soul.personality.boundaries.map((boundary, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">• {boundary}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Style */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Response Style</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soul.personality.responseStyle.beConcise}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality.responseStyle, beConcise: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Be concise</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soul.personality.responseStyle.useMarkdown}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality.responseStyle, useMarkdown: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Use markdown</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soul.personality.responseStyle.showReasoning}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality.responseStyle, showReasoning: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Show reasoning</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soul.personality.responseStyle.askFollowUp}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality.responseStyle, askFollowUp: e.target.checked }
                  })}
                  className="rounded"
                />
                <span className="text-sm text-gray-300">Ask follow-up questions</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Memory Tab */}
      {activeTab === 'memory' && (
        <div className="space-y-4">
          {/* Add Memory */}
          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Add Memory</label>
            <div className="flex gap-2">
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value as typeof memoryCategory)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {memoryCategories.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder={memoryCategories.find(c => c.key === memoryCategory)?.placeholder}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                onClick={addMemory}
                disabled={!newMemory.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Memory Categories */}
          {memoryCategories.map((cat) => {
            const memories = soul.memory.longTerm[cat.key];
            if (memories.length === 0) return null;
            
            return (
              <div key={cat.key} className="space-y-2">
                <label className="block text-sm text-gray-400">{cat.label}</label>
                <div className="space-y-1">
                  {memories.map((memory, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span className="text-sm text-gray-300 flex-1">{memory}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Recent Context */}
          {soul.memory.recent.lastTopics.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Recent Topics</label>
              <div className="flex gap-2 flex-wrap">
                {soul.memory.recent.lastTopics.map((topic, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-gray-700 rounded-full text-gray-300">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* System Prompt Preview */}
      {isEditing && (
        <div className="space-y-2">
          <label className="block text-sm text-gray-400">Generated System Prompt</label>
          <pre className="p-3 bg-gray-800 rounded-lg text-xs text-gray-300 overflow-auto max-h-48">
            {AgentSoulService.generateSystemPrompt(soul)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AgentSoulSettings;