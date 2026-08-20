# mcp-hello

Minimal MCP server that exposes two tools to Mosaic via stdio transport.

## Tools

| Tool | Arguments | What it does |
|------|-----------|--------------|
| `word_count` | `text` (string) | Returns word count, character count, sentence count, and estimated reading time |
| `time_now` | `timezone?` (IANA string) | Returns the current time in local, ISO 8601, and Unix formats |

## Setup

**Install dependencies** (once, isolated to this directory):

```sh
cd examples/mcp-hello
npm install
```

**Register in Mosaic** (writes to Mosaic's config — no app code changes):

```sh
npm run setup
```

Then click the **Refresh** button (↻) in **Settings → MCP Servers**. The `word_count` and `time_now` tools will appear in MosaicBot and any chat tab with tool use enabled.

**Try it** — ask MosaicBot:
- *"How many words are in this paragraph: ..."*
- *"What time is it in Tokyo?"*

**Remove when done:**

Open **Settings → MCP Servers**, find `mcp-hello`, and click the trash icon. The entry is removed immediately.

Alternatively, if Mosaic is not running:

```sh
npm run remove
```

---

## How setup works

`setup.js` finds Mosaic's `mcp-plugins.json` (in the Electron userData directory) and appends an entry pointing at the absolute path of `server.js`. `remove.js` deletes that entry. Neither script touches the Mosaic source code.

The userData directory per platform:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/mosaic-companion/` |
| Linux | `~/.config/mosaic-companion/` |
| Windows | `%APPDATA%\mosaic-companion\` |

---

## Development testing (without Mosaic)

The MCP Inspector is an official tool for testing MCP servers interactively via a local web UI. Use it when you want to verify tool schemas and responses without wiring the server into Mosaic:

```sh
npx @modelcontextprotocol/inspector node server.js
```

This opens a browser tab (usually `http://localhost:5173`). From there:

1. Click **Connect** — the inspector performs the MCP handshake
2. Go to **Tools** — you'll see `system_info` and `time_now` listed with their schemas
3. Click a tool → fill in any arguments → **Call tool** — the raw response appears on the right

The inspector is good for checking that your tool schema is correct and your handler returns the right shape before you register in Mosaic. It installs into npx's temp cache and leaves no trace in your project.

---

## Extending this example

- **Add a tool** — call `server.tool(name, description, zodSchema, handler)` and click Refresh (↻) in Settings → MCP Servers.
- **Add a resource** — use `server.resource(...)` to expose read-only data (files, API responses).
- **Add a prompt** — use `server.prompt(...)` to expose reusable prompt templates.
- **HTTP transport** — swap `StdioServerTransport` for an HTTP server; in `setup.js` set `transport: "http"` and `url` instead of `command`/`args`.

## Contract with Mosaic

Mosaic uses `@modelcontextprotocol/sdk ^1.27.0`. Your server must speak the same protocol version. The `MCPPlugin` interface Mosaic stores in `mcp-plugins.json` is defined in `electron/integrations/mcp/plugin.ts`.
