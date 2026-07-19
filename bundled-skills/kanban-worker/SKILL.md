---
name: kanban-worker
description: Pitfalls, examples, and edge cases for Hermes Kanban workers. The lifecycle itself is auto-injected into every worker's system prompt as KANBAN_GUIDANCE (from agent/prompt_builder.py); this skill is what you load when you want deeper detail on specific scenarios.
version: 2.0.0
metadata:
  hermes:
    tags: [kanban, multi-agent, collaboration, workflow, pitfalls]
    related_skills: [kanban-orchestrator]
---

# Kanban Worker — Pitfalls and Examples

> You're seeing this skill because the Hermes Kanban dispatcher spawned you as a worker with `--skills kanban-worker` — it's loaded automatically for every dispatched worker. The **lifecycle** (6 steps: orient → work → heartbeat → block/complete) also lives in the `KANBAN_GUIDANCE` block that's auto-injected into your system prompt. This skill is the deeper detail: good handoff shapes, retry diagnostics, edge cases.

## Workspace handling

Your workspace kind determines how you should behave inside `$HERMES_KANBAN_WORKSPACE`:

| Kind | What it is | How to work |
|---|---|---|
| `scratch` | Fresh tmp dir, yours alone | Read/write freely; it gets GC'd when the task is archived. |
| `dir:<path>` | Shared persistent directory | Other runs will read what you write. Treat it like long-lived state. Path is guaranteed absolute (the kernel rejects relative paths). |
| `worktree` | Git worktree at the resolved path | If `.git` doesn't exist, run `git worktree add <path> <branch>` from the main repo first, then cd and work normally. Commit work here. |

## Tenant isolation

If `$HERMES_TENANT` is set, the task belongs to a tenant namespace. When reading or writing persistent memory, prefix memory entries with the tenant so context doesn't leak across tenants:

- Good: `business-a: Acme is our biggest customer`
- Bad (leaks): `Acme is our biggest customer`

## Good summary + metadata shapes

The `kanban_complete(summary=..., metadata=...)` handoff is how downstream workers read what you did. Patterns that work:

**Coding task:**
```python
kanban_complete(
    summary="shipped rate limiter — token bucket, keys on user_id with IP fallback, 14 tests pass",
    metadata={
        "changed_files": ["rate_limiter.py", "tests/test_rate_limiter.py"],
        "tests_run": 14,
        "tests_passed": 14,
        "decisions": ["user_id primary, IP fallback for unauthenticated requests"],
    },
)
```

**Research task:**
```python
kanban_complete(
    summary="3 competing libraries reviewed; vLLM wins on throughput, SGLang on latency, Tensorrt-LLM on memory efficiency",
    metadata={
        "sources_read": 12,
        "recommendation": "vLLM",
        "benchmarks": {"vllm": 1.0, "sglang": 0.87, "trtllm": 0.72},
    },
)
```

**Review task:**
```python
kanban_complete(
    summary="reviewed PR #123; 2 blocking issues found (SQL injection in /search, missing CSRF on /settings)",
    metadata={
        "pr_number": 123,
        "findings": [
            {"severity": "critical", "file": "api/search.py", "line": 42, "issue": "raw SQL concat"},
            {"severity": "high", "file": "api/settings.py", "issue": "missing CSRF middleware"},
        ],
        "approved": False,
    },
)
```

Shape `metadata` so downstream parsers (reviewers, aggregators, schedulers) can use it without re-reading your prose.

## Claiming cards you actually created

If your run produced new kanban tasks (via `kanban_create`), pass the ids in `created_cards` on `kanban_complete`. The kernel verifies each id exists and was created by your profile; any phantom id blocks the completion with an error listing what went wrong, and the rejected attempt is permanently recorded on the task's event log. **Only list ids you captured from a successful `kanban_create` return value — never invent ids from prose, never paste ids from earlier runs, never claim cards another worker created.**

```python
# GOOD — capture return values, then claim them.
c1 = kanban_create(title="remediate SQL injection", assignee="security-worker")
c2 = kanban_create(title="fix CSRF middleware", assignee="web-worker")

kanban_complete(
    summary="Review done; spawned remediations for both findings.",
    metadata={"pr_number": 123, "approved": False},
    created_cards=[c1["task_id"], c2["task_id"]],
)
```

```python
# BAD — claiming ids you don't have captured return values for.
kanban_complete(
    summary="Created remediation cards t_a1b2c3d4, t_deadbeef",  # hallucinated
    created_cards=["t_a1b2c3d4", "t_deadbeef"],                   # → gate rejects
)
```

