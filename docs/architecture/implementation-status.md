# Implementation Status

What's built today, what's planned for Phase 1, and what's still open.

> Last updated: 2026-03-05

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

### Multi-user Chat (In Progress — David)

| Component        | Status             | Details                                  |
| ---------------- | ------------------ | ---------------------------------------- |
| Chat server      | ✅ Working locally | Tested locally, needs AWS deployment     |
| Multi-user rooms | 🔲 In progress     | Multiple people + AI agents in same chat |

---

## Phase 1 — Linear Tickets

### HYP-652: Initial Sandbox / Vault Architecture 🔲

| Component                      | Status         | Priority  | Notes                                     |
| ------------------------------ | -------------- | --------- | ----------------------------------------- |
| Trust boundary definition      | 🔲 Not started | **First** | Docs + code structure                     |
| Container Launcher abstraction | 🔲 Not started | High      | `launcher.ts` → `DockerLauncher`          |
| Docker runtime implementation  | 🔲 Not started | High      | Uses `dockerode` npm package              |
| `/init?key=<key>` protocol     | 🔲 Not started | High      | Access key per container                  |
| Container security hardening   | 🔲 Not started | High      | `--cap-drop ALL`, `--read-only`, non-root |
| Container → ToolModule adapter | 🔲 Not started | High      | Containerized tools appear as ToolModules |
| Docker availability detection  | 🔲 Not started | Medium    | Detect + warn if Docker missing           |

### HYP-660: Implement Gatekeeper 🔲

| Component                    | Status         | Priority | Notes                            |
| ---------------------------- | -------------- | -------- | -------------------------------- |
| Gatekeeper module            | 🔲 Not started | High     | Proxy-as-only-exit pattern       |
| Domain allowlist filter      | 🔲 Not started | High     | Manifest-declared domains        |
| HTTP/HTTPS proxy             | 🔲 Research    | High     | CONNECT method for HTTPS domains |
| PII baseline filter          | 🔲 Not started | Medium   | Regex (emails, phones, SSNs)     |
| Docker network configuration | 🔲 Not started | Medium   | `mosaic-internal` (no internet)  |
| Request logging (JSONL)      | 🔲 Not started | Medium   | All gatekeeper decisions logged  |

### HYP-664: Debug Output / Chronicle 🔲

| Component                          | Status         | Priority | Notes                        |
| ---------------------------------- | -------------- | -------- | ---------------------------- |
| Chronicle module                   | 🔲 Not started | High     | Append-only JSONL per tool   |
| Chronicle HTTP API                 | 🔲 Not started | High     | `/chronicle/append` endpoint |
| Gatekeeper → Chronicle integration | 🔲 Not started | Medium   | Audit entries auto-written   |
| Chronicle viewer UI                | 🔲 Not started | Low      | Browse tool activity history |

### HYP-663: Tool Download UI 🔲

| Component                  | Status         | Priority | Notes                           |
| -------------------------- | -------------- | -------- | ------------------------------- |
| Tool Registry page         | 🔲 Not started | High     | Browse available tools          |
| Permission approval modal  | 🔲 Not started | High     | Review + approve before install |
| Image pull with progress   | 🔲 Not started | Medium   | Show download progress          |
| Installed tools management | 🔲 Not started | Medium   | Start/stop/uninstall            |
| Debug log file             | 🔲 Not started | Medium   | All install actions logged      |

### Other In-Progress Work (Team)

| Component                      | Owner    | Status         | Notes                                        |
| ------------------------------ | -------- | -------------- | -------------------------------------------- |
| Wallet component (create only) | Joaquin  | ⏳ Almost done | Isolated payment component ready today       |
| Multi-user chat                | David    | 🔲 In progress | AWS deployment pending (David driving today) |
| Gatekeeper proof of concepts   | Jhonatan | 🔲 In progress | Building PoCs for networking approach        |
| Data organization proposal     | Robert   | ⏳ Almost done | Initial proposal nearly finished             |
| WhatsApp agent integration     | Nasir    | 🔲 In progress | Flow mapping, demo expected tomorrow         |
| CB&O versioning                | Team     | ✅ Decided     | Let them build separately, integrate later   |

---

## Execution Sequence

See [execution-plan.md](./execution-plan.md) for the full ordered plan. Summary:

```
1. Trust boundary (HYP-652)
2. Tool execution contract (HYP-652)
3. Container launch layer (HYP-652)
4. Outbound gatekeeper (HYP-660)
5. Outbound profiles (HYP-660)
6. Append-only Chronicle (HYP-664)
7. Data bridge (deferred to v2)
8. Logging model (spans multiple tickets)
9. Tool download UI (HYP-663)
```

---

## Vault Next Steps 🔲

| Feature                 | Status       | Notes                             |
| ----------------------- | ------------ | --------------------------------- |
| Entry editing UI        | 🔲 Quick win | Backend exists, needs edit button |
| File import (.txt, .md) | 🔲 Next      | Drag-and-drop into boxes          |
| Search & filtering      | 🔲 Planned   | Client-side entry filtering       |
| Access logging          | 🔲 Planned   | Log when agents read vault data   |
| Connectors (IMAP, RSS)  | 🔲 Future    | Auto-ingest from external sources |

**Docs:** [vault-next.plan.md](../../vault-next.plan.md)

---

## Open Engineering Questions

### Architecture

1. **Cross-platform Docker** — Docker Desktop required on macOS/Windows. Can MosAIc auto-install it? Team has experience with installing dependencies (Nasir).
2. **Container communication** — HTTP + access key is the plan. Need to verify this works cleanly with Docker bridge networking.
3. **OCI compatibility** — Ensure images work with other OCI runtimes (Podman, containerd) for future Docker replacement.

### Gatekeeper

4. **Proxy library choice** — Which Node.js proxy library? `http-proxy`, `node-http-proxy`, custom?
5. **HTTP_PROXY support** — How well do popular libraries (requests, axios, fetch) work with container-level proxy config? (Needs testing)
6. **PII baseline rules** — What patterns to include in v1? Need a concrete list.
7. **WebSocket support** — Can the proxy handle WebSocket connections?

### Data Model

7. **Chronicle format** — JSONL chosen for v1. Is SQLite better for querying?
8. **Chronicle ↔ Vault boundary** — When does a tool output become a vault entry?
9. **Pre-materialization UX** — How does the user select which files to copy into a container?

### Security

10. **Docker CVE monitoring** — How to stay on top of Docker vulnerabilities?
11. **Ironclaw / Gramine** — Robert mentioned these as hardening options. Worth researching?
12. **WASM migration timeline** — When to start building the `WasmLauncher`?

---

## Marketing / Demo Needs

Dan requested 3-4 short Mosaic demo videos (1-5 min each) showing different features. Team agreed to produce these. Drop in the marketing-engineering channel.

Nasir's WhatsApp agent integration is a strong demo candidate (Mar 05 daily). Lucas also has 2 demo videos — Robert sharing in engineering chat.

## Team Updates (Mar 05 daily)

- ✅ **Everyone got paid** — funding resolved (Barry facilitated)
- Jhonatan building Gatekeeper proof of concepts — Barry will review security-sensitive code
- Joaquin: isolated payment component ready today
- Robert: initial data organization proposal nearly finished → will share with Dan + Barry
- Barry + Robert + Victor: CB&O team should build separately, we integrate later when plugin API is defined
- Victor (HyperInsight precedent): Lucas's work was added as separate part with different release
