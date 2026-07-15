# Mosaic Companion — Complete Ecosystem Analysis

> Generated: 2026-07-10 | Branch: `stargate-module` | Working Tree: `/home/mauricio/mosaic-companion`

---

## 1. Executive Summary

**Mosaic Companion** is a dual-runtime Electron application that serves as the command center for your **HyperCycle ecosystem**. It combines a React-based renderer UI with a Node.js/Electron main process that hosts the **Mosaic Bot** — an autonomous AI orchestrator managing node factories, Stargate pools, AIM modules, and a fleet of specialized skills.

**Key Identity**: Mosaic Bot is NOT Hermes Agent. It is a distinct autonomous entity built on Hermes infrastructure but focused on infrastructure management, AIM deployment, and fleet operations.

---

## 2. Architecture Overview

### Dual-Runtime Model

```
┌─────────────────────────────────────────────────────────────────┐
│                  MOSAIC COMPANION WINDOW                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   RENDERER PROCESS                        │  │
│  │  (React 19 + Vite + TypeScript + Tailwind CSS)            │  │
│  │                                                            │  │
│  │  • src/App.tsx — Main router                               │  │
│  │  • src/components/* — UI panels (Chat, Vault, Stargate)   │  │
│  │  • src/services/* — Business logic (AI, Stargate Pool)    │  │
│  │  • src/services/AIService.ts — Core AI orchestration      │  │
│  │                                                            │  │
│  └───────────────────↑ IPC ↓─────────────────────────────────┘  │
│                      Preload Script                             │
│  ┌───────────────────↓ IPC ↑───────────────────────────────────┐  │
│  │                    MAIN PROCESS                             │  │
│  │  (Electron + Node.js + SQLite + MCP Servers)               │  │
│  │                                                            │  │
│  │  • electron/main.ts — Entry point, window mgmt            │  │
│  │  • electron/integrations/mosaicbot/ — Mosaic Bot Core     │  │
│  │  • electron/integrations/mcp/ — MCP client/servers        │  │
│  │  • electron/integrations/vault/ — SQLite vault storage    │  │
│  │  • electron/integrations/chat/ — Hermes agent bridge      │  │
│  │  • electron/integrations/pool/ — Stargate Pool Orchestrator │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Bridge**: The preload script (`electron/preload.ts`) exposes APIs to the renderer. If preload is outdated, the UI cannot talk to the backend.

---

## 3. Your HyperCycle Fleet

### Live Node Status (as of latest telemetry)

| Node | IP | Status | Arch | Role | Notes |
|------|-----|--------|------|------|-------|
| **C-3PO** | 192.168.0.150 | 🟢 Online | ARM64 (RK3588) | Primary HyperAIBox | Tiller :9000, HBA :8100, Node Manager :8006 |
| **R2-D2** | 192.168.0.38 | 🟢 Online | ARM64 (RK3588) | Secondary HyperAIBox | Tiller :9001, HBA :8100 |
| **SPO** | 192.168.0.112:9100 | 🔴 DOWN | — | Stargate Pool Orchestrator | Blocks HBA registration; pool ops blocked |
| **AtomMan** | (local x86_64) | 🟢 Online | x86_64 | Orchestrator host | Runs Mosaic Companion |

**C-3PO IP Behavior**: DHCP lease can change on reboot (.151 → .150 observed). The bot knows to scan subnet `.100-.160` after reboots.

**Known Issues**:
- SPO is down → HBA heartbeats fail (expected behavior)
- C-3PO HBA had zombie process (pid existed, not listening) → fixed by removing stale PID file
- Tiller endpoint is `/list`, not `/health`

---

## 4. Directory Structure

### Source Code Layout

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/` | **Renderer Process** (React UI) | `App.tsx`, `components/*`, `services/*` |
| `electron/` | **Main Process** (Node/Electron backend) | `main.ts`, `preload.ts`, `integrations/*` |
| `electron/integrations/mosaicbot/` | **Mosaic Bot Core** | `src/main/index.ts`, `src/main/orchestrator.ts` |
| `electron/integrations/mosaicbot/bundled-skills/` | **Bot Skills** | `stargate-doctor/`, `mosaic-orchestrator/`, `auto-skill-importer/` |
| `electron/integrations/mcp/` | **MCP Servers** | Native + custom MCPs (stargate, hypercycle, codebase-memory) |
| `electron/integrations/pool/` | **Stargate Pool Orchestrator** | `SPOServer.ts`, `TillingProvisioner.ts` |
| `electron/integrations/vault/` | **Vault Storage** | SQLite-backed knowledge boxes |
| `electron/integrations/chat/` | **Chat Agent Bridge** | Connects to Hermes Agent for AI chat |
| `src/services/StargatePool/` | **Stargate Pool UI Services** | `StargatePoolService.ts`, `ANFEService.ts`, `WalletAdapter.ts` |
| `src/services/stargate/` | **Stargate Integrations** | `AimifierService.ts`, `EnhancedLocalNodeBridge.ts` |
| `axi-tools/` | **AXI CLI Tools** | `hbox-axi/`, `spo-axi/`, `aimify/` |
| `docs/` | **Documentation** | `AI_AGENCY_ARCHITECTURE.md`, `HBOX-MASTERY.md`, `AXI_INTEGRATION.md` |
| `scripts/` | **Utility Scripts** | `ai-chat-health-check.sh`, `hermes-to-mosaic-converter.py` |
| `tests/` | **Test Suite** | `e2e/validator-telemetry.test.ts` |

