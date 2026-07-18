# Architecture Design: Compute & Nodes — HPEC DAO Affiliate Marketplace

**Vision:** Transform Mosaic-Companion Stargate's "Compute & Nodes" tab into a multi-provider compute marketplace that includes HPEC DAO offerings (Private Cloud, Storage, GPU Compute, Flat-Rate AI), earning referral commissions on every user transaction.

**Date:** 2026-06-27  
**Architect:** AI Agent (Hermes)  
**Target:** Stargate module (`browser://adaportal/start` → `compute` tab)

---

## 1. Executive Summary

Mosaic-Companion Stargate already has a **"Compute & Nodes"** tab with three static tiers (`Standard $0.50/hr`, `High-Performance $1.50/hr`, `Dedicated $5.00/hr`). These are placeholder compute tiers without real backend integration.

**The Opportunity:** The external marketplace [ComputePortal](https://computeportal.io/marketplace) offers:
- **Node as a Service (NaaS)** — dedicated compute, bare metal, edge nodes
- **Virtual Private Servers (VPS)** — fast/scalable virtual servers
- **Private Edge Cloud** — enterprise infrastructure
- **Storage as a Service** — object storage, data infrastructure, AI data
- **Plug & Play Node Activation** — starting at $2.00 USD
- **Various software categories** — AI models, data processing, orchestration, blockchain

**What's Missing on ComputePortal:**
1. No **HPEC DAO** offerings (our target affiliate partner)
2. No **flat-rate unlimited AI token usage** subscription model
3. No **affiliate/referral commission** system
4. No **wallet-integrated** compute booking (MetaMask/Tokeo checkout)

**Our Edge:** Mosaic-Companion already has:
- Wallet integration (MetaMask + Tokeo Cardano)
- ANFE NFT-gated compute (Stargate Pool)
- HyperCycle node telemetry (HyperInsight)
- Hermes agent orchestration (kanban task dispatch)
- TypeScript/React component system with 18 UI block types

---

## 2. Product Vision — Four Pillar Offerings

### Pillar 1: Private Cloud Hosting (HPEC DAO)
**What:** Dedicated compute instances, bare metal servers, edge nodes  
**Pricing:** Per-hour or per-month (compete with AWS/GCP)  
**Affiliate:** 10-15% referral commission on first 3 months  
**Target:** Enterprise users, DAOs, dApp developers

### Pillar 2: Storage (HPEC DAO)
**What:** Object storage, data infrastructure, AI training datasets  
**Pricing:** Per-GB/month with tiered discounts  
**Affiliate:** 5-10% recurring commission  
**Target:** ML engineers, data scientists, Web3 storage needs

### Pillar 3: GPU Compute (HPEC DAO + External)
**What:** GPU instances for AI training, inference, rendering  
**Pricing:** Per-hour (compete with Lambda, CoreWeave)  
**Affiliate:** 10-20% first-month commission  
**Target:** AI researchers, Midjourney-style users, 3D renderers

### Pillar 4: Flat-Rate AI Tokens (UNIQUE — NOT on ComputePortal)
**What:** Unlimited AI token usage for fixed monthly fee (like Netflix for LLMs)  
**Pricing Tiers:**
- **Lite:** $29/month — 1M tokens/month (Claude Haiku, GPT-4o-mini)
- **Pro:** $99/month — 5M tokens/month + priority queue (Claude Sonnet, GPT-4o)
- **Unlimited:** $299/month — unlimited tokens + custom model loading (Claude Opus, GPT-4-turbo, local models)
**Affiliate:** 20-30% recurring commission (highest margin)  
**Target:** Every Mosaic user, ChatGPT power users, AI developers

---

## 3. Existing Architecture — What We Build On

### Stargate Tab Structure (current)
```
AdaPortalPanel.tsx
├── Start tab (intent selection)
├── Marketplace (hire agents)
├── AI Models (AIMs)
├── Rankings
├── Train Agents
├── Bundles
├── Skills
├── **Compute & Nodes** ← TARGET TAB
├── Dashboard
├── Stargate Pool
├── Midnight City
└── Deploy System (ASP)
```

### Compute Tab (current — placeholder)
- Static 3-tier cards (`Standard`, `High-Performance`, `Dedicated`)
- No provider integration
- No booking flow
- No wallet checkout
- No affiliate tracking

### Existing Data Models (from `types.ts`)
```typescript
interface ComputeNode {
  nodeId: string;
  address: string;
  uptime: number;
  reliability: number;
  availableCompute: number;
  pricePerHour: number;
  status: 'online' | 'offline' | 'busy';
  lastChecked: string;
  platform: 'hyperinsight' | 'hyperaibox' | 'battery';
  // ... extended fields
}
```

### Existing Services
- `StargatePoolService` — ANFE NFT management, multi-chain wallet
- `HyperInsightStargateBridge` — node telemetry, AIM discovery
- `LocalNodeBridge` — local HyperAIBox discovery
- `BatteryOrg` — BatteryOrg pool nodes
- `AspGateway` — company onboarding, ASP packages
- `AgentEconomyService` — task payments, USDC escrow

---

## 4. New Data Model — ProviderComputeOffering

### 4.1 Core Types

```typescript
// ============================================
// COMPUTE PROVIDER SYSTEM — Types
// ============================================

export type ProviderType = 'hpec_dao' | 'compute_portal' | 'hypercycle' | 'battery' | 'community';

export type ComputeOfferingCategory = 
  | 'hosting'        // Private Cloud, VPS, Bare Metal
  | 'storage'        // Object Storage, Data Infrastructure
  | 'gpu_compute'    // GPU instances, AI training
  | 'ai_tokens'      // Flat-rate AI token subscriptions (OUR UNIQUE)
  | 'node_activation' // Plug & Play nodes (ComputePortal style)
  | 'software'       // AI models, APIs, services
  ;

export type BillingModel = 'hourly' | 'monthly' | 'per_use' | 'subscription' | 'flat_rate';

export type OfferingStatus = 'available' | 'limited' | 'coming_soon' | 'deprecated';

export interface ComputeProvider {
  id: string;                          // e.g., "hpec-dao", "compute-portal"
  type: ProviderType;
  name: string;                        // "HPEC DAO"
  description: string;
  logoUrl?: string;
  websiteUrl: string;                  // e.g., "https://hpecdao.io"
  affiliateCode: string;               // "HPEC-MAURICIO-001"
  referralCommissionPercent: number;   // 0.15 = 15%
  isActive: boolean;
  apiBaseUrl?: string;                 // For API integrations
  apiDocsUrl?: string;
  supportedChains: ('ethereum' | 'base' | 'cardano' | 'solana')[];
  createdAt: number;
  // Provider health
  lastSyncedAt?: number;
  syncStatus: 'healthy' | 'degraded' | 'down' | 'never_synced';
}

export interface ProviderComputeOffering {
  id: string;                          // UUID
  providerId: string;                  // FK to ComputeProvider
  category: ComputeOfferingCategory;
  
  // Product Identity
  name: string;                        // "HPEC Private Cloud — 8 vCPU"
  description: string;
  shortDescription: string;            // Card subtitle
  icon: string;                        // lucide-react icon name
  tags: string[];                      // ["gpu", "nvidia", "ai", "staking"]
  
  // Pricing
  billingModel: BillingModel;
  pricePerHour?: number;               // For hourly (e.g., $0.50)
  pricePerMonth?: number;              // For monthly (e.g., $29.00)
  pricePerUse?: number;                // For per-use
  subscriptionTiers?: ComputeTier[];   // For flat-rate AI tokens
  
  // Resource Specs (displayed on card)
  specs: ComputeSpec;
  
  // Availability
  status: OfferingStatus;
  availabilityCount?: number;          // "89 available" like ComputePortal
  region?: string;                     // "US-East", "EU-West", "Global"
  
  // Referral / Affiliate
  affiliateLink: string;               // Deep link with referral code
  commissionAmount?: number;           // Estimated commission per sale
  
  // Booking / Integration
  externalBookingUrl?: string;         // Redirect to provider checkout
  internalBooking?: boolean;          // If true, we handle booking via our API
  apiEndpoint?: string;               // REST endpoint for provisioning
  
  // Metadata
  featured: boolean;                   // Show in "Popular Right Now"
  popular: boolean;                    // Badge on card
  new: boolean;                        // "NEW" badge
  createdAt: number;
  updatedAt: number;
}

export interface ComputeSpec {
  cpuCores?: number;
  cpuType?: string;                    // "AMD EPYC", "Intel Xeon"
  ramGB?: number;
  gpuType?: string;                    // "NVIDIA A100", "NVIDIA RTX 4090"
  gpuCount?: number;
  storageGB?: number;
  storageType?: string;               // "NVMe SSD", "HDD"
  bandwidthMbps?: number;
  aiTokensPerMonth?: number;          // For flat-rate AI
  supportedModels?: string[];         // ["claude-sonnet", "gpt-4o", "llama-3.2"]
}

export interface ComputeTier {
  tierId: string;                     // "lite", "pro", "unlimited"
  name: string;                       // "Lite"
  pricePerMonth: number;
  specs: ComputeSpec;
  description: string;
  featured: boolean;                   // Middle tier highlighted
}

export interface ComputeBooking {
  bookingId: string;
  userId: string;                      // Wallet address
  offeringId: string;
  providerId: string;
  tierId?: string;                     // If subscription/multi-tier
  
  // Booking State
  status: 'pending' | 'confirmed' | 'provisioning' | 'active' | 'suspended' | 'cancelled';
  
  // Financials
  billingModel: BillingModel;
  pricePerPeriod: number;
  period: 'hourly' | 'monthly';
  commissionAmount: number;
  commissionPercent: number;
  
  // Provider side
  providerBookingId?: string;          // External booking reference
  providerInstanceId?: string;        // e.g., AWS instance ID, HPEC node ID
  
  // Timestamps
  createdAt: number;
  activatedAt?: number;
  expiresAt?: number;
  cancelledAt?: number;
  
  // Access credentials (encrypted in vault)
  accessCredentials?: {
    ipAddress?: string;
    sshKey?: string;
    username?: string;
    password?: string;                 // Never plaintext — vault-encrypted
    dashboardUrl?: string;
  };
}

export interface ReferralTransaction {
  transactionId: string;
  bookingId: string;
  userId: string;                      // Buyer wallet
  providerId: string;
  offeringId: string;
  
  // Commission
  amount: number;                      // Commission earned (USD)
  percent: number;
  status: 'pending' | 'confirmed' | 'paid' | 'reversed';
  
  // Payment tracking
  payoutAddress?: string;             // Where commission is sent
  payoutTxHash?: string;              // Blockchain tx hash
  payoutToken?: 'USDC' | 'USDT' | 'ADA' | 'ETH';
  
  createdAt: number;
  confirmedAt?: number;
  paidAt?: number;
}
```

### 4.2 Type Relationships
```
ComputeProvider (1)
  └── ProviderComputeOffering (N)
        └── ComputeBooking (N) — per user
              └── ReferralTransaction (1) — per booking
```

---

## 5. Component Architecture

### 5.1 New Components (Renderer / React)

| Component | Purpose | Location |
|-----------|---------|----------|
| `ComputeProviderGrid` | Main marketplace grid (like ComputePortal cards) | `src/components/stargate/compute/` |
| `ComputeProviderCard` | Individual offering card with specs, price, badges | `src/components/stargate/compute/` |
| `ComputeProviderDetail` | Full offering detail panel (modal or drawer) | `src/components/stargate/compute/` |
| `ComputeBookingFlow` | Multi-step booking: select → wallet → confirm → provision | `src/components/stargate/compute/` |
| `ComputeDashboard` | User's active bookings, usage, spend | `src/components/stargate/compute/` |
| `ComputeProviderFilter` | Sidebar filter (category, price, region, provider) | `src/components/stargate/compute/` |
| `FlatRateAIManager` | Special component for AI token subscriptions | `src/components/stargate/compute/` |
| `ReferralEarningsPanel` | Affiliate dashboard — commissions, payouts, history | `src/components/stargate/compute/` |
| `ProviderSyncStatus` | Health indicator per provider (green/yellow/red) | `src/components/stargate/compute/` |

### 5.2 Integration into AdaPortalPanel

**Current:**
```tsx
{activeTab === 'compute' && <>{renderCompute()}{renderNodes()}</>}
```

**New:**
```tsx
{activeTab === 'compute' && (
  <ComputeProviderGrid
    providers={computeProviders}
    offerings={computeOfferings}
    userBookings={userBookings}
    onBook={handleBookOffering}
    onFilterChange={setComputeFilters}
    walletConnected={tokeoConnected || !!ethAddress}
    affiliateCode={activeAffiliateCode}  // "HPEC-MAURICIO-001"
  />
)}
```

---

## 6. Service Layer (Main Process / IPC)

### 6.1 New Services

```typescript
// ============================================
// COMPUTE PROVIDER SERVICE
// ============================================

class ComputeProviderService {
  // Provider Management
  async registerProvider(provider: ComputeProvider): Promise<void>;
  async syncProviderOfferings(providerId: string): Promise<ProviderComputeOffering[]>;
  async getAllProviders(): Promise<ComputeProvider[]>;
  async getProviderById(id: string): Promise<ComputeProvider | null>;
  
  // Offering Discovery
  async getOfferings(filters: OfferingFilter): Promise<ProviderComputeOffering[]>;
  async getFeaturedOfferings(): Promise<ProviderComputeOffering[]>;
  async getOfferingById(id: string): Promise<ProviderComputeOffering | null>;
  
  // Booking Lifecycle
  async createBooking(
    userId: string,
    offeringId: string,
    tierId?: string,
    walletAddress: string
  ): Promise<ComputeBooking>;
  
  async confirmBooking(
    bookingId: string,
    txHash: string,                    // Payment tx on-chain
    chain: SupportedChain
  ): Promise<ComputeBooking>;
  
  async provisionBooking(bookingId: string): Promise<ComputeBooking>;
  async getUserBookings(userId: string): Promise<ComputeBooking[]>;
  async cancelBooking(bookingId: string): Promise<ComputeBooking>;
  
  // Referral / Affiliate
  async recordReferral(booking: ComputeBooking): Promise<ReferralTransaction>;
  async getReferralEarnings(affiliateCode: string): Promise<ReferralTransaction[]>;
  async requestPayout(affiliateCode: string, amount: number, token: string): Promise<string>;
  
  // Flat-Rate AI Tokens (Special)
  async getAITokenSubscription(userId: string): Promise<FlatRateAISubscription | null>;
  async subscribeToAITokens(userId: string, tierId: string): Promise<ComputeBooking>;
  async checkAITokenQuota(userId: string): Promise<{ used: number; limit: number }>;
  async consumeAITokens(userId: string, tokens: number): Promise<boolean>;
}
```

### 6.2 IPC Bridge (preload.ts additions)

```typescript
// Add to electron/preload.ts
interface ComputeAPI {
  // Provider discovery
  'compute:providers:list': () => Promise<ComputeProvider[]>;
  'compute:offerings:list': (filters: OfferingFilter) => Promise<ProviderComputeOffering[]>;
  'compute:offering:get': (id: string) => Promise<ProviderComputeOffering>;
  
  // Booking
  'compute:booking:create': (offeringId: string, tierId?: string) => Promise<ComputeBooking>;
  'compute:booking:confirm': (bookingId: string, txHash: string) => Promise<ComputeBooking>;
  'compute:booking:list': () => Promise<ComputeBooking[]>;
  'compute:booking:cancel': (bookingId: string) => Promise<ComputeBooking>;
  
  // Referral
  'compute:referral:earnings': () => Promise<ReferralTransaction[]>;
  'compute:referral:payout': (amount: number, token: string) => Promise<string>;
  
  // AI Tokens (flat-rate)
  'compute:ai:subscription': () => Promise<FlatRateAISubscription | null>;
  'compute:ai:subscribe': (tierId: string) => Promise<ComputeBooking>;
  'compute:ai:quota': () => Promise<{ used: number; limit: number }>;
  'compute:ai:consume': (tokens: number) => Promise<boolean>;
}
```

---

## 7. Integration Points — Where We Hook Into Existing Systems

### 7.1 Wallet Integration (Web3 / Tokeo)
**Existing:** `electron/integrations/web3/` — MetaMask + Tokeo Cardano  
**Hook:** On booking creation, generate payment request:
- MetaMask: `walletAdapter.requestPayment(amount, token, recipient)`
- Tokeo: Cardano CIP-30 payment with `walletAddress` as buyer
- After on-chain confirmation, call `compute:booking:confirm(txHash)`

### 7.2 ANFE / Stargate Pool
**Existing:** `StargatePoolService` — NFT-gated compute access  
**Hook:** ANFE holders get discounts on HPEC DAO offerings:
- HPEC DAO PASS NFT → 10% off all HPEC offerings
- CMHPEC DAO PASS NFT → 15% off
- HyperDegens NFT → 5% off

**Implementation:**
```typescript
// In booking flow, check user's NFT holdings
const userNFTs = await anfeService.loadWalletANFEs(walletAddress);
const discount = calculateNFEDiscount(userNFTs, providerId);
const finalPrice = offering.pricePerMonth * (1 - discount);
```

### 7.3 Hermes Agent Orchestration
**Existing:** `HermesAgentService` — dispatch kanban tasks to HyperCycle nodes  
**Hook:** After booking a "Private Cloud" instance, auto-deploy a Hermes agent:
```typescript
// On booking activation:
await hermesAgentService.deployToNode({
  nodeId: booking.providerInstanceId,
  agentConfig: userAgent,
  anfeTokenId: userANFE.id
});
```

### 7.4 HyperInsight Telemetry
**Existing:** `HyperInsightStargateBridge` — node stats, AIM rankings  
**Hook:** Show real-time provider health:
```typescript
// Provider card shows live status:
const nodeHealth = await hyperInsight.getNodeHealth(provider.nodeId);
// Display: "● Live — 99.9% uptime — 12ms latency"
```

### 7.5 Vault (Secure Storage)
**Existing:** `electron/integrations/vault/` — encrypted box storage  
**Hook:** Store booking credentials securely:
```typescript
// On provisioning completion:
await vault.createEntry('compute-bookings', bookingId, {
  ipAddress: instance.ip,
  sshKey: encryptedSshKey,  // encrypted via safeStorage
  username: instance.username
});
```

### 7.6 Chronicle (Audit Trail)
**Existing:** `electron/integrations/sandbox/chronicle.ts` — append-only JSONL  
**Hook:** Log every booking, commission, and payout:
```typescript
// Per-provider chronicle:
chronicle.append({
  type: 'booking_created',
  bookingId: booking.id,
  user: walletAddress,
  amount: booking.pricePerPeriod,
  commission: booking.commissionAmount,
  timestamp: Date.now()
});
```

### 7.7 ASP Gateway (Company Onboarding)
**Existing:** `AspGatewayService` — company-level ASP packages  
**Hook:** Companies buying compute in bulk get ASP discounts:
```typescript
// In booking flow, check if user is part of an ASP:
const company = aspGateway.getCompanyByMember(walletAddress);
if (company) {
  const volumeDiscount = company.volumeDiscountPercent || 0;
  finalPrice *= (1 - volumeDiscount);
}
```

---

## 8. UI/UX Design — ComputeProviderGrid

### 8.1 Layout (inspired by ComputePortal)

```
┌─────────────────────────────────────────────────────────────┐
│  Compute Resources, Made Simple                               │
│  Discover verified compute from trusted providers            │
├─────────────────────────────────────────────────────────────┤
│  Filters [All ▼] [Hardware ▼] [Software ▼] [Price ▼]       │
├─────────────────────────────────────────────────────────────┤
│  🔥 Popular Right Now                    🛒 Cart (0)         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ HPEC     │  │ HPEC     │  │ HPEC     │  │ Flat-Rate│  │
│  │ Private  │  │ GPU      │  │ Storage  │  │ AI Tokens│  │
│  │ Cloud    │  │ Compute  │  │ 1TB      │  │ Unlimited│  │
│  │          │  │ A100     │  │          │  │          │  │
│  │ $0.50/hr │  │ $2.50/hr │  │ $0.02/GB│  │ $299/mo  │  │
│  │ 89 avail │  │ 12 avail │  │ ∞ avail  │  │ ● Active │  │
│  │ [Book]   │  │ [Book]   │  │ [Book]   │  │ [Manage] │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Node as  │  │ VPS      │  │ Plug &   │  │ Software │  │
│  │ Service  │  │ Fast     │  │ Play     │  │ AI Model │  │
│  │ (NaaS)   │  │ Scalable │  │ Node     │  │ API      │  │
│  │          │  │          │  │          │  │          │  │
│  │ Custom   │  │ Custom   │  │ $2.00    │  │ $0.01    │  │
│  │ pricing  │  │ pricing  │  │ one-time │  │ /call    │  │
│  │ [Contact]│  │ [Contact]│  │ [Buy]    │  │ [Subscribe]│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────────────────────┤
│  💰 Your Referral Earnings: $1,234.50 USDC                  │
│  [Withdraw]  [View History]  [Share Link]                    │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Card Component (ProviderComputeCard)

```typescript
interface ProviderComputeCardProps {
  offering: ProviderComputeOffering;
  provider: ComputeProvider;
  onBook: () => void;
  onDetails: () => void;
  userBooking?: ComputeBooking;       // If already booked, show "Manage"
  isFeatured?: boolean;               // Larger card, top banner
}

// Visual elements:
// - Provider logo (top-left)
// - Category badge (top-right: "Hosting", "GPU", "AI Tokens")
// - Status badge ("89 available", "NEW", "Limited")
// - Price (large, bold)
// - Specs list (CPU, RAM, GPU, Storage, Bandwidth)
// - AI Tokens special: progress bar showing quota usage
// - Action button: "Book Now" / "Manage" / "Coming Soon"
```

### 8.3 Booking Flow (Wizard)

```
Step 1: Select Offering
  → User clicks card → opens detail panel
  → Show full specs, region, SLA, provider info
  → "Book This" button

Step 2: Configure
  → Select tier (if multi-tier: Lite/Pro/Unlimited)
  → Select region (US-East, EU-West, Asia)
  → Duration (1 month, 3 months, 12 months — discount for longer)
  → Show price breakdown + estimated commission

Step 3: Wallet Payment
  → Detect connected wallet (MetaMask / Tokeo)
  → Generate payment request (amount, token, recipient address)
  → Show QR code for mobile wallet
  → Wait for on-chain confirmation

Step 4: Confirmation
  → "Booking confirmed! Transaction: 0xabc..."
  → Show provisioning status (spinner → "Ready!")
  → Display access credentials (IP, SSH key, dashboard URL)
  → Save to Vault (encrypted)
  → Add to Compute Dashboard
```

---

## 9. Flat-Rate AI Tokens — The Unique Offering

### 9.1 Subscription Tiers

| Tier | Price | Tokens | Models | Priority | Extra |
|------|-------|--------|--------|----------|-------|
| **Lite** | $29/mo | 1M/mo | Claude Haiku, GPT-4o-mini, Llama 3.2 | Standard | — |
| **Pro** | $99/mo | 5M/mo | Claude Sonnet, GPT-4o, Gemini 1.5 Pro | Priority | Custom skills |
| **Unlimited** | $299/mo | Unlimited | Claude Opus, GPT-4-turbo, local models | Highest | Custom model loading, dedicated instance |

### 9.2 Token Consumption Model

```typescript
// Integrated into AIService (src/services/AIService.ts)
class FlatRateAITokenManager {
  async checkQuota(userId: string): Promise<{ tier: string; used: number; limit: number }> {
    const sub = await computeProviderService.getAITokenSubscription(userId);
    if (!sub) return { tier: 'none', used: 0, limit: 0 };
    return { tier: sub.tierId, used: sub.tokensUsed, limit: sub.tokensLimit };
  }
  
  async consumeTokens(userId: string, tokens: number): Promise<boolean> {
    return computeProviderService.consumeAITokens(userId, tokens);
  }
  
  async getEffectivePrice(userId: string): Promise<number> {
    // For AI Chat UI: show "Using Pro plan — $99/mo — 3.2M tokens remaining"
    const quota = await this.checkQuota(userId);
    if (quota.tier === 'none') return Infinity; // Pay-per-use fallback
    return 0; // Already paid via subscription
  }
}

// In Chatview.tsx — before sending message:
const quota = await flatRateManager.checkQuota(userId);
if (quota.limit > 0 && quota.used >= quota.limit) {
  // Show upgrade prompt: "You've used 5M tokens. Upgrade to Unlimited?"
  showUpgradeModal();
}
```

### 9.3 Integration with AI Chat

When user sends a message in Chatview:
1. Check if user has active Flat-Rate AI subscription
2. If yes → route through `FlatRateAIManager` (no per-token cost)
3. If no → fall back to existing per-use model (API key required)
4. After LLM response, deduct estimated tokens from quota
5. Show remaining quota in chat UI (progress bar)

---

## 10. Referral / Affiliate System

### 10.1 Commission Structure

| Offering Type | Commission | Payout Schedule |
|-------------|------------|-----------------|
| Private Cloud (Hosting) | 10% first 3 months | Monthly, 30-day hold |
| Storage | 5% recurring | Monthly, 30-day hold |
| GPU Compute | 15% first month | Monthly, 30-day hold |
| Flat-Rate AI Tokens | 30% recurring | Monthly, 15-day hold |
| Node Activation | 20% one-time | Instant on confirmation |

### 10.2 Referral Link Format

```
https://mosaic-companion.app/stargate/compute?ref=HPEC-MAURICIO-001&provider=hpec-dao&offering=hosting-8vcpu
```

### 10.3 Earnings Dashboard

```typescript
interface ReferralDashboardProps {
  totalEarned: number;
  pendingPayout: number;
  thisMonth: number;
  conversionRate: number;            // Bookings / Clicks
  topOfferings: TopOffering[];
  transactions: ReferralTransaction[];
  onWithdraw: (amount: number, token: string) => void;
  onShare: () => void;               // Copy referral link
}

// Visual:
// ┌─────────────────────────────────────────┐
// │  💰 Your Earnings                       │
// │  $1,234.50 USDC  (Pending: $340.20)   │
// │  [Withdraw]  [Share Link]               │
// ├─────────────────────────────────────────┤
// │  This Month: $456.80 ↑ 23% vs last     │
// │  Conversion: 4.2% (42 bookings / 1k)   │
// ├─────────────────────────────────────────┤
// │  Top Performers:                        │
// │  1. Flat-Rate AI Pro — $620.00        │
// │  2. GPU Compute A100 — $340.00        │
// │  3. Private Cloud 8vCPU — $274.50     │
// ├─────────────────────────────────────────┤
// │  Recent Transactions                  │
// │  • $45.00 — Flat-Rate AI Pro — Paid   │
// │  • $30.00 — GPU A100 — Pending        │
// │  • $12.50 — Storage 1TB — Confirmed   │
// └─────────────────────────────────────────┘
```

### 10.4 Payout Mechanism

- **Minimum:** $50 USDC
- **Tokens:** USDC (Base), USDT (Ethereum), ADA (Cardano)
- **Schedule:** Monthly auto-payout if > $50, else manual request
- **On-chain:** Payout tx recorded in `ReferralTransaction.payoutTxHash`

---

## 11. Provider API Integration (HPEC DAO Example)

### 11.1 HPEC DAO API (Hypothetical — To Be Confirmed)

```typescript
// HPEC DAO adapter — implements ComputeProviderAdapter
class HPECDAOAdapter implements ComputeProviderAdapter {
  private baseUrl = 'https://api.hpecdao.io/v1';
  private affiliateCode: string;
  
  async syncOfferings(): Promise<ProviderComputeOffering[]> {
    const response = await fetch(`${this.baseUrl}/offerings?affiliate=${this.affiliateCode}`);
    const data = await response.json();
    return data.offerings.map(o => this.mapToOffering(o));
  }
  
  async createBooking(
    offeringId: string,
    userWallet: string,
    tierId?: string
  ): Promise<{ bookingId: string; paymentAddress: string; amount: number }> {
    const response = await fetch(`${this.baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offeringId,
        userWallet,
        tierId,
        affiliateCode: this.affiliateCode,
        metadata: { source: 'mosaic-companion' }
      })
    });
    return response.json(); // Returns payment address + amount
  }
  
  async confirmBooking(
    bookingId: string,
    txHash: string
  ): Promise<{ instanceId: string; credentials: InstanceCredentials }> {
    const response = await fetch(`${this.baseUrl}/bookings/${bookingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ txHash, chain: 'base' })
    });
    return response.json();
  }
  
  async getInstanceStatus(instanceId: string): Promise<'provisioning' | 'active' | 'failed'> {
    const response = await fetch(`${this.baseUrl}/instances/${instanceId}/status`);
    const data = await response.json();
    return data.status;
  }
  
  async getReferralStats(): Promise<{ totalEarned: number; pending: number; conversions: number }> {
    const response = await fetch(`${this.baseUrl}/affiliates/${this.affiliateCode}/stats`);
    return response.json();
  }
}
```

### 11.2 ComputePortal Adapter (Future)

```typescript
class ComputePortalAdapter implements ComputeProviderAdapter {
  private baseUrl = 'https://api.computeportal.io/v1';
  // Similar pattern but with ComputePortal-specific auth/API
}
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Infrastructure + data model + HPEC DAO integration

