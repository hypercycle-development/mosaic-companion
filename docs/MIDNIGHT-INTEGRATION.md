# Midnight Integration Developer Guide

How Midnight blockchain capabilities are wired into Mosaic-Companion.

---

## Architecture Overview

Three layers provide Midnight support inside Mosaic:

| Layer | Component | Purpose |
|---|---|---|
| 1 | **MCP Plugin** (`electron/integrations/mcp/index.ts`) | Auto-registers `midnight-mcp` as a default MCP server, persisted via `MCPPluginManager`. Stdio transport. |
| 2 | **ToolRegistry Bridge** (`electron/integrations/tools/modules/midnight.ts`) | 14 native Mosaic tools that proxy calls to the MCP server. Exposed to the AI system prompt. |
| 3 | **System Prompt** (`MidnightModule.getSystemPrompt()`) | Injects Compact language concepts, SDK architecture, and usage guidelines into the LLM context. |

---

## File Changes

### 1. MCP Auto-Registration

**File:** `electron/integrations/mcp/index.ts`

`ensureDefaultPlugins()` is called at app startup. It checks if a plugin named `midnight-mcp` exists; if not, it adds one:

```ts
pluginManager.add({
  name: "midnight-mcp",
  description: "Midnight blockchain MCP server (Compact language, ZK contracts, private compute)",
  transport: "stdio",
  command: "npx",
  args: ["-y", "midnight-mcp@latest"],
  autoConnect: true,
});
```

This means **users do not need to add the server manually**. It appears in the MCP Servers panel automatically and is persisted to `mcp-plugins.json`.

### 2. Tool Module

**File:** `electron/integrations/tools/modules/midnight.ts`

Implements `ToolModule` interface (same as `Web3Module`, `GmailModule`).

**14 exposed tools:**

Category | Tool | MCP Mapping | Description
---|---|---|---|
Generation | `midnight_generate_contract` | `midnight-generate-contract` | Generate Compact from NL requirements |
Generation | `midnight_compile_contract` | `midnight-compile-contract` | Compile Compact → JS/TS + ZKIR |
Generation | `midnight_review_contract` | `midnight-review-contract` | AI security review |
Analysis | `midnight_analyze_contract` | `midnight-analyze-contract` | Static structure analysis |
Analysis | `midnight_explain_circuit` | `midnight-explain-circuit` | Explain ZK circuit logic |
Search | `midnight_search_compact` | `midnight-search-compact` | Compact language patterns |
Search | `midnight_search_docs` | `midnight-search-docs` | Documentation search |
Search | `midnight_search_typescript` | `midnight-search-typescript` | SDK type definitions |
Repository | `midnight_list_examples` | `midnight-list-examples` | Example contracts |
Repository | `midnight_get_latest_updates` | `midnight-get-latest-updates` | Latest repo changes |
Discovery | `midnight_list_tool_categories` | `midnight-list-tool-categories` | Browse all MCP categories |
Discovery | `midnight_suggest_tool` | `midnight-suggest-tool` | Intent → tool recommendation |
Health | `midnight_health_check` | `midnight-health-check` | Server health |
Health | `midnight_get_status` | `midnight-get-status` | Version + capabilities |

**28 total tools available** from the MCP server; we surface the 14 most useful for AI-driven contract development workflows.

### 3. Registration

**File:** `electron/integrations/tools/index.ts`

```ts
import { MidnightModule } from "./modules/midnight";
// ...
registry.register(new MidnightModule());
```

This makes `midnight:` tools available to the AI (e.g. `<use_tool server="midnight" tool="midnight_generate_contract">...`).

---

## MCP Server Details

- **Package:** `midnight-mcp@latest` (tested: v0.2.18)
- **Author:** Idris Olubisi (Olanetsoft)
- **License:** MIT
- **Transport:** stdio (via `npx -y midnight-mcp@latest`)
- **Fallback:** If the local server fails, tools gracefully return unavailable
- **ChromaDB note:** The server emits a warning about tenant connection on startup, but falls back to in-memory vector store and continues to function.

