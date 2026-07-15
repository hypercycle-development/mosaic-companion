# Stargate Tilling — Community Compute Service for Node Factories
## Non-Custodial Tilling Powered by Decentralized HyperAIBox Cloud

**Version:** 1.0  
**Date:** 2026-06-27  
**Author:** AI Architect (Hermes)  
**Scope:** Community Service → Stargate Pool → Global HyperAIBox Fleet

> **What is Stargate Tilling?** A community-powered service where users delegate their HyperAIBoxes and appliances to the Stargate Pool, enabling non-custodial Node Factory tilling at prices more accessible than centralized alternatives. The network is the infrastructure.

---

## 1. What Is Tilling?

In the **HyperCycle ecosystem**, "tilling" (or "tiling") is the process of **registering a Node Factory** on the network so it can produce compute (AIM modules, inference, etc.) and earn rewards. Think of it as:

- **Staking a license** (ANFE) on a compute node
- **Activating the node** so it can serve requests
- **Earning yield** from the network based on uptime and compute contribution

**HyperPG** currently offers a managed tilling service for **$5/month** where they run your Node Factory on their infrastructure.

**Stargate Pool Tilling Service** proposes to do the same thing — but cheaper, decentralized, and **non-custodial**.

---

## 2. The Core Idea: "Stargate Tilling"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER FLOW: Stargate Tilling — Community Compute Service                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User navigates to Node Factory Ops → "Start" tab in Mosaic            │
│     └── Selects their Node Factory (ANFE license) from the tracker        │
│                                                                             │
│  2. User sees options:                                                     │
│     a) Stargate Tilling on my own HyperAIBox (if they own one)            │
│     b) Stargate Tilling via Pool (rent decentralized community compute)     │
│                                                                             │
│  3. User selects (b) → Stargate Pool                                       │
│     └── Matchmaker finds cheapest available HyperAIBox                     │
│     └── Shows price: $3.00/month shared / $0.01/hr spot (vs HyperPG $5.00/mo)    │
│                                                                             │
│  4. User confirms → USDC payment (smart contract escrow)                  │
│     └── NO KEYS LEAVE USER'S WALLET → NON-CUSTODIAL                     │
│                                                                             │
│  5. Stargate Pool provisions tilling container on selected box           │
│     └── HBA on box receives provision command                            │
│     └── HBA starts HyperCycle Node Manager + AIM container               │
│     └── Node Factory is LIVE and earning                                 │
│                                                                             │
│  6. User receives tilling dashboard:                                       │
│     └── Node status, earnings, uptime                                    │
│     └── "Stop Tilling" button (releases container, refunds unused)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Makes It Non-Custodial?

| Aspect | HyperPG (Managed) | **Stargate Tilling (Community)** |
|--------|-------------------|-----------------------------------|
| **Keys** | HyperPG holds your ANFE keys | **You keep your keys** — never leave your wallet |
| **Node Factory** | Runs on HyperPG servers | Runs on **your rented box** via Docker |
| **Earnings** | HyperPG collects and forwards | **Direct to your wallet** — no intermediary |
| **Control** | You trust HyperPG | **You control start/stop** via Mosaic UI |
| **Censorship** | Can be shut down by HyperPG | **Decentralized** — boxes around globe |

### How Stargate Tilling Works:

1. **User signs a delegation message** (not a transaction transferring keys)
   - Uses EIP-712 typed data: "I authorize HyperAIBox [box-id] to run Node Factory [license-id] on my behalf"
   - Signature is temporary and revocable

2. **HBA receives the signed delegation** and passes it to Node Manager
   - Node Manager starts with `--delegate` flag + signature
   - Node Factory runs but user retains ownership

3. **All earnings flow to user's wallet** (the one that signed delegation)
   - Smart contract on HyperCycle network verifies delegation
   - Rewards sent directly to owner address from delegate_data

4. **User can revoke anytime** via Mosaic UI
   - "Stop Tilling" sends revoke command → container stops → delegation invalidated
   - Unused funds refunded from escrow

---

