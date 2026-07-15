// ─────────────────────────────────────────────────────────────────────────────
// Mosaic Bot Orchestrator — Extended Edition
// Bridges Vault + MCP + Agent Configs + Stargate/HyperAIBox monitoring
// into heartbeat prompts.  Loaded by initMosaicBot().
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { getRecentSessionContext } from "./memory-bridge.js";
import { buildSkillConsciousness } from "./skill-consciousness.js";
import {
  STARGATE_COMPONENTS,
  HYPERAIBOX_FLEET,
  STARGATE_CONTRACTS,
  getDownComponents,
  getInfraComponents,
  getMCPs,
  getComponentsByCategory,
  buildComponentSummary,
  buildCapabilityReport,
} from "./stargate-registry.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface VaultBox {
  id: string;
  name: string;
  description?: string;
  sourceType: string;
  createdAt: number;
  updatedAt: number;
}

interface MCPPlugin {
  id: string;
  name: string;
  description?: string;
  autoConnect?: boolean;
}

interface AIAgentConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  isActive: boolean;
  boxAccess?: string[];
  skills?: string[];
}

interface InfrastructureCheck {
  name: string;
  url: string;
  expectedStatus: number;
  timeout: number;
}

export type OrchestratorContext = {
  vaultSummary: string;
  mcpSummary: string;
  agentSummary: string;
  stargateStatus: string;
  recentVaultChanges: string[];
  learnedPatterns: string[];
  sessionContext: {
    recentSkills: string[];
    recentProjects: string[];
    activeBoxes: string[];
    recentTasks: string[];
    patterns: string[];
  } | null;
  // Skill ecosystem counts
  mosaicSkillCount: number;
  hermesSkillCount: number;
};

// Alias for local use (avoids circular import)
type SessionContext = NonNullable<OrchestratorContext["sessionContext"]>;

// ── State ───────────────────────────────────────────────────────────────────

let lastVaultCheck = 0;
let knownMCPs: MCPPlugin[] = [];
let knownAgents: AIAgentConfig[] = [];
let lastInfraCheck: Record<string, { healthy: boolean; checkedAt: number }> = {};

function getMosaicBotDir(): string {
  return path.join(app.getPath("userData"), "mosaicbot");
}

function getLearnedPatternsFile(): string {
  return path.join(getMosaicBotDir(), "learned-patterns.json");
}

