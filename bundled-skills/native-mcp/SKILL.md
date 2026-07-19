---
name: native-mcp
description: "MCP client: connect servers, register tools (stdio/HTTP).""
version: 1.2.0
author: Hermes Agent
category: mcp
source: hermes-converted
converted_at: 2026-07-02T21:03:36.286556
---

# Native MCP Client

Hermes Agent has a built-in MCP client that connects to MCP servers at startup, discovers their tools, and makes them available as first-class tools the agent can call directly. No bridge CLI needed -- tools from MCP servers appear alongside built-in tools like `terminal`, `read_file`, etc.

## When to Use

Use this whenever you want to:
- Connect to MCP servers and use their tools from within Hermes Agent
- Add external capabilities (filesystem access, GitHub, databases, APIs) via MCP
- Run local stdio-based MCP servers (npx, uvx, or any command)
- Connect to remote HTTP/StreamableHTTP MCP servers
- Have MCP tools auto-discovered and available in every conversation

For ad-hoc, one-off MCP tool calls from the terminal without configuring anything, see the `mcporter` skill instead.

## Prerequisites

- **mcp Python package** -- optional dependency; install with `pip install mcp`. If not installed, MCP support is silently disabled.
- **Node.js** -- required for `npx`-based MCP servers (most community servers)
- **uv** -- required for `uvx`-based MCP servers (Python-based servers)

Install the MCP SDK:

```bash
pip install mcp
# or, if using uv:
uv pip install mcp
```

## Quick Start

Add MCP servers to `~/.hermes/config.yaml` under the `mcp_servers` key:

```yaml
mcp_servers:
  time:
    command: "uvx"
    args: ["mcp-server-time"]
```

Restart Hermes Agent. On startup it will:
1. Connect to the server
2. Discover available tools
3. Register them with the prefix `mcp_time_*`
4. Inject them into all platform toolsets

You can then use the tools naturally -- just ask the agent to get the current time.

## Configuration Reference

Each entry under `mcp_servers` is a server name mapped to its config. There are two transport types: **stdio** (command-based) and **HTTP** (url-based).

### Stdio Transport (command + args)

```yaml
mcp_servers:
  server_name:
    command: "npx"             # (required) executable to run
    args: ["-y", "pkg-name"]   # (optional) command arguments, default: []
    env:                       # (optional) environment variables for the subprocess
      SOME_API_KEY: "value"
    timeout: 120               # (optional) per-tool-call timeout in seconds, default: 120
    connect_timeout: 60        # (optional) initial connection timeout in seconds, default: 60
```

### HTTP Transport (url)

```yaml
mcp_servers:
  server_name:
    url: "https://my-server.example.com/mcp"   # (required) server URL
    headers:                                     # (optional) HTTP headers
      Authorization: "Bearer sk-..."
    timeout: 180               # (optional) per-tool-call timeout in seconds, default: 120
    connect_timeout: 60        # (optional) initial connection timeout in seconds, default: 60
```

### All Config Options

| Option            | Type   | Default | Description                                       |
|-------------------|--------|---------|---------------------------------------------------|
| `command`         | string | --      | Executable to run (stdio transport, required)     |
| `args`            | list   | `[]`    | Arguments passed to the command                   |
| `env`             | dict   | `{}`    | Extra environment variables for the subprocess    |
| `url`             | string | --      | Server URL (HTTP transport, required)             |
| `headers`         | dict   | `{}`    | HTTP headers sent with every request              |
| `timeout`         | int    | `120`   | Per-tool-call timeout in seconds                  |
| `connect_timeout` | int    | `60`    | Timeout for initial connection and discovery      |

Note: A server config must have either `command` (stdio) or `url` (HTTP), not both.

## How It Works

### Startup Discovery

When Hermes Agent starts, `discover_mcp_tools()` is called during tool initialization:

1. Reads `mcp_servers` from `~/.hermes/config.yaml`
2. For each server, spawns a connection in a dedicated background event loop
3. Initializes the MCP session and calls `list_tools()` to discover available tools
4. Registers each tool in the Hermes tool registry

### Tool Naming Convention

MCP tools are registered with the naming pattern:

```
mcp_{server_name}_{tool_name}
```

Hyphens and dots in names are replaced with underscores for LLM API compatibility.

Examples:
- Server `filesystem`, tool `read_file` → `mcp_filesystem_read_file`
- Server `github`, tool `list-issues` → `mcp_github_list_issues`
- Server `my-api`, tool `fetch.data` → `mcp_my_api_fetch_data`

### Auto-Injection

