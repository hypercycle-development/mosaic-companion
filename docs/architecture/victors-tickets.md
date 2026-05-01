# Victor's Linear Tickets — Implementation Guide

> Reference for implementing assigned tickets. Ordered by logical dependency, not ticket number.
> We're going with Docker to ship fast. WASM is the right long-term choice — plan for migration.

---

## Execution Order

```
HYP-652 (Sandbox architecture)     ← Foundation, do first
    ↓
HYP-660 (Gatekeeper)              ← Depends on sandbox being defined
    ↓
HYP-664 (Debug output / Chronicle) ← Depends on IPC from gatekeeper work
    ↓
HYP-663 (Tool download UI)        ← Last, needs all backend pieces ready
```

---

## 🔧 HYP-652 — Implement Initial Sandbox / Vault Architecture

**Ticket:** Begin implementation of dual architecture (Core trusted / Sandbox untrusted).

### What to do

1. **Create a container launcher abstraction** in `electron/integrations/containers/`
   - `launcher.ts` — abstract interface: `launchTool()`, `stopTool()`, `listRunning()`
   - `docker-runtime.ts` — Docker implementation (uses `dockerode` npm package)
   - This abstraction is KEY for later swapping to WASM
2. **Implement container security defaults**
   - All containers launched with: `--cap-drop ALL`, `--read-only`, `USER 1001`, resource limits
   - No `:rw` mounts to shared data. Only:
     - `/inputs:ro` (pre-materialized data from Core)
     - `/chronicle` (append-only, Core-managed)
     - `/tmp` (ephemeral, if needed)

3. **Implement the `/init?key=<key>` protocol**
   - Generate a random UUID per container launch
   - Call the tool's init endpoint after startup
   - Store the key in Core for subsequent calls
   - See [container-communication.md](../architecture/container-communication.md)

4. **Register containerized tools as ToolModules**
   - Each running container becomes a `ToolModule` in the existing `ToolRegistry`
   - Same `<use_tool>` format for agents — transparent
   - Forward `ExecutionContext` (agentId) through tool calls

### Key files to create/modify

- `electron/integrations/containers/launcher.ts` (NEW)
- `electron/integrations/containers/docker-runtime.ts` (NEW)
- `electron/integrations/containers/types.ts` (NEW — container/manifest types)
- `electron/integrations/tools/modules/container-tool.ts` (NEW — ToolModule adapter)
- `electron/integrations/tools/index.ts` (register container tools)

### Dependencies

- `dockerode` — Node.js Docker API client
- Docker must be installed on the host machine (detect + warn if missing)

### Gotchas

- Docker Desktop on macOS/Windows — detect platform and guide user
- Docker socket path differs: `/var/run/docker.sock` (Linux/macOS) vs named pipe (Windows)
- Container startup time: ~1-5 seconds. Show loading state in UI.

---

## 🛡️ HYP-660 — Implement Gatekeeper for Tools

**Ticket:** Must log inputs and outputs. Flexible enough to expand logging later.

### What to do

1. **Create the Gatekeeper module** in `electron/integrations/gatekeeper/`
   - `gatekeeper.ts` — main logic: filter chain, allow/deny decisions
   - `filters/domain-filter.ts` — domain allowlist from manifest
   - `filters/pii-filter.ts` — basic regex PII detection (emails, phones, SSNs)
   - `logger.ts` — append-only log of all gatekeeper decisions

2. **Implement domain allowlist filtering**
   - Parse `allowed_domains` from tool manifest
   - Resolve domains to IPs at tool launch (keep a cache)
   - Re-resolve periodically (every 5 min?) to handle DNS changes
   - Block requests to non-allowed IPs

