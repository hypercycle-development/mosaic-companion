// =============================================================================
// AGENT FORGE ENGINE — STRUCTURAL SMOKE TEST (Pure JS, no TS import)
// Validates that all files are correctly shaped and wired
// =============================================================================

const path = require("path");
const fs = require("fs");

function readFile(relPath) {
  const full = path.join(__dirname, relPath);
  return fs.readFileSync(full, "utf8");
}

const engineSrc = readFile("./AgentForgeEngine.ts");
const ideSrc = readFile("../../../src/services/stargate/integrations/IDEAgentForge.ts");
const mainSrc = readFile("../../main.ts");
const preloadSrc = readFile("../../preload.ts");

// =============================================================================
// CHECKS
// =============================================================================

const checks = [];

// --- AgentForgeEngine.ts ---
checks.push(
  { group: "AgentForgeEngine", name: "imports electron", src: engineSrc, test: (s) => s.includes('import { app } from "electron"') },
  { group: "AgentForgeEngine", name: "imports vm.Script", src: engineSrc, test: (s) => s.includes('import { Script } from "vm"') },
  { group: "AgentForgeEngine", name: "imports child_process.spawn", src: engineSrc, test: (s) => s.includes('import { spawn, execSync } from "child_process"') },
  { group: "AgentForgeEngine", name: "has runTest method", src: engineSrc, test: (s) => s.includes("async runTest(") },
  { group: "AgentForgeEngine", name: "has deploy method", src: engineSrc, test: (s) => s.includes("async deploy(") },
  { group: "AgentForgeEngine", name: "has _bundleCode method", src: engineSrc, test: (s) => s.includes("_bundleCode(") },
  { group: "AgentForgeEngine", name: "has _runInVm method", src: engineSrc, test: (s) => s.includes("_runInVm(") },
  { group: "AgentForgeEngine", name: "has _spawnAgent method", src: engineSrc, test: (s) => s.includes("_spawnAgent(") },
  { group: "AgentForgeEngine", name: "has ForgeAgentManifest type", src: engineSrc, test: (s) => s.includes("interface ForgeAgentManifest") },
  { group: "AgentForgeEngine", name: "has ForgeTestResult type", src: engineSrc, test: (s) => s.includes("interface ForgeTestResult") },
  { group: "AgentForgeEngine", name: "uses esbuild.build", src: engineSrc, test: (s) => s.includes("esbuild.build(") },
  { group: "AgentForgeEngine", name: "has timeout in VM", src: engineSrc, test: (s) => s.includes("timeout: 5000") },
  { group: "AgentForgeEngine", name: "has stopAgent method", src: engineSrc, test: (s) => s.includes("stopAgent(") },
  { group: "AgentForgeEngine", name: "has getDeployedAgents method", src: engineSrc, test: (s) => s.includes("getDeployedAgents(") },
  { group: "AgentForgeEngine", name: "has getRunningAgents method", src: engineSrc, test: (s) => s.includes("getRunningAgents(") },
  { group: "AgentForgeEngine", name: "creates manifest.json", src: engineSrc, test: (s) => s.includes('"manifest.json"') },
  { group: "AgentForgeEngine", name: "creates package.json stub", src: engineSrc, test: (s) => s.includes('"package.json"') },
  { group: "AgentForgeEngine", name: "sets FORGE_AGENT_ID env", src: engineSrc, test: (s) => s.includes("FORGE_AGENT_ID") },
  { group: "AgentForgeEngine", name: "has 4 test stages", src: engineSrc, test: (s) =>
    s.includes('Stage 1/4') && s.includes('Stage 2/4') && s.includes('Stage 3/4') && s.includes('Stage 4/4')
  },
  { group: "AgentForgeEngine", name: "has template validation", src: engineSrc, test: (s) => s.includes("_validateTemplate(") },
  { group: "AgentForgeEngine", name: "validates anfe-minter exports", src: engineSrc, test: (s) => s.includes('"anfe-minter": ["mintANFE"]') },
  { group: "AgentForgeEngine", name: "validates fleet-node exports", src: engineSrc, test: (s) => s.includes('"fleet-node": ["registerFleetNode"]') },
  { group: "AgentForgeEngine", name: "validates mcp-adapter exports", src: engineSrc, test: (s) => s.includes('"mcp-adapter": ["startMCPAdapter"]') },
  { group: "AgentForgeEngine", name: "has isHealthy method", src: engineSrc, test: (s) => s.includes("isHealthy(") },
  { group: "AgentForgeEngine", name: "has deployToNode (SSH)", src: engineSrc, test: (s) => s.includes("deployToNode(") },
  { group: "AgentForgeEngine", name: "has deployToSandbox (Docker)", src: engineSrc, test: (s) => s.includes("deployToSandbox(") },
  { group: "AgentForgeEngine", name: "has enableHealthCheck", src: engineSrc, test: (s) => s.includes("enableHealthCheck(") },
  { group: "AgentForgeEngine", name: "has disableHealthCheck", src: engineSrc, test: (s) => s.includes("disableHealthCheck(") },
  { group: "AgentForgeEngine", name: "has _extractImports", src: engineSrc, test: (s) => s.includes("_extractImports(") },
  { group: "AgentForgeEngine", name: "has _bundleCodeWithDeps", src: engineSrc, test: (s) => s.includes("_bundleCodeWithDeps(") },
  { group: "AgentForgeEngine", name: "has _logToChronicle", src: engineSrc, test: (s) => s.includes("_logToChronicle(") },
  { group: "AgentForgeEngine", name: "has runTestWASM", src: engineSrc, test: (s) => s.includes("runTestWASM(") },
  { group: "AgentForgeEngine", name: "has _detectWasmEngine", src: engineSrc, test: (s) => s.includes("_detectWasmEngine(") },
  { group: "AgentForgeEngine", name: "has _buildWasiRunner", src: engineSrc, test: (s) => s.includes("_buildWasiRunner(") },
);

