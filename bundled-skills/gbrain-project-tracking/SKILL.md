---
name: gbrain-project-tracking
description: "Use gbrain (via MCP) to build structured project knowledge trees. Map application UI sections to explicit page hierarchies, link commits and files, and maintain them over time."
category: note-taking
source: hermes-converted
converted_at: 2026-07-02T21:03:36.287818
---

# GBrain Project Tracking

Use gbrain as an active project memory system — not just a vault mirror. Build structured, traversable knowledge trees that reflect how the application presents itself to users (sidebar, tabs, panels).

## When to use this pattern

| Scenario | Rationale |
|----------|-----------|
| Multi-tab/multi-page UI project | Each tab naturally maps to a gbrain page |
| Active development with frequent commits | Commit history lives in the tree |
| Complex service layer behind UI | Each page tracks which backend services feed it |
| Team knowledge handoff | Explicit tree + tags = discoverable by new agents |

## Workflow

### Step 0 — Discovery: map the real UI before building

Before creating any pages, inspect the application to discover **all** visible UI sections. Don't guess from filenames — the app may render many tabs from a single component.

**Recommended discovery order:**
1. **Sidebar / top-level nav:** grep the main layout (e.g., `Sidebar.tsx`, `MainLayout.tsx`) for nav items or route definitions.
2. **Inner tabs:** grep the container that renders the current module for `activeTab`, `TabId`, or `useState('...')` patterns.
3. **Sub-panels:** Look for nested `renderX()` functions within the same parent component.
4. **Route files:** Check for React Router, Next.js Pages, or Electron window registrations.
5. **Research sources:** For external/quest-style work (e.g., a new network/ecosystem), collect authoritative references (official docs, GitHub repos, skill packs, MCP servers) and summarize them in gbrain pages before building anything.

Record findings in a scratch list and confirm with the user before building the tree.

**Session example (Mosaic Companion → Stargate):**
- Sidebar nav: grep found "Stargate" as one nav item among 12.
- Stargate inner tabs: grep of `AdaPortalPanel.tsx` found `TabId = 'start' | 'marketplace' | ... | 'dashboard' | 'stargate-pool' | 'asp'` — 11 tabs rendered by one file.
- Extra panels: MCP Servers sidebar, IDE/Agent Forge, Multi-Agent — 3 standalone pages.
- **Total:** 15 pages under root `projects/mosaic-stargate`.

**Session example (Midnight Network quest):**
- Cloned `mzf11125/midnight_agent_skills` to `~/.local/share/midnight-skills/`.
- Captured four skill overviews: `midnight-concepts`, `midnight-compact`, `midnight-api`, `midnight-network`.
- Documented the Midnight MCP server (29 tools) and integration plan.
- Stored everything under `projects/midnight/research/` before moving to implementation tasks.

### Step 1 — Identify the UI tree

Walk the application from top to bottom:
- Sidebar nav items
- Inner tab names
- Sub-panels or nested views

Map each to a gbrain page slug under a project root.

```
projects/<project-name> (root + summary)
├── <project-name>/start
├── <project-name>/marketplace
├── <project-name>/dashboard
├── <project-name>/hire-agents
└── ...
```

Rule of thumb: if a UI section has its own tab or route, it gets a page.

For quest-style work, also create a `research/` child branch to hold findings before implementation begins:
```
projects/<project-name> (root + summary)
├── <project-name>/research/findings
├── <project-name>/research/agent-skills
├── <project-name>/research/midnight-mcp
├── <project-name>/overview
├── <project-name>/ideas
├── <project-name>/integrations
└── <project-name>/notes
```

### Step 2 — Create the root page

The root page must contain:
- Project overview (architecture, tech stack, status)
- Branch/repo references
- Commit history link (GitHub)
- **The tree table** mapping every child page to its UI tab and source file
- Links to every child page
- For quest-style work, also link to the Hermes kanban board slug and the Mosaic Vault box name/id so the brain, board, and vault stay connected

Example front-matter:
```yaml
---
type: project
title: "Mosaic Companion — Stargate Module"
status: active
branch: stargate-module
repo: https://github.com/.../tree/stargate-module
---
```

### Step 3 — Create child pages (one per UI section)

