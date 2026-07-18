# Stargate Integration Guide

## Where to Drop These Files

All new code is written to `/home/hyperai/stargate-improvements/`. It is **read-only safe** — nothing here overwrites existing Mosaic source. To integrate, copy or merge into the live project.

## Integration Steps

### 1. Services (copy into `src/services/`)

| New File | Replaces / Extends | Action |
|----------|-------------------|--------|
| `services/EnhancedLocalNodeBridge.ts` | `services/LocalNodeBridge.ts` | Import and call alongside existing bridge; does NOT replace it |
| `services/FleetDiscoveryService.ts` | New | New file |
| `services/UnifiedLeaderboardService.ts` | `services/AdaPortal/LeaderboardService.ts` | Replace or rename |
| `services/HermesAgentOrchestrator.ts` | New | New file |

**Important**: `EnhancedLocalNodeBridge.ts` imports `LocalNodeBridge.ts` — keep the existing file. Just add the new methods.

### 2. Components (copy into `src/components/`)

| New File | Injected Into | Replaces |
|----------|--------------|----------|
| `components/StargateTelemetryCard.tsx` | `Start` tab in AdaPortalPanel | Static "My Local Node" card |
| `components/StargateAIMPanel.tsx` | `AI Models` tab | Empty AIMs placeholder |
| `components/StargateRankingsView.tsx` | `Rankings` tab | Static leaderboardData rendering |
| `components/StargateFleetPanel.tsx` | `Hire Agents` tab | Static demo list |

### 3. Wiring into AdaPortalPanel.tsx

In `src/components/AdaPortalPanel.tsx`, import the new components:

```typescript
import StargateTelemetryCard from './StargateTelemetryCard';
import StargateAIMPanel from './StargateAIMPanel';
import StargateRankingsView from './StargateRankingsView';
import StargateFleetPanel from './StargateFleetPanel';
```

Then replace the rendered tab bodies:

```tsx
// Start tab
{activeTab === 'start' && (
  <>
    <StargateTelemetryCard />
    {/* ... rest of start tab */}
  </>
)}

// AI Models tab
{activeTab === 'ai_models' && <StargateAIMPanel />}

// Rankings tab
{activeTab === 'rankings' && <StargateRankingsView />}

// Hire Agents tab
{activeTab === 'hire_agents' && <StargateFleetPanel />}
```

### 4. Dependencies

All new components use only `@mui/material` and `@mui/icons-material` which are already project dependencies.

### 5. Dev Mode Behavior

| Feature | With Electron | Browser Dev (no Electron) |
|---------|------------|---------------------------|
| Telemetry Card | Shows CPU%, memory, AIM slots, Ollama models | Shows only localhost fetch data; Hermes process list is empty |
| AIM Panel | Same | Same (works in browser) |
| Rankings | HyperInsight IPC + local + Merkelizer | Falls back to local node + cached data |
| Fleet Panel | mDNS discovery + registry + spawn kanban | Registry fetch only; mDNS not available |

### 6. Read-Only Safety

Since the Mosaic source directory is read-only in the current environment, the new code is written to `/home/hyperai/stargate-improvements/` as a standalone patch set. To apply:

```bash
cd /home/hyperai/stargate-improvements
# Copy services
cp services/*.ts /storage/mauro-hermes/sessions/mosaic-stargate/src/services/
# Copy components
cp components/*.tsx /storage/mauro-hermes/sessions/mosaic-stargate/src/components/
```

## Unique Features Delivered

1. **Telemetry-Driven Start Tab**: Node compute levels change which intents are highlighted. Live CPU, memory, disk, AIM slot gauges.
2. **Live AIM Inventory**: See exactly what AI models are running on your box with slot numbers, ports, and whitelist status.
3. **On-Chain Rankings**: Merkelizer uptime + HyperInsight composite scores + local node data = unified leaderboard with legendary/epic/rare/common badges.
4. **Fleet Hire & Deploy**: Discover DAO fleet nodes, hire agents per node, book training, all dispatched via Hermes kanban.
5. **No SSH Required**: Fleet orchestration uses registry polling and gateway messaging — works even when nodes have no LAN reachability.

## Prerequisites

- **Docker**: Aimify requires Docker Engine / Docker Desktop for building and packaging AIMs.
  Install: https://docs.docker.com/get-docker/
- **Node.js**: v18+ (used by Electron build scripts)
- **Git**: For cloning `aim-py-gen` (optional, used by Hermes agent pipeline)

## Essential: PORT Environment Variable

> **Every containerized app MUST read `PORT` from the environment.** Aimify assigns a random port in the range **49000-49999** per container and injects it via the `PORT` environment variable. Your app must bind to this port dynamically. Hardcoding a port causes health checks to fail with "connection reset by peer."

### How It Works

When Aimify deploys your container, it does something equivalent to:

```bash
# Aimify internally assigns e.g. port 49123
# The container MUST listen on whatever PORT is set
```

Your `Dockerfile` should **not** `EXPOSE` a fixed port, or if it does, it should still read `PORT` at runtime:

```dockerfile
# Generated Dockerfile (Aimify sets this for you)
ENV PORT=8080
EXPOSE ${PORT}
CMD ["python", "main.py"]
```

Your application code must then read `PORT` at startup:

**Python / Flask:**
```python
import os
port = int(os.environ.get("PORT", "8080"))
app.run(host="0.0.0.0", port=port)
```

**Python / Uvicorn (FastAPI):**
```python
import os
import uvicorn
port = int(os.environ.get("PORT", "8000"))
uvicorn.run(app, host="0.0.0.0", port=port)
```

**Node.js / Express:**
```javascript
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on ${port}`));
```

**Node.js / Fastify:**
```javascript
const port = Number(process.env.PORT) || 3000;
fastify.listen({ port, host: '0.0.0.0' });
```

**Go:**
```go
port := os.Getenv("PORT")
if port == "" { port = "8080" }
http.ListenAndServe(":" + port, nil)
```

**Rust (Axum/Actix):**
```rust
let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
```

### What Happens If You Don't

If your app hardcodes `port = 8000` and Aimify assigns `PORT=49123`, the Node Manager's health check will probe `localhost:49123`. Since your app is actually listening on `8000`, the probe gets `connection reset by peer` and the AIM is marked unhealthy.

## Aimify Troubleshooting

### `spawn docker ENOENT`
Docker is not installed or not in PATH. Install Docker Desktop and ensure `docker version` works in your terminal.

### `connection reset by peer` during health check
Your app is hardcoding a port instead of reading `process.env.PORT` (or equivalent). See **"Essential: PORT Environment Variable"** above for the fix. This is the most common first-time Aimify failure.

## Matching Skills Created

| Skill | Path | Purpose |
|-------|------|---------|
| `stargate-node-telemetry` | `devops/stargate-node-telemetry` | Bridge local NM telemetry into Stargate UI |
| `stargate-fleet-orchestrator` | `devops/stargate-fleet-orchestrator` | Dispatch kanban tasks to fleet nodes |
| `stargate-on-chain-rankings` | `devops/stargate-on-chain-rankings` | Merge on-chain + off-chain leaderboard |
