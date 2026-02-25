/**
 * Web3 ToolModule
 *
 * Built-in Web3/crypto tools. Replaces the separate MCP trading server.
 * Provides:
 * - Crypto price lookups (CoinGecko API)
 * - Market news (simulated for now)
 * - Wallet balance checks (TODO: viem integration)
 * - Token swaps (simulated for now)
 * - Secure wallet storage (via OS encryption)
 */

import type { ToolModule, ToolDefinition } from "../types";
import {
  saveWalletKey,
  getWalletKey,
  deleteWalletKey,
} from "../../web3/index";

// =============================================================================
// Symbol Mapping
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
};

// =============================================================================
// Tool Implementations
// =============================================================================

async function getCryptoPrice(symbol: string): Promise<string> {
  const normalizedSymbol = symbol.toUpperCase();
  const id = SYMBOL_MAP[normalizedSymbol] || symbol.toLowerCase();

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, { usd: number; usd_24h_change: number }>;

  if (!data[id]) {
    throw new Error(
      `Could not find price data for '${symbol}'. Try the full name (e.g. 'bitcoin' instead of 'BTC').`,
    );
  }

  const price = data[id].usd;
  const change = data[id].usd_24h_change;
  return `Current price of ${symbol.toUpperCase()}: $${price}\n24h Change: ${change.toFixed(2)}%`;
}

async function getMarketNews(query: string): Promise<string> {
  // TODO: integrate a real news API (NewsAPI, CryptoPanic, etc.)
  return `[SIMULATED NEWS] Latest headlines for "${query}":\n1. Market analysts predict volatility ahead of upcoming protocol upgrade.\n2. Institutional inflows increase for major digital assets.\n3. ${query} sentiment remains neutral to bullish based on on-chain metrics.`;
}

// =============================================================================
// Tool Definitions
// =============================================================================

const web3Tools: ToolDefinition[] = [
  {
    name: "get_crypto_price",
    description:
      "Fetch the current price of a cryptocurrency in USD. Use when users ask for token prices.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description:
            "The token symbol or name (e.g. 'bitcoin', 'ETH', 'solana')",
        },
      },
      required: ["symbol"],
    },
    handler: async (args) => {
      try {
        const text = await getCryptoPrice(args.symbol as string);
        return { success: true, data: text };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "get_market_news",
    description: "Fetch recent news and market sentiment for a topic or token.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. 'Ethereum merge', 'Bitcoin ETF')",
        },
      },
      required: ["query"],
    },
    handler: async (args) => {
      try {
        const text = await getMarketNews(args.query as string);
        return { success: true, data: text };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "get_wallet_balance",
    description: "Get the ETH balance of the connected wallet or a specific address.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Optional address to check. If omitted, checks the internal wallet.",
        },
      },
    },
    handler: async (_args) => {
      // TODO: viem integration for on-chain balance checks
      const hasWallet = !!getWalletKey();
      if (!hasWallet) {
        return {
          success: false,
          error: "No wallet configured. Save a private key in Settings first.",
        };
      }
      return {
        success: false,
        error: "On-chain balance lookups require viem integration (coming soon).",
      };
    },
  },
  {
    name: "execute_swap",
    description: "Execute a token swap on the blockchain (simulation for now).",
    inputSchema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Token to sell" },
        tokenOut: { type: "string", description: "Token to buy" },
        amount: { type: "string", description: "Amount to swap (e.g. '0.1')" },
      },
      required: ["tokenIn", "tokenOut", "amount"],
    },
    handler: async (args) => {
      const hasWallet = !!getWalletKey();
      if (!hasWallet) {
        return {
          success: false,
          error: "Wallet not configured. Cannot execute transactions.",
        };
      }
      // MOCK — real implementation needs viem + DEX integration
      return {
        success: true,
        data: `[SIMULATION] Executed swap: Sent ${args.amount} ${args.tokenIn} for ${args.tokenOut}.\nTxHash: 0xmocktransactionhash123456789`,
      };
    },
  },
  {
    name: "save-wallet",
    description: "Securely store an Ethereum private key using OS encryption",
    inputSchema: {
      type: "object",
      properties: {
        privateKey: { type: "string", description: "The private key to store" },
      },
      required: ["privateKey"],
    },
    handler: async (args) => {
      const success = saveWalletKey(args.privateKey as string);
      return { success };
    },
  },
  {
    name: "delete-wallet",
    description: "Delete the stored Ethereum private key",
    handler: async () => {
      const success = deleteWalletKey();
      return { success };
    },
  },
  {
    name: "wallet-exists",
    description: "Check if a wallet private key is stored",
    handler: async () => {
      return { success: true, data: { exists: !!getWalletKey() } };
    },
  },
];

// =============================================================================
// Module Export
// =============================================================================

export class Web3Module implements ToolModule {
  name = "web3";
  displayName = "Web3";
  tools = web3Tools;
  actionPatterns = []; // No text-based action patterns yet

  getSystemPrompt(): string {
    return `You have access to Web3/crypto tools. You can:
- Check cryptocurrency prices: use get_crypto_price with a symbol like "bitcoin", "ETH", "solana"
- Get market news: use get_market_news with a search query
- Check wallet balance: use get_wallet_balance (requires wallet setup)
- Execute token swaps: use execute_swap (simulation mode)

Use these tools when users ask about crypto prices, market trends, their wallet, or want to make trades.`;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