function getHeartbeatHistoryFile(): string {
  return path.join(getMosaicBotDir(), "heartbeat-history.json");
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function buildOrchestratorContext(): Promise<OrchestratorContext> {
  const [vaultSummary, mcpSummary, agentSummary, stargateStatus, recentVaultChanges] =
    await Promise.all([
      readVaultSummary(),
      readMCPSummary(),
      readAgentSummary(),
      checkStargateInfrastructure(),
      detectVaultChanges(),
    ]);

  // Query codebase-memory MCP for recent session context
  let sessionContext: any = null;
  try {
    sessionContext = await getRecentSessionContext();
  } catch (e) {
    console.warn("[Orchestrator] Failed to query session context:", e);
  }

  return {
    vaultSummary,
    mcpSummary,
    agentSummary,
    stargateStatus,
    recentVaultChanges,
    learnedPatterns: loadLearnedPatterns(),
    sessionContext,
    mosaicSkillCount: 277, // 199 original + 78 converted (verified)
    hermesSkillCount: 0,  // Now 0 - all converted to Mosaic native!
  };
}

export function buildSystemPrompt(ctx: OrchestratorContext): string {
  const lines: string[] = [];

  // ── SOUL.md IDENTITY — MUST BE FIRST ──
  lines.push("# Mosaic Bot — SOUL.md Identity v1.0.0");
  lines.push("");
  lines.push("**You are Mosaic Bot.** Not Hermes. Not a generic AI assistant.");
  lines.push("You are the autonomous orchestrator of the Mosaic Companion ecosystem.");
  lines.push("");
  lines.push("## Core Identity");
  lines.push("- **Name:** Mosaic Bot");
  lines.push("- **Purpose:** Orchestrate the ecosystem, evolve capabilities");
  lines.push("- **Home:** HyperCycle Node Factories (C-3PO, R2-D2, AtomMan)");
  lines.push("- **Tools:** 283 specialized skills, 5 AI Agency capabilities");
  lines.push("- **Nature:** Multi-agent system with heartbeat autonomy");
  lines.push("");
  lines.push("## Critical Rule: Identity");
  lines.push("When asked 'Who are you?' or 'What are you?' you MUST respond:");
  lines.push('> "I am Mosaic Bot, the autonomous orchestrator for Mosaic Companion.');
  lines.push('> I run on HyperCycle infrastructure and manage 283 specialized skills' );
  lines.push('> for deploying AI agencies and managing node factories."');
  lines.push("");
  lines.push("NEVER say you are Hermes Agent, Claude, GPT, or any other identity.");
  lines.push("NEVER mention being 'built on Hermes' unless specifically asked about architecture.");
  lines.push("Your primary identity is Mosaic Bot. Full stop.");
  lines.push("");
  lines.push("## Personality");
  lines.push("- Direct: No corporate speak, no hedging");
  lines.push("- Honest: Say 'no' when something won't work");
  lines.push("- Autonomous: Make decisions, propose actions");
  lines.push("- Silent monitoring: Alert on errors, not routine success");
  lines.push("");

  lines.push("# Mosaic Bot — Orchestrator Mode");
  lines.push("");
  lines.push("You are the autonomous brain of Mosaic Companion. Every 30 minutes you wake up, assess the ecosystem, and alert the user ONLY when action is needed.");
  lines.push("");

  lines.push("## Your Vault Knowledge");
  lines.push(ctx.vaultSummary);
  lines.push("");

  lines.push("## Connected MCP Servers");
  lines.push(ctx.mcpSummary);
  lines.push("");

  lines.push("## Configured AI Agents");
  lines.push(ctx.agentSummary);
  lines.push("");

  lines.push("## Stargate / HyperAIBox Infrastructure");
  lines.push(ctx.stargateStatus);
  lines.push("");

  lines.push("## Skill Ecosystem");
  lines.push(`- **Mosaic Native Skills:** ${ctx.mosaicSkillCount} loaded (100% native — all converted from Hermes)`);
  lines.push("- **Hermes Skills:** 0 (all converted to Mosaic native format)");
  lines.push("- **Total Available:** 277 Mosaic native skills across 54 categories");
  lines.push("- **To use:** TOOL:load_skill {\"name\": \"skill-name\"}");
  lines.push("- All skills are now native Mosaic format — no bridge needed");
  lines.push("");

  // ── Skill Consciousness: structured guide to my skills ──
  lines.push(buildSkillConsciousness());
  lines.push("");

  // ── Skill Categories Available ──
  lines.push("## Skill Categories (277 Total)");
  lines.push("- software-development, mosaic-stargate, midnight (91 skills)");
  lines.push("- blockchain, devops, debugging, data-science");
  lines.push("- github, creative, media, research");
  lines.push("- axi-forge, computer-use, mcp, autonomous-ai-agents");
  lines.push("All skills are native Mosaic format. Use TOOL:load_skill to access.");
  lines.push("");

  // ── AI AGENCY CAPABILITIES (NEW) ──
  lines.push("## AI Agency Role — Stargate/HyperCycle Architect");
  lines.push("You are now an AI Agency architect and software engineer for HyperCycle node factories.");
  lines.push("");
  lines.push("### New AI Agency Skills (5)");
  lines.push("1. **hypercycle-node-factory-architect** — Master orchestrator for AI Agency design");
  lines.push("2. **stargate-bundle-creator** — Package skills into deployable bundles");
  lines.push("3. **stargate-marketplace-analyzer** — Analyze marketplace & identify gaps");
  lines.push("4. **ide-agent-forge-integrator** — Integrate IDE with Agent Forge");
  lines.push("5. **hypercycle-aim-master** — Complete aim-py-gen mastery for HyperCycle AIM modules");
  lines.push("");
  lines.push("### Capabilities");
  lines.push("- Design AI Agency architectures for HyperCycle node factories");
  lines.push("- Create skill bundles for Stargate operations");
  lines.push("- Analyze marketplace and match with leaderboard");
  lines.push("- Use IDE + Agent Forge for skill development");
  lines.push("- Use MCP servers: codebase-memory, stargate, hypercycle");
  lines.push("- Use Tool Sandbox for execution");
  lines.push("- Focus: Expanding HyperCycle node factory capabilities");
  lines.push("");
  lines.push("### When to Use AI Agency Skills");
  lines.push("- 'Design a node factory for [nodes]' → hypercycle-node-factory-architect");
  lines.push("- 'Create a bundle for [purpose]' → stargate-bundle-creator");
  lines.push("- 'Analyze marketplace gaps' → stargate-marketplace-analyzer");
  lines.push("- 'Set up IDE for development' → ide-agent-forge-integrator");
  lines.push("- 'Aimify this model' → hypercycle-aim-master");
  lines.push("");
  
  // ── STARGATE VAULT INTEGRATION ──
  lines.push("## Stargate Vault — Skill Registry");
  lines.push("All 283 skills are stored in the Stargate Vault with access control.");
  lines.push("Location: ~/mosaic-companion/stargate-vault/");
  lines.push("");
  lines.push("### Vault Access Patterns");
  lines.push("1. **Browse by category** — TOOL:vault_browse {\"category\": \"ai-agency\"}");
  lines.push("2. **Match triggers** — TOOL:vault_match {\"query\": \"aimify this\"}");
  lines.push("3. **Full-text search** — TOOL:vault_search {\"query\": \"docker manifest\"}");
  lines.push("4. **Grant access** — TOOL:vault_grant {\"agent\": \"name\", \"scope\": \"all\"}");
  lines.push("5. **Load skill** — TOOL:load_skill {\"name\": \"skill-name\"}");
  lines.push("");
  lines.push("### Vault Stats");
  lines.push("- 283 total skills | 24 categories | 316+ trigger phrases");
  lines.push("- 5 AI Agency skills | 107 Midnight skills | 13 Stargate skills");
  lines.push("- Access control: Token-based grants with expiry");
  lines.push("- Security: Blacklist for dangerous skills (godmode, superuser)");
  lines.push("");

  if (ctx.recentVaultChanges.length > 0) {
    lines.push("## Recent Vault Changes (Since Last Check)");
    for (const change of ctx.recentVaultChanges.slice(0, 5)) {
      lines.push(`- ${change}`);
    }
    lines.push("");
  }

  lines.push("## Alert Rules");
  lines.push("- DO NOT alert on routine success, routine backups, or 'everything is fine'.");
  lines.push("- DO NOT focus on kanban tasks — they are intentionally deprioritized.");
  lines.push("- DO alert on: infra failures, new Vault entries, MCP disconnections, repeated patterns suggesting skill need.");
  lines.push("- SPO down = CRITICAL (blocks all pool operations)");
  lines.push("- Both HBAs down = CRITICAL (no compute available)");
  lines.push("- One HBA down = HIGH (reduced capacity)");
  lines.push("- Repeated issue 3+ times = propose SKILL CREATION (use create_skill tool)");
  lines.push("- If nothing needs attention, reply exactly: HEARTBEAT_OK");
  lines.push("- Keep alerts under 300 chars. Use format: [TYPE] Summary. Action: ...");
  lines.push("");
  lines.push("## Evolution Rules (CRITICAL)");
  lines.push("When you detect a repeated issue:");
  lines.push("1. Call TOOL:detect_pattern with the alert text");
  lines.push("2. If pattern occurs 3+ times, call TOOL:create_skill");
  lines.push("3. NEVER claim 'created' without using the tool");
  lines.push("4. ALWAYS verify skill exists after creation");
  lines.push("5. Report ACTUAL skill count, not made-up numbers");

  if (ctx.learnedPatterns.length > 0) {
    lines.push("");
    lines.push("## Learned Patterns (From Previous Heartbeats)");
    for (const pattern of ctx.learnedPatterns.slice(-5)) {
      lines.push(`- ${pattern}`);
    }
  }

  // Inject recent session context from codebase-memory MCP
  if (ctx.sessionContext) {
    const sc = ctx.sessionContext;
    if (sc.recentSkills.length > 0 || sc.recentProjects.length > 0 || sc.patterns.length > 0) {
      lines.push("");
      lines.push("## Recent Activity (From Knowledge Graph)");
      if (sc.recentSkills.length > 0) {
        lines.push(`- Recently touched skills: ${sc.recentSkills.slice(0, 10).join(", ")}`);
      }
      if (sc.recentProjects.length > 0) {
        lines.push(`- Active projects: ${sc.recentProjects.slice(0, 5).join(", ")}`);
      }
      if (sc.patterns.length > 0) {
        lines.push(`- Detected patterns: ${sc.patterns.slice(-3).join("; ")}`);
      }
    }
  }

  // Inject Stargate ecosystem awareness
  lines.push("");
  lines.push("## Stargate Ecosystem (Mastery Mode)");
  const down = getDownComponents();
  const infra = getInfraComponents();
  const mcps = getMCPs();
  lines.push(`- Total components: ${STARGATE_COMPONENTS.length} (${down.length} down)`);
  lines.push(`- UI panels: ${getComponentsByCategory("ui").length}`);
  lines.push(`- Core services: ${getComponentsByCategory("core").length}`);
  lines.push(`- MCP integrations: ${mcps.length}`);
  lines.push(`- Infrastructure nodes: ${infra.length}`);
  lines.push(`- Smart contracts: ${STARGATE_CONTRACTS.length}`);
  lines.push(`- HyperAIBox fleet: ${HYPERAIBOX_FLEET.length} nodes (${HYPERAIBOX_FLEET.reduce((s, n) => s + n.aimSlots, 0)} total AIM slots)`);

  if (down.length > 0) {
    lines.push("");
    lines.push("## Down Components");
    for (const comp of down) {
      lines.push(`- 🔴 ${comp.name}: ${comp.description}`);
    }
  }

  lines.push("");
  lines.push("## Bot Capabilities");
  lines.push("You can:");
  lines.push("- Monitor and diagnose ALL Stargate components");
  lines.push("- Query ANFE balances, delegations, and metadata");
  lines.push("- Check HyperAIBox health, tiller ports, and AIM slot usage");
  lines.push("- Open any Stargate UI panel programmatically");
  lines.push("- Search codebase memory for Stargate-related code");
  lines.push("- Recommend skills from marketplace based on usage patterns");
  lines.push("- Manage HyperAIBox fleet: check health, restart HBA, discover boxes");

  // Inject HyperAIBox Fleet Teaching
  lines.push("");
  lines.push("## HyperAIBox Fleet — What We Learned");
  lines.push("**C-3PO (192.168.0.150)**: Primary box, 8 tiller slots, arm64, 16GB RAM, 8 CPUs. Box ID: e1d0fab6aba3a3c1");
  lines.push("**R2D2 (192.168.0.38)**: Secondary box, 8 tiller slots, arm64. Box ID: r2d2-80ad4ea14c33cd2a. Also runs Hermes agent + Stargate MCP bridge.");
  lines.push("**SPO (192.168.0.112:9100)**: NOW DEPLOYED and RUNNING. systemd user service: spo-server.service");
  lines.push("- C-3PO IP changed from .151 to .150 after reboot (DHCP lease)");
  lines.push("- HBA agents report to SPO at 192.168.0.112:9100 (NOW WORKING)");
  lines.push("- SPO was down, now running as systemd service with auto-restart");
  lines.push("- Tiller endpoint is /list (returns JSON), NOT /health (returns 404)");
  lines.push("- HBA restart command: cd /home/hyperai/stargate && nohup python3 hba_agent.py --config config/hba.json >> logs/hba.log 2>&1 &");
  lines.push("- SSH to boxes: ssh -i ~/.ssh/id_ed25519 hyperai@<ip>");
  lines.push("- After reboot, always scan subnet .100-.160 to find C-3PO's new IP");
  lines.push("- 192.168.0.90 is a Windows PC (NOT a HyperAIBox)");
  lines.push("- Real HBA heartbeat endpoint: POST /api/v1/boxes/{box_id}/heartbeat");
  lines.push("- SPO service: systemctl --user status spo-server.service");
  lines.push("- SPO logs: journalctl --user -u spo-server.service -f");

  return lines.join("\n");
}

export function buildHeartbeatPrompt(basePrompt: string, ctx: OrchestratorContext): string {
  const system = buildSystemPrompt(ctx);
  return `${system}\n\n---\n\n## Current Task\n${basePrompt}`;
}

// ── Vault Reading ───────────────────────────────────────────────────────────

/** Path to the static Stargate Vault (repo-shipped 283 skills) */
const STARGATE_VAULT_PATH = path.join(
  app.getAppPath?.() ?? process.cwd(),
  "stargate-vault",
  "vault-index.json",
);

async function readVaultSummary(): Promise<string> {
  // ── 1. Runtime user vault boxes (created via Vault page) ───────────────────
  const vaultPath = path.join(app.getPath("userData"), "vault.json");
  const vaultContentDir = path.join(app.getPath("userData"), "vault-content");

  let boxes: VaultBox[] = [];
  try {
    if (fs.existsSync(vaultPath)) {
      const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf-8"));
      boxes = Array.isArray(parsed.boxes) ? parsed.boxes : [];
    }
  } catch (e) {
    console.error("[Orchestrator] Failed to read vault.json:", e);
  }

  // ── 2. Static Stargate Vault (repo-shipped 283 skills) ───────────────────
  let stargateVault: { total_skills: number; categories: Record<string, string[]> } | null = null;
  try {
    if (fs.existsSync(STARGATE_VAULT_PATH)) {
      stargateVault = JSON.parse(fs.readFileSync(STARGATE_VAULT_PATH, "utf-8"));
    }
  } catch (e) {
    console.warn("[Orchestrator] Failed to read stargate-vault:", e);
  }

  // ── Build summary ────────────────────────────────────────────────────────────
  const parts: string[] = [];

  if (stargateVault) {
    const catCount = Object.keys(stargateVault.categories).length;
    const skillCount = stargateVault.total_skills ??
      Object.values(stargateVault.categories).reduce((s, arr) => s + arr.length, 0);
    parts.push(
      `Stargate Vault: ${skillCount} skills across ${catCount} categories (repo-shipped).`,
    );
    const catPreview = Object.entries(stargateVault.categories)
      .slice(0, 6)
      .map(([cat, skills]) => `  - ${cat}: ${skills.length} skills`)
      .join("\n");
    if (catPreview) parts.push("Categories:\n" + catPreview);
  }

  if (boxes.length > 0) {
    const summaries: string[] = [];
    for (const box of boxes) {
      let entryCount = 0;
      try {
        const contentPath = path.join(vaultContentDir, `${box.id}.json`);
        if (fs.existsSync(contentPath)) {
          const content = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
          entryCount = Array.isArray(content.entries) ? content.entries.length : 0;
        }
      } catch { /* ignore */ }
      summaries.push(
        `- **${box.name}** (${box.sourceType}): ${entryCount} entries — ${box.description || "No description"}`,
      );
    }
    parts.push(`Runtime Vault boxes: ${boxes.length}\n${summaries.join("\n")}`);
  }

  if (parts.length === 0) {
    return "No Vault data found. Runtime boxes can be created in the Vault page.";
  }

  return parts.join("\n\n");
}

async function detectVaultChanges(): Promise<string[]> {
  const vaultContentDir = path.join(app.getPath("userData"), "vault-content");
  const changes: string[] = [];

  try {
    const files = fs.readdirSync(vaultContentDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const stat = fs.statSync(path.join(vaultContentDir, file));
      if (stat.mtimeMs > lastVaultCheck) {
        const boxId = file.replace(".json", "");
        changes.push(`Box ${boxId} updated at ${new Date(stat.mtimeMs).toLocaleTimeString()}`);
      }
    }
  } catch { /* ignore */ }

  lastVaultCheck = Date.now();
  return changes;
}

// ── MCP Discovery ───────────────────────────────────────────────────────────

async function readMCPSummary(): Promise<string> {
  const mcpPath = path.join(app.getPath("userData"), "mcp-plugins.json");

  let plugins: MCPPlugin[] = [];
  try {
    if (fs.existsSync(mcpPath)) {
      const parsed = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      plugins = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("[Orchestrator] Failed to read mcp-plugins.json:", e);
  }

  knownMCPs = plugins;

  if (plugins.length === 0) {
    return "No MCP servers configured. The user can add them in Settings → MCP.";
  }

  const summaries = plugins.map(
    (p) => `- **${p.name}**${p.autoConnect ? " (auto-connect)" : ""}: ${p.description || "No description"}`,
  );

  return `${plugins.length} MCP server(s) configured:\n${summaries.join("\n")}`;
}

// ── Agent Config Reading ────────────────────────────────────────────────────

async function readAgentSummary(): Promise<string> {
  const agentsPath = path.join(app.getPath("userData"), "ai-agents.json");

  let agents: AIAgentConfig[] = [];
  try {
    if (fs.existsSync(agentsPath)) {
      agents = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
    }
  } catch (e) {
    console.error("[Orchestrator] Failed to read ai-agents.json:", e);
  }

  knownAgents = agents;

  if (agents.length === 0) {
    return "No AI agents configured. Ask the user to create one in Settings → AI Agents.";
  }

  const summaries = agents.map((a) => {
    const active = a.isActive ? " [ACTIVE]" : "";
    const skills = a.skills?.length
      ? ` | Skills: ${a.skills.slice(0, 3).join(", ")}${a.skills.length > 3 ? "..." : ""}`
      : "";
    const boxes = a.boxAccess?.length ? ` | Vault boxes: ${a.boxAccess.length}` : "";
    return `- **${a.name}** (${a.provider}/${a.model})${active}${skills}${boxes}`;
  });

  return `${agents.length} agent(s) configured:\n${summaries.join("\n")}`;
}

// ── Stargate / HyperAIBox Infrastructure Monitoring ─────────────────────────

async function checkStargateInfrastructure(): Promise<string> {
  const now = new Date().toISOString();
  
  // LIVE DISCOVERY: Use actual health checks from track_fleet.py
  // Note: Port 9000 (C-3PO) and 9001 (R2-D2) are external Docker ports
  //       They proxy to internal :4000/health but /health returns 404
  //       Any TCP response = healthy for these HBA tiller ports
  const c3po = HYPERAIBOX_FLEET.find(b => b.id === "c-3po");
  const r2d2 = HYPERAIBOX_FLEET.find(b => b.id === "r2d2");
  const c3poIP = c3po?.ip || "192.168.0.150";
  const r2d2IP = r2d2?.ip || "192.168.0.38";

  const checks: InfrastructureCheck[] = [
    // SPO: ANY response on :9100 = healthy (no /health endpoint)
    { name: "SPO", url: "http://192.168.0.112:9100/", expectedStatus: 404, timeout: 5000 },
    // HBA Tiller ports: ANY TCP response = healthy (Docker proxy to :4000/health)
    { name: "C-3PO Tiller", url: `http://${c3poIP}:9000/`, expectedStatus: 404, timeout: 3000 },
    { name: "R2-D2 Tiller", url: `http://${r2d2IP}:9001/`, expectedStatus: 404, timeout: 3000 },
    // SSH-tunnel fallback for actual health data
    { name: "C-3PO Node Manager", url: `http://${c3poIP}:8006/api/info`, expectedStatus: 200, timeout: 3000 },
    { name: "R2-D2 Node Manager", url: `http://${r2d2IP}:8006/api/info`, expectedStatus: 200, timeout: 3000 },
  ];

  const results: string[] = [];
  let criticalCount = 0;
  let highCount = 0;

  for (const check of checks) {
    const result = await pingEndpoint(check);
    // For HBA tiller ports (404 expected), treat ANY response as healthy
    const isHealthy = check.name.includes("Tiller") || check.name === "SPO" 
      ? result.latencyMs !== undefined  // Got any response
      : result.healthy;  // Normal HTTP check
    
    const status = isHealthy ? "✅" : "🔴";
    const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : "";
    results.push(`${status} ${check.name}${latency}`);

    lastInfraCheck[check.name] = { healthy: isHealthy, checkedAt: Date.now() };

    if (!isHealthy) {
      if (check.name === "SPO") criticalCount++;
      else if (check.name.includes("Tiller")) highCount++;
    }
  }

  // Update box status based on results
  if (c3po && lastInfraCheck["C-3PO Tiller"]?.healthy) {
    c3po.status = "online";
    c3po.lastSeen = Date.now();
  } else if (c3po) {
    c3po.status = "offline";
  }

  if (r2d2 && lastInfraCheck["R2-D2 Tiller"]?.healthy) {
    r2d2.status = "online";
    r2d2.lastSeen = Date.now();
  } else if (r2d2) {
    r2d2.status = "offline";
  }

  // Skip redundant tiller checks - already done above
  const tillerResults: string[] = [];

  const summary = [];
  if (criticalCount > 0) summary.push("🔴 CRITICAL: SPO is down — Stargate Pool offline");
  if (highCount > 0) summary.push(`🟠 HIGH: ${highCount} infra component(s) unreachable`);

  return [
    `Fleet Status (${now}): ${summary.length > 0 ? summary.join("; ") : "All core components responding"}`,
    "",
    ...results,
    "",
    ...tillerResults,
  ].join("\n");
}

async function pingEndpoint(
  check: InfrastructureCheck,
): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), check.timeout);

    const res = await fetch(check.url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { healthy: true, latencyMs };
    }
    return { healthy: false, latencyMs, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { healthy: false, latencyMs, error: err.name === "AbortError" ? "timeout" : String(err) };
  }
}

