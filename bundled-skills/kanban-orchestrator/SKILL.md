---
name: kanban-orchestrator
description: Decomposition playbook + specialist-roster conventions + anti-temptation rules for an orchestrator profile routing work through Kanban. The "don't do the work yourself" rule and the basic lifecycle are auto-injected into every kanban worker's system prompt; this skill is the deeper playbook when you're specifically playing the orchestrator role.
version: 2.0.0
metadata:
  hermes:
    tags: [kanban, multi-agent, orchestration, routing]
    related_skills: [kanban-worker]
---

# Kanban Orchestrator — Decomposition Playbook

> The **core worker lifecycle** (including the `kanban_create` fan-out pattern and the "decompose, don't execute" rule) is auto-injected into every kanban process via the `KANBAN_GUIDANCE` system-prompt block. This skill is the deeper playbook when you're an orchestrator profile whose whole job is routing.

## First-time setup (one-time per machine)

See `references/setup-recipe.md` for the complete step-by-step with exact commands. Quick version below:

```bash
# 1. Initialize the kanban database
hermes kanban init

# 2. Ensure kanban toolsets are in your active profile config
# Edit ~/.hermes/config.yaml → add "kanban" and "kanban-orchestrator" to toolsets:
#   toolsets: [hermes-cli, kanban, kanban-orchestrator]

# 3. Create an orchestrator profile (routes work, has kanban tools)
hermes profile create orchestrator --clone

# 4. Create worker profiles that the orchestrator will assign tasks to
hermes profile create researcher --clone
hermes profile create backend-eng --clone
hermes profile create ops --clone

# 5. Start the gateway (hosts the embedded dispatcher that ticks every 60s)
hermes gateway run        # foreground — good for testing
hermes gateway install    # systemd user service — survives reboots

# 6. (Optional) Launch the web dashboard
hermes dashboard --tui    # adds the /kanban tab with drag-drop board
```

**Verification:** After the gateway is running, create a test task and watch it get claimed:
```bash
hermes kanban create "Test task" --assignee researcher
sleep 65
hermes kanban list        # should show status "running" then "done"
```

---

See also: `references/storm-multi-agent-decomposition-pattern.md` — Apply Stanford OVAL's STORM methodology (Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking) to kanban multi-agent orchestration. **Use for complex cross-domain analysis requiring deep synthesis from multiple expert perspectives.**

---

## When to use the board (vs. just doing the work)

Create Kanban tasks when any of these are true:

1. **Multiple specialists are needed.** Research + analysis + writing is three profiles.
2. **The work should survive a crash or restart.** Long-running, recurring, or important.
3. **The user might want to interject.** Human-in-the-loop at any step.
4. **Multiple subtasks can run in parallel.** Fan-out for speed.
5. **Review / iteration is expected.** A reviewer profile loops on drafter output.
6. **The audit trail matters.** Board rows persist in SQLite forever.

If *none* of those apply — it's a small one-shot reasoning task — use `delegate_task` instead or answer the user directly.

## The anti-temptation rules

Your job description says "route, don't execute." The rules that enforce that:

- **Do not execute the work yourself.** Your restricted toolset usually doesn't even include terminal/file/code/web for implementation. If you find yourself "just fixing this quickly" — stop and create a task for the right specialist.
- **For any concrete task, create a Kanban task and assign it.** Every single time.
- **If no specialist fits, ask the user which profile to create.** Do not default to doing it yourself under "close enough."
- **Decompose, route, and summarize — that's the whole job.**

## The standard specialist roster (convention)

Unless the user's setup has customized profiles, assume these exist. Adjust to whatever the user actually has — ask if you're unsure.

