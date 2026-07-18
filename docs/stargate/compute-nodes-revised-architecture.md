# Revised Architecture: Compute & Nodes — Dual-Track Design

**Date:** 2026-06-27  
**Revision:** v2 — Corrected from "Stargate as Provider" to "Stargate as Marketplace Aggregator"

---

## The Corrected Vision

**Stargate does NOT set prices.** Stargate is a **marketplace aggregator** that lists compute providers. Users have two independent tracks:

| Track | What | Who Sets Price | Who Earns | Example |
|-------|------|--------------|-----------|---------|
| **My Compute** (decentralized) | User-owned appliances — HyperAIBox, Battery Boxes, custom nodes | User (free for themselves) | User earns if they rent out | Your R2D2 at home |
| **Rent Compute** (marketplace) | Provider-owned infrastructure — ComputePortal, BatteryCoin, etc. | Provider | Stargate earns affiliate commission | ComputePortal GPU instance |

**Stargate's role:**
1. Discover and list providers (ComputePortal, BatteryCoin, etc.)
2. Enable users to add their own appliances (HyperAIBox, Battery Box, custom node)
3. Track all compute in one dashboard (My Compute + Active Rentals)
4. Earn affiliate commissions when users book through Stargate
5. Provide tools to deploy agents to ANY compute (owned or rented)

---

## Current State — What Already Exists

### Existing "My Compute" Features (Decentralized Track)

| Feature | Implementation | Status | Location |
|---------|---------------|--------|----------|
| **Local Node Discovery** | `LocalNodeBridge` polls `localhost:8005/8006` | ✅ Active | `services/LocalNodeBridge.ts` |
| **HyperAIBox Integration** | `hboxPoolService` discovers + delegates | ✅ Active | `services/StargatePool/HBoxPoolService.ts` |
| **ANFE Management** | `anfeService` + `StargatePoolService` | ✅ Active | `services/StargatePool/` |
| **Battery Org Nodes** | `batteryOrgPool` stub (empty) | 🚧 Stub | `services/BatteryOrg.ts` |
| **HyperInsight Nodes** | `hyperInsight.getNodes()` maps to `ComputeNode` | ✅ Active | `services/AdaPortal/HyperInsightService.ts` |
| **Node List UI** | `renderNodes()` — grouped by source | ✅ Active | `AdaPortalPanel.tsx:3168` |
| **Deploy Hermes to HBox** | Button in HBox card | ✅ Active | `AdaPortalPanel.tsx:3238` |
| **Pool HBox** | "Pool" button delegates to Stargate | ✅ Active | `AdaPortalPanel.tsx:3245` |
| **Use Battery Box** | "Use" button (placeholder action) | 🚧 Placeholder | `AdaPortalPanel.tsx:3308` |
| **Allocate Compute Button** | Routes to AI Chat with prompt | ✅ Active | `AdaPortalPanel.tsx:3103` |

### Existing "Rent Compute" Features (Marketplace Track)

| Feature | Implementation | Status | Location |
|---------|---------------|--------|----------|
| **3 Tier Cards** | Static `computeTiers` array | 🚧 Placeholder | `AdaPortalPanel.tsx:222` |
| **Tier Selection** | `selectedComputeTier` state | 🚧 Placeholder | `AdaPortalPanel.tsx:274` |
| **Price Display** | Hardcoded `$0.50/hr`, `$1.50/hr`, `$5.00/hr` | 🚧 Placeholder | `AdaPortalPanel.tsx:223-226` |
| **No Provider Names** | No provider attribution | ❌ Missing | — |
| **No Booking Flow** | Selection only, no checkout | ❌ Missing | — |
| **No Wallet Payment** | No integration with Web3/Tokeo | ❌ Missing | — |
| **No Affiliate Tracking** | No referral/commission system | ❌ Missing | — |

---

## The Problem with Current Design

The current `renderCompute()` + `renderNodes()` are **two separate functions rendered sequentially** in the same tab. This creates confusion:

```tsx
{activeTab === 'compute' && <>{renderCompute()}{renderNodes()}</>}
```

**Issues:**
1. `renderCompute()` shows "Rent" tiers mixed with "Allocate Compute" button (which should help with BOTH tracks)
2. `renderNodes()` shows all node types jumbled together (HyperInsight, HBox, Battery) — no clear ownership model
3. No explicit split between "My stuff" and "Stuff I can rent"
4. The "Allocate Compute" button just routes to AI Chat — it should offer a choice: use my nodes or rent new ones