// --- IDEAgentForge.ts ---
checks.push(
  { group: "IDEAgentForge", name: "IDE uses _ipc helper", src: ideSrc, test: (s) => s.includes("_ipc(") },
  { group: "IDEAgentForge", name: "IDE has _persistSessions", src: ideSrc, test: (s) => s.includes("_persistSessions(") },
  { group: "IDEAgentForge", name: "IDE has restoreSessions", src: ideSrc, test: (s) => s.includes("restoreSessions(") },
  { group: "IDEAgentForge", name: "IDE restores on load", src: ideSrc, test: (s) => s.includes("ideAgentForge.restoreSessions()") },
  { group: "IDEAgentForge", name: "IDE delegates test to IPC", src: ideSrc, test: (s) => s.includes("this._ipc('testAgentCode'") },
  { group: "IDEAgentForge", name: "IDE delegates deploy to IPC", src: ideSrc, test: (s) => s.includes("this._ipc('deployAgentCode'") },
  { group: "IDEAgentForge", name: "IDE has listDeployedAgents", src: ideSrc, test: (s) => s.includes("listDeployedAgents(") },
  { group: "IDEAgentForge", name: "IDE has listRunningAgents", src: ideSrc, test: (s) => s.includes("listRunningAgents(") },
  { group: "IDEAgentForge", name: "IDE has stopAgent", src: ideSrc, test: (s) => s.includes("stopAgent(") },
);

// --- main.ts ---
checks.push(
  { group: "main.ts", name: "imports AgentForgeEngine", src: mainSrc, test: (s) => s.includes('import { agentForgeEngine } from "./integrations/forge/AgentForgeEngine"') },
  { group: "main.ts", name: "has stargate:testAgentCode handler", src: mainSrc, test: (s) => s.includes('"stargate:testAgentCode"') },
  { group: "main.ts", name: "has stargate:deployAgentCode handler", src: mainSrc, test: (s) => s.includes('"stargate:deployAgentCode"') },
  { group: "main.ts", name: "has stargate:forge:listDeployed handler", src: mainSrc, test: (s) => s.includes('"stargate:forge:listDeployed"') },
  { group: "main.ts", name: "has stargate:forge:listRunning handler", src: mainSrc, test: (s) => s.includes('"stargate:forge:listRunning"') },
  { group: "main.ts", name: "has stargate:forge:stopAgent handler", src: mainSrc, test: (s) => s.includes('"stargate:forge:stopAgent"') },
);

// --- preload.ts ---
checks.push(
  { group: "preload.ts", name: "exposes listDeployedAgents", src: preloadSrc, test: (s) => s.includes("listDeployedAgents:") },
  { group: "preload.ts", name: "exposes listRunningAgents", src: preloadSrc, test: (s) => s.includes("listRunningAgents:") },
  { group: "preload.ts", name: "exposes stopAgent", src: preloadSrc, test: (s) => s.includes("stopAgent:") },
  { group: "preload.ts", name: "exposes skills.syncToNode", src: preloadSrc, test: (s) => s.includes("skills:") && s.includes("syncToNode") },
);

