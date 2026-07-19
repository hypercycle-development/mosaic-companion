---
name: mosaic-stargate
description: Mosaic-Companion Stargate module knowledge — architecture, imports, TypeScript patterns, and infrastructure. Load this when working on AdaPortalPanel, fleet, or orchestrator code.
version: 1.3.0
metadata:
  hermes:
    tags: [mosaic, stargate, ada-portal, fleet, orchestrator, typescript]
    related_skills: [kanban-worker]
---

# Mosaic-Companion Stargate Skill

## User Output Preferences

- **Terminal output format:** The user reads responses directly in a terminal. Do NOT emit markdown tables, headers, or heavy formatting. Use plain text with minimal structure. When listing files, use a simple list. When summarizing changes, use short sentences with line breaks, not formatted blocks.
- **Action-first responses:** Fix issues before explaining. Minimize preliminary commentary and verbose framing. Respond like a senior engineer delivering a patch, not a tutorial writer.

## Quick Navigation

| Question | Where to Look |
|----------|--------------|
| "What file has the real orchestrator?" | `src/services/stargate/HermesAgentOrchestrator.ts` line 528 |
| "What file is just a barrel re-export?" | `src/services/stargate/integrations/UnifiedOrchestrator.ts` (~5 lines) |
| "Which tab renders what?" | See Tab Map below |
| "How do I fix a TS error from partial API?" | `as any` at consumption point |
| "What imports should I use?" | Import Map below |
| "How do I simplify the Start tab for new users?" | `references/stargate-ui-simplification.md` (2026-06-02 — remove Autonomous Mode, replace abstract intents with concrete action cards, add descriptions, wire directly to tabs) |
| **How do I design a tree-structured AIM Forge for guided AIM creation?** | `references/aim-forge-tree-panel-design.md` (2026-06-09 — spec-level architecture) AND `references/aim-forge-implementation.md` (2026-06-09 — actual built artifacts: single-file panel, IPC handler reuse lesson, zero new main.ts handlers) |
| "How do I add a new 'Aimify' panel for packaging any AI model?" | `references/generic-aimify-panel.md` (2026-06-02 — 4-step wizard: Source→Info→Config→Build, templates, dataset monetization, Electron IPC `dialog:openDirectory`) |
| "What do I need from a compute provider before building an adapter?" | `references/compute-provider-onboarding-questionnaire.md` (2026-06-03 — 10-category checklist: API, auth, node discovery, health, jobs, billing, network, AIM, legal) |
| "What's the Battery Org integration context?" | `references/battery-org-integration.md` (2026-06-03 — Battery Box concept, revenue model, what we need from David Kam) |
| "What's the mandatory debugging protocol?" | `references/eight-phase-debugging.md` (2026-06-03 — Understand→Hypothesize→Isolate→Verify→Fix→Test→Prevent→Detective) |
| "What imports should I use?" | Import Map below |
| "How does Train Agents connect to Chat Rooms?" | `references/stargate-chat-training-bridge.md` |
| "Why are my agents not interacting in chat rooms?" | `references/chat-room-agent-interaction.md` (2026-06-01 — runner activation, multi-machine serverUrl trap, @mention rules; **2026-06-04 — slow local Ollama model timeout (qwen2.5:32b) and `HeadersTimeoutError` fix**) |
| "Next.js build is failing in Stargate?" | `references/nextjs-build-pitfalls.md` |
| "How do I wire an external Python/Tornado tracker with no CORS?" | `references/external-tracker-integration.md` (verified IPC proxy pattern 2026-06-01) |
| "Where's the starter template for external tracker panels?" | `templates/node-factory-tracker-starter.tsx` (copy-ready React panel 2026-06-01) |
| "Does a CBNO license tracker already exist in Stargate?" | **Yes — `NodeFactoryTrackerPanel` in Start tab** (see Pre-Flight section below) |
| "How do I integrate a new LLM provider into Mosaic?" | `references/llm-provider-integration-checklist.md` (verified 2026-06-01) |
| "How do I wire an external tracker (Python/FastAPI) into Stargate?" | `references/external-tracker-integration.md` (added 2026-06-01) |
| **"How do I integrate Midnight Wallet MCP?"** | `references/midnight-mcp-integration.md` (2026-06-10 — package name, --mcp flag, timeout tuning) |
| "How do I prevent off-chain indexers from inflating owned token counts?" | `references/hyperinsight-ownership-verification.md` (verified 2026-06-01 — includes dead-RPC handling, trust-indexer-owner-first pattern, **AND the critical `if (!owner) return null` boolean-gate fix** for when indexer lacks `owner` field) |
| "How do I write a stakeholder summary of all Stargate features?" | `references/stargate-stakeholder-summary-template.md` (2026-06-04 — canonical tab map, user action→response mapping, architecture diagram, lead-with-Aimify rule) |
| "How do I wire a new payment button to real USDC on Base?" | `references/blockchain-payment-wiring.md` (2026-06-05 — standard 5-step flow, copy-paste for any new marketplace button; rejects `stargateCredits`) |
| "How do I prevent paused sessions from flipping back when I switch tabs?" | `references/stargate-pool-resume-lock-pattern.md` (2026-06-28 — Resume + Lock endpoints, heartbeat logic update, grouped UI sections with big Activate button, verified on R2D2/C-3PO/SPO host) |
| "Why does my Node Factory card still show DEAD after I delegated to Pool?" | `references/node-factory-pool-status-sync.md` (2026-06-28 — Node Factory Tracker and Stargate Pool are separate systems. Cards must query BOTH Merkelizer and Pool sessions to show dual status: on-chain + compute.) |
| **"How do I build a multi-agent Mosaic Bot with Vault + MCP + infrastructure awareness?"** | `references/mosaic-bot-multi-agent-orchestrator.md` (2026-06-30 / 2026-07-01 — multi-agent heartbeat profiles: main/coder/local, **BLACKLIST-only auto-skill importer**, **Memory Bridge to codebase-memory MCP (194k nodes)**, **Stargate Component Registry (38 components)**, **Stargate Doctor v2**, **Stargate Knowledge Indexer with trend tracking**, new IPC handlers) |
| "How do I make a bot self-aware of every component in a complex system?" | `references/stargate-component-registry-pattern.md` (2026-07-01 — catalog UI panels, services, MCPs, infrastructure, contracts in a single registry with query helpers, dependency chains, and capability reports) |
| "How do I connect a bot's local memory to a knowledge graph MCP?" | `references/memory-bridge-pattern.md` (2026-07-01 — bridge SQLite local memory to codebase-memory MCP, query 194k nodes, inject session context into prompts, index sessions back to graph) |
| **How do I prevent LLM hallucination on skill creation?** | `references/mosaic-bot-anti-hallucination-pattern.md` (2026-07-03 — verification layer pattern, filesystem checks before claiming success, kanban vs evolution focus, false health alerts, actual vs claimed skill counts) |
| "How do I connect a bot's local memory to a knowledge graph MCP?" | `references/memory-bridge-pattern.md` (2026-07-01 — bridge SQLite local memory to codebase-memory MCP, query 194k nodes, inject session context into prompts, index sessions back to graph) |
| "How do I add a Coming Soon banner for unbuilt features?" | `references/stargate-coming-soon-pattern.md` (2026-06-28 — Replace fake placeholder UI with honest "Coming Soon" overlays that preserve architecture and navigation. Verified on ComputePortal + BatteryCoin cards.) |
| "How do I convert a Web2 marketplace into a Stargate Rev Pool?" | `references/rev-pool-business-pattern.md` (2026-07-04 — SAFE freight exchange pattern, 14-task kanban graph, tokenomics, competitive advantage framework) AND `references/rev-pool-ui-card-pattern.md` (2026-07-04 — UI card for Stargate Pool Dashboard integration, **ALWAYS place in `renderStargatePool()` NOT in `StargatePoolDashboard.tsx` directly**) |
| "How do I prevent dynamic `import()` functions from breaking in production builds?" | `references/dynamic-import-tree-shaking.md` (verified 2026-06-01) |
| **"TS2307: Cannot find module" error when building Electron app?** | `references/typescript-import-path-fix.md` (2026-07-04 — import path recalculation after file moves) |
| "What UI settings should I expose vs. keep hidden?" | `references/external-tracker-integration.md` → "Sensitive API endpoint exposure" |
| "How do I make the Skills Marketplace discoverable by other MCP clients?" | `references/marketplace-mcp-bridge.md` (2026-06-02 — built MCP bridge spec, zero-dep stdio, 9 tools, auto-registered in `ensureDefaultPlugins()`) |
| "How do I make the marketplace panel work across machines (not just localhost)?" | `references/marketplace-mcp-bridge.md` → "Frontend Panel Integration" (2026-06-02 — `marketplaceCall()` MCP-first + HTTP fallback pattern) |
| "Why does selecting a card in Aimified and sending a prompt produce no response?" | `references/kanban-dashboard-prompt-execution.md` (2026-06-02 — **column-filter gate + API routing mismatch**: `aimified` excluded from `runSelected` filter, `hermes-aim` wrongly routed through `completeWithHermes` (8642 /v1/chat/completions) instead of `sendToHermesAIM` (9000 /chat)) |
| **"Why did my AI Chat agent stop responding / show 'Hermes 404' or '400 Bad Request'?"** | `references/ai-chat-failure-patterns.md` (2026-06-08 — three root causes: literal `JSON_ARGS` in tool prompts, `hermes-aim` heartbeat on wrong port 8642 instead of 9000, invalid empty `Bearer ` auth header) |
| "Every Stargate button opens AI Chat instead of its tab" | `references/navigation-payment-workflow-trap.md` (2026-06-07 — `else if (onNavigateToChat)` handler fallbacks + parent `onCreateNewChatTab` override trap; error-path chat is OK, success-path chat is the bug) |
| "What bugs were found in Aimify battle testing?" | `references/aimify-bug-fix-session-2026-06-05.md` (**UNVERIFIED / DREAM-GENERATED** — describes fixes that were never applied in the actual codebase. Use as a bug checklist, NOT as a patch guide. See Skill Pitfall: "Dream-Generated Reference Files") |
| "What's the full Stargate Pool end-to-end flow (HBA → SPO → Monitor → Heartbeat)?" | `references/stargate-pool-end-to-end.md` (2026-06-27 — verified on R2D2/C-3PO/SPO host; includes IPC wiring, UI patterns, SPO_URL fix, /info vs /health, capacity tracking, Three Streams table showing Rent Compute is NOT built) |
| **"Console floods with 429/403 from base.publicnode.com before I even click Connect"** | `references/shared-rpc-limiter-multi-service-cascade.md` (2026-06-25 — multiple services each with isolated circuit breakers hammer the same public RPC simultaneously. Global SharedRPCLimiter + scan dedup architecture.) |
| **"React blue screen after clicking Activate — Cannot read properties of null (reading 'toFixed')"** | `references/null-toFixed-react-render-crash.md` (2026-06-25 — `anfe.verification` is null, not just `.uptime`. Guard PARENT object before property access. Also `MidnightCityCommandPanel.tsx` `{a.distance.toFixed(1)}m` guard.) |
| "Why does the Aimified column show 0 even though a Node Factory AIM is running?" | `references/kanban-dashboard-aim-discovery.md` (2026-06-02 — dual-route probe: canonical `8000/info` per HYPC devs, fallback `9000/health`; multi-slot aware, nested-flat health-shape tolerant, dedup by `id`) |
| "Chat Rooms shows 'User' instead of my name — where is it set?" | `references/chat-room-username-config.md` (2026-06-02 — persisted config file + two-layer fallback chain in main/renderer + **server-side override diagnosis + renderer-side fix**) |
| "I grepped main.ts and can't find stargate:registerAgentTool / stargate:registerAIM — are they missing?" | `references/stargate-ipc-handler-discovery.md` (2026-06-02 — **false alarm guide**: handlers live in `integrations/sandbox/index.ts` and `integrations/mcp/index.ts`, registered via `initializeTools()`) |