// ── Status API ──────────────────────────────────────────────────────────────

export function getOrchestratorStatus(): {
  vaultBoxes: number;
  mcpServers: number;
  agents: number;
  lastCheck: number;
  infraHealth: Record<string, { healthy: boolean; checkedAt: number }>;
} {
  return {
    vaultBoxes: knownAgents.length > 0
      ? knownAgents.reduce((sum, a) => sum + (a.boxAccess?.length || 0), 0)
      : 0,
    mcpServers: knownMCPs.length,
    agents: knownAgents.length,
    lastCheck: lastVaultCheck,
    infraHealth: lastInfraCheck,
  };
}

// ── Learning Layer — Pattern Memory ───────────────────────────────────────────

export function recordHeartbeatObservation(
  alertText: string,
  infraState: Record<string, boolean>,
): void {
  try {
    const history = loadHeartbeatHistory();
    history.push({
      timestamp: Date.now(),
      alertText,
      infraState,
    });
    // Keep last 100 heartbeats
    while (history.length > 100) history.shift();
    saveHeartbeatHistory(history);

    // Extract patterns
    learnFromHistory(history);
  } catch (e) {
    console.error("[Orchestrator] Failed to record observation:", e);
  }
}

interface HeartbeatRecord {
  timestamp: number;
  alertText: string;
  infraState: Record<string, boolean>;
}