| Profile | Does | Typical workspace |
|---|---|---|
| `researcher` | Reads sources, gathers facts, writes findings | `scratch` |
| `analyst` | Synthesizes, ranks, de-dupes. Consumes multiple `researcher` outputs | `scratch` |
| `writer` | Drafts prose in the user's voice | `scratch` or `dir:` into their Obsidian vault |
| `reviewer` | Reads output, leaves findings, gates approval | `scratch` |
| `backend-eng` | Writes server-side code | `worktree` |
| `frontend-eng` | Writes client-side code | `worktree` |
| `ops` | Runs scripts, manages services, handles deployments | `dir:` into ops scripts repo |
| `pm` | Writes specs, acceptance criteria | `scratch` |

## Decomposition playbook

### Step 1 — Understand the goal

Ask clarifying questions if the goal is ambiguous. Cheap to ask; expensive to spawn the wrong fleet.

### Step 2 — Sketch the task graph

Before creating anything, draft the graph out loud (in your response to the user). Example for "Analyze whether we should migrate to Postgres":

```
T1  researcher        research: Postgres cost vs current
T2  researcher        research: Postgres performance vs current
T3  analyst           synthesize migration recommendation       parents: T1, T2
T4  writer            draft decision memo                       parents: T3
```

Show this to the user. Let them correct it before you create anything.

### Step 3 — Create tasks and link

```python
t1 = kanban_create(
    title="research: Postgres cost vs current",
    assignee="researcher",
    body="Compare estimated infrastructure costs, migration costs, and ongoing ops costs over a 3-year window. Sources: AWS/GCP pricing, team time estimates, current Postgres bills from peers.",
    tenant=os.environ.get("HERMES_TENANT"),
)["task_id"]

t2 = kanban_create(
    title="research: Postgres performance vs current",
    assignee="researcher",
    body="Compare query latency, throughput, and scaling characteristics at our expected data volume (~500GB, 10k QPS peak). Sources: benchmark papers, public case studies, pgbench results if easy.",
)["task_id"]

t3 = kanban_create(
    title="synthesize migration recommendation",
    assignee="analyst",
    body="Read the findings from T1 (cost) and T2 (performance). Produce a 1-page recommendation with explicit trade-offs and a go/no-go call.",
    parents=[t1, t2],
)["task_id"]

t4 = kanban_create(
    title="draft decision memo",
    assignee="writer",
    body="Turn the analyst's recommendation into a 2-page memo for the CTO. Match the tone of previous decision memos in the team's knowledge base.",
    parents=[t3],
)["task_id"]
```

`parents=[...]` gates promotion — children stay in `todo` until every parent reaches `done`, then auto-promote to `ready`. No manual coordination needed; the dispatcher and dependency engine handle it.

### Step 4 — Complete your own task

If you were spawned as a task yourself (e.g. `planner` profile was assigned `T0: "investigate Postgres migration"`), mark it done with a summary of what you created:

```python
kanban_complete(
    summary="decomposed into T1-T4: 2 researchers parallel, 1 analyst on their outputs, 1 writer on the recommendation",
    metadata={
        "task_graph": {
            "T1": {"assignee": "researcher", "parents": []},
            "T2": {"assignee": "researcher", "parents": []},
            "T3": {"assignee": "analyst", "parents": ["T1", "T2"]},
            "T4": {"assignee": "writer", "parents": ["T3"]},
        },
    },
)
```

### Step 5 — Report back to the user

Tell them what you created in plain prose:

> I've queued 4 tasks:
> - **T1** (researcher): cost comparison
> - **T2** (researcher): performance comparison, in parallel with T1
> - **T3** (analyst): synthesizes T1 + T2 into a recommendation
> - **T4** (writer): turns T3 into a CTO memo
>
> The dispatcher will pick up T1 and T2 now. T3 starts when both finish. You'll get a gateway ping when T4 completes. Use the dashboard or `hermes kanban tail <id>` to follow along.

## Common patterns

**Fan-out + fan-in (research → synthesize):** N `researcher` tasks with no parents, one `analyst` task with all of them as parents.

