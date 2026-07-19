---
name: skill-ecosystem-migration
description: Port and integrate external skill/plugin ecosystems into Hermes — from repo analysis through bulk conversion, master orchestrator creation, MCP bridge building, codebase-memory indexing, and kanban task decomposition. Trigger when the user asks to integrate, port, migrate, or adapt an external skill marketplace, plugin collection, or knowledge base into Hermes.
version: 1.0.0
metadata:
  hermes:
    tags: [skills, integration, migration, porting, automation, hermes, mcp, kanban, orchestration]
---

# Skill Ecosystem Migration into Hermes

A repeatable playbook for porting external skill/plugin repositories (e.g., Claude Code plugin marketplaces, VS Code extension packs, standalone skill repos) into the Hermes ecosystem with full automation.

## When to Use

- A user wants to "add all skills from X" or "integrate Y plugin marketplace"
- You discover a rich external knowledge base (Claude Code plugins, GitHub skill repos, documentation packs) that should become Hermes skills
- You need to create MCP bridge servers, codebase-memory indexes, and kanban orchestration for a new domain

## Prerequisites

- Source repository cloned locally
- Hermes CLI available (`hermes skills list` works)
- Python 3 for bulk conversion scripts
- Mosaic-Companion source available (for MCP bridge creation)
- Codebase-memory MCP configured (for indexing)

## Phase 1: Repository Analysis & Inventory

### Step 1: Clone and inspect structure
```bash
cd /tmp && git clone --depth 1 <repo-url> ecosystem-source
```

### Step 2: Generate automated inventory

Use `scripts/generate-skill-inventory.py` (in this skill) to catalog all plugins, skills, agents, commands, references, and examples.

The script produces `HERMES-INTEGRATION-INVENTORY.md` with:
- Plugin matrix (name, version, skill count, agent count, command count)
- Skill list per plugin with paths and descriptions
- Agent definitions
- Command triggers
- Reference/doc counts
- Compatibility assessment (source format → Hermes format)
- Tiered integration priority (Tier 1 must-have → Tier 5 optional)

### Step 3: Assess compatibility

Identify format differences between source and Hermes:

| Source Feature | Hermes Equivalent | Action |
|---|---|---|
| `name: plugin:skill` frontmatter | `name: prefix-skill` with `category:` | Rewrite frontmatter |
| `agents/*.md` | `~/.hermes/skills/<category>-agents/` | Convert to SKILL.md |
| `commands/*.md` slash commands | Hermes slash commands or kanban tasks | Adapt or document |
| `references/*.md` | Copy as-is under skill's `references/` | Direct copy |
| `examples/*` | Copy as-is under skill's `examples/` | Direct copy |
| `scripts/*` | Copy if pure shell/Python; test executability | Validate |

## Phase 2: Bulk Skill Conversion

Use `scripts/bulk-skill-convert.py` (in this skill) to automate the port:

1. Walk the source `plugins/<plugin>/skills/` tree
2. For each `SKILL.md`:
   - Copy to `~/.hermes/skills/<category>/<prefix>-<skill-name>/`
   - Rewrite frontmatter:
     - Replace `name: <plugin>:<skill>` → `name: <prefix>-<skill>`
     - Add `category: <category>`
     - Keep `description`, `version`
   - Copy `references/`, `examples/`, `scripts/` directories intact
   - Add Hermes compatibility note after frontmatter
3. Verify with `hermes skills list | grep <category>`

### Frontmatter Rewriting Rules (Python)

```python
import re

# Replace plugin-scoped names with flat prefixed names
content = re.sub(r'name:\s*([\w-]+):([\w-]+)', r'name: \1-\2', content)

# Add category if missing
if 'category:' not in content:
    content = content.replace('version:', 'category: my-category\nversion:', 1)

# Add compatibility note after closing frontmatter
if '---' in content:
    parts = content.split('---', 2)
    if len(parts) >= 3 and 'hermes integration' not in parts[2].lower():
        parts[2] = (
            "\n> **Hermes Integration Note:** This skill was ported from an external ecosystem. "
            "Some source-specific commands may need adaptation to Hermes equivalents.\n"
            + parts[2]
        )
        content = f"---{parts[1]}---{parts[2]}"
```

## Phase 3: Agent Porting

Convert `agents/*.md` to Hermes agent skills:

