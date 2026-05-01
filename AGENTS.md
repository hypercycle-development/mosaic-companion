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
| [`tool-lifecycle.md`](docs/architecture/tool-lifecycle.md)                   | Before changing tool install, launch, or execution flow   |
| [`tool-ui.md`](docs/architecture/tool-ui.md)                                 | Before changing how tools render UI blocks                |
| [`execution-plan.md`](docs/architecture/execution-plan.md)                   | For the Phase 1 implementation sequence                   |
| [`implementation-status.md`](docs/architecture/implementation-status.md)     | To check what's built vs planned                          |
| [`glossary.md`](docs/architecture/glossary.md)                               | For term definitions                                      |

## Project Structure

```
electron/
  main.ts                          # Electron main process entry point
  preload.ts                       # IPC bridge (renderer ↔ main)
  settings.ts                      # Persistent app settings (~/.config/mosaic-companion/)
  updater.ts                       # Electron autoUpdater configuration
  utils/
    index.ts                       # File/folder utilities, JSON helpers
  integrations/
    sandbox/                       # Tool sandbox subsystem (WASM-first)
      types.ts                     # ToolManifest, ToolLauncher, GatekeeperPolicy interfaces
      gatekeeper.ts                # ManifestGatekeeperPolicy + WASM host functions
      wasm-launcher.ts             # WasmLauncher (Extism) — ONLY file that knows WASM/Extism
      tool-bridge.ts               # Bridges WASM tools into ToolModule pattern
      chronicle.ts                 # Append-only JSONL activity logs per tool
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
      index.ts                     # Vault CRUD (boxes, entries, content)
      types.ts                     # VaultBox, VaultEntry, BoxContent
    chat/                          # Multi-user chat room system
      client.ts                    # ChatClient — WebSocket client
      agent-runner.ts              # AI agents in chat rooms
      CHATAPI.ts                   # Renderer IPC bridge
      types.ts                     # Chat types (rooms, messages, members)
      index.ts                     # Chat init + IPC registration
    mcp/                           # MCP server integration
      MCPClient.ts                 # Multi-server MCP client (@modelcontextprotocol/sdk)
      MCPAPI.ts                    # Renderer IPC bridge
      plugin.ts                    # MCPPluginManager — named server configs
      LlmToolCalling.ts            # Agentic MCP workflow demos
      index.ts                     # MCP integration entry
      providers/                   # LLM provider adapters (Anthropic, OpenAI)
      recipes/                     # Reusable MCP patterns (agent loop, fanout, etc.)
    gmail/                         # Gmail OAuth + API
      gmailClient.ts               # Gmail API service (auth, fetch, search, read/unread)
      gmailAPI.ts                  # Renderer IPC bridge
      index.ts                     # OAuth2 auth + token persistence
    web3/                          # Web3 wallet + blockchain
      index.ts                     # Wallet storage (safeStorage), address derivation, address book
      config.ts                    # Network config, RPC, token registry, transfer limits
    mosaicbot/                     # Autonomous agent system
      src/main/
        index.ts                   # MosaicBot init — wires heartbeat, channels, skills, memory
        llm.ts                     # Main-process LLM caller
        heartbeat/                 # Periodic agent ticks (runner, wake queue)
        channels/                  # Message delivery to platforms (IPC, HTTP adapters)
        memory/                    # Semantic search + embedding (SQLite, QMD backends)
        skills/                    # Dynamic capability loading (SKILL.md files)
      src/preload.ts               # Preload bridge (agent.send, memory.search)
      bundled-skills/              # Built-in skill definitions
      docs/                        # MosaicBot architecture + memory docs
src/
  App.tsx                          # Main React app (tabs, sidebar, content routing)
  index.tsx                        # React entry point
  ThemeProvider.tsx                # Light/dark theme context
  themes.ts                        # Theme definitions
  theme.css                        # Global CSS variables
  components/
    Chatview.tsx                   # AI chat interface (streaming, tool use)
    ChatPage.tsx                   # Multi-user chat rooms UI
    SettingsPage.tsx               # Agent config (providers, models, connections)
    VaultPage.tsx                  # Vault box management + agent access control
    SandboxPage.tsx                # WASM tool install, manifests, chronicle logs
    Web3Page.tsx                   # Wallet, balances, transfers, address book
    MCPPage.tsx                    # MCP server config + tool/resource discovery
    MosaicBotPanel.tsx             # MosaicBot status, skills, heartbeat, memory search
    GmailClient.tsx                # Gmail connection + email management
    LandingPage.tsx                # Home page with feature highlights
    Sidebar.tsx                    # Navigation sidebar
    TopBar.tsx                     # Navigation bar
    BottomBar.tsx                  # Input textarea with voice + send
    ContentArea.tsx                # Page router
    TabStrip.tsx                   # Browser-like tab management
    ChatHistorySidebar.tsx         # Chat session history panel
    CommandPalette.tsx             # Quick navigation / actions
    tool-ui/                       # Tool UI block rendering system
      ToolUIRenderer.tsx           # Maps block types → React components
      types.ts                     # Block type definitions (text, table, chart, form, …)
      blocks/                      # Individual block renderers (ToolText, ToolTable, …)
  services/
    AIService.ts                   # LLM API calls (Claude, OpenAI, Gemini, Ollama, custom)
    ActionParser.ts                # Parses <use_tool> from AI responses → ToolRegistry/MCP
    TTSService.ts                  # Text-to-speech (local Xenova Speecht5)
  types/
    ai.ts                          # AIAgentConfig, AIProvider, ChatMessage, ChatSession
    chat.ts                        # Chat types (rooms, members, messages)
    tools.ts                       # ToolResult, ModuleInfo, tool arg types
    types.ts                       # App types (tabs, sidebar, browser theme)
docs/
  architecture/                    # Full architecture documentation (see table above)
  build.md                         # Build and development instructions
  vault.md                         # Vault feature docs
  GMAIL_SETUP.md                   # Gmail OAuth setup guide
  release-process.md               # Release and deployment process
  linux-sandbox.md                 # Linux sandbox configuration
tests/
  tools/wasm/                      # WASM tool tests
```

