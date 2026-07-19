---
name: pattern-extractor
description: Extract reusable patterns from work sessions. Codify workflows, capture architecture decisions, and auto-generate skills from completed tasks.
version: 1.0.0
trigger: After completing work, "extract pattern from this", "make this reusable", or when building skill libraries
---

# Pattern Extractor Skill

## What It Does

Every work session contains implicit patterns. This skill:
- **Analyzes completed work** — Files changed, commands run, decisions made
- **Extracts reusable patterns** — Code patterns, debugging workflows, architecture decisions
- **Generates skills** — Auto-create SKILL.md from patterns
- **Updates existing skills** — Add new references to established skills
- **Builds pattern libraries** — Searchable corpus of solutions

## The Pattern Hierarchy

```
Session Work
    ↓ Extract
Pattern (specific solution to one problem)
    ↓ Generalize
Template (parametrized solution class)
    ↓ Document
Skill (reusable knowledge module)
```

## Extraction Pipeline

### Step 1: Session Analysis

Input: Kanban task + git diff + terminal history

```typescript
const session = await analyzeSession({
  taskId: 'kb-123',
  filesChanged: ['src/components/Button.tsx', '...'],
  commandsRun: ['git checkout -b feature', 'npm install', ...],
  decisions: [...],
  blockers: [...]
});
```

### Step 2: Pattern Detection

Detect pattern types:
- **Code Pattern** — React component structure, IPC handler pattern, etc.
- **Debug Pattern** — 8-phase debugging protocol, log analysis
- **Architecture Pattern** — Service decomposition, event sourcing
- **Integration Pattern** — API wiring, MCP bridge
- **Workflow Pattern** — Deployment, testing, review

### Step 3: Pattern Storage

Store in SQLite for querying:

```sql
CREATE TABLE patterns (
  id TEXT PRIMARY KEY,
  type TEXT, -- code, debug, architecture, integration, workflow
  title TEXT,
  description TEXT,
  context TEXT, -- when to use
  solution TEXT, -- how to apply
  examples JSON, -- file paths, code snippets
  tags JSON,
  source_task TEXT,
  created_at INTEGER
);
```

## MCP Tools

### pattern_extract

**Input**:
```json
{
  "sessionId": "kb-456",
  "scope": "files_changed", // or "terminal_history", "full_session"
  "patternTypes": ["code", "debug", "architecture"]
}
```

**Output**:
```json
{
  "patterns": [
    {
      "type": "code",
      "title": "IPC Bridge Pattern for CORS-less APIs",
      "description": "When integrating external APIs without CORS, create an IPC handler in main.ts",
      "context": "External API panel integration in Electron",
      "solution": "1. Add handler in main.ts\n2. Expose in preload.ts\n3. Call from renderer",
      "examples": ["src/services/external/NodeFactoryTracker.ts"],
      "files": ["electron/main.ts:1234", "electron/preload.ts:456"],
      "confidence": 0.92
    }
  ]
}
```

### pattern_generate_skill

**Input**:
```json
{
  "patternIds": ["pat-123", "pat-124"],
  "skillName": "external-api-integration",
  "category": "software-development"
}
```

**Output**:
```json
{
  "skillPath": "~/.hermes/skills/software-development/external-api-integration/SKILL.md",
  "created": true,
  "references": [...]
}
```

## Pattern Libraries

### Library 1: Debugging Patterns

| Pattern | When to Use | Key Steps |
|---------|-------------|-----------|
| 8-Phase Debug | Any complex bug | Understand→Hypothesize→Isolate→Verify→Fix→Test→Prevent→Detective |
| React Prop Drill | Missing callback | Trace prop through parent chain |
| Health Check 404 | Endpoint not found | Check route registration, port binding |

### Library 2: Integration Patterns

| Pattern | Context | Implementation |
|---------|---------|----------------|
| IPC Bridge | CORS-less external API | main.ts handler → preload.ts expose → renderer call |
| MCP Tool | Add capability to agent | schema → handler → register |
| AIM Wrapper | Package tool for HyperCycle | manifest → docker → deploy |

### Library 3: Architecture Patterns

| Pattern | Use Case | Structure |
|---------|----------|-----------|
| Service Registry | Many services | Central registry with health checks |
| Event Bus | Decoupled components | Pub/sub with typed events |
| Plugin System | Extensible features | Manifest → loader → lifecycle |

## Workflow: Post-Session Extraction

After completing work:

```typescript
// 1. Extract patterns from this session
const patterns = await patternExtract({
  sessionId: process.env.HERMES_KANBAN_TASK,
  scope: 'full_session'
});

// 2. Review with user (optional)
for (const pattern of patterns) {
  const shouldCreate = await confirm(`Create skill from "${pattern.title}"?`);
  if (shouldCreate) {
    await patternGenerateSkill({
      patternIds: [pattern.id],
      skillName: slugify(pattern.title),
      category: 'software-development'
    });
  }
}

// 3. Index to codebase-memory MCP
await indexToMemory({ patterns, sessionId });
```

## Skill Auto-Generation Template

Generated skills follow this structure:

```markdown
---
name: {pattern_slug}
description: {pattern_description}
version: 1.0.0
trigger: {pattern_context}
---

# {pattern_title}

## What It Does
{pattern_solution_summary}

## When to Use
{pattern_context}

## Steps
{numbered_steps}

## Example
```typescript
{code_from_session}
```

## Files
{list_of_files_changed}

## Pitfalls
{blockers_encountered}

## Source
Extracted from task {task_id} on {date}
```

## Integration

- **After kanban_complete** — Auto-extract patterns from finished work
- **With mosaic-bot** — Periodically suggest "You solved X before — want to skillify it?"
- **With codebase-memory** — Index patterns as graph nodes for retrieval
