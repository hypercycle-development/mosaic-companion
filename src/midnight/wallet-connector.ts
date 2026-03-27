/**
 * Midnight/MosAIc Wallet Connector
 * Integration with Lace, Eternal, and other Cardano wallets via CIP-30
 */

import type {
  WalletName,
  ConnectionStatus,
  NetworkInfo,
  WalletBalance,
  WalletState,
  WalletConfig,
  WalletEventType,
  WalletEventHandler,
  WalletApi,
  DetectedWallet,
  TransactionRequest,
  SignedTransaction,
  TransactionResult,
  UTxO,
} from './types';

// ============================================================================
// Wallet Detection
// ============================================================================

/**
 * Global object where Cardano wallets expose their API
 */
declare global {
  interface Window {
    cardano?: {
      lace?: WalletApi;
      eternal?: WalletApi;
      nami?: WalletApi;
      flint?: WalletApi;
      yoroi?: WalletApi;
      gero?: WalletApi;
    };
  }
}

/**
 * Map wallet names to display names
 */
const WALLET_DISPLAY_NAMES: Record<WalletName, string> = {
  lace: 'Lace',
  eternal: 'Eternal',
  nami: 'Nami',
  flint: 'Flint',
  yoroi: 'Yoroi',
  gero: 'Gero',
};

/**
 * Detect installed wallets
 */
export function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = [];
  const cardano = window.cardano;

  if (!cardano) {
    return wallets;
  }

  const walletNames: WalletName[] = ['lace', 'eternal', 'nami', 'flint', 'yoroi', 'gero'];

  for (const name of walletNames) {
    const api = cardano[name];
    wallets.push({
      name,
      displayName: WALLET_DISPLAY_NAMES[name],
      icon: null, // Would need to fetch from wallet API
      installed: !!api,
      api: api || null,
    });
  }

  return wallets;
}

/**
 * Check if a specific wallet is installed
 */
export function isWalletInstalled(name: WalletName): boolean {
  return !!window.cardano?.[name];
}

// ============================================================================
// Wallet Connection
// ============================================================================

/**
 * Wallet Connector class for managing Cardano wallet connections
 */
export class WalletConnector {
  private state: WalletState;
  private config: WalletConfig;
  private eventHandlers: Map<WalletEventType, Set<WalletEventHandler>>;
  private balanceRefreshTimer?: ReturnType<typeof setInterval>;

  constructor(config: WalletConfig) {
    this.config = {
      testnet: false,
      balanceRefreshInterval: 30000, // 30 seconds
      connectionTimeout: 30000, // 30 seconds
      ...config,
    };

    this.state = {
      status: 'disconnected',
      walletName: null,
      walletApi: null,
      address: null,
      network: null,
      balance: null,
      error: null,
      lastUpdated: null,
    };

    this.eventHandlers = new Map();
  }

  // ---------------------------------------------------------------------------
  // Connection Methods
  // ---------------------------------------------------------------------------

