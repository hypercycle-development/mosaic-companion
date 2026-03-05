# MosAIc Architecture Documentation

> Consolidated reference for the MosAIc security and tool execution architecture.
> Based on the Phase 1 Requirements Alignment, Docker Proposal, engineering meetings (Mar 03-04), and Linear tickets.
> Last updated: 2026-03-05

## Documents

| File                                                       | Contents                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| [overview.md](./overview.md)                               | Core vs Sandbox architecture, trust model, tools vs agents, wallet model   |
| [glossary.md](./glossary.md)                               | All architectural terms and concepts                                       |
| [execution-plan.md](./execution-plan.md)                   | Ordered Phase 1 implementation sequence with deliverables                  |
| [container-communication.md](./container-communication.md) | How MosAIc talks to containers (HTTP + access key protocol)                |
| [tool-lifecycle.md](./tool-lifecycle.md)                   | How tools are built, distributed, installed, and executed                  |
| [gatekeeper.md](./gatekeeper.md)                           | Outbound traffic filtering, proxy/DNS design, domain allowlists            |
| [data-model.md](./data-model.md)                           | Chronicle (append-only output), Vault, wallet, reference vs dereference    |
| [permissions.md](./permissions.md)                         | Permission model, profiles, no-runtime-escalation, future-compatible seams |
| [implementation-status.md](./implementation-status.md)     | What's built vs planned, Linear tickets, open questions                    |
| [victors-tickets.md](./victors-tickets.md)                 | Victor's guide for assigned Linear tickets (HYP-652/660/664/663)           |     |

## Key Decisions (as of 2026-03-05)

### Architecture

- **Core (trusted) vs Sandbox (untrusted)** — fundamental split
- **Containers are NOT the security boundary** — Core enforcement is
- **Docker for Phase 1**, but must NOT become a hard requirement (use OCI standard)
- **Container Launcher abstraction** — enables swapping Docker for WASM/microVMs later

### Communication

- **HTTP + access key** — containers expose HTTP server, MosAIc sends `/init?key=<uuid>`
- **No HTTPS needed** — all communication is localhost
- **No exposed ports** — Docker bridge network + access key prevents external access

### Security

- **Outbound gatekeeper required** — Docker network controls alone are NOT sufficient
- **Domain allowlist** in manifest — hard filtering for tools (Barry's recommendation)
- **NLP/content filtering** better suited for agent guardrails, not tools
- **DNS proxy + IP filtering** — leading approach for HTTPS domain enforcement

### Data

- **Tools are read-only** on shared data; writes ONLY to append-only **Chronicle**
- **Pre-materialization** — Core copies data into container's `/inputs:ro`
- **Data access logging** best-effort at Core boundary (not syscall-level in v1)

### Payments & Wallet

- **MosAIc creates wallets** — no import (users fund only what they're willing to lose)
- **Paid tool registry deferred** — focus on HyperCycle remote services (USDC on Base + TODA TDN)
- **Agent wallets** — future, agents can have own wallets inside containers

### Permissions

- **No runtime permission escalation** — must be declared in manifest
- **User approval required** before any tool installation
- **Warning escalation** — more permissions → more aggressive warnings

## Source Documents

| Document                                     | Date     | Type                               |
| -------------------------------------------- | -------- | ---------------------------------- |
| Phase 1 Docker Proposal (Jhonatan)           | Feb 2026 | Original containerization proposal |
| Requirements Alignment Notes (Robert)        | Mar 2026 | CXO + engineering alignment        |
| Phase 1 Execution Plan (Jhonatan + Robert)   | Mar 03   | Linear issue planning doc          |
| Mar 03 Daily standup                         | Mar 03   | Team updates, wallet decisions     |
| Mar 03 Architecture sync (Jhonatan + Robert) | Mar 03   | Deep technical discussion          |
| Mar 04 Daily standup                         | Mar 04   | Barry's proxy/DNS recommendation   |

## Team

| Person   | Role in this effort                                                 |
| -------- | ------------------------------------------------------------------- |
| Jhonatan | Lead — containerization, gatekeeper, execution plan                 |
| Robert   | Architecture — requirements alignment, data model, Chronicle vision |
| Barry    | Security advisor — proxy/DNS approach, networking hardening         |
| David    | Multi-user chat, container isolation research                       |
| Joaquin  | Wallet component                                                    |
| Victor   | Vault system (already implemented)                                  |
| Nasir    | Tool development, tutorials, dependency installation                |
| Dann     | Management — pushing for Mosaic releases, marketing                 |
