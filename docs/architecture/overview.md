# Architecture Overview

## Trust Model

MosAIc splits into two zones with fundamentally different trust levels:

```
┌──────────────────────────────────────────────────────────┐
│                     HOST OS / Machine                     │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   CORE (Trusted)                     │ │
│  │                                                     │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐│ │
│  │  │  Policy  │ │  User    │ │ Secrets │ │ Logging/ ││ │
│  │  │  Control │ │  Approvals│ │ Mgmt   │ │ Audit    ││ │
│  │  └─────────┘ └──────────┘ └─────────┘ └──────────┘│ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐│ │
│  │  │   Storage    │ │  Boundary    │ │  Gatekeeper  ││ │
│  │  │ Coordination │ │  Enforcement │ │  (Outbound)  ││ │
│  │  └─────────────┘ └──────────────┘ └──────────────┘│ │
│  │  ┌──────────────┐ ┌──────────────┐                │ │
│  │  │   Wallet     │ │  Container   │                │ │
│  │  │  (user-only) │ │  Launcher    │                │ │
│  │  └──────────────┘ └──────────────┘                │ │
│  └─────────────────────────┬───────────────────────────┘ │
│                            │ Boundary (Core-mediated)     │
│  ┌─────────────────────────┴───────────────────────────┐ │
│  │                  SANDBOX (Untrusted)                  │ │
│  │                                                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │ │
│  │  │  Tool 1  │  │  Tool 2  │  │  Tool N  │          │ │
│  │  │(container│  │(container│  │(container│          │ │
│  │  │ or WASM) │  │ or WASM) │  │ or WASM) │          │ │
│  │  └──────────┘  └──────────┘  └──────────┘          │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────┐           │ │
│  │  │  Agents (dynamic/evolving code)      │           │ │
│  │  │  (can have their own wallets)        │           │ │
│  │  └──────────────────────────────────────┘           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Key Invariant

> **Tool execution is always low-trust.** Tools do not gain trust because they run in containers managed by Mosaic.

Even if we wrote a tool ourselves, once it's in the Sandbox zone it gets the same restrictions as any third-party tool. Trust is architectural, not reputational.

**Containers are NOT the security boundary.** Core enforcement is. The container is just the execution environment — the real security comes from Core-mediated boundary crossings.

## What Core Owns

Core is the trusted half of MosAIc. It is responsible for:

| Responsibility           | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| **Policy control**       | Decides what tools can and cannot do                            |
| **User approvals**       | Pre-install permission prompts, re-approval on escalation       |
| **Secrets management**   | API keys, wallet keys — never exposed to tools                  |
| **Logging / Audit**      | Records all boundary crossings for debugging and security       |
| **Storage coordination** | Manages Vault, Chronicle, and data references                   |
| **Boundary enforcement** | Mediates every crossing between Sandbox and trusted/external    |
| **Gatekeeper**           | Filters outbound traffic (see [gatekeeper.md](./gatekeeper.md)) |
| **Wallet**               | User wallet — MosAIc creates it, user funds it (no import)      |
| **Container Launcher**   | Abstraction over runtime (Docker now, WASM later)               |

## What the Sandbox Runs

The Sandbox is the untrusted execution zone:

- **Tool containers** — Docker containers (Phase 1) or WASM modules (future)
- **Agents** — AI agents and their dynamic/evolving code (future — same container infra)
- **MCP servers** — Third-party Model Context Protocol servers
- **Dynamic UI code** — Future: agents could evolve the MosAIc UI from within containers

Everything in the Sandbox:

- Has **no implicit access** to Core resources
- Must go through **boundary crossings** to reach anything outside
- Writes only to its own **append-only Chronicle**
- Reads shared data only through **Core-mediated Data Bridges** (read-only)
- Communicates with Core via **HTTP + access key** protocol (see [container-communication.md](./container-communication.md))

## Tools vs Agents

From the March 03 meeting with Robert:

| Aspect         | Tools                             | Agents                               |
| -------------- | --------------------------------- | ------------------------------------ |
| Complexity     | Single function calls             | Semi/fully autonomous                |
| Lifespan       | Per-call (start → execute → stop) | Long-running                         |
| Internal state | Stateless or minimal              | May maintain state, run LLMs         |
| Wallet         | None                              | May have own wallet (funded by user) |
| Chronicle      | Activity log + output             | Richer behavioral data               |
| Phase          | Phase 1 (now)                     | Future (same container infra)        |

> "Tools is step 1. Agents in containers is a natural extension." — The container infrastructure built for tools will also serve agents.

## Boundary Crossings

A boundary crossing is any flow between the Sandbox and something trusted or external:

- Reading Core-managed data (Vault boxes, configs)
- Writing outputs to persistent storage (Chronicle)
- Accessing the internet (through Gatekeeper)
- Invoking host actions (wallet transactions, file operations)
- Exporting data (clipboard, downloads)

**Every boundary crossing must be:**

1. **Explicit** — no implicit access paths
2. **Core-mediated** — Core controls the crossing
3. **Logged** — recorded in audit trail

## Topology Flexibility

The architecture does not mandate a specific topology:

- One container per tool ✅ (preferred baseline)
- Multiple tools in one container ✅
- WASM modules in-process ✅ (future)
- Child processes ✅ (current MCP model)

**Requirement:** Core mediation + policy + logging semantics must hold **regardless of topology.** The security model is not tied to Docker or any specific runtime.

## Docker Stance

| Statement                                          | Status                                      |
| -------------------------------------------------- | ------------------------------------------- |
| Docker is fine for Phase 1                         | ✅ Accepted                                 |
| Docker must NOT become a hard requirement          | ✅ Firm requirement                         |
| Policy/logging/gatekeeper must work without Docker | ✅ Must be runtime-agnostic                 |
| Use OCI-standard images                            | ✅ Any OCI runtime could replace Docker     |
| Docker-in-Docker                                   | ❌ Excluded                                 |
| Docker socket mounting (permissive in v1)          | ⚠️ Accepted with hardening path             |
| MosAIc can install Docker on the host              | ✅ Accepted (team has experience with this) |

> **Why Docker for now?** "The entire team is really familiar with it. That will enable us to move forward more quickly." — Robert (Mar 03)

If later MosAIc uses microVMs, WASM, or another sandbox technology, the Core concepts (policy, logging, gatekeeper) must still work unchanged. The Container Launcher is an abstraction layer that enables this swap.

## Wallet Model

From the March 03 daily and Robert meeting:

- **MosAIc creates wallets** — users do NOT import existing wallets
- Users should only put in what they're willing to lose
- MosAIc wallet is Core-controlled (trusted)
- **Agents can have their own wallets** inside containers (future)
  - User transfers from MosAIc wallet to agent wallet
  - Agent has full control of its allocated funds
- Payment rails: **USDC on Base** + **TODA TDN**
- Paid tool registry is **deferred** — payments focus on HyperCycle remote services

## Data Filtering — Two Boundaries

From Robert's discussion (Mar 03 meeting):

There are potentially **two places** where content filtering is needed:

1. **Outbound Gatekeeper** — filters what tools/agents send to the internet
2. **Data ingestion** — filters what data is loaded INTO MosAIc/chats from external sources

Example: If email data is loaded into a chat and then sent to OpenAI, PII could leak. The data ingestion side would scrub sensitive data before it enters the chat, so whatever's in the chat is "fair game" to send to LLM providers.

> v1 focuses on the Gatekeeper. Data ingestion filtering is acknowledged but not Phase 1 priority.

## Terminal / OS Access

From David's concern (Mar 03 meeting):

> "The main thing we need to protect is agents getting access to the terminal of the OS."

**Mitigation:** Docker namespaces and cgroups provide kernel-level isolation (same technology AWS uses). A containerized process cannot access the host terminal. Additional measures:

- Detect if Docker runs as root → warn user
- Keep Docker and images updated (vulnerabilities are published annually)
- No `--privileged` flag on containers
- Monitor Docker CVEs regularly

## Security Research References

From Robert (Mar 03 meeting):

- **Ironclaw** — Uses WASM for isolation (worth investigating)
- **Gramine** — Takes Dockerfiles and produces images with additional security guarantees ("graminized" images)
- **TEEs (Trusted Execution Environments)** — Gramine facilitates running in TEEs
- These are future hardening options, not v1 requirements