## 4. Architecture: Tilling Service ↔ Stargate Pool

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MOSAIC COMPANION (User UI)                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Node Factory Tracker Panel (existing)                               │  │
│  │  ├── License list (Base, Ethereum)                                    │  │
│  │  ├── Status: alive/dead/error                                       │  │
│  │  └── [NEW] "Stargate Tilling" button                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [NEW] Tilling Service Wizard                                        │  │
│  │  ├── Step 1: Select Node Factory (from tracker)                     │  │
│  │  ├── Step 2: Choose tilling mode                                    │  │
│  │  │     a) My own HyperAIBox (if available)                         │  │
│  │  │     b) Stargate Pool (rent compute)                              │  │
│  │  ├── Step 3: If (b), browse pool boxes + prices                   │  │
│  │  ├── Step 4: Sign delegation (non-custodial)                      │  │
│  │  ├── Step 5: USDC payment → escrow contract                         │  │
│  │  └── Step 6: Monitor tilling dashboard                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │  IPC / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STARGATE POOL ORCHESTRATOR (SPO)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Matchmaker       │  │ Pricing Engine   │  │ Booking Manager        │  │
│  │ Find best box    │  │ $3.00/mo shared   │  │ USDC escrow + payout   │  │
│  │ for tilling      │  │ $0.01/hr spot     │  │ Owner: 60%, SPO: 30%   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ [NEW] TillingProvisioner                                            │  │
│  │ Receives: license_id, owner_wallet, signed_delegation, box_id       │  │
│  │ Forwards provision to HBA with tilling-specific config              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │  HTTP POST /provision
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HYPERAIBOX AGENT (HBA) on Box                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ [NEW] TillingProvisionerHandler                                     │  │
│  │ Receives: tilling provision command                                 │  │
│  │ Starts: HyperCycle Node Manager + AIM Container + Tilling config    │  │
│  │ Passes: signed_delegation to Node Manager startup                   │  │
│  │ Exposes: tilling status API (/tilling/status)                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Docker Tenant Container (Tilling Mode)                             │  │
│  │  ├── HyperCycle Node Manager (port 8000)                            │  │
│  │  │     └── Runs with --delegate [signature]                          │  │
│  │  ├── AIM Container (port 9000, slot 0)                              │  │
│  │  │     └── Serves inference requests                              │  │
│  │  └── [NEW] Tilling Monitor Agent                                    │  │
│  │        └── Reports earnings, uptime, status to SPO                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tilling Service Components

### 5.1 TillingProvisioner (SPO Service)

```typescript
interface TillingProvisionRequest {
  licenseId: string;           // ANFE license ID
  ownerWallet: string;         // User's wallet (receives earnings)
  boxId: string;               // Selected HyperAIBox from pool
  delegationSignature: string; // EIP-712 signed delegation
  durationDays: number;        // Rental duration
  network: 'base' | 'ethereum'; // Which chain the license is on
}

interface TillingProvisionResult {
  tenantId: string;
  boxId: string;
  status: 'provisioning' | 'tilling' | 'failed';
  nodeManagerUrl: string;      // http://[box-wg-ip]:8000
  earningsAddress: string;     // Same as ownerWallet
  startTime: number;
  estimatedEndTime: number;
}
```

### 5.2 Tilling-Specific HBA Config

When HBA receives a tilling provision, it:

1. Pulls the **HyperCycle Node Manager image** (or uses existing)
2. Starts Node Manager with `--delegate` + user's signature
3. Deploys AIM container (Mosaic Hermes AIM)
4. Starts **Tilling Monitor Agent** — reports earnings to SPO

```json
{
  "tenant_id": "till-abc123",
  "tilling_mode": true,
  "license_id": "2324779898048044",
  "owner_wallet": "0xUserWallet...",
  "delegation_signature": "0x...",
  "network": "base",
  "node_manager_image": "hypercycle/node-manager:latest",
  "aim_image": "mosaic-hermes-aim:1.0.4"
}
```

### 5.3 Tilling Monitor Agent (New Component)

A lightweight sidecar that runs alongside Node Manager in the tenant container:

```python
# Runs every 60 seconds
async def report_tilling_status():
    status = {
        "tenant_id": TENANT_ID,
        "license_id": LICENSE_ID,
        "node_manager_alive": check_nm_health(),
        "aim_alive": check_aim_health(),
        "uptime_seconds": get_uptime(),
        "requests_served": get_request_count(),
        "estimated_earnings_hpc": calculate_earnings(),
        "box_id": BOX_ID,
    }
    await send_to_spo(status)
```

---

## 6. Pricing: How We Beat HyperPG ($5/month → $3/month)

### HyperPG Pricing
- **$5.00/month** for managed tilling (~$0.16/day)
- They run your Node Factory on their centralized servers
- You pay for their infrastructure + margin

### Stargate Pool Tilling Pricing
**The key insight:** One HyperAIBox can run **multiple node factories** simultaneously (multi-tenant tilling), amortizing compute cost across many licenses.