1. Read original `.md` definition
2. Create `~/.hermes/skills/<category>-agents/<prefix>-agent-<name>/SKILL.md`
3. Wrap in frontmatter with `category: <category>-agents`
4. Preserve original content in body with adaptation notes
5. Add routing guidance (when to invoke this agent vs others)

## Phase 4: Master Orchestrator

Create a unified entry point skill:

```yaml
name: <category>-orchestrator
description: Master orchestrator for <domain>. Auto-detects context and routes to specialist skills.
category: <category>
```

Include:
- **Context detection matrix**: user signals → target specialist skills
- **Agent routing table**: which agent handles which task type (for kanban/delegation)
- **End-to-end verification checklist**: what "done" looks like for this domain
- **Environment variables and dependencies**: common env vars, required binaries
- **Quick-start workflow**: a canonical happy-path sequence through the skills

## Phase 5: Codebase Memory Indexing

```bash
# Index the source repo
mcp_codebase_memory_index_repository(
    repo_path="/path/to/source",
    mode="full",
    persistence=true
)

# Cross-repo intelligence (link with existing projects)
mcp_codebase_memory_index_repository(
    repo_path="/path/to/source",
    mode="cross-repo-intelligence",
    target_projects=["*"],
    persistence=true
)
```

Verify with `mcp_codebase_memory_index_status` and test queries.

## Phase 6: MCP Bridge for Mosaic-Companion

Create a Node.js MCP bridge server following the pattern in Mosaic's `electron/integrations/mcp/servers/`:

1. Study existing bridges (gbrain, stargate-marketplace, hermes-tools)
2. Implement stdio JSON-RPC 2.0 protocol
3. Define tool schemas with `name`, `description`, `inputSchema`
4. Implement handlers that either:
   - Shell out to CLI tools (Compact CLI, Docker, curl)
   - Load Hermes skills via `skill_view` or `hermes skills view`
   - Query codebase-memory via the MCP graph
5. Register in `electron/integrations/mcp/index.ts` under `ensureDefaultPlugins()`

See `templates/mcp-bridge-server.js` in this skill for a starter template.

### Phase 6b: ToolRegistry Native Module (Mosaic Main Process)

**In addition to the MCP bridge, create a native `ToolModule`** that the main-process ToolRegistry can invoke directly without IPC overhead:

1. Create `electron/integrations/tools/modules/<prefix>.ts` implementing `ToolModule`:
   - `id`: unique module identifier
   - `name`: human-readable name
   - `tools`: array of `ToolDefinition` objects (name, description, parameters)
   - `isAvailable()`: check MCP connection or required binaries
   - `handler(tool, params)`: call `mcpClient.callTool()` or shell out directly
   - `getSystemPrompt()`: inject domain context into agent prompts
2. Register in `electron/integrations/tools/index.ts`:
   ```typescript
   import { NewModule } from "./modules/<prefix>";
   registry.register(new NewModule());
   ```
3. The `MidnightModule` pattern in Mosaic's `midnight.ts` is the canonical reference.

**Why both?** MCP bridge exposes tools via the MCP protocol (usable by any MCP client); ToolModule exposes them via Mosaic's native ToolRegistry (faster, no JSON-RPC overhead, integrates with agent prompt injection).

### Critical Pattern: Path Resolution in Mosaic

> esbuild bundles TS entry points but does NOT copy raw JS assets. `require.resolve("./servers/...")` fails in `dist/main/`. Always resolve bridge server paths from `$HOME` or use `process.env.SERVER_PATH` with a fallback.

## Phase 8: Kanban Task Decomposition

Create a tiered task graph on a dedicated board:

1. **Research task**: Generate inventory (gated: none)
2. **Parallel porting tracks**: Group skills by plugin, assign to `backend-eng` (gated: research)
3. **Agent porting**: Convert agent definitions (gated: skill porting)
4. **Orchestrator creation**: Build master skill (gated: skill porting)
5. **Codebase memory**: Index + cross-repo (independent, can run in parallel with porting)
6. **MCP integration**: Build + register bridge (gated: skill porting)
7. **Stargate registry**: Add skills + agents + bundle to `StargateSkillRegistry.ts` (gated: skill porting)
8. **Operations board**: Create recurring operational templates (independent)

Always pass `board="<board-name>"` explicitly in every `kanban_create()` call.

## Phase 7: Mosaic-Companion Renderer Integration (Stargate Registry)

Add skills, agent profiles, and bundles to `src/services/StargateSkillRegistry.ts` so Mosaic agents can discover and dispatch them:

### Step 7a: Add skill entries to `skillCategories`

