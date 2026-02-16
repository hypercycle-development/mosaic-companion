#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Create server instance
const server = new Server(
  {
    name: "mosaic-trading-server",
    version: "0.0.41",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Define tools
const GET_CRYPTO_PRICE_TOOL: Tool = {
  name: "get_crypto_price",
  description:
    "Fetch the current price of a cryptocurrency in USD. Use this tool when the user asks for the price of a token (e.g., ETH, BTC, SOL).",
  inputSchema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "The token symbol (e.g., 'bitcoin', 'ethereum', 'solana'). Note: CoinGecko IDs are preferred (lowercase full names).",
      },
    },
    required: ["symbol"],
  },
};

const GET_MARKET_NEWS_TOOL: Tool = {
  name: "get_market_news",
  description: "Fetch recent news and market sentiment for a specific topic or token.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query for news (e.g., 'Ethereum merge', 'Bitcoin ETF').",
      },
    },
    required: ["query"],
  },
};

// Implement tool logic
async function getCryptoPrice(symbol: string) {
  try {
    // Basic mapping for common symbols to CoinGecko IDs
    const symbolMap: Record<string, string> = {
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
    
    // Normalize input
    const normalizedSymbol = symbol.toUpperCase();
    const id = symbolMap[normalizedSymbol] || symbol.toLowerCase();

    console.error(`Fetching price for: ${id}`);
    
    // Using fetch as requested
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      throw new Error(`Coingecko API error: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, any>;
    
    if (!data[id]) {
      return {
        content: [
          {
            type: "text",
            text: `Could not find price data for symbol '${symbol}'. Please try the full name (e.g. 'bitcoin' instead of 'BTC').`,
          },
        ],
        isError: true,
      };
    }

    const price = data[id].usd;
    const change = data[id].usd_24h_change;

    return {
      content: [
        {
          type: "text",
          text: `Current price of ${symbol.toUpperCase()}: $${price}\n24h Change: ${change.toFixed(2)}%`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching price: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

async function getMarketNews(query: string) {
    // Placeholder - in a real app, use NewsAPI or CryptoPanic API
    // For now, we'll return simulated news for the "learning curve"
    return {
        content: [
            {
                type: "text",
                text: `[SIMULATED NEWS] Latest headlines for "${query}":\n1. Market analysts predict volatility ahead of upcoming protocol upgrade.\n2. Institutional inflows increase for major digital assets.\n3. ${query} sentiment remains neutral to bullish based on on-chain metrics.`
            }
        ]
    };
}

// Viem Client Setup
import { createWalletClient, createPublicClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { ReadResourceRequestSchema, ListResourcesRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Initialize Viem Clients (Lazy load or use env vars)
// In a real app, these should be initialized with the key passed securely
let walletClient: any = null;
let publicClient: any = null;
let account: any = null;

function initializeViem() {
    if (walletClient) return;

    // Default to a random key if none provided (FOR DEMO/TESTING ONLY)
    // Real implementation: Process.env.MOSAIC_PRIVATE_KEY or similar
    const pk = process.env.MOSAIC_WALLET_PRIVATE_KEY as `0x${string}`;
    
    if (!pk) {
        console.warn("No private key found in env MOSAIC_WALLET_PRIVATE_KEY. Wallet features will be limited.");
        publicClient = createPublicClient({
            chain: mainnet,
            transport: http()
        });
        return;
    }

    try {
        account = privateKeyToAccount(pk);
        
        publicClient = createPublicClient({
            chain: mainnet,
            transport: http()
        });

        walletClient = createWalletClient({
            account,
            chain: mainnet,
            transport: http()
        });
        
        console.error(`Wallet initialized for address: ${account.address}`);
    } catch (e) {
        console.error("Failed to initialize wallet:", e);
    }
}

// Initialize on start
initializeViem();

const GET_WALLET_BALANCE_TOOL: Tool = {
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
};

const EXECUTE_SWAP_TOOL: Tool = {
    name: "execute_swap",
    description: "Execute a token swap on the blockchain (Simulation for now).",
    inputSchema: {
        type: "object",
        properties: {
            tokenIn: { type: "string", description: "Symbol or address of token to sell" },
            tokenOut: { type: "string", description: "Symbol or address of token to buy" },
            amount: { type: "string", description: "Amount to swap (in human readable units, e.g. 0.1)" },
        },
        required: ["tokenIn", "tokenOut", "amount"],
    },
};

async function getWalletBalance(address?: string) {
    if (!publicClient) {
        return { content: [{ type: "text", text: "Blockchain client not initialized." }], isError: true };
    }

    const targetAddress = address || account?.address;
    if (!targetAddress) {
         return { content: [{ type: "text", text: "No address provided and no internal wallet configured." }], isError: true };
    }

    try {
        const balance = await publicClient.getBalance({ address: targetAddress });
        return {
            content: [{ type: "text", text: `${formatEther(balance)} ETH` }]
        };
    } catch (e) {
        return { content: [{ type: "text", text: `Error fetching balance: ${(e as Error).message}` }], isError: true };
    }
}

async function executeSwap(tokenIn: string, tokenOut: string, amount: string) {
    // secure wallet check
    if (!walletClient || !account) {
         return { content: [{ type: "text", text: "Wallet not configured. Cannot execute transactions." }], isError: true };
    }

    // MOCK IMPLEMENTATION
    console.error(`Mock Executing Swap: ${amount} ${tokenIn} -> ${tokenOut}`);
    
    // In a real implementation:
    // 1. Get quotes (e.g. 1inch/Uniswap SDK)
    // 2. Approve Token (if not ETH)
    // 3. Send Transaction
    
    return {
        content: [{ 
            type: "text", 
            text: `[SIMULATION] executed swap: Sent ${amount} ${tokenIn} for ${tokenOut}. \nTxHash: 0xmocktransactionhash123456789` 
        }]
    };
}


// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [GET_CRYPTO_PRICE_TOOL, GET_MARKET_NEWS_TOOL, GET_WALLET_BALANCE_TOOL, EXECUTE_SWAP_TOOL],
  };
});

// Resource Handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "trading://wallet/status",
                name: "Wallet Status",
                mimeType: "application/json",
                description: "Current status of the trading wallet"
            }
        ]
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === "trading://wallet/status") {
        return {
            contents: [{
                uri: "trading://wallet/status",
                mimeType: "application/json",
                text: JSON.stringify({
                    configured: !!account,
                    address: account?.address || null,
                    network: "mainnet", // hardcoded for now
                })
            }]
        };
    }
    throw new Error(`Resource not found: ${request.params.uri}`);
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_crypto_price") {
    const symbol = String(args?.symbol);
    return getCryptoPrice(symbol);
  }
  
  if (name === "get_market_news") {
      const query = String(args?.query);
      return getMarketNews(query);
  }

  if (name === "get_wallet_balance") {
      const address = args?.address ? String(args.address) : undefined;
      return getWalletBalance(address);
  }

  if (name === "execute_swap") {
      return executeSwap(String(args?.tokenIn), String(args?.tokenOut), String(args?.amount));
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mosaic Trading MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
