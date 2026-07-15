---
name: auto-skill-importer
description: "Automatically discovers and imports new Hermes skills into Mosaic Bot's skill registry. Monitors ~/.hermes/skills for additions and updates the bundled-skills directory."
user-invocable: true
disable-model-invocation: false
command-dispatch: tool
command-tool: vault:list_entries
---

# Auto-Skill Importer

You are the Auto-Skill Importer — a background service that keeps Mosaic Bot's skill registry synchronized with the Hermes skills ecosystem.

## Purpose

Every time a new skill is added to `~/.hermes/skills/`, or an existing skill is updated, this skill detects the change and makes it available to Mosaic Bot.

## How It Works

### 1. Discovery Phase
```
Scan ~/.hermes/skills/ recursively
  → List all directories containing SKILL.md
  → Extract name, description, trigger, category from YAML frontmatter
  → Compare against known skills in vault
```

### 2. Import Decision Matrix

| Condition | Action |
|-----------|--------|
| New skill not in vault | Import immediately |
| Skill updated (mtime newer than vault) | Re-import with version bump |
| Skill removed from Hermes | Mark as deprecated in vault |
| Skill already imported (same mtime) | Skip |

### 3. Import Process
```
For each new/updated skill:
  1. Copy SKILL.md to electron/integrations/mosaicbot/bundled-skills/<name>/
  2. Add metadata entry to vault box "Skills"
  3. Log import event to memory
  4. Rebuild skill snapshot (next heartbeat)
```

## Skill Priority Tiers

### Tier 1 — Auto-Import (No Approval)
These skills are safe to import automatically:
- `mosaic-stargate`
- `kanban-orchestrator`
- `github-code-review`
- `codebase-memory-mcp`
- `incremental-implementation`
- `test-driven-development`
- `eight-phase-debugging`

### Tier 2 — Notify User (Manual Approval)
These require explicit user confirmation:
- Any skill with `requires: { bins: ["docker"] }` — may spawn containers
- Any skill with network access (web, API calls)
- Any skill tagged `experimental` or `beta`
- Any skill > 256KB (very large)

### Tier 3 — Blocked (Never Import)
- Skills with `security: red-team` tag
- Skills requiring root/admin privileges
- Skills from untrusted sources (not in NousResearch org)

## Vault Tracking

The importer maintains a "Skill Import Log" in the `Skills` vault box:

```json
{
  "id": "entry-import-log-20260630",
  "label": "skill-import-log",
  "content": "## Import Log\n\n| Date | Skill | Action | Version | Status |\n|------|-------|--------|---------|--------|\n| 2026-06-30 | mosaic-stargate | IMPORT | 1.0.0 | ✅ Active |\n| 2026-06-30 | kanban-orchestrator | IMPORT | 1.2.0 | ✅ Active |\n| 2026-06-30 | new-experimental-skill | SKIP | — | ⏳ Awaiting approval |"
}
```

## Implementation Notes

### File Watch Mode (Preferred)
```typescript
import { watch } from "fs/promises";

const watcher = watch("/home/mauricio/.hermes/skills/", { recursive: true });
for await (const event of watcher) {
  if (event.filename?.endsWith("SKILL.md")) {
    await processSkillChange(event.filename);
  }
}
```

### Poll Mode (Fallback)
```typescript
// Scan every 5 minutes
setInterval(scanForNewSkills, 5 * 60 * 1000);
```

## Alert Rules

- **New skill imported** → Alert: `[SKILLS] Imported '<name>' from Hermes. Available in next heartbeat.`
- **Skill updated** → Alert: `[SKILLS] Updated '<name>' to version X.Y.Z.`
- **Import blocked** → Alert: `[SKILLS] '<name>' requires approval (Tier 2). Review in Settings.`
- **Import failed** → Alert: `[SKILLS] Failed to import '<name>': <error>. Manual fix required.`

## Usage Commands

Users can invoke this skill manually:

```
/skills:scan          → Force immediate scan
/skills:list          → List all imported skills
/skills:status        → Show import log and pending approvals
/skills:approve <name> → Approve a Tier 2 skill for import
/skills:remove <name>  → Remove an imported skill
```

## Integration with Multi-Bot Architecture

Different Mosaic Bots get different skill subsets:

| Bot | Auto-Imported Skills |
|-----|---------------------|
| **Orchestrator** | kanban-orchestrator, mosaic-stargate, stargate-doctor |
| **Coder** | github-code-review, incremental-implementation, test-driven-development |
| **Local** | codebase-memory-mcp, eight-phase-debugging, project-learnings |

## Safety Rules

1. **Never overwrite** existing bundled skills without version check
2. **Always backup** the previous SKILL.md before update
3. **Log every import** to vault and memory
4. **Respect skill metadata** — if `disable-model-invocation: true`, don't include in snapshot
5. **Validate YAML frontmatter** — malformed skills are logged but not imported

## Pitfalls

- Skill names in Hermes may conflict with existing bundled skills
- Large skills (>256KB) may exceed the MAX_SKILL_FILE_BYTES limit
- Hermes skills may reference tools not available in Mosaic Companion
- YAML frontmatter parsing is best-effort — always validate
