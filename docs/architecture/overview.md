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

## Docker Dependency — What "Not a Hard Requirement" Actually Means

> ⚠️ **Be honest about this:** Docker IS a hard runtime dependency for v1. Users must have Docker installed. There is no way around it right now.

**What the team means by "Docker must not become a hard requirement"** is about **code architecture**, not the current reality:

> Don't write code that ONLY works with Docker. Keep Docker-specific logic in one place (the Launcher), so everything else — manifest parsing, permission checks, logging, Chronicle, UI — doesn't know Docker exists.

### What depends on Docker (v1)

| Concept                | Docker provides it                              | Could WASM replace it?                                 |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Tool isolation         | Docker container (Linux namespaces, cgroups)    | WASM sandbox (no system calls by default)              |
| Network isolation      | Docker `--internal` network (no internet route) | WASM has no network access at all                      |
| Gatekeeper enforcement | HTTP proxy as only exit on Docker network       | Host functions — tool calls YOUR code to make requests |
| Filesystem isolation   | `--read-only`, no host mounts                   | WASM has no filesystem access                          |
| Resource limits        | `--cpus`, `--memory`                            | WASM fuel/memory limits                                |
| Cross-platform         | Docker Desktop runs a Linux VM on macOS/Windows | WASM runs natively in Node.js, zero dependencies       |

### What does NOT depend on Docker (keep it that way)

- Manifest format and parsing
- Permission model and user approval flow
- Chronicle (append-only logging)
- Vault / Data Bridge
- Tool Registry and ToolModule interface
- Gatekeeper **policy logic** (which domains are allowed, PII rules)
- Logging format and storage
- UI components (tool cards, permission modal, Chronicle viewer)

### The Launcher abstraction — this is the key

All Docker-specific code lives behind ONE interface:

```typescript
interface ToolLauncher {
  launch(manifest: ToolManifest): Promise<RunningTool>;
  stop(toolId: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// v1: uses Docker
class DockerLauncher implements ToolLauncher { ... }

// future: uses WASM (Extism), no Docker needed
class WasmLauncher implements ToolLauncher { ... }
```

**Everything else in Core calls `launcher.launch()` — it never calls Docker directly.** When WASM is ready, you swap `DockerLauncher` for `WasmLauncher` and nothing else changes.

### How the Gatekeeper changes between Docker and WASM

**Docker (v1):** The Gatekeeper is a **network-level proxy**. Tool containers sit on an isolated Docker network with no internet. The proxy is the only exit. Domain filtering happens at the proxy.

**WASM (future):** The Gatekeeper is a **code-level function**. WASM modules have ZERO network access by default. To make an HTTP request, the tool must call a host function YOU provide:

```typescript
// This IS the gatekeeper — no proxy, no network, just code
function httpRequest(domain: string, path: string, body: string) {
  if (!manifest.allowed_domains.includes(domain)) {
    log({ tool: toolId, domain, action: "DENY" });
    throw new Error("Domain not allowed");
  }
  log({ tool: toolId, domain, action: "ALLOW" });
  return await fetch(`https://${domain}${path}`, { body });
}
```

The gatekeeper CONCEPT stays the same. The implementation changes completely.

### Summary

| Question                                       | Answer                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Is Docker required for v1?                     | **Yes.** Users must install Docker.                                      |
| Can we ship without Docker?                    | **No.** Not in Phase 1.                                                  |
| Is that okay?                                  | **Yes.** Team agreed. Ship fast, iterate.                                |
| What does "not a hard requirement" mean?       | Keep Docker code in the Launcher, not everywhere.                        |
| When we move to WASM, do we still need Docker? | **No.** WASM runs in Node.js natively.                                   |
| How much work to swap?                         | New `WasmLauncher` + new Gatekeeper implementation. Rest stays the same. |

> **Why Docker for now?** "The entire team is really familiar with it. That will enable us to move forward more quickly." — Robert (Mar 03)

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
