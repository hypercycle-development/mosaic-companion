---
name: axi-executor
description: Execute AXI (Agent eXperience Interface) CLI tools from within Hermes Agent. Parse TOON output, handle structured errors, and chain AXI commands for complex workflows.
version: 1.0.0
trigger: When running hbox-axi, spo-axi, aimify, or any AXI tool; when TOON output needs parsing
---

# AXI Executor Skill

## What It Does

AXI tools (hbox-axi, spo-axi, aimify, etc.) output TOON (Tabular Output Optimized for Networks) format. This skill enables:
- **Execute AXI commands** — Run any AXI tool from Hermes
- **Parse TOON tables** — Convert box-drawing output to structured data
- **Chain commands** — Build workflows (status → logs → restart)
- **Handle exit codes** — Structured error handling
- **Auto-discovery** — Find available AXI tools in PATH

## Available AXI Tools

| Tool | Domain | Commands |
|------|--------|----------|
| hbox-axi | HyperAIBox fleet | status, ssh, logs, restart, deploy |
| spo-axi | Stargate Pool | boxes, tenants, deploy, logs |
| aimify | AIM packaging | build, push, register |
| codenav-axi | Codebase nav | index, find, imports, patterns |

## TOON Parser

TOON format uses box-drawing characters:

```
┌─ Fleet Status ─────────────────────────────┐
│ Name  │ Status │ Metric                      │
├──────────────────────────────────────────────┤
│ c3po  │ online │ 38GB free                   │
└──────────────────────────────────────────────┘
```

Parse rules:
1. First line after `┌─` = table title
2. Third line = headers (split on `│`)
4. Data rows = content between `├─` and `├─` or `└─`
5. Footer = last row before `└─` if contains "Next:" or similar

### Parser Implementation

```typescript
interface ToonTable {
  title: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}

function parseToon(output: string): ToonTable {
  const lines = output.split('\n').filter(l => l.includes('│'));
  const title = output.match(/┌─ (.+) ─/)?.[1] ?? 'Unknown';
  
  // Headers from first content row
  const headerLine = lines.find(l => !l.includes('├') && !l.includes('└'));
  const headers = headerLine?.split('│').slice(1, -1).map(h => h.trim()) ?? [];
  
  // Data rows
  const rows = lines
    .filter(l => !l.includes('├') && !l.includes('└') && !l.includes('┌'))
    .map(l => l.split('│').slice(1, -1).map(c => c.trim()));
  
  return { title, headers, rows };
}
```

## MCP Tool: axi_execute

**Input**:
```json
{
  "tool": "hbox-axi",
  "command": "status",
  "args": ["--node", "c3po"],
  "workingDir": "/opt/tools",
  "timeoutSeconds": 30
}
```

**Output**:
```json
{
  "exitCode": 0,
  "toon": {
    "title": "C-3PO Status",
    "headers": ["Service", "Status", "Details"],
    "rows": [
      ["HBA", "✓", "listening on :8100"],
      ["Tiller", "✓", "8 slots available"]
    ]
  },
  "raw": "...",
  "error": null
}
```

## MCP Tool: axi_chain

Chain multiple AXI commands:

**Input**:
```json
{
  "steps": [
    { "tool": "hbox-axi", "command": "status", "capture": "status" },
    { "tool": "hbox-axi", "command": "logs", "args": ["--service", "hba"], "if": "status.rows[0][1] !== '✓'" },
    { "tool": "hbox-axi", "command": "restart", "args": ["hba"], "if": "logs.contains('error')" }
  ]
}
```

## Exit Code Handling

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | General error | Report and stop |
| 10 | SSH failed | Check network, retry |
| 20 | Service restart failed | Check logs, escalate |
| 30 | Tiller not responding | Alert infrastructure |

## Auto-Discovery

Scan PATH for AXI tools:

```typescript
const axiTools = await discoverAxiTools();
// Returns: [{ name: 'hbox-axi', path: '/usr/local/bin/hbox-axi', version: '1.2.0' }]
```

## Common Workflows

### Workflow 1: Fleet Health Check

```typescript
const result = await axiExecute({
  tool: 'hbox-axi',
  command: 'status'
});

if (result.exitCode === 0) {
  const offline = result.toon.rows.filter(r => r[1] !== '✓');
  if (offline.length > 0) {
    await axiExecute({ tool: 'hbox-axi', command: 'logs', args: ['--node', offline[0][0]] });
  }
}
```

### Workflow 2: AIM Deployment

```typescript
// Build → Push → Deploy chain
await axiChain([
  { tool: 'aimify', command: 'build', args: ['.'] },
  { tool: 'aimify', command: 'push', args: ['--tag', 'latest'] },
  { tool: 'spo-axi', command: 'deploy', args: ['my-aim', '--scale', '2'] }
]);
```

## Integration with mosaic-stargate

When working on Stargate:
1. Use `hbox-axi` to check HyperAIBox fleet
2. Use `spo-axi` to check pool status
3. Use `aimify` to package and deploy AIM modules

All output feeds into orchestrator context for Mosaic Bot.
