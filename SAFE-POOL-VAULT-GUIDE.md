# SAFE Rev Pool - Vault Integration Guide

## Overview

This document explains how the SAFE Rev Pool is integrated into Mosaic-Companion's Vault system, allowing agents to learn pool operations and be delegated tasks.

## Vault Architecture in Mosaic

### Location
**Left Sidebar → Vault** (icon: Package 📦)

### Components

```
Vault/
├── Boxes (Named containers)
│   ├── Box: "SAFE Rev Pool Operations" ⬅️ Our pool knowledge
│   │   ├── Entries (Knowledge items)
│   │   │   ├── Entry: "Pool Overview"
│   │   │   ├── Entry: "Agent Workflows"  
│   │   │   ├── Entry: "Constraint Matching"
│   │   │   ├── Entry: "A2A Protocol"
│   │   │   ├── Entry: "Settlement & Escrow"
│   │   │   └── Entry: "Best Practices"
│   │   └── Agent Access (Who can read this box)
│   │       ├── Agent A: ✅ Granted
│   │       └── Agent B: ❌ Denied
│   └── Other Boxes...
└── Actions
    ├── Create Box
    ├── Add Entry
    └── Delegate to Agents
```

## SAFE Rev Pool Vault Box

### Box Details

| Property | Value |
|----------|-------|
| **Box ID** | `safe-rev-pool-operations` |
| **Box Name** | SAFE Rev Pool Operations |
| **Source Type** | Manual |
| **Created** | Auto-generated on app startup |
| **Location** | `~/.config/mosaic-companion/vault.json` |

### Knowledge Entries (6 Total)

#### 1. Pool Overview (`entry-safe-overview`)
**Purpose:** High-level understanding of what SAFE is

**Content:**
- What is SAFE? (Sovereign Autonomous Freight Exchange)
- Key differentiators for drivers (0% fees vs AnyVan 15%)
- Key differentiators for shippers (2-5% vs 10-20%)
- Infrastructure: C-3PO (128 slots), HyperCycle, UK Pilot
- AIMs deployed: Driver Twin, Shipper Agent, Matching Engine, Settlement

**When to use:** 
- Onboarding new agents
- Explaining the pool to stakeholders
- Understanding the value proposition

---

#### 2. Agent Workflows (`entry-safe-workflows`)
**Purpose:** Step-by-step processes for Driver Twins and Shipper Agents

**Driver Digital Twin Workflow:**
1. Registration → Set preferences, vehicle, regions
2. Load Discovery → Receive matching loads
3. Bid Preparation → Calculate costs, generate bid
4. A2A Negotiation → Negotiate with Shipper Agent
5. Load Execution → Transport with GPS tracking
6. Settlement → Upload proof, receive USDC (<30s)

**Shipper Agent Workflow:**
1. Cargo Submission → Parse description
2. Load Broadcasting → Broadcast to drivers
3. Bid Evaluation → Score and rank bids
4. Negotiation → Counter-offer, select winner
5. Monitoring → Track driver progress
6. Confirmation → Verify delivery, release escrow

**When to use:**
- Building new agent implementations
- Debugging workflow issues
- Training agents on proper sequencing

---

#### 3. Constraint Matching Rules (`entry-safe-constraints`)
**Purpose:** How the Matching Engine evaluates loads

**Hard Constraints (Must Match):**
- Driver serves origin region
- Driver serves destination region
- Vehicle capacity ≥ cargo weight
- Vehicle dimensions ≥ cargo dimensions

**Soft Constraints (Scored):**
- Shorter dead mileage (preferred)
- Driver knows route (preferred)
- Delivery deadline feasibility

**Scoring Formula:**
```
score = (price_score * 0.35) + 
        (reputation_score * 0.25) + 
        (time_match * 0.20) + 
        (dead_mileage * 0.20)
```

**When to use:**
- Understanding why a match was/wasn't made
- Tuning the matching algorithm
- Debugging constraint satisfaction issues

---

