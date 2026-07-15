# Stargate Pool Cloud Architecture
## Distributed Compute Cluster for Global HyperAIBox Fleet

**Version:** 1.0  
**Date:** 2026-06-27  
**Author:** AI Architect (Hermes)  
**Scope:** Stargate Pool → Global HyperAIBox Cloud → Tilling Service

---

## 1. Executive Summary

**The Vision:** Transform the Stargate Pool from a simple node registry into a **global distributed compute cloud** built on HyperAIBox appliances. Users worldwide can rent compute power from this pool at prices competitive with HyperPG ($5 USD/month per node factory), with seamless provisioning, automatic scaling, and crypto/fiat payment.

**What Already Exists (Building Blocks):**
| Component | What It Does | Status |
|-----------|-------------|--------|
| `FleetDiscoveryService` | Discovers HyperAIBoxes via registry or local config | ✅ Active |
| `HBoxPoolService` | Manages delegation, agent deployment, health | ✅ Active |
| `NodeManagerClient` | Protocol-2 signed API calls to HyperAIBoxes | ✅ Active |
| `payments-jit` | USDC top-ups to nodes, 402 handling | ✅ Active |
| `LocalNodeBridge` | Polls `localhost:8005/8006` for local box telemetry | ✅ Active |
| `HyperInsight` | Network-wide node stats, GPU, uptime, region | ✅ Active |
| `StargatePoolService` | ANFE management, wallet connection, pool registration | ✅ Active |

**The Gap:** These are **disconnected pieces**. We need an **orchestration layer** that treats hundreds of HyperAIBoxes as a unified cloud — with NAT traversal, load balancing, tenant isolation, and automated provisioning.

---

## 2. Problem Analysis: Why This Is Hard

### 2.1 The HyperAIBox Deployment Reality

