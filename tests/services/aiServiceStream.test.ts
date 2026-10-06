import assert from "node:assert/strict";
import { test } from "node:test";
import { AIService } from "../../src/services/AIService";
import type { AIAgentConfig, ChatMessage } from "../../src/types/ai";

test("OpenAI stream keeps an SSE event split across network reads", async () => {
  const event = `data: ${JSON.stringify({ choices: [{ delta: { content: "Praxis answers Rule 56." } }] })}\n\ndata: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(event);
  const split = event.indexOf("Rule") + 2;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, split));
          controller.enqueue(bytes.slice(split));
          controller.close();
        },
      }),
      { status: 200, headers: { "content-type": "text/event-stream" } },
    );

  try {
    const tokens: string[] = [];
    let completed = "";
    const answer = await AIService.sendToOpenAI(
      { provider: "custom", baseUrl: "https://praxis.example", apiKey: "test", model: "praxis-legal" } as AIAgentConfig,
      [{ role: "user", content: "Rule 56?" } as ChatMessage],
      {
        onToken: (token) => tokens.push(token),
        onComplete: (text) => { completed = text; },
        onError: (error) => { throw error; },
      },
    );

    assert.equal(answer, "Praxis answers Rule 56.");
    assert.deepEqual(tokens, [answer]);
    assert.equal(completed, answer);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
