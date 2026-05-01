# Mosaic Browser — Agent System Documentation

This document covers the full agent architecture of Mosaic Browser: how agents are configured, how they execute, how they interact with LLMs and tools, and how the various subsystems connect.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Configuration](#agent-configuration)
3. [LLM Providers](#llm-providers)
4. [Agent Execution Modes](#agent-execution-modes)
   - [Interactive Chat (Chatview)](#1-interactive-chat-chatview)
   - [MosaicBot Autonomous Agent](#2-mosaicbot-autonomous-agent)
   - [Chat Room Agents](#3-chat-room-agents)
5. [MCP Integration](#mcp-integration)
6. [Tool System](#tool-system)
7. [Memory System](#memory-system)
8. [Skills System](#skills-system)
9. [Heartbeat System](#heartbeat-system)
10. [Channel Delivery](#channel-delivery)
11. [WASM Tool Sandbox](#wasm-tool-sandbox)
12. [IPC Reference](#ipc-reference)
13. [Data Flow Diagrams](#data-flow-diagrams)
14. [Configuration Files](#configuration-files)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React/Vite)                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Chatview │ │ ChatPage │ │MosaicBot │ │  MCPPage  │  │
│  │ (1-on-1) │ │ (Rooms)  │ │  Panel   │ │           │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  AIService    chatAPI      agent/memory      mcpAPI     │
│  ActionParser                                           │
└───────┬─────────────┬────────────┬──────────────┬───────┘
        │  IPC Bridge (preload.ts)                │
┌───────┴─────────────┴────────────┴──────────────┴───────┐
│  Main Process (Electron)                                │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ AI Agents   │  │   Chat   │  │    MosaicBot     │   │
│  │ CRUD +      │  │  Client  │  │ ┌──────────────┐ │   │
│  │ ai-agents   │  │  Agent   │  │ │  Heartbeat   │ │   │
│  │ .json       │  │  Runner  │  │ │  Memory      │ │   │
│  │             │  │          │  │ │  Skills      │ │   │
│  │             │  │          │  │ │  Channels    │ │   │
│  └──────┬──────┘  └────┬─────┘  │ │  LLM Caller │ │   │
│         │               │        │ └──────────────┘ │   │
│  ┌──────┴───────────────┴────────┴──────────────┐   │   │
│  │            callActiveLLM()                    │   │   │
│  │  Claude │ OpenAI │ Gemini │ Ollama │ Custom  │   │   │
│  │                  │ Hypercycle                 │   │   │
│  └──────────────────────────────────────────────┘   │   │
│  ┌────────────┐  ┌───────────┐  ┌───────────────┐  │   │
│  │ MCP Client │  │   Tools   │  │  Tool Sandbox │  │   │
│  │ (servers)  │  │ Registry  │  │  (WASM)       │  │   │
│  └────────────┘  └───────────┘  └───────────────┘  │   │
└─────────────────────────────────────────────────────────┘
```

The agent system has three execution modes that all share the same agent configuration (`ai-agents.json`) and LLM caller infrastructure:

| Mode | UI Component | Trigger | IPC Namespace |
|------|-------------|---------|---------------|
| Interactive Chat | `Chatview.tsx` | User message | `electronAPI` |
| MosaicBot Autonomous | `MosaicBotPanel.tsx` | Heartbeat timer / manual | `agent`, `memory` |
| Chat Room Agent | `ChatPage.tsx` | @mention in room | `chatAPI` |

---

## Agent Configuration

Agents are defined in `~/.config/mosaic-companion/ai-agents.json` and managed via the Settings page.

### AIAgentConfig

```typescript
interface AIAgentConfig {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // Display name
  provider: AIProvider;          // "claude" | "openai" | "gemini" | "ollama" | "custom" | "hypercycle"
  apiKey: string;                // Provider API key
  baseUrl?: string;              // Custom endpoint URL
  model: string;                 // Model identifier (e.g., "claude-sonnet-4-20250514")
  maxTokens?: number;            // Max output tokens
  temperature?: number;          // Sampling temperature (0-1)
  isActive: boolean;             // Whether this is the default agent
  createdAt: number;             // Unix timestamp (ms)
  boxAccess?: string[];          // Vault box IDs this agent can read
  richUI?: boolean;              // Allow <mosaic_ui> block rendering

  // Hypercycle-specific fields
  hypercycleBackend?: "toda" | "basechain";
  hypercycleCurrencyType?: string;
  hypercycleAimBaseUrl?: string;
  hypercycleTxSignature?: string;
  hypercycleTxDriver?: string;
  hypercycleStreamBaseUrl?: string;
  hypercycleStreamTxSender?: string;
}
```

### IPC Handlers for Agent CRUD

| Handler | Description |
|---------|-------------|
| `ai-agents:get` | Load all agents |
| `ai-agents:set` | Overwrite all agents |
| `ai-agents:add` | Create new agent |
| `ai-agents:update` | Update agent by ID |
| `ai-agents:delete` | Delete agent by ID |
| `ai-agents:clear` | Remove all agents |

The active agent (the one with `isActive: true`) is used by default when calling `callActiveLLM()`.

---

## LLM Providers

All LLM calls are routed through `callActiveLLM()` in the main process (`electron/integrations/mosaicbot/src/main/llm.ts`) or through `AIService` in the renderer (`src/services/AIService.ts`).

### Provider Details

| Provider | Endpoint | Auth Header | Streaming |
|----------|----------|-------------|-----------|
| **Claude** | `https://api.anthropic.com/v1/messages` | `x-api-key` | SSE |
| **OpenAI** | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer` | SSE |
| **Gemini** | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `?key=` query param | SSE |
| **Ollama** | `http://localhost:11434/api/chat` | None (local) | NDJSON |
| **Custom** | User-provided `baseUrl` | `Authorization: Bearer` | SSE |
| **Hypercycle** | Multi-step: nonce → AIM → stream | TODA/Basechain signing | SSE |

### Default Models

```
Claude:     claude-sonnet-4-20250514, claude-opus-4-0-20250514, claude-haiku-4-0-20250514
OpenAI:     gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-preview, o1-mini
Gemini:     gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
Ollama:     llama3.2, mistral, codellama, deepseek-coder
Hypercycle: claude-sonnet-4-5-20250929
```

### callActiveLLM()

```typescript
// Main process LLM caller (safe — API keys never cross IPC)
async function callActiveLLM(
  prompt: string,
  systemPrompt?: string,
  agentId?: string       // Optional: use specific agent instead of active
): Promise<string | null>
```

- If `agentId` is provided, looks up that specific agent
- Otherwise uses the first agent with `isActive: true`
- Returns `null` if no agent found or on error
- Routes to provider-specific implementation based on `agent.provider`

### Renderer AIService

```typescript
// Renderer-side LLM calls (streaming supported)
class AIService {
  static sendMessage(config, messages, callbacks?): Promise<string>
  static sendToClaude(config, messages, callbacks?): Promise<string>
  static sendToOpenAI(config, messages, callbacks?): Promise<string>
  static sendToGemini(config, messages, callbacks?): Promise<string>
  static sendToOllama(config, messages, callbacks?): Promise<string>
  static sendToHypercycle(config, messages, callbacks?): Promise<string>
  static testConnection(config): Promise<{success, message}>
}
```

Streaming callbacks:
```typescript
{
  onToken?: (token: string) => void;   // Called per token
  onDone?: (full: string) => void;     // Called on completion
}
```

---

## Agent Execution Modes

### 1. Interactive Chat (Chatview)

**Location:** `src/components/Chatview.tsx`

The primary user-facing chat interface. Users send messages to a selected agent and receive streaming responses with tool execution support.

**Flow:**

```
User types message
  → AIService.sendMessage(agentConfig, messages, {onToken, onDone})
  → LLM responds (streamed)
  → ActionParser.parseAction(response) checks for <use_tool> tags
  → If tool call found:
      → executeToolCall() routes to ToolRegistry or MCP
      → Tool result appended to messages
      → LLM called again with tool output
  → If <mosaic_ui> blocks found:
      → parseMosaicUI() extracts and validates UI blocks
      → Rendered inline in chat (if agent.richUI is true)
  → Session saved via aiAgentsHistory.save()
```

**Tool Call Format (in LLM output):**

```xml
<use_tool server="module_name" tool="tool_name">
{"param1": "value1", "param2": "value2"}
</use_tool>
```

**Rich UI Block Format:**

```xml
<mosaic_ui type="chart" title="Sales Data">
{"data": [...], "config": {...}}
</mosaic_ui>
```

**Media Handling:**
- Tool results can include `mosaic-media://` URLs pointing to local files
- These are converted to `data:` URIs via `electronAPI.media.readAsDataUri()`
- Auto-display is gated by user preference

### 2. MosaicBot Autonomous Agent

**Location:** `electron/integrations/mosaicbot/`

A periodic autonomous agent that wakes on schedule, searches its memory, and delivers alerts when it has something meaningful to report.

**Initialization:**

```typescript
// Called from electron/main.ts on app ready
const handle = await initMosaicBot();
// Returns: { stop() } for cleanup
```

**Components:**

| Component | File | Purpose |
|-----------|------|---------|
| Heartbeat | `heartbeat/runner.ts` | Schedules periodic LLM ticks |
| Memory | `memory/index.ts` | Semantic search + file indexing |
| Skills | `skills/registry.ts` | Dynamic command discovery |
| Channels | `channels/registry.ts` | Message delivery (IPC / HTTP) |
| LLM | `llm.ts` | Provider-agnostic LLM calls |

**Agent Message Flow:**

```
User sends text via window.agent.send(text)
  → IPC handler "agent:send" in main process
  → resolveSkillCommand(text, skillSpecs)
  → If skill match: return { type: "skill", skill, args }
  → If not: callActiveLLM(text) → return { type: "reply", text }
```

**Heartbeat Flow:**

```
Timer fires (every intervalMs)
  → Check active hours (skip if outside)
  → Search memory for pending tasks/reminders
  → Build prompt with memory context
  → callActiveLLM(prompt, systemPrompt)
  → Strip HEARTBEAT_OK token
  → If meaningful content remains: deliver via channel
```

**Renderer API:**

```typescript
window.agent = {
  send(text): Promise<{type, skill?, args?, text?}>
  triggerHeartbeat(agentId?): Promise<{ok}>
  listSkills(): Promise<Array<{name, description}>>
  onMessage(cb): void  // Push: { to, text, channel, messageId }
}

window.memory = {
  search(query, opts?): Promise<MemorySearchResult[]>
  read(relPath, from?, lines?): Promise<{text, path}>
  sync(): Promise<void>
  status(): Promise<MemoryProviderStatus>
}
```

### 3. Chat Room Agents

**Location:** `electron/integrations/chat/`

Multi-user WebSocket chat rooms where AI agents join as participants and respond to @mentions.

**Architecture:**

```
Chat Server (wss://agents-chat.hyperpg.site)
    ↕ WebSocket
ChatClient (electron/integrations/chat/client.ts)
    ↕ Events
AgentRunner (electron/integrations/chat/agent-runner.ts)
    ↓ @mention detected
callActiveLLM(conversationContext, systemPrompt, agentId)
    ↓ Response
ChatClient.send({ type: "send-message", roomId, text: reply })
```

**Agent Lifecycle:**

```typescript
// Assign agent to room (from UI)
startAgentInRoom(serverUrl, roomId, agentId, agentName)
  → Creates ChatClient with isAgent: true
  → Authenticates via WebSocket
  → Joins specified room
  → Listens for messages

// On incoming message:
  → addToHistory(roomId, message)     // Keep last 50 messages
  → Check if message is from agent    // Skip agent messages
  → Check for @agentName mention      // Case-insensitive regex
  → buildConversationContext()         // Format history for LLM
  → callActiveLLM(context, systemPrompt, agentId)
  → Send reply to room

// Remove agent from room
stopAgentInRoom(roomId, agentId)
  → Destroys ChatClient
  → Cleans up history if no agents remain
```

**System Prompt for Chat Agents:**

```
You are {agentName}, an AI assistant in a multi-user chat room.
You can see the full conversation history above.
The latest message mentions you — respond to it helpfully and concisely.
Do NOT prefix your response with your name.
```

**Conversation Context Format:**

```
[AI] BotName: Previous bot message
Username: Previous user message
[AI] AnotherBot: Another bot message
Username: @BotName can you help with this?

Respond to the latest message that mentions you.
```

**WebSocket Protocol:**

| Client Message | Purpose |
|---------------|---------|
| `auth` | Authenticate (username, isAgent flag, metadata) |
| `create-room` | Create room (name, visibility, password) |
| `join-room` | Join existing room |
| `leave-room` | Leave room |
| `send-message` | Send text to room |
| `direct-message` | DM another member |
| `typing` | Typing indicator |
| `list-rooms` | Request room list |
| `set-visibility` | Change room visibility |
| `invite-member` | Invite user to room |

| Server Message | Purpose |
|---------------|---------|
| `auth-ok` | Authentication successful (returns memberId) |
| `rooms` / `rooms-updated` | Room list |
| `joined` | Joined room (includes message history) |
| `message` | New message in room |
| `member-joined` / `member-left` | Presence events |
| `error` | Error message |

**Room Visibility:** `"public"` | `"private"` | `"invite-only"`

**Persistence:**
- `chat-settings.json` — Server URL and username
- `chat-room-agents.json` — Room-to-agent assignments (`Record<roomId, agentId[]>`)

**ChatClient Reconnection:**
- Base delay: 1,000ms
- Max delay: 30,000ms
- Strategy: Exponential backoff (delay *= 2 per retry)

---

## MCP Integration

**Location:** `electron/integrations/mcp/`

MCP (Model Context Protocol) allows connecting to external tool servers that expose tools, resources, and prompts.

### MCPClient

Multi-server connection manager wrapping `@modelcontextprotocol/sdk`:

```typescript
class MCPClient extends EventEmitter {
  // Connection
  connectStdio(name, command, args?, env?): Promise<MCPInitializeResult>
  connectHttp(name, url, apiKey?): Promise<MCPInitializeResult>
  disconnect(name): Promise<void>
  disconnectAll(): Promise<void>

  // Tools
  callTool(serverName, toolName, args?): Promise<MCPToolResult>
  listTools(serverName): Promise<MCPTool[]>
  getAllTools(): Promise<Array<MCPTool & {_serverName}>>

  // Resources
  readResource(serverName, uri): Promise<{contents: MCPContent[]}>
  listResources(serverName): Promise<MCPResource[]>

  // Prompts
  getPrompt(serverName, promptName, args?): Promise<...>
  listPrompts(serverName): Promise<MCPPrompt[]>
}
```

### Plugin Manager

Persists server configurations to `mcp-plugins.json`:

```typescript
interface MCPPlugin {
  id: string;
  name: string;
  description?: string;
  transport: "stdio" | "http";
  command?: string;            // For stdio: shell command
  args?: string[];             // For stdio: command args
  env?: Record<string, string>;
  url?: string;                // For HTTP transport
  apiKey?: string;
  autoConnect?: boolean;       // Connect on app start
  role?: "os" | string;       // Special role routing
}
```

### OS Role

One MCP plugin can be designated with `role: "os"` for filesystem access. This provides a stable abstraction:

```typescript
window.electronAPI.os.status()          // Check if OS plugin connected
window.electronAPI.os.listTools()       // Get available OS tools
window.electronAPI.os.call(tool, args)  // Call OS tool
```

### Agent Loop

The MCP system supports full agentic loops where the LLM iteratively calls tools:

```typescript
// Renderer triggers via:
mcpAPI.runAgent({
  query: "Find all TODO comments in the codebase",
  serverNames: ["filesystem"],
  provider: "anthropic",
  model: "claude-sonnet-4-20250514"
})

// Main process executes:
runAgentLoop(mcp, provider, serverNames, query, {
  maxIterations: 10,
  onBeforeToolCall: (call) => { /* approve/deny */ },
  onToolResult: (result) => { /* emit to renderer */ },
  onIteration: (i, messages) => { /* progress */ }
})
```

### LLM Provider Adapters

MCP tools are converted to provider-specific formats:

| Provider | Tool Format | Response Format |
|----------|-------------|-----------------|
| Anthropic | `tool_use` content blocks | `tool_use` type in content |
| OpenAI | `function` calling | `tool_calls` on message |

### Recipes

Pre-built patterns in `electron/integrations/mcp/recipes/`:

| Recipe | Description |
|--------|-------------|
| `directToolCall` | Single/batch tool calls without LLM |
| `agentLoop` | Full agentic loop with iterative tool use |
| `multiServerFanout` | Unified tool surface across all servers |
| `promptChaining` | Discover and chain prompt templates |
| `resourceWatcher` | Monitor resource changes |

---

## Tool System

**Location:** `electron/integrations/tools/`

### Built-in Tool Registry

Tools are organized as modules, each exposing named functions:

```typescript
interface ToolModule {
  name: string;
  displayName: string;
  description: string;
  tools: ToolDefinition[];
  execute(toolName: string, args: Record<string, unknown>, context?: ExecutionContext): Promise<ToolResult>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  required?: string[];
}
```

### Tool Routing

When the LLM outputs a `<use_tool>` tag, `ActionParser` routes the call:

1. Check ToolRegistry for built-in module match
2. If not found, check MCP servers for `server:tool` match
3. Execute and return result to LLM

```typescript
// IPC handlers
tools.execute(fullName, args, context?)  // "module:tool" format
tools.listModules()                       // All available modules
tools.getSystemPrompt()                   // Tool descriptions for LLM
tools.getActionPatterns()                 // Regex patterns for detection
```

---

## Memory System

**Location:** `electron/integrations/mosaicbot/src/main/memory/`

Provides semantic search over workspace files for the MosaicBot agent.

### Backends

| Backend | Description | Availability |
|---------|-------------|-------------|
| **Builtin (SQLite)** | FTS5 + optional vector search | Always available |
| **QMD** | External `qmd` command for advanced indexing | Optional, falls back to SQLite |

### Configuration

```typescript
type BuiltinMemoryConfig = {
  workspaceDir: string;
  dbPath: string;                     // e.g., ~/.config/mosaic-companion/memory/main.sqlite
  embedding?: {
    provider: "openai" | "ollama" | "none";
    model?: string;                   // Default: "text-embedding-3-small"
    apiKey?: string;
    baseUrl?: string;
    dimensions?: number;              // Default: 1536
  };
  chunking?: {
    tokens?: number;                  // Default: 400
    overlap?: number;                 // Default: 80
  };
  search?: {
    maxResults?: number;              // Default: 6
    minScore?: number;                // Default: 0.0
    vectorWeight?: number;            // Default: 0.7
    textWeight?: number;              // Default: 0.3
    mmr?: { enabled?, lambda? };      // Max marginal relevance
    temporalDecay?: { enabled?, halfLifeDays? };
  };
};
```

### Search Interface

```typescript
interface MemorySearchManager {
  search(query, opts?): Promise<MemorySearchResult[]>
  readFile(params): Promise<{text, path}>
  sync(params?): Promise<void>
  status(): MemoryProviderStatus
  close(): Promise<void>
}

type MemorySearchResult = {
  path: string;       // Relative path
  startLine: number;  // 1-indexed
  endLine: number;
  score: number;      // 0-1
  snippet: string;    // ≤700 chars
  source: "memory" | "sessions";
};
```

### Embedding Providers

| Provider | Model | Dimensions | Endpoint |
|----------|-------|------------|----------|
| OpenAI | text-embedding-3-small | 1536 | `/v1/embeddings` |
| Ollama | Configurable | Auto-detected | `/api/embeddings` |
| None | — | — | FTS-only mode |

---

## Skills System

**Location:** `electron/integrations/mosaicbot/src/main/skills/`

Skills are dynamic capabilities loaded from `SKILL.md` markdown files.

### Skill Sources (priority: bundled < managed < workspace)

| Source | Location |
|--------|----------|
| Bundled | `electron/integrations/mosaicbot/bundled-skills/` |
| Managed | `~/.config/mosaic-companion/mosaicbot/skills/` |
| Workspace | `{project_root}/skills/` |

### SKILL.md Format

```yaml
---
name: GitHub Integration
description: Interact with GitHub repositories
metadata: |
  {"OpenMosaic": {"requires": {"bins": ["git", "gh"]}, "os": ["darwin", "linux"]}}
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: github_tool
---

# Skill content (prompt instructions for the LLM)
...
```

### Eligibility Checking

Before a skill is offered, the system checks:
- Required binaries exist on PATH (e.g., `git`, `gh`, `docker`)
- OS compatibility (darwin, linux, win32)
- Other metadata conditions

```typescript
async function buildEligibilityContext(
  binsToProbe?: string[]  // Default: ["git", "gh", "node", "python3", "docker", "curl"]
): Promise<SkillEligibilityContext>
```

### Command Resolution

Skills register as `/commandname` shortcuts:

```typescript
resolveSkillCommand("/github list-prs", skillSpecs)
// Returns: { spec: githubSkill, args: "list-prs" }
```

---

## Heartbeat System

**Location:** `electron/integrations/mosaicbot/src/main/heartbeat/`

Periodic autonomous agent ticks with configurable scheduling.

### Configuration

```typescript
type HeartbeatConfig = {
  enabled: boolean;
  intervalMs: number;              // e.g., 30 * 60_000 (30 min)
  channel?: string;                // "ipc" or "http"
  to?: string;                     // Recipient identifier
  ackMaxChars?: number;            // Suppress trivial responses (default: 300)
  activeHours?: {
    start: string;                 // "HH:MM" (e.g., "09:00")
    end: string;                   // "HH:MM" (e.g., "22:00")
    timezone?: string;
  };
  prompt?: string;                 // Custom heartbeat prompt
  memorySearch?: {
    query?: string;                // Default: "pending tasks actions reminders"
    maxResults?: number;           // Default: 5
    maxInjectedChars?: number;     // Default: 2000
  };
};
```

### HEARTBEAT_OK Protocol

If the LLM has nothing to report, it returns `HEARTBEAT_OK`. The runner strips this token:
- If only `HEARTBEAT_OK` remains → status `"ok-token"`, no delivery
- If empty response → status `"ok-empty"`, no delivery
- If meaningful content → status `"sent"`, delivered via channel

### Wake Mechanism

Manual triggers coalesce rapid requests:

```typescript
requestHeartbeatNow({ agentId: "main" })  // Fires after 250ms debounce

// Priority levels:
WAKE_PRIORITY.retry    = 0  // Automatic retry
WAKE_PRIORITY.interval = 1  // Scheduled
WAKE_PRIORITY.default  = 2  // Generic
WAKE_PRIORITY.action   = 3  // Manual (highest)
```

---

## Channel Delivery

**Location:** `electron/integrations/mosaicbot/src/main/channels/`

Channels deliver agent messages to different destinations.

### Built-in Adapters

| Adapter | Destination | Chunk Limit | Format |
|---------|-------------|-------------|--------|
| **IPC** | All BrowserWindows | 65,536 chars | Markdown |
| **HTTP** | Webhook URL | 4,000 chars | Plain text |

### IPC Delivery

```typescript
// Sends to all open windows:
BrowserWindow.getAllWindows().forEach(w => {
  w.webContents.send("agent:message", { to, text, channel: "ipc" })
})
```

### HTTP Delivery

```typescript
// POSTs to configured webhook:
fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ to, text, ts: Date.now() })
})
```

### Chunking

Long messages are split intelligently:
1. Try to split at paragraph boundaries
2. Fall back to sentence boundaries
3. Hard cut at chunk limit if necessary

---

## WASM Tool Sandbox

**Location:** `electron/integrations/sandbox/`

Runs WebAssembly-based tools in a sandboxed environment with explicit permission grants.

### Tool Manifest

Each WASM tool declares capabilities:

```typescript
{
  permissions: {
    internet: boolean;
    allowed_domains?: string[];
    files?: string[];
    services?: string[];
  },
  ui_panels: [{ id, title, description }],
  inputs: [{ key, label, secret?, required? }],
  functions: [{ name, description, parameters }]
}
```

### Gatekeeper

`ManifestGatekeeperPolicy` enforces permissions at runtime:
- Domain allowlisting for network access
- File path restrictions
- Service access control
- All decisions logged to Chronicle

### Chronicle (Audit Log)

Append-only JSONL log per tool:

```typescript
type ChronicleEntry = {
  type: "lifecycle" | "audit" | "output" | "log";
  timestamp: number;
  toolId: string;
  data: unknown;
};
```

### Tool Lifecycle IPC

| Handler | Description |
|---------|-------------|
| `toolSandbox:inspectManifest` | Preview tool before install |
| `toolSandbox:install` | Install with explicit approval |
| `toolSandbox:launch` / `stop` | Start/stop tool |
| `toolSandbox:listInstalled` / `listRunning` | Query state |
| `toolSandbox:setInput` | Store API keys (encrypted) |
| `toolSandbox:renderPanel` | Render tool's custom UI |
| `toolSandbox:callFunction` | Execute tool function |
| `chronicle:read` | Read audit log |

---

## IPC Reference

### window.electronAPI

```typescript
// AI Agents
aiAgents.get(): Promise<AIAgentConfig[]>
aiAgents.set(agents): Promise<{success, error?}>
aiAgents.add(agent): Promise<{success, error?}>
aiAgents.update(id, updates): Promise<{success, error?}>
aiAgents.delete(id): Promise<{success, error?}>

// Chat History
aiAgentsHistory.getAll(agentId): Promise<ChatSession[]>
aiAgentsHistory.get(agentId, sessionId): Promise<ChatSession | null>
aiAgentsHistory.save(session): Promise<{success, error?}>
aiAgentsHistory.delete(agentId, sessionId): Promise<{success, error?}>

// Tools
tools.execute(fullName, args, context?): Promise<{success, data?, error?}>
tools.listModules(): Promise<Array<{name, displayName, toolCount, tools[]}>>
tools.getSystemPrompt(): Promise<string>
tools.getActionPatterns(): Promise<Array<{moduleName, toolName, pattern, flags}>>

// Media
media.readAsDataUri(url): Promise<{success, dataUri?, error?}>
media.getAutoDisplay(): Promise<{enabled}>
media.setAutoDisplay(enabled): Promise<{success}>

// Vault
vault.getBoxes(): Promise<VaultBox[]>
vault.getAgentBoxes(agentId): Promise<VaultBox[]>
vault.getBoxContent(boxId): Promise<VaultEntry[]>
// ... full CRUD for boxes and entries

// Nodes
nodes.get(): Promise<HypercycleNode[]>
nodes.add(node): Promise<{success, nodes?, error?}>
nodes.update(id, updates): Promise<{success, nodes?, error?}>
nodes.delete(id): Promise<{success, nodes?, error?}>
```

### window.agent (MosaicBot)

```typescript
send(text): Promise<{type: "skill"|"reply"|"error", skill?, args?, text?}>
triggerHeartbeat(agentId?): Promise<{ok}>
listSkills(): Promise<Array<{name, description}>>
onMessage(cb: (msg: {to, text, channel, messageId}) => void): void
```

### window.memory (MosaicBot)

```typescript
search(query, opts?): Promise<MemorySearchResult[]>
read(relPath, from?, lines?): Promise<{text, path}>
sync(): Promise<MemoryProviderStatus>
status(): Promise<MemoryProviderStatus>
```

### window.chatAPI (Chat Rooms)

```typescript
// Settings
getSettings(): Promise<ChatSettings>
saveSettings(s): Promise<{success, error?}>

// Connection
connect(): Promise<{success, error?}>
disconnect(): Promise<{success}>
status(): Promise<{status}>

// Rooms
listRooms(): Promise<{success, error?}>
createRoom(name, visibility?): Promise<{success, error?}>
joinRoom(roomId): Promise<{success, error?}>
leaveRoom(roomId): Promise<{success, error?}>
sendMessage(roomId, text): Promise<{success, error?}>

// Agent Assignment
assignAgent(roomId, agentId, agentName): Promise<{success}>
removeAgent(roomId, agentId): Promise<{success}>
listAssignedAgents(roomId): Promise<string[]>

// Push Events (return cleanup function)
onConnectionChanged(cb): () => void
onRoomsUpdated(cb): () => void
onJoined(cb): () => void
onMessage(cb): () => void
onMemberJoined(cb): () => void
onMemberLeft(cb): () => void
onError(cb): () => void
```

### window.mcpAPI

```typescript
// Server Management
connect(config): Promise<MCPResult>
disconnect(serverName): Promise<MCPResult>
listServers(): Promise<MCPServer[]>

// Tools
callTool(serverName, toolName, args): Promise<MCPResult<MCPToolResult>>
listTools(serverName): Promise<MCPResult<{tools}>>

// Resources
readResource(serverName, uri): Promise<MCPResult>
listResources(serverName): Promise<MCPResult<{resources}>>

// Prompts
getPrompt(serverName, promptName, args): Promise<MCPResult>
listPrompts(serverName): Promise<MCPResult<{prompts}>>

// Plugins
listPlugins(): Promise<MCPPlugin[]>
addPlugin(plugin): Promise<MCPPlugin>
updatePlugin(id, updates): Promise<MCPPlugin | null>
removePlugin(id): Promise<boolean>
connectPlugin(id): Promise<MCPResult>

// Agent Loop
runAgent(request): Promise<AgentResult>

// Push Events
onServerConnected(cb): () => void
onServerDisconnected(cb): () => void
onToolsChanged(cb): () => void
onAgentToolResult(cb): () => void
onAgentText(cb): () => void
```

---

## Data Flow Diagrams

### Interactive Chat with Tool Use

```
User → Chatview → AIService.sendMessage()
                      ↓
              LLM Response (streamed)
                      ↓
        ActionParser.parseAction(response)
                      ↓
         ┌──── Has <use_tool>? ────┐
         │ Yes                     │ No
         ↓                         ↓
  executeToolCall()           Render response
    ↓            ↓
ToolRegistry   MCPClient
    ↓            ↓
  Tool Result ←──┘
    ↓
  Append to messages
    ↓
  Call LLM again with tool output
    ↓
  Render final response
```

### MosaicBot Heartbeat Cycle

```
Timer fires (intervalMs)
    ↓
Check active hours → [outside] → skip
    ↓ [inside]
memory.search("pending tasks")
    ↓
Build prompt + memory context
    ↓
callActiveLLM(prompt, systemPrompt)
    ↓
Strip HEARTBEAT_OK token
    ↓
┌── Has content? ──┐
│ No               │ Yes
↓                  ↓
Status: ok-token   deliverMessage(channel, to, text)
                       ↓
                   ┌───┴───┐
                   IPC     HTTP
                   ↓       ↓
              BrowserWindow  Webhook
```

### Chat Room Agent Interaction

```
User sends "@AgentName help me with X" in room
    ↓
Chat Server broadcasts message to all members
    ↓
AgentRunner receives via ChatClient WebSocket
    ↓
addToHistory(roomId, message)
    ↓
Check: isAgent? → skip
Check: @mention match? → no match → skip
    ↓ match found
buildConversationContext(roomId, agentName)
  → Last 50 messages formatted as:
    "[AI] Bot: ..." or "User: ..."
    ↓
callActiveLLM(context, systemPrompt, agentId)
    ↓
ChatClient.send({ type: "send-message", roomId, text: reply })
    ↓
Chat Server broadcasts reply to room
```

---

## Configuration Files

All stored in `~/.config/mosaic-companion/` (Electron's `app.getPath("userData")`):

| File | Content |
|------|---------|
| `ai-agents.json` | Array of `AIAgentConfig` objects |
| `chat-settings.json` | `{ serverUrl, username }` |
| `chat-room-agents.json` | `Record<roomId, agentId[]>` |
| `mcp-plugins.json` | Array of `MCPPlugin` objects |
| `mosaicbot/memory/main.sqlite` | Memory search database |
| `mosaicbot/skills/` | User-managed skill files |

### Key Source Files

| File | Purpose |
|------|---------|
| `electron/main.ts` | App lifecycle, IPC registration, agent CRUD |
| `electron/preload.ts` | IPC bridge (electronAPI, chatAPI, mcpAPI, agent, memory) |
| `electron/integrations/mosaicbot/src/main/index.ts` | MosaicBot init + IPC |
| `electron/integrations/mosaicbot/src/main/llm.ts` | Main-process LLM caller |
| `electron/integrations/mosaicbot/src/main/heartbeat/runner.ts` | Heartbeat scheduling |
| `electron/integrations/mosaicbot/src/main/memory/index.ts` | Memory backend factory |
| `electron/integrations/mosaicbot/src/main/skills/registry.ts` | Skill eligibility + commands |
| `electron/integrations/chat/index.ts` | Chat IPC handlers |
| `electron/integrations/chat/client.ts` | WebSocket chat client |
| `electron/integrations/chat/agent-runner.ts` | Chat room @mention handler |
| `electron/integrations/mcp/index.ts` | MCP server integration |
| `electron/integrations/mcp/MCPClient.ts` | Multi-server MCP client |
| `electron/integrations/tools/index.ts` | Tool registry |
| `electron/integrations/sandbox/index.ts` | WASM tool manager |
| `src/services/AIService.ts` | Renderer-side LLM calls |
| `src/services/ActionParser.ts` | Tool call parsing + execution |
| `src/services/hypercycleAgent.ts` | Hypercycle protocol (TODA/Basechain) |
| `src/types/ai.ts` | Agent config + chat types |
| `global.d.ts` | Window API type declarations |