```
┌─────────────────────────────────────────────────────────────┐
│                    GLOBAL HYPERAIBOX FLEET                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🇺🇸 US-East          🇪🇺 EU-West           🇸🇬 Asia-Pacific    │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│  │ HyperAIBox   │     │ HyperAIBox   │     │ HyperAIBox   │  │
│  │ R2D2         │     │ C-3PO        │     │ BB-8         │  │
│  │              │     │              │     │              │  │
│  │ • RK3588 ARM │     │ • RK3588 ARM │     │ • RK3588 ARM │  │
│  │ • 32GB RAM   │     │ • 32GB RAM   │     │ • 32GB RAM   │  │
│  │ • 2x RTX 4090│     │ • 1x RTX 3090│     │ • No GPU     │  │
│  │ • Home WiFi  │     │ • Office LAN │     │ • 4G Hotspot │  │
│  │ • NAT Router │     │ • NAT Router │     │ • CGNAT      │  │
│  │ • No staticIP│     │ • Firewall   │     │ • No inbound │  │
│  │ • Dynamic DNS│     │ • Port fwd?  │     │ • Firewalled │  │
│  └──────────────┘     └──────────────┘     └──────────────┘  │
│                                                               │
│  ❌ No public IP          ❌ No public IP        ❌ No publicIP│
│  ❌ Behind NAT            ❌ Behind NAT/FW       ❌ Behind CGNAT│
│  ❌ Port 8005/8006 local  ❌ Maybe port fwd       ❌ Nothing fwd│
│                                                               │
│  How does a renter in Germany use a box in Texas?            │
│  How do we route compute jobs to the nearest available box?  │
│  How do we isolate renters from each other and the owner?  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Challenges

| Challenge | Severity | Description |
|-----------|----------|-------------|
| **NAT Traversal** | 🔴 Critical | Boxes have no public IP, inbound connections blocked |
| **Network Heterogeneity** | 🔴 Critical | Home WiFi, office LAN, 4G, CGNAT — all different |
| **Firewall Pinholes** | 🟡 High | Need stable outbound tunnels; can't rely on port forwarding |
| **Dynamic IPs** | 🟡 High | Residential IPs change; need persistent addressing |
| **Tenant Isolation** | 🔴 Critical | Multiple renters on same box = security risk |
| **Capacity Fragmentation** | 🟡 Medium | 100 boxes × 32GB RAM ≠ one big 3.2TB box |
| **Payment Routing** | 🟡 Medium | Revenue split: pool operator, box owner, Stargate commission |
| **Latency Optimization** | 🟡 Medium | Route users to nearest geographic box |

---

## 3. Architecture: The Stargate Pool Cloud

### 3.1 High-Level Design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           STARGATE POUD COMPUTE CLOUD                         │
│                    "The Airbnb of Compute — Powered by HyperAIBoxes"         │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    RENTER (User who needs compute)                   │     │
│  │                     Mosaic-Companion App / Web                       │     │
│  │                                                                      │     │
│  │   "I need 8 CPU, 32GB RAM, 1x GPU for 2 hours"                       │     │
│  │   [Browse Pool] → [Select Tier] → [Pay $3.50] → [Provisioned]     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │              STARGATE POUD ORCHESTRATOR (SPO)                        │     │
│  │                    🌐 Global Control Plane                          │     │
│  ├─────────────────────────────────────────────────────────────────────┤     │
│  │                                                                      │     │
│  │  ┌─ Pool Registry ─────────────────────────────────────────────┐   │     │
│  │  │  Known HyperAIBoxes:                                         │   │     │
│  │  │  • R2D2 (US-East) — 8 CPU, 32GB, 2x RTX 4090 — ONLINE        │   │     │
│  │  │  • C-3PO (EU-West) — 8 CPU, 32GB, 1x RTX 3090 — ONLINE       │   │     │
│  │  │  • BB-8 (Asia) — 8 CPU, 32GB, No GPU — BUSY                   │   │     │
│  │  └────────────────────────────────────────────────────────────────┘   │     │
│  │                                                                      │     │
│  │  ┌─ Matchmaker ────────────────────────────────────────────────┐   │     │
│  │  │  Renting from Germany → Route to EU-West (C-3PO)            │   │     │
│  │  │  Need GPU → Filter out BB-8 (no GPU)                         │   │     │
│  │  │  Lowest latency + available capacity = C-3PO ✅              │   │     │
│  │  └────────────────────────────────────────────────────────────────┘   │     │
│  │                                                                      │     │
│  │  ┌─ Provisioner ───────────────────────────────────────────────┐   │     │
│  │  │  1. Create tenant on C-3PO (Docker container + volume)       │   │     │
│  │  │  2. Assign port range (8100-8109)                             │   │     │
│  │  │  3. Generate SSH key pair (renter public key → box)           │   │     │
│  │  │  4. Start AIM container (Hermes agent or custom image)        │   │     │
│  │  │  5. Update reverse tunnel → map `c3po-tenant-abc.stargate.pool`│   │     │
│  │  └────────────────────────────────────────────────────────────────┘   │     │
│  │                                                                      │     │
│  │  ┌─ Payment Router ─────────────────────────────────────────────┐   │     │
│  │  │  Rent pays $3.50 → Split:                                     │   │     │
│  │  │  • Box owner (C-3PO): $2.00 (57%)                             │   │     │
│  │  │  • Stargate Pool operator: $1.00 (29%)                        │   │     │
│  │  │  • HPEC DAO affiliate: $0.50 (14%)                            │   │     │
│  │  │  All on-chain via smart contract                               │   │     │
│  │  └────────────────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                    ┌───────────────┼───────────────┐                        │
│                    │               │               │                        │
│                    ▼               ▼               ▼                        │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐     │
│  │  STARGATE RELAY    │ │  STARGATE RELAY    │ │  STARGATE RELAY    │     │
│  │  🇺🇸 US-East        │ │  🇪🇺 EU-West        │ │  🇸🇬 Asia-Pacific   │     │
│  │  relay-us.pool.io  │ │  relay-eu.pool.io  │ │  relay-ap.pool.io  │     │
│  ├────────────────────┤ ├────────────────────┤ ├────────────────────┤     │
│  │ • Public IP        │ │ • Public IP        │ │ • Public IP        │     │
│  │ • WireGuard hub    │ │ • WireGuard hub    │ │ • WireGuard hub    │     │
│  │ • Reverse proxy    │ │ • Reverse proxy    │ │ • Reverse proxy    │     │
│  │ • TLS termination  │ │ • TLS termination  │ │ • TLS termination  │     │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘     │
│         ▲      ▲              ▲      ▲              ▲      ▲             │
│         │      │              │      │              │      │             │
│    WireGuard tunnels (outbound from boxes, inbound from anywhere)          │
│         │      │              │      │              │      │             │
│  ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐          │
│  │  HYPERAIBOX │       │  HYPERAIBOX │       │  HYPERAIBOX │          │
│  │  R2D2       │       │  C-3PO      │       │  BB-8       │          │
│  │  (Texas)    │       │  (Germany)  │       │  (Singapore)│          │
│  ├─────────────┤       ├─────────────┤       ├─────────────┤          │
│  │• RK3588 ARM │       │• RK3588 ARM │       │• RK3588 ARM │          │
│  │• 32GB RAM   │       │• 32GB RAM   │       │• 32GB RAM   │          │
│  │• 2x RTX4090 │       │• 1x RTX3090 │       │• No GPU     │          │
│  │• Docker AIMs │       │• Docker AIMs │       │• Docker AIMs │          │
│  │• WireGuard  │       │• WireGuard  │       │• WireGuard  │          │
│  │  client     │       │  client     │       │  client     │          │
│  └─────────────┘       └─────────────┘       └─────────────┘          │
│  Home WiFi / NAT      Office LAN / NAT     4G Hotspot / CGNAT          │
│  No inbound ports     Maybe port fwd       No inbound ports            │
│  ⬆️ Outbound WG to US-East relay                                       │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Components

### 4.1 Stargate Pool Orchestrator (SPO)

**The Brain.** Runs in Stargate's backend (can be a service in Mosaic's main process or a separate cloud service).

```typescript
interface StargatePoolOrchestrator {
  // Registry
  registerBox(box: HyperAIBoxRegistration): Promise<void>;
  unregisterBox(boxId: string): Promise<void>;
  getBox(boxId: string): Promise<PoolBox | null>;
  listBoxes(filters?: BoxFilters): Promise<PoolBox[]>;
  
