# Permission Model

How MosAIc controls what tools and agents are allowed to do.

---

## Principles

1. **Explicit approval** — No tool runs without the user reviewing and approving its permissions
2. **Least privilege** — Tools get the minimum permissions needed
3. **Escalation requires re-approval** — If a tool update requests new permissions, the user must approve again
4. **Future-compatible** — v1 must not block the path to more granular permissions later

---

## Phase 1 Permission Categories

### For Tools (Containerized)

| Permission        | Description                                                  | Default  |
| ----------------- | ------------------------------------------------------------ | -------- |
| `internet`        | Can the tool make outbound network requests?                 | `false`  |
| `allowed_domains` | Which domains can the tool reach? (only if `internet: true`) | `[]`     |
| `cpu`             | Maximum CPU allocation                                       | `"1"`    |
| `memory`          | Maximum memory allocation                                    | `"512m"` |

**Filesystem permissions are excluded from the Phase 1 model.** Tools are completely isolated — they cannot see or access any host files. The only data they receive is what Core explicitly provides through Data Bridges.

### For Agents (Built-in)

| Permission      | Description                                     | Currently Implemented            |
| --------------- | ----------------------------------------------- | -------------------------------- |
| `boxAccess`     | Which vault boxes can this agent read?          | ✅ Yes (via VaultToolModule)     |
| Tool access     | Which tools can this agent invoke?              | ❌ Not yet (all tools available) |
| Internet access | Can this agent's tool calls reach the internet? | ❌ Not yet                       |

---

## Approval Flow

### Initial Installation

```
1. User browses tool registry in MosAIc
2. MosAIc fetches manifest from registry
3. MosAIc displays permission summary:
   ┌──────────────────────────────────────┐
   │  Install "Data Analyzer v1.0.0"?    │
   │                                      │
   │  Permissions requested:              │
   │  ⚡ CPU: up to 1 core               │
   │  💾 Memory: up to 512MB             │
   │  🌐 Internet: No                    │
   │                                      │
   │  [Cancel]              [Install]     │
   └──────────────────────────────────────┘
4. User clicks Install → image pulled, tool registered
   User clicks Cancel → nothing happens
```

### Permission Escalation

If a tool update requests new permissions (e.g., v1.1.0 now wants internet access):

```
1. MosAIc compares old manifest with new manifest
2. Detects new permission: internet access
3. Displays diff to user:
   ┌──────────────────────────────────────┐
   │  Update "Data Analyzer" to v1.1.0?  │
   │                                      │
   │  NEW permissions requested:          │
   │  🌐 Internet: api.openai.com        │
   │                                      │
   │  [Cancel]              [Update]      │
   └──────────────────────────────────────┘
4. User must explicitly approve the new permissions
```

---

## Profiles (Tool Launch Profiles)

A profile is a preset permission configuration applied when a tool is launched.

### Predefined Profiles

| Profile        | Internet              | Content Filter | PII Check | Use Case                  |
| -------------- | --------------------- | -------------- | --------- | ------------------------- |
| **strict**     | Deny (no exceptions)  | Full           | Full      | Sensitive data processing |
| **standard**   | Manifest domains only | Basic          | Baseline  | Normal usage              |
| **permissive** | Allow most, log all   | Minimal        | Minimal   | Development / testing     |

### How Profiles Work

1. Tool manifest may recommend a profile: `"recommended_profile": "standard"`
2. User can accept the recommendation or select a different profile
3. Profile settings override or supplement manifest permissions
4. Some rules may be global (e.g., global PII patterns always apply regardless of profile)

---

## Future-Compatible Seams

Phase 1 does NOT implement the full permission model. But the design must leave a path to:

### Reference vs Dereference Permissions

Currently a binary: agent has access or doesn't. Future: agent might be able to reference a box (see its name) but not dereference (read its content).

**v1 seam:** The split between `vault:list_boxes` (reference) and `vault:read_box` (dereference) already supports this. Adding separate permission checks is straightforward.

### Scoped Access (Views / Subsets / Feeds)

Currently: if an agent can read a box, it reads ALL entries. Future: agent might read only entries from the last 7 days, or only entries matching a filter.

**v1 seam:** Use stable identifiers for shared resources. When scoped access is needed, add scope parameters to the Data Bridge host functions.

### Room-Based Access Control (Exploratory)

A "room" is a potential future unit where tools/bots are added and receive data access based on the room's policy. Adding to a room grants access; removing revokes it.

**v1 seam:** Don't hardcode permission checks to agent-level. The `ExecutionContext` already supports arbitrary identity context — it could carry a `roomId` alongside `agentId`.

---

## docker.sock / Container Management Authority

### v1 (Permissive)

Mounting `/var/run/docker.sock` into the Mosaic container gives it full control over the host Docker daemon. This is accepted for v1 to move fast.

### Hardening Path (Post-v1)

1. **Constrained container launcher** — A dedicated service with a restricted API (can only create/stop/remove tool containers, not arbitrary containers)
2. **Operation logging** — Log all container lifecycle actions
3. **Image allowlisting** — Only images from the private registry can be launched
4. **Mount restrictions** — Only approved directories can be mounted
5. **Privilege restrictions** — Never launch privileged containers

---

## Open Questions

1. Per-agent tool access control — should agents have a list of tools they can use (like `boxAccess` but for tools)?
2. Runtime permission prompting — can a tool request a new permission mid-execution (like mobile app permissions)?
3. Permission revocation — if the user revokes a permission, does the running tool get killed or just lose access?
4. Cross-tool permissions — can Tool A grant Tool B access to its data?
