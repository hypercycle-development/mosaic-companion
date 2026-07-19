---
name: hermes-mcp-integration
description: "Expose Hermes' full tool and skill registry over MCP, and auto-register it in client applications like Mosaic Companion.""
version: 1.0.0
author: Hermes Agent
category: devops
source: hermes-converted
converted_at: 2026-07-02T21:03:36.287573
---

# Hermes MCP Integration

This skill covers the dual-sided pattern of exposing Hermes Agent's full tool ecosystem over the Model Context Protocol (MCP) stdio transport, and auto-registering that server in downstream client applications (Electron/Node.js apps like Mosaic Companion).

## The Core Gap

Hermes Agent has two MCP surfaces that are easily confused:

1. **`hermes mcp add` (MCP *client*)** — Connects to *external* MCP servers. Stable, well-documented, tools appear as `mcp_github_*` in Hermes.
2. **`hermes mcp serve` (MCP *server*)** — Exposes *itself* as an MCP server, but **only 10 messaging tools** (conversations, messages, channels). It does NOT export `terminal`, `read_file`, `browser_navigate`, `skill_view`, `cronjob`, `kanban_*`, `delegate_task`, `web_search`, etc.

The actual tool registry lives in `~/hermes/model_tools.py` (`get_tool_definitions()`, `handle_function_call()`) and `~/hermes/tools/registry.py`. These ~45 tools were never wired to MCP before this pattern.

## Dual-Sided Integration Pattern

### Option C (Verified, Recommended)

1. **Upstream Hermes**: Build `hermes mcp serve-tools` — a FastMCP stdio server that dynamically introspects `get_tool_definitions()` and wraps each tool via `handle_function_call()`.
2. **Downstream Client**: Auto-register the server in `ensureDefaultPlugins()` with binary discovery and `autoConnect: true`.

This is the only pattern that gives *all* MCP clients (Mosaic, Claude Desktop, Cursor) instant access to Hermes tools without per-client bridge code.

---

## Session Finding: v1.26.0 Already Live

In production (Mosaic Companion + Hermes v1.26.0), `hermes mcp serve-tools --accept-hooks` is **already running as a registered MCP server**:

```
[MCP] Registered default plugin: hermes-tools (cmd: /home/mauricio/hermes/venv/bin/python3, ... "mcp","serve-tools","--accept-hooks")
[MCP] Connected: hermes-tools (hermes-tools v1.26.0)
[MCP] hermes-tools tools: [
  'browser_back', 'browser_click', ..., 'kanban_block', ..., 'skill_view',
  'terminal', ..., 'call_hermes_tool'
]
```

**This is the only pattern that gives *all* MCP clients (Mosaic, Claude Desktop, Cursor) instant access to Hermes tools without per-client bridge code.**

**OAuth 2.0 Support Note:** The `@modelcontextprotocol/sdk` (v1.10+) supports OAuth natively via `StreamableHTTPClientTransport` with an `authProvider`. However, the SDK's built-in `auth()` helper assumes a web browser environment (uses `window.location`). In Electron apps, you must implement the flow **manually** using `BrowserWindow` + redirect interception. See `references/remote-http-mcp-default-plugin.md` for the full manual OAuth implementation pattern.

**Correction (v2):** An earlier version of this skill incorrectly stated that the SDK does not support OAuth and that `mcp.base.org` uses API keys. Both were wrong:
- `mcp.base.org` requires **OAuth 2.0 authorization_code + PKCE** (confirmed via `/.well-known/oauth-authorization-server`)
- The SDK **does** support OAuth via `StreamableHTTPClientTransport({ authProvider })`
- CDP API keys (`bdev_...`) are for the **deprecated** `base-mcp-legacy` local package, NOT for `mcp.base.org`

