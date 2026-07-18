# Stargate Improvements Plan

## Target State
Transform the empty/placeholder tabs in Mosaic Stargate into live, telemetry-driven, unique features powered by HyperCycle Node Manager data, Hermes skills, and fleet orchestration.

## New Components (written to `/home/hyperai/stargate-improvements/`)

| File | Purpose | Replaces |
|------|---------|----------|
| `services/EnhancedLocalNodeBridge.ts` | Extended telemetry (CPU, memory, AIM slots, Ollama models) | `LocalNodeBridge.ts` additions |
| `services/FleetDiscoveryService.ts` | Discover DAO fleet nodes from registry URL | New service |
| `services/UnifiedLeaderboardService.ts` | Merge Merkelizer + HyperInsight + local + skills into one ranking | `LeaderboardService.ts` |
| `services/HermesAgentOrchestrator.ts` | Dispatch kanban tasks for agent hire/train/deploy | New service |
| `components/StargateTelemetryCard.tsx` | Live node stats card for Start tab | Static node card in Start |
| `components/StargateAIMPanel.tsx` | Live AIM list with slots, ports, status | Empty AIMs tab |
| `components/StargateRankingsView.tsx` | Unified rankings with on-chain data | Static leaderboard |
| `components/StargateFleetPanel.tsx` | Fleet node list with deploy/hire actions | Empty Hire Agents |
| `docs/integration-guide.md` | How to wire these into AdaPortalPanel | Docs |

## Design Decisions
- **No Electron dependency degradation**: In browser dev mode (no `window.electronAPI`), features gracefully degrade or skip Electron-only features.
- **Vite-proxy compatible**: All local node fetches use `/api/*` paths so Vite proxy works.
- **No SSH between nodes**: Fleet orchestration uses registry polling and gateway messaging, never SSH.
- **Skill-driven**: All new features have matching Hermes skills: `stargate-node-telemetry`, `stargate-fleet-orchestrator`, `stargate-on-chain-rankings`.

## Unique Value Adds
1. **Telemetry-Driven Start Tab**: Node compute levels change which intents are highlighted.
2. **Live AIM Inventory**: See exactly what AI models are running on your box.
3. **On-Chain Rankings**: Merkelizer uptime + HyperInsight composite scores = real leaderboard.
4. **Fleet Hire**: Hire agents and dispatch them to specific DAO nodes.
5. **Hermes Skill Overlay**: Install/manage Hermes skills from inside Stargate.

---

Below are the full TypeScript implementations for each component and service.
