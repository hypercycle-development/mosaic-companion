# Glossary

Canonical definitions of all architectural terms used across MosAIc documentation.

---

### Core (Trusted)

The trusted part of MosAIc. Owns the UI shell and all high-trust responsibilities: policy decisions, user approvals, secrets handling, logging/audit, and storage coordination. Core mediates all boundary crossings. In the Electron app, this is the **main process**.

### Sandbox (Untrusted)

The untrusted execution environment where tools, agents, and dynamically evolving code run. In Phase 1 this may be implemented as Docker containers. Sandbox code must not have implicit access to Core resources.

### Tool Container

A container (Docker, WASM, or other runtime) used to run a specific tool in the Sandbox zone. Treated as **untrusted by default**. "Tool container" is an implementation choice; the security requirements apply regardless of runtime technology.

### Boundary Crossing

Any flow from Sandbox to something trusted or external (or vice versa). Examples: reading Core-managed data, writing outputs to persistent storage, accessing the internet, invoking host actions, or exporting data. Boundary crossings must be **explicit, Core-mediated, and logged**.

### Policy Gate

The user-controlled permission boundary enforced by Core. A Policy Gate defines what a tool/agent/service is allowed to access or do (data access, dereference rights, outbound network permissions, etc.). Preferred term over "firewall" to avoid ambiguity.

### Gatekeeper (Outbound Boundary)

The Core-controlled enforcement point for all outbound traffic from the Sandbox. Applies allow/deny rules, filtering checks (destination URLs, content/MIME types, PII detection), and produces logs/audit records. See [gatekeeper.md](./gatekeeper.md).

### Outbound Filter Chain

The sequence of checks/filters applied at the Gatekeeper. Can include allow/deny rules, content transforms (redaction), schema checks, and logging. Can be partly global and partly tool-specific via Profiles.

### Profile (Outbound / Tool Launch Profile)

A configuration set selected when a tool is launched that determines its default outbound filtering and permission settings (e.g., deny-by-default, domain allowlist, content checks). A tool may recommend a profile; the user may select or override it.

### Data Bridge

The Core-mediated mechanism for sharing data into the Sandbox. Core controls what data is shared, in what form, and under what policy, rather than giving tools broad direct access. In the current implementation, the **Vault ToolModule** is a Data Bridge.

### Reference vs Dereference

A permission distinction:

- **Reference** = ability to see/use identifiers, handles, or metadata for data objects
- **Dereference** = ability to resolve the reference into the underlying content (full data)

Long-term, dereference control is intended to be Core policy-mediated. In Phase 1, "dereference logging" is best-effort at the Core materialization boundary.

### Materialization / Pre-materialization

A pattern where Core copies or prepares selected content for a tool in advance (e.g., placing allowed vault entries into a tool-accessible area) instead of allowing the tool to dereference arbitrary references on demand. Simpler v1 approach.

### Chronicle (Tool Chronicle)

An **append-only** record of tool activity and outputs. Key requirement: tool writes go **only** to an append-only Chronicle (unless a future use case forces an exception). Chronicles support debugging and security audits.

### Append-Only

A write constraint: new records can be added, but previously written records cannot be modified or deleted. In v1, enforcement may be "good enough" and hardened over time; the intent is to preserve a reliable history.

### Vault

MosAIc's structured data storage system organized into **Boxes**. Users store information and control which agents can access each box. See [/docs/vault.md](../vault.md) for full documentation.

### Box (Vault Box)

A named container within the Vault that holds related data entries. Each box has access control — agents must be explicitly granted access.

### Least Privilege

Security principle: each tool or component has only the minimum permissions needed. Tools get read-only access to shared data and write-only (append-only) access to their Chronicle; any expansion requires a specific use case and deliberate approval.

### Room (Exploratory)

A potential future unit of access control and interaction: tools/bots could be added to a "room" (chat/context space) and receive data access based on the room's policy; they can be removed to revoke access. **Not yet finalized** — direction being explored.

### ExecutionContext

The runtime identity passed through the MosAIc tool execution pipeline. Contains `agentId` so tool handlers can enforce access control. Already implemented in the Vault ToolModule.

### MCP (Model Context Protocol)

An open standard for connecting AI systems to external tools and data sources. MosAIc supports MCP servers as a tool integration layer. MCP servers currently run as child processes (semi-trusted).