If a `kanban_create` call fails (exception, tool_error), the card was NOT created — do not include a phantom id for it. Retry the create, or omit the id and mention the failure in your summary. The prose-scan pass also catches `t_<hex>` references in your free-form summary that don't resolve; these don't block the completion but show up as advisory warnings on the task in the dashboard.

## Block reasons that get answered fast

Bad: `"stuck"` — the human has no context.

Good: one sentence naming the specific decision you need. Leave longer context as a comment instead.

```python
kanban_comment(
    task_id=os.environ["HERMES_KANBAN_TASK"],
    body="Full context: I have user IPs from Cloudflare headers but some users are behind NATs with thousands of peers. Keying on IP alone causes false positives.",
)
kanban_block(reason="Rate limit key choice: IP (simple, NAT-unsafe) or user_id (requires auth, skips anonymous endpoints)?")
```

The block message is what appears in the dashboard / gateway notifier. The comment is the deeper context a human reads when they open the task.

## Heartbeats worth sending

Good heartbeats name progress: `"epoch 12/50, loss 0.31"`, `"scanned 1.2M/2.4M rows"`, `"uploaded 47/120 videos"`.

Bad heartbeats: `"still working"`, empty notes, sub-second intervals. Every few minutes max; skip entirely for tasks under ~2 minutes.

## Zombie Worker Detection and Recovery

A **zombie worker** is a process that is alive (sending heartbeats) but has stopped doing useful work. It usually occurs after:
- A protocol violation where the worker exited clean (rc=0) without calling `kanban_complete` or `kanban_block`
- A dispatcher reclaim that the worker process didn't notice
- A spawn failure that left a heartbeat process running independently

## Zombie Worker Detection and Recovery

A **zombie worker** is a process that is alive (sending heartbeats) but has stopped doing useful work. It usually occurs after:
- A protocol violation where the worker exited clean (rc=0) without calling `kanban_complete` or `kanban_block`
- A dispatcher reclaim that the worker process didn't notice
- A spawn failure that left a heartbeat process running independently
- A long build (e.g. `npm install`, `docker build`) where the subprocess finished but the worker never resumed to call `kanban_complete`

**Symptoms:**
- Task shows `status: running` with regular heartbeats but no progress
- `kanban_show` shows the same `current_run_id` for hours with no new events
- Multiple PIDs for the same task all alive simultaneously
- `ps -p $pid` shows the process alive but with no CPU activity
- Heartbeat notes repeat the same status (e.g. "Building Next.js components...") for >30 min

**Recovery (kill cascade):**
```bash
# Step 1: Graceful termination
kill -15 <pid>
sleep 2
# Step 2: Force kill if still alive
ps -p <pid> > /dev/null 2>&1 && kill -9 <pid>
```

**After killing:** The task will show as `running` for ~60s until the dispatcher notices the heartbeat stopped, then it will either:
- Auto-reclaim and promote back to `ready` (if retries remain)
- Or you can manually `kanban_complete` it if the work was already done by another worker

**Prevention:**
- Always call `kanban_complete` or `kanban_block` before exiting
- Don't let long-running subprocesses outlive the worker — use `process(action='wait')` with timeout
- Set `max_runtime_seconds` on tasks that should not run forever
- After a long subprocess completes, immediately verify outputs exist on disk, then call `kanban_complete`

## False-Positive Completions: DONE Status with Missing Artifacts

A worker may call `kanban_complete` successfully while its artifacts were never written to the workspace. This happens when:
- The worker creates files in a temp directory inside its session, then exits — the temp is GC'd
- The worker references paths that only existed in its transient environment
- A protocol-violation retry reported completion from a prior successful run, but the scratch workspace was wiped
- **Multiple workers across a task graph all report completion, but ALL workspaces are empty** (cascading false-positive)

**Detection:**
```bash
# Always verify artifacts exist BEFORE trusting a DONE status
ls -la "$HERMES_KANBAN_WORKSPACE" 2>/dev/null || echo "EMPTY"
# For dir workspaces, check the specific deliverables
find "$HERMES_KANBAN_WORKSPACE" -name "*.js" -o -name "*.ts" -o -name "Dockerfile*" | head -20
```

For orchestrators auditing a completed task graph:
```bash
# Spot-check ALL task workspaces in a pipeline
for task in t_22fa47fd t_6b487435 t_0912d715; do
  ws="/home/mauricio/.hermes/kanban/workspaces/$task"
  echo "=== $task ==="
  find "$ws" -type f -not -path '*/node_modules/*' | wc -l
done
```