Each child page must contain:
- What UI it renders (tab id, panel name, source file)
- Key commits that built/last touched this section (table with hash, message)
- Key services / backend files responsible
- Cross-links to related tabs (navigations that are natural in the UI)

### Step 4 — Wire explicit graph links

After all pages are created, explicitly link the root to every child via `mcp_gbrain_add_link` with `link_type: "contains"`.

This step is required because:
- Remote MCP callers skip auto-link extraction
- Explicit links power `traverse_graph` for tree navigation
- The tree is only traversable if links exist

```
mcp_gbrain_add_link from projects/my-root to projects/my-root/section-a link_type contains
```

### Step 0 — Configure GBRAIN_HOME (Critical)

Before creating pages, ensure the gbrain CLI can find your brain.

**Pitfall:** Setting `GBRAIN_HOME` to `~/.gbrain` breaks the CLI. gbrain treats `GBRAIN_HOME` as the **parent directory** containing `.gbrain/`, and resolves `database_path` relative to `$GBRAIN_HOME/.gbrain/config.json`.

**Correct:**
```bash
export GBRAIN_HOME="/home/mauricio"        # parent of .gbrain/
```

**Incorrect:**
```bash
export GBRAIN_HOME="/home/mauricio/.gbrain" # points INTO .gbrain/ → "No brain configured"
```

Verification:
```bash
gbrain get projects/mosaic-stargate --json || echo "FAIL: brain not found"
```

If the brain is empty but configured, check `$GBRAIN_HOME/.gbrain/config.json` for `database_path`.

### Step 5 — Tag the root

Add 2-5 tags on the root for discoverability. Example tags for a web3 AI project:
```
stargate, mosaic, ai-companion, cardano, hypercycle
```

### Step 6 — Verify

Run `mcp_gbrain_traverse_graph` from the root to confirm every child link is present.
If a child is missing, backfill its link.

### Step 7 — Maintain: append every commit to its page

Every new commit should be saved in the brain so nothing is forgotten. Choose the right destination page based on which UI section the commit touched.

**Commit tracking workflow:**

1. **After the user pushes:** Ask them which UI section (tab/panel) the commit affects, or infer from the commit message/file paths.
2. **Retrieve the page:** `mcp_gbrain_get_page(slug)` to read the current content.
3. **Append to the page:** `mcp_gbrain_put_page` with the updated body:
   - Add commit to the "Key Commits" table (hash + date + description)
   - Add a "Recent Fixes" section if it was a bugfix, describing root cause + resolution
   - Link to the full repo if needed: `https://github.com/.../commits/<branch>`
4. **Add a timeline entry:** `mcp_gbrain_add_timeline_entry` for chronological project history.
5. **Update the Development Log page:** `stargate/development` (or equivalent) also needs the commit for the consolidated history.

**Commit table format (inside child pages):**
```markdown
| Hash | When | What |
|------|------|------|
| `476c063` | 2026-05-25 | fix: auto-spawn Hermes Dashboard on 'Open Kanban' click — IPC bridge + Docker-aware URL |
```

**Why per-page commit tracking matters:**
- Each page shows only commits relevant to that UI section — no noise from unrelated work
- Root page (e.g., `stargate/development`) keeps the full consolidated log
- Timeline entries give chronological narrative across the whole project
- Future agents can query `gbrain` for "what changed in Dashboard last month" and get precise answers

**Session example:**
- Commit `476c063` (Hermes Kanban fix) added to `stargate/dashboard` page under "Recent Fixes" with full 8-phase summary and linked files table.
- Timeline entry: "Dashboard > Open Hermes Kanban button — fixed with IPC-managed auto-spawn"
- Build verification noted: `npx tsc --noEmit` exits 0.

## Content Patterns

### Commit History Table
Preferred format inside child pages:
```markdown
| Hash | Message |
|------|---------|
| `ae529c6` | fix(aimifier): CONNECT mode UI + ANFE detection without MetaMask |
```

Keep only the last 5-10 relevant commits; the full log goes on the root's "Development" child.

### Service Mapping Table
```markdown
| Service | File | Responsibility |
|---------|------|---------------|
| StargatePoolService | `src/services/StargatePool/...` | NFT-gated factory registry |
```

