/** ============================================================
 * Battery Org Adapter - API Client for Battery Box Compute
 * 
 * Integration target: Stargate Compute & Nodes panel
 * Provides: node discovery, health checks, job submission
 * ============================================================ */

export interface BatteryBox {
  id: string;
  name: string;
  location: {
    region: string;
    lat?: number;
    lon?: number;
  };
  energySource: 'solar' | 'wind' | 'grid' | 'hybrid';
  gpuCount: number;
  gpuModel: string;
  tflops: number;
  vramGb: number;
  isAvailable: boolean;
  pricePerHourUsd: number;
  supportedFrameworks: string[];
  status: 'online' | 'offline' | 'maintenance';
  lastHealthCheck: string;
}

export interface BatteryJobRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface BatteryJobResponse {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BatteryHealthStatus {
  boxId: string;
  status: 'ok' | 'degraded' | 'offline';
  gpuUtilization: number;
  memoryUtilization: number;
  activeJobs: number;
  queueDepth: number;
}

// Configuration from environment or settings
interface BatteryOrgConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

class BatteryOrgAdapter {
  private config: BatteryOrgConfig;
  private lastError: string | null = null;

  constructor() {
    // Default config - in production, load from secure storage
    this.config = {
      baseUrl: import.meta.env.VITE_BATTERY_ORG_URL || 'https://api.battery.org/v1',
      apiKey: '', // Loaded from secure storage
      timeoutMs: 30000,
    };
  }

  /**
   * Initialize with config from secure storage
   */
  async initialize(): Promise<boolean> {
    try {
      // Try to load API key from Electron secure storage
      if (window.electronAPI?.settings?.get) {
        const settings = await window.electronAPI.settings.get();
        const batteryConfig = settings?.batteryOrg;
        if (batteryConfig?.apiKey) {
          this.config.apiKey = batteryConfig.apiKey;
        }
        if (batteryConfig?.baseUrl) {
          this.config.baseUrl = batteryConfig.baseUrl;
        }
      }
      return this.config.apiKey.length > 0;
    } catch (e) {
      this.lastError = 'Failed to load Battery Org config from secure storage';
      return false;
    }
  }

  /**
   * Get available Battery Boxes for compute
   * Maps to requirement 3.1 - Endpoint to list active Battery Boxes
   */
  async getAvailableBoxes(): Promise<BatteryBox[]> {
    if (!this.config.apiKey) {
      await this.initialize();
    }

    // For beta: return mock data if no API key configured
    // This allows UI testing while API credentials are pending
    if (!this.config.apiKey) {
      console.log('[BatteryOrg] No API key - returning mock boxes for UI testing');
      return this.getMockBoxes();
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/boxes/available`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'X-Battery-Version': 'v1',
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Battery Org API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.boxes || [];
    } catch (error: any) {
      this.lastError = error.message || 'Failed to fetch Battery Boxes';
      console.error('[BatteryOrg]', this.lastError);
      // Fallback to mock data on error for graceful degradation
      return this.getMockBoxes();
    }
  }

  /**
   * Health check for a specific Battery Box
   * Maps to requirement 4.1 - Health-check endpoint per box
   */
  async checkBoxHealth(boxId: string): Promise<BatteryHealthStatus | null> {
    if (!this.config.apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/boxes/${boxId}/health`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Submit an inference job to a Battery Box
   * Maps to requirement 5.1 - Endpoint to submit inference job
   */
  async submitJob(boxId: string, request: BatteryJobRequest): Promise<BatteryJobResponse | null> {
    if (!this.config.apiKey) {
      this.lastError = 'Battery Org not configured - no API key';
      return null;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/boxes/${boxId}/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Job submission failed: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      this.lastError = error.message || 'Failed to submit job';
      console.error('[BatteryOrg]', this.lastError);
      return null;
    }
  }

  /**
   * Query job status
   * Maps to requirement 6.1 - Query job status
   */
  async getJobStatus(boxId: string, jobId: string): Promise<BatteryJobResponse | null> {
    if (!this.config.apiKey) return null;

    try {
      const response = await fetch(`${this.config.baseUrl}/boxes/${boxId}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Get pricing information
   * Maps to requirement 7.2 - Current price list endpoint
   */
  async getPricing(): Promise<{ pricePerHourUsd: number; currency: string } | null> {
    if (!this.config.apiKey) {
      return { pricePerHourUsd: 0.15, currency: 'USD' }; // Default mock pricing
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/pricing`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  /**
   * Mock data for UI testing before API credentials available
   * Returns realistic Battery Box configurations
   */
  private getMockBoxes(): BatteryBox[] {
    return [
      {
        id: 'battery-sf-001',
        name: 'San Francisco Solar Bay',
        location: { region: 'us-west-1', lat: 37.7749, lon: -122.4194 },
        energySource: 'solar',
        gpuCount: 8,
        gpuModel: 'NVIDIA A100 80GB',
        tflops: 312,
        vramGb: 640,
        isAvailable: true,
        pricePerHourUsd: 2.50,
        supportedFrameworks: ['CUDA 12', 'PyTorch', 'TensorFlow', 'vLLM', 'TGI'],
        status: 'online',
        lastHealthCheck: new Date().toISOString(),
      },
      {
        id: 'battery-tx-001',
        name: 'Texas Wind Compute',
        location: { region: 'us-central-1', lat: 32.7767, lon: -96.7970 },
        energySource: 'wind',
        gpuCount: 4,
        gpuModel: 'NVIDIA H100 80GB',
        tflops: 400,
        vramGb: 320,
        isAvailable: true,
        pricePerHourUsd: 3.20,
        supportedFrameworks: ['CUDA 12', 'PyTorch', 'TensorFlow', 'vLLM', 'TGI', 'ROCm'],
        status: 'online',
        lastHealthCheck: new Date().toISOString(),
      },
      {
        id: 'battery-ny-001',
        name: 'NYC Grid Hub',
        location: { region: 'us-east-1', lat: 40.7128, lon: -74.0060 },
        energySource: 'hybrid',
        gpuCount: 2,
        gpuModel: 'NVIDIA A10G 24GB',
        tflops: 62,
        vramGb: 48,
        isAvailable: true,
        pricePerHourUsd: 0.85,
        supportedFrameworks: ['CUDA 11.8', 'PyTorch', 'ONNX Runtime'],
        status: 'online',
        lastHealthCheck: new Date().toISOString(),
      },
      {
        id: 'battery-eu-001',
        name: 'Amsterdam Renewable',
        location: { region: 'eu-west-1', lat: 52.3676, lon: 4.9041 },
        energySource: 'wind',
        gpuCount: 8,
        gpuModel: 'NVIDIA A100 40GB',
        tflops: 312,
        vramGb: 320,
        isAvailable: false, // Busy/offline
        pricePerHourUsd: 2.80,
        supportedFrameworks: ['CUDA 12', 'PyTorch', 'TensorFlow', 'vLLM'],
        status: 'maintenance',
        lastHealthCheck: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ];
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }
}

// Singleton instance
export const batteryOrgAdapter = new BatteryOrgAdapter();
export default batteryOrgAdapter;

// Export class for extension
export { BatteryOrgAdapter };
