# STORM Analysis: Stargate Ecosystem in Mosaic-Companion

## Orchestrator Kickoff Document

### System Overview
Stargate is Mosaic-Companion's HyperCycle integration layer spanning:
- **Local Node Bridge** (`services/stargate/LocalNodeBridge.ts`) - Connects to Node Manager at localhost:8006
- **AIM Panels** - Live inventory (StargateAIMPanel.tsx) + Community marketplace (StargateCommunityAIMPanel.tsx)
- **Node Factory Tracker** (NodeFactoryTrackerPanel.tsx - 868 lines) - CBNO license monitoring
- **MCP Server** (`electron/integrations/mcp/servers/stargate-marketplace-mcp-server.js`) - Skills marketplace bridge
- **Skills Marketplace** (StargateSkillsMarketplacePanel.tsx)

### Critical Integration Points
1. **AIService.sendToHermesAIM** - Static method pattern (from memory)
2. **Localhost discovery fallback** - localhost:9000 probe when Node Manager shows empty
3. **MCP Tool Registration** - AIM-as-tool and Agent-as-tool patterns

---

## STORM Analysis Framework

This analysis follows the STORM (Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking) methodology:

### Phase 1: Multi-Perspective Discovery
Four specialist agents analyze from different perspectives:

| Agent | Perspective | Focus Area |
|-------|-------------|------------|
| Frontend Agent | Developer Experience | UI components, state, performance |
| Backend Agent | API Design | Services, bridges, MCP servers |
| Integration Agent | Network Architecture | Connectivity, error handling |
| Security Agent | Risk Management | Secrets, vulnerabilities, hardcoded values |

### Phase 2: Simulated Conversation
Each agent asks clarifying questions:
- "What if Node Manager is down?"
- "How do we handle Electron file:// protocol?"
- "Are there memory leaks from polling intervals?"
- "What hardcoded values exist?"

### Phase 3: Synthesis
Final agent compiles findings into actionable roadmap.

---

## Initial Pre-Discovery Findings

### Frontend Perspective
- `NodeFactoryTrackerPanel.tsx` is 868 lines - likely needs decomposition
- Discovery fallback pattern at localhost:9000 in StargateAIMPanel
- Polling interval: 30s (found in LocalNodeBridge)

### Backend Perspective
- `LocalNodeBridge.ts` has sophisticated fallback URL strategies for Electron file:// protocol
- Static method pattern: `AIService.sendToHermesAIM` (known from memory)
- Hardcoded contract: `0x8c0075D087de9588DdF5c1441dF39828d695bc2f` (HyperCycle BASE ANFE)

### Integration Perspective
- Multiple localhost ports: 8005 (admin), 8006 (UI), 9000 (discovery fallback)
- SignalController timeout: 5000ms

### Security Perspective
- MCP server reads/writes `~/.config/mosaic-companion/ai-agents.json`
- HTTP (not HTTPS) to localhost endpoints

---

## Agent Coordination Map

```
t_7bdf4026 [Orchestrator - This Task]
├── t_f27c2edb [Frontend Agent] → React components, state, UX
├── t_0cf08ff7 [Backend Agent] → Services, MCP, data flow  
├── t_2b7f5c00 [Ops Agent] → Connectivity, failure modes
├── t_e223f57d [Security Agent] → Secrets, vulnerabilities
└── t_bfb9ceda [Synthesis - BLOCKED until above complete]
```

Child tasks will auto-promote to 'ready' when all parent analyses complete.

---

## Expected Deliverables

### Per-Agent
1. Component/feature inventory
2. Identified issues (P0/P1/P2)
3. Recommendations
4. Questions for other agents

### Synthesis
1. Unified system architecture diagram
2. Critical issues dashboard
3. Refactoring roadmap
4. Testing gaps analysis

---

## How to Apply STORM Principles

When executing, each agent should:

1. **Perspective-Guided Discovery**: Don't just list files - analyze from your assigned perspective
2. **Simulated Conversation**: Ask "what if?" questions and answer them
3. **Multi-turn Investigation**: Follow threads, don't just surface-scan
4. **Synthesis Before Reporting**: Connect findings into coherent narrative

This creates a **shared conceptual space** (mind map) of the system.

---

*Created: 2025-06-19*
*Board: stargate*
*Orchestrator Task: t_7bdf4026*
