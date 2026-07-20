/**
 * Minimal Cardano CIP-30 IPC handlers
 *
 * Routes legacy `cardano:*` renderer requests to the same in-process
 * WebView bridge used by the 1AM wallet. This satisfies the
 * window.electronAPI.cardano.* surface exposed in preload.ts.
 */

import { ipcMain } from 'electron';
import {
  bridgeDetectWallets,
  bridgeConnectWallet,
  bridgeDisconnect,
} from '../oneam/CIP30WebViewBridge';

interface WalletResult {
  success: boolean;
  data?: any;
  error?: string;
}

export function registerCardanoIpc(): void {
  console.log('[CardanoIPC] Registering cardano:* handlers');

  ipcMain.handle('cardano:detectWallets', async (): Promise<WalletResult> => {
    try {
      const detected = await bridgeDetectWallets();
      return {
        success: true,
        data: {
          available: detected.available,
          wallets: detected.wallets,
        },
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Wallet detection failed' };
    }
  });

  ipcMain.handle('cardano:connectWallet', async (_event, walletKey: string): Promise<WalletResult> => {
    try {
      const result = await bridgeConnectWallet(walletKey);
      return {
        success: result.success,
        data: {
          connected: result.success,
          walletName: result.walletName,
          address: result.address,
          networkId: result.networkId,
          lovelace: result.lovelace,
          assets: result.assets,
        },
        error: result.error,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Wallet connection failed' };
    }
  });

  ipcMain.handle('cardano:disconnectWallet', async (): Promise<WalletResult> => {
    await bridgeDisconnect().catch(() => {});
    return { success: true };
  });

  ipcMain.handle('cardano:getWalletAssets', async (): Promise<WalletResult> => {
    return {
      success: true,
      data: { assets: [] },
    };
  });

  ipcMain.handle('cardano:getBridgeStatus', async (): Promise<WalletResult> => {
    return {
      success: true,
      data: { connected: false },
    };
  });
}