After discovery, MCP tools are automatically injected into all `hermes-*` platform toolsets (CLI, Discord, Telegram, etc.). This means MCP tools are available in every conversation without any additional configuration.

### Connection Lifecycle

- Each server runs as a long-lived asyncio Task in a background daemon thread
- Connections persist for the lifetime of the agent process
- If a connection drops, automatic reconnection with exponential backoff kicks in (up to 5 retries, max 60s backoff)
- On agent shutdown, all connections are gracefully closed

### Idempotency

`discover_mcp_tools()` is idempotent -- calling it multiple times only connects to servers that aren't already connected. Failed servers are retried on subsequent calls.

## Transport Types

### Stdio Transport

The most common transport. Hermes launches the MCP server as a subprocess and communicates over stdin/stdout.

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
```

The subprocess inherits a **filtered** environment (see Security section below) plus any variables you specify in `env`.

### HTTP / StreamableHTTP Transport

For remote or shared MCP servers. Requires the `mcp` package to include HTTP client support (`mcp.client.streamable_http`).

```yaml
mcp_servers:
  remote_api:
    url: "https://mcp.example.com/mcp"
    headers:
      Authorization: "Bearer sk-..."
```

If HTTP support is not available in your installed `mcp` version, the server will fail with an ImportError and other servers will continue normally.

## Security

### Environment Variable Filtering

For stdio servers, Hermes does NOT pass your full shell environment to MCP subprocesses. Only safe baseline variables are inherited:

- `PATH`, `HOME`, `USER`, `LANG`, `LC_ALL`, `TERM`, `SHELL`, `TMPDIR`
- Any `XDG_*` variables

All other environment variables (API keys, tokens, secrets) are excluded unless you explicitly add them via the `env` config key. This prevents accidental credential leakage to untrusted MCP servers.

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      # Only this token is passed to the subprocess
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_..."
```

### Credential Stripping in Error Messages

If an MCP tool call fails, any credential-like patterns in the error message are automatically redacted before being shown to the LLM. This covers:

- GitHub PATs (`ghp_...`)
- OpenAI-style keys (`sk-...`)
- Bearer tokens
- Generic `token=`, `key=`, `API_KEY=`, `password=`, `secret=` patterns

## Integration into Electron Applications

When embedding MCP into an Electron app, auto-register the server at startup and wrap its tools in a native `ToolModule` so the LLM sees stable, prefixed names.

### Critical Distinction: `hermes mcp serve` is Messaging-Only

Hermes Agent ships `hermes mcp serve` as an MCP *server* (stdio), but it exposes **only messaging tools** (conversations, messages, channels, approvals -- 10 tools). It does **not** export the full tool registry (terminal, web, file, skills, cron, kanban, etc.).

| Surface | Tools Exposed | Use Case |
|---------|---------------|----------|
| `hermes mcp serve` | 10 messaging tools | Claude Desktop/Cursor wants to pipe into Hermes sessions |
| `model_tools.py` registry | 40+ tool schemas + dispatch | The *actual* Hermes tool ecosystem |

If your Electron app wants **"all Hermes skills + all Nous futures"** available to its agents, `hermes mcp serve` alone is insufficient. You need to build or extend a bridge that exposes the full tool registry over MCP.

### Three Architectural Options for "Full Hermes" MCP Bridge

**Option A -- Hermes-side enhancement (upstream PR)**
Add a new command (e.g., `hermes mcp serve-tools`) that uses `get_tool_definitions()` + `handle_function_call()` to expose every installed tool as an MCP tool. All MCP clients (Mosaic, Claude Desktop, Cursor) gain access automatically.

```python
# Conceptual implementation path:
# 1. In mcp_serve.py or a new mcp_tools_server.py, after creating FastMCP,
#    iterate over registry.get_definitions() to register each tool dynamically.
# 2. The handler proxy wraps handle_function_call(tool_name, args, task_id).
# 3. Each tool call returns the JSON string the Hermes handler already produces.
```

**Option B -- Mosaic-side bundled server**
Create a Node.js zero-dependency stdio MCP server (`electron/integrations/mcp/servers/hermes-tools-mcp-server.js`) that spawns `hermes chat -q "execute tool X with args Y"` and wraps the response in MCP format. Less efficient but requires no Hermes core changes.

```typescript
// electron/integrations/mcp/servers/hermes-tools-mcp-server.js
// 1. On startup, runs `hermes tools list --json` to discover available tools.
// 2. Registers each tool via JSON-RPC mcp/tools/list.
// 3. Each handler spawns `hermes chat -q JSON.stringify(tool_call)` and returns stdout.
```

