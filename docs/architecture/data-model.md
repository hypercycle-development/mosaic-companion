# Data Model

How data flows between Core and Sandbox. Covers the Chronicle (tool output), Vault (structured storage), and the reference/dereference model.

---

## Overview

```
                  CORE (Trusted)
┌──────────────────────────────────────────┐
│                                          │
│   ┌────────┐    ┌──────────┐             │
│   │ Vault  │    │ Configs  │ (read-only  │
│   │ Boxes  │    │ Secrets  │  to tools)  │
│   └───┬────┘    └────┬─────┘             │
│       │              │                   │
│   Data Bridge    Data Bridge             │
│   (read-only)    (read-only)             │
│       │              │                   │
├───────┼──────────────┼───────────────────┤
│       ↓              ↓                   │
│   ┌──────────────────────────┐           │
│   │     SANDBOX (Untrusted)  │           │
│   │                          │           │
│   │  Tool reads data ←──────│─── Core provides (pre-materialized or on-demand)
│   │  Tool produces output ──│──→ Chronicle (append-only)
│   │                          │           │
│   └──────────────────────────┘           │
│       │                                  │
│   Chronicle                              │
│   (append-only, ──→ stored in Core       │
│    auditable)                            │
└──────────────────────────────────────────┘
```

---

## Chronicle (Append-Only Tool Output)

### What It Is

A Chronicle is the **only place a tool can write data**. It is an append-only record of:

- Tool outputs (results returned to the agent/user)
- Artifacts produced (files, blobs, images)
- Activity logs

### Key Properties

| Property         | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| **Append-only**  | New records can be added. Existing records CANNOT be modified or deleted.   |
| **Per-tool**     | Each tool has its own Chronicle. No tool can see another tool's Chronicle.  |
| **Core-managed** | The Chronicle is stored and managed by Core, not by the tool.               |
| **Auditable**    | Supports debugging and security audits — full history of what the tool did. |

### Why Append-Only?

1. **Full audit trail** — you can always trace what happened
2. **Debugging** — reproduce issues by replaying the Chronicle
3. **Tamper resistance** — a compromised tool cannot erase evidence
4. **Trust** — users can verify what a tool did

### v1 Enforcement

In v1, append-only enforcement may be "good enough" (Core controls the write path, tools don't have direct filesystem access). Hardening over time (e.g., content-addressable storage, cryptographic chaining) is a future option.

### Exception Handling

If a future use case requires relaxing append-only (e.g., a tool that maintains mutable state):

- Requires a specific use case justification
- Core grants write access using least-privilege model
- The mutable state is still logged (snapshot before/after)

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

The Vault system is the **first implementation** of the Data Bridge pattern. The same principles apply to all future data sharing:

1. Core decides what data is shared (based on `boxAccess[]`)
2. Tools/agents request data through Core-mediated APIs
3. Access is checked before data is returned
4. The tool never has direct filesystem access to the data

---

## Reference vs Dereference

A key architectural concept for data access control.

### Definitions

- **Reference** = an identifier/handle for a data object (e.g., box ID, entry ID, file hash)
- **Dereference** = resolving that reference into the actual content

### Why This Matters

A tool might be allowed to know that a box called "Meeting Notes" exists (reference) but not be allowed to read its contents (dereference). This enables:

- Metadata-only access ("you have 3 boxes")
- Selective content access ("you can read box A but not box B")
- Future: scoped views ("you can see entries from the last 7 days only")

### Current Implementation

| Level                         | Implementation                                     | Status         |
| ----------------------------- | -------------------------------------------------- | -------------- |
| Reference                     | `vault:list_boxes` returns box IDs and names       | ✅ Implemented |
| Dereference                   | `vault:read_box` returns full entry content        | ✅ Implemented |
| Access control on dereference | `canAgentAccessBox()` checks before returning data | ✅ Implemented |
| Logging on dereference        | Not yet                                            | ⚠️ Future      |

### v1 Approach: Best-Effort Logging

> "Logging of reads/dereference can be implemented in the easiest way — logging at the Core-managed dereference/materialization boundary is acceptable. We do not require logging every filesystem read syscall inside a container in v1."

In practice: log when `vault:read_box` is called, not when a tool reads a file inside its container.

---

## Materialization / Pre-materialization

### Pattern

Instead of letting a tool dereference arbitrary references on demand, Core **pre-materializes** data:

1. Core determines what data the tool is allowed to access
2. Core copies that data into the tool's accessible area (mounted directory or host function response)
3. Tool reads the pre-materialized data
4. No further dereference calls needed during execution

### When to Use

- **Pre-materialization** — when the data set is small and known in advance (e.g., vault entries for a specific agent)
- **On-demand dereference** — when the data set is large or the tool needs to discover what's available at runtime

The current Vault ToolModule uses on-demand dereference (tool calls `list_boxes` → `read_box`). Pre-materialization could be used for Docker containers where mounting a JSON file is simpler than setting up host function calls.

---

## Artifacts and Blobs

Tools may produce binary artifacts (images, files, processed data). These must be:

1. **Provenance-labeled** — tagged with the producing tool's ID, timestamp, and input reference
2. **Referenced where possible** — avoid unnecessary duplication (use content-addressed hashes)
3. **Traceable via Chronicle** — every artifact creation is recorded

### v1 Approach

Artifacts are stored in the tool's Chronicle directory:

```
~/.config/mosaic-companion/chronicles/<tool_id>/
├── chronicle.jsonl        # Append-only activity log
├── artifacts/
│   ├── output-001.json    # Produced by tool
│   ├── output-002.png     # Produced by tool
│   └── ...
```

---

## Open Questions

1. Exact Chronicle format — JSONL? SQLite? Content-addressed store?
2. Chronicle ↔ Vault allocation rules (when does a Chronicle entry become a Vault entry?)
3. Chronicle retention policy (keep forever? prune after N days?)
4. How pre-materialization works for Docker containers (mounted files vs API)
5. Artifact deduplication strategy