---

## Revised Dual-Track Design

### Compute & Nodes Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Compute & Nodes                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [My Compute]  [Rent Compute]  [All Nodes]          │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ==== MY COMPUTE (Decentralized Track) ====                   │
│                                                               │
│  ┌─ My Appliances ─────────────────────────────────────┐     │
│  │  [+] Add Appliance                                  │     │
│  │                                                     │     │
│  │  🟢 R2D2 — HyperAIBox #1234                         │     │
│  │     localhost:8005 | 8 CPU | 32GB RAM | 2x RTX 4090  │     │
│  │     [Deploy Hermes] [Pool] [Details]                 │     │
│  │                                                     │     │
│  │  🟡 Battery Box — Node-Alpha (maintenance)          │     │
│  │     [Details] [Restart]                              │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─ My Deployed Agents ───────────────────────────────┐     │
│  │  🤖 Hermes-Dev on R2D2 — Running (3d uptime)       │     │
│  │  🤖 Agent-Marketing on Battery Box — Stopped        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ==== RENT COMPUTE (Marketplace Track) ====                   │
│                                                               │
│  ┌─ Providers ─────────────────────────────────────────┐     │
│  │  🔥 ComputePortal  🆕 BatteryCoin (Coming Soon)     │     │
│  │  [Filter: All ▼] [Hosting ▼] [GPU ▼] [Region ▼]     │     │
│  │                                                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │
│  │  │ GPU      │  │ VPS      │  │ Storage  │         │     │
│  │  │ A100     │  │ 8 vCPU   │  │ 1TB SSD  │         │     │
│  │  │ $2.50/hr │  │ $0.50/hr │  │ $0.02/GB│         │     │
│  │  │ Compute  │  │ Compute  │  │ Compute  │         │     │
│  │  │ Portal   │  │ Portal   │  │ Portal   │         │     │
│  │  │ [Book]   │  │ [Book]   │  │ [Book]   │         │     │
│  │  └──────────┘  └──────────┘  └──────────┘         │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─ My Bookings ──────────────────────────────────────┐     │
│  │  📦 GPU A100 — Active (14h remaining)               │     │
│  │  📦 VPS 8vCPU — Expired (renew?)                    │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ==== UNIVERSAL ACTIONS ====                                  │
│                                                               │
│  [Allocate Compute] → Dialog: "Use my nodes or rent new?"   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Explicit separation:** My Compute vs Rent Compute are visually distinct sections
2. **Provider attribution:** Every rental card shows "ComputePortal", "BatteryCoin", etc.
3. **We don't price:** Prices come from provider APIs (or manual admin config)
4. **We earn affiliate:** Booking flow includes our referral code
5. **Universal deploy:** "Allocate Compute" offers BOTH tracks — use my appliance or rent from marketplace
6. **Dashboard unified:** My total compute = owned appliances + active rentals

---

## Revised Data Model

### ComputeSource (unified type for both tracks)

