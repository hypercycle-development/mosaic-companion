---
name: hermes-agent-skill-authoring
description: "Author in-repo SKILL.md: frontmatter, validator, structure.""
version: 1.0.0
author: Hermes Agent
category: software-development
source: hermes-converted
converted_at: 2026-07-02T21:03:36.283927
---

# Authoring Hermes-Agent Skills (in-repo)

## Overview

There are two places a SKILL.md can live:

1. **User-local:** `~/.hermes/skills/<maybe-category>/<name>/SKILL.md` — personal, not shared. Created via `skill_manage(action='create')`.
2. **In-repo (this skill is about this case):** `/home/bb/hermes-agent/skills/<category>/<name>/SKILL.md` — committed, shipped with the package. Use `write_file` + `git add`. `skill_manage(action='create')` does NOT target this tree.

## When to Use

- User asks you to add a skill "in this branch / repo / commit"
- You're committing a reusable workflow that should ship with hermes-agent
- You're editing an existing skill under `/home/bb/hermes-agent/skills/` (use `patch` for small edits, `write_file` for rewrites; `skill_manage` still works for patch on in-repo skills, but not for `create`)

## Required Frontmatter

Source of truth: `tools/skill_manager_tool.py::_validate_frontmatter`. Hard requirements:

- Starts with `---` as the first bytes (no leading blank line).
- Closes with `\n---\n` before the body.
- Parses as a YAML mapping.
- `name` field present.
- `description` field present, ≤ **1024 chars** (`MAX_DESCRIPTION_LENGTH`).
- Non-empty body after the closing `---`.

Peer-matched shape used by every skill under `skills/software-development/`:

```yaml
---
name: my-skill-name               # lowercase, hyphens, ≤64 chars (MAX_NAME_LENGTH)
description: Use when <trigger>. <one-line behavior>.
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [short, descriptive, tags]
    related_skills: [other-skill, another-skill]
---
```

`version` / `author` / `license` / `metadata` are NOT enforced by the validator, but every peer has them — omit and your skill sticks out.

## Size Limits

- Description: ≤ 1024 chars (enforced).
- Full SKILL.md: ≤ 100,000 chars (enforced as `MAX_SKILL_CONTENT_CHARS`, ~36k tokens).
- Peer skills in `software-development/` sit at **8-14k chars**. Aim for that range. If you're pushing past 20k, split into `references/*.md` and reference them from SKILL.md.

## Peer-Matched Structure

Every in-repo skill follows roughly:

```
# <Title>

## Overview
One or two paragraphs: what and why.

## When to Use
- Bulleted triggers
- "Don't use for:" counter-triggers

## <Topic sections specific to the skill>
- Quick-reference tables are common
- Code blocks with exact commands
- Hermes-specific recipes (tests via scripts/run_tests.sh, ui-tui paths, etc.)

## Common Pitfalls
Numbered list of mistakes and their fixes.

## Verification Checklist
- [ ] Checkbox list of post-action verifications

## One-Shot Recipes (optional)
Named scenarios → concrete command sequences.
```

Not every section is mandatory, but `Overview` + `When to Use` + actionable body + pitfalls are the minimum for the skill to feel like a peer.

## Directory Placement

```
skills/<category>/<skill-name>/SKILL.md
```

Categories currently in repo (confirm with `ls skills/`): `autonomous-ai-agents`, `creative`, `data-science`, `devops`, `dogfood`, `email`, `gaming`, `github`, `leisure`, `mcp`, `media`, `mlops/*`, `note-taking`, `productivity`, `red-teaming`, `research`, `smart-home`, `social-media`, `software-development`.

Pick the closest existing category. Don't invent new top-level categories casually.

## Workflow

1. **Survey peers** in the target category:
   ```
   ls skills/<category>/
   ```
   Read 2-3 peer SKILL.md files to match tone and structure.
2. **Check validator constraints** in `tools/skill_manager_tool.py` if unsure.
3. **Draft** with `write_file` to `skills/<category>/<name>/SKILL.md`.
4. **Validate locally**:
   ```python
   import yaml, re, pathlib
   content = pathlib.Path("skills/<category>/<name>/SKILL.md").read_text()
   assert content.startswith("---")
   m = re.search(r'\n---\s*\n', content[3:])
   fm = yaml.safe_load(content[3:m.start()+3])
   assert "name" in fm and "description" in fm
   assert len(fm["description"]) <= 1024
   assert len(content) <= 100_000
   ```
5. **Git add + commit** on the active branch.
6. **Note:** the CURRENT session's skill loader is cached — `skill_view` / `skills_list` will not see the new skill until a new session. This is expected, not a bug.

## Cross-Referencing Other Skills

`metadata.hermes.related_skills` unions both trees (`skills/` in-repo and `~/.hermes/skills/`) at load time. You CAN reference a user-local skill from an in-repo skill, but it won't resolve for other users who clone the repo fresh. Prefer referencing only in-repo skills from in-repo skills. If a frequently-referenced skill lives only in `~/.hermes/skills/`, consider promoting it to the repo.

## Editing Existing In-Repo Skills

- **Small fix (typo, added pitfall, tightened trigger):** `skill_manage(action='patch', name=..., old_string=..., new_string=...)` works fine on in-repo skills.
- **Major rewrite:** `write_file` the whole SKILL.md. `skill_manage(action='edit')` also works but requires supplying the full new content.
- **Adding supporting files:** `write_file` to `skills/<category>/<name>/references/<file>.md`, `templates/<file>`, or `scripts/<file>`. `skill_manage(action='write_file')` also works and enforces the references/templates/scripts/assets subdir allowlist.
- **Always commit** the edit — in-repo skills are source, not runtime state.

