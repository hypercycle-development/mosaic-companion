# Tool UI Rendering — Architecture & Approach

> **Status:** Design document. Defines how WASM tools render UI inside MosAIc.

---

## The Problem

WASM tools need to show UI: charts, tables, forms, status cards, interactive dashboards.
But WASM modules can't render HTML directly — they run in a sandbox with zero DOM access.

We need an approach that is:
- **Safe** — no raw HTML/JS injection from untrusted tools
- **Easy to develop** — tool authors shouldn't need to learn MosAIc internals
- **Consistent** — tools should look native to MosAIc's themes
- **Flexible** — support simple data displays AND interactive UIs
- **Performant** — no full browser-in-browser overhead

---

## Approaches Considered

### 1. Raw HTML in sandboxed iframe
Tool returns HTML string → rendered in `<iframe sandbox>`.

| Pros | Cons |
|------|------|
| Maximum flexibility | Security risk (CSP bypasses, data exfiltration) |
| Familiar to web devs | Doesn't match MosAIc theme |
| | Large payload size from WASM |
| | Hard to develop inside WASM (no DOM, no devtools) |

**Verdict:** Too dangerous, too painful for tool devs. Reject.

### 2. Canvas rendering (game-engine style)
Tool renders pixels to a canvas via WASM graphics APIs.

| Pros | Cons |
|------|------|
| Full control over rendering | Enormous complexity for simple UIs |
| Works for specialized viz | No accessibility |
| | No text selection, no copy/paste |
| | Huge WASM binary size |

**Verdict:** Overkill. Maybe for niche viz tools later, not the default path.

### 3. Declarative Component Protocol ← **CHOSEN**
Tool returns a JSON tree of components. MosAIc maps them to React components.

| Pros | Cons |
|------|------|
| Secure — no code execution | Can't do arbitrary UI (by design) |
| Theme-consistent by default | Component library is finite |
| Tiny payloads (just JSON) | Need to design a good component set |
| Easy to build in any WASM language | |
| Testable (just validate JSON output) | |

**Verdict:** Best balance of safety, simplicity, and power. This is the path.

---

## The Component Protocol

### How It Works

```
┌─────────────┐        JSON          ┌─────────────────┐
│  WASM Tool   │  ─── component ───►  │  MosAIc Renderer │
│  (Rust/Go/C) │      tree            │  (React)         │
└─────────────┘                       └─────────────────┘
```

1. Tool function returns `ToolCallResult` with a `ui` field
2. `ui` is an array of **UI blocks** — each block is a JSON object with a `type` field
3. MosAIc has a `<ToolUIRenderer>` React component that maps each block type to a React component
4. Tool authors never write HTML/CSS/React — they describe *what* to show, MosAIc decides *how*

This is the same pattern as:
- **Slack Block Kit** — apps return JSON blocks, Slack renders them
- **Streamlit** — Python describes UI, framework renders it
- **Discord Components** — bots describe buttons/selects, Discord renders them
- **Adaptive Cards** (Microsoft) — JSON → native rendering per platform

### Two UI Surfaces

Tools can render UI in **two places**:

#### A. Inline UI (in chat)
Returned as part of a `ToolCallResult.ui` when an agent calls a tool function.
Rendered inline in the chat conversation, below the tool result text.

```
Agent: Let me analyze that CSV for you.
┌──────────────────────────────────┐
│ 📊 CSV Analysis Results          │
│ ┌──────────┬─────────┐          │
│ │ Metric   │ Value   │          │
│ ├──────────┼─────────┤          │
│ │ Mean     │ 42.5    │          │
│ │ Median   │ 40.0    │          │
│ └──────────┴─────────┘          │
│ [Bar Chart: Distribution]        │
└──────────────────────────────────┘
```

#### B. Panel UI (persistent side panel / tab)
Declared in `manifest.ui.panels`. Rendered in its own tab or side panel.
The WASM tool exposes a `mosaic_render_panel(panelId)` function that MosAIc calls to get the current panel state. Can be polled or event-driven.

```
┌─────────────────────────────────────────┐
│ MosAIc                                   │
│ ┌──────────┬────────────────────────────┤
│ │ Chat     │  📊 Analysis Dashboard     │
│ │          │  [Live chart]              │
│ │          │  [Data table]              │
│ │          │  [Filter form]             │
│ │          │                            │
│ └──────────┴────────────────────────────┘
```

---

## Component Library (v1)