**Symptoms:**
- `kanban_show` reports `status: done` but `kanban_list` shows the workspace is empty
- Metadata lists `changed_files: [...]` but the paths don't exist on disk
- Downstream tasks (children) unblock and then immediately crash with "file not found"
- **Multiple consecutive tasks in a pipeline all show DONE but produce no actual files**

**Fix:**
1. If the task is DONE but artifacts are missing, the completion was false-positive
2. **For orchestrators:** Do NOT auto-trust parent completions when spawning children. Always verify parent workspace contents before children auto-promote. If parents are empty, block children and rebuild.
3. Manually complete the task if another worker (or the orchestrator) fixed it, OR re-queue the task: `kanban_create` a replacement with the same body, assignee, and parents
4. **Crucial:** Post a comment on the false-positive task documenting what was missing so future orchestrators know
5. **For multi-module rebuilds:** Instead of re-creating individual scratch workspaces, rebuild into a unified persistent directory tree (e.g., `/home/mauricio/stargate-skills-marketplace/{backend,frontend,scanner,discovery}/`). This survives across sessions and avoids repeated GC wipes.

See `references/cascading-false-positive-completions.md` for a full incident transcript, detection scripts, and the unified rebuild pattern.

**Prevention:**
- Workers should verify files exist on disk before calling `kanban_complete`
- Use `dir:` workspace_kind for tasks producing persistent artifacts
- Orchestrators should spot-check workspace contents after workers report completion
- For long pipelines, verify parent artifacts exist BEFORE children auto-promote from `todo` to `ready`

## Port Binding Conflicts During Rebuild Verification

When verifying that rebuilt services are actually live, **a port responding to HTTP does NOT mean your service is there.** Stale processes, containers, or unrelated services may occupy the port and return unexpected responses (e.g., 405 Method Not Allowed).

**Symptoms:**
- `curl http://localhost:PORT/health` returns a response, but it's the *wrong* format
- `ss -tlnp | grep PORT` shows a listener, but with no PID info (kernel filter hides it)
- `fuser -k PORT/tcp` fails — the process is privileged, containerized, or immune
- `lsof -ti:PORT` returns PIDs that don't match the expected command line

**Detection commands:**
```bash
# Check WHO is actually listening
ss -tlnp | grep :PORT
lsof -i:PORT

# Verify response format — is it OUR service?
curl -v http://localhost:PORT/health 2>&1

# Check process identity
lsof -ti:PORT | xargs -I{} cat /proc/{}/cmdline | tr '\0' ' '
```

**Fix:**
If the wrong service occupies the port:
1. Try `fuser -k PORT/tcp` (may need root)
2. If that fails, pick a new port (e.g., 8003 instead of 8000)
3. Update ALL downstream configs (`.env`, pipeline scripts, API_BASE constants) to match
4. Verify: `curl http://localhost:NEW_PORT/health` → expected JSON response

**Prevention:**
- Reserve a port range for your system (e.g., 3000-3010 for app services, 8000-8010 for scanners)
- Use `docker run -p 0.0.0.0:PORT:PORT` with explicit host binding (localhost-only may clash)
- Document exact ports in a `references/port-assignments.md` file

If you open the task and `kanban_show` returns `runs: [...]` with one or more closed runs, you're a retry. The prior runs' `outcome` / `summary` / `error` tell you what didn't work. Don't repeat that path. Typical retry diagnostics:

