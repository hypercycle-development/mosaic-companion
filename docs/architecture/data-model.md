# Data Model

How data flows between Core and Sandbox. Covers the Chronicle (tool output), Vault (structured storage), wallet model, and the reference/dereference model.

---

## Overview

```
                  CORE (Trusted)
┌──────────────────────────────────────────┐
│                                          │
│   ┌────────┐  ┌───────┐  ┌───────────┐ │
│   │ Vault  │  │Configs│  │  Wallet   │ │
│   │ Boxes  │  │Secrets│  │(user-only)│ │
│   └───┬────┘  └───┬───┘  └───────────┘ │
│       │            │                     │
│   Data Bridge  Data Bridge               │
│   (read-only)  (read-only)               │
│       │            │                     │
├───────┼────────────┼─────────────────────┤
│       ↓            ↓     Boundary        │
│   ┌──────────────────────────────┐       │
│   │     SANDBOX (Untrusted)      │       │
│   │                              │       │
│   │  /inputs (ro) ← Core copies data in │
│   │                              │       │
│   │  Tool does work...           │       │
│   │                              │       │
│   │  Tool → Core API → Chronicle (append)│
│   │                              │       │
│   │  Tool → Gatekeeper → Internet│       │
│   └──────────────────────────────┘       │
│       │                                  │
│   Chronicle (append-only)                │
│   ──→ stored & managed by Core           │
└──────────────────────────────────────────┘
```

---

## Chronicle (Append-Only Tool Output)

### What It Is

A Chronicle is the **only place a tool can write data**. It is an append-only record of:

- Tool outputs (results returned to the agent/user)
- Artifacts produced (files, blobs, images)
- Activity logs
- Gatekeeper audit entries (added by Core automatically)

### Key Properties

| Property         | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| **Append-only**  | New records can be added. Existing records CANNOT be modified or deleted.   |
| **Per-tool**     | Each tool has its own Chronicle. No tool can see another tool's Chronicle.  |
| **Core-managed** | The Chronicle is stored and managed by Core, not by the tool.               |
| **Auditable**    | Supports debugging and security audits — full history of what the tool did. |

### Why Append-Only?

From Robert (Mar 03 meeting):

1. **Full audit trail** — you can always trace what happened
2. **Debugging** — reproduce issues by replaying the Chronicle
3. **Security audits** — verify what a tool accessed and what it sent out
4. **Data mining** — extract useful patterns from tool behavior (like Barry's example: a user visiting the same URL multiple times — you want to log each visit even if the page content didn't change)
5. **State reconstruction** (future) — kill a container and reconstruct it from its Chronicle, continuing from the last good state

### v1 Implementation

Tools write to their Chronicle via Core's API:

```
Tool Container → POST /chronicle/append (with access key) → Core → Chronicle file
```

Stored as JSONL (one JSON object per line) at:

```
~/.config/mosaic-companion/chronicles/<tool_id>/chronicle.jsonl
```

Entry format:

```json
{
  "id": "entry-1709654400000",
  "timestamp": "2026-03-05T10:00:00Z",
  "source": "tool",
  "type": "log",
  "data": { "action": "analyzed_text", "wordCount": 42 }
}
```

