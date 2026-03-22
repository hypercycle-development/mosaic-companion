import { _electron as electron, test, expect } from "@playwright/test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { z } from "zod";

const electronPath = require("electron");

/**
 * Starts a temporary local MCP HTTP server used only by this E2E test.
 *
 * The server exposes one tool: `add_two_numbers(a, b)`.
 * We also keep a call counter so the test can verify that the tool
 * was actually invoked from the app (not just that the UI changed).
 */
const createAddTwoNumbersServer = async (): Promise<{
  server: HttpServer;
  port: number;
  getToolCallCount: () => number;
}> => {
  const app = createMcpExpressApp();
  let toolCallCount = 0;

  app.post("/mcp", async (req, res) => {
    const mcpServer = new McpServer({
      name: "e2e-mcp-add-server",
      version: "1.0.0",
    });

    mcpServer.registerTool(
      "add_two_numbers",
      {
        description: "Adds two numbers and returns the sum",
        inputSchema: {
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        },
      },
      async ({ a, b }) => {
        toolCallCount += 1;
        return {
          content: [{ type: "text", text: String(a + b) }],
        };
      },
    );

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on("close", () => {
        transport.close();
        mcpServer.close();
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (_req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
    );
  });

  app.delete("/mcp", async (_req, res) => {
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
    );
  });

  const server = await new Promise<HttpServer>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  const address = server.address() as AddressInfo;
  return {
    server,
    port: address.port,
    getToolCallCount: () => toolCallCount,
  };
};

test("mcp http plugin add and connect flow", async () => {
  // This test sends a real AI request from Chat, so we need a provider key.
  const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
  if (!GEMINI_KEY) {
    test.skip(true, "GEMINI_API_KEY not set");
  }

  // Use random suffixes so test data does not collide with existing local state.
  const pluginSuffix = Math.floor(Math.random() * 90000) + 10000;
  const pluginName = `E2E MCP HTTP ${pluginSuffix}`;
  const pluginDescription = `MCP add-two-numbers HTTP server ${pluginSuffix}`;
  const e2eAgentId = `e2e-agent-${pluginSuffix}`;
  const e2eAgentName = `E2E Agent ${pluginSuffix}`;

  // Start local MCP server and build the URL that the app should connect to.
  const {
    server: mcpHttpServer,
    port,
    getToolCallCount,
  } = await createAddTwoNumbersServer();
  const mcpUrl = `http://localhost:${port}/mcp`;

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: ["."],
  });

  let page: Awaited<ReturnType<typeof electronApp.firstWindow>> | null = null;
  let originalAgents: any[] | null = null;

  try {
    page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");

    // Open sidebar if collapsed.
    const sidebarToggle = page.locator("button.absolute.top-4.left-4").first();
    if (await sidebarToggle.count()) {
      await sidebarToggle.click();
    }

    // ----- Step 1: Add MCP plugin (HTTP) from the MCP Servers page -----
    await page.locator('button:has-text("MCP Servers")').click();

    await page.locator('button[title="Add plugin"]').click();

    await page.locator('input[placeholder="Name *"]').fill(pluginName);
    await page
      .locator('input[placeholder="Description"]')
      .fill(pluginDescription);

    await page.locator('button:has-text("http")').click();
    await page
      .locator('input[placeholder="URL (e.g. http://localhost:8000/mcp)"]')
      .fill(mcpUrl);

    await page
      .locator('form:has-text("Add Plugin") button[type="submit"]')
      .click();

    const pluginNameLabel = page
      .locator("p.text-sm.text-gray-200", { hasText: pluginName })
      .first();
    await expect(pluginNameLabel).toBeVisible({ timeout: 10000 });

    const pluginCard = pluginNameLabel.locator(
      'xpath=ancestor::div[contains(@class,"mx-2") and contains(@class,"rounded-lg")][1]',
    );

    await pluginCard.locator('button:has-text("Connect")').click();

    await expect(
      pluginCard.locator('button:has-text("Disconnect")'),
    ).toBeVisible({ timeout: 15000 });

    // ----- Step 2: Ensure there is an active chat agent for AI Chat -----
    // We save current agents so we can restore them in `finally`.
    const agentSetupResult = await page.evaluate(
      async ({ agentId, agentName, apiKey }) => {
        const api = (window as any).electronAPI;
        const currentAgents = (await api.aiAgents.get()) || [];

        const newAgent = {
          id: agentId,
          name: agentName,
          provider: "gemini",
          apiKey,
          model: "gemini-2.0-flash",
          isActive: true,
          createdAt: Date.now(),
          temperature: 0,
          maxTokens: 512,
          richUI: false,
        };

        const withoutNewAgent = currentAgents.filter(
          (a: any) => a.id !== agentId,
        );
        const updatedAgents = [newAgent, ...withoutNewAgent];
        await api.aiAgents.set(updatedAgents);

        return {
          originalAgents: currentAgents,
        };
      },
      {
        agentId: e2eAgentId,
        agentName: e2eAgentName,
        apiKey: GEMINI_KEY,
      },
    );

    originalAgents = agentSetupResult.originalAgents;

    // ----- Step 3: Go to AI Chat and send a prompt that requires MCP tool use -----
    await page.locator('button:has-text("AI Chat")').click();
    await page.locator('button:has-text("New Chat")').first().click();

    const prompt = `Use the MCP tool add_two_numbers from server \"${pluginName}\" to add 7 and 5. You must call the tool before answering.`;

    await page.locator("textarea").fill(prompt);
    await page.locator("button[data-auto-send]").click();

    // ----- Step 4: Verify the MCP server function was really called -----
    await expect
      .poll(() => getToolCallCount(), {
        timeout: 90000,
        intervals: [1000, 2000, 3000],
      })
      .toBeGreaterThan(0);
  } finally {
    // Cleanup 1: restore user agents so test is non-destructive.
    if (page && originalAgents) {
      await page.evaluate(async (agents) => {
        const api = (window as any).electronAPI;
        await api.aiAgents.set(agents);
      }, originalAgents);
    }

    // Cleanup 2: close app and local test server.
    await electronApp.close();
    await new Promise<void>((resolve) => mcpHttpServer.close(() => resolve()));
  }
});
