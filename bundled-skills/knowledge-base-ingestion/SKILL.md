---
name: knowledge-base-ingestion
description: End-to-end pipeline for acquiring curated knowledge bases (awesome-lists, docs, registries) and turning them into structured JSON, Hermes skills, and MCP-indexed graphs. Ensures agents can discover and reuse the knowledge across sessions.
category: devops
author: Mosaic Ecosystem
version: 1.0.0
---

# knowledge-base-ingestion

When the user drops a curated knowledge repository (awesome-list, free-tier registry, tool catalog, API directory) and says "acquire this," follow this pipeline exactly.

## End-to-End Pipeline

1. **FETCH**
   - `curl -sL` the raw source (README.md, JSON API, CSV).
   - Always prefer raw GitHub content URLs (`.md` raw) over HTML scraping.

2. **PARSE**
   - Inspect the markdown structure (H2 categories, bullet lists, nested features).
   - Write a small Python regex parser (no deps) to extract hierarchy.
   - Output: flat JSON with `categories → services → features` schema.
   - See `references/markdown-extraction-pattern.md` (in `free-tier-arbitrage`) for the proven regex set.

3. **STRUCTURE**
   - Store JSON in `~/.hermes/skills/<skill-name>/data/<source-name>.json`.
   - Keep it local (~350KB is fine); do not hot-load from GitHub on every query.

4. **SKILL-IFY**
   - Write `SKILL.md` with YAML frontmatter, commands, integration matrix, and script reference.
   - Write `scripts/query.py` (Python 3, zero deps) with: categories, query, search, top, scaffold, refresh.
   - Test every command before declaring done.

5. **MCP-INDEX**
   - Copy skill directory to `~/codebase-memory-projects/<project-name>`.
   - Run `mcp_codebase_memory_index_repository` with `mode=fast` and `persistence=true`.
   - Verify with `index_status`.

6. **MEMORY-SAVE**
   - Save skill path, commands, MCP project name, and key category counts to `memory` target.
   - Save user-visible facts (top categories, integration points) to `user` target.

7. **VALIDATE**
   - Run each query command end-to-end (categories, search, query, top, scaffold).
   - Confirm JSON loads correctly and MCP returns results.
   - Only then mark tasks complete.

## Integration Targets

| Target | Action |
|---|---|
| Hermes Skills | `~/.hermes/skills/<name>/` — query engine + JSON data |
| MCP Codebase Memory | `~/codebase-memory-projects/<name>` — indexed graph for agent search |
| Persistent Memory | `memory` + `user` stores for cross-session recall |
| Mosaic-Companion Vault | Skill loaded via `skill_view`; JSON parsed by panel scripts |

## Pitfalls

- **BrokenPipeError** — Never pipe `search` output to `head` without pagination in the script.
- **Upstream rejection** — Respect `AGENTS.md` / `CLAUDE.md` policies. This pipeline is read-only.
- **Stale data** — Free tiers change. Add a `refresh` command that re-fetches and re-parses.
- **Memory overflow** — Batch memory operations (remove stale entries + add new ones in one call) to stay under the 2,200 char limit.

## References

- `references/markdown-extraction-pattern.md` (bundled in `free-tier-arbitrage`) — Regex parsing recipe for awesome-lists.
- Example project: `home-mauricio-codebase-memory-projects-free-tier-arbitrage-repo`

## Roadmap

- [ ] Add generic `ingest.py` script that accepts a URL + regex config and auto-produces the JSON + SKILL.md scaffold.
- [ ] Add `refresh-all` command that updates every indexed knowledge base in one pass.
- [ ] Add Mosaic-Companion panel generator for any ingested JSON.