These are the UI block types MosAIc will render. Start small, expand based on demand.

### Display Components

#### `text`
Simple text with optional formatting.
```json
{ "type": "text", "content": "Analysis complete.", "variant": "body" }
```
Variants: `"heading"`, `"subheading"`, `"body"`, `"caption"`, `"label"`

#### `markdown`
Rich text via Markdown. Supports standard markdown + code blocks.
```json
{ "type": "markdown", "content": "## Results\nThe dataset shows a **normal distribution**." }
```

#### `code`
Syntax-highlighted code block.
```json
{ "type": "code", "language": "sql", "content": "SELECT * FROM users WHERE active = true;" }
```

#### `alert`
Status/notification message.
```json
{ "type": "alert", "level": "warning", "title": "Missing Data", "message": "3 rows had null values and were skipped." }
```
Levels: `"info"`, `"success"`, `"warning"`, `"error"`

#### `image`
Base64-encoded or data-URI image.
```json
{ "type": "image", "src": "data:image/png;base64,...", "alt": "Scatter plot", "width": 400 }
```

#### `divider`
Visual separator.
```json
{ "type": "divider" }
```

### Data Components

#### `table`
Tabular data. MosAIc renders with sorting and optional pagination.
```json
{
  "type": "table",
  "title": "Top Users",
  "columns": [
    { "key": "name", "label": "Name" },
    { "key": "score", "label": "Score", "align": "right" }
  ],
  "rows": [
    { "name": "Alice", "score": 95 },
    { "name": "Bob", "score": 87 }
  ]
}
```

#### `card`
Key-value summary card.
```json
{
  "type": "card",
  "title": "Dataset Summary",
  "fields": [
    { "label": "Rows", "value": "1,234" },
    { "label": "Columns", "value": "8" },
    { "label": "Missing", "value": "23 (1.8%)" }
  ]
}
```

#### `list`
Ordered or unordered list of items.
```json
{
  "type": "list",
  "ordered": false,
  "items": [
    { "text": "Column 'age' has 3 outliers", "icon": "warning" },
    { "text": "Column 'name' is 100% complete", "icon": "success" }
  ]
}
```

### Chart Components

#### `chart`
Charts rendered by MosAIc using a charting library (Recharts, Chart.js, etc.).
```json
{
  "type": "chart",
  "chartType": "bar",
  "title": "Age Distribution",
  "xAxis": { "label": "Age Range" },
  "yAxis": { "label": "Count" },
  "series": [
    {
      "name": "Users",
      "data": [
        { "x": "18-25", "y": 120 },
        { "x": "26-35", "y": 340 },
        { "x": "36-50", "y": 210 }
      ]
    }
  ]
}
```
Chart types: `"bar"`, `"line"`, `"pie"`, `"scatter"`, `"area"`, `"donut"`

### Interactive Components

#### `form`
Input form that sends data back to the tool. Enables iterative workflows.
```json
{
  "type": "form",
  "id": "filter-form",
  "submitLabel": "Apply Filter",
  "submitAction": { "tool": "filter_data", "server": "ext:csv-analyzer" },
  "fields": [
    { "key": "column", "label": "Column", "type": "select", "options": ["age", "name", "score"] },
    { "key": "min", "label": "Min Value", "type": "number" },
    { "key": "max", "label": "Max Value", "type": "number" }
  ]
}
```

When user submits, MosAIc calls the tool function with the form values — same as an agent tool call.

Field types: `"text"`, `"number"`, `"select"`, `"multiselect"`, `"checkbox"`, `"date"`, `"textarea"`, `"slider"`, `"file"`

#### `button`
Action button that triggers a tool function call.
```json
{
  "type": "button",
  "label": "Export CSV",
  "variant": "secondary",
  "action": { "tool": "export_csv", "server": "ext:csv-analyzer", "args": { "format": "csv" } }
}
```
Variants: `"primary"`, `"secondary"`, `"danger"`, `"ghost"`

#### `tabs`
Tabbed view — each tab holds a sub-array of UI blocks.
```json
{
  "type": "tabs",
  "tabs": [
    { "id": "summary", "label": "Summary", "blocks": [ ...blocks... ] },
    { "id": "raw",     "label": "Raw Data", "blocks": [ ...blocks... ] }
  ]
}
```

### Layout Components