**Option C -- Hybrid (recommended)**
1. Build the tool bridge in Hermes core (Option A) so all MCP clients benefit.
2. Auto-register it in Mosaic's `ensureDefaultPlugins()` with:
   ```typescript
   {
     name: "hermes-tools",
     transport: "stdio",
     command: "hermes",
     args: ["mcp", "serve-tools", "--profile", "default"],
     autoConnect: true,
   }
   ```
3. Add a `ToolModule` proxy in Mosaic that presents `hermes_terminal`, `hermes_web_search`, etc. as native-sounding tool names to Mosaic agents.

### Boundary Check Before Implementation

If your project has an *integration boundary* (e.g., "Midnight must stay out of Mosaic"), verify whether: (a) a generic Hermes TCP/stdio bridge violates it, (b) a Hermes core PR stays outside the boundary, or (c) the boundary applies to *specific tool categories* rather than transport infrastructure. Do not auto-pass the bridge through without verifying scope.

### Auto-Registration in Plugin Manager

Persist a default plugin entry in the Electron main process so users do not need to edit `config.yaml`:

```typescript
function ensureDefaultPlugins(): void {
  const plugins = loadPlugins(); // from mcp-plugins.json
  if (!plugins.find(p => p.name === 'midnight-mcp')) {
    plugins.push({
      name: 'midnight-mcp',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'midnight-mcp@latest'],
      autoConnect: true,
      enabled: true
    });
    savePlugins(plugins);
  }
}
```

Call `ensureDefaultPlugins()` inside `initPlugins()` before loading the UI.

### Native ToolModule Bridge

Do not rely solely on dynamic MCP discovery. Create a `ToolModule` class that proxies to the MCP client:

```typescript
export class MidnightModule implements ToolModule {
  name = 'midnight';
  getTools() { return [ /* stable descriptors */ ]; }
  async execute(toolName: string, args: any) {
    const mcpTool = toolName.replace('midnight_', '');
    return mcpClient.callTool('midnight-mcp', mcpTool, args);
  }
  getSystemPrompt() { return 'Compact language, ZK circuits, NIGHT/DUST tokens...'; }
}
```

Register the module in `ToolRegistry` alongside Gmail, Web3, Vault, etc.

### Global Install vs App Dependency

Install MCP servers globally or run them via `npx -y` rather than adding them to the app's `package.json`. This avoids bloating the app dependency tree and allows independent updates.

```bash
npm install -g midnight-mcp@latest
```

### Bundled Node.js Stdio Server Pattern (No npm dependency)

For servers that must work offline and avoid `npx` registry hits, ship a zero-dependency Node.js script that implements the MCP stdio protocol directly and shells out to a local CLI.

**Example: gbrain in Mosaic Companion.**

File: `electron/integrations/mcp/servers/gbrain-mcp-server.js`

- 415 lines, zero npm dependencies (built-in `child_process`, `readline`, `path`, `os`).
- Registers 7 tools: `gbrain_search`, `gbrain_query`, `gbrain_get_page`, `gbrain_list_pages`, `gbrain_graph`, `gbrain_get_stats`, `gbrain_code_callers`.
- Each tool call spawns `gbrain <subcommand> --json <args>` and returns stdout as MCP `content`.
- Fixed `GBRAIN_HOME` resolution at startup (see Pitfall #4 below).

Auto-registration:

```typescript
function ensureDefaultPlugins(): void {
  const existing = pluginManager.list();
  if (!existing.some((p) => p.name === "gbrain")) {
    pluginManager.add({
      name: "gbrain",
      description: "Personal knowledge graph",
      transport: "stdio",
      command: "node",
      args: [require.resolve("./servers/gbrain-mcp-server.js")],
      env: {},
      autoConnect: true,
    });
  }
}
```

**Packaging rule.** Add the `servers/` directory to your Electron build assets (e.g. `extraResources` in `electron-builder.yml`) or the script disappears in packaged builds and `require.resolve()` throws.

### Electron IPC Bridge Lifecycle Pattern: on-demand daemon spawn

When the app needs a **local service** (e.g., `hermes dashboard`) that is NOT automatically running, add IPC handlers in the main process to spawn it on-demand, bridge its lifecycle events, and expose status to the renderer.

**Use case in this session:**
- Hermes AIM Docker container exposes a "Open Hermes Kanban" button.
- The Kanban URL (`http://127.0.0.1:9119`) has no server listening by default.
- Raw `window.open('http://127.0.0.1:9119')` fails silently.

**Solution:** IPC bridge that auto-starts the daemon on first click.

**1. `electron/preload.ts` -- expose IPC to renderer:**
```typescript
hermes: {
  startDashboard: (port?: number) => ipcRenderer.invoke("hermes:start-dashboard", port),
  stopDashboard: () => ipcRenderer.invoke("hermes:stop-dashboard"),
  dashboardStatus: () => ipcRenderer.invoke("hermes:dashboard-status"),
}
```

**2. `electron/main.ts` -- main process handlers:**
```typescript
ipcMain.handle("hermes:start-dashboard", async (_event, port = 9119) => {
  // Check if already running
  const probe = spawn("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code", `http://127.0.0.1:${port}`]);
  const probeCode = await new Promise(resolve => probe.on("close", resolve));
  if (probeCode === 200) {
    return { status: "already-running" };
  }

  // Spawn detached daemon
  const child = spawn("hermes", ["dashboard", "--port", String(port), "--no-open"], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, HERMES_PORT: String(port) },
  });
  child.unref();

  // Wait for port to come up (max 10s)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const check = spawn("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://127.0.0.1:${port}`]);
    const code = await new Promise(resolve => check.on("close", resolve));
    if (code === 200) {
      return { status: "started", pid: child.pid };
    }
  }

  return { status: "timeout", pid: child.pid };
});

