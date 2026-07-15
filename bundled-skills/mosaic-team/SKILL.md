---
name: mosaic-team
version: 1.0.0
description: |
  Generic multi-agent team orchestration framework for Mosaic Bot.
  Defines team topology, agent roles, handoff rules, and shared memory
  contracts. Can be activated for any vertical: palm-economy, coffee-supply,
  logistics, real-estate, etc.
author: Mosaic Team
license: MIT
metadata:
  hermes:
    tags: [mosaic, team, orchestration, multi-agent, sales, agency]
    related_skills: [palm-economy, lead-scraper, proposal-writer, crm-connector]
    requires: []
    os: [linux, darwin, win32]
triggers:
  - mosaic team
  - multi-agent
  - team orchestration
  - sales agency
  - agent team
  - swarm
  - handoff
  - pipeline
---

# 🤖 MOSAIC TEAM — Multi-Agent Team Orchestration Framework

> **Purpose:** Generic framework for orchestrating multiple AI agents with
> different profiles, skills, and vault access to work collaboratively.
> **Vertical layer:** Activate for Palm Economy, Coffee Supply, Logistics, etc.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MOSAIC BOT (Renderer)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Chat Tab   │  │  Team Tab   │  │  Settings / Agents  │ │
│  │  (existing) │  │  (NEW)      │  │  (existing)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              MOSAIC BOT MAIN PROCESS (Node)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │Orchestrator │  │  Agent      │  │  Shared Memory +    │ │
│  │(conductor)  │  │  Runner     │  │  Wiki Engine        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle
**The framework code doesn't know what cacao is.** It knows "Product A",
"Pipeline Stage B", "Agent Role C". The vertical content (Palm Economy,
Coffee, etc.) lives in skills and vault boxes.

---

## 2. Team Topology Schema (YAML)

```yaml
# mosaic-team.yaml — Generic template
# Copy this file, change `vertical` and `agents`, deploy.

team:
  name: "Palm Economy Sales Agency"
  slug: "palm-economy-sales"
  domain: "rwa-sales"          # generic: sales, support, dev-rel, ops
  vertical: "palm-economy"     # specialization layer
  description: |
    LATAM-focused sales team for RWA commodity traceability.
    Targets cacao cooperatives, honey exporters, palm oil producers.

agents:
  # ── Phase 1: MVP (minimum viable team) ─────────────────────────
  - id: "latam-scout"
    role: "prospector"
    displayName: "LATAM Scout"
    avatar: "🕵️"
    objective: "Find and qualify LATAM businesses needing traceability"
    skills:
      - palm-economy
      - lead-scraper
      - latam-outreach
      - commodity-cacao
      - commodity-honey
    brain:
      provider: "ollama-cloud"
      model: "kimi-k2.6"
      temperature: 0.8
    vaultAccess:
      - box-palm-economy
      - box-latam-market
    priority: 1
    activeHours: { start: "06:00", end: "22:00" }  # LATAM timezone friendly
    handoffTriggers:
      - condition: "prospect_qualified"
        to: "palmyra-educator"
        auto: false          # human gate: you approve before handoff

  - id: "palmyra-educator"
    role: "educator"
    displayName: "Palmyra Educator"
    avatar: "🎓"
    objective: "Explain traceability, products, compliance to prospects"
    skills:
      - palm-economy
      - palmyra-products
      - traceability-101
      - latam-regulations
      - rwa-tokenization
    brain:
      provider: "ollama-cloud"
      model: "kimi-k2.6"
      temperature: 0.7
    vaultAccess:
      - box-palm-economy
      - box-products
      - box-regulations
    priority: 2
    activeHours: { start: "09:00", end: "18:00" }
    handoffTriggers:
      - condition: "pricing_requested"
        to: "commodity-analyst"
        auto: false
      - condition: "proposal_ready"
        to: "deal-closer"
        auto: false

  - id: "deal-closer"
    role: "negotiator"
    displayName: "Deal Closer"
    avatar: "🤝"
    objective: "Draft proposals, handle objections, close deals"
    skills:
      - palm-economy
      - proposal-writer
      - sales-closing
      - crm-connector
      - email-outreach
    brain:
      provider: "ollama-cloud"
      model: "kimi-k2.6"
      temperature: 0.6
    vaultAccess:
      - box-palm-economy
      - box-sales-playbooks
      - box-pricing
    priority: 3
    activeHours: { start: "09:00", end: "18:00" }
    handoffTriggers:
      - condition: "deal_closed"
        to: "client-success"
        auto: false

  # ── Phase 2: Expansion ────────────────────────────────────────
  - id: "commodity-analyst"
    role: "analyst"
    displayName: "Commodity Analyst"
    avatar: "📊"
    objective: "Provide pricing intelligence, market data, harvest forecasts"
    skills:
      - commodity-cacao
      - commodity-honey
      - market-intel
    brain:
      provider: "ollama-cloud"
      model: "kimi-k2.6"
      temperature: 0.5
    vaultAccess:
      - box-commodities
      - box-market-intel
    priority: 4
    activeHours: { start: "09:00", end: "18:00" }
    disabled: true          # enable in Phase 2

  - id: "client-success"
    role: "onboarding"
    displayName: "Client Success"
    avatar: "🌱"
    objective: "Post-sale onboarding, platform training, first harvest setup"
    skills:
      - palmyra-products
      - traceability-101
      - crm-connector
    brain:
      provider: "ollama-cloud"
      model: "kimi-k2.6"
      temperature: 0.7
    vaultAccess:
      - box-palm-economy
      - box-products
    priority: 5
    activeHours: { start: "09:00", end: "18:00" }
    disabled: true          # enable after first deal closes

shared:
  memory:
    format: "structured"
    entries:
      - "prospect_qualified: [timestamp] [agent] [prospect] [key_info]"
      - "interaction_log: [timestamp] [agent] [prospect] [action] [outcome]"
      - "pricing_quote: [timestamp] [commodity] [price] [terms]"
  pipelineStages:
    - "lead"
    - "qualified"
    - "educated"
    - "pricing"
    - "proposal"
    - "negotiation"
    - "closed"
    - "onboarding"
    - "active"
  humanCheckpoints:
    - stage: "qualified→educated"
      action: "approve_handoff"
    - stage: "proposal"
      action: "review_before_send"
    - stage: "pricing_deviation"
      action: "approve_discount"
    - stage: "deal_closed"
      action: "human_signs_contract"

integrations:
  crm: "airtable"           # airtable, notion, hubspot, manual
  calendar: "none"          # google-calendar, calendly, manual
  email: "none"             # gmail, sendgrid, manual
  slack: "none"             # slack-webhook, discord
```