// --- Skill Delivery Pipeline (Orchestrator) ---
const orchSrc = readFile("../../../src/services/stargate/HermesAgentOrchestrator.ts");
checks.push(
  { group: "Orchestrator", name: "has _syncSkillsToNode (Phase 1)", src: orchSrc, test: (s) => s.includes("_syncSkillsToNode(") },
  { group: "Orchestrator", name: "has _verifySkillsOnNode (Phase 3)", src: orchSrc, test: (s) => s.includes("_verifySkillsOnNode(") },
  { group: "Orchestrator", name: "has _activateSkillsOnNode (Phase 4)", src: orchSrc, test: (s) => s.includes("_activateSkillsOnNode(") },
  { group: "Orchestrator", name: "has _resolveSkillPath", src: orchSrc, test: (s) => s.includes("_resolveSkillPath(") },
  { group: "Orchestrator", name: "has _resolveNodeHost", src: orchSrc, test: (s) => s.includes("_resolveNodeHost(") },
  { group: "Orchestrator", name: "has _scpDirectory", src: orchSrc, test: (s) => s.includes("_scpDirectory(") },
  { group: "Orchestrator", name: "embeds structured skill META", src: orchSrc, test: (s) => s.includes("__stargate_skills__") },
  { group: "Orchestrator", name: "hires agent with skill sync", src: orchSrc, test: (s) => s.includes("Skills synced:") && s.includes("Skills verified:") && s.includes("Skills activated:") },
);

// --- AdaPortalPanel (UI) ---
const adaSrc = readFile("../../../src/components/AdaPortalPanel.tsx");
checks.push(
  { group: "AdaPortalPanel", name: "has selectedSkill state", src: adaSrc, test: (s) => s.includes("selectedSkill") },
  { group: "AdaPortalPanel", name: "has skillSyncStatus state", src: adaSrc, test: (s) => s.includes("skillSyncStatus") },
  { group: "AdaPortalPanel", name: "has Deploy to Node button", src: adaSrc, test: (s) => s.includes('"Deploy to Node"') },
  { group: "AdaPortalPanel", name: "calls electronAPI.skills.syncToNode", src: adaSrc, test: (s) => s.includes("skills.syncToNode") },
  { group: "AdaPortalPanel", name: "shows sync status banner", src: adaSrc, test: (s) => s.includes("skillSyncStatus.syncing") },
  { group: "AdaPortalPanel", name: "shows activated banner", src: adaSrc, test: (s) => s.includes("Skills activated:") },
  { group: "AdaPortalPanel", name: "skill card is selectable", src: adaSrc, test: (s) => s.includes("setSelectedSkill") && s.includes("cursor-pointer") },
);

// --- main.ts skill IPC ---
checks.push(
  { group: "main.ts", name: "has stargate:skill:syncToNode handler", src: mainSrc, test: (s) => s.includes('"stargate:skill:syncToNode"') },
);

// --- AIService Skill Injection ---
const aiServiceSrc = readFile("../../../src/services/AIService.ts");
checks.push(
  { group: "AIService", name: "imports skillInjector lazily", src: aiServiceSrc, test: (s) => s.includes("skillInjector") && s.includes("import(\"./skillInjector\")") },
  { group: "AIService", name: "injects skills before sendMessage", src: aiServiceSrc, test: (s) => s.includes("config.skills") && s.includes("buildSystemPrompt") && s.includes("enrichedMessages") },
  { group: "AIService", name: "logs loaded skills", src: aiServiceSrc, test: (s) => s.includes("[AIService] Skills injected") && s.includes("[AIService] Failed to load skills") },
);

// --- SkillInjector Service ---
const skillInjectorSrc = readFile("../../../src/services/skillInjector.ts");
checks.push(
  { group: "SkillInjector", name: "has buildSystemPrompt method", src: skillInjectorSrc, test: (s) => s.includes("buildSystemPrompt(") },
  { group: "SkillInjector", name: "has _resolveSkillPath", src: skillInjectorSrc, test: (s) => s.includes("_resolveSkillPath(") },
  { group: "SkillInjector", name: "has _loadSkill", src: skillInjectorSrc, test: (s) => s.includes("_loadSkill(") },
  { group: "SkillInjector", name: "caches skills", src: skillInjectorSrc, test: (s) => s.includes("skillCache") && s.includes("cacheMaxAgeMs") },
  { group: "SkillInjector", name: "loads references directory", src: skillInjectorSrc, test: (s) => s.includes("referencesDir") && s.includes("references.set") },
);

