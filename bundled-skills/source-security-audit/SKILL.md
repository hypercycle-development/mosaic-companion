---
name: source-security-audit
description: |
  Audit and remediate hardcoded credentials, personal infrastructure IPs,
  private registry URLs, and API keys from shared source code.
  Ensures per-user configuration isolation and documents leaks.
category: software-development
---

# Source Security Audit

## Trigger
User suspects or confirms that personal infrastructure details (IPs, registry URLs, API keys, node lists) are hardcoded in source code that other people clone or build from.

## Steps

### 1. Discover — Find every hardcoded value
- **IP addresses**: search for IPv4 patterns (`\d+\.\d+\.\d+\.\d+`) in `src/` and `plugins/`
- **Gist / raw GitHub URLs**: search for `gist.githubusercontent.com` and `raw.githubusercontent`
- **Domain names**: search for known personal domains or subdomains
- **API keys / tokens**: search for patterns like `apiKey`, `token`, `secret` assigned to string literals
- **Env var fallbacks that contain real values**: e.g. `process.env.X || 'http://real-ip'`

### 2. Read — Understand data flow for each hit
Read the surrounding code to determine:
- Where the value is consumed (dashboard, service, plugin)
- What user-facing feature breaks if the value is removed
- Whether a per-user config store already exists (`localStorage`, electron settings, etc.)

### 3. Design replacement — Per-user config isolation
Prefer this hierarchy:
1. **User settings UI** → electron IPC / localStorage (most robust for end-users)
2. **Environment variable** → `.env.local` with empty default (good for dev / CI)
3. **Explicit registry URL** → configurable at runtime, empty by default

Never use a leaked value as a fallback default. Use `''` and add a guard clause that surfaces a setup message.

### 4. Patch — Remove defaults, add guards
- Replace hardcoded `DEFAULT_*` constants with `''`
- Add conditional checks: if config missing, show inline setup instructions instead of crashing or calling a dead endpoint
- Preserve TypeScript build (`npx tsc --noEmit`)

### 5. Verify current tree
Run broad `grep -r` equivalents to confirm zero matches of leaked values in `src/` and `plugins/`.

### 6. Verify git history (not just current tree)

Running `grep` on `src/` only checks the **latest commit**. Git history retains all prior commits — anyone who clones can browse back and see leaked values in old diffs.

**Check if leaked values exist in history:**
```bash
# Find ALL commits that added or removed the leaked string
git log --all -S "YOUR_LEAKED_STRING" --oneline

# Check which branches contain those commits
for hash in $(git log --all -S "YOUR_LEAKED_STRING" --format=%H); do
  echo "$hash: $(git branch -a --contains $hash | tr '\n' ', ')"
done
```

**Never run `git filter-repo` without user consent.** Explain the tradeoff (permanent history rewrite vs. current-tree-only security) and get explicit approval first. If the user declines, fall back to Path A and document the residual risk.

**Pre-flight checks before consent:**
- Check scope: `git log --all -S "LEAKED_VALUE" --oneline` — count affected commits
- Check branches: `for hash in $(git log --all -S "LEAK" --format=%H); do git branch -a --contains $hash; done`
- Stash uncommitted work: `git stash push -m "before history purge"`
- `filter-repo` strips all remotes as a side effect — you will need to re-add them after

**Installation (if missing):**
```bash
pip3 install git-filter-repo
```

**Steps after user consent:**
1. Stash uncommitted changes: `git stash push -m "before history purge"`
2. Create replacement spec — use `literal:` for exact strings, `regex:` for URL patterns:
   ```
   literal:YOUR_LEAKED_IP==>YOUR_HYPERCYCLE_NODE_IP
   literal:YOUR_GIST_ID==>YOUR_FLEET_REGISTRY_GIST_ID
   literal:YOUR_GITHUB_USERNAME==>YOUR_GITHUB_USERNAME
   regex:https://gist\.githubusercontent\.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID/raw/[^\s"'\)]+==>YOUR_FLEET_REGISTRY_URL
   regex:https://gist\.github\.com/YOUR_GITHUB_USERNAME/YOUR_GIST_ID[^\s"'\)]*==>YOUR_FLEET_REGISTRY_URL
   ```
3. Run: `git filter-repo --replace-text /tmp/replacements.txt --force`
4. `filter-repo` strips ALL remotes — re-add them:
   ```bash
   git remote add origin https://github.com/USER/REPO.git
   git remote add upstream https://github.com/ORG/REPO.git
   ```
5. Restore stashed changes: `git stash pop`
6. Verify with `git log --all -S "LEAKED_VALUE" --oneline` — should return empty for all leaked strings
7. Build check: `npx tsc --noEmit` — must pass before pushing
8. Push — `git push --force-with-lease` will FAIL because filter-repo rewrote remote tracking refs. Use `git push --force` instead:
   ```bash
   git push --force origin <branch>
   git push --force upstream <branch>
   ```
9. Advise team: anyone with an old clone must `git fetch origin && git reset --hard origin/<branch>`

**Never run `git filter-repo` without user consent.** Explain the tradeoff (permanent history rewrite vs. current-tree-only security) and get explicit approval first. If the user declines, fall back to Path A and document the residual risk.

### 7. Document
- Create `SECURITY.md` summarizing leaks, impact, remediation, and verification steps
- Update `README.md` with per-panel setup instructions so new users know how to configure their own infrastructure

### 8. Build & commit
- Type-check: `npx tsc --noEmit`
- Commit with `security:` or `fix:` prefix
- Push to remote; verify CI passes if available

## Pitfalls
- **Default fallback to leaked endpoint**: `const API = process.env.API || 'http://18.216.x.x'` is still a leak. Default to empty string.
- **CustomEvent navigation in nested components**: Deeply nested dashboard panels often lack router access. Static instructions are safer than broken click handlers.
- **Electron static method import**: `const { AIService } = await import(...)` then `AIService.sendToHermesAIM(...)` — direct destructuring of static methods causes TS2339.
- **localStorage key collisions**: if different features use the same key, merging settings objects rather than overwriting.

## References
- `references/grep-patterns.md` — ready-to-use search regexes for common leak types
- `references/electron-per-user-config.md` — pattern for storing per-user nodes via IPC + localStorage
- `references/git-filter-repo-purge-recipe.md` — full `git-filter-repo` workflow for permanent history erasure (irreversible; requires user consent)
