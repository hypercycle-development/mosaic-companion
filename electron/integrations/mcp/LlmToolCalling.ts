/**
 * Example: Using MCP with LLM Tool Calling
 *
 * Demonstrates how to use the modular recipes and providers for agentic
 * MCP workflows. This file is now a thin demo — all logic lives in
 * recipes/ and providers/.
 *
 * Run: npx ts-node integrations/mcp/LlmToolCalling.ts
 */

import { MCPClient, mcpResultToString } from "./MCPClient";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import type { LLMProvider } from "./providers/types";
import {
  directToolCall,
  batchToolCalls,
  findAndCallTool,
} from "./recipes/directToolCall";
import { runAgentLoop } from "./recipes/agentLoop";
import { unifiedToolSurface } from "./recipes/multiServerFanout";
import { discoverPrompts } from "./recipes/promptChaining";

// =============================================================================
// Configuration
// =============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const MCP_SERVERS = [
  {
    name: "local-tools",
    transport: "stdio" as const,
    command: "python",
    args: ["../mcp-implementation/python/server.py"],
  },
  // HTTP server example:
  // {
  //   name: 'remote-tools',
  //   transport: 'http' as const,
  //   url: 'http://localhost:8000/mcp',
  // },
];

// =============================================================================
// Demo Functions
// =============================================================================

/**
 * Demo 1: Direct tool calls (no LLM)
 */
async function demoDirectCalls(mcp: MCPClient, serverName: string) {
  console.log("\n" + "═".repeat(50));
  console.log("📌 Demo 1: Direct Tool Calls");
  console.log("═".repeat(50));

  // Single call
  console.log("\n→ Calling get_current_time...");
  const time = await directToolCall(mcp, serverName, "get_current_time", {
    timezone: "America/New_York",
  });
  console.log(`  Result: ${time}`);

  // Find and call across servers
  console.log("\n→ Finding and calling get_current_time across all servers...");
  try {
    const { server, result } = await findAndCallTool(mcp, "get_current_time", {
      timezone: "Asia/Tokyo",
    });
    console.log(`  Found on: ${server}`);
    console.log(`  Result: ${result}`);
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
  }

  // Batch calls
  console.log("\n→ Batch calling multiple tools in parallel...");
  const batchResults = await batchToolCalls(mcp, [
    {
      server: serverName,
      tool: "get_current_time",
      args: { timezone: "America/New_York" },
    },
    {
      server: serverName,
      tool: "get_current_time",
      args: { timezone: "Europe/London" },
    },
    {
      server: serverName,
      tool: "get_current_time",
      args: { timezone: "Asia/Tokyo" },
    },
  ]);

  for (const r of batchResults) {
    if (r.result) {
      console.log(`  ${r.tool}: ${r.result}`);
    } else {
      console.log(`  ${r.tool}: ERROR - ${r.error}`);
    }
  }
}

/**
 * Demo 2: Unified tool surface
 */
async function demoToolSurface(mcp: MCPClient) {
  console.log("\n" + "═".repeat(50));
  console.log("📌 Demo 2: Unified Tool Surface");
  console.log("═".repeat(50));

  const tools = await unifiedToolSurface(mcp);
  console.log(`\n  Found ${tools.length} tools across all servers:\n`);

  for (const tool of tools) {
    console.log(`  [${tool.serverName}] ${tool.qualifiedName}`);
    console.log(`    ${tool.description || "No description"}`);
  }
}

/**
 * Demo 3: Prompt discovery
 */
async function demoPrompts(mcp: MCPClient) {
  console.log("\n" + "═".repeat(50));
  console.log("📌 Demo 3: Prompt Discovery");
  console.log("═".repeat(50));

  const prompts = await discoverPrompts(mcp);

  if (prompts.length === 0) {
    console.log("\n  No prompts found on any server.");
    return;
  }

  console.log(`\n  Found ${prompts.length} prompts:\n`);
  for (const prompt of prompts) {
    console.log(`  [${prompt._serverName}] ${prompt.name}`);
    console.log(`    ${prompt.description || "No description"}`);
    if (prompt.arguments?.length) {
      console.log(
        `    Args: ${prompt.arguments.map((a) => a.name).join(", ")}`,
      );
    }
  }
}

/**
 * Demo 4: Agent loop with tool calling
 */
async function demoAgentLoop(
  mcp: MCPClient,
  provider: LLMProvider,
  providerName: string,
  serverNames: string[],
) {
  console.log("\n" + "═".repeat(50));
  console.log(`📌 Demo 4: Agent Loop (${providerName})`);
  console.log("═".repeat(50));

  const query =
    "What is the current time in Tokyo? Also, fetch the homepage of example.com and summarize it.";

  console.log(`\n  Query: "${query}"\n`);

  const result = await runAgentLoop(mcp, provider, serverNames, query, {
    maxIterations: 10,
    onBeforeToolCall: (toolName, args, server) => {
      console.log(`  🔧 [${server}] Calling: ${toolName}`);
      console.log(`     Args: ${JSON.stringify(args)}`);
      return true; // Approve all calls in this demo
    },
    onToolResult: (toolName, resultText) => {
      const preview =
        resultText.length > 100 ? resultText.slice(0, 100) + "..." : resultText;
      console.log(`     ← ${preview}`);
    },
    onIteration: (iteration) => {
      console.log(`\n  🔄 Iteration ${iteration}`);
    },
  });

  console.log(`\n  ✅ Completed in ${result.iterations} iterations`);
  console.log(`\n  📝 Response:\n  ${result.content}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("🚀 MCP Integration Examples\n");

  // Check for API keys
  const hasLLM = !!(OPENAI_API_KEY || ANTHROPIC_API_KEY);
  if (!hasLLM) {
    console.log(
      "⚠️  No API keys set. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for agent demo.",
    );
    console.log("   Running non-LLM demos only.\n");
  }

  // Create client
  const mcp = new MCPClient({ debug: false });

  mcp.on("connected", ({ server }) => console.log(`✅ Connected: ${server}`));
  mcp.on("disconnected", ({ server }) =>
    console.log(`❌ Disconnected: ${server}`),
  );

  try {
    // Connect to all servers
    for (const config of MCP_SERVERS) {
      if (config.transport === "stdio") {
        await mcp.connectStdio(config.name, config.command, config.args);
      } else {
        await mcp.connectHttp(config.name, (config as any).url);
      }
    }

    const serverName = MCP_SERVERS[0].name;
    const serverNames = mcp.getConnectedServers();

    // Run demos
    await demoDirectCalls(mcp, serverName);
    await demoToolSurface(mcp);
    await demoPrompts(mcp);

    // Agent loop (requires API key)
    if (hasLLM) {
      let provider: LLMProvider;
      let providerName: string;

      if (ANTHROPIC_API_KEY) {
        provider = new AnthropicProvider(ANTHROPIC_API_KEY);
        providerName = "Anthropic";
      } else {
        provider = new OpenAIProvider(OPENAI_API_KEY);
        providerName = "OpenAI";
      }

      await demoAgentLoop(mcp, provider, providerName, serverNames);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await mcp.disconnectAll();
    console.log("\n👋 Done!");
  }
}

main();