| "How do I simplify the Start tab for new users?" | `references/stargate-ui-simplification.md` (2026-06-02 — remove Autonomous Mode, replace abstract intents with concrete action cards, add descriptions, wire directly to tabs) |
| **How do I design a tree-structured AIM Forge for guided AIM creation?** | `references/aim-forge-tree-panel-design.md` (2026-06-09 — spec-level architecture) AND `references/aim-forge-implementation.md` (2026-06-09 — actual built artifacts: single-file panel, IPC handler reuse lesson, zero new main.ts handlers) |
| "How do I add a new 'Aimify' panel for packaging any AI model?" | `references/generic-aimify-panel.md` (2026-06-02 — 4-step wizard: Source→Info→Config→Build, templates, dataset monetization, Electron IPC `dialog:openDirectory`) |
| "What do I need from a compute provider before building an adapter?" | `references/compute-provider-onboarding-questionnaire.md` (2026-06-03 — 10-category checklist: API, auth, node discovery, health, jobs, billing, network, AIM, legal) |
| "What's the Battery Org integration context?" | `references/battery-org-integration.md` (2026-06-03 — Battery Box concept, revenue model, what we need from David Kam) |
| "What's the mandatory debugging protocol?" | `references/eight-phase-debugging.md` (2026-06-03 — Understand→Hypothesize→Isolate→Verify→Fix→Test→Prevent→Detective) |
| "How do I remove hardcoded personal infrastructure from shared code?" | `references/removing-hardcoded-infrastructure.md` (2026-06-06 — step-by-step pattern: zero defaults, per-user config, fallback to local settings, SECURITY.md + README updates) |
<br><br>
## Tab Map (AdaPortalPanel.tsx)