  // Health
  heartbeat(boxId: string, telemetry: BoxTelemetry): Promise<void>;
  getBoxHealth(boxId: string): Promise<BoxHealth>;
  
  // Allocation
  allocateCompute(request: ComputeRequest): Promise<ComputeAllocation>;
  releaseCompute(allocationId: string): Promise<void>;
  extendCompute(allocationId: string, hours: number): Promise<void>;
  
  // Routing
  getRoute(boxId: string): Promise<RouteInfo>;        // tenant → box
  getReverseRoute(boxId: string): Promise<RouteInfo>;   // SPO → box (via relay)
  
  // Pricing
  calculatePrice(specs: ComputeSpec, hours: number): Promise<PriceQuote>;
  
  // Revenue
  recordPayment(payment: PoolPayment): Promise<void>;
  distributeRevenue(allocationId: string): Promise<void>;
}
```

### 4.2 Stargate Relay (Regional Hub)

**The Gateway.** Publicly accessible servers in each region. Boxes connect OUTBOUND to these (NAT-safe). Renters connect to these to reach their allocated boxes.

```
┌─────────────────────────────────────────────┐
│         STARGATE RELAY (per region)        │
│         e.g., relay-eu.stargate.pool        │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─ WireGuard Server ─────────────────────┐ │
│  │  wg0: 10.200.0.1/24                   │ │
│  │  Boxes get IPs: 10.200.0.10, .11, ...  │ │
│  │  Persistent keys, auto-reconnect       │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌─ Reverse Proxy (Nginx/Traefik) ──────┐ │
│  │  c3po-tenant-abc.stargate.pool →     │ │
│  │    10.200.0.11:8100 (WireGuard IP)   │ │
│  │                                          │ │
│  │  r2d2-tenant-def.stargate.pool →      │ │
│  │    10.200.0.10:8200                   │ │
│  │  TLS certs via Let's Encrypt            │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌─ NATS / Message Bus ──────────────────┐ │
│  │  SPO commands → boxes                 │ │
│  │  Box telemetry → SPO                  │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌─ DDoS Protection ──────────────────────┐ │
│  │  Rate limiting per tenant              │ │
│  │  WAF rules                             │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Why WireGuard?**
- UDP-based = NAT-friendly (outbound UDP usually allowed)
- Single port (51820) = easy firewall rule
- Roaming = box can change IP, tunnel stays up
- Small codebase = can run on RK3588
- Performance = kernel-accelerated, minimal CPU overhead

### 4.3 HyperAIBox Agent (HBA)

**The Worker.** Lightweight service running on every HyperAIBox (in a Docker container or systemd service). Connects to regional relay, reports capacity, accepts provisioning commands.

```typescript
interface HyperAIBoxAgent {
  // Lifecycle
  start(config: AgentConfig): Promise<void>;
  stop(): Promise<void>;
  
  // Connectivity
  connectToRelay(relayUrl: string, wgConfig: WireGuardConfig): Promise<void>;
  disconnectFromRelay(): Promise<void>;
  
  // Reporting
  reportTelemetry(): Promise<BoxTelemetry>;
  reportHealth(): Promise<BoxHealth>;
  
  // Provisioning
  provisionTenant(config: TenantConfig): Promise<TenantInfo>;
  destroyTenant(tenantId: string): Promise<void>;
  listTenants(): Promise<TenantInfo[]>;
  
  // Resource enforcement
  enforceLimits(tenantId: string, limits: ResourceLimits): Promise<void>;
}

interface BoxTelemetry {
  boxId: string;
  timestamp: number;
  cpu: { usagePercent: number; cores: number };
  memory: { usedGB: number; totalGB: number };
  gpu: { model: string; count: number; utilization: number; vramUsedGB: number };
  storage: { usedGB: number; totalGB: number };
  network: { latencyToRelayMs: number; bandwidthMbps: number };
  docker: { runningContainers: number; totalContainers: number };
  aims: { running: number; slots: number };
}
```