// --- Types ---
const typesSrc = readFile("../../../src/types/ai.ts");
checks.push(
  { group: "Types", name: "AIAgentConfig has skills field", src: typesSrc, test: (s) => s.includes("skills?: string[]") && s.includes("Hermes skills attached") },
);

// --- AIAgentsSettings UI ---
const settingsSrc = readFile("../../../src/components/AIAgentsSettings.tsx");
checks.push(
  { group: "AIAgentsSettings", name: "shows Attached Skills section", src: settingsSrc, test: (s) => s.includes("Attached Skills") && s.includes("BookOpen") },
  { group: "AIAgentsSettings", name: "has skill chips with remove", src: settingsSrc, test: (s) => s.includes("skillName") && s.includes("filter((s) => s !== skillName)") },
  { group: "AIAgentsSettings", name: "has add skill dropdown", src: settingsSrc, test: (s) => s.includes("+ Add a skill") && s.includes("onChange={(e) => {") },
  { group: "AIAgentsSettings", name: "calls updateAgent for skills", src: settingsSrc, test: (s) => s.includes("updateAgent(agent.id") && s.includes("skills:") },
);

const groups = {};
let totalPassed = 0;
let totalFailed = 0;

for (const check of checks) {
  const ok = check.test(check.src);
  if (!groups[check.group]) groups[check.group] = { passed: 0, failed: 0, items: [] };
  groups[check.group].items.push({ name: check.name, ok });
  if (ok) {
    groups[check.group].passed++;
    totalPassed++;
  } else {
    groups[check.group].failed++;
    totalFailed++;
  }
}

for (const [name, data] of Object.entries(groups)) {
  console.log(`\n=== ${name} ===`);
  for (const item of data.items) {
    console.log(`${item.ok ? "✅" : "❌"} ${item.name}`);
  }
  console.log(`→ ${data.passed}/${data.items.length} passed`);
}

const total = totalPassed + totalFailed;

console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║  AGENT FORGE + SKILL DELIVERY + SKILL→AGENT INJECTION    ║`);
console.log(`╠══════════════════════════════════════════════════════════╣`);
console.log(`║  AgentForgeEngine : ${String(groups["AgentForgeEngine"]?.passed || 0).padStart(2)}/${String(groups["AgentForgeEngine"]?.items.length || 0).padStart(2)}                              ║`);
console.log(`║  IDEAgentForge    : ${String(groups["IDEAgentForge"]?.passed || 0).padStart(2)}/${String(groups["IDEAgentForge"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  Orchestrator     : ${String(groups["Orchestrator"]?.passed || 0).padStart(2)}/${String(groups["Orchestrator"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  AdaPortalPanel   : ${String(groups["AdaPortalPanel"]?.passed || 0).padStart(2)}/${String(groups["AdaPortalPanel"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  AIService        : ${String(groups["AIService"]?.passed || 0).padStart(2)}/${String(groups["AIService"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  SkillInjector    : ${String(groups["SkillInjector"]?.passed || 0).padStart(2)}/${String(groups["SkillInjector"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  Types            : ${String(groups["Types"]?.passed || 0).padStart(2)}/${String(groups["Types"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  AIAgentsSettings : ${String(groups["AIAgentsSettings"]?.passed || 0).padStart(2)}/${String(groups["AIAgentsSettings"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  main.ts (IPC)    : ${String(groups["main.ts"]?.passed || 0).padStart(2)}/${String(groups["main.ts"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`║  preload.ts       : ${String(groups["preload.ts"]?.passed || 0).padStart(2)}/${String(groups["preload.ts"]?.items.length || 0).padStart(2)}                               ║`);
console.log(`╠══════════════════════════════════════════════════════════╣`);
console.log(`║  TOTAL            : ${String(totalPassed).padStart(2)}/${String(total).padStart(2)}                               ║`);
console.log(`╚══════════════════════════════════════════════════════════╝`);

if (totalFailed > 0) {
  console.error(`\n❌ ${totalFailed} structural checks FAILED`);
  process.exit(1);
}

console.log("\n✅ ALL CHECKS PASSED — Agent Forge v2 is structurally sound and wired correctly!");
