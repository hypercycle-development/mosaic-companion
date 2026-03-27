/**
 * Model Selector Component
 * Ollama model selection and management UI
 * Supports both local and cloud models (MiniMax, OpenAI, Anthropic)
 */

import React, { useState, useEffect } from 'react';
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
  const [availableModels] = useState([
    { name: 'llama2', description: 'Meta Llama 2 - General purpose' },
    { name: 'llama2:13b', description: 'Llama 2 13B - More capable' },
    { name: 'llama3', description: 'Meta Llama 3 - Latest' },
    { name: 'llama3:8b', description: 'Llama 3 8B - Fast' },
    { name: 'mistral', description: 'Mistral 7B - Efficient' },
    { name: 'codellama', description: 'Code Llama - Code generation' },
    { name: 'codellama:13b', description: 'Code Llama 13B' },
    { name: 'neural-chat', description: 'Neural Chat - conversational' },
    { name: 'orca-mini', description: 'Orca Mini - Lightweight' },
    { name: 'phi3', description: 'Microsoft Phi-3 - Small & capable' },
    { name: 'qwen', description: 'Qwen - Alibaba' },
    { name: 'aya', description: 'Aya - Cohere' },
    { name: 'solar', description: 'Solar - Upstage' },
    { name: 'wizardlm2', description: 'WizardLM 2 - Microsoft' }
  ]);
  const [cloudModels] = useState([
    { name: 'minimax-m2.5:cloud', provider: 'MiniMax', description: 'MiniMax M2.5 - High performance cloud inference' },
    { name: 'openai/gpt-4', provider: 'OpenAI via Ollama', description: 'OpenAI GPT-4 (via Ollama gateway)' },
    { name: 'openai/gpt-3.5-turbo', provider: 'OpenAI via Ollama', description: 'OpenAI GPT-3.5 Turbo (via Ollama gateway)' }
  ]);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    try {
      const loadedModels = await ollamaService.listModels();
      setModels(loadedModels);
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

  if (loading) {
    return <div className="model-selector loading">Loading models...</div>;
  }

  if (error && models.length === 0) {
    return (
      <div className="model-selector error">
        <div className="error-message">{error}</div>
        <div className="ollama-status">
          <span className="status-indicator offline"></span>
          Ollama not available
        </div>
        <div className="start-instructions">
          Run: <code>ollama serve</code>
        </div>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div className="selector-header">
        <h3>Select Model</h3>
        <button onClick={loadModels} className="refresh-btn">
          ⟳ Refresh
        </button>
      </div>

      <div className="current-model">
        <label>Current:</label>
        <select 
          value={selectedModel} 
          onChange={(e) => handleSelect(e.target.value)}
        >
          {models.map(model => (
            <option key={model.name} value={model.name}>
              {model.name} ({formatSize(model.size)})
            </option>
          ))}
        </select>
      </div>

      {pulling && (
        <div className="pull-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '50%' }}></div>
          </div>
          <span className="progress-text">{pullProgress}</span>
        </div>
      )}

      <div className="installed-models">
        <h4>Installed Models ({models.length})</h4>
        <div className="model-list">
          {models.map(model => (
            <div 
              key={model.name} 
              className={`model-item ${selectedModel === model.name ? 'selected' : ''}`}
              onClick={() => handleSelect(model.name)}
            >
              <div className="model-name">{model.name}</div>
              <div className="model-size">{formatSize(model.size)}</div>
              <button 
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(model.name);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="available-models">
        <h4>Pull New Model</h4>
        <div className="model-list">
          {availableModels.map((m: { name: string; description: string }) => {
            const isInstalled = models.some(pm => pm.name.startsWith(m.name));
            return (
              <div key={m.name} className="model-item available">
                <div className="model-name">{m.name}</div>
                <div className="model-desc">{m.description}</div>
                <button 
                  className="pull-btn"
                  onClick={() => handlePullModel(m.name)}
                  disabled={pulling || isInstalled}
                >
                  {isInstalled ? 'Installed' : 'Pull'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Models Section */}
      <div className="cloud-models">
        <h4>☁️ Cloud Models (Requires OLLAMA_API_KEY)</h4>
        
        {!apiKeyConfigured ? (
          <div className="api-key-prompt">
            <button 
              className="configure-api-btn"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            >
              {showApiKeyInput ? 'Cancel' : 'Configure OLLAMA_API_KEY'}
            </button>
            
            {showApiKeyInput && (
              <div className="api-key-input">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                />
                <button onClick={handleSetApiKey} className="save-btn">
                  Save to Env
                </button>
              </div>
            )}
            <p className="api-key-help">
              Set <code>OLLAMA_API_KEY</code> env variable.<br/>
              Get key from{' '}
              <a href="https://platform.minimax.chat/" target="_blank" rel="noopener">
                MiniMax Platform
              </a>
            </p>
          </div>
        ) : (
          <div className="api-key-configured">
            <span className="status-indicator online"></span>
            API Key Configured
            <button 
              className="change-btn"
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

        <div className="model-list">
          {cloudModels.map((m: { name: string; provider: string; description: string }) => (
            <div 
              key={m.name} 
              className={`model-item cloud ${selectedModel === m.name ? 'selected' : ''} ${!apiKeyConfigured ? 'disabled' : ''}`}
              onClick={() => {
                if (apiKeyConfigured) {
                  handleSelect(m.name);
                }
              }}
            >
              <div className="model-provider">{m.provider}</div>
              <div className="model-name">{m.name}</div>
              <div className="model-desc">{m.description}</div>
              {!apiKeyConfigured && (
                <span className="requires-key">🔒 Requires API Key</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;