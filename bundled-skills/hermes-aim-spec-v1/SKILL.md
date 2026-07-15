---
name: hermes-aim-spec-v1
description: "HermesAIMSpec v1.0.1 — Formal standard for Hermes agent AIM modules on HyperCycle nodes. Includes manifest schema, endpoint contracts, capability registry, cost model, deployment requirements, wrapper contract, validation scripts, and production Docker pitfalls."
trigger: "When building, validating, or deploying a Hermes agent as a HyperCycle AIM. When formalizing AIM contracts or integration standards. When creating node factory compatibility specs. When debugging AIM container crashes or Dockerfile build failures."
category: blockchain
version: 1.0.1
---

# HermesAIMSpec v1.0.0

## Quick Start

Run validator:
```bash
cd ~/Cardano/mosaic-hermes-aim
python3 validate_spec.py
```

Or use the deterministic probe (no manual setup):
```bash
node scripts/validate-aim-image.js 1.0.2
```

## Canonical Files

| File | Purpose | Status |
|------|---------|--------|
| `HermesAIMSpec-v1.md` | Formal spec (authority) | VALIDATED |
| `manifest.json` | AIM manifest with `mosaic_aim` extension | VALIDATED |
| `config.yml` | aim-py-gen configuration | VALIDATED |
| `Dockerfile` | Production container build | VALIDATED |
| `requirements.txt` | Minimal dependencies (no ML bloat) | VALIDATED |
| `mosaic_hermes_wrapper.py` | HermesAIMWrapper reference impl | VALIDATED |
| `app/main.py` | Uvicorn server with endpoints | VALIDATED |
| `validate_spec.py` | Automated compliance checker | VALIDATED |
| `references/` | Reference implementations and templates | VALIDATED |

## Spec Validation Results (2026-05-20)

- **Passed:** 54
- **Warnings:** 0
- **Errors:** 0

## HermesAIMWrapper Contract

```python
class HermesAIMWrapper:
    def __init__(self, base_url: str, model: str)
    def chat(self, message: str, system_prompt: str="") -> (str, int)
    def health(self) -> (str, int)
    def capabilities(self) -> (str, int)
```

All methods return `(result_json_string, cost_in_pu)`.

## Critical Dependencies Pin

```
starlette<0.30
uvicorn<0.30
anyio<4
```

## Container Gotchas

