/**
 * CIP-30 Cardano Wallet Connector
 * For HyperSharePass (a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46) NFT-gated access
 * 
 * Enables: Connect Eternl/Lace → Verify HyperSharePass → Access MosAic Chat/AI Agents
 */

// Policy ID for HyperSharePass collection
const HYPERSHARE_PASS_POLICY_ID = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';

// Supported wallets
const WALLET_NAMES = ['eternl', 'lace', 'nami', 'yoroi', 'flint', 'gero'] as const;
type WalletName = typeof WALLET_NAMES[number];

interface WalletAPI {
  enable(): Promise<WalletApi>;
  isEnabled(): Promise<boolean>;
  submitTx(tx: string): Promise<string>;
  getUtxos(): Promise<Utxo[] | null>;
  getBalance(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  signTx(tx: string, partialSign: boolean): Promise<string>;
  signData(address: string, payload: string): Promise<string>;
}

interface WalletApi {
  getUtxos(): Promise<Utxo[] | null>;
  getBalance(): Promise<string>;
  getUsedAddresses(): Promise<string[]>;
  getChangeAddress(): Promise<string>;
  signTx(tx: string, partialSign: boolean): Promise<string>;
  signData(address: string, payload: string): Promise<string>;
}

interface Utxo {
  txHash: string;
  outputIndex: number;
  assets: Asset[];
}

interface Asset {
  policyId: string;
  assetName: string;
  quantity: string;
}

interface DelegationRights {
  walletAddress: string;
  hyperSharePassCount: number;
  chatAccess: boolean;
  maxAgents: number;
}

// Global wallet state
let currentWallet: WalletName | null = null;
let walletApi: WalletApi | null = null;

/**
 * Check if a wallet is installed
 */
export function isWalletInstalled(walletName: WalletName): boolean {
  return typeof window !== 'undefined' && 
         window.cardano && 
         window.cardano[walletName] !== undefined;
}

/**
 * Get list of installed wallets
 */
export function getInstalledWallets(): WalletName[] {
  if (typeof window === 'undefined' || !window.cardano) {
    return [];
  }
  return WALLET_NAMES.filter(w => window.cardano[w] !== undefined);
}

/**
 * Connect to a Cardano wallet using CIP-30
 */
export async function connectWallet(walletName: WalletName): Promise<string> {
  if (!isWalletInstalled(walletName)) {
    throw new Error(`Wallet ${walletName} not installed`);
  }

  const wallet = window.cardano[walletName];
  walletApi = await wallet.enable();
  currentWallet = walletName;

  // Get wallet address
  const addresses = await walletApi.getUsedAddresses();
  if (addresses.length === 0) {
    const unused = await walletApi.getUnusedAddresses();
    if (unused.length === 0) {
      throw new Error('No addresses found in wallet');
    }
    return unused[0];
  }
  return addresses[0];
}

/**
 * Disconnect from wallet
 */
export function disconnectWallet(): void {
  currentWallet = null;
  walletApi = null;
}

/**
 * Get current connected wallet name
 */
export function getCurrentWallet(): WalletName | null {
  return currentWallet;
}

/**
 * Get all UTXOs from connected wallet
 */
export async function getWalletUtxos(): Promise<Utxo[] | null> {
  if (!walletApi) {
    throw new Error('No wallet connected');
  }
  return walletApi.getUtxos();
}

/**
 * Parse UTXOs and extract NFT assets
 */
export function parseNftsFromUtxos(utxos: Utxo[] | null): Asset[] {
  if (!utxos) return [];

  const nfts: Asset[] = [];
  for (const utxo of utxos) {
    for (const asset of utxo.assets) {
      // Filter to only NFT-like assets (quantity = 1)
      if (asset.quantity === '1' && asset.policyId) {
        nfts.push(asset);
      }
    }
  }
  return nfts;
}

/**
 * Check how many HyperSharePass NFTs user holds
 */
export function countHyperSharePass(nfts: Asset[]): number {
  return nfts.filter(nft => 
    nft.policyId === HYPERSHARE_PASS_POLICY_ID
  ).length;
}

/**
 * Get user's delegation rights based on HyperSharePass holdings
 */
export async function getDelegationRights(): Promise<DelegationRights> {
  if (!walletApi) {
    throw new Error('No wallet connected');
  }

  const addresses = await walletApi.getUsedAddresses();
  const walletAddress = addresses[0] || await walletApi.getChangeAddress();

  const utxos = await walletApi.getUtxos();
  const nfts = parseNftsFromUtxos(utxos);
  const hyperSharePassCount = countHyperSharePass(nfts);

  // Access rights based on NFT count
  // Each HyperSharePass = 1 vote in DAO + access to AI agent
  const chatAccess = hyperSharePassCount > 0;
  const maxAgents = hyperSharePassCount; // 1 agent per NFT

  return {
    walletAddress,
    hyperSharePassCount,
    chatAccess,
    maxAgents
  };
}

/**
 * Sign authentication data for midnight.city
 */
export async function signAuthMessage(message: string): Promise<string> {
  if (!walletApi) {
    throw new Error('No wallet connected');
  }

  const addresses = await walletApi.getUsedAddresses();
  const address = addresses[0] || await walletApi.getChangeAddress();

  // Sign message with wallet
  const signature = await walletApi.signData(address, message);
  return signature;
}

/**
 * Full authentication flow for midnight.city
 */
export async function authenticateMidnightCity(): Promise<{
  wallet: WalletName;
  address: string;
  hyperSharePassCount: number;
  chatAccess: boolean;
  maxAgents: number;
  signature: string;
}> {
  if (!currentWallet || !walletApi) {
    throw new Error('No wallet connected');
  }

  const addresses = await walletApi.getUsedAddresses();
  const address = addresses[0] || await walletApi.getChangeAddress();

  const rights = await getDelegationRights();

  // Create auth message
  const timestamp = Date.now();
  const authMessage = `midnight.city:auth:${timestamp}:${address}`;

  // Sign for authentication
  const signature = await signAuthMessage(authMessage);

  return {
    wallet: currentWallet,
    address,
    hyperSharePassCount: rights.hyperSharePassCount,
    chatAccess: rights.chatAccess,
    maxAgents: rights.maxAgents,
    signature
  };
}

/**
 * Get the HyperSharePass policy ID (for reference)
 */
export function getHyperSharePassPolicyId(): string {
  return HYPERSHARE_PASS_POLICY_ID;
}

// Extend window type for Cardano wallets
declare global {
  interface Window {
    cardano: {
      [key: string]: {
        enable(): Promise<WalletApi>;
        isEnabled(): Promise<boolean>;
      };
    };
  }
}

export type { WalletName, WalletApi, Utxo, Asset, DelegationRights };