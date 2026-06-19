/**
 * Midnight ToolModule
 *
 * Bridges the Midnight Development MCP server into Mosaic's native ToolRegistry.
 * Surfaces 14 high-value tools for AI-driven Compact contract development.
 */

import type { ToolModule, ToolDefinition } from "../types";

const SERVER_NAME = "midnight-mcp";

// Map of native tool names → underlying MCP tool names
const TOOL_MAPPINGS: Array<{
  name: string;
  mcpName: string;
  description: string;
  args: Record<string, unknown>;
}> = [
  {
    name: "midnight_generate_contract",
    mcpName: "midnight-generate-contract",
    description: "Generate a Compact smart contract from natural-language requirements. Supports counter, token, voting, or custom contracts.",
    args: { requirements: "string", contractType: "string", baseExample: "string (optional)" },
  },
  {
    name: "midnight_compile_contract",
    mcpName: "midnight-compile-contract",
    description: "Compile Compact source code. Use skipZk=true for fast syntax validation; fullCompile=true for full ZK circuit generation.",
    args: { code: "string", skipZk: "boolean (default true)", fullCompile: "boolean" },
  },
  {
    name: "midnight_review_contract",
    mcpName: "midnight-review-contract",
    description: "AI-powered security and privacy review of a Compact contract.",
    args: { code: "string" },
  },
  {
    name: "midnight_analyze_contract",
    mcpName: "midnight-analyze-contract",
    description: "Static analysis of a Compact contract: structure, circuits, witnesses, ledger, security findings.",
    args: { code: "string", checkSecurity: "boolean (default true)" },
  },
  {
    name: "midnight_explain_circuit",
    mcpName: "midnight-explain-circuit",
    description: "Explain what a specific Compact circuit does in plain language, including ZK and privacy implications.",
    args: { circuitCode: "string" },
  },
  {
    name: "midnight_search_compact",
    mcpName: "midnight-search-compact",
    description: "Semantic search across Compact smart-contract patterns, circuits, ledger declarations, and examples.",
    args: { query: "string", limit: "number (default 10)" },
  },
  {
    name: "midnight_search_docs",
    mcpName: "midnight-search-docs",
    description: "Full-text search across official Midnight documentation.",
    args: { query: "string", category: "'guides'|'api'|'concepts'|'all'", limit: "number" },
  },
  {
    name: "midnight_search_typescript",
    mcpName: "midnight-search-typescript",
    description: "Search Midnight TypeScript SDK code, types, and API implementations.",
    args: { query: "string", limit: "number" },
  },
  {
    name: "midnight_list_examples",
    mcpName: "midnight-list-examples",
    description: "List available Midnight example contracts (counter, bboard, token, voting) with complexity ratings.",
    args: { category: "'counter'|'bboard'|'token'|'voting'|'all'" },
  },
  {
    name: "midnight_get_latest_updates",
    mcpName: "midnight-get-latest-updates",
    description: "Retrieve recent changes and commits across Midnight repositories.",
    args: { since: "ISO date", repos: "string[]" },
  },
  {
    name: "midnight_list_tool_categories",
    mcpName: "midnight-list-tool-categories",
    description: "List available Midnight MCP tool categories for discovery.",
    args: {},
  },
  {
    name: "midnight_suggest_tool",
    mcpName: "midnight-suggest-tool",
    description: "Describe a goal in natural language and get recommended Midnight tools.",
    args: { intent: "string" },
  },
  {
    name: "midnight_health_check",
    mcpName: "midnight-health-check",
    description: "Check the Midnight MCP server health, API connectivity, and resource availability.",
    args: { detailed: "boolean (default false)" },
  },
  {
    name: "midnight_get_status",
    mcpName: "midnight-get-status",
    description: "Get current Midnight MCP server status, version, and rate limits.",
    args: {},
  },
];

/**
 * Invoke a tool via the main-process MCP client.
 * The IPC channel `mcp:call-tool` is registered in electron/integrations/mcp/index.ts
 * and is the cleanest way for renderer/tool modules to call an MCP tool.
 */
async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    // In the main process, require the MCP client singleton directly.
    // This avoids brittle IPC from a ToolModule that runs in the main process.
    const { mcpClient } = require("../../mcp");
    if (!mcpClient) {
      return { success: false, error: "MCP client is not initialized" };
    }
    if (!mcpClient.isConnected(SERVER_NAME)) {
      return {
        success: false,
        error: `Midnight MCP server "${SERVER_NAME}" is not connected. It should auto-connect at startup; check the MCP panel.`,
      };
    }
    const result = await mcpClient.callTool(SERVER_NAME, toolName, args);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function toolDefinition(mapping: (typeof TOOL_MAPPINGS)[number]): ToolDefinition {
  return {
    name: mapping.name,
    description: mapping.description,
    inputSchema: {
      type: "object",
      properties: mapping.args,
    },
    handler: async (args) => {
      // Strip undefined / empty optional fields
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null && v !== "") cleaned[k] = v;
      }
      const result = await callMcpTool(mapping.mcpName, cleaned);
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result.data };
    },
  };
}

export class MidnightModule implements ToolModule {
  name = "midnight";
  displayName = "Midnight Network";
  actionPatterns = [];

  tools: ToolDefinition[] = TOOL_MAPPINGS.map(toolDefinition);

  getSystemPrompt(): string {
    return `
# Midnight Network Tools

You have access to Midnight Network tools via the "midnight" module. Midnight is a zero-knowledge partner chain to Cardano for privacy-preserving decentralized applications.

## Core Concepts
- **NIGHT**: the native token.
- **DUST**: the gas token, generated by delegating/spending NIGHT.
- **Compact**: Midnight's smart-contract language for ZK circuits.
- **Ledger**: dual-state — public ledger + private local state.
- **Circuits**: ZK programs that prove facts without revealing inputs.
- **Witnesses**: functions that fetch private inputs from local state.

## Available Tools (module: midnight)

Generation:
- midnight_generate_contract — create Compact from a description
- midnight_compile_contract — validate/compile Compact code
- midnight_review_contract — AI security/privacy review

Analysis:
- midnight_analyze_contract — static structure & security analysis
- midnight_explain_circuit — plain-language circuit explanation

Search & Discovery:
- midnight_search_compact — find Compact patterns/examples
- midnight_search_docs — search official Midnight docs
- midnight_search_typescript — search Midnight.js SDK
- midnight_list_examples — list official example contracts
- midnight_get_latest_updates — latest repo changes
- midnight_list_tool_categories — browse tool categories
- midnight_suggest_tool — get tool recommendation from intent

Health:
- midnight_health_check — MCP server health
- midnight_get_status — version & rate limits

## Usage Rules
1. ALWAYS call midnight_get_latest_syntax before writing any Compact code.
2. ALWAYS compile generated Compact with midnight_compile_contract before claiming it works.
3. Prefer midnight_suggest_tool when the user is unsure which tool to use.
4. Keep responses concise and based only on tool output.
`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { mcpClient } = require("../../mcp");
      return mcpClient?.isConnected(SERVER_NAME) ?? false;
    } catch {
      return false;
    }
  }
}