**Correction (v3 — Session Proven):** The BrowserWindow + manual PKCE approach described in `references/remote-http-mcp-default-plugin.md` was **abandoned** for `mcp.base.org` because the Base authorization page is a modern React SPA that cannot render in an Electron BrowserWindow with `nodeIntegration: false`, `contextIsolation: true`. The **correct architecture** is to configure the remote HTTP MCP server in `~/.hermes/config.yaml` and let Hermes' built-in `mcp_oauth.py` handle the full OAuth 2.1 PKCE flow using the **user's real browser** + localhost callback. This is the approach Base's own docs recommend. See `references/coinbase-base-mcp-auth.md` for the full corrected architecture and `references/hermes-native-oauth-vs-electron-browserwindow.md` for the comparative analysis.

See `references/coinbase-base-mcp-auth.md` for the corrected auth architecture (includes standalone Hermes CLI flow and Electron/Mosaic-Companion delegation pattern).
See `references/hermes-native-oauth-vs-electron-browserwindow.md` for the comparative analysis.
---

## Side A: Hermes Core — `mcp serve-tools`

### Implementation: `mcp_serve_tools.py`

Create a new file in the Hermes repo root (or alongside `mcp_serve.py`):

```python
"""Hermes Tool MCP Server — exposes full tool/skill registry over stdio."""
from __future__ import annotations

import asyncio
import inspect
import json
import os
import signal
import sys
import traceback
from contextlib import asynccontextmanager
from typing import Any

from mcp.server.fastmcp import FastMCP

HERMES_HOME = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
if str(HERMES_HOME) not in sys.path:
    sys.path.insert(0, str(HERMES_HOME))

# Import must happen after sys.path fix
from model_tools import get_tool_definitions, handle_function_call


def _map_json_type_to_python(prop: dict) -> type:
    t = prop.get("type", "string")
    if t == "string":
        return str
    if t == "integer":
        return int
    if t == "number":
        return float
    if t == "boolean":
        return bool
    if t == "array":
        return list
    if t == "object":
        return dict
    return str


def _make_handler(tool_schema: dict, verbose: bool, task_id: str | None):
    props = tool_schema.get("parameters", {}).get("properties", {})
    required = tool_schema.get("parameters", {}).get("required", [])

    params = []
    for name, prop in props.items():
        is_req = name in required
        if is_req:
            params.append(
                inspect.Parameter(
                    name,
                    inspect.Parameter.KEYWORD_ONLY,
                    annotation=_map_json_type_to_python(prop),
                )
            )
        else:
            params.append(
                inspect.Parameter(
                    name,
                    inspect.Parameter.KEYWORD_ONLY,
                    default=None,
                    annotation=_map_json_type_to_python(prop),
                )
            )

    sig = inspect.Signature(params)

    async def _handler(**kwargs):
        clean = {k: v for k, v in kwargs.items() if v is not None}
        if verbose:
            print(f"[mcp-tools] {tool_schema['name']} called with {clean!r}", file=sys.stderr)
        try:
            result = handle_function_call(
                function_name=tool_schema["name"],
                function_args=clean,
                task_id=task_id,
            )
        except Exception:
            return json.dumps({"error": traceback.format_exc()})
        return result if isinstance(result, str) else json.dumps(result)

    _handler.__signature__ = sig
    _handler.__doc__ = tool_schema.get("description", "")
    _handler.__name__ = tool_schema["name"]
    return _handler


def _check_toolset_conflicts(toolsets: set[str] | None, exclude_toolsets: set[str] | None) -> None:
    pass  # Hermes internals handle per-toolset enablement; this is for future filtering


def create_tool_mcp_server(
    verbose: bool = False,
    toolsets: list[str] | None = None,
    exclude_toolsets: list[str] | None = None,
    include_tools: list[str] | None = None,
    exclude_tools: list[str] | None = None,
) -> FastMCP:
    server = FastMCP("hermes-tools")

    definitions = get_tool_definitions(quiet_mode=True)
    _check_toolset_conflicts(
        set(toolsets) if toolsets else None,
        set(exclude_toolsets) if exclude_toolsets else None,
    )

    for tool in definitions:
        schema = tool.get("function", tool)
        name = schema["name"]

        if include_tools and name not in include_tools:
            continue
        if exclude_tools and name in exclude_tools:
            continue

        # Skip tools that can't execute (schema-only, no handler)
        handler_fn = _make_handler(schema, verbose=verbose, task_id=None)
        server.add_tool(handler_fn, name=name, description=schema.get("description", ""))

    # ---- Meta tools (skill management beyond registry) ----
    @server.tool()
    async def list_hermes_skills() -> str:
        """Return all installed Hermes skills."""
        from skills_manager import skills_manager
        skills = skills_manager.list_skills()
        return json.dumps({"skills": skills})

    @server.tool()
    async def view_hermes_skill(name: str) -> str:
        """View the full markdown content of a Hermes skill by name."""
        from skills_manager import skills_manager
        return skills_manager.view_skill(name)

    @server.tool()
    async def manage_hermes_skill(
        action: str,
        name: str,
        content: str | None = None,
    ) -> str:
        """Create, patch, edit, or delete a Hermes skill."""
        from skills_manager import skills_manager
        return skills_manager.manage(action=action, name=name, content=content)

    @server.tool()
    async def hermes_metadata() -> str:
        """Return Hermes version, profile, home, and tool count."""
        return json.dumps({
            "version": os.environ.get("HERMES_VERSION", "unknown"),
            "profile": os.environ.get("HERMES_PROFILE", "default"),
            "home": HERMES_HOME,
            "tools_registered": len(definitions),
        })

    return server


async def run_mcp_tools_server(**kwargs) -> None:
    server = create_tool_mcp_server(**kwargs)
    await server.run_stdio_async()
```