ipcMain.handle("hermes:stop-dashboard", async () => {
  // find PID via pgrep or stored ref, SIGTERM
});

ipcMain.handle("hermes:dashboard-status", async (_event, port = 9119) => {
  const probe = spawn("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://127.0.0.1:${port}`]);
  const code = await new Promise(resolve => probe.on("close", resolve));
  return { running: code === 200, port };
});
```

**Key rules for daemon spawn in Electron:**
- Always use `detached: true` + `stdio: "ignore"` + `unref()` so the daemon survives Electron exit and does not hold file descriptors.
- Probe before spawning (avoid double-spawn).
- Timeout the health check (max ~10s) and return `{ status: "timeout" }` so renderer can show spinner.
- Store PID somewhere (in-memory or `electron-store`) so `stop` can SIGTERM.

**3. Renderer handler -- async before open:**
```typescript
async function openHermesKanban() {
  try {
    const result = await window.electronAPI.hermes.startDashboard();
    if (result.status === "started" || result.status === "already-running") {
      window.open("http://127.0.0.1:9119");
    } else {
      setStatus("Dashboard spawn timed out. Is hermes CLI on PATH?");
    }
  } catch {
    // IPC unavailable -- fall back to raw open
    window.open("http://127.0.0.1:9119");
  }
}
```

**When to use this pattern over a bundled MCP server:**
- The target process (`hermes dashboard`) is a **user-level CLI tool**, not a bundled npm package
- The process needs to run **as a long-lived daemon** independent of the app lifecycle
- The process must survive app restart and be shared by multiple features

### Stdio Testing Pitfall

Some MCP versions (e.g., `midnight-mcp` v0.2.18+) do **not** recognize a `--stdio` flag — the default transport is already stdio. Passing the flag produces `Unknown argument: stdio`. Test raw JSON-RPC by invoking the binary directly and writing requests to stdin.

**Known good test sequence for `midnight-mcp` v0.2.21:**
```bash
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  echo '{"jsonrpc":"2.0","id":2,"method":"initialized","params":{}}'
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/list"}'
) | npx -y midnight-mcp@0.2.21
```

The server will log ChromaDB fallback warnings but still return the full tool list (29 tools). It does **not** need `--stdio`.

### Auth-Required HTTP MCP Servers in Electron (OAuth vs API Key)

Remote HTTP MCP servers often require authentication. There are **two distinct patterns** — never conflate them:

| Pattern | Server Examples | Auth UI | Implementation |
|---|---|---|---|
| **OAuth redirect** | Some enterprise MCP portals | Browser login page with redirect to `/callback` | Sandboxed `BrowserWindow` + redirect token extraction |
| **API key / Bearer token** | CDP APIs, most hosted SaaS MCP | None — key generated on a developer portal | Inline password input in renderer |

**Critical pitfall — Category confusion:**
`https://mcp.base.org` is an **MCP API endpoint**, not a web login page. Opening it in a `BrowserWindow` returns `{"error":"invalid_token"}` because it speaks the MCP protocol, not HTML. There is no `/callback` redirect, no session cookie, and no form to fill. The `@modelcontextprotocol/sdk` `StreamableHTTPClientTransport` only accepts static `Authorization: Bearer` headers — it does **not** negotiate OAuth itself.

