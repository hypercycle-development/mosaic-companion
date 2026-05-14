/**
 * Preload script for the CIP-30 bridge window.
 * Provides a minimal bridgeAPI that posts messages back to the main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeAPI', {
  /**
   * @param {string} type
   * @param {any} data
   */
  report: (type, data) => {
    ipcRenderer.send('bridge:report', { type, data });
  },
});
