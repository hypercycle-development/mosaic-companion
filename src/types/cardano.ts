/**
 * Cardano Types for Mosaic Companion
 * CIP-30 Wallet API TypeScript definitions
 */

// Global window.cardano type
export interface CardanoWallet {
  enable(): Promise<CardanoWalletAPI>;
}

export interface CardanoWalletAPI {
  getUsedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  getBalance(): Promise<string>;
  getUtxos(): Promise<CardanoUTxO[]>;
  signData(address: string, payload: string): Promise<string>;
  signTx(tx: string, partialSign: boolean): Promise<string>;
  submitTx(tx: string): Promise<string>;
}

export interface CardanoUTxO {
  txHash: string;
  index: number;
  value: number;
  assets?: CardanoAsset[];
  dataHash?: string;
  inlineDatum?: string;
  referenceScriptHash?: string;
}

export interface CardanoAsset {
  policyId: string;
  assetName: string;
  quantity: string;
}

export interface CardanoTx {
  inputs: CardanoTxInput[];
  outputs: CardanoTxOutput[];
  fee?: number;
  ttl?: number;
  validityStartInterval?: number;
  certificates?: CardanoCertificate[];
  withdrawals?: CardanoWithdrawal[];
  metadata?: CardanoMetadata;
}

export interface CardanoTxInput {
  txHash: string;
  index: number;
  address?: string;
}

export interface CardanoTxOutput {
  address: string;
  value: number;
  assets?: CardanoAsset[];
  datumHash?: string;
  inlineDatum?: string;
  referenceScriptHash?: string;
}

export interface CardanoCertificate {
  type: 'stakeRegistration' | 'stakeDeregistration' | 'stakeDelegation' | 'poolRegistration' | 'poolRetirement';
  stakeAddress?: string;
  poolKeyHash?: string;
  poolMargin?: number;
  poolCost?: number;
}

export interface CardanoWithdrawal {
  stakeAddress: string;
  amount: number;
}

export interface CardanoMetadata {
  label: string;
  json: Record<string, unknown>;
}

// Extension for window object - merged declaration
// Note: window.cardano is also declared in other files, this extends the type
export interface WindowCardano {
  cardano?: Record<string, {
    enable(): Promise<CardanoWalletAPI>;
    isEnabled(): Promise<boolean>;
  }>;
}

// Augment existing Window interface
declare global {
  // Only add if not already present
  interface Window {
    cardano?: Record<string, {
      enable(): Promise<CardanoWalletAPI>;
      isEnabled(): Promise<boolean>;
    }>;
  }
}

export {};