## Common Pitfalls

1. **Using `skill_manage(action='create')` for an in-repo skill.** It writes to `~/.hermes/skills/`, not the repo tree. Use `write_file` for in-repo creation.

2. **Leading whitespace before `---`.** The validator checks `content.startswith("---")`; any leading blank line or BOM fails validation.

3. **Description too generic.** Peer descriptions start with "Use when ..." and describe the *trigger class*, not the one task. "Use when debugging X" > "Debug X".

4. **Forgetting the author/license/metadata block.** Not validator-enforced, but every peer has it; omitting makes the skill look half-finished.

5. **Writing a skill that duplicates a peer.** Before creating, `ls skills/<category>/` and open 2-3 peers. Prefer extending an existing skill to creating a narrow sibling.

6. **Expecting the current session to see the new skill.** It won't. The skill loader is initialized at session start. Verify in a fresh session or via `skill_view` using the exact path.

7. **Linking to skills that don't exist in-repo.** `related_skills: [some-user-local-skill]` works for you but breaks for other clones. Prefer only in-repo links.

8. **Dropping `references/` pointers during patch operations.** When using `skill_manage(action='patch')` or `patch` to replace a section near a reference link, the replacement text must include the original `## References` or `references/` pointer or it will be silently dropped. Always re-read the skill after patching to confirm support file links survive.

## Library Shape Target (User-defined)

The target shape of a Hermes skill library should be **class-level umbrella skills**, each with:

- A **rich, opinionated SKILL.md** (8–15k chars) that teaches *how* to think about the class of task
- A **`references/` directory** for session-specific detail, error transcripts, reproduction recipes, and condensed knowledge banks
- A **`templates/` directory** for starter files (boilerplate configs, scaffolding)
- A **`scripts/` directory** for re-runnable verification or fixture scripts

**Not** a long flat list of narrow one-session-one-skill entries. If a skill only makes sense for a single task, it is too narrow — fold it into an umbrella or add a `references/<topic>.md` under an existing one.

Examples of good umbrella names: `blockchain-node-ops`, `mlops-training`, `electron-linux-setup`.

Examples of too-narrow names: `fix-xyz-bug`, `debug-cert-daemon-2026-05-12`, `pr-42-review`.

For a worked example of enriching empty auto-generated skills into class-level umbrellas, see `references/skill-enrichment-pattern.md`.

## Update Preference Order (Post-Session Review)

When a session produces learning that should persist, prefer these actions in order:

1. **UPDATE A CURRENTLY-LOADED SKILL** — the skill that was in play during the session is the right place for the fix.
2. **PATCH AN EXISTING UMBRELLA** — if no loaded skill fits but a class-level skill covers the territory, add a subsection, pitfall, or broaden a trigger.
3. **ADD A SUPPORT FILE** (`references/`, `templates/`, `scripts/`) under an existing umbrella. Use `references/` for session-specific detail and condensed research; `templates/` for starter files; `scripts/` for re-runnable probes. Always add a one-line pointer in the parent SKILL.md so future agents know the file exists.
4. **CREATE A NEW CLASS-LEVEL UMBRELLA** only if no existing skill covers the class. The name MUST NOT be a specific PR number, error string, feature codename, or session artifact.

## User-Preference Embedding

When a user corrects your **style, tone, format, legibility, verbosity, workflow, approach, or sequence of steps**, the lesson belongs in the **SKILL.md** that governs that class of task — not just in memory. Memory captures who the user is; skills capture how to do the task for this user. Examples:

- User says "stop explaining, just give me the answer" → add to skill governing the task family
- User corrects your code formatting → add to `senior-ai-developer` or coding governance skill
- User insists on 8-phase debugging → add to debugging skill
- User wants structured design-before-code → add to the coding skill

## Enriching Auto-Generated Skills

Skills auto-generated from documentation (e.g., Orchestra Research skills) often have these gaps:

- **Empty "Common Patterns" placeholders** — the quick reference is boilerplate like "*Patterns will be added as you use the skill.*"
- **No cross-references** to related skills in the user's library
- **No self-test scenarios** — only reference doc dumps, no actionable verification
- **No practical quick-start** — just installation + link to reference
- **No integration notes** — how this tool fits with sibling tools the user also uses

When enriching such skills, add:
1. A **practical quick-start** (copy-pasteable code block leading to a running result)
2. An **integration table** mapping tasks → best related skill
3. **Self-test scenarios** with Goal → Steps → Verify format
4. A **Version History** table
5. Update `metadata.hermes.related_skills` to point to sibling skills

## Verification Checklist

- [ ] File is at `skills/<category>/<name>/SKILL.md` (not in `~/.hermes/skills/`)
- [ ] Frontmatter starts at byte 0 with `---`, closes with `\n---\n`
- [ ] `name`, `description`, `version`, `author`, `license`, `metadata.hermes.{tags, related_skills}` all present
- [ ] Name ≤ 64 chars, lowercase + hyphens
- [ ] Description ≤ 1024 chars and starts with "Use when ..."
- [ ] Total file ≤ 100,000 chars (aim for 8-15k)
- [ ] Structure: `# Title` → `## Overview` → `## When to Use` → body → `## Common Pitfalls` → `## Verification Checklist`
- [ ] `related_skills` references resolve in-repo (or are explicitly OK to be user-local)
- [ ] `git add skills/<category>/<name>/ && git commit` completed on the intended branch