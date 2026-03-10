# Tool Manifest Specification (WIP)

> **Status:** Work-in-progress draft. This will evolve as we prototype.

The manifest is the contract between a tool developer and MosAIc. It declares:

- What the tool is and how to run it
- What permissions it needs (network, files, services)
- What functions it exposes to agents
- What UI it can render inside MosAIc

---

## Full Manifest Example

```json
{
  "manifestVersion": "1.0.0",
  "id": "csv-analyzer",
  "version": "1.0.0",
  "displayName": "CSV Data Analyzer",
  "description": "Analyze CSV datasets with statistics, charts, and AI-powered insights.",
  "author": "MosAIc Community",
  "license": "MIT",
  "icon": "icon.png",

  "runtime": {
    "type": "wasm",
    "entry": "tool.wasm"
  },

  "permissions": {
    "internet": true,
    "allowed_domains": ["api.openai.com"],
    "files": [],
    "services": []
  },

  "resources": {
    "memory": "64m",
    "timeout": "30s"
  },

  "tools": {
    "analyze": {
      "description": "Analyze a CSV dataset and return statistics (mean, median, outliers).",
      "inputSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "string",
            "description": "CSV content to analyze"
          },
          "columns": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Columns to analyze (empty = all)"
          }
        },
        "required": ["data"]
      }
    },
    "summarize": {
      "description": "Generate a natural-language summary of a dataset using AI.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "string",
            "description": "CSV content to summarize"
          }
        },
        "required": ["data"]
      }
    }
  },

  "ui": {
    "panels": [
      {
        "id": "results",
        "title": "Analysis Results",
        "description": "Displays analysis results with tables and charts.",
        "defaultHeight": 400
      }
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

| Field           | Type                   | Required | Description                                          |
| --------------- | ---------------------- | -------- | ---------------------------------------------------- |
| `runtime.type`  | `"wasm"` \| `"docker"` | ✅       | Execution runtime                                    |
| `runtime.entry` | string                 | ✅       | Entry point — `.wasm` file or Docker image reference |

**WASM runtime:**

```json
{ "type": "wasm", "entry": "tool.wasm" }
```

**Docker runtime (future, optional):**

```json
{ "type": "docker", "entry": "registry.mosaic.ai/ml-trainer:1.0.0" }
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

For Docker runtime, additional fields apply: `cpu`, `disk`, `vram`.

### Tools (Functions)

The `tools` object declares functions the tool exposes to agents. Each key is the function name.

| Field                      | Type   | Required | Description                                                 |
| -------------------------- | ------ | -------- | ----------------------------------------------------------- |
| `tools.<name>.description` | string | ✅       | What this function does (injected into agent system prompt) |
| `tools.<name>.inputSchema` | object | ❌       | JSON Schema for the function's input                        |

When a tool is loaded, MosAIc registers each function in the ToolRegistry. Agents see them in the system prompt:

```
Available tools for CSV Data Analyzer (server: "ext:csv-analyzer"):
- Tool: analyze
  Description: Analyze a CSV dataset and return statistics
  Usage: <use_tool server="ext:csv-analyzer" tool="analyze">JSON_ARGS</use_tool>
```

### UI (Rendering Panels)

Tools can declare UI panels that render inside MosAIc. The tool returns structured UI descriptors at runtime; MosAIc renders them using built-in React components.

| Field                       | Type   | Required | Description                    |
| --------------------------- | ------ | -------- | ------------------------------ |
| `ui.panels`                 | array  | ❌       | UI panels this tool can render |
| `ui.panels[].id`            | string | ✅       | Panel identifier               |
| `ui.panels[].title`         | string | ✅       | Panel display name             |
| `ui.panels[].description`   | string | ❌       | What the panel shows           |
| `ui.panels[].defaultHeight` | number | ❌       | Default panel height in pixels |

**How UI rendering works at runtime:**

The tool doesn't render HTML. It returns a JSON array of UI blocks:

```json
{
  "success": true,
  "data": { "mean": 42.5, "median": 40 },
  "ui": [
    {
      "type": "table",
      "title": "Statistics",
      "columns": ["Metric", "Value"],
      "rows": [
        ["Mean", "42.5"],
        ["Median", "40"],
        ["Std Dev", "5.2"]
      ]
    },
    {
      "type": "chart",
      "chartType": "bar",
      "title": "Distribution",
      "data": [
        { "label": "0-20", "value": 5 },
        { "label": "20-40", "value": 12 },
        { "label": "40-60", "value": 18 }
      ]
    },
    {
      "type": "markdown",
      "content": "## Summary\nThe dataset shows a **normal distribution** with mean 42.5."
    }
  ]
}
```

**Supported UI block types (v1):**

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `table`    | Tabular data with columns and rows                      |
| `chart`    | Charts: `bar`, `line`, `pie`, `scatter`                 |
| `markdown` | Rich text with markdown formatting                      |
| `image`    | Base64-encoded image (charts, plots, etc.)              |
| `form`     | Input form for tool parameters (re-run with user input) |
| `card`     | Summary card with key-value pairs                       |
| `code`     | Syntax-highlighted code block                           |
| `alert`    | Status message: `info`, `warning`, `error`, `success`   |

MosAIc provides the React components. The tool just says "show a bar chart with this data." New UI types can be added without changing the manifest format.

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

## Relationship to WASM Host Functions

The manifest's `permissions` field directly controls which host functions are available:

```
Manifest declares:                  MosAIc provides:
  internet: true                  →   http_request() host function (with domain check)
  internet: false                 →   http_request() is NOT injected
  files: ["/data/*.csv"]          →   file_read() host function (with path check)
  files: []                       →   file_read() is NOT injected
  services: ["elasticsearch"]     →   db_query("elasticsearch", ...) allowed
```

If a permission isn't declared, the corresponding host function simply doesn't exist for that WASM module. The tool cannot call it — not blocked, just absent.
