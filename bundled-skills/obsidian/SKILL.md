---
name: obsidian
description: "Read, search, create, and edit notes in the Obsidian vault. Includes retrieval-first organization and GBrain memory-layer integration."
category: note-taking
source: hermes-converted
converted_at: 2026-07-02T21:03:36.288012
---

# Obsidian Vault

Use this skill for filesystem-first Obsidian vault work, plus retrieval-first organizational conventions and GBrain memory-system integration.

## Vault path

Use a known or resolved vault path before calling file tools.

The documented vault-path convention is the `OBSIDIAN_VAULT_PATH` environment variable, for example from `~/.hermes/.env`. If it is unset, use `~/Documents/Obsidian Vault`.

File tools do not expand shell variables. Do not pass paths containing `$OBSIDIAN_VAULT_PATH` to `read_file`, `write_file`, `patch`, or `search_files`; resolve the vault path first and pass a concrete absolute path. Vault paths may contain spaces, which is another reason to prefer file tools over shell commands.

If the vault path is unknown, `terminal` is acceptable for resolving `OBSIDIAN_VAULT_PATH` or checking whether the fallback path exists. Once the path is known, switch back to file tools.

## Read a note

Use `read_file` with the resolved absolute path to the note. Prefer this over `cat` because it provides line numbers and pagination.

## List notes

Use `search_files` with `target: "files"` and the resolved vault path. Prefer this over `find` or `ls`.

- To list all markdown notes, use `pattern: "*.md"` under the vault path.
- To list a subfolder, search under that subfolder's absolute path.

## Search

Use `search_files` for both filename and content searches. Prefer this over `grep`, `find`, or `ls`.

- For filenames, use `search_files` with `target: "files"` and a filename `pattern`.
- For note contents, use `search_files` with `target: "content"`, the content regex as `pattern`, and `file_glob: "*.md"` when you want to restrict matches to markdown notes.

## Create a note

Use `write_file` with the resolved absolute path and the full markdown content. Prefer this over shell heredocs or `echo` because it avoids shell quoting issues and returns structured results.

## Append to a note

Prefer a native file-tool workflow when it is not awkward:

- Read the target note with `read_file`.
- Use `patch` for an anchored append when there is stable context, such as adding a section after an existing heading or appending before a known trailing block.
- Use `write_file` when rewriting the whole note is clearer than constructing a fragile patch.

For an anchored append with `patch`, replace the anchor with the anchor plus the new content.

For a simple append with no stable context, `terminal` is acceptable if it is the clearest safe option.

## Targeted edits

Use `patch` for focused note changes when the current content gives you stable context. Prefer this over shell text rewriting.

## Wikilinks

Obsidian links notes with `[[Note Name]]` syntax. When creating notes, use these to link related content.

## Vault Organization (Retrieval-First)

Organize for **retrieval**, not storage. Every folder, naming convention, tag, and property decision must answer: "does this make finding the note faster or slower"

### 7-Folder Structure

| Folder | Content | Retrieval pattern |
|--------|---------|-------------------|
| `00 - INBOX/` | Temporary captures | Process daily; nothing permanent |
| `01 - NOTES/` | Time-stamped captures: daily/, meetings/, books/, courses/ | "When did this happen" |
| `02 - PROJECTS/` | Active work with defined outcome and end date | "What am I working on" |
| `03 - AREAS/` | Ongoing responsibilities with no end date | "What am I responsible for" |
| `04 - RESOURCES/` | Reference material — personal Wikipedia by topic, person, place, tool | "What do I know about X" |
| `05 - ARCHIVE/` | Completed projects, outdated refs, old notes (>1yr) | "What did I finish" |
| `06 - SYSTEM/` | Templates, MOCs, config | Things that make the vault work |

### Naming Convention

```
YYYY-MM-DD-[TYPE]-[TOPIC].md
```

