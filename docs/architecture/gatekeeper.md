# Outbound Gatekeeper

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

## Implementation Options (Under Research)

The engineering team is evaluating how to technically enforce the Gatekeeper. Key challenge: **HTTPS traffic is encrypted on the client (inside the container), making proxy interception difficult.**

### Option A: HTTP Proxy

```
Container → HTTP Proxy (in Core) → Internet
```

- Configure container environment with `HTTP_PROXY=http://mosaic-gatekeeper:8080`
- Proxy can inspect unencrypted HTTP requests fully
- **HTTPS problem:** Encrypted from the client. Options:
  - Use HTTP-only proxy (tools must accept HTTP) — simple but limiting
  - Use HTTPS MITM proxy with injected CA cert — complex, breaks some tools
  - Use CONNECT-based filtering (can see destination domain but not content) — practical compromise

### Option B: DNS Proxy

```
Container → DNS query → Mosaic DNS resolver → resolve or deny
Container → direct IP connection → Internet
```

- Set container DNS to Mosaic's DNS resolver
- Resolver only resolves domains on the allowlist; denies everything else
- **Pro:** Works with HTTPS — DNS is queried before encryption
- **Con:** Cannot inspect content or MIME types
- **Con:** Tool could bypass DNS if it knows the IP directly

### Option C: DNS + IP Filtering (Barry's Recommendation)

```
1. At tool launch, resolve allowed domains → get IP addresses
2. Set up IP-based firewall rules (iptables)
3. Only allowed IPs are reachable
4. DNS in container points to Mosaic resolver (for domain resolution)
```

- Most robust: even if a tool knows an IP, it can only reach allowed ones
- Resolves HTTPS problem (filtering at network level, not content level)
- **Con:** DNS records change — need periodic re-resolution
- **Con:** Cannot do content-level filtering (but that's a v2 concern)

### Recommended v1 Approach

Combine **DNS proxy** + **IP filtering** for domain enforcement, and add an **HTTP proxy** layer for tools that opt into content-level filtering:

```
                          ┌─ DNS Proxy (domain allowlist)
Tool Container ──────────┤
                          └─ IP Filter (resolved IPs from allowlist)
                                  │
                          ┌───────┴──────┐
                          │  If HTTP:    │  If HTTPS:
                          │  Full proxy  │  Domain-only filtering
                          │  + content   │  (no content inspection)
                          │  inspection  │
                          └──────────────┘
```

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

- **strict** — deny-by-default, allowlist only, full content filtering
- **standard** — manifest-declared domains, basic PII check
- **permissive** — allow most traffic, log everything (dev/testing)

Tool may recommend a profile; user may override.

---

## Open Questions

1. Exact PII rule set for v1 baseline — what patterns to include?
2. How to handle DNS record changes for IP filtering (re-resolution interval)?
3. Whether HTTPS MITM with injected CA is acceptable for some tools
4. Performance impact of proxy on high-throughput tools
5. How to handle WebSocket connections (persistent, bidirectional)
