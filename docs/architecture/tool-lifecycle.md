# Tool Lifecycle

How tools are built, distributed, installed, and executed in MosAIc.

> Last updated: 2026-03-17. WASM is the primary and only implemented runtime.

---

## 1. Tool Development

A tool is a self-contained WASM binary that runs in MosAIc's sandbox. Tool developers create:

1. **The tool code** — TypeScript/JavaScript (Rust/Go planned)
2. **A manifest** (`manifest.json`) — declares identity, permissions, inputs, tools, and UI panels

### Manifest Format

See [manifest.md](./manifest.md) for the full specification. Key fields:

```json
{
  "manifestVersion": "1.0.0",
  "id": "my-tool",
  "version": "1.0.0",
  "displayName": "My Tool",
  "description": "What the tool does (injected into agent system prompt).",
  "runtime": { "type": "wasm", "entry": "my-tool.wasm" },
  "permissions": {
    "internet": true,
    "allowed_domains": ["api.example.com"]
  },
  "resources": { "memory": "64m", "timeout": "30s" },
  "inputs": {
    "api_key": { "type": "secret", "description": "API key", "required": false }
  },
  "tools": {
    "my_function": {
      "description": "Does something useful.",
      "displayHint": "display",
      "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } } }
    }
  },
  "ui": {
    "panels": [
      { "id": "dashboard", "title": "Dashboard", "icon": "chart" }
    ]
  }
}
```

### Building for WASM (JS/TS)

Tools are built in two steps:

```bash
# Step 1: Bundle TypeScript → CommonJS JavaScript (esbuild inlines manifest.json)
npm run bundle    # → dist/bundle.js

# Step 2: Compile JS bundle → WASM via extism-js
extism-js dist/bundle.js -i index.d.ts -o dist/my-tool.wasm
```

**Prerequisites:**
- Node.js ≥ 18
- [extism-js](https://github.com/extism/js-pdk) CLI on `$PATH`
- [Binaryen](https://github.com/WebAssembly/binaryen) (`wasm-opt`, `wasm-merge` on `$PATH`)

**Required WASM exports:**

Every tool must export:
1. `mosaic_manifest()` — returns the full manifest JSON via `Host.outputString()`
2. One function per entry in `manifest.tools` — reads JSON input, returns JSON output
3. `mosaic_render_panel()` (if the tool has UI panels) — renders panel content

Output is a single `.wasm` file. The manifest is embedded inside at build time.

> **Source code:** See the [mosaic-tools](https://github.com/hypercycle-development/mosaic-tools) repository for the build system, shared SDK, and example tools.

---

## 2. Distribution

### Current (v1)

Tools are distributed as `.wasm` files. Users install them locally via the Tool Sandbox page:

```
Developer → builds .wasm → shares file or publishes to releases
                              ↓
User → "Install .wasm Tool" → picks file → reviews manifest → approves → installed
```

### Future: Tool Registry

A browseable catalog of tools is planned. The registry will support:
- Authenticated access
- Version tagging
- Discovery and search
- Payment integration (crypto)

---

## 3. Installation

### Approval Flow (Implemented)

```
User picks a .wasm file
  → MosAIc calls mosaic_manifest() to read the embedded manifest
  → Displays manifest review screen:
     - Tool name, version, description, author
     - Requested permissions (internet, domains)
     - Resource limits (memory, timeout)
     - Surface area (functions, panels, domains)
     - Approval history (if updating)
  → User must EXPLICITLY approve (checkbox + confirm)
  → If approved:
     - WASM file copied to ~/.config/mosaic-companion/tools/<tool-id>/
     - SHA-256 hash recorded for integrity
     - Approval record saved
     - Tool auto-launched if enabled
  → If denied: nothing happens
```

**No tool is installed without user approval.**

### Updates

When re-installing the same tool:
- MosAIc compares the incoming manifest to the installed version
- Shows a diff of permission/capability changes
- Same-hash builds are rejected ("already at this exact build")
- Permission changes require re-approval

### Input Configuration

Tools that declare `inputs` in their manifest can be configured after install:
- **Required inputs** (default): shown in the config UI for the user to provide
- **Auto-managed inputs** (`required: false`): hidden from UI, managed by the tool itself (e.g. auto-registered API keys via `writeInput()`)

Inputs are stored encrypted on disk using Electron's `safeStorage` API.

---

## 4. Execution

### WASM Launch (Implemented)

When a tool is launched, MosAIc:

1. **Verifies integrity:** re-reads `mosaic_manifest()` from the stored WASM file, compares to the approved manifest
2. **Resolves inputs:** merges user-configured values + defaults from manifest
3. **Creates Extism plugin** with:
   - `useWasi: true` — WASI support for stdio
   - `runInWorker: true` — runs in a worker thread (BackgroundPlugin)
   - `allowedHosts` — mapped from `permissions.allowed_domains` (enables Extism built-in HTTP)
   - `config` — input data injected as key-value config (readable via `Config.get()`)
   - Host functions: `mosaic_log`, `mosaic_write_output`, `mosaic_write_input`
4. **Registers in ToolRegistry** — tool functions become available to AI agents
5. **Logs lifecycle event** to Chronicle

### Tool Call Flow

```
Agent → <use_tool server="ext:my-tool" tool="my_function">{"query": "..."}</use_tool>
  → ActionParser → ToolRegistry.executeTool("ext:my-tool", "my_function", args)
    → WasmLauncher.callFunction() → plugin.call("my_function", JSON.stringify(args))
      → WASM module runs, optionally calls host functions
      → Returns JSON: { data: ..., ui: [...], displayHint: "display" }
    → Result logged to Chronicle
    → If displayHint="display": UI blocks rendered, agent doesn't see data
    → If displayHint="analyze": data sent to agent for commentary
```

### Panel Rendering Flow

```
User opens tool panel tab (e.g. "Leaderboard")
  → ToolPanelView calls toolSandbox.callFunction(toolId, "mosaic_render_panel", { panelId: "leaderboard" })
    → WASM renders panel → returns JSON array of UI blocks
    → UI blocks rendered by ToolUIRenderer (React components)
  → User clicks button with action="navigate_panel"
    → New panel loaded: { panelId: "aim-detail", args: { name: "..." } }
```

### Security

| Measure            | How                                                       |
| ------------------ | --------------------------------------------------------- |
| Zero-capability default | WASM has no network/filesystem/OS access by default  |
| Domain allowlist   | Extism `allowedHosts` enforces `permissions.allowed_domains` |
| Gatekeeper audit   | All outbound HTTP logged to Chronicle                     |
| Input encryption   | Inputs stored via `safeStorage` (OS keychain-backed)     |
| Integrity chain    | SHA-256 hash verified at launch time                      |
| Worker isolation   | Each plugin runs in its own worker thread                 |
| Non-reentrant      | Plugin calls are serialized (no concurrent execution)     |

---

## 5. Lifecycle Management

| Event                 | What Happens                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Install**           | Manifest extracted → user approves → WASM stored → launched → registered in ToolRegistry |
| **Launch**            | Integrity verified → Extism plugin created → host functions injected → tool active   |
| **Stop**              | Plugin closed → worker terminated → unregistered from ToolRegistry                   |
| **Update**            | New manifest compared → permission changes shown → re-approval if needed → relaunched |
| **Uninstall**         | Plugin stopped → WASM file deleted → inputs file deleted → removed from registry     |
| **Pin/Unpin**         | Toggle sidebar visibility — pinned tools show as sidebar navigation items            |
| **Permission change** | Requires explicit user re-approval                                                   |
