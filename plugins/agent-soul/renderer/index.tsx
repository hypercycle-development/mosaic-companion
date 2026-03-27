/**
 * Agent Soul Plugin - Renderer
 * React component for managing agent personality and memory
 */

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Trash2, Plus, Save, X } from 'lucide-react';

const PERSONALITY_TEMPLATES = [
  { id: 'default', name: 'Default', vibe: 'Helpful, clear, direct' },
  { id: 'assistant', name: 'Assistant', vibe: 'Helpful, proactive, resourceful' },
  { id: 'coder', name: 'Coder', vibe: 'Precise, efficient, technical' },
  { id: 'analyst', name: 'Analyst', vibe: 'Analytical, thorough, objective' },
  { id: 'creative', name: 'Creative', vibe: 'Creative, imaginative, expressive' },
];

const MEMORY_CATEGORIES = [
  { key: 'keyFacts', label: 'Key Facts', placeholder: 'e.g., User works on blockchain projects' },
  { key: 'preferences', label: 'Preferences', placeholder: 'e.g., Prefers TypeScript over JavaScript' },
  { key: 'relationships', label: 'Relationships', placeholder: 'e.g., Has 2 cats named Luna and Mars' },
  { key: 'decisions', label: 'Decisions', placeholder: 'e.g., Chose Next.js over Remix for the project' },
];

interface AgentSoulViewProps {
  agentId: string;
  agentName: string;
  onSave?: () => void;
}

