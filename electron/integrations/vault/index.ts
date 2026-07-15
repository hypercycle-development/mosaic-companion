/**
 * Vault Module
 *
 * Persistence and CRUD for the user's Vault (named boxes).
 * Stored at: ~/.config/mosaic-companion/vault.json
 *
 * Follows the same JSON-file pattern as settings.ts and ai-agents in main.ts.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import type { VaultBox, VaultConfig, VaultEntry, BoxContent } from "./types";

// =============================================================================
// File Paths & Defaults
// =============================================================================

const vaultPath = path.join(app.getPath("userData"), "vault.json");
const vaultContentDir = path.join(app.getPath("userData"), "vault-content");

/** Ensure the vault-content directory exists. */
function ensureContentDir(): void {
  if (!fs.existsSync(vaultContentDir)) {
    fs.mkdirSync(vaultContentDir, { recursive: true });
  }
}

/** Path for a box's content file. */
function boxContentPath(boxId: string): string {
  return path.join(vaultContentDir, `${boxId}.json`);
}

const DEFAULT_VAULT: VaultConfig = {
  boxes: [],
};

// =============================================================================
// Persistence
// =============================================================================

/** Load vault config from disk, returning defaults if missing/corrupt. */
export function loadVault(): VaultConfig {
  try {
    if (fs.existsSync(vaultPath)) {
      const data = fs.readFileSync(vaultPath, "utf8");
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_VAULT,
        ...parsed,
        boxes: Array.isArray(parsed.boxes) ? parsed.boxes : [],
      };
    }
  } catch (error) {
    console.error("[Vault] Failed to load vault config:", error);
  }
  return { ...DEFAULT_VAULT };
}

