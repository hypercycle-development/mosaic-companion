/**
 * Web3 Configuration Store
 *
 * Persistent JSON config for:
 * - Network selection (Base mainnet / Base testnet)
 * - RPC endpoints
 * - Token registry (ERC20 + native ETH)
 * - Transfer limits (per-currency per-tx + daily aggregate)
 * - Banned addresses
 * - Safety settings
 * - Daily spend tracking
 *
 * All config is stored in `web3_config.json` in the user's data directory.
 * Designed to be reusable from tools, chat, and future command bar.
 */

import { app } from "electron";
import path from "path";
import fs from "fs";

// =============================================================================
// Types
// =============================================================================

export type NetworkId = "ethereum" | "base" | "base-testnet";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  /** User-provided custom RPC override (empty = use default) */
  customRpcUrl: string;
}

export interface TokenConfig {
  id: string;
  symbol: string;
  name: string;
  /** Contract address for ERC20 tokens; null/undefined for native ETH */
  contractAddress?: string;
  decimals: number;
  isNative: boolean;
  /** Which network this token belongs to */
  network: NetworkId;
}

export interface TransferLimit {
  /** Token symbol this limit applies to, or "*" for all */
  symbol: string;
  /** Max amount per single transaction (string for precision) */
  maxPerTx: string;
  /** Max aggregate amount per 24h (string for precision), "0" = no limit */
  maxDaily: string;
}

export interface BannedAddress {
  address: string;
  reason?: string;
  addedAt: number;
}

export interface SafetySettings {
  /** Require explicit user confirmation before executing transfers */
  requireConfirmation: boolean;
  /** Only allow transfers to saved contacts */
  whitelistOnly: boolean;
  /** Minimum ms between transactions (0 = no cooldown) */
  cooldownMs: number;
}

/** Tracks daily spending per token */
export interface DailySpendEntry {
  symbol: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Total amount spent today (string for precision) */
  totalSpent: string;
}

export interface Web3Config {
  activeNetwork: NetworkId;
  networks: Record<NetworkId, NetworkConfig>;
  tokens: TokenConfig[];
  transferLimits: TransferLimit[];
  bannedAddresses: BannedAddress[];
  safety: SafetySettings;
  dailySpend: DailySpendEntry[];
  /** Timestamp of last transaction (for cooldown) */
  lastTxTimestamp: number;
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_NETWORKS: Record<NetworkId, NetworkConfig> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    rpcUrl: "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    customRpcUrl: "",
  },
  base: {
    id: "base",
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    customRpcUrl: "",
  },
  "base-testnet": {
    id: "base-testnet",
    name: "Base Sepolia (Testnet)",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    customRpcUrl: "",
  },
};

const DEFAULT_TOKENS: TokenConfig[] = [
  // Ethereum mainnet
  {
    id: "eth-ethereum",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    isNative: true,
    network: "ethereum",
  },
  {
    id: "usdc-ethereum",
    symbol: "USDC",
    name: "USD Coin",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    isNative: false,
    network: "ethereum",
  },
  // Base mainnet
  {
    id: "eth-base",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    isNative: true,
    network: "base",
  },
  {
    id: "usdc-base",
    symbol: "USDC",
    name: "USD Coin",
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    isNative: false,
    network: "base",
  },
  // Base Sepolia testnet
  {
    id: "eth-base-testnet",
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    isNative: true,
    network: "base-testnet",
  },
  {
    id: "usdc-base-testnet",
    symbol: "USDC",
    name: "USD Coin",
    contractAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    isNative: false,
    network: "base-testnet",
  },
];

const DEFAULT_CONFIG: Web3Config = {
  activeNetwork: "base-testnet",
  networks: DEFAULT_NETWORKS,
  tokens: DEFAULT_TOKENS,
  transferLimits: [],
  bannedAddresses: [],
  safety: {
    requireConfirmation: true,
    whitelistOnly: false,
    cooldownMs: 0,
  },
  dailySpend: [],
  lastTxTimestamp: 0,
};

// =============================================================================
// Config File I/O
// =============================================================================

const CONFIG_FILE = "web3_config.json";

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILE);
}

/**
 * Ensures all default tokens are present in the saved tokens array.
 * Adds any missing defaults (by ID) while preserving user-added tokens.
 * This guarantees USDC and native ETH are always available even for users
 * whose config predates the token being added to DEFAULT_TOKENS.
 */
function mergeDefaultTokens(saved: TokenConfig[]): TokenConfig[] {
  const merged = [...saved];
  for (const defaultToken of DEFAULT_TOKENS) {
    if (!merged.find((t) => t.id === defaultToken.id)) {
      merged.push(defaultToken);
    }
  }
  return merged;
}