## Key Patterns

### ToolModule pattern

All tools (built-in, MCP, sandboxed WASM) implement the `ToolModule` interface. Agents don't know what runtime is underneath.

### Sandbox tool flow

```
tool.wasm → ToolManager.installTool(wasmPath)
  → WasmLauncher.extractManifest() calls mosaic_manifest() export → ToolManifest
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

### Chat system

WebSocket-based multi-user chat with AI agent participants. The `ChatClient` handles real-time messaging; `agent-runner.ts` manages AI agents inside rooms.

### MosaicBot

Autonomous agent subsystem with:
- **Heartbeat** — periodic ticks that wake agents on schedule
- **Channels** — message delivery to IPC (renderer) or HTTP (webhooks)
- **Memory** — semantic search with SQLite (builtin) or QMD backends, embeddings (OpenAI/Ollama)
- **Skills** — dynamic capability loading from SKILL.md files (bundled, managed, workspace)

Docs: `electron/integrations/mosaicbot/docs/`

### Tool UI blocks

WASM tools return structured UI blocks (text, table, chart, form, etc.) instead of raw HTML. The `ToolUIRenderer` maps block types to themed React components. See [`docs/architecture/tool-ui.md`](docs/architecture/tool-ui.md).

## Don'ts

- **Don't** add Extism/WASM calls outside of `sandbox/wasm-launcher.ts`
- **Don't** give tools direct access to host filesystem, secrets, or wallet
- **Don't** bypass the ToolRegistry for tool execution
- **Don't** assume a specific runtime in Core logic — use `ToolLauncher` interface
- **Don't** allow tools to escalate permissions at runtime
- **Don't** put filtering logic outside of `GatekeeperPolicy`
