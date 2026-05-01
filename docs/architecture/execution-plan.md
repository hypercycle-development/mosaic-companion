# Phase 1 Execution Plan

> Ordered sequence of implementation phases for tool containerization.
> Source: Execution plan document reviewed with Robert (2026-03-03), refined after Barry's input (2026-03-04).

---

## Sequence Overview

```
1. Trust Boundary Definition
2. Tool Execution Contract
3. Container Launch Layer
4. Outbound Gatekeeper
5. Outbound Profiles
6. Append-Only Chronicle
7. Core-Mediated Data Bridge (v2)
8. Logging Model
9. Hardening Path Documentation
```

---

## 1️⃣ Define the Trust Boundary (Foundational)

**Goal:** Formalize Core vs Sandbox separation before writing infrastructure.

**Deliverables:**

- Clear definition of Core responsibilities (policy, logging, mediation, secrets, storage coordination)
- Clear definition of Sandbox responsibilities (tool execution only)
- Explicit statement: **containers are not the security boundary** — Core enforcement is
- Documentation of all "boundary crossing" events

**Why first?** Everything else (networking, filesystem, logging) depends on this definition.

---

## 2️⃣ Define the Tool Execution Contract

**Goal:** Standardize how tools are launched and what they are allowed to access.

**Permissions model (v1):**

| Permission      | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| Internet access | Whether the tool can make outbound requests (through Gatekeeper)                  |
| File access     | User can copy specific files/directories into the container (pre-materialization) |
| CPU             | Number of cores allocated                                                         |
| Memory          | RAM limit                                                                         |
| Disk            | Storage limit                                                                     |
| VRAM / GPU      | Graphics card access (for ML tools, LLMs inside containers)                       |

**Container communication protocol:**

- Tool exposes a port (HTTP/TCP server)
- MosAIc initializes the container by calling `/init?key=<random_key>`
- Tool saves that key and requires it for all subsequent API calls
- No HTTPS needed — communication is localhost/same machine only
- This prevents external machines on the network from accessing the tool

**Deliverables:**

- Tool launch schema (image reference, outbound profile, resource limits)
- Stable tool identifier (used for logging + Chronicle attribution)
- Definition of allowed mounts:
  - `/inputs` (read-only) — Core pre-materialized data
  - `/chronicle` (append-only logical target)
  - `/tmp` (optional ephemeral)
- **Constraint:** No unrestricted `:rw` mounts to shared system data

---

## 3️⃣ Container Launch Layer (v1 Permissive, Hardenable Later)

**Goal:** Control container lifecycle without locking into Docker long-term.

**Architecture:**

```
Core → Launcher (abstraction) → Runtime (Docker for now)
```

The launcher is an abstraction so the runtime can change later (microVMs, WASM, etc.).

**Deliverables:**

- Core-controlled launcher component
- Logging of: image pulled, container started/stopped, resources assigned
- `docker.sock` usage allowed in v1 (permissive)
- Image allowlist support (even if simple)
- Container security flags:
  - `--cap-drop ALL`
  - `--read-only`
  - `USER 1001` (non-root)
  - `--cpus` / `--memory` limits
  - No `--network host`

**OCI Compatibility:** Use OCI-standard container images. Docker is the v1 runtime, but any OCI-compatible runtime (Podman, containerd) could replace it.

---

## 4️⃣ Implement Outbound Gatekeeper (Mandatory)

**Goal:** All tool egress flows through a Core-controlled boundary. Logging required.

**Implementation approach (from engineering discussion with Barry, 2026-03-04):**

### For tools: Hard domain filtering