| Task | Effort | Owner |
|------|--------|-------|
| Define `ComputeProvider`, `ProviderComputeOffering`, `ComputeBooking` types | 1d | Backend |
| Create `ComputeProviderService` with CRUD + sync | 2d | Backend |
| Add IPC handlers (`compute:*`) to `preload.ts` | 1d | Backend |
| Build `ComputeProviderGrid` + `ProviderComputeCard` components | 2d | Frontend |
| Integrate into `AdaPortalPanel` `compute` tab | 1d | Frontend |
| Implement HPEC DAO adapter (mock API first) | 2d | Backend |
| Add filter sidebar (category, price, region) | 1d | Frontend |

**Deliverable:** Browseable marketplace with HPEC DAO offerings (static/mock data)

### Phase 2: Booking Flow (Week 3-4)
**Goal:** End-to-end booking with wallet payment

| Task | Effort | Owner |
|------|--------|-------|
| Build `ComputeBookingFlow` wizard component | 3d | Frontend |
| Integrate wallet payment (MetaMask + Tokeo) | 2d | Backend |
| Implement `createBooking` → `confirmBooking` → `provisionBooking` | 2d | Backend |
| Add booking confirmation email (Atomic Mail MCP) | 1d | Backend |
| Store credentials in Vault (encrypted) | 1d | Backend |
| Build `ComputeDashboard` (user bookings) | 2d | Frontend |
| Add Chronicle logging per booking | 0.5d | Backend |

