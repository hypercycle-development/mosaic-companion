# MosAIc Companion — Extension Examples

Each subdirectory is a self-contained example of one way to extend MosAIc.
They are starting points: working, minimal, and commented to show exactly
which contracts matter.

| Example | Surface | Status |
|---------|---------|--------|
| [`tab-plugin/`](tab-plugin/) | Addon — a sidebar tab | Working, no build step |
| [`mcp/mcp-hello/`](mcp/mcp-hello/) | MCP server (stdio) | Working |
| [`wasm-tool/`](wasm-tool/) | WASM sandboxed tool (TypeScript) | Working |
| [`wasm/`](wasm/) | Two more WASM tools — `cron-explain`, `checksum` | Working |

HyperCycle node integration doesn't have an example yet. Until it does, the
working reference is `plugins/aim-nodes` in this repository — in particular
its `NodeManagerClient` pattern for calling AIMs, authentication and signing.

## Which surface do I need?

**Addon** — you want a new page in MosAIc, shipped and installed separately
from the app. Your addon is its own directory with a manifest, loaded into an
isolated webview, talking to the app through the permission-gated
`window.addonAPI`. This is how HyperInsight is built, and it's the right
default for anything user-facing. Start with [`tab-plugin/`](tab-plugin/).

**MCP server** — you want to expose tools or resources to the AI assistant.
Your server runs as a local process; MosAIc connects to it over stdio or HTTP.
Nothing about it is MosAIc-specific.

**WASM tool** — you want sandboxed computation users can invoke from the Tool
Sandbox. Your tool compiles to `.wasm` and declares a manifest; permissions
are enforced at the sandbox boundary.

## How isolation differs between them

Worth understanding before you pick, because it decides what your code can do:

| | Runs in | Reaches the app via | Trust |
|---|---|---|---|
| Addon | Isolated webview | `window.addonAPI`, permission-gated | Declared in a manifest, shown to the user at install |
| MCP server | Its own OS process | MCP protocol | Whatever the user grants the server |
| WASM tool | WASM sandbox | Host function calls | Declared in a manifest, enforced by the gatekeeper |

None of these gets `window.electronAPI` or Node access. That bridge belongs to
the app's own renderer, and code copied out of it will not work unchanged in
any of the three.

## Publishing

Addons are distributed from the
[`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons)
repository, one directory per addon, as a reviewed catalogue. Open a pull
request adding `addons/<your-id>/` — manifest, licence, and source. Submissions
are assessed from the diff, so everything your addon does should be readable
there. See its
[CONTRIBUTING guide](https://github.com/hypercycle-development/mosaic-addons/blob/main/CONTRIBUTING.md)
for what a submission must contain, and what it cannot ask for.

While you're developing, build and install unpacked through the Dev corner (see
[`tab-plugin/`](tab-plugin/)). That route stays open for anything you only want
to run on your own machine.

MCP servers and WASM tools are distributed by you, however you like.
