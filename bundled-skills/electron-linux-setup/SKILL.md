---
name: electron-linux-setup
description: "Set up, build, and run Electron desktop apps on Linux from a fresh git clone. Covers dependency installation, TypeScript compilation, Vite bundling, and the common Linux sandbox permission crash."
version: 1.1.0
---

# Electron Linux Setup

Quick path from fresh clone to running Electron app on Linux, including the sandbox pitfall that blocks almost every first-time run.

## Trigger
- User cloned an Electron repo and ran `npm run start`
- Build fails with `electron-forge: not found`
- Electron crashes with `FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166`
- TypeScript errors after checking out a feature branch with unmerged method signatures

## Steps

### 1. Install dependencies
```bash
cd <repo>
npm install
```
Common symptom if skipped: `electron-forge: not found` because devDependencies are missing.

### 2. Build
```bash
npm run build
```
- Most Electron+Vite repos run `tsc && vite build` here
- If the repo uses electron-forge, `npm run start` may trigger the build automatically via a `generateAssets` hook

**Troubleshooting: Forge swallows the real error**
If `npm run start` fails inside Electron Forge with:
```
❯ Running generateAssets hook
  ✖ Running generateAssets hook from forgeConfig
    › Command failed: npm run build
```
and the actual TypeScript or Vite error is not shown, bypass Forge and run the build directly:
```bash
npm run build
```
This prints the raw `tsc` or `vite` diagnostics (e.g., `TS2345`, `TS2304`) so you can fix the underlying code issue instead of fighting the wrapper.

### 3. Fix TypeScript errors from branch merges
When a feature branch adds calls to methods that don't exist on the target class yet:
1. Find the class definition
2. Add the missing method
3. Re-run build

Example: `HermesAgentOrchestrator.dispatchPrompt()` was called in a component but the class only had `hireAgent()` / `bookTraining()`. Added `dispatchPrompt()` to the class, build succeeded.

**Pattern: Duplicate interface name divergence across files**
When two files each declare an `interface` with the **same name** (e.g., `AgentForgeSession`), TypeScript treats them as distinct types in their own modules. If one file gains a new required field (e.g., `chronicleEvents: ForgeChronicleEvent[]`) but the other does not, any cross-module assignment fails with `TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'. Property 'chronicleEvents' is missing...`

**Fix:**
1. Identify both interface definitions (search with `grep -rn "interface AgentForgeSession" src/`).
2. Align the "source of truth" interface with the "consumer" interface — add the missing field and its dependent types to the source file.
3. Initialize the new field in every factory function / object literal that constructs the interface (e.g., `chronicleEvents: []`).
4. Re-run `npm run build` (or `tsc --noEmit`) to confirm no remaining missing-property errors.

**Prevention:** Use a single shared types file (e.g., `src/types.ts`) imported by both modules, or keep interfaces private (`interface` inside a module, not `export`) when they are not meant to be shared.

### 4. Fix the sandbox crash (Linux only)
Electron's SUID sandbox helper fails with:
```
FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166
The SUID sandbox helper binary was found, but is not configured correctly.
```

