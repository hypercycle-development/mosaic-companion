---
name: tasks
description: Manage your task list — add, complete, list, and prioritize tasks stored in TASKS.md
user-invocable: true
disable-model-invocation: false
metadata: {"openclaw":{"emoji":"✅","always":false,"requires":{"bins":[]}}}
---

# tasks — Task List Manager

Use this skill to manage your personal task list stored in `TASKS.md` in the workspace root.

## Commands

- `/tasks` — Show all open tasks
- `/tasks add <description>` — Add a new task
- `/tasks done <number>` — Mark task #N as complete
- `/tasks clear` — Remove all completed tasks
- `/tasks priority <number> <high|medium|low>` — Set priority on a task

## TASKS.md Format

```markdown
# Task List

## Open
- [ ] (high) Write unit tests for auth module
- [ ] (medium) Update README with setup instructions
- [ ] (low) Refactor legacy API adapter

## Completed
- [x] Bootstrap Electron app skeleton
- [x] Add SQLite memory backend
```

## Usage Examples

### List all tasks
```
/tasks
```

### Add a task
```
/tasks add Integrate OAuth provider for user login
```

### Complete a task
```
/tasks done 2
```

### Set priority
```
/tasks priority 1 high
```

## Notes

- Tasks are persisted in `TASKS.md` at the workspace root.
- The heartbeat agent checks `TASKS.md` on every tick and will alert you if high-priority items are overdue.
- All changes are plain Markdown — you can edit `TASKS.md` directly in any editor.
