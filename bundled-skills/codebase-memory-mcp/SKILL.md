---
name: codebase-memory-mcp
description: "Deploy and use the codebase-memory-mcp high-performance code-intelligence MCP server. Index codebases into a persistent knowledge graph and query call chains, architecture, ADRs, and change blast radius with sub-millisecond graph queries."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [mcp, external-repo, integration]
    homepage: https://github.com/
    related_skills: [hermes-agent, native-mcp]
---

# codebase-memory-mcp

codebase-memory-mcp is a high-performance code-intelligence MCP server written in pure C. It builds a persistent knowledge graph of a codebase using tree-sitter AST analysis and Hybrid LSP semantic resolution (9 languages), then exposes 14 read-mostly MCP tools.

## When to use

- You need deep code-structure understanding faster than file-by-file search.
- You want call-chain analysis (`trace_path`), architecture overview (`get_architecture`), or change blast radius (`detect_changes`).
- You want a single static binary with zero runtime dependencies and no API keys.

## Installation

Download the latest release binary for your platform and run `install`:

```bash
# Linux x86_64 example
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/scripts/setup.sh | bash
codebase-memory-mcp install
```

Supported platforms: macOS (arm64/amd64), Linux (arm64/amd64), Windows (amd64).

## MCP tools (14)

### Indexing
- `index_repository` — index a repo; auto-sync keeps it fresh.
- `list_projects` — list indexed projects with node/edge counts.
- `delete_project` — remove a project graph.
- `index_status` — check indexing status.

### Querying
- `search_graph` — structured search by label, name pattern, file pattern, degree filters.
- `trace_path` / `trace_call_path` — BFS call-chain traversal, depth 1–5.
- `detect_changes` — map git diff to affected symbols + blast radius + risk classification.
- `query_graph` — Cypher-like read-only graph queries.
- `get_graph_schema` — node/edge counts, relationship patterns, property definitions.
- `get_code_snippet` — read source for a function by qualified name.
- `get_architecture` — codebase overview: languages, packages, routes, hotspots, clusters, ADR.
- `search_code` — grep-like text search within indexed files.
- `manage_adr` — create/update architecture decision records.

## Hermes integration

Add to `~/.hermes/config.yaml` under `mcp_servers`:

```yaml
mcp_servers:
  codebase_memory:
    command: "codebase-memory-mcp"
    args: ["serve", "--stdio"]
```

Tools will appear as `mcp_codebase_memory_*`.

## Mosaic Companion integration

In `electron/integrations/mcp/index.ts`, add an `ensureDefaultPlugins()` entry for `codebase-memory-mcp` that:
1. Resolves the binary from `~/.local/bin/codebase-memory-mcp` or `~/bin/codebase-memory-mcp`.
2. Registers with `transport: "stdio"`, `args: ["serve", "--stdio"]`.
3. Sets `autoConnect: true`.

## Usage workflow

1. `mcp_codebase_memory_index_repository` on the target repo.
2. `mcp_codebase_memory_get_graph_schema` to understand the graph.
3. `mcp_codebase_memory_trace_path` or `search_graph` for the question at hand.
4. `mcp_codebase_memory_get_code_snippet` to read relevant source.

## Pitfalls

- The binary must be on PATH or given as an absolute path; it is a single static binary but must be executable.
- Graph UI variant exists but is optional; the core MCP server works headless.
- No built-in LLM — the agent translates natural language to structured graph queries.
- Indexes average repos in milliseconds; very large repos (Linux kernel) take minutes.

## Resources

- https://github.com/DeusData/codebase-memory-mcp
- arXiv:2603.27277 — Codebase-Memory paper

