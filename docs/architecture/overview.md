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
│  │  └──────────────────────────────────────┘           │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Key Invariant

> **Tool execution is always low-trust.** Tools do not gain trust because they run in containers managed by Mosaic.

Even if we wrote a tool ourselves, once it's in the Sandbox zone it gets the same restrictions as any third-party tool. Trust is architectural, not reputational.

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

## What the Sandbox Runs

The Sandbox is the untrusted execution zone:

- **Tool containers** — Docker containers (Phase 1) or WASM modules (future)
- **Agents** — AI agents and their dynamic/evolving code
- **MCP servers** — Third-party Model Context Protocol servers

Everything in the Sandbox:

- Has **no implicit access** to Core resources
- Must go through **boundary crossings** to reach anything outside
- Writes only to its own **append-only Chronicle**
- Reads shared data only through **Core-mediated Data Bridges** (read-only)

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

- One container per tool ✅
- Multiple tools in one container ✅
- WASM modules in-process ✅
- Child processes ✅

**Requirement:** Core mediation + policy + logging semantics must hold **regardless of topology.** The security model is not tied to Docker or any specific runtime.

## Docker Stance

| Statement                                          | Status                          |
| -------------------------------------------------- | ------------------------------- |
| Docker is fine for Phase 1                         | ✅ Accepted                     |
| Docker must NOT become a hard requirement          | ✅ Firm requirement             |
| Policy/logging/gatekeeper must work without Docker | ✅ Must be runtime-agnostic     |
| Docker-in-Docker                                   | ❌ Excluded                     |
| Docker socket mounting (permissive in v1)          | ⚠️ Accepted with hardening path |

If later MosAIc uses microVMs, WASM, or another sandbox technology, the Core concepts (policy, logging, gatekeeper) must still work unchanged.
