/**
 * Cardano IPC Handlers for Electron Main Process
 * Bridges Tokeo wallet QR pairing + NFT verification to renderer process
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { qrSessionManager, getCallbackHost } from './TokeoQRBridge';
import { verifyPolicyOwnership, NFTVerificationResult, KoiosConfig } from './NFTVerifier';
import {
  bridgeDetectWallets,
  bridgeConnectWallet,
  bridgeSignTx as legacyBridgeSignTx,
  bridgeDisconnect as legacyBridgeDisconnect,
  getBridgeState,
  isBridgeConnected,
} from './CIP30WebViewBridge';
import {
  discoverChromeWallets,
  connectChromeWallet,
  signTxChrome,
  disconnectChromeWallet,
  isChromeInstalled,
} from './CIP30ChromeBridge';
import {
  isFirefoxInstalled,
  detectFirefoxWallets,
  connectFirefoxWallet,
  disconnectFirefoxWallet,
} from './CIP30FirefoxBridge';

// In-memory store for connected tokeo state (QR-based)
interface TokeoConnectionState {
  connected: boolean;
  address?: string;
  networkId?: number;
  sessionId?: string;
}

let tokeoState: TokeoConnectionState = { connected: false };

const KOIOS_CONFIG: KoiosConfig = {
  network: 'mainnet',
  timeoutMs: 30000,
};

/**
 * Register all Cardano IPC handlers
 */