---

## 3. Agent Configuration Mapping

Each agent in `mosaic-team.yaml` maps to an entry in Mosaic's `ai-agents.json`:

```json
{
  "id": "latam-scout",
  "name": "LATAM Scout",
  "provider": "ollama-cloud",
  "model": "kimi-k2.6",
  "skills": ["palm-economy", "lead-scraper", "latam-outreach", "commodity-cacao", "commodity-honey"],
  "boxAccess": ["box-palm-economy", "box-latam-market"],
  "isActive": true,
  "temperature": 0.8
}
```

### Field Mapping
| mosaic-team.yaml | ai-agents.json | Notes |
|------------------|----------------|-------|
| `id` | `id` | Must match exactly |
| `displayName` | `name` | Human-readable name |
| `brain.provider` | `provider` | ollama, ollama-cloud, openai, claude |
| `brain.model` | `model` | Model identifier |
| `brain.temperature` | `temperature` | 0.0–1.0 |
| `skills` | `skills` | From `~/.hermes/skills/` |
| `vaultAccess` | `boxAccess` | From Mosaic Vault |
| `activeHours` | (not yet) | Future: schedule-aware activation |
| `priority` | (not yet) | Future: task queue ordering |
| `disabled` | `isActive` | `disabled: true` → `isActive: false` |

---

## 4. Handoff Protocol

### Standard Handoff Message Format
```
═══════════════════════════════════════
HANDOFF: [from_agent] → [to_agent]
PROSPECT: [name / company / country]
STAGE: [current pipeline stage]
CONTEXT:
  - [Key fact 1]
  - [Key fact 2]
  - [Key fact 3]
ACTION REQUIRED: [what the receiving agent should do]
HUMAN GATE: [approved / pending / auto]
═══════════════════════════════════════
```

