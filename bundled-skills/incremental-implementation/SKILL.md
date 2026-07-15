---
name: incremental-implementation
description: Build in thin vertical slices — implement one piece, test it, verify it, commit. Use when implementing any multi-file change.
---

# Incremental Implementation

## Overview

Build in thin vertical slices — implement one piece, test it, verify it, commit. Each increment should leave the system in a working, testable state.

## When to Use

- Implementing any multi-file change
- Building a new feature from a task breakdown
- Refactoring existing code
- Any time you're tempted to write more than ~100 lines before testing

## The Increment Cycle

```
┌──────────────────────────────────────┐
│                                      │
│   Implement ──→ Test ──→ Verify ──┐  │
│       ▲                           │  │
│       └───── Commit ◄─────────────┘  │
│              │                       │
│              ▼                       │
│          Next slice                  │
│                                      │
└──────────────────────────────────────┘
```

## Slicing Strategies

### Vertical Slices (Preferred)

Build one complete path through the stack:

```
Slice 1: Create a task (DB + API + basic UI) → Working end-to-end
Slice 2: List tasks (query + API + UI) → Working end-to-end
Slice 3: Edit a task (update + API + UI) → Working end-to-end
```

### Contract-First Slicing

When backend and frontend need parallel development:

```
Slice 0: Define API contract (types, interfaces, OpenAPI spec)
Slice 1a: Implement backend against contract + API tests
Slice 1b: Implement frontend against mock data
Slice 2: Integrate and test end-to-end
```

### Risk-First Slicing

Tackle the riskiest piece first:

```
Slice 1: Prove WebSocket connection works (highest risk)
Slice 2: Build real-time updates on proven connection
Slice 3: Add offline support and reconnection
```

## Implementation Rules

### Rule 0: Simplicity First

Before writing any code, ask: "What is the simplest thing that could work?"

```
SIMPLICITY CHECK:
✗ Generic EventBus with middleware for one notification
✓ Simple function call

✗ Abstract factory pattern for two similar components
✓ Two straightforward components with shared utilities
```

### Rule 0.5: Scope Discipline

Touch only what the task requires.

**Do NOT:**
- "Clean up" code adjacent to your change
- Refactor imports in files you're not modifying
- Remove comments you don't fully understand
- Add features not in the spec

If you notice something worth improving, **note it — don't fix it**:

```
NOTICED BUT NOT TOUCHING:
- src/utils/format.ts has unused import (unrelated)
- Auth middleware could use better errors (separate task)
```

### Rule 1: Compile and Test Existing Work Before Building More

When resuming a multi-session build, **compile and test what already exists before adding new components.**

**Anti-pattern:**
```
Build A → Build B → Build C → Compile everything → Fix 47 errors
```

**Correct pattern:**
```
Build A → Compile A → Test A → Fix A
Build B → Compile B → Test B → Fix B
Build C → Compile C → Test C → Fix C
```

**Why:** Compilation errors in existing code block new code. Fix the foundation before extending.

**Example from AXI tool building:**
```bash
# Session 1: Built hbox-axi scaffold (commands, libs, entry)
# Session 2: RESUME — compile and test BEFORE building spo-axi

cd ~/mosaic-companion/axi-tools/hbox-axi
npx tsc                          # Verify no compile errors
node dist/index.js               # Test content-first output
node dist/index.js --help        # Verify help system
node dist/index.js status --node c3po  # Test real SSH against fleet
# ONLY THEN → proceed to build spo-axi
```

### Rule 2: One Thing at a Time

Each increment changes one logical thing.

**Bad:** One commit that adds a component, refactors existing code, and updates build config.

**Good:** Three separate commits — one for each change.

### Rule 2: Keep It Compilable

After each increment, the project must build and existing tests must pass.

### Rule 3: Feature Flags for Incomplete Features

```typescript
const ENABLE_TASK_SHARING = process.env.FEATURE_TASK_SHARING === 'true';

if (ENABLE_TASK_SHARING) {
  // New sharing UI
}
```

### Rule 4: Safe Defaults

New code should default to safe, conservative behavior:

```typescript
// Safe: disabled by default, opt-in
export function createTask(data: TaskInput, options?: { notify?: boolean }) {
  const shouldNotify = options?.notify ?? false;
  // ...
}
```

### Rule 5: Rollback-Friendly

Each increment should be independently revertable.

## Increment Checklist

- [ ] This increment touches only what's needed
- [ ] Tests pass after this increment
- [ ] Build succeeds after this increment
- [ ] System is in a working state
- [ ] Commit message explains the "why"
- [ ] I can describe what this increment does in one sentence

## Anti-Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I'll test everything at the end" | "At the end" never comes. Test each increment or you'll ship bugs. |
| "This is faster if I do it all at once" | It's faster until it breaks. Then debugging takes 10x longer. |
| "I need to see the whole picture" | You can see the whole picture in the plan. Implement one slice at a time. |

## Verification

- [ ] Each increment is tested before proceeding
- [ ] Build passes after each increment
- [ ] Commits are atomic and descriptive
- [ ] System remains functional throughout
