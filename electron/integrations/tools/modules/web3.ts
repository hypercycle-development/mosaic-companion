/**
 * Web3 ToolModule
 *
 * Built-in Web3/crypto tools. Replaces the separate MCP trading server.
 * Provides:
 * - Crypto price lookups (CoinGecko API)
 * - Market news (simulated for now)
 * - Wallet address derivation (viem)
 * - Wallet balance checks (public RPC)
 * - Token transfers (simulated for now)
 * - Address book management
 * - Secure wallet storage (via OS encryption)
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
  USDC: "usd-coin",
  USDT: "tether",
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

/**
 * Resolve an address or contact name to a wallet address.
 * If input looks like an address (starts with 0x), return as-is.
 * Otherwise, look up in the address book.
 */
function resolveAddress(
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
  // =========================================================================
  // Wallet Tools
  // =========================================================================
  {
    name: "get_wallet_address",
    description:
      "Get the public Ethereum address of the configured wallet. Use when users ask 'what is my address' or 'what is my wallet'.",
    handler: async () => {
      const address = getWalletAddress();
      if (!address) {
        return {
          success: false,
          error: "No wallet configured. Please save a private key in the Web3 section first.",
        };
      }
      return { success: true, data: { address } };
    },
  },
  {
    name: "get_wallet_balance",
    description:
      "Get the ETH balance of the connected wallet or a specific address. Use when users ask 'how much do I have', 'what is my balance', etc.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "Optional: an Ethereum address or a saved contact name. If omitted, uses the configured wallet.",
        },
      },
    },
    handler: async (args) => {
      let targetAddress: string;

      if (args.address) {
        const resolved = resolveAddress(args.address as string);
        if (!resolved) {
          return {
            success: false,
            error: `Could not resolve "${args.address}". It's not a valid address and not found in saved contacts.`,
          };
        }
        targetAddress = resolved.address;
      } else {
        const walletAddr = getWalletAddress();
        if (!walletAddr) {
          return {
            success: false,
            error: "No wallet configured. Save a private key in the Web3 section first.",
          };
        }
        targetAddress = walletAddr;
      }

      // Fetch balance using public RPC
      try {
        const response = await fetch("https://eth.llamarpc.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [targetAddress, "latest"],
            id: 1,
          }),
        });
        const data = (await response.json()) as { result?: string; error?: { message: string } };
        if (data.error) {
          return { success: false, error: data.error.message };
        }
        const balanceWei = BigInt(data.result || "0");
        const balanceEth = Number(balanceWei) / 1e18;

        return {
          success: true,
          data: `Address: ${targetAddress}\nETH Balance: ${balanceEth.toFixed(6)} ETH`,
        };
      } catch (err) {
        return {
          success: false,
          error: `Failed to fetch balance: ${(err as Error).message}`,
        };
      }
    },
  },
  {
    name: "transfer_eth",
    description:
      "Transfer ETH to an address or saved contact. Currently simulated — will describe the transaction without executing. Use when users say 'send ETH to...', 'transfer 0.1 ETH to John', etc.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description:
            "Recipient: an Ethereum address (0x...) or a saved contact name",
        },
        amount: {
          type: "string",
          description: "Amount of ETH to transfer (e.g. '0.1')",
        },
      },
      required: ["to", "amount"],
    },
    handler: async (args) => {
      const hasWallet = !!getWalletKey();
      if (!hasWallet) {
        return {
          success: false,
          error: "Wallet not configured. Cannot execute transactions.",
        };
      }

      const resolved = resolveAddress(args.to as string);
      if (!resolved) {
        return {
          success: false,
          error: `Could not resolve recipient "${args.to}". Not a valid address and not found in saved contacts.`,
        };
      }

      const fromAddr = getWalletAddress();
      const resolvedLabel = resolved.resolvedName
        ? `${resolved.resolvedName} (${resolved.address})`
        : resolved.address;

      return {
        success: true,
        data: `[SIMULATION] Transfer prepared:\n` +
          `From: ${fromAddr}\n` +
          `To: ${resolvedLabel}\n` +
          `Amount: ${args.amount} ETH\n\n` +
          `⚠️ This is a simulation. Real on-chain execution will be available in a future update.`,
      };
    },
  },
  {
    name: "transfer_token",
    description:
      "Transfer an ERC-20 token (e.g. USDC, USDT) to an address or saved contact. Currently simulated. Use when users say 'send 10 USDC to...', 'transfer tokens', etc.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description:
            "Recipient: an Ethereum address (0x...) or a saved contact name",
        },
        amount: {
          type: "string",
          description: "Amount to transfer (e.g. '10')",
        },
        token: {
          type: "string",
          description: "Token symbol (e.g. 'USDC', 'USDT', 'DAI')",
        },
      },
      required: ["to", "amount", "token"],
    },
    handler: async (args) => {
      const hasWallet = !!getWalletKey();
      if (!hasWallet) {
        return {
          success: false,
          error: "Wallet not configured. Cannot execute transactions.",
        };
      }

      const resolved = resolveAddress(args.to as string);
      if (!resolved) {
        return {
          success: false,
          error: `Could not resolve recipient "${args.to}". Not a valid address and not found in saved contacts.`,
        };
      }

      const fromAddr = getWalletAddress();
      const resolvedLabel = resolved.resolvedName
        ? `${resolved.resolvedName} (${resolved.address})`
        : resolved.address;

      return {
        success: true,
        data: `[SIMULATION] Token transfer prepared:\n` +
          `From: ${fromAddr}\n` +
          `To: ${resolvedLabel}\n` +
          `Amount: ${args.amount} ${(args.token as string).toUpperCase()}\n\n` +
          `⚠️ This is a simulation. Real on-chain execution will be available in a future update.`,
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
      return {
        success: true,
        data: `[SIMULATION] Executed swap: Sent ${args.amount} ${args.tokenIn} for ${args.tokenOut}.\nTxHash: 0xmocktransactionhash123456789`,
      };
    },
  },
  // =========================================================================
  // Address Book Tools
  // =========================================================================
  {
    name: "lookup_saved_wallet",
    description:
      "Look up a saved wallet contact by name. Returns the address. Use when users mention a name and you need their address.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The contact name to look up",
        },
      },
      required: ["name"],
    },
    handler: async (args) => {
      const contact = lookupContact(args.name as string);
      if (!contact) {
        return {
          success: false,
          error: `No saved contact found with name "${args.name}". Available contacts: ${
            getAddressBookContacts()
              .map((c) => c.name)
              .join(", ") || "(none)"
          }`,
        };
      }
      return {
        success: true,
        data: {
          name: contact.name,
          address: contact.address,
        },
      };
    },
  },
  {
    name: "save_wallet_contact",
    description:
      "Save a wallet address with a label/name to the address book. Use when users say 'save this address as...', 'remember this wallet', etc.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A human-readable label (e.g. 'John', 'My Exchange')",
        },
        address: {
          type: "string",
          description: "The Ethereum address (0x...)",
        },
      },
      required: ["name", "address"],
    },
    handler: async (args) => {
      const result = saveAddressBookContact(
        args.name as string,
        args.address as string,
      );
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return {
        success: true,
        data: `Saved contact "${result.contact!.name}" with address ${result.contact!.address}`,
      };
    },
  },
  {
    name: "delete_wallet_contact",
    description: "Delete a saved wallet contact from the address book.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The contact ID to delete",
        },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const result = deleteAddressBookContact(args.id as string);
      return result;
    },
  },
  {
    name: "list_saved_wallets",
    description:
      "List all saved wallet contacts from the address book. Use when users ask 'show my contacts', 'list saved wallets', etc.",
    handler: async () => {
      const contacts = getAddressBookContacts();
      if (contacts.length === 0) {
        return {
          success: true,
          data: "No saved wallet contacts yet. Use save_wallet_contact to add one.",
        };
      }
      const list = contacts
        .map((c) => `• ${c.name}: ${c.address}`)
        .join("\n");
      return {
        success: true,
        data: `Saved wallet contacts (${contacts.length}):\n${list}`,
      };
    },
  },
  // =========================================================================
  // Wallet Management Tools
  // =========================================================================
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
    const contacts = getAddressBookContacts();
    const contactsList =
      contacts.length > 0
        ? contacts.map((c) => `  - "${c.name}" → ${c.address}`).join("\n")
        : "  (no saved contacts yet)";

    const walletAddress = getWalletAddress();
    const walletStatus = walletAddress
      ? `Your configured wallet address is: ${walletAddress}`
      : "No wallet is configured yet.";

    return `You have access to Web3/crypto tools. ${walletStatus}

You can:
- Check cryptocurrency prices: use get_crypto_price with a symbol like "bitcoin", "ETH", "solana", "USDC"
- Get market news: use get_market_news with a search query
- Check wallet balance: use get_wallet_balance (works with your wallet or any address/contact name)
- Get wallet address: use get_wallet_address to show the configured wallet's public address
- Transfer ETH: use transfer_eth with a recipient (address or contact name) and amount
- Transfer tokens: use transfer_token with recipient, amount, and token symbol (e.g. USDC)
- Execute token swaps: use execute_swap (simulation mode)
- Look up contacts: use lookup_saved_wallet to find an address by name
- Save contacts: use save_wallet_contact with a name and address
- List contacts: use list_saved_wallets to show all saved contacts

Saved wallet contacts:
${contactsList}

IMPORTANT: When users mention a person's name in the context of sending/transferring crypto,
first use lookup_saved_wallet to resolve the name to an address. If the name is not found,
ask the user for the address.

Use these tools when users ask about crypto prices, market trends, their wallet, want to make trades, or manage their contacts.`;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