### Critical Pitfall: `PYTHONHOME` Corrupts Venv Python in Electron

When spawning a venv Python from Node.js / Electron, **never set `PYTHONHOME`** — even to the venv path. The venv's `pyvenv.cfg` already contains the correct standard library path. Setting `PYTHONHOME` overrides it and produces a mangled `sys.path` containing literal `'lib'` strings, causing immediate exit code 1.

**Correct env vars:**
- `PATH`: prepend `~/hermes/venv/bin` so `dotenv`, `mcp`, etc. site-packages are resolvable
- `PYTHONPATH: ~/hermes` so `main.py` can import `model_tools`, `mcp_serve_tools`
- **No `PYTHONHOME`**

See `references/electron-spawn-pitfalls.md` for the full isolation test recipe.

FastMCP/Pydantic *requires* concrete function signatures. A naive wrapper `async def _handler(**kwargs)` produces:

```
ValidationError: kwargs Field required
```

**Fix:** Synthesize `inspect.Signature` from JSON schema `properties`. Map `"string"→str`, `"integer"→int`, etc. Optional args default to `None`. Required args have no default.

### Critical Pitfall: Name Extraction from Nested Schema

`get_tool_definitions()` returns OpenAI-format objects where the tool info is nested under `"function"`. A naive `tool.get("name")` returns `None`.

**Fix:** `tool.get("function", tool).get("name")`

### Critical Pitfall: Orphan Code — `mcp_serve_tools.py` Exists but Is Invisible to the CLI

`mcp_serve_tools.py` may be fully implemented with `build_serve_tools_parser()` and `run_mcp_tools_server()` ready to go, but if nobody calls `build_serve_tools_parser(mcp_sub)` during CLI setup in `main.py`, the subcommand is **completely invisible** to argparse. The `hermes mcp serve-tools` command will return `invalid choice: 'serve-tools'` even though `python3 mcp_serve_tools.py --help` works fine.

**Fix in `hermes_cli/main.py`:**
```python
try:
    from mcp_serve_tools import build_serve_tools_parser
    stp = build_serve_tools_parser(mcp_sub)
except ImportError:
    pass  # mcp_serve_tools.py not present in this checkout
```

Then wire the `--accept-hooks` flag to the returned subparser object:
```python
_add_accept_hooks_flag(stp)
```