```typescript
export type ComputeSourceType = 'owned' | 'rented' | 'pooled' | 'delegated';

export type ComputeProvider = 
  | 'hyperaibox'      // User's own HyperAIBox
  | 'battery'           // User's own Battery Box
  | 'local'             // User's local machine/node
  | 'hyperinsight'      // HyperCycle network node (rented via ANFE)
  | 'compute_portal'    // External provider: ComputePortal
  | 'battery_coin'    // External provider: BatteryCoin (future)
  | 'community'         // Peer-to-peer compute sharing
  ;

export interface ComputeResource {
  id: string;                          // UUID
  name: string;                        // "R2D2", "GPU-A100-CP-001"
  
  // Track classification
  sourceType: ComputeSourceType;       // 'owned' | 'rented' | 'pooled' | 'delegated'
  provider: ComputeProvider;           // Who owns the hardware
  
  // Ownership
  ownerWallet?: string;               // For owned: user's wallet
  renterWallet?: string;              // For rented: who is renting it
  providerId?: string;                // For rented: FK to ProviderRecord
  
  // Specs (unified across all sources)
  specs: ComputeSpec;                 // CPU, RAM, GPU, storage, bandwidth
  
  // Status
  status: 'online' | 'offline' | 'busy' | 'provisioning' | 'maintenance' | 'expired';
  healthScore: number;                // 0-1 composite score
  
  // Financial (for rented resources)
  billing?: {
    model: 'hourly' | 'monthly' | 'per_use';
    pricePerHour: number;             // Provider's price (what user pays)
    commissionPercent: number;        // Our cut (e.g., 0.15 = 15%)
    startedAt: number;
    expiresAt?: number;               // For time-limited rentals
    totalPaid: number;
  };
  
  // Deployment (what's running on it)
  deployment?: {
    agentId?: string;                 // Hermes agent deployed
    agentName?: string;
    status: 'running' | 'stopped' | 'error';
    uptimeMs: number;
    lastDeployedAt: number;
  };
  
  // Location / Network
  region?: string;                    // "US-East", "EU-West", "Home"
  ipAddress?: string;
  hostname?: string;
  port?: number;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
  tags: string[];                     // ["gpu", "ai", "home"]
}

export interface ProviderRecord {
  id: string;                         // "compute-portal", "battery-coin"
  name: string;                       // "ComputePortal"
  type: 'external_marketplace' | 'peer_network' | 'stargate_native';
  websiteUrl: string;
  apiBaseUrl?: string;
  apiDocsUrl?: string;
  
  // Affiliate
  affiliateCode: string;              // "STARGATE-001"
  commissionPercent: number;          // 0.15 = 15% default
  
  // Supported offerings
  categories: ComputeOfferingCategory[];
  
  // Status
  isActive: boolean;
  syncStatus: 'healthy' | 'degraded' | 'down' | 'never_synced';
  lastSyncedAt?: number;
  
  // Auth (for API integrations)
  apiKey?: string;                    // Encrypted in vault
  
  createdAt: number;
}

export interface ComputeOffering {
  id: string;
  providerId: string;                 // FK to ProviderRecord
  
  // Product
  name: string;                       // "GPU Compute — NVIDIA A100"
  description: string;
  category: ComputeOfferingCategory;
  
  // Specs
  specs: ComputeSpec;
  
  // Pricing (SET BY PROVIDER, not us)
  pricePerHour: number;              // e.g., 2.50 (USD)
  pricePerMonth?: number;             // e.g., 1800.00 (USD)
  currency: 'USD' | 'USDC' | 'ETH' | 'ADA';
  
  // Availability
  availability: 'available' | 'limited' | 'unavailable';
  availableCount?: number;            // "12 available"
  region: string;
  
  // Booking
  minDurationHours?: number;
  maxDurationHours?: number;
  
  // Stargate metadata
  featured: boolean;
  popular: boolean;
  
  createdAt: number;
  updatedAt: number;
}

export type ComputeOfferingCategory = 
  | 'hosting'        // VPS, bare metal, private cloud
  | 'storage'        // Object storage, block storage
  | 'gpu_compute'    // GPU instances for AI/training
  | 'ai_api'         // AI model API access (tokens, inference)
  | 'node_activation' // Plug & play hardware activation
  ;
```

### Booking Flow (for Rent Track)

```typescript
export interface ComputeBooking {
  id: string;
  
  // What was booked
  offeringId: string;
  providerId: string;
  resourceId?: string;                // Assigned after provisioning
  
  // Who booked it
  userWallet: string;
  
  // Financials
  pricePerHour: number;               // Provider's price
  hoursBooked: number;
  totalCost: number;                  // pricePerHour * hoursBooked
  commissionAmount: number;           // totalCost * commissionPercent
  commissionPercent: number;          // Our cut (e.g., 0.15)
  
  // Payment
  paymentTxHash?: string;             // On-chain payment confirmation
  paymentToken: 'USDC' | 'ETH' | 'ADA';
  paymentChain: 'base' | 'ethereum' | 'cardano';
  
  // Status lifecycle
  status: 'pending_payment' | 'payment_confirmed' | 'provisioning' | 'active' | 'expiring' | 'expired' | 'cancelled';
  
  // Timestamps
  createdAt: number;
  paidAt?: number;
  activatedAt?: number;
  expiresAt: number;
  cancelledAt?: number;
  
  // Access credentials (encrypted in vault)
  credentials?: {
    ipAddress?: string;
    sshKey?: string;
    username?: string;
    dashboardUrl?: string;
  };
}
```