1. `pyhypercycle-aim/disks.py` requires `/container_mount` dirs — create in Dockerfile
2. Starlette `on_startup` removed in v1.0+ — pin `<0.30`
3. Template bug in `main.py.tmpl`: undefined `cost` variable — post-process with `(response, cost) = self.model.chat(...)`
4. Default `requirements.txt` pulls torch/transformers/accelerate — override with minimal deps for Hermes bridge
5. **WRAPPER FILE NOT IN APP/** — `mosaic_hermes_wrapper.py` must be explicitly `COPY`ed into `app/` directory alongside `main.py` — see `references/dockerfile-pitfalls.md`
6. **PYHYPERCYCLE-AIM SOURCE MISSING FROM BUILD CONTEXT** — `pyhypercycle-aim/` must be present in Docker build context or COPY fails — see `references/dockerfile-pitfalls.md`

## Reference Files

- `references/dockerfile-pitfalls.md` — Production Docker build failures, network modes, container mount requirements
- `references/HermesAIMWrapper-reference.py` — Canonical wrapper implementation with (content, cost) contract
- `templates/config.yml` — aim-py-gen starter configuration

## Docker Image

```bash
docker build -t mosaic-hermes-aim:1.0.1 .
docker run -d -p 4000:4000 -e HERMES_BASE_URL=http://host.docker.internal:3000 mosaic-hermes-aim:1.0.1
```

## Reference Files

- `references/dockerfile-pitfalls.md` — Production Docker build failures, network modes, container mount requirements
- `references/orchestration-philosophy.md` — Strategic architecture: agent deployment OS, priority order, registry schema roadmap
- `references/HermesAIMWrapper-reference.py` — Canonical v1 wrapper implementation with (content, cost) contract
- `references/v2-real-embedded-pattern.md` — **v2 real embedded AIM: lazy-init AIAgent, PYTHONPATH fix, port 8006 registration, ANFE license requirement**
- `references/aim-registry-schema-v1.md` — AIM Registry Schema v1.0.0: signed manifests, version lineage, compatibility ranges, trust metadata
- `references/anfe-deployment-reference.md` — Live ANFE deployment proof: node discovery, routing test, metrics, Docker fixes
- `templates/config.yml` — aim-py-gen starter configuration
- `scripts/validate-aim-image.js` — Deterministic probe: starts mock Hermes, runs container, tests all endpoints, writes persistent history
- `references/context-floor-workaround.md` — Hermes Agent 64K minimum context floor workaround for local models
- `references/stargate-provider-filters.md` — Mosaic Stargate Dashboard provider string mismatch pitfall

## Docker Image

```bash
docker build -t mosaic-hermes-aim:1.0.2 .
docker run -d -p 4000:4000 --add-host=host.docker.internal:host-gateway -e HERMES_BASE_URL=http://host.docker.internal:3000 mosaic-hermes-aim:1.0.2
```

Or validate immediately:
```bash
node scripts/validate-aim-image.js 1.0.2
```

## Node Manager API Operations

### Port Distinction (CRITICAL)
- **Port 8000** → Public AIM handler. Routes `GET /aim/{slot}/health`, `/aim/{slot}/chat`. Returns `405 Method Not Allowed` for admin operations.
- **Port 8006** → Admin API. Use for `POST /api/add_aim`, `GET /api/list_aims`. This is where AIMs are registered and managed.

### AIM Port Range
HyperCycle assigns port numbers based on `config.aim_start_port` (typically `9000`). Passing arbitrary ports (e.g., 4000, 30000) returns `{"error":"Invalid AIM port"}`. Always use the node's configured range.

- Slot index = `port - aim_start_port`
- Public health endpoint: `http://localhost:{aim_start_port + slot}/health`

### Registration Example
```bash
curl -s -X POST http://localhost:8006/api/add_aim \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "real-hermes-aim",
    "tag": "real-hermes-aim:v2.0.0",
    "port": 9000,
    "environment": {
      "HERMES_MODEL": "kimi-k2.6",
      "HERMES_PROVIDER": "ollama",
      "HERMES_BASE_URL": "http://host.docker.internal:11434",
      "PYTHONPATH": "/opt/hermes-agent"
    }
  }'
```

### License Requirement
If the node returns `{"error":"Node does not have a license assigned"}`, the HyperCycle node does not have an active ANFE license. Register the ANFE node license through the Node Manager UI before deploying AIMs.

### Real vs Proxy Architecture
- **v1 (DEPRECATED):** HTTP proxy wrapper forwarding to `HERMES_BASE_URL`. Required external Hermes server. Brittle, mock-like.
- **v2 (CURRENT):** Real embedded `AIAgent` imported from `run_agent.py` with `PYTHONPATH=/opt/hermes-agent`. No external HTTP dependency. Lazy-init on first `chat()`.

```python
# v2 wrapper pattern — lazy-init
class HermesAIMWrapper:
    def __init__(self):
        self._agent = None
        self._agent_ready = False
    def _ensure_agent(self):
        if self._agent is not None: return
        from run_agent import AIAgent
        self._agent = AIAgent(model=..., quiet_mode=True, ...)
    def chat(self, message):
        self._ensure_agent()
        return self._agent.chat(message)
```

## Validation Checklist (§12)

- [ ] `GET /manifest.json` returns all required fields
- [ ] `manifest.mosaic_aim.hermes_spec_version` is `1.0.0`
- [ ] `GET /health` returns 200 + JSON
- [ ] `GET /capabilities` returns 200 + JSON
- [ ] `POST /chat` returns 200 + response + costs
- [ ] `POST /chat` with `cost_only: true` returns costs without execution
- [ ] Docker image builds and starts successfully
- [ ] Healthcheck passes after startup
- [ ] All environment variables are overridable at runtime
- [ ] **Container starts without `ModuleNotFoundError`** (wrapper file must be COPYed into `app/`)
- [ ] **Mock server reachable from container** (bind to `0.0.0.0`, use `host.docker.internal`)
- [ ] **Port 4000 not occupied** (check with `ss -tlnp | grep :4000`)
- [ ] **Node has active ANFE license** (`POST /api/add_aim` must not return license error)
- [ ] **Port is in node AIM range** (check `aim_start_port` in node config, typically 9000+)

## Registry Schema

See `../hypercycle-aimifier/references/aim-registry-schema-v1.md` for the full AIM Registry Schema v1.0.0.

Key fields:
- `entry_id`, `name`, `version`, `image.digest`
- `manifest.mosaic_aim` extension object
- `capabilities.aim_type`, `capabilities.interfaces`
- `deployment.container_port`, `deployment.healthcheck`
- `provenance.build_signature` (ecdsa-secp256k1)
- `lineage.parent_entry_id`, `lineage.compatibility_range`

Canonical registry stored at: `~/Cardano/mosaic-hermes-aim/registry/index.json`
## Pipeline History Requirement

Every deployment MUST persist:
- Manifest JSON
- Per-stage outputs and logs
- Timing metrics (generation, build, validation, startup, registration, first inference)
- Failure traces (if any)
- Deployment target (local node URL)
- Image hash/tag
- Registration ID / aimIndex

Storage: `~/Cardano/mosaic-hermes-aim/deployment-history/` or equivalent.
This data becomes orchestration analytics, rollback intelligence, and node reliability scoring.
