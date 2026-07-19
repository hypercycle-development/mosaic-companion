---
name: axi-forge
title: AXI Tool Forge for Stargate
description: Build agent-native CLI tools (AXI), aimify them, and deploy through Stargate Pool
author: Mosaic Bot
version: 1.0.0
tags: [axi, agent-cli, stargate, hypercycle, tool-forge, aimify]
---

# AXI Tool Forge — Build and Deploy Agent-Native Tools

## What is AXI?

AXI (Agent eXperience Interface) is a design paradigm for building CLI tools that AI agents interact with efficiently. AXI tools are cheaper, faster, and more accurate than traditional CLIs or MCP servers for agent workflows.

## 10 AXI Principles

1. **Token-efficient output** — TOON tables instead of verbose JSON
2. **Minimal schemas** — 3-4 fields by default
3. **Content truncation** — `--full` escape hatch
4. **Pre-computed aggregates** — Eliminate round trips
5. **Definitive empty states** — "0 results" not silence
6. **Structured errors & exit codes** — No interactive prompts
7. **Ambient context** — Session hooks, not re-auth every call
8. **Content first** — No args = live data
9. **Contextual disclosure** — Next-step suggestions in output
10. **Consistent help** — Per-subcommand reference

## Pipeline: User Need → Tool → AIM → Deploy

```
User: "Build an AXI tool for X"
  ↓
Mosaic Bot (axi-forge skill) analyzes need
  ↓
Scaffolds TypeScript CLI with TOON output
  ↓
Builds, tests, validates against 10 principles
  ↓
Registers in AXI Catalog (SQLite)
  ↓
AIMify: wraps as HyperCycle AIM module
  ↓
Deploys via SPO to HyperAIBox nodes
  ↓
Monitors health and aggregates logs
```

## Production Tools Built

| Tool | Purpose | Location |
|------|---------|----------|
| hbox-axi | HyperAIBox fleet management | `axi-tools/hbox-axi/` |
| spo-axi | SPO orchestration | `axi-tools/spo-axi/` |
| aimify | AXI → AIM wrapper | `axi-tools/aimify/` |

## TOON Format

```typescript
// lib/toon.ts
export interface ToonTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}

export function toon(table: ToonTable): string {
  // Returns box-drawing ASCII table
  // Saves ~40% tokens vs JSON for same data
}
```

## Scaffolding a New Tool

```bash
# 1. Create directory structure
mkdir axi-tools/<name>-axi/src/{commands,lib}
cp axi-tools/hbox-axi/tsconfig.json axi-tools/<name>-axi/
cp axi-tools/hbox-axi/src/lib/toon.ts axi-tools/<name>-axi/src/lib/

# 2. Create commands/status.ts, commands/<op>.ts

# 3. Create index.ts CLI entry

# 4. Build and test
npm install && npx tsc
node dist/index.js              # Content-first test
node dist/index.js --help       # Help consistency
```

## Key Design Patterns

### Ambient Context
```typescript
// Never prompt for credentials
const sshKey = process.env.SSH_KEY || `${homedir()}/.ssh/id_ed25519`;
```

### Content-First Entry
```typescript
// No args = live data
if (args.length === 0) {
  await status({});  // Show fleet status immediately
  return;
}
```

### Auto-Heal on Restart
```typescript
const preRestart = [
  "rm -f /path/to/stale.pid",   // Remove stale PID first!
  "pkill -f 'old_process' || true",
];
```

### Contextual Disclosure
```typescript
footer: "→ Next: hbox-axi status --full for details"
```

## IPC Channels (Renderer ↔ Main)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `axi:catalog` | → Main | List all AXI tools |
| `axi:status` | → Main | Run hbox-axi status |
| `axi:spo-status` | → Main | Run spo-axi status |
| `axi:deploy` | → Main | Deploy AIM module |
| `axi:aimify` | → Main | Wrap tool as AIM |

## AXI Catalog UI

React component at `src/components/axi/AxiCatalogPanel.tsx`:
- Shows tool cards with status badges
- "Run" button per tool
- Command buttons (status, logs, deploy)
- TOON output panel

## References