export function AgentSoulView({ agentId, agentName, onSave }: AgentSoulViewProps) {
  const [soul, setSoul] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'personality' | 'memory'>('personality');
  const [newMemory, setNewMemory] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<'keyFacts'>('keyFacts');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSoul();
  }, [agentId]);

  const loadSoul = async () => {
    if (window.electronAPI?.agentsoul) {
      const result = await window.electronAPI.agentsoul['get'](agentId);
      if (result) {
        setSoul(result);
      } else {
        // Create new soul
        const newSoul = await window.electronAPI.agentsoul['create'](agentId, agentName);
        setSoul(newSoul);
      }
    }
  };

  const updatePersonality = async (updates: any) => {
    if (window.electronAPI?.agentsoul) {
      const result = await window.electronAPI.agentsoul['update-personality'](agentId, updates);
      if (result) {
        setSoul(result);
      }
    }
  };

  const addMemory = async () => {
    if (!newMemory.trim() || !window.electronAPI?.agentsoul) return;
    
    await window.electronAPI.agentsoul['add-memory'](agentId, memoryCategory, newMemory.trim());
    setNewMemory('');
    await loadSoul();
  };

  const applyTemplate = async (templateId: string) => {
    const template = PERSONALITY_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    await updatePersonality({
      vibe: template.vibe,
      tone: 'Professional but approachable',
      coreTruths: [],
      boundaries: []
    });
  };

  if (!soul) {
    return <div className="soul-loading">Loading...</div>;
  }

  return (
    <div className="agent-soul-panel">
      <div className="soul-header">
        <Brain size={20} className="text-purple-400" />
        <h3>Agent Soul</h3>
        <span className="agent-name">{agentName}</span>
      </div>

      <div className="soul-tabs">
        <button 
          className={`tab ${activeTab === 'personality' ? 'active' : ''}`}
          onClick={() => setActiveTab('personality')}
        >
          Personality
        </button>
        <button 
          className={`tab ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => setActiveTab('memory')}
        >
          Memory
        </button>
      </div>

      {activeTab === 'personality' && (
        <div className="personality-tab">
          <div className="template-section">
            <label>Apply Template</label>
            <select onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Select template...</option>
              {PERSONALITY_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="personality-fields">
            <div className="field">
              <label>Vibe</label>
              <input
                value={soul.personality?.vibe || ''}
                onChange={(e) => updatePersonality({ vibe: e.target.value })}
                placeholder="e.g., Helpful, clear, direct"
              />
            </div>

            <div className="field">
              <label>Tone</label>
              <input
                value={soul.personality?.tone || ''}
                onChange={(e) => updatePersonality({ tone: e.target.value })}
                placeholder="e.g., Professional but approachable"
              />
            </div>

            <div className="field">
              <label>Core Truths</label>
              <div className="list">
                {(soul.personality?.coreTruths || []).map((truth: string, i: number) => (
                  <div key={i} className="list-item">
                    <span>{truth}</span>
                    <button className="remove-btn" onClick={() => {
                      const truths = [...(soul.personality?.coreTruths || [])];
                      truths.splice(i, 1);
                      updatePersonality({ coreTruths: truths });
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <input
                placeholder="Add a core truth..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    updatePersonality({
                      coreTruths: [...(soul.personality?.coreTruths || []), (e.target as HTMLInputElement).value.trim()]
                    });
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>

            <div className="field">
              <label>Boundaries</label>
              <div className="list">
                {(soul.personality?.boundaries || []).map((boundary: string, i: number) => (
                  <div key={i} className="list-item">
                    <span>{boundary}</span>
                    <button className="remove-btn" onClick={() => {
                      const boundaries = [...(soul.personality?.boundaries || [])];
                      boundaries.splice(i, 1);
                      updatePersonality({ boundaries });
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <input
                placeholder="Add a boundary..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    updatePersonality({
                      boundaries: [...(soul.personality?.boundaries || []), (e.target as HTMLInputElement).value.trim()]
                    });
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
          </div>

          <div className="response-style">
            <label>Response Style</label>
            <div className="checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={soul.personality?.responseStyle?.beConcise || false}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality?.responseStyle, beConcise: e.target.checked }
                  })}
                />
                Be concise
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={soul.personality?.responseStyle?.useMarkdown || false}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality?.responseStyle, useMarkdown: e.target.checked }
                  })}
                />
                Use markdown
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={soul.personality?.responseStyle?.showReasoning || false}
                  onChange={(e) => updatePersonality({
                    responseStyle: { ...soul.personality?.responseStyle, showReasoning: e.target.checked }
                  })}
                />
                Show reasoning
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="memory-tab">
          <div className="memory-categories">
            {MEMORY_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className={`category-btn ${memoryCategory === cat.key ? 'active' : ''}`}
                onClick={() => setMemoryCategory(cat.key as any)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="memory-list">
            {(soul.memory?.longTerm?.[memoryCategory] || []).map((item: string, i: number) => (
              <div key={i} className="memory-item">
                <span>{item}</span>
                <button className="remove-btn" onClick={async () => {
                  const memories = [...(soul.memory?.longTerm?.[memoryCategory] || [])];
                  memories.splice(i, 1);
                  // Would need API to remove memory
                }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="add-memory">
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder={MEMORY_CATEGORIES.find(c => c.key === memoryCategory)?.placeholder}
              onKeyDown={(e) => e.key === 'Enter' && addMemory()}
            />
            <button onClick={addMemory} disabled={!newMemory.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      )}

      <style>{`
        .agent-soul-panel { padding: 20px; background: #1a1a2e; border-radius: 12px; color: #fff; }
        .soul-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .soul-header h3 { margin: 0; }
        .agent-name { background: #333; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .soul-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab { padding: 8px 16px; background: #333; border: none; border-radius: 6px; color: #888; cursor: pointer; }
        .tab.active { background: #7c3aed; color: #fff; }
        .personality-fields { display: flex; flex-direction: column; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; color: #888; }
        .field input { background: #0d0d1a; border: 1px solid #333; border-radius: 6px; padding: 8px; color: #fff; }
        .list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
        .list-item { display: flex; justify-content: space-between; align-items: center; background: #333; padding: 6px 10px; border-radius: 4px; font-size: 13px; }
        .remove-btn { background: none; border: none; color: #888; cursor: pointer; padding: 4px; }
        .remove-btn:hover { color: #ff4757; }
        .response-style { margin-top: 16px; }
        .checkboxes { display: flex; flex-direction: column; gap: 8px; }
        .checkboxes label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .memory-categories { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .category-btn { padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #888; cursor: pointer; }
        .category-btn.active { background: #7c3aed; color: #fff; }
        .memory-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .memory-item { background: #333; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; }
        .add-memory { display: flex; gap: 8px; }
        .add-memory input { flex: 1; background: #0d0d1a; border: 1px solid #333; border-radius: 6px; padding: 8px; color: #fff; }
        .add-memory button { display: flex; align-items: center; gap: 6px; background: #7c3aed; border: none; border-radius: 6px; padding: 8px 16px; color: #fff; cursor: pointer; }
        .add-memory button:disabled { opacity: 0.5; }
        .template-section { margin-bottom: 16px; }
        .template-section label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; }
        .template-section select { width: 100%; background: #0d0d1a; border: 1px solid #333; border-radius: 6px; padding: 8px; color: #fff; }
      `}</style>
    </div>
  );
}

export default AgentSoulView;