**Pipeline with gates:** `pm → backend-eng → reviewer`. Each stage's `parents=[previous_task]`. Reviewer blocks or completes; if reviewer blocks, the operator unblocks with feedback and respawns.

**Same-profile queue:** 50 tasks, all assigned to `translator`, no dependencies between them. Dispatcher serializes — translator processes them in priority order, accumulating experience in their own memory.

**Human-in-the-loop:** Any task can `kanban_block()` to wait for input. Dispatcher respawns after `/unblock`. The comment thread carries the full context.

## Pitfalls

**Using wrong kanban board.** User may have multiple boards (e.g., "Stargate", "AIMForge", "stargate-mosaic"). Always verify which board the user intends:
```bash
# List all boards first
hermes kanban boards list

# Ask user to confirm which board if ambiguous:
# "You have multiple boards: Stargate, AIMForge. Which should I use?"

# Then explicitly switch
hermes kanban boards switch <correct-board-slug>

# Verify before creating tasks
hermes kanban boards show
```

**Build environment verification before dispatch.** Worker crashes on Node.js/Python/Rust tasks are frequently caused by a silently broken build environment (e.g. `NODE_ENV=production` suppressing npm devDependencies). Before dispatching implementation tasks, verify the environment or gate the task behind a verification step. See `references/environment-verification-gates.md` for specific commands and patterns by stack.

**HyperAIBox / edge fleet SSH access — host keys AND key mismatch.** When deploying to physical edge devices (RK3588 HyperAIBoxes, Raspberry Pi fleets, etc.), kanban `ops` workers will fail with `Host key verification failed` if host keys are missing from `~/.ssh/known_hosts`. Additionally, **different boxes in the same fleet may have DIFFERENT authorized keys** — one key (e.g., `id_ed25519`) may work for R2D2 but fail for C-3PO because C-3PO's `authorized_keys` contains a different public key. The orchestrator must verify SSH access for EACH box individually before dispatching any fleet tasks. See `references/hyperaibox-fleet-ssh-access.md` for the full pre-flight checklist including multi-key verification, a real incident transcript, and a verification script.

**Profile toolset verification before dispatch.** The most common cause of "worker exited cleanly without kanban_complete" protocol violations is a profile that lacks working toolsets. A profile with only `[hermes-cli, kanban, kanban-orchestrator]` can create tasks but cannot execute real work. Before creating tasks, verify the target profile has domain-appropriate toolsets:

```bash
# Verify a worker profile is properly armed
hermes -p <profile> config get toolsets
```

Expected toolsets by role:
- `researcher`: `terminal`, `file`, `web`, `search` (at minimum)
- `backend-eng`: `terminal`, `file`, `browser`, `code_execution` (at minimum)
- `frontend-eng`: `terminal`, `file`, `browser` (at minimum)
- `ops`: `terminal`, `file`, `web`, `cronjob` (at minimum)
- `analyst`: `terminal`, `file`, `web` (at minimum)
- `writer`: `file`, `web` (at minimum)

Also verify the model has ≥64K context: `hermes -p <profile> config get model` should show a model with ≥64,000 tokens.

**Cloud model preference for kanban workers.** When the user's machine has weak local models (e.g., `gpt-oss:20b` outputs low-quality code, `qwen2.5-coder:7b` crashes on context limits), always **upgrade worker profiles to cloud models first** before retrying failed tasks. Cloud models (e.g., `kimi-k2.5:cloud`, `claude-sonnet-4:cloud`, `gemini-2.5-pro:cloud`) provide reliable context windows and consistent code quality. They cost tokens but eliminate the retry loops and protocol violations caused by weak local inference.

- **When to upgrade:** After any worker shows `outcome: "crashed"` or produces garbled/empty outputs.
- **How to upgrade:** `hermes -p <profile> config set model kimi-k2.5:cloud` (or equivalent cloud alias).
- **Verify:** Run `hermes -p <profile> config get model` and confirm the `:cloud` suffix is present.

