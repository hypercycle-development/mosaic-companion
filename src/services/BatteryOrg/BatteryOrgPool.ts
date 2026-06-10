/** ============================================================
 * Battery Org Pool Service
 * 
 * Node discovery + health polling + load balancer
 * Integrates Battery Boxes into Stargate Compute & Nodes panel
 * ============================================================ */

import { 
  batteryOrgAdapter, 
  BatteryBox, 
  BatteryHealthStatus,
  BatteryJobRequest,
  BatteryJobResponse 
} from './BatteryOrgAdapter';

export interface BatteryPoolNode extends BatteryBox {
  _source: 'batteryorg';
  health?: BatteryHealthStatus;
  lastPolledAt: string;
  estimatedLatency?: number; // ms
}

export interface BatteryBoxSelection {
  boxId: string;
  reason: 'best_price' | 'lowest_latency' | 'highest_compute' | 'green_energy';
  score: number;
}

class BatteryOrgPoolService {
  private nodes: Map<string, BatteryPoolNode> = new Map();
  private initialized = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastPollResult: { success: boolean; error?: string } | null = null;

  // Polling configuration
  private readonly POLL_INTERVAL_MS = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL_MS = 60000; // 60 seconds

  /**
   * Initialize the Battery Org pool
   * Loads boxes and starts polling
   */
  async init(): Promise<{ success: boolean; count: number; error?: string }> {
    if (this.initialized) {
      return { success: true, count: this.nodes.size };
    }

    // Initialize adapter (load API key from secure storage)
    const adapterReady = await batteryOrgAdapter.initialize();
    console.log(`[BatteryOrgPool] Adapter initialized: ${adapterReady ? 'with API key' : 'mock mode (no API key)'}`);

    // Load initial boxes
    const loadResult = await this.refreshBoxes();
    
    if (loadResult.count > 0) {
      this.initialized = true;
      this.startPolling();
    }

    return loadResult;
  }

