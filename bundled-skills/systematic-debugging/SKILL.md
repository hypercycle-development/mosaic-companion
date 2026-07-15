---
name: systematic-debugging
description: "4-phase root cause debugging: understand bugs before fixing."
version: 1.2.0
author: Hermes Agent (adapted from obra/superpowers)
license: MIT
metadata:
  hermes:
    tags: [debugging, troubleshooting, problem-solving, root-cause, investigation]
    related_skills: [test-driven-development, writing-plans, subagent-driven-development]
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue:
- Test failures
- Bugs in production
- Unexpected behavior
- Performance problems
- Build failures
- Integration issues

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (rushing guarantees rework)
- Someone wants it fixed NOW (systematic is faster than thrashing)

## The Eight Phases (Mandatory Default)

**The 8-phase framework is MANDATORY for all debugging.** When a user provides the 8-phase framework text as a direct instruction, treat it as a binding requirement — not optional, not default. Do NOT swap to the 4-phase summary. The user explicitly expects: Understand, Hypothesize, Isolate, Verify, Apply Minimal Fix, Test, Prevent, Detective.

You MUST complete each phase before proceeding to the next.

| Phase | Name | Key Question |
|-------|------|--------------|
| 1 | **UNDERSTAND THE PROBLEM** | Restate the issue clearly; identify expected vs actual; ask for missing critical info |
| 2 | **FORM HYPOTHESES** | List most likely causes ranked by probability; focus on high-impact common failures |
| 3 | **ISOLATE THE ISSUE** | Break system into parts; test each part logically; narrow down the failure location |
| 4 | **VERIFY BEFORE FIXING** | Confirm the root cause before applying any fix; explain why this is the actual issue |
| 5 | **APPLY MINIMAL FIX** | Fix only what is necessary; no large rewrites unless required; keep changes controlled |
| 6 | **TEST THE FIX** | Ensure issue is fully resolved; check for side effects or new bugs |
| 7 | **PREVENT FUTURE ISSUES** | Explain why the bug happened; suggest safeguards (validation, logs, structure) |
| 8 | **THINK LIKE A DETECTIVE** | Prioritize logic over assumptions; follow evidence not intuition; state what needs testing when uncertain |

**Rules for the 8-phase mode:**
- Do not hallucinate causes
- Do not jump to solutions without verification
- Do not overcomplicate fixes
- Prefer simple explanations over complex ones
- If uncertain, say what needs to be tested instead of guessing

---

## Abbreviated: 4-Phase Summary (Use Only When User Explicitly Requests It)

When the user explicitly says "use the 4-phase summary" or "keep it brief," use this condensed framework. Otherwise, default to the 8-phase methodology above.

| Phase | Name | Key Question |
|-------|------|--------------|
| 1 | **UNDERSTAND** | Restate the issue; identify expected vs actual; gather missing critical info |
| 2 | **HYPOTHESIZE** | List most likely causes ranked by probability; focus on high-impact common failures |
| 3 | **ISOLATE** | Break system into parts; test each logically; narrow to the failure point |
| 4 | **VERIFY** | Confirm root cause with evidence before attempting any fix |

**Rules for the 4-phase mode:**
- Do not jump straight to solutions
- Form a clear hypothesis before testing
- Prefer simple explanations over complex ones
- If uncertain, gather more data instead of guessing

---

## Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

### 1. Read Error Messages Carefully

- Don't skip past errors or warnings
- They often contain the exact solution
- Read stack traces completely
- Note line numbers, file paths, error codes

**Action:** Use `read_file` on the relevant source files. Use `search_files` to find the error string in the codebase.

### 2. Reproduce Consistently

- Can you trigger it reliably?
- What are the exact steps?
- Does it happen every time?
- If not reproducible → gather more data, don't guess

**Action:** Use the `terminal` tool to run the failing test or trigger the bug:

```bash
# Run specific failing test
pytest tests/test_module.py::test_name -v

# Run with verbose output
pytest tests/test_module.py -v --tb=long
```

### 3. Check Recent Changes

- What changed that could cause this?
- Git diff, recent commits
- New dependencies, config changes

**Action:**

```bash
# Recent commits
git log --oneline -10

# Uncommitted changes
git diff

# Changes in specific file
git log -p --follow src/problematic_file.py | head -100
```

### 4. Gather Evidence in Multi-Component Systems

