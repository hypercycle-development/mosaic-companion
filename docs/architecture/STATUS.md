# Status of this documentation set

**Last verified:** 2026-08-20, against commit `2d920ce`. Still accurate at
`6a19a8b`: the intervening change touched the README, `setup.sh` and the package
engines only — nothing under `electron/`.

This directory is **not currently a reliable description of the implementation.**
It is stratified by date and the strata disagree with each other.

- Documents dated **2026-03-05 and earlier** describe a **Docker-based runtime
  that was never built.**
- Documents dated **2026-03-17** describe the **WebAssembly runtime that was
  actually built**, and are broadly accurate.

Both layers are still present. A reader entering through `README.md` meets the
superseded layer first. Until that is reconciled, use this page to tell them
apart.

## Which documents describe what

| Document | Stratum | Use with |
| --- | --- | --- |
| `implementation-status.md` | WASM (2026-03-17) | Confidence |
| `tool-lifecycle.md` | WASM (2026-03-17) | Confidence, except D4 below |
| `tool-ui.md`, `tool-panels-ui.md` | UI contracts, runtime-independent | Confidence |
| `README.md`, `overview.md` | **Docker-era** | Caution — see D1 |
| `permissions.md` | **Docker-era** | Caution — see D5, D7 |
| `container-communication.md` | **Docker-era** | Superseded — see D3 |
| `data-model.md`, `execution-plan.md`, `gatekeeper.md` | **Docker-era** | Caution — see D2, D3 |
| `glossary.md`, `manifest.md` | Mixed | Caution |
| `victors-tickets.md` | Docker-era work log | Historical |

## Known divergences

| # | Subject | Severity |
| --- | --- | --- |
| D1 | Docker described as a required runtime; it is not used | High |
| D2 | Input delivery by bind mount; inputs are Extism config values | High |
| D3 | Container HTTP protocol and access-key handshake; neither exists | High |
| D4 | Outbound audit described as complete; one of two paths is unaudited | Medium |
| D5 | `docker.sock` hardening path; moot without Docker | Medium |
| D6 | Launch profiles (`strict`/`limited`/`relaxed`) are not implemented | Medium |
| D7 | Resource permissions for CPU, disk and GPU; only memory and timeout exist | Low |
| D8 | The add-on system does not appear in this set at all | High |

**D1 — Docker as a required runtime.** `README.md` and `overview.md` state that
Docker is a hard dependency users must install. No `DockerLauncher` exists;
`electron/integrations/sandbox/wasm-launcher.ts` is the only `ToolLauncher`
implementation. This is the most consequential divergence — a reader entering
through `README.md` forms an entirely wrong model of the runtime.

**D2 — Input delivery.** The documents describe files being materialised into a
container and mounted at `/inputs:ro`. No mount exists. Inputs are injected as
Extism config values and read by the guest through `Config.get()`.

**D3 — Container HTTP protocol.** The documents specify an in-container HTTP
server, an access-key handshake, and a `POST /chronicle/append` endpoint. None
exists. The Chronicle is written by direct host function call in-process.

**D4 — Outbound audit completeness.** `tool-lifecycle.md` states that all
outbound HTTP is logged to the Chronicle. That holds for the
`mosaic_http_request` path only; the Extism `allowedHosts` path is unaudited.
The security boundary is the same allowlist in both cases — what differs is
observability.

**D5 — `docker.sock` hardening.** `permissions.md` accepts `docker.sock`
mounting for v1 and sets out a hardening path. Moot without Docker, but it
remains in the document unqualified.

**D6 — Launch profiles.** The `strict` / `limited` / `relaxed` profiles, with
their content-filtering and PII columns, are not implemented. No profile
machinery exists in the sandbox.

**D7 — Resource permissions.** The documented set includes `cpu`, `disk` and
`vram`/`gpu`. The manifest schema carries `memory` and `timeout` only.

**D8 — Add-on system absent.** The add-on system does not appear in this set. It
is the highest-privilege execution substrate in the application, and a new
engineer directed to read this directory will not learn that it exists.

## Reconciling this

Tracked as an issue. Until it is closed, treat `implementation-status.md` as the
most reliable account of what is built, and read anything mentioning Docker as a
description of a design that was considered and not implemented.
