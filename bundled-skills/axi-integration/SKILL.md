---
title: axi-integration
name: axi-integration
description: Build agent-native CLI tools using AXI (Agent eXperience Interface) design principles and integrate them with Stargate/HyperCycle ecosystems for deployment via Node Factories
version: 1.0.0
tags: [axi, agent-cli, stargate, hypercycle, tool-forge, aim-modules]
---

# AXI Integration — Build Agent-Native Tools for Stargate

## What This Skill Covers

Building **AXI-compliant CLI tools** — tools designed for AI agents to consume efficiently — and wiring them into the **Mosaic Bot → Stargate Pool → Node Factory** deployment pipeline.

## What is AXI?

AXI (Agent eXperience Interface) is a design philosophy for CLI tools that agents love:

1. **Token-efficient output** — TOON format instead of JSON
2. **Content-first** — No args = live data, not help text
3. **Minimal schemas** — 3-4 fields default
4. **Pre-computed aggregates** — Eliminate round trips
5. **Definitive empty states** — "0 results" not silence
6. **Structured errors** — Exit codes 1-127, no interactive prompts
7. **Ambient context** — SSH keys from env, not prompts
8. **Contextual disclosure** — Next-step hints in every output
9. **Consistent help** — Per-subcommand reference
10. **Content truncation** — `--full` escape hatch

## Workflow: User Need → Agent Tool → AIM Module → Deployed Service

```
┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ User Need   │───▶│ Scaffold │───▶│  Build   │───▶│ AIMify   │───▶│ Deploy   │
│             │    │          │    │          │    │          │    │          │
└─────────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │                  │              │              │              │
       │                  │              │              │              │
       ▼                  ▼              ▼              ▼              ▼
  "Check my         TypeScript       npm run build   Docker wrap    spo-axi
  fleet"            + TOON output    + test          + manifest     deploy
```

## Phase 1: Scaffold Tool

### Directory Structure

```
<tool-name>-axi/
├── src/
│   ├── index.ts         # CLI entry with command router
│   ├── commands/        # One file per operation
│   │   ├── status.ts    # Content-first: no args = live data
│   │   ├── list.ts
│   │   └── ...
│   ├── lib/
│   │   ├── toon.ts      # TOON serializer (~40% token savings)
│   │   ├── config.ts    # Target system config + ambient auth
│   │   └── errors.ts    # Structured exit codes
│   └── types.ts
├── package.json
├── tsconfig.json
└── README.md
```

### TOON Format Template

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
  lines.push(`┌─ ${table.title} ${"─".repeat(50)}┐`);
  // ... render table with box-drawing characters
  return lines.join("\n");
}

export function nextStep(hint: string): string {
  return `→ Next: ${hint}`;
}
```

### Command Template (Content-First)

```typescript
// commands/status.ts
export async function status(args: { full?: boolean }): Promise<void> {
  const data = await fetchData();

  console.log(toon({
    title: `${data.domain} Status`,
    headers: ["Name", "Status", "Metric"],
    rows: data.items.map((i) => [i.name, i.status, i.metric]),
    footer: args.full
      ? `Total: ${data.items.length}`
      : nextStep("status --full for details"),
  }));
}
```

## Phase 2: Build & Test

```bash
cd <tool-name>-axi
npm install
npx tsc --noEmit          # Type check
node dist/index.js        # Content-first test: should show live data
node dist/index.js --help # Help consistency check
```

**Validation Checklist:**
- [ ] No args shows live data (not help)
- [ ] Output is ≤ 10 lines by default
- [ ] Each line has ≤ 80 chars
- [ ] Footer suggests next step
- [ ] Errors have structured exit codes (1-127)
- [ ] No interactive prompts
- [ ] `--full` escape hatch works

## Phase 3: Register in AXI Catalog

Insert into Mosaic Bot SQLite:

```sql
INSERT INTO axi_tools (id, name, domain, description, version, commands, source_path, status, created_at, updated_at)
VALUES (
  'hbox-axi',
  'HyperAIBox Manager',
  'infra',
  'Fleet management for HyperAIBox nodes',
  '1.0.0',
  '["status", "ssh", "logs", "restart"]',
  '/home/mauricio/mosaic-companion/axi-tools/hbox-axi',
  'built',
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
```

## Phase 4: AIMify

Wrap as HyperCycle AIM module:

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
    resources: { cpu: "100m", memory: "128Mi" },
    telemetry: { heartbeat_interval: 30 },
  };
}
```

Build Docker image:
```bash
docker build -t localhost:5000/aim-<tool-name>:<version> .
docker push localhost:5000/aim-<tool-name>:<version>
```

## Phase 5: Deploy via Stargate

```bash
spo-axi deploy <module-id> --scale 2
spo-axi boxes              # Verify deployment
spo-axi logs <module-id>   # Check logs
```

## Pitfalls

### 1. Don't Build Human-Centric TUIs
No ncurses, no menus, no interactive prompts. Agents parse stdout. Use TOON tables.

### 2. Don't Require Interactive Auth
Use ambient context (env vars, SSH keys, config files). Never prompt for passwords.

### 3. Don't Return Raw Objects
Always serialize to TOON or minimal JSON. Agents can't parse `[object Object]`.

### 4. Don't Forget --full
When default output is truncated, always provide `--full` escape hatch.

### 5. Don't Hardcode IPs
Use config files or discovery. IPs change (especially C-3PO after reboot).

### 6. Don't Assume JSON Field Names
Verify actual API responses. Tiller returns `"available": 128` NOT `"slots": 128`.

## Related Skills

- `hyperaibox-fleet-manager` — HyperAIBox diagnostics and auto-healing
- `stargate-doctor` — Infrastructure health monitoring
- `github-pr-workflow` — When AXI tools need CI/CD

## Existing Tools in Catalog

| Tool | Domain | Status | Deployed |
|------|--------|--------|----------|
| `hbox-axi` | HyperAIBox fleet | ✅ Built | Local only |
| `spo-axi` | SPO orchestration | 🟡 Partial | Local only |

## Key Files

- `~/mosaic-companion/axi-tools/` — AXI tool source code
- `~/mosaic-companion/docs/AXI_INTEGRATION.md` — Full architecture blueprint
- `~/mosaic-companion/electron/integrations/mosaicbot/src/main/axi/` — IPC handlers and schema
