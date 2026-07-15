// =============================================================================
// STARGATE TILLING PROVISIONER — SPO Extension (v1)
// Community service for non-custodial Node Factory tilling via Stargate Pool
// =============================================================================

import { StargatePoolOrchestrator } from "./StargatePoolOrchestrator";

export interface TillingProvisionRequest {
  licenseId: string;
  ownerWallet: string;
  network: "base" | "ethereum";
  delegationSignature?: string; // EIP-712 signed delegation
  durationDays: number; // 30 default
  pricingModel: "shared" | "spot" | "dedicated";
}

export interface TillingProvisionResult {
  tenantId: string;
  boxId: string;
  boxName: string;
  status: "provisioning" | "tilling" | "failed" | "stopped";
  nodeManagerUrl: string;
  earningsAddress: string;
  startTime: number;
  estimatedEndTime: number;
  monthlyCost: number;
  actualCost: number; // accrued so far
}

export interface TillingSession {
  tenantId: string;
  licenseId: string;
  ownerWallet: string;
  boxId: string;
  boxName: string;
  network: string;
  status: "active" | "paused" | "stopped" | "failed";
  startedAt: number;
  expiresAt: number;
  monthlyCost: number;
  earningsHyPC: number;
  uptimeSeconds: number;
  requestsServed: number;
  lastHeartbeat: number;
}

const PRICING = {
  shared: 3.0,     // $3.00/month — multi-tenant, shared box
  spot: 0.01,      // $0.01/hour — pay per active hour
  dedicated: 8.0,  // $8.00/month — full box dedicated
};

export class TillingProvisioner {
  private spo: StargatePoolOrchestrator;
  private sessions: Map<string, TillingSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(spo: StargatePoolOrchestrator) {
    this.spo = spo;
    this.startCleanupLoop();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Provision a Node Factory for tilling via Stargate Pool.
   * Non-custodial: user keeps keys, only delegates compute to pool.
   */
  async provisionTilling(req: TillingProvisionRequest): Promise<TillingProvisionResult> {
    console.log(`[TillingProvisioner] Provisioning tilling for license ${req.licenseId} on ${req.network}`);

    // 1. Check if already tilling
    const existing = this.findSessionByLicense(req.licenseId);
    if (existing && existing.status === "active") {
      throw new Error(`License ${req.licenseId} is already tilling in session ${existing.tenantId}`);
    }

    // 2. Matchmaker: find best box for tilling
    const box = await this.findBestBoxForTilling(req);
    if (!box) {
      throw new Error("No available boxes in Stargate Pool for tilling. Try again later or add your own box to the pool.");
    }

    // 3. Calculate cost
    const monthlyCost = PRICING[req.pricingModel];
    const totalCost = req.pricingModel === "spot"
      ? monthlyCost * 24 * req.durationDays // rough estimate
      : monthlyCost * (req.durationDays / 30);

    console.log(`[TillingProvisioner] Selected box ${box.boxName} (${box.boxId}) — $${monthlyCost}/mo`);

    // 4. Create tenant ID
    const tenantId = `till-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 5. Provision tilling container on box
    const provisionResult = await this.provisionTillingContainer({
      tenantId,
      boxId: box.boxId,
      boxName: box.boxName,
      licenseId: req.licenseId,
      ownerWallet: req.ownerWallet,
      network: req.network,
      delegationSignature: req.delegationSignature,
      nodeManagerImage: "hypercycle/node-manager:latest",
      aimImage: "mosaic-hermes-aim:1.0.4",
    });

    if (provisionResult.status === "failed") {
      throw new Error(`Provisioning failed: ${provisionResult.error}`);
    }

    // 6. Create session
    const session: TillingSession = {
      tenantId,
      licenseId: req.licenseId,
      ownerWallet: req.ownerWallet,
      boxId: box.boxId,
      boxName: box.boxName,
      network: req.network,
      status: "active",
      startedAt: Date.now(),
      expiresAt: Date.now() + req.durationDays * 86400000,
      monthlyCost,
      earningsHyPC: 0,
      uptimeSeconds: 0,
      requestsServed: 0,
      lastHeartbeat: Date.now(),
    };
    this.sessions.set(tenantId, session);

    // 7. Update box tenant count
    await this.spo.updateBoxTenant(box.boxId, 1);

    console.log(`[TillingProvisioner] ✅ Tilling session ${tenantId} active on ${box.boxName}`);

    return {
      tenantId,
      boxId: box.boxId,
      boxName: box.boxName,
      status: "tilling",
      nodeManagerUrl: `http://${box.localIp}:8000`,
      earningsAddress: req.ownerWallet,
      startTime: session.startedAt,
      estimatedEndTime: session.expiresAt,
      monthlyCost,
      actualCost: 0,
    };
  }

