---
name: kanban-project-init
description: Initialize new kanban boards for multi-profile agent workflows. One-command board creation, task graph setup, and dependency wiring for research → backend → ops pipelines.
version: 1.0.0
metadata:
  hermes:
    tags: [kanban, orchestration, project-setup, multi-agent]
---

# Kanban Project Initialization Skill

## Purpose
Standardized pattern for spinning up new kanban boards with multi-profile task graphs (researcher → backend-eng → ops).

## Quick Start

```bash
# 1. Create and switch to new board
hermes kanban boards create <project-name> --description "..."
hermes kanban boards switch <project-name>

# 2. Verify profiles exist
hermes profile list

# 3. Create research task (runs immediately)
kanban_create(
    title="[Research] <Project> Analysis",
    assignee="researcher",
    body="## Goal\nAnalyze...",
    workspace_kind="dir",
    workspace_path="/absolute/path/to/repo"
)

# 4. Create dependent tasks (blocked until research completes)
kanban_create(
    title="[Backend Eng] <Project> Implementation",
    assignee="backend-eng",
    parents=["<research-task-id>"],
    workspace_kind="worktree"
)

kanban_create(
    title="[Ops] <Project> Infrastructure",
    assignee="ops",
    parents=["<research-task-id>"],
    workspace_kind="dir"
)
```

## Critical Patterns

### 1. Board-Per-Quest Organization (User Requirement)
**Each distinct quest/project gets its own board.** This preserves quest history and allows jumping between boards to analyze previous work.

```bash
# Pattern: Create board for each quest
hermes kanban boards create quest-{feature-name}
hermes kanban boards switch quest-{feature-name}

# Example boards:
# - quest-marketing-videos
# - quest-stargate-integration  
# - quest-onboarding-flow
```

**Benefits:**
- Isolated task history per quest
- Can reference previous quest work by switching boards
- Cleaner project organization
- Easier to audit what was done for each initiative

### 2. Always Set the Target Board Explicitly
The `kanban_create` tool resolves the active board from the `HERMES_KANBAN_BOARD` environment variable. That variable is **not always set** in long-running or desktop sessions, and `hermes kanban boards switch` only updates the Hermes CLI state — it does **not** export `HERMES_KANBAN_BOARD` into the current process.

**Therefore, always pass `board: "<board-name>"` explicitly in every `kanban_create()` call.** Relying on the ambient env or a prior `switch` is a common source of tasks landing on the wrong board.

```python
# ✅ Correct — board is explicit
kanban_create(
    title="Register first agent on midnight.city",
    assignee="senior-ai-developer",
    board="midnight",          # <- never omit this
)

# ❌ Risky — depends on HERMES_KANBAN_BOARD being set
kanban_create(title="Register first agent on midnight.city", assignee="senior-ai-developer")
```

**CLI verification before batch creation:**
```bash
hermes kanban boards show  # Confirm current board
echo $HERMES_KANBAN_BOARD  # Confirm env var (often empty)
export HERMES_KANBAN_BOARD=<board-name>  # Pin it for the shell session
```

### 2. Profile Toolset Verification
Before creating tasks, verify target profiles have required toolsets:

| Profile | Required Toolsets | Verify Command |
|---------|-------------------|----------------|
| researcher | terminal, file, web, search | `hermes -p researcher config get toolsets` |
| backend-eng | terminal, file, browser, code_execution | `hermes -p backend-eng config get toolsets` |
| ops | terminal, file, web, cronjob | `hermes -p ops config get toolsets` |

### 3. Workspace Kind Selection

| Task Type | workspace_kind | Reason |
|-----------|---------------|--------|
| Research/analysis | `scratch` or `dir` | Read-only, no git needed |
| Code implementation | `worktree` | Clean git state for commits |
| Infrastructure/ops | `dir` | May need persistent state |

### 4. Pre-flight Infrastructure Verification (Before Dispatching `ops` Tasks)

When tasks require accessing remote infrastructure (servers, edge devices, VMs, IoT fleet), verify connectivity from the orchestrator host BEFORE creating tasks. Workers inherit the orchestrator's SSH agent and `~/.ssh/config` but cannot configure new host entries themselves.

**SSH connectivity checklist:**
```bash
# Verify ~/.ssh/config has entries for target hosts
grep -E "^Host\s+" ~/.ssh/config

# Verify host keys are in known_hosts
grep "<target_ip>" ~/.ssh/known_hosts

# Test actual SSH connectivity
ssh -o ConnectTimeout=5 -o BatchMode=yes <user>@<host> "hostname" 2>/dev/null && echo "REACHABLE" || echo "NOT REACHABLE"
```

**For HyperAIBox / RK3588 edge fleets specifically:** See `kanban-orchestrator/references/hyperaibox-fleet-ssh-access.md` for the complete pre-flight pattern, including host key scanning, multi-key verification, and a real incident transcript where one box (C-3PO) had a different authorized key than the others.

**If SSH is not configured yet:** Do NOT dispatch `ops` tasks that require remote access. Instead, dispatch a local `ops` task to set up SSH first, or ask the user for credentials. Creating tasks that will inevitably crash wastes dispatcher cycles and pollutes the board with false-starts.

### 5. Dependency Wiring
Always use explicit `parents=[...]` to gate task promotion:
- Child tasks stay in `todo` until ALL parents reach `done`
- Dispatcher auto-promotes when parents complete
- No manual coordination needed

### 6. Gateway Health Check
Verify dispatcher is running before expecting task pickup:
```bash
pgrep -f "hermes gateway" || hermes gateway run
```

## Common Pitfalls

**Task lands on wrong board:** `kanban_create()` was called without `board: "..."`. The `HERMES_KANBAN_BOARD` env var is not reliably present, and `hermes kanban boards switch` does not export it. Fix: pass `board` explicitly on every `kanban_create()` call, then verify with `hermes kanban list` scoped to that board.

**Profile has no toolsets:** Worker spawns but cannot execute. Fix: verify toolsets before creating tasks.

**Child tasks never start:** Parent not completing. Fix: check `kanban_show(parent_id)` for blockers.

**Workspace path doesn't exist:** Task fails immediately. Fix: use absolute paths, verify directory exists.

## Example: Stargate-Mosaic Board

```bash
hermes kanban boards create stargate-mosaic --description "Stargate integration work"
hermes kanban boards switch stargate-mosaic

# Research task (no parents, runs immediately)
t1 = kanban_create(
    title="[Research] Stargate Integration Analysis",
    assignee="researcher",
    workspace_path="/home/mauricio/mosaic-companion"
)["task_id"]

# Implementation tasks (blocked on t1)
kanban_create(title="[Backend Eng] Fix UI Wiring", assignee="backend-eng", parents=[t1])
kanban_create(title="[Ops] Verify Infrastructure", assignee="ops", parents=[t1])
```

## Handling Crashed Tasks (Protocol Violations)

When tasks show `protocol_violation` (worker exited without calling kanban_complete):

1. **Check if work is actually done** — Verify externally (files changed, services running)
2. **If done** — Manually complete with `kanban_complete()` documenting the fix
3. **If not done** — Let task retry or block for human review

See `kanban-orchestrator/references/manual-completion-for-crashed-tasks.md`

## Verification Commands

```bash
# See task graph
hermes kanban list

# Watch task progress
hermes kanban tail <task-id>

# Check dispatcher health
hermes kanban diagnostics
```
