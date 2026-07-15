---
name: eight-phase-debugging
description: "The user's mandatory 8-phase structured debugging methodology. Must be followed explicitly for ALL debugging, integration, and troubleshooting tasks. Never substitute with default 4-phase summaries."
version: 1.0.0
author: Hermes Agent
category: software-development
source: hermes-converted
converted_at: 2026-07-02T21:03:36.283839
---

## UPDATE 2: Multi-Codepath Discovery — The Real Bug

**Continued Session Date:** 2026-06-19

After the variable shadowing fix was applied, errors **still persisted**. Investigation revealed **3 separate fetch calls** to `/v1/chat/completions` in the compiled bundle:

```bash
$ grep -o 'fetch([^)]*chat/completions[^)]*)' dist/renderer/assets/index-*.js
# Found 3 matches:
# 1. AIService.sendToOpenAI() - Already patched
# 2. ElectronHermesAdapter.chat() - NOT patched! ← BUG SOURCE
# 3. KanbanDashboard - Already correct
```

### The Hidden Code Path

The error was coming from `AimifierAdapters.ts`, NOT from `AIService.ts`:

```typescript
// src/services/stargate/AimifierAdapters.ts (line 607-624)
export class ElectronHermesAdapter implements HermesAdapter {
  async chat(baseUrl: string, message: string, systemPrompt?: string): Promise<...> {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {  // ← NO .replace() here!
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kimi-k2.6', ... }),
    });
    ...
  }
}
```

### Discovery Technique

1. **Check compiled bundle** for fix presence:
   ```bash
   grep -A 5 'your-fix-pattern' dist/renderer/assets/index-*.js
   ```

2. **Search ALL similar patterns**:
   ```bash
   grep -n 'fetch.*chat/completions' dist/renderer/assets/index-*.js
   ```

3. **Trace error to exact position**:
   - Error showed `at xl.sendToOpenAI (index-CZ4A-d_R.js:1323:4064)`
   - Examined position 1323:4064 in bundle
   - Found `sendToOpenAI` was NOT the culprit

4. **Find unique identifiers**:
   - Noticed hardcoded model `"kimi-k2.6"` in minified code
   - Searched source: `grep -r "kimi-k2.6" src/`
   - Found `AimifierAdapters.ts`

### The Fix

```typescript
// Defensive fix in AimifierAdapters.ts
async chat(baseUrl: string, message: string, systemPrompt?: string): Promise<...> {
  const fixedBaseUrl = baseUrl.replace('https://ollama.com', 'https://api.ollama.com');
  const resp = await fetch(`${fixedBaseUrl}/v1/chat/completions`, {
    ...
  });
}
```

### Key Lesson

**Never assume a single fix location.** Complex apps (especially Electron with renderer/main split, adapters, services) often have **multiple independent code paths** making the same API call.

When a fix doesn't work:
1. Verify fix is in compiled bundle
2. Search for ALL similar API calls
3. Trace error to exact minified location
4. Map back to source

See `references/multi-codepath-debugging-pattern.md` for full pattern.

---

## UPDATE: Variable Shadowing in Minified Bundles

This is the user's **mandatory debugging framework**. It must be followed explicitly for every debugging, integration, troubleshooting, or root-cause analysis task. Do NOT use default 4-phase summaries (understand → fix → test → prevent). Use ALL 8 phases below.

## The 8 Phases

### Phase 1: UNDERSTAND THE PROBLEM
- Restate the issue clearly in your own words
- Identify what is **expected** vs what is **actually happening**
- Ask for missing critical information if needed (logs, configs, environment)
- Gather all available evidence BEFORE forming hypotheses

### Phase 2: FORM HYPOTHESES
- List the **most likely causes** ranked by probability
- Focus on **high-impact, common failure points** first
- Use evidence from Phase 1 to inform ranking
- Format as a table: Rank | Hypothesis | Evidence | Impact

### Phase 3: ISOLATE THE ISSUE
- Break the system into **independent parts**
- Test each part **logically and independently**
- Narrow down where the failure occurs
- **AVOID changing multiple variables at once**

### Phase 3.5: COLLECT EVIDENCE (Implicit)
- Run targeted commands to verify each hypothesis
- Read relevant files, configs, logs
- Use `browser_navigate` / `curl` for external services
- Document findings with exact output

### Phase 4: VERIFY BEFORE FIXING
- **Confirm the root cause** before applying any fix
- Explain WHY this is the actual issue (not just a correlation)
- Cite specific evidence that proves causation
- If uncertain, say what needs to be tested instead of guessing

### Phase 5: APPLY MINIMAL FIX
- Fix **only what is necessary**
- Do NOT rewrite large parts unless absolutely required
- Keep changes **simple and controlled**
- One fix per root cause — do not batch unrelated changes

### Phase 6: TEST THE FIX
- Ensure the issue is **fully resolved**
- Check for **side effects** or new bugs
- Verify the fix works in the actual environment (not just theory)
- Document test results with commands/output

### Phase 7: PREVENT FUTURE ISSUES
- Explain **why the bug happened** (root cause, not just symptom)
- Suggest **safeguards**: validation, logs, structure improvements
- Add error handling where missing
- Update documentation/comments

### Phase 8: THINK LIKE A DETECTIVE
- Prioritize **logic over assumptions**
- Follow **evidence, not intuition**
- If uncertain, say what needs to be tested instead of guessing
- Document remaining gaps and open questions
- Be honest about what you don't know

## Rules

