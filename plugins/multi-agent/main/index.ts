/**
 * Multi-Agent Plugin - Main Process
 * Handles multi-agent orchestration state and coordination
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'multi-agent' });

export function registerMultiAgentIpc() {
  // Get stored agents
  ipcMain.handle('multiagent:get-agents', async () => {
    return store.get('agents', []);
  });

  // Save agents
  ipcMain.handle('multiagent:set-agents', async (_event, agents) => {
    store.set('agents', agents);
    return { success: true };
  });

  // Get orchestration state
  ipcMain.handle('multiagent:get-state', async () => {
    return store.get('orchestrationState', {
      mode: 'parallel',
      isRunning: false,
      currentAgent: null,
      tasks: []
    });
  });

  // Set orchestration state
  ipcMain.handle('multiagent:set-state', async (_event, state) => {
    store.set('orchestrationState', state);
    return { success: true };
  });

  // Get agent history
  ipcMain.handle('multiagent:get-history', async () => {
    return store.get('history', []);
  });

  // Add to history
  ipcMain.handle('multiagent:add-history', async (_event, entry) => {
    const history = store.get('history', []) as any[];
    history.push({ ...entry, timestamp: Date.now() });
    // Keep last 100 entries
    if (history.length > 100) history.shift();
    store.set('history', history);
    return { success: true };
  });

  console.log('[MultiAgent] IPC handlers registered');
}