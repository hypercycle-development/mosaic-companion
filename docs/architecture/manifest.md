# Tool Manifest Specification

> [!WARNING]
> **Parts of this document describe a Docker-based runtime that was never built.**
> The implemented runtime is WebAssembly via Extism. See
> [STATUS.md](./STATUS.md) for what in this set is accurate and what is
> superseded. Last verified 2026-08-20 against `2d920ce`.

> **Status:** Stable v1.0.0. Implemented and shipping.

The manifest is the contract between a tool developer and MosAIc. It declares:

- What the tool is and how to run it
- What permissions it needs (network, files, services)
- What functions it exposes to agents
- What inputs it needs (API keys, config)
- What UI it can render inside MosAIc

The manifest is embedded in the WASM binary at build time. There is no separate manifest file at runtime — MosAIc reads it by calling the tool's `mosaic_manifest()` export.

---

## Full Manifest Example

Based on the HyperInsight tool (a real, shipping tool):

```json
{
  "manifestVersion": "1.0.0",
  "id": "hyperinsight",
  "version": "1.0.0",
  "displayName": "HyperInsight",
  "description": "HyperCycle network analytics — AIM leaderboard, node stats, and compute metrics.",
  "author": "HyperCycle",
  "license": "MIT",
  "icon": "trophy",

  "runtime": {
    "type": "wasm",
    "entry": "hyperinsight.wasm"
  },

  "permissions": {
    "internet": true,
    "allowed_domains": ["api.hyperinsight.app"],
    "files": [],
    "services": []
  },

  "resources": {
    "memory": "64m",
    "timeout": "30s"
  },

  "inputs": {
    "api_key": {
      "type": "secret",
      "description": "HyperInsight API key — auto-registered on first run",
      "required": false
    }
  },

  "tools": {
    "get_network_stats": {
      "description": "Get current HyperCycle network statistics including active/available AIM counts, total nodes, compute capacity, and a ranked topAims array (top 5 by activeNodes).",
      "displayHint": "display",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    },
    "get_aim_details": {
      "description": "Get detailed analytics for a specific AIM by name, including active nodes, compute metrics, metadata, releases, and charts.",
      "displayHint": "display",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "The full AIM name (e.g. 'hypercycle/ollama-aim')"
          }
        },
        "required": ["name"]
      }
    }
  },

  "ui": {
    "panels": [
      { "id": "leaderboard", "title": "Leaderboard", "icon": "trophy" },
      { "id": "aims", "title": "Aims", "icon": "chart" },
      { "id": "nodes", "title": "Nodes", "icon": "server" },
      { "id": "aim-detail", "title": "AIM Detail", "hidden": true },
      { "id": "aim-charts", "title": "AIM Charts", "hidden": true },
      { "id": "aim-releases", "title": "AIM Releases", "hidden": true }
    ]
  }
}
```

---

## Field Reference

### Identity

| Field             | Type   | Required | Description                                                 |
| ----------------- | ------ | -------- | ----------------------------------------------------------- |
| `manifestVersion` | string | ✅       | Manifest format version (currently `"1.0.0"`)               |
| `id`              | string | ✅       | Globally unique tool identifier (kebab-case)                |
| `version`         | string | ✅       | Tool version (semver)                                       |
| `displayName`     | string | ✅       | Human-readable name shown in UI                             |
| `description`     | string | ✅       | What the tool does (also injected into agent system prompt) |
| `author`          | string | ❌       | Tool author or organization                                 |
| `license`         | string | ❌       | License identifier                                          |
| `icon`            | string | ❌       | Path to icon file (relative to manifest)                    |

### Runtime

| Field           | Type     | Required | Description                                          |
| --------------- | -------- | -------- | ---------------------------------------------------- |
| `runtime.type`  | `"wasm"` | ✅       | Execution runtime (WASM only in v1)                  |
| `runtime.entry` | string   | ✅       | Entry point — `.wasm` filename                       |

```json
{ "type": "wasm", "entry": "tool.wasm" }
```

### Permissions

Everything is **denied by default**. The tool explicitly declares what it needs.

| Field                         | Type     | Default | Description                                                   |
| ----------------------------- | -------- | ------- | ------------------------------------------------------------- |
| `permissions.internet`        | boolean  | `false` | Can the tool make outbound HTTP requests?                     |
| `permissions.allowed_domains` | string[] | `[]`    | Which domains are allowed (only if `internet` is `true`)      |
| `permissions.files`           | string[] | `[]`    | File paths/globs the tool can read (user-approved at install) |
| `permissions.services`        | string[] | `[]`    | Named services: `"elasticsearch"`, `"postgresql"`, etc.       |

> **Key:** These permissions are shown to the user at install time. The user must explicitly approve. MosAIc's host functions enforce them at runtime — the tool physically cannot bypass them (WASM has no network/filesystem access by default).

