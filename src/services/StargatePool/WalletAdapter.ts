// @ts-nocheck
// =============================================================================
// STARGATE POOL - Wallet Adapter
// Reuses Mosaic wallet (window.mosaic.wallet) - NO MetaMask, NO duplicates
// =============================================================================

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  network: string | null;
  balance: string | null;
}

export interface WalletProvider {
  isConnected: boolean;
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
  getAddress: () => Promise<string>;
  getChainId: () => Promise<number>;
  getBalance: () => Promise<string>;
  switchNetwork: (chainId: number) => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  onAccountChange: (handler: (accounts: string[]) => void) => void;
  onChainChange: (handler: (chainId: number) => void) => void;
}

// Chain configurations
export const CHAIN_CONFIG: Record<number, { name: string; symbol: string; decimals: number }> = {
  1: { name: 'Ethereum Mainnet', symbol: 'ETH', decimals: 18 },
  5: { name: 'Ethereum Goerli', symbol: 'ETH', decimals: 18 },
  8453: { name: 'Base Mainnet', symbol: 'ETH', decimals: 18 },
  84531: { name: 'Base Sepolia', symbol: 'ETH', decimals: 18 },
};

class WalletAdapter {
  private wallet: WalletProvider | null = null;
  private state: WalletState = {
    isConnected: false,
    address: null,
    chainId: null,
    network: null,
    balance: null,
  };
  private listeners: Set<(state: WalletState) => void> = new Set();

  constructor() {
    this.init();
  }

  /**
   * Initialize - detect Mosaic wallet
   */
  private init(): void {
    // Check for Mosaic wallet
    if (typeof window !== 'undefined') {
      // Try window.mosaic first (Mosaic Web3 wallet)
      if (window.mosaic?.wallet) {
        this.wallet = window.mosaic.wallet;
        console.log('[WalletAdapter] Mosaic wallet detected');
      }
      // Fallback: check for injected provider
      else if (window.ethereum) {
        console.log('[WalletAdapter] Using window.ethereum (fallback)');
        this.wallet = this.createEthereumAdapter(window.ethereum);
      }
    }

    if (this.wallet) {
      this.syncState();
    }
  }

  /**
   * Create adapter from window.ethereum (fallback)
   */
  private createEthereumAdapter(ethereum: any): WalletProvider {
    return {
      get isConnected() {
        return ethereum.isConnected?.() ?? true;
      },
      connect: async () => {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        return accounts[0];
      },
      disconnect: async () => {
        // Ethereum doesn't have disconnect, just clear local state
      },
      getAddress: async () => {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        return accounts[0];
      },
      getChainId: async () => {
        const chainId = await ethereum.request({ method: 'eth_chainId' });
        return parseInt(chainId, 16);
      },
      getBalance: async () => {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (!accounts[0]) return '0';
        const balance = await ethereum.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest'],
        });
        return balance;
      },
      switchNetwork: async (chainId: number) => {
        const chainIdHex = '0x' + chainId.toString(16);
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          });
        } catch (switchError: any) {
          // If chain not added, could add here
          throw new Error(`Failed to switch network: ${switchError.message}`);
        }
      },
      signMessage: async (message: string) => {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        return ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
      },
      onAccountChange: (handler: (accounts: string[]) => void) => {
        ethereum.on('accountsChanged', handler);
      },
      onChainChange: (handler: (chainId: number) => void) => {
        ethereum.on('chainChanged', (chainIdHex: string) => {
          handler(parseInt(chainIdHex, 16));
        });
      },
    };
  }

  /**
   * Sync wallet state
   */
  private async syncState(): Promise<void> {
    if (!this.wallet) return;

    try {
      const address = await this.wallet.getAddress();
      const chainId = await this.wallet.getChainId();
      const balance = await this.wallet.getBalance();

      this.state = {
        isConnected: !!address,
        address: address || null,
        chainId,
        network: CHAIN_CONFIG[chainId]?.name || `Chain ${chainId}`,
        balance,
      };

      this.notifyListeners();
    } catch (error) {
      console.error('[WalletAdapter] Failed to sync state:', error);
    }
  }

  /**
   * Connect wallet
   */
  async connect(): Promise<string> {
    if (!this.wallet) {
      throw new Error('No wallet available');
    }

    const address = await this.wallet.connect();
    await this.syncState();

    // Set up listeners for changes
    this.wallet.onAccountChange(async () => {
      await this.syncState();
    });
    this.wallet.onChainChange(async () => {
      await this.syncState();
    });

    console.log('[WalletAdapter] Connected:', address.slice(0, 8) + '...');
    return address;
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    if (this.wallet) {
      await this.wallet.disconnect();
    }

    this.state = {
      isConnected: false,
      address: null,
      chainId: null,
      network: null,
      balance: null,
    };

    this.notifyListeners();
    console.log('[WalletAdapter] Disconnected');
  }

  /**
   * Get current address
   */
  async getAddress(): Promise<string | null> {
    if (!this.state.isConnected || !this.wallet) {
      return null;
    }
    return this.wallet.getAddress();
  }

  /**
   * Get current chain ID
   */
  async getChainId(): Promise<number | null> {
    if (!this.state.isConnected || !this.wallet) {
      return null;
    }
    return this.wallet.getChainId();
  }

  /**
   * Switch network
   */
  async switchNetwork(chainId: number): Promise<void> {
    if (!this.wallet) {
      throw new Error('No wallet available');
    }

    await this.wallet.switchNetwork(chainId);
    await this.syncState();
    console.log('[WalletAdapter] Switched to chain:', chainId);
  }

  /**
   * Get wallet state
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Check if wallet is available
   */
  isAvailable(): boolean {
    return !!this.wallet;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Get chain name from ID
   */
  static getChainName(chainId: number): string {
    return CHAIN_CONFIG[chainId]?.name || `Chain ${chainId}`;
  }

  /**
   * Get chain symbol from ID
   */
  static getChainSymbol(chainId: number): string {
    return CHAIN_CONFIG[chainId]?.symbol || 'ETH';
  }

  /**
   * Supported chains
   */
  static getSupportedChains(): number[] {
    return [1, 8453]; // Ethereum, Base
  }
}

// Declare window.mosaic for TypeScript
declare global {
  interface Window {
    mosaic?: {
      wallet?: WalletProvider;
    };
  }
}

// Singleton
export const walletAdapter = new WalletAdapter();
export default walletAdapter;