For each skill, add to the `skillCategories` map:
```typescript
'midnight-compact-core-basic-start': {
    name: 'Compact Basic Start',
    description: 'Write your first Compact smart contract and deploy to devnet',
    category: 'midnight',
    tags: ['compact', 'devnet', 'hello-world']
},
```

### Step 7b: Add agent profiles to `BUILTIN_AGENTS`

Add complete agent profiles with `id`, `name`, `role`, `skills`, `model`, `provider`, `status`, `rating`, `hourlyRate`.

### Step 7c: Add bundles to `BUNDLES`

Create `BundleConfig` entries grouping agents into purchasable teams.

### Verification
- `hermes skills list | grep midnight | wc -l` → matches expected count
- `grep "midnight" src/services/StargateSkillRegistry.ts | wc -l` → skills + agents + bundles present

## Verification Checklist

- [ ] All source skills appear in `hermes skills list`
- [ ] All frontmatter has `name`, `description`, `category`
- [ ] All references/examples/scripts copied intact
- [ ] Master orchestrator loads without errors (`/skill <name>`)
- [ ] Codebase-memory project shows `status: "ready"`
- [ ] MCP bridge server registers in Mosaic without path errors
- [ ] Kanban tasks created with proper `parents=[...]` dependencies
- [ ] End-to-end test: ask Hermes a domain question, verify it routes to correct skill

## Pitfalls

- **Missing `category:` in frontmatter**: Skills won't show up in filtered lists
- **Plugin-scoped names**: Claude Code uses `plugin:skill` namespacing; Hermes uses flat prefixed names. Always rewrite.
- **Claude-specific slash commands**: Commands like `/plugin:command` need Hermes equivalents (load skill, use tool) or removal.
- **Board ambiguity**: `HERMES_KANBAN_BOARD` env var is unreliable. Pass `board="..."` explicitly.
- **MCP path resolution**: esbuild strips raw JS assets. Use absolute paths from `$HOME`.
- **Skill name collisions**: Two plugins may have skills with the same base name. Use `<prefix>-<skill>` consistently.
- **Script executability**: Scripts copied from source may assume Claude's environment. Test each with `bash -n` or `python -m py_compile`.
- **Cross-repo intelligence timing**: Run `cross-repo-intelligence` AFTER all target projects are fully indexed, or edges will be zero.
- **Hermes skills directory resolution**: Skills load from `~/.hermes/skills/<category>/` directly. Profile-specific directories like `~/.hermes/profiles/default/skills/` may not be consulted by the loader. Always install into the global skills directory unless the user explicitly configured profile-specific paths.
- **User preference: single-session integration**: This user's preferred workflow is complete end-to-end integration in a single session — inventory, conversion, indexing, MCP bridge, kanban tasks, and verification all done before stopping. Decompose into child kanban tasks only for future parallel dispatch, not for session continuation.
- **execute_code as fallback**: When the helper scripts in this skill aren't on PATH or the user hasn't activated the skill, use `execute_code` with inline Python to perform bulk operations. This is more reliable than assuming script availability.
- **MCP bridge path resolution in esbuild**: When creating MCP bridge servers for Mosaic-Companion, always use absolute paths from `$HOME` in the `ensureDefaultPlugins()` registration, never relative paths. esbuild bundles TypeScript but does not copy raw `.js` assets to `dist/`.
- **Preload bridge method availability**: Check `preload.ts` before assuming the renderer has full MCP tool access. The bridge may only expose `listServers()` and `connect()`, not `callTool()`. If so, the renderer-side agent code must use the `mcp:call-tool` IPC channel directly (via `window.electronAPI.mcpAPI.callTool(...)` if exposed, or via the generic IPC bridge).
- **MCP handler signature mismatch**: The `mcp:call-tool` handler in Mosaic's `main.ts` wraps `mcpClient.callTool(toolName, args)` (NOT `callTool(serverName, toolName, args)`). If your ToolModule invokes `mcpClient.callTool(server, tool, args)`, verify the `MCPClient.callTool()` implementation accepts a `serverName` parameter and routes internally. If it does not, you must connect to the correct server first or use the server's direct `callTool()` method.

## Related Skills

- `kanban-orchestrator` — multi-agent decomposition and routing
- `kanban-project-init` — board setup and profile verification
- `codebase-memory-mcp` — indexing and querying code knowledge graphs
- `native-mcp` — MCP server configuration in Hermes
- `hermes-agent` — Hermes CLI and configuration reference
