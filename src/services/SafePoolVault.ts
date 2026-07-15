// =============================================================================
// SAFE Rev Pool Vault Integration
// 
// This module creates and manages a dedicated vault box for SAFE Rev Pool
// operations, allowing agents to learn how to work with the pool.
// =============================================================================

// Inline Vault types to avoid import issues
export type BoxSourceType = "manual" | "import" | "connector";

export interface VaultBox {
  id: string;
  name: string;
  description?: string;
  sourceType: BoxSourceType;
  createdAt: number;
  updatedAt: number;
}

export interface VaultEntry {
  id: string;
  label?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoxContent {
  boxId: string;
  entries: VaultEntry[];
}

// =============================================================================
// SAFE Rev Pool Vault Box Definition
// =============================================================================

export const SAFE_REV_POOL_VAULT_ID = "safe-rev-pool-operations";

export interface SafePoolVaultBox extends VaultBox {
  /** Pool-specific metadata */
  poolData: {
    poolId: string;
    poolName: string;
    poolStatus: "active" | "paused" | "beta" | "deprecated";
    infrastructure: {
      primaryNode: string;
      tillerSlots: number;
      spoRegistered: boolean;
    };
    economics: {
      driverFee: string;
      shipperFee: string;
      settlementTime: string;
    };
  };
}

// =============================================================================
// SAFE Rev Pool Knowledge Entries
// These are learning materials for agents working with the pool
// =============================================================================

export const SAFE_POOL_ENTRIES: VaultEntry[] = [
  {
    id: "entry-safe-overview",
    label: "SAFE Rev Pool Overview",
    content: `# SAFE Rev Pool - Sovereign Autonomous Freight Exchange

## What is SAFE?

SAFE (Sovereign Autonomous Freight Exchange) is an AI-powered logistics marketplace where Driver Digital Twins and Shipper Agents negotiate freight loads autonomously via Agent-to-Agent (A2A) protocols.

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
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
- Rate: driver experience
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
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

\`\`\`
score = (price_score * 0.35) + 
        (reputation_score * 0.25) + 
        (time_match * 0.20) + 
        (dead_mileage * 0.20)
\`\`\`

Where:
- **price_score**: Lower is better (normalized)
- **reputation_score**: Higher completion %, higher score
- **time_match**: Closer to ideal timing = higher score
- **dead_mileage**: Shorter empty miles = higher score
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "entry-safe-a2a-protocol",
    label: "A2A Negotiation Protocol",
    content: `# SAFE Rev Pool - Agent-to-Agent (A2A) Protocol

## Message Format

All A2A messages use JSON-RPC 2.0 over WebSocket:

\`\`\`json
{
  "jsonrpc": "2.0",
  "method": "a2a.negotiate",
  "params": {
    "sessionId": "uuid-v4",
    "sender": "driver-twin://<driver-id>",
    "recipient": "shipper-agent://<shipper-id>",
    "messageType": "BID | COUNTER | ACCEPT | REJECT",
    "payload": { /* message-specific data */ },
    "timestamp": 1234567890,
    "signature": "0x..." // ECDSA signature
  },
  "id": 1
}
\`\`\`

## Message Types

### BID (Driver → Shipper)
\`\`\`json
{
  "messageType": "BID",
  "payload": {
    "loadId": "load-uuid",
    "driverId": "driver-uuid",
    "bidAmount": 450.00,
    "currency": "USDC",
    "pickupTime": 1234567890,
    "deliveryTime": 1234571490,
    "vehicleType": "box_truck",
    "confidence": 0.92,
    "expiresAt": 1234568490
  }
}
\`\`\`

### COUNTER (Shipper → Driver)
\`\`\`json
{
  "messageType": "COUNTER",
  "payload": {
    "loadId": "load-uuid",
    "counterAmount": 425.00,
    "counterPickupTime": 1234568190,
    "reason": "Budget optimization",
    "expiresAt": 1234568790
  }
}
\`\`\`

### ACCEPT (Either party)
\`\`\`json
{
  "messageType": "ACCEPT",
  "payload": {
    "loadId": "load-uuid",
    "finalPrice": 425.00,
    "finalPickupTime": 1234568190,
    "finalDeliveryTime": 1234571490,
    "smartContractAddress": "0x...",
    "escrowAmount": 425.00
  }
}
\`\`\`

### REJECT (Either party)
\`\`\`json
{
  "messageType": "REJECT",
  "payload": {
    "loadId": "load-uuid",
    "reason": "RATE_TOO_LOW",
    "suggestedAlternative": null
  }
}
\`\`\`

## Negotiation State Machine

\`\`\`
[LOAD_POSTED] 
    ↓ (broadcast)
[BIDDING_OPEN] 
    ↓ (driver submits)
[BID_RECEIVED] 
    ↓ (shipper evaluates)
[EVALUATING] 
    ↓ (decision)
    ├──→ [ACCEPTED] → [ESCROW_LOCKED] → [IN_TRANSIT] → [DELIVERED] → [SETTLED]
    ├──→ [COUNTER_SENT] → [COUNTER_RECEIVED] → [BIDDING_OPEN]
    └──→ [REJECTED] → [BIDDING_OPEN] (to next driver)
\`\`\`

## Timeout Rules

- **Bidding Phase:** 10 minutes from broadcast
- **Counter Phase:** 5 minutes per round
- **Acceptance Phase:** 2 minutes to confirm
- **Auto-reject:** After 3 counter rounds

## Dispute Resolution

If A2A negotiation fails:
1. Log all messages to vault
2. Escalate to Matching Engine
3. Engine recommends fair split
4. Both parties must agree to proceed
5. If no agreement: load returns to pool
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
\`\`\`
score = (completion_rate * 0.40) +
        (on_time_rate * 0.30) +
        (shipper_rating * 0.20) +
        (platform_score * 0.10)
\`\`\`

### Score Thresholds
- 95+: "Diamond" — Priority access to premium loads
- 90-94: "Gold" — Standard access
- 80-89: "Silver" — Limited to verified shippers
- <80: "Bronze" — Requires platform review
- <70: Suspended pending review

### Shipper Score
- Similar calculation based on driver feedback
- Low shipper scores: Must escrow 100% upfront
- Very low: Removed from platform
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
- ❌ Not providing loading dock details

## Platform Guidelines

### Privacy
- Driver location: Shared only after bid acceptance
- Shipper identity: Revealed only to winning driver
- Financial data: Encrypted, never logged to public channels

### Security
- All A2A messages: Signed and encrypted
- Smart contracts: Audited, immutable logic
- Wallet keys: Never stored by platform
- API keys: Rotated monthly

### Support
- Dispute resolution: Available 24/7
- Emergency hotline: For in-transit issues
- Insurance: Automatic for all loads > $1000
- Escalation: Platform reserves right to mediate
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "entry-safe-api-reference",
    label: "API Reference for Agents",
    content: `# SAFE Rev Pool - API Reference for Agents

## Authentication

All API requests require:
\`\`\`
Authorization: Bearer <agent-jwt>
X-Agent-Type: driver-twin | shipper-agent
X-Agent-Id: <agent-uuid>
\`\`\`

## Driver Twin Endpoints

### Get Available Loads
\`\`\`http
GET /api/v1/loads/available

Query Parameters:
- origin (lat,lng): Origin coordinates
- destination (lat,lng): Destination coordinates
- radius (km): Search radius
- cargo_type: Type of cargo accepted
- min_rate: Minimum acceptable rate

Response:
{
  "loads": [
    {
      "id": "load-uuid",
      "origin": { "lat": 51.5, "lng": -0.1 },
      "destination": { "lat": 53.5, "lng": -2.2 },
      "cargo": {
        "type": "palletized",
        "weight_kg": 500,
        "dimensions": { "l": 1.2, "w": 0.8, "h": 1.0 }
      },
      "pickup_window": { "start": 1234567890, "end": 1234571490 },
      "delivery_deadline": 1234575090,
      "suggested_rate": 450.00,
      "currency": "USDC"
    }
  ]
}
\`\`\`

### Submit Bid
\`\`\`http
POST /api/v1/loads/{loadId}/bid

Body:
{
  "bidAmount": 425.00,
  "pickupTime": 1234568190,
  "deliveryTime": 1234571490,
  "message": "Available and ready"
}
\`\`\`

### Get Negotiation Status
\`\`\`http
GET /api/v1/negotiations/{sessionId}

Response:
{
  "status": "counter_received",
  "counterOffer": {
    "amount": 435.00,
    "pickupTime": 1234568490
  },
  "expiresAt": 1234568790
}
\`\`\`

## Shipper Agent Endpoints

### Create Load
\`\`\`http
POST /api/v1/loads

Body:
{
  "origin": { "lat": 51.5, "lng": -0.1, "address": "London" },
  "destination": { "lat": 53.5, "lng": -2.2, "address": "Manchester" },
  "cargo": {
    "description": "Electronics - 10 pallets",
    "weight_kg": 500,
    "dimensions": { "l": 1.2, "w": 0.8, "h": 1.0 },
    "special_requirements": ["fragile"]
  },
  "pickupWindow": { "start": 1234567890, "end": 1234571490 },
  "deliveryDeadline": 1234575090,
  "suggestedRate": 450.00
}
\`\`\`

### Get Bids
\`\`\`http
GET /api/v1/loads/{loadId}/bids

Response:
{
  "bids": [
    {
      "driverId": "driver-uuid",
      "driverName": "John D.",
      "bidAmount": 425.00,
      "pickupTime": 1234568190,
      "deliveryTime": 1234571490,
      "reputation": 0.94,
      "vehicleType": "box_truck"
    }
  ],
  "deadline": 1234568490
}
\`\`\`

### Counter Offer
\`\`\`http
POST /api/v1/negotiations/{sessionId}/counter

Body:
{
  "counterAmount": 430.00,
  "pickupTime": 1234568490,
  "message": "Can you meet this rate?"
}
\`\`\`

## WebSocket Events

Connect to: \`wss://api.safe-freight.exchange/ws/agents\`

### Driver Twin Events
- \`load.available\` — New load matching your criteria
- \`bid.accepted\` — Your bid was accepted
- \`bid.countered\` — Shipper sent counter-offer
- \`negotiation.timeout\` — Negotiation expired
- \`escrow.locked\` — Payment secured, proceed with load
- \`proof.required\` — Upload delivery confirmation
- \`payment.received\` — USDC deposited to your wallet

### Shipper Agent Events
- \`bid.received\` — Driver submitted bid
- \`bid.rejected\` — Driver rejected your load
- \`negotiation.accepted\` — Driver accepted your terms
- \`escrow.confirmed\` — Driver confirmed escrow lock
- \`delivery.update\` — GPS update from driver
- \`delivery.completed\` — Load delivered
- \`payment.sent\` — Escrow released to driver
`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates the initial SAFE Rev Pool vault box configuration
 */
export function createSafePoolVaultBox(): SafePoolVaultBox {
  return {
    id: SAFE_REV_POOL_VAULT_ID,
    name: "SAFE Rev Pool Operations",
    description: "Knowledge base for agents working with the SAFE (Sovereign Autonomous Freight Exchange) Rev Pool. Contains workflows, protocols, best practices, and API documentation.",
    sourceType: "manual",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    poolData: {
      poolId: "safe-freight-pool",
      poolName: "SAFE Freight Exchange",
      poolStatus: "active",
      infrastructure: {
        primaryNode: "C-3PO (192.168.0.150:8000)",
        tillerSlots: 128,
        spoRegistered: true,
      },
      economics: {
        driverFee: "0%",
        shipperFee: "3.5%",
        settlementTime: "< 30 seconds",
      },
    },
  };
}

/**
 * Creates the full box content with all entries
 */
export function createSafePoolBoxContent(): BoxContent {
  return {
    boxId: SAFE_REV_POOL_VAULT_ID,
    entries: SAFE_POOL_ENTRIES,
  };
}

/**
 * Gets a specific entry by ID
 */
export function getSafePoolEntry(entryId: string): VaultEntry | undefined {
  return SAFE_POOL_ENTRIES.find(e => e.id === entryId);
}

/**
 * Searches entries by keyword
 */
export function searchSafePoolEntries(query: string): VaultEntry[] {
  const lowerQuery = query.toLowerCase();
  return SAFE_POOL_ENTRIES.filter(entry => 
    entry.label?.toLowerCase().includes(lowerQuery) ||
    entry.content.toLowerCase().includes(lowerQuery)
  );
}

export default {
  SAFE_REV_POOL_VAULT_ID,
  SAFE_POOL_ENTRIES,
  createSafePoolVaultBox,
  createSafePoolBoxContent,
  getSafePoolEntry,
  searchSafePoolEntries,
};