export function registerCardanoIpc(): void {
  console.log('[CardanoIPC] Registering IPC handlers...');

  // ─── tokeoDetect ───
  ipcMain.handle('cardano:tokeoDetect', async () => {
    // Desktop: no browser extension available; QR is the method
    return {
      success: true,
      data: {
        available: false,
        name: 'Tokeo',
        message: 'Desktop: use QR pairing with Tokeo mobile app',
      },
    };
  });

  // ─── tokeoConnect ───
  ipcMain.handle('cardano:tokeoConnect', async () => {
    // Desktop cannot direct-connect; must use QR
    return {
      success: false,
      error: 'Desktop cannot connect directly. Use QR pairing with Tokeo mobile app.',
    };
  });

  // ─── tokeoQRPairing ───
  ipcMain.handle(
    'cardano:tokeoQRPairing',
    async (_event: IpcMainInvokeEvent, policyIds: string[] = []) => {
      try {
        // Ensure server is running
        const port = await qrSessionManager.startServer();

        const result = qrSessionManager.createSession(policyIds, 'mainnet');

        // Store session ID in state for later polling
        tokeoState = {
          connected: false,
          sessionId: result.sessionId,
        };

        return {
          success: true,
          data: {
            sessionId: result.sessionId,
            uri: result.qrData,
            callbackUrl: result.callbackUrl,
            port,
            host: getCallbackHost(),
          },
        };
      } catch (error: any) {
        console.error('[CardanoIPC] QR pairing error:', error);
        return {
          success: false,
          error: error.message || 'Failed to create QR pairing session',
        };
      }
    }
  );

  // ─── tokeoCheckQR ───
  ipcMain.handle(
    'cardano:tokeoCheckQR',
    async (_event: IpcMainInvokeEvent, sessionId?: string) => {
      try {
        const sid = sessionId || tokeoState.sessionId;
        if (!sid) {
          return {
            success: false,
            error: 'No active QR session',
          };
        }

        const status = qrSessionManager.getSessionStatus(sid);

        if (status.status === 'connected' && status.address) {
          tokeoState = {
            connected: true,
            address: status.address,
            sessionId: sid,
          };

          return {
            success: true,
            data: {
              connected: true,
              address: status.address,
              sessionId: sid,
            },
          };
        }

        if (status.status === 'expired') {
          return {
            success: false,
            error: status.error || 'QR session expired',
          };
        }

        return {
          success: true,
          data: {
            connected: false,
            status: status.status,
          },
        };
      } catch (error: any) {
        console.error('[CardanoIPC] Check QR error:', error);
        return {
          success: false,
          error: error.message || 'Failed to check QR status',
        };
      }
    }
  );

  // ─── tokeoVerifyCollection ───
  ipcMain.handle(
    'cardano:tokeoVerifyCollection',
    async (_event: IpcMainInvokeEvent, policyIds: string[] = [], strict: boolean = false) => {
      try {
        const address = tokeoState.address;
        if (!address) {
          return {
            success: false,
            error: 'No wallet connected. Please connect via QR first.',
          };
        }

        const result: NFTVerificationResult = await verifyPolicyOwnership(
          address,
          policyIds,
          KOIOS_CONFIG
        );

        if (result.error) {
          return {
            success: false,
            error: result.error,
          };
        }

        const hasAll = strict
          ? result.matchedPolicies.length === policyIds.length
          : result.matchedPolicies.length > 0;

        return {
          success: true,
          data: {
            hasAccess: result.hasAccess,
            hasAll,
            matchedPolicies: result.matchedPolicies,
            assets: result.assets,
          },
        };
      } catch (error: any) {
        console.error('[CardanoIPC] Verify collection error:', error);
        return {
          success: false,
          error: error.message || 'Failed to verify NFT collection',
        };
      }
    }
  );

  // ─── tokeoCancelQR ───
  ipcMain.handle(
    'cardano:tokeoCancelQR',
    async (_event: IpcMainInvokeEvent, sessionId?: string) => {
      const sid = sessionId || tokeoState.sessionId;
      if (sid) {
        qrSessionManager.cancelSession(sid);
      }
      tokeoState = { connected: false };
      return { success: true };
    }
  );

  // ─── tokeoStatus ───
  ipcMain.handle('cardano:tokeoStatus', async () => {
    return {
      success: true,
      data: {
        connected: tokeoState.connected,
        address: tokeoState.address,
        networkId: tokeoState.networkId,
      },
    };
  });

  // ─── tokeoDisconnect ───
  ipcMain.handle('cardano:tokeoDisconnect', async () => {
    tokeoState = { connected: false };
    return { success: true };
  });

  // ─── CIP-30 Browser Wallet Bridge (Lace, Eternl, Nami, etc.) ───

  // detectWallets — scan for installed CIP-30 extensions (Chrome + Firefox)
  ipcMain.handle('cardano:detectWallets', async () => {
    try {
      // Priority 1: Chrome/Chromium/Brave/Edge extensions via file-system scan + Chrome bridge
      const chromeResult = await discoverChromeWallets();
      const allWallets = [...chromeResult.wallets];

      // Priority 2: Firefox extensions (Lace, etc.)
      if (isFirefoxInstalled()) {
        const firefoxResult = await detectFirefoxWallets();
        if (firefoxResult.available) {
          for (const fw of firefoxResult.wallets) {
            // Avoid duplicates if same wallet name appears in both
            if (!allWallets.some(w => w.key === fw.key || w.name.toLowerCase() === fw.name.toLowerCase())) {
              allWallets.push(fw);
            }
          }
        }
      }

      return {
        success: true,
        data: {
          available: allWallets.length > 0,
          wallets: allWallets.map(w => ({
            name: w.name,
            key: w.key,
            version: w.version,
          })),
        },
      };
    } catch (error: any) {
      console.error('[CardanoIPC] detectWallets error:', error);
      return { success: false, error: error.message || 'Failed to detect wallets' };
    }
  });

  // connectWallet — enable a specific CIP-30 wallet via bridge (Chrome or Firefox)
  ipcMain.handle('cardano:connectWallet', async (_event, walletKey: string) => {
    try {
      // Priority 1: Chrome/Chromium/Brave/Edge via real browser spawner
      if (isChromeInstalled()) {
        console.log(`[CardanoIPC] Trying Chrome bridge for ${walletKey}...`);
        const chromeResult = await connectChromeWallet(walletKey);
        if (chromeResult.success) {
          tokeoState = {
            connected: true,
            address: chromeResult.address,
            networkId: chromeResult.networkId,
          };
          return {
            success: true,
            data: {
              connected: true,
              walletName: walletKey,
              address: chromeResult.address,
              rewardAddress: chromeResult.rewardAddress,
              networkId: chromeResult.networkId,
              assets: chromeResult.assets || [],
            },
          };
        }
        console.log('[CardanoIPC] Chrome bridge failed:', chromeResult.error);
      }

      // Fallback: try legacy WebView bridge (for users on older systems)
      const legacyResult = await bridgeConnectWallet(walletKey);
      if (legacyResult.success) {
        tokeoState = {
          connected: true,
          address: legacyResult.address || undefined,
          networkId: legacyResult.networkId || undefined,
        };
        return {
          success: true,
          data: {
            connected: true,
            walletName: walletKey,
            address: legacyResult.address,
            rewardAddress: legacyResult.rewardAddress,
            networkId: legacyResult.networkId,
            assets: [],
          },
        };
      }

      // Fallback 2: if Lace and Firefox is installed, try Firefox bridge
      if (walletKey === 'lace' && isFirefoxInstalled()) {
        console.log('[CardanoIPC] Chrome bridge failed, trying Firefox bridge...');
        const firefoxResult = await connectFirefoxWallet(walletKey);
        if (firefoxResult.success) {
          tokeoState = {
            connected: true,
            address: firefoxResult.address || undefined,
            networkId: firefoxResult.networkId || undefined,
          };
          return {
            success: true,
            data: {
              connected: true,
              walletName: 'lace',
              address: firefoxResult.address,
              rewardAddress: firefoxResult.rewardAddress,
              networkId: firefoxResult.networkId,
              assets: [],
            },
          };
        }
        return {
          success: false,
          error: `Chrome: ${legacyResult.error || 'no extension found'} | Firefox: ${firefoxResult.error || 'failed'}`,
        };
      }

      return {
        success: false,
        error: legacyResult.error || `Failed to connect ${walletKey}. Is the extension installed?`,
      };
    } catch (error: any) {
      console.error('[CardanoIPC] connectWallet error:', error);
      return { success: false, error: error.message || 'Failed to connect wallet' };
    }
  });

  // getWalletAssets — return assets from the last successful connect (stored in tokeoState)
  ipcMain.handle('cardano:getWalletAssets', async () => {
    try {
      if (!tokeoState.connected || !tokeoState.address) {
        return {
          success: false,
          error: 'No wallet connected',
        };
      }
      // If we had assets from Chrome bridge, they would have been returned in connectWallet.
      // For standalone asset refresh, re-run Chrome bridge in asset-only mode.
      // For now, return whatever is in memory.
      return {
        success: true,
        data: {
          address: tokeoState.address,
          assets: [], // populated by renderer from connectWallet response
        },
      };
    } catch (error: any) {
      console.error('[CardanoIPC] getWalletAssets error:', error);
      return { success: false, error: error.message || 'Failed to get wallet assets' };
    }
  });

  // signTx — sign a transaction via the bridge
  ipcMain.handle('cardano:signTx', async (_event, walletKey: string, txHex: string, partialSign = true) => {
    try {
      // Try Chrome bridge first
      if (isChromeInstalled()) {
        const result = await signTxChrome(walletKey, txHex, partialSign);
        if (result.success) {
          return {
            success: true,
            data: { signedTx: result.signedTx },
          };
        }
      }
      // Fallback to legacy WebView bridge
      const result = await legacyBridgeSignTx(walletKey, txHex, partialSign);
      return {
        success: result.success,
        data: result.success ? { signedTx: result.signedTx } : undefined,
        error: result.error,
      };
    } catch (error: any) {
      console.error('[CardanoIPC] signTx error:', error);
      return { success: false, error: error.message || 'Failed to sign transaction' };
    }
  });

  // getBridgeStatus — current bridge state
  ipcMain.handle('cardano:getBridgeStatus', async () => {
    return {
      success: true,
      data: {
        chromeAvailable: isChromeInstalled(),
        firefoxAvailable: isFirefoxInstalled(),
        connected: tokeoState.connected,
        state: tokeoState,
      },
    };
  });

  // disconnectWallet — disconnect CIP-30 bridge (Chrome + Firefox)
  ipcMain.handle('cardano:disconnectWallet', async () => {
    await legacyBridgeDisconnect();
    await disconnectChromeWallet();
    await disconnectFirefoxWallet();
    tokeoState = { connected: false };
    return { success: true };
  });

  console.log('[CardanoIPC] All handlers registered');
}
