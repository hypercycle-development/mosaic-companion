/**
 * Example: Using MCP with LLM Tool Calling
 *
 * This demonstrates how to integrate MCP tools with an LLM (OpenAI/Anthropic)
 * for agentic workflows. The LLM can discover and call MCP tools.
 *
 * Run: npx integrations/mcp/LlmToolCalling.ts
 */

import { MCPTool } from "@/src/types/integrations/mcp";
import MCPClient, { mcpToolsToOpenAI, mcpResultToString } from "./MCPClient";

// ============ CONFIGURATION ============

// Replace with your actual API keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// MCP Server configuration
const MCP_SERVERS = [
  {
    name: "local-tools",
    transport: "stdio" as const,
    command: "python",
    args: ["../mcp-implementation/python/server.py"],
    url: "",
  },
  // Or connect to an HTTP server:
  // {
  //   name: 'remote-tools',
  //   transport: 'http' as const,
  //   url: 'http://localhost:8000/mcp',
  // },
];

// ============ LLM INTEGRATION ============

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Call OpenAI's API with tool support
 */
async function callOpenAI(
  messages: Message[],
  tools: MCPTool[]
): Promise<{
  message: Message;
  toolCalls?: ToolCall[];
}> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo-preview",
      messages,
      tools: mcpToolsToOpenAI(tools),
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  return {
    message: choice.message,
    toolCalls: choice.message.tool_calls,
  };
}

/**
 * Call Anthropic's API with tool support
 */
async function callAnthropic(
  messages: Message[],
  tools: MCPTool[]
): Promise<{
  message: Message;
  toolCalls?: ToolCall[];
}> {
  // Convert tools to Anthropic format
  const anthropicTools = tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    input_schema: tool.inputSchema,
  }));

  // Convert messages to Anthropic format
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "tool" ? "user" : m.role,
      content:
        m.role === "tool"
          ? [
              {
                type: "tool_result",
                tool_use_id: m.tool_call_id,
                content: m.content,
              },
            ]
          : m.content,
    }));

  const systemMessage =
    messages.find((m) => m.role === "system")?.content || "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4096,
      system: systemMessage,
      messages: anthropicMessages,
      tools: anthropicTools,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();

  // Convert Anthropic response to common format
  const textContent = data.content.find((c: any) => c.type === "text");
  const toolUses = data.content.filter((c: any) => c.type === "tool_use");

  const toolCalls = toolUses.map((tu: any) => ({
    id: tu.id,
    type: "function" as const,
    function: {
      name: tu.name,
      arguments: JSON.stringify(tu.input),
    },
  }));

  return {
    message: {
      role: "assistant",
      content: textContent?.text || "",
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    },
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ============ AGENT LOOP ============

/**
 * Run an agentic conversation with MCP tool calling
 */
async function runAgent(
  mcp: MCPClient,
  serverName: string,
  userQuery: string,
  provider: "openai" | "anthropic" = "openai"
): Promise<string> {
  console.log("\n🤖 Starting agent with query:", userQuery);
  console.log("─".repeat(50));

  // Get available tools from MCP server
  const tools = await mcp.listTools(serverName);
  console.log(
    `📦 Loaded ${tools.length} tools from ${serverName}:`,
    tools.map((t) => t.name).join(", ")
  );

  // Initialize conversation
  const messages: Message[] = [
    {
      role: "system",
      content: `You are a helpful assistant with access to tools. Use the tools to help answer the user's questions.
      
Available tools:
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

When you need information or to perform an action, use the appropriate tool.`,
    },
    {
      role: "user",
      content: userQuery,
    },
  ];

  // Agent loop
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    iterations++;
    console.log(`\n🔄 Iteration ${iterations}`);

    // Call LLM
    const llmCall = provider === "openai" ? callOpenAI : callAnthropic;
    const { message, toolCalls } = await llmCall(messages, tools);

    messages.push(message);

    // Check if we have tool calls
    if (!toolCalls || toolCalls.length === 0) {
      // No more tool calls, return the final response
      console.log("\n✅ Agent completed");
      return message.content;
    }

    // Execute tool calls
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 Calling tool: ${toolName}`, toolArgs);

      try {
        // Call the MCP tool
        const result = await mcp.callTool(serverName, toolName, toolArgs);
        const resultText = mcpResultToString(result);

        console.log(
          `   ← Result: ${resultText.slice(0, 100)}${
            resultText.length > 100 ? "..." : ""
          }`
        );

        // Add tool result to messages
        messages.push({
          role: "tool",
          content: resultText,
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        const errorMsg = `Tool error: ${(error as Error).message}`;
        console.log(`   ← Error: ${errorMsg}`);

        messages.push({
          role: "tool",
          content: errorMsg,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  throw new Error("Max iterations reached");
}

// ============ MAIN ============

async function main() {
  console.log("🚀 MCP + LLM Tool Calling Example\n");

  // Check for API keys
  if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
    console.log(
      "⚠️  No API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY"
    );
    console.log("   This example will demonstrate MCP client setup only.\n");
  }

  // Create MCP client
  const mcp = new MCPClient({ debug: true });

  // Set up event listeners
  mcp.on("connected", ({ server }) => {
    console.log(`✅ Connected to ${server}`);
  });

  mcp.on("disconnected", ({ server }) => {
    console.log(`❌ Disconnected from ${server}`);
  });

  mcp.on("notification", ({ server, method }) => {
    console.log(`📬 Notification from ${server}: ${method}`);
  });

  try {
    // Connect to MCP servers
    for (const config of MCP_SERVERS) {
      if (config.transport === "stdio") {
        await mcp.connectStdio(config.name, config.command, config.args);
      } else {
        await mcp.connectHttp(config.name, config.url!);
      }
    }

    // List tools from all servers
    for (const serverName of mcp.getConnectedServers()) {
      const tools = await mcp.listTools(serverName);
      console.log(`\n📋 Tools from ${serverName}:`);
      for (const tool of tools) {
        console.log(`   - ${tool.name}: ${tool.description}`);
      }

      const resources = await mcp.listResources(serverName);
      console.log(`\n📄 Resources from ${serverName}:`);
      for (const resource of resources) {
        console.log(`   - ${resource.uri}: ${resource.name}`);
      }
    }

    // Demo: Call a tool directly
    console.log("\n─".repeat(50));
    console.log("🔧 Direct tool call demo:\n");

    const serverName = MCP_SERVERS[0].name;

    // Call get_current_time
    console.log("Calling get_current_time...");
    const timeResult = await mcp.callTool(serverName, "get_current_time", {
      timezone: "America/New_York",
    });
    console.log("Result:", mcpResultToString(timeResult));

    // If API keys are available, run the agent
    if (OPENAI_API_KEY || ANTHROPIC_API_KEY) {
      const provider = OPENAI_API_KEY ? "openai" : "anthropic";
      console.log(`\n${"─".repeat(50)}`);
      console.log(`🤖 Running agent with ${provider}...\n`);

      const response = await runAgent(
        mcp,
        serverName,
        "What is the current time in Tokyo? Also, fetch the homepage of example.com and summarize it.",
        provider as "openai" | "anthropic"
      );

      console.log("\n📝 Final Response:");
      console.log(response);
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Cleanup
    await mcp.disconnectAll();
    console.log("\n👋 Done!");
  }
}

main();