| Tab ID | Label | Render Function | Data Source |
|--------|-------|-----------------|-------------|
| `dashboard` | Dashboard | `renderDashboard` | `skillMarketplace`, `agentPackages`, `hboxPoolService` |
| `skills` | Skills | `<StargateSkillsMarketplacePanel />` | Live REST API / MCP bridge / `MarketplaceService` `:13000` |
| `packages` | Bundles | `renderPackages` | `stargateRegistry.getBundles()` |
| `training` | Train Agents | `renderTraining` | `trainingMarketplace.getListings()` |
| `asp` | Deploy System | `renderAspGateway` | `aspGateway.getPackages()` |
| `compute` | Compute & Nodes | `renderCompute` / `renderNodes` | Hardcoded tiers (FAKE — see Pitfall below) + `hboxPoolService.getNodes()` |

**⚠️ CRITICAL — `compute` tab has a fake "Rent Compute" placeholder:**
`AdaPortalPanel.tsx:223-226` defines `computeTiers` with hardcoded prices (`$0.50/hr`, `$1.50/hr`, `$5.00/hr`) and specs. These are **entirely fabricated** — there is no ComputePortal API integration, no BatteryCoin connection, no booking flow, and no affiliate tracking. The "Allocate Compute" button just routes to AI Chat. This placeholder should be removed or replaced with real provider integration before any public release. See "The Three Stargate Compute Streams" under "Stargate Pool Dashboard Patterns" below for the full context.
| `marketplace` | Hire Agents | `renderMarketplace` | `stargateRegistry.getAgents()` |
| `aims` | AI Models | `<StargateCommunityAIMPanel />` | `hyperInsightAIMs` + `localNodeBridge` + `StargateSkillRegistry.remoteAIMs` |
| `aimforge` | AIM Forge | `<AIMForgePanel />` | `AIMForgeService.generateFiles()` + `aimify:write-file` / `aimify:exec` / `stargate:registerAIM` |
| `leaderboard` | Rankings | `renderLeaderboard` | Ranking service |
| `stargate` | Stargate Pool | `renderStargatePool` | `ANFEService` + `NodeFactoryTrackerPanel` |

**Skills tab:** Renders `StargateSkillsMarketplacePanel` (imported from `src/components/stargate/StargateSkillsMarketplacePanel.tsx`) instead of the old `renderSkills()` inline. This connects to the standalone Skills Marketplace backend.

**NEW — Agent-to-Agent (Skill → Agent) Flow:**
The Skills detail panel now supports attaching a skill to a Mosaic-Companion AI Agent:

1. User clicks a skill → `SkillDetail` view opens
2. Clicks **"Attach to My Agent"** button (purple, Zap icon)
3. Parent `AdaPortalPanel` receives `onAttachSkill(skill)` callback
4. Sets `selectedSkill = skill`, opens `AgentSelectModal` in `'skill'` mode
5. User picks an agent → `electronAPI.aiAgents.update()` appends skill to agent's `skills[]`
6. Agent now has the skill wired for execution in AI Chat

**Code:**
```typescript
import StargateSkillsMarketplacePanel from './stargate/StargateSkillsMarketplacePanel';

{activeTab === 'skills' && (
  <StargateSkillsMarketplacePanel
    onAttachSkill={(skill) => {
      setSelectedSkill(skill);
      setAgentSelectMode('skill');
      setShowAgentSelectModal(true);
    }}
  />
)}
```

## Import Map

```typescript
// ✅ CORRECT — real orchestrator singleton
import { hermesAgentOrchestrator, HireAgentParams } from '../../services/stargate/HermesAgentOrchestrator';

// ❌ WRONG — type-only barrel, will crash at runtime
import { UnifiedOrchestrator } from '../../services/stargate/integrations/UnifiedOrchestrator';
```

## Provider Strings (Family Checks)

| String | Port | Use |
|--------|------|-----|
| `hermes` | 8642 | Local gateway |
| `hermes-aim` | 9000 | AIM container |
| `hermes-api` | — | OpenAI-compatible endpoint |

**Rule:** Use `provider.startsWith('hermes')` or `provider.includes('hermes')`, never `=== 'hermes'`.

## Pre-Flight: What Already Exists in Stargate (2026-06-01)

Before implementing ANY new feature in the Stargate module, check this list. Multiple agents have re-implemented features that were already in the codebase because they didn't check.

| Feature | File | Status | How to Use |
|---------|------|--------|------------|
| **Node Factory Tracker** (CBNO license health) | `src/components/stargate/NodeFactoryTrackerPanel.tsx` | ✅ Live in Start tab | Renders inside `renderStart()` in `AdaPortalPanel.tsx` |
| **HPEC JSON schema support** | `NodeFactoryTrackerPanel.tsx` line ~198 | ✅ Merged commit `932ef39` | Loads both `{ "base": ["id"] }` and `{ "Licenses": [{"network","license_id"}] }` |
| **IPC proxy for CORS-less APIs** | `electron/main.ts` + `preload.ts` | ✅ Merged | `window.electronAPI.nodeFactory.checkLicense()` + `.loadJsonFile()` |
| **Clear/Disconnect file button** | `NodeFactoryTrackerPanel.tsx` Settings panel | ✅ Merged | Red `XCircle` next to Browse, guarded by `filePath` |
| **Auto-refresh toggle + interval** | `NodeFactoryTrackerPanel.tsx` | ✅ Merged | Settings panel exposes `autoRefresh` + `refreshInterval` |
| **Stargate Pool ANFE discovery** | `src/services/StargatePool/ANFEService.ts` | ✅ Merged commit `1cd228b` | `loadWalletANFEs()` — parallel, timeout-protected |
| **Ollama Cloud provider** | `src/services/...` (model config) | ✅ Merged | Models ending in `:cloud` route through `ollama-cloud` provider |
| **Skills Marketplace panel** | `StargateSkillsMarketplacePanel.tsx` | ✅ Live in Skills tab | REST API on port 3000 |
| **Agent-to-Agent skill attachment** | `AdaPortalPanel.tsx` + `AgentSelectModal` | ✅ Merged | Purple "Attach to My Agent" button in skill detail |

