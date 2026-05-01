/**
 * Web3 ToolModule
 *
 * Built-in Web3/crypto tools for chat & future command bar.
 * All functions are reusable — tools are thin wrappers.
 *
 * Tools:
 *  - Crypto price lookups (CoinGecko API)
 *  - Wallet address derivation (viem)
 *  - Token & native balance checks (on-chain via RPC)
 *  - Real ETH transfers (viem walletClient)
 *  - Real ERC20 transfers (viem writeContract)
 *  - Gas estimation
 *  - Address book management
 *  - Config management (network, tokens, limits, bans, safety)
 */

import type { ToolModule, ToolDefinition } from "../types";
import {
  saveWalletKey,
  getWalletKey,
  deleteWalletKey,
  getWalletAddress,
  getAddressBookContacts,
  saveAddressBookContact,
  deleteAddressBookContact,
  lookupContact,
  withWalletKey,
} from "../../web3/index";
import { PRIVATE_KEY_GENERATION_PLACEHOLDER } from "../../web3/constants";
import {
  loadConfig,
  getActiveRpcUrl,
  getActiveNetwork,
  setActiveNetwork,
  setCustomRpc,
  getTokens,
  findToken,
  addToken,
  updateToken,
  deleteToken,
  getTransferLimits,
  setTransferLimit,
  removeTransferLimit,
  getBannedAddresses,
  addBannedAddress,
  removeBannedAddress,
  getSafetySettings,
  updateSafetySettings,
  preFlightCheck,
  recordSpend,
  lookupTokenOnChain,
  getTodaTwinHostname,
  getTodaTwinInfoAddress,
  type NetworkId,
  type TokenConfig,
} from "../../web3/config";
import {
  getTodaAddress,
  fetchTodaBalance,
  executeTodaTransfer,
  hasTodaConfig,
  type TodaDqEntry,
} from "../../web3/toda";

// =============================================================================
// Symbol Mapping (for CoinGecko)
// =============================================================================

const SYMBOL_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  USDC: "usd-coin",
  USDT: "tether",
};

// =============================================================================
// Reusable Functions (for tools, chat, command bar)
// =============================================================================

export async function fetchCryptoPrice(symbol: string): Promise<string> {
  const normalizedSymbol = symbol.toUpperCase();
  const id = SYMBOL_MAP[normalizedSymbol] || symbol.toLowerCase();

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
  );
  if (!response.ok) throw new Error(`CoinGecko API error: ${response.statusText}`);

  const data = (await response.json()) as Record<string, { usd: number; usd_24h_change: number }>;
  if (!data[id]) {
    throw new Error(`Could not find price data for '${symbol}'. Try the full name (e.g. 'bitcoin').`);
  }

  const price = data[id].usd;
  const change = data[id].usd_24h_change;
  return `${symbol.toUpperCase()}: $${price.toLocaleString()} USD (24h: ${change >= 0 ? "+" : ""}${change.toFixed(2)}%)`;
}

/**
 * Resolve an address or contact name to a wallet address (0x for Base).
 */
export function resolveAddress(
  addressOrName: string,
): { address: string; resolvedName?: string } | null {
  if (addressOrName.startsWith("0x") && addressOrName.length >= 42) {
    return { address: addressOrName };
  }
  const contact = lookupContact(addressOrName);
  if (contact) {
    return { address: contact.address, resolvedName: contact.name };
  }
  return null;
}

/** Check if string looks like a TODA Twin URL */
function isTwinUrl(s: string): boolean {
  const t = s.trim();
  return (t.startsWith("https://") || t.startsWith("http://")) && t.includes(".todaq.net");
}

/**
 * Resolve an address or contact name to a TODA Twin URL.
 */
export function resolveTodaAddress(
  addressOrName: string,
): { address: string; resolvedName?: string } | null {
  if (isTwinUrl(addressOrName)) {
    return { address: addressOrName.trim() };
  }
  const contact = lookupContact(addressOrName);
  if (contact && isTwinUrl(contact.address)) {
    return { address: contact.address, resolvedName: contact.name };
  }
  if (contact) return { address: contact.address, resolvedName: contact.name };
  return null;
}