### 4.4 Tenant Isolation (Docker-based)

Each renter gets an isolated Docker container on the allocated HyperAIBox.

```yaml
# docker-compose.tenant.yml (generated by Provisioner)
version: '3.8'
services:
  tenant-workspace:
    image: stargate/tenant-base:latest  # Pre-built with Hermes, Ollama, tools
    container_name: tenant-abc123
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '8.0'
          memory: 32G
        reservations:
          cpus: '2.0'
          memory: 4G
    
    # GPU access (NVIDIA Container Toolkit)
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=0  # First GPU assigned to this tenant
      - NVIDIA_DRIVER_CAPABILITIES=compute,utility
    
    # Network isolation
    networks:
      - tenant-net
    ports:
      - "127.0.0.1:8100:8000"   # AIM API (internal only, accessed via relay)
      - "127.0.0.1:8101:22"     # SSH (internal only)
      - "127.0.0.1:8102:8080"   # Jupyter / Web UI
    
    # Storage
    volumes:
      - tenant-abc123-data:/workspace
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Allow child containers
    
    # Security
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    
    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/info"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  tenant-net:
    driver: bridge
    internal: false  # But firewall rules restrict external access

volumes:
  tenant-abc123-data:
    driver: local
```

**Security Model:**
- Each tenant = one Docker container
- No root privileges inside container (`no-new-privileges`)
- Network isolated (bridge network, no direct internet by default)
- GPU access controlled via `NVIDIA_VISIBLE_DEVICES` (only assigned GPUs)
- Storage = named volume (persistent across restarts, destroyed with tenant)
- SSH key authentication only (no passwords)

---

## 5. Network Architecture: How We Beat NAT

### 5.1 The Problem

```
HyperAIBox (Home)              Internet               Renter
┌──────────────┐               ┌──────┐              ┌──────────┐
│ 10.0.1.50    │──NAT Router──▶│ 🌍   │───Firewall──▶│ Germany  │
│ :8005/:8006  │  No inbound   │      │ No inbound   │ wants to │
│ No public IP │  ports fwd    │      │ to 10.0.1.50 │ connect  │
└──────────────┘               └──────┘              └──────────┘
```

### 5.2 The Solution: WireGuard + Relay

```
Phase 1: Box boots up
─────────────────────────────────────────────────────────────
HyperAIBox (Texas)                    Stargate Relay (US-East)
┌──────────────────┐                 ┌──────────────────────┐
│ 1. HBA starts    │                 │                      │
│ 2. Reads config: │                 │                      │
│    relay:        │                 │                      │
│    relay-us.pool │                 │                      │
│    wg pubkey:    │                 │                      │
│    abc123...     │                 │                      │
│                  │                 │                      │
│ 3. Outbound UDP  │════════════════▶│ 4. WG handshake      │
│    to :51820     │  NAT OK! UDP   │    Box IP:           │
│                  │  outbound works  │    10.200.0.10/32    │
└──────────────────┘                 └──────────────────────┘

Phase 2: Renter gets allocated
─────────────────────────────────────────────────────────────
Renter (Germany)     SPO (EU)          Relay (EU)         Box (US)
┌──────────┐      ┌────────┐        ┌──────────┐     ┌────────┐
│ "I need  │─────▶│ Match  │───────▶│ Reverse  │────▶│ Tenant │
│  GPU"     │      │ R2D2   │        │ Proxy    │     │ Docker │
│           │      │ (Texas)│        │          │     │ :8100  │
└──────────┘      └────────┘        └──────────┘     └────────┘
                         │               │
                         │               │ r2d2-abc.stargate.pool
                         │               │ → 10.200.0.10:8100
                         │               │ (via WireGuard)
                         ▼               ▼
                   ┌──────────────────────────────┐
                   │ Renter gets URL:             │
                   │ https://r2d2-abc.stargate.pool│
                   │ + SSH key for direct access  │
                   └──────────────────────────────┘
```

### 5.3 WireGuard Configuration

**Relay Server (US-East):**
```ini
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <relay-private-key>
Address = 10.200.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# HyperAIBox: R2D2
[Peer]
PublicKey = <r2d2-public-key>
AllowedIPs = 10.200.0.10/32
PersistentKeepalive = 25

# HyperAIBox: C-3PO
[Peer]
PublicKey = <c3po-public-key>
AllowedIPs = 10.200.0.11/32
PersistentKeepalive = 25
```

**HyperAIBox (R2D2):**
```ini
# /etc/wireguard/wg-stargate.conf
[Interface]
PrivateKey = <r2d2-private-key>
Address = 10.200.0.10/32

[Peer]
PublicKey = <relay-us-public-key>
AllowedIPs = 10.200.0.0/24
Endpoint = relay-us.stargate.pool:51820
PersistentKeepalive = 25
```