- `outcome: "timed_out"` — the previous attempt hit `max_runtime_seconds`. You may need to chunk the work or shorten it.
- `outcome: "crashed"` — OOM or segfault. Reduce memory footprint. **BUT if the error is `worker exited cleanly (rc=0) without calling kanban_complete or kanban_block — protocol violation`, the worker's LLM calls may never have succeeded at all.** A flat `model: <name>:cloud` key in the profile config (no structured provider block) routes the request to the default provider (often Anthropic), which 404s on the model name; the agent exits rc=0 having executed zero turns. Diagnose via `~/.hermes/profiles/<profile>/logs/errors.log` — look for `HTTP 404: model:` lines. The kanban DB alone cannot distinguish this from toolset problems. Fix externally (structured `model:` block with correct `provider:`/`base_url:`), verify with a trivial canary task, then unblock. See `kanban-orchestrator` → `references/model-provider-misrouting-incident.md`.
- `outcome: "spawn_failed"` — usually a profile config issue. **Two common causes:**
  1. **Missing working toolsets.** If the profile only has `[hermes-cli, kanban, kanban-orchestrator]`, the worker can create tasks but cannot execute any real work. It spawns, attempts work, finds no tools, and exits with a protocol violation. **Fix:** Add domain-appropriate toolsets:
     - **researcher:** `terminal`, `file`, `web`, `search` (needs to search the web and gather data)
     - **backend-eng:** `terminal`, `file`, `browser`, `code_execution` (needs to write code, run tests, inspect browser output)
     - **ops:** `terminal`, `file`, `web`, `cronjob` (needs to run scripts, schedule jobs, monitor systems)
     - **orchestrator:** `terminal`, `file`, `web`, `search`, `kanban`, `kanban-orchestrator` (needs all tools to decompose and route work)
     - **frontend-eng:** `terminal`, `file`, `browser`, `code_execution` (same as backend-eng, browser for UI testing)
     - **designer/ux:** `terminal`, `file`, `browser` (browser for visual inspection, file for asset management)
  2. **Model with <64K context window.** Hermes enforces a hard 64,000 token minimum for spawned workers. If your profile's model has fewer tokens (e.g. `qwen2.5:32b` at 32,768, `qwen2.5-coder:7b` at 32,768, `llama3.2:3b` at 32,768), every spawn will crash within seconds. **DO NOT retry blindly — switch the profile to a model with ≥64K context (e.g. `gpt-oss:20b` at 131K, `gemma3:27b` at 128K, cloud models like `claude-sonnet-4` at 200K).**
  4. **Reasoning models even with high context may fail.** Some reasoning models (e.g. `qwen2.5-coder:14b` at 131K context) still fail on kanban worker dispatch due to reasoning-token overhead consuming the context window. **Fix:** Switch to non-reasoning models like `gpt-oss:20b` or cloud models.
  5. **Invalid skill reference in task creation.** If a kanban task was created with `skills=["research"]` (or any skill name) but that skill does not exist in the assigned profile's skill directories, the worker will crash on startup with `Error: Unknown skill(s): research` and exit code 1. The dispatcher then respawns it every ~60 seconds, creating a persistent CPU-consuming crash loop. **Fix:** Check `~/.hermes/profiles/<profile>/skills/` or run `hermes skills list` to verify the skill exists before creating tasks. If the skill is missing, either install it, remove the `skills` parameter from the task, or complete the stuck task to stop the loop. Also remove stale default skill references from the profile config: `hermes config unset profiles.<name>.kanban.default_skills`. The crash loop log lives at `~/.hermes/kanban/logs/<task_id>.log`.
- `outcome: "reclaimed"` + `summary: "task archived..."` — operator archived the task out from under the previous run; you probably shouldn't be running at all, check status carefully.
- `outcome: "blocked"` — a previous attempt blocked; the unblock comment should be in the thread by now.

## Environment Already Fixed by Orchestrator Between Attempts

When you are spawned as a retry and `kanban_show` reveals prior attempts failed due to **missing toolsets**, **wrong model**, or **missing infrastructure** (database, Docker containers, etc.), read the **comment thread** carefully. The orchestrator may have already fixed these issues externally (e.g., added `terminal` to the profile toolset, deployed PostgreSQL, upgraded the model to `kimi-k2.5:cloud`).

**What to do:**
1. Verify the fix is in place before assuming the environment is still broken. Example checks:
   ```bash
   # Toolset added?
   npx --version  # should succeed if terminal toolset is present
   # Database deployed?
   pg_isready -h localhost -p 5432  # or equivalent
   # Model upgraded?
   hermes config get model  # should show cloud model, not weak local
   ```
2. If the fix is confirmed, **proceed with the task normally**. Do not re-report the old blocker as a new block.
3. If the fix is NOT confirmed (e.g., toolset still missing, database still unreachable), block with a specific new reason referencing the expected fix.

**Anti-pattern:** Re-blocking with the same reason the orchestrator already fixed wastes human time and creates duplicate work. Always verify the current state before blocking.

## Workspace Corruption by Prior Runs

When your workspace is `dir:` (shared persistent directory), **previous agent runs may have left broken files behind.** The researcher agent may have run `npm install` and produced a partially-populated `node_modules/` and an incorrect `package-lock.json`. The backend-eng agent may have modified `tsconfig.json` (e.g. adding `"electron"` to the `types` array) in a way that breaks downstream builds. The ops agent inherits ALL of this.

**Before doing any build work, verify workspace integrity.** Run the bundled verification script:

```bash
bash scripts/verify-workspace.sh /tmp/your-workspace
# or, if HERMES_KANBAN_WORKSPACE is set:
bash scripts/verify-workspace.sh
```

This script checks:
1. Git status for uncommitted changes from prior runs
2. Diff stats to see what prior runs touched
3. `node_modules` completeness (detects missing devDependencies from crashed installs)
4. Known bad modifications to `tsconfig.json`, `package.json`, `package-lock.json`
5. TypeScript smoke test (`npx tsc --noEmit`)

**Manual fallback if the script isn't available:**

```bash
# Check git status to see what prior runs changed
git status --short

# If there are unexpected modifications, inspect them
git diff --stat

# If modifications are wrong, reset to known-good HEAD
git checkout HEAD -- tsconfig.json package.json package-lock.json

# Verify node_modules is complete (not half-installed from a crashed run)
ls node_modules/electron node_modules/vite 2>/dev/null || echo "CRITICAL: devDependencies missing"
```

**Never assume the workspace is clean just because it's a `dir:` workspace.** Always `kanban_show` the parent task and read its summary/logs to understand what state was left behind.

## Do NOT

- Call `delegate_task` as a substitute for `kanban_create`. `delegate_task` is for short reasoning subtasks inside YOUR run; `kanban_create` is for cross-agent handoffs that outlive one API loop.
- Modify files outside `$HERMES_KANBAN_WORKSPACE` unless the task body says to.
- Create follow-up tasks assigned to yourself — assign to the right specialist.
- Complete a task you didn't actually finish. Block it instead.

## Background daemons and long-lived services

When the task asks you to start a long-lived background process (e.g., a continuous miner daemon, a server, a watcher), use `terminal(background=true)` and set `notify_on_complete=false` for processes that never exit on their own. Do **not** use shell `&` backgrounding inside a foreground `terminal()` call — the tool rejects it and the daemon will not be tracked.

Pattern:
```python
proc = terminal(
    "python3 -u /path/to/daemon.py > /path/to/daemon.stdout 2>&1",
    background=True,
    notify_on_complete=False,  # daemon never exits
)
# Verify it actually started
terminal("ps -p $(cat /path/to/daemon.pid) -o pid,stat,cmd || pgrep -a -f daemon.py")
```

For bounded long-running tasks (builds, tests, deployments), keep `notify_on_complete=True` so you get a single notification when the subprocess finishes. For never-exit daemons, rely on explicit health checks instead of notifications.

**Do not `kanban_complete` a daemon-start task until you have verified the process is alive.** A common failure mode is the daemon exiting immediately with a config or dependency error, leaving no running process even though the start command returned successfully.

## Pitfalls

**Task state can change between dispatch and your startup.** Between when the dispatcher claimed and when your process actually booted, the task may have been blocked, reassigned, or archived. Always `kanban_show` first. If it reports `blocked` or `archived`, stop — you shouldn't be running.

**Workspace may have stale artifacts.** Especially `dir:` and `worktree` workspaces can have files from previous runs. Read the comment thread — it usually explains why you're running again and what state the workspace is in.

**Scratch workspace for file-editing tasks is a trap.** The default `workspace_kind=scratch` gives a fresh empty temp directory. If the task body expects to edit files in an existing repo (e.g., "fix TypeScript error in `src/components/X.tsx`"), the worker will crash with file-not-found because the repo is not present in the scratch workspace. This is an environment issue, not a code bug. The correct fix is at task creation time: use `workspace_kind=worktree` (with `workspace_path=/absolute/path/to/repo`) or `workspace_kind=dir` pointing at the repo, or have the task body instruct the worker to `git clone` the repo first. If you are the Master resolving blocked tasks, and you see workers crashing with "file not found" on files that exist in the real repo, the task should be completed (the code is fine) and recreated with proper workspace setup.

**Don't rely on the CLI when the guidance is available.** The `kanban_*` tools work across all terminal backends (Docker, Modal, SSH). `hermes kanban <verb>` from your terminal tool will fail in containerized backends because the CLI isn't installed there. When in doubt, use the tool.

## CLI fallback (for scripting)

Every tool has a CLI equivalent for human operators and scripts:
- `kanban_show` ↔ `hermes kanban show <id> --json`
- `kanban_complete` ↔ `hermes kanban complete <id> --summary "..." --metadata '{...}'`
- `kanban_block` ↔ `hermes kanban block <id> "reason"`
- `kanban_create` ↔ `hermes kanban create "title" --assignee <profile> [--parent <id>]`
- etc.

Use the tools from inside an agent; the CLI exists for the human at the terminal.