/** Fetch native (ETH) balance via JSON-RPC */
export async function fetchNativeBalance(address: string): Promise<{ balance: string; balanceRaw: bigint }> {
  const rpcUrl = getActiveRpcUrl();
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
      id: 1,
    }),
  });
  const data = (await resp.json()) as { result?: string; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  const raw = BigInt(data.result || "0");
  return { balance: (Number(raw) / 1e18).toFixed(6), balanceRaw: raw };
}

/** Fetch ERC20 token balance via JSON-RPC */
export async function fetchTokenBalance(
  address: string,
  token: TokenConfig,
): Promise<{ balance: string; balanceRaw: bigint }> {
  const rpcUrl = getActiveRpcUrl();
  // balanceOf(address) selector = 0x70a08231
  const paddedAddr = address.slice(2).padStart(64, "0");
  const callData = `0x70a08231${paddedAddr}`;

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: token.contractAddress, data: callData }, "latest"],
      id: 1,
    }),
  });
  const data = (await resp.json()) as { result?: string; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  const raw = BigInt(data.result || "0");
  const balance = Number(raw) / Math.pow(10, token.decimals);
  return { balance: balance.toFixed(token.decimals <= 6 ? token.decimals : 6), balanceRaw: raw };
}

/** Estimate gas for a native transfer */
export async function estimateGas(to: string, valueHex: string): Promise<{ gasLimit: string; gasPriceGwei: string; estimatedCostEth: string }> {
  const rpcUrl = getActiveRpcUrl();
  const from = getWalletAddress();

  const [gasEstResp, gasPriceResp] = await Promise.all([
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_estimateGas",
        params: [{ from, to, value: valueHex }],
        id: 1,
      }),
    }),
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 2,
      }),
    }),
  ]);

  const gasEst = (await gasEstResp.json()) as { result?: string; error?: { message: string } };
  const gasPrice = (await gasPriceResp.json()) as { result?: string; error?: { message: string } };

  if (gasEst.error) throw new Error(gasEst.error.message);
  if (gasPrice.error) throw new Error(gasPrice.error.message);

  const gasLimitBn = BigInt(gasEst.result || "21000");
  const gasPriceBn = BigInt(gasPrice.result || "0");
  const costWei = gasLimitBn * gasPriceBn;

  return {
    gasLimit: gasLimitBn.toString(),
    gasPriceGwei: (Number(gasPriceBn) / 1e9).toFixed(4),
    estimatedCostEth: (Number(costWei) / 1e18).toFixed(8),
  };
}

/** Resolve the viem chain object for the active network */
async function getViemChain(networkId: string) {
  const { base, baseSepolia, mainnet } = await import("viem/chains");
  if (networkId === "ethereum") return mainnet;
  if (networkId === "base") return base;
  return baseSepolia; // base-testnet fallback
}

/** Execute a real native ETH transfer via JSON-RPC */
export async function executeNativeTransfer(
  to: string,
  amountEth: number,
): Promise<{ txHash: string }> {
  return withWalletKey(async (formattedKey) => {
    const { createWalletClient, http, parseEther } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");

    const account = privateKeyToAccount(formattedKey);
    const network = getActiveNetwork();
    const chain = await getViemChain(network.id);
    const rpcUrl = network.customRpcUrl || network.rpcUrl;

    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    const hash = await client.sendTransaction({
      to: to as `0x${string}`,
      value: parseEther(amountEth.toString()),
      chain,
    } as any);

    return { txHash: hash };
  });
}

