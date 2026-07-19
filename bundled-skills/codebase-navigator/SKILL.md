---
name: codebase-navigator
description: Navigate and understand large codebases efficiently. Build mental models, find patterns, trace dependencies, and generate architecture maps. Optimized for TypeScript/React and Node.js projects.
version: 1.0.0
trigger: When exploring a codebase, finding patterns, tracing imports, or building architecture understanding
---

# Codebase Navigator Skill

## What It Does

Large codebases (10K+ files) are impossible to hold in context. This skill provides:
- **Import graph tracing** — Follow dependency chains
- **Pattern detection** — Find similar structures across files
- **Architecture mapping** — Generate component/service diagrams
- **Symbol indexing** — Fast lookup of functions, classes, types
- **Change impact analysis** — What breaks if I modify X?

## Core Tools

### 1. Import Graph Analysis

```typescript
// Uses ts-morph or tree-sitter to parse imports
const graph = await analyzeImports({
  entryPoints: ['src/main.ts'],
  depth: 3,
  includeNodeModules: false
});
// Returns: { file -> imports[], importedBy[], depth }
```

### 2. Pattern Finder

```typescript
// Find all Redux slices
const patterns = await findPatterns({
  type: 'redux-slice',
  grep: 'createSlice\\s*\\(',
  fileGlob: '**/*.ts'
});

// Find all React hooks
const hooks = await findPatterns({
  type: 'custom-hook',
  grep: 'function use[A-Z]',
  fileGlob: '**/*.tsx'
});
```

### 3. Symbol Index

```typescript
// Build index of all exported symbols
const index = await buildSymbolIndex({
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['**/*.test.ts', '**/node_modules/**']
});
// Returns: { name, kind, file, line, exportType }
```

## MCP Tools

### codebase_analyze_imports

**Input**:
```json
{
  "entryPoint": "src/components/App.tsx",
  "depth": 2,
  "includeTypes": true
}
```

**Output**:
```json
{
  "files": 47,
  "imports": [
    { "from": "./Button", "file": "App.tsx", "line": 5, "isDefault": true }
  ],
  "cycles": [],
  "depth": 2
}
```

### codebase_find_symbol

**Input**:
```json
{
  "symbol": "useAuth",
  "kind": "function"
}
```

**Output**:
```json
{
  "definitions": [
    { "file": "src/hooks/useAuth.ts", "line": 12, "kind": "function" }
  ],
  "references": [
    { "file": "src/components/Login.tsx", "line": 8 }
  ]
}
```

### codebase_detect_patterns

**Input**:
```json
{
  "patterns": ["react-component", "redux-slice", "ipc-handler"],
  "limit": 100
}
```

**Output**:
```json
{
  "react-component": [
    { "file": "src/components/Button.tsx", "name": "Button", "props": [...] }
  ],
  "redux-slice": [...],
  "ipc-handler": [...]
}
```

## Usage Workflows

### Workflow 1: New Feature Integration

When adding a feature to an unfamiliar area:
1. Find entry point via `codebase_find_symbol` (e.g., "Settings page")
2. Trace dependencies with `codebase_analyze_imports`
3. Detect patterns with `codebase_detect_patterns` (how do others add IPC?)
4. Identify insertion point

### Workflow 2: Refactoring Impact

Before renaming `UserService`:
1. `codebase_find_symbol` → get all references
2. Group by component/module
3. Check test coverage
4. Plan migration order

### Workflow 3: Architecture Documentation

For onboarding docs:
1. `codebase_detect_patterns` → get all service patterns
2. `codebase_analyze_imports` → build dependency graph
3. Generate Mermaid diagram
4. Cross-reference with existing docs

## Performance Tips

- Cache symbol index in SQLite (update on git commit)
- Use ripgrep for fast greps (respects .gitignore)
- Lazy-load file contents (only parse on demand)
- Parallelize independent searches

## Integration with Other Skills

- `mosaic-stargate` — Navigate Stargate module specifically
- `ide-integration` — Jump to definitions in IDE
- `axi-executor` — Run `codenav-axi` CLI for offline analysis

## AXI Tool: codenav-axi

A companion CLI tool for offline analysis:

```bash
# Build index
codenav-axi index --project ~/mosaic-companion

# Query
codenav-axi find "useAuth" --kind function
codenav-axi imports src/main.ts --depth 2
codenav-axi patterns --detect react-component,ipc-handler
```

Output uses TOON format for agent consumption.
