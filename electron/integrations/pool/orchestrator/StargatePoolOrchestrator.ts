// =============================================================================
// STARGATE POOL ORCHESTRATOR — Service (Main Process / Node)
// =============================================================================
// Manages the global HyperAIBox pool: registration, heartbeats, matchmaking,
// provisioning, and revenue tracking.
//
// This runs in the Electron main process and exposes IPC handlers for the
// renderer (Mosaic UI) to browse, book, and manage pool compute.
//
// Architecture:
//   1. Pool Registry — tracks registered boxes (heartbeat-based)
//   2. Matchmaker — finds best box for a compute request
//   3. Provisioner — sends provision command to box via HBA API
//   4. Revenue Tracker — records bookings, tracks commissions
// =============================================================================

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface PoolBoxRegistration {
  boxId: string;
  boxName: string;
  poolId: string;
  region: string;
  ownerWallet: string;
  commissionPercent: number;     // 0.57 = 57% to owner
  maxConcurrentTenants: number;
  publicAccess: boolean;
  nftGated: boolean;
  allowedCollections: string[];
  hbaApiHost: string;            // WireGuard IP or Tailscale IP
  hbaApiPort: number;            // Usually 8100
  localIp: string;                // Local IP for HBA API calls (Tailscale/LAN)
}

export interface PoolBoxTelemetry {
  boxId: string;
  boxName: string;
  localIp: string;               // IP for HBA API (Tailscale/LAN)
  timestamp: number;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  
  // Node Manager data
  nodeManager: {
    status: string;
    name: string;
    address: string;
    nodeVersion: string;
    nodeId: string;
    platform: string;
    geoIp: string;
    uptimePercent: number;
    heartbeats: number;
    license: string;
    acceptingCurrencies: string[];
  };
  
  // System data
  system: {
    cpuCores: number;
    cpuModel?: string;
    memoryTotalGb: number;
    memoryAvailableGb: number;
    diskTotalGb: number;
    diskFreeGb: number;
    uptimeHours: number;
    load1m: number;
  };
  
  // Docker data
  docker: {
    runningContainers: number;
    totalContainers: number;
  };
  
  // Current tenants on box
  tenantCount: number;
}

export interface ComputeRequest {
  requestId: string;
  userWallet: string;
  region?: string;                 // Preferred region
  specs: {
    cpu: number;                   // Required CPU cores
    memoryGb: number;              // Required RAM
    gpu?: string;                  // GPU model (optional)
    storageGb?: number;            // Storage (optional)
  };
  durationHours: number;
  maxPricePerHour?: number;        // Budget constraint
}

export interface ComputeAllocation {
  allocationId: string;
  boxId: string;
  boxName: string;
  tenantId: string;
  status: 'provisioning' | 'active' | 'failed' | 'expired' | 'expiring';
  
  // Pricing
  pricePerHour: number;
  totalCost: number;
  commissionAmount: number;        // Stargate's cut
  ownerRevenue: number;            // Box owner's cut
  
  // Access
  accessUrl?: string;              // e.g., https://r2d2-abc.stargate.pool
  sshKey?: string;                 // Private key for tenant
  sshHost?: string;                // WireGuard IP
  sshPort?: number;
  
  // Timestamps
  createdAt: number;
  activatedAt?: number;
  expiresAt: number;
}

export interface PoolBooking {
  bookingId: string;
  userWallet: string;
  boxId: string;
  tenantId: string;
  status: PoolBookingStatus;
  pricePerHour: number;
  durationHours: number;
  totalCost: number;
  commissionAmount: number;
  ownerRevenue: number;
  paymentTxHash?: string;
  createdAt: number;
  expiresAt: number;
}

export type PoolBookingStatus = 
  | 'pending_payment' 
  | 'payment_confirmed' 
  | 'provisioning' 
  | 'active' 
  | 'expiring' 
  | 'expired' 
  | 'cancelled';

export interface PoolFilters {
  region?: string;
  gpu?: boolean;
  minCpu?: number;
  minMemoryGb?: number;
  maxPricePerHour?: number;
  status?: 'online' | 'all';
}

// ============================================================================
// STARGATE POOL ORCHESTRATOR
// ============================================================================

export class StargatePoolOrchestrator extends EventEmitter {
  private boxes: Map<string, PoolBoxTelemetry> = new Map();
  private registrations: Map<string, PoolBoxRegistration> = new Map();
  private bookings: Map<string, PoolBooking> = new Map();
  private allocations: Map<string, ComputeAllocation> = new Map();
  
