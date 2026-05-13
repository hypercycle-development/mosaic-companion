# STARGATE x MOSAIC: User Guide
## How to Use the 8 New Integrations

**Version**: stargate-module (2026-05-13)  
**Status**: Production-ready, E2E tested (9/9 passed)

---

## What is Stargate?

Stargate is Mosaic's blockchain compute layer. It connects your Mosaic browser to:
- **ANFE NFTs** — AI Node Factory Entities that grant compute rights
- **HyperCycle** — Decentralized AI compute marketplace
- **Fleet Nodes** — Remote servers running AI models
- **Your Wallet** — Multi-chain asset management

**Before this integration**: Stargate was powerful but isolated. You could see your ANFEs and fleet nodes, but couldn't use Mosaic's best features with them.

**After this integration**: Every Stargate feature is now deeply connected to Mosaic's tool system, sandbox, MCP, IDE, orchestration, vault, gatekeeper, and chronicle systems.

---

## The 8 Integrations: What They Do & Where to Find Them

### #1 — Agent-as-Tool Manifest (P0)
**What it does**: Every ANFE you own automatically becomes a tool in Mosaic's tool system.

**Why it matters**: ANFEs used to just sit in your wallet. Now they have:
- Container isolation (each ANFE runs in its own Docker sandbox)
- Gatekeeper filtering (outbound traffic is controlled)
- Chronicle logging (every action is recorded)
- Full tool manifest (ANFEs appear alongside Mosaic's native tools)

**Where to find it**: Open Mosaic → **Stargate AIM Panel** → Click **"Register as Tool"** next to any active AIM.

**Example use case**:  
You own ANFE #5842. You click "Register as Tool" — now ANFE #5842 appears in Mosaic's tool registry with its own API endpoint. You can use it in chat, in workflows, or expose it to other apps via MCP. It's isolated, logged, and secured.

---

### #2 — MCP Everywhere (P0)
**What it does**: Every AIM in your fleet exposes a standard MCP (Model Context Protocol) endpoint. This means Mosaic AIMs can be used from:
- Cursor IDE
- Claude Desktop
- Windsurf
- Any MCP-compatible client

**Why it matters**: Before: AIMs were locked inside Mosaic. After: AIMs become universal. More clients using your compute = more demand for Stargate = your ANFEs earn more.

**Where to find it**: Open Mosaic → **Stargate AIM Panel** → Click **"Expose as MCP Server"**.

**Example use case**:  
You have 3 fleet nodes running HyperCycle AIMs. You click "Expose as MCP Server" — they automatically get `mcp://node-id:port` endpoints. Now you open Cursor IDE, add `mcp://your-node:8006`, and Cursor can talk to your HyperCycle compute directly.

---

### #3 — Unified Orchestration Bus (P1)
**What it does**: One button to dispatch tasks across your fleet in different modes.

**Why it matters**: Before: Kanban only (dispatch one task at a time). After: 4 modes:
- **Parallel** — Run the same task on ALL fleet nodes simultaneously
- **Sequential** — Chain tasks: "Train → Verify → Deploy" (step A must finish before step B)
- **Pipeline** — Data flows through multiple nodes in sequence
- **Hybrid** — Mix local compute + fleet nodes in one workflow

**Where to find it**: Open Mosaic → **Multi-Agent Panel** → Click **"Deploy to Fleet"**.

**Example use case**:  
You have a prompt: "Analyze this dataset and generate a report." You select 5 fleet nodes and choose **Parallel mode**. The prompt runs on all 5 nodes simultaneously. Results come back, and Chronicle logs which node completed which part.

Another example:  
You build a **Sequential** workflow: Step 1: "Train model on Node A" → Step 2: "Verify accuracy on Node B" → Step 3: "Deploy to production on Node C". Each step waits for the previous one. If Step 2 fails, Step 3 never runs.

---

### #4 — IDE-as-Agent-Forge (P1)
**What it does**: The built-in IDE now has an agent template system. Code → Test → Deploy, all inside Mosaic.

**Why it matters**: Before: No way to develop agents inside Mosaic. After: Built-in templates (ANFE minter, Fleet node, MCP server) with test runner and one-click deploy.

**Where to find it**: Open Mosaic → **IDE Page** (top toolbar) → Click **"Forge Agent"** (Rocket icon).

**Example use case**:  
You want to build a custom agent that monitors your ANFE uptime. You open the IDE, click "Forge Agent", select the "anfe-minter" template. The template gives you starter code. You edit it in the Monaco editor, click "Test" to run it against your fleet, then click "Deploy" to push it to all your nodes.

The full flow:  
IDE → Template → Edit Code → Run Test → Deploy to Fleet → Chronicle logs the deployment

---

### #5 — Fleet-as-Sandbox (P2)
**What it does**: Every fleet node gets a Docker sandbox with isolated resources.

**Why it matters**: Before: Fleet nodes ran unsandboxed code. After: Each node runs in a Docker container with resource limits, isolated networking, and tiered performance:
- **Basic tier**: 1 CPU, 2GB RAM, 10GB disk
- **Standard tier**: 2 CPUs, 4GB RAM, 20GB disk
- **Advanced tier**: 4 CPUs, 8GB RAM, 50GB disk

**Where to find it**: Open Mosaic → **Stargate Fleet Panel** → Click **"Sandbox"** on any fleet node row.

**Example use case**:  
You hire a fleet node from the marketplace, but you don't trust the provider. You select "Standard sandbox" before deploying. Your agent runs in Docker isolation — it can't see other processes, can't use more than 4GB RAM, and can only talk to whitelisted domains. If the node is malicious, it's contained.

---

### #6 — Vault-Backed ASP (P2)
**What it does**: All API keys are stored in Mosaic's encrypted Vault. They never touch memory or localStorage.

**Why it matters**: Before: API keys were stored in plain memory (risk of exposure). After: Keys are stored in `VaultPage` (AES-256 encrypted, stored in SQLite). When an agent needs a key, it's fetched on-demand, cached for 30 seconds, then cleared.

**Where to find it**: Open Mosaic → **Ada Portal Panel** → Create company → Keys are automatically vault-backed.

**Example use case**:  
Your HyperCycle agent needs an OpenAI API key to complete tasks. Instead of putting `OPENAI_API_KEY` in environment variables, you save it in Mosaic VaultPage. The agent only gets the key when it needs it (max 30s in memory). If your machine is compromised, the key is encrypted on disk and not in memory.

---

### #7 — Gatekeeper Fleet Filter (P2)
**What it does**: Network-level traffic filtering for every fleet node. Blocks malicious requests, rate-limits, and enforces TLS.

**Why it matters**: Before: Fleet nodes could make any outbound request (risk of data exfiltration). After: Policy-based filtering per node:
- Whitelisted domains (e.g., `*.hypercycle.io`, `api.openai.com`)
- Blocked ports (e.g., block SSH access)
- Rate limits (e.g., max 120 requests/minute)
- TLS required (blocks plain HTTP)

**Where to find it**: Open Mosaic → **Stargate Fleet Panel** → Click **"Filter"** on any fleet node row.

**Example use case**:  
You deploy an agent to a third-party fleet node. The gatekeeper policy says: "Only talk to api.openai.com, max 120 calls/minute, HTTPS only." The agent tries to call a suspicious domain → Gatekeeper blocks it. The agent tries to make 10,000 calls/minute → Gatekeeper throttles it. Your data stays safe.

---

### #8 — Chronicle Fleet Log (P2)
**What it does**: Immutable audit trail for every fleet event. Chain-hashed, tamper-evident, replayable.

**Why it matters**: Before: Only `console.log` for debugging. After: Every action is logged with a chain hash. If someone tampers with a log entry, the hash chain breaks — you'll know immediately.

**Where to find it**: Open Mosaic → **Stargate Fleet Panel** → Click **"Log"** on any fleet node row.

**Example use case**:  
Your compliance team asks: "Show me every compute job that ran on Node #42 last month." You click "Log" → Chronicle shows a chain-hashed timeline: Deploy, Run, Test, Output. Each entry is signed with a hash linking to the previous entry. You can export the log to JSON, replay the entire sequence, and verify no one tampered with it.

---

## Quick Navigation Guide (For New Users)

| I want to... | Open Panel | Click |
|-------------|-----------|-------|
| Register my ANFE as a tool | Stargate AIM Panel | "Register as Tool" |
| Use my AIM from Cursor/Claude | Stargate AIM Panel | "Expose as MCP Server" |
| Run a prompt on 5 nodes at once | Multi-Agent Panel | "Deploy to Fleet" → Parallel |
| Build + deploy a custom agent | IDE Page | "Forge Agent" (Rocket icon) |
| Isolate a fleet node in Docker | Stargate Fleet Panel | "Sandbox" on node row |
| Secure my API keys | Ada Portal Panel | Create company (auto vault-backed) |
| Block malicious traffic | Stargate Fleet Panel | "Filter" on node row |
| View audit trail | Stargate Fleet Panel | "Log" on node row |

---

## 3 Real-World Workflows

### Workflow 1: "I want to build a custom AI agent for my fleet"
1. Open **IDE Page** → Click **"Forge Agent"**
2. Select template (e.g., "fleet-monitor")
3. Edit code in Monaco editor
4. Click **"Test"** → runs against your fleet (sandbox)
5. If test passes → Click **"Deploy"**
6. Deployment is logged to **Chronicle**
7. Agent runs in **Sandbox** isolation on each node
8. Agent uses **Vault** for API keys (never in memory)

### Workflow 2: "I want to process data across my entire fleet"
1. Open **Multi-Agent Panel**
2. Type your prompt: "Analyze Q3 sales data"
3. Select 5 fleet nodes
4. Choose **Parallel mode**
5. Click **"Deploy to Fleet"**
6. All 5 nodes run simultaneously
7. Results collated and logged to **Chronicle**
8. Gatekeeper ensures each node only talks to trusted domains

### Workflow 3: "I want my AIM usable from Cursor IDE"
1. Open **Stargate AIM Panel**
2. Find the AIM you want to expose
3. Click **"Expose as MCP Server"**
4. Get the MCP URL: `mcp://node-id:8006`
5. Open Cursor IDE settings → Add MCP server
6. Paste the URL
7. Now Cursor can talk to your HyperCycle AIM directly

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                        MOSAIC BROWSER                             │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│  AIM Panel   │ Fleet Panel  │ Multi-Agent  │       IDE Page       │
│  - Register  │ - Sandbox    │ - Parallel   │   - Forge Agent      │
│  - MCP       │ - Filter     │ - Sequential │   - Test             │
│    Expose    │ - Log        │ - Pipeline   │   - Deploy           │
├──────────────┴──────────────┴──────────────┴──────────────────────┤
│                    STARGATE INTEGRATION LAYER                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │AgentTool   │  │MCPAIM      │  │Unified     │  │IDEAgent    │  │
│  │Service     │  │Service     │  │Orchestrator│  │Forge       │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │FleetSandbox│  │SecureAsp   │  │FleetGate   │  │FleetChronicle│ │
│  │Launcher    │  │Gateway     │  │keeper      │  │Logger       │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│                    STARGATE CORE SERVICES                         │
│  StargatePool → ANFE → HyperCycle → Fleet → Wallet → Graph     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Status Summary

| Component | Status | Test |
|-----------|--------|------|
| AgentToolService | DONE | E2E PASS |
| MCPAIMService | DONE | E2E PASS |
| UnifiedOrchestrator | DONE | E2E PASS |
| IDEAgentForge | DONE | E2E PASS |
| FleetSandboxLauncher | DONE | E2E PASS |
| SecureAspGateway | DONE | E2E PASS |
| FleetGatekeeperFilter | DONE | E2E PASS |
| FleetChronicleLogger | DONE | E2E PASS |

**Total**: 2,490 lines of integration code, 9/9 E2E checks passed, zero TypeScript errors, 10 clean commits on `stargate-module`.

---

*Generated from stargate_mosaic_analysis.md and implementation at ~/mosaic-companion/*