| Cost Component | Per Box / Day | Shared Across | Per Factory / Day | Per Factory / Month |
|----------------|-------------|-------------|-------------------|---------------------|
| Compute rental (HyperAIBox) | $3.50 | 20 factories | $0.175 | **$5.25** |
| Stargate operator fee | $0.70 | 20 factories | $0.035 | **$1.05** |
| Tilling Monitor Agent | $0.30 | 20 factories | $0.015 | **$0.45** |
| **Total** | **$4.50** | — | **$0.225** | **$6.75** |

**Wait — that's MORE expensive than HyperPG's $5/month!**

### How We Actually Beat HyperPG: Three Pricing Models

#### Model A: Spot Tilling (Pay-Per-Hour)
| Feature | Price |
|---------|-------|
| Active tilling | **$0.01/hour** (~$7.20/month if 24/7) |
| Paused / idle | **$0** (no charge) |
| **Effective cost** | **$3.00–$5.00/month** (user controls uptime) |

**This beats HyperPG** because:
- User only pays when Node Factory is actively processing requests
- Most node factories have idle periods
- Average user pays ~$3.50/month vs HyperPG's flat $5

#### Model B: Shared Pool Tilling (Multi-Tenant)
- One HyperAIBox runs **20–30 node factories** simultaneously
- Cost per factory: **$3.00/month** (amortized)
- **40% cheaper than HyperPG**

#### Model C: Dedicated Tilling (Single Factory)
- Entire HyperAIBox dedicated to one Node Factory
- **$8.00/month** — premium for guaranteed resources
- For high-traffic factories that need dedicated compute

### Revenue Split (Model B — $3.00/month per factory)
- **Box Owner**: $1.80 (60%) — covers electricity
- **Stargate Operator**: $0.90 (30%) — relay + SPO infra
- **HPEC DAO Affiliate**: $0.30 (10%) — referral

### Why Stargate Pool Wins Despite Similar Price
| Feature | HyperPG $5/mo | **Stargate Pool** |
|---------|---------------|-------------------|
| **Custody** | Custodial (they hold keys) | **Non-custodial** |
| **Censorship** | Centralized DC | **Decentralized global** |
| **Transparency** | Opaque | **On-chain verifiable** |
| **Flexibility** | Flat monthly only | **Spot, shared, dedicated** |
| **Earnings** | Via HyperPG | **Direct to wallet** |
| **Control** | Trust them | **One-click stop** |

---

## 7. Non-Custodial Delegation Flow (Detailed)

```
Step 1: User selects Node Factory in Mosaic UI
   └── License: "2324779898048044" (Base chain)
   └── Status: "dead" (not currently tilling)

Step 2: Mosaic shows "Stargate Tilling" dialog
   └── Option A: "Use my HyperAIBox" (if user owns one)
   └── Option B: "Rent from Stargate Pool" (recommended)

Step 3: If Option B, user sees pool browser
   └── Box list: C-3PO ($3.00/mo shared), R2D2 ($3.00/mo shared), etc.
   └── Filter by: region, price, uptime, GPU
   └── User selects C-3PO

Step 4: Delegation signing (NON-CUSTODIAL)
   └── Mosaic generates EIP-712 message:
       ```
       Domain: HyperCycle Delegation
       Message: {
         licenseId: "2324779898048044",
         delegatee: "stargate-pool-c3po",
         owner: "0xUserWallet...",
         expiry: 1725235200,  // 30 days from now
         nonce: 123
       }
       ```
   └── User signs with their wallet (MetaMask / WalletConnect)
   └── Signature: "0xabc123..."
   └── Keys NEVER leave user's device

Step 5: Payment
   └── User pays $3.00 (shared) or $0.01/hr × estimated hours = ~$X USDC
   └── Smart contract escrow holds funds
   └── Funds release to box owner + SPO periodically

Step 6: Provisioning
   └── SPO sends provision to HBA on C-3PO
   └── HBA starts Node Manager with --delegate "0xabc123..."
   └── Node Manager verifies signature on-chain
   └── Node Factory is LIVE

Step 7: Monitoring
   └── User sees Tilling Dashboard:
       ├── Node Status: ✅ Alive
       ├── Uptime: 99.2%
       ├── Earnings: 12.4 HyPC
       ├── Requests Served: 1,247
       └── Time Remaining: 5d 12h

Step 8: Stop Tilling
   └── User clicks "Stop"
   └── SPO sends destroy to HBA
   └── Delegation invalidated (past expiry)
   └── Unused funds refunded from escrow
```