Examples:
- `2026-05-20-daily-wednesday.md`
- `2026-05-15-meeting-client-quarterly-review.md`
- `2026-05-10-book-thinking-fast-and-slow.md`
- `2026-04-28-resource-claude-prompting-techniques.md`

The date prefix sorts chronologically, gives a time anchor for retrieval, and prevents filename collisions.

### Properties (YAML Frontmatter)

Every note must carry:
```yaml
---
type: [daily/meeting/project/area/resource/book/course/idea/task]
status: [active/complete/archived/reference/waiting]
date: YYYY-MM-DD
tags: [topic1, topic2]
---
```

Additional type-specific properties (include when relevant):
- **project**: `deadline`, `priority`, `next_action`, `completion`
- **book**: `author`, `finished`, `rating`, `key_insight`
- **meeting**: `attendees`, `decisions`, `actions`
- **resource**: `topic`, `source`, `reliability`

### Three-Category Tag System

- **Topic tags** — what the note is about: `#productivity`, `#cardano`, `#machine-learning`
- **Status tags** — where it is in a workflow: `#status/active`, `#status/waiting`, `#status/complete`
- **Project tags** — which project it belongs to: `#project/website-launch`

Rule: only create a new tag if it will appear on at least five notes. Singleton tags are noise.

### Maps of Content (MOCs)

When a topic accumulates more than 20 notes, create a MOC: a hub note that links to all related notes in that cluster. Place it in `SYSTEM/MOCs/`. A MOC is not a folder; notes stay where they are and the MOC links to them. This makes large topic clusters navigable from a single starting point.

### Inbox Processing (Daily Habit)

For every note in INBOX, answer:
1. What type of content is this? → determines folder
2. Does it already have a home? → link it
3. Should it be its own note or added to an existing note?
4. Update properties, filename, tags. Move to correct folder.

### Quarterly Vault Review

Every three months: audit folders, tags, archive stale notes, fix naming inconsistencies. Takes 30–120 min; pays back every time you find a note in under 30 seconds.

## GBrain Integration

GBrain can index an Obsidian vault for semantic search, entity graph extraction, and synthesized answers (`gbrain think`). This session produced a tested install recipe; see `references/gbrain-mcp.md` for the full procedure.

At a glance:
1. **Install**: `bun install -g github:garrytan/gbrain`
2. **Init**: `gbrain init --pglite` (add `--no-embedding` if no embedding API key yet)
3. **Import**: `gbrain import <vault-path> --no-embed`
4. **Register MCP** in `~/.hermes/config.yaml`:
   ```yaml
   mcp_servers:
     gbrain:
       command: "gbrain"
       args: ["serve"]
       timeout: 120
       connect_timeout: 60
   ```
5. **Restart** Hermes Agent for MCP tool discovery. Tools appear as `mcp_gbrain_*`.

With embeddings configured, `gbrain think` returns synthesized, cited answers across the vault with gap analysis — the synthesis layer turns search into a true memory system.

## Vault as GBrain Fallback (PGLite WASM Crash Recovery)

GBrain's PGLite engine can fail on some Linux kernels (≥ 6.17) with:
```
PGLite failed to initialize its WASM runtime. Aborted().
```
When this happens, the vault remains the durable source of truth.

**In a brain outage, write to vault FIRST:**
1. Draft root page in `02-PROJECTS/<project>-project.md` with commit table, architecture, and infrastructure state
2. Draft child pages in `02-PROJECTS/<project>-<section>.md` per UI tab (source file, key commits, fixes)
3. Draft consolidated log in `02-PROJECTS/<project>-development.md`
4. Use `[[wikilink]]` syntax for cross-navigation
5. Tag with three-category system: topic, status, project
6. Re-import to gbrain later: `gbrain import ~/Vault/02-PROJECTS/ --no-embed`

**Why this works:** The vault is git-tracked, retrieval-first, and YAML-fronted. It needs no WASM runtime. GBrain is an enrichment layer, never the primary store.