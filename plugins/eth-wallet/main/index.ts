/**
 * ETH Wallet Plugin - Main Process
 * Handles Ethereum and BASE wallet connections with ANFE support
 */

import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'eth-wallet' });

// Supported networks
const NETWORKS = {
  ethereum: { chainId: 1, name: 'Ethereum Mainnet' },
  base: { chainId: 8453, name: 'Base' },
  'base-sepolia': { chainId: 84532, name: 'Base Sepolia' }
};

// ANFE Contract on Base
const ANFE_CONTRACT = '0x8c0075D087de9588DdF5c1441dF39828d695bc2f';

export function registerEthWalletIpc() {
  // Get stored wallet state
  ipcMain.handle('ethwallet:get-state', async () => {
    return store.get('walletState', {
      connected: false,
      address: null,
      chainId: null,
      balance: '0',
      network: null
    });
  });

  // Store wallet state
  ipcMain.handle('ethwallet:set-state', async (_event, state) => {
    store.set('walletState', state);
    return { success: true };
  });

  // Clear wallet state
  ipcMain.handle('ethwallet:disconnect', async () => {
    store.set('walletState', {
      connected: false,
      address: null,
      chainId: null,
      balance: '0',
      network: null
    });
    return { success: true };
  });

  // Get supported networks
  ipcMain.handle('ethwallet:get-networks', async () => {
    return { success: true, networks: NETWORKS };
  });

  // Get ANFE contract address
  ipcMain.handle('ethwallet:get-anfe-contract', async () => {
    return { success: true, address: ANFE_CONTRACT };
  });

  // Get stored API keys
  ipcMain.handle('ethwallet:get-api-keys', async () => {
    return store.get('apiKeys', {});
  });

  // Store API key
  ipcMain.handle('ethwallet:set-api-key', async (_event, provider, key) => {
    const keys = store.get('apiKeys', {}) as Record<string, string>;
    keys[provider] = key;
    store.set('apiKeys', keys);
    return { success: true };
  });

  console.log('[EthWallet] IPC handlers registered');
}