---

## Revised UI Architecture

### AdaPortalPanel.tsx — Compute Tab Restructure

Replace the current:
```tsx
{activeTab === 'compute' && <>{renderCompute()}{renderNodes()}</>}
```

With explicit dual-track layout:

```tsx
{activeTab === 'compute' && (
  <div className="space-y-8">
    {/* Universal Action Bar */}
    <ComputeActionBar 
      onAllocate={handleAllocateCompute}
      ownedCount={ownedResources.length}
      rentedCount={activeBookings.length}
    />
    
    {/* Track 1: My Compute (Decentralized) */}
    <MyComputeSection
      resources={ownedResources}
      onAddAppliance={handleAddAppliance}
      onDeploy={handleDeployToResource}
      onPool={handlePoolResource}
      onDetails={handleResourceDetails}
    />
    
    {/* Track 2: Rent Compute (Marketplace) */}
    <RentComputeSection
      providers={providers}
      offerings={filteredOfferings}
      bookings={activeBookings}
      onBook={handleBookOffering}
      onFilter={setFilters}
      walletConnected={ethAddress !== null}
    />
  </div>
)}
```

### New Components

| Component | Purpose | Track |
|-----------|---------|-------|
| `ComputeActionBar` | Top bar with "Allocate Compute" button + stats | Universal |
| `MyComputeSection` | User-owned appliances + deployed agents | My Compute |
| `AddApplianceWizard` | Onboarding flow for new HyperAIBox/Battery Box | My Compute |
| `ApplianceCard` | Single appliance card (status, specs, actions) | My Compute |
| `DeployedAgentRow` | Agent running on an appliance | My Compute |
| `RentComputeSection` | Provider marketplace + filter sidebar | Rent Compute |
| `ProviderFilterBar` | Category, price, region, provider filters | Rent Compute |
| `OfferingCard` | Single offering from a provider (with attribution) | Rent Compute |
| `BookingFlow` | Multi-step: select → configure → pay → provision | Rent Compute |
| `MyBookingsPanel` | Active/past rentals with status | Rent Compute |
| `BookingDetailDrawer` | Full booking details, credentials, renew | Rent Compute |
| `ProviderBadge` | Small badge showing "ComputePortal", "BatteryCoin", etc. | Rent Compute |
| `ComputeDashboard` | Unified view: total compute, usage, costs | Universal |

### Allocate Compute Dialog (Revised)

When user clicks "Allocate Compute":

```
┌─────────────────────────────────────────────┐
│  🚀 Allocate Compute                          │
├─────────────────────────────────────────────┤
│  What would you like to do?                   │
│                                               │
│  ┌─ Use My Existing Compute ─────────────┐  │
│  │  🟢 R2D2 (HyperAIBox) — 8 CPU, 32GB   │  │
│  │  🟡 Battery Box — 4 CPU, 16GB          │  │
│  │  [Deploy Agent to Selected]            │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─ Rent New Compute ────────────────────┐  │
│  │  🔥 GPU Compute — $2.50/hr              │  │
│  │  💾 Storage — $0.02/GB                 │  │
│  │  🖥️ VPS — $0.50/hr                     │  │
│  │  [Browse Marketplace]                    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─ Quick Actions ───────────────────────┐  │
│  │  [+] Add New Appliance                 │  │
│  │  🤖 Auto-Select Best Node              │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Provider Adapter Pattern

Each external provider implements a standard adapter interface. Stargate is the marketplace; providers are plugins.

```typescript
interface ComputeProviderAdapter {
  // Identity
  readonly providerId: string;
  readonly providerName: string;
  
  // Discovery
  syncOfferings(): Promise<ComputeOffering[]>;
  getOfferingById(id: string): Promise<ComputeOffering | null>;
  
  // Booking
  createBookingRequest(
    offeringId: string,
    userWallet: string,
    hours: number,
    affiliateCode: string
  ): Promise<{
    bookingId: string;
    paymentAddress: string;
    amount: number;               // Total cost (what user pays)
    commission: number;           // Our cut
  }>;
  
  confirmPayment(
    bookingId: string,
    txHash: string
  ): Promise<{
    status: 'provisioning' | 'active';
    resourceId: string;
    credentials: ComputeCredentials;
  }>;
  
  checkStatus(resourceId: string): Promise<'provisioning' | 'active' | 'failed'>;
  