export function loadConfig(): Web3Config {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      saveConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<Web3Config>;
    // Merge with defaults to handle missing fields from older configs
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      networks: { ...DEFAULT_NETWORKS, ...(raw.networks || {}) },
      tokens: mergeDefaultTokens(raw.tokens || []),
      safety: { ...DEFAULT_CONFIG.safety, ...(raw.safety || {}) },
    };
  } catch (error) {
    console.error("[Web3Config] Failed to load config:", error);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Web3Config): boolean {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error("[Web3Config] Failed to save config:", error);
    return false;
  }
}

// =============================================================================
// Network
// =============================================================================

export function getActiveNetwork(): NetworkConfig {
  const config = loadConfig();
  return config.networks[config.activeNetwork];
}

export function getActiveRpcUrl(): string {
  const network = getActiveNetwork();
  return network.customRpcUrl || network.rpcUrl;
}

export function setActiveNetwork(networkId: NetworkId): boolean {
  const config = loadConfig();
  if (!config.networks[networkId]) return false;
  config.activeNetwork = networkId;
  return saveConfig(config);
}

export function setCustomRpc(networkId: NetworkId, rpcUrl: string): boolean {
  const config = loadConfig();
  if (!config.networks[networkId]) return false;
  config.networks[networkId].customRpcUrl = rpcUrl;
  return saveConfig(config);
}

// =============================================================================
// Token Registry
// =============================================================================

/** Get tokens for the active network */
export function getTokens(network?: NetworkId): TokenConfig[] {
  const config = loadConfig();
  const net = network || config.activeNetwork;
  return config.tokens.filter((t) => t.network === net);
}

/** Find a token by symbol on the active network */
export function findToken(symbol: string, network?: NetworkId): TokenConfig | null {
  const tokens = getTokens(network);
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}

/** Add a new token (ERC20). Returns the created token or error. */
export function addToken(
  token: Omit<TokenConfig, "id" | "isNative">,
): { success: boolean; token?: TokenConfig; error?: string } {
  const config = loadConfig();

  // Validate
  if (!token.symbol?.trim()) return { success: false, error: "Symbol is required" };
  if (!token.contractAddress?.trim()) return { success: false, error: "Contract address is required for ERC20 tokens" };
  if (!token.contractAddress.startsWith("0x") || token.contractAddress.length !== 42) {
    return { success: false, error: "Invalid contract address format" };
  }

  // Check duplicate on same network
  const existing = config.tokens.find(
    (t) =>
      t.network === token.network &&
      (t.symbol.toUpperCase() === token.symbol.toUpperCase() ||
        (t.contractAddress && t.contractAddress.toLowerCase() === token.contractAddress!.toLowerCase())),
  );
  if (existing) {
    return { success: false, error: `Token "${existing.symbol}" already exists on ${token.network}` };
  }

  const newToken: TokenConfig = {
    id: `${token.symbol.toLowerCase()}-${token.network}-${Date.now()}`,
    symbol: token.symbol.toUpperCase().trim(),
    name: token.name.trim(),
    contractAddress: token.contractAddress.trim(),
    decimals: token.decimals,
    isNative: false,
    network: token.network,
  };

  config.tokens.push(newToken);
  const ok = saveConfig(config);
  return ok ? { success: true, token: newToken } : { success: false, error: "Failed to save" };
}

/** Update an existing token */
export function updateToken(
  id: string,
  updates: Partial<Pick<TokenConfig, "symbol" | "name" | "contractAddress" | "decimals">>,
): { success: boolean; error?: string } {
  const config = loadConfig();
  const idx = config.tokens.findIndex((t) => t.id === id);
  if (idx === -1) return { success: false, error: "Token not found" };
  if (config.tokens[idx].isNative) return { success: false, error: "Cannot edit native token" };

  if (updates.symbol) config.tokens[idx].symbol = updates.symbol.toUpperCase().trim();
  if (updates.name) config.tokens[idx].name = updates.name.trim();
  if (updates.contractAddress) config.tokens[idx].contractAddress = updates.contractAddress.trim();
  if (updates.decimals !== undefined) config.tokens[idx].decimals = updates.decimals;

  const ok = saveConfig(config);
  return ok ? { success: true } : { success: false, error: "Failed to save" };
}

/** Delete a token by ID */
export function deleteToken(id: string): { success: boolean; error?: string } {
  const config = loadConfig();
  const token = config.tokens.find((t) => t.id === id);
  if (!token) return { success: false, error: "Token not found" };
  if (token.isNative) return { success: false, error: "Cannot delete native token" };

  config.tokens = config.tokens.filter((t) => t.id !== id);
  const ok = saveConfig(config);
  return ok ? { success: true } : { success: false, error: "Failed to save" };
}

