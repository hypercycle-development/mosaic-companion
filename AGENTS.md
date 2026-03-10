# MosAIc Companion — AI Agent Instructions

> This file provides context for AI coding assistants working on this project.
> Read this before making changes to the codebase.

## Project Overview

MosAIc is an Electron desktop app (React + TypeScript) that serves as an AI companion with tool use, wallet integration, and secure sandboxed tool execution.

**Stack:** Electron (main process) + React (renderer) + TypeScript. Vite for bundling.

## Architecture — MUST READ Before Modifying

The project follows a **Core (trusted) vs Sandbox (untrusted)** architecture for tool execution.

**Full architecture docs:** [`/docs/architecture/`](docs/architecture/README.md)

### Key Rules

1. **WASM is the primary runtime for sandboxed tools.** Docker is optional for heavy workloads (GPU, databases). WASM tools have zero network/filesystem/OS access by default — all capabilities come through host functions.
2. **The Gatekeeper is host functions, not a container.** For WASM tools, the Gatekeeper logic runs directly inside Electron as host functions gated by `GatekeeperPolicy`. No separate proxy or container.
3. **Tools are always low-trust.** Even tools written by us get the same restrictions in the Sandbox. Trust is architectural, not reputational.
4. **Every boundary crossing must be:** explicit, Core-mediated, and logged.
5. **No runtime permission escalation** — tools declare permissions in their manifest upfront.
6. **`GatekeeperPolicy` is the base interface** for filtering decisions. WASM host functions call it directly now; a future Docker proxy would call the same policy. Same rules, different plumbing.

### Key Architecture Docs

| Doc                                                                          | When to read                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`overview.md`](docs/architecture/overview.md)                               | Before modifying any Core or Sandbox code                 |
| [`manifest.md`](docs/architecture/manifest.md)                               | Before changing tool manifests, permissions, or UI panels |
| [`gatekeeper.md`](docs/architecture/gatekeeper.md)                           | Before touching outbound network filtering                |
| [`container-communication.md`](docs/architecture/container-communication.md) | Before changing how MosAIc talks to tools                 |
| [`permissions.md`](docs/architecture/permissions.md)                         | Before changing the permission model                      |
| [`data-model.md`](docs/architecture/data-model.md)                           | Before modifying Chronicle, Vault, or data flow           |
| [`glossary.md`](docs/architecture/glossary.md)                               | For term definitions                                      |

## Project Structure

```
electron/
  main.ts                          # Electron main process
  preload.ts                       # IPC bridge (renderer ↔ main)
  integrations/
    sandbox/                       # Tool sandbox subsystem (WASM-first)
      types.ts                     # ToolManifest, ToolLauncher, GatekeeperPolicy interfaces
      gatekeeper.ts                # ManifestGatekeeperPolicy + WASM host functions
      wasm-launcher.ts             # WasmLauncher (Extism) — ONLY file that knows WASM/Extism
      tool-bridge.ts               # Bridges WASM tools into ToolModule pattern
      index.ts                     # ToolManager — orchestration + IPC
    tools/                         # Tool system
      types.ts                     # ToolModule, ToolDefinition, ExecutionContext
      registry.ts                  # ToolRegistry — central tool manager
      index.ts                     # Registry singleton + lifecycle
      modules/                     # Built-in tool modules
        gmail.ts                   # Gmail integration (8 tools)
        web3.ts                    # Web3/crypto tools (17 tools)
        vault-tools.ts             # Vault read-only access for agents
    vault/                         # Vault data storage (boxes + entries)
    mcp/                           # MCP server integration
    gmail/                         # Gmail OAuth + API
    web3/                          # Web3 wallet + blockchain
    mosaicbot/                     # MosAIc bot logic
src/
  App.tsx                          # Main React app
  components/                      # React components (ChatView, Vault, Settings, etc.)
docs/
  architecture/                    # Full architecture documentation
```

## Key Patterns

### ToolModule pattern

All tools (built-in, MCP, sandboxed WASM) implement the `ToolModule` interface. Agents don't know what runtime is underneath.

### Sandbox tool flow

```
manifest.json + tool.wasm → ToolManager.installTool()
  → ToolManager.launchTool() → WasmLauncher.launch()
    → Extism loads .wasm + injects host functions (gated by GatekeeperPolicy)
    → createToolBridge() → ToolModule registered in ToolRegistry
    → Agent calls <use_tool server="ext:tool-id" tool="fn">args</use_tool>
```

### Tool Manifest (WIP)

See [`docs/architecture/manifest.md`](docs/architecture/manifest.md). Key fields:

- `runtime.type`: `"wasm"` (primary) or `"docker"` (future)
- `permissions`: internet, allowed_domains, files, services
- `tools`: functions exposed to agents
- `ui.panels`: UI panels the tool can render inside MosAIc

### ExecutionContext

Agent identity flows through the tool execution pipeline. Used by tools like Vault to enforce access control.

### IPC bridge

All main↔renderer communication goes through `preload.ts` via `ipcRenderer.invoke()`.

## Phase 1 Tickets (Linear)

| Ticket  | Status             | Description                          |
| ------- | ------------------ | ------------------------------------ |
| HYP-652 | ✅ Implemented     | Sandbox architecture + WASM launcher |
| HYP-660 | ✅ Merged into 652 | Gatekeeper (host functions for WASM) |
| HYP-664 | 🔲 Next            | Chronicle (append-only tool logging) |
| HYP-663 | 🔲 Planned         | Tool Download UI                     |

## Don'ts

- **Don't** add Extism/WASM calls outside of `sandbox/wasm-launcher.ts`
- **Don't** give tools direct access to host filesystem, secrets, or wallet
- **Don't** bypass the ToolRegistry for tool execution
- **Don't** assume a specific runtime in Core logic — use `ToolLauncher` interface
- **Don't** allow tools to escalate permissions at runtime
- **Don't** put filtering logic outside of `GatekeeperPolicy`
