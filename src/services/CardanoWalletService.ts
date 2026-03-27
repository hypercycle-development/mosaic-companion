/**
 * Cardano Wallet Service - CIP-30 Integration for Mosaic Companion
 * 
 * Supports: Eternl, Lace, Nami, Yoroi, Flint, Gero
 * 
 * For HyperSharePass (a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46)
 * NFT-gated access to MosAic AI agents
 * 
 * Usage:
 *   import { CardanoWalletService } from '../services/CardanoWalletService';
 *   const cardano = new CardanoWalletService();
 *   await cardano.connect('eternl');
 */

import { CardanoWallet } from '../types/cardano';

export type CardanoWalletName = 'eternl' | 'lace' | 'nami' | 'yoroi' | 'flint' | 'gero';

export interface CardanoWalletState {
  isConnected: boolean;
  walletName: CardanoWalletName | null;
  address: string | null;
  rewardAddress: string | null;
  balance: string;
  hyperSharePassCount: number;
  access: {
    canChat: boolean;
    canCreateAgents: number;
    canDelegate: boolean;
    canRentCompute: boolean;
  };
}

// HyperSharePass Policy ID
const HYPERSHARE_PASS_POLICY_ID = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';

class CardanoWalletService {
  private wallet: CardanoWallet | null = null;
  private api: unknown = null;
  private state: CardanoWalletState = {
    isConnected: false,
    walletName: null,
    address: null,
    rewardAddress: null,
    balance: '0',
    hyperSharePassCount: 0,
    access: {
      canChat: false,
      canCreateAgents: 0,
      canDelegate: false,
      canRentCompute: false
    }
  };

  private listeners: Map<string, Set<(state: CardanoWalletState) => void>> = new Map();

  /**
   * Check if a specific wallet is installed
   */
  isWalletInstalled(walletName: CardanoWalletName): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as unknown as { cardano?: Record<string, unknown> }).cardano?.[walletName];
  }

  /**
   * Get list of installed Cardano wallets
   */
  getInstalledWallets(): CardanoWalletName[] {
    if (typeof window === 'undefined') return [];
    
    const wallets: CardanoWalletName[] = ['eternl', 'lace', 'nami', 'yoroi', 'flint', 'gero'];
    const cardano = (window as unknown as { cardano?: Record<string, unknown> }).cardano;
    
    if (!cardano) return [];
    
    return wallets.filter(w => cardano[w] !== undefined);
  }

  /**
   * Connect to a Cardano wallet via CIP-30
   */
  async connect(walletName: CardanoWalletName): Promise<CardanoWalletState> {
    const cardano = (window as unknown as { cardano?: Record<string, unknown> }).cardano;
    
    if (!cardano?.[walletName]) {
      throw new Error(`Wallet ${walletName} not installed`);
    }

    try {
      this.wallet = cardano[walletName] as CardanoWallet;
      this.api = await this.wallet.enable();
      
      // Get address
      const addresses = await (this.api as { getUsedAddresses: () => Promise<string[]> }).getUsedAddresses();
      const address = Array.isArray(addresses) && addresses.length > 0 
        ? addresses[0] 
        : await (this.api as { getChangeAddress: () => Promise<string> }).getChangeAddress();
      
      // Get balance
      const balance = await (this.api as { getBalance: () => Promise<string> }).getBalance();
      
      // Get UTXOs and count HyperSharePass NFTs
      const utxos = await (this.api as { getUtxos: () => Promise<unknown[]> }).getUtxos();
      const hyperSharePassCount = this.countHyperSharePass(utxos as Array<{ assets?: Array<{ policyId: string; quantity: string }> }>);
      
      // Calculate access
      const access = {
        canChat: hyperSharePassCount > 0,
        canCreateAgents: hyperSharePassCount,
        canDelegate: hyperSharePassCount > 0,
        canRentCompute: hyperSharePassCount >= 10
      };

      this.state = {
        isConnected: true,
        walletName,
        address,
        rewardAddress: null,
        balance: this.formatAda(balance),
        hyperSharePassCount,
        access
      };

      this.notifyListeners('stateChange', this.state);
      return this.state;
    } catch (error) {
      console.error('[CardanoWallet] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  disconnect(): void {
    this.wallet = null;
    this.api = null;
    this.state = {
      isConnected: false,
      walletName: null,
      address: null,
      rewardAddress: null,
      balance: '0',
      hyperSharePassCount: 0,
      access: {
        canChat: false,
        canCreateAgents: 0,
        canDelegate: false,
        canRentCompute: false
      }
    };
    this.notifyListeners('stateChange', this.state);
  }

  /**
   * Get current state
   */
  getState(): CardanoWalletState {
    return this.state;
  }

  /**
   * Sign data for authentication (CIP-30)
   */
  async signData(message: string): Promise<string> {
    if (!this.api || !this.state.address) {
      throw new Error('Wallet not connected');
    }

    const api = this.api as { signData: (address: string, payload: string) => Promise<string> };
    const signature = await api.signData(this.state.address, message);
    
    return signature;
  }

  /**
   * Sign transaction (CIP-30)
   */
  async signTx(tx: string, partialSign: boolean = false): Promise<string> {
    if (!this.api) {
      throw new Error('Wallet not connected');
    }

    const api = this.api as { signTx: (tx: string, partialSign: boolean) => Promise<string> };
    const signature = await api.signTx(tx, partialSign);
    
    return signature;
  }

  /**
   * Submit transaction (CIP-30)
   */
  async submitTx(tx: string): Promise<string> {
    if (!this.api) {
      throw new Error('Wallet not connected');
    }

    const api = this.api as { submitTx: (tx: string) => Promise<string> };
    const txHash = await api.submitTx(tx);
    return txHash;
  }

  /**
   * Refresh wallet state (re-fetch NFTs)
   */
  async refresh(): Promise<CardanoWalletState> {
    if (!this.api || !this.state.walletName) {
      return this.state;
    }

    try {
      // Re-fetch UTXOs
      const utxos = await (this.api as { getUtxos: () => Promise<unknown[]> }).getUtxos();
      const hyperSharePassCount = this.countHyperSharePass(utxos as Array<{ assets?: Array<{ policyId: string; quantity: string }> }>);
      
      // Update state
      this.state.hyperSharePassCount = hyperSharePassCount;
      this.state.access = {
        canChat: hyperSharePassCount > 0,
        canCreateAgents: hyperSharePassCount,
        canDelegate: hyperSharePassCount > 0,
        canRentCompute: hyperSharePassCount >= 10
      };

      this.notifyListeners('stateChange', this.state);
    } catch (error) {
      console.error('[CardanoWallet] Refresh failed:', error);
    }

    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(event: string, callback: (state: CardanoWalletState) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // Private helpers

  private countHyperSharePass(utxos: Array<{ assets?: Array<{ policyId: string; quantity: string }> }>): number {
    if (!utxos) return 0;

    let count = 0;
    for (const utxo of utxos) {
      if (utxo.assets) {
        for (const asset of utxo.assets) {
          // Check if asset matches HyperSharePass policy ID
          if (asset.policyId === HYPERSHARE_PASS_POLICY_ID && asset.quantity === '1') {
            count++;
          }
        }
      }
    }
    return count;
  }

  private formatAda(lovelace: string): string {
    const ada = parseInt(lovelace) / 1000000;
    return ada.toFixed(2);
  }

  private notifyListeners(event: string, state: CardanoWalletState): void {
    this.listeners.get(event)?.forEach(cb => cb(state));
  }
}

// Export singleton instance
export const cardanoWallet = new CardanoWalletService();
export default cardanoWallet;