/** Execute a real ERC20 transfer via JSON-RPC */
export async function executeTokenTransfer(
  to: string,
  amount: number,
  token: TokenConfig,
): Promise<{ txHash: string }> {
  return withWalletKey(async (formattedKey) => {
    const { createWalletClient, http } = await import("viem");
    const { privateKeyToAccount } = await import("viem/accounts");

    const account = privateKeyToAccount(formattedKey);
    const network = getActiveNetwork();
    const chain = await getViemChain(network.id);
    const rpcUrl = network.customRpcUrl || network.rpcUrl;

    const client = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    const rawAmount = BigInt(Math.round(amount * Math.pow(10, token.decimals)));

    const erc20Abi = [
      {
        name: "transfer",
        type: "function" as const,
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable" as const,
      },
    ];

    const hash = await client.writeContract({
      account,
      address: token.contractAddress! as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, rawAmount],
      chain,
    });

    return { txHash: hash };
  });
}

// =============================================================================
// Tool Definitions
// =============================================================================

const web3Tools: ToolDefinition[] = [
  // =========================================================================
  // Price & News
  // =========================================================================
  {
    name: "get_crypto_price",
    description: "Fetch the CURRENT real-time price of a cryptocurrency in USD. Returns only the latest price and 24h change. Cannot provide historical prices, price at specific past times, time series, or price charts.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Token symbol or name (e.g. 'bitcoin', 'ETH', 'USDC')" },
      },
      required: ["symbol"],
    },
    handler: async (args) => {
      try {
        return { success: true, data: await fetchCryptoPrice(args.symbol as string) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "get_market_news",
    description: "Fetch recent news headlines and market sentiment for a topic or token. Returns a brief summary only — not detailed articles or analysis.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    handler: async (args) => ({
      success: true,
      data: `[SIMULATED NEWS] Headlines for "${args.query}":\n1. Market analysts predict volatility ahead.\n2. Institutional inflows increase.\n3. Sentiment neutral to bullish based on on-chain metrics.`,
    }),
  },
  // =========================================================================
  // Wallet & Balance
  // =========================================================================
  {
    name: "get_wallet_address",
    description: "Get the public address of the configured wallet (Base: 0x address, TODA: Twin URL).",
    handler: async () => {
      const network = getActiveNetwork();
      if (network.id === "toda") {
        const cached = getTodaTwinInfoAddress();
        if (cached) {
          return {
            success: true,
            data: { address: cached, network: network.name, chainId: 0 },
          };
        }
        if (!hasTodaConfig()) {
          return {
            success: false,
            error: "TODA Twin not configured. Set hostname and API key in Web3 settings.",
          };
        }
        const address = await getTodaAddress();
        if (!address) {
          return {
            success: false,
            error: "Failed to fetch TODA Twin address. Check hostname and API key.",
          };
        }
        return { success: true, data: { address, network: network.name, chainId: 0 } };
      }
      const address = getWalletAddress();
      if (!address) return { success: false, error: "No wallet configured." };
      return { success: true, data: { address, network: network.name, chainId: network.chainId } };
    },
  },
  {
    name: "get_wallet_balance",
    description: "Get current native ETH and configured token balances for the wallet or a specific address. Returns balances only — not transaction history or past balances. On TODA, fetches DQ balances from Twin.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Optional: address or contact name. If omitted, uses the configured wallet/Twin." },
      },
    },
    handler: async (args) => {
      const network = getActiveNetwork();

      if (network.id === "toda") {
        if (!hasTodaConfig()) return { success: false, error: "TODA Twin not configured." };
        try {
          const [info, dqEntries] = await Promise.all([getTodaAddress(), fetchTodaBalance()]);
          const address = info || "Unknown";
          const lines: string[] = [`Address: ${address}`, `Network: ${network.name}`];
          for (const entry of dqEntries as TodaDqEntry[]) {
            const bal = entry.balance ?? entry.quantity ?? 0;
            const typeLabel = entry.type ? ` (${entry.type.slice(0, 8)}...)` : "";
            lines.push(`${entry.type || "DQ"}${typeLabel}: ${bal}`);
          }
          if (dqEntries.length === 0) lines.push("No DQ balances");
          return { success: true, data: lines.join("\n") };
        } catch (err) {
          return { success: false, error: `Failed to fetch TODA balance: ${(err as Error).message}` };
        }
      }

      let targetAddress: string;
      if (args.address) {
        const resolved = resolveAddress(args.address as string);
        if (!resolved) return { success: false, error: `Could not resolve "${args.address}".` };
        targetAddress = resolved.address;
      } else {
        const walletAddr = getWalletAddress();
        if (!walletAddr) return { success: false, error: "No wallet configured." };
        targetAddress = walletAddr;
      }

      try {
        const tokens = getTokens();
        const lines: string[] = [`Address: ${targetAddress}`, `Network: ${network.name}`];
        const ethBal = await fetchNativeBalance(targetAddress);
        lines.push(`ETH: ${ethBal.balance}`);
        for (const token of tokens) {
          if (token.isNative) continue;
          try {
            const bal = await fetchTokenBalance(targetAddress, token);
            lines.push(`${token.symbol}: ${bal.balance}`);
          } catch {
            lines.push(`${token.symbol}: (error fetching)`);
          }
        }
        return { success: true, data: lines.join("\n") };
      } catch (err) {
        return { success: false, error: `Failed to fetch balance: ${(err as Error).message}` };
      }
    },
  },
  // =========================================================================
  // Transfers (Real execution)
  // =========================================================================
  {
    name: "transfer_eth",
    description: "Transfer ETH to an address or saved contact on Base. Runs pre-flight safety checks. Will ask for confirmation if enabled.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient: Ethereum address (0x...) or saved contact name" },
        amount: { type: "string", description: "Amount of ETH to transfer (e.g. '0.01')" },
        confirmed: { type: "boolean", description: "Set to true to bypass confirmation prompt (only if user already confirmed)" },
      },
      required: ["to", "amount"],
    },
    handler: async (args) => {
      const network = getActiveNetwork();
      if (network.id === "toda") {
        return { success: false, error: "Use transfer_toda for TODA DQ transfers. Switch to Base network for ETH transfers." };
      }

      if (!getWalletKey()) return { success: false, error: "Wallet not configured." };

      const resolved = resolveAddress(args.to as string);
      if (!resolved) return { success: false, error: `Could not resolve "${args.to}".` };

      const amount = parseFloat(args.amount as string);
      if (isNaN(amount) || amount <= 0) return { success: false, error: "Invalid amount." };

      const contacts = getAddressBookContacts();
      const check = preFlightCheck(resolved.address, amount, "ETH", contacts);
      if (!check.ok) return { success: false, error: check.error };

      const safety = getSafetySettings();
      const fromAddr = getWalletAddress();
      const label = resolved.resolvedName ? `${resolved.resolvedName} (${resolved.address})` : resolved.address;

      // Confirmation required?
      if (safety.requireConfirmation && !args.confirmed) {
        let gasInfo = "";
        try {
          const valueHex = `0x${BigInt(Math.round(amount * 1e18)).toString(16)}`;
          const gas = await estimateGas(resolved.address, valueHex);
          gasInfo = `\nEstimated gas: ${gas.estimatedCostEth} ETH (~${gas.gasPriceGwei} Gwei)`;
        } catch { /* gas estimation optional */ }

        return {
          success: true,
          data: `🔐 CONFIRMATION REQUIRED\n\n` +
            `From: ${fromAddr}\n` +
            `To: ${label}\n` +
            `Amount: ${amount} ETH\n` +
            `Network: ${network.name}${gasInfo}\n` +
            `${check.warning || ""}\n\n` +
            `Please confirm this transfer. To proceed, call transfer_eth again with confirmed: true.`,
        };
      }

      // Execute real transfer
      try {
        const result = await executeNativeTransfer(resolved.address, amount);
        recordSpend("ETH", amount);
        return {
          success: true,
          data: `✅ Transfer successful!\n\n` +
            `From: ${fromAddr}\n` +
            `To: ${label}\n` +
            `Amount: ${amount} ETH\n` +
            `Tx Hash: ${result.txHash}\n` +
            `Explorer: ${network.explorerUrl}/tx/${result.txHash}`,
        };
      } catch (err) {
        return { success: false, error: `Transfer failed: ${(err as Error).message}` };
      }
    },
  },
  {
    name: "transfer_token",
    description: "Transfer an ERC20 token (e.g. USDC) to an address or saved contact on Base. Runs pre-flight safety checks. On TODA network, use transfer_toda instead.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient: address (0x...) or saved contact name" },
        amount: { type: "string", description: "Amount to transfer (e.g. '10')" },
        token: { type: "string", description: "Token symbol (e.g. 'USDC')" },
        confirmed: { type: "boolean", description: "Set to true to bypass confirmation prompt" },
      },
      required: ["to", "amount", "token"],
    },
    handler: async (args) => {
      const network = getActiveNetwork();
      if (network.id === "toda") {
        return { success: false, error: "Use transfer_toda for TODA DQ transfers. Switch to Base network for ERC20 transfers." };
      }

      if (!getWalletKey()) return { success: false, error: "Wallet not configured." };

      const resolved = resolveAddress(args.to as string);
      if (!resolved) return { success: false, error: `Could not resolve "${args.to}".` };

      const tokenSymbol = (args.token as string).toUpperCase();
      const token = findToken(tokenSymbol);
      if (!token) return { success: false, error: `Token "${tokenSymbol}" not found. Add it in Web3 settings first.` };
      if (token.isNative) return { success: false, error: "Use transfer_eth for native ETH transfers." };

      const amount = parseFloat(args.amount as string);
      if (isNaN(amount) || amount <= 0) return { success: false, error: "Invalid amount." };

      const contacts = getAddressBookContacts();
      const check = preFlightCheck(resolved.address, amount, tokenSymbol, contacts);
      if (!check.ok) return { success: false, error: check.error };

      const safety = getSafetySettings();
      const fromAddr = getWalletAddress();
      const label = resolved.resolvedName ? `${resolved.resolvedName} (${resolved.address})` : resolved.address;

      if (safety.requireConfirmation && !args.confirmed) {
        return {
          success: true,
          data: `🔐 CONFIRMATION REQUIRED\n\n` +
            `From: ${fromAddr}\n` +
            `To: ${label}\n` +
            `Amount: ${amount} ${tokenSymbol}\n` +
            `Token Contract: ${token.contractAddress}\n` +
            `Network: ${network.name}\n` +
            `${check.warning || ""}\n\n` +
            `Please confirm this transfer. To proceed, call transfer_token again with confirmed: true.`,
        };
      }

      try {
        const result = await executeTokenTransfer(resolved.address, amount, token);
        recordSpend(tokenSymbol, amount);
        return {
          success: true,
          data: `✅ Transfer successful!\n\n` +
            `From: ${fromAddr}\n` +
            `To: ${label}\n` +
            `Amount: ${amount} ${tokenSymbol}\n` +
            `Tx Hash: ${result.txHash}\n` +
            `Explorer: ${network.explorerUrl}/tx/${result.txHash}`,
        };
      } catch (err) {
        return { success: false, error: `Transfer failed: ${(err as Error).message}` };
      }
    },
  },
  // =========================================================================
  // TODA Transfer
  // =========================================================================
  {
    name: "transfer_toda",
    description: "Transfer TODA DQ (digital quantity) to a Twin URL or saved contact. Only available when TODA network is active. Runs pre-flight safety checks.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient: Twin URL (https://...todaq.net) or saved contact name" },
        amount: { type: "string", description: "Amount to transfer" },
        typeHash: { type: "string", description: "DQ type hash (e.g. from GET /dq response). Use token symbol if configured (e.g. TDN)." },
        confirmed: { type: "boolean", description: "Set to true to bypass confirmation prompt" },
      },
      required: ["to", "amount", "typeHash"],
    },
    handler: async (args) => {
      const network = getActiveNetwork();
      if (network.id !== "toda") {
        return { success: false, error: "Switch to TODA network first. Use switch_network with network: 'toda'." };
      }
      if (!hasTodaConfig()) return { success: false, error: "TODA Twin not configured. Set hostname and API key in Web3 settings." };

      const resolved = resolveTodaAddress(args.to as string);
      if (!resolved) return { success: false, error: `Could not resolve "${args.to}". Use a Twin URL (https://...todaq.net) or saved contact name.` };

      const amount = parseFloat(args.amount as string);
      if (isNaN(amount) || amount <= 0) return { success: false, error: "Invalid amount." };

      let typeHash = (args.typeHash as string).trim();
      const token = findToken(args.typeHash as string);
      if (token?.contractAddress) typeHash = token.contractAddress;

      const contacts = getAddressBookContacts();
      const check = preFlightCheck(resolved.address, amount, typeHash.slice(0, 8), contacts);
      if (!check.ok) return { success: false, error: check.error };

      const safety = getSafetySettings();
      const fromAddr = await getTodaAddress();
      const label = resolved.resolvedName ? `${resolved.resolvedName} (${resolved.address})` : resolved.address;

      if (safety.requireConfirmation && !args.confirmed) {
        return {
          success: true,
          data: `🔐 CONFIRMATION REQUIRED\n\n` +
            `From: ${fromAddr}\n` +
            `To: ${label}\n` +
            `Amount: ${amount} (type: ${typeHash.slice(0, 12)}...)\n` +
            `Network: ${network.name}\n` +
            `${check.warning || ""}\n\n` +
            `Please confirm this transfer. To proceed, call transfer_toda again with confirmed: true.`,
        };
      }

      try {
        const result = await executeTodaTransfer(typeHash, amount, resolved.address);
        if (!result.success) return { success: false, error: result.error };
        recordSpend(typeHash.slice(0, 8), amount);
        const summary =
          `✅ Transfer successful!\n\n` +
          `From: ${fromAddr}\n` +
          `To: ${label}\n` +
          `Amount: ${amount}\n` +
          `Transfer ID: ${result.transferId || "N/A"}\n` +
          (result.entryFileId
            ? `Entry file (balance tx-id): ${result.entryFileId}\n`
            : "");
        return {
          success: true,
          data: {
            summary,
            transferId: result.transferId,
            entryFileId: result.entryFileId,
          },
        };
      } catch (err) {
        return { success: false, error: `TODA transfer failed: ${(err as Error).message}` };
      }
    },
  },
  // =========================================================================
  // Gas Estimation
  // =========================================================================
  {
    name: "estimate_gas",
    description: "Estimate gas cost for an ETH transfer on Base. Only for ETH transfers — not ERC20 tokens. Not applicable on TODA.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address or contact name" },
        amount: { type: "string", description: "Amount of ETH" },
      },
      required: ["to", "amount"],
    },
    handler: async (args) => {
      const network = getActiveNetwork();
      if (network.id === "toda") {
        return { success: true, data: "TODA does not use gas. Transfers are fee-free at the protocol level." };
      }
      if (!getWalletAddress()) return { success: false, error: "No wallet configured." };
      const resolved = resolveAddress(args.to as string);
      if (!resolved) return { success: false, error: `Could not resolve "${args.to}".` };

      try {
        const amount = parseFloat(args.amount as string);
        const valueHex = `0x${BigInt(Math.round(amount * 1e18)).toString(16)}`;
        const gas = await estimateGas(resolved.address, valueHex);
        return {
          success: true,
          data: `Gas estimate (${network.name}):\n` +
            `Gas Limit: ${gas.gasLimit}\n` +
            `Gas Price: ${gas.gasPriceGwei} Gwei\n` +
            `Estimated Cost: ${gas.estimatedCostEth} ETH`,
        };
      } catch (err) {
        return { success: false, error: `Gas estimation failed: ${(err as Error).message}` };
      }
    },
  },
  // =========================================================================
  // Config Tools (network, tokens, limits, bans, safety)
  // =========================================================================
  {
    name: "get_network_info",
    description: "Get the current active network (Base mainnet, testnet, or TODA), RPC/endpoint, and chain ID.",
    handler: async () => {
      const network = getActiveNetwork();
      if (network.id === "toda") {
        const twinHost = getTodaTwinHostname();
        const configured = hasTodaConfig() ? "Yes" : "No (set Twin hostname and API key)";
        return {
          success: true,
          data: `Network: ${network.name}\nTwin Hostname: ${twinHost || "(not set)"}\nConfigured: ${configured}\nExplorer: ${network.explorerUrl}`,
        };
      }
      return {
        success: true,
        data: `Network: ${network.name}\nChain ID: ${network.chainId}\nRPC: ${network.customRpcUrl || network.rpcUrl}\nExplorer: ${network.explorerUrl}`,
      };
    },
  },
  {
    name: "switch_network",
    description: "Switch between Base mainnet, Base testnet, and TODA.",
    inputSchema: {
      type: "object",
      properties: {
        network: { type: "string", description: "'base', 'base-testnet', or 'toda'" },
      },
      required: ["network"],
    },
    handler: async (args) => {
      const networkId = args.network as NetworkId;
      if (networkId !== "base" && networkId !== "base-testnet" && networkId !== "toda") {
        return { success: false, error: "Invalid network. Use 'base', 'base-testnet', or 'toda'." };
      }
      const ok = setActiveNetwork(networkId);
      if (!ok) return { success: false, error: "Failed to switch network." };
      const net = getActiveNetwork();
      const extra = net.id === "toda" && getTodaTwinHostname() ? ` (Twin: ${getTodaTwinHostname().slice(0, 16)}...)` : "";
      return { success: true, data: `Switched to ${net.name}${extra}` };
    },
  },
  {
    name: "lookup_token_onchain",
    description: "Look up ERC20 token info (name, symbol, decimals) from a contract address on the current network.",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "The ERC20 contract address (0x...)" },
      },
      required: ["contractAddress"],
    },
    handler: async (args) => {
      const result = await lookupTokenOnChain(args.contractAddress as string);
      if (!result.success) return { success: false, error: result.error };
      return {
        success: true,
        data: `Token found:\n  Name: ${result.data!.name}\n  Symbol: ${result.data!.symbol}\n  Decimals: ${result.data!.decimals}\n\n⚠️ Please verify that this is the correct token before adding it.`,
      };
    },
  },
  // =========================================================================
  // Address Book Tools
  // =========================================================================
  {
    name: "lookup_saved_wallet",
    description: "Look up a saved wallet contact by name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Contact name" } },
      required: ["name"],
    },
    handler: async (args) => {
      const contact = lookupContact(args.name as string);
      if (!contact) {
        const all = getAddressBookContacts();
        return {
          success: false,
          error: `No contact "${args.name}". Available: ${all.map((c) => c.name).join(", ") || "(none)"}`,
        };
      }
      return { success: true, data: { name: contact.name, address: contact.address } };
    },
  },
  {
    name: "save_wallet_contact",
    description: "Save a wallet address with a label to the address book.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Label (e.g. 'John', 'My Exchange')" },
        address: { type: "string", description: "Ethereum address (0x...)" },
      },
      required: ["name", "address"],
    },
    handler: async (args) => {
      const result = saveAddressBookContact(args.name as string, args.address as string);
      if (!result.success) return { success: false, error: result.error };
      return { success: true, data: `Saved "${result.contact!.name}" → ${result.contact!.address}` };
    },
  },
  {
    name: "delete_wallet_contact",
    description: "Delete a saved wallet contact.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Contact ID" } },
      required: ["id"],
    },
    handler: async (args) => deleteAddressBookContact(args.id as string),
  },
  {
    name: "list_saved_wallets",
    description: "List all saved wallet contacts.",
    handler: async () => {
      const contacts = getAddressBookContacts();
      if (contacts.length === 0) return { success: true, data: "No saved contacts yet." };
      const list = contacts.map((c) => `• ${c.name}: ${c.address}`).join("\n");
      return { success: true, data: `Saved contacts (${contacts.length}):\n${list}` };
    },
  },
  // =========================================================================
  // Wallet Management
  // =========================================================================
  {
    name: "save-wallet",
    description: "Generate and store a new Ethereum wallet. Only creates a new key — never accepts or imports an existing private key. Use empty/placeholder to generate.",
    inputSchema: {
      type: "object",
      properties: {
        privateKey: {
          type: "string",
          description: "Must be empty or the generation placeholder. Raw private keys are rejected for security.",
        },
      },
      required: ["privateKey"],
    },
    handler: async (args) => {
      const pk = args.privateKey as string;
      if (pk && pk !== PRIVATE_KEY_GENERATION_PLACEHOLDER) {
        return { success: false, error: "Import via tool is disabled. Use the Web3 settings UI to import a wallet." };
      }
      return { success: saveWalletKey(PRIVATE_KEY_GENERATION_PLACEHOLDER) };
    },
  },
  {
    name: "delete-wallet",
    description: "Delete the stored Ethereum private key.",
    handler: async () => ({ success: deleteWalletKey() }),
  },
  {
    name: "wallet-exists",
    description: "Check if a wallet private key is stored.",
    handler: async () => ({ success: true, data: { exists: !!getWalletKey() } }),
  },
];

