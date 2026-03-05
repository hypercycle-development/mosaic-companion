# Permission Model

How MosAIc controls what tools and agents are allowed to do.

---

## Principles

1. **Explicit approval** — No tool runs without the user reviewing and approving its permissions
2. **Least privilege** — Tools get the minimum permissions needed
3. **No runtime escalation** — Tools cannot request new permissions mid-execution. If they need it, it should be in the manifest. (Confirmed Mar 03 meeting: "That should be the responsibility of the tool developer.")
4. **Future-compatible** — v1 must not block the path to more granular permissions later

---

## Phase 1 Permission Categories

### For Tools (Containerized)

| Permission        | Description                          | Default  | Notes                          |
| ----------------- | ------------------------------------ | -------- | ------------------------------ |
| `internet`        | Can the tool make outbound requests? | `false`  | Through Gatekeeper only        |
| `allowed_domains` | Which domains? (if `internet: true`) | `[]`     | Hard domain allowlist          |
| `cpu`             | CPU cores allocated                  | `"1"`    | From manifest                  |
| `memory`          | RAM limit                            | `"512m"` | From manifest                  |
| `disk`            | Storage limit                        | TBD      | From manifest                  |
| `vram` / `gpu`    | GPU access for ML/LLMs               | `false`  | For tools running local models |

**Filesystem permissions are excluded from v1.** Tools are completely isolated. The only data they receive is what Core explicitly pre-materializes into `/inputs:ro`. No direct host filesystem access under any circumstances.

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
MosAIc fetches manifest from registry
  → Displays to user:

   ┌──────────────────────────────────────┐
   │  Install "Data Analyzer v1.0.0"?    │
   │                                      │
   │  Permissions requested:              │
   │  ⚡ CPU: up to 1 core               │
   │  💾 Memory: up to 512MB             │
   │  🌐 Internet: api.openai.com only   │
   │  🎮 GPU: No                         │
   │                                      │
   │  ⚠️ This tool requests internet     │
   │  access. Are you sure?              │
   │                                      │
   │  [Cancel]              [Install]     │
   └──────────────────────────────────────┘

  → User clicks Install → image pulled, tool registered
  → User clicks Cancel → nothing happens
```

**No tool is installed without user approval.**

### Warning Escalation

From Jhonatan + Robert (Mar 03 meeting): Warn users more aggressively based on the number/severity of permissions requested. Many users "just click yes to things they shouldn't — that's why a lot of people have 10 or 15 viruses installed."

| Permission level               | User experience              |
| ------------------------------ | ---------------------------- |
| Low (CPU/memory only)          | Simple approval              |
| Medium (internet access)       | Yellow warning banner        |
| High (internet + many domains) | "Are you sure?" confirmation |

### Permission Escalation — NOT Allowed at Runtime

If a tool update (new version) requests new permissions:

- MosAIc compares old manifest with new manifest
- Shows a diff of new permissions
- User must re-approve

**Tools cannot request extra permissions during execution.** If a tool needs a permission, the developer must include it in the manifest upfront. No runtime prompting.

From Jhonatan (Mar 03): "If they foresee that their tool might need this permission, then they should include it in the manifest."

Robert's nuance: "If something breaks for a permissions reason, there should be a way to notify the user. But that's the tool developer's responsibility to declare correctly."

---

## File Access Model

### v1: No Filesystem Access + Pre-Materialization

Tools never access the host filesystem. Instead:

1. User selects files to share with a tool (via MosAIc UI)
2. Core copies those files into the tool's `/inputs` directory
3. Container mounts `/inputs:ro`
4. Tool reads from `/inputs` — that's all it gets

### v2 (Future): Controlled File API

From David (Mar 03 meeting): Some MCP servers use a password-protected API for filesystem operations. A similar approach could work for tools that need dynamic file access — a restricted API with the access key, controlled by Core.

### File Syncing (Future)

From Jhonatan (Mar 03): "Maybe later the user could sync their files with a folder in their computer." This would be a persistent mount updated by Core, but NOT in v1.

---

## Profiles (Tool Launch Profiles)

A profile is a preset permission configuration applied when a tool is launched.

### Predefined Profiles

| Profile     | Internet              | Content Filter | PII Check | Use Case                  |
| ----------- | --------------------- | -------------- | --------- | ------------------------- |
| **strict**  | Deny (no exceptions)  | Full           | Full      | Sensitive data processing |
| **limited** | Manifest domains only | Basic          | Baseline  | Normal usage              |
| **relaxed** | Allow most, log all   | Minimal        | Minimal   | Development / testing     |

### How Profiles Work

1. Tool manifest may recommend a profile: `"recommended_profile": "limited"`
2. User can accept the recommendation or select differently
3. Users usually "just pick whatever is recommended" (Robert, Mar 03)
4. Profile settings override or supplement manifest permissions
5. Some rules are global (e.g., PII patterns always apply)

---

## Future-Compatible Seams

Phase 1 does NOT implement the full permission model. But the design must leave a path to:

### Reference vs Dereference Permissions

Currently binary: agent has access or doesn't. Future: agent might reference a box (see name) but not dereference (read content).

**v1 seam:** The split between `vault:list_boxes` (reference) and `vault:read_box` (dereference) already supports this.

### Scoped Access (Views / Subsets / Feeds)

Currently: if an agent reads a box, it reads ALL entries. Future: read only entries matching a filter (date range, tags, etc.).

**v1 seam:** Use stable identifiers for shared resources. When scoped access is needed, add scope parameters.

### Room-Based Access Control (Exploratory)

Tools/bots added to a "room" receive data access based on the room's policy. Remove to revoke.

**v1 seam:** `ExecutionContext` can carry a `roomId` alongside `agentId`.

---

## docker.sock / Container Management Authority

### v1 (Permissive)

`docker.sock` mounting is accepted for v1 to move fast.

### Hardening Path (Post-v1)

1. **Constrained container launcher** — restricted API (only create/stop/remove tool containers)
2. **Operation logging** — log all container lifecycle actions
3. **Image allowlisting** — only images from the private registry
4. **Mount restrictions** — only approved directories
5. **Privilege restrictions** — never launch privileged containers

**Key:** Docker is an implementation detail behind the Container Launcher abstraction. When hardening or swapping runtimes, only the launcher implementation changes.

---

## Open Questions

1. Per-agent tool access control — should agents have a list of tools they can use?
2. Permission revocation — does the running tool get killed or just lose access?
3. Cross-tool permissions — can Tool A grant Tool B access to its data?
4. Wallet permissions — can a tool trigger wallet transactions? (Probably no — too risky)
5. GPU access detection — how to detect available VRAM and allocate to tools?