  /**
   * Connect to the configured wallet
   */
  async connect(): Promise<WalletState> {
    this.updateState({ status: 'connecting', error: null });

    try {
      const cardano = window.cardano;
      if (!cardano) {
        throw new Error('No Cardano wallet detected');
      }

      const walletApi = cardano[this.config.walletName];
      if (!walletApi) {
        throw new Error(`${WALLET_DISPLAY_NAMES[this.config.walletName]} wallet not installed`);
      }

      // Enable wallet (may trigger extension popup)
      const enableResult = await walletApi.enable();

      // Get initial data
      const [networkId, usedAddresses, balance] = await Promise.all([
        walletApi.getNetworkId(),
        walletApi.getUsedAddresses(),
        walletApi.getBalance(),
      ]);

      const address = usedAddresses[0] || null;
      const network = await this.getNetworkInfo(walletApi, networkId);
      const walletBalance = this.parseBalance(balance);

      this.updateState({
        status: 'connected',
        walletApi: enableResult,
        walletName: this.config.walletName,
        address,
        network,
        balance: walletBalance,
        error: null,
        lastUpdated: new Date(),
      });

      // Start balance refresh
      this.startBalanceRefresh();

      this.emitEvent('connected', { address, networkId });

      return this.state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.updateState({
        status: 'error',
        error: errorMessage,
      });
      this.emitEvent('error', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  disconnect(): void {
    this.stopBalanceRefresh();
    this.updateState({
      status: 'disconnected',
      walletApi: null,
      address: null,
      network: null,
      balance: null,
      error: null,
      lastUpdated: new Date(),
    });
    this.emitEvent('disconnected', {});
  }

  // ---------------------------------------------------------------------------
  // Query Methods
  // ---------------------------------------------------------------------------

  /**
   * Get current wallet state
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Get wallet address
   */
  async getAddress(): Promise<string | null> {
    if (!this.state.walletApi || !this.state.address) {
      return null;
    }
    return this.state.address;
  }

  /**
   * Get network info
   */
  async getNetwork(): Promise<NetworkInfo | null> {
    return this.state.network;
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<WalletBalance | null> {
    if (!this.state.walletApi) {
      return null;
    }

    try {
      const balance = await this.state.walletApi.getBalance();
      return this.parseBalance(balance);
    } catch {
      return this.state.balance;
    }
  }

  /**
   * Get UTXOs
   */
  async getUTxOs(): Promise<UTxO[]> {
    if (!this.state.walletApi) {
      return [];
    }

    // CIP-30 doesn't provide direct UTXO query
    // Would need to use a blockfrost or other indexer API
    // This is a placeholder
    return [];
  }

  // ---------------------------------------------------------------------------
  // Transaction Methods
  // ---------------------------------------------------------------------------

  /**
   * Sign a transaction
   */
  async signTransaction(tx: string, partialSign = false): Promise<SignedTransaction> {
    if (!this.state.walletApi) {
      throw new Error('Wallet not connected');
    }

    const signature = await this.state.walletApi.signTx(tx, partialSign);

    return {
      cbor: signature,
      txHash: 'TODO: calculate hash from CBOR',
    };
  }

  /**
   * Submit a signed transaction
   */
  async submitTransaction(tx: SignedTransaction): Promise<TransactionResult> {
    if (!this.state.walletApi) {
      throw new Error('Wallet not connected');
    }

    const txHash = await this.state.walletApi.submitTx(tx.cbor);

    return {
      txHash,
      submittedAt: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Event Handling
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to wallet events
   */
  on(event: WalletEventType, handler: WalletEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private async getNetworkInfo(api: WalletApi, networkId: number): Promise<NetworkInfo> {
    return {
      networkId,
      // Testnet = 0, Mainnet = 1
      protocolMagic: networkId === 0 ? 764824073 : undefined,
      slot: undefined,
      epoch: undefined,
    };
  }

  private parseBalance(balance: string): WalletBalance {
    const lovelace = BigInt(balance || '0');
    return {
      ada: lovelace,
      tokens: new Map(),
      formattedAda: this.formatAda(lovelace),
    };
  }

  private formatAda(lovelace: bigint): string {
    const ada = Number(lovelace) / 1_000_000;
    return ada.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }

  private async refreshBalance(): Promise<void> {
    if (!this.state.walletApi) return;

    try {
      const balance = await this.state.walletApi.getBalance();
      const parsed = this.parseBalance(balance);
      this.updateState({ balance: parsed, lastUpdated: new Date() });
      this.emitEvent('balanceChanged', { balance: parsed });
    } catch {
      // Silent fail on refresh
    }
  }

  private startBalanceRefresh(): void {
    this.stopBalanceRefresh();
    const interval = this.config.balanceRefreshInterval || 30000;
    this.balanceRefreshTimer = setInterval(() => {
      this.refreshBalance();
    }, interval);
  }

  private stopBalanceRefresh(): void {
    if (this.balanceRefreshTimer) {
      clearInterval(this.balanceRefreshTimer);
      this.balanceRefreshTimer = undefined;
    }
  }

  private updateState(partial: Partial<WalletState>): void {
    this.state = { ...this.state, ...partial };
    if (partial.status) {
      this.emitEvent('statusChanged', { status: partial.status });
    }
  }

  private emitEvent<T>(type: WalletEventType, payload: T): void {
    const event: WalletEvent<T> = {
      type,
      timestamp: new Date(),
      payload,
    };

    this.eventHandlers.get(type)?.forEach((handler) => handler(event));
    // Also emit to 'any' handlers if implemented
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a wallet connector for a specific wallet
 */
export function createWalletConnector(walletName: WalletName, testnet = false): WalletConnector {
  return new WalletConnector({
    walletName,
    testnet,
  });
}

/**
 * Get list of installed wallet names
 */
export function getInstalledWallets(): WalletName[] {
  const detected = detectWallets();
  return detected.filter((w) => w.installed).map((w) => w.name);
}

export default WalletConnector;