The `try/except` wrapper ensures `main.py` does not break in checkouts where `mcp_serve_tools.py` is missing.

### Critical Pitfall: `--accept-hooks` Must Be on the Subparser, Not Just the Parent

When argparse sees `--accept-hooks` after the subcommand (`mcp serve-tools --accept-hooks`), it checks the **subparser** first. If the subparser does not have the flag, argparse raises `unrecognized arguments: --accept-hooks` even though the parent `mcp` parser defines it.

**Fix:** After `build_serve_tools_parser()` returns the subparser object, explicitly attach the flag:
```python
_add_accept_hooks_flag(stp)
```

### CLI Wiring

In `hermes_cli/main.py` (argparse):

```python
try:
    from mcp_serve_tools import build_serve_tools_parser
    stp = build_serve_tools_parser(mcp_sub)
    _add_accept_hooks_flag(stp)
except ImportError:
    pass  # mcp_serve_tools.py not present in this checkout
```

In `hermes_cli/mcp_config.py` (dispatcher):

```python
if action == "serve-tools":
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from mcp_serve_tools import run_mcp_tools_server  # type: ignore
    asyncio.run(run_mcp_tools_server(
        verbose=args.verbose,
        toolsets=args.toolsets.split(",") if args.toolsets else None,
        exclude_toolsets=args.exclude_toolsets.split(",") if args.exclude_toolsets else None,
        include_tools=args.include_tools.split(",") if args.include_tools else None,
        exclude_tools=args.exclude_tools.split(",") if args.exclude_tools else None,
    ))
    return
```

### CLI Test

```bash
cd ~/hermes
source venv/bin/activate
python -c "
import asyncio, sys
sys.path.insert(0, '.')
from mcp_serve_tools import create_tool_mcp_server
server = create_tool_mcp_server(verbose=True)
import asyncio
async def test():
    tools = await server.list_tools()
    print('Registered:', len(tools))
    for t in tools[:5]:
        print(' ', t.name)
asyncio.run(test())
"
```

---

## Side B: Mosaic / Electron — Auto-Registration

### What Already Exists

Mosaic's `electron/integrations/mcp/index.ts` has `ensureDefaultPlugins()` that auto-connects the gbrain MCP server using a zero-dependency bundled Node.js script.

### Adding Hermes Tools Auto-Connect

In `electron/integrations/mcp/index.ts`, extend `ensureDefaultPlugins()`:

```typescript
function resolveHermesBinary(): string | null {
  // 1. Try PATH
  try {
    const which = child_process.execSync("which hermes", { encoding: "utf-8", timeout: 3000 }).trim();
    if (which) return which;
  } catch { /* not on PATH */ }

  // 2. Common install locations
  const candidates = [
    path.join(os.homedir(), ".local", "bin", "hermes"),
    "/usr/local/bin/hermes",
    "/usr/bin/hermes",
    path.join(os.homedir(), "hermes", "venv", "bin", "hermes"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function ensureDefaultPlugins(): void {
  const existing = pluginManager.list();

  // --- gbrain (existing) ---
  if (!existing.some((p) => p.name === "gbrain")) {
    /* ... existing gbrain registration ... */
  }

  // --- Hermes tool bridge (ALWAYS direct venv python, NEVER the "hermes" wrapper) ---
  const venvPython = path.join(os.homedir(), "hermes", "venv", "bin", "python3");
  const mainPy = path.join(os.homedir(), "hermes", "hermes_cli", "main.py");

  if (!fs.existsSync(venvPython)) {
    console.warn("[MCP] venv python not found at", venvPython, "; skipping hermes-tools");
  }

  function _isHermesCommand(c: string | undefined): boolean {
    if (!c) return false;
    return c === "hermes" || c.endsWith("bin/hermes") || c.endsWith("bin/hermes");
  }

  const existingHermes = existing.find((p) => p.name === "hermes-tools");

  if (existingHermes) {
    const isStale =
      _isHermesCommand(existingHermes.command) ||
      existingHermes.command !== venvPython ||
      !Array.isArray(existingHermes.args) ||
      existingHermes.args.length < 3;

    if (isStale) {
      console.warn("[MCP] Removing stale hermes-tools entry (cmd:", existingHermes.command, ")");
      try {
        pluginManager.remove(existingHermes.id);
      } catch (err) {
        console.warn("[MCP] Failed to remove stale hermes-tools:", err);
      }
      // fall through to re-add below
    } else {
      // Not stale — already correct, skip
      console.log("[MCP] hermes-tools already registered with correct config");
      return;
    }
  }

  // Build environment: PATH points inside venv so mcp/dotenv are found,
  // PYTHONPATH points at repo root so main.py finds model_tools.py.
  const hermesEnv = {
    ...process.env,
    HERMES_HOME: process.env.HERMES_HOME || path.join(os.homedir(), ".hermes"),
    PATH: path.join(os.homedir(), "hermes", "venv", "bin") + ":" + process.env.PATH,
    PYTHONPATH: path.join(os.homedir(), "hermes"),
    // PYTHONHOME: Never set when spawning venv Python from Electron — it corrupts the interpreter
  };

  pluginManager.add({
    name: "hermes-tools",
    description: "Hermes Agent — ALL tools and skills (terminal, web, file, skills, kanban, cron, etc.)",
    transport: "stdio",
    command: venvPython,
    args: [mainPy, "mcp", "serve-tools", "--accept-hooks"],
    env: hermesEnv,
    autoConnect: true,
  });
  console.log("[MCP] Registered default plugin: hermes-tools (cmd:", venvPython, ", args:", [mainPy, "mcp", "serve-tools", "--accept-hooks"], ")");
}
```

### gbrain Native `serve` vs Bridge Script

The gbrain project provides a native `gbrain serve` command, but on Linux it may crash with a PGLite WASM error. Before assuming it's the upstream "macOS 26.3 WASM bug" (issue #223), test whether the data directory is corrupted:

**Diagnostic test:**
```bash
# Test A: in-memory PGLite (no dataDir) — if this works, WASM runtime is OK
cd ~/.bun/install/global/node_modules/gbrain && bun run -e "
  import {PGlite} from '@electric-sql/pglite';
  PGlite.create().then(()=>console.log('MEMORY OK')).catch(e=>console.log('MEMORY FAIL:', e.message));
"

# Test B: with actual dataDir — if this fails while A passes, the brain is corrupted
bun run -e "
  import {PGlite} from '@electric-sql/pglite';
  PGlite.create({dataDir:'/home/mauricio/.gbrain/brain.pglite'}).then(()=>console.log('DIR OK')).catch(e=>console.log('DIR FAIL:', e.message));
"
```

**Result matrix:**
| Test A (in-memory) | Test B (dataDir) | Root Cause | Fix |
|---|---|---|---|
| OK | OK | PGLite healthy | No action |
| OK | FAIL | **Corrupted data directory** (stale `postmaster.pid`, torn state, force-killed process) | Move brain aside: `mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.corrupted-$(date +%s)`, run `gbrain init` |
| FAIL | FAIL | True WASM incompatibility (kernel, V8, etc.) | Switch engine: `gbrain init --supabase` or `--url <DATABASE_URL>` |

**Session finding:** The upstream error message misleadingly blames "macOS 26.3 WASM bug". In practice, most `Aborted()` errors on gbrain startup are caused by a corrupted PGLite data directory (stale `postmaster.pid`, force-killed process, unclean shutdown). In-memory PGLite always works, proving the WASM runtime itself is fine.

The workaround is a lightweight Node.js bridge script that wraps individual gbrain CLI commands (`search`, `query`, `list`, etc.) and exposes them as MCP tools over stdio. It is registered in Mosaic via `ensureDefaultPlugins()` using an **absolute path** (not `require.resolve()` which breaks after esbuild bundling). The bridge successfully registers 7 read-only tools. However, every tool call will return the PGLite error until the brain is recovered or gbrain is switched to a Postgres backend.

