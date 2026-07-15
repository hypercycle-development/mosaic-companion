---
name: planning-and-task-breakdown
description: Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering. Use when you have a spec and need implementable units.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human

## The Planning Process

### Step 1: Enter Plan Mode

Before writing any code:
- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document.

### Step 2: Map the Dependency Graph

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

### Step 3: Slice Vertically

**Bad (horizontal):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
```

Each slice delivers working, testable functionality.

## Task Template

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]
- [ ] Tests pass

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [XS | S | M | L]
```

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config | Add validation rule |
| **S** | 1-2 | One component or endpoint | Add new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering |
| **XL** | 8+ | **Break it down** | — |

## Plan Document Template

```markdown
# Implementation Plan: [Feature Name]

## Overview
[One paragraph summary]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Phase 3: Polish
- [ ] Task 5: ...

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
```

## Anti-Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I'll figure it out as I go" | That's how you end up with a tangled mess. 10 minutes of planning saves hours. |
| "This is just a small change" | Small changes compound. Without a plan, you lose track of what's done. |
| "Planning is overhead" | Planning is an investment. The return is reliable delivery and maintainable code. |

## Verification

- [ ] Tasks are small enough for single-session completion
- [ ] Each task has clear acceptance criteria
- [ ] Dependencies are mapped and ordered
- [ ] Checkpoints are defined for review gates
