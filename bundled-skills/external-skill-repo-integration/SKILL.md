---
name: external-skill-repo-integration
description: "Integrate external skill repositories (e.g. Taste-Skill, custom SKILL.md collections) into Hermes/Vault systems with structured metadata (dials, triggers, presets)."
version: 1.0.0
author: Hermes Agent
category: software-development
source: hermes-converted
converted_at: 2026-07-02T21:03:36.283093
---

# External Skill Repository Integration

This skill covers the pattern of importing structured skill repositories (like the Taste-Skill format) into Hermes Agent or Mosaic Companion's Vault system.

## When to Use

- You need to import skills from an external GitHub repo (e.g. `Leonxlnx/taste-skill`)
- The external skills have structured metadata (dials, triggers, presets) that must be preserved
- You want to make these skills available to kanban workers, AI agents, or the MCP tool registry
- The external repo uses a different format than Hermes native `SKILL.md`

## The Taste-Skill Format

The Taste-Skill repository (github.com/Leonxlnx/taste-skill) defines a structured skill format:

### YAML Frontmatter
```yaml
---
name: design-taste-frontend
description: All Taste-Skill instructions and constraints
category: frontend-design
version: "1.0.0"
---
```

### Three Dials (1-10 scale)
| Dial | 1 | 10 |
|---|---|---|
| **DESIGN_VARIANCE** | Perfect Symmetry | Artsy Chaos |
| **MOTION_INTENSITY** | Static | Cinematic / Physics |
| **VISUAL_DENSITY** | Art Gallery / Airy | Cockpit / Packed |

### Signal-to-Dial Triggers
```markdown
| If the user's brief reads as... | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm" | 5 | 3 | 2 |
| "bold / playful / energetic" | 9 | 7 | 8 |
| "professional / corporate" | 4 | 3 | 6 |
```

### Use-Case Presets
```markdown
| Use Case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Dashboard (dense, utilitarian) | 3 | 4 | 9 |
| Mobile (compact, thumb-friendly) | 6 | 5 | 8 |
```

### Pre-flight Verification Checklist
```markdown
## Pre-flight Verification
Before generating any code:
1. [ ] Verify dial values are set correctly for the brief
2. [ ] Confirm output format (code vs images)
3. [ ] Check reference image style matches selected preset
```

## Integration Pattern

### Step 1: Parse External SKILL.md

Use the `tasteSkillParser.ts` pattern:

```typescript
// 1. Extract YAML frontmatter
const frontmatter = parseFrontmatter(markdown); // name, description, category

// 2. Extract dial values from Three Dials section
const dials = parseDials(markdown); // { designVariance, motionIntensity, visualDensity }

// 3. Extract triggers from Dial Inference table
const triggers = parseTriggers(markdown); // [{ signal, variance, motion, density }]

// 4. Extract presets from Use-Case Presets table
const presets = parsePresets(markdown); // [{ name, variance, motion, density }]

// 5. Detect output type (code, images, or both)
const outputType = detectOutputType(markdown, installName);
```

### Step 2: Extend VaultEntry with Metadata

The Vault must accept structured metadata alongside flat content:

```typescript
interface VaultEntry {
  id: string;
  label?: string;
  content: string;
  metadata?: TasteSkillMetadata; // NEW
  createdAt: number;
  updatedAt: number;
}

interface TasteSkillMetadata {
  installName: string;
  category: string;
  sourceRepo?: string;
  isTasteSkill: boolean;
  version?: string;
  dials?: {
    designVariance?: number;
    motionIntensity?: number;
    visualDensity?: number;
  };
  outputType?: "code" | "images" | "both";
}
```

**Critical:** Update both `electron/integrations/vault/types.ts` AND `global.d.ts` so the type is available in renderer and main processes.

### Step 3: Update IPC Handlers

Modify `electron/main.ts` vault IPC handlers to pass metadata through:

```typescript
ipcMain.handle("vault:add-entry", async (_event, boxId, input) => {
  // input now includes metadata field
  return addEntry(boxId, input); // addEntry accepts metadata too
});
```