See `references/gbrain-bridge-notes.md` for full reproduction, upstream links, and Postgres migration steps.

### Bundled Electron Code Cannot Resolve Relative Bridge Scripts

When esbuild bundles `index.ts` into `dist/main/main.js`, any `require.resolve("./servers/...")` resolving from the source tree will fail at runtime because the bundled output lives in `dist/main/` while the source assets remain in `electron/integrations/mcp/servers/`.

**Fix:** Use absolute paths constructed at runtime:
```typescript
const gbrainPath = path.join(
  os.homedir(),
  "mosaic-companion",
  "electron",
  "integrations",
  "mcp",
  "servers",
  "gbrain-mcp-server.js"
);

pluginManager.add({
  name: "gbrain",
  transport: "stdio",
  command: "node",
  args: [gbrainPath],
  env: { ...process.env, GBRAIN_HOME: os.homedir() },  // GBRAIN_HOME = PARENT of .gbrain/
  autoConnect: true,
});
```

Wrap registration in `try/catch` so a missing bridge script does not crash `ensureDefaultPlugins()`:
```typescript
try {
  pluginManager.add({ /* ... gbrain config ... */ });
} catch (err) {
  console.warn("[MCP] Failed to register gbrain bridge:", err);
}
```

### gbrain brain.pglite directory must be parent-directory referenced

The gbrain CLI expects `GBRAIN_HOME` to be the **parent directory** containing `.gbrain/`. Setting it to `~/.gbrain` itself causes "No brain configured" errors. The server auto-corrects this:
```javascript
let gbrainHome = process.env.GBRAIN_HOME || os.homedir();
if (path.basename(gbrainHome) === '.gbrain') {
  gbrainHome = path.dirname(gbrainHome);
}
process.env.GBRAIN_HOME = gbrainHome;
```
#See `references/mosaic-electron-debugging.md` for session-proven debugging patterns covering double-slash URL bugs, wrong default ports, and the "worker exited cleanly" protocol violation.

## Verification Checklist

### `ImportError: cannot import name 'mcp_serve_tools'`
Add the repo root to PYTHONPATH: `sys.path.insert(0, str(Path(__file__).parent.parent))`

### `ValidationError: kwargs Field required`
The wrapper function lacks a concrete signature. Use `_make_handler()` with synthesized `inspect.Signature`.

### `KeyError: 'name'` on tool definition iteration
Tool dict uses nested `"function"` key. Read name as `tool.get("function", tool).get("name")`.

### MCP client sees no tools
FastMCP stores tools internally; verify registration count with `await server.list_tools()` (method on FastMCP instance). Do not access undocumented `._tool_manager._tools` — the attribute shape varies by SDK version.

### `web_search` missing from registered tools
Hermes web providers register provider-specific names: `ddgs_search`, `brave_search`, `tavily_search`, `exa_search`, `firecrawl_search`, `parallel_search`, `searxng_search`. There is no generic `web_search` in `get_tool_definitions()`.

### Phase C: MCP Skill Fallback (Runtime-Resolved)

When a skill name is not found in either the local filesystem or the Vault, the IPC handler in `electron/main.ts` falls back to the Hermes MCP server:

```typescript
// In electron/main.ts — skill:buildSystemPrompt handler
if (result.failedSkills.length > 0) {
  try {
    const mcpImports = await Promise.all(
      result.failedSkills.map(async (name) => {
        const { loadMcpSkill } = require("../services/mcpSkillResolver");
        const mcpSkill = await loadMcpSkill(name);
        return { name, mcpSkill };
      })
    );
    // ... inject mcpSkill.skillMd into systemPrompt
  } catch (e) { /* gracefully degrade */ }
}
```