// =============================================================================
// Module Export
// =============================================================================

export class Web3Module implements ToolModule {
  name = "web3";
  displayName = "Web3";
  tools = web3Tools;
  actionPatterns = [];

  getSystemPrompt(): string {
    const contacts = getAddressBookContacts();
    const contactsList =
      contacts.length > 0
        ? contacts.map((c) => `  - "${c.name}" → ${c.address}`).join("\n")
        : "  (none)";

    const walletAddress = getWalletAddress();
    const walletStatus = walletAddress
      ? `Configured wallet: ${walletAddress}`
      : "No wallet configured.";

    const network = getActiveNetwork();
    const tokens = getTokens();
    const tokenList = tokens.map((t) => `  - ${t.symbol} (${t.isNative ? "native" : t.contractAddress})`).join("\n");

    const config = loadConfig();
    const safety = config.safety;

    const todaStatus = network.id === "toda"
      ? (hasTodaConfig() ? "TODA Twin configured." : "TODA Twin not configured — set hostname and API key in Web3 settings.")
      : "";

    return `You have Web3/crypto tools on Base and TODA.
${walletStatus}
${network.id === "toda" ? todaStatus : ""}
Network: ${network.name}${network.id === "toda" ? "" : ` (Chain ID: ${network.chainId})`}

Configured tokens:
${tokenList}

Saved contacts:
${contactsList}

Safety: confirmation=${safety.requireConfirmation}, whitelistOnly=${safety.whitelistOnly}, cooldown=${safety.cooldownMs}ms

You can:
- Check crypto prices (get_crypto_price)
- Check all token balances (get_wallet_balance)
- On Base: Transfer ETH (transfer_eth), ERC20 (transfer_token), estimate gas (estimate_gas)
- On TODA: Transfer DQ (transfer_toda) — destination must be Twin URL
- Manage contacts (lookup/save/delete/list) — Base uses 0x addresses, TODA uses Twin URLs
- Switch network (switch_network) — 'base', 'base-testnet', or 'toda'
- Look up token info on-chain (lookup_token_onchain) — Base only

When a user mentions a name for transfers, use lookup_saved_wallet first.
Transfers run pre-flight checks (banned addresses, limits, whitelist, cooldown).
If requireConfirmation is true, the first call returns a preview — the user must confirm.`;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
