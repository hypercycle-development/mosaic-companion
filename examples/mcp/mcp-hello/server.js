/**
 * mcp-hello — minimal MCP server for MosAIc Companion
 *
 * Demonstrates:
 *   - McpServer setup with named tools
 *   - Tools with required arguments (word_count)
 *   - Tools with optional arguments (time_now)
 *   - Returning structured markdown text the agent can summarise
 *
 * Setup:  node setup.js   (registers in MosAIc, restart app to activate)
 * Remove: node remove.js
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-hello",
  version: "1.0.0",
});

// ── Tool: word_count ──────────────────────────────────────────────────────────
// Counts words, characters, sentences, and estimated reading time.
// LLMs are unreliable at counting — always use this tool for accurate results.

server.tool(
  "word_count",
  "Counts words, characters (with and without spaces), sentences, and estimated reading time for a piece of text. Always use this tool when asked to count words — do not count manually.",
  {
    text: z.string().describe("The text to analyse."),
  },
  async ({ text }) => {
    const words      = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    const charsTotal = text.length;
    const charsNoSp  = text.replace(/\s/g, "").length;
    const sentences  = (text.match(/[^.!?]*[.!?]+/g) ?? []).length || (text.trim() ? 1 : 0);
    const readMins   = (words / 200).toFixed(1); // ~200 wpm average reading speed

    return {
      content: [{
        type: "text",
        text: [
          `**Words:** ${words}`,
          `**Characters (with spaces):** ${charsTotal}`,
          `**Characters (no spaces):** ${charsNoSp}`,
          `**Sentences:** ${sentences}`,
          `**Reading time:** ~${readMins} min`,
        ].join("\n"),
      }],
    };
  }
);

// ── Tool: time_now ────────────────────────────────────────────────────────────
// Returns the current time. Optional timezone shifts the local representation.

server.tool(
  "time_now",
  "Returns the current date and time in multiple formats. Optionally pass a timezone (IANA name, e.g. 'America/New_York') to see the time in another region.",
  {
    timezone: z.string().optional().describe(
      "IANA timezone name (e.g. 'Europe/London'). Defaults to the system timezone."
    ),
  },
  async ({ timezone }) => {
    const now = new Date();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    let localStr;
    try {
      localStr = now.toLocaleString("en-GB", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      });
    } catch {
      return {
        content: [{
          type: "text",
          text: `Unknown timezone: "${timezone}". Use an IANA name like "Europe/London" or "America/New_York".`,
        }],
      };
    }

    return {
      content: [{
        type: "text",
        text: [
          `**Local (${tz}):** ${localStr}`,
          `**ISO 8601:** ${now.toISOString()}`,
          `**Unix timestamp:** ${Math.floor(now.getTime() / 1000)}`,
        ].join("\n"),
      }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