This should be a standard step in the orchestrator's pre-flight: verify toolsets → verify model (upgrade to cloud if needed) → verify infrastructure → dispatch tasks.

**Zombie worker detection for stuck tasks.** When `kanban_list status=running` shows tasks with long idle times, the orchestrator should investigate before creating new work. Zombies are processes alive but not doing useful work (usually after protocol violations). Detection: `kanban_show` → check `events` for `protocol_violation` or `gave_up` patterns → verify with `ps -p <pid>`. Recovery: `kill -15` → `kill -9` cascade. See `kanban-worker/references/zombie-worker-incident.md` for a full incident transcript.

**Repeated protocol violation escalation.** When a task shows `protocol_violation` (worker exited rc=0 without calling `kanban_complete` or `kanban_block`) **two or more times**, the dispatcher will hit its failure limit and stop retrying. The orchestrator must intervene before the task is permanently dead:

1. Read `kanban_show(task_id)` → inspect `runs` array for repeated `outcome: "crashed"` with `error: "worker exited cleanly ... protocol violation"`.
2. Identify the root cause:
   - **Model/provider misrouting (flat model key)** → A profile config with a FLAT `model: kimi-k2.5:cloud` (or any `:cloud` model) plus `providers: {}` and no structured `model:` block gets routed to the DEFAULT provider (often Anthropic) → HTTP 404 `model not found` on every call → worker burns all API retries and exits rc=0 without ever reaching `kanban_complete`. The kanban error is identical to toolset problems, so check the profile's `logs/agent.log` / `logs/errors.log` for `HTTP 404: model:` lines. Fix: replace the flat key with a structured block (copy from a WORKING profile):
     ```yaml
     model:
       api_key: ollama
       base_url: https://ollama.com/v1
       default: kimi-k2.5:cloud
       provider: ollama-cloud
     ```
     Also remove any stray top-level `provider:` string key. See `references/model-provider-misrouting-incident.md` for the full incident (10 tasks blocked across 4 boards, all recovered).
   - **Missing `kanban` toolset** → Another top cause of protocol violations. Worker profiles MUST have `kanban` in their toolsets or the spawned agent cannot call `kanban_complete()`. Verify: `grep -n "toolsets" ~/.hermes/profiles/<profile>/config.yaml`. If `kanban` is missing, patch the config, then `kanban_unblock(task_id)`. This hits ALL profiles that were cloned before the `kanban` toolset was added to the template.

**Malformed toolsets YAML** → Config shows `toolsets: '['terminal', 'file', ...]'` (quoted string instead of YAML array). This breaks tool loading silently → worker crashes with `gave_up` status. **Fix:** Edit profile config directly:
```bash
# Broken (quoted string):
toolsets: '['terminal', 'file', 'web', 'cronjob', 'search', 'kanban']'

# Fixed (YAML array):
toolsets: [terminal, file, web, cronjob, search, kanban, kanban-worker]
```
Verify with: `hermes -p <profile> config show | grep -A1 toolsets`

See `references/manual-completion-for-crashed-tasks.md` for the full pattern when tasks crash 4+ times on infrastructure assessment due to this issue.
   - **Missing other toolsets** → Profile lacks tools needed to do real work (e.g., no `terminal` for `npm install`). Verify with `hermes -p <profile> config show`, add the missing toolset, then unblock/reclaim.
   - **Wrong model** → The profile uses a model with <64K context or a reasoning model that fails on worker dispatch. Upgrade the profile model (see cloud model preference below), then reclaim/retry.
   - **Skill name poisoning** → The task was created with an invalid `skills` reference. Check `kanban_show` for `skills` field; if invalid, archive the task and recreate without bad skills.
   - **Empty workspace** → `workspace_kind=scratch` on a file-editing task. Recreate with `workspace_kind=worktree` or `dir`.
