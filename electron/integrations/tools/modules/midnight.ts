/**
 * Midnight Tool Module
 *
 * Bridges the midnight-mcp MCP server into Mosaic's built-in ToolRegistry,
 * exposing core Midnight blockchain tools to the AI chat and command bar.
 *
 * The underlying capability is powered by the @modelcontextprotocol/sdk client
 * (MCPClient) which auto-connects at startup via initPlugins(). If the
 * MCP server is not connected, tools gracefully return unavailable.
 */

import type { ToolModule, ToolDefinition, ToolResult } from "../types";
import { mcpClient } from "../../mcp";

const MCP_SERVER = "midnight-mcp";

// ---------------------------------------------------------------------------
// MCP availability check
// ---------------------------------------------------------------------------

function isMidnightConnected(): boolean {
  return mcpClient.isConnected(MCP_SERVER);
}

// ---------------------------------------------------------------------------
// MCP Proxy Helper
// ---------------------------------------------------------------------------

async function callMidnightTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (!isMidnightConnected()) {
    return {
      success: false,
      error: `Midnight MCP server is not connected. Install with: npm i -g midnight-mcp@latest, then restart Mosaic.`,
    };
  }
  try {
    const result = await mcpClient.callTool(MCP_SERVER, toolName, args);
    const text = result.content.map((c) => c.text ?? "").join("\n");
    return { success: true, data: text };
  } catch (err) {
    return { success: false, error: `Midnight tool error: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Tool Definitions — 14 curated tools from the 29 available
// ---------------------------------------------------------------------------

const midnightTools: ToolDefinition[] = [
  // Generation
  {
    name: "midnight_generate_contract",
    description: "Generate a new Midnight Compact smart contract from a natural-language description. Specify the type of contract (e.g. counter, voting, token), security requirements, and any special features.",
    inputSchema: {
      type: "object",
      properties: {
        contractType: { type: "string", description: "e.g. 'counter', 'voting', 'token', 'bulletin board', 'DEX'" },
        description: { type: "string", description: "Natural language description of the contract's purpose" },
        securityLevel: { type: "string", description: "'basic', 'standard', 'high', or 'maximum'" },
        features: { type: "array", items: { type: "string" }, description: "Optional list of features e.g. ['privacy', 'reentrancy-guard']" },
      },
      required: ["contractType", "description"],
    },
    handler: async (args) => callMidnightTool("midnight-generate-contract", args),
  },
  {
    name: "midnight_compile_contract",
    description: "Compile a Midnight Compact contract source. Returns JS/TS bindings, prover/verifier keys, and ZKIR artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "The Compact contract source code" },
        target: { type: "string", description: "Output target: 'javascript' or 'typescript'" },
        includeComments: { type: "boolean" },
      },
      required: ["source"],
    },
    handler: async (args) => callMidnightTool("midnight-compile-contract", args),
  },
  {
    name: "midnight_review_contract",
    description: "Review a Compact smart contract for security issues, soundness, and best-practice adherence.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "The Compact contract source code" },
        focus: { type: "string", description: "Review focus: 'security', 'soundness', 'gas', or 'comprehensive'" },
        contractName: { type: "string" },
      },
      required: ["source"],
    },
    handler: async (args) => callMidnightTool("midnight-review-contract", args),
  },
  // Analysis
  {
    name: "midnight_analyze_contract",
    description: "Analyze an existing Compact contract for structure, circuit complexity, and potential issues.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "The Compact contract source code" },
        contractName: { type: "string" },
      },
      required: ["source"],
    },
    handler: async (args) => callMidnightTool("midnight-analyze-contract", args),
  },
  {
    name: "midnight_explain_circuit",
    description: "Explain the ZK circuit logic within a Compact contract.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "The Compact contract source code" },
        circuitName: { type: "string", description: "Specific circuit or function to explain" },
        detail: { type: "string", description: "Explanation depth: 'overview', 'detailed', or 'technical'" },
      },
      required: ["source"],
    },
    handler: async (args) => callMidnightTool("midnight-explain-circuit", args),
  },
  // Search
  {
    name: "midnight_search_compact",
    description: "Search the Midnight documentation and examples for Compact language patterns.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query e.g. 'ledger manipulation', 'witness pattern'" },
        category: { type: "string", description: "Optional filter: 'all', 'language', 'stdlib', 'examples'" },
      },
      required: ["query"],
    },
    handler: async (args) => callMidnightTool("midnight-search-compact", args),
  },
  {
    name: "midnight_search_docs",
    description: "Search Midnight documentation for concepts, APIs, or guides.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number" },
      },
      required: ["query"],
    },
    handler: async (args) => callMidnightTool("midnight-search-docs", args),
  },
  {
    name: "midnight_search_typescript",
    description: "Search Midnight TypeScript SDK / Midday SDK type definitions and examples.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query e.g. 'WitnessClient', 'deployContract'" },
        maxResults: { type: "number" },
      },
      required: ["query"],
    },
    handler: async (args) => callMidnightTool("midnight-search-typescript", args),
  },
  // Repository / Examples
  {
    name: "midnight_list_examples",
    description: "List available example Midnight contracts from the starter template repository.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category e.g. 'voting', 'games', 'defi'" },
      },
    },
    handler: async (args) => callMidnightTool("midnight-list-examples", args),
  },
  {
    name: "midnight_get_latest_updates",
    description: "Get the latest updates, changelog entries, and new features from the Midnight repository.",
    inputSchema: {
      type: "object",
      properties: {
        version: { type: "string", description: "Optional specific version to retrieve updates for" },
        limit: { type: "number" },
      },
    },
    handler: async (args) => callMidnightTool("midnight-get-latest-updates", args),
  },
  // Meta / Discovery
  {
    name: "midnight_list_tool_categories",
    description: "List all Midnight MCP tool categories and their descriptions.",
    handler: async () => callMidnightTool("midnight-list-tool-categories", {}),
  },
  {
    name: "midnight_suggest_tool",
    description: "Given a task description, suggest the most relevant Midnight tool(s) to use.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Description of what the user wants to do" },
        experience: { type: "string", description: "User experience level: 'beginner', 'intermediate', 'advanced'" },
      },
      required: ["task"],
    },
    handler: async (args) => callMidnightTool("midnight-suggest-tool", args),
  },
  // Health
  {
    name: "midnight_health_check",
    description: "Run a health check on the Midnight MCP server and connected resources.",
    handler: async () => callMidnightTool("midnight-health-check", {}),
  },
  {
    name: "midnight_get_status",
    description: "Get the Midnight MCP server status, version, and capabilities.",
    handler: async () => callMidnightTool("midnight-get-status", {}),
  },
];

// ---------------------------------------------------------------------------
// System Prompt Context
// ---------------------------------------------------------------------------

function midnightSystemPrompt(): string {
  return `MIDNIGHT BLOCKCHAIN CONTEXT
===========================

Midnight is a data-protection-focused Layer 1 blockchain (Cardano ecosystem spin-off)
developed by Input Output Global (IOG). It protects transactional data via zero-knowledge
proofs (ZK-SNARKs) while preserving a tamper-proof audit trail.

KEY CONCEPTS
------------
• Compact — Midnight's domain-specific language (DSL) for ZK smart contracts.
  - ledger: Public on-chain state (like Solidity storage).
  - witness: Private client-side data, never revealed on-chain.
  - circuit: ZK circuit definitions proving state transitions.
  Compiled output: JS/TS bindings + prover/verifier keys + ZKIR artifacts.

• Dual-token system:
  - NIGHT: Native staking/governance token.
  - DUST: Fee token for transactions.

• Privacy: Transitions are verified via ZK proofs; inputs remain private.
  Parties can selectively disclose data to auditors via "disclosure rules."

• Midday SDK — TypeScript SDK for contract operations:
  9 namespaces: Client, Contract, Config, Wallet, PrivateState, ZkConfig, Hash, Runtime, Utils.
  Three API tiers: Promise (beginner), Effect (functional), Effect DI (production).

• Midnight Starter Template (Edda Labs) — Counter, DEX, Bulletin Board, Voting examples.

• WebAssembly (WASM) — Contracts compile to WASM; proofs run client-side in the browser.

• Hermes Agent integration: The midnight-mcp MCP server exposes 29 tools for
  - Searching Compact/TypeScript/docs
  - Generating/reviewing/compiling contracts
  - Listing examples and getting updates
  - Health checks and tool discovery

TOOLS AVAILABLE TO YOU
------------------------
You have 14 Midnight tools available (provided the MCP server is connected):

Generation:
  • midnight_generate_contract — Generate Compact from natural-language description.
  • midnight_compile_contract — Compile Compact → JS bindings + ZK artifacts.
  • midnight_review_contract — Security review.

Analysis:
  • midnight_analyze_contract — Structural + circuit analysis.
  • midnight_explain_circuit — Explain ZK circuit logic.

Search:
  • midnight_search_compact — Compact language patterns.
  • midnight_search_docs — Documentation.
  • midnight_search_typescript — SDK type definitions.

Repository:
  • midnight_list_examples — Example contracts (Counter, DEX, Bulletin Board, etc.).
  • midnight_get_latest_updates — Latest repo news.

Discovery:
  • midnight_list_tool_categories — Browse tool categories.
  • midnight_suggest_tool — Let MCP suggest the right tool for a task.

Health:
  • midnight_health_check — Server health.
  • midnight_get_status — Version + capabilities.

GUIDELINES
----------
1. When a user asks about Compact syntax, call midnight_search_compact or midnight_search_docs first.
2. When a user wants to create a contract, call midnight_generate_contract then midnight_review_contract.
3. If the MCP server is offline, tell the user to run: npm i -g midnight-mcp@latest and restart Mosaic.
4. For complex workflows, chain tools: generate → review → compile → search (for deployment patterns).
5. Always run midnight_health_check if the server seems unresponsive before reporting errors.`;
}

// ---------------------------------------------------------------------------
// Module Export
// ---------------------------------------------------------------------------

export class MidnightModule implements ToolModule {
  name = "midnight";
  displayName = "Midnight";
  tools = midnightTools;
  actionPatterns = [
    // Detect conversational mentions of Midnight tasks
    {
      pattern: /\b(midnight (contract|zk|compact|generate|compile|review|search|example))\b/i,
      toolName: "midnight_suggest_tool",
      extractArgs: (match) => ({ task: match[0] }),
    },
  ];

  getSystemPrompt(): string {
    const connected = mcpClient.isConnected(MCP_SERVER);
    const statusLine = connected
      ? "[Midnight MCP: CONNECTED]"
      : "[Midnight MCP: OFFLINE — run `npm i -g midnight-mcp@latest` and restart Mosaic]";
    return `${midnightSystemPrompt()}\n\n${statusLine}`;
  }

  async isAvailable(): Promise<boolean> {
    return mcpClient.isConnected(MCP_SERVER);
  }
}
