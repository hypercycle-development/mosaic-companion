# MosAIc Architecture Documentation

> Consolidated reference for the MosAIc security and tool execution architecture.
> Based on the Phase 1 Requirements Alignment, Docker Proposal, and engineering discussions.

## Documents

| File                                                   | Contents                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [overview.md](./overview.md)                           | Core vs Sandbox architecture, trust model, key invariants                         |
| [glossary.md](./glossary.md)                           | All architectural terms and concepts                                              |
| [tool-lifecycle.md](./tool-lifecycle.md)               | How tools are built, distributed, installed, and executed                         |
| [gatekeeper.md](./gatekeeper.md)                       | Outbound traffic filtering, proxy/DNS design, domain allowlists                   |
| [data-model.md](./data-model.md)                       | Chronicle (append-only output), Vault (structured data), reference vs dereference |
| [permissions.md](./permissions.md)                     | Permission model, profiles, escalation, future-compatible seams                   |
| [implementation-status.md](./implementation-status.md) | What's built today vs what's planned, open questions                              |

## Key Decisions (as of 2026-03-04)

- **Docker is acceptable for Phase 1** but must NOT become a hard requirement long-term
- **Outbound gatekeeper is required** — Docker network controls alone are not sufficient
- **Tools are read-only** on shared data; writes go only to append-only **Chronicle**
- **Data access logging** is best-effort at Core dereference boundary (not syscall-level in v1)
- **Paid tool registry is deferred** — payments focus on HyperCycle remote services (USDC on Base + TODA TDN)
- **Internet filtering** for tools: domain allowlist in manifest, enforced via proxy or DNS (research ongoing)
- **NLP/content filtering** better suited for agent guardrails, not tool-level enforcement