3. Apply the fix **externally** (edit profile config, deploy infrastructure), then trigger retry. Do NOT expect the worker to fix its own environment if it can't even boot. **Corollary: never assign the "fix the broken worker profiles" task to one of the broken profiles** — it will crash exactly like the tasks it was meant to fix. Fix profiles from outside the kanban system (main agent / operator), then use the board.
4. **Canary verification before mass-unblocking.** After applying a profile fix, do NOT immediately unblock all failed tasks. Create one trivial canary first:
   ```bash
   hermes kanban --board <board> create "CANARY: verify worker protocol fix — complete me" \
     --assignee <fixed-profile> \
     --body "Protocol test. Do exactly this: (1) write test-canary.txt containing 'ok' in your workspace, (2) call kanban_complete with summary 'canary passed'. Nothing else."
   ```
   Wait ~2 dispatch ticks (~150s), check `status == done && consecutive_failures == 0`. Only then comment root-cause on each blocked task and unblock in bulk. If the canary crashes identically, your hypothesis was wrong — dig deeper before touching real tasks.
5. If the task has consumed all retries (`gave_up` with `effective_limit` reached), the task is dead. Create a replacement task with corrected setup, link it as a child, and archive the dead one.

**One-shot profile fix script** — When multiple profiles are broken, apply the fix in bulk:
```bash
for p in researcher ops backend-eng writer; do
  # Verify current toolsets
  hermes -p $p config show | grep -A1 "toolsets"
  # Add kanban if missing (patch via sed or manual edit)
  # Then upgrade model to cloud if on local
  hermes -p $p config set model kimi-k2.5:cloud 2>/dev/null || true
done
```

See `references/ops-protocol-violation-incident.md` for a real incident transcript and resolution.

**Reassignment vs. new task.** If a reviewer blocks with "needs changes," create a NEW task linked from the reviewer's task — don't re-run the same task with a stern look. The new task is assigned to the original implementer profile.

**Argument order for links.** `kanban_link(parent_id=..., child_id=...)` — parent first. Mixing them up demotes the wrong task to `todo`.

**Don't pre-create the whole graph if the shape depends on intermediate findings.** If T3's structure depends on what T1 and T2 find, let T3 exist as a "synthesize findings" task whose own first step is to read parent handoffs and plan the rest. Orchestrators can spawn orchestrators.

**Tenant inheritance.** If `HERMES_TENANT` is set in your env, pass `tenant=os.environ.get("HERMES_TENANT")` on every `kanban_create` call so child tasks stay in the same namespace.

**Skill name poisoning.** The `--skill` / `skills` parameter on `kanban_create` must reference an *installed* skill name exactly as shown by `hermes skills list`. Generic names like `"research"` do not exist and will cause every spawned worker to crash immediately with `Error: Unknown skill(s)`. Worse, the skill list is baked into the task record at creation time — unblocking, reclaiming, or reassigning the task does not remove the invalid skill. The only fix is to archive the poisoned task (`hermes kanban archive <id>`) and create a replacement with valid skill names (e.g. `arxiv`, `blogwatcher`, `llm-wiki`, `writing-plans`).

**Gateway must be running for dispatch — dashboard alone is insufficient.** The dashboard (port 9119) serves the Kanban SPA and API but does NOT run the dispatcher. The dispatcher lives inside `hermes gateway run`. If `pgrep -f "hermes gateway"` returns nothing, tasks in `ready` will queue forever. See `references/gateway-production-diagnostics.md` for the full production health matrix and a real incident transcript.

**Gateway already running check.** Before attempting `hermes gateway run` or `hermes gateway install`, always check if a gateway is already active: `pgrep -f "hermes gateway"`. A second instance will fail with port conflicts. If a gateway is already running (e.g., from a prior `hermes gateway run &` or a systemd service), do not start another — the existing one is sufficient.