  private heartbeatTimeoutMs = 120_000;  // 2 minutes without heartbeat = offline
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.startCleanupLoop();
  }
  
  // ── Registry ────────────────────────────────────────────────────────────
  
  /**
   * Register a new HyperAIBox into the pool.
   * Called when a box owner clicks "Add to Pool" in Mosaic UI,
   * or when HBA first connects.
   */
  registerBox(registration: PoolBoxRegistration): { success: boolean; error?: string } {
    if (!registration.boxId) {
      return { success: false, error: 'box_id is required' };
    }
    if (!registration.hbaApiHost) {
      return { success: false, error: 'hba_api_host is required' };
    }
    
    this.registrations.set(registration.boxId, registration);
    
    // Initialize telemetry with offline status until first heartbeat
    this.boxes.set(registration.boxId, {
      boxId: registration.boxId,
      boxName: registration.boxName,
      localIp: registration.localIp || registration.hbaApiHost || '',
      timestamp: Date.now(),
      status: 'offline',
      nodeManager: {} as any,
      system: {} as any,
      docker: {} as any,
      tenantCount: 0,
    });
    
    this.emit('box:registered', registration);
    console.log(`[SPO] Box registered: ${registration.boxName} (${registration.boxId})`);
    return { success: true };
  }
  
  /**
   * Remove a box from the pool.
   */
  unregisterBox(boxId: string): boolean {
    const had = this.registrations.has(boxId);
    this.registrations.delete(boxId);
    this.boxes.delete(boxId);
    if (had) {
      this.emit('box:unregistered', boxId);
      console.log(`[SPO] Box unregistered: ${boxId}`);
    }
    return had;
  }
  
  /**
   * Receive heartbeat from HBA.
   */
  handleHeartbeat(telemetry: PoolBoxTelemetry): void {
    const boxId = telemetry.boxId;
    if (!this.registrations.has(boxId)) {
      console.warn(`[SPO] Heartbeat from unknown box: ${boxId}`);
      return;
    }
    
    // Determine status based on telemetry
    let status: PoolBoxTelemetry['status'] = 'online';
    if (telemetry.nodeManager?.status !== 'alive') {
      status = 'offline';
    } else if (telemetry.tenantCount >= (this.registrations.get(boxId)?.maxConcurrentTenants || 2)) {
      status = 'busy';
    }
    
    const updated = { ...telemetry, status, timestamp: Date.now() };
    this.boxes.set(boxId, updated);
    this.emit('box:heartbeat', updated);
  }
  
  /**
   * Get a single box's current telemetry.
   */
  getBox(boxId: string): PoolBoxTelemetry | null {
    return this.boxes.get(boxId) || null;
  }
  
  /**
   * List all boxes matching filters.
   */
  listBoxes(filters?: PoolFilters): PoolBoxTelemetry[] {
    let results = Array.from(this.boxes.values());
    
    if (filters?.region) {
      results = results.filter(b => b.nodeManager?.geoIp?.includes(filters.region!) || 
                                     this.registrations.get(b.boxId)?.region === filters.region);
    }
    if (filters?.gpu) {
      // Filter boxes with GPU info in NM data
      results = results.filter(b => {
        const nm = b.nodeManager as any;
        return nm?.hardware?.gpu !== null && nm?.hardware?.gpu !== undefined;
      });
    }
    if (filters?.minCpu) {
      results = results.filter(b => (b.system?.cpuCores || 0) >= filters.minCpu!);
    }
    if (filters?.minMemoryGb) {
      results = results.filter(b => (b.system?.memoryTotalGb || 0) >= filters.minMemoryGb!);
    }
    if (filters?.maxPricePerHour) {
      // Price not in telemetry yet — skip or infer
    }
    if (filters?.status && filters.status !== 'all') {
      results = results.filter(b => b.status === filters.status);
    }
    
    return results;
  }
  
  /**
   * Get online boxes available for rental.
   */
  getAvailableBoxes(): PoolBoxTelemetry[] {
    return this.listBoxes({ status: 'online' }).filter(
      b => b.status === 'online' && b.tenantCount < (this.registrations.get(b.boxId)?.maxConcurrentTenants || 2)
    );
  }

  /**
   * Update tenant count for a box (increment or decrement).
   * Called by TillingProvisioner when sessions start/stop.
   */
  updateBoxTenant(boxId: string, delta: number): { success: boolean; tenantCount: number } {
    const box = this.boxes.get(boxId);
    if (!box) {
      return { success: false, tenantCount: 0 };
    }
    box.tenantCount = Math.max(0, box.tenantCount + delta);
    this.boxes.set(boxId, box);
    this.emit('box:tenant_changed', { boxId, tenantCount: box.tenantCount });
    return { success: true, tenantCount: box.tenantCount };
  }
  
  // ── Matchmaker ────────────────────────────────────────────────────────────
  
  /**
   * Find the best box for a compute request.
   * Scores by: geo proximity, capacity, reliability, price.
   */
  findBestBox(request: ComputeRequest): { box: PoolBoxTelemetry | null; score: number } {
    const available = this.getAvailableBoxes();
    if (available.length === 0) {
      return { box: null, score: 0 };
    }
    
    const scored = available.map(box => {
      let score = 0;
      
      // 1. Geographic proximity (40%)
      const reg = this.registrations.get(box.boxId);
      if (request.region && reg?.region === request.region) {
        score += 0.40;
      } else if (request.region && reg?.region) {
        // Same continent rough check
        const continentMap: Record<string, string[]> = {
          'us-east': ['us-east', 'us-west', 'us-central'],
          'us-west': ['us-east', 'us-west', 'us-central'],
          'eu-west': ['eu-west', 'eu-central', 'eu-east'],
          'eu-central': ['eu-west', 'eu-central', 'eu-east'],
          'asia': ['asia-east', 'asia-south', 'asia-southeast'],
        };
        const reqCont = Object.entries(continentMap).find(([_, v]) => v.includes(request.region!));
        const boxCont = Object.entries(continentMap).find(([_, v]) => v.includes(reg.region));
        if (reqCont && boxCont && reqCont[0] === boxCont[0]) {
          score += 0.25;
        }
      }
      
      // 2. Capacity match (30%)
      const sys = box.system || {} as any;
      const cpuOk = (sys.cpuCores || 0) >= request.specs.cpu;
      const memOk = (sys.memoryAvailableGb || 0) >= request.specs.memoryGb;
      if (cpuOk && memOk) score += 0.30;
      else if (cpuOk || memOk) score += 0.15;
      
      // 3. GPU match (15%)
      if (request.specs.gpu) {
        const nm = box.nodeManager as any;
        if (nm?.hardware?.gpu) {
          score += 0.15;
        }
      } else {
        score += 0.15; // No GPU required = full score
      }
      
      // 4. Reliability (10%)
      const uptime = box.nodeManager?.uptimePercent || 0;
      score += uptime * 0.10;
      
      // 5. Price competitiveness (5%)
      // Lower price = higher score (not implemented yet)
      score += 0.05;
      
      return { box, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0] || { box: null, score: 0 };
  }
  
  // ── Provisioning ──────────────────────────────────────────────────────────
  
  /**
   * Allocate compute on a box.
   */
  async allocateCompute(request: ComputeRequest): Promise<ComputeAllocation> {
    const match = this.findBestBox(request);
    if (!match.box) {
      throw new Error('No available boxes matching requirements');
    }
    
    const box = match.box;
    const reg = this.registrations.get(box.boxId)!;
    const allocationId = `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Calculate pricing
    const pricePerHour = this._calculatePrice(box, request.specs);
    const totalCost = pricePerHour * request.durationHours;
    const commissionPercent = 0.29;  // Stargate takes 29%
    const commissionAmount = totalCost * commissionPercent;
    const ownerRevenue = totalCost - commissionAmount;
    
    const allocation: ComputeAllocation = {
      allocationId,
      boxId: box.boxId,
      boxName: box.boxName,
      tenantId,
      status: 'provisioning',
      pricePerHour,
      totalCost,
      commissionAmount,
      ownerRevenue,
      createdAt: Date.now(),
      expiresAt: Date.now() + (request.durationHours * 60 * 60 * 1000),
    };
    
    this.allocations.set(allocationId, allocation);
    
    // Send provision command to HBA on box
    try {
      await this._sendProvisionCommand(reg, tenantId, request);
      allocation.status = 'active';
      allocation.activatedAt = Date.now();
      
      // TODO: Generate SSH keypair, configure WireGuard route, etc.
      // For now, placeholder
      allocation.sshHost = reg.hbaApiHost;
      allocation.sshPort = 2222; // Tenant SSH port on box
      
    } catch (error) {
      allocation.status = 'failed';
      console.error(`[SPO] Provisioning failed for ${allocationId}:`, error);
    }
    
    this.allocations.set(allocationId, allocation);
    this.emit('allocation:created', allocation);
    return allocation;
  }
  
  /**
   * Send provision command to HBA on a box.
   */
  private async _sendProvisionCommand(
    reg: PoolBoxRegistration, 
    tenantId: string, 
    request: ComputeRequest
  ): Promise<void> {
    const url = `http://${reg.hbaApiHost}:${reg.hbaApiPort}/provision`;
    
    const payload = {
      tenant_id: tenantId,
      config: {
        cpu: request.specs.cpu,
        memory_gb: request.specs.memoryGb,
        gpu: request.specs.gpu,
        image: 'ubuntu:22.04',
        // SSH key would be generated and sent here
      },
    };
    
    // Use Electron's net or node-fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HBA provision failed: ${response.status} ${await response.text()}`);
    }
  }
  
  /**
   * Release an allocation (stop tenant).
   */
  async releaseAllocation(allocationId: string): Promise<void> {
    const alloc = this.allocations.get(allocationId);
    if (!alloc) return;
    
    const reg = this.registrations.get(alloc.boxId);
    if (reg) {
      const url = `http://${reg.hbaApiHost}:${reg.hbaApiPort}/destroy`;
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: alloc.tenantId }),
        });
      } catch (e) {
        console.error(`[SPO] Failed to send destroy command:`, e);
      }
    }
    
    alloc.status = 'expired';
    this.allocations.set(allocationId, alloc);
    this.emit('allocation:released', alloc);
  }
  
  // ── Pricing ───────────────────────────────────────────────────────────────
  
  /**
   * Calculate price per hour based on box specs and demand.
   * This is the STARGATE POOL pricing (not ComputePortal).
   */
  private _calculatePrice(box: PoolBoxTelemetry, specs: ComputeRequest['specs']): number {
    const basePrice = 0.50;  // Base per CPU core per hour
    const memoryPrice = 0.10; // Per GB RAM per hour
    const gpuPrice = 1.00;     // Per GPU per hour
    
    let price = 0;
    price += (specs.cpu || 2) * basePrice;
    price += (specs.memoryGb || 8) * memoryPrice;
    if (specs.gpu) {
      price += gpuPrice;
    }
    
    // Region adjustment (cheaper in some regions)
    const region = this.registrations.get(box.boxId)?.region;
    if (region?.includes('us')) price *= 1.0;
    else if (region?.includes('eu')) price *= 1.1;
    else if (region?.includes('asia')) price *= 0.9;
    
    // Round to nearest cent
    return Math.round(price * 100) / 100;
  }
  
  // ── Bookings ──────────────────────────────────────────────────────────────
  
  createBooking(allocation: ComputeAllocation, userWallet: string): PoolBooking {
    const booking: PoolBooking = {
      bookingId: `book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userWallet,
      boxId: allocation.boxId,
      tenantId: allocation.tenantId,
      status: 'pending_payment',
      pricePerHour: allocation.pricePerHour,
      durationHours: Math.round((allocation.expiresAt - allocation.createdAt) / (1000 * 60 * 60)),
      totalCost: allocation.totalCost,
      commissionAmount: allocation.commissionAmount,
      ownerRevenue: allocation.ownerRevenue,
      createdAt: Date.now(),
      expiresAt: allocation.expiresAt,
    };
    
    this.bookings.set(booking.bookingId, booking);
    this.emit('booking:created', booking);
    return booking;
  }
  
  confirmPayment(bookingId: string, txHash: string): PoolBooking | null {
    const booking = this.bookings.get(bookingId);
    if (!booking) return null;
    
    booking.status = 'payment_confirmed';
    booking.paymentTxHash = txHash;
    this.bookings.set(bookingId, booking);
    this.emit('booking:paid', booking);
    return booking;
  }
  
  getBookings(userWallet?: string): PoolBooking[] {
    const all = Array.from(this.bookings.values());
    if (userWallet) {
      return all.filter(b => b.userWallet === userWallet);
    }
    return all;
  }
  
  // ── Cleanup ───────────────────────────────────────────────────────────────
  
  private startCleanupLoop(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Mark stale boxes offline
      for (const [boxId, box] of this.boxes) {
        if (now - box.timestamp > this.heartbeatTimeoutMs) {
          if (box.status !== 'offline') {
            console.log(`[SPO] Box ${boxId} timed out, marking offline`);
            this.boxes.set(boxId, { ...box, status: 'offline' });
            this.emit('box:offline', boxId);
          }
        }
      }
      
      // Expire old allocations
      for (const [allocId, alloc] of this.allocations) {
        if (alloc.status === 'active' && now > alloc.expiresAt) {
          alloc.status = 'expiring';
          this.allocations.set(allocId, alloc);
          this.emit('allocation:expiring', alloc);
          
          // Auto-release after grace period
          setTimeout(() => {
            this.releaseAllocation(allocId);
          }, 5 * 60 * 1000); // 5 min grace
        }
      }
      
      // Clean up old bookings (keep 30 days)
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      for (const [bookId, book] of this.bookings) {
        if (book.createdAt < thirtyDaysAgo && ['expired', 'cancelled'].includes(book.status)) {
          this.bookings.delete(bookId);
        }
      }
      
    }, 60_000); // Run every minute
  }
  
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const stargatePoolOrchestrator = new StargatePoolOrchestrator();
export default stargatePoolOrchestrator;
