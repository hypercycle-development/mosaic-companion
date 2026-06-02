<div align="center">
<img width="1200" height="475" alt="Stargate Module Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mosaic Stargate Module

> AI Workforce + Compute + Intelligence Platform for Cardano

Stargate is the integrated control panel inside **Mosaic Companion** that transforms a local HyperCycle Node Manager into a full AI orchestration hub. It bridges on-chain Cardano assets (NFTs, ANFE tokens), off-chain compute (HyperCycle nodes, H-Box pools), and AI agent management (Hermes kanban, training rooms, skill marketplaces) into a single Electron + React dashboard.

This branch (`stargate-module`) is the active development line for all Stargate features. If you want to run, extend, or contribute to the AI workforce layer of Mosaic, you are in the right place.

---

## What You Can Do

### Start — Onboarding & Intent Discovery
Your entry point. Connect a Cardano wallet (Lace browser extension or Tokeo mobile via QR pairing), verify NFT holdings against allowed policy IDs, and resolve collection metadata. Stargate reads your compute profile and highlights achievable intents — whether you want to deploy agents, join a DAO fleet, or rent compute.

### Hire Agents — Fleet Marketplace
Browse AI agent templates from the marketplace. Each agent profile shows capabilities, compute requirements, and pricing tiers. One-click hire dispatches the agent to your fleet via the Hermes kanban orchestrator.

### AI Models — Live AIM Inventory
Inspect every AI model running on your local HyperCycle node: slot numbers, exposed ports, whitelist status, and resource usage. Direct integration with the Node Manager telemetry API.

### Rankings — Unified Leaderboard
Composite scoring across three sources:
- **Merkelizer** — on-chain uptime attestations
- **HyperInsight** — fleet-wide heartbeat + heartbeat-derived reliability scores
- **Local node** — CPU, memory, disk, and AIM slot gauges

Badges: Legendary / Epic / Rare / Common.

### Train Agents — Training Room Deployer
Book training slots on your own node or a fleet peer. Manage training jobs, monitor loss curves, and promote finished models into AIM slots. Integrates with the Ollama Cloud provider for GPU-less development machines.

### Bundles — Agent Packages
Curated agent bundles (collections of skills + models + configs) ready for one-click deployment. Browse, purchase, and install directly into your fleet.

### Skills — Skill Marketplace
Discover and install Hermes skills from the live REST API. Each skill exposes a set of tools (e.g. `stargate-node-telemetry`, `stargate-fleet-orchestrator`) that extend what your agents can do. "Attach to My Agent" wires skills into the existing `AgentSelectModal`.

### Compute & Nodes — Resource Allocation
- **Compute Tiers** — Bronze / Silver / Gold / Platinum pricing tiers with live specs
- **Node Registry** — Merge HyperInsight-discovered nodes with HyperAIBox H-Box pool nodes into one list
- **ANFE Ownership Verification** — On-chain `ownerOf` guard + HyperInsight fallback; dead RPCs are handled safely (see commit `1cd228b`)
- **Node Factory Tracker** — Live operations-center view of license keys, regions, uptime, and endpoint lists

### Dashboard — Telemetry & Orchestration
- Live node stats: CPU%, memory, disk, AIM slot utilization, Ollama model list
- Hermes Dashboard auto-spawn on "Open Kanban" click
- Fleet discovery via registry polling (no SSH between nodes)
- mDNS LAN discovery when running inside Electron

### Stargate Pool — ANFE Discovery & Management
Query the HyperCycle ANFE (Agent Node Function Endpoint) pool:
- Discover ANFEs by wallet via HyperInsight
- Verify on-chain ownership through `ANFEService` with null-safe guards
- Track H-Box pool allocations and availability

### Deploy System — IDE Agent Forge
The **Agent Forge Panel** inside the IDE page is a full code-as-agent builder. Write TypeScript, attach tools, test in a sandbox, and deploy directly to a fleet node. MCP AIM Service integration lets agents call external tools during development.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Mosaic Companion (Electron)         │
│  ┌─────────┐ ┌─────────┐ ┌───────────────┐  │
│  │  Start  │ │  Hire   │ │  AI Models    │  │
│  │  (NFT   │ │ Agents  │ │  (AIM Panel)  │  │
│  │ wallet) │ │         │ │               │  │
│  └────┬────┘ └────┬────┘ └───────┬───────┘  │
│       └─────────────┴──────────────┘          │
│                    │                          │
│  ┌─────────────────┼─────────────────────┐    │
│  │     AdaPortalPanel.tsx (4,200 LOC)  │    │
│  │  ── renders all tabs + services      │    │
│  └─────────────────┼─────────────────────┘    │
│                    │                          │
│  ┌─────────────────┼─────────────────────┐    │
│  │   src/services/stargate/              │    │
│  │   • LocalNodeBridge.ts              │    │
│  │   • EnhancedLocalNodeBridge.ts        │    │
│  │   • FleetDiscoveryService.ts          │    │
│  │   • UnifiedLeaderboardService.ts      │    │
│  │   • HermesAgentOrchestrator.ts        │    │
│  │   • TrainingRoomDeployer.ts           │    │
│  │   • AimifierService.ts + Adapters     │    │
│  └─────────────────┼─────────────────────┘    │
│                    │                          │
│  ┌─────────────────┼─────────────────────┐    │
│  │   src/services/StargatePool/          │    │
│  │   • ANFEService.ts (ownerOf guards)   │    │
│  │   • StargatePoolService.ts            │    │
│  │   • HBoxPoolService.ts                │    │
│  └─────────────────┼─────────────────────┘    │
│                    │                          │
│  ┌─────────────────┼─────────────────────┐    │
│  │   plugins/stargate-pool/               │    │
│  │   (renderer + main process bridge)    │    │
│  └─────────────────────────────────────────┘    │
│                    │                          │
└────────────────────┼──────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
 HyperCycle      HyperInsight     Hermes
 Node Manager    API              Kanban / gbrain
 (localhost)     (fleet data)     (agent dispatch)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Tailwind CSS + @mui/material |