#### `row`
Horizontal layout — places child blocks side by side.
```json
{
  "type": "row",
  "gap": 16,
  "blocks": [
    { "type": "card", "title": "Mean", "fields": [{ "label": "Value", "value": "42.5" }] },
    { "type": "card", "title": "Median", "fields": [{ "label": "Value", "value": "40.0" }] }
  ]
}
```

#### `column`
Vertical stack (default layout, but explicit for nesting inside `row`).
```json
{
  "type": "column",
  "blocks": [ ...blocks... ]
}
```

#### `section`
Named collapsible section.
```json
{
  "type": "section",
  "title": "Advanced Statistics",
  "collapsed": true,
  "blocks": [ ...blocks... ]
}
```

---

## How It Flows (Runtime)

### Inline UI (chat)

```
1. Agent calls:  <use_tool server="ext:csv-analyzer" tool="analyze">{"data":"..."}</use_tool>
2. ActionParser → ToolRegistry → WASM callFunction("analyze", args)
3. WASM returns:  { success: true, data: {...}, ui: [ {type:"table",...}, {type:"chart",...} ] }
4. ChatView renders:
   - Text: "Analysis complete. Found 1234 rows."
   - Below text: <ToolUIRenderer blocks={result.ui} />
     → <ToolTable ... />
     → <ToolChart ... />
```

### Panel UI (persistent)

```
1. Tool manifest declares: ui.panels: [{ id: "dashboard", title: "Dashboard" }]
2. When tool is launched, MosAIc shows a tab for the panel
3. MosAIc calls: WasmLauncher.callFunction(toolId, "mosaic_render_panel", { panelId: "dashboard" })
4. Tool returns: { success: true, ui: [ ...blocks... ] }
5. MosAIc renders: <ToolUIRenderer blocks={result.ui} />
6. Re-render on:
   - Timer interval (poll, configurable in manifest)
   - After any tool function call (auto-refresh)
   - User clicks refresh button
```

---

## Manifest UI Section — Updated

```json
{
  "ui": {
    "panels": [
      {
        "id": "dashboard",
        "title": "Analysis Dashboard",
        "description": "Live view of analysis results",
        "defaultHeight": 400,
        "renderFunction": "mosaic_render_panel",
        "refreshMode": "after-call",
        "refreshInterval": 0
      }
    ],
    "inlineResults": true
  }
}
```

New fields:
- `renderFunction`: WASM export name to call for panel content (default: `"mosaic_render_panel"`)
- `refreshMode`: `"manual"` | `"after-call"` | `"interval"` | `"event"`
- `refreshInterval`: milliseconds between polls (only if `refreshMode: "interval"`)
- `inlineResults`: whether tool call results should render inline UI blocks in chat (default: `true`)

---

## The Tool Developer Experience

### What a tool developer does:

1. Write WASM functions (in Rust, Go, C, etc.)
2. Return JSON with `ui` blocks — just data, no HTML
3. Declare panels in the manifest

### Example: Rust tool returning UI

```rust
#[plugin_fn]
pub fn analyze(input: String) -> FnResult<String> {
    let args: serde_json::Value = serde_json::from_str(&input)?;
    let data = args["data"].as_str().unwrap();

    // ... do analysis ...

    let result = json!({
        "success": true,
        "data": { "mean": 42.5, "median": 40.0 },
        "ui": [
            {
                "type": "card",
                "title": "Summary",
                "fields": [
                    { "label": "Rows", "value": "1,234" },
                    { "label": "Mean", "value": "42.5" }
                ]
            },
            {
                "type": "chart",
                "chartType": "bar",
                "title": "Distribution",
                "series": [{
                    "name": "Count",
                    "data": [
                        { "x": "0-20", "y": 5 },
                        { "x": "20-40", "y": 12 }
                    ]
                }]
            },
            {
                "type": "form",
                "id": "rerun",
                "submitLabel": "Re-analyze",
                "submitAction": { "tool": "analyze", "server": "ext:csv-analyzer" },
                "fields": [
                    { "key": "column", "label": "Focus Column", "type": "select",
                      "options": ["age", "score", "name"] }
                ]
            }
        ]
    });
    Ok(result.to_string())
}
```

The developer never writes HTML, CSS, or React. They describe what they want, MosAIc renders it.

### Helper libraries (future)

We can provide thin helper libraries for common languages:

```rust
use mosaic_sdk::ui::*;

let ui = UIBuilder::new()
    .card("Summary", &[("Rows", "1234"), ("Mean", "42.5")])
    .chart_bar("Distribution", &[("0-20", 5), ("20-40", 12)])
    .form("rerun")
        .select("column", "Focus Column", &["age", "score", "name"])
        .submit("Re-analyze", "analyze")
    .build();
```

