/**
 * Cardano Wallet Plugin - Main Process
 * Handles CIP-30 wallet connections and HyperSharePass NFT verification
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'cardano-wallet' });

// HyperSharePass Policy ID
const HYPERSHARE_PASS_POLICY_ID = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';

export function registerCardanoWalletIpc(ipcMain: typeof import('electron').ipcMain) {
  // Get stored wallet state
  ipcMain.handle('cardano:get-state', async () => {
    return store.get('walletState', {
      isConnected: false,
      address: null,
      balance: '0',
      hyperSharePassCount: 0
    });
  });

  // Store wallet state
  ipcMain.handle('cardano:set-state', async (_event, state) => {
    store.set('walletState', state);
    return { success: true };
  });

  // Clear wallet state
  ipcMain.handle('cardano:disconnect', async () => {
    store.set('walletState', {
      isConnected: false,
      address: null,
      balance: '0',
      hyperSharePassCount: 0
    });
    return { success: true };
  });

  // Get HyperSharePass policy ID
  ipcMain.handle('cardano:get-policy-id', async () => {
    return { policyId: HYPERSHARE_PASS_POLICY_ID };
  });

  console.log('[CardanoWallet] IPC handlers registered');
}