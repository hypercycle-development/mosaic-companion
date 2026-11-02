/**
 * E2E test: Native tool calling (openai/custom providers)
 *
 * Verifies that:
 * 1. A custom (OpenAI-compatible) agent receives the `tools` array in its request
 * 2. The model's tool_calls are executed against the built-in ToolRegistry
 * 3. The tool result is sent back as role:"tool" messages with tool_call_id
 * 4. The final answer uses the tool data
 *
 * Uses a local mock OpenAI-compatible server so no real API key is needed.
 */
import { _electron as electron, test, expect } from "@playwright/test";
import http from "http";

const electronPath = require("electron");

let server: http.Server;
const recordedRequests: any[] = [];

function startMockServer(): Promise<number> {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          recordedRequests.push(parsed);
          const messages = parsed.messages || [];
          const hasToolResult = messages.some((m: any) => m.role === "tool");

          if (!hasToolResult) {
            const priceTool = (parsed.tools || []).find((t: any) =>
              t.function?.name?.includes("get_crypto_price"),
            );
            if (!priceTool) {
              // SSE: plain text answer
              res.writeHead(200, { "Content-Type": "text/event-stream" });
              res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: "NO_TOOL_FOUND" } }] })}\n\n`);
              res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
              return;
            }
            const safeName = priceTool.function.name;
            // SSE stream: tool_calls split across chunks to exercise accumulation
            res.writeHead(200, { "Content-Type": "text/event-stream" });
            res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: null } }] })}\n\n`);
            res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_mock_1", type: "function", function: { name: safeName, arguments: "" } }] } }] })}\n\n`);
            res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"symbol":' } }] } }] })}\n\n`);
            res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '"bitcoin"}' } }] } }] })}\n\n`);
            res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          // Round 2: tool result present → final answer (SSE)
          const toolMsg = messages.find((m: any) => m.role === "tool");
          const answer = `Bitcoin price from tool: ${toolMsg?.content ?? "(no data)"}`;
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: answer } }] })}\n\n`);
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: String(e) } }));
        }
      });
    });
    server.listen(0, "127.0.0.1", () => resolve((server.address() as any).port));
  });
}