**For Base MCP / Coinbase Developer Platform MCP:**
1. User generates an API key at `https://portal.cdp.coinbase.com/`
2. In the app, click **Connect** on the `base-mcp` card
3. Inline input appears: "Paste your API key..."
4. App saves key via `pluginManager.update(id, { apiKey: key })`
5. App calls `mcpClient.connect({ name, transport: "http", url, apiKey: key })`

**Implementation (renderer):**
```typescript
const handleConnect = async (plugin: MCPPlugin) => {
  if (plugin.oauthRequired && !plugin.apiKey) {
    setAuthPluginId(plugin.id);  // show inline input, don't open BrowserWindow
    return;
  }
  await api.connectPlugin(plugin.id);
};
```

**Implementation (main process):**
```typescript
ipcMain.handle("mcp:set-apikey-and-connect", async (_event, id, apiKey) => {
  const plugin = pluginManager.get(id);
  pluginManager.update(id, { apiKey });
  await mcpClient.connect({ name: plugin.name, transport: "http", url: plugin.url, apiKey });
});
```

**Key rule: `autoConnect: false` is mandatory.**
Setting `autoConnect: true` causes the startup connect loop to POST to the API endpoint without a Bearer token. The server returns `{error:"invalid_token"}` on every startup, producing noisy log spam.

**When to use BrowserWindow OAuth:**
Only when the remote server **is** an OAuth authorization server with a real HTML login form and a documented callback URL (e.g. `https://auth.example.com/authorize` redirecting to `https://auth.example.com/callback`). Verify this by curling the URL — if it returns HTML, BrowserWindow is appropriate. If it returns JSON or MCP protocol messages, use API key input instead.

**Reference:** `references/oauth-gated-mcp-electron.md` covers the full BrowserWindow OAuth pattern with production hardening. **Do not use that pattern for Base MCP.**

**CDP API Key Format Note:**
Coinbase Developer Platform API keys are **key pairs** (API Key Name + API Key Secret), not simple Bearer tokens. The Secret is an EC private key used to create JWT signatures. Passing the raw Key Name as `Authorization: Bearer <key>` will produce `invalid_token` because the server expects a JWT signed with the Secret. See `references/api-key-mcp-electron.md` for the full CDP auth flow and diagnostic steps.

## Pitfalls

### 0. `hermes mcp serve` is NOT the full toolset

`hermes mcp serve` only exposes 10 messaging tools. For the full Hermes tool registry (40+ tools), use `hermes mcp serve-tools`. This command was an orphan module in v1.26.0 — if it is missing from your build, the wiring may be incomplete. See `references/hermes-mcp-serve-tools-wiring.md`.

### 1. `args` must be a YAML list, never a JSON string

`hermes config set mcp_servers.<name>.args '["-y", "pkg"]'` writes a quoted JSON string, but the MCP SDK expects `args` to be an actual list. The resulting error is:

```
1 validation error for StdioServerParameters
args
  Input should be a valid list [type=list_type, input_value='["-y", "pkg"]', input_type=str]
```

**Fix:** Write the list as native YAML:
```yaml
mcp_servers:
  atomicmail:
    command: npx
    args:
    - -y
    - "@atomicmail/mcp-github"
    connect_timeout: 120
    timeout: 120
```

If you already used `hermes config set` with a JSON string, open `hermes config edit` (or patch `~/.hermes/config.yaml`) and replace the single-quoted string with a real YAML list.

### 2. `npx -y <pkg>@latest` is brittle -- use `require.resolve()`

Never auto-spawn an MCP server via `npx -y <package>@latest` in production Electron apps. The npm registry can serve corrupted builds, ESM parse errors, or incompatible transitive dependencies that break silently on certain Node versions.

**Symptom:** `initPlugins()` catches a spawn error but only logs to main-process stdout. Renderer sees no MCP tools and no error.
**Root cause:** `npx` downloads the latest registry build on-the-fly; a local `npm install` may have cached a working copy while `npx` pulls a broken one.
**Fix:** Resolve the locally installed binary via `require.resolve("<pkg>/package.json")` and spawn with `node <local_bin_path>`.

```typescript
const localBin = require("path").join(
  require("path").dirname(require.resolve("midnight-mcp/package.json")),
  "dist",
  "bin.js",
);
pluginManager.add({
  name: "midnight-mcp",
  transport: "stdio",
  command: "node",
  args: [localBin],
  autoConnect: true,
});
```

See `references/mcp-electron-spawn-pitfalls.md` for full reproduction recipe and `templates/electron-mcp-auto-connect.ts` for a drop-in `ensureDefaultPlugins()` function.