### Resources

| Field               | Type   | Default | Description                          |
| ------------------- | ------ | ------- | ------------------------------------ |
| `resources.memory`  | string | `"64m"` | Max memory for the WASM module       |
| `resources.timeout` | string | `"30s"` | Max execution time per function call |

### Inputs (Optional)

Tools can declare named inputs they need — API keys, configuration strings, user preferences. Inputs are:

- Shown to the user for configuration (unless `required: false`)
- Stored encrypted on disk by MosAIc Core
- Injected into the WASM sandbox as Extism config at launch time
- Readable by the tool via `readInput(key)` at runtime

| Field                        | Type                      | Required | Description                                                     |
| ---------------------------- | ------------------------- | -------- | --------------------------------------------------------------- |
| `inputs.<key>.type`          | `"secret"` \| `"string"`  | ✅       | `"secret"` values are encrypted at rest                         |
| `inputs.<key>.description`   | string                    | ✅       | Human-readable description shown in the config UI               |
| `inputs.<key>.required`      | boolean                   | ❌       | Default `true`. If `false`, hidden from install UI (auto-managed) |
| `inputs.<key>.default`       | string                    | ❌       | Fallback value when user hasn't configured one                  |

**Auto-managed inputs:** Set `required: false` for inputs the tool obtains itself (e.g. auto-registering an API key on first run via `writeInput()`). These are hidden from the user in the install/config screens.

```json
"inputs": {
  "api_key": {
    "type": "secret",
    "description": "API key — auto-registered on first run",
    "required": false
  },
  "custom_endpoint": {
    "type": "string",
    "description": "Custom API endpoint URL",
    "default": "https://api.example.com"
  }
}
```

### Tools (Functions)

The `tools` object declares functions the tool exposes to agents. Each key is the function name.

| Field                          | Type                            | Required | Description                                                 |
| ------------------------------ | ------------------------------- | -------- | ----------------------------------------------------------- |
| `tools.<name>.description`     | string                          | ✅       | What this function does (injected into agent system prompt) |
| `tools.<name>.inputSchema`     | object                          | ❌       | JSON Schema for the function's input                        |
| `tools.<name>.displayHint`     | `"display"` \| `"analyze"`      | ❌       | Default hint for how the agent should handle results (see below) |

When a tool is loaded, MosAIc registers each function in the ToolRegistry. Agents see them in the system prompt:

```
Available tools for CSV Data Analyzer (server: "ext:csv-analyzer"):
- Tool: analyze
  Description: Analyze a CSV dataset and return statistics
  Usage: <use_tool server="ext:csv-analyzer" tool="analyze">JSON_ARGS</use_tool>
```

### UI (Rendering Panels)

Tools can declare UI panels that render inside MosAIc as tabs. The tool returns structured UI descriptors at runtime; MosAIc renders them using built-in React components.

| Field                       | Type    | Required | Description                                   |
| --------------------------- | ------- | -------- | --------------------------------------------- |
| `ui.panels`                 | array   | ❌       | UI panels this tool can render                |
| `ui.panels[].id`            | string  | ✅       | Panel identifier (passed to `mosaic_render_panel`) |
| `ui.panels[].title`         | string  | ✅       | Panel tab display name                        |
| `ui.panels[].description`   | string  | ❌       | What the panel shows                          |
| `ui.panels[].defaultHeight` | number  | ❌       | Default panel height in pixels                |
| `ui.panels[].icon`          | string  | ❌       | Icon name for the panel tab                   |
| `ui.panels[].hidden`        | boolean | ❌       | If `true`, not shown as a tab — navigable only via button actions |

**Visible vs Hidden panels:** Visible panels appear as tabs in the tool's panel view. Hidden panels are for detail/drill-down views navigated to via `navigate_panel` button actions. For example, an "AIM Detail" panel that opens when clicking a row in the leaderboard.

**How panel rendering works at runtime:**

The tool must export a `mosaic_render_panel` function. MosAIc calls it with a JSON input containing the `panelId` (and optional `args`):

```json
{ "panelId": "leaderboard" }
{ "panelId": "aim-detail", "args": { "name": "hypercycle/ollama-aim" } }
```

The function returns a JSON array of UI blocks:

```json
{
  "ui": [
    {
      "type": "table",
      "title": "Statistics",
      "columns": [{"key": "metric", "label": "Metric"}, {"key": "value", "label": "Value"}],
      "rows": [
        {"metric": "Mean", "value": "42.5"},
        {"metric": "Median", "value": "40"}
      ]
    },
    {
      "type": "chart",
      "chartType": "bar",
      "title": "Distribution",
      "data": [
        { "label": "0-20", "value": 5 },
        { "label": "20-40", "value": 12 }
      ]
    }
  ]
}
```