**Why this works:**
- Box initiates outbound UDP to relay (NAT allows outbound)
- `PersistentKeepalive = 25` = sends keepalive every 25s, keeping NAT mapping alive
- Relay has public IP = renter can connect to relay
- Relay forwards via WireGuard tunnel to box
- Box never needs inbound port forwarding

### 5.4 Alternative: Tailscale (Managed WireGuard)

If we don't want to manage our own WireGuard infrastructure, **Tailscale** provides:
- Managed NAT traversal (STUN, DERP relays)
- Automatic mesh networking
- ACLs (access control lists)
- MagicDNS (`r2d2.tailnet-name.ts.net`)
- Works behind CGNAT

**Trade-off:**
- ✅ Easier setup, managed infrastructure
- ✅ Works on mobile, works behind CGNAT
- ❌ Dependency on Tailscale's network
- ❌ $6-18/user/month for team plan
- ❌ Less control over routing

**Recommendation:** Start with self-managed WireGuard (full control, lower cost). Evaluate Tailscale if NAT traversal becomes too complex.

---

## 6. Tilling Service: Compute Rental Model

### 6.1 What Is "Tilling"?

**HyperPG's offering:** Rent compute by the "tile" — a standardized compute unit (CPU + RAM + GPU slice). They charge **$5 USD per tile per day**.

> **Note:** This is HyperPG's **compute tile rental** pricing. Their separate **Node Factory Tilling Service** is priced at **$5/month per node factory** (see [`tilling-service-architecture.md`](tilling-service-architecture.md) for tilling-specific architecture).

**Our offering:** Stargate Pool "Tilling" — rent compute from HyperAIBoxes at a **lower price point** because we have lower infrastructure costs (no data center, community-owned hardware).

### 6.2 Tilling Service Pricing

| Tier | Specs | HyperPG Price | **Stargate Pool Price** | Savings |
|------|-------|---------------|------------------------|---------|
| **Micro Tile** | 2 CPU, 8GB RAM, No GPU | N/A | **$2.00/day** | — |
| **Small Tile** | 4 CPU, 16GB RAM, Shared GPU | $5/day | **$3.50/day** | **30% cheaper** |
| **Standard Tile** | 8 CPU, 32GB RAM, 1x RTX 3090 | $10/day | **$7.00/day** | **30% cheaper** |
| **Large Tile** | 8 CPU, 32GB RAM, 2x RTX 4090 | $20/day | **$14.00/day** | **30% cheaper** |
| **GPU Slice** | Shared GPU (25% of RTX 4090) | $8/day | **$5.00/day** | **37% cheaper** |

**Why cheaper?**
- No data center costs (boxes are in homes/offices)
- No cooling costs (owner pays electricity)
- Community-owned = no depreciation
- Stargate takes smaller margin than HyperPG

### 6.3 Revenue Distribution

For every $3.50 Small Tile rental:

```
$3.50 ───────────────────────────────────────────────────
  │                                                      │
  ├─ Box Owner (R2D2 in Texas) ─────────────── $2.00 (57%)
  │   • Pays electricity (~$0.50/day)                    │
  │   • Net profit: ~$1.50/day                            │
  │                                                      │
  ├─ Stargate Pool Operator ─────────────────── $1.00 (29%)
  │   • Relay servers, bandwidth, SPO infra               │
  │   • Net profit: ~$0.70/day (after relay costs)        │
  │                                                      │
  └─ HPEC DAO Affiliate (Mauricio) ──────────── $0.50 (14%)
      • Referral commission                                │
      • Net: $0.50/day (no costs)                          │
```

**Smart Contract Split:** On-chain via Solidity contract on Base:
```solidity
contract StargatePoolRevenue {
    // On rental payment:
    // 1. 57% → box owner wallet
    // 2. 29% → Stargate treasury
    // 3. 14% → referrer (if any)
    // All automatic, no manual intervention
}
```

### 6.4 Tilling Service User Flow

```
1. Renter opens Mosaic → Stargate Pool → "Rent Compute"
2. Browses available "tiles" (filtered by region, GPU, price)
3. Selects "Small Tile — EU-West — $3.50/day"
4. Chooses duration: 1 day, 3 days, 7 days (discount for longer)
5. Pays via MetaMask (USDC on Base) or Tokeo (ADA on Cardano)
6. SPO provisions tenant on C-3PO (Germany)
7. Renter gets:
   • URL: https://c3po-abc123.stargate.pool
   • SSH key (download)
   • Jupyter notebook URL
   • Hermes agent pre-installed
8. Renter uses compute for AI training, agent hosting, etc.
9. At end of rental:
   • Tenant container stopped
   • Data archived (optional, $0.10/GB/month)
   • Revenue distributed on-chain
```

