---
name: axi-tool-forge
description: Teach Mosaic Bot to create AXI (Agent eXperience Interface) tools, aimify them as HyperCycle AIM modules, and deploy through Stargate Pool Orchestrator into HyperAIBox Node Factories.
version: 1.0.0
trigger: When user asks to build/create an AXI tool, forge a CLI, or deploy an agent-native tool through Stargate
---

# AXI Tool Forge

## What It Is

AXI (Agent eXperience Interface) is a design paradigm for building CLI tools that AI agents interact with efficiently. AXI tools use TOON (Tabular Output Optimized for Networks) format, are content-first (no args = live data), and include contextual disclosure (next-step hints in every output).

This skill teaches Mosaic Bot to scaffold, build, validate, aimify, and deploy AXI tools through the Stargate → Node Factory pipeline.

## The Pipeline

```
User Need → Analyze → Scaffold → Build → Test → Register → AIMify → Deploy → Monitor
```

## Step 1: Analyze Need (30s)

Determine:
- **Domain**: infra, github, browser, database, etc.
- **Operations**: What commands does the user need? (status, list, restart, logs, deploy)
- **Target**: Single resource or fleet-wide? (one box vs all boxes)
- **Frequency**: Daily, on-demand, or continuous?
- **Actors**: Agents, humans, or both?

## Step 2: Scaffold Tool (2-5min)

Generate TypeScript project:

```
<tool-name>-axi/
├── src/
│   ├── index.ts         # CLI entry with command router
│   ├── commands/        # One file per operation
│   │   ├── status.ts
│   │   ├── list.ts
│   │   └── ...
│   ├── lib/
│   │   ├── toon.ts      # TOON format serializer
│   │   ├── config.ts    # Target system config
│   │   └── errors.ts    # Structured error codes
│   └── types.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Step 3: Build with TOON

TOON (Tabular Output Optimized for Networks) replaces JSON for agent consumption:

```typescript
import { ToonTable, toon } from "./lib/toon.js";

const table: ToonTable = {
  title: "Fleet Status",
  headers: ["Name", "Status", "Metric"],
  rows: [
    ["c3po", "online", "38GB free"],
    ["r2d2", "online", "30GB free"],
  ],
  footer: "Next: status --full for details",
};

console.log(toon(table));
```

**Output:**
```
┌─ Fleet Status ─────────────────────────────┐
│ Name  │ Status │ Metric                      │
├──────────────────────────────────────────────┤
│ c3po  │ online │ 38GB free                   │
│ r2d2  │ online │ 30GB free                   │
├──────────────────────────────────────────────┤
│ Next: status --full for details              │
└──────────────────────────────────────────────┘
```

**Why TOON:** Saves ~40% tokens vs JSON. Agents parse tables naturally.

## Step 4: Validate Against 10 Principles

| Principle | Check |
|-----------|-------|
| Token-efficient | Uses TOON, not JSON |
| Minimal schemas | ≤ 4 fields per row |
| Content truncation | `--full` escape hatch |
| Pre-computed | Aggregates in default view |
| Definitive empty | "0 results" not silence |
| Structured errors | Exit codes 1-127 |
| Ambient context | Auth from env/files |
| Content first | No args = live data |
| Contextual disclosure | Next-step hint in footer |
| Consistent help | `--help` per subcommand |

## Step 5: Register in AXI Catalog

Insert into Mosaic Bot SQLite:

```sql
INSERT INTO axi_tools (id, name, domain, description, version, commands, source_path, status, created_at, updated_at)
VALUES (
  'hbox-axi',
  'HyperAIBox Manager',
  'infra',
  'Fleet management for HyperAIBox nodes',
  '1.0.0',
  '["status", "ssh", "logs", "restart", "deploy", "aimify"]',
  '/home/mauricio/mosaic-companion/axi-tools/hbox-axi',
  'built',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
```

## Step 6: AIMify (1-2min)

Wrap as HyperCycle AIM module:

```typescript
export function createAimManifest(tool: AxiTool): AimManifest {
  return {
    name: tool.name,
    version: tool.version,
    entrypoint: "dist/index.js",
    protocol: "axi-v1",
    endpoints: tool.commands.map((cmd) => ({
      path: `/api/v1/${cmd}`,
      method: "POST",
      description: `${cmd} operation`,
    })),
    resources: { cpu: "100m", memory: "128Mi" },
    telemetry: { heartbeat_interval: 30, metrics: ["requests", "errors", "latency"] },
  };
}
```

Build Docker image:
```bash
docker build -t localhost:5000/aim-<tool-name>:<version> .
docker push localhost:5000/aim-<tool-name>:<version>
```

## Step 7: Deploy via Stargate

```bash
# SPO schedules to available nodes
spo-axi deploy <aim-name> --scale 2

# Or directly via Node Manager
node-axi deploy --module <aim-name> --node c3po
```

## Step 8: Monitor

```bash
# Check all deployments
spo-axi boxes --aim-status

# Tail aggregated logs
spo-axi logs <aim-name> --follow

# Health check
<tool-name>-axi status --node c3po
```

## Reference Files

- `references/axi-integration-architecture.md` — Full architecture document
- `references/hbox-axi-implementation.md` — Complete hbox-axi implementation reference: endpoints, TOON patterns, restart-with-PID-cleanup, exit codes
- `templates/axi-cli-scaffold.ts` — Starter template for new AXI tools (TypeScript + TOON + content-first)
- `templates/hbox-axi/` — Scaffolded AXI tool for HyperAIBox fleet management
- `templates/spo-axi/` — Scaffolded AXI tool for Stargate Pool orchestration

## Pitfalls

1. **Don't build human-centric TUI** — No ncurses, no menus. Agents parse stdout.
2. **Don't require interactive auth** — Use ambient context (env vars, SSH keys).
3. **Don't return raw objects** — Always serialize to TOON or minimal JSON.
4. **Don't forget --full** — Agents need escape hatch when default is truncated.
5. **Don't hardcode IPs** — Use config files or discovery.

## Related Skills

- `hyperaibox-fleet-manager` — Fleet diagnostics and auto-healing
- `stargate-doctor` — Infrastructure health monitoring
- `mosaic-bot-orchestrator` — Multi-agent orchestration and heartbeat wiring
- `midnight-expert` — For AIM module smart contract integration