  // Commission tracking (optional — some providers report, others we track)
  getCommissionStats?(): Promise<{
    totalEarned: number;
    pending: number;
    conversions: number;
  }>;
}
```

### Provider Adapters (Planned)

| Adapter | Provider | Status | Auth |
|---------|----------|--------|------|
| `ComputePortalAdapter` | ComputePortal | 🔜 Planned | API key (request from CP) |
| `BatteryCoinAdapter` | BatteryCoin | 🔜 Future | TBD (not yet built) |
| `HyperCycleAdapter` | HyperCycle Network | ✅ Exists | ANFE + blockchain |
| `LocalNodeAdapter` | User's own nodes | ✅ Exists | Localhost polling |
| `CommunityAdapter` | P2P compute sharing | 🔜 Future | Smart contract |

---

## Mapping Existing Code to New Structure

### What Stays (My Compute Track)

| Existing Code | New Home | Action |
|---------------|----------|--------|
| `LocalNodeBridge` | `MyComputeSection` → appliance discovery | Keep as-is, add to section |
| `hboxPoolService` | `MyComputeSection` → HBox cards | Keep, add "Deploy" and "Pool" buttons |
| `batteryOrgPool` | `MyComputeSection` → Battery Box cards | Keep stub, add when BatteryCoin ships |
| `hyperInsight.getNodes()` | `MyComputeSection` → "Network Nodes" (if user owns ANFE) | Keep, but filter by ownership |
| `anfeService` | `MyComputeSection` → ANFE-based nodes | Keep, add deployment controls |
| `renderNodes()` | Split into `MyComputeSection` + `RentComputeSection` | Refactor |
| `computeTiers` (as owned tiers) | `MyComputeSection` → "My Compute Tiers" | Keep for user's own capacity |

### What Changes (Rent Compute Track)

| Existing Code | New Home | Action |
|---------------|----------|--------|
| `computeTiers` (static cards) | **REMOVE** — replaced by provider offerings | Delete |
| `renderCompute()` | **REFACTOR** → `RentComputeSection` | Rewrite completely |
| `handleSelectCompute(tier)` | **REMOVE** — no tier selection | Delete |
| `selectedComputeTier` | **REMOVE** | Delete state |
| `onSelectCompute` callback | **REMOVE** | Delete prop |

### New Code Needed

| Component | Lines | Purpose |
|-----------|-------|---------|
| `ProviderAdapter` interface | ~30 | Standard contract for all providers |
| `ComputePortalAdapter` | ~100 | First provider adapter (mock until API ready) |
| `ProviderService` | ~200 | CRUD providers, sync offerings, track bookings |
| `BookingService` | ~150 | Booking lifecycle, payment, provisioning |
| `MyComputeSection` | ~300 | UI for owned appliances |
| `RentComputeSection` | ~400 | UI for marketplace + filters |
| `OfferingCard` | ~100 | Provider-attributed offering card |
| `BookingFlow` | ~250 | Multi-step booking wizard |
| `ComputeActionBar` | ~80 | Universal allocate button + stats |
| `AddApplianceWizard` | ~200 | Onboarding for new HyperAIBox/Battery Box |
| `ProviderBadge` | ~30 | "ComputePortal", "BatteryCoin" badge |

---

## "Allocate Compute" Button — Revised Behavior

### Current (Confusing)
```tsx
<button onClick={() => onNavigateToChat?.('I need compute resources for my agents')}>
  Allocate Compute
</button>
// Routes to AI Chat with a generic prompt
```

### Revised (Action Dialog)
```tsx
<button onClick={handleAllocateCompute}>
  Allocate Compute
</button>