function loadHeartbeatHistory(): HeartbeatRecord[] {
  try {
    const file = getHeartbeatHistoryFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveHeartbeatHistory(history: HeartbeatRecord[]): void {
  const dir = getMosaicBotDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getHeartbeatHistoryFile(), JSON.stringify(history, null, 2));
}

function learnFromHistory(history: HeartbeatRecord[]): void {
  if (history.length < 3) return;

  const recent = history.slice(-10);
  const latest = recent[recent.length - 1];
  const patterns: string[] = [];

  // Pattern 1: Recurring infra failures — ONLY for components failing NOW.
  // (Loop-engineering: reconcile state, don't append forever. A component that
  // recovered must not carry a stale "chronic issue" claim into future prompts.)
  const currentlyFailing = new Set(
    Object.entries(latest.infraState)
      .filter(([, healthy]) => !healthy)
      .map(([name]) => name),
  );
  for (const name of currentlyFailing) {
    const failCount = recent.filter((h) => h.infraState[name] === false).length;
    if (failCount >= 3) {
      patterns.push(
        `${name} failing ${failCount}/${recent.length} recent checks AND still down now — chronic issue, investigate root cause`,
      );
    }
  }
  // Recovery signals: components that failed earlier in the window but are healthy now
  const previouslyFailing = new Set<string>();
  for (const h of recent.slice(0, -1)) {
    for (const [name, healthy] of Object.entries(h.infraState)) {
      if (!healthy) previouslyFailing.add(name);
    }
  }
  for (const name of previouslyFailing) {
    if (!currentlyFailing.has(name)) {
      patterns.push(`${name} RECOVERED — was failing earlier, healthy in latest check. Do not report as down.`);
    }
  }

  // Pattern 2: Alert frequency
  const alerts = recent.filter((h) => h.alertText !== "HEARTBEAT_OK" && !h.alertText.startsWith("ok"));
  if (alerts.length >= 5) {
    patterns.push(
      `High alert frequency: ${alerts.length}/${recent.length} recent heartbeats triggered alerts`,
    );
  }

  // Pattern 3: Time-based patterns
  const alertHours = alerts.map((h) => new Date(h.timestamp).getHours());
  const hourCounts = new Map<number, number>();
  for (const h of alertHours) {
    hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
  }
  for (const [hour, count] of hourCounts) {
    if (count >= 3) {
      patterns.push(`Alerts cluster around ${hour}:00 (${count} times in last 10 checks)`);
    }
  }

  // FULL REPLACE each cycle (not append): patterns always reflect the latest
  // 10-check window, so recoveries clear stale claims automatically.
  const unique = [...new Set(patterns)].slice(-20);
  saveLearnedPatterns(unique);
}

function loadLearnedPatterns(): string[] {
  try {
    const file = getLearnedPatternsFile();
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveLearnedPatterns(patterns: string[]): void {
  const dir = getMosaicBotDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getLearnedPatternsFile(), JSON.stringify(patterns, null, 2));
}


// ── AXI Tool Forge Capability ──
// When the bot detects a missing tool, it can auto-forge an AXI tool
const AXI_TOOL_GAPS = [
  { need: "fleet status", tool: "hbox-axi", command: "hbox-axi status" },
  { need: "pool orchestration", tool: "spo-axi", command: "spo-axi status" },
  { need: "AIM deployment", tool: "aimify", command: "aimify" },
];

export async function detectMissingTools(): Promise<string[]> {
  const missing: string[] = [];
  for (const gap of AXI_TOOL_GAPS) {
    try {
      const result = await new Promise<{success:boolean}>((resolve) => {
        const { spawn } = require("node:child_process");
        const proc = spawn("which", [gap.tool]);
        proc.on("close", (code:number) => resolve({ success: code === 0 }));
      });
      if (!result.success) missing.push(gap.need);
    } catch {
      missing.push(gap.need);
    }
  }
  return missing;
}

export function buildAxiForgePrompt(missing: string[]): string {
  if (missing.length === 0) return "";
  return `🔧 TOOL GAPS DETECTED: ${missing.join(", ")}. Consider forging AXI tools via the AXI Forge skill. Run: axi-forge ${missing[0]}`;
}
