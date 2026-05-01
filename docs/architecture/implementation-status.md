# Implementation Status

What's built today, what's in progress, and what's planned.

> Last updated: 2026-03-17

---

## Already Implemented

### WASM Tool Sandbox ✅ (feat/tool-panels-ui branch)

Full WASM-first tool execution system — the primary tool runtime.

| Component                   | Status  | Details                                                          |
| --------------------------- | ------- | ---------------------------------------------------------------- |
| WasmLauncher                | ✅ Done | Extism BackgroundPlugin (worker mode), host functions            |
| Tool manifest extraction    | ✅ Done | `mosaic_manifest()` export, SHA-256 integrity verification       |
| Install approval gate       | ✅ Done | Manifest review UI with permission diff on updates               |
| Tool persistence            | ✅ Done | WASM files stored in `~/.config/mosaic-companion/tools/<id>/`    |
| Input system                | ✅ Done | Encrypted inputs via `safeStorage`, readInput/writeInput         |
| Auto-managed inputs         | ✅ Done | `required: false` inputs hidden from UI, auto-registered by tool |
| Host functions              | ✅ Done | `mosaic_log`, `mosaic_write_output`, `mosaic_write_input`        |
| HTTP via Extism built-in    | ✅ Done | `Http.request()` + `allowedHosts` from manifest domains         |
| Config injection            | ✅ Done | Input data passed as Extism config → `Config.get(key)`          |
| Gatekeeper policy           | ✅ Done | Domain allowlist enforcement, audit logging                      |
| Chronicle                   | ✅ Done | Append-only JSONL per tool, lifecycle + call logging             |
| ToolBridge                  | ✅ Done | WASM tools registered in ToolRegistry as standard ToolModules   |
| Tool Sandbox page           | ✅ Done | Install, launch, stop, uninstall, pin/unpin, input config       |
| Pin to sidebar              | ✅ Done | Pinned tools appear as sidebar navigation items                  |

### Tool Panel UI ✅ (feat/tool-panels-ui branch)

| Component                | Status  | Details                                                    |
| ------------------------ | ------- | ---------------------------------------------------------- |
| ToolPanelView            | ✅ Done | Tab-based panel rendering with lazy loading                |
| mosaic_render_panel      | ✅ Done | WASM export for panel content, receives panelId + args     |
| ToolUIRenderer           | ✅ Done | Maps UI block types to React components                    |
| UI block types           | ✅ Done | text, markdown, code, table, chart, card, image, alert, button, form, divider, toast, detail-panel, badge, progress, stat-row, grid, confirm-modal, tabs |
| Hidden panels            | ✅ Done | `hidden: true` panels for drill-down navigation            |
| navigate_panel action    | ✅ Done | Button action to navigate between panels with args         |
| Panel args               | ✅ Done | Context data passed between panels (e.g. AIM name)        |
| Toast notifications      | ✅ Done | Ephemeral toasts from tool UI blocks                       |

### HyperInsight Tool ✅ (mosaic-tools repo, hyperinsight-wip branch)

| Component          | Status  | Details                                                     |
| ------------------ | ------- | ----------------------------------------------------------- |
| Network stats      | ✅ Done | Leaderboard, AIM grid, node list panels                     |
| AIM details        | ✅ Done | Stats, metadata, lazy charts + releases sub-panels          |
| Auto API key       | ✅ Done | Registers on first run via `/auth/register-client`          |
| HTTP via Extism    | ✅ Done | Uses `Http.request()` PDK global, domain-restricted         |
| 6 UI panels        | ✅ Done | leaderboard, aims, nodes, aim-detail, aim-charts, aim-releases |

### Vault System ✅

| Component               | Status  | Details                                                    |
| ----------------------- | ------- | ---------------------------------------------------------- |
| Box CRUD                | ✅ Done | Create, read, update, delete boxes                         |
| Entry CRUD              | ✅ Done | Add, read, update, delete entries within boxes             |
| Agent access control    | ✅ Done | `boxAccess[]` on agents, enforced at runtime               |
| Vault ToolModule        | ✅ Done | `vault:list_boxes`, `vault:read_box` exposed to agents     |
| ExecutionContext         | ✅ Done | `agentId` threaded through ToolRegistry → tool handlers    |
| VaultPage UI            | ✅ Done | Box management, agent access toggles, entry management     |

### ToolRegistry ✅

| Component               | Status  | Details                                           |
| ----------------------- | ------- | ------------------------------------------------- |
| ToolModule interface    | ✅ Done | Standard interface for registering tools          |
| Built-in modules        | ✅ Done | Gmail (8 tools), Web3 (17 tools), Vault (2 tools) |
| MCP server support      | ✅ Done | Third-party MCP servers as child processes        |
| WASM tool support       | ✅ Done | Sandboxed tools registered via ToolBridge         |
| System prompt injection | ✅ Done | Tools describe themselves to AI agents            |

### AI Agent System ✅

| Component           | Status  | Details                                          |
| ------------------- | ------- | ------------------------------------------------ |
| Multi-agent support | ✅ Done | Multiple agents with different providers/models  |
| Chat history        | ✅ Done | Per-agent session persistence                    |
| Tool use loop       | ✅ Done | Recursive tool execution with agent context      |
| Provider support    | ✅ Done | Claude, OpenAI, Gemini, Ollama, custom endpoints |

---

## In Progress

| Component                    | Status             | Notes                                                  |
| ---------------------------- | ------------------ | ------------------------------------------------------ |
| Multi-user chat              | 🔲 In progress     | WebSocket rooms with AI agent participants             |
| Tool registry/marketplace    | 🔲 Planned         | Browseable catalog, versioned releases                 |
| WASM concurrency             | 📋 Plan created    | Plugin pool or host-side HTTP batching (see plans/)    |

---

## Open Engineering Questions

1. **WASM concurrency** — BackgroundPlugin is not reentrant. Plan options: plugin pool, host-side batch, or sequential queue.
2. **Tool distribution** — Need a registry service for publishing/discovering tools.
3. **Rust/Go tool support** — Extism supports these; need to build shared SDK equivalents.
4. **Panel refresh model** — Currently on-demand. Consider WebSocket push for live-updating panels.