### Tab-to-File Mapping
```markdown
| Tab | ID | File |
|-----|----|------|
| Start | `start` | `AdaPortalPanel.tsx` (renderStart) |
```

## Pitfalls

1. **Auto-links skipped in remote mode.** Always run `mcp_gbrain_add_link` explicitly after creating pages. Do not rely on the `auto_links` feature for tree connectivity.
2. **GBRAIN_HOME must be the parent directory.** Never point it at `~/.gbrain` itself. See Step 0.
3. **Slugs must be consistent.** If you change a page slug, all links break. Establish slug conventions upfront.
4. **Commit messages with pipes.** When writing commit tables in markdown, escape pipes `\|` or the table breaks. Always preview tables before marking a page done.
5. **No write-through from remote.** Remote `put_page` writes to the brain DB but does not mirror to any local repo. Treat the brain as the source of truth for project metadata.
6. **Tag sparsity.** Don't create singleton tags. Only add a tag if it will appear on at least 5 pages.
7. **PGLite `Aborted()` crash is most often corrupted data, not WASM incompatibility.** The upstream error message misleadingly blames "macOS 26.3 WASM bug". In practice, a stale `postmaster.pid` or torn PGLite state (from force-killed processes) causes the WASM engine to abort. Test: in-memory `PGlite.create()` works, but the specific dataDir fails. Fix: move the brain aside and reinitialize (`gbrain init`). True WASM incompatibility only if in-memory also fails.
8. **`DATABASE_URL` can override `~/.gbrain/config.json` with a Prisma Accelerate URL.** If `gbrain stats` fails with `unrecognized configuration parameter "api_key"`, the resolved connection string is `prisma+postgres://...?api_key=...` even though `config.json` may contain a plain `postgresql://` URL. gbrain's loader prioritizes `DATABASE_URL` over the config file. See `references/gbrain-prisma-url-override-diagnosis.md` for the full diagnostic recipe.
9. **`gbrain capture --stdin` requires an explicit `--stdin` flag and the heredoc must be passed correctly.** A bare heredoc after positional args may be treated as empty content. Prefer `--file PATH` with a temporary `.md` file for multi-line captures, or use `echo "content" | gbrain capture --stdin --slug ... --type page`.
10. **External Postgres containers can stop between sessions.** If gbrain was migrated to a Postgres backend (e.g. a Docker container), that container may not restart automatically on host reboot. When `gbrain stats` returns `ECONNREFUSED`, check `docker ps` and start the container with `docker start <container-name>` before assuming the URL is wrong.
11. **`gbrain capture --stdin` may ignore `--path` and write to `inbox/`.** In some CLI versions, stdin capture routes to `inbox/YYYY-MM-DD-<hash>` even when `--path` is supplied. To place content at an exact slug, either (a) write a temp `.md` file and use `gbrain capture --file <tmp.md> --path <slug>`, or (b) capture via stdin and then `gbrain put <slug>` with the captured content.

### Recovery from Brain Outage (PGLite WASM / Corruption)

When gbrain becomes inaccessible, the vault remains the durable source of truth.

**Symptom (two distinct causes, same error message):**
```
PGLite failed to initialize its WASM runtime.
This is most commonly the macOS 26.3 WASM bug: https://github.com/garrytan/gbrain/issues/223
Run `gbrain doctor` for a full diagnosis.
Original error: Aborted(). Build with -sASSERTIONS for more info.
```

**Cause A — Stale / Corrupted PGLite Data Directory (most common)**
1. Check for `postmaster.pid` inside `~/.gbrain/brain.pglite/` — if it contains an impossible PID (e.g. `-42`), the brain was force-terminated and is inconsistent.
2. Check for PGLite db corruption by testing in-memory vs disk:
   ```bash
   # In-memory always works (proves WASM is OK)
   npx ts-node -e "import {PGlite} from '@electric-sql/pglite'; PGlite.create().then(()=>console.log('MEMORY OK'))"
   
   # Specific directory fails (proves data dir is the problem)
   npx ts-node -e "import {PGlite} from '@electric-sql/pglite'; PGlite.create({dataDir:'/home/.../.gbrain/brain.pglite'}).then(()=>console.log('DIR OK'))"
   ```
