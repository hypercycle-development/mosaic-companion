# ─────────────────────────────────────────────────────────────────────────────
# AXI INTEGRATION ARCHITECTURE
# Document ID: axi-integration-v1
# Project: mosaic-companion
# Purpose: Blueprint for integrating AXI (Agent eXperience Interface) into
#          Mosaic Bot → Stargate Pool → HyperAIBox Node Factories
# ─────────────────────────────────────────────────────────────────────────────

## 1. VISION

Mosaic Bot becomes an AXI Tool Forge that creates agent-native CLI tools.
These tools are then aimified (wrapped as HyperCycle AIM modules) and deployed
through Stargate Pool Orchestrator (SPO) into HyperAIBox Node Factories.

Pipeline:
  User Need → Mosaic Bot (axi-forge skill) → AXI Tool → AIMify → SPO Deploy → Node Factory

## 2. DESIGN PRINCIPLES (AXI + Mosaic Specific)

| Principle | AXI Standard | Mosaic Extension |
|-----------|-------------|------------------|
| Token-efficient output | TOON format | + Aggregated telemetry in 1 call |
| Minimal schemas | 3-4 fields | + Status badge (online/offline/pending) |
| Content truncation | --full escape | + "Last N lines" shorthand |
| Pre-computed aggregates | Counts, summaries | + Fleet-wide rollup |
| Definitive empty states | "0 results" | + "No nodes in pool" with CTA |
| Structured errors | Exit codes | + Auto-heal suggestions |
| Ambient context | Session hooks | + Node Manager auth caching |
| Content first | No args = live data | + Default to "my fleet" |
| Contextual disclosure | Next-step hints | + "Deploy to Stargate?" prompt |
| Consistent help | Per-subcommand | + /help skill integration |

## 3. ARCHITECTURE TREE

```
mosaic-companion/
├── axi-tools/                              # AXI CLI tools (npm packages)
│   ├── hbox-axi/                          # HyperAIBox fleet management
│   │   ├── src/
│   │   │   ├── index.ts                   # CLI entry, command router
│   │   │   ├── commands/
│   │   │   │   ├── status.ts              # Fleet status with TOON output
│   │   │   │   ├── ssh.ts               # SSH wrapper with ambient auth
│   │   │   │   ├── logs.ts              # Remote log tailing
│   │   │   │   ├── restart.ts           # Service restart (HBA, tiller, etc)
│   │   │   │   ├── deploy.ts            # Deploy AIM to box
│   │   │   │   └── aimify.ts            # Convert tool → AIM module
│   │   │   ├── lib/
│   │   │   │   ├── ssh.ts               # SSH connection manager
│   │   │   │   ├── toon.ts              # TOON format serializer
│   │   │   │   ├── config.ts            # Fleet registry (C-3PO, R2D2, etc)
│   │   │   │   └── telemetry.ts         # Aggregate health data
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── spo-axi/                           # Stargate Pool Orchestrator CLI
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/
│   │   │   │   ├── boxes.ts             # List registered boxes
│   │   │   │   ├── deploy.ts            # Deploy AIM to fleet
│   │   │   │   ├── aimify.ts            # Package AXI tool as AIM
│   │   │   │   ├── scale.ts             # Scale AIM instances
│   │   │   │   ├── logs.ts              # Aggregate logs from fleet
│   │   │   │   ├── status.ts            # SPO health + pool summary
│   │   │   │   └── drain.ts             # Graceful node drain
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── aimify/                             # AIMification wrapper
│       ├── src/
│       │   ├── index.ts
│       │   ├── wrapper.ts               # Wraps AXI tool in AIM protocol
│       │   ├── manifest.ts              # AIM module manifest generator
│       │   └── registry.ts              # AIM catalog (local + remote)
│       └── package.json
├── electron/integrations/mosaicbot/
│   ├── bundled-skills/
│   │   └── axi-forge/
│   │       └── SKILL.md                   # Mosaic Bot skill for building AXIs
│   ├── src/main/
│   │   ├── axi/
│   │   │   ├── catalog.ts               # AXI Tool Catalog (in-memory + DB)
│   │   │   ├── forge.ts                 # Tool scaffolding engine
│   │   │   ├── aimify.ts                # AIMification orchestration
│   │   │   └── schema.sql               # SQLite schema additions for AXI
│   │   ├── memory/
│   │   │   └── schema.ts                # Extended: axi_tools table
│   │   └── index.ts                     # IPC handlers for axi:* commands
│   └── src/preload.ts                   # Expose axi API to renderer
├── src/components/
│   └── stargate/
│       └── AxiCatalog.tsx               # UI: Browse + deploy AXI tools
└── docs/
    └── axi-integration.md                 # Full integration guide
```

## 4. MEMORY STRUCTURE (Codebase Memory + SQLite)

### 4.1 Codebase Memory MCP (Persistent Knowledge Graph)
Nodes indexed per project:
  - Project: "mosaic-companion-axi"
  - Nodes: axi_tools, aim_modules, stargate_deployments, fleet_nodes
  - Edges: BUILDS → (tool → aim), DEPLOYS → (aim → node), MANAGES → (spo → box)

