# Atomic Mail MCP Integration for Mosaic Companion

## Overview

Adds autonomous `@atomicmail.ai` email inboxes to Mosaic Companion via the
Atomic Mail MCP server. Each agent inside Mosaic can register its own inbox and
send/receive/search emails natively.

## Architecture

```
Mosaic Companion (Electron)
├── Renderer (React + TypeScript)
│   └── ChatView → ActionParser → <use_tool server="atomicmail" tool="...">
├── Preload (IPC bridge)
└── Main (Node.js)
    ├── MCPClient (@modelcontextprotocol/sdk)
    │   └── atomicmail MCP server (stdio)
    │       └── npx -y @atomicmail/mcp-github
    ├── MCPPluginManager (persistent storage)
    └── ToolRegistry
        └── AtomicMailModule
            ├── atomicmail:registerInbox
            ├── atomicmail:sendEmail
            ├── atomicmail:readInbox
            ├── atomicmail:searchEmails
            ├── atomicmail:emailHelp
            └── atomicmail:getStatus
```

## Tools Exposed

| Tool | Description |
|------|-------------|
| `atomicmail:registerInbox` | Create a new `@atomicmail.ai` inbox (PoW signup) |
| `atomicmail:sendEmail` | Send outbound email (to/cc/bcc, subject, plain body) |
| `atomicmail:readInbox` | Fetch recent emails |
| `atomicmail:searchEmails` | Search inbox by text |
| `atomicmail:emailHelp` | Get Atomic Mail help / JMAP presets |
| `atomicmail:status` | Check MCP connection status |

## Configuration

Auto-registered in `electron/integrations/mcp/index.ts` via `ensureDefaultPlugins()`.
No manual config needed.

```ts
{
  name: "atomicmail",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@atomicmail/mcp-github"],
  autoConnect: true,
}
```

If the `@atomicmail/mcp-github` package is installed in Mosaic's `node_modules`,
the plugin resolves the local `dist/index.js` entry point instead of using `npx`.

## Credentials

Credentials are written to `~/.atomicmail/` by the MCP server (default). To give
multiple agents separate inboxes, use the `credentials_dir` argument on
`registerInbox` or the `credentials_dir` env var.

## Example Agent Prompts

```
Register an inbox for me called "ruby-outreach" with display name "Ruby".
Send an email to mauricio@example.com from ruby-outreach saying hi.
Read my latest 5 emails.
Search emails for "proposal".
```

## Files

- `electron/integrations/mcp/index.ts` — plugin registration
- `electron/integrations/tools/modules/atomicmail.ts` — ToolModule bridge
- `electron/integrations/tools/index.ts` — module registration
