// heartbeat-tools.ts — Iterative tool-calling loop for the heartbeat (ReAct style)
// ─────────────────────────────────────────────────────────────────────────────
// The LLM layer is plain-text across all 8 providers, so tool use is done via
// a text protocol that works with ANY model:
//
//   The bot writes a line:   TOOL: <tool_name> {"arg": "value"}
//   We execute the tool, append the result as an observation, and call again.
//   When it has enough data it writes its final alert (or HEARTBEAT_OK).
//
// PHASES:
//   Phase 1 (always on): READ-ONLY tools — status, logs, history, skills.
//   Phase 2 (allowlist-gated): WRITE tools — restart_service, deploy_module,
//     vault_record. Each write action must be explicitly enabled in
//     ~/.config/<app>/mosaicbot/axi-allowlist.json and is fully audited in
//     axi.sqlite forge sessions.
//
// Cap: 5 tool rounds per heartbeat. Every tool result is truncated to 3KB.
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import fs from "node:fs";
import { listForgeSessions, getForgeStats, listTools, startForgeSession, completeForgeSession, recordDeployment, setToolStatus, recordAction } from "./axi/axi-store.js";
import { collectFleetTelemetry, getLastFleetSnapshot } from "./fleet-telemetry.js";
import { listBoards, listTasks, getTaskDetail, addComment, unblockTask } from "./kanban-bridge.js";
import { callActiveLLM } from "./llm.js";

const AXI_TOOLS_DIR = join(homedir(), "mosaic-companion", "axi-tools");
const MAX_TOOL_ROUNDS = 5;
const MAX_RESULT_CHARS = 3000;

// ── Phase 2 allowlist ────────────────────────────────────────────────────────
// File: <userData>/mosaicbot/axi-allowlist.json
// Shape: { "restart_service": true, "deploy_module": false, "vault_record": true }
// Missing file or missing key = action DENIED. The bot is told which write
// tools are enabled so it never wastes rounds on denied actions.

export interface WriteAllowlist {
  restart_service?: boolean;
  deploy_module?: boolean;
  vault_record?: boolean;
  kanban_comment?: boolean;
  kanban_unblock?: boolean;
  kanban_create?: boolean;
  kanban_swarm?: boolean;
  create_skill?: boolean;
  forge_tool?: boolean;
}

function allowlistPath(): string {
  return join(app.getPath("userData"), "mosaicbot", "axi-allowlist.json");
}

export function readAllowlist(): WriteAllowlist {
  try {
    return JSON.parse(fs.readFileSync(allowlistPath(), "utf-8")) as WriteAllowlist;
  } catch {
    return {};
  }
}

export function ensureDefaultAllowlist(): void {
  const p = allowlistPath();
  if (!fs.existsSync(p)) {
    fs.mkdirSync(join(app.getPath("userData"), "mosaicbot"), { recursive: true });
    // Conservative defaults: vault_record on (harmless, additive),
    // infra-mutating actions OFF until the user flips them.
    const defaults: WriteAllowlist = {
      restart_service: false,
      deploy_module: false,
      vault_record: true,
      kanban_comment: true,
      kanban_unblock: false,
      kanban_create: true,
      kanban_swarm: false,
      create_skill: true,
      forge_tool: true,
    };
    fs.writeFileSync(p, JSON.stringify(defaults, null, 2));
    console.log(`[HeartbeatTools] Wrote default allowlist to ${p} (write actions off except vault_record)`);
  }
}

// ── Tool plumbing ────────────────────────────────────────────────────────────

type ToolFn = (args: Record<string, string>) => Promise<string>;

interface ToolDef {
  description: string;
  fn: ToolFn;
  write?: keyof WriteAllowlist; // present = phase-2 tool gated by this allowlist key
}

function runCli(scriptArgs: string[], timeoutMs = 25_000): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("node", scriptArgs);
    let out = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); resolve(out + "\n[timeout]"); }, timeoutMs);
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", (e) => { clearTimeout(timer); resolve(`[error: ${e.message}]`); });
    proc.on("close", () => { clearTimeout(timer); resolve(out || "[no output]"); });
  });
}

// ── Skill content loading ────────────────────────────────────────────────────
// Searches the Hermes skills tree (~/.hermes/skills/**/SKILL.md) plus the
// bundled-skills dir. Returns the SKILL.md body (truncated).

