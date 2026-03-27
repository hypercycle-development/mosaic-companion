/**
 * Ollama Models Plugin - Renderer
 * React component for Ollama model management
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Download, Trash2, RefreshCw, Check } from 'lucide-react';

const POPULAR_MODELS = [
  { name: 'llama3', description: 'Meta Llama 3 - Latest general purpose' },
  { name: 'llama2', description: 'Meta Llama 2 - General purpose' },
  { name: 'mistral', description: 'Mistral 7B - Efficient' },
  { name: 'codellama', description: 'Code Llama - Code generation' },
  { name: 'phi3', description: 'Microsoft Phi-3 - Small & capable' },
];

export function OllamaModelsView() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.electronAPI?.ollama) {
        const result = await window.electronAPI.ollama['list-models']();
        if (result.success) {
          setModels(result.models || []);
        } else {
          setError(result.error || 'Failed to load models');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async (modelName: string) => {
    setPulling(modelName);
    setError(null);
    try {
      if (window.electronAPI?.ollama) {
        const result = await window.electronAPI.ollama['pull-model'](modelName);
        if (result.success) {
          await loadModels();
        } else {
          setError(result.error || 'Failed to pull model');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPulling(null);
    }
  };

  const handleDelete = async (modelName: string) => {
    if (!confirm(`Delete ${modelName}?`)) return;
    try {
      if (window.electronAPI?.ollama) {
        await window.electronAPI.ollama['delete-model'](modelName);
        await loadModels();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="ollama-models-panel">
      <div className="panel-header">
        <h3><Cpu size={20} /> Ollama Models</h3>
        <button className="refresh-btn" onClick={loadModels} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="installed-section">
        <h4>Installed Models ({models.length})</h4>
        {models.length === 0 ? (
          <div className="empty">No models installed. Pull one below.</div>
        ) : (
          <div className="model-list">
            {models.map(model => (
              <div key={model.name} className="model-item">
                <div className="model-info">
                  <span className="name">{model.name}</span>
                  <span className="size">{(model.size / 1e9).toFixed(1)} GB</span>
                </div>
                <button className="delete-btn" onClick={() => handleDelete(model.name)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pull-section">
        <h4>Pull New Model</h4>
        <div className="model-list">
          {POPULAR_MODELS.map(model => {
            const isInstalled = models.some(m => m.name.startsWith(model.name));
            const isPulling = pulling === model.name;
            return (
              <div key={model.name} className="model-item">
                <div className="model-info">
                  <span className="name">{model.name}</span>
                  <span className="desc">{model.description}</span>
                </div>
                <button
                  className="pull-btn"
                  onClick={() => handlePull(model.name)}
                  disabled={isInstalled || isPulling}
                >
                  {isPulling ? <RefreshCw size={14} className="spinning" /> : 
                   isInstalled ? <Check size={14} /> : <Download size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .ollama-models-panel { padding: 20px; background: #1a1a2e; border-radius: 12px; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .refresh-btn { background: #333; border: none; border-radius: 6px; padding: 8px; color: #fff; cursor: pointer; }
        .installed-section, .pull-section { margin-bottom: 20px; }
        h4 { color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; }
        .model-list { display: flex; flex-direction: column; gap: 8px; }
        .model-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #333; border-radius: 8px; }
        .model-info { display: flex; flex-direction: column; }
        .model-info .name { font-weight: 600; }
        .model-info .size, .model-info .desc { font-size: 12px; color: #888; }
        .pull-btn, .delete-btn { background: #444; border: none; border-radius: 6px; padding: 8px; color: #fff; cursor: pointer; }
        .pull-btn:disabled { opacity: 0.5; }
        .empty { color: #666; text-align: center; padding: 20px; }
        .error { background: #3d1a1a; border: 1px solid #ff4757; border-radius: 8px; padding: 12px; color: #ff6b81; margin-bottom: 16px; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default OllamaModelsView;