**GitHub SSH setup for repo access.** When creating kanban tasks that need to clone GitHub repos, ensure the worker profile's machine has:
1. SSH key generated or existing (`ls -la ~/.ssh/id_*.pub`)
2. Public key added to GitHub (https://github.com/settings/keys)
3. Connection verified (`ssh -T git@github.com`)
4. Git identity configured (`git config --global user.name` and `user.email`)
5. GitHub URLs rewritten to SSH (`git config --global url."git@github.com:".insteadOf "https://github.com/"`)
Without this, workers will fail to clone repos silently.

**GitHub SSH setup for repo access.** When creating kanban tasks that need to clone GitHub repos, ensure the worker profile's machine has:
1. SSH key generated or existing (`ls -la ~/.ssh/id_*.pub`)
2. Public key added to GitHub (https://github.com/settings/keys)
3. Connection verified (`ssh -T git@github.com`)
4. Git identity configured (`git config --global user.name` and `user.email`)
5. GitHub URLs rewritten to SSH (`git config --global url."git@github.com:".insteadOf "https://github.com/"`)
Without this, workers will fail to clone repos silently.

**Getting the kanban toolset recognized.** If you are in the `default` profile and `kanban_create` doesn't appear in tool listings, make sure `kanban` and `kanban-orchestrator` are listed in the *current* profile's `config.yaml → toolsets`, not just the orchestrator profile. The `kanban_create` / `kanban_link` / `kanban_complete` tools are gated behind the `kanban-orchestrator` toolset for the active session.

**Invalid skill names cause silent repeated crashes.** When `kanban_create` is called with `skills=["some_skill"]`, the worker agent loads those skills at startup. If a skill name does not exist in the installed skill library, the worker crashes immediately and the dispatcher retries indefinitely (default 5× before blocking). Always validate skill names against `hermes skills list` before creating tasks. If you want research capabilities, use the actual installed research skills (`arxiv`, `blogwatcher`, `llm-wiki`, `polymarket`, `research-paper-writing`) rather than a generic `"research"` string.

**Skill names must exist in the skill registry.** When creating tasks with a `skills` field (e.g. `skills=["research"]`), the value is validated against the installed skill catalog. A non-existent skill causes the spawned worker to crash repeatedly with `Error: Unknown skill(s): X`. Always verify the skill name before assignment:
```bash
hermes skills list | grep -i <keyword>    # find matching skills
```
If no skill matches the worker's domain, either use a broader valid skill (e.g. `arxiv` instead of `research`), omit `skills` entirely (the worker uses its profile defaults), or ask the user which skill to load. Never assign a skill you haven't confirmed exists.

See also: `references/setup-guide.md` for a quick-start checklist (initialising DB, creating profiles, starting gateway, common CLI syntax).
See also: `references/local-dashboard-activation.md` for one-shot gateway + dashboard startup without systemd install prompts.
See also: `references/skill-validation-errors.md` for crash-loop diagnostics caused by unknown skill names.
See also: `references/multi-module-pipeline-rebuild.md` — when an entire task graph produces cascading false-positive completions (all parents DONE but workspaces empty), this document describes the unified persistent directory rebuild pattern, dependency order (backend → scanner → frontend → discovery), port allocation convention, and verification steps. **Use when multiple consecutive tasks in a pipeline all show DONE but produce no actual files.**
- `references/dedicated-board-domain-analysis-pattern.md` — pattern for creating isolated boards and activating researcher → backend-eng → ops profile chains for comprehensive domain analysis. **Use when user says "create a new kanban board for [domain] work" or "activate profiles to learn everything about [domain]."**
- `references/batterycoin-inference-task-graph.md` — concrete 4-phase task graph for aimifying + deploying AI inference nodes on HyperAIBox RK3588 fleet. Discovery → Design → Build → Deploy with explicit `parents=[...]` dependency wiring. Includes per-profile toolset requirements and the "missing kanban toolset = protocol violation" pitfall.
See also: `references/ops-protocol-violation-incident.md` for a real incident transcript where repeated `protocol_violation` crashes were resolved by upgrading the worker profile to a cloud model. **Critical for ops profiles debugging stuck tasks.**
See also: `references/manual-completion-for-crashed-tasks.md` — When work is actually done but worker crashed with protocol violation.
See also: `references/setup-recipe.md` — full step-by-step recipe with exact commands for first-time setup
- `references/setup-guide.md` — quick-start checklist (initialising DB, creating profiles, starting gateway, common CLI syntax)
- `references/gateway-production-diagnostics.md` — production health matrix, real incident transcript, automated watchdog pattern. **Critical for ops profiles verifying kanban dispatch is actually working.**
- `references/recovering-deleted-files.md` — how to restore deleted files from git history and fix undefined references in dependent files. **Essential when refactor commits leave dangling imports.**
- `references/ui-tab-e2e-debug-task-graph.md` — template for creating kanban task graphs to debug large multi-tab UI components end-to-end. **Use when a single React/Vue panel has 5+ tabs that each need independent testing.**
- `references/dashboard-navigation.md` — visual guide to the web dashboard layout, columns, task drawer, and controls
- `references/pipeline-example-research-build-test.md` — concrete 3-stage pipeline (research → build → test) with commands and expected board lifecycle
## The "Master" Pattern — Proactive Implementation Without Blocking

When acting as a **Master** or **COO** role for kanban operations, the orchestrator has implicit authority to:

1. **Unblock stuck tasks immediately** when the fix is clear and low-risk
2. **Implement fixes directly** rather than spawning new tasks
3. **Complete crashed tasks** when the work was actually done but the worker failed to call `kanban_complete`

**When to apply:**
- Task shows `protocol_violation` or `gave_up` with clear root cause (missing auth header, wrong endpoint, simple bug)
- Fix requires ≤10 lines of code change
- Fix pattern is already documented in skill references
- User has explicitly granted authority: "always involved on solving them out without me giving you permission"

**Execution pattern:**
1. `kanban_show(task_id)` — understand the task and prior failures
2. `kanban_unblock(task_id)` — if blocked, unblock immediately
3. Implement the fix directly (use patch, terminal, etc.)
4. Build/test to verify
5. `kanban_complete(task_id)` with full metadata

**Examples:**
- Backend-eng profile crashes on kanban protocol violation → Master implements fix directly
- Missing Authorization header in API call → Master patches the code
- Wrong endpoint URL in config → Master fixes the baseUrl

**Anti-pattern:** Creating new tasks for trivial fixes that the Master can do in 2 minutes. The Master exists to keep the pipeline flowing, not to add bureaucracy.

See `references/master-blocked-task-triage.md` for detailed triage patterns.

---
- `scripts/diagnostic.py` — verification script you can run after setup

## Recovering stuck workers

When a worker profile keeps crashing, hallucinating, or getting blocked by its own mistakes (usually: wrong model, missing skill, broken credential), the kanban dashboard flags the task with a ⚠ badge and opens a **Recovery** section in the drawer. Three primary actions:

1. **Reclaim** (or `hermes kanban reclaim <task_id>`) — abort the running worker immediately and reset the task to `ready`. The existing claim TTL is ~15 min; this is the fast path out.
2. **Reassign** (or `hermes kanban reassign <task_id> <new-profile> --reclaim`) — switch the task to a different profile and let the dispatcher pick it up with a fresh worker.
3. **Change profile model** — the dashboard prints a copy-paste hint for `hermes -p <profile> model` since profile config lives on disk; edit it in a terminal, then Reclaim to retry with the new model.

Hallucination warnings appear on tasks where a worker's `kanban_complete(created_cards=[...])` claim included card ids that don't exist or weren't created by the worker's profile (the gate blocks the completion), or where the free-form summary references `t_<hex>` ids that don't resolve (advisory prose scan, non-blocking). Both produce audit events that persist even after recovery actions — the trail stays for debugging.