/** Poll until cond() is true or timeout ms elapse. */
async function waitFor(cond: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${what}`);
}

test("native tool calling end-to-end via mock OpenAI server", async () => {
  test.setTimeout(180_000);

  const port = await startMockServer();

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: ["."],
    // Isolated scratch profile + multi-instance allowed: the test never fights
    // the installed app for the single-instance lock, and never touches real data.
    env: {
      ...process.env,
      MOSAIC_ALLOW_MULTI_INSTANCE: "1",
      MOSAIC_USER_DATA_DIR: `/tmp/mosaic-e2e-${Date.now()}`,
    } as any,
  });
  const page = await electronApp.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500); // let the app settle

  // ── Create the test agent directly via the IPC bridge ──
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const agentId = `agent-test-${rand}`;
  const agentName = `NativeTools test #${rand}`;
  const addResult = await page.evaluate(
    ({ id, name, port }) =>
      (window as any).electronAPI.aiAgents.add({
        id,
        name,
        provider: "custom",
        apiKey: "mock-key",
        baseUrl: `http://127.0.0.1:${port}`,
        model: "mock-model",
        maxTokens: 1024,
        temperature: 0.7,
        isActive: true,
        createdAt: Date.now(),
      }),
    { id: agentId, name: agentName, port },
  );
  console.log("[test] add result:", JSON.stringify(addResult));

  // ── Fresh profile shows the landing page — click through onboarding ──
  const getStarted = page.locator('button:has-text("Get Started")').first();
  if (await getStarted.count()) {
    await getStarted.click({ force: true });
    await page.waitForTimeout(2000);
    // Onboarding may have multiple steps — click through any forward-flow buttons
    for (let i = 0; i < 8; i++) {
      const next = page.locator('button:has-text("Continue"), button:has-text("Next"), button:has-text("Get Started"), button:has-text("Skip"), button:has-text("Finish"), button:has-text("Done"), button:has-text("Configure Your Agent"), button:has-text("Explore MosAIc")').first();
      if (!(await next.count())) break;
      await next.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
  }

  // ── Open chat: ChatView mounts on tab click and fetches agents fresh ──
  // Fresh profile may start with the sidebar collapsed — open it first.
  const sidebarToggle = page.locator("button.absolute.top-4.left-4").first();
  if (await sidebarToggle.count()) await sidebarToggle.click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);

  const chatBtn = page.locator('button[title*="Chat one-on-one"]').first();
  let chatBtnCount = await chatBtn.count();
  if (!chatBtnCount) {
    // Diagnostic: dump all buttons (text + first classes) to find the sidebar state
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .slice(0, 60)
        .map((b) => ({
          t: (b as HTMLElement).textContent?.trim().slice(0, 30) || "",
          title: (b as HTMLElement).title || undefined,
          cls: ((b as HTMLElement).className || "").toString().slice(0, 60),
        })),
    );
    console.log("[test] all buttons on page:", JSON.stringify(allBtns, null, 1));
    await page.waitForTimeout(2000);
    chatBtnCount = await chatBtn.count();
  }
  console.log("[test] chat button found:", chatBtnCount);
  if (chatBtnCount) await chatBtn.click({ force: true }); // decorative corner overlay can intercept — force through
  else throw new Error("Chat button not found — see titled buttons dump above");

  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ timeout: 15000 });
  await textarea.fill("What is the price of bitcoin?");
  await textarea.press("Enter"); // Enter sends (Shift+Enter = newline); avoids disabled-button timing

  // ── Wait for the mock server to see both rounds ──
  try {
    await waitFor(
      () => recordedRequests.some((r) => (r.messages || []).some((m: any) => m.role === "tool")),
      45_000,
      "tool result round-trip (request → tool_calls → role:tool message)",
    );
  } catch (e) {
    // Dump what the mock server actually received to diagnose where the chain broke
    const diag = recordedRequests.map((r, i) => ({
      idx: i,
      hasTools: Array.isArray(r.tools) ? r.tools.length : 0,
      model: r.model,
      roles: (r.messages || []).map((m: any) => m.role),
      lastUserContent: [...(r.messages || [])].reverse().find((m: any) => m.role === "user")?.content?.slice(0, 120),
    }));
    throw new Error(
      `${(e as Error).message}\nMock server received ${recordedRequests.length} request(s): ${JSON.stringify(diag, null, 2)}`,
    );
  }

  // 1. First request carried a structured tools array with sanitized names
  const req1 = recordedRequests.find((r) => Array.isArray(r.tools) && r.tools.length > 0);
  expect(req1, "first request must contain a tools array").toBeTruthy();
  const priceTool = req1.tools.find((t: any) =>
    t.function?.name?.includes("get_crypto_price"),
  );
  expect(priceTool, "web3 get_crypto_price must be exposed as a native tool").toBeTruthy();
  expect(priceTool.function.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);

  // 2. Second round carried the tool result as role:"tool" with tool_call_id
  const req2 = recordedRequests.find((r) =>
    (r.messages || []).some((m: any) => m.role === "tool"),
  );
  const toolMsg = req2.messages.find((m: any) => m.role === "tool");
  expect(toolMsg.tool_call_id).toBe("call_mock_1");
  expect(String(toolMsg.content).toLowerCase()).toContain("bitcoin");

  // 3. Final answer rendered in the UI
  await expect(
    page.locator("text=Bitcoin price from tool").first(),
  ).toBeVisible({ timeout: 30_000 });

  // Cleanup: remove the test agent
  await page.evaluate((id) => (window as any).electronAPI.aiAgents.delete(id), agentId);

  await electronApp.close();
});