**Supported UI block types (v1):**

| Type       | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `text`     | Styled text (variants: `heading`, `subheading`, `body`, `caption`, `label`) |
| `markdown` | Rich text with markdown formatting                           |
| `code`     | Syntax-highlighted code block                                |
| `table`    | Tabular data with columns and rows (sorting built-in)        |
| `chart`    | Charts: `bar`, `line`, `pie`, `scatter`                      |
| `card`     | Summary card with key-value pairs                            |
| `image`    | Base64-encoded image (data-URI)                              |
| `alert`    | Status message: `info`, `warning`, `error`, `success`        |
| `button`   | Clickable button — triggers `navigate_panel` or tool calls   |
| `form`     | Input form for tool parameters                               |
| `divider`  | Visual separator                                             |
| `toast`    | Ephemeral notification (not rendered in panel)               |

MosAIc provides the React components. The tool just says "show a bar chart with this data." New UI types can be added without changing the manifest format.

**Button actions (navigate between panels):**

```json
{
  "type": "button",
  "label": "View Details →",
  "action": "navigate_panel",
  "panelId": "aim-detail",
  "args": { "name": "hypercycle/ollama-aim" }
}
```

### `displayHint` — Controlling Agent Follow-up

After a tool call, MosAIc decides whether to send the result back to the agent for commentary, or stop and just show the UI. `displayHint` controls this.

| Value | Behaviour |
| --------- | --------- |
| `"analyze"` | **(Default)** Agent receives the tool's `data` field and generates a follow-up response. Use this when the agent should interpret or summarise results for the user. |
| `"display"` | UI blocks are the complete response. The agent does **not** see the data and does **not** send a follow-up message. Use this for dashboards, visualisations, or any result where the UI speaks for itself. |

**Priority order (highest to lowest):**
1. `displayHint` field in the tool's own JSON response (per-call, dynamic)
2. `displayHint` in the manifest under `tools.<name>` (per-function default)
3. `"analyze"` — the implicit fallback if nothing is set (backwards-compatible)

This means a tool can override its manifest default at runtime. For example, an analytics tool might default to `"analyze"` but return `"display"` when it detects a simple "just show me the chart" request.

**Manifest example — mixed hints:**

```json
"tools": {
  "dashboard": {
    "description": "Render an overview dashboard.",
    "displayHint": "display"
  },
  "analyze": {
    "description": "Run statistical analysis and explain the results.",
    "displayHint": "analyze"
  }
}
```

**Per-call override in tool response:**

```js
// The tool's JS code can override the manifest default:
const result = {
  data: { summary: "..." },
  ui: [ /* blocks */ ],
  displayHint: "display"  // overrides manifest default for this call
};
Host.outputString(JSON.stringify(result));
```

---

## Manifest Validation Rules

1. `id` must be kebab-case, 3-50 characters, unique in the registry
2. `manifestVersion` must be a supported version
3. If `internet` is `true`, `allowed_domains` must be non-empty
4. All `allowed_domains` must be valid hostnames (no IPs, no wildcards in v1)
5. `tools` must have at least one function
6. Each tool function must have a `description`
7. `runtime.type` must be `"wasm"` (or `"docker"` if Docker support is enabled)

---

## Relationship to Host Functions

The manifest's `permissions` and `inputs` fields control what the tool can do at runtime:

```
Manifest declares:                  MosAIc provides:
  internet: true                  →   Http.request() (Extism built-in, domain-filtered by allowedHosts)
  internet: false                 →   Http.request() blocked (no allowedHosts configured)
  inputs: { api_key: ... }        →   readInput("api_key") returns the stored value via Config.get()
  (any tool)                      →   writeInput(key, value) persists to encrypted store
  (any tool)                      →   log(message) appends to Chronicle
  (any tool)                      →   writeOutput(data) pushes data to MosAIc
```

**Available host functions (v1):**

| Function                               | Description                                                     |
| -------------------------------------- | --------------------------------------------------------------- |
| `httpRequest(url, method, headers, body)` | HTTP request via Extism built-in `Http.request()`. Only allowed to `permissions.allowed_domains`. |
| `readInput(key)`                       | Read input data by key. Uses Extism `Config.get()` — inputs are injected as config at plugin creation. |
| `writeInput(key, value)`               | Persist an input to MosAIc's encrypted store. For auto-registration flows. |
| `log(message)`                         | Write a log entry to the tool's Chronicle (append-only).        |
| `writeOutput(data)`                    | Push output data to MosAIc.                                     |

HTTP requests use Extism's built-in HTTP support (not a custom host function). MosAIc maps `permissions.allowed_domains` to Extism's `allowedHosts` config. The Gatekeeper enforces the allowlist.
