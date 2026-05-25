#!/usr/bin/env node
/**
 * GBrain MCP Server — Bridge for Mosaic Companion
 *
 * Exposes gbrain CLI operations via the Model Context Protocol (stdio).
 * Runs as a child process spawned by Electron's MCP Client.
 *
 * Environment:
 *   GBRAIN_HOME — points to ~/.gbrain (auto-detected or set externally)
 *
 * Protocol: MCP 2024-11-05 (stdio / JSON-RPC 2.0)
 */

const { spawn, execFileSync } = require("child_process");
const readline = require("readline");
const path = require("path");
const os = require("os");

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

// GBRAIN_HOME is the PARENT directory that contains .gbrain/
// (not the .gbrain/ dir itself — gbrain CLI resolves database_path relative to it)
let GBRAIN_HOME = process.env.GBRAIN_HOME || path.join(os.homedir(), ".gbrain");
if (path.basename(GBRAIN_HOME) === ".gbrain" && path.basename(path.dirname(GBRAIN_HOME))) {
  GBRAIN_HOME = path.dirname(GBRAIN_HOME);
}
process.env.GBRAIN_HOME = GBRAIN_HOME;

// Ensure bun is on PATH so gbrain works
const BUN_PATH = path.join(os.homedir(), ".bun", "bin");
if (!process.env.PATH.includes(BUN_PATH)) {
  process.env.PATH = `${BUN_PATH}:${process.env.PATH}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "gbrain_search",
    description:
      "Keyword search (full-text) across gbrain pages. Best for exact-match lookups on titles, slugs, or content.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords" },
        limit: { type: "integer", description: "Max results", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "gbrain_query",
    description:
      "Hybrid semantic + keyword search across gbrain pages. Best for natural-language questions like 'what do we know about Stargate?'",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Natural-language question" },
        limit: { type: "integer", description: "Max results", default: 20 },
      },
      required: ["question"],
    },
  },
  {
    name: "gbrain_get_page",
    description:
      "Read a single gbrain page by its slug (e.g. 'stargate/dashboard'). Returns markdown frontmatter + body.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Page slug, e.g. 'stargate/dashboard'",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "gbrain_list_pages",
    description:
      "List recent pages with optional filters. Returns a table of slugs, types, tags, and updated timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by page type" },
        tag: { type: "string", description: "Filter by tag" },
        limit: { type: "integer", description: "Max results", default: 20 },
        sort: {
          type: "string",
          description: "Sort order",
          default: "updated_desc",
        },
      },
    },
  },
  {
    name: "gbrain_graph",
    description:
      "Traverse the gbrain link graph from a starting page. Returns connected pages up to a given depth.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Starting page slug, e.g. 'projects/mosaic-stargate'",
        },
        depth: { type: "integer", description: "How many hops", default: 2 },
      },
      required: ["slug"],
    },
  },
  {
    name: "gbrain_get_stats",
    description:
      "Return gbrain statistics: page count, chunk count, tag count, timeline entries, etc.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "gbrain_code_callers",
    description:
      "Find all callers of a code symbol across the brain's code index. Use before editing any function.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Bare or qualified symbol name",
        },
        limit: { type: "integer", default: 100 },
      },
      required: ["symbol"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC Helpers
// ─────────────────────────────────────────────────────────────────────────────

let msgId = 0;
const PENDING = new Map(); // id -> reject/resolve

function sendJson(obj) {
  const line = JSON.stringify(obj);
  if (process.stdout.writable) {
    process.stdout.write(line + "\n");
  }
}

function sendResponse(id, result) {
  sendJson({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  sendJson({ jsonrpc: "2.0", id, error: { code, message, data } });
}

function sendNotification(method, params) {
  sendJson({ jsonrpc: "2.0", method, params });
}

// ─────────────────────────────────────────────────────────────────────────────
// GBrain CLI Helper
// ─────────────────────────────────────────────────────────────────────────────

async function callGbrain(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn("gbrain", args, {
      env: { ...process.env, GBRAIN_HOME },
      stdio: ["ignore", "pipe", "pipe"],
      cwd: os.homedir(),
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error("gbrain command timed out after " + timeoutMs + "ms"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`gbrain spawn error: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0 && code !== null) {
        reject(
          new Error(
            `gbrain exited ${code}: ${stderr || stdout || "(no output)"}`
          )
        );
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function execTool(name, args) {
  let gArgs;
  switch (name) {
    case "gbrain_search": {
      const lim = Math.min(Math.floor(Number(args.limit || 20)), 50);
      gArgs = ["search", String(args.query), "-n", String(lim), "--json"];
      break;
    }
    case "gbrain_query": {
      const qlim = Math.min(Math.floor(Number(args.limit || 20)), 50);
      gArgs = ["query", String(args.question), "-n", String(qlim), "--json"];
      break;
    }
    case "gbrain_get_page": {
      gArgs = ["get", String(args.slug), "--json"];
      break;
    }
    case "gbrain_list_pages": {
      const ll = Math.min(Math.floor(Number(args.limit || 20)), 50);
      gArgs = ["list", "-n", String(ll), "--json"];
      if (args.type) gArgs.push("--type", String(args.type));
      if (args.tag) gArgs.push("--tag", String(args.tag));
      if (args.sort) gArgs.push("--sort", String(args.sort));
      break;
    }
    case "gbrain_graph": {
      const dep = Math.min(Math.max(1, Number(args.depth || 2)), 8);
      gArgs = [
        "graph",
        String(args.slug),
        "--json",
        "--depth",
        String(dep),
      ];
      break;
    }
    case "gbrain_get_stats": {
      gArgs = ["stats", "--json"];
      break;
    }
    case "gbrain_code_callers": {
      gArgs = [
        "code-callers",
        String(args.symbol),
        "--json",
      ];
      if (args.limit) gArgs.push("-n", String(args.limit));
      break;
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }

  const raw = await callGbrain(gArgs, 30000);

  // gbrain --json may return raw JSON or a JSON array/object we need to parse
  // If the body is already JSON, return it directly for richer rendering
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
      // Pretty-print structured data
      return {
        content: [
          {
            type: "text",
            text:
              "```json\n" +
              JSON.stringify(parsed, null, 2).slice(0, 8000) +
              "\n```",
          },
        ],
        isError: false,
      };
    }
  } catch {
    // Not JSON, treat as plain text
  }

  return {
    content: [{ type: "text", text: raw }],
    isError: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Router
// ─────────────────────────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
          logging: {},
        },
        serverInfo: { name: "gbrain-mcp", version: "1.0.0" },
      });
      break;

    case "ping":
      sendResponse(id, {});
      break;

    case "tools/list":
      sendResponse(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments || params?.args || {};
      if (!toolName) {
        sendError(id, -32602, "Missing tool name");
        return;
      }
      try {
        const result = await execTool(toolName, toolArgs);
        sendResponse(id, result);
      } catch (err) {
        const code = err.code || -32600;
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: `[gbrain-mcp] Error calling ${toolName}: ${err.message}`,
            },
          ],
          isError: true,
        });
      }
      break;
    }

    case "notifications/initialized":
      // No-op — client has finished handshake
      break;

    case "$/cancelRequest":
      // No-op — we don't support cancellation in this bridge
      break;

    default:
      if (method?.startsWith("notifications/")) {
        // Ignore unknown notifications
        break;
      }
      sendError(id, -32601, `Unknown method: ${method}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stdin Line Reader (MCP over stdio)
// ─────────────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

process.stderr.write(
  `[gbrain-mcp] Ready. GBRAIN_HOME=${GBRAIN_HOME} PATH=${process.env.PATH}\n`
);

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    await handleMessage(msg);
  } catch (e) {
    process.stderr.write(`[gbrain-mcp] Parse error: ${e.message}\n`);
    // Send parse error back if we have an id
    try {
      const msg = JSON.parse(line);
      if (msg?.id !== undefined) {
        sendError(msg.id, -32700, `Parse error: ${e.message}`);
      }
    } catch {
      // Can't even parse the id — swallow
    }
  }
});

rl.on("close", () => {
  process.stderr.write("[gbrain-mcp] stdin closed — shutting down\n");
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.stderr.write("[gbrain-mcp] SIGTERM received\n");
  process.exit(0);
});