### Anti-Pattern: "I clicked a button and nothing happened"
→ ❌ WRONG: Debug the click handler internals, add logging, or assume the child component is broken.  
→ ✅ RIGHT: Check if the **callback prop is undefined at the call site** by logging `props.onAction` in the child. If it's `undefined`, trace upward through the parent instantiation chain (`Child` → `Parent` → `Grandparent`) until you find the component that mounts the child without passing the callback. The fix is always adding the missing prop in the parent, not changing logic inside the child. See `references/aimify-bug-fix-session-2026-06-05.md` → "React Callback Prop Wiring Trap" for the full diagnostic pattern.

### Anti-Pattern: "The Aimified column shows 0 but my AIM is running"
→ ❌ WRONG: Add AIM persistence logic into `electronAPI.aiAgents` store  
→ ✅ RIGHT: Probe `localhost:8000/info` (canonical node API, lists all AIM slots) and inject **synthetic, ephemeral** `KanbanAgent` with `column: 'aimified'`. Fallback to `localhost:9000/health` for standalone AIMs (no node). See `references/kanban-dashboard-aim-discovery.md`.

**Additional traps when implementing this (verified 2026-06-02):**
- **Health response shape mismatch:** Some AIM versions return `{"status": {"status": "ok"}}` (nested), not `{"status": "ok"}` (flat). A naive `info?.status === 'ok'` check silently discards the synthetic agent. See Pitfall A in `references/kanban-dashboard-aim-discovery.md`.
- **Stale bundled build:** After patching `src/components/KanbanDashboard.tsx`, `npm run build:renderer` creates a new bundle, but the running Electron renderer holds the old JS in memory. The probe code never executes until **Ctrl+R** reloads the renderer. See Pitfall C in `references/kanban-dashboard-aim-discovery.md`.
- **ProviderIcon missing `hermes-aim`:** Any `switch(provider)` rendering logic must catch both `'hermes'` and `'hermes-aim'`. See Pitfall B in `references/kanban-dashboard-aim-discovery.md`.
- **Route `8006/aim/<slot>/` returns HTML in dev mode:** Do not use this for programmatic health checks — it serves the Vite dev SPA. See Pitfall E in `references/kanban-dashboard-aim-discovery.md`.
- **Hardcoded `9000` port:** The node API `aim.aims[]` contains the actual `port` per slot. Use `aim.port || 9000 + slot`, not hardcoded `9000`. See Pitfall F in `references/kanban-dashboard-aim-discovery.md`.
- **TS2339 static method import trap:** When routing provider `hermes-aim` to `AIService.sendToHermesAIM`, dynamic import must be `const { AIService } = await import('...')` then `AIService.sendToHermesAIM(...)`. Direct destructuring `const { sendToHermesAIM } = ...` fails at build time because the method is on the class, not a module export. See `references/kanban-dashboard-prompt-execution.md` → "Static Method Import Pitfall".

### Anti-Pattern: "I need a license tracker"
→ ❌ WRONG: Start from scratch with `delegate_task` subagents  
→ ✅ RIGHT: Read `NodeFactoryTrackerPanel.tsx` (36 KB, fully featured). If you need a variant, copy it and modify.

### Anti-Pattern: "I need to wire an external API with no CORS"
→ ❌ WRONG: Try renderer `fetch()` and struggle with CORS  
→ ✅ RIGHT: Copy the IPC proxy pattern from `electron/main.ts` (`nodeFactory:checkLicense` handler).

### Anti-Pattern: "I need to support a new JSON schema"
→ ❌ WRONG: Replace the existing parser  
→ ✅ RIGHT: Add a normalization branch (see `references/external-tracker-integration.md` → "Schema Normalization Pitfall").

### Anti-Pattern: "Every button in my panel opens AI Chat"
→ ❌ WRONG: Add logging inside the click handler, assume the child is broken, or wrap every handler in `setTimeout` to delay chat.  
→ ✅ RIGHT: Check THREE places:
1. **Handler fallbacks** — grep for `else if (onNavigateToChat)` in the leaf component and remove any success-path fallback. The chat redirect is legitimate only for wallet-missing / wrong-wallet / insufficient-funds error paths.
2. **Parent override** — trace the callback prop (`onHireAgent`, `onGetPackage`, etc.) through every parent instantiation. If `ContentArea.tsx` (or any parent) wires it to `onCreateNewChatTab`, that parent overrides the child's tab navigation.
3. **Intent card grid** — if Start tab cards call `onNavigateToChat` inside their `onClick`, remove it. Cards should only `setActiveTab(intent.tab)`.

**Rule of thumb:** Error flows get chat, success flows stay put. See `references/navigation-payment-workflow-trap.md` for the full 2026-06-07 diagnosis, fix diff, and prevention checklist.

## Skill Pitfall — Dream-Generated Reference Files

The `gbrain` system can emit **dream-generated** reference files that describe plausible-sounding but **unverified** fixes. These files contain specific line numbers, code snippets, and patch descriptions that **do not exist in the actual codebase**.

**Detection signals:**
- References to files or paths you cannot find via `search_files`
- Specific line numbers that don't match actual file contents
- Described fixes that would require changes you never made
- Content surfaced by `gbrain` tools without accompanying terminal/patch verification

**How to handle:**
1. Treat the content as a **bug checklist / hypothesis list**, NOT as ground truth.
2. Independently verify every claim against the actual codebase (`read_file`, `search_files`).
3. If unverified, add a **prominent unverified marker** to the reference so future agents don't blindly apply the described fixes.
4. Never patch production code based solely on dream-generated reference content.

**Example:** `references/aimify-bug-fix-session-2026-06-05.md` was marked as unverified because none of the six described fixes were actually present in the codebase.

## Training Room Bridge (Train Agents → Chat Rooms)