3. **Set up DNS proxy or HTTP proxy**
   - **Research needed:** Which approach works best in practice?
   - Option A: Custom DNS resolver (container DNS points to MosAIc)
   - Option B: HTTP proxy with `HTTP_PROXY` env var in container
   - Option C: DNS + IP filtering combo (Barry's recommendation)
   - **HTTPS challenge:** Can inspect domain via DNS, but not content
   - Test with `curl` inside a container to validate it "just works" for tool devs

4. **Docker network configuration**
   - Create `mosaic-tools` Docker network
   - Tools without internet: `--network=mosaic-internal` (no outbound)
   - Tools with internet: `--network=mosaic-tools` (routes through gatekeeper)

5. **Logging format**
   ```jsonl
   {"ts":"2026-03-05T10:00:00Z","tool":"data-analyzer","dest":"api.openai.com","action":"ALLOW","profile":"limited"}
   {"ts":"2026-03-05T10:00:01Z","tool":"data-analyzer","dest":"evil.com","action":"DENY","reason":"not_in_allowlist"}
   ```

### Key insight from Barry (Mar 04)

> "For tools, security checks should be hard — specific domain allowlists. For agents, use softer guardrails (NLP, warnings). NLP is easy to bypass, so it's fine for agents but not for tools."

### Open research

- How well does `HTTP_PROXY` env var work with popular libraries (requests, axios, fetch)?
- Can we force containers to use HTTP-only and have the proxy upgrade to HTTPS?
- DNS proxy libraries for Node.js?

---

## 📝 HYP-664 — Implement Debug Output for Tools

**Ticket:** Enable IPC port for tools to log data. Append-only. Never modify or delete.

### What to do

1. **Create Chronicle module** in `electron/integrations/chronicle/`
   - `chronicle.ts` — append-only log management
   - One Chronicle file per tool: `~/.config/mosaic-companion/chronicles/<tool_id>/chronicle.jsonl`
   - `readChronicle(toolId)` — read all entries (for UI display)
   - `appendToChronicle(toolId, entry)` — append only, no update/delete API

2. **Expose Chronicle API to containers**
   - MosAIc runs a small HTTP server that containers can call:
   - `POST /chronicle/append` with `X-Mosaic-Key` header
   - Core validates the key, adds the entry to the tool's Chronicle
   - Response: `{ "success": true, "entryId": "..." }`

3. **Chronicle is also used by the Gatekeeper**
   - Gatekeeper decisions are written to the tool's Chronicle
   - This means the Chronicle captures BOTH:
     - Tool's own logs (via API)
     - Gatekeeper audit trail (automated by Core)

4. **Entry format**

   ```json
   {
     "id": "entry-1709654400000",
     "timestamp": "2026-03-05T10:00:00Z",
     "source": "tool" | "gatekeeper" | "core",
     "type": "log" | "output" | "audit" | "error",
     "data": { ... }
   }
   ```

5. **Enforcement**
   - v1: Soft enforcement — no delete/update API exists, so append-only is structural
   - v2: Hardened — content-addressed hashing, tamper detection

### Robert's vision for Chronicle (from Mar 03 meeting)

The Chronicle is more than a debug log. It serves:

- **Security audits** — what did the tool do?
- **Debugging** — reproduce issues
- **Data mining** — extract patterns from tool behavior
- **State reconstruction** (future) — kill container + reconstruct from Chronicle

---

## 🖥️ HYP-663 — Create Tool Download UI

**Ticket:** Must request permission from user. Must log all actions/errors to debug file.

### What to do

1. **Create Tool Registry page** in `src/components/ToolRegistryPage.tsx`
   - Browse available tools (from private registry)
   - Tool cards showing: name, description, version, permissions requested
   - Install button → triggers permission approval flow

2. **Permission approval modal**

   ```
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
   ```

   - Warn more aggressively for more permissions
   - Show recommended profile

3. **Installed tools management**
   - List installed tools
   - Start/stop controls
   - View Chronicle (debug log)
   - Uninstall (removes image + data)
   - Update (compare manifests, re-approve if permissions changed)

4. **Download + install flow**
   - Fetch manifest from registry
   - Show approval UI
   - Pull Docker image (show progress)
   - Register as ToolModule
   - Log everything to debug file (append-only)

5. **Error handling**
   - Docker not installed → show install instructions
   - Image pull failed → retry with clear error
   - Container won't start → show debug logs
   - All errors logged to `~/.config/mosaic-companion/tool-install.log`

---

## Wallet Integration (Context — Not Your Ticket)

From the Mar 03 daily and Robert meeting:

- **MosAIc creates wallets** — no import. Users should only put in what they're willing to lose.
- **Agents can have their own wallets** inside containers — user transfers from MosAIc wallet to agent wallet
- **Joaquin is working on the wallet component** (create only, no import)
- Payment rails: USDC on Base + TODA TDN
- Paid tool registry is deferred — not Phase 1

---

## Implementation Tips

### Docker detection

```typescript
import Docker from "dockerode";

async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}
```

### WASM migration path

Design the `Launcher` interface so it can later be implemented by a `WasmRuntime`:

```typescript
interface ContainerLauncher {
  launch(manifest: ToolManifest): Promise<RunningTool>;
  stop(toolId: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}

// v1: DockerLauncher implements this
// future: WasmLauncher implements this
```

This way, swapping Docker for WASM later only requires a new implementation of this interface — no changes to ToolRegistry, Gatekeeper, Chronicle, or UI.