// =============================================================================
// Transfer Limits
// =============================================================================

export function getTransferLimits(): TransferLimit[] {
  return loadConfig().transferLimits;
}

export function setTransferLimit(limit: TransferLimit): boolean {
  const config = loadConfig();
  const idx = config.transferLimits.findIndex((l) => l.symbol === limit.symbol);
  if (idx >= 0) {
    config.transferLimits[idx] = limit;
  } else {
    config.transferLimits.push(limit);
  }
  return saveConfig(config);
}

export function removeTransferLimit(symbol: string): boolean {
  const config = loadConfig();
  config.transferLimits = config.transferLimits.filter((l) => l.symbol !== symbol);
  return saveConfig(config);
}

// =============================================================================
// Banned Addresses
// =============================================================================

export function getBannedAddresses(): BannedAddress[] {
  return loadConfig().bannedAddresses;
}

export function addBannedAddress(address: string, reason?: string): { success: boolean; error?: string } {
  if (!address.startsWith("0x") || address.length !== 42) {
    return { success: false, error: "Invalid address format" };
  }
  const config = loadConfig();
  const exists = config.bannedAddresses.find(
    (b) => b.address.toLowerCase() === address.toLowerCase(),
  );
  if (exists) return { success: false, error: "Address already banned" };

  config.bannedAddresses.push({ address: address.trim(), reason, addedAt: Date.now() });
  const ok = saveConfig(config);
  return ok ? { success: true } : { success: false, error: "Failed to save" };
}

export function removeBannedAddress(address: string): boolean {
  const config = loadConfig();
  config.bannedAddresses = config.bannedAddresses.filter(
    (b) => b.address.toLowerCase() !== address.toLowerCase(),
  );
  return saveConfig(config);
}

export function isAddressBanned(address: string): boolean {
  const config = loadConfig();
  return config.bannedAddresses.some(
    (b) => b.address.toLowerCase() === address.toLowerCase(),
  );
}

// =============================================================================
// Safety Settings
// =============================================================================

export function getSafetySettings(): SafetySettings {
  return loadConfig().safety;
}

export function updateSafetySettings(updates: Partial<SafetySettings>): boolean {
  const config = loadConfig();
  config.safety = { ...config.safety, ...updates };
  return saveConfig(config);
}

// =============================================================================
// Daily Spend Tracking
// =============================================================================

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Clean up old spend entries (older than 2 days) */
function pruneOldSpend(config: Web3Config): void {
  const today = getTodayDateStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  config.dailySpend = config.dailySpend.filter(
    (s) => s.date === today || s.date === yesterday,
  );
}

export function getDailySpent(symbol: string): number {
  const config = loadConfig();
  const today = getTodayDateStr();
  const entry = config.dailySpend.find(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase() && s.date === today,
  );
  return entry ? parseFloat(entry.totalSpent) : 0;
}

export function recordSpend(symbol: string, amount: number): void {
  const config = loadConfig();
  pruneOldSpend(config);

  const today = getTodayDateStr();
  const idx = config.dailySpend.findIndex(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase() && s.date === today,
  );

  if (idx >= 0) {
    const current = parseFloat(config.dailySpend[idx].totalSpent);
    config.dailySpend[idx].totalSpent = (current + amount).toString();
  } else {
    config.dailySpend.push({
      symbol: symbol.toUpperCase(),
      date: today,
      totalSpent: amount.toString(),
    });
  }

  config.lastTxTimestamp = Date.now();
  saveConfig(config);
}

// =============================================================================
// Cooldown Check
// =============================================================================

export function checkCooldown(): { ok: boolean; waitMs?: number } {
  const config = loadConfig();
  if (config.safety.cooldownMs <= 0) return { ok: true };

  const elapsed = Date.now() - config.lastTxTimestamp;
  if (elapsed >= config.safety.cooldownMs) return { ok: true };

  return { ok: false, waitMs: config.safety.cooldownMs - elapsed };
}

// =============================================================================
// On-Chain Token Lookup (ERC20 metadata)
// =============================================================================

const ERC20_ABI_FRAGMENTS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
};

/**
 * Fetch ERC20 token metadata from the blockchain.
 * Uses the active network's RPC to call name(), symbol(), decimals().
 */
