---
name: mosaic-vault-knowledge-injection
title: Mosaic Vault Knowledge Injection
description: |
  Programmatically create Vault boxes and inject structured knowledge into
  Mosaic Companion's Vault system so agents can access it via boxAccess.
  Covers working tree analysis, pre-commit cleanup, commit splitting,
  secret scanning, pushing to hypercycle remote, vault box creation,
  entry structuring, and agent access grants.
triggers:
  - create vault box for agents
  - inject knowledge into mosaic vault
  - add team documentation to vault
  - make knowledge accessible to mosaic agents
  - create vault entry for stargate components
  - programmatic vault box creation
  - vault knowledge sharing
---

# Mosaic Vault Knowledge Injection

## When to Use

When you need to share knowledge, documentation, or integration guides with
Mosaic Companion AI agents through the Vault system. Agents read vault box
contents when their `boxAccess` array includes the box ID.

## Architecture

```
~/.config/mosaic-companion/
├── vault.json                    # Box registry (name, id, description)
└── vault-content/
    └── box-<id>.json            # Entries array per box
```

The renderer injects vault box contents into agent system prompts under
`## Vault Knowledge`.

## Step-by-Step Workflow

### 1. Analyze Working Tree

Before committing anything, understand what changed:

```bash
cd /path/to/mosaic-companion

# Commits ahead of upstream
git log --oneline origin/stargate-module..HEAD

# Modified tracked files
git diff --name-status origin/stargate-module..HEAD | grep "^ M"

# New untracked files
git status --short | grep "^??"

# Untracked by category
git status --short | grep "^??" | awk '{print $2}' | sort | awk -F'/' '{print $1}' | sort | uniq -c | sort -rn
```

### 2. Pre-Commit Cleanup

#### A. Scan for Secrets

```bash
grep -rnE "ghp_[a-zA-Z0-9]{36}" --include="*" . | grep -v "node_modules/" | grep -v ".git/"
```

Also check for: `sk-`, `pk-`, `api_key`, `API_KEY`, `SECRET`, `private_key`,
`0x[a-fA-F0-9]{64}` in `.ts`, `.tsx`, `.js`, `.json`, `.md` files.

#### B. Exclude Runtime Data

Update `.gitignore` to exclude directories that should never be committed:

```
# Runtime data directories
.codebase-memory/
memory/
kanban-boards/
video-editor-agent/output/
```

Verify with: `git status --short | grep "^??" | wc -l` — count should drop.

#### C. Check for .env Files

```bash
find . -maxdepth 3 -name ".env*" -not -path "*/node_modules/*" -not -path "*/.git/*"
```

### 3. Commit Strategy

Split into **two logical commits** for clean history:

**Commit 1 — Modified tracked files:**
```bash
git add -u
git commit -m "fix(stargate-module): integrate X, Y, Z into existing codebase

Updates to tracked files to support:
- Feature A
- Feature B"
```

**Commit 2 — All new components:**
```bash
git add .
git commit -m "feat(stargate-module): new components — X, Y, Z

New features:
- Feature A
- Feature B"
```

### 4. Push to hypercycle Remote

```bash
# Verify remote exists
git remote -v

# Dry-run first
git push --dry-run hypercycle stargate-module

# Push
git push hypercycle stargate-module
```

The remote name is `hypercycle` (not `hypercycle-development`), pointing to
`github.com:hypercycle-development/mosaic-companion.git`.

### 5. Create Vault Box Programmatically

Write a standalone Node.js script that manipulates the vault files directly:

```javascript
const fs = require("fs");
const path = require("path");
const os = require("os");

const userDataPath = path.join(os.homedir(), ".config", "mosaic-companion");
const vaultPath = path.join(userDataPath, "vault.json");
const vaultContentDir = path.join(userDataPath, "vault-content");

function loadVault() {
  try {
    if (fs.existsSync(vaultPath)) return JSON.parse(fs.readFileSync(vaultPath, "utf8"));
  } catch { /* ignore */ }
  return { boxes: [] };
}

function saveVault(config) {
  fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
  fs.writeFileSync(vaultPath, JSON.stringify(config, null, 2), "utf8");
}

function saveBoxContent(content) {
  fs.mkdirSync(vaultContentDir, { recursive: true });
  fs.writeFileSync(
    path.join(vaultContentDir, content.boxId + ".json"),
    JSON.stringify(content, null, 2),
    "utf8"
  );
}

const BOX_NAME = "Your Box Name";
const vault = loadVault();

// Prevent duplicates
if (vault.boxes.find(b => b.name === BOX_NAME)) {
  console.log("Box already exists");
  process.exit(0);
}

const now = Date.now();
const boxId = `box-your-prefix-${now}`;

vault.boxes.push({
  id: boxId,
  name: BOX_NAME,
  description: "...",
  sourceType: "manual",
  createdAt: now,
  updatedAt: now,
});
saveVault(vault);

const entries = [
  {
    id: `entry-${now}-0`,
    label: "Section Title",
    content: "# Markdown content here...",
    createdAt: now,
    updatedAt: now,
  },
];

saveBoxContent({ boxId, entries });
console.log(`Created box ${boxId} with ${entries.length} entries`);
```

Run with: `node scripts/your-script.js`

### 6. Structure Knowledge Entries

Each entry should be a self-contained markdown document with:

- **H1 title** — clear topic
- **Files section** — list relevant source files
- **Tables** — comparisons, matrices, scoring rubrics
- **Architecture Patterns** — numbered list of key design decisions
- **Quick Links** — direct file paths for navigation

Example entry labels:
- `Integration Overview & Key Files`
- `SOUL Identity Layer`
- `AIM Forge (AIM Builder)`
- `Stargate Pool Orchestrator`
- `Mosaic Bot Team`
- `MCP Integrations`
- `Ada Portal Payment Service`
- `Video Editor Agent`
- `Hermes Capability Registry`

### 7. Grant Agent Access

Agents must have the box ID in their `boxAccess` array.

**Via config file** (`~/.config/mosaic-companion/ai-agents.json`):
```json
{
  "id": "your-agent-id",
  "name": "StargateBot",
  "provider": "ollama",
  "model": "llama3.1",
  "boxAccess": [
    "box-your-prefix-1234567890123",
    "box-skills-main"
  ]
}
```

**Via UI:** Settings → AI Agents → Vault Boxes → add box name.

## Pitfalls

1. **tsx fails to install** — The npx tsx installer often hits ENOTEMPTY on
   esbuild. Always use plain `node script.js` instead.

2. **Duplicate box names** — The vault prevents duplicate names. Check existence
   before creating or the script will fail silently.

3. **Token in working tree** — Never commit tokens. Always grep for `ghp_`,
   `sk-`, `pk-` before `git add .`. Use `git add -u` for tracked files first.

4. **Runtime data in commits** — Directories like `.codebase-memory/`,
   `memory/`, `kanban-boards/` contain session data that should be gitignored.

5. **Agent boxAccess not updated** — Creating the box alone does nothing.
   Agents only see vault content if their `boxAccess` array includes the box ID.

6. **Hermes-in-Docker AIM** — When wrapping Hermes inside an AIM container,
   the wrapper must auto-detect `HERMES_SRC` from three possible paths:
   `/container_mount`, `/opt/hermes-agent`, `/hermes`.

## Verification

After running the script:

```bash
# Verify box appears in registry
cat ~/.config/mosaic-companion/vault.json | python3 -m json.tool

# Verify content file exists
ls -la ~/.config/mosaic-companion/vault-content/box-your-prefix-*.json

# Count entries
cat ~/.config/mosaic-companion/vault-content/box-your-prefix-*.json | grep '"label"'
```

## Support Files

| File | Purpose |
|------|---------|
| `scripts/vault-box-creation.js` | Standalone script template. Copy, customize BOX_NAME/BOX_DESCRIPTION/entries, run with `node scripts/your-script.js` |
| `references/vault-types.ts` | TypeScript type definitions (VaultBox, VaultEntry, BoxContent, TasteSkillMetadata) extracted from electron/integrations/vault/types.ts |

## References

- `references/vault-box-creation.js` — Standalone script template
- `references/vault-types.ts` — Type definitions from electron/integrations/vault/types.ts