**Deliverable:** Users can book HPEC DAO compute and pay with wallet

### Phase 3: Flat-Rate AI Tokens (Week 5-6)
**Goal:** The unique offering — unlimited AI for fixed fee

| Task | Effort | Owner |
|------|--------|-------|
| Define `FlatRateAISubscription` model + tiers | 1d | Backend |
| Build `FlatRateAIManager` service | 2d | Backend |
| Integrate token consumption into `AIService` | 2d | Backend |
| Build `FlatRateAIManager` UI component | 2d | Frontend |
| Add quota display in Chatview (progress bar) | 1d | Frontend |
| Implement subscription upgrade/downgrade flow | 2d | Frontend |
| Add "Subscribe to AI" button in Settings | 0.5d | Frontend |

**Deliverable:** $29/$99/$299 AI subscription tiers with quota tracking

### Phase 4: Affiliate System (Week 7-8)
**Goal:** Referral commissions + earnings dashboard

| Task | Effort | Owner |
|------|--------|-------|
| Implement `ReferralTransaction` model + tracking | 2d | Backend |
| Add affiliate code generation + validation | 1d | Backend |
| Build `ReferralEarningsPanel` component | 2d | Frontend |
| Implement payout flow (USDC/ADA transfer) | 2d | Backend |
| Add referral link sharing (copy + social) | 1d | Frontend |
| Build commission analytics (conversion rate, top offerings) | 2d | Frontend |
| Add ASP volume discounts for companies | 1d | Backend |