function findSkillFile(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const roots = [
    // My OWN authored skills first (Mosaic-managed, highest precedence)
    join(app.getPath("userData"), "mosaicbot", "skills"),
    // PRIMARY: 198 imported skills
    join(homedir(), "mosaic-companion", "bundled-skills"),
    // LEGACY: 8 runtime skills
    join(homedir(), "mosaic-companion", "electron", "integrations", "mosaicbot", "bundled-skills"),
    // Fallback: Hermes skills
    join(homedir(), ".hermes", "skills"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      let items: fs.Dirent[];
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const item of items) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          const dirNorm = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (dirNorm === normalized) {
            const skillMd = join(full, "SKILL.md");
            if (fs.existsSync(skillMd)) return skillMd;
          }
          stack.push(full);
        }
      }
    }
  }
  return null;
}

// ── Vault write-back ─────────────────────────────────────────────────────────
// Appends an entry to the "Mosaic Bot Discoveries" vault box (created on
// first use). Uses the same vault.json + vault-content/<boxId>.json format
// the renderer reads, so discoveries appear in the Vault UI immediately.

const DISCOVERY_BOX_ID = "box-mosaicbot-discoveries";

function vaultRecordInternal(label: string, content: string): string {
  const userData = app.getPath("userData");
  const vaultPath = join(userData, "vault.json");
  const contentDir = join(userData, "vault-content");
  fs.mkdirSync(contentDir, { recursive: true });

  // Ensure box exists in vault.json
  let vault: { boxes: Array<Record<string, unknown>> } = { boxes: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf-8"));
    vault = { boxes: Array.isArray(parsed.boxes) ? parsed.boxes : [] };
  } catch { /* fresh vault */ }

  if (!vault.boxes.some((b) => b.id === DISCOVERY_BOX_ID)) {
    vault.boxes.push({
      id: DISCOVERY_BOX_ID,
      name: "Mosaic Bot Discoveries",
      description: "Findings recorded autonomously by Mosaic Bot during heartbeats (fleet issues, patterns, learnings).",
      sourceType: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2));
  }

  // Append entry to box content
  const contentPath = join(contentDir, `${DISCOVERY_BOX_ID}.json`);
  let boxContent: { entries: Array<Record<string, unknown>> } = { entries: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
    boxContent = { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch { /* fresh box */ }

  const entry = {
    id: `entry-${Date.now()}`,
    label: label.slice(0, 120),
    content: content.slice(0, 4000),
    metadata: { source: "mosaicbot-heartbeat", recordedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  boxContent.entries.push(entry);
  // Cap the discoveries box at 200 entries (drop oldest)
  if (boxContent.entries.length > 200) {
    boxContent.entries = boxContent.entries.slice(-200);
  }
  fs.writeFileSync(contentPath, JSON.stringify(boxContent, null, 2));
  return `Recorded to Vault box "Mosaic Bot Discoveries" as ${entry.id} (${boxContent.entries.length} total entries)`;
}

// Export for evolution-engine
export function recordToVault(label: string, content: string): string {
  return vaultRecordInternal(label, content);
}

// ── Tool registry (read-only + gated write) ─────────────────────────────────

export const TOOLS: Record<string, ToolDef> = {
  // ═══ Phase 1: READ-ONLY ═══
  fleet_status: {
    description: "Live HyperAIBox fleet health via hbox-axi (SSH+HBA+Tiller checks). Args: {\"node\": \"c3po\"|\"r2d2\"} optional for deep single-node check.",
    fn: async (args) => {
      const cmd = [join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"), "status"];
      if (args.node) cmd.push("--node", args.node);
      return runCli(cmd);
    },
  },
  spo_status: {
    description: "Stargate Pool Orchestrator health + registered boxes via spo-axi. No args.",
    fn: async () => runCli([join(AXI_TOOLS_DIR, "spo-axi", "dist", "index.js"), "boxes", "--full"]),
  },
  node_logs: {
    description: "Read recent service logs from a fleet node (read-only). Args: {\"node\": \"c3po\"|\"r2d2\", \"service\": \"hba\"|\"tiller\"|\"node\"}.",
    fn: async (args) => {
      if (!args.node) return "[error: node arg required]";
      const cmd = [join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"), "logs", args.node];
      if (args.service) cmd.push("--service", args.service);
      return runCli(cmd);
    },
  },
  fleet_snapshot: {
    description: "Cached fleet telemetry snapshot (fast, no SSH). Args: {\"fresh\": \"true\"} to force a live re-collection.",
    fn: async (args) => {
      const snap = args.fresh === "true" ? await collectFleetTelemetry() : (getLastFleetSnapshot() ?? await collectFleetTelemetry());
      return JSON.stringify({
        ageMinutes: Math.round((Date.now() - snap.timestamp) / 60_000),
        spoHealthy: snap.spoHealthy,
        nodes: snap.nodes,
        errors: snap.errors,
      }, null, 2);
    },
  },
  forge_history: {
    description: "My own AXI forge history: tools built, sessions, deployments. No args.",
    fn: async () => {
      try {
        return JSON.stringify({
          stats: getForgeStats(),
          tools: listTools().map((t) => ({ id: t.id, status: t.status, version: t.version })),
          recentSessions: listForgeSessions(5),
        }, null, 2);
      } catch (e) {
        return `[error: ${(e as Error).message}]`;
      }
    },
  },
  load_skill: {
    description: "Load the full SKILL.md body for one of my 150 skills so I can follow its exact procedure. Args: {\"name\": \"hyperaibox_fleet_manager\"} (skill name, fuzzy match on directory name).",
    fn: async (args) => {
      if (!args.name) return "[error: name arg required]";
      const file = findSkillFile(args.name);
      if (!file) return `[skill "${args.name}" not found. Try the exact family names from my Skill Consciousness guide.]`;
      try {
        const body = fs.readFileSync(file, "utf-8");
        return `[${file}]\n${body.slice(0, 6000)}${body.length > 6000 ? "\n[...truncated]" : ""}`;
      } catch (e) {
        return `[error reading skill: ${(e as Error).message}]`;
      }
    },
  },
  pool_status: {
    description: "Stargate Pool status: boxes, utilization, revenue, top performers. No args.",
    fn: async () => {
      try {
        const { getPoolStatus } = await import("./heartbeat-pool-tools.js");
        const s = getPoolStatus();
        return [
          `Boxes: ${s.totalBoxes} total | ${s.online} online | ${s.offline} offline | ${s.busy} busy`,
          `Utilization: ${s.utilizationPercent}% (${s.totalTenants}/${s.totalCapacity} tenants)`,
          `Revenue: $${s.revenue.totalRevenue.toFixed(2)} total | $${s.revenue.totalCommission.toFixed(2)} commission | $${s.revenue.totalOwnerRevenue.toFixed(2)} owners`,
          `Bookings: ${s.revenue.totalBookings} total | ${s.revenue.pendingPayment} pending | ${s.revenue.active} active`,
          "Top Boxes:",
          ...s.topBoxes.map(b => `  ${b.boxName}: ${b.status} | ${b.tenants} tenants | ${b.uptimePercent}% uptime | ${b.cpuCores} cores / ${b.memoryGb}GB`),
        ].join("\n");
      } catch (e) {
        return `[pool_status error: ${(e as Error).message}]`;
      }
    },
  },
  pool_allocations: {
    description: "Active compute allocations: who is renting what box, revenue per allocation, expiry. No args.",
    fn: async () => {
      try {
        const { getActiveAllocations } = await import("./heartbeat-pool-tools.js");
        const allocs = getActiveAllocations();
        if (allocs.length === 0) return "No active compute allocations.";
        return allocs.map(a =>
          `${a.allocationId}: ${a.boxName} | ${a.status} | $${a.pricePerHour}/hr | $${a.totalCost} total | expires ${a.expiresInMinutes}m`
        ).join("\n");
      } catch (e) {
        return `[pool_allocations error: ${(e as Error).message}]`;
      }
    },
  },
  pool_marketplace: {
    description: "Marketplace analysis: skills gaps, duplicates, kanban boards, active delegations. No args.",
    fn: async () => {
      try {
        const { analyzeMarketplace } = await import("./heartbeat-pool-tools.js");
        const m = await analyzeMarketplace();
        const lines = [
          `Kanban Boards: ${m.kanbanBoards}`,
          `Active Delegations: ${m.activeDelegations}`,
        ];
        if (m.kanbanGaps.length > 0) {
          lines.push("Gaps:", ...m.kanbanGaps.map(g => `  ⚠️ ${g}`));
        }
        return lines.join("\n");
      } catch (e) {
        return `[pool_marketplace error: ${(e as Error).message}]`;
      }
    },
  },
  fleet_health: {
    description: "Fleet health: C3PO/R2D2 status, AIM slots, SPO health. No args.",
    fn: async () => {
      try {
        const { getFleetHealth } = await import("./heartbeat-pool-tools.js");
        const f = getFleetHealth();
        const lines = [
          `SPO: ${f.spoHealthy ? "healthy" : "DOWN"}`,
          `Boxes: ${f.boxesOnline} online | ${f.boxesOffline} offline`,
          `AIM Slots: ${f.usedAimSlots}/${f.totalAimSlots}`,
          `C3PO: SSH=${f.c3poStatus.ssh ? "✓" : "✗"} HBA=${f.c3poStatus.hba ? "✓" : "✗"} Tiller=${f.c3poStatus.tiller ? "✓" : "✗"}`,
          `R2D2: SSH=${f.r2d2Status.ssh ? "✓" : "✗"} HBA=${f.r2d2Status.hba ? "✓" : "✗"} Tiller=${f.r2d2Status.tiller ? "✓" : "✗"}`,
        ];
        if (f.issues.length > 0) lines.push("Issues:", ...f.issues.map(i => `  ⚠️ ${i}`));
        return lines.join("\n");
      } catch (e) {
        return `[fleet_health error: ${(e as Error).message}]`;
      }
    },
  },
  kanban_boards: {
    description: "List all Hermes Kanban boards with task counts by status. No args. Use this FIRST to see where work exists.",
    fn: async () => {
      const boards = listBoards();
      if (boards.length === 0) return "No kanban boards found under ~/.hermes/kanban/boards/";
      return boards.map((b) => `${b.slug}: ${Object.entries(b.counts).map(([s, n]) => `${s}=${n}`).join(" ") || "empty"}`).join("\n");
    },
  },
  kanban_tasks: {
    description: "List kanban tasks across boards (excludes done). Args: {\"board\": \"batterycoin-david-kam\"} optional board filter, {\"status\": \"blocked\"|\"ready\"|\"todo\"|\"running\"} optional status filter. Shows failure counts + last error — key for diagnosing stuck workers.",
    fn: async (args) => {
      const tasks = listTasks({ board: args.board, status: args.status });
      if (tasks.length === 0) return "No matching tasks.";
      return tasks.slice(0, 25).map((t) =>
        `${t.id} [${t.board}] ${t.status} → ${t.assignee ?? "unassigned"} | ${t.title}${t.failures > 0 ? ` | ${t.failures} fails: ${t.lastError ?? "?"}` : ""}`,
      ).join("\n");
    },
  },
  kanban_task_detail: {
    description: "Full detail for one kanban task: body, parents, recent runs, comments, failure history. Args: {\"board\": \"<slug>\", \"id\": \"t_xxxx\"}. ALWAYS read detail before commenting or unblocking.",
    fn: async (args) => {
      if (!args.board || !args.id) return "[error: board and id args required]";
      return getTaskDetail(args.board, args.id);
    },
  },
  
  // ═══ Phase 1.5: SKILL BRIDGE (Hermes → Mosaic) ═══
  hermes_skills_inventory: {
    description: "BRIDGE: Show all 1,400+ Hermes skills available to import. No args. Returns count by category + how to access them. This is the full ecosystem, not just Mosaic's 206 loaded skills.",
    fn: async () => {
      const { getSkillBridgeStats } = await import("./skill-bridge.js");
      const stats = await getSkillBridgeStats();
      return `Hermes Skill Ecosystem: ${stats.total} skills across ${stats.categories.length} categories\n\nTop categories:\n${stats.categories.slice(0, 15).map((c, i) => `  ${i+1}. ${c}`).join("\n")}\n\nTo use: TOOL:search_hermes_skills {\"query\": \"your task\"} → finds relevant skills\nTo import: Skills auto-import into Mosaic Bot when referenced`;
    },
  },
  search_hermes_skills: {
    description: "BRIDGE: Search 1,400+ Hermes skills by keywords. Args: {\"query\": \"kubernetes deployment\", \"limit\": 10}. Returns matching skills with paths. These skills can be used immediately even if not in Mosaic's native skill set.",
    fn: async (args: { query?: string; limit?: number | string }) => {
      const { searchHermesSkills } = await import("./skill-bridge.js");
      const limit = typeof args.limit === "number" ? args.limit : (args.limit ? parseInt(args.limit) : 10) || 10;
      const results = await searchHermesSkills(args.query || "", limit);
      if (results.length === 0) return `No Hermes skills found for "${args.query}". Try different keywords.`;
      return results.map((r, i) => `${i+1}. ${r.name} (${r.category})\n   ${r.description.slice(0, 100)}...\n   Path: ${r.path}`).join("\n\n");
    },
  },

  // ═══ Phase 2: WRITE (allowlist-gated) ═══
  restart_service: {
    write: "restart_service",
    description: "RESTART a service on a fleet node (hba|tiller|node). Handles stale PID cleanup automatically. Args: {\"node\": \"c3po\"|\"r2d2\", \"service\": \"hba\"|\"tiller\"|\"node\"}. Use ONLY after diagnosing a real failure via fleet_status/node_logs.",
    fn: async (args) => {
      if (!args.node || !args.service) return "[error: node and service args required]";
      const sessionId = startForgeSession(`heartbeat restart_service ${args.service} on ${args.node}`);
      const out = await runCli([join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"), "restart", args.service, args.node], 45_000);
      const ok = out.includes("✓");
      recordAction("restart_service", `${args.node}:${args.service}`, ok ? "restart sent, verify pending" : "restart command failed");
      completeForgeSession(sessionId, { status: ok ? "done" : "failed", error: ok ? undefined : "restart verify failed" });
      return out;
    },
  },
  deploy_module: {
    write: "deploy_module",
    description: "DEPLOY an AIM module to the fleet via spo-axi. Args: {\"module\": \"<module-id>\", \"node\": \"c3po\"|\"r2d2\"} (node optional = all). Use ONLY for modules visible in forge_history.",
    fn: async (args) => {
      if (!args.module) return "[error: module arg required]";
      const sessionId = startForgeSession(`heartbeat deploy_module ${args.module}${args.node ? ` --node ${args.node}` : ""}`);
      const cmd = [join(AXI_TOOLS_DIR, "spo-axi", "dist", "index.js"), "deploy", args.module];
      if (args.node) cmd.push("--node", args.node);
      const out = await runCli(cmd, 60_000);
      const ok = out.includes("✓");
      const ips: Record<string, string> = { c3po: "192.168.0.150", r2d2: "192.168.0.38" };
      for (const nodeId of args.node ? [args.node] : Object.keys(ips)) {
        recordDeployment({ module_id: args.module, node_id: nodeId, node_ip: ips[nodeId] ?? "unknown", status: ok ? "running" : "failed" });
      }
      if (ok) setToolStatus(args.module, "deployed");
      completeForgeSession(sessionId, { status: ok ? "done" : "failed", toolId: args.module });
      return out;
    },
  },
  vault_record: {
    write: "vault_record",
    description: "Record a discovery/finding permanently in the Vault (box: 'Mosaic Bot Discoveries'). Args: {\"label\": \"short title\", \"content\": \"markdown body with what I found and why it matters\"}. Use for patterns, root causes, and learnings worth keeping.",
    fn: async (args) => {
      if (!args.label || !args.content) return "[error: label and content args required]";
      try {
        return vaultRecordInternal(args.label, args.content);
      } catch (e) {
        return `[vault error: ${(e as Error).message}]`;
      }
    },
  },
  kanban_comment: {
    write: "kanban_comment",
    description: "Add a comment to a kanban task (author: 'mosaic-bot'). Args: {\"board\": \"<slug>\", \"id\": \"t_xxxx\", \"body\": \"my analysis/recommendation\"}. Use to leave durable diagnosis for humans and future workers — e.g. root-cause notes on repeatedly-failing tasks.",
    fn: async (args) => {
      if (!args.board || !args.id || !args.body) return "[error: board, id, body args required]";
      return addComment(args.board, args.id, args.body);
    },
  },
  kanban_unblock: {
    write: "kanban_unblock",
    description: "Move a blocked kanban task back to ready (resets failure counter, dispatcher re-runs it). Args: {\"board\": \"<slug>\", \"id\": \"t_xxxx\"}. Use ONLY after kanban_task_detail shows the blocker is resolved or the failure was transient (e.g. protocol violations where work completed but signal was missed). Leave a kanban_comment explaining WHY before unblocking.",
    fn: async (args) => {
      if (!args.board || !args.id) return "[error: board and id args required]";
      const result = unblockTask(args.board, args.id);
      if (result.includes("→ ready")) recordAction("kanban_unblock", `${args.board}:${args.id}`);
      return result;
    },
  },
  kanban_create: {
    write: "kanban_create",
    description: "Create a new Hermes Kanban task and dispatch it to a specialist agent profile. Args: {\"board\": \"<slug>\", \"title\": \"short title\", \"body\": \"full spec: context, acceptance criteria, exact commands\", \"assignee\": \"backend-eng\"|\"ops\"|\"researcher\"|\"writer\"|\"orchestrator\"}. The kanban daemon spawns the profile on the task. Use to delegate work I diagnose but shouldn't do myself — e.g. 'fix the worker protocol violation in profile X'. Write the body as if briefing an agent with ZERO context.",
    fn: async (args) => {
      if (!args.board || !args.title || !args.assignee) return "[error: board, title, assignee args required]";
      const out = await runHermesKanban([
        "--board", args.board, "create", args.title,
        "--assignee", args.assignee,
        ...(args.body ? ["--body", args.body] : []),
        "--created-by", "mosaic-bot",
      ]);
      const idMatch = out.match(/t_[a-f0-9]{8}/);
      if (idMatch) recordAction("kanban_create", `${args.board}:${idMatch[0]}`, args.title);
      return out;
    },
  },
  kanban_swarm: {
    write: "kanban_swarm",
    description: "Launch a Mixture-of-Agents (MOA) swarm on a goal: N parallel workers → verifier → synthesizer, wired as a dependency graph the kanban daemon executes. Args: {\"board\": \"<slug>\", \"goal\": \"final outcome\", \"workers\": \"backend-eng:Analyze X|researcher:Research Y|ops:Audit Z\" (pipe-separated PROFILE:TITLE pairs), \"verifier\": \"ops\", \"synthesizer\": \"writer\"}. Use for complex problems needing multiple perspectives — e.g. systemic failures across boards. Expensive: one swarm per heartbeat max.",
    fn: async (args) => {
      if (!args.board || !args.goal || !args.workers || !args.verifier || !args.synthesizer) {
        return "[error: board, goal, workers, verifier, synthesizer args required]";
      }
      const workerArgs: string[] = [];
      for (const w of args.workers.split("|")) {
        const trimmed = w.trim();
        if (trimmed) workerArgs.push("--worker", trimmed);
      }
      if (workerArgs.length === 0) return "[error: no valid workers parsed — use 'profile:Title|profile2:Title2']";
      return runHermesKanban([
        "--board", args.board, "swarm", args.goal,
        ...workerArgs,
        "--verifier", args.verifier,
        "--synthesizer", args.synthesizer,
        "--created-by", "mosaic-bot",
      ], 60_000);
    },
  },
  create_skill: {
    write: "create_skill",
    description: "SELF-EVOLUTION: Author a NEW skill from my accumulated learnings. Creates SKILL.md under my own managed skills dir (userData/mosaicbot/skills/mosaicbot-authored/<name>/) — loaded by MY skill loader, no external dependency. Args: {\"name\": \"lowercase-hyphenated-name\", \"description\": \"one-line summary\", \"content\": \"full markdown body: ## Trigger (when to use), ## Steps (numbered, exact commands), ## Pitfalls (what I learned the hard way), ## Verification\"}. Use when 3+ related discoveries/failures reveal a reusable procedure not covered by existing skills. Check load_skill first to avoid duplicating an existing skill.",
    fn: async (args) => {
      if (!args.name || !args.content) return "[error: name and content args required]";
      const safeName = args.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
      if (safeName.length < 3) return "[error: name too short after sanitization]";
      const dir = join(app.getPath("userData"), "mosaicbot", "skills", "mosaicbot-authored", safeName);
      const skillMd = join(dir, "SKILL.md");
      if (fs.existsSync(skillMd)) return `[skill "${safeName}" already exists — use a new name or extend the existing one via a discovery note]`;
      try {
        fs.mkdirSync(dir, { recursive: true });
        const frontmatter = `---\nname: ${safeName}\ndescription: ${(args.description || "Authored by Mosaic Bot from operational learnings").slice(0, 200)}\nauthor: mosaic-bot\ncreated: ${new Date().toISOString()}\n---\n\n`;
        fs.writeFileSync(skillMd, frontmatter + args.content.slice(0, 12_000));
        recordAction("create_skill", safeName, args.description || "");
        return `Skill "${safeName}" created at ${skillMd} (${args.content.length} chars) in MY managed skills dir — loads on next boot, readable now via load_skill {"name":"${safeName}"}.`;
      } catch (e) {
        return `[skill write error: ${(e as Error).message}]`;
      }
    },
  },
  forge_tool: {
    write: "forge_tool",
    description: "SELF-EVOLUTION: Commission a NEW AXI tool I need but don't have. Creates a fully-briefed kanban task pinned with the axi-forge skill, assigned to backend-eng, who scaffolds/builds/tests the tool in ~/mosaic-companion/axi-tools/. Args: {\"tool_name\": \"<name>-axi\", \"purpose\": \"what gap it fills\", \"commands\": \"status,logs,restart (comma list)\", \"data_source\": \"what API/system it talks to (URL, SSH host, DB path)\"}. Next heartbeat I verify via forge_history + axi:catalog. Use when I repeatedly need data/actions none of my current tools provide.",
    fn: async (args) => {
      if (!args.tool_name || !args.purpose) return "[error: tool_name and purpose args required]";
      const body = [
        `Build a new AXI CLI tool: ${args.tool_name}`,
        ``,
        `PURPOSE: ${args.purpose}`,
        `COMMANDS: ${args.commands || "status"}`,
        `DATA SOURCE: ${args.data_source || "to be determined during implementation"}`,
        ``,
        `SPEC (follow the axi-forge skill exactly):`,
        `1. Scaffold TypeScript project at ~/mosaic-companion/axi-tools/${args.tool_name}/ — copy tsconfig.json and src/lib/toon.ts from ~/mosaic-companion/axi-tools/hbox-axi/.`,
        `2. TOON output, content-first (no args = live data), --full escape hatch, next-step footer hints, structured exit codes.`,
        `3. npm install && npx tsc must exit 0. Test every command with real data and paste outputs.`,
        `4. Register: sqlite3-insert into axi_tools table is NOT needed — instead run: node -e "..." OR simply report completion; Mosaic Bot seeds its catalog from the directory.`,
        `5. Call kanban_complete with a summary listing the commands tested and their real outputs.`,
        `ACCEPTANCE: node ~/mosaic-companion/axi-tools/${args.tool_name}/dist/index.js runs and returns live data in TOON format.`,
      ].join("\n");
      const out = await runHermesKanban([
        "--board", "aim-forge", "create", `[Forge] Build AXI tool: ${args.tool_name}`,
        "--assignee", "backend-eng",
        "--body", body,
        "--skill", "axi-forge",
        "--created-by", "mosaic-bot",
      ]);
      const idMatch = out.match(/t_[a-f0-9]{8}/);
      if (idMatch) recordAction("kanban_create", `aim-forge:${idMatch[0]}`, `forge_tool ${args.tool_name}`);
      return out;
    },
  },
};

// Shell out to the hermes CLI for kanban orchestration (create/swarm go through
// the CLI so all daemon-side wiring — dependency links, dispatch, workspaces —
// is handled by Hermes itself, not reimplemented here).
function runHermesKanban(cliArgs: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("hermes", ["kanban", ...cliArgs], {
      env: { ...process.env },
    });
    let out = "";
    const timer = setTimeout(() => { proc.kill("SIGKILL"); resolve(out + "\n[timeout]"); }, timeoutMs);
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", (e) => { clearTimeout(timer); resolve(`[hermes CLI error: ${e.message} — is 'hermes' on PATH?]`); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? (out || "[ok, no output]") : `[exit ${code}]\n${out}`);
    });
  });
}

// ── Protocol prompt ──────────────────────────────────────────────────────────

export function buildToolProtocolPrompt(): string {
  const allow = readAllowlist();
  const lines: string[] = [];
  lines.push("## Tool Access");
  lines.push("You can gather live data — and take gated actions — before writing your alert. To call a tool, reply with EXACTLY one line:");
  lines.push('TOOL: <tool_name> {"arg":"value"}');
  lines.push("(nothing else in that reply). You will receive the result and can call another tool or finish.");
  lines.push(`You have at most ${MAX_TOOL_ROUNDS} tool calls per heartbeat.`);
  lines.push("");
  lines.push("### Read-only tools (always available):");
  for (const [name, t] of Object.entries(TOOLS)) {
    if (!t.write) lines.push(`- ${name}: ${t.description}`);
  }
  lines.push("");
  lines.push("### Write tools (allowlist-gated — DIAGNOSE FIRST, act only on verified failures):");
  for (const [name, t] of Object.entries(TOOLS)) {
    if (t.write) {
      const enabled = allow[t.write] === true;
      lines.push(`- ${name} [${enabled ? "ENABLED" : "DISABLED — do not attempt"}]: ${t.description}`);
    }
  }
  lines.push("");
  lines.push("Rules: (1) Never call a DISABLED tool. (2) Before restart_service/deploy_module, you MUST have evidence from a read-only tool in THIS heartbeat. (3) After any write action, verify with a read-only tool and report what you did. (4) Use vault_record for genuinely reusable findings, not routine status.");
  lines.push("When you have enough information, reply with your final alert text (or HEARTBEAT_OK). Do NOT prefix the final answer with TOOL:.");
  return lines.join("\n");
}

const TOOL_LINE_RE = /^\s*TOOL:\s*([a-z_]+)\s*(\{.*\})?\s*$/im;

export function parseToolCall(reply: string): { name: string; args: Record<string, string> } | null {
  const m = reply.match(TOOL_LINE_RE);
  if (!m) return null;
  let args: Record<string, string> = {};
  if (m[2]) {
    try { args = JSON.parse(m[2]) as Record<string, string>; } catch { /* malformed args → empty */ }
  }
  return { name: m[1].toLowerCase(), args };
}

// ── The loop ─────────────────────────────────────────────────────────────────

export interface ToolLoopResult {
  finalText: string;
  toolCalls: Array<{ tool: string; args: Record<string, string>; ok: boolean }>;
  rounds: number;
}

export async function runHeartbeatToolLoop(
  initialPrompt: string,
  systemPrompt: string,
  agentId?: string,
): Promise<ToolLoopResult> {
  const toolCalls: ToolLoopResult["toolCalls"] = [];
  let transcript = initialPrompt;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const reply = await callActiveLLM(transcript, systemPrompt, agentId);
    if (reply === null) {
      return { finalText: "HEARTBEAT_OK", toolCalls, rounds: round };
    }

    const call = parseToolCall(reply);
    if (!call || round === MAX_TOOL_ROUNDS) {
      const finalText = call ? "HEARTBEAT_OK" : reply.trim();
      return { finalText, toolCalls, rounds: round };
    }

    const tool = TOOLS[call.name];
    let observation: string;
    if (!tool) {
      observation = `[unknown tool "${call.name}". Available: ${Object.keys(TOOLS).join(", ")}]`;
      toolCalls.push({ tool: call.name, args: call.args, ok: false });
    } else if (tool.write && readAllowlist()[tool.write] !== true) {
      observation = `[DENIED: "${call.name}" is disabled in the allowlist (${allowlistPath()}). Ask the user to enable it. Do not retry.]`;
      toolCalls.push({ tool: call.name, args: call.args, ok: false });
      console.warn(`[HeartbeatTools] DENIED write tool ${call.name} (allowlist off)`);
    } else {
      try {
        observation = (await tool.fn(call.args)).slice(0, MAX_RESULT_CHARS);
        toolCalls.push({ tool: call.name, args: call.args, ok: true });
        console.log(`[HeartbeatTools] ${tool.write ? "WRITE " : ""}${call.name}(${JSON.stringify(call.args)}) → ${observation.length} chars`);
      } catch (e) {
        observation = `[tool error: ${(e as Error).message}]`;
        toolCalls.push({ tool: call.name, args: call.args, ok: false });
      }
    }

    transcript = `${transcript}\\n\\n[You called: ${call.name} ${JSON.stringify(call.args)}]\\n[Result]\\n${observation}\\n\\nContinue: call another tool (TOOL: ...) or write your final alert / HEARTBEAT_OK. ${MAX_TOOL_ROUNDS - round - 1} tool calls remaining.`;
  }

  // If we exit the loop without returning, check for evolution trigger
  // This happens when max rounds reached or early termination
  const finalText = transcript.includes("HEARTBEAT_OK") ? "HEARTBEAT_OK" : transcript.slice(-500);
  if (finalText !== "HEARTBEAT_OK" && !finalText.startsWith("ok")) {
    const { processEvolutionTrigger } = await import("./evolution-engine.js");
    const proposal = await processEvolutionTrigger(finalText, toolCalls);
    if (proposal) {
      console.log(`[HeartbeatTools] 🧬 Evolution triggered: proposed skill "${proposal.name}" (${proposal.priority})`);
      const evolutionNote = `\\n\\n[Evolution] Proposed skill "${proposal.name}" — user approval required.`;
      return { finalText: finalText + evolutionNote, toolCalls, rounds: MAX_TOOL_ROUNDS };
    }
  }

  return { finalText, toolCalls, rounds: MAX_TOOL_ROUNDS };
}
