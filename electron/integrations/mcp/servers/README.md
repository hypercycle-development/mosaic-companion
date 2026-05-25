# GBrain MCP Server for Mosaic Companion

## Overview

This is a **Model Context Protocol (MCP) server bridge** that exposes the personal knowledge graph (gbrain) to Mosaic Companion's MCP client layer. Agents inside Mosaic can now query Stargate development history, architecture, and commits via natural language.

## Architecture

```
Mosaic Companion (Electron)
├── Renderer (React + TypeScript)
│   └── ChatView → ActionParser → window.electronAPI.mcpAPI.callTool(...)
├── Preload (IPC bridge)
└── Main (Node.js)
    ├── MCPClient (@modelcontextprotocol/sdk)
    │   ├── Connects to various MCP servers
    │   └── ┌────────────────────────────────┐
    │         │  gbrain-mcp-server.js (stdio) │
    │         │  (this file)                   │
    │         └──────┬───────────────────────────┘
    │                │ spawns child processes
    │                ▼
    ├── gbrain CLI ──► ~/.gbrain/brain.pglite (PGLite DB)
    │   ├── search, query, graph, get_page, list_pages, stats
    │   └── code_callers
    └── MCPPluginManager (persistent storage)
```

## Tools Exposed (7 tools)

| Tool | Description | Best For |
|------|-------------|----------|
| `gbrain_search` | Full-text keyword search | Exact match: "what is the ANFE fix commit?" |
| `gbrain_query` | Semantic + keyword hybrid | Natural language: "show me Stargate dashboard work" |
| `gbrain_get_page` | Read one page by slug | Deep dive: "show me the Stargate Pool details" |
| `gbrain_list_pages` | Recent pages with filters | Discovery: "what pages were created today?" |
| `gbrain_graph` | Link graph traversal | Tree exploration: "what's under Mosaic Stargate?" |
| `gbrain_get_stats` | Brain health summary | Status check: "how many pages do we have?" |
| `gbrain_code_callers` | Code symbol callers | Dev work: "who calls StargatePoolService?" |

## Inside Mosaic Usage

Agents in Mosaic Chat can now ask:

```
Search the brain for all Stargate commits about ANFE
Show me the graph under projects/mosaic-stargate
What pages exist about the dashboard?
List the latest Stargate commits
What do we know about MCP Everywhere?
```

The `ActionParser` auto-routes `<use_tool server="gbrain" tool="...">` to this bridge.

## Configuration

The server auto-registers in `electron/integrations/mcp/index.ts` via `ensureDefaultPlugins()`.
No manual config needed — it uses:

```ts
{
  name: "gbrain",
  transport: "stdio",
  command: "node",
  args: [".../electron/integrations/mcp/servers/gbrain-mcp-server.js"],
  autoConnect: true,  // Connects on app startup
}
```

## Environment

| Var | Default | Description |
|-----|---------|-------------|
| `GBRAIN_HOME` | `~/.gbrain` (parent) | Parent directory of `.gbrain/` db dir |

## Files

| File | Purpose |
|------|---------|
| `gbrain-mcp-server.js` | MCP stdio bridge (this server) |
| `test-gbrain-mcp.js` | Local smoke test script |

## Testing

```bash
cd /tmp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mosaic","version":"1.0.0"}}}' \
  | node ~/mosaic-companion/electron/integrations/mcp/servers/gbrain-mcp-server.js
```

## Notes

- Auto-connects on Mosaic startup (if gbrain DB exists)
- Graceful timeout on long gbrain queries (30s default)
- JSON pretty-print output for LLM readability
- Safe against `No brain configured` — server emits error, does not crash

---
*Registered by default in Mosaic Companion stargate-module branch*