**Deliverable:** Full affiliate system with withdrawable earnings

### Phase 5: Scale — Multi-Provider (Week 9-10)
**Goal:** Onboard ComputePortal, Battery Nodes, community providers

| Task | Effort | Owner |
|------|--------|-------|
| Build `ComputePortalAdapter` | 2d | Backend |
| Build `BatteryOrgAdapter` | 2d | Backend |
| Add provider health monitoring (`ProviderSyncStatus`) | 2d | Frontend |
| Implement provider score/ranking algorithm | 2d | Backend |
| Add provider onboarding flow (for new providers) | 3d | Frontend + Backend |
| Build provider dashboard (for compute sellers) | 3d | Frontend |
| Add cross-provider price comparison | 1d | Frontend |

**Deliverable:** Multi-provider marketplace with 3+ providers

---

## 13. Key Design Decisions

### 13.1 Why Flat-Rate AI Tokens?
**The Gap:** No competitor (OpenAI, Anthropic, Google) offers unlimited tokens for fixed fee. ComputePortal has no AI subscription model.  
**The Edge:** Mosaic users already use AI Chat daily. A "Netflix for LLMs" model removes token anxiety and creates predictable revenue.  
**Commission:** 30% recurring on $99/mo = $29.70/mo per user. 1000 users = $29,700/mo passive income.