And update `electron/integrations/vault/index.ts`:

```typescript
export function addEntry(
  boxId: string,
  input: { content: string; label?: string; metadata?: VaultEntry["metadata"] }
): { success: boolean; entry?: VaultEntry; error?: string } {
  // ... create entry with metadata ...
}
```

### Step 4: Fetch from GitHub Raw Content

```typescript
const RAW_BASE = "https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills";

async function fetchSkillMarkdown(folder: string): Promise<string | null> {
  const url = `${RAW_BASE}/${folder}/SKILL.md`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  return await r.text();
}
```

**Pitfall:** GitHub API rate-limits unauthenticated requests to 60/hour. For production, use a GitHub token or cache locally.

### Step 5: Import into Vault

```typescript
import { importTasteSkills } from "./services/tasteSkillImport";

// In Stargate marketplace or AdaPortal panel:
const result = await importTasteSkills(
  (boxId, entry) => window.electronAPI.vault.addEntry(boxId, entry),
  "box-taste-skills" // target box ID
);

console.log(`Imported ${result.imported} skills, ${result.failed} failed`);
```

### Step 6: Inject into System Prompt with Dial Overrides

When a Taste-Skill is attached to an agent, the system prompt builder must:

1. Detect Taste-Skill format (has `DESIGN_VARIANCE` in content)
2. Inject dial override block BEFORE skill content:

```markdown
### CURRENT DIALS (Runtime Override)
- DESIGN_VARIANCE: 8
- MOTION_INTENSITY: 6
- VISUAL_DENSITY: 4

Apply these dial values instead of the skill's baseline defaults.
```

3. Support user-adjusted dials via `buildSystemPrompt({ dialOverrides: {...} })`

## Generic External SKILL.md Import (Non-Taste-Skill)

Not every external repo uses the Taste-Skill dial format. For repos that publish a plain `SKILL.md` with YAML frontmatter (name, category, description, version), use this lighter pattern.

### Step 1: Classify the repo

Before writing any integration code, decide which surface the repo best fits:

| Repo shape | Hermes surface | Mosaic surface | Stargate surface |
|---|---|---|---|
| Structured methodology / prompt library | Local `SKILL.md` skill | Vault imported skill | Agent profile |
| Ships an MCP server/binary | Hermes `mcp_servers` config + native MCP client | Default MCP plugin in `ensureDefaultPlugins()` | Agent profile that uses MCP tools |
| Framework/agent harness | Local `SKILL.md` skill + optional CLI wrapper | Vault imported skill | Bundle with multiple agents |

### Step 2: Fetch from GitHub Raw