### 4.2 Mosaic Bot SQLite (Runtime Session Memory)
New tables added to schema.ts:
  - `axi_tools`: id, name, domain, commands[], aimified, deployed_nodes[]
  - `aim_modules`: id, name, source_tool, version, status, deployed_nodes[]
  - `axi_deployments`: id, tool_id, node_id, deployed_at, status
  - `axi_sessions`: id, prompt, tool_created, aim_generated, deployed, timestamp

## 5. DATA FLOW

```
User: "Build an AXI tool for monitoring disk usage"
  │
  ▼
Mosaic Bot (axi-forge skill)
  ├── 1. Analyze need → domain = "infra", ops = ["status", "alerts", "report"]
  ├── 2. Scaffold TypeScript CLI with TOON output
  ├── 3. Add to axi_tools table in SQLite
  ├── 4. Add to AXI Catalog (UI)
  │
  ▼
User: "Aimify this and deploy to Stargate"
  │
  ▼
Mosaic Bot (aimify engine)
  ├── 1. Generate AIM manifest (aim_modules table)
  ├── 2. Build Docker wrapper (wrapper.ts)
  ├── 3. Push to Node Manager registry
  ├── 4. SPO schedules to available nodes
  ├── 5. Record deployment in axi_deployments table
  │
  ▼
Stargate Pool Dashboard
  ├── Shows: hbox-axi v1.0 | ✅ Aimified | 2 nodes deployed
  ├── Live telemetry: heartbeats, slot usage, errors
  └── Actions: scale, update, rollback, drain
```

## 6. KEY COMMANDS

### hbox-axi
```bash
hbox-axi status                    # Fleet overview (TOON)
hbox-axi status --full             # Full per-box breakdown
hbox-axi ssh c3po                  # Interactive SSH
hbox-axi logs r2d2 --service hba  # Tail HBA logs
hbox-axi restart hba c3po          # Restart HBA remotely
hbox-axi deploy aim <module>       # Deploy AIM to box
hbox-axi aimify <tool-path>        # Convert local tool → AIM
```

### spo-axi
```bash
spo-axi boxes                      # All registered nodes
spo-axi deploy <aim> --scale 3    # Deploy to 3 nodes
spo-axi aimify <tool-name>        # Package from catalog
spo-axi scale <aim> 5             # Scale to 5 instances
spo-axi logs <aim>                # Aggregate logs
spo-axi status                    # SPO + pool health
spo-axi drain <node>              # Graceful removal
```

## 7. UI INTEGRATION (Mosaic Bot Panel)

New tab: "AXI Forge"
  ┌─ AXI Tool Catalog ───────────────────────────────┐
  │ hbox-axi │ v1.2 │ ✅ Aimified │ 2 nodes │ Scale │
  │ spo-axi  │ v0.9 │ ⏳ Local    │ 1 node  │ Aimify│
  │ node-axi │ v1.0 │ ✅ Aimified │ 2 nodes │ Scale │
  ├─ Create New AXI Tool ───────────────────────────┤
  │ [Describe what you need... ] [Forge Tool]      │
  ├─ Recent Sessions ────────────────────────────────┤
  │ Session #1: Built hbox-axi → aimified → deployed│
  │ Session #2: Fixed C-3PO HBA via axi-forge      │
  └──────────────────────────────────────────────────┘

## 8. INTEGRATION CHECKLIST

- [ ] Install AXI skill (npx skills add kunchenguid/axi)
- [ ] Create axi-forge bundled-skill
- [ ] Scaffold hbox-axi
- [ ] Scaffold spo-axi
- [ ] Build aimify wrapper
- [ ] Add axi_tools table to SQLite schema
- [ ] Add AIM module tables to SQLite schema
- [ ] Add deployment tracking tables
- [ ] Create IPC handlers (axi:*)
- [ ] Build AXI Catalog UI component
- [ ] Wire into Stargate Pool Dashboard
- [ ] Index all artifacts into codebase-memory MCP
- [ ] Document in vault (AXI_INTEGRATION.md)

## 9. SUCCESS METRICS

- Tool creation time: < 2 minutes from prompt to scaffolded CLI
- AIMification time: < 1 minute from CLI to deployable module
- Token savings: 40%+ vs raw CLI, 20%+ vs MCP
- Success rate: 100% on known operations (per AXI benchmarks)
- Fleet coverage: All HyperAIBox nodes discoverable via hbox-axi

## 10. REFERENCES

- AXI: https://github.com/kunchenguid/axi (10 principles)
- gh-axi: https://github.com/kunchenguid/gh-axi (reference impl)
- TOON: https://toonformat.dev/ (token-efficient output)
- HyperCycle AIM: See midnight-expert/compact-core/compact-patterns
- Node Manager: See hyperaibox-fleet-manager skill
- SPO: See stargate-registry.ts (infra components)

Document created: 2026-07-01
Version: 1.0.0
Owner: Mosaic Bot AXI Forge Team