Fix the permissions inside `node_modules`:
```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

**Why this happens:** Ubuntu 24.04+ restricts unprivileged user namespaces by default (`apparmor_restrict_unprivileged_userns=1`). Electron tries to use the setuid sandbox helper as a fallback, but npm installs it with user ownership so it refuses to run. Packaging tools (electron-forge, AppImage) usually generate wrapper scripts that add `--no-sandbox`, but **dev mode (`npm run start`) does not**.

Alternative (less secure, only for dev):
```bash
npx electron --no-sandbox .
```

### 5. Rebuild native modules for Electron ABI
If the app uses `better-sqlite3`, `node-pty`, or other C++ addons, they compile against **Node's V8 ABI**, not Electron's. At runtime Electron loads them and crashes with:
```
Error: The module '.../better_sqlite3.node' was compiled against a different Node.js version
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 140.
```

Find Electron's target ABI:
```bash
cd <repo>
npx electron -v          # e.g. v39.8.10
node -p "process.versions.modules"   # Node ABI (not Electron's)
```

Rebuild the specific native module against Electron headers:
```bash
cd <repo>
npx electron-rebuild -f -w better-sqlite3
```

If `electron-rebuild` still produces the old binary (cached), force a clean build:
```bash
rm -rf node_modules/better-sqlite3/build
npm_config_runtime=electron npm_config_target=39.8.10 npm_config_disturl=https://electronjs.org/headers npm rebuild better-sqlite3
```

Verify the rebuilt binary loads under Electron:
```bash
echo "const b = require('better-sqlite3'); const db = new b(':memory:'); console.log('OK'); process.exit(0);" > _test.js
npx electron --no-sandbox _test.js
```

**Key trap:** `npm rebuild` without `runtime=electron` silently rebuilds for Node, not Electron. The binary size may even shrink (2.1 MB vs 2.16 MB) — a subtle clue it's wrong. Only an Electron runtime test confirms success.

### 6. Run
```bash
npm run start
```

Verify it's alive:
```bash
ps aux | grep -E "electron|mosaic" | grep -v grep
```

## Pitfalls

- **Never commit the `chrome-sandbox` permission fix.** It only lives in `node_modules` and gets wiped on `npm install`. Document it in the repo README instead.
- **Background process traps:** `npm run start` with electron-forge is a long-lived watch process. If running via agent terminal, use `background=true` and poll for the "Launched Electron app" log line.
- **WASM / native addons:** If the app uses `better-sqlite3`, `node-pty`, or `onnxruntime-node`, they may need rebuilds. Watch for `node-gyp` errors during `npm install`.

## Cross-Platform Build Notes

When building Electron for distribution:
```bash
# Linux x64
npm run make -- --arch=x64 --platform=linux

# Windows (from Linux via Wine, or WSL2 with cross-compile tools)
# Use electron-forge with @electron-forge/maker-squirrel or @electron-forge/maker-zip

# macOS (requires a Mac)
# Use @electron-forge/maker-dmg
```

On WSL2, native `wine` may be needed to sign Windows `.exe` files.

## References

- `references/electron-sandbox-linux.md` — Deep dive on AppArmor vs setuid sandbox, WSL2 namespace handling, and permanent workarounds.

## Integration with Other Skills

- **`senior-ai-developer`**: When Electron app is the subject of a coding task, this skill governs the build steps; Electron-specific behavior is governed by this skill.
- **`hermes-agent`**: If the Electron app uses `hermes` as an internal agent (like mosaic-companion), use Hermes Agent skill for subprocess spawning.
- **`blockchain-node-ops`**: If the app is a blockchain dApp or node manager, defer to that skill for operational commands.

## Self-Test Scenarios

### Scenario 1: Fresh Clone to Running App
- **Steps:** `git clone` → `npm install` → `npm run build` → fix sandbox → `npm run start`
- **Verify:** `ps aux | grep electron` shows process. Browser window opens.

### Scenario 2: Native Module Rebuild
- **State:** `better-sqlite3` fails with MODULE_VERSION mismatch after Electron update.
- **Steps:** `npx electron -v` → note version → `rm -rf node_modules/better-sqlite3/build` → `npm_config_runtime=electron npm_config_target=<version> npm rebuild better-sqlite3` → test with `_test.js`.
- **Verify:** Test script prints `OK` and exits 0.

### Scenario 3: Sandbox Crash on New Dev Machine
- **State:** First-time `npm run start` on Ubuntu 24.04 fails with setuid sandbox error.
- **Steps:** `chown root:root node_modules/electron/dist/chrome-sandbox` + `chmod 4755` → OR use `npx electron --no-sandbox .`
- **Verify:** App launches without FATAL sandbox error.

### Scenario 4: TypeScript Signature Mismatch
- **State:** Component calls `orchestrator.dispatchPrompt()` but class has no such method.
- **Steps:** Find class definition → add missing method with matching signature → rebuild.
- **Verify:** `npm run build` exits 0. `tsc --noEmit` passes.

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-05-12 | Sandbox fix, native module rebuild, TS merge tips |
| 1.1.0 | 2026-05-13 | Added cross-platform builds, integration with senior-ai-dev, scenarios, version history |