---

## 7. Provisioning Flow: Step-by-Step

### 7.1 Sequence Diagram

```
Renter          Mosaic App         SPO           Relay        Box (HBA)
  │                │                │              │              │
  │─Browse tiles──▶│                │              │              │
  │                │─listBoxes()───▶│              │              │
  │                │◄───────────────│              │              │
  │◄─Show tiles────│                │              │              │
  │                │                │              │              │
  │─Select + Pay──▶│                │              │              │
  │                │─allocate()────▶│              │              │
  │                │                │              │              │
  │                │                │─matchMaker() │              │
  │                │                │ (C-3PO best)  │              │
  │                │                │              │              │
  │                │                │─provision()──▶│             │
  │                │                │              │─WG create───▶│
  │                │                │              │  tenant IP  │
  │                │                │              │◄────────────│
  │                │                │              │              │
  │                │                │              │─docker run──▶│
  │                │                │              │  (tenant)   │
  │                │                │              │◄────────────│
  │                │                │◄─────────────│             │
  │                │◄───────────────│              │              │
  │◄─Credentials───│                │              │              │
  │                │                │              │              │
  │─SSH / HTTPS───▶│                │              │              │
  │                │─proxy request─▶│              │              │
  │                │                │─route via WG─▶│            │
  │                │                │              │─forward────▶│
  │                │                │              │  :8100     │
  │                │                │              │◄────────────│
  │                │                │◄─────────────│             │
  │◄─Response──────│                │              │              │
```

### 7.2 Implementation Details

**Step 1: Discovery**
```typescript
// SPO polls all boxes every 30s
const boxes = await spo.listBoxes({
  region: 'eu-west',
  gpuRequired: true,
  status: 'online',
  availableCapacity: { cpu: 4, ramGB: 16, gpu: 1 }
});
// Returns: [C-3PO (Germany), R2D2 (Texas-but-EU-capable?), ...]
```

**Step 2: Matchmaking**
```typescript
// Geographic + capacity matching
function matchBox(request: ComputeRequest, boxes: PoolBox[]): PoolBox {
  const scored = boxes.map(box => ({
    box,
    score: (
      geoScore(box.region, request.preferredRegion) * 0.4 +
      capacityScore(box, request.specs) * 0.3 +
      priceScore(box.pricePerHour) * 0.2 +
      reliabilityScore(box.uptimePercent) * 0.1
    )
  }));
  return scored.sort((a, b) => b.score - a.score)[0].box;
}
```

**Step 3: Provisioning**
```typescript
// SPO sends provision command to HBA via relay
await relay.sendCommand(boxId, {
  type: 'PROVISION_TENANT',
  tenantId: generateUUID(),
  config: {
    cpu: 4,
    ramGB: 16,
    gpu: 'rtx3090',
    durationHours: 24,
    sshPublicKey: renterPublicKey,
    image: 'stargate/tenant-base:latest'
  }
});

// HBA on box executes:
// 1. docker run with resource limits
// 2. Configure SSH with renter's public key
// 3. Start AIM container inside tenant
// 4. Report back: container ID, internal port, status
```

**Step 4: Routing**
```typescript
// Relay configures reverse proxy
await relay.configureRoute({
  subdomain: `c3po-${tenantId.slice(0, 8)}.stargate.pool`,
  target: `10.200.0.11:${tenantPort}`,  // WireGuard IP
  tls: true,
  rateLimit: '100r/m'
});

// Renter gets:
// • https://c3po-abc123.stargate.pool (Web UI)
// • ssh -i key.pem tenant@10.200.0.11 -p 8101 (SSH)
```

---

## 8. Security Architecture

### 8.1 Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| Tenant escapes Docker | 🔴 Critical | Rootless containers, seccomp, AppArmor, no `--privileged` |
| Tenant accesses other tenants | 🔴 Critical | Bridge network per tenant, iptables rules |
| Tenant accesses host (box owner) | 🔴 Critical | Docker user namespaces, cgroup limits, no host mounts |
| Box owner spies on tenant data | 🟡 High | Encrypted volumes (LUKS), tenant owns keys |
| Relay compromised | 🟡 High | TLS everywhere, short-lived certs, mTLS between relay-SPO |
| DDoS on relay | 🟡 Medium | Cloudflare/Rate limiting, per-tenant bandwidth caps |
| Payment fraud | 🟡 Medium | On-chain payments only, no chargebacks |
| Box owner disappears | 🟢 Low | SLA guarantees, backup boxes, data snapshots |

### 8.2 Docker Security Hardening