Single-click deployment: user selects an agent and clicks Train → agent is assigned to a freshly-created chat room with a skill-aware training prompt injected into its system prompt.

### Flow
1. User in AdaPortalPanel **Train Agents** tab clicks **Train**
2. `TrainingRoomDeployer.ts` creates/joins a room named `Training: {Skill}` (private visibility)
3. Assigns agent with `trainingContext: { skillName, systemPrompt }`
4. `agent-runner.ts` prepends the training context to the LLM system prompt
5. Training session auto-logs to Vault box **"Training-Logs"**
6. User auto-navigated to **Chat Rooms**; `ChatPage.tsx` reads `sessionStorage["stargate_training_deployment"]`, auto-joins the room and surfaces a **Training** badge

### Files
| Role | Path |
|------|------|
| Deployer service | `src/services/stargate/TrainingRoomDeployer.ts` |
| Train handler | `src/components/AdaPortalPanel.tsx` (~line 3974) |
| Chat room UX | `src/components/ChatPage.tsx` (mount reader + badge) |
| Runner injection | `electron/integrations/chat/agent-runner.ts` |
| IPC plumbing | `electron/integrations/chat/index.ts` + `CHATAPI.ts` |
| Types | `global.d.ts` (`assignAgent` signature) |

### Patterns
- **Dynamic import** for deployer: `import(/* webpackChunkName: "training-deployer" */ './TrainingRoomDeployer')` — keeps AdaPortal bundle small
- **sessionStorage bridge**: `sessionStorage["stargate_training_deployment"] = JSON.stringify({ roomId, agentId, skillName })`
- **Training prompt injection**: replaces generic assistant system prompt when `trainingContext` is present; fallback to `"You are training to master {skillName}. Research, practice, and refine your skills."`
- **Vault logging**: `window.electronAPI.vault.addEntry("Training-Logs", JSON.stringify(sessionMeta))` — fires once on successful deployment
- **Purple badge**: CSS class `bg-purple-600 text-white` on room header `<h1>` when `trainingInfo.isTraining` is true

### Deferred to V2
- Sparring mode (agent vs agent)
- Guided Training (pre-loaded thread with curriculum)
- Multi-agent curricula

---

## Infrastructure (Verified 2026-06-11)