### 13.2 Why HPEC DAO First?
**Alignment:** HPEC DAO is already a Cardano/HyperCycle partner. We have NFT policy IDs in the codebase.  
**Trust:** Users already hold HPEC DAO PASS NFTs — natural upsell.  
**Technical:** HPEC DAO has node infrastructure; we can integrate with existing HyperCycle telemetry.  
**Commission:** 10-30% is competitive with AWS/Azure partner programs (5-15%).

### 13.3 Why Wallet-Integrated Checkout?
**User Experience:** One-click payment from existing MetaMask/Tokeo connection. No credit card forms.  
**Trust:** On-chain payment = immutable proof. No chargebacks.  
**Commission Tracking:** Blockchain tx hashes = transparent referral attribution.  
**Security:** No PCI compliance needed. Payments are on-chain.

### 13.4 Why Not Just Redirect to ComputePortal?
**Value Capture:** Redirect = 0% commission. Integrated booking = 10-30% commission.  
**User Experience:** In-app booking keeps users in Mosaic. Context switching = abandonment.  
**Data:** We learn what users buy, when, how much. Fuels recommendation engine.  
**Unique:** We add Flat-Rate AI, ANFE discounts, Hermes agent deployment — things ComputePortal can't do.

---

## 14. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| HPEC DAO API not ready | Build mock adapter first. Swap real API when available. |
| Provider goes down | Health monitoring + fallback providers. Show "Temporarily Unavailable". |
| User doesn't pay | Booking stays in `pending` for 24h, then auto-cancelled. |
| Commission disputes | Chronicle audit trail + blockchain tx hashes = immutable proof. |
| Token quota abuse | Rate limiting + anomaly detection. Suspend subscription if abuse detected. |
| Wallet not connected | Show "Connect Wallet to Book" CTA. Fallback to QR code payment. |
| Regulatory (affiliate) | Add terms of service disclosure. "Affiliate links — we earn commission." |