This is sugar — the output is still the same JSON. The SDK is optional.

---

## React Implementation Plan

### MosAIc side (`src/components/tool-ui/`)

```
src/components/tool-ui/
  ToolUIRenderer.tsx     — Root: maps block types to components
  blocks/
    ToolText.tsx         — text
    ToolMarkdown.tsx     — markdown
    ToolCode.tsx         — code
    ToolAlert.tsx        — alert
    ToolImage.tsx        — image
    ToolDivider.tsx      — divider
    ToolTable.tsx        — table
    ToolCard.tsx         — card
    ToolList.tsx         — list
    ToolChart.tsx        — chart (wraps Recharts/Chart.js)
    ToolForm.tsx         — form (sends back to tool)
    ToolButton.tsx       — button
    ToolTabs.tsx         — tabs
    ToolRow.tsx          — row layout
    ToolColumn.tsx       — column layout
    ToolSection.tsx      — collapsible section
  types.ts               — TypeScript types for all block schemas
```

### `ToolUIRenderer.tsx` (core)

```tsx
const BLOCK_MAP: Record<string, React.FC<any>> = {
  text: ToolText,
  markdown: ToolMarkdown,
  code: ToolCode,
  alert: ToolAlert,
  image: ToolImage,
  divider: ToolDivider,
  table: ToolTable,
  card: ToolCard,
  list: ToolList,
  chart: ToolChart,
  form: ToolForm,
  button: ToolButton,
  tabs: ToolTabs,
  row: ToolRow,
  column: ToolColumn,
  section: ToolSection,
};

export const ToolUIRenderer: React.FC<{ blocks: ToolUIBlock[] }> = ({ blocks }) => (
  <div className="tool-ui-container">
    {blocks.map((block, i) => {
      const Component = BLOCK_MAP[block.type];
      if (!Component) return <ToolAlert key={i} level="warning" message={`Unknown block: ${block.type}`} />;
      return <Component key={i} {...block} />;
    })}
  </div>
);
```

### Integration points:
1. **ChatView** — after tool result text, render `<ToolUIRenderer blocks={result.ui} />`
2. **Panel tabs** — new component that calls `mosaic_render_panel` and renders the result
3. **Form submit** — calls `window.electronAPI.tools.execute(action.server + ":" + action.tool, formValues)`

---

## Security Considerations

1. **No raw HTML** — all rendering is through MosAIc's React components. XSS is impossible.
2. **Markdown sanitization** — the Markdown block uses a sanitizing renderer (no `<script>`, no `onclick`, etc.)
3. **Image validation** — only `data:` URIs (base64) allowed. No external URLs (would bypass Gatekeeper).
4. **Form actions** — can only call tools from the SAME tool module. Can't trigger other tools.
5. **Size limits** — UI block array is capped (e.g. 50 blocks, 1MB total) to prevent memory bombs.
6. **No custom CSS** — tools inherit MosAIc's theme. No style injection.

---

## Implementation Priority

### Phase 1 — Inline display (MVP)
- `ToolUIRenderer` with: `text`, `markdown`, `code`, `alert`, `table`, `card`, `image`, `divider`
- Wire into ChatView after tool results
- No interactivity yet

### Phase 2 — Interactivity
- `form`, `button` components
- Form submit → tool call → re-render cycle
- `chart` component (pick a charting library)

### Phase 3 — Panels
- Panel tab rendering
- `mosaic_render_panel` WASM export convention
- Refresh modes (after-call, interval)
- Layout components: `row`, `column`, `section`, `tabs`

### Phase 4 — SDK
- Rust SDK crate: `mosaic-sdk` with UI builder
- Go SDK
- AssemblyScript SDK
- Documentation + example tools

---

## Open Questions

1. **Charting library** — Recharts (already React) vs Chart.js (more chart types) vs Nivo (beautiful but heavy)?
2. **Streaming UI** — Should tools be able to update UI incrementally during long operations? (via `mosaic_write_output` host function)
3. **Custom themes per tool** — Allow tools to provide a color accent? Or strict MosAIc theme only?
4. **Panel communication** — Can a panel form trigger a chat message to the agent? Or only direct tool calls?
5. **Maximum block depth** — How deep can `row > column > section > tabs > blocks` nest? (Suggest: 4 levels max)
