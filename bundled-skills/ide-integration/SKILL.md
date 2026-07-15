---
name: ide-integration
description: Integrate Hermes Agent with the Mosaic IDE (embedded in Mosaic Companion). Enables context-aware editing, code navigation, inline completions, and IDE-triggered agent actions.
version: 1.0.0
trigger: When user mentions IDE, code editor, inline editing, or wants agent to work with Mosaic's embedded editor
---

# IDE Integration Skill

## What It Does

Mosaic Companion has an **embedded IDE** for code editing. This skill enables Hermes Agent to:
- Read the current file from the IDE context
- Suggest edits inline
- Navigate between files
- Execute IDE commands (goto definition, find references, refactor)
- Trigger agent actions from IDE events (onSave, onOpen, onCursorMove)

## Architecture

```
Mosaic IDE (Monaco/CodeMirror)
    ↓ IPC / WebSocket
electron/integrations/ide/
    ├── src/main/ide-bridge.ts      # Main process bridge
    ├── src/preload/ide-api.ts       # Preload API
    └── src/renderer/ide-service.ts  # React service
    ↓
Hermes Agent (via hermes-tools MCP)
```

## MCP Tool: ide_get_context

**Purpose**: Get current IDE state for agent context

**Input**:
```json
{
  "includeContent": true,
  "includeSelection": true,
  "lineRange": { "start": 1, "end": 50 }
}
```

**Output**:
```json
{
  "filePath": "/home/user/project/src/app.ts",
  "language": "typescript",
  "content": "...",
  "cursor": { "line": 42, "column": 15 },
  "selection": { "startLine": 40, "endLine": 45 },
  "symbols": [{ "name": "MyClass", "kind": "class", "line": 10 }]
}
```

## MCP Tool: ide_apply_edit

**Purpose**: Apply an edit to the IDE

**Input**:
```json
{
  "filePath": "/home/user/project/src/app.ts",
  "edits": [
    {
      "range": { "startLine": 42, "startColumn": 0, "endLine": 42, "endColumn": 100 },
      "newText": "const result = await fetchData();"
    }
  ]
}
```

## Usage Patterns

### Pattern 1: IDE-Aware Code Review

When user says "review this file", the agent:
1. Calls `ide_get_context` to get current file
2. Analyzes code structure
3. Returns inline comments via `ide_apply_edit` with comment markers

### Pattern 2: Inline Suggestion

When user says "improve this function", the agent:
1. Gets selection from context
2. Generates improved version
3. Shows diff in IDE's inline diff widget

### Pattern 3: Cross-File Navigation

When user says "find where this is used", the agent:
1. Gets symbol at cursor
2. Calls `ide_find_references`
3. Returns file:line locations

## IPC Handlers to Add

```typescript
// electron/main.ts
ipcMain.handle('ide:getContext', async (_, opts) => {
  return ideBridge.getContext(opts);
});

ipcMain.handle('ide:applyEdit', async (_, edit) => {
  return ideBridge.applyEdit(edit);
});

ipcMain.handle('ide:gotoDefinition', async (_, symbol) => {
  return ideBridge.gotoDefinition(symbol);
});

ipcMain.handle('ide:findReferences', async (_, symbol) => {
  return ideBridge.findReferences(symbol);
});
```

## Preload Exposure

```typescript
// preload.ts
ide: {
  getContext: (opts) => ipcRenderer.invoke('ide:getContext', opts),
  applyEdit: (edit) => ipcRenderer.invoke('ide:applyEdit', edit),
  gotoDefinition: (symbol) => ipcRenderer.invoke('ide:gotoDefinition', symbol),
  findReferences: (symbol) => ipcRenderer.invoke('ide:findReferences', symbol),
}
```

## Agent System Prompt Context

When this skill is loaded, add to system prompt:

```
The user has an embedded IDE in Mosaic Companion. Available commands:
- Get current file context: Use ide_get_context
- Apply edits: Use ide_apply_edit
- Navigate to definition: Use ide_gotoDefinition
- Find references: Use ide_findReferences

Always prefer IDE-aware tools over terminal/file operations when editing code.
```

## Pitfalls

1. **Race conditions**: IDE may not have saved file to disk yet — always use IDE context, not fs.readFile
2. **Large files**: Request line ranges, not entire file for 10K+ line files
3. **Language detection**: Trust IDE's language ID over file extension
4. **Symbol resolution**: IDE may not have indexed — provide fallback to text search

## Related Skills

- `mosaic-stargate` — For Stargate-related code
- `codebase-navigator` — For large codebase exploration
- `axi-executor` — For running AXI tools from IDE
