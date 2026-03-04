# Implementation Status

What's built today, what's planned for Phase 1, and what's still open.

> Last updated: 2026-03-04

---

## Already Implemented (in MosAIc Electron App)

### Vault System ✅

Full implementation of a Data Bridge for structured user data.

| Component               | Status  | Details                                                    |
| ----------------------- | ------- | ---------------------------------------------------------- |
| Box CRUD                | ✅ Done | Create, read, update, delete boxes                         |
| Entry CRUD              | ✅ Done | Add, read, update, delete entries within boxes             |
| Agent access control    | ✅ Done | `boxAccess[]` on agents, enforced at runtime               |
| Vault ToolModule        | ✅ Done | `vault:list_boxes`, `vault:read_box` exposed to agents     |
| ExecutionContext        | ✅ Done | `agentId` threaded through ToolRegistry → tool handlers    |
| Sandbox enforcement     | ✅ Done | `canAgentAccessBox()` in main process, agents can't bypass |
| VaultPage UI            | ✅ Done | Box management, agent access toggles, entry management     |
| Tool message collapsing | ✅ Done | Tool calls and outputs collapsed into expandable chips     |

**Docs:** [/docs/vault.md](../vault.md)

### ToolRegistry ✅

Modular tool system with IPC bridge.

| Component               | Status  | Details                                           |
| ----------------------- | ------- | ------------------------------------------------- |
| ToolModule interface    | ✅ Done | Standard interface for registering tools          |
| Built-in modules        | ✅ Done | Gmail (8 tools), Web3 (17 tools), Vault (2 tools) |
| MCP server support      | ✅ Done | Third-party MCP servers as child processes        |
| System prompt injection | ✅ Done | Tools describe themselves to AI agents            |
| ExecutionContext        | ✅ Done | Agent identity passed through execution pipeline  |

### AI Agent System ✅

Multi-agent chat with tool use.

| Component           | Status  | Details                                          |
| ------------------- | ------- | ------------------------------------------------ |
| Multi-agent support | ✅ Done | Multiple agents with different providers/models  |
| Chat history        | ✅ Done | Per-agent session persistence                    |
| Tool use loop       | ✅ Done | Recursive tool execution with agent context      |
| Provider support    | ✅ Done | Claude, OpenAI, Gemini, Ollama, custom endpoints |

---

## Phase 1 — Planned (Not Yet Implemented)

### Tool Containerization 🔲

| Component                    | Status         | Priority | Notes                                                  |
| ---------------------------- | -------------- | -------- | ------------------------------------------------------ |
| Docker container launcher    | 🔲 Not started | High     | Launch/stop/remove tool containers                     |
| Container hardening          | 🔲 Not started | High     | --cap-drop ALL, --read-only, non-root, resource limits |
| Tool manifest parser         | 🔲 Not started | High     | Parse and validate manifest.json                       |
| Permission approval UI       | 🔲 Not started | High     | Show permissions, require user approval                |
| Private registry integration | 🔲 Not started | Medium   | Authenticated image pulls                              |
| docker.sock management       | 🔲 Not started | Medium   | Mount and manage host Docker daemon                    |

### Outbound Gatekeeper 🔲

| Component                    | Status         | Priority | Notes                                  |
| ---------------------------- | -------------- | -------- | -------------------------------------- |
| DNS proxy/resolver           | 🔲 Research    | High     | Filter domains at DNS level            |
| IP filtering                 | 🔲 Research    | High     | Resolve allowed domains → filter by IP |
| Domain allowlist enforcement | 🔲 Not started | High     | Manifest-declared domains only         |
| PII baseline filter          | 🔲 Not started | Medium   | Regex + basic NER                      |
| Request logging              | 🔲 Not started | Medium   | All outbound requests logged           |
| HTTP proxy (optional)        | 🔲 Research    | Low      | For content-level filtering on HTTP    |

**Docs:** [gatekeeper.md](./gatekeeper.md)

### Chronicle 🔲

| Component              | Status         | Priority | Notes                              |
| ---------------------- | -------------- | -------- | ---------------------------------- |
| Append-only log format | 🔲 Not started | High     | JSONL per tool                     |
| Chronicle storage      | 🔲 Not started | High     | Core-managed, per-tool directories |
| Artifact storage       | 🔲 Not started | Medium   | Blobs with provenance labels       |
| Chronicle viewer UI    | 🔲 Not started | Low      | Browse tool activity history       |

### Payments (Deferred) 🔲

| Component                | Status            | Priority | Notes                       |
| ------------------------ | ----------------- | -------- | --------------------------- |
| Wallet integration       | 🔲 Separate track | —        | USDC on Base, TODA TDN      |
| HyperCycle node services | 🔲 Separate track | —        | Purchase remote AI services |
| Paid tool registry       | 🔲 Deferred       | —        | Not Phase 1 priority        |

---

## Vault Next Steps 🔲

| Feature                 | Status       | Notes                                   |
| ----------------------- | ------------ | --------------------------------------- |
| Entry editing UI        | 🔲 Quick win | Backend exists, needs edit button in UI |
| File import (.txt, .md) | 🔲 Next      | Drag-and-drop into boxes                |
| Search & filtering      | 🔲 Planned   | Client-side entry filtering             |
| Entry size limits       | 🔲 Quick win | Validate content length                 |
| Access logging          | 🔲 Planned   | Log when agents read vault data         |
| Connectors (IMAP, RSS)  | 🔲 Future    | Auto-ingest from external sources       |

**Docs:** [vault-next.plan.md](../../vault-next.plan.md)

---

## Open Engineering Questions

### Architecture

1. **Runtime technology decision** — Docker for Phase 1, but what's the migration path? WASM (Extism), Deno, or hardened child processes?
2. **Mosaic inside Docker?** — The original proposal puts MosAIc itself in Docker. This conflicts with Electron's native GUI. Clarify: only tools in containers, not MosAIc itself?
3. **Cross-platform Docker** — Docker Desktop required on macOS/Windows. What's the user installation experience? Is this acceptable friction?

### Gatekeeper

4. **HTTPS interception** — How to filter HTTPS traffic? DNS proxy + IP filtering is the leading approach, but can't inspect content.
5. **Proxy vs DNS vs both** — What combination works best in practice? Needs prototyping.
6. **PII baseline rules** — What patterns to include in v1? Need a concrete list.

### Data Model

7. **Chronicle format** — JSONL, SQLite, or content-addressed store?
8. **Chronicle ↔ Vault boundary** — When does a tool output become a vault entry?
9. **Pre-materialization vs on-demand** — When to copy data into tool's area vs letting it request on demand?

### Permissions

10. **Room-based access** — How does this map to the current agent model? Rooms ≈ chat sessions?
11. **Per-agent tool access** — Should agents declare which tools they can use?
12. **Runtime permission prompting** — Can a tool request permissions mid-execution?

---

## Cross-Platform Considerations

| Platform | Docker Support    | Notes                                                                       |
| -------- | ----------------- | --------------------------------------------------------------------------- |
| Linux    | ✅ Native Docker  | Best experience, native performance                                         |
| macOS    | ⚠️ Docker Desktop | Runs Linux VM under the hood, ~1GB install, license fees for commercial use |
| Windows  | ⚠️ Docker Desktop | Same as macOS — requires WSL2 backend                                       |

**Risk:** Requiring Docker Desktop on macOS/Windows is significant user friction. The architecture must leave a path to non-Docker runtimes (WASM, child processes).
