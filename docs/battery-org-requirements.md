# Battery Org Compute Integration — Requirements from David Kam

**Meeting date:** 2026-06-03
**Integration target:** Mosaic Companion Stargate → Compute & Nodes panel (parallel to existing node factories)
**Goal:** Beta test Battery Box (location + energy + compute) as an alternative compute source; route inference jobs through Battery Org and monetize.

---

## 1. API Authentication
| # | Question | Why we need it |
|---|----------|---------------|
| 1.1 | **What auth scheme?** (API key header, OAuth2, JWT, mTLS?) | We need to configure the Stargate adapter so every request carries correct credentials securely. |
| 1.2 | **How do we receive the key?** (encrypted email, secure portal, direct handoff?) | Prevents leakage. We will store it in the Electron main-process encrypted store. |
| 1.3 | **Key rotation / expiry policy?** | We must build re-auth or alerting before keys expire. |
| 1.4 | **Rate limits per key?** (requests/min, concurrent jobs) | So we can throttle or queue requests in the Stargate pool. |

## 2. Base URL & Endpoint Schema
| # | Question | Why we need it |
|---|----------|---------------|
| 2.1 | **Base URL for the Battery Org API?** (e.g. `https://api.battery.org/v1`) | Root for all adapter calls. |
| 2.2 | **OpenAPI / Swagger spec or Postman collection?** | Auto-generate TypeScript types and validation. |
| 2.3 | **Required headers on every request?** (e.g. `X-Battery-Version`, `Accept: application/json`) | Our fetch wrapper must attach them. |

## 3. Node Discovery & Metadata
| # | Question | Why we need it |
|---|----------|---------------|
| 3.1 | **Endpoint to list active Battery Boxes?** | We will poll this to populate the Stargate Compute & Nodes grid. |
| 3.2 | **JSON schema for a single Battery Box?** Fields we expect: `id`, `name`, `location` (lat/lon or region string), `energy_source`, `gpu_count`, `gpu_model`, `tflops`, `vram_gb`, `is_available`, `price_per_hour_usd`, `supported_frameworks`. | Drives the UI cards and filtering. |
| 3.3 | **How do we know which models / frameworks each box supports?** (CUDA, ROCm, CPU-only, specific Docker images?) | So we route compatible inference jobs only. |
| 3.4 | **Static pool or dynamic auto-scaling?** | Affects whether we cache the list or refresh every 30s. |

## 4. Health & Availability
| # | Question | Why we need it |
|---|----------|---------------|
| 4.1 | **Health-check endpoint per box?** (HTTP GET returning `{"status":"ok"}` or similar) | Stargate will display online/offline badges. |
| 4.2 | **Expected response time / timeout?** | We set the `AbortSignal` threshold in the UI probe. |
| 4.3 | **Any push/webhook status updates?** (box goes offline, maintenance mode) | Better than polling; lets us show real-time state. |

## 5. Job Submission (Inference)
| # | Question | Why we need it |
|---|----------|---------------|
| 5.1 | **Endpoint to submit an inference job?** (POST body schema) | Core routing path: Stargate user clicks "Use AIM" → POST to Battery Org. |
| 5.2 | **Supported input formats?** (raw JSON, OpenAI-compatible `/v1/chat/completions`, Anthropic Messages, or custom?) | Determines whether we reuse existing `AIService` adapters or build a new one. |
| 5.3 | **Streaming response supported?** (SSE, chunked JSON, WebSocket) | Affects the UI chat-streaming implementation. |
| 5.4 | **Max payload size?** (MB limit for prompts / images / audio) | We need client-side validation before upload. |
| 5.5 | **Timeout / max runtime per job?** | So we can show progress spinners and auto-cancel stuck jobs. |
| 5.6 | **Job queue depth or back-pressure signal?** | If boxes are full, we need to fallback to another provider or show "busy". |

## 6. Job Tracking & Results
| # | Question | Why we need it |
|---|----------|---------------|
| 6.1 | **How do we query job status?** (GET by `jobId`, webhook callback, long-polling?) | Stargate will show a "Running on Battery Org" indicator. |
| 6.2 | **How do we fetch the final result / logs / errors?** | For the "Details" drawer and debugging. |
| 6.3 | **Job retention / TTL?** (how long are results stored after completion?) | So we know whether to cache locally. |

## 7. Pricing & Metering
| # | Question | Why we need it |
|---|----------|---------------|
| 7.1 | **Pricing model?** (per token, per second, per job, per GPU-hour?) | Drives the cost estimator shown before the user clicks "Run". |
| 7.2 | **Endpoint to fetch current price list or rate card?** | We can display real-time "Est. $0.004 / 1K tokens" on each box card. |
| 7.3 | **How do we retrieve usage / billing reports?** (daily/weekly API or CSV export?) | For our internal Stargate Credits reconciliation before on-chain settlement. |
| 7.4 | **Currency?** (USD, USDC, native token?) | Determines the payment adapter layer. |

## 8. Network & Connectivity
| # | Question | Why we need it |
|---|----------|---------------|
| 8.1 | **Static IPs or dynamic DNS for the boxes?** | Firewall allow-listing if users run behind corporate proxies. |
| 8.2 | **VPN / tunnel required?** (WireGuard, Tailscale, etc.) | May need an Electron-side tunnel daemon. |
| 8.3 | **Regions / latency targets?** | For a "closest box" auto-select feature. |

## 9. AIM / Model Packaging
| # | Question | Why we need it |
|---|----------|---------------|
| 9.1 | **Do Battery Boxes run standard Ollama / vLLM / TGI containers, or a custom runtime?** | Determines how we package community AIMs for deployment. |
| 9.2 | **Can operators upload custom models, or is it a fixed catalog?** | If operators can upload, we need an "Aimify" flow to convert Hermes AIMs → Battery Box format. |
| 9.3 | **Model manifest / metadata format?** (name, version, quantization, context length, supported modalities) | For the Stargate AIM registry entry. |

## 10. Legal & Beta Terms
| # | Question | Why we need it |
|---|----------|---------------|
| 10.1 | **Beta SLA / uptime commitment?** | Sets user expectations in the UI. |
| 10.2 | **Data retention & privacy policy?** (prompt logs, model weights, user data) | Required disclosure before routing user inference through Battery Org. |
| 10.3 | **Termination / off-boarding process?** (how quickly can we disable a box?) | Operational safety. |
| 10.4 | **Revenue share or reseller agreement draft?** | So we know how Stargate monetizes the routing. |

---

## Deliverables we will produce once reqs are received
1. `BatteryOrgAdapter.ts` — typed API client wrapping the above endpoints.
2. `BatteryOrgPool.ts` — node discovery + health polling + load balancer.
3. UI additions in Stargate Compute & Nodes: Battery Box cards, price estimator, "Use Battery Box" CTA.
4. Integration test harness (mock server + real ping to David's staging box).

**Est. dev effort after full requirements: 1–2 days.**
