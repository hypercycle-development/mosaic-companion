# Stargate Module

AI Workforce + Compute + Intelligence Platform for Cardano - Mosaic Companion Integration

## Overview

Stargate is the Ada Portal rebranded — a comprehensive AI agent workforce system that integrates with Mosaic Companion, featuring:

- **Agent Marketplace** - Hire AI agents (Marketing, Developer, UI/UX, Data Analyst, Growth)
- **Skills.sh Integration** - Attach skills from the skills.sh ecosystem
- **Stargate Pool** - NFT-gated compute node access via HyperCycle Node Factories
- **Tokeo Wallet** - Cardano wallet integration with CIP-30 NFT-based access control
- **HyperInsight** - AIM performance metrics and rankings
- **Agent Training** - Train custom agents with skill transfer
- **Agent Bundles** - Pre-built multi-agent packages
- **MCP Integration** - Model Context Protocol orchestration

## What's Included

### New Files Added

```
src/
├── components/
│   └── AdaPortalPanel.tsx       # Main Stargate UI panel
├── services/
│   ├── AdaPortal/               # All AdaPortal services (renamed Stargate)
│   │   ├── AgentMarketplaceService.ts
│   │   ├── SkillMarketplaceService.ts
│   │   ├── AccessControlService.ts
│   │   ├── CardanoWalletService.ts
│   │   ├── NodeIntelligenceService.ts
│   │   ├── MCPIntegrationService.ts
│   │   └── ... (14 services total)
│   ├── AgentRegistry.ts         # Claw Code patterns
│   ├── AspGateway/              # ASP Gateway service
│   ├── StargatePool/            # NFT-gated compute pool
│   └── StargatePoolService.ts   # Node factory management
├── global.d.ts                   # TypeScript definitions
└── types/types.ts                # Updated with Stargate URLs

plugins/
└── stargate-pool/               # Plugin for Stargate Pool UI
    ├── manifest.json
    ├── main/index.ts
    └── renderer/StargatePoolView.tsx

electron/
├── integrations/tools/modules/
│   ├── agent-browser.ts         # Vercel agent-browser integration
│   ├── cardano-tokeo.ts         # Tokeo wallet module
│   └── ... (other tool modules)
```

### Modified Files

- `src/components/Sidebar.tsx` - Renamed "Ada Portal" → "Stargate"
- `src/components/ContentArea.tsx` - Tab title updated
- `src/types/types.ts` - Internal URLs defined (INTERNAL_ADAPORTAL_*)

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/hypercycle-development/mosaic-companion.git
cd mosaic-companion
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and add your keys:

```bash
cp .env.example .env
```

Required for full functionality:
- `GEMINI_API_KEY` - For agent AI capabilities
- `HYPERCYCLE_RPC` - HyperCycle subgraph endpoint (optional)
- `BLOCKFROST_API_KEY` - For Cardano data (optional)

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
npm run start
# or for development
npm run dev
```

## Stargate UI

Access via the **Stargate** sidebar item in Mosaic Companion. Features:

| Tab | Description |
|-----|-------------|
| **Start** | Connect wallet, view Stargate Pool eligibility |
| **Hire Agents** | Browse and hire AI agents |
| **Skills** | Browse skills.sh marketplace |
| **Train** | Train custom agents |
| **Bundles** | Pre-built agent packages |
| **Compute** | HyperCycle node management |
| **Rankings** | AIM leaderboards |

## Wallet Integration

### Tokeo (Cardano)
- Click "Connect Tokeo" in the Start tab
- Supports CIP-30 standard
- NFT-gated premium access

### MetaMask / Mosaic Wallet
- Fallback Ethereum wallet support
- WalletAdapter.ts handles both

## Stargate Pool (NFT-Gated Compute)

Node Factories on HyperCycle can be gated by NFT collections:

```typescript
// Register a factory
const result = await stargatePoolService.registerFactory({
  name: 'HyperCycle Alpha Node',
  chain: 'base',
  network: 'base-mainnet',
  owner_wallet: '0x...',
  total_capacity: 100,
  skills_supported: ['code-generation'],
  is_public: false, // NFT-gated
});
```

## Adding New Skills

The Skills tab integrates with skills.sh:

```typescript
skillMarketplace.attachSkillToAgent(
  'vercel-react-best-practices', // skill name from skills.sh
  'agent_001',                   // agent ID
  4                              // proficiency level 1-5
);
```

## Troubleshooting

### Aimify `connection reset by peer` (Health Check Failure)
This is the most common first-time Aimify failure. Aimify assigns a random port (49000-49999) per container via the `PORT` environment variable. Every containerized app MUST read `PORT` dynamically — reading `process.env.PORT` (Node), `os.environ['PORT']` (Python), etc. Hardcoding a port causes the Node Manager's health check to probe the wrong address and fail with "connection reset by peer."

See `docs/stargate/integration-guide.md` for a full cross-language reference.

Quick examples:

**Python:**
```python
import os
port = int(os.environ.get("PORT", "8080"))
app.run(host="0.0.0.0", port=port)
```

**Node.js:**
```javascript
const port = process.env.PORT || 3000;
app.listen(port);
```

### Build Errors
If you see missing exports, ensure all AdaPortal services are copied:
```bash
cp -r src/services/AdaPortal/* src/services/AdaPortal/
```

### Wallet Connection Issues
- Ensure Tokeo extension is installed
- Check browser console for errors

## Credits

Built on Claw Code architecture patterns:
- PortingModule / PermissionContext
- QueryEngine for agent routing
- ExecutionRegistry for middleware

---

For questions: https://discord.com/invite/clawd