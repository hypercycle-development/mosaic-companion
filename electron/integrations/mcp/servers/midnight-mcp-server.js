#!/usr/bin/env node
/**
 * Midnight MCP Server — Bridge for Mosaic Companion
 *
 * Exposes Midnight Network operations via the Model Context Protocol (stdio).
 * Runs as a child process spawned by Electron's MCP Client.
 *
 * Uses Hermes Midnight skills as the knowledge backend and can shell out
 * to the Compact CLI, devnet Docker Compose, and Midnight wallet SDK.
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

const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), ".hermes");
const MIDNIGHT_EXPERT = process.env.MIDNIGHT_EXPERT || path.join(os.homedir(), "midnight-expert");

// Ensure hermes CLI is on PATH
const HERMES_BIN = path.join(os.homedir(), ".local", "bin");
if (!process.env.PATH.includes(HERMES_BIN)) {
  process.env.PATH = `${HERMES_BIN}:${process.env.PATH}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "midnight_status",
    description:
      "Check overall Midnight ecosystem health: devnet, proof server, indexer, wallet, and Compact CLI status.",
    inputSchema: {
      type: "object",
      properties: {
        verbose: { type: "boolean", description: "Include detailed diagnostics", default: false },
      },
      required: [],
    },
  },
  {
    name: "midnight_devnet",
    description:
      "Start, stop, or check status of the local Midnight devnet (node + indexer + proof server via Docker Compose).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "stop", "status", "restart", "logs"],
          description: "Devnet action to perform",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "midnight_compile",
    description:
      "Compile a Compact smart contract and return compilation diagnostics.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to .compact file" },
        verbose: { type: "boolean", description: "Verbose output", default: false },
      },
      required: ["file"],
    },
  },
  {
    name: "midnight_wallet",
    description:
      "Create, fund, or list Midnight test wallets. Manage NIGHT and DUST tokens.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "fund", "list", "balance", "register-dust"],
          description: "Wallet action",
        },
        name: { type: "string", description: "Wallet name/label", default: "" },
      },
      required: ["action"],
    },
  },
  {
    name: "midnight_skill",
    description:
      "Load and query a specific Midnight skill from the Hermes skill registry (compact-core, midnight-tooling, midnight-verify, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description:
            "Skill name, e.g. 'midnight-compact-core-basic-start', 'midnight-tooling-devnet', 'midnight-verify-verify-compact'",
        },
        query: {
          type: "string",
          description: "What to ask the skill (optional — loads skill into context)",
          default: "",
        },
      },
      required: ["skill"],
    },
  },
  {
    name: "midnight_status_codes",
    description:
      "Look up a Midnight error code, status code, or tagged error across the node, ledger, indexer, wallet, SDK, compiler, proof server, and DApp connector.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "Error code (e.g. '0x4b', '1010', 'Implicit disclosure of witness value')",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "midnight_contract_review",
    description:
      "Run a multi-axis review on a Compact contract: security, privacy, architecture, performance, testing, documentation, compilation.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to .compact file" },
        axes: {
          type: "array",
          items: { type: "string", enum: ["security", "privacy", "architecture", "performance", "testing", "documentation", "compilation"] },
          default: ["security", "privacy", "compilation"],
        },
      },
      required: ["file"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers
// ─────────────────────────────────────────────────────────────────────────────

function sendJson(obj) {
  const line = JSON.stringify(obj);
  process.stdout.write(line + "\n");
}

function sendResponse(id, result) {
  sendJson({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  sendJson({ jsonrpc: "2.0", id, error: { code, message } });
}

function sendNotification(method, params) {
  sendJson({ jsonrpc: "2.0", method, params });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────

function execShell(cmd, args = [], timeout = 30000) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: "utf-8",
      timeout,
      cwd: MIDNIGHT_EXPERT,
      env: { ...process.env, HERMES_HOME },
    });
    return { ok: true, stdout: out };
  } catch (e) {
    return { ok: false, error: e.message, stderr: e.stderr || "" };
  }
}

function skillViaHermes(skillName, query = "") {
  // Use hermes skill_view via hermes CLI (non-interactive)
  const result = execShell("hermes", ["skills", "view", skillName], 60000);
  if (!result.ok) {
    // Try skill_view as a one-shot
    return {
      ok: false,
      error: `Skill '${skillName}' not found or not loadable. Install with: hermes skills install ${skillName}`,
    };
  }
  return { ok: true, content: result.stdout };
}

async function handleMidnightStatus(args) {
  const checks = [];
  // Check Compact CLI
  const cli = execShell("compact", ["--version"], 5000);
  checks.push({ service: "compact-cli", ok: cli.ok, detail: cli.ok ? cli.stdout.trim() : cli.error });

  // Check devnet via docker
  const devnet = execShell("docker", ["compose", "ps"], 10000);
  checks.push({ service: "devnet-docker", ok: devnet.ok, detail: devnet.ok ? "Docker compose running" : devnet.error });

  // Check proof server health (if port 3000 is listening)
  const proof = execShell("curl", ["-s", "http://localhost:3000/health", "||", "echo", "not running"], 5000);
  checks.push({ service: "proof-server", ok: proof.stdout?.includes("ok") || false, detail: proof.stdout?.trim() || proof.error });

  // Check wallet SDK reference (via skill)
  const walletSkill = skillViaHermes("midnight-wallet-wallet-sdk");
  checks.push({ service: "wallet-sdk-skill", ok: walletSkill.ok, detail: walletSkill.ok ? "Skill loaded" : walletSkill.error });

  return {
    summary: checks.filter((c) => c.ok).length + " / " + checks.length + " services healthy",
    checks,
  };
}

async function handleMidnightDevnet(args) {
  const { action } = args;
  switch (action) {
    case "start":
      return execShell("docker", ["compose", "up", "-d"], 60000);
    case "stop":
      return execShell("docker", ["compose", "down"], 30000);
    case "status":
      return execShell("docker", ["compose", "ps"], 10000);
    case "restart":
      return execShell("docker", ["compose", "restart"], 60000);
    case "logs":
      return execShell("docker", ["compose", "logs", "--tail", "50"], 10000);
    default:
      return { ok: false, error: `Unknown devnet action: ${action}` };
  }
}

async function handleMidnightCompile(args) {
  const { file, verbose = false } = args;
  const flags = verbose ? ["compile", file, "--verbose"] : ["compile", file];
  return execShell("compact", flags, 30000);
}

async function handleMidnightWallet(args) {
  const { action, name = "" } = args;
  // These would typically be implemented via the wallet SDK or Compact CLI
  // For now, return guidance from the skill
  const skill = skillViaHermes("midnight-wallet-managing-test-wallets");
  return {
    ok: skill.ok,
    action,
    walletName: name,
    guidance: skill.ok ? skill.content : skill.error,
    note: "Wallet operations require the Compact CLI wallet commands or SDK integration. See guidance above.",
  };
}

async function handleMidnightSkill(args) {
  const { skill, query = "" } = args;
  const result = skillViaHermes(skill, query);
  return result;
}

async function handleMidnightStatusCodes(args) {
  const { code } = args;
  // Query the status-codes skill
  const result = skillViaHermes("midnight-status-codes-status-codes-lookup");
  if (!result.ok) {
    return { ok: false, error: result.error, code };
  }
  // In a full implementation, we'd parse the lookup script or reference docs
  return {
    ok: true,
    code,
    note: "Status code lookup requires running the midnight-status-codes lookup script or querying the reference docs.",
    skillLoaded: true,
    content: result.content,
  };
}

async function handleMidnightContractReview(args) {
  const { file, axes = ["security", "privacy", "compilation"] } = args;
  const results = [];
  for (const axis of axes) {
    const skillMap = {
      security: "midnight-compact-core-compact-security",
      privacy: "midnight-compact-core-compact-privacy-disclosure",
      architecture: "midnight-compact-core-compact-review",
      performance: "midnight-compact-core-compact-circuit-costs",
      testing: "midnight-cq-compact-testing",
      documentation: "midnight-compact-core-compact-review",
      compilation: "midnight-verify-verify-compact",
    };
    const skillName = skillMap[axis];
    const skillResult = skillViaHermes(skillName);
    results.push({ axis, skill: skillName, loaded: skillResult.ok, content: skillResult.ok ? skillResult.content : skillResult.error });
  }
  return { ok: true, file, axes, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function handleMessage(msg) {
  if (msg.method === "initialize") {
    sendResponse(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      serverInfo: {
        name: "midnight-mcp-server",
        version: "0.1.0",
        description: "Midnight Network MCP server for MosAIc Companion",
      },
    });
    sendNotification("notifications/tools/list_changed", {});
    return;
  }

  if (msg.method === "initialized" || msg.method === "notifications/initialized") {
    return;
  }

  if (msg.method === "tools/list") {
    sendResponse(msg.id, { tools: TOOLS });
    return;
  }

  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params;
    let result;
    try {
      switch (name) {
        case "midnight_status":
          result = await handleMidnightStatus(args);
          break;
        case "midnight_devnet":
          result = await handleMidnightDevnet(args);
          break;
        case "midnight_compile":
          result = await handleMidnightCompile(args);
          break;
        case "midnight_wallet":
          result = await handleMidnightWallet(args);
          break;
        case "midnight_skill":
          result = await handleMidnightSkill(args);
          break;
        case "midnight_status_codes":
          result = await handleMidnightStatusCodes(args);
          break;
        case "midnight_contract_review":
          result = await handleMidnightContractReview(args);
          break;
        default:
          sendError(msg.id, -32601, `Unknown tool: ${name}`);
          return;
      }
      sendResponse(msg.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      sendError(msg.id, -32603, e.message);
    }
    return;
  }

  // Unknown method
  sendError(msg.id, -32601, `Method not found: ${msg.method}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main (stdio loop)
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", async (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // skip malformed JSON
    }
    await handleMessage(msg);
  });
}

main();
