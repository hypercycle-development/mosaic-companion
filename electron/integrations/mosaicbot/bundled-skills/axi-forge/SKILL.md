---
title: axi-forge
version: 1.0.0
category: devops
skills:
  - axi-forge
  - hermes-agent
  - stargate-doctor
  - hyperaibox-fleet-manager
---

# AXI Forge — Build Agent-Native Tools for Stargate

## Trigger

Activate when user says ANY of:
- "Build an AXI tool for..."
- "Create agent-native CLI for..."
- "I need a tool that agents love for..."
- "AIMify this tool"
- "Deploy to Stargate"
- "Forge a tool"

## Overview

AXI (Agent eXperience Interface) is a design paradigm for building CLI tools
that AI agents interact with efficiently. AXI tools are:

1. **Token-efficient** — TOON output saves ~40% vs JSON
2. **Content-first** — No args = live data, not help text
3. **Pre-computed** — Aggregates eliminate round trips
4. **Context-aware** — Next-step suggestions in every output
5. **Structured** — Definitive errors, no interactive prompts

This skill teaches Mosaic Bot to scaffold, build, test, and deploy AXI tools
through the Stargate ecosystem.

## Workflow

```
User Need → Scaffold → Build → Test → Aimify → Deploy → Monitor
```

### Phase 1: Analyze Need (30s)

```typescript
interface ToolNeed {
  domain: string;        // "infra", "github", "browser", "database"
  operations: string[];  // ["status", "list", "restart", "logs"]
  target: string;        // "HyperAIBox fleet", "GitHub repos", "SQLite"
  frequency: string;     // "daily", "on-demand", "continuous"
  actors: string[];      // ["agent", "human"]
}
```

**Questions to ask (if unclear):**
- "What operations do you need most? (status, restart, logs, deploy)"
- "Is this for agents, humans, or both?"
- "Should it default to fleet-wide or single-node view?"

### Phase 2: Scaffold Tool (2-5min)

Generate TypeScript project with:

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

**TOON Format Template:**

```typescript
// lib/toon.ts
export interface ToonTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}

export function toon(table: ToonTable): string {
  const lines: string[] = [];
  lines.push(`┌─ ${table.title} ${"─".repeat(50 - table.title.length)}┐`);
  const header = "│ " + table.headers.map((h, i) =>
    h.padEnd(table.rows[0]?.[i]?.length || 10)
  ).join(" │ ") + " │";
  lines.push(header);
  lines.push("├" + "─".repeat(header.length - 2) + "┤");
  for (const row of table.rows) {
    lines.push("│ " + row.map((c, i) =>
      c.padEnd(table.headers[i]?.length || 10)
    ).join(" │ ") + " │");
  }
  if (table.footer) {
    lines.push("├" + "─".repeat(header.length - 2) + "┤");
    lines.push(`│ ${table.footer.padEnd(header.length - 3)}│`);
  }
  lines.push("└" + "─".repeat(header.length - 2) + "┘");
  return lines.join("\n");
}
```

**Command Template:**

```typescript
// commands/status.ts
import { ToonTable, toon } from "../lib/toon.js";

export async function status(args: { full?: boolean }): Promise<void> {
  const data = await fetchData(); // Replace with real API call

  const table: ToonTable = {
    title: `${data.domain} Status`,
    headers: ["Name", "Status", "Metric"],
    rows: data.items.map((i) => [i.name, i.status, i.metric]),
    footer: args.full
      ? `Total: ${data.items.length} | Last updated: ${data.timestamp}`
      : "Next: status --full for details",
  };

  console.log(toon(table));
}
```

### Phase 3: Build & Test (3-5min)

```bash
cd <tool-name>-axi
npm install
cd src && npx tsc --noEmit          # Type check
npx tsx src/index.ts status          # Content-first test
npx tsx src/index.ts status --full   # Full output test
npx tsx src/index.ts --help          # Help consistency check
```

**Validation Checklist:**
- [ ] No args shows live data (not help)
- [ ] Output is ≤ 10 lines by default
- [ ] Each line has ≤ 80 chars
- [ ] Footer suggests next step
- [ ] Errors have structured exit codes (1-127)
- [ ] No interactive prompts
- [ ] `--full` escape hatch works

### Phase 4: Register in AXI Catalog

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

### Phase 5: AIMify (1-2min)

Wrap AXI tool as HyperCycle AIM module:

```typescript
// aimify/wrapper.ts
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
    resources: {
      cpu: "100m",
      memory: "128Mi",
    },
    telemetry: {
      heartbeat_interval: 30,
      metrics: ["requests", "errors", "latency"],
    },
  };
}
```