- Domain allowlist declared in manifest
- Enforced via DNS proxy + IP filtering (Barry's recommendation)
- Tool cannot bypass — network-level enforcement

### For agents: Soft guardrails

- NLP-based content analysis
- Named Entity Recognition for PII detection
- Can be bypassed by determined actors — acceptable for agents, not for tools

**The HTTPS challenge:**

- HTTPS is encrypted on the client (inside the container)
- Proxy cannot inspect encrypted content
- Solution: DNS proxy resolves only allowed domains → IP filter blocks everything else
- Content inspection limited to HTTP traffic

**Deliverables:**

- Outbound proxy/gateway service
- Docker network routing that forces tool traffic through it
- Outbound filter chain:
  - Allow/deny rules (domain allowlist from manifest)
  - URL validation
  - Content/MIME type checks (HTTP only)
  - Basic PII baseline (simple regex + NER rules)
- Logging: tool ID, destination, policy applied, decision (allow/deny)

> Docker networking is supplementary — not the policy layer.

---

## 5️⃣ Define Outbound Profiles (Launch-Time Policy)

**Goal:** Make outbound policy configurable without rewriting architecture.

**Deliverables:**

- Profile model:
  - **Strict** — deny-by-default, no internet
  - **Limited** — manifest-declared domain allowlist only
  - **Relaxed** — broader access (if needed for dev/testing)
- Tool-recommended profile option in manifest
- User selection mechanism at launch
- Warning system: if a tool requests many permissions, show "are you sure?" prompts

---

## 6️⃣ Implement Append-Only Chronicle

**Goal:** Ensure tool output is auditable and immutable.

**Preferred v1 implementation:**

```
Tool → (API call) → Core → Chronicle append
```

The tool calls Core's API to write to its Chronicle. Core controls the write path.

**Alternative (filesystem-based):**

- Dedicated `/chronicle` mount
- No shared write access
- Core ingests and validates entries
- Soft append-only enforcement in v1

**Chronicle serves multiple purposes (from Robert):**

1. **Security audit** — full record of what the tool did
2. **Debugging** — reproduce issues by replaying activity
3. **Data mining** — extract useful patterns from tool behavior
4. **State reconstruction** (future) — kill container and reconstruct from last good state

**Deliverables:**

- Chronicle data structure (JSONL or similar)
- Tool attribution model (every record tagged with tool ID)
- Append-only enforcement mechanism (v1 soft, v2 hardened)
- Provenance labeling for artifacts/blobs

---

## 7️⃣ Core-Mediated Data Bridge (Deferred to v2)

**Goal:** Enforce read-only shared data requirement with full policy control.

**v1 approach (simpler):**

- Core pre-materializes approved data into a tool-specific read-only directory
- Mounts as `/inputs:ro`

**v2 approach (full Data Bridge):**

- Core-mediated dereference API
- Reference vs dereference permissions
- Scoped access (views/subsets/feeds)

**Logging:**

- What references were materialized
- Which tool accessed them
- Logged at materialization boundary, NOT at syscall level

> **Confirmed decision:** No filesystem read syscall logging in v1. Logging at Core's materialization boundary is sufficient.

---

## 8️⃣ Logging Model for Boundary Crossings

**Goal:** Unified audit trail across all boundary types.

**Must log in v1:**

| Event Type           | Details Logged                            |
| -------------------- | ----------------------------------------- |
| Data materialization | What data, for which tool, when           |
| Chronicle append     | Tool ID, content type, timestamp          |
| Outbound requests    | Tool ID, destination, policy, decision    |
| Container lifecycle  | Image pulled, started, stopped, resources |

**NOT required in v1:**

- Syscall-level filesystem logging
- Kernel-level network tracing

> Keep it practical. Deep logging is a future hardening option.

---

## 9️⃣ Hardening Path Documentation

**Goal:** Prove Phase 1 decisions are reversible.

**Document future steps (architecture seams, not implementation):**

- Replace `docker.sock` with restricted launcher interface
- Image signature validation
- Reduce privileges over time
- Possibly swap runtime (microVM, WASM, etc.)
- Stronger append-only enforcement (content-addressed storage)
- Container monitoring (research: what tools exist for observing container behavior without syscall-level logging)

---

## Extra Research Tasks

### NLP for PII Detection

- Research lightweight NLP techniques for detecting PII in outbound traffic
- Named Entity Recognition (NER), part-of-speech tagging
- Evaluate whether a small local LLM (via Ollama) could help with edge cases
- **Note from Barry:** NLP/content filtering is better for agent guardrails, not tool-level enforcement
- **For tools:** Hard domain filtering is the correct approach

### Container Monitoring

- Research ways to monitor containers without getting into syscall territory
- Focus on what's useful for security without burdening tool developers
- ~30 minutes of research to identify practical options

---

## What This Achieves

By following this sequence:

- ✅ Docker is used, but NOT relied upon as the trust boundary
- ✅ Tools remain explicitly low-trust
- ✅ All sensitive flows are Core-mediated
- ✅ The system can later move to microVMs, WASM, or alternative sandboxes
- ✅ Phase 1 remains achievable without overengineering