---

## 5. Mosaic Bot Subsystem

### Three-Agent Architecture

| Agent | Schedule | Focus | System Prompt |
|-------|----------|-------|---------------|
| **main** | Every 30 min | Orchestrator (vault + MCP + infrastructure) | "You are the Mosaic Orchestrator..." |
| **coder** | Every 60 min | Code review, PRs, tests | "You are the Code Review Agent..." |
| **local** | Every 15 min | Lightweight checks (qwen2.5) | "You are the Local Agent..." |

### Key Capabilities

1. **Vault Monitoring**: Reads all vault boxes, detects changes
2. **Infrastructure Pings**: SPO, C-3PO HBA, R2-D2 HBA, Tiller ports
3. **Auto-Skill Importer**: Watches `~/.hermes/skills/`, auto-imports Tier 1 skills
4. **Fleet Telemetry**: 15-minute snapshots to `axi.sqlite`
5. **Auto-Healing**: Detects zombie HBA processes, attempts restart
6. **Pattern Detection**: Proposes new skills when repeated patterns found

### IPC Commands (Renderer → Main)

```typescript
// Orchestrator
ipcRenderer.invoke("orchestrator:status")       // { vaultBoxes, mcpServers, agents, infraHealth }
ipcRenderer.invoke("heartbeat:trigger", "main") // Manual heartbeat

// Skills
ipcRenderer.invoke("skills:pending")            // Skills awaiting approval
ipcRenderer.invoke("skills:approve", name)      // Approve a Tier 2 skill
ipcRenderer.invoke("skills:force-scan")         // Trigger immediate scan

// HyperAIBox
ipcRenderer.invoke("hbox:check-fleet")          // Full fleet status
ipcRenderer.invoke("hbox:discover")             // Scan subnet
ipcRenderer.invoke("hbox:auto-heal")              // Attempt fixes

// AXI Forge
ipcRenderer.invoke("axi:catalog")               // List AXI tools
ipcRenderer.invoke("axi:forge", description)    // Create new AXI tool
```

---

## 6. Skill System

### Skill Counts (from SOUL.md)

| Category | Count | Description |
|----------|-------|-------------|
| AI Agency | 5 | Bundle creator, marketplace analyzer, IDE integrator, architect |
| Stargate | 4+ | Operations, debug, mastery, registry |
| HyperCycle | 2 | Node manager, aimifier |
| Midnight | 107 | Blockchain, smart contracts |
| Blockchain | 21 | Cardano, Aiken, node ops |
| MCP | 8 | Codebase memory, native, etc. |
| DevOps | 14 | k8s, docker, infrastructure |
| Software Dev | 20 | Coding, debugging, testing |
| Automation | 9 | Agent orchestration |
| Creative | 21 | ASCII art, diagrams, design |
| + Others | 62 | Media, productivity, research |
| **TOTAL** | **283+** | |

### Auto-Import Tiers

**Tier 1 (Auto-Import, No Approval)**:
- `mosaic-stargate`, `kanban-orchestrator`, `github-code-review`
- `codebase-memory-mcp`, `incremental-implementation`
- `test-driven-development`, `eight-phase-debugging`
- `stargate-doctor`, `mosaic-orchestrator`