export async function lookupTokenOnChain(
  contractAddress: string,
  network?: NetworkId,
): Promise<{
  success: boolean;
  data?: { name: string; symbol: string; decimals: number };
  error?: string;
}> {
  const config = loadConfig();
  const net = config.networks[network || config.activeNetwork];
  const rpcUrl = net.customRpcUrl || net.rpcUrl;

  if (!contractAddress.startsWith("0x") || contractAddress.length !== 42) {
    return { success: false, error: "Invalid contract address" };
  }

  async function ethCall(data: string): Promise<string | null> {
    try {
      const resp = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: contractAddress, data }, "latest"],
          id: 1,
        }),
      });
      const json = (await resp.json()) as { result?: string; error?: { message: string } };
      if (json.error) return null;
      return json.result || null;
    } catch {
      return null;
    }
  }

  function decodeString(hex: string | null): string {
    if (!hex || hex === "0x" || hex.length < 130) return "";
    try {
      // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
      const lengthHex = hex.slice(66, 130);
      const length = parseInt(lengthHex, 16);
      const dataHex = hex.slice(130, 130 + length * 2);
      return Buffer.from(dataHex, "hex").toString("utf8").replace(/\0/g, "");
    } catch {
      return "";
    }
  }

  function decodeUint(hex: string | null): number {
    if (!hex || hex === "0x") return 0;
    try {
      return parseInt(hex.slice(-64), 16);
    } catch {
      return 0;
    }
  }

  const [nameHex, symbolHex, decimalsHex] = await Promise.all([
    ethCall(ERC20_ABI_FRAGMENTS.name),
    ethCall(ERC20_ABI_FRAGMENTS.symbol),
    ethCall(ERC20_ABI_FRAGMENTS.decimals),
  ]);

  const name = decodeString(nameHex);
  const symbol = decodeString(symbolHex);
  const decimals = decodeUint(decimalsHex);

  if (!symbol) {
    return { success: false, error: "Could not read token data. Is this a valid ERC20 contract on this network?" };
  }

  return { success: true, data: { name, symbol, decimals } };
}

// =============================================================================
// Pre-Flight Transfer Validation
// =============================================================================

export interface PreFlightResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

/**
 * Run all safety checks before executing a transfer.
 * Designed to be called from tool handlers AND future command bar.
 */
export function preFlightCheck(
  to: string,
  amount: number,
  symbol: string,
  contacts: Array<{ address: string }>,
): PreFlightResult {
  const config = loadConfig();

  // 1. Banned address
  if (isAddressBanned(to)) {
    return { ok: false, error: `Address ${to} is banned.` };
  }

  // 2. Whitelist-only mode
  if (config.safety.whitelistOnly) {
    const inContacts = contacts.some(
      (c) => c.address.toLowerCase() === to.toLowerCase(),
    );
    if (!inContacts) {
      return {
        ok: false,
        error: "Whitelist mode is enabled. Recipient must be a saved contact.",
      };
    }
  }

  // 3. Per-transaction limit
  const perTxLimit = config.transferLimits.find(
    (l) => l.symbol.toUpperCase() === symbol.toUpperCase() || l.symbol === "*",
  );
  if (perTxLimit && parseFloat(perTxLimit.maxPerTx) > 0) {
    if (amount > parseFloat(perTxLimit.maxPerTx)) {
      return {
        ok: false,
        error: `Amount ${amount} ${symbol} exceeds per-tx limit of ${perTxLimit.maxPerTx} ${symbol}.`,
      };
    }
  }

  // 4. Daily aggregate limit
  if (perTxLimit && parseFloat(perTxLimit.maxDaily) > 0) {
    const spent = getDailySpent(symbol);
    const remaining = parseFloat(perTxLimit.maxDaily) - spent;
    if (amount > remaining) {
      return {
        ok: false,
        error: `Would exceed daily limit. Spent today: ${spent} ${symbol}, limit: ${perTxLimit.maxDaily} ${symbol}, remaining: ${remaining.toFixed(6)} ${symbol}.`,
      };
    }
  }

  // 5. Cooldown
  const cooldownCheck = checkCooldown();
  if (!cooldownCheck.ok) {
    const waitSec = Math.ceil((cooldownCheck.waitMs || 0) / 1000);
    return { ok: false, error: `Cooldown active. Wait ${waitSec}s before next transaction.` };
  }

  // 6. Spending alert (warning, not blocking)
  if (perTxLimit && parseFloat(perTxLimit.maxDaily) > 0) {
    const spent = getDailySpent(symbol);
    const dailyLimit = parseFloat(perTxLimit.maxDaily);
    const afterSpend = spent + amount;
    if (afterSpend > dailyLimit * 0.8) {
      return {
        ok: true,
        warning: `⚠️ After this transfer, you'll have used ${((afterSpend / dailyLimit) * 100).toFixed(0)}% of your daily ${symbol} limit.`,
      };
    }
  }

  return { ok: true };
}