/** Save vault config to disk. */
function saveVault(config: VaultConfig): { success: boolean; error?: string } {
  try {
    fs.writeFileSync(vaultPath, JSON.stringify(config, null, 2), "utf8");
    console.log("[Vault] Config saved to:", vaultPath);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Vault] Failed to save:", msg);
    return { success: false, error: msg };
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/** Get all boxes. */
export function getBoxes(): VaultBox[] {
  return loadVault().boxes;
}

/** Get a single box by ID. */
export function getBox(id: string): VaultBox | null {
  return getBoxes().find((b) => b.id === id) ?? null;
}

/** Create a new box. */
export function addBox(
  input: Partial<Omit<VaultBox, "id" | "createdAt" | "updatedAt">>,
): { success: boolean; box?: VaultBox; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: "Box name is required" };
  }

  const vault = loadVault();

  // Prevent duplicate names
  const nameExists = vault.boxes.some(
    (b) => b.name.toLowerCase() === input.name!.trim().toLowerCase(),
  );
  if (nameExists) {
    return { success: false, error: `A box named "${input.name.trim()}" already exists` };
  }

  const now = Date.now();
  const box: VaultBox = {
    id: `box-${now}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    sourceType: input.sourceType || "manual",
    createdAt: now,
    updatedAt: now,
  };

  vault.boxes.push(box);
  const result = saveVault(vault);
  return { ...result, box };
}

/** Update an existing box (partial update). */
export function updateBox(
  id: string,
  updates: Partial<Omit<VaultBox, "id" | "createdAt">>,
): { success: boolean; box?: VaultBox; error?: string } {
  const vault = loadVault();
  const index = vault.boxes.findIndex((b) => b.id === id);

  if (index === -1) {
    return { success: false, error: "Box not found" };
  }

  // If renaming, check for duplicates (exclude self)
  if (updates.name) {
    const nameExists = vault.boxes.some(
      (b) =>
        b.id !== id &&
        b.name.toLowerCase() === updates.name!.trim().toLowerCase(),
    );
    if (nameExists) {
      return { success: false, error: `A box named "${updates.name.trim()}" already exists` };
    }
  }

  vault.boxes[index] = {
    ...vault.boxes[index],
    ...updates,
    updatedAt: Date.now(),
  };

  const result = saveVault(vault);
  return { ...result, box: vault.boxes[index] };
}

/** Delete a box by ID. */
export function deleteBox(id: string): { success: boolean; error?: string } {
  const vault = loadVault();
  const index = vault.boxes.findIndex((b) => b.id === id);

  if (index === -1) {
    return { success: false, error: "Box not found" };
  }

  vault.boxes.splice(index, 1);
  const result = saveVault(vault);

  // Clean up associated content file if it exists
  try {
    const contentFile = boxContentPath(id);
    if (fs.existsSync(contentFile)) {
      fs.unlinkSync(contentFile);
      console.log("[Vault] Content file deleted for box:", id);
    }
  } catch (err) {
    console.warn("[Vault] Could not delete content file for box:", id, err);
  }

  return result;
}

// =============================================================================
// Agent Access Helpers
// =============================================================================

/**
 * Get all boxes that a specific agent has access to.
 * Reads the agent's config from ai-agents.json to find its boxAccess array,
 * then returns matching boxes from the vault.
 */
export function getAgentBoxes(agentId: string): VaultBox[] {
  const agentsPath = path.join(app.getPath("userData"), "ai-agents.json");

  let agents: Array<{ id: string; boxAccess?: string[]; [key: string]: unknown }> = [];
  try {
    if (fs.existsSync(agentsPath)) {
      agents = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
    }
  } catch {
    return [];
  }

  const agent = agents.find((a) => a.id === agentId);
  if (!agent || !agent.boxAccess || agent.boxAccess.length === 0) {
    return [];
  }

  const allBoxes = getBoxes();
  const accessSet = new Set(agent.boxAccess);
  return allBoxes.filter((b) => accessSet.has(b.id));
}

/**
 * Check whether an agent has access to a specific box.
 */
export function canAgentAccessBox(agentId: string, boxId: string): boolean {
  const agentBoxes = getAgentBoxes(agentId);
  return agentBoxes.some((b) => b.id === boxId);
}

// =============================================================================
// Box Content CRUD
// =============================================================================

/** Load a box's content from disk. Returns empty content if not found. */
function loadBoxContent(boxId: string): BoxContent {
  ensureContentDir();
  const filePath = boxContentPath(boxId);
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return {
        boxId,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    }
  } catch (err) {
    console.error("[Vault] Failed to load content for box:", boxId, err);
  }
  return { boxId, entries: [] };
}

/** Save a box's content to disk. */
function saveBoxContent(
  content: BoxContent,
): { success: boolean; error?: string } {
  ensureContentDir();
  try {
    fs.writeFileSync(
      boxContentPath(content.boxId),
      JSON.stringify(content, null, 2),
      "utf8",
    );
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Vault] Failed to save content for box:", content.boxId, msg);
    return { success: false, error: msg };
  }
}

/** Get all entries in a box. */
export function getBoxContent(boxId: string): VaultEntry[] {
  return loadBoxContent(boxId).entries;
}

/** Add a new entry to a box. */
export function addEntry(
  boxId: string,
  input: { content: string; label?: string; metadata?: VaultEntry["metadata"] },
): { success: boolean; entry?: VaultEntry; error?: string } {
  if (!input.content || input.content.trim().length === 0) {
    return { success: false, error: "Entry content cannot be empty" };
  }

  const boxContent = loadBoxContent(boxId);
  const now = Date.now();
  const entry: VaultEntry = {
    id: `entry-${now}`,
    label: input.label?.trim() || undefined,
    content: input.content.trim(),
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };

  boxContent.entries.push(entry);
  const result = saveBoxContent(boxContent);
  return { ...result, entry };
}

/** Update an existing entry (partial). */
export function updateEntry(
  boxId: string,
  entryId: string,
  updates: { content?: string; label?: string; metadata?: VaultEntry["metadata"] },
): { success: boolean; entry?: VaultEntry; error?: string } {
  const boxContent = loadBoxContent(boxId);
  const index = boxContent.entries.findIndex((e) => e.id === entryId);

  if (index === -1) {
    return { success: false, error: "Entry not found" };
  }

  boxContent.entries[index] = {
    ...boxContent.entries[index],
    ...updates,
    updatedAt: Date.now(),
  };

  const result = saveBoxContent(boxContent);
  return { ...result, entry: boxContent.entries[index] };
}

/** Delete an entry from a box. */
export function deleteEntry(
  boxId: string,
  entryId: string,
): { success: boolean; error?: string } {
  const boxContent = loadBoxContent(boxId);
  const index = boxContent.entries.findIndex((e) => e.id === entryId);

  if (index === -1) {
    return { success: false, error: "Entry not found" };
  }

  boxContent.entries.splice(index, 1);
  return saveBoxContent(boxContent);
}

// =============================================================================
// SAFE Rev Pool Vault Initialization
// =============================================================================

/**
 * Initialize the SAFE Rev Pool vault box with all learning entries.
 * Called on app startup to ensure agents have access to pool knowledge.
 */
export function initializeSafePoolVault(): { success: boolean; message: string } {
  const SAFE_POOL_BOX_ID = "safe-rev-pool-operations";
  const SAFE_POOL_BOX_NAME = "SAFE Rev Pool Operations";

  // Check if box already exists
  const existing = getBox(SAFE_POOL_BOX_ID);
  if (existing) {
    return { success: true, message: "SAFE Rev Pool vault already initialized" };
  }

  // Create the vault box
  const now = Date.now();
  const vault = loadVault();
  
  const box: VaultBox = {
    id: SAFE_POOL_BOX_ID,
    name: SAFE_POOL_BOX_NAME,
    description: "Knowledge base for agents working with the SAFE (Sovereign Autonomous Freight Exchange) Rev Pool. Contains workflows, protocols, best practices, and API documentation.",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  };

  vault.boxes.push(box);
  const saveResult = saveVault(vault);
  
  if (!saveResult.success) {
    return { success: false, message: `Failed to create vault box: ${saveResult.error}` };
  }

  // Create entries with all the learning content
  const entries: VaultEntry[] = [
    {
      id: "entry-safe-overview",
      label: "SAFE Rev Pool Overview",
      content: `# SAFE Rev Pool - Sovereign Autonomous Freight Exchange

## What is SAFE?

SAFE is an AI-powered logistics marketplace where Driver Digital Twins and Shipper Agents negotiate freight loads autonomously via Agent-to-Agent (A2A) protocols.

## Key Differentiators

### For Drivers
- **0% fees** (vs AnyVan 15%, Shiply 10-20%)
- Instant USDC settlement (< 30 seconds)
- No manual bidding
- AI negotiates optimal rates
- Dead mileage optimization

### For Shippers
- Lower total costs (2-5% vs 10-20%)
- Real-time tracking via Driver Digital Twin
- Predictive delivery times
- Zero payment disputes (smart contract escrow)

## Infrastructure

- **Primary Node:** C-3PO (192.168.0.150:8000)
- **Tiller Slots:** 128
- **Settlement:** HyperCycle proof server
- **Network:** UK Pilot (London-Manchester corridor)

## AIMs Deployed

1. **Driver Digital Twin** - Represents driver capabilities, preferences, availability
2. **Shipper Agent** - Manages cargo requests, negotiates rates
3. **Matching Engine** - Constraint satisfaction + scoring + A2A negotiation
4. **Settlement Service** - Smart contract escrow + USDC payment`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "entry-safe-workflows",
      label: "Agent Workflows",
      content: `# SAFE Rev Pool - Agent Workflows

## Driver Digital Twin Workflow

### 1. Registration
- Driver creates digital twin with preferences
- Specify: vehicle type, capacity, operating regions
- Set: availability windows, minimum rates
- Configure: notification preferences

### 2. Load Discovery
- System broadcasts available loads
- Driver Twin receives matching requests
- Filter by: geography, capacity, profitability

### 3. Bid Preparation
- Calculate: fuel cost, time, opportunity cost
- Apply: driver's pricing strategy
- Generate: bid with confidence score

### 4. A2A Negotiation
- Receive counter-offers from Shipper Agent
- Negotiate: price, pickup time, delivery window
- Use multi-factor scoring to evaluate
- Accept or reject within timeout window

### 5. Load Execution
- Receive route optimization
- Update status: en route, loading, in transit
- Transmit GPS telemetry
- Confirm: proof of delivery

### 6. Settlement
- Upload: delivery confirmation
- Trigger: smart contract release
- Receive: USDC to wallet (< 30s)
- Update: reputation score

## Shipper Agent Workflow

### 1. Cargo Submission
- Parse: natural language cargo description
- Extract: origin, destination, cargo type, weight
- Validate: against carrier requirements

### 2. Load Broadcasting
- Broadcast to: matching Driver Twins
- Include: route, requirements, suggested price
- Set: bid deadline

### 3. Bid Evaluation
- Collect: all driver bids
- Score: price, reputation, availability, vehicle match
- Rank: top candidates

### 4. Negotiation
- Counter-offer to top candidates
- Negotiate: price, timing, special requirements
- Select: winning driver

### 5. Monitoring
- Track: driver progress via Digital Twin
- Update: shipper on status changes
- Alert: on delays or issues

### 6. Confirmation
- Verify: delivery completion
- Release: escrow payment
- Rate: driver experience`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "entry-safe-constraints",
      label: "Constraint Matching Rules",
      content: `# SAFE Rev Pool - Constraint Matching Rules

## Geographic Constraints

### Must Match (Hard Constraints)
- Driver must serve origin region
- Driver must serve destination region  
- Vehicle must be within operating radius

### Soft Constraints
- Preferred: shorter dead mileage
- Preferred: driver knows route
- Preferred: driver has delivered to destination before

## Capacity Constraints

### Vehicle Matching
- Cargo weight ≤ vehicle capacity
- Cargo dimensions ≤ vehicle dimensions
- Special handling requirements (refrigerated, fragile, etc.)

### Volume Matching
- Driver available for pickup window
- Driver can meet delivery deadline
- Driver has hours remaining for duty cycle

## Time Constraints

### Pickup Window
- Driver can arrive at pickup location within window
- Loading time + transit time + buffer

### Delivery Window
- Driver can deliver by deadline
- Transit time includes traffic, weather, rest stops

## Economic Constraints

### Minimum Rate
- Driver's minimum acceptable rate per mile
- Must cover: fuel, depreciation, time

### Maximum Negotiation Rounds
- Hard limit: 3 rounds
- Timeout: 5 minutes per round
- Auto-accept if within 5% of target

## Scoring Formula

The Matching Engine scores each bid using:

score = (price_score * 0.35) + 
        (reputation_score * 0.25) + 
        (time_match * 0.20) + 
        (dead_mileage * 0.20)

Where:
- **price_score**: Lower is better (normalized)
- **reputation_score**: Higher completion %, higher score
- **time_match**: Closer to ideal timing = higher score
- **dead_mileage**: Shorter empty miles = higher score`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "entry-safe-a2a-protocol",
      label: "A2A Negotiation Protocol",
      content: `# SAFE Rev Pool - Agent-to-Agent (A2A) Protocol

## Message Format

All A2A messages use JSON-RPC 2.0 over WebSocket.

## Message Types

### BID (Driver → Shipper)
{ "messageType": "BID", "loadId": "...", "driverId": "...", "bidAmount": 450.00, "currency": "USDC", "pickupTime": 1234567890, "deliveryTime": 1234571490, "vehicleType": "box_truck", "confidence": 0.92 }

### COUNTER (Shipper → Driver)
{ "messageType": "COUNTER", "loadId": "...", "counterAmount": 425.00, "counterPickupTime": 1234568190, "reason": "Budget optimization", "expiresAt": 1234568790 }

### ACCEPT (Either party)
{ "messageType": "ACCEPT", "loadId": "...", "finalPrice": 425.00, "finalPickupTime": 1234568190, "finalDeliveryTime": 1234571490, "smartContractAddress": "0x...", "escrowAmount": 425.00 }

### REJECT (Either party)
{ "messageType": "REJECT", "loadId": "...", "reason": "RATE_TOO_LOW", "suggestedAlternative": null }

## Negotiation State Machine

[LOAD_POSTED] → [BIDDING_OPEN] → [BID_RECEIVED] → [EVALUATING]
   ├──→ [ACCEPTED] → [ESCROW_LOCKED] → [IN_TRANSIT] → [DELIVERED] → [SETTLED]
   ├──→ [COUNTER_SENT] → [COUNTER_RECEIVED] → [BIDDING_OPEN]
   └──→ [REJECTED] → [BIDDING_OPEN] (to next driver)

## Timeout Rules

- **Bidding Phase:** 10 minutes from broadcast
- **Counter Phase:** 5 minutes per round
- **Acceptance Phase:** 2 minutes to confirm
- **Auto-reject:** After 3 counter rounds`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "entry-safe-settlement",
      label: "Settlement & Escrow",
      content: `# SAFE Rev Pool - Settlement & Escrow

## Smart Contract Escrow

### Escrow Creation (Shipper)
1. Shipper deposits USDC to smart contract
2. Contract holds funds until delivery confirmation
3. Contract address shared with Driver Twin
4. Multi-sig: Driver + Shipper + Platform

### Delivery Confirmation
1. Driver uploads: proof of delivery (photo + signature)
2. Shipper confirms: delivery received
3. Platform validates: GPS matches destination
4. 2-of-3 signatures required to release

### Payment Release
1. Upon confirmation: smart contract releases USDC
2. Driver receives: 96.5% of amount (after 3.5% platform fee)
3. Settlement time: < 30 seconds
4. Transaction hash logged to vault

## Failure Scenarios

### Driver No-Show
- After 1 hour: Shipper can cancel
- Escrow returns to Shipper
- Driver reputation penalized
- Driver banned after 3 no-shows

### Late Delivery
- Up to 30 min: No penalty
- 30-60 min: 5% penalty from driver share
- 60+ min: 10% penalty + shipper can reject
- Rejected: Funds returned to shipper

### Damaged Cargo
- Driver uploads: damage documentation
- Insurance claim: filed automatically
- Escrow: held pending claim resolution
- Driver liable: up to insurance deductible

## Reputation System

### Driver Score Calculation
score = (completion_rate * 0.40) + (on_time_rate * 0.30) + (shipper_rating * 0.20) + (platform_score * 0.10)

### Score Thresholds
- 95+: "Diamond" — Priority access to premium loads
- 90-94: "Gold" — Standard access
- 80-89: "Silver" — Limited to verified shippers
- <80: "Bronze" — Requires platform review
- <70: Suspended pending review`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "entry-safe-best-practices",
      label: "Agent Best Practices",
      content: `# SAFE Rev Pool - Agent Best Practices

## For Driver Digital Twins

### Bid Optimization
1. **Don't bid on every load** — Focus on your profitable corridors
2. **Know your costs** — Calculate true cost per mile including empty miles
3. **Price confidently** — Low bids win but hurt margins; find your floor
4. **Communicate early** — If delays happen, notify immediately

### Negotiation Strategy
1. **First bid matters** — Sets anchor for negotiation
2. **Know when to walk** — Have a minimum rate and stick to it
3. **Counter quickly** — Delays reduce your chance of winning
4. **Build relationships** — Repeat shippers offer better rates

### Reputation Management
1. **Never ghost** — Always respond, even if rejecting
2. **Be precise** — Accurate ETAs build trust
3. **Document everything** — Photos protect you in disputes
4. **Ask for ratings** — Good shippers will rate you well

## For Shipper Agents

### Load Posting
1. **Clear descriptions** — Ambiguity leads to bad matches
2. **Realistic pricing** — Research market rates before posting
3. **Flexible windows** — Tighter windows = higher prices needed
4. **Provide context** — Special requirements in description

### Negotiation Strategy
1. **Know market rate** — Research before counter-offering
2. **Respect driver costs** — Don't negotiate below profitability
3. **Offer alternatives** — Suggest different pickup times if price is issue
4. **Be decisive** — Slow responses lose good drivers

### Relationship Building
1. **Rate fairly** — Good drivers deserve good ratings
2. **Pay promptly** — Consider releasing escrow early for proven drivers
3. **Communicate changes** — Route changes, delays, etc.
4. **Feedback loop** — Tell platform about good/bad experiences

## Common Mistakes to Avoid

### Driver Twins
- ❌ Bidding without checking route feasibility
- ❌ Accepting loads that conflict with existing bookings
- ❌ Not accounting for dead mileage in bid price
- ❌ Late communication about delays
- ❌ Inadequate proof of delivery documentation

### Shipper Agents
- ❌ Unrealistic price expectations
- ❌ Vague cargo descriptions
- ❌ Excessive negotiation rounds
- ❌ Late payment or delayed escrow release
- ❌ Not providing loading dock details`,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Save all entries to the box content file
  const boxContent: BoxContent = {
    boxId: SAFE_POOL_BOX_ID,
    entries,
  };

  const contentResult = saveBoxContent(boxContent);
  
  if (!contentResult.success) {
    return { success: false, message: `Failed to save vault content: ${contentResult.error}` };
  }

  console.log("[Vault] SAFE Rev Pool vault initialized with", entries.length, "entries");
  return { success: true, message: `SAFE Rev Pool vault initialized with ${entries.length} knowledge entries` };
}