  /**
   * Refresh available boxes from Battery Org API
   */
  async refreshBoxes(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      const boxes = await batteryOrgAdapter.getAvailableBoxes();
      
      const now = new Date().toISOString();
      const newNodes = new Map<string, BatteryPoolNode>();

      for (const box of boxes) {
        // Preserve existing health data if available
        const existing = this.nodes.get(box.id);
        
        const poolNode: BatteryPoolNode = {
          ...box,
          _source: 'batteryorg',
          lastPolledAt: now,
          health: existing?.health,
          estimatedLatency: existing?.estimatedLatency,
        };

        newNodes.set(box.id, poolNode);
      }

      this.nodes = newNodes;
      this.lastPollResult = { success: true };
      
      console.log(`[BatteryOrgPool] Loaded ${boxes.length} Battery Boxes`);
      return { success: true, count: boxes.length };
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to refresh Battery Boxes';
      this.lastPollResult = { success: false, error: errorMsg };
      console.error('[BatteryOrgPool]', errorMsg);
      return { success: false, count: 0, error: errorMsg };
    }
  }

  /**
   * Start background polling for node updates
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Poll for box availability updates
    this.pollingInterval = setInterval(async () => {
      await this.refreshBoxes();
    }, this.POLL_INTERVAL_MS);

    // Health checks on live nodes
    setInterval(async () => {
      await this.runHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL_MS);

    console.log(`[BatteryOrgPool] Started polling every ${this.POLL_INTERVAL_MS}ms`);
  }

  /**
   * Run health checks on available nodes
   */
  private async runHealthChecks(): Promise<void> {
    const onlineNodes = this.getOnlineNodes();
    
    for (const node of onlineNodes.slice(0, 5)) { // Limit concurrent checks
      try {
        const health = await batteryOrgAdapter.checkBoxHealth(node.id);
        if (health) {
          const updated = this.nodes.get(node.id);
          if (updated) {
            updated.health = health;
            updated.lastPolledAt = new Date().toISOString();
            this.nodes.set(node.id, updated);
          }
        }
      } catch (e) {
        // Health check failed - node may be offline
        console.warn(`[BatteryOrgPool] Health check failed for ${node.id}`);
      }
    }
  }

  /**
   * Get all Battery Boxes
   */
  getNodes(): BatteryPoolNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get online/available nodes only
   */
  getOnlineNodes(): BatteryPoolNode[] {
    return this.getNodes().filter(n => n.isAvailable && n.status === 'online');
  }

  /**
   * Get nodes by region
   */
  getNodesByRegion(region: string): BatteryPoolNode[] {
    return this.getOnlineNodes().filter(n => n.location.region === region);
  }

  /**
   * Get nodes by GPU model
   */
  getNodesByGpu(gpuModel: string): BatteryPoolNode[] {
    return this.getOnlineNodes().filter(n => n.gpuModel.includes(gpuModel));
  }

  /**
   * Select best box based on criteria
   * Implements load balancing logic
   */
  selectBestBox(criteria: {
    minTflops?: number;
    minVramGb?: number;
    region?: string;
    preferGreenEnergy?: boolean;
    maxPricePerHour?: number;
  } = {}): BatteryBoxSelection | null {
    let candidates = this.getOnlineNodes();

    // Apply filters
    if (criteria.minTflops) {
      candidates = candidates.filter(n => n.tflops >= criteria.minTflops!);
    }
    if (criteria.minVramGb) {
      candidates = candidates.filter(n => n.vramGb >= criteria.minVramGb!);
    }
    if (criteria.region) {
      candidates = candidates.filter(n => n.location.region === criteria.region);
    }
    if (criteria.maxPricePerHour) {
      candidates = candidates.filter(n => n.pricePerHourUsd <= criteria.maxPricePerHour!);
    }

    if (candidates.length === 0) {
      return null;
    }

    // Score and select best
    let bestBox: BatteryPoolNode | null = null;
    let bestScore = -1;
    let reason: BatteryBoxSelection['reason'] = 'best_price';

    for (const box of candidates) {
      let score = 0;

      // Price efficiency (lower is better, so invert)
      const priceScore = box.pricePerHourUsd > 0 ? 1 / box.pricePerHourUsd : 0;
      score += priceScore * 100;

      // Compute power
      score += box.tflops * 0.5;

      // Green energy bonus
      if (criteria.preferGreenEnergy && 
          (box.energySource === 'solar' || box.energySource === 'wind')) {
        score += 50;
      }

      // Health status bonus
      if (box.health) {
        const healthScore = (100 - box.health.gpuUtilization) * 0.3; // Prefer less utilized
        score += healthScore;
      }

      if (score > bestScore) {
        bestScore = score;
        bestBox = box;
      }
    }

    if (!bestBox) return null;

    // Determine selection reason
    if (criteria.preferGreenEnergy && 
        (bestBox.energySource === 'solar' || bestBox.energySource === 'wind')) {
      reason = 'green_energy';
    } else if (bestBox.tflops > 300) {
      reason = 'highest_compute';
    } else {
      reason = 'best_price';
    }

    return {
      boxId: bestBox.id,
      reason,
      score: Math.round(bestScore),
    };
  }

  /**
   * Submit an inference job to the best available Battery Box
   */
  async submitInferenceJob(request: BatteryJobRequest & { boxId?: string }): Promise<{
    success: boolean;
    jobId?: string;
    boxId?: string;
    error?: string;
  }> {
    // Select box if not specified
    let targetBoxId = request.boxId;
    if (!targetBoxId) {
      const selection = this.selectBestBox();
      if (!selection) {
        return { success: false, error: 'No available Battery Boxes' };
      }
      targetBoxId = selection.boxId;
    }

    // Remove boxId from request before sending
    const { boxId, ...jobRequest } = request as any;

    const result = await batteryOrgAdapter.submitJob(targetBoxId, jobRequest);
    
    if (!result) {
      return { success: false, error: 'Failed to submit job to Battery Box' };
    }

    return {
      success: true,
      jobId: result.jobId,
      boxId: targetBoxId,
    };
  }

  /**
   * Check job status
   */
  async getJobStatus(boxId: string, jobId: string): Promise<BatteryJobResponse | null> {
    return await batteryOrgAdapter.getJobStatus(boxId, jobId);
  }

  /**
   * Get pricing info
   */
  async getPricing(): Promise<{ pricePerHourUsd: number; currency: string } | null> {
    return await batteryOrgAdapter.getPricing();
  }

  /**
   * Stop polling and cleanup
   */
  dispose(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.initialized = false;
    this.nodes.clear();
    console.log('[BatteryOrgPool] Disposed');
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    nodeCount: number;
    onlineCount: number;
    lastPollResult: typeof this.lastPollResult;
    isConfigured: boolean;
  } {
    return {
      initialized: this.initialized,
      nodeCount: this.nodes.size,
      onlineCount: this.getOnlineNodes().length,
      lastPollResult: this.lastPollResult,
      isConfigured: batteryOrgAdapter.isConfigured(),
    };
  }
}

// Singleton instance
export const batteryOrgPool = new BatteryOrgPoolService();
export default batteryOrgPool;

// Export class for extension
export { BatteryOrgPoolService };