### Example
```
═══════════════════════════════════════
HANDOFF: latam-scout → palmyra-educator
PROSPECT: Cooperativa Norandino, Piura, Peru
STAGE: qualified
CONTEXT:
  - 2,400 farmer members
  - Exports 70% to EU (Germany, Netherlands)
  - Current traceability: paper logs + Excel
  - Pain point: EU buyer requested EUDR compliance proof
ACTION REQUIRED: Schedule product demo, explain 6-step traceability
HUMAN GATE: approved
═══════════════════════════════════════
```

---

## 5. Shared Memory Contract

All agents in a team share a **team memory box** (`box-{team-slug}-memory`).

### Memory Entry Schema
```json
{
  "id": "mem-1740528000000",
  "timestamp": 1740528000000,
  "agent": "latam-scout",
  "prospect": "Cooperativa Norandino",
  "stage": "qualified",
  "type": "interaction",
  "content": "Spoke with Maria Gonzalez (Operations Director). Cooperative has 2,400 members, exports 70% to EU. Current traceability is paper-based. Interested in Palmyra Coop Package.",
  "tags": ["cacao", "peru", "cooperative", "eu-export", "qualified"],
  "nextAction": "palmyra-educator: schedule demo"
}
```

### Memory Types
| Type | When Written | Query Pattern |
|------|--------------|---------------|
| `interaction` | After every prospect touch | "What did we last say to [prospect]?" |
| `qualification` | When prospect is scored | "Which prospects are qualified?" |
| `pricing` | When quote is given | "What did we quote [prospect] for [commodity]?" |
| `proposal` | When SOW is drafted | "Show me the proposal for [prospect]" |
| `objection` | When objection is raised | "What objections has [prospect] raised?" |
| `win` | When deal closes | "What deals closed this month?" |

---

## 6. UI/UX Design for Mosaic Team Tab

### Layout Concept
```
┌──────────────────────────────────────────────────────────────┐
│  Mosaic Team — Palm Economy Sales Agency                     │
├────────────┬────────────────────────────┬────────────────────┤
│ AGENT      │   ACTIVE MISSIONS          │  SHARED KNOWLEDGE  │
│ ROSTER     │                            │                    │
│            │  🕵️ Scout: Finding leads   │  📦 Palm Economy   │
│  🕵️ Scout  │     └─ NORANDINO (Peru)  │  📦 Products       │
│  🎓 Educator│  🎓 Educator: Demo pending │  📦 Commodities    │
│  🤝 Closer │     └─ ECAM (Ecuador)      │  📦 Regulations    │
│  📊 Analyst│                            │  📦 Playbooks      │
│  🌱 Success│  Pipeline: 12 leads → 4    │  📦 Market Intel    │
│            │  qualified → 1 proposal    │                    │
├────────────┴────────────────────────────┴────────────────────┤
│ COMMAND: @latam-scout find cacao cooperatives in Ecuador   │
│          @palmyra-educator explain EUDR to NORANDINO       │
└──────────────────────────────────────────────────────────────┘
```

### Tab Features
1. **Agent roster** — Cards with status (idle | working | waiting), avatar, last action
2. **Active missions** — Current workflows, handoff log, human checkpoints
3. **Shared knowledge** — Vault boxes accessible to the team
4. **Command bar** — `@agent-name` to pull someone into action
5. **Pipeline view** — Visual funnel of all prospects
6. **Handoff log** — History of agent-to-agent transfers

---

## 7. Generic Vertical Activation Guide

To activate Mosaic Team for a NEW vertical (e.g., Coffee Supply):

### Step 1: Create Vertical Skill
```bash
mkdir -p ~/.hermes/skills/domain/coffee-supply
cat > ~/.hermes/skills/domain/coffee-supply/SKILL.md << 'EOF'
---
name: coffee-supply
description: Coffee supply chain traceability and sales
---
# Coffee Supply Knowledge...
EOF
```

### Step 2: Create Team Config
```bash
cp mosaic-team.yaml coffee-team.yaml
# Edit:
#   team.vertical = "coffee-supply"
#   team.name = "Coffee Supply Sales Agency"
#   agents[].skills → swap palm-economy for coffee-supply
#   agents[].vaultAccess → swap palm boxes for coffee boxes
```

### Step 3: Create Vault Boxes
```bash
# In Mosaic UI or via IPC:
vault:addBox "Coffee Supply"
vault:addBox "Coffee Market Intel"
vault:addEntry "coffee-supply" "{origin: 'Ethiopia', grades: '...'}"
```

