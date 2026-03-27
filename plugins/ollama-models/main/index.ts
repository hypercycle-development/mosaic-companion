/**
 * Ollama Models Plugin - Main Process
 * Handles local LLM model management via Ollama API
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'ollama-models' });
const OLLAMA_API = 'http://localhost:11434';

export function registerOllamaIpc(ipcMain: typeof import('electron').ipcMain) {
  // Get installed models
  ipcMain.handle('ollama:list-models', async () => {
    try {
      const response = await fetch(`${OLLAMA_API}/api/tags`);
      const data = await response.json();
      return { success: true, models: data.models || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Pull model
  ipcMain.handle('ollama:pull-model', async (_event, modelName) => {
    try {
      const response = await fetch(`${OLLAMA_API}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false })
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete model
  ipcMain.handle('ollama:delete-model', async (_event, modelName) => {
    try {
      const response = await fetch(`${OLLAMA_API}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      });
      return { success: response.ok };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get stored model preferences
  ipcMain.handle('ollama:get-preferences', async () => {
    return store.get('preferences', {
      defaultModel: 'llama3',
      cloudModels: [],
      apiKeyConfigured: false
    });
  });

  // Set model preferences
  ipcMain.handle('ollama:set-preferences', async (_event, prefs) => {
    store.set('preferences', prefs);
    return { success: true };
  });

  // Check Ollama status
  ipcMain.handle('ollama:status', async () => {
    try {
      const response = await fetch(`${OLLAMA_API}/api/version`);
      const data = await response.json();
      return { success: true, running: true, version: data.version };
    } catch {
      return { success: true, running: false, version: null };
    }
  });

  console.log('[Ollama] IPC handlers registered');
}