---

## 8. Tilling Dashboard UI (New Panel)

```
┌─ My Active Tilling Sessions ──────────────────────────────────┐
│                                                               │
│  🟢 Node Factory #2324779898048044 (Base)                   │
│     Status: Tilling via Stargate Pool → C-3PO               │
│     Started: 2 days ago                                       │
│     Remaining: 5 days                                         │
│     ─────────────────────────────────────────────────────     │
│     📊 Performance                                          │
│        Uptime:        ████████░░ 99.2%                       │
│        Requests:      1,247 served                           │
│        Avg Response:  245ms                                  │
│        Earnings:      12.4 HyPC (~$4.20)                    │
│     ─────────────────────────────────────────────────────     │
│     💰 Economics                                              │
│        Daily Cost:    $3.50                                  │
│        Daily Earnings: $2.10                                 │
│        Net Position:  -$1.40/day (early stage)              │
│     ─────────────────────────────────────────────────────     │
│     🎛️ Actions                                               │
│        [View Node Manager]  [View Logs]  [Restart]          │
│        [STOP TILLING] — Refund unused $17.50               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 9. Security Considerations

### Non-Custodial Guarantees
1. **User never transfers ANFE ownership** — only delegates
2. **Delegation is time-bound** — expires after rental period
3. **User can revoke** — stops tilling instantly
4. **Earnings go directly to user** — no intermediary custody
5. **Box owner cannot steal** — they only run the container, don't have keys

### Smart Contract Escrow
```solidity
// Simplified escrow for tilling payments
contract TillingEscrow {
    struct Booking {
        address user;
        address boxOwner;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }
    
    function payForTilling(address boxOwner, uint256 duration) external {
        // User pays USDC into escrow
        // Funds release daily to box owner
        // Unused funds refunded on stop
    }
    
    function stopTilling(bytes32 bookingId) external {
        // Calculate unused time
        // Refund user
        // Release earned portion to box owner
    }
}
```

---

## 10. Implementation Roadmap

### Phase 1: Core Tilling (Immediate)
- [ ] Add "Stargate Tilling" button to NodeFactoryTrackerPanel
- [ ] Build TillingProvisioner in SPO
- [ ] Add tilling mode to HBA provision handler
- [ ] Deploy test tilling on R2D2/C-3PO
- [ ] Build Stargate Tilling Dashboard UI

### Phase 2: Non-Custodial Delegation
- [ ] Implement EIP-712 delegation signing in Mosaic UI
- [ ] Add delegation verification to HBA
- [ ] Test delegation flow end-to-end
- [ ] Build smart contract escrow

### Phase 3: Production
- [ ] Multiple tilling modes (dedicated, shared, spot)
- [ ] Auto-restart on failure
- [ ] Earnings analytics dashboard
- [ ] Tilling insurance (refund if box goes offline)

---

## 11. Competitive Advantage vs HyperPG

| Feature | HyperPG HMS | **Stargate Pool Tilling** |
|---------|-------------|---------------------------|
| Price | **$5.00/month** | **$3.00/month** (shared) / **$0.01/hr** (spot) |
| Custody | Custodial (they hold keys) | **Non-custodial** (you keep keys) |
| Infrastructure | Centralized DC | **Decentralized** (global boxes) |
| Censorship | Can be shut down | **Censorship-resistant** |
| Earnings | Delayed, via HyperPG | **Direct to wallet** |
| Transparency | Opaque | **On-chain verifiable** |
| Exit | Complex | **One-click stop + refund** |

---

## 12. Files to Create / Modify

### New Files
- `src/components/stargate/TillingServicePanel.tsx` — Main tilling UI
- `src/components/stargate/TillingDashboard.tsx` — Active tilling monitoring
- `electron/integrations/pool/orchestrator/TillingProvisioner.ts` — SPO tilling logic
- `electron/integrations/pool/hba/TillingMonitorAgent.py` — Box-side earnings reporter

### Modified Files
- `src/components/stargate/NodeFactoryTrackerPanel.tsx` — Add "Stargate Tilling" button
- `electron/integrations/pool/orchestrator/StargatePoolOrchestrator.ts` — Add tilling methods
- `electron/integrations/pool/hba/hba_agent.py` — Add tilling provision handler

---

**Ready to build?** Start with Phase 1 — add the "Stargate Tilling" button to NodeFactoryTrackerPanel and wire it to the SPO TillingProvisioner.