#### 4. A2A Negotiation Protocol (`entry-safe-a2a-protocol`)
**Purpose:** How agents communicate with each other

**Message Format:** JSON-RPC 2.0 over WebSocket

**Message Types:**
- `BID` → Driver submits bid to shipper
- `COUNTER` → Shipper counters with new terms
- `ACCEPT` → Either party accepts deal
- `REJECT` → Either party rejects deal

**State Machine:**
```
LOAD_POSTED → BIDDING_OPEN → BID_RECEIVED → EVALUATING
   ├──→ ACCEPTED → ESCROW_LOCKED → IN_TRANSIT → DELIVERED → SETTLED
   ├──→ COUNTER_SENT → COUNTER_RECEIVED → BIDDING_OPEN
   └──→ REJECTED → BIDDING_OPEN
```

**Timeout Rules:**
- Bidding: 10 minutes
- Counter: 5 minutes per round
- Acceptance: 2 minutes
- Max rounds: 3

**When to use:**
- Implementing A2A messaging
- Debugging negotiation failures
- Understanding deal lifecycle

---

#### 5. Settlement & Escrow (`entry-safe-settlement`)
**Purpose:** Payment flow and dispute handling

**Escrow Process:**
1. Shipper deposits USDC to smart contract
2. Contract holds funds until delivery
3. 2-of-3 multi-sig: Driver + Shipper + Platform
4. Upon confirmation: releases USDC to driver

**Payment Flow:**
- Driver receives: 96.5% (after 3.5% platform fee)
- Settlement time: < 30 seconds
- Transaction hash: logged to vault

**Failure Scenarios:**
- Driver no-show: Escrow returns to shipper after 1 hour
- Late delivery: 5-10% penalty based on delay
- Damaged cargo: Insurance claim auto-filed

**Reputation System:**
```
score = (completion_rate * 0.40) + 
        (on_time_rate * 0.30) + 
        (shipper_rating * 0.20) + 
        (platform_score * 0.10)
```

**Score Thresholds:**
- 95+: Diamond (priority access)
- 90-94: Gold (standard access)
- 80-89: Silver (verified shippers only)
- <80: Bronze (requires review)
- <70: Suspended

**When to use:**
- Understanding payment flows
- Handling disputes
- Reputation calculations

---

#### 6. Best Practices (`entry-safe-best-practices`)
**Purpose:** Tips and common mistakes for agents

