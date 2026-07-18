/**
 * Tokeo Wallet Service
 * Renderer-side service that calls the Electron IPC bridge for Tokeo QR wallet integration
 * 
 * Usage:
 *   import { tokeoWalletService } from './TokeoWalletService';
 *   const { sessionId, uri } = await tokeoWalletService.startQRPairing(policyIds);
 *   const status = await tokeoWalletService.checkQRStatus(sessionId);
 *   const result = await tokeoWalletService.verifyCollection(policyIds);
 */

export interface TokeoQRPairingResult {
  sessionId: string;
  uri: string;
  callbackUrl: string;
  port: number;
}

export interface TokeoConnectionStatus {
  connected: boolean;
  address?: string;
  sessionId?: string;
  status?: string;
}

export interface NFTVerificationData {
  hasAccess: boolean;
  hasAll: boolean;
  matchedPolicies: string[];
  assets: any[];
}

export interface TokeoStatus {
  connected: boolean;
  address?: string;
  networkId?: number;
}

class TokeoWalletService {
  private currentSessionId: string | null = null;

  /**
   * Detect if Tokeo is available (desktop always returns false - QR only)
   */
  async detect(): Promise<{ available: boolean; name?: string; message?: string }> {
    const result = await window.electronAPI?.cardano?.tokeoDetect();
    return result || { available: false, message: 'Bridge not available' };
  }

  /**
   * Direct connect (desktop: always fails, use QR)
   */
  async connect(): Promise<{ success: boolean; address?: string; error?: string }> {
    const result = await window.electronAPI?.cardano?.tokeoConnect();
    return result || { success: false, error: 'Bridge not available' };
  }

  /**
   * Start QR pairing session
   */
  async startQRPairing(policyIds: string[] = []): Promise<TokeoQRPairingResult> {
    const result = await window.electronAPI?.cardano?.tokeoQRPairing(policyIds);
    if (!result?.success || !result?.data) {
      throw new Error(result?.error || 'Failed to start QR pairing');
    }
    this.currentSessionId = result.data.sessionId;
    return {
      sessionId: result.data.sessionId,
      uri: result.data.uri,
      callbackUrl: result.data.callbackUrl,
      port: result.data.port,
    };
  }

  /**
   * Check QR pairing status
   */
  async checkQRStatus(sessionId?: string): Promise<TokeoConnectionStatus> {
    const sid = sessionId || this.currentSessionId;
    if (!sid) {
      return { connected: false, status: 'no_session' };
    }
    const result = await window.electronAPI?.cardano?.tokeoCheckQR(sid);
    if (!result?.success) {
      return { connected: false, status: 'error', sessionId: sid };
    }
    return {
      connected: result.data?.connected || false,
      address: result.data?.address,
      sessionId: result.data?.sessionId || sid,
      status: result.data?.status || 'unknown',
    };
  }

  /**
   * Verify NFT collection ownership for connected wallet
   */
  async verifyCollection(policyIds: string[], strict: boolean = false): Promise<NFTVerificationData> {
    const result = await window.electronAPI?.cardano?.tokeoVerifyCollection(policyIds, strict);
    if (!result?.success || !result?.data) {
      throw new Error(result?.error || 'Verification failed');
    }
    return result.data;
  }

  /**
   * Cancel active QR session
   */
  async cancelQR(sessionId?: string): Promise<void> {
    const sid = sessionId || this.currentSessionId;
    await window.electronAPI?.cardano?.tokeoCancelQR(sid || undefined);
    if (!sessionId || sessionId === this.currentSessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Get current Tokeo connection status
   */
  async getStatus(): Promise<TokeoStatus> {
    const result = await window.electronAPI?.cardano?.tokeoStatus();
    if (!result?.success || !result?.data) {
      return { connected: false };
    }
    return result.data;
  }

  /**
   * Disconnect Tokeo wallet
   */
  async disconnect(): Promise<void> {
    await window.electronAPI?.cardano?.tokeoDisconnect();
    this.currentSessionId = null;
  }

  /**
   * Get the current active session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}

export const tokeoWalletService = new TokeoWalletService();
