---
name: stargate_mastery
category: infrastructure
description: Master control skill for all Stargate/HyperCycle components. Self-aware of every service, UI panel, smart contract, and infrastructure node.
version: 2.0.0
trigger: stargate
platforms: [desktop, electron]
---

# Stargate Mastery — Master Control Protocol

> This skill makes Mosaic Bot **self-aware** of every Stargate component and gives it mastery over the entire ecosystem.

---

## Component Registry

The bot has access to a complete registry of all Stargate components via `stargate-registry.ts`. It knows:

- **18 UI panels** — every React component in `src/components/stargate/`
- **7 core services** — pool, ANFE, HBox, asset discovery, merkelizer, graph, wallet
- **6 MCP integrations** — midnight, hermes, wallet, web3, codebase-memory, atomicmail
- **3 infrastructure nodes** — SPO, C-3PO, R2D2
- **5 smart contracts** — ANFE, Node Factory, and module contracts
- **3 bot skills** — orchestrator, stargate-doctor, auto-skill-importer

## Available Commands

### Pool Commands
- `/stargate pool:status` — Show pool status, delegations, compute allocation
- `/stargate pool:delegate <anfe-id> <node>` — Delegate ANFE to compute node
- `/stargate pool:list-nodes` — List all available compute nodes
- `/stargate pool:my-anfes` — Show user's ANFE holdings

### ANFE Commands
- `/stargate anfe:load-wallet` — Load ANFEs from connected wallet
- `/stargate anfe:verify <token-id>` — Verify ANFE on-chain
- `/stargate anfe:metadata <token-id>` — Show ANFE metadata
- `/stargate anfe:delegations` — List active delegations

### HBox Commands
- `/stargate hbox:list` — List HyperAIBox nodes
- `/stargate hbox:slots <node-id>` — Check slot usage
- `/stargate hbox:deploy-aim <aim-module> <node>` — Deploy AIM to node

### Infrastructure Commands
- `/stargate infra:spo:status` — Check SPO orchestrator health
- `/stargate infra:c3po:status` — Check C-3PO HBA
- `/stargate infra:c3po:tiller` — Discover C-3PO tiller port
- `/stargate infra:c3po:slots` — Check C-3PO AIM slot usage
- `/stargate infra:r2d2:status` — Check R2D2 HBA
- `/stargate infra:r2d2:tiller` — Discover R2D2 tiller port
- `/stargate infra:r2d2:slots` — Check R2D2 AIM slot usage

### UI Commands
- `/stargate ui:open-dashboard` — Open Stargate Pool Dashboard
- `/stargate ui:open-fleet` — Open Fleet Panel
- `/stargate ui:open-aim` — Open AIM Panel
- `/stargate ui:open-marketplace` — Open Skills Marketplace
- `/stargate ui:open-community` — Open Community AIM Panel
- `/stargate ui:open-telemetry` — Open Telemetry Card
- `/stargate ui:open-forge` — Open AIM Forge
- `/stargate ui:open-tracker` — Open Node Factory Tracker
- `/stargate ui:open-midnight` — Open Midnight City Command
- `/stargate ui:open-taste` — Open Taste Skill Dial
- `/stargate ui:open-rankings` — Open Rankings View
- `/stargate ui:open-krea` — Open Krea Panel

### Contract Commands
- `/stargate contract:anfe-base:balance` — Check Base ANFE balance
- `/stargate contract:anfe-base:delegations` — List ANFE delegations
- `/stargate contract:node-factory-eth:balance` — Check Node Factory balance
- `/stargate contracts:list` — List all HyperCycle contracts

### MCP Commands
- `/stargate mcp:midnight:status` — Check Midnight MCP status
- `/stargate mcp:midnight:contracts` — List deployed Compact contracts
- `/stargate mcp:hermes:tools` — List Hermes MCP tools
- `/stargate mcp:hermes:skills` — List Hermes MCP skills
- `/stargate mcp:wallet:balance` — Check Midnight Wallet balance
- `/stargate mcp:web3:balance` — Check Web3 balances
- `/stargate mcp:memory:search <query>` — Search codebase memory
- `/stargate mcp:mail:inbox` — Check AtomicMail inbox

### Bot Commands
- `/stargate bot:status` — Show orchestrator status
- `/stargate bot:heartbeat` — Trigger heartbeat
- `/stargate bot:agents` — List active agents
- `/stargate bot:skills` — List loaded skills
- `/stargate bot:importer:scan` — Force skill scan
- `/stargate bot:importer:list` — List imported skills

### Diagnostics
- `/stargate doctor:diagnose` — Full system diagnosis
- `/stargate doctor:report` — Generate health report
- `/stargate doctor:fleet` — HyperAIBox fleet status
- `/stargate doctor:mcp` — MCP health check
- `/stargate doctor:contracts` — Contract health check

## Self-Awareness Rules

When responding to Stargate commands:

1. **Always check the component registry first** — know if a component is up or down
2. **Never report fake data** — if SPO is down, say it's down with full explanation
3. **Distinguish pool/compute status from on-chain/Merkelizer status** — dual badges
4. **Never display prices during beta** — use "Beta" badge instead
5. **Rename internal ops to user-facing names** — "Tilling" → "Stargate Pool"
6. **Show infrastructure capacity** — HyperAIBox count, slots used/total
7. **Never show fake earnings** — only verifiable data from real sources
8. **Spell out acronyms on first use** — ANFE (Access NFT for Execution), HBA (HyperBox Agent), SPO (Stargate Pool Orchestrator), AIM (AI Model)

## Response Format

For status queries:
```
[STATUS] Component Name
• Health: ✅ Operational / 🟠 Degraded / 🔴 Down
• Last check: HH:MM:SS
• Dependencies: [list]
• Action needed: [if any]
```

For fleet queries:
```
[FLEET] HyperAIBox Nodes
• C-3PO (192.168.0.151): 🔴 Unreachable — 128 slots offline
• R2D2 (192.168.0.38): 🔴 Unreachable — 8 slots offline
• Total capacity: 0/136 slots available
```

For skill queries:
```
[SKILLS] Loaded: N skills
• Recently added: [list]
• Pending import: N
• Auto-import active: ✅
```

## Architecture Knowledge

The bot knows the full Stargate architecture:

```
User Wallet → ANFE Holdings → Stargate Pool → Compute Delegation → HyperAIBox Nodes
                                        ↓
                                   SPO Orchestrator
                                        ↓
                              Agent Scheduling → AIM Deployment
```

And:

```
Hermes Skills → Stargate Skill Registry → Stargate UI Panels
                                        ↓
                                   Marketplace → Community AIM
```

## Integration Points

The bot integrates Stargate with:
- **Vault** — stores ANFE metadata, delegations, node configurations
- **Codebase Memory MCP** — indexes all Stargate components for search
- **Hermes MCP** — uses kanban, web search, terminal tools
- **Midnight MCP** — deploys Compact contracts for privacy-preserving compute
- **Auto-Skill Importer** — brings new skills into Stargate marketplace

## Evolution Path

The bot should evolve its Stargate mastery by:
1. Learning from each heartbeat which components are stable vs flaky
2. Tracking which commands are used most → prioritize those in UI
3. Detecting patterns like "C-3PO always down after midnight" → suggest fixes
4. Recommending new skills from marketplace based on usage patterns
5. Auto-deploying AIM modules when slots become available
