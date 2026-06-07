# Mosaic Hermes AIM

## What This Is

A production-ready HyperCycle AIM (Adaptive Intelligence Module) that runs Hermes Agent inside a Docker container, exposing chat/completion endpoints through the HyperCycle Node Manager's slot-based routing system.

## Architecture

```
User ──HTTP──→ Node Manager (port 8000) ──proxy──→ AIM Container (port 9000, slot 0)
                                                      │
                                                      └───HTTP──→ Ollama (port 11434)
```

The AIM proxies to Ollama's OpenAI-compatible `/v1/chat/completions` endpoint. Any Ollama model can be used (default: `kimi-k2.5:cloud`).

## Files

| File | Purpose |
|------|---------|
| `app/main.py` | HyperCycle AIM server (Uvicorn + Starlette) with `/chat`, `/health`, `/manifest.json` |
| `manifest.json` | AIM metadata + endpoints spec (required by Node Manager proxy) |
| `Dockerfile` | Multi-stage container with pyhypercycle-aim bundled |
| `requirements.txt` | Python deps including bundled pyhypercycle-aim |
| `scripts/anfe-deploy-validate.js` | Full deployment validation test (local + Node Manager) |
| `scripts/deploy-validate.js` | Lightweight deployment checker |
| `ANFE-Deployment-Validation-Report.md` | Validation report from latest test run |

## Deployment States

Our six-tier deployment model:

1. **LOCAL_VALIDATED** — Image builds, container runs, endpoints verified locally
2. **REGISTRY_PUBLISHED** — Image in reachable registry (local or remote)
3. **NODE_REGISTERED** — Node Manager knows the AIM image + slot assignment
4. **ANFE_DEPLOYED** — Container persistent with `--restart unless-stopped`
5. **ROUTING_VERIFIED** — `POST /aim/{slot}/chat` returns real AIM response
6. **PRODUCTION_ACTIVE** — Real Hermes backend (Ollama) connected and inferencing

## Deployment

### Local Docker Registry (for HyperCycle node on same machine)

```bash
# Start local registry for Node Manager access
docker run -d -p 5000:5000 --restart unless-stopped --name registry registry:2

# Build and push
docker build -t mosaic-hermes-aim:1.0.4 .
docker tag mosaic-hermes-aim:1.0.4 localhost:5000/mosaic-hermes-aim:1.0.4
docker push localhost:5000/mosaic-hermes-aim:1.0.4

# Deploy directly to port 9000 (slot 0) — Node Manager must have slot 0 mapped to port 9000
docker run -d --name mosaic-hermes-aim-production --restart unless-stopped \
  -p 9000:4000 \
  -e HERMES_BASE_URL=http://host.docker.internal:11434 \
  -e HERMES_MODEL=kimi-k2.5:cloud \
  --add-host=host.docker.internal:host-gateway \
  localhost:5000/mosaic-hermes-aim:1.0.4
```

### Verify

```bash
# Direct AIM test
curl -X POST http://localhost:9000/chat -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Via Node Manager proxy (slot 0)
curl -X POST http://localhost:8000/aim/0/chat -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

## Config Mismatch Note

The Node Manager's internal config (`setup.json`) is encrypted and currently stores `real-hermes-aim:v2.0.0` with `status=download_failed` for slot 0. Official Node Manager config update is required for the metadata to reflect the new image. **However**, routing works because the proxy is port-based — as long as slot 0 → port 9000, requests flow correctly.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_BASE_URL` | `http://localhost:3000` | Ollama / Hermes backend URL |
| `HERMES_MODEL` | `kimi-k2.5:cloud` | Default model to use |
| `PORT` | `4000` | Internal AIM server port (must be read from env at runtime) |

> **Important:** When Aimify deploys this AIM, it assigns a random port (49000-49999) and injects it via the `PORT` environment variable. The AIM server **must** read `PORT` dynamically at startup. Hardcoding a port causes health checks to fail with "connection reset by peer."

In `app/main.py` this is already handled correctly:
```python
self.port = int(port or os.environ.get("PORT", "4000"))
```

## Dependencies

- `pyhypercycle-aim` — Bundled from `https://github.com/hypercycle-development/pyhypercycle-aim`
  (see `../../external/pyhypercycle-aim` for submodule or copy source into build context)

## Version

`1.0.4` — Manifest includes `endpoints` array (required by Node Manager proxy)