  /**
   * Stop tilling session — releases container, refunds unused time.
   */
  async stopTilling(tenantId: string): Promise<{ refunded: number; reason: string }> {
    const session = this.sessions.get(tenantId);
    if (!session) {
      throw new Error(`Tilling session ${tenantId} not found`);
    }

    console.log(`[TillingProvisioner] Stopping tilling session ${tenantId}`);

    // 1. Send destroy to HBA
    await this.destroyTillingContainer(session.boxId, tenantId);

    // 2. Calculate refund
    const elapsedMs = Date.now() - session.startedAt;
    const totalMs = session.expiresAt - session.startedAt;
    const unusedRatio = Math.max(0, 1 - elapsedMs / totalMs);
    const refunded = session.monthlyCost * (session.expiresAt - session.startedAt) / 86400000 / 30 * unusedRatio;

    // 3. Update session
    session.status = "stopped";
    this.sessions.set(tenantId, session);

    // 4. Update box tenant count
    await this.spo.updateBoxTenant(session.boxId, -1);

    console.log(`[TillingProvisioner] ✅ Session ${tenantId} stopped. Refunded $${refunded.toFixed(2)}`);

    return { refunded: Math.round(refunded * 100) / 100, reason: "User requested stop" };
  }

  /**
   * Get user's active tilling sessions.
   */
  getUserSessions(wallet: string): TillingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.ownerWallet.toLowerCase() === wallet.toLowerCase())
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Get all active tilling sessions (for dashboard).
   */
  getAllSessions(): TillingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === "active")
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Receive tilling heartbeat from HBA monitor agent.
   * Enhanced with actual tiller slot data from hyperbox-tiller API.
   */
  async receiveHeartbeat(tenantId: string, report: {
    nodeManagerAlive: boolean;
    aimAlive: boolean;
    tillerPort?: number;
    availableSlots?: number;
    activeTillersCount?: number;
    tillingActive?: boolean;
    activeTillers?: Array<{
      number: number;
      license: number;
      priority: number;
      address: string;
      timeLeft: number;
    }>;
    uptimeSeconds: number;
    requestsServed: number;
    estimatedEarningsHyPC: number;
  }): Promise<void> {
    const session = this.sessions.get(tenantId);
    if (!session) {
      console.warn(`[TillingProvisioner] Heartbeat for unknown session ${tenantId}`);
      return;
    }

    session.lastHeartbeat = Date.now();
    session.uptimeSeconds = report.uptimeSeconds;
    session.requestsServed = report.requestsServed;
    session.earningsHyPC = report.estimatedEarningsHyPC;

    // Store tiller-specific status in session metadata
    const tillingActuallyActive = report.tillingActive === true && (report.activeTillersCount || 0) > 0;
    
    if (!report.nodeManagerAlive) {
      session.status = "paused";
      console.warn(`[TillingProvisioner] Session ${tenantId} paused — Node Manager dead`);
    } else if (!report.aimAlive) {
      session.status = "paused";
      console.warn(`[TillingProvisioner] Session ${tenantId} paused — Tiller AIM not running`);
    } else if (report.tillingActive !== undefined && !tillingActuallyActive) {
      // Tiller AIM is running but no actual tilling slots are active
      session.status = "active"; // Session is healthy but not doing crypto work yet
      console.log(`[TillingProvisioner] Session ${tenantId} healthy — Tiller ready (${report.availableSlots || 0} slots available, ${report.activeTillersCount || 0} active)`);
    } else {
      session.status = "active";
      if (tillingActuallyActive) {
        console.log(`[TillingProvisioner] Session ${tenantId} TILLING — ${report.activeTillersCount} active tillers, port ${report.tillerPort}`);
      }
    }

    this.sessions.set(tenantId, session);
  }

  // ── Internal Methods ─────────────────────────────────────────────────────────

  private async findBestBoxForTilling(req: TillingProvisionRequest): Promise<{
    boxId: string;
    boxName: string;
    localIp: string;
    score: number;
  } | null> {
    // Get all online boxes from SPO
    const boxes = this.spo.listBoxes();
    const candidates = boxes.filter(b => b.status === "online" && b.tenantCount < 20);

    if (candidates.length === 0) return null;

    // Score: lower tenant count = higher score, higher uptime = higher score
    const scored = candidates.map(b => {
      const tenantScore = Math.max(0, 20 - b.tenantCount) / 20; // 1.0 = empty, 0.0 = full
      const uptimeScore = b.system.uptimeHours > 0 ? Math.min(b.system.uptimeHours / 100, 1) : 0.5;
      return {
        boxId: b.boxId,
        boxName: b.boxName,
        localIp: b.localIp,
        score: tenantScore * 0.6 + uptimeScore * 0.4,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  private async provisionTillingContainer(config: {
    tenantId: string;
    boxId: string;
    boxName: string;
    licenseId: string;
    ownerWallet: string;
    network: string;
    delegationSignature?: string;
    nodeManagerImage: string;
    aimImage: string;
  }): Promise<{ status: "ok" | "failed"; error?: string }> {
    // Forward to HBA on the selected box
    const box = this.spo.getBox(config.boxId);
    if (!box) {
      return { status: "failed", error: "Box not found in pool" };
    }

    // SPO runs on the host machine — monitor container needs host IP to reach it
    const spoHost = process.env.SPO_HOST || "192.168.0.112";
    const spoUrl = `http://${spoHost}:9100`;

    try {
      const res = await fetch(`http://${box.localIp}:8100/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: config.tenantId,
          tilling_mode: true,
          license_id: config.licenseId,
          owner_wallet: config.ownerWallet,
          network: config.network,
          spo_url: spoUrl,
          delegation_signature: config.delegationSignature,
          node_manager_image: config.nodeManagerImage,
          aim_image: config.aimImage,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { status: "failed", error: `HBA provision failed: ${err}` };
      }

      return { status: "ok" };
    } catch (e: any) {
      return { status: "failed", error: `HBA unreachable: ${e.message}` };
    }
  }

  private async destroyTillingContainer(boxId: string, tenantId: string): Promise<void> {
    const box = this.spo.getBox(boxId);
    if (!box) return;

    try {
      await fetch(`http://${box.localIp}:8100/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
    } catch (e) {
      console.warn(`[TillingProvisioner] Failed to destroy container on ${boxId}:`, e);
    }
  }

  private findSessionByLicense(licenseId: string): TillingSession | undefined {
    return Array.from(this.sessions.values()).find(s => s.licenseId === licenseId);
  }

  private startCleanupLoop(): void {
    // Every 60s: check for expired sessions, paused sessions
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [tenantId, session] of this.sessions.entries()) {
        // Mark expired
        if (session.status === "active" && now > session.expiresAt) {
          console.log(`[TillingProvisioner] Session ${tenantId} expired`);
          session.status = "stopped";
          this.sessions.set(tenantId, session);
          this.spo.updateBoxTenant(session.boxId, -1);
        }
        // Mark stale (no heartbeat for 5 min)
        if (session.status === "active" && now - session.lastHeartbeat > 300000) {
          console.log(`[TillingProvisioner] Session ${tenantId} stale — no heartbeat`);
          session.status = "paused";
          this.sessions.set(tenantId, session);
        }
      }
    }, 60000);
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton attached to SPO
let _tillingProvisioner: TillingProvisioner | null = null;

export function getTillingProvisioner(spo?: StargatePoolOrchestrator): TillingProvisioner {
  if (!_tillingProvisioner && spo) {
    _tillingProvisioner = new TillingProvisioner(spo);
  }
  if (!_tillingProvisioner) {
    throw new Error("TillingProvisioner not initialized — pass SPO instance first");
  }
  return _tillingProvisioner;
}
