/**
 * WalletConnect Bridge for Electron
 * Enables Cardano wallet connection via WalletConnect protocol
 * Mobile wallets scan QR code to connect
 */

import { CardanoWalletState, CardanoWalletName } from './CardanoWalletService';

export interface WalletConnectSession {
  uri: string;
  topic: string;
  expiry: number;
}

export interface WalletConnectConfig {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

// Cardano chain namespace for WalletConnect
const CARDANO_CHAINS = ['cardano:1']; // Mainnet

class WalletConnectBridge {
  private session: WalletConnectSession | null = null;
  private connectedAddress: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  
  /**
   * Initialize WalletConnect session
   * Returns URI for QR code display
   */
  async initSession(config?: Partial<WalletConnectConfig>): Promise<WalletConnectSession | null> {
    try {
      // Check if walletconnect API exists in electronAPI
      const wcApi = (window as any).electronAPI?.walletconnect;
      
      if (wcApi) {
        const result = await wcApi.init({
          projectId: config?.projectId || 'mosaic-companion',
          metadata: config?.metadata || {
            name: 'MosAic Companion',
            description: 'AI Agent Orchestration Platform',
            url: 'https://mosaic.hypercycle.ai',
            icons: ['https://mosaic.hypercycle.ai/icon.png']
          },
          chains: CARDANO_CHAINS
        });
        
        if (result.success && result.uri) {
          this.session = {
            uri: result.uri,
            topic: result.topic,
            expiry: Date.now() + 300000 // 5 min
          };
          return this.session;
        }
      }
      
      // Fallback: Generate manual connection flow
      return this.generateManualConnection();
    } catch (error) {
      console.error('[WalletConnect] Init failed:', error);
      return null;
    }
  }
  
  /**
   * Generate manual connection for wallets without WalletConnect
   * User manually enters address or scans QR
   */
  private async generateManualConnection(): Promise<WalletConnectSession> {
    const topic = this.generateTopicId();
    return {
      uri: `mosaic://connect?topic=${topic}&version=1`,
      topic,
      expiry: Date.now() + 300000
    };
  }
  
  /**
   * Connect to wallet via WalletConnect
   */
  async connect(): Promise<CardanoWalletState | null> {
    if (!this.session) {
      await this.initSession();
    }
    
    // Wait for wallet approval
    // In real implementation, this would poll for session approval
    return null;
  }
  
  /**
   * Get connected address
   */
  getAddress(): string | null {
    return this.connectedAddress;
  }
  
  /**
   * Disconnect session
   */
  async disconnect(): Promise<void> {
    const wcApi = (window as any).electronAPI?.walletconnect;
    
    if (this.session && wcApi) {
      try {
        await wcApi.disconnect(this.session.topic);
      } catch (error) {
        console.error('[WalletConnect] Disconnect failed:', error);
      }
    }
    this.session = null;
    this.connectedAddress = null;
  }
  
  /**
   * Subscribe to events
   */
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }
  
  private generateTopicId(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
}

// Manual Address Entry Mode
class ManualAddressInput {
  private address: string | null = null;
  private listeners: Set<(state: CardanoWalletState) => void> = new Set();
  
  /**
   * Set wallet address manually (view-only mode)
   */
  async setAddress(address: string): Promise<CardanoWalletState> {
    // Validate Cardano address format
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Cardano address format');
    }
    
    this.address = address;
    
    // Create a view-only state
    const state: CardanoWalletState = {
      isConnected: true,
      walletName: 'manual' as CardanoWalletName,
      address,
      rewardAddress: null,
      balance: '0', // View-only, can't query balance
      hyperSharePassCount: 0, // Would need Blockfrost API
      access: {
        canChat: false, // View-only mode
        canCreateAgents: 0,
        canDelegate: false,
        canRentCompute: false
      }
    };
    
    this.notifyListeners(state);
    return state;
  }
  
  /**
   * Validate Cardano address
   */
  private validateAddress(address: string): boolean {
    // Cardano addresses start with: addr1, stake1, etc.
    const cardanoRegex = /^(addr1|stake1|addr_test1|stake_test1)[a-zA-Z0-9]+$/;
    return cardanoRegex.test(address);
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: CardanoWalletState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(state: CardanoWalletState): void {
    this.listeners.forEach(cb => cb(state));
  }
  
  disconnect(): void {
    this.address = null;
  }
}

// Export combined service
export const walletConnectBridge = new WalletConnectBridge();
export const manualAddressInput = new ManualAddressInput();

export default walletConnectBridge;