Sources: `"tool"` (from tool's API calls), `"gatekeeper"` (automatic audit), `"core"` (lifecycle events).

### v1 Enforcement

Enforcement is **structural** in v1:

- No update/delete API exists
- Tools write only via Core's append endpoint
- Core controls the write path

v2 hardening: content-addressed hashing, cryptographic chaining, tamper detection.

### Exception Handling

If a future use case requires relaxing append-only (e.g., a tool that maintains mutable state):

- Requires a specific use case justification — "do the dumb thing first, iterate" (Robert)
- Core grants write access using least-privilege model
- The mutable state is still logged (snapshot before/after)

### Internal Tool State (Future)

Robert mentioned the value of tools periodically dumping state data to the Chronicle. This enables:

- Killing a container and reconstructing from the last good state
- Both debugging and security perspectives benefit

Not required in v1 — "let's see how necessary this is."

---

## Vault (Structured User Data)

The Vault is already implemented in MosAIc. See [/docs/vault.md](../vault.md) for full documentation.

### How Vault Relates to the Architecture

| Concept                      | Vault Implementation                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Data Bridge**              | Vault ToolModule (`vault:list_boxes`, `vault:read_box`)                  |
| **Read-only access**         | ✅ Agents can only read, not write                                       |
| **Core-mediated**            | ✅ Access checks run in main process (`canAgentAccessBox()`)             |
| **Logged**                   | ⚠️ Not yet — access logging is a future addition                         |
| **Reference vs Dereference** | Partial — `list_boxes` returns references (IDs), `read_box` dereferences |

### Vault as Precedent

The Vault system is the **first implementation** of the Data Bridge pattern. The same principles apply to all future data sharing.

### Rooms + Boxes (Exploratory — from Mar 03 daily)

Jhonatan proposed: agents in multi-user chat rooms could automatically create Vault boxes with context about users they interact with. Example: a HyperCycle team bot would store that "Nasir is in charge of HyperWire" and could tag Nasir when HyperWire topics come up. Requires integration of Victor's vault work with David's chat system.

---

## Wallet Model

### MosAIc Wallet (Core-Controlled)

From the Mar 03 daily:

- **Create only, no import** — MosAIc creates the wallet
- Users should only fund it with what they're "willing to lose"
- Payment rails: **USDC on Base** + **TODA TDN**
- Joaquin is implementing the wallet component

### Agent Wallets (Future)

From Robert (Mar 03):

- Agents could create their own wallets **inside their containers**
- User transfers from MosAIc wallet to agent wallet
- Agent has full control of its allocated funds
- Enables autonomous agent spending (e.g., purchasing HyperCycle node services)

### Payments Priority

Current priority is wallet integration + purchasing HyperCycle remote services.
Paid tool registry/distribution is **explicitly deferred** — not Phase 1.

---

## Pre-Materialization (Data Input to Containers)

### v1 Approach

Core copies approved data into the container at launch:

```
Core creates: /mosaic_data/tools/<tool_id>/inputs/
  ├── data.json        # Pre-materialized vault entries
  ├── config.json      # Tool-specific config (if any)
  └── ...

Docker mount: /mosaic_data/tools/<tool_id>/inputs/ → /inputs:ro
```

The tool reads from `/inputs` (read-only). It never has direct access to the Vault, filesystem, or any other Core resource.

### When Pre-Materialization Isn't Enough

Robert noted (Mar 03): "If you needed access to dynamic data, pre-materialization isn't going to work." For tools that need real-time data, a Data Bridge API (like the Vault ToolModule) would be needed. This is a v2 consideration.

### File Access Model

From the Mar 03 meeting:

| What                                                     | How                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| User wants tool to process specific files                | User copies files into the container's `/inputs` directory (via MosAIc UI) |
| Tool accessing host filesystem directly                  | ❌ Never allowed                                                           |
| David's MCP approach (password-protected filesystem API) | Considered for v2 — restricted API with auth                               |
| Tool writing output                                      | Only via Chronicle (append-only)                                           |

---

## Data Ingestion Filtering (Future)

Robert raised an important point (Mar 03 meeting): content filtering may be needed not just at the **outbound** boundary (Gatekeeper), but also at the **data ingestion** boundary.

Example: Email data loaded into a chat → sent to OpenAI → PII leaks.

**Potential approach:**

- Data sources (email, files) get scrubbed of sensitive data before loading into a chat
- Policy per data source defines what needs to be filtered
- Sensitive data use cases (medical, financial) require specialized services with proper security guarantees

> Not Phase 1 priority. The Gatekeeper (outbound filtering) comes first.

---

## Reference vs Dereference

### Definitions

- **Reference** = an identifier/handle for a data object (e.g., box ID, entry ID, file hash)
- **Dereference** = resolving that reference into the actual content

### Current Implementation

| Level                         | Implementation                               | Status         |
| ----------------------------- | -------------------------------------------- | -------------- |
| Reference                     | `vault:list_boxes` returns box IDs and names | ✅ Implemented |
| Dereference                   | `vault:read_box` returns full entry content  | ✅ Implemented |
| Access control on dereference | `canAgentAccessBox()` checks                 | ✅ Implemented |
| Logging on dereference        | Not yet                                      | ⚠️ Future      |

### v1 Approach: Best-Effort Logging

> "Logging of reads/dereference can be implemented in the easiest way — logging at the Core-managed dereference/materialization boundary is acceptable. We do not require logging every filesystem read syscall inside a container in v1."

---

## Open Questions

1. Exact Chronicle format — JSONL? SQLite? Content-addressed store?
2. Chronicle ↔ Vault boundary — when does a tool output become a Vault entry?
3. Chronicle retention policy — keep forever? prune after N days?
4. How pre-materialization works for Docker containers — mounted files vs API
5. Data ingestion filtering — when to implement, what per-source policies look like
6. Agent state reconstruction from Chronicle — feasibility and limitations for tool developers
