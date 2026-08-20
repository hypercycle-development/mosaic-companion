# Tool Panels UI — Architecture & Implementation

> [!NOTE]
> This documentation set has known divergences from the implementation. See
> [STATUS.md](./STATUS.md) before relying on it. Last verified 2026-08-20
> against `2d920ce`.

> **Branch:** `feat/tool-panels-ui`
> **Scope:** WASM tool lifecycle (install → approve → launch → render UI) + rich panel rendering system

---

## Table of Contents

- [Overview](#overview)
- [Tool Panel Rendering System](#tool-panel-rendering-system)
  - [ToolPanelView](#toolpanelview)
  - [UI Block Types](#ui-block-types)
  - [Action Handling](#action-handling)
  - [Caching & Prefetching](#caching--prefetching)
  - [Navigation](#navigation)
- [WASM Tool Installation](#wasm-tool-installation)
  - [Manifest Extraction](#manifest-extraction)
  - [User Approval Gate](#user-approval-gate)
  - [Trusted Artifact Persistence](#trusted-artifact-persistence)
  - [Approval Records](#approval-records)
- [WASM Tool Launch](#wasm-tool-launch)
  - [Integrity Verification](#integrity-verification)
  - [Input Data Resolution](#input-data-resolution)
  - [Plugin Loading](#plugin-loading)
  - [Tool Bridge Registration](#tool-bridge-registration)
- [Security Architecture](#security-architecture)
  - [Zero-Capability Default](#zero-capability-default)
  - [Host Functions (Gatekeeper)](#host-functions-gatekeeper)
  - [Domain Filtering](#domain-filtering)
  - [Integrity Chain](#integrity-chain)
  - [Input Isolation](#input-isolation)
  - [Chronicle Audit Trail](#chronicle-audit-trail)
  - [Security Layers Diagram](#security-layers-diagram)
- [Generic Input System](#generic-input-system)
- [Detail Sidebar](#detail-sidebar)
  - [Opening via Action Target](#opening-via-action-target)
  - [Opening via Block Type](#opening-via-block-type)
  - [Component Anatomy](#sidebar-component-anatomy)
- [Confirmation Modal](#confirmation-modal)
  - [Returning a Confirm Modal from a Tool](#returning-a-confirm-modal-from-a-tool)
  - [Severity Levels](#severity-levels)
  - [Modal in Agent Chat](#modal-in-agent-chat)
  - [Component Anatomy](#modal-component-anatomy)
- [Sidebar & Routing Integration](#sidebar--routing-integration)
- [Files Changed](#files-changed)

---

## Overview

This feature turns MosAIc's sandbox subsystem from a stub into a working tool
platform. Sandboxed WASM tools can be **installed**, **reviewed and approved**,
**launched**, and **render rich persistent UI panels** inside the app — all while
being confined to a strict security boundary.

Key principles:

1. **The manifest embedded in the WASM binary is the single source of truth.**
   No external manifest file is trusted.
2. **WASM tools have zero OS/network/filesystem access by default.**
   Every capability is provided through host functions gated by the Gatekeeper.
3. **Every install and update requires explicit user approval.**
   The user sees the full permission set (and a diff on updates) before anything runs.
4. **Integrity is verified at every launch.**
   The stored artifact is SHA-256-checked against the hash recorded at approval time.

---

## Tool Panel Rendering System

### ToolPanelView

**File:** `src/components/ToolPanelView.tsx`

The central component for rendering persistent UI from a running WASM tool.
When a tool declares `ui.panels` in its manifest, `ToolPanelView`:

1. Calls `mosaic_render_panel(panelId)` via IPC → the WASM function returns an
   array of `ToolUIBlock[]`.
2. Passes the blocks to `ToolUIRenderer`, which maps each block type to its
   React component.
3. Handles interactive actions — button clicks and form submits call tool
   functions via IPC, then re-render the panel with fresh data.

```
User clicks panel tab
  → ToolPanelView.renderPanel(panelId)
    → IPC: toolSandbox:renderPanel(toolId, panelId, context?)
      → ToolManager → WasmLauncher.callFunction("mosaic_render_panel", { panelId, context })
        → WASM tool returns JSON with { ui: ToolUIBlock[] }
    → ToolUIRenderer renders blocks
```

#### Props

```typescript
interface ToolPanelViewProps {
  toolId: string;                // The tool's manifest ID
  manifest: ToolManifest;        // For display name, panels list
  mockData?: Record<string, ToolUIBlock[]> | ((panelId, context?) => ToolUIBlock[]);
}
```

The `mockData` prop lets developers bypass IPC entirely during development —
supply static blocks or a function that returns blocks per panel.

### UI Block Types

Tools return structured blocks instead of raw HTML. Each block type maps to a
themed React component.

| Block Type    | Component         | Description                                      |
| ------------- | ----------------- | ------------------------------------------------ |
| `text`        | `ToolText`        | Rich text with color, size, weight variants      |
| `table`       | `ToolTable`       | Data table with cell colors, clickable rows      |
| `card`        | `ToolCard`        | Content card with accent borders, collapsible    |
| `chart`       | `ToolChart`       | Data visualization (recharts)                    |
| `section`     | `ToolSection`     | Collapsible section with animated chevron        |
| `tabs`        | `ToolTabs`        | Tabbed content with icon support                 |
| `row`/`column`| `ToolRow`/`Column`| Flex layout containers                           |
| `button`      | `ToolButton`      | Action trigger with server/tool/args payload     |
| `form`        | `ToolForm`        | Input form that submits to a tool function       |
| `stat-card`   | `ToolStatCard`    | Metric card: value, label, trend, sparkline      |
| `badge`       | `ToolBadge`       | Colored tag/label with variant support           |
| `detail-panel`| `ToolDetailSidebar`| Right-side drawer with title + child blocks (overlay) |
| `confirm-modal`| `ToolConfirmModal`| Confirmation dialog with severity theming (overlay) |

Block type definitions live in `src/components/tool-ui/types.ts`.
Block renderers live in `src/components/tool-ui/blocks/`.

### Action Handling

Buttons and forms inside panels carry an action payload:

```typescript
interface BlockAction {
  server: string;   // e.g. "ext:hyperinsight"
  tool: string;     // function name, or "__navigate_panel__" for navigation
  args?: Record<string, unknown>;
  target?: "inline" | "sidebar" | "modal";  // where the response renders
}
```

When an action fires:

1. `ToolUIRenderer` calls the `onAction` handler passed from `ToolPanelView`.
2. If `action.tool === "__navigate_panel__"`, it's a panel navigation — push
   current panel to history, set context, switch to target panel.
3. `ToolPanelView` checks the `target` field:
   - **`"inline"`** (default): call the tool function, then re-render the panel.
   - **`"sidebar"`**: call the tool function, render the response in the right
     detail sidebar instead of replacing the panel.
   - **`"modal"`**: call the tool function, show a confirmation modal if the
     response contains a `confirm-modal` block.

### Caching & Prefetching

Panel data is cached in a `Map<string, PanelCacheEntry>` keyed by
`panelId:serializedContext`. Behavior:

- **Cache hit (fresh):** Render immediately, no IPC call.
- **Cache hit (stale, >5 min):** Render cached data immediately, then refresh
  in the background. If the background fetch returns new data while the user is
  still on the same panel, the state updates seamlessly.
- **Cache miss:** Show loading spinner, fetch via IPC.
- **Prefetch:** 250ms after the first visible panel loads, all sibling tabs are
  fetched in the background so switching tabs feels instant.

### Navigation

Tools can declare **hidden panels** in their manifest (`hidden: true`). These
don't appear as tabs but can be navigated to via button actions. Example: a
"Leaderboard" tab has rows that navigate to a hidden "AIM Detail" panel.

Navigation state:

- **History stack:** Each navigation pushes the current panel to a stack. A back
  button appears when viewing a hidden panel.
- **Context:** Navigation actions can pass arbitrary context
  (e.g. `{ name: "hypercycle/ollama-aim" }`) which is forwarded to the WASM
  `mosaic_render_panel` call.

---

## WASM Tool Installation

### Manifest Extraction

**File:** `electron/integrations/sandbox/wasm-launcher.ts` → `extractManifest()`

When the user selects a `.wasm` file, MosAIc extracts the manifest by
**calling a function inside the WASM binary** itself:

```typescript
// 1. Read raw WASM bytes from disk
const wasmData = readFileSync(wasmPath);

// 2. Create a temporary Extism plugin with STUB host functions.
//    Stubs are required because the WASM module declares imports for
//    mosaic_log, mosaic_http_request, etc. The runtime refuses to
//    instantiate the module if ANY import is unresolved — even when
//    we only intend to call mosaic_manifest().
const plugin = await createPlugin(
  { wasm: [{ data: wasmData }] },
  { useWasi: true, runInWorker: true, functions: STUB_HOST_FUNCTIONS },
);

// 3. Call the mandatory mosaic_manifest() export
const result = await plugin.call("mosaic_manifest");
const manifest: ToolManifest = JSON.parse(result.text());

// 4. Validate all required fields
this.validateManifest(manifest);

// 5. Close the temporary plugin
await plugin.close();
```

**Why stubs?** WASM modules declare all their imports (host functions) at
compile time. Even though we only want to call `mosaic_manifest()`, the Extism
runtime won't instantiate the module unless every declared import has a binding.
The stubs are no-ops that satisfy the import table without doing anything.

**Validation** checks for: `manifestVersion`, `id` (kebab-case), `version`,
`displayName`, `description`, `runtime.type`, `permissions`, `resources`, and
at least one entry in `tools`.

### User Approval Gate

**File:** `src/components/SandboxPage.tsx` → `ManifestPreview`

After extraction, the manifest is shown to the user in a review UI:

- **Permissions:** Internet access, allowed domains, file paths, services
- **Resource limits:** Memory cap, execution timeout
- **Functions:** Every tool function with its description and input schema
- **UI panels:** What panels the tool will render
- **Declared inputs:** API keys or config values the tool needs

For **updates**, the UI computes a diff between the installed manifest and the
incoming one, highlighting:

- Added/removed domains, file paths, services
- Added/removed/changed functions
- Added/removed/changed panels
- Permission changes (internet toggled, memory/timeout changed)

The user must click "Approve & Install" (or "Approve & Update") to proceed.
The IPC handler enforces this:

```typescript
ipcMain.handle("toolSandbox:install", async (_event, wasmPath, approval) => {
  if (!approval?.approved) {
    return { success: false, error: "Installation requires explicit permission approval" };
  }
  return { success: true, data: await this.installTool(wasmPath) };
});
```

### Trusted Artifact Persistence

**File:** `electron/integrations/sandbox/index.ts` → `persistApprovedArtifact()`

Once approved, the WASM binary is copied to a trusted location:

```
~/.config/mosaic-companion/sandbox/tools/<toolId>/<toolId>-<version>-<hash12>.wasm
```

- `<hash12>` is the first 12 hex characters of the SHA-256 hash.
- The original source path is stored in `sourcePath` for reference.
- The stored path (`entryPath`) is what gets loaded at launch time.
- The full SHA-256 hash is stored in `fileHash` for integrity verification.

Metadata for all installed tools lives in:

```
~/.config/mosaic-companion/sandbox/installed-tools.json
```

### Approval Records

**Type:** `ApprovalRecord` in `electron/integrations/sandbox/types.ts`

Every install and update creates an approval record — a snapshot of exactly what
the user approved:

```typescript
interface ApprovalRecord {
  approvedAt: string;                  // ISO timestamp
  approvedVersion: string;             // Tool version at approval time
  approvedFileHash: string;            // SHA-256 of the approved WASM binary
  approvedPermissions: ToolPermissions; // Full permissions snapshot
  approvedFunctions: string[];          // Function names at approval time
  action: "install" | "update";        // What triggered the approval
}
```

Records are stored as an array on each `InstalledTool`, newest first. The UI
shows the last 3 approvals in the tool's expanded card.

---

## WASM Tool Launch

**File:** `electron/integrations/sandbox/index.ts` → `launchTool()`

### Integrity Verification

Before any WASM code runs, the stored artifact is re-hashed:

```typescript
const currentHash = sha256(readFileSync(installed.entryPath));
if (installed.fileHash !== currentHash) {
  throw new Error(
    `Tool integrity check failed for "${toolId}". ` +
    `Expected ${installed.fileHash.slice(0,12)}..., got ${currentHash.slice(0,12)}...`
  );
}
```

If the file was modified after install approval — by anything, for any reason —
**launch is refused**. There are no overrides.

### Input Data Resolution

```typescript
const inputData: Map<string, string> = this.resolveInputData(manifest);
```

If the manifest declares `inputs`, the system:

1. Reads `~/.config/mosaic-companion/sandbox/tool-inputs/<toolId>.json`
2. For each declared input key:
   - If a user-configured value exists and is a secret → decrypt via `safeStorage`
   - If a user-configured value exists and is a string → use as-is
   - If no user value but `default` is declared in the manifest → use the default
3. The resulting `Map<string, string>` is passed to the WASM launcher

The tool reads these values at runtime via the `mosaic_read_input(key)` host
function. It cannot enumerate keys beyond what it declared.

### Plugin Loading

**File:** `electron/integrations/sandbox/wasm-launcher.ts` → `launch()`

```typescript
// 1. Register manifest with Gatekeeper (sets up domain/file/service policies)
gatekeeperPolicy.registerTool(manifest);

// 2. Create host functions gated by the Gatekeeper
const hostFns = createHostFunctions(manifest, gatekeeperPolicy, inputData);

// 3. Build Extism-compatible function bindings
const extismFunctions = this.buildExtismFunctions(manifest.id, hostFns);

// 4. Load the WASM module with real host functions
const plugin = await createPlugin(
  { wasm: [{ data: wasmData }] },
  { useWasi: true, runInWorker: true, functions: extismFunctions },
);
```

At this point the WASM module is running. It can only interact with the host
through the 4 injected host functions.

### Tool Bridge Registration

**File:** `electron/integrations/sandbox/tool-bridge.ts` → `createToolBridge()`

The bridge wraps a running WASM tool as a standard `ToolModule`:

```typescript
const bridge: ToolModule = {
  name: "ext:hyperinsight",              // Prefixed with "ext:" for sandboxed tools
  displayName: "HyperInsight",
  tools: [/* ToolDefinition[] derived from manifest.tools */],
  getSystemPrompt: () => systemPrompt,   // Teaches the AI about this tool
  actionPatterns: [],                    // Sandbox tools use <use_tool>, not patterns
};
```

Once registered in the ToolRegistry, the AI agent can call the tool using the
same syntax as built-in tools:

```xml
<use_tool server="ext:hyperinsight" tool="get_network_stats">{}</use_tool>
```

The `ActionParser` in the renderer resolves `server="ext:hyperinsight"` to the
registered bridge, which calls `WasmLauncher.callFunction()` under the hood.

---

## Security Architecture

### Zero-Capability Default

WebAssembly modules run in a memory-isolated sandbox. A WASM tool:

- **Cannot** access the network
- **Cannot** read/write the filesystem
- **Cannot** access OS APIs, environment variables, or processes
- **Cannot** see other tools' memory or data

This is enforced by the WebAssembly specification itself — it's a hardware-level
boundary, not a software convention.

### Host Functions (Gatekeeper)

All capabilities come through exactly **4 host functions** injected into the
WASM module's import namespace:

| Host Function | Purpose | Gatekeeper Check |
| --- | --- | --- |
| `mosaic_http_request(url, method, headers, body)` | Make an HTTP request | Domain must be in `permissions.allowed_domains` |
| `mosaic_read_input(key)` | Read a pre-materialized input value | Key must exist in the pre-resolved `inputData` map |
| `mosaic_log(message)` | Append a log line | None (append-only to Chronicle) |
| `mosaic_write_output(data)` | Write structured output | None (append-only to Chronicle) |

If a function isn't in this list, the tool **physically cannot do it**.

### Domain Filtering

**File:** `electron/integrations/sandbox/gatekeeper.ts` → `ManifestGatekeeperPolicy`

When a tool calls `mosaic_http_request`, the Gatekeeper:

1. Parses the domain from the URL via `new URL(url).hostname`
2. Checks the domain against `manifest.permissions.allowed_domains` (exact match,
   case-insensitive)
3. Logs the decision (ALLOW or DENY) to the Chronicle
4. If denied, throws an error — the request never leaves the host

```typescript
checkDomain(toolId: string, domain: string): GatekeeperDecision {
  const manifest = this.manifests.get(toolId);
  if (!manifest.permissions.internet) {
    return { allowed: false, reason: "Tool has no internet permission" };
  }
  const isAllowed = manifest.permissions.allowed_domains
    .some(d => d.toLowerCase().trim() === domain.toLowerCase().trim());
  return isAllowed
    ? { allowed: true }
    : { allowed: false, reason: `Domain "${domain}" not in allowlist` };
}
```

File path and service access follow the same pattern — check against the
manifest's declared permissions, log the decision, allow or deny.

### Integrity Chain

| Stage | What's Checked |
| --- | --- |
| **Install** | SHA-256 computed from raw WASM bytes, stored in `installed-tools.json` |
| **Every launch** | SHA-256 recomputed from stored artifact, compared to recorded hash |
| **Approval record** | Hash snapshot preserved so you can verify what was actually approved |

If the stored `.wasm` file has been modified since approval, launch fails with
an explicit integrity error. There is no bypass.

### Input Isolation

Tools never access the filesystem to read secrets. The data flow:

1. Core reads `tool-inputs/<toolId>.json` at launch time
2. Secrets are decrypted from `safeStorage` (backed by the OS keychain)
3. Decrypted values are placed in an in-memory `Map<string, string>`
4. The map is captured in the host function closure
5. The tool calls `mosaic_read_input("api_key")` → gets the value from memory

The tool cannot:
- Enumerate keys it didn't declare in its manifest
- Access other tools' input files
- Read the encrypted JSON file on disk

### Chronicle Audit Trail

**File:** `electron/integrations/sandbox/chronicle.ts`

Every tool gets its own Chronicle — an append-only JSONL file:

```
~/.config/mosaic-companion/chronicles/<tool_id>/chronicle.jsonl
```

Recorded events:
- **Lifecycle:** launched, stopped
- **Audit:** every Gatekeeper decision (ALLOW/DENY with resource and reason)
- **Output:** structured data written by the tool via `mosaic_write_output`
- **Logs:** free-text messages from `mosaic_log`

There is no update or delete API — the Chronicle is append-only by design.

### Security Layers Diagram

```
┌──────────────────────────────────────────────────────┐
│  User Approval Gate                                  │
│  (manifest review + update diff UI)                  │
├──────────────────────────────────────────────────────┤
│  SHA-256 Integrity Verification                      │
│  (recomputed at every launch)                        │
├──────────────────────────────────────────────────────┤
│  GatekeeperPolicy                                    │
│  (domain / file path / service filtering per tool)   │
├──────────────────────────────────────────────────────┤
│  Host Functions                                      │
│  (4 total — the tool's only capabilities)            │
├──────────────────────────────────────────────────────┤
│  WASM Sandbox                                        │
│  (zero OS / network / filesystem access by default)  │
├──────────────────────────────────────────────────────┤
│  Chronicle Audit Trail                               │
│  (append-only JSONL per tool)                        │
└──────────────────────────────────────────────────────┘
```

---

## Generic Input System

Tools can declare named inputs in their manifest:

```json
{
  "inputs": {
    "api_key": {
      "type": "secret",
      "description": "API key for the service",
      "required": true
    },
    "region": {
      "type": "string",
      "description": "Preferred region",
      "required": false,
      "default": "us-east-1"
    }
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `type` | `"secret"` or `"string"` | Secrets are encrypted at rest via `safeStorage` |
| `description` | `string` | Shown to the user in the manifest review and config UI |
| `required` | `boolean` | Whether the tool can function without this input (default `true`) |
| `default` | `string` | Fallback value used when no user configuration exists |

**Storage:** `~/.config/mosaic-companion/sandbox/tool-inputs/<toolId>.json`

**UI:** The tool card's expanded view shows a configuration section per declared
input, with save/delete buttons, password masking for secrets, and status
indicators: "configured" (green), "using default" (blue), "not set" (gray).

**IPC methods:**
- `toolSandbox:setInput(toolId, key, value)` — store (encrypts secrets)
- `toolSandbox:deleteInput(toolId, key)` — remove a stored value
- `toolSandbox:getInputStatus(toolId)` — returns `{ key: boolean }` (has value or not)

---

## Detail Sidebar

**File:** `src/components/tool-ui/blocks/ToolDetailSidebar.tsx`

The detail sidebar is a right-side drawer that slides in when a user clicks a
list item, table row, or card — anything that warrants an "inspect" or
"drill-down" view. It's tool-scoped and doesn't interfere with MosAIc's
navigation sidebar on the left.

### Opening via Action Target

Any `ButtonAction` (used by buttons, table row clicks, form submits) can set
`target: "sidebar"` to route the tool's response into the sidebar:

```json
{
  "type": "table",
  "columns": [
    { "key": "name", "label": "Node" },
    { "key": "status", "label": "Status" }
  ],
  "rows": [
    { "name": "node-alpha", "status": "active" },
    { "name": "node-beta", "status": "idle" }
  ],
  "onRowClick": {
    "server": "ext:my-tool",
    "tool": "get_node_details",
    "args": { "nodeId": "${name}" },
    "target": "sidebar"
  }
}
```

When the user clicks a row:

1. `ToolPanelView` calls `get_node_details({ nodeId: "node-alpha" })` via IPC.
2. The tool returns blocks (e.g. cards, charts, stats about the node).
3. If the response contains a `detail-panel` block, that block is used directly.
4. Otherwise, the response blocks are wrapped in a synthetic `detail-panel`.
5. The sidebar slides in from the right, showing the tool's content.

The main panel underneath stays visible — the sidebar is an overlay.

### Opening via Block Type

A tool can also return a `detail-panel` block directly in any response:

```json
{
  "type": "detail-panel",
  "title": "Node: alpha-7",
  "subtitle": "Region: us-east-1 · Status: active",
  "width": "medium",
  "blocks": [
    { "type": "stat-card", "label": "Uptime", "value": "99.7%", "color": "green" },
    { "type": "stat-card", "label": "Requests/s", "value": "1,240", "color": "blue" },
    { "type": "section", "title": "Recent Activity", "blocks": [
      { "type": "table", "columns": [...], "rows": [...] }
    ]}
  ]
}
```

When `ToolPanelView` encounters a `detail-panel` block in any tool response
(panel render or action result), it extracts it and renders it in the sidebar.
The block is filtered out of the inline panel content.

### Sidebar Component Anatomy

```typescript
interface DetailPanelBlock {
  type: "detail-panel";
  title: string;                          // Header title
  subtitle?: string;                      // Optional subtitle
  width?: "narrow" | "medium" | "wide";   // 384px / 480px / 640px
  blocks: ToolUIBlock[];                  // Child blocks rendered in body
}
```

**Behavior:**
- Slides in from the right with CSS animation (250ms ease-out)
- Semi-transparent backdrop dims the panel underneath
- Closes on: X button click, Escape key, or backdrop click
- Scrollable body for long content
- Child blocks support full interactivity — buttons and forms inside the
  sidebar trigger actions via the same `handleAction` handler

---

## Confirmation Modal

**File:** `src/components/tool-ui/blocks/ToolConfirmModal.tsx`

The confirmation modal lets tools request explicit user consent before
performing critical actions. This works in **both** the panel UI and the
agent chat.

Use cases:
- "Confirm this transaction?" (Web3 transfers)
- "Delete this item permanently?"
- "Deploy to production?"
- "Grant this permission?"

### Returning a Confirm Modal from a Tool

A tool returns a `confirm-modal` block as part of its response:

```json
{
  "type": "confirm-modal",
  "title": "Confirm Transaction",
  "message": "Send 0.5 ETH to 0xabc1234...def? This action cannot be undone.",
  "severity": "warning",
  "confirmLabel": "Send",
  "cancelLabel": "Cancel",
  "confirmAction": {
    "server": "ext:web3-tool",
    "tool": "execute_transfer",
    "args": { "to": "0xabc1234...def", "amount": "0.5", "token": "ETH" }
  },
  "details": [
    { "type": "card", "title": "Transfer Details", "fields": [
      { "label": "To", "value": "0xabc1234...def", "icon": "globe" },
      { "label": "Amount", "value": "0.5 ETH", "icon": "zap", "color": "yellow" },
      { "label": "Network", "value": "Ethereum Mainnet", "icon": "database" }
    ]}
  ]
}
```

A button action can also use `target: "modal"` to indicate the response should
be treated as a modal:

```json
{
  "type": "button",
  "label": "Transfer",
  "variant": "danger",
  "action": {
    "server": "ext:web3-tool",
    "tool": "prepare_transfer",
    "args": { "to": "0xabc...", "amount": "0.5" },
    "target": "modal"
  }
}
```

### Severity Levels

| Severity | Use Case | Visual |
| --- | --- | --- |
| `info` (default) | Low-risk confirmations | Blue icon + accent |
| `warning` | Medium-risk, reversible actions | Yellow/amber icon + accent |
| `danger` | High-risk, irreversible actions | Red icon + accent |

Each severity has a matching icon (`Info`, `AlertTriangle`, `ShieldAlert`),
border color, background tint, and confirm button color.

### Modal in Agent Chat

When a tool called by the AI agent returns a `confirm-modal` block, MosAIc
extracts it from the tool result and shows the modal overlay in the chat view.
This lets the agent propose an action (e.g. "I'll transfer 0.5 ETH") while the
tool ensures the user explicitly approves before execution.

**Chat flow:**

```
Agent: "I'll transfer 0.5 ETH to the address you specified."
  → Agent calls <use_tool server="ext:web3-tool" tool="prepare_transfer">
  → Tool returns confirm-modal block
  → MosAIc shows modal overlay in chat
  → User clicks "Confirm" → confirmAction fires → tool executes transfer
  → User clicks "Cancel" → modal closes, no action taken
```

The `confirm-modal` block is filtered out of the inline message blocks —
it only renders as a modal overlay, never inline in the chat.

### Modal Component Anatomy

```typescript
interface ConfirmModalBlock {
  type: "confirm-modal";
  title: string;                        // Modal title
  message: string;                      // Descriptive message
  severity?: "info" | "warning" | "danger";
  details?: ToolUIBlock[];              // Optional detail blocks between message and buttons
  confirmLabel?: string;                // Default: "Confirm"
  cancelLabel?: string;                 // Default: "Cancel"
  confirmAction: ButtonAction;          // Fired on confirm
  cancelAction?: ButtonAction;          // Fired on cancel (optional — default just closes)
}
```

**Behavior:**
- Centered overlay with backdrop blur
- Scale-in animation (200ms ease-out)
- Closes on: Cancel click, Escape key, or backdrop click
- Confirm triggers the `confirmAction` via the same action handler, then closes
- Cancel triggers `cancelAction` if provided, then closes
- Detail blocks inside the modal support full rendering (cards, tables, text, etc.)

---

## Sidebar & Routing Integration

### Pinned Tools in Sidebar

**File:** `src/components/Sidebar.tsx`

Tools can be "pinned" from the SandboxPage tool card. Pinned tools with at
least one UI panel appear in a dedicated **Pinned Tools** section in the
sidebar. The list refreshes every 15 seconds.

Clicking a pinned tool navigates to `mosaic://tool-panel/<toolId>`.

### ContentArea Routing

**File:** `src/components/ContentArea.tsx`

Added routing for the `mosaic://tool-panel/` prefix. When a navigation to this
URL occurs:

1. Fetch the installed tools list via IPC
2. Find the matching tool by ID
3. Render `ToolPanelView` with the tool's manifest

---

## Files Changed

| Area | Files | What Changed |
| --- | --- | --- |
| **Sandbox core** | `electron/integrations/sandbox/index.ts`, `types.ts`, `wasm-launcher.ts` | Install/update with approval records, SHA-256 integrity, input system, panel/function IPC |
| **Gatekeeper** | `electron/integrations/sandbox/gatekeeper.ts` | Domain/file/service policy enforcement + host function factory |
| **Tool bridge** | `electron/integrations/sandbox/tool-bridge.ts` | WASM → ToolModule adapter with system prompt builder |
| **IPC layer** | `electron/preload.ts`, `global.d.ts` | `renderPanel`, `callFunction`, `setInput`, `deleteInput`, `getInputStatus` |
| **Panel rendering** | `src/components/ToolPanelView.tsx` (new) | Full panel lifecycle with caching, prefetch, navigation |
| **Sandbox page** | `src/components/SandboxPage.tsx` | Manifest review, update diff, approval history, input config, pin/open panel |
| **UI blocks** | `src/components/tool-ui/` (12 files) | `stat-card`, `badge`, `detail-panel`, `confirm-modal`, enhanced table/card/tabs/section/text/button/form |
| **Navigation** | `src/components/Sidebar.tsx`, `ContentArea.tsx`, `src/types/types.ts` | Pinned tools sidebar, tool-panel routing |
| **Chat integration** | `src/components/Chatview.tsx` | Confirmation modal rendering from tool responses in agent chat |
| **External** | `.gitmodules`, `external/mosaic-tools` | Submodule for co-developed WASM tools |