**WHEN system has multiple components (API → service → database, CI → build → deploy):**

**BEFORE proposing fixes, add diagnostic instrumentation:**

For EACH component boundary:
- Log what data enters the component
- Log what data exits the component
- Verify environment/config propagation
- Check state at each layer

Run once to gather evidence showing WHERE it breaks.
THEN analyze evidence to identify the failing component.
THEN investigate that specific component.

### 5. Trace Data Flow

**WHEN error is deep in the call stack:**

- Where does the bad value originate?
- What called this function with the bad value?
- Keep tracing upstream until you find the source
- Fix at the source, not at the symptom

**Action:** Use `search_files` to trace references:

```python
# Find where the function is called
search_files("function_name(", path="src/", file_glob="*.py")

# Find where the variable is set
search_files("variable_name\\s*=", path="src/", file_glob="*.py")
```

### Phase 1 Completion Checklist

- [ ] Error messages fully read and understood
- [ ] Issue reproduced consistently
- [ ] Recent changes identified and reviewed
- [ ] Evidence gathered (logs, state, data flow)
- [ ] Problem isolated to specific component/code
- [ ] Root cause hypothesis formed

**STOP:** Do not proceed to Phase 2 until you understand WHY it's happening.

---

## Phase 2: Pattern Analysis

**Find the pattern before fixing:**

### 1. Find Working Examples

- Locate similar working code in the same codebase
- What works that's similar to what's broken?

**Action:** Use `search_files` to find comparable patterns:

```python
search_files("similar_pattern", path="src/", file_glob="*.py")
```

### 2. Compare Against References

- If implementing a pattern, read the reference implementation COMPLETELY
- Don't skim — read every line
- Understand the pattern fully before applying

### 3. Identify Differences

- What's different between working and broken?
- List every difference, however small
- Don't assume "that can't matter"

### 4. Understand Dependencies

- What other components does this need?
- What settings, config, environment?
- What assumptions does it make?

---

## Phase 3: Hypothesis and Testing

**Scientific method:**

### 1. Form a Single Hypothesis

- State clearly: "I think X is the root cause because Y"
- Write it down
- Be specific, not vague

### 2. Test Minimally

- Make the SMALLEST possible change to test the hypothesis
- One variable at a time
- Don't fix multiple things at once

### 3. Verify Before Continuing

- Did it work? → Phase 4
- Didn't work? → Form NEW hypothesis
- DON'T add more fixes on top

### 4. When You Don't Know

- Say "I don't understand X"
- Don't pretend to know
- Ask the user for help
- Research more

---

## Phase 4: Implementation

**Fix the root cause, not the symptom:**

### 1. Create Failing Test Case

- Simplest possible reproduction
- Automated test if possible
- MUST have before fixing
- Use the `test-driven-development` skill

### 2. Implement Single Fix

- Address the root cause identified
- ONE change at a time
- No "while I'm here" improvements
- No bundled refactoring

### 3. Verify Fix

```bash
# Run the specific regression test
pytest tests/test_module.py::test_regression -v

# Run full suite — no regressions
pytest tests/ -q
```

### 4. If Fix Doesn't Work — The Rule of Three

- **STOP.**
- Count: How many fixes have you tried?
- If < 3: Return to Phase 1, re-analyze with new information
- **If ≥ 3: STOP and question the architecture (step 5 below)**
- DON'T attempt Fix #4 without architectural discussion

### 5. If 3+ Fixes Failed: Question Architecture

**Pattern indicating an architectural problem:**
- Each fix reveals new shared state/coupling in a different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Are we "sticking with it through sheer inertia"?
- Should we refactor the architecture vs. continue fixing symptoms?

**Discuss with the user before attempting more fixes.**

This is NOT a failed hypothesis — this is a wrong architecture.

---

## Red Flags — STOP and Follow Process

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals a new problem in a different place**

**ALL of these mean: STOP. Return to Phase 1.**

**If 3+ fixes failed:** Question the architecture (Phase 4 step 5).

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question the pattern, don't fix again. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence, trace data flow | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare, identify differences | Know what's different |
| **3. Hypothesis** | Form theory, test minimally, one variable at a time | Confirmed or new hypothesis |
| **4. Implementation** | Create regression test, fix root cause, verify | Bug resolved, all tests pass |

## Hermes Agent Integration

### Investigation Tools

Use these Hermes tools during Phase 1:

- **`search_files`** — Find error strings, trace function calls, locate patterns
- **`read_file`** — Read source code with line numbers for precise analysis
- **`terminal`** — Run tests, check git history, reproduce bugs
- **`web_search`/`web_extract`** — Research error messages, library docs

### With delegate_task

For complex multi-component debugging, dispatch investigation subagents:

```python
delegate_task(
    goal="Investigate why [specific test/behavior] fails",
    context="""
    Follow systematic-debugging skill:
    1. Read the error message carefully
    2. Reproduce the issue
    3. Trace the data flow to find root cause
    4. Report findings — do NOT fix yet

    Error: [paste full error]
    File: [path to failing code]
    Test command: [exact command]
    """,
    toolsets=['terminal', 'file']
)
```

### With test-driven-development

When fixing bugs:
1. Write a test that reproduces the bug (RED)
2. Debug systematically to find root cause
3. Fix the root cause (GREEN)
4. The test proves the fix and prevents regression

## Real-World Impact

From debugging sessions:
- Systematic approach: 15-30 minutes to fix
- Random fixes approach: 2-3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: Near zero vs common

## Common Environment Pitfalls

- `NODE_ENV=production` silently suppresses npm devDependency installation. See `references/node-env-build-pitfall.md` for the full symptoms, isolation steps, and fix.
- **Transitive dependency CVEs** (e.g. `protobufjs` via `@xenova/transformers`) should be patched via surgical npm `overrides`, not `--force` upgrades that break unrelated packages. See `references/npm-override-security.md` for the full pattern, deferral rationale framework, and a real-world reproduction recipe.
- **Shell/Forge subprocess swallowing real errors**: When a build tool (Electron Forge, a Makefile, or a `forge.config.js` hook) calls `execSync('npm run build')`, the subprocess inherits `stdio: 'inherit'` but the parent catches and re-throws with a generic `Command failed: npm run build`. The **actual TypeScript or Vite error is lost** in the generic wrapper. Always bypass the wrapper and run the inner command directly to surface the real failure:
  ```bash
  cd project-root && npm run build 2>&1 | tail -40
  ```
  Only then return to the wrapper once the real error is fixed. See `references/electron-forge-error-swallowing-vite-node-api.md` for the full transcript, TS2451 duplicate-const pattern, and Vite Node-API-in-renderer pitfall.