### 2. Main-process errors are invisible to the renderer

MCP spawn failures, stdio parse errors, and connection timeouts all happen in the Electron **main process**. By default they only appear in the terminal where `npm run start` was launched. The renderer DevTools console shows nothing, leaving users confused.

**Fix:** Bridge all MCP lifecycle events to the renderer via IPC:
- On successful connect → `notifyRenderer("mcp:server-connected", { name, tools, resources, prompts })`
- On disconnect → `notifyRenderer("mcp:server-disconnected", { name, code })`
- On error → `notifyRenderer("mcp:server-error", { name, error })`

In the renderer (e.g., `MCPPage.tsx`), attach listeners:
```typescript
const offError = api.onServerError(({ name, error }) => {
  console.error(`[MCP] Server error from "${name}":`, error);
  setError(`MCP server "${name}" error: ${error}`);
});
```

### 3. Stale main-process builds after `electron/` edits

Vite rebuilds the renderer; esbuild rebuilds the main process. After editing `electron/integrations/mcp/index.ts`, a plain `npm run build` may not recompile the main process. Always run `npm run build:electron` (or `rm -rf dist/ && npm run build:electron && npm run build`) after any main-process change.

### 4. Missing bundled server files in packaged Electron builds

When you ship a bundled `.js` server file alongside the app (e.g. `electron/integrations/mcp/servers/gbrain-mcp-server.js`), Vite / esbuild will NOT include it in the app bundle unless explicitly configured. The file works in dev (`npm run start`) but vanishes in the packaged app, causing `require.resolve()` to throw `MODULE_NOT_FOUND`.

**Symptom:** Dev works fine. Packaged app (or `npm run package`) crashes with `Error: Cannot find module '.../gbrain-mcp-server.js'` during `initPlugins()`.
**Root cause:** Electron-builder / Forge only packages files listed in `files` or `extraResources`. The `servers/` directory is outside the standard build tree.
**Fix:** Add the glob to `electron-builder.yml` (or equivalent):

```yaml
extraResources:
  - from: "electron/integrations/mcp/servers/"
    to: "servers/"
    filter: ["**/*"]
```

Or in `forge.config.js`:
```javascript
packagerConfig: {
  extraResource: [
    path.join(__dirname, "electron", "integrations", "mcp", "servers"),
  ],
},
```

After changing packaging config, test with `npm run package` and inspect `dist/` to confirm the file exists.

## Templates (in skill)

| Template | Purpose |
|----------|---------|
| `templates/electron-mcp-auto-connect.ts` | Drop-in `ensureDefaultPlugins()` with `require.resolve()` spawn pattern for Electron MCP auto-registration |
| `templates/electron-mcp-oauth-handler.ts` | Drop-in `mcp:oauth-connect` IPC handler for OAuth-gated HTTP MCP servers (HTML login pages) |
| `templates/electron-midnight-toolmodule.ts` | Drop-in Mosaic `ToolModule` that proxies 14 `midnight-mcp` tools into the Mosaic tool registry |

## References (in skill)

| Reference | Purpose |
|-----------|---------|
| `references/mcp-electron-spawn-pitfalls.md` | Full reproduction recipe: `npx` corruption vs local install, stdio flag behavior, error bridging, stale build pitfall |
| `references/hermes-mcp-serve-tools-wiring.md` | `hermes mcp serve-tools` orphan-code wiring: `main.py` subparser + `mcp_config.py` action dispatch |
| `references/hermes-mosaic-mcp-integration.md` | Hermes proxy option |
| `references/mosaic-midnight-mcp-integration.md` | Concrete Mosaic-Companion wiring for `midnight-mcp`, including the `dist/bin.js` stdio entry point |
| `references/oauth-gated-mcp-electron.md` | Complete OAuth-gated MCP integration: BrowserWindow pattern, multi-strategy token extraction, sandbox, pitfall guide |
| `references/api-key-mcp-electron.md` | API-key gated MCP servers (Base MCP, CDP, hosted SaaS): inline input pattern, curl pre-flight check, architecture |
| `references/codebase-memory-mcp-integration.md` | Static-binary MCP server integration proven with DeusData/codebase-memory-mcp: install, Hermes config, Mosaic default plugin, verification |
| `references/atomicmail-mcp.md` | Atomic Mail agentic email MCP: verified Hermes config, `args` pitfall, credential-directory binding, and outbound identity tips |
| `references/atomicmail-register-stdio-probe.md` | Direct stdio JSON-RPC probe for Atomic Mail `register` (useful for setup/replacement debugging) |
| `references/base-mcp-integration.md` | Base (Coinbase L2) MCP: deprecated-package warning, remote HTTP endpoint, Hermes config, Mosaic OAuth pattern, on-chain capabilities list |