```dockerfile
# Dockerfile.tenant-base
FROM ubuntu:22.04

# Non-root user
RUN useradd -m -s /bin/bash tenant
USER tenant
WORKDIR /home/tenant

# Minimal base (no sudo, no root tools)
# Only: python, node, ollama, hermes-agent

# Read-only rootfs
# Runtime flag: --read-only
```

```bash
# Docker run with security flags
docker run \
  --name tenant-abc123 \
  --user 1000:1000 \
  --read-only \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --cap-add CHOWN,SETGID,SETUID \
  --memory 32g \
  --memory-swap 32g \
  --cpus 8.0 \
  --pids-limit 1000 \
  --network tenant-bridge-abc123 \
  stargate/tenant-base:latest
```

---

## 9. Scaling Considerations

### 9.1 Single Box Limits

| Resource | RK3588 Limit | Tenant Capacity |
|----------|-------------|-----------------|
| CPU | 8 cores | 2-4 tenants (2-4 cores each) |
| RAM | 32GB | 2 tenants (16GB each) or 4 (8GB each) |
| GPU | 1-2 cards | 1 tenant (dedicated) or 2-4 (shared via time-slicing) |
| Disk | 1TB NVMe | 500GB per tenant (2 tenants) |
| Network | 1Gbps | Shared, throttled per tenant |

### 9.2 Pool Growth

```
Phase 1 (Month 1-3):   10 boxes   → ~20 concurrent tenants
Phase 2 (Month 4-6):   50 boxes   → ~100 concurrent tenants
Phase 3 (Month 7-12):  200 boxes  → ~400 concurrent tenants
Phase 4 (Year 2):      1000 boxes → ~2000 concurrent tenants
```

### 9.3 Relay Scaling

| Region | Initial | Phase 2 | Phase 3 |
|--------|---------|---------|---------|
| US-East | 1 relay (t3.medium) | 2 relays (load balanced) | 3 relays + CDN |
| EU-West | 1 relay (t3.medium) | 2 relays | 3 relays + CDN |
| Asia-Pacific | 1 relay (t3.medium) | 2 relays | 3 relays + CDN |

**Cost:** ~$30/month per relay (AWS t3.medium) = $90/month initial, $270/month at Phase 3.

---

## 10. Comparison: Stargate Pool vs HyperPG

| Feature | HyperPG | **Stargate Pool** | Advantage |
|---------|---------|-------------------|-------------|
| **Price** | $5/tile/day | **$3.50/tile/day** | ✅ 30% cheaper |
| **Infrastructure** | Centralized data centers | Distributed HyperAIBoxes | ✅ Lower cost, edge compute |
| **Geographic reach** | Limited regions | Anywhere there's a box | ✅ True edge compute |
| **GPU availability** | Scheduled batches | On-demand | ✅ Instant provisioning |
| **Ownership** | HyperPG owns hardware | Community owns hardware | ✅ Decentralized, resilient |
| **Payment** | Fiat + Crypto | Crypto + Fiat | ✅ Same |
| **Tenant isolation** | VMs | Docker containers | Comparable |
| **Latency** | ~20-50ms | ~5-20ms (nearest box) | ✅ Better for edge AI |
| **Setup complexity** | Low | Medium (box owner setup) | Trade-off |
| **Reliability** | High (SLA) | Medium (home internet) | ⚠️ Lower but cheaper |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Month 1-2)
**Goal:** 3-box test cluster with manual provisioning

| Task | Effort | Owner |
|------|--------|-------|
| Deploy WireGuard relay (US-East) | 1d | DevOps |
| Build HyperAIBox Agent (HBA) Docker image | 3d | Backend |
| Build SPO (orchestrator) core | 5d | Backend |
| Tenant provisioning (Docker automation) | 3d | Backend |
| Health monitoring (`/api/info` polling) | 2d | Backend |
| Mosaic UI: Pool browser + rental flow | 5d | Frontend |
| Manual end-to-end test (R2D2 → Renter) | 2d | QA |

**Deliverable:** Mauricio can rent his own R2D2 via Mosaic. 1-box "cloud".

### Phase 2: Multi-Region (Month 3-4)
**Goal:** 10 boxes across 3 regions with auto-provisioning

| Task | Effort | Owner |
|------|--------|-------|
| Deploy EU + Asia relays | 2d | DevOps |
| Automatic matchmaking (geo + capacity) | 3d | Backend |
| Revenue smart contract (Base) | 4d | Blockchain |
| Payment integration (USDC + ADA) | 3d | Backend |
| Box owner dashboard (earnings, settings) | 3d | Frontend |
| Onboarding wizard ("Add your box to the pool") | 2d | Frontend |

**Deliverable:** 10-box pool, renters can browse and book, revenue auto-split.