| Service | Port | Status Check | Notes |
|---------|------|-------------|-------|
| AIM container | 9000 | `curl http://127.0.0.1:9000/health` | hermes-embedded-slot0 |
| Dashboard | 9119 | `curl http://127.0.0.1:9119/api/status` | ✅ Confirmed running (corrected from Gap #11) |
| Ollama | 11434 | `curl http://127.0.0.1:11434/api/tags` | Local models |
| Hermes Gateway | 8642 | `pgrep -f "hermes gateway"` | Process may exist but not bind — see troubleshooting |
| Skills Marketplace API | 3000 | `curl http://localhost:3000/health` | External service |
| MarketplaceService | 13000 | `curl http://127.0.0.1:13000/api/health` | Zero-dep, auto-starts |
| Scanner | 8001 | `curl http://localhost:8001/health` | Often not running — check before debugging |
| Local Node Bridge | 8000 | `curl http://localhost:8000/info` | HyperCycle node API |
| Ollama Cloud | — | `https://ollama.com/v1/chat/completions` | Cloud models with `:cloud` suffix |
| PostgreSQL | 5432 | `pg_isready -h localhost -p 5432` | For kanban persistence |
| Kanban DB | — | `~/.hermes/kanban.db` | SQLite |

**Port 9119 Correction:** Gap Analysis Report #11 claimed Dashboard port 9119 was "not found in codebase" — this was **incorrect**. Ops verification (t_571128ac) confirmed port 9119 IS running and accessible. Always verify with actual health checks rather than codebase grepping.

**Port 8642 Gateway Issue:** Process may exist (`pgrep` shows PID) but not accept connections. Check with `curl http://localhost:8642/api/status` — if this fails, gateway needs restart even if process appears running.

**Port 8001 Scanner:** Frequently not running. This is expected if Skills Marketplace hasn't been started. Don't assume misconfiguration — verify service status first.

## Stargate Pool Dashboard Patterns (Verified 2026-06-27)

When building a compute-pool dashboard for Stargate, follow these UX and technical patterns verified during the Stargate Tilling → Stargate Pool rename.

### The Three Stargate Compute Streams

Stargate has **three independent compute tracks**. Two are implemented. One is a placeholder that must be addressed.

| Stream | What | Who Owns | Pricing | Status |
|--------|------|----------|---------|--------|
| **My Compute** (Decentralized) | User-owned appliances — HyperAIBox, Battery Boxes, custom nodes | User (free for themselves) | User earns if they rent out | ✅ **Implemented** — Node list, delegation, ANFE management |
| **Stargate Pool** (Community) | Users delegate appliances to pool for shared compute | Community | Free during beta | ✅ **Implemented** — License delegation, capacity tracking, dual-status UI |
| **Rent Compute** (Marketplace) | External providers — ComputePortal, BatteryCoin, etc. | Provider | Provider sets price; Stargate earns affiliate | ❌ **NOT built** — Only fake placeholder UI (`AdaPortalPanel.tsx:223-226`) |

**The fake placeholder:** `const computeTiers = [{ id: 'standard', price: '$0.50/hr', ... }]` — static strings with no API, no provider, no booking flow, no affiliate tracking. Either remove this or replace it with real provider integration.

**Decision needed:** Remove placeholder or mark "Coming Soon" with scoped provider onboarding.

### Don't Show Fake Earnings / Revenue Metrics

**Rule:** Never display earnings, revenue, or "HyPC earned" metrics unless there is a real on-chain data source for those numbers. HyperAIBox cannot query real HYPC rewards per Node Factory — there is no API endpoint for this.

**Anti-pattern:** Showing `0.00 HyPC` as a placeholder in session cards or dashboard stats. Users interpret this as "I'm earning nothing" which is misleading, or worse, they think it's real when it's fabricated.

**What to show instead:**
- Compute status (Node Manager Up/Down)
- License count in pool
- Uptime hours
- Heartbeat recency
- Pool capacity (slots used / total)

**What to show if real earnings exist:**
If a Merkelizer API or on-chain indexer provides per-license reward data, THEN and only then add an earnings column. Gate the display behind a feature flag or data-availability check.

**Pitfall:** I (the agent) once added `earningsHyPC: number` to the `TillingSession` type, rendered it in StatCard as `"${totalEarnings.toFixed(2)} HyPC"`, and populated it in SPO's heartbeat handler from `estimated_earnings_hypc`. None of these numbers were real. The user caught this and corrected it immediately.

**Fix pattern when caught:**
1. Remove the field from the TypeScript interface
2. Replace the stat card label (e.g., `Licenses` instead of `Earnings`)
3. Remove the assignment from the SPO server heartbeat handler
4. Replace the detail column in session cards with actual verifiable data (e.g., compute status)

### Beta-Mode Pricing: Don't Display Prices
During beta testing, **do not show prices** on action buttons or cards. Instead:
- Label the action with a **"Beta"** badge
- Explain what the action does in plain terms ("Delegate to Pool", not "Activate Tilling")
- Add a sub-line disclaimer: *"Adds license to Stargate Pool. Does NOT activate Node Factory on-chain."*
- Alert on success should explain both pool delegation AND that on-chain activation is still required via Merkelizer

**Anti-pattern:** Showing `$3.00/mo` on a beta button spooks users and creates false expectations about billing.

### Pool Status ≠ On-Chain Status (Critical UX Pattern)
Users conflate "compute allocated in pool" with "Node Factory activated on-chain." Always show **dual status**:

```
[Compute: active]  [On-chain: check Merkelizer]
```

The pool only provisions containers/VMs. On-chain activation (Merkelizer) is a separate step. If the Node Factory shows "dead" in the tracker but "active" in the pool, the compute is running but the license isn't delegated on-chain.

**Info banner text:**
> "The cards below show compute allocation in the Stargate Pool. Your Node Factory may show 'active' here (compute assigned) but still be 'dead' on Merkelizer (not activated on-chain). Both must be active for full operation."

### Pool Capacity Bar
Show a visual capacity indicator using data from `GET /api/v1/boxes`:

```typescript
const onlineBoxes = boxes.filter(b => b.status === 'online');
const totalSlots = onlineBoxes.reduce((sum, b) => sum + (b.maxConcurrentTenants || 2), 0);
const usedSlots = onlineBoxes.reduce((sum, b) => sum + (b.tenantCount || 0), 0);
const percent = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
```

**Color rules:**
- `< 70%` → Green
- `70-90%` → Amber
- `> 90%` → Red + warning banner: *"Pool near capacity. Add more HyperAIBoxes to accommodate more licenses."*

### HyperCycle Node Manager Health Check
HyperCycle Node Manager v0.5.0 (running via systemd `hypercycle.service`) responds to `GET /info` with:
```json
{"status":"alive","name":"Hypercycle Node","node_version":"0.5.0"}
```

**It returns 405 Method Not Allowed on `/health`**. Any monitor or health probe inside a Docker container checking `localhost:8000/health` will falsely report the node as dead.

**Fix:** Always use `/info`, not `/health`:
```typescript
// ✅ CORRECT
const resp = await fetch('http://localhost:8000/info', { timeout: 5000 });
const nmAlive = resp.status === 200;

// ❌ WRONG — returns 405 on HyperCycle NM v0.5.0
const resp = await fetch('http://localhost:8000/health', { timeout: 5000 });
```

### Container Networking: SPO_URL Must Be Host IP
When a Docker monitor container needs to reach the SPO (Stargate Pool Orchestrator) running on the host machine:

**Problem:** Passing `spo_url: 'http://localhost:9100'` from SPO to HBA to monitor container means the monitor hits `localhost:9100` **inside the container**, where nothing is listening.

**Fix:** SPO must pass its **host-accessible IP** (e.g., `192.168.0.112:9100`):
```typescript
// In SPO provision handler
const spoHost = process.env.SPO_HOST || '192.168.0.112';
const spoUrl = `http://${spoHost}:9100`;
// Forward spoUrl in provision payload to HBA
```

The monitor container needs `--network host` (or explicit port mapping) so `localhost:8000` inside the container maps to the host's Node Manager. But `localhost:9100` for SPO must be replaced with the host's LAN IP.

### Naming: "Stargate Pool" vs "Stargate Tilling"
"Tilling" is an internal operation name. Users see **"Stargate Pool"** — a pool of delegated Node Factory licenses running on community HyperAIBoxes. The dashboard header should say:
- **Title:** "Stargate Pool"
- **Subtitle:** "Community Node Factory Compute"

## AIM Container — Sacred

- **Name:** `hermes-embedded-slot0`
- **Do NOT stop/restart** without pausing AIMLoop via mongosh first
- **Pause:** `mongosh` → update tries to 99, status to "error"
- **Auto-kill bypass:** Set MongoDB `status: "virtual"`

## TypeScript Patterns

### Removing @ts-nocheck
1. `npx tsc --noEmit` → get error list
2. Fix structural (missing interface fields)
3. Fix syntax (paren balance)
4. Apply `as any` last for partial API objects

### setState with .map()
```typescript
// WRONG
setListings((registryAgents.map(a => ({...})));
// CORRECT
setListings(registryAgents.map(a => ({...})));
```

### Partial API → as any
```typescript
status === 'online' || status === ('alive' as any)
```

## Branch

`stargate-module` on `github.com:hypercycle-development/mosaic-companion`

## Community AIM Integration (Remote Operators) — Shipped

HyperCycle node operators with public AIM endpoints can register their AIMs in Stargate so other users can discover and pay-per-use them. This is **distinct** from local Node Manager AIMs.

**Status:** ✅ Merged on `stargate-module` — `StargateCommunityAIMPanel.tsx` renders in the **AI Models** tab with 4 views.

### AI Models Tab Views

| View | Data Source | What It Shows |
|------|-------------|---------------|
| **All** | Combined | Every AIM from all sources |
| **HyperCycle** | `hyperInsightAIMs` prop (from `AdaPortalPanel` `aims` state) | Official AIMs tracked by HyperInsight |
| **Local** | `localNodeBridge.getLocalAIMs()` + `EnhancedLocalNodeBridge` + `localhost:9000` fallback | AIMs running on the user's own hardware |
| **Community** | `StargateSkillRegistry.remoteAIMs` (persisted `localStorage` key `stargate_remote_aims`) | Operator-submitted remote AIMs with health probes |

**Panel file:** `src/components/stargate/StargateCommunityAIMPanel.tsx`  
**Registry file:** `src/services/StargateSkillRegistry.ts`  
**Credits service:** `src/services/stargate/StargateCreditsService.ts` (beta ledger, seeded 100 USDC)

### Health Probe Pattern (Shipped)

- **Remote AIMs (Community tab):** 60s interval, 8s timeout, nested/flat shape tolerance
- **Local AIMs (Local tab):** `localNodeBridge.getLocalAIMs()` every 30s + `localhost:9000/health` fallback

```typescript
const probeRemoteAIM = async (aim: AIMInfo): Promise<boolean> => {
  try {
    const resp = await fetch(aim.healthUrl!, { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return false;
    const data = await resp.json();
    return (data.status === 'ok') || (data.status?.status === 'ok');
  } catch { return false; }
};
```

### Real Payment Flow (USDC on Base via PaymentService)

All "Use AIM" buttons must execute real USDC transfers on Base — no fake credit ledgers. The `PaymentService` (viem-based) handles wallet detection, balance checking, chain switching, transaction signing, and receipt confirmation.

**Files:**
- `src/services/AdaPortal/PaymentService.ts` — service implementation
- `src/components/stargate/StargateCommunityAIMPanel.tsx` — Community AIMs "Use AIM" button
- `src/components/AdaPortalPanel.tsx` — Hire Agents & Bundles buttons

**Flow (5 steps):**
1. `paymentService.detectWallet()` — EVM wallet required; Cardano rejected with guidance
2. `paymentService.checkBalance(address, price)` — must have USDC + ETH for gas
3. `paymentService.executePayment({ amount, recipient, description, metadata })` — signs USDC `transfer` on Base
4. Wait for `waitForTransactionReceipt` confirmation
5. `fetch(aim.requestUrl)` to call the AIM, then show result + TX hash

**Fallback on blocked payment:**
- No wallet → `alert` + `onNavigateToChat('How do I connect my EVM wallet?')`
- Cardano → `alert` + `onNavigateToChat('How do I switch to an EVM wallet?')`
- Insufficient USDC → `alert` + `onNavigateToChat('How do I fund my wallet with USDC on Base?')`

**Anti-pattern:** `stargateCredits.deduct(price)` — this is a fake localStorage balance that never touches the blockchain. Never use it for production payment buttons.

For the full copy-paste pattern and convenience methods (`payForAgent`, `payForBundle`, `executePayment`), see `references/blockchain-payment-wiring.md`.

### "Register My AIM" Form

Modal inside `StargateCommunityAIMPanel.tsx` with fields: AIM Name, Description, Version, Endpoint URL, Health URL, Manifest URL, Request URL, Price per call, Price token, Operator name, Operator contact, Node ID, License ID.

On submit: `stargateRegistry.registerRemoteAIM(formData)` → persists to `localStorage` → immediately renders in Community tab.

### First Community AIM Seed

Dory's `hypc-node-status` is seeded in `StargateSkillRegistry.seedCommunityAIMs()`:
- Endpoint: `https://api.hypercycle.ai/aims/hypc-node-status`
- Price: 0.02 USDC per call
- Operator: `Dory (HyperCycle Node Operator)`

See `references/community-aim-integration.md` for full implementation details and external contribution process.

## External API Panel Integration (2026-06-22)

When integrating an external API (e.g. Midnight City observer API) into a Stargate panel, use the **4-step IPC bridge pattern** instead of renderer `fetch()` (which hits CORS or needs token exposure):

### Step 1 — Add IPC handler in `electron/main.ts`

Register a handler that accepts structured params, calls the external API from the trusted main process, and returns normalized results:

```typescript
ipcMain.handle("myapi:doSomething", async (_event, params: { endpoint: string; method: "GET" | "POST"; body?: any; token: string }) => {
  try {
    const response = await fetch(`https://api.example.com${params.endpoint}`, {
      method: params.method,
      headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
    const text = await response.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!response.ok) return { error: `${response.status} ${response.statusText}`, data: null };
    return { error: null, data };
  } catch (err: any) {
    return { error: err.message, data: null };
  }
});
```

### Step 2 — Expose in `electron/preload.ts`

Add the namespace to `contextBridge.exposeInMainWorld("electronAPI", { ... })`:

```typescript
myApi: {
  call: (params: { endpoint: string; method: "GET" | "POST"; body?: any; token: string }) =>
    ipcRenderer.invoke("myapi:doSomething", params),
},
```

### Step 3 — Add TypeScript types in `src/global.d.ts`

Extend the `Window.electronAPI` interface so TS knows about the new namespace:

```typescript
myApi?: {
  call: (params: { endpoint: string; method: "GET" | "POST"; body?: any; token: string }) => Promise<{ error: string | null; data: any }>;
};
```

### Step 4 — Wire panel into `AdaPortalPanel.tsx`

1. Import the panel component:
   ```typescript
   import MyApiPanel from './stargate/MyApiPanel';
   ```
2. Add the tab ID to the `TabId` union:
   ```typescript
   type TabId = 'start' | ... | 'myapi' | 'asp';
   ```
3. Add the tab entry to the `tabs` array:
   ```typescript
   { id: 'myapi', label: 'My API', icon: <Icon size={18} /> },
   ```
4. Add the render branch:
   ```typescript
   {activeTab === 'myapi' && <MyApiPanel />}
   ```
5. Add the icon import from `lucide-react`.

**Pitfall:** `AdaPortalPanel.tsx` is ~4400 lines. The Hermes `patch` tool may report success without actually writing changes on files this large. Always verify with `grep "MyApiPanel" src/components/AdaPortalPanel.tsx` after patching. If the change didn't apply, use Python direct string replacement instead of `patch`.

**Verified example:** The `midnightCity` namespace (2026-06-22) follows this exact pattern with 5 handlers: `apiCall`, `readScript`, `writeScript`, `restartMiner`, `deployAgent`. See `electron/main.ts` lines 1834+ and `electron/preload.ts` for the working implementation.

When integrating a third-party compute provider (e.g. Battery Org data centers) into Stargate **Compute & Nodes**, request this from the provider before writing code. The full questionnaire is available in `references/compute-provider-onboarding-questionnaire.md` — copy it, fill it with the provider, and use the answers to scope the adapter.

| Category | Why It Blocks |
|----------|---------------|
| 1. API Spec | You need endpoints and schemas to write any fetch() call |
| 2. Auth | Wrong header = 401 on every call |
| 3. Node Discovery | Can't render nodes if you don't know the discovery response shape |
| 4. Health Check | Can't show online/offline status |
| 5. Job Submission | Can't submit inference jobs |

| Category | Why It's Parallel |
|----------|-----------------|
| 6-7. Tracking + Billing | Needed for production but not for a smoke-test adapter |
| 8. Network | Affects deployment config, not code structure |
| 9. AIM Compatibility | Determines if AIMs need a translation layer or can be used as-is |
| 10. Legal | Required before launch, not before prototype |

**Pre-flight rule:** Never start building the adapter without #1-5.

### Battery Org Integration Context

Battery Org (David Kam) sells **Battery Boxes** — bundled units of location + energy + compute power. See `references/battery-org-integration.md` for:
- What a Battery Box is (physical, not cloud VM)
- Revenue model (existing inference jobs → aimify → monetize)
- Beta test strategy (connect to node factories as secondary option before full integration)
- Priority questions for David (API key, node list, Battery Box metadata, job submission, health, AIM compatibility, pricing)

## Debugging Protocol (Mandatory)

All debugging, integration, and troubleshooting tasks must follow the 8-phase protocol documented in `references/eight-phase-debugging.md`:

Understand → Hypothesize → Isolate → Verify → Apply Minimal Fix → Test → Prevent → Detective

This is a user-mandated format. Never substitute with default 4-phase summaries. The reference includes Stargate-specific tool mappings per phase and anti-patterns to avoid.

## Operations Center Panel Patterns

Reusable UI/UX conventions for Stargate Operations Center panels (e.g., fleet trackers, node monitors) wired into the **Start tab**.

### Clear / Disconnect File Pattern
Every file-attached panel must expose a **compact XCircle disconnect button** in its **Settings view**, next to the "Browse…" button. This resets both localStorage persistence and React state, returning the panel to its empty / onboarding state.

**Implementation:**
```typescript
const clearLicenseFile = useCallback(() => {
  setFilePath('');
  setResults([]);
  setLastUpdated(null);
  setFleet({ statuses: {}, total: 0, alive: 0, dead: 0, loading: 0 });
  setSettings(prev => ({ ...prev, licensesJsonPath: null }));
}, []);
```

**UX placement (Settings panel, inside the File Path row):**
```typescript
<div className="flex items-center gap-2">
  <FolderOpen size={14} className="text-gray-500 shrink-0" />
  <span className="flex-1 text-sm text-gray-300 truncate">
    {settings.licensesJsonPath || 'No file selected'}
  </span>
  <button onClick={pickLicenseFile} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs">
    Browse…
  </button>
  {settings.licensesJsonPath && (
    <button onClick={clearLicenseFile} className="px-2 py-1.5 hover:bg-red-500/20 text-red-400 rounded-lg" title="Disconnect file">
      <XCircle size={14} />
    </button>
  )}
