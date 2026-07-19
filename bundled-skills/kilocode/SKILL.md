---
name: kilocode
description: "Use Kilo Code (open-source agentic engineering platform) as a coding agent, MCP server, or SDK client. Covers installation, CLI, VS Code/JetBrains extension, `kilo serve`, `@kilocode/sdk`, and integration patterns."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [autonomous-ai-agents, external-repo, integration]
    homepage: https://github.com/
    related_skills: [hermes-agent, native-mcp]
---

# Kilo Code

Kilo Code is an open-source agentic engineering platform: a CLI coding agent (`kilo`), VS Code/JetBrains extensions, and an HTTP/SSE server (`kilo serve`). It is a fork of OpenCode with 500+ models, open pricing, and a generated TypeScript SDK.

## When to use

- You want an alternative autonomous coding agent to Hermes for a specific task.
- You need to embed a coding agent inside another app via `@kilocode/sdk`.
- You want to expose Kilo as a local MCP server or HTTP API.
- You are developing inside the Kilo monorepo.

## Quick commands

```bash
# Install CLI (via npm or VS Code marketplace)
npm install -g @kilocode/cli
kilo --help

# Start the HTTP/SSE server
kilo serve

# SDK client example (after server is running)
import { KiloClient } from "@kilocode/sdk";
```

## Key architectural facts

- **CLI package**: `@kilocode/cli` in `packages/opencode/`. Binary `kilo`.
- **SDK package**: `@kilocode/sdk` (`packages/sdk/js/`) generated from OpenAPI.
- **Products**: CLI (`kilo serve`, TUI, `kilo run`), VS Code extension, JetBrains plugin.
- **Runtime**: Bun + TypeScript; turborepo monorepo.
- **Models**: 500+ via provider routing; supports switching mid-task.
- **Auto-instructions**: `AGENTS.md` at repo root defines build/dev/test rules.

## Hermes integration patterns

1. **As a subagent**: spawn `kilo` process from Hermes `terminal` or `delegate_task` for a bounded coding mission.
2. **As an MCP client target**: Kilo can be configured to use Hermes via its provider routing or plugin system.
3. **As a tool bridge**: `@kilocode/sdk` client can call a running `kilo serve` instance from Hermes Node/Python scripts.

## Pitfalls

- Kilo CLI is Bun-based; ensure `bun` is installed before building from source.
- Typechecking uses `tsgo`, not `tsc`.
- Tests avoid mocks — prefer real implementation tests.
- VS Code extension and JetBrains plugin each have their own `AGENTS.md`.

## Resources

- https://github.com/Kilo-Org/kilocode
- https://kilo.ai