- **Do not hallucinate causes.** Every hypothesis needs evidence.
- **Do not jump to solutions without verification.** Phase 4 is mandatory.
- **Do not overcomplicate fixes.** Prefer simple explanations over complex ones.
- **Do not change multiple variables at once.** One hypothesis test at a time.
- **Do not substitute phases.** All 8 must be present in the final report.
- **Do not skip the report even for "simple" fixes.** The user explicitly expects a structured report after every debugging/integration task.

## Report Format

Present findings as a structured report:

```
## PHASE 1: UNDERSTAND THE PROBLEM
[Restatement]

## PHASE 2: FORM HYPOTHESES
| Rank | Hypothesis | Evidence | Impact |
|---|---|---|---|

## PHASE 3: ISOLATE THE ISSUE
[What was tested, what was found]

## PHASE 4: VERIFY ROOT CAUSES
[Confirmed causes with evidence]

## PHASE 5: APPLY MINIMAL FIX
[What was changed and why]

## PHASE 6: TEST THE FIX
[How it was verified]

## PHASE 7: PREVENT FUTURE ISSUES
[Why it happened, safeguards added]

## PHASE 8: DETECTIVE — REMAINING GAPS
[Open questions, what's not yet known]
```

## When to Use

- ANY error investigation
- Integration failures
- Performance issues
- Configuration problems
- Multi-agent system failures
- Tool/bridge connectivity issues

## When NOT to Use

- Creative/content generation tasks (use appropriate creative methodology)
- Pure research tasks (use research methodology)

> **User Preference Exception:** For this user, the formal 8-phase report is **mandatory for ALL debugging, integration, and troubleshooting tasks** regardless of perceived simplicity. Do not skip the formal report even for "simple" fixes. The user explicitly expects the structured output after every debugging session.

## Common Pitfalls to Avoid

1. **Skipping Phase 4** — Applying fix before verifying root cause leads to regressions
2. **Weak Phase 2** — Listing obvious hypotheses without evidence ranking wastes time
3. **Missing Phase 8** — Not documenting gaps means next debugger repeats your work
4. **Over-fixing in Phase 5** — Changing 10 files when 1 would do creates new bugs
5. **No test evidence in Phase 6** — "It should work now" is not a test
6. **Lifetime-count guards become progressive kill switches** — A safety guard that counts *historical* events across an entire session (e.g., total tool results ever) will eventually block all new activity. Prefer *trailing/sliding-window* counts scoped to the current turn, or depth counters passed recursively. See `references/chat-tool-loop-guard-accumulation-false-positive.md`.

## Integration with Other Skills

- **kanban-worker**: When debugging kanban worker failures, use 8-phase before creating remediation tasks
- **systematic-debugging**: 4-phase skill is SUBORDINATE to this 8-phase skill. When both are loaded, 8-phase wins.
- **hermes-mcp-integration**: Use 8-phase for MCP connectivity issues

## References
- `references/chat-tool-loop-guard-accumulation-false-positive.md` — **Guard counting lifetime tool results across a session becomes a progressive kill switch**. Fixing trailing-contiguous counts vs session-wide filters in recursive AI response handlers. (2026-06-20)
- `references/electron-impossible-fetch-interception.md` — **When debug logs show correct URL but network shows wrong URL**: external CDN interception, fetch wrappers, service workers, Electron protocol handlers
- `references/post-method-mutation-debug.md` — **When debug logs show correct values but actual request is wrong**: POST→GET method mutation, variable shadowing, fetch interceptors
- `references/multi-codepath-debugging-pattern.md` — **When fixes don't work**: debugging multiple independent code paths making the same API call (Ollama Cloud 405 case study with 3 separate fetch locations)
- `references/electron-ollama-cloud-baseurl-debug.md` — Ollama Cloud 405 errors: URL routing fix, variable shadowing in minified bundles, defensive `.replace()` pattern at fetch boundary
- `references/electron-stargate-kanban-aim-debug.md` — KanbanDashboard "Aimified" column stuck at 0: stale bundle + health response shape mismatch + ProviderIcon missing case (2026-06-01)
- `references/electron-tailwind-csp-rpc-prompt-overflow-debug.md` — **Bundle of production Electron issues**: Tailwind CDN in production, missing CSP, dead public RPC endpoints, MCP non-JSON responses, and prompt/context-window overflow. Session-proven fixes and verification commands. (2026-06-19)
- `references/eight-phase-example-report.md` — Full example report from a real session
- `references/eight-phase-example-oauth-blank-window.md` — OAuth BrowserWindow blank/black window fix
- `references/electron-react-init-guard-cascade.md` — **React useEffect init guards for Electron apps:** When `useEffect(() => loadData(), [])` fires 5× per mount, causing downstream service cascades (RPC rate limiting, ANFE discovery loops, console spam). The root cause is missing `useRef` init guards + duplicate `useEffect` hooks. Includes 4 verified fixes: init guard, debounced narrow refresh, service fast-path, and silent Electron fallbacks. (2026-06-22)
- `references/electron-vault-record-lookup-crash.md` — Vault panel white-screen: `Record<sourceType, {color}>` lookup crash on persisted data with missing/unknown `sourceType`. Nullish coalescing fallback pattern for all Record-based lookups with external data. (2026-05-29)
- `references/electron-stargate-skill-delivery-debug.md` — Stargate skill delivery fails: hardcoded `nodeId: 'r2d2'` in AdaPortalPanel with no fleet registry, plus Vault Record crash during full Stargate debugging. (2026-05-29)
- `references/eight-phase-vs-four-phase.md` — When to use which (user preference)
- `references/ollama-model-mismatch-debug.md` — Saved config references model name not available locally; API returns 500 with body but client swallows it with generic "is it running?". Fix stack: sanitize on load + parse response body + update defaults. (2026-05-29)