- **Duplicate `const` after payload refactor (TS2451)**: When adding a second structured payload object in the same block scope (e.g., a new `skillPayload` after an existing one), TypeScript emits `error TS2451: Cannot redeclare block-scoped variable`. The fix is to rename the second declaration (e.g., `kanbanPayload`) and update all downstream references (`JSON.stringify`, destructuring). This often happens when embedding a new metadata block into a task body without checking for existing identically-named constants.
- **Partial file overwrite / corruption in tracked files**: When a file in a tracked repo mysteriously shrinks from N lines to a few lines (e.g., 326 → 52), it's usually a partial overwrite or append that deleted the original content. The telltale sign is a file whose **first line is a mid-file comment** (e.g., `// appended storeSecret function` where the file header should be). Recovery: `git show <hash>:path/to/file > path/to/file`. Always diff against HEAD before assuming a file is intact. See `references/electron-vault-corruption-and-cross-boundary-import.md` for the full corruption chain, git-recovery commands, and verification steps.
- **Cross-boundary import mismatch (Electron main vs renderer)**: Code in `src/` (renderer / Vite bundle) cannot import from `electron/integrations/` (Electron main process) at build time because the Vite renderer bundle externalizes Node APIs. A broken import to `../integrations/vault/storeSecret` from `src/services/` only fails during `tsc --noEmit` or Vite build, silently passes Electron's esbuild of `electron/`. The two toolchains (`esbuild` for main, `tsc`/`vite` for renderer) are separate error sites. When fixing "missing import" errors in Electron apps, always check WHICH toolchain is failing. Do not import Node/electron modules into `src/` files.
- **Adapter methods are required at the service level, not the component level.** Components use domain-specific types (`BridgeAIM`, `FleetNode`) while services use their own types (`AIMInfo`, `AgentToolManifest`). Don't make components do the mapping — add `registerFromXxx()` adapter methods to the service so components stay thin. This was the #1 source of the 10 tsc errors in this session.
- **`window.open(url, '_blank', 'noopener,noreferrer')` in Electron's sandboxed renderer creates a blank `about:blank` popup.** In a normal browser, `noopener` severs the opener reference but navigation proceeds. In Electron's `sandbox: true` renderer, `noopener` prevents the new `BrowserWindowProxy` from ever receiving navigation events — the popup stays permanently on `about:blank` (white/blank window). The fix is NOT to remove `noopener` (security risk) but to delegate external URL opening to the main process via IPC: `electronAPI.window.openExternal(url)` calls `shell.openExternal(url)` in `main.ts`, which opens the URL in the user's default system browser. This also bypasses the no-external-navigation restriction in sandboxed pages. See `references/electron-popup-blank-window.md` for the full reproduction, root cause, and verified fix.
- **URL allowlist inversion in IPC handler produces silent black hole.** When rewriting an `open-external` IPC handler to prevent external navigation, a negative guard (`!url.startsWith('http://localhost') && !url.startsWith('file://')`) intended to block untrusted URLs will also block `http://127.0.0.1:*` — and because `shell.openExternal` is only called when BOTH conditions are true, the button becomes a complete no-op with zero console output. Fix: use an explicit positive `isLocal` allowlist (`http://localhost`, `http://127.0.*`, `https://localhost`, `https://127.0.*`, `file://`) and `console.warn` on blocked URLs. See `references/electron-popup-blank-window.md` § "Inverted Allowlist Pitfall".
- **Spawning a daemon from an IPC handler is not enough — wait for HTTP readiness before returning.** An `ipcMain.handle("service:start")` handler may spawn a `detached` child process and immediately return `{ status: 'started' }`. But the renderer then opens `http://127.0.0.1:PORT` before the HTTP server is bound, producing a dead-port connection or blank page. Fix: after `spawn()`, run a readiness probe loop (e.g., `curl -s -o /dev/null -w "%{http_code}" --max-time 1 http://127.0.0.1:${port}`) every 500ms for up to 10s. Only return `{ status: 'ready' }` after HTTP 200 is confirmed. See `references/electron-popup-blank-window.md` for the probe implementation.
- **OAuth BrowserWindow renders black/blank during external sign-in.** When Electron opens a `BrowserWindow` for OAuth (`mcp.base.org`, Google, Coinbase, etc.), `show: true` + missing `backgroundColor` + no `ready-to-show` gate causes a black flash that may persist if the provider blocks the `Electron/x.y.z` User-Agent or if the page's JS fails in a sandboxed renderer. The fix is a 5-guard pattern: `show: false` → `backgroundColor: "#ffffff"` → `win.once("ready-to-show", () => win.show())` → strip `Electron/` from UA via `setUserAgent` → `sandbox: false` with `nodeIntegration: false` + `contextIsolation: true`. Always attach `did-fail-load` and `console-message` listeners so silent provider-side failures become observable. See `references/electron-oauth-browserwindow-blank.md` for the full pattern, verification steps, and a ready-to-paste code block.
- **PGLite WASM `Aborted()` on startup: corrupted brain directory.** PGLite uses an embedded Postgres WASM runtime. If a prior process terminated uncleanly (e.g., SIGKILL, segfault, host crash), the `postmaster.pid` in the PGLite data directory may contain a stale/no-longer-valid PID, and the WASM binary will call `abort()` during initialization rather than attempt recovery. This is NOT a WASM runtime bug — it's Postgres's conservative safety behavior. The fix is to remove/rename the corrupted brain directory and let PGLite reinitialize (or use `gbrain init --pglite` for gbrain-specific contexts). See `references/pglite-wasm-corruption-debugging.md` for the full isolation recipe (test in-memory → test fresh dir → test actual dir → inspect postmaster.pid) and recovery commands.

**No shortcuts. No guessing. Systematic always wins.**

See Also

- `references/electron-config-migration-patterns.md` — Config caching and aggressive migration patterns for saved settings
- `references/electron-main-process-stale-build.md`
- `references/electron-main-process-stale-build.md`
- `references/stale-build-false-positive.md`
- `references/electron-forge-error-swallowing-vite-node-api.md`
- `references/electron-vault-corruption-and-cross-boundary-import.md`
- `references/nodejs-env-build-pitfall.md`
- `references/typescript-stale-config-enum-crash.md`
- `references/npm-override-security.md`
- `references/stale-vite-renderer-bundle-drift.md`
- `references/pglite-wasm-corruption-debugging.md`
