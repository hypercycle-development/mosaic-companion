#!/usr/bin/env node
/**
 * 1AM CLI MCP Server
 *
 * Wraps the `1am` CLI as an MCP server so AI agents can manage Midnight wallets
 * and query the explorer via the standard Model Context Protocol.
 *
 * Transport: STDIO (spawning via node oneam-mcp-server.js)
 * Tools exposed:
 *   - oneam_wallet_create   — create a new wallet profile
 *   - oneam_wallet_list     — list local wallet profiles
 *   - oneam_wallet_show     — show wallet details and sync status
 *   - oneam_wallet_sync     — sync wallet against a Midnight indexer
 *   - oneam_wallet_use      — set default wallet
 *   - oneam_wallet_export   — export wallet seed material
 *   - oneam_explorer_summary       — network summary (blocks, epoch, uptime)
 *   - oneam_explorer_address_activity — query address activity
 *   - oneam_explorer_search         — search blocks, txs, contracts
 *   - oneam_explorer_tx             — get transaction detail
 *
 * Install as MCP plugin:
 *   command: "node"
 *   args: ["/absolute/path/to/electron/integrations/mcp/servers/oneam-mcp-server.js"]
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");

// =============================================================================
// CLI Spawner (mirrors oneam-cli/index.ts logic but pure Node, no Electron)
// =============================================================================

function runOneAm(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("1am", args, {
      env: { ...process.env, ...env },
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => { stdout += c; });
    child.stderr.on("data", (c) => { stderr += c; });
    child.on("close", (code) => {
      if (code !== 0) {
        reject({ error: `1am exited with code ${code}`, stderr: stderr.trim() });
        return;
      }
      const trimmed = stdout.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try { resolve(JSON.parse(trimmed)); } catch { resolve({ raw: trimmed, stderr: stderr.trim() || undefined }); }
      } else {
        resolve({ raw: trimmed, stderr: stderr.trim() || undefined });
      }
    });
    child.on("error", (err) => reject({ error: err.message, stderr: stderr.trim() }));
  });
}

// =============================================================================
// MCP Server
// =============================================================================

const server = new Server(
  { name: "oneam-cli", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool: oneam_wallet_create ─────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "oneam_wallet_create") {
      const walletName = args.name || "mosaic-default";
      const cliArgs = ["wallet", "create", walletName, "--json"];
      if (args.setDefault) cliArgs.push("--set-default");
      if (args.insecurePlain) cliArgs.push("--insecure-plain");
      const env = {};
      if (args.password) env.ONE_AM_WALLET_PASSWORD = args.password;
      const result = await runOneAm(cliArgs, env);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_wallet_list ──────────────────────────────────────────
    if (name === "oneam_wallet_list") {
      const result = await runOneAm(["wallet", "list", "--json"], {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_wallet_show ──────────────────────────────────────────
    if (name === "oneam_wallet_show") {
      const cliArgs = ["wallet", "show", "--json"];
      if (args.name) cliArgs.push(args.name);
      const result = await runOneAm(cliArgs, {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_wallet_sync ──────────────────────────────────────────
    if (name === "oneam_wallet_sync") {
      const walletName = args.name || "mosaic-default";
      const network = args.network || "mainnet";
      const cliArgs = ["wallet", "sync", walletName, "--network", network, "--json"];
      if (args.timeout) cliArgs.push("--timeout", String(args.timeout));
      if (args.indexer) cliArgs.push("--indexer", args.indexer);
      const env = {};
      if (args.password) env.ONE_AM_WALLET_PASSWORD = args.password;
      const result = await runOneAm(cliArgs, env);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_wallet_use ───────────────────────────────────────────
    if (name === "oneam_wallet_use") {
      const walletName = args.name || "mosaic-default";
      const result = await runOneAm(["wallet", "use", walletName, "--json"], {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_wallet_export ────────────────────────────────────────
    if (name === "oneam_wallet_export") {
      const walletName = args.name || "mosaic-default";
      const cliArgs = ["wallet", "export", walletName, "--json"];
      if (args.password) cliArgs.push("--password", args.password);
      const result = await runOneAm(cliArgs, {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_explorer_summary ─────────────────────────────────────
    if (name === "oneam_explorer_summary") {
      const result = await runOneAm(["explorer", "summary", "--json"], {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_explorer_address_activity ─────────────────────────────
    if (name === "oneam_explorer_address_activity") {
      const identifier = args.identifier;
      if (!identifier) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required argument: identifier" }, null, 2) }], isError: true };
      }
      const result = await runOneAm(["explorer", "address-activity", identifier, "--json"], {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_explorer_search ────────────────────────────────────────
    if (name === "oneam_explorer_search") {
      const query = args.query;
      if (!query) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required argument: query" }, null, 2) }], isError: true };
      }
      const cliArgs = ["explorer", "search", query, "--json"];
      if (args.limit) cliArgs.push("--limit", String(args.limit));
      const result = await runOneAm(cliArgs, {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ─── Tool: oneam_explorer_tx ──────────────────────────────────────────
    if (name === "oneam_explorer_tx") {
      const hash = args.hash;
      if (!hash) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Missing required argument: hash" }, null, 2) }], isError: true };
      }
      const result = await runOneAm(["explorer", "tx", hash, "--json"], {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: err.error || err.message, stderr: err.stderr }, null, 2) }],
      isError: true,
    };
  }
});

// ─── Tool List ─────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "oneam_wallet_create",
        description: "Create a new 1AM Midnight wallet profile. Returns wallet metadata, path, and recovery material (mnemonic or seed hex).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet profile name (default: mosaic-default)" },
            password: { type: "string", description: "Optional password for encryption (env: ONE_AM_WALLET_PASSWORD)" },
            setDefault: { type: "boolean", description: "Set as default wallet after creation" },
            insecurePlain: { type: "boolean", description: "Store seed in plain text (NOT for production)" },
          },
        },
      },
      {
        name: "oneam_wallet_list",
        description: "List all local 1AM Midnight wallet profiles with public keys and addresses.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "oneam_wallet_show",
        description: "Show public wallet details and sync status for a named profile (or default).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet profile name (optional, uses default if omitted)" },
          },
        },
      },
      {
        name: "oneam_wallet_sync",
        description: "Sync a wallet profile against a Midnight indexer. Returns balances, available coins, and pending coins.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet profile name (default: mosaic-default)" },
            network: { type: "string", enum: ["preview", "preprod", "mainnet"], description: "Midnight network to sync against (default: mainnet)" },
            timeout: { type: "number", description: "Indexer timeout in seconds (default: 120)" },
            indexer: { type: "string", description: "Custom indexer URL (optional)" },
            password: { type: "string", description: "Wallet password if encrypted" },
          },
        },
      },
      {
        name: "oneam_wallet_use",
        description: "Set the default local wallet profile for subsequent commands.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet profile name to set as default" },
          },
          required: ["name"],
        },
      },
      {
        name: "oneam_wallet_export",
        description: "Export stored wallet seed material for backup or migration. WARNING: exposes secret material.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Wallet profile name (default: mosaic-default)" },
            password: { type: "string", description: "Password to decrypt the wallet" },
          },
        },
      },
      {
        name: "oneam_explorer_summary",
        description: "Get the full Midnight network summary: latest block, block time, epoch, uptime, D-parameter, NIGHT supply.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "oneam_explorer_address_activity",
        description: "Get mainnet activity for a public identifier (shielded address, unshielded address, or dust address).",
        inputSchema: {
          type: "object",
          properties: {
            identifier: { type: "string", description: "Midnight public identifier (e.g. mn_addr1... or mn_dust1...)" },
          },
          required: ["identifier"],
        },
      },
      {
        name: "oneam_explorer_search",
        description: "Search blocks, transactions, contracts, and public identifiers on Midnight mainnet.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (block height, tx hash, contract address, or identifier fragment)" },
            limit: { type: "number", description: "Max results (default: 20)" },
          },
          required: ["query"],
        },
      },
      {
        name: "oneam_explorer_tx",
        description: "Get transaction detail by hash on Midnight mainnet.",
        inputSchema: {
          type: "object",
          properties: {
            hash: { type: "string", description: "Transaction hash (hex)" },
          },
          required: ["hash"],
        },
      },
    ],
  };
});

// =============================================================================
// Start
// =============================================================================

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("[1AM MCP] Server ready via stdio");
}).catch((err) => {
  console.error("[1AM MCP] Failed to start:", err);
  process.exit(1);
});