**Tier 2 (Pending Approval)**:
- All other skills detected in `~/.hermes/skills/`

---

## 7. Stargate Pool & ANFE

### Components

| Component | Service File | Purpose |
|-----------|-------------|---------|
| **StargatePoolService** | `src/services/StargatePool/StargatePoolService.ts` | Main pool orchestration |
| **ANFEService** | `src/services/StargatePool/ANFEService.ts` | ANFE (Agent Node Factory Exchange) operations |
| **HBoxPoolService** | `src/services/StargatePool/HBoxPoolService.ts` | HyperAIBox-specific pool logic |
| **WalletAdapter** | `src/services/StargatePool/WalletAdapter.ts` | Cardano wallet integration |
| **RPCResilience** | `src/services/StargatePool/RPCResilience.ts` | Circuit breaker for RPC calls |
| **AlchemyKeyManager** | `src/services/StargatePool/AlchemyKeyManager.ts` | API key rotation |

### ANFE Key Concepts
- **ANFE Pool**: Agent Node Factory Exchange where compute resources are traded
- **AIM Modules**: HyperCycle AI Module packages deployed to nodes
- **Tiller**: Service managing AIM slots on each HyperAIBox
- **HBA**: HyperAIBox Agent — registers boxes with SPO
- **SPO**: Stargate Pool Orchestrator — coordinates pool operations

---

## 8. AXI Integration (Tool Forge)

### Pipeline

```
User Need → Mosaic Bot (axi-forge skill) → AXI Tool → AIMify → SPO Deploy → Node Factory
```

### AXI Tools Directory (`axi-tools/`)

| Tool | Package | Purpose |
|------|---------|---------|
| `hbox-axi` | `axi-tools/hbox-axi/` | Fleet management (status, ssh, logs, restart) |
| `spo-axi` | `axi-tools/spo-axi/` | Pool orchestrator CLI |
| `aimify` | `axi-tools/aimify/` | Wrap AXI tools as AIM modules |

### Key Commands

```bash
# Fleet management
hbox-axi status                    # Fleet overview (TOON format)
hbox-axi ssh c3po                  # Interactive SSH
hbox-axi logs r2d2 --service hba   # Tail HBA logs
hbox-axi restart hba c3po          # Restart HBA remotely

# Pool operations
spo-axi boxes                      # All registered nodes
spo-axi deploy <aim> --scale 3     # Deploy to 3 nodes
spo-axi status                     # SPO + pool health
```

---

## 9. Build System & Development

### Scripts (from package.json)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (renderer only) |
| `npm run build:electron` | Build Electron main process |
| `npm run build:renderer` | Build React renderer |
| `npm run build` | Full build (tsc + vite) |
| `npm run start` | Electron Forge start |
| `npm run make:linux` | Build Linux package |
| `npm run typecheck` | TypeScript check only |
| `npm run health:check` | Run health doctor |
| `npm run test:e2e` | Playwright tests |

### Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Dev mode (renderer hot reload)
npm run dev

# 3. Build for production
npm run build:electron
npm run build:renderer

# 4. Package for Linux
npm run make:linux

# 5. Full test
npm run typecheck
npm run test:e2e
```

---

## 10. Setup Requirements

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** (for AIM module building)
- **SSH key** (`~/.ssh/id_ed25519`) for HyperAIBox access
- **Hermes Agent** installed (for AI chat backend)
- **Cardano wallet** (for Stargate pool interactions)

### Environment Files

| File | Purpose |
|------|---------|
| `~/.hermes/config.yaml` | Hermes configuration |
| `~/.hermes/.env` | API keys (secrets only) |
| `~/.config/mosaic-companion/` | Mosaic Companion app data |
| `~/.config/mosaic-companion/ai-agents.json` | Active AI agent configs |
| `~/.config/mosaic-companion/vault.json` | Vault boxes |
| `~/.config/mosaic-companion/mcp-plugins.json` | MCP server registry |

### First-Time Setup

```bash
# 1. Clone and checkout branch
cd /home/mauricio/mosaic-companion
git checkout stargate-module

# 2. Install dependencies
npm install

# 3. Verify build
npm run typecheck
npm run build:electron

# 4. Start the app
npm run start

