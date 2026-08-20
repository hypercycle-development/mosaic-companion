# Container Communication Protocol

> [!WARNING]
> **Parts of this document describe a Docker-based runtime that was never built.**
> The implemented runtime is WebAssembly via Extism. See
> [STATUS.md](./STATUS.md) for what in this set is accurate and what is
> superseded. Last verified 2026-08-20 against `2d920ce`.

How MosAIc communicates with tool containers at runtime.

> Source: March 03 meeting with Robert + team discussion.

---

## Overview

```
MosAIc (Core)                    Tool Container
┌──────────┐                     ┌──────────────┐
│          │   /init?key=abc123  │              │
│  Electron │ ──────────────────→ │  HTTP Server │
│  Main     │                     │  (any lang)  │
│  Process  │   /tool_call       │              │
│          │ ──────────────────→ │  Handles     │
│          │ ←────────────────── │  request     │
│          │   { result }        │              │
└──────────┘                     └──────────────┘
      ↑                                │
      │                                │
      │    ← Outbound (if allowed) ←  │
      │         via Gatekeeper         │
```

## Protocol

### 1. Container Startup

MosAIc starts the container with resource limits and network config:

```bash
docker run \
  --cap-drop ALL \
  --read-only \
  --cpus=1 --memory=512m \
  --network=mosaic-tools \
  -p <dynamic_port>:<tool_port> \
  registry.mosaic.ai/tool-name:1.0.0
```

### 2. Initialization (Access Key)

Once the container is running, MosAIc calls the init endpoint:

```
POST http://localhost:<port>/init?key=<random_uuid>
```

The tool saves this key. All subsequent calls must include it. This prevents:

- Other processes on the machine from calling the tool
- Network-level access from other machines (combined with bridge networking)

### 3. Tool Calls

MosAIc invokes tool functions via HTTP:

```
POST http://localhost:<port>/call
Headers:
  X-Mosaic-Key: <the_init_key>
  Content-Type: application/json
Body:
  {
    "function": "analyze",
    "args": { "text": "..." }
  }
```

Response:

```json
{
  "success": true,
  "data": { "wordCount": 42, "sentiment": "positive" }
}
```

### 4. No HTTPS Required

Communication is localhost (same machine). No encryption needed. This also means:

- No TLS certificate management
- No certificate rotation
- Simpler tool developer experience

### 5. Container Shutdown

MosAIc stops and removes the container after use (or after timeout):

```bash
docker stop <container_id>
docker rm <container_id>
```

---

## Tool Developer Requirements

A tool image must:

1. **Expose an HTTP server** on a configurable port
2. **Accept `/init?key=<key>`** and store the key
3. **Require the key** on all subsequent requests (via header or query param)
4. **Respond with JSON** to all tool calls
5. **Run as non-root** (`USER 1001`)
6. **Work with read-only root filesystem** (`--read-only`)

### Minimal Tool Example (Python)

```python
from flask import Flask, request, jsonify
import os

app = Flask(__name__)
access_key = None

@app.route('/init')
def init():
    global access_key
    access_key = request.args.get('key')
    return jsonify({"status": "initialized"})

@app.route('/call', methods=['POST'])
def call():
    if request.headers.get('X-Mosaic-Key') != access_key:
        return jsonify({"error": "unauthorized"}), 401

    data = request.json
    # ... tool logic here ...
    return jsonify({"success": True, "data": result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
```

### Minimal Tool Example (Node.js)

```javascript
const express = require("express");
const app = express();
let accessKey = null;

app.use(express.json());

app.get("/init", (req, res) => {
  accessKey = req.query.key;
  res.json({ status: "initialized" });
});

app.post("/call", (req, res) => {
  if (req.headers["x-mosaic-key"] !== accessKey) {
    return res.status(401).json({ error: "unauthorized" });
  }
  // ... tool logic ...
  res.json({ success: true, data: result });
});

app.listen(process.env.PORT || 8080);
```

---

## Language Flexibility

Tools can be written in **any language** — Python, Node.js, Go, Rust, Java, etc. The only requirement is:

- An HTTP server
- JSON request/response
- Accept the init key protocol

This is intentionally simple so tool developers don't need specialized SDKs.

---

## Chronicle Integration

Tools can write to their Chronicle via a Core-provided API:

```
POST http://<mosaic_host>:<chronicle_port>/chronicle/append
Headers:
  X-Mosaic-Key: <init_key>
Body:
  {
    "type": "log",
    "data": { "action": "processed_file", "details": "..." }
  }
```

This is the **only write path** available to tools. All Chronicle writes are:

- Append-only (no update/delete)
- Attributed to the tool ID
- Timestamped by Core

---

## Outbound Internet Access

If a tool has internet permission, outbound requests go through the Gatekeeper:

```
Tool Container → Docker Bridge Network → Gatekeeper (proxy/DNS) → Internet
```

See [gatekeeper.md](./gatekeeper.md) for filtering details.

If internet is NOT permitted, the container is placed in an isolated Docker network with no outbound route except back to MosAIc.

---

## Security Considerations

| Concern                            | Mitigation                         |
| ---------------------------------- | ---------------------------------- |
| External access to tool port       | Docker bridge network + access key |
| Tool impersonating another tool    | Unique key per container instance  |
| Tool persisting state across runs  | Read-only root filesystem          |
| Tool consuming excessive resources | `--cpus` / `--memory` limits       |
| Tool elevated privileges           | `--cap-drop ALL`, non-root user    |

---

## Future: Agent Containers

The same communication protocol applies to future agent containers (more autonomous, long-running). Additional considerations for agents:

- Agents may need **VRAM/GPU access** for running local LLMs
- Agents may have their own **wallets** (created inside the container, funded by user transfers from MosAIc wallet)
- Agents may run for extended periods (not just per-call)
- Agent Chronicle would capture richer behavioral data (for data mining and state reconstruction)

> "Tools" is step 1 of the container journey. Agents in containers is a natural extension using the same infrastructure.