</div>
```

**Rules:**
- Button appears **only when a file is loaded** (guarded by `filePath`).
- Icon only — no label — to keep the row compact.
- Red `text-red-400` / `hover:bg-red-500/20` on hover.
- Clears **all runtime state** (results, fleet, timestamps) + **persisted settings**.
- Verified 2026-06-01.

## Skill Pitfall — Patching Large Files (AdaPortalPanel.tsx)

`AdaPortalPanel.tsx` is ~4400 lines / 200KB. The Hermes `patch` tool uses fuzzy matching with confidence thresholds. On files this large, it may report success without actually writing the change.

**Detection:** After any patch on this file, always verify with grep:
```bash
grep "aimforge" src/components/AdaPortalPanel.tsx
grep "AIMForgePanel" src/components/AdaPortalPanel.tsx
```

**Fix:** Use Python direct string replacement instead of `patch` for AdaPortalPanel.tsx. The file is too large for the fuzzy matcher's confidence threshold, but exact string replacement works reliably:

```python
with open('src/components/AdaPortalPanel.tsx', 'r') as f:
    content = f.read()
content = content.replace(old_string, new_string)
with open('src/components/AdaPortalPanel.tsx', 'w') as f:
    f.write(content)
```

**Applies to:** Any file > 3000 lines in the Mosaic-Companion codebase (AdaPortalPanel.tsx, ChatPage.tsx, NodeFactoryTrackerPanel.tsx).

## gbrain Pages

- `mosaic-companion/stargate/overview` — Architecture overview
- `mosaic-companion/stargate/typescript-fix-log` — @ts-nocheck removal log
- `mosaic-companion/stargate/orchestrator-imports` — Import map warning
- `mosaic-companion/stargate/taste-skill-dials` — Taste-Skill integration
- `mosaic-companion/stargate/fleet-discovery` — FleetDiscoveryService
- `mosaic-companion/infrastructure/topology` — Service topology
- `mosaic-companion/ops/kanban-zombie-incident` — Zombie worker incident

---

## Stargate Skills Marketplace — Pitfalls (2026-06-02)

**Scanner port drift.** The docs historically list `:8003` but the actual FastAPI scanner starts on `:8001`. Always verify `scanner/src/main.py` or the startup command before documenting or connecting. The MCP bridge (see `references/marketplace-mcp-bridge.md`) defaults to `:8001`.

**Backend missing → panel shows empty/error state.** `StargateSkillsMarketplacePanel` has no mock/fallback data. If `localhost:3000` is unreachable, the user sees only a loading spinner or generic error. Before asking the user to pick from Options 1-4, verify whether the backend server is actually running (`curl http://localhost:3000/health`) and whether the scanner is up (`curl http://localhost:8001/health`).

**MCP bridge opportunity.** The marketplace backend (`:3000`) and scanner (`:8001`) are REST APIs consumed only by the hardcoded panel. Wrapping them in a zero-dependency stdio MCP server (copy the `gbrain-mcp-server.js` pattern) makes skill discovery and security scanning callable by any MCP client (Claude Desktop, Cursor, other agents). See `references/marketplace-mcp-bridge.md` for the built MCP bridge spec.

**TypeScript variable hoisting when adding multiple stdio MCP plugins.** `ensureDefaultPlugins()` in `electron/integrations/mcp/index.ts` is a single function with multiple conditional `if (!existing.some(...))` blocks. Each block historically declared its own `const path = require("path")`, `const os = require("os")`, etc. Adding a third plugin block (e.g. `stargate-marketplace`) causes TS2448/TS2451 "Block-scoped variable used before its declaration" because the earlier block's `path` shadows the later block's `path` within the same function scope. **Fix:** Hoist all shared Node.js built-in requires to the top of `ensureDefaultPlugins()`, then reference them in each conditional block without redeclaring.