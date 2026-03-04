# Tool Lifecycle

How tools are built, distributed, installed, and executed in MosAIc.

---

## 1. Tool Development

A tool is a self-contained unit of functionality that runs in the Sandbox. Tool developers create:

1. **The tool code** — business logic in any supported language
2. **A manifest** — declares identity, permissions, resources, and available functions

### Manifest Format (Phase 1)

```json
{
  "id": "python-data-analyzer",
  "manifest-version": "1.0.0",
  "version": "1.0.0",
  "image": "registry.mosaic.ai/python-data-analyzer:1.0.0",
  "permissions": {
    "internet": false,
    "allowed_domains": [],
    "filesystem_read": false,
    "filesystem_write": false
  },
  "resources": {
    "cpu": "1",
    "memory": "512m"
  },
  "description": "Advanced data analysis tool.",
  "tools": {
    "analyze": {
      "description": "Analyze a dataset",
      "inputSchema": { ... }
    }
  }
}
```

Key manifest fields:

- `id` — Unique identifier, globally unique within the registry
- `manifest-version` — Version of the manifest format itself
- `version` — Version of the tool (semver)
- `image` — Docker image reference (Phase 1) or `.wasm` file (future)
- `permissions` — What the tool is allowed to do (see [permissions.md](./permissions.md))
- `resources` — CPU and memory limits
- `tools` — Functions exposed to agents (integrated into MosAIc's ToolRegistry)

### Building for Docker (Phase 1)

```dockerfile
FROM python:3.12-slim

# Security: non-root user
RUN useradd -m -u 1001 tooluser
USER 1001

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ /app/
WORKDIR /app

ENTRYPOINT ["python", "main.py"]
```

**Requirements:**

- Must use a non-root user (`USER 1001`)
- Must work with read-only root filesystem (`--read-only`)
- Must not assume host-specific directory layouts
- All tool containers run as Linux containers (Docker Desktop abstracts this on macOS/Windows)

### Building for WASM (Future)

```bash
# JS/TS tools via Extism PDK
extism-js src/index.js -o tool.wasm

# Rust tools
cargo build --target wasm32-wasi --release
```

Output is a single `.wasm` file. No Dockerfile needed.

---

## 2. Distribution

### Private Registry (Phase 1)

All tool images are stored in a private Docker registry.

```
Developer → pushes image → Private Registry
                              ↓
User → browses in MosAIc → pulls manifest → reviews permissions → installs
```

**Registry requirements:**

- Authenticated access (short-lived tokens)
- Version tagging support
- Options: Harbor, AWS ECR, self-hosted Docker Registry v2
- Images are NOT stored on-chain or in decentralized storage

### Payment Flow (Deferred — Not Phase 1 Priority)

The paid tool registry/distribution model is **deferred**. Current payments priority is wallet integration for purchasing HyperCycle remote services (USDC on Base, TODA TDN).

When implemented:

1. User selects a paid tool
2. User completes crypto payment
3. Backend verifies the transaction
4. Backend records license in internal database
5. Backend issues registry pull authorization
6. MosAIc pulls image

---

## 3. Installation

### User Approval Flow

```
MosAIc fetches manifest from registry
  → Displays to user:
     - Tool name, description, version
     - Requested permissions (internet, resources, etc.)
     - Resource limits (CPU, memory)
  → User must EXPLICITLY approve
  → If approved: image is pulled and registered
  → If denied: nothing happens
```

**No tool is installed without user approval.**

Permission escalation after installation (e.g., a new version requesting internet access when the previous version didn't) requires **re-approval**.

---

## 4. Execution

### Container Launch (Phase 1)

When a tool is invoked (by an agent via `<use_tool>` or by the user), MosAIc:

1. Creates a Docker container with hardening flags:

   ```
   --cap-drop ALL          # Drop all Linux capabilities
   --read-only             # Read-only root filesystem
   --cpus=1 --memory=512m  # Resource limits from manifest
   --network=<bridge>      # No host networking
   ```

2. Mounts only the tool's isolated directory:

   ```
   /mosaic_data/tools/<tool_id>/  →  container:/data  (:ro or :rw)
   ```

3. If internet is allowed, routes through the Gatekeeper (see [gatekeeper.md](./gatekeeper.md))

4. Passes input data as JSON via stdin or a mounted file

5. Captures output → appends to the tool's **Chronicle** (append-only)

6. Returns result to the agent/user via the ToolRegistry

7. Container is stopped and removed

### Container Security Hardening

| Measure            | Flag                      | Effect                       |
| ------------------ | ------------------------- | ---------------------------- |
| Non-root user      | `USER 1001` in Dockerfile | Reduces impact of compromise |
| Drop capabilities  | `--cap-drop ALL`          | No elevated kernel access    |
| Read-only root FS  | `--read-only`             | No persistent tampering      |
| No host networking | No `--network host`       | No direct host access        |
| Resource limits    | `--cpus` / `--memory`     | Prevents resource exhaustion |
| Seccomp (default)  | Docker default profile    | Restricts dangerous syscalls |

### WASM Execution (Future)

When using WASM instead of Docker:

1. Load `.wasm` module via Extism/Wasmtime
2. Inject host functions based on approved permissions
3. Execute function with JSON input
4. Capture output → Chronicle
5. No container overhead, ~5-50ms startup

### Integration with ToolRegistry

Regardless of runtime (Docker, WASM, child process), tools appear to agents through the same `ToolModule` interface:

```
Agent → <use_tool server="tool-id" tool="function">args</use_tool>
  → ActionParser → ToolRegistry.executeTool()
    → Docker container / WASM module / child process
      → Result → Chronicle (logged) → Agent
```

The agent doesn't know or care about the underlying runtime.

---

## 5. Lifecycle Management

| Event                 | What Happens                                                                      |
| --------------------- | --------------------------------------------------------------------------------- |
| **Install**           | Manifest reviewed → user approves → image pulled → registered as ToolModule       |
| **Update**            | New manifest compared → permission changes require re-approval → new image pulled |
| **Uninstall**         | Container removed → image deleted → tool data directory cleaned up                |
| **Disable**           | Tool remains installed but is not loaded into ToolRegistry                        |
| **Permission change** | Requires explicit user re-approval                                                |