### Phase 3: Tilling Service Launch (Month 5-6)
**Goal:** Public beta, price undercuts HyperPG

| Task | Effort | Owner |
|------|--------|-------|
| "Tilling" branding and pricing page | 2d | Frontend |
| Tiered pricing (Micro/Small/Standard/Large) | 1d | Backend |
| GPU sharing (multiple tenants per GPU via time-slicing) | 4d | Backend |
| Marketing: "Cheaper than HyperPG" | — | Community |
| SLA guarantees (minimum uptime, credit refunds) | 3d | Backend |
| Data snapshot / migration between boxes | 3d | Backend |

**Deliverable:** Public Stargate Pool Tilling Service. $3.50/tile vs HyperPG $5.

### Phase 4: Scale (Month 7-12)
**Goal:** 100+ boxes, competitive with centralized clouds

| Task | Effort | Owner |
|------|--------|-------|
| Auto-scaling (spin up tenants across multiple boxes) | 5d | Backend |
| Kubernetes on HyperAIBox (k3s) | 5d | Backend |
| Spot pricing (discount for interruptible compute) | 3d | Backend |
| Mobile app for box owners (monitor earnings) | 5d | Mobile |
| Enterprise sales ("Private Stargate Pool") | — | Business |

---

## 12. Files to Create

```
src/services/stargate/pool/
├── StargatePoolOrchestrator.ts          # Main orchestrator service
├── PoolRegistry.ts                      # Box registry + discovery
├── Matchmaker.ts                        # Allocate best box for request
├── Provisioner.ts                       # Docker tenant provisioning
├── RevenueRouter.ts                     # Payment + revenue split
├── types.ts                             # Pool types
└── adapters/
    ├── WireGuardRelayAdapter.ts         # WireGuard tunnel management
    ├── DockerProvisioner.ts             # Docker-based tenant isolation
    └── TailscaleRelayAdapter.ts         # Alternative: Tailscale

src/components/stargate/pool/
├── StargatePoolBrowser.tsx              # Browse available tiles
├── TileCard.tsx                         # Single tile offering card
├── PoolBookingFlow.tsx                  # Rent tile wizard
├── PoolDashboard.tsx                    # Active rentals + usage
├── BoxOwnerDashboard.tsx                # Earnings, settings for box owners
├── AddBoxToPoolWizard.tsx               # Onboarding: add HyperAIBox
└── PoolTopologyMap.tsx                  # Visual map of global boxes

electron/integrations/pool/
├── HyperAIBoxAgent.ts                  # Agent service running on box
├── WireGuardClient.ts                  # WG client config + connection
├── TenantManager.ts                    # Docker tenant lifecycle
└── TelemetryReporter.ts                # Box health + capacity reports

infra/
├── relay/
│   ├── docker-compose.yml              # Relay server setup
│   ├── nginx.conf                      # Reverse proxy config
│   └── wg0.conf.template             # WireGuard server template
└── hba/
    ├── Dockerfile                      # HyperAIBox Agent image
    └── docker-compose.yml              # HBA + WG client setup
```

---

## 13. Open Questions

1. **Box owner incentive:** Is $2/day enough to motivate people to keep boxes online? (Electricity cost ~$0.50-1.50/day)
2. **Legal:** Are there liability issues if a tenant uses compute for illegal activities? (Terms of service needed)
3. **Insurance:** What happens if a box dies with tenant data? (Backup strategy needed)
4. **GPU sharing:** Can we safely time-slice GPUs between tenants? (NVIDIA MIG requires A100/H100, not RTX)
5. **Stargate Relay cost:** Who pays for relay servers initially? (HPEC DAO treasury? Stargate operator?)
6. **On-chain revenue split:** Do we use a smart contract or manual distribution? (Smart contract = trustless but gas costs)
7. **Box authentication:** How does SPO know a box is legitimate (not a fake box stealing compute fees)? (ANFE license verification)

---

## 14. Why This Beats HyperPG

| Factor | HyperPG | Stargate Pool |
|--------|---------|---------------|
| **Cost structure** | Data center rent + cooling + staff | Community-owned = near-zero CAPEX |
| **Price** | $5/tile (must cover costs + margin) | **$3.50/tile** (lower costs = lower price) |
| **Edge compute** | Centralized data centers | Boxes in homes = true edge (lower latency) |
| **Scaling** | Buy more servers | Community joins = organic growth |
| **Resilience** | Single point of failure | Distributed = no single point |
| **Privacy** | Tenant data on HyperPG servers | Tenant data on community box (owner can't read) |

**The Pitch:** "HyperPG charges $5 for a tile in their data center. We charge $3.50 for a tile in your neighbor's basement — closer to you, cheaper, and you can earn by adding your own box."

---

*End of Stargate Pool Cloud Architecture*