**Implementation:** `src/services/mcpSkillResolver.ts` provides:
- `loadMcpSkill(skillName)` — calls `mcpClient.callTool("hermes-tools", "skill_view", {name})`
- `discoverMcpSkills()` — calls `mcpClient.callTool("hermes-tools", "skills_list", {})`
- `clearMcpSkillCache()` — invalidate when skills are updated

**Key details:**
- `skill_view` Hermes MCP tool returns the SKILL.md content for a named skill
- `skills_list` Hermes MCP tool returns all installed skills (for discovery/fallback)
- Cache uses same 5-minute TTL as local skills
- Gracefully degrades if MCP server is down, returns null
- The `hermes-tools` MCP server exposes **83 tools** including `skills_list`, `skill_view`, `skill_manage`, `terminal`, `kanban_list`, etc.

**Full resolution chain:**
```
skillInjector.getSkill(skillName):
  ├── Try local ~/.hermes/skills/{name}/SKILL.md
  ├── Try Vault "Skills" box entry
  └── Try MCP: mcpClient.callTool("hermes-tools", "skill_view", {name})
      └── On miss: discover via skills_list, retry
```
Add the repo root to PYTHONPATH: `sys.path.insert(0, str(Path(__file__).parent.parent))`

### `ValidationError: kwargs Field required`
The wrapper function lacks a concrete signature. Use `_make_handler()` with synthesized `inspect.Signature`.

### `KeyError: 'name'` on tool definition iteration
Tool dict uses nested `"function"` key. Read name as `tool.get("function", tool).get("name")`.

### MCP client sees no tools
FastMCP stores tools internally; verify registration count with `await server.list_tools()` (method on FastMCP instance). Do not access undocumented `._tool_manager._tools` — the attribute shape varies by SDK version.

### `web_search` missing from registered tools
Hermes web providers register provider-specific names: `ddgs_search`, `brave_search`, `tavily_search`, `exa_search`, `firecrawl_search`, `parallel_search`, `searxng_search`. There is no generic `web_search` in `get_tool_definitions()`.

## References (Absorbed from mosaic-vault-skills, mosaic-agent-memory)

- `references/stargate-marketplace-mcp.md` — **REST-proxy bridge pattern**: zero-dependency Node.js stdio MCP server that proxies to a REST backend (not CLI wrapper). Includes frontend `marketplaceCall()` MCP-first pattern, commit checklist for cross-machine sync, backend dependency options, and env var reference.
- `references/mcp-non-json-error-pattern.md` — When an MCP server returns plain text or raw HTML in `content[0].text` and the client does `JSON.parse()` on it. Fix: return proper `sendError()` JSON-RPC responses from the server, reject HTTP 4xx/5xx in the bridge, and guard `JSON.parse()` in the renderer. (2026-06-19)
- `references/base-mcp-removal.md` — **COMPLETE removal playbook** for Base MCP when auth is broken or misconfigured.
- `references/base-mcp-removal.md` — **COMPLETE removal playbook** for Base MCP when auth is broken or misconfigured. Covers both Hermes config and Mosaic Companion `mcp-plugins.json`, stale disk state traps, and re-enablement path.