### Step 4: Register Agents
```bash
# In Mosaic UI: Settings → Agents → Add Agent
# Or edit ai-agents.json directly
```

### Step 5: Activate Team
In Mosaic Team tab: "Activate Coffee Team" → agents spin up, shared memory initializes.

---

## 8. Integration with Existing Mosaic Systems

| System | How Team Uses It |
|--------|------------------|
| **Skills** (`~/.hermes/skills/`) | Agent capabilities loaded via `skill:buildSystemPrompt` IPC |
| **Vault** (`vault.json`) | Shared knowledge boxes, product catalogs, playbooks |
| **Memory** (SQLite/wiki) | Team interaction history, prospect context |
| **MCP** (`hermes-tools`) | Agents execute Hermes tools (terminal, web, file, skills) |
| **CRM** (Airtable/Notion) | Deal tracking, pipeline management |
| **Heartbeat** (MosaicBot) | Background monitoring, auto-actions, chronic escalation |

---

## 9. Security & Governance

### Agent Boundaries
- Agents can ONLY access boxes in their `vaultAccess` list
- Agents can ONLY invoke skills in their `skills` list
- Agents CANNOT modify other agents' configs
- Agents CANNOT access human-only data (passwords, contracts, legal)

### Human Gatekeeping
| Checkpoint | Default | Rationale |
|------------|---------|-----------|
| Scout → Educator handoff | **Requires approval** | Prevent spam, ensure quality |
| Proposal send | **Requires approval** | Brand risk, pricing accuracy |
| Pricing discount >5% | **Requires approval** | Margin protection |
| Deal closure | **Requires human signature** | Legal binding |
| CRM update | **Auto-allowed** | Low risk, high velocity |
| Memory write | **Auto-allowed** | Required for team coherence |

### Audit Trail
Every agent action is logged:
```json
{
  "timestamp": 1740528000000,
  "agent": "latam-scout",
  "action": "lead_discovered",
  "target": "Cooperativa Norandino",
  "toolsUsed": ["web_search", "web_extract"],
  "skillsUsed": ["lead-scraper", "latam-outreach"],
  "humanGate": "approved",
  "outcome": "qualified"
}
```

---

## 10. Error Handling & Recovery

### Error: Agents return canned/simulated responses instead of real LLM output

**Symptoms:** All agents return identical pre-written text regardless of user prompt. Scout always finds the same 3 cooperatives. Educator always pastes the same EUDR brief.

**Root Cause:** The renderer is using a hardcoded `responses` dictionary with `setTimeout` simulation instead of calling the actual LLM.

**Fix:** Replace simulated dispatch with real per-agent LLM calls:

1. Add `callAgentLLM(agentId, prompt, systemPrompt)` to `electron/integrations/mosaicbot/src/main/llm.ts` — reads `ai-agents.json` by ID (not `find((a) => a.isActive)` which returns first match only)
2. Register IPC handler `team:dispatch` in `electron/integrations/mosaicbot/src/main/index.ts`
3. Expose `window.agent.teamDispatch` in `electron/integrations/mosaicbot/src/preload.ts`
4. Add `Window.agent` type to `src/global.d.ts`
5. Call `window.agent?.teamDispatch?.(agent.id, text, systemPrompt)` in `src/components/MosaicTeamPanel.tsx`

**See:** `references/team-dispatch-implementation.md` for full code, data flow, and verification steps.

| Scenario | Recovery |
|----------|----------|
| Agent fails to load skill | Log to `failedSkills`, retry with fallback skill, alert human |
| Handoff fails (agent down) | Queue in shared memory, retry every 5 min, escalate after 3 fails |
| MCP tool execution fails | Retry once, log error, continue with reduced capability |
| Vault box missing | Create stub box automatically, log warning, continue |
| LLM API error | Retry with exponential backoff, fallback to local model if configured |
| Same alert 3+ times | Auto-create kanban ops task (chronic escalation rule) |
| **Agents return canned responses** | Replace simulated dispatch with `callAgentLLM` + `team:dispatch` IPC (see `references/team-dispatch-implementation.md`) |

---

**End of MOSAIC TEAM skill. This framework enables any vertical to deploy
a collaborative AI sales/support/ops team inside Mosaic Bot.**
