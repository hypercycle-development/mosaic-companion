---
name: git-workflow-and-versioning
description: Treat commits as save points, branches as sandboxes, and history as documentation. Use when making any code change.
---

# Git Workflow and Versioning

## Overview

Git is your safety net. Treat commits as save points, branches as sandboxes, and history as documentation. With AI agents generating code at high speed, disciplined version control keeps changes manageable, reviewable, and reversible.

## When to Use

Always. Every code change flows through git.

## Core Principles

### Trunk-Based Development (Recommended)

Keep `main` always deployable. Work in short-lived feature branches that merge back within 1-3 days.

```
main ──●──●──●──●──●──●──●──●──●──  (always deployable)
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← short-lived branches (1-3 days)
```

- **Dev branches are costs.** Every day a branch lives, it accumulates merge risk.
- **Feature flags > long branches.** Deploy incomplete work behind flags rather than keeping it on a branch for weeks.

### 1. Commit Early, Commit Often

Each successful increment gets its own commit. Don't accumulate large uncommitted changes.

```
Work pattern:
  Implement slice → Test → Verify → Commit → Next slice

Not this:
  Implement everything → Hope it works → Giant commit
```

### 2. Atomic Commits

Each commit does one logical thing:

```
# Good: Each commit is self-contained
git log --oneline
a1b2c3d Add task creation endpoint with validation
d4e5f6g Add task creation form component
h7i8j9k Connect form to API and add loading state
m1n2o3p Add task creation tests

# Bad: Everything mixed together
git log --oneline
x1y2z3a Add task feature, fix sidebar, update deps, refactor utils
```

### 3. Descriptive Messages

Commit messages explain the *why*, not just the *what*:

```
# Good: Explains intent
feat: add email validation to registration endpoint

Prevents invalid email formats from reaching the database.
Uses Zod schema validation at the route handler level.

# Bad: Describes what's obvious from the diff
update auth.ts
```

**Format:**
```
<type>: <short description>

<optional body explaining why>
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code change (no feature/fix)
- `test` — Adding/updating tests
- `docs` — Documentation only
- `chore` — Tooling, dependencies, config

### 4. Keep Concerns Separate

Don't combine formatting changes with behavior changes. Each type of change should be separate.

### 5. Size Your Changes

Target ~100 lines per commit/PR.

## Branch Naming

```
feature/<short-description>   → feature/task-creation
fix/<short-description>       → fix/duplicate-tasks
refactor/<short-description>  → refactor/auth-module
```

## Git Checklist

- [ ] Commits are atomic (one logical thing each)
- [ ] Commit messages explain the "why"
- [ ] Commits are frequent (not accumulated)
- [ ] Concerns are separated (formatting ≠ behavior)
- [ ] Changes are sized for review (~100 lines)
- [ ] Branch names are descriptive
- [ ] Branches are short-lived (1-3 days max)
