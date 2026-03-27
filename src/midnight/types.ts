/**
 * Midnight/MosAIc Wallet Integration Types
 * Based on CIP-30 (Cardano Wallet Interface)
 */

/**
 * Supported wallet implementations
 */
export type WalletName = 'lace' | 'eternal' | 'nami' | 'flint' | 'yoroi' | 'gero';

/**
 * Connection status for the wallet
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Network information for the connected wallet
 */
export interface NetworkInfo {
  /** Network ID: 0 = testnet, 1 = mainnet */
  networkId: number;
  /** Protocol magic for testnet */
  protocolMagic?: number;
  /** Current slot number */
  slot?: number;
  /** Current epoch */
  epoch?: number;
}

/**
 * Balance information for the wallet
 */
export interface WalletBalance {
  /** Sum of all UTXO values in Lovelace */
  ada: bigint;
  /** Token balances by policy ID */
  tokens: Map<string, Map<string, bigint>>;
  /** Total balance as formatted string */
  formattedAda: string;
}

/**
 * UTXO (Unspent Transaction Output)
 */
export interface UTxO {
  txHash: string;
  txIndex: number;
  value: bigint;
  assets: Asset[];
  datumHash?: string;
}

/**
 * Token asset in a UTXO
 */
export interface Asset {
  policyId: string;
  assetName: string;
  quantity: bigint;
}

/**
 * Transaction request parameters
 */
export interface TransactionRequest {
  /** Recipient address */
  recipient: string;
  /** Amount in Lovelace */
  adaAmount?: bigint;
  /** Token amounts to send */
  tokens?: TokenAmount[];
  /** Optional metadata */
  metadata?: TransactionMetadata;
  /** Transaction TTL (time to live) in slots */
  ttl?: number;
}

/**
 * Token amount for transaction
 */
export interface TokenAmount {
  policyId: string;
  assetName: string;
  amount: bigint;
}

/**
 * Transaction metadata (CIP-20)
 */
export interface TransactionMetadata {
  /** JSON metadata */
  json?: Record<string, unknown>;
  /** CIP-20 text labels */
  labels?: Record<number, string | number | Uint8Array>;
}

/**
 * Signed transaction ready for submission
 */
export interface SignedTransaction {
  /** Signed transaction in CBOR format */
  cbor: string;
  /** Transaction hash */
  txHash: string;
}

/**
 * Transaction result after submission
 */
export interface TransactionResult {
  /** Transaction hash */
  txHash: string;
  /** When the transaction was submitted */
  submittedAt: Date;
  /** Estimated confirmation time */
  estimatedConfirmationTime?: Date;
}

/**
 * Wallet API version
 */
export interface WalletApiVersion {
  major: number;
  minor: number;
}

/**
 * Core wallet API methods (CIP-30)
 */
export interface WalletApi {
  /** Get wallet name */
  name(): Promise<string>;
  /** Get wallet icon (base64 or URL) */
  icon(): Promise<string | null>;
  /** Get API version */
  apiVersion: WalletApiVersion;
  /** Get enabled networks */
  getNetworkId(): Promise<number>;
  /** Get UTXO balance */
  getBalance(): Promise<string>;
  /** Get used addresses */
  getUsedAddresses(): Promise<string[]>;
  /** Get unused addresses */
  getUnusedAddresses(): Promise<string[]>;
  /** Get change address */
  getChangeAddress(): Promise<string>;
  /** Sign data */
  signData(address: string, payload: string): Promise<{ signature: string; key: string }>;
  /** Sign transaction */
  signTx(tx: string, partialSign: boolean): Promise<string>;
  /** Submit transaction */
  submitTx(tx: string): Promise<string>;
  /** Get collateral (for smart contracts) */
  getCollateral(): Promise<UTxO[]>;
  /** Experimental API (optional) */
  experimental?: Record<string, unknown>;
}

/**
 * Wallet state
 */
export interface WalletState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Selected wallet name */
  walletName: WalletName | null;
  /** Wallet API instance */
  walletApi: WalletApi | null;
  /** Connected address */
  address: string | null;
  /** Network information */
  network: NetworkInfo | null;
  /** Wallet balance */
  balance: WalletBalance | null;
  /** Error message if any */
  error: string | null;
  /** Last updated timestamp */
  lastUpdated: Date | null;
}

/**
 * Wallet connection configuration
 */
export interface WalletConfig {
  /** Wallet to connect */
  walletName: WalletName;
  /** Enable testnet */
  testnet?: boolean;
  /** Auto-refresh balance interval in ms */
  balanceRefreshInterval?: number;
  /** Timeout for connection attempt in ms */
  connectionTimeout?: number;
}

/**
 * Event types for wallet state changes
 */
export type WalletEventType = 
  | 'connected'
  | 'disconnected'
  | 'balanceChanged'
  | 'networkChanged'
  | 'error'
  | 'statusChanged';

/**
 * Wallet event payload
 */
export interface WalletEvent<T = unknown> {
  type: WalletEventType;
  timestamp: Date;
  payload: T;
}

/**
 * Event handler type
 */
export type WalletEventHandler<T = unknown> = (event: WalletEvent<T>) => void;

/**
 * Transaction builder options
 */
export interface TransactionBuilderOptions {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** ADA amount in Lovelace */
  ada?: bigint;
  /** Token transfers */
  tokens?: TokenAmount[];
  /** Metadata */
  metadata?: TransactionMetadata;
  /** TTL in slots (default: 3600 = 1 hour) */
  ttl?: number;
  /** Fee buffer (default: 1.5x estimated) */
  feeBuffer?: number;
}

/**
 * Wallet capabilities
 */
export interface WalletCapabilities {
  /** Whether the wallet supports signData */
  signData: boolean;
  /** Whether the wallet supports collateral */
  collateral: boolean;
  /** Whether the wallet supports token transfers */
  tokens: boolean;
  /** Whether the wallet supports metadata */
  metadata: boolean;
}

/**
 * Extension detection result
 */
export interface DetectedWallet {
  name: WalletName;
  displayName: string;
  icon: string | null;
  installed: boolean;
  api: WalletApi | null;
}