#!/usr/bin/env node
/**
 * Stargate Skills Marketplace MCP Server — Bridge for Mosaic Companion
 *
 * Exposes Stargate Skills Marketplace API operations via the Model Context Protocol (stdio).
 * Connects to:
 *   - http://localhost:3000/api  (marketplace backend)
 *   - http://localhost:8001      (SkillSpector security scanner)
 *
 * Zero npm dependencies — built-in Node.js modules only.
 *
 * Protocol: MCP 2024-11-05 (stdio / JSON-RPC 2.0)
 */

const http = require("http");
const https = require("https");
const readline = require("readline");
const os = require("os");
const path = require("path");
const fs = require("fs");

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const MARKETPLACE_API = process.env.STARGATE_MARKETPLACE_URL || "http://127.0.0.1:13000/api";
const SCANNER_API = process.env.STARGATE_SCANNER_URL || "http://localhost:8001";

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_skills",
    description:
      "Search skills in the Stargate Skills Marketplace. Supports keyword search, category filter, and sorting by stars, votes, or recency.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords (optional)" },
        category: { type: "string", description: "Category slug filter, e.g. 'ai-agents', 'cli-tools' (optional)" },
        sort: { type: "string", enum: ["stars", "votes", "recent", "name"], default: "stars" },
        order: { type: "string", enum: ["asc", "desc"], default: "desc" },
        page: { type: "integer", description: "Page number", default: 1 },
        perPage: { type: "integer", description: "Items per page", default: 12 },
      },
    },
  },
  {
    name: "get_skill",
    description:
      "Get detailed information about a single skill by its slug. Returns full metadata, README preview, security report, vote/bookmark counts, and category info.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Skill slug, e.g. 'kanban-orchestrator'" },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_categories",
    description:
      "List all skill categories in the marketplace with their counts and metadata.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "scan_skill",
    description:
      "Run a security scan (SkillSpector) on a skill. Requires the skill source URL (GitHub repo or local path). Returns vulnerability findings and risk score.",
    inputSchema: {
      type: "object",
      properties: {
        sourceUrl: { type: "string", description: "GitHub URL or local filesystem path to the skill source" },
        skillSlug: { type: "string", description: "Optional: store report under this skill slug" },
      },
      required: ["sourceUrl"],
    },
  },
  {
    name: "get_security_report",
    description:
      "Retrieve the latest security report for a skill by its slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Skill slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "vote_skill",
    description:
      "Upvote or downvote a skill in the marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Skill slug" },
        direction: { type: "string", enum: ["up", "down"], description: "Vote direction" },
      },
      required: ["slug", "direction"],
    },
  },
  {
    name: "bookmark_skill",
    description:
      "Bookmark a skill to the user's collection.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Skill slug" },
      },
      required: ["slug"],
    },
  },
  {
    name: "attach_skill_to_agent",
    description:
      "Attach a marketplace skill to a Mosaic Companion AI agent. Updates the agent's skills[] array so the skill is available in AI Chat.",
    inputSchema: {
      type: "object",
      properties: {
        skillSlug: { type: "string", description: "Skill slug to attach" },
        agentId: { type: "string", description: "Mosaic AI agent ID" },
      },
      required: ["skillSlug", "agentId"],
    },
  },
  {
    name: "discover_skills",
    description:
      "Trigger the skill discovery pipeline. Scans GitHub for new skills and syncs local ~/.hermes/skills/ entries into the marketplace database.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["github", "local", "all"], default: "all" },
        limit: { type: "integer", description: "Max skills to discover", default: 20 },
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Helper (zero-dependency fetch replacement)
// ─────────────────────────────────────────────────────────────────────────────

function httpRequest(method, urlStr, body = null, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === "https:" ? https : http;
    const headers = {};
    if (body) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: method.toUpperCase(),
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            const preview = data.slice(0, 200).replace(/\s+/g, " ");
            reject(new Error(`HTTP ${res.statusCode} from ${urlStr}: ${preview}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve({ status: res.statusCode, data: json });
          } catch {
            resolve({ status: res.statusCode, data: { raw: data } });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    });

    if (body) req.write(body);
    req.end();
  });
}

// Cached backend health check (negative result expires after 30s)
let _backendHealthy = true;
let _backendCheckedAt = 0;
const BACKEND_HEALTH_TTL = 30000;

async function checkBackendHealth() {
  const now = Date.now();
  if (now - _backendCheckedAt < BACKEND_HEALTH_TTL) return _backendHealthy;
  _backendCheckedAt = now;
  try {
    await httpRequest("GET", `${MARKETPLACE_API}/categories`, null, 3000);
    _backendHealthy = true;
    return true;
  } catch {
    _backendHealthy = false;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function execTool(name, args) {
  // Fast-fail: skip backend calls if marketplace is known to be unreachable
  if (['search_skills','get_skill','get_categories','scan_skill','get_security_report',
       'vote_skill','bookmark_skill','discover_skills'].includes(name)) {
    const healthy = await checkBackendHealth();
    if (!healthy) {
      throw Object.assign(
        new Error('Skills marketplace backend is not reachable (localhost:13000). Is the marketplace server running?'),
        { code: -32001 }
      );
    }
  }

  let result;

  switch (name) {
    case "search_skills": {
      const params = new URLSearchParams();
      if (args.query) params.set("search", args.query);
      if (args.category) params.set("category", args.category);
      params.set("sort", args.sort || "stars");
      params.set("order", args.order || "desc");
      params.set("page", String(args.page || 1));
      params.set("perPage", String(Math.min(Math.floor(args.perPage || 12), 50)));

      const res = await httpRequest("GET", `${MARKETPLACE_API}/skills?${params.toString()}`);
      result = res.data;
      break;
    }

    case "get_skill": {
      const res = await httpRequest("GET", `${MARKETPLACE_API}/skills/${encodeURIComponent(args.slug)}`);
      if (res.status === 404) {
        throw Object.assign(new Error(`Skill "${args.slug}" not found`), { code: -32001 });
      }
      result = res.data;
      break;
    }

    case "get_categories": {
      const res = await httpRequest("GET", `${MARKETPLACE_API}/categories`);
      result = res.data;
      break;
    }

    case "scan_skill": {
      const res = await httpRequest(
        "POST",
        `${SCANNER_API}/scan`,
        { url: args.sourceUrl, skill_slug: args.skillSlug || null },
        60000 // scanning can take longer
      );
      result = res.data;
      break;
    }

    case "get_security_report": {
      // Security reports are stored in the backend as part of skill detail
      const res = await httpRequest("GET", `${MARKETPLACE_API}/skills/${encodeURIComponent(args.slug)}`);
      if (res.status === 404) {
        throw Object.assign(new Error(`Skill "${args.slug}" not found`), { code: -32001 });
      }
      result = { securityReport: res.data.securityReport || null };
      break;
    }

    case "vote_skill": {
      const res = await httpRequest("POST", `${MARKETPLACE_API}/votes`, {
        skillSlug: args.slug,
        direction: args.direction,
      });
      result = res.data;
      break;
    }

    case "bookmark_skill": {
      const res = await httpRequest("POST", `${MARKETPLACE_API}/bookmarks`, {
        skillSlug: args.slug,
      });
      result = res.data;
      break;
    }

    case "attach_skill_to_agent": {
      // Mosaic AI agents live in ~/.config/mosaic-companion/ai-agents.json
      // We read, modify, and write back
      const configPath = path.join(os.homedir(), ".config", "mosaic-companion", "ai-agents.json");
      if (!fs.existsSync(configPath)) {
        throw Object.assign(new Error("Mosaic AI agents config not found"), { code: -32002 });
      }
      const raw = fs.readFileSync(configPath, "utf8");
      const agents = JSON.parse(raw);
      const agent = agents.find((a) => a.id === args.agentId || a.name === args.agentId);
      if (!agent) {
        throw Object.assign(new Error(`Agent "${args.agentId}" not found`), { code: -32003 });
      }

      // Fetch skill metadata from marketplace to get full info
      const skillRes = await httpRequest("GET", `${MARKETPLACE_API}/skills/${encodeURIComponent(args.skillSlug)}`);
      if (skillRes.status === 404) {
        throw Object.assign(new Error(`Skill "${args.skillSlug}" not found in marketplace`), { code: -32001 });
      }
      const skill = skillRes.data;

      agent.skills = agent.skills || [];
      const already = agent.skills.find((s) => s.slug === skill.slug || s.id === skill.slug);
      if (!already) {
        agent.skills.push({
          id: skill.slug,
          name: skill.name,
          source: skill.source || "github",
          url: skill.sourceUrl || skill.githubUrl,
          addedAt: new Date().toISOString(),
        });
        fs.writeFileSync(configPath, JSON.stringify(agents, null, 2));
      }

      result = { attached: true, agent: agent.name || agent.id, skill: skill.name };
      break;
    }

    case "discover_skills": {
      // Trigger the discovery pipeline via backend webhook or direct scan
      const res = await httpRequest(
        "POST",
        `${MARKETPLACE_API}/admin/discover`,
        { source: args.source || "all", limit: Math.min(args.limit || 20, 50) }
      );
      result = res.data;
      break;
    }

    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }

  // Pretty-print structured JSON for MCP content
  const text = "```json\n" + JSON.stringify(result, null, 2).slice(0, 12000) + "\n```";
  return {
    content: [{ type: "text", text }],
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
        serverInfo: { name: "stargate-marketplace-mcp", version: "1.0.0" },
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
        sendError(id, code, err.message || String(err));
      }
      break;
    }

    case "notifications/initialized":
      // No-op — client handshake complete
      break;

    case "$/cancelRequest":
      // No-op — cancellation not supported in this bridge
      break;

    default:
      if (method?.startsWith("notifications/")) {
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
  `[stargate-marketplace-mcp] Ready. API=${MARKETPLACE_API} SCANNER=${SCANNER_API}\n`
);

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    await handleMessage(msg);
  } catch (e) {
    process.stderr.write(`[stargate-marketplace-mcp] Parse error: ${e.message}\n`);
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
  process.stderr.write("[stargate-marketplace-mcp] stdin closed — finishing pending requests\n");
  // Give in-flight async requests a brief window to complete before exit
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

process.on("SIGTERM", () => {
  process.stderr.write("[stargate-marketplace-mcp] SIGTERM received\n");
  process.exit(0);
});