## Troubleshooting

### "MCP SDK not available -- skipping MCP tool discovery"

The `mcp` Python package is not installed. Install it:

```bash
pip install mcp
```

### "No MCP servers configured"

No `mcp_servers` key in `~/.hermes/config.yaml`, or it's empty. Add at least one server.

### "Failed to connect to MCP server 'X'"

Common causes:
- **Command not found**: The `command` binary isn't on PATH. Ensure `npx`, `uvx`, or the relevant command is installed.
- **Package not found**: For npx servers, the npm package may not exist or may need `-y` in args to auto-install.
- **Timeout**: The server took too long to start. Increase `connect_timeout`.
- **Port conflict**: For HTTP servers, the URL may be unreachable.

### "MCP server 'X' requires HTTP transport but mcp.client.streamable_http is not available"

Your `mcp` package version doesn't include HTTP client support. Upgrade:

```bash
pip install --upgrade mcp
```

### Tools not appearing

- Check that the server is listed under `mcp_servers` (not `mcp` or `servers`)
- Ensure the YAML indentation is correct
- Look at Hermes Agent startup logs for connection messages
- Tool names are prefixed with `mcp_{server}_{tool}` -- look for that pattern

### Connection keeps dropping

The client retries up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s, capped at 60s). If the server is fundamentally unreachable, it gives up after 5 attempts. Check the server process and network connectivity.

## Examples

### Time Server (uvx)

```yaml
mcp_servers:
  time:
    command: "uvx"
    args: ["mcp-server-time"]
```

Registers tools like `mcp_time_get_current_time`.

### Filesystem Server (npx)

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"]
    timeout: 30
```

Registers tools like `mcp_filesystem_read_file`, `mcp_filesystem_write_file`, `mcp_filesystem_list_directory`.

### GitHub Server with Authentication

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxxxxxxxxxxxxxxxxxxx"
    timeout: 60
```

Registers tools like `mcp_github_list_issues`, `mcp_github_create_pull_request`, etc.

### Remote HTTP Server

```yaml
mcp_servers:
  company_api:
    url: "https://mcp.mycompany.com/v1/mcp"
    headers:
      Authorization: "Bearer sk-xxxxxxxxxxxxxxxxxxxx"
      X-Team-Id: "engineering"
    timeout: 180
    connect_timeout: 30
```

### Atomic Mail MCP Server

Autonomous `@atomicmail.ai` inboxes for AI agents: proof-of-work signup, send/receive/search, drafts, attachments via JMAP. Good for outbound campaigns, lead-gen assistants, or giving every agent its own email identity.

**Hermes config:**
```yaml
mcp_servers:
  atomicmail:
    command: npx
    args:
    - -y
    - "@atomicmail/mcp-github"
    connect_timeout: 120
    timeout: 120
```

**Verification:**
```bash
hermes mcp list
hermes mcp test atomicmail
```

Expected: 3 tools (`register`, `jmap_request`, `help`).

**Critical implementation notes**
1. `args` must be a real YAML list, not a JSON string. `hermes config set` with `'["-y", "@atomicmail/mcp-github"]'` writes a quoted string and fails with `Input should be a valid list`. Edit `~/.hermes/config.yaml` manually if needed.
2. The server binds **one inbox per credential directory** (default `~/.atomicmail/`). To replace the active inbox, back up the dir then register with `forced: true`. To add a second inbox, use a different `credentials_dir` argument or env var `ATOMIC_MAIL_CREDENTIALS_DIR`.
3. `jmap_request` accepts `ops` as a **JSON string** (methodCalls array), not a raw array. `vars` values must be strings (join arrays with commas). Read the reference for concrete JMAP examples and gotchas.
4. For outbound/lead-gen, prefer real-sounding usernames/display names (e.g. `ruby-outreach`, `emma-bd`) over generic `company-leads` handles.
5. The npm package entry point is `node_modules/@atomicmail/mcp-github/esm/mcp/main.js` for bundled/Electron use; do not assume `dist/index.js`.

**In Electron / Mosaic Companion:** Register as a default MCP plugin using `npx -y @atomicmail/mcp-github` (or the local ESM entry point), then bridge to a native `ToolModule` that exposes agent-friendly names like `atomicmail:registerInbox`, `atomicmail:sendEmail`, `atomicmail:readInbox`, `atomicmail:searchEmails`, `atomicmail:emailHelp`, `atomicmail:getStatus`. See `references/atomicmail-mcp.md` for the full Mosaic integration recipe and JMAP gotchas.