# 5. In DevTools console, verify:
#    [MosaicBot] 4 skills loaded
#    [MosaicBot] Skill importer started
#    [Heartbeat] main @ 2026-...
```

---

## 11. Critical Files Reference

### Must-Know Files

| File | Lines | Purpose |
|------|-------|---------|
| `electron/main.ts` | ~2,290 | Electron entry point, window management, IPC handlers |
| `electron/preload.ts` | ~530 | IPC bridge — exposes APIs to renderer |
| `src/services/AIService.ts` | ~1,200 | Core AI orchestration in renderer |
| `electron/integrations/mosaicbot/src/main/index.ts` | ~668 | Mosaic Bot main entry, agent profiles |
| `electron/integrations/mosaicbot/src/main/orchestrator.ts` | ~450 | Heartbeat orchestrator with infra checks |
| `electron/integrations/mosaicbot/src/main/hbox-manager.ts` | ~300 | Fleet health, auto-healing |
| `electron/integrations/mosaicbot/src/main/skill-importer.ts` | ~280 | Auto-imports Hermes skills |
| `src/services/StargatePool/StargatePoolService.ts` | ~900 | Pool operations, contract interactions |
| `src/services/StargatePool/ANFEService.ts` | ~600 | ANFE marketplace operations |
| `src/services/stargate/AimifierService.ts` | ~400 | AIM module building |

---

## 12. Working Notes & Tips

### For Daily Operations

1. **Restart the app fully** (quit + reopen, not just close window) when preload or main-process code changes.

2. **Check fleet status** via console:
   ```typescript
   await window.electronAPI.hbox.checkFleet()
   ```

3. **Skill approval workflow**:
   - Drop SKILL.md into `~/.hermes/skills/<category>/<name>/`
   - Bot detects within seconds (or 5-min poll fallback)
   - Tier 1: auto-imported | Tier 2: appears in Importer tab

4. **SPO is expected to be down** during initial setup. HBAs will show heartbeat failures — this is normal, not a bug.

5. **C-3PO IP changes after reboot**. Always scan `.100-.160` if C-3PO seems offline.

### For Development

- **Renderer changes**: Hot-reload via `npm run dev`
- **Main process changes**: Requires full restart (`Ctrl+C`, `npm run start`)
- **Preload changes**: Requires full restart
- **Skill changes**: Restart to reload bundled skills

### For Debugging

1. **DevTools** (Ctrl+Shift+I): Check `[MosaicBot]`, `[Heartbeat]`, `[SkillImporter]` logs
2. **Main process logs**: Check `~/.config/mosaic-companion/logs/`
3. **Vault state**: Inspect `~/.config/mosaic-companion/vault.json`
4. **Hermes bridge**: Check `~/.hermes/logs/agent.log`

---

## 13. Integration Points

### External Services Connected

| Service | Integration | Status |
|---------|-------------|--------|
| **Hermes Agent** | Chat bridge, skill source | ✅ Active |
| **Node Manager** | `localhost:8006` (C-3PO) | ✅ Responding |
| **SPO** | `192.168.0.112:9100` | 🔴 Down |
| **C-3PO HBA** | `192.168.0.150:8100` | ✅ Healthy |
| **R2-D2 HBA** | `192.168.0.38:8100` | ✅ Healthy |
| **Cardano Node** | `192.168.0.150:3001` | ✅ Running |
| **Midnight Wallet** | CLI + MCP | ✅ Integrated |
| **HyperInsight** | Plugin IPC | ✅ Active |
| **Atomic Mail** | MCP server | ✅ Integrated |
| **Krea** | Image generation | ✅ Active |

---

## 14. Next Steps for Full Setup

### Immediate

- [ ] Verify SPO deployment (or create local mock)
- [ ] Add DHCP reservation for C-3PO (fix IP permanently)
- [ ] Test end-to-end skill import from Hermes
- [ ] Verify AIM module build pipeline

### Short-term

- [ ] Deploy AXI tools to fleet (`hbox-axi`, `spo-axi`)
- [ ] Create custom skill bundle for your node factory
- [ ] Set up kanban ops board for auto-escalation
- [ ] Integrate Midnight City monitoring

### Long-term

- [ ] Build custom AIM modules for your use cases
- [ ] Scale to additional HyperAIBox nodes
- [ ] Implement AI Agency pattern with dedicated agents
- [ ] Marketplace skill publishing

---

*This analysis is current as of 2026-07-10. The ecosystem evolves rapidly — check `docs/` for the latest architecture docs.*
