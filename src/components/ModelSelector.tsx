/**
 * Model Selector Component
 * Ollama model selection and management UI
 * Supports both local and cloud models (MiniMax, OpenAI, Anthropic)
 * 
 * Refactored: Contained scrollable panel with clean hierarchy
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Trash2, Check, Lock, Search, Cloud, Server } from 'lucide-react';
import { ollamaService, OllamaModel } from '../services/OllamaService';

interface ModelSelectorProps {
  onSelect?: (model: string) => void;
  defaultModel?: string;
  onApiKeyChange?: (hasKey: boolean) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  onSelect,
  defaultModel = 'llama3',
  onApiKeyChange
}) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'installed' | 'pull' | 'cloud'>('installed');

  const availableModels = [
    { name: 'llama2', description: 'Meta Llama 2 - General purpose', size: '4GB' },
    { name: 'llama2:13b', description: 'Llama 2 13B - More capable', size: '7GB' },
    { name: 'llama3', description: 'Meta Llama 3 - Latest', size: '4.7GB' },
    { name: 'llama3:8b', description: 'Llama 3 8B - Fast', size: '4.7GB' },
    { name: 'mistral', description: 'Mistral 7B - Efficient', size: '4.1GB' },
    { name: 'codellama', description: 'Code Llama - Code generation', size: '4GB' },
    { name: 'codellama:13b', description: 'Code Llama 13B', size: '7GB' },
    { name: 'neural-chat', description: 'Neural Chat - Conversational', size: '4GB' },
    { name: 'phi3', description: 'Microsoft Phi-3 - Small & capable', size: '2GB' },
    { name: 'qwen', description: 'Qwen - Alibaba', size: '4GB' },
    { name: 'aya', description: 'Aya - Cohere', size: '4GB' },
    { name: 'solar', description: 'Solar - Upstage', size: '4GB' },
    { name: 'wizardlm2', description: 'WizardLM 2 - Microsoft', size: '4GB' }
  ];

  const cloudModels = [
    { name: 'minimax-m2.5:cloud', provider: 'MiniMax', description: 'High performance cloud inference' },
    { name: 'openai/gpt-4', provider: 'OpenAI', description: 'GPT-4 via Ollama gateway' },
    { name: 'openai/gpt-3.5-turbo', provider: 'OpenAI', description: 'GPT-3.5 Turbo via Ollama gateway' }
  ];

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    try {
      const loadedModels = await ollamaService.listModels();
      setModels(loadedModels);
      setError(null);
    } catch (err: any) {
      setError('Ollama not running. Start with: ollama serve');
    }
    setLoading(false);
  };

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      ollamaService.setApiKey(apiKey.trim());
      setApiKeyConfigured(true);
      setShowApiKeyInput(false);
      onApiKeyChange?.(true);
    }
  };

  const handlePullModel = async (modelName: string) => {
    setPulling(true);
    setPullProgress('Starting pull...');
    try {
      await ollamaService.pullModel(modelName, (progress: string) => {
        setPullProgress(progress);
      });
      await loadModels();
      setPullProgress(null);
    } catch (err: any) {
      setError(err.message);
    }
    setPulling(false);
  };

  const handleSelect = (modelName: string) => {
    setSelectedModel(modelName);
    onSelect?.(modelName);
  };

  const handleDelete = async (modelName: string) => {
    if (!confirm(`Delete ${modelName}?`)) return;
    try {
      await ollamaService.deleteModel(modelName);
      await loadModels();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const filteredAvailable = availableModels.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Error state
  if (error && models.length === 0) {
    return (
      <div className="model-selector-error">
        <Server className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">{error}</p>
        <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-2 inline-block">ollama serve</code>
      </div>
    );
  }

  return (
    <div className="model-selector-panel">
      {/* Top Controls - Always Visible */}
      <div className="model-selector-header">
        <div className="header-row">
          <div className="current-model-select">
            <label className="text-xs text-gray-500 mb-1 block">Active Model</label>
            <select 
              value={selectedModel} 
              onChange={(e) => handleSelect(e.target.value)}
              className="model-dropdown"
            >
              {models.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name} ({formatSize(model.size)})
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={loadModels} 
            disabled={loading}
            className="refresh-button"
            title="Refresh models"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Pull Progress */}
        {pulling && pullProgress && (
          <div className="pull-progress-bar">
            <div className="progress-label">{pullProgress}</div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="model-tabs">
        <button
          className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Installed</span>
          {models.length > 0 && <span className="tab-badge">{models.length}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'pull' ? 'active' : ''}`}
          onClick={() => setActiveTab('pull')}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Pull New</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'cloud' ? 'active' : ''}`}
          onClick={() => setActiveTab('cloud')}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloud</span>
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="model-content-scroll">
        {/* Installed Models Tab */}
        {activeTab === 'installed' && (
          <div className="model-section">
            {models.length === 0 ? (
              <div className="empty-state">
                <Server className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No models installed</p>
                <p className="text-gray-600 text-xs mt-1">Pull a model to get started</p>
              </div>
            ) : (
              <div className="model-list">
                {models.map(model => (
                  <div 
                    key={model.name} 
                    className={`model-row ${selectedModel === model.name ? 'selected' : ''}`}
                    onClick={() => handleSelect(model.name)}
                  >
                    <div className="model-info">
                      <span className="model-name">{model.name}</span>
                      <span className="model-size-badge">{formatSize(model.size)}</span>
                    </div>
                    <div className="model-actions">
                      {selectedModel === model.name && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                      <button 
                        className="delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(model.name);
                        }}
                        title="Delete model"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pull New Model Tab */}
        {activeTab === 'pull' && (
          <div className="model-section">
            <div className="search-input-wrapper">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="model-list">
              {filteredAvailable.map(m => {
                const isInstalled = models.some(pm => pm.name === m.name || pm.name.startsWith(m.name.split(':')[0]));
                return (
                  <div key={m.name} className="model-row available">
                    <div className="model-info">
                      <span className="model-name">{m.name}</span>
                      <span className="model-desc">{m.description}</span>
                    </div>
                    <div className="model-actions">
                      <span className="size-hint">{m.size}</span>
                      <button 
                        className={`pull-button ${isInstalled ? 'installed' : ''}`}
                        onClick={() => handlePullModel(m.name)}
                        disabled={pulling || isInstalled}
                      >
                        {isInstalled ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cloud Models Tab */}
        {activeTab === 'cloud' && (
          <div className="model-section">
            {/* API Key Section */}
            <div className="api-key-section">
              {!apiKeyConfigured ? (
                <div className="api-key-prompt">
                  {showApiKeyInput ? (
                    <div className="api-key-input-row">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter OLLAMA_API_KEY..."
                        className="api-key-field"
                      />
                      <button onClick={handleSetApiKey} className="save-key-btn">
                        Save
                      </button>
                      <button onClick={() => setShowApiKeyInput(false)} className="cancel-key-btn">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="configure-key-btn"
                      onClick={() => setShowApiKeyInput(true)}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Configure API Key
                    </button>
                  )}
                  <p className="api-hint">
                    Get key from <a href="https://platform.minimax.chat/" target="_blank" rel="noopener">MiniMax Platform</a>
                  </p>
                </div>
              ) : (
                <div className="api-key-active">
                  <div className="key-status">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>API Key configured</span>
                  </div>
                  <button 
                    className="change-key-btn"
                    onClick={() => {
                      setApiKeyConfigured(false);
                      setApiKey('');
                      onApiKeyChange?.(false);
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Cloud Models List */}
            <div className="model-list">
              {cloudModels.map(m => (
                <div 
                  key={m.name} 
                  className={`model-row cloud ${selectedModel === m.name ? 'selected' : ''} ${!apiKeyConfigured ? 'disabled' : ''}`}
                  onClick={() => apiKeyConfigured && handleSelect(m.name)}
                >
                  <div className="model-info">
                    <span className="provider-label">{m.provider}</span>
                    <span className="model-name">{m.name}</span>
                    <span className="model-desc">{m.description}</span>
                  </div>
                  {!apiKeyConfigured && (
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .model-selector-panel {
          display: flex;
          flex-direction: column;
          background: #0c0c14;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Header - Always Visible */
        .model-selector-header {
          padding: 12px;
          border-bottom: 1px solid #1e1e2e;
          flex-shrink: 0;
        }

        .header-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .current-model-select {
          flex: 1;
        }

        .model-dropdown {
          width: 100%;
          padding: 8px 12px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          color: #e0e0e0;
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }

        .model-dropdown:focus {
          border-color: #6366f1;
        }

        .refresh-button {
          padding: 8px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #1e1e2e;
          color: #e0e0e0;
        }

        .refresh-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pull-progress-bar {
          margin-top: 8px;
          padding: 6px 10px;
          background: #1e1e2e;
          border-radius: 4px;
        }

        .progress-label {
          font-size: 11px;
          color: #9ca3af;
        }

        /* Tab Navigation */
        .model-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          background: #0a0a12;
          border-bottom: 1px solid #1e1e2e;
          flex-shrink: 0;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: #16161e;
          color: #9ca3af;
        }

        .tab-btn.active {
          background: #1e1e2e;
          color: #e0e0e0;
        }

        .tab-badge {
          background: #374151;
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }

        .tab-btn.active .tab-badge {
          background: #4f46e5;
        }

        /* Scrollable Content */
        .model-content-scroll {
          max-height: 280px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: #3b3b4f transparent;
        }

        .model-content-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .model-content-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .model-content-scroll::-webkit-scrollbar-thumb {
          background: #3b3b4f;
          border-radius: 3px;
        }

        .model-content-scroll::-webkit-scrollbar-thumb:hover {
          background: #4b4b5f;
        }

        /* Model Section */
        .model-section {
          padding: 8px;
        }

        /* Search Input */
        .search-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          margin-bottom: 8px;
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #e0e0e0;
          font-size: 12px;
          outline: none;
        }

        .search-input::placeholder {
          color: #6b7280;
        }

        /* Model List */
        .model-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        /* Model Row */
        .model-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: #12121a;
          border: 1px solid #1e1e2e;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .model-row:hover {
          background: #1a1a24;
          border-color: #2a2a3e;
        }

        .model-row.selected {
          background: #1e1e2e;
          border-color: #4f46e5;
        }

        .model-row.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .model-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .model-name {
          font-size: 12px;
          font-weight: 500;
          color: #e0e0e0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .model-size-badge {
          font-size: 10px;
          color: #6b7280;
          background: #1e1e2e;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .model-desc {
          font-size: 10px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .model-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .delete-button {
          padding: 4px;
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .delete-button:hover {
          background: #3b1f1f;
          color: #f87171;
        }

        .pull-button {
          padding: 4px 8px;
          background: #1e3a1e;
          border: 1px solid #2d4a2d;
          border-radius: 4px;
          color: #4ade80;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .pull-button:hover:not(:disabled) {
          background: #2d4a2d;
        }

        .pull-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pull-button.installed {
          background: #1e1e2e;
          border-color: #2a2a3e;
          color: #6b7280;
        }

        .size-hint {
          font-size: 10px;
          color: #6b7280;
        }

        /* Available Model Row */
        .model-row.available .model-info {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        /* Cloud Model Row */
        .model-row.cloud .model-info {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .provider-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #8b5cf6;
          background: #1e1e2e;
          padding: 1px 4px;
          border-radius: 2px;
        }

        /* API Key Section */
        .api-key-section {
          padding: 8px;
          margin-bottom: 4px;
          background: #0a0a12;
          border-radius: 6px;
        }

        .api-key-prompt {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .configure-key-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .configure-key-btn:hover {
          background: #1e1e2e;
          color: #e0e0e0;
        }

        .api-key-input-row {
          display: flex;
          gap: 6px;
        }

        .api-key-field {
          flex: 1;
          padding: 8px 10px;
          background: #16161e;
          border: 1px solid #2a2a3e;
          border-radius: 4px;
          color: #e0e0e0;
          font-size: 12px;
          outline: none;
        }

        .api-key-field:focus {
          border-color: #4f46e5;
        }

        .save-key-btn {
          padding: 8px 12px;
          background: #4f46e5;
          border: none;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          cursor: pointer;
        }

        .cancel-key-btn {
          padding: 8px 12px;
          background: transparent;
          border: 1px solid #2a2a3e;
          border-radius: 4px;
          color: #9ca3af;
          font-size: 12px;
          cursor: pointer;
        }

        .api-hint {
          font-size: 10px;
          color: #6b7280;
        }

        .api-hint a {
          color: #818cf8;
          text-decoration: none;
        }

        .api-key-active {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .key-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #4ade80;
        }

        .change-key-btn {
          padding: 4px 8px;
          background: transparent;
          border: 1px solid #2a2a3e;
          border-radius: 4px;
          color: #9ca3af;
          font-size: 11px;
          cursor: pointer;
        }

        .change-key-btn:hover {
          background: #1e1e2e;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 24px 16px;
        }

        /* Error State */
        .model-selector-error {
          text-align: center;
          padding: 20px;
          background: #12121a;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default ModelSelector;