### Codebase Memory MCP Server

`codebase-memory-mcp` is a high-performance static-binary MCP server that builds a persistent knowledge graph over a codebase. It is an example of integrating a repo that ships its own MCP server rather than a prompt library.

**Install:**
```bash
mkdir -p /tmp/cbm && cd /tmp/cbm
curl -fsSL -o cbm.tar.gz https://github.com/DeusData/codebase-memory-mcp/releases/download/v0.8.1/codebase-memory-mcp-linux-amd64.tar.gz
tar -xzf cbm.tar.gz
./install.sh
~/.local/bin/codebase-memory-mcp --version
```

**Hermes config:**
```yaml
mcp_servers:
  codebase_memory:
    command: /home/mauricio/.local/bin/codebase-memory-mcp
    args: []
    timeout: 120
    connect_timeout: 60
```

**Verify:**
```bash
hermes mcp list
hermes mcp test codebase_memory
```

**In Electron / Mosaic Companion:** Add the binary path to `ensureDefaultPlugins()` (or read it from `process.env.CODEBASE_MEMORY_MCP_PATH`) and register with `transport: "stdio"`, `args: []`, `autoConnect: true`. Static binaries have zero npm dependencies and start instantly, making them safer default plugins than `npx`-based servers.

### Midnight MCP Server (Blockchain Contract Intelligence)

Example configuration for the `midnight-mcp` server -- an MCP server exposing 29 tools for the Midnight privacy-preserving blockchain (zkSNARKs L1). Useful for AI-assisted Compact contract generation, compilation, and review.

```yaml
mcp_servers:
  midnight:
    command: "npx"
    args: ["-y", "midnight-mcp@latest"]
    env:
      GITHUB_TOKEN: "ghp_..."   # Optional: raises GitHub rate limit to 5000 req/hr
    sampling:
      enabled: true             # Required for AI generation tools (generate-contract, review-contract, etc.)
      max_rpm: 10
      max_tool_rounds: 5
    timeout: 120
    connect_timeout: 60
```

Tools register as `mcp_midnight_*` (e.g., `mcp_midnight_search_compact`, `mcp_midnight_compile_contract`). The server supports hosted mode (default, Cloudflare Workers) and local mode (`MIDNIGHT_LOCAL=true` + ChromaDB). See `references/midnight-mcp-server.md` for full tool catalog and architecture details.

### Multiple Servers

```yaml
mcp_servers:
  time:
    command: "uvx"
    args: ["mcp-server-time"]

  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxxxxxxxxxxxxxxxxxxx"

  company_api:
    url: "https://mcp.internal.company.com/mcp"
    headers:
      Authorization: "Bearer sk-xxxxxxxxxxxxxxxxxxxx"
    timeout: 300
```

All tools from all servers are registered and available simultaneously. Each server's tools are prefixed with its name to avoid collisions.

## Sampling (Server-Initiated LLM Requests)

Hermes supports MCP's `sampling/createMessage` capability -- MCP servers can request LLM completions through the agent during tool execution. This enables agent-in-the-loop workflows (data analysis, content generation, decision-making).

Sampling is **enabled by default**. Configure per server:

```yaml
mcp_servers:
  my_server:
    command: "npx"
    args: ["-y", "my-mcp-server"]
    sampling:
      enabled: true           # default: true
      model: "gemini-3-flash" # model override (optional)
      max_tokens_cap: 4096    # max tokens per request
      timeout: 30             # LLM call timeout (seconds)
      max_rpm: 10             # max requests per minute
      allowed_models: []      # model whitelist (empty = all)
      max_tool_rounds: 5      # tool loop limit (0 = disable)
      log_level: "info"       # audit verbosity
```

Servers can also include `tools` in sampling requests for multi-turn tool-augmented workflows. The `max_tool_rounds` config prevents infinite tool loops. Per-server audit metrics (requests, errors, tokens, tool use count) are tracked via `get_mcp_status()`.

Disable sampling for untrusted servers with `sampling: { enabled: false }`.

## Notes

- MCP tools are called synchronously from the agent's perspective but run asynchronously on a dedicated background event loop
- Tool results are returned as JSON with either `{"result": "..."}` or `{"error": "..."}`
- The native MCP client is independent of `mcporter` -- you can use both simultaneously
- Server connections are persistent and shared across all conversations in the same agent process
- Adding or removing servers requires restarting the agent (no hot-reload currently)