```typescript
const RAW_BASE = "https://raw.githubusercontent.com";
async function fetchSkillMarkdown(owner: string, repo: string, branch = "main", skillPath = ""): Promise<string | null> {
  const path = skillPath ? `${skillPath}/SKILL.md` : "SKILL.md";
  const url = `${RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return r.status === 200 ? await r.text() : null;
  } catch {
    return null;
  }
}
```

**Pitfall:** Unauthenticated GitHub raw requests are rate-limited. For production, cache the markdown locally or use a token.

### Step 3: Store in Mosaic Vault

Create a dedicated "External Skills" Vault box and append each imported `SKILL.md` as an entry with structured metadata:

```typescript
interface ExternalSkillMetadata {
  installName: string;
  category: string;
  sourceRepo: string;
  version: string;
  outputType?: "code" | "images" | "both";
  isTasteSkill: boolean;
}
```

The importer should:
1. Create the box if it does not exist.
2. Parse frontmatter to extract `name`, `category`, `description`, `version`.
3. Detect `outputType` from markdown content.
4. Call `vault.addEntry(boxId, { label: name, content: markdown, metadata })`.

### Step 4: Auto-register MCP servers (if the repo ships one)

If the repo exposes an MCP server, add it to both Hermes `~/.hermes/config.yaml` under `mcp_servers` **and** Mosaic's `ensureDefaultPlugins()` so it is available inside the Electron app without manual setup.

For a **static binary release** (e.g., `codebase-memory-mcp`):

```typescript
const hasCodebaseMemory = existing.some((p) => p.name === "codebase-memory");
if (!hasCodebaseMemory) {
  const cbmBinary = process.env.CODEBASE_MEMORY_MCP_PATH
    || path.join(os.homedir(), ".local", "bin", "codebase-memory-mcp");
  if (fs.existsSync(cbmBinary)) {
    pluginManager.add({
      name: "codebase-memory",
      description: "Codebase Memory — persistent code knowledge graph via MCP",
      transport: "stdio",
      command: cbmBinary,
      args: [],
      env: {},
      autoConnect: true,
    });
  }
}
```

For an **npx/server** MCP, use the local `require.resolve()` pattern described in the MCP integration skill.

### Step 5: Expose in Stargate

Add agent profiles and bundles to `StargateSkillRegistry.ts` so marketplace users can hire agents that already carry the new skills:

- One agent per repo role (e.g., `kilo-code-001`, `codebase-memory-001`).
- Bundles that group related agents (e.g., `external-superpowers`).

### Verification

```bash
hermes skills list                              # skills appear
hermes mcp test <server_name>                   # MCP server connects
npx tsc --noEmit                                # Mosaic TypeScript clean
```

Full drop-in code for this session is in `references/generic-github-skill-import.md`.

## UI Components

### Taste-Skill Dial Panel

A React component with three range sliders (1-10) and preset buttons. See `references/taste-skill-ui.md` for full component code.

### UI Integration Pattern

For wiring the import button, vault section, dial auto-save, and "Attach with Dials" into a Stargate marketplace panel, see `references/taste-skill-ui-integration-pattern.md`. Covers dynamic import, IPC `any` type workaround, state variable layout, and auto-save pattern.

## Pitfalls

**Double-slash URL bug in Mosaic AIService:** `baseUrl` ending with `/` + path starting with `/` produces `localhost:8642//health`. Always strip trailing slash: `baseUrl.replace(/\/$/, "")`.

**Wrong default port:** `HermesAgentService.ts` had `HERMES_DEFAULT_PORT = 3000` instead of `8642`. The Hermes standalone API runs on 8642.

**Profile toolset starvation:** Workers with only `[hermes-cli, kanban, kanban-orchestrator]` can create tasks but cannot execute work. Always add domain-specific toolsets.

**Reasoning models failing kanban dispatch:** Even models with >64K context (e.g. `qwen2.5-coder:14b` at 131K) may fail due to reasoning-token overhead. Use non-reasoning models for workers.

**Import path mismatch:** `src/services/` importing from `src/utils/` needs `../utils/`, not `./utils/`. TypeScript `paths` `@/*` mapping only works for `src/` root, not cross-directory imports.

**IPC handler `import()` type annotation fails:** In `electron/main.ts`, `input: { metadata?: import("./...").Type }` causes TypeScript path resolution errors. Use `input: any` for IPC payload types — runtime validation happens inside `addEntry()`.

**Auto-save vs explicit Save button:** For dial sliders, auto-save on `onChange` is preferred. Users expect immediate feedback. A separate Save button creates friction and forget-to-save risk.

## References

- `references/taste-skill-format.md` — Full Taste-Skill SKILL.md specification with parsing regexes
- `references/taste-skill-ui.md` — React dial panel component code
- `references/taste-skill-ui-integration-pattern.md` — AdaPortalPanel wiring, dynamic import, IPC workaround, auto-save
- `references/external-repo-import-pattern.md` — Generic pattern for any external skill repo
- `references/five-public-repos-integration.md` — End-to-end session recipe for integrating `Kilo-Org/kilocode`, `obra/superpowers`, `DeusData/codebase-memory-mcp`, `google-research/timesfm`, and `withastro/flue` into Hermes, Mosaic Vault/MCP, and Stargate agents/bundles. (2026-06-19)
- `references/generic-github-skill-import.md` — Drop-in recipe for importing plain GitHub `SKILL.md` repos (with MCP server wiring and Stargate bundles) — session proven on kilocode, superpowers, codebase-memory-mcp, timesfm, flue