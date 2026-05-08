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

## Matching Skills Created

| Skill | Path | Purpose |
|-------|------|---------|
| `stargate-node-telemetry` | `devops/stargate-node-telemetry` | Bridge local NM telemetry into Stargate UI |
| `stargate-fleet-orchestrator` | `devops/stargate-fleet-orchestrator` | Dispatch kanban tasks to fleet nodes |
| `stargate-on-chain-rankings` | `devops/stargate-on-chain-rankings` | Merge on-chain + off-chain leaderboard |