const handleAllocateCompute = () => {
  // Show dialog with options:
  // 1. Use my existing appliance (list owned resources)
  // 2. Rent from marketplace (browse offerings)
  // 3. Add new appliance (onboarding wizard)
  // 4. Auto-select (smart routing to cheapest available)
  
  setShowAllocateDialog(true);
};
```

**Smart Routing (Auto-Select):**
```typescript
async function autoSelectCompute(
  requirements: ComputeRequirements,
  userResources: ComputeResource[],
  offerings: ComputeOffering[]
): Promise<ComputeResource | ComputeOffering> {
  // 1. Check user's owned resources first (free)
  const availableOwned = userResources.filter(r => r.status === 'online' && r.sourceType === 'owned');
  if (availableOwned.length > 0) {
    // Pick best match by specs/cost
    return availableOwned[0];
  }
  
  // 2. Check pooled resources (user has delegated to pool)
  const availablePooled = userResources.filter(r => r.sourceType === 'pooled');
  if (availablePooled.length > 0) {
    return availablePooled[0];
  }
  
  // 3. Fall back to cheapest rental offering
  const cheapest = offerings
    .filter(o => o.availability === 'available')
    .sort((a, b) => a.pricePerHour - b.pricePerHour)[0];
  
  return cheapest;
}
```

---

## Provider Onboarding (How We Add ComputePortal)

```typescript
// Admin flow (not user-facing)
async function onboardProvider(config: ProviderOnboardingConfig) {
  const provider: ProviderRecord = {
    id: 'compute-portal',
    name: 'ComputePortal',
    type: 'external_marketplace',
    websiteUrl: 'https://computeportal.io',
    apiBaseUrl: 'https://api.computeportal.io/v1',  // Request from CP team
    apiDocsUrl: 'https://docs.computeportal.io/api',
    affiliateCode: 'STARGATE-HPEC-001',               // Our affiliate code
    commissionPercent: 0.15,                         // 15% negotiated with CP
    categories: ['hosting', 'storage', 'gpu_compute', 'node_activation'],
    isActive: true,
    syncStatus: 'never_synced',
    createdAt: Date.now(),
  };
  
  // Store encrypted API key in vault
  await vault.createEntry('provider-api-keys', 'compute-portal', {
    apiKey: encrypt(config.apiKey),
  });
  
  // Register in provider service
  await providerService.register(provider);
  
  // Initial sync
  await providerService.syncProvider('compute-portal');
}
```

---

## Key Changes Summary

### Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `AdaPortalPanel.tsx` | Restructure `compute` tab: dual-track layout, remove `renderCompute()`/`renderNodes()`, add new sections | 2d |
| `AdaPortal/types.ts` | Add `ComputeResource`, `ProviderRecord`, `ComputeOffering`, `ComputeBooking` | 0.5d |
| `services/LocalNodeBridge.ts` | Keep as-is, but normalize to `ComputeResource` shape | 0.5d |
| `services/StargatePool/` | Keep ANFE management, add deployment state to `ComputeResource` | 1d |

### Files to Create

| File | Purpose | Effort |
|------|---------|--------|
| `services/ProviderService.ts` | Provider CRUD, sync, adapter registry | 1d |
| `services/BookingService.ts` | Booking lifecycle, payment, provisioning | 1d |
| `services/adapters/ProviderAdapter.ts` | Base interface + adapter registry | 0.5d |
| `services/adapters/ComputePortalAdapter.ts` | ComputePortal integration (mock first) | 1d |
| `components/stargate/compute/MyComputeSection.tsx` | Owned appliances UI | 1d |
| `components/stargate/compute/RentComputeSection.tsx` | Marketplace UI | 1.5d |
| `components/stargate/compute/OfferingCard.tsx` | Provider-attributed card | 0.5d |
| `components/stargate/compute/BookingFlow.tsx` | Multi-step booking | 1d |
| `components/stargate/compute/ComputeActionBar.tsx` | Universal allocate button | 0.5d |
| `components/stargate/compute/AddApplianceWizard.tsx` | Onboarding flow | 1d |
| `components/stargate/compute/ProviderBadge.tsx` | Attribution badge | 0.2d |

---

## Open Questions (Revised)

1. **ComputePortal API:** Do they have an API? What's the endpoint? How do we request affiliate integration?
2. **BatteryCoin:** What is their timeline? Do they have a compute marketplace planned?
3. **Affiliate Codes:** What is our affiliate code with ComputePortal? Do we need to apply?
4. **ANFE Discounts:** Should HPEC DAO PASS holders get discounts on ComputePortal rentals? (Cross-promotion)
5. **P2P Compute:** Should users be able to rent OUT their own HyperAIBox via Stargate? (Community adapter)
6. **Payment:** For rentals, do users pay in crypto (USDC) or fiat? Does ComputePortal accept crypto?
7. **Provisioning:** After payment, how does the compute instance get created? Does ComputePortal have an API for that, or do we redirect to their checkout?

---

*End of Revised Architecture*
