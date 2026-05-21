# Live ANFE Deployment Validation Report

**Date:** 2026-05-21
**Validator:** `anfe-deploy-validate.js`
**Status:** SUCCESS

---

## Node Under Test

| Field | Value |
|-------|-------|
| Node ID | `80ad4ea14c33cd2a` |
| Network | `mainnet` |
| API | `http://localhost:8000` |
| Admin UI | `http://localhost:8006` |
| Public IP | `187.161.142.27:8000` |
| Hardware | 66GB RAM / 22 cores / 1TB disk |
| Node version | `0.5.1` |
| Accepting currencies | `HyPC`, `USDC` |
| AIMs deployed (pre-test) | `[]` (zero) |

## Image Under Test

| Field | Value |
|-------|-------|
| Name | `mosaic-hermes-aim` |
| Tag | `1.0.2` |
| Baseline | `1.0.1` (fixed Dockerfile COPY for wrapper.py + manifest.json) |
| Size | ~543MB |
| Builder | Mosaic Companion Aimifier pipeline |

## Stage Timings

| Stage | Time (ms) |
|-------|-----------|
| MOCK_HERMES | 4 |
| PREFLIGHT | 44 |
| DEPLOY | 1,259 |
| TEST_AIM | 5 |
| TEST_NODE_ROUTING | 22 |
| MONITOR | 1,020 |
| STOP | 429 |
| **TOTAL** | **2,785** |

## Endpoint Results

### AIM Container Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /manifest.json` | 200 | Manifest with `mosaic_aim` extension |
| `GET /capabilities` | 200 | Capabilities metadata |
| `POST /chat` | 200 | Inference through Hermes proxy |

### Node Manager Routing

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /info` | 200 | Node metadata, aim[] list |
| `POST /balance` | 200 | Wallet balance layer |
| `GET aim/health (from node)` | 200 | AIM reachable from node perspective |

## Validation Script Location

```bash
cd ~/Cardano/mosaic-hermes-aim
node anfe-deploy-validate.js
```

## Critical Fixes Applied During Validation

1. **Dockerfile COPY for wrapper.py** — `app/main.py` imports `mosaic_hermes_wrapper` directly (same directory). The wrapper was not being copied into `app/` during build.
   - Fix: Added `COPY mosaic_hermes_wrapper.py ./app/mosaic_hermes_wrapper.py`
   - Fix: Added `COPY manifest.json ./app/manifest.json`

2. **pyhypercycle-aim in build context** — Missing from workspace.
   - Fix: Copied from `/tmp/pyhypercycle-aim` into `~/Cardano/mosaic-hermes-aim/`

3. **Docker bridge → host routing** — `host.docker.internal` not automatically available on Linux Docker.
   - Fix: `--add-host=host.docker.internal:host-gateway` on `docker run`

4. **Mock server binding** — `127.0.0.1` unreachable from container.
   - Fix: Mock Hermes bound to `0.0.0.0`

5. **Port collision on host** — `:4000` already occupied.
   - Fix: Mapped container → `14000:4000`

## Next Extension

When HyperCycle exposes a formal `/api/aim/{index}/register` endpoint, the `anfe-deploy-validate.js` script will be extended with:
1. Authenticated registration payload
2. AIM index slot allocation
3. On-chain license verification
4. Economic routing: cost comparison across node factories

## History File

```
~/Cardano/mosaic-hermes-aim/deployment-history/anfe-deploy-1779329044815.json
~/Cardano/mosaic-hermes-aim/deployment-history/latest-anfe-deploy.json
```