---

## 15. Open Questions (Need Your Input)

1. **HPEC DAO API:** Do they have a REST API? What's the endpoint? Auth method?
2. **Affiliate Code:** What is your HPEC DAO affiliate/referral code? (e.g., `HPEC-MAURICIO-001`)
3. **Payment Address:** What wallet address receives commissions? (Base USDC? Cardano ADA?)
4. **Pricing:** Confirm Flat-Rate AI tiers ($29/$99/$299) and HPEC DAO offering prices.
5. **ComputePortal Partnership:** Are we integrating their API or scraping? Do we have an API key?
6. **Battery Nodes:** What services will Battery Nodes offer? (GPU? Storage? Hosting?)
7. **NFT Discounts:** Confirm ANFE discount percentages (HPEC DAO PASS 10%, CMHPEC 15%?).
8. **Payout Token:** USDC (Base), USDT (Ethereum), or ADA (Cardano)?
9. **Legal:** Do you have terms of service for affiliate program? KYC needed for payouts?

---

## 16. Files to Create / Modify

### New Files
```
src/services/ComputeProviderService.ts
src/services/adapters/HPECDAOAdapter.ts
src/services/adapters/ComputePortalAdapter.ts
src/services/FlatRateAIManager.ts
src/services/ReferralTrackingService.ts
src/components/stargate/compute/ComputeProviderGrid.tsx
src/components/stargate/compute/ProviderComputeCard.tsx
src/components/stargate/compute/ComputeProviderDetail.tsx
src/components/stargate/compute/ComputeBookingFlow.tsx
src/components/stargate/compute/ComputeDashboard.tsx
src/components/stargate/compute/FlatRateAIManager.tsx
src/components/stargate/compute/ReferralEarningsPanel.tsx
src/components/stargate/compute/ProviderSyncStatus.tsx
src/types/compute.ts
electron/integrations/compute/index.ts
electron/integrations/compute/ComputeProviderManager.ts
electron/integrations/compute/adapters/HPECDAOAdapter.ts
```

