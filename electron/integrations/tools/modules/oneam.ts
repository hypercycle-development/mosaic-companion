/**
 * OneAM ToolModule
 *
 * Built-in tool module that wraps the 1AM CLI (Midnight wallet + explorer)
 * into the ToolRegistry pattern. AI agents call these via:
 *   <use_tool server="oneam" tool="wallet_list">{}</use_tool>
 *
 * Also serves as the non-MCP fallback when the MCP server is not connected.
 */

import type { ToolModule, ToolDefinition, ExecutionContext } from "../types";
import {
  oneamCreateWallet,
  oneamListWallets,
  oneamShowWallet,
  oneamSyncWallet,
  oneamUseWallet,
  oneamExplorerSummary,
  oneamExplorerAddressActivity,
  oneamExplorerTx,
  type OneAmCliError,
} from "../../oneam-cli/index";

// ─── Helpers ───────────────────────────────────────────────────────────────

function isError(result: any): result is OneAmCliError {
  return result && typeof result === "object" && "error" in result;
}

/** Convert any CLI result into a ToolResult */
function ok(data: any) {
  return { success: true as const, data };
}

function err(error: OneAmCliError) {
  return { success: false as const, error: error.error || "Unknown 1AM error" };
}

// ─── Tool Definitions ──────────────────────────────────────────────────────

const oneamTools: ToolDefinition[] = [
  {
    name: "wallet_create",
    description: "Create a new 1AM Midnight wallet profile. Returns wallet metadata and recovery material (mnemonic or seed hex).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Wallet profile name (default: mosaic-default)" },
        password: { type: "string", description: "Optional encryption password" },
        setDefault: { type: "boolean", description: "Set as default wallet after creation" },
        insecurePlain: { type: "boolean", description: "Store seed in plain text (NOT for production)" },
      },
    },
    handler: async (args) => {
      const result = await oneamCreateWallet(
        (args.name as string) || "mosaic-default",
        {
          password: args.password as string | undefined,
          setDefault: args.setDefault as boolean | undefined,
          insecurePlain: args.insecurePlain as boolean | undefined,
        },
      );
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "wallet_list",
    description: "List all local 1AM Midnight wallet profiles with public keys and addresses for each network.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const result = await oneamListWallets();
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "wallet_show",
    description: "Show public wallet details, addresses (shielded/unshielded/dust per network), and sync status.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Wallet profile name (optional, uses default if omitted)" },
      },
    },
    handler: async (args) => {
      const result = await oneamShowWallet(args.name as string | undefined);
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "wallet_sync",
    description: "Sync a wallet profile against a Midnight indexer. Returns available coins, pending coins, and token balances.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Wallet profile name (default: mosaic-default)" },
        network: { type: "string", enum: ["preview", "preprod", "mainnet"], description: "Midnight network (default: mainnet)" },
        timeout: { type: "number", description: "Indexer timeout in seconds" },
        indexer: { type: "string", description: "Custom indexer URL (optional)" },
        password: { type: "string", description: "Wallet password if encrypted" },
      },
    },
    handler: async (args) => {
      const result = await oneamSyncWallet(
        (args.name as string) || "mosaic-default",
        (args.network as "preview" | "preprod" | "mainnet") || "mainnet",
        {
          timeout: args.timeout as number | undefined,
          indexer: args.indexer as string | undefined,
          password: args.password as string | undefined,
        },
      );
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "wallet_use",
    description: "Set the default local wallet profile for subsequent commands.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Wallet profile name to set as default" },
      },
      required: ["name"],
    },
    handler: async (args) => {
      const result = await oneamUseWallet(args.name as string);
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "explorer_summary",
    description: "Get the full Midnight network summary: latest block, block time, epoch, uptime, D-parameter, NIGHT supply.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const result = await oneamExplorerSummary();
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "explorer_address_activity",
    description: "Get mainnet activity for a Midnight public identifier (shielded, unshielded, or dust address).",
    inputSchema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Midnight public identifier (e.g. mn_addr1... or mn_dust1...)" },
      },
      required: ["identifier"],
    },
    handler: async (args) => {
      const result = await oneamExplorerAddressActivity(args.identifier as string);
      return isError(result) ? err(result) : ok(result);
    },
  },
  {
    name: "explorer_tx",
    description: "Get transaction detail by hash on Midnight mainnet.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Transaction hash (hex)" },
      },
      required: ["hash"],
    },
    handler: async (args) => {
      const result = await oneamExplorerTx(args.hash as string);
      return isError(result) ? err(result) : ok(result);
    },
  },
];

// ─── System Prompt ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
## 1AM Midnight Wallet Tools

You can manage Midnight Network wallets and query the blockchain via the 1AM CLI.

Wallet profiles are stored locally under ~/.1am/wallets/ and contain:
- **Shielded addresses** (privacy-preserving transactions)
- **Unshielded addresses** (transparent, like Cardano UTXO)
- **DUST addresses** (for DUST token operations)
- Each address type has versions for **preview**, **preprod**, and **mainnet** networks.

Important concepts:
- **Sync**: Before checking balances, you MUST call wallet_sync to query the indexer.
- **NIGHT**: The native Midnight token (like ETH on Ethereum).
- **DUST**: A sub-token used for micro-transactions and fees.
- **Networks**: mainnet (production), preprod (staging), preview (dev).

Always sync before reporting balances. Never report balances from memory.
`.trim();

// ─── Module ────────────────────────────────────────────────────────────────

export class OneAmModule implements ToolModule {
  name = "oneam";
  displayName = "1AM Midnight Wallet";
  tools = oneamTools;
  actionPatterns = [];

  getSystemPrompt(): string {
    return SYSTEM_PROMPT;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const result = await oneamListWallets();
      return !isError(result);
    } catch {
      return false;
    }
  }
}