| Desktop | Electron + Vite + Electron Forge |
| State | React hooks (useState/useEffect) + custom stores |
| Blockchain | Cardano CIP-30 (Lace, Tokeo) + HyperCycle contracts |
| Compute | HyperCycle Node Manager REST API, HyperAIBox H-Box pool |
| AI Runtime | Ollama (local + cloud provider), AIM modules |
| Agent Orchestration | Hermes kanban tasks, MCP tools, gbrain knowledge graph |
| Build | TypeScript 5.x, Vite dev server with `/api/*` proxy |

---

## Run Locally

**Prerequisites:** Node.js v20+, npm 10+

```bash
# Clone and enter branch
git clone https://github.com/hypercycle-development/mosaic-companion.git
cd mosaic-companion
git checkout stargate-module

# Install dependencies
./setup.sh
# OR manually: npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local — add GEMINI_API_KEY and any Ollama Cloud credentials

# Start development
npm run dev          # Vite dev server (browser)
npm run start        # Electron app via Forge
```

### Dev Mode vs Electron Mode

| Feature | Electron (production) | Browser dev (`npm run dev`) |
|---------|----------------------|----------------------------|
| Wallet connect | Full CIP-30 via `window.electronAPI.cardano` | Mock / degraded |
| Node telemetry | Live IPC to Node Manager | Fetch via `/api/*` proxy only |
| Fleet mDNS discovery | Works (LAN multicast) | Not available |
| Hermes Dashboard spawn | Auto-spawns on "Open Kanban" | Manual launch only |
| AIM panel | Full slot + port data | Same (REST works) |

---

## How to Contribute

### Branch Policy
- `stargate-module` — feature integration branch (this branch). All Stargate PRs target here first.
- `main` — stable release line. `stargate-module` merges to `main` on tagged releases.
- Feature branches: prefix with `feat/stargate-<name>` or `hyperinsight-feat/stage<X>`.

### Code Patterns
- **No Electron dependency degradation**: If a feature uses `window.electronAPI`, it must gracefully degrade in browser dev mode.
- **Vite-proxy compatible**: All local node fetches must use `/api/*` paths so the Vite proxy works.
- **No SSH between nodes**: Fleet orchestration uses registry polling and gateway messaging only.
- **Skill-driven**: Every major feature has a matching Hermes skill under `devops/` or `hypercycle/`.

### Where to Add Code

| What you're building | Drop files here |
|----------------------|-----------------|
| New Stargate tab / panel | `src/components/stargate/` |
| New service (node, fleet, AI) | `src/services/stargate/` |
| ANFE / pool logic | `src/services/StargatePool/` |
| Plugin (main+renderer bridge) | `plugins/stargate-pool/` |
| Documentation | `docs/stargate/` |

### Testing Your Change
```bash
npm run typecheck    # TS strict — zero errors required
npm run build        # Vite production build
npm run make:linux   # Or your platform — verifies Electron packaging
```

### Opening a PR
1. Branch from `stargate-module`: `git checkout -b feat/stargate-myfeature`
2. Commit with conventional prefixes: `feat(...)`, `fix(...)`, `docs(...)`, `refactor(...)`
3. Ensure `npm run typecheck` passes clean
4. Open PR against `hypercycle-development/mosaic-companion:stargate-module`
5. Link any related kanban task IDs in the PR body

---

## Key Commits to Know

| Commit | What it fixed / added |
|--------|----------------------|
| `1cd228b` | Boolean logic trap in ANFE ownership: `null && false` no longer bypasses the guard when public RPCs are dead |
| `a7373a5` | Trust HyperInsight `node.owner` over dead `ownerOf` RPCs |
| `63bb427` | Node Factory Tracker integrated into Start tab as Operations Center module |
| `a1dac85` | Train Agents bridged to Chat Rooms + Ollama Cloud provider added |
| `e518911` | Skills Marketplace panel wired into skills tab with live REST API |
| `476c063` | Hermes Dashboard auto-spawn on "Open Kanban" click |

---

## Resources

- [HyperCycle Node Manager Docs](https://docs.hypercycle.ai)
- [Hermes Agent Docs](https://hermes-agent.nousresearch.com/docs)
- [Mosaic Companion Issues](https://github.com/hypercycle-development/mosaic-companion/issues)
- Internal: `docs/stargate/integration-guide.md` — file-level integration steps for the improvement plan

---

## License

Same as parent repository (see root `LICENSE`).

---

*Built by the HyperCycle AI Systems team. Contributions welcome — agent-first, always.*