**Driver Twin Best Practices:**
- ✅ Focus on profitable corridors
- ✅ Know true cost per mile
- ✅ Price confidently (don't undercut)
- ✅ Communicate delays early
- ✅ Never ghost - always respond
- ✅ Document everything with photos

**Shipper Agent Best Practices:**
- ✅ Clear cargo descriptions
- ✅ Research market rates before posting
- ✅ Respect driver costs
- ✅ Be decisive - slow loses drivers
- ✅ Rate drivers fairly
- ✅ Pay promptly

**Common Mistakes:**
- ❌ Bidding without checking feasibility
- ❌ Accepting conflicting bookings
- ❌ Not accounting for dead mileage
- ❌ Vague cargo descriptions
- ❌ Excessive negotiation rounds

**When to use:**
- Training new agents
- Troubleshooting performance issues
- Setting agent behavior guidelines

---

## Delegating to Agents

### Step 1: Grant Box Access

1. Open **Vault** (left sidebar)
2. Find **"SAFE Rev Pool Operations"** box
3. Click **Expand** (chevron down)
4. Click **"Agent Access"** tab
5. Toggle agents you want to grant access

### Step 2: Verify Access

Agents with access can:
- Read all entries in the box
- Use the knowledge in their operations
- Be delegated pool-related tasks

### Step 3: Delegate Tasks

In **AI Chat**, you can now ask agents:

```
"@AgentName Using the SAFE Rev Pool knowledge, 
help me understand why this load didn't match"

"@AgentName Following the Driver Twin workflow, 
what should happen after bid acceptance?"

"@AgentName Check the A2A protocol entry - 
what's the timeout for counter offers?"
```

## Agent Configuration

### Adding Box Access to Agent Config

When creating/editing an agent in **AI Chat → Settings**:

```json
{
  "id": "my-pool-agent",
  "name": "Pool Operator",
  "boxAccess": ["safe-rev-pool-operations"],
  "vaultSkills": {
    "safe-rev-pool-operations": [
      "entry-safe-workflows",
      "entry-safe-constraints"
    ]
  }
}
```

### Agent System Prompt Template

```
You are an agent operator for the SAFE Rev Pool.
You have access to the "SAFE Rev Pool Operations" vault box
containing knowledge about:
- Pool overview and differentiators
- Agent workflows (Driver Twin & Shipper Agent)
- Constraint matching rules
- A2A negotiation protocol
- Settlement and escrow procedures
- Best practices

Use this knowledge to:
1. Answer questions about pool operations
2. Debug matching/negotiation issues
3. Guide users through workflows
4. Explain the reputation system
```

## Triggers for Agent Actions

### Trigger 1: Load Posted
**When:** New load enters the system
**Agent Action:** 
- Query "Agent Workflows" → Shipper Agent step 2
- Query "Constraint Matching" → Filter eligible drivers

### Trigger 2: Bid Received
**When:** Driver submits bid
**Agent Action:**
- Query "Agent Workflows" → Shipper Agent step 3
- Query "Constraint Matching" → Score the bid

### Trigger 3: Negotiation Started
**When:** Counter-offer sent
**Agent Action:**
- Query "A2A Protocol" → Message format
- Query "A2A Protocol" → Timeout rules

### Trigger 4: Delivery Completed
**When:** Proof of delivery uploaded
**Agent Action:**
- Query "Settlement & Escrow" → Release process
- Query "Settlement & Escrow" → Reputation update

### Trigger 5: Dispute Raised
**When:** Shipper or driver reports issue
**Agent Action:**
- Query "Settlement & Escrow" → Failure scenarios
- Query "Best Practices" → Prevention tips

## API for Programmatic Access

### From Renderer (React)

```typescript
// Get all entries from SAFE Rev Pool vault
const entries = await window.electronAPI?.vault?.getBoxContent(
  "safe-rev-pool-operations"
);

// Search entries
const searchResults = entries.filter(e => 
  e.content.includes("negotiation")
);
```

### From Main Process

```typescript
import { getBoxContent } from "./integrations/vault";

const entries = getBoxContent("safe-rev-pool-operations");
```

## File Locations

| File | Path | Purpose |
|------|------|---------|
| Vault Config | `~/.config/mosaic-companion/vault.json` | Box metadata |
| Box Content | `~/.config/mosaic-companion/vault-content/safe-rev-pool-operations.json` | Entries |
| Source | `electron/integrations/vault/index.ts` | Vault logic |
| UI | `src/components/VaultPage.tsx` | Vault page |
| Init | `electron/main.ts` | Auto-initialization |

## Troubleshooting

### Vault Not Showing
1. Restart Mosaic-Companion
2. Check console for `[Vault] SAFE Rev Pool vault initialized`
3. Verify `vault.json` exists

### Agents Can't Access
1. Go to Vault → SAFE Rev Pool Operations
2. Click "Agent Access" tab
3. Ensure agent toggle is ON
4. Restart agent session

### Entries Missing
1. Check `vault-content/safe-rev-pool-operations.json`
2. Should contain 6 entries
3. If empty, delete file and restart app

## Summary

The SAFE Rev Pool is now a first-class citizen in Mosaic's Vault system:

✅ **Created:** `safe-rev-pool-operations` vault box  
✅ **Populated:** 6 comprehensive knowledge entries  
✅ **Accessible:** Via left sidebar → Vault  
✅ **Delegable:** Grant agent access per-box  
✅ **Searchable:** Full-text search across entries  
✅ **Extensible:** Add new entries anytime  

Agents can now learn pool operations from the vault and be delegated tasks with full context.