Build Docker image:
```bash
docker build -t localhost:5000/aim-<tool-name>:<version> .
docker push localhost:5000/aim-<tool-name>:<version>
```

Register in aim_modules table:
```sql
INSERT INTO aim_modules (id, tool_id, name, version, manifest, docker_image, status, created_at, updated_at)
VALUES (
  'hbox-aim-v1.0',
  'hbox-axi',
  'HyperAIBox AIM',
  '1.0.0',
  '{...manifest_json...}',
  'localhost:5000/aim-hbox-axi:1.0.0',
  'built',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
```

### Phase 6: Deploy via Stargate

```bash
# SPO schedules AIM to available nodes
spo-axi deploy hbox-aim-v1.0 --scale 2

# Or directly via Node Manager
node-axi deploy --module hbox-aim-v1.0 --node c3po
node-axi deploy --module hbox-aim-v1.0 --node r2d2
```

Record deployment:
```sql
INSERT INTO axi_deployments (id, module_id, node_id, node_ip, status, deployed_at, created_at)
VALUES (
  'deploy-001',
  'hbox-aim-v1.0',
  'c3po',
  '192.168.0.150',
  'running',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
```

### Phase 7: Monitor

```bash
# Check all deployments
spo-axi boxes --aim-status

# Tail aggregated logs
spo-axi logs hbox-aim-v1.0 --follow

# Health check
hbox-axi status --node c3po
```

## Reference: AXI Principles in Action

| Principle | Example in hbox-axi |
|-----------|-------------------|
| Token-efficient | TOON tables instead of JSON |
| Minimal schemas | `name, status, metric` (3 cols) |
| Content truncation | `logs --tail 20` default, `--full` for all |
| Pre-computed | `status` includes counts + next-step hint |
| Definitive empty | "0 boxes online — check SPO status" |
| Structured errors | Exit code 10 = SSH failed, 20 = HBA down |
| Ambient context | SSH key from ~/.ssh/id_ed25519 |
| Content first | `hbox-axi status` = live fleet data |
| Contextual disclosure | Footer: "Next: hbox-axi status --full" |
| Consistent help | `hbox-axi status --help` = per-subcommand ref |

## Pitfalls

1. **Don't build human-centric TUI** — No ncurses, no menus. Agents parse stdout.
2. **Don't require interactive auth** — Use ambient context (env vars, SSH keys).
3. **Don't return raw objects** — Always serialize to TOON or minimal JSON.
4. **Don't forget --full** — Agents need escape hatch when default is truncated.
5. **Don't hardcode IPs** — Use config files or discovery (like hbox-axi does).

## Related Skills

- `hyperaibox-fleet-manager` — HyperAIBox diagnostics and auto-healing
- `stargate-doctor` — Infrastructure health monitoring
- `midnight-expert` — For AIM module smart contract integration
- `github-pr-workflow` — When AXI tools need CI/CD

## Examples

### Example 1: Build hbox-axi

User: "Build an AXI tool for managing my HyperAIBox fleet"

Bot response:
1. Analyzing need: domain=infra, ops=[status, ssh, logs, restart, deploy], target=HyperAIBox fleet
2. Scaffolding hbox-axi...
3. Building...
4. Testing content-first: `hbox-axi status` →
   ```
   ┌─ HyperAIBox Fleet Status ──────────────────┐
   │ Name  │ Status  │ Free Disk │ AIM Slots   │
   ├──────────────────────────────────────────────┤
   │ c3po  │ online  │ 38 GB     │ 8/128       │
   │ r2d2  │ online  │ 30 GB     │ 8/8         │
   ├──────────────────────────────────────────────┤
   │ Next: hbox-axi status --full for details    │
   └──────────────────────────────────────────────┘
   ```
5. Registering in AXI Catalog... ✅
6. Ready to aimify and deploy!

### Example 2: AIMify and Deploy

User: "Aimify hbox-axi and deploy to my fleet"

Bot response:
1. Generating AIM manifest for hbox-axi v1.0...
2. Building Docker image localhost:5000/aim-hbox-axi:1.0.0...
3. Pushing to C-3PO registry...
4. Deploying to c3po (192.168.0.150) via Node Manager...
5. Deploying to r2d2 (192.168.0.38) via Node Manager...
6. Recording deployments... ✅
7. SPO shows: hbox-aim-v1.0 | ✅ Running | 2 nodes

## Session Memory

When this skill is used, record in SQLite:
- axi_sessions: prompt, tool_id, module_id, status, duration_ms
- codebase-memory MCP: Index the generated tool source code

This enables the bot to learn from each forge session and improve scaffolding.