- `references/remote-http-mcp-default-plugin.md` — **COMPLETE** pattern for adding a **remote HTTP MCP server** with API-key auth to Mosaic Companion's `ensureDefaultPlugins()`. Covers the BrowserWindow-OAuth anti-pattern, inline API key input UI, stale disk state patching, and `mcp:set-apikey-and-connect` IPC handler.
- `references/coinbase-base-mcp-auth.md` — Architecture notes on Coinbase/Base MCP auth: **v3-corrected** — why BrowserWindow OAuth fails for `mcp.base.org`, how Hermes native OAuth replaces it, and the CDP legacy API key distinction.
- `references/hermes-native-oauth-vs-electron-browserwindow.md` — **Session-proven comparative analysis.** When a remote MCP server requires OAuth 2.0, when to use Hermes `mcp_oauth.py` (real browser + localhost callback) vs when Electron BrowserWindow is viable. Includes the 5-guard BrowserWindow pattern and the `mcp.base.org` React-SPA incompatibility evidence.
- `references/electron-oauth-browserwindow-blank.md` — **Blank/black BrowserWindow during OAuth sign-in.** 5-guard pattern: `show: false` → `backgroundColor: "#ffffff"` → `win.once("ready-to-show", () => win.show())` → strip `Electron/` from UA via `setUserAgent` → `sandbox: false` with `nodeIntegration: false` + `contextIsolation: true`. Always attach `did-fail-load` and `console-message` listeners so silent provider-side failures become observable.
- `references/npm-mcp-server-pattern.md` — **Third-party npm MCP servers** (Pattern D). When a published npm package (like `midnight-wallet-cli`) exposes a native MCP server via `bin` entry, use local node_modules detection with npx fallback—no bridge script needed.
- `references/stale-disk-state-pattern.md` — General pattern for patching stale persisted plugin entries when default values change across app versions.
- `references/mcp-bridge-patterns.md` — Pattern for exposing any local CLI tool via bundled Node.js stdio MCP server (absolute paths, read-only tools, `extraResources`).
- `references/ui-skill-attachment-patterns.md` — Stargate UI wiring for skill selection, attachment, vault save, dynamic dropdowns.
- `references/electron-spawn-pitfalls.md` — PYTHONHOME corruption, venv Python from Electron, and other spawn environment issues.
- `references/mosaic-electron-debugging.md` — Session-proven debugging patterns covering double-slash URL bugs, wrong default ports, and the "worker exited cleanly" protocol violation.
- `references/memory-bridge-codebase-memory-mcp.md` — Connecting Mosaic Bot to the codebase-memory MCP knowledge graph (194k nodes) for session persistence and context injection into heartbeat prompts (2026-07-01).
- `references/dashboard-readiness-audit.md` — Full step-by-step readiness audit for the Hermes web dashboard (port 9119). From archived `hermes-dashboard`.

## Dashboard Operations

The Hermes Dashboard is a separate FastAPI/Starlette process (port 9119) serving a Vite/React SPA. It does NOT share ports with the AIM or embedded agent.

### Quick Start
```bash
# Default launch (port 9119, auto-open browser)
hermes dashboard

# Headless / safe co-existence with AIM
hermes dashboard --port 9119 --no-open --skip-build
```

### Key Flags
| Flag | Purpose |
|------|---------|
| `--port 9119` | Bind port (default 9119) |
| `--host 127.0.0.1` | Bind address |
| `--no-open` | Suppress browser auto-open |
| `--skip-build` | Serve existing `web_dist` without npm |
| `--insecure` | Bind to non-loopback (DANGEROUS) |
| `--tui` | Enable in-browser Chat tab |
| `--stop` | Kill all dashboard processes |
| `--status` | List running dashboard processes |

### Persistent Deployment (systemd)

For headless hosts, use the provided template: `templates/hermes-dashboard.service`.

1. Audit current state → record PID, port occupancy, kill manual process.
2. Verify port free: `ss -tlnp | grep 9119`
3. Install service: `sudo cp templates/hermes-dashboard.service /etc/systemd/system/`
4. Reload, enable, start: `sudo systemctl daemon-reload && sudo systemctl enable hermes-dashboard.service && sudo systemctl start hermes-dashboard.service`
5. Verify: `curl -s http://127.0.0.1:9119/api/status`

### Co-existence Rules
- Dashboard (9119) and AIM (9000/8006/8642) are separate processes on separate ports.
- No container modifications needed for the AIM.

### Troubleshooting
- **"Web UI dependencies not installed"** — `python3 -m pip install -e .[web]` or let lazy-install handle it.
- **"No web dist found"** — `cd /path/to/hermes/web && npm install && npm run build`
- **Port 9119 in use** — `hermes dashboard --stop` or `ps aux | grep "hermes dashboard"`