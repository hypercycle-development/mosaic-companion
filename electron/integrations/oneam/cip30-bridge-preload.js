/**
 * Preload script for the 1AM CIP-30 bridge window.
 * Provides a minimal bridgeAPI that posts messages back to the main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  report: (type, data) => {
    ipcRenderer.send('bridge:report', { type, data });
  },
});