---

## AI System Prompt

When the AI generates a system prompt for tool invocation, `MidnightModule.getSystemPrompt()` produces:

- Core Midnight concepts (ledger, witness, circuit, NIGHT/DUST)
- Compact language fundamentals
- Midday SDK architecture (9 namespaces, 3 API tiers)
- Available tools categorized by workflow
- Usage guidelines (when to call which tool)
- **Connection status**: `[Midnight MCP: CONNECTED]` or offline instructions

The system prompt follows the **same strict rules** as all other Mosaic tool modules (see `ToolRegistry.getSystemPrompt()`):
1. One sentence max before tool calls
2. No hallucinated data before tool output
3. Concise responses using only tool data
4. No repetition of tool output

---

## Testing

Manual test of the MCP server directly:

```bash
# 1. Verify server installs
npm install -g midnight-mcp@latest

# 2. Test stdio protocol
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | midnight-mcp

# 3. List tools
cat <<'JSON' | midnight-mcp
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
JSON
```

Expected: 28 tools returned, server responds with `protocolVersion: 2024-11-05`, `name: midnight-mcp`.

---

## Extending (Adding More Tools)

To expose additional MCP tools in the native bridge:

1. Find the tool name from `midnight-mcp` (e.g. `midnight-get-migration-guide`).
2. Add a `ToolDefinition` to `midnightTools[]` in `midnight.ts`.
3. Map the tool name via `callMidnightTool("midnight-get-migration-guide", args)`.
4. Rebuild (`npm run build:electron`) or restart the app.

Example:

```ts
{
  name: "midnight_get_migration_guide",
  description: "Get migration guide between Midnight versions.",
  inputSchema: {
    type: "object",
    properties: {
      repo: { type: "string" },
      fromVersion: { type: "string" },
    },
    required: ["repo", "fromVersion"],
  },
  handler: async (args) => callMidnightTool("midnight-get-migration-guide", args),
}
```

---

## Troubleshooting

### "Midnight MCP server is not connected"
- Check `npm i -g midnight-mcp@latest` is installed.
- Check Node.js ≥ 20.
- In the MCP Servers panel in Mosaic, verify `midnight-mcp` appears and click **Connect**.
- Check the terminal logs: `[MCP] Auto-connect failed for plugin "midnight-mcp": ...`

### Tools timeout or fail
- `midnight-generate-contract` requires **MCP sampling capability** (Claude Desktop / Cursor). If unavailable, it returns gracefully.
- Compound tools (`midnight-upgrade-check`, `midnight-get-repo-context`) may take 10-30s. They are long-running.
- ChromaDB warnings are harmless — the server falls back to in-memory search.

### TypeScript errors
- The 2 pre-existing errors in `AgentForgePanel.tsx` (type mismatch on `AgentForgeSession`) are **unrelated** to Midnight integration.
- `midnight.ts` itself type-checks cleanly against the `ToolModule` interface.

---

## Security & Privacy

- **No private keys are stored** in the Midnight module. Contract development is done via MCP tool calls with no wallet integration.
- **WASM compilation** is handled client-side by the MCP server; no code leaves the local machine unless the AI explicitly requests an external resource.
- **Selective disclosure** in Compact is a Midnight blockchain feature, not a Mosaic feature. The AI can explain it but does not control it.

---

## Related Docs

- `~/Cardano/midnight-research/MIDNIGHT-FUNDAMENTALS.md` — Core Midnight blockchain research
- `~/Cardano/midnight-research/MIDNIGHT-MCP-ANALYSIS.md` — Full MCP server deep dive
- `~/Cardano/midnight-research/MIDNIGHT-HYPERCYCLE-MOSAIC-2PAGER.md` — Business opportunities