3. Fix: **Move the corrupted brain aside and reinitialize** — gbrain will recreate a fresh brain on next `gbrain stats` or `gbrain init`.
   ```bash
   mv ~/.gbrain/brain.pglite ~/.gbrain/brain.pglite.corrupted-$(date +%s)
   gbrain init  # or just run any gbrain command — auto-creates brain
   ```
   Your data is gone (0 pages) if you never committed it, but this is the only clean path when the WASM engine rejects the data dir.

**Cause B — True WASM Runtime Incompatibility (rare, usually kernel-specific)**
PGLite's WASM runtime genuinely fails on some Linux kernels ≥ 6.17. The brain files on disk are healthy but unreadable by the WASM engine.
- Test: in-memory PGLite.create() also fails → points to a true WASM issue
- Fix: switch gbrain to Postgres backend:
  ```bash
  gbrain init --supabase   # or
  gbrain init --url <DATABASE_URL>
  ```

**Cause C — Config resolves to a Prisma Accelerate URL instead of plain Postgres**
Even when `~/.gbrain/config.json` contains a plain `postgresql://...` URL, `gbrain` may load a `prisma+postgres://...?api_key=...` connection string from a higher-precedence source (env var, wrapper, or sourced `.env`). The resulting error is `unrecognized configuration parameter "api_key"` because Postgres receives the Prisma query parameter as a startup GUC.
- Diagnose: inspect the resolved URL with `bun -e "import {loadConfig} from '/path/to/gbrain/src/core/config.ts'; console.log(loadConfig())"`.
- Fix: unset `DATABASE_URL`, `GBRAIN_DATABASE_URL`, and any `.env` sourced by your shell profile, then verify `gbrain stats` succeeds against the plain Postgres URL.

**Why vault-first is correct:** The vault follows the retrieval-first principle Master requires. It is YAML-fronted, tag-indexed, and versioned by git. The gbrain is an enrichment layer on top, not the primary storage.

## Bridging gbrain into the Application's MCP Client

If the application itself has an MCP client (e.g. Mosaic Companion), expose gbrain as a bundled stdio MCP server so agents inside the app can query project history.

High-level (see `references/mcp-bridge-pattern.md` for full implementation):
1. Write a zero-dependency Node.js stdio server that shells out to `gbrain` CLI.
2. Place it alongside the app code (e.g. `electron/integrations/mcp/servers/gbrain-mcp-server.js`).
3. Auto-register it in `ensureDefaultPlugins()` so it starts on app launch.
4. Only expose **read** tools: `gbrain_search`, `gbrain_query`, `gbrain_get_page`, `gbrain_graph`, `gbrain_get_stats`, `gbrain_code_callers`.
5. Add the server directory to your Electron build assets (`extraResources`) so it survives packaging.

## Reference Files

- `references/stargate-tree-example.md` — Working example: full 15-page tree built for Mosaic Companion Stargate module, including slug naming, UI discovery via `grep`, and verification steps.
- **`systematic-debugging/references/electron-popup-blank-window.md`** — Blank `about:blank` popup when `window.open(url, '_blank', 'noopener,noreferrer')` is used inside Electron's sandboxed renderer. Fix: delegate to `shell.openExternal(url)` via IPC (`electronAPI.window.openExternal`), and add an HTTP readiness probe loop in the IPC spawn handler. Session 2026-05-25 (Mosaic Companion Stargate "Open Hermes Kanban" button fix).
- `references/mcp-bridge-pattern.md` — Pattern for connecting an application-level MCP client (like Mosaic Companion) to its own gbrain via a bundled Node.js stdio MCP server.
- `references/pglite-linux-crash-recovery.md` — PGLite WASM `Aborted()` on Linux: corrupted data vs true WASM incompatibility, with recovery steps.
- `references/gbrain-prisma-url-override-diagnosis.md` — `gbrain stats` fails with `unrecognized configuration parameter "api_key"` even though `~/.gbrain/config.json` has a plain Postgres URL. How a `.env` file or env var can override the config file with a `prisma+postgres://...` URL, and a step-by-step diagnostic/recovery recipe including a `--no-env-file` wrapper.
- `scripts/diagnose-gbrain-url-override.mjs` — Runnable probe: prints which source (env vs config file) gbrain actually uses for its database URL. Use it when connection errors look config-related.