### Modified Files
```
src/components/AdaPortalPanel.tsx          // Add compute tab integration
src/services/AIService.ts                  // Add FlatRateAI token consumption
electron/preload.ts                        // Add compute:* IPC handlers
src/components/Chatview.tsx                // Add quota display
src/components/SettingsPage.tsx            // Add AI subscription management
```

---

## 17. Success Metrics

| Metric | Target (Month 1) | Target (Month 6) |
|--------|-----------------|------------------|
| Active bookings | 50 | 1,000 |
| Flat-Rate AI subscribers | 20 | 500 |
| Monthly referral commission | $500 | $25,000 |
| Provider count | 1 (HPEC DAO) | 4+ |
| Average booking value | $75 | $120 |
| Conversion rate | 2% | 5% |
| User retention (AI sub) | 70% | 85% |

---

## 18. Next Steps

1. **You confirm:** HPEC DAO API details, affiliate code, pricing, payment address
2. **I implement:** Phase 1 (Foundation) — types, service, grid component, mock data
3. **You test:** Browse marketplace, verify UI/UX, provide feedback
4. **I iterate:** Adjust based on feedback, integrate real HPEC DAO API
5. **We launch:** Soft launch with HPEC DAO only, then add Flat-Rate AI, then multi-provider

---

*End of Architecture Design Document*