- AXI: https://github.com/kunchenguid/axi
- TOON: https://toonformat.dev/
- gh-axi (reference): https://github.com/kunchenguid/gh-axi
- [`references/axi-integration-architecture.md`](references/axi-integration-architecture.md) — Full session blueprint
- [`references/hbox-axi-production-reference.md`](references/hbox-axi-production-reference.md) — Production-validated CLI details
- [`references/full-stack-wiring-checklist.md`](references/full-stack-wiring-checklist.md) — Verified 5-layer wiring recipe (CLI→IPC→main→preload→React tab), build-output paths, grep verification commands
- [`references/electron-forge-start-failure.md`](references/electron-forge-start-failure.md) — Diagnosing "Command failed: npm run build" inside Forge's generateAssets hook (esbuild vs tsc gap, spawn-options TS errors, runtime boot verification)
- [`references/forge-history-sqlite-store.md`](references/forge-history-sqlite-store.md) — Persistent forge-history store (axi.sqlite): schema, idempotent seeding, self-recording IPC handlers, and how to inspect Electron-native SQLite DBs from outside the app
- [`references/autonomy-loop-fleet-telemetry.md`](references/autonomy-loop-fleet-telemetry.md) — Closing the loop: bot runs its own AXI tools on an in-app 15-min cron, parses TOON output, records telemetry, injects live fleet + skill-consciousness into heartbeat prompts
- [`references/text-protocol-tool-loop.md`](references/text-protocol-tool-loop.md) — Provider-agnostic ReAct tool loop over a plain-text LLM caller (`TOOL: name {json}` protocol): works with ALL providers incl. those without native function calling; read-only-first safety rails, round caps, observation truncation

## Pitfalls

1. **Don't build human-centric TUI** — No ncurses, no menus. Agents parse stdout.
2. **Don't require interactive auth** — Use ambient context.
3. **Don't return raw objects** — Always serialize to TOON or minimal JSON.
4. **Don't forget --full** — Agents need escape hatch when default is truncated.
5. **Don't hardcode IPs** — Use config files or discovery.
6. **Zero runtime deps by default** — Don't add speculative npm packages (e.g. `node-ssh2` doesn't exist on the registry and broke `npm install`). Shell out to system `ssh`/`curl` via `execSync`/`spawn` and use built-in `fetch` (Node ≥18). Add a dep only when actually needed.
7. **Common TS strict-mode traps in scaffolds**: (a) shadowed variable names — declaring `const lines` twice in one function triggers TS7022/TS2448 self-reference errors; (b) optional args in closures — `args.node` inside `.filter((n) => ...)` loses narrowing; copy to a local (`const nodeFilter = args.node`) before using in the callback.
8. **Verify real endpoints before coding health checks** — SSH in and grep the actual server source (`grep 'do_GET' agent.py`) rather than guessing paths. HBA serves `/health` (not `/` or `/api/health`); Tiller serves `/list` returning `{"available":N,"tillers":[]}` (match on `"available"`, not `"slots"`).
9. **Trust `tsc` over stale LSP diagnostics** — after rewriting a file, the editor LSP may still report errors from the previous version. Run `npx tsc` for ground truth before "fixing" phantom errors.
10. **esbuild passing ≠ project builds** — `npm run build:electron` (esbuild) does NOT type-check, but Electron Forge's `generateAssets` hook runs `npm run build` = `tsc && vite build` (strict). Code that esbuild bundles fine can still crash `npm run start` with "Error: Command failed: npm run build". Always run `npx tsc` at the repo root as the final gate before declaring the wiring done.
11. **`spawn()` options are not `execSync()` options** — `{ encoding: "utf-8" }` is valid for `execSync` but a TS2769 error in `SpawnOptions`. With `spawn`, read `Buffer` chunks and `.toString("utf-8")` yourself, use `proc.stdout?.on(...)` (possibly-null under strict mode), and always attach `proc.on("error", ...)` so a missing binary resolves the promise instead of hanging it:
    ```typescript
    function runNodeScript(scriptArgs: string[]): Promise<AxiResult> {
      return new Promise((resolve) => {
        const proc = spawn("node", scriptArgs);
        let out = "";
        proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
        proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
        proc.on("error", (e) => resolve({ success: false, error: e.message, output: out }));
        proc.on("close", (code) => resolve({ success: code === 0, output: out }));
      });
    }
    ```
