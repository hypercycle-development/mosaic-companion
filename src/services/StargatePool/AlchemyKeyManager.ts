// =============================================================================
// ALCHEMY KEY MANAGER — Handles migration from demo key to real Alchemy key
// with config persistence and validation.
// =============================================================================

const ALCHEMY_STORAGE_KEY = 'stargate:alchemy:config';
const DEMO_KEY_PATTERN = /demo/i;

export interface AlchemyConfig {
  ethereumKey: string;
  baseKey: string;
  lastValidatedAt?: number;
  validationStatus: 'unknown' | 'valid' | 'invalid' | 'rate_limited';
}

export interface KeyValidationResult {
  valid: boolean;
  status: 'valid' | 'invalid' | 'rate_limited' | 'network_error';
  error?: string;
  latencyMs?: number;
}

/**
 * Alchemy Key Manager
 * Handles migration from demo key to real key with persistence
 */
class AlchemyKeyManager {
  private config: AlchemyConfig | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load config from localStorage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(ALCHEMY_STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
      }
    } catch {
      // localStorage not available or corrupted
    }
  }

  /**
   * Save config to localStorage
   */
  private saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined' || !this.config) return;
      localStorage.setItem(ALCHEMY_STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // localStorage not available
    }
  }

  /**
   * Get current config
   */
  getConfig(): AlchemyConfig | null {
    return this.config;
  }

  /**
   * Check if currently using a demo key
   */
  isUsingDemoKey(): boolean {
    if (!this.config) return true; // No config = default to demo state
    return DEMO_KEY_PATTERN.test(this.config.ethereumKey) ||
           DEMO_KEY_PATTERN.test(this.config.baseKey);
  }

  /**
   * Set real Alchemy keys (non-demo)
   */
  setKeys(ethereumKey: string, baseKey: string): void {
    this.config = {
      ethereumKey,
      baseKey,
      validationStatus: 'unknown',
    };
    this.saveToStorage();
  }

  /**
   * Update just the Ethereum key
   */
  setEthereumKey(key: string): void {
    if (!this.config) {
      this.config = {
        ethereumKey: key,
        baseKey: '',
        validationStatus: 'unknown',
      };
    } else {
      this.config.ethereumKey = key;
      this.config.validationStatus = 'unknown';
    }
    this.saveToStorage();
  }

  /**
   * Update just the Base key
   */
  setBaseKey(key: string): void {
    if (!this.config) {
      this.config = {
        ethereumKey: '',
        baseKey: key,
        validationStatus: 'unknown',
      };
    } else {
      this.config.baseKey = key;
      this.config.validationStatus = 'unknown';
    }
    this.saveToStorage();
  }

  /**
   * Get RPC URL for a chain
   */
  getRpcUrl(chain: 'ethereum' | 'base'): string | null {
    const key = chain === 'ethereum' ? this.config?.ethereumKey : this.config?.baseKey;
    if (!key) return null;

    const network = chain === 'ethereum' ? 'eth-mainnet' : 'base-mainnet';
    return `https://${network}.g.alchemy.com/v2/${key}`;
  }

  /**
   * Validate an Alchemy API key
   */
  async validateKey(key: string, chain: 'ethereum' | 'base'): Promise<KeyValidationResult> {
    const network = chain === 'ethereum' ? 'eth-mainnet' : 'base-mainnet';
    const url = `https://${network}.g.alchemy.com/v2/${key}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 429) {
          return { valid: false, status: 'rate_limited', latencyMs };
        }
        if (response.status === 401 || response.status === 403) {
          return { valid: false, status: 'invalid', error: `HTTP ${response.status}: Invalid key`, latencyMs };
        }
        return { valid: false, status: 'network_error', error: `HTTP ${response.status}`, latencyMs };
      }

      const data = await response.json();

      if (data.error) {
        if (data.error.message?.includes('rate limit') || data.error.message?.includes('Rate limit')) {
          return { valid: false, status: 'rate_limited', error: data.error.message, latencyMs };
        }
        return { valid: false, status: 'invalid', error: data.error.message, latencyMs };
      }

      if (!data.result) {
        return { valid: false, status: 'invalid', error: 'Empty response', latencyMs };
      }

      return { valid: true, status: 'valid', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        valid: false,
        status: 'network_error',
        error: err instanceof Error ? err.message : String(err),
        latencyMs,
      };
    }
  }

  /**
   * Validate current keys and update status
   */
  async validateCurrentKeys(): Promise<{ ethereum: KeyValidationResult; base: KeyValidationResult }> {
    if (!this.config) {
      return {
        ethereum: { valid: false, status: 'invalid', error: 'No keys configured' },
        base: { valid: false, status: 'invalid', error: 'No keys configured' },
      };
    }

    const [ethereum, base] = await Promise.all([
      this.config.ethereumKey ? this.validateKey(this.config.ethereumKey, 'ethereum') : Promise.resolve({ valid: false, status: 'invalid', error: 'No key' } as KeyValidationResult),
      this.config.baseKey ? this.validateKey(this.config.baseKey, 'base') : Promise.resolve({ valid: false, status: 'invalid', error: 'No key' } as KeyValidationResult),
    ]);

    // Update validation status
    if (ethereum.valid && base.valid) {
      this.config.validationStatus = 'valid';
    } else if (ethereum.status === 'rate_limited' || base.status === 'rate_limited') {
      this.config.validationStatus = 'rate_limited';
    } else {
      this.config.validationStatus = 'invalid';
    }

    this.config.lastValidatedAt = Date.now();
    this.saveToStorage();

    return { ethereum, base };
  }

  /**
   * Clear all stored keys (migration complete or reset)
   */
  clearKeys(): void {
    this.config = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ALCHEMY_STORAGE_KEY);
      }
    } catch {
      // localStorage not available
    }
  }

  /**
   * Check if we need to prompt user for real keys
   */
  shouldPromptForKeys(): boolean {
    return this.isUsingDemoKey();
  }

  /**
   * Get migration status for UI display
   */
  getMigrationStatus(): {
    usingDemo: boolean;
    hasEthereumKey: boolean;
    hasBaseKey: boolean;
    validationStatus: 'unknown' | 'valid' | 'invalid' | 'rate_limited';
    lastValidatedAt?: number;
  } {
    return {
      usingDemo: this.isUsingDemoKey(),
      hasEthereumKey: !!this.config?.ethereumKey,
      hasBaseKey: !!this.config?.baseKey,
      validationStatus: this.config?.validationStatus || 'unknown',
      lastValidatedAt: this.config?.lastValidatedAt,
    };
  }
}

export const alchemyKeyManager = new AlchemyKeyManager();

/**
 * Default RPC endpoints for fallback
 * These are public endpoints used when Alchemy is not configured or rate-limited
 */
export const DEFAULT_RPC_ENDPOINTS = {
  ethereum: [
    { url: 'https://cloudflare-eth.com', priority: 1 },
    { url: 'https://ethereum.publicnode.com', priority: 2 },
    { url: 'https://rpc.ankr.com/eth', priority: 3 },
    { url: 'https://1rpc.io/eth', priority: 4 },
  ],
  base: [
    { url: 'https://base.publicnode.com', priority: 1 },
    { url: 'https://base-rpc.publicnode.com', priority: 2 },
    { url: 'https://rpc.ankr.com/base', priority: 3 },
    { url: 'https://1rpc.io/base', priority: 4 },
  ],
} as const;

/**
 * Get RPC endpoints for a chain, including Alchemy if configured
 */
export function getRPCEndpoints(chain: 'ethereum' | 'base'): { url: string; priority: number }[] {
  const endpoints: { url: string; priority: number }[] = [];

  // Try Alchemy first if we have a real key
  const alchemyUrl = alchemyKeyManager.getRpcUrl(chain);
  if (alchemyUrl && !alchemyKeyManager.isUsingDemoKey()) {
    endpoints.push({ url: alchemyUrl, priority: 0 });
  }

  // Add default fallbacks
  endpoints.push(...DEFAULT_RPC_ENDPOINTS[chain]);

  return endpoints;
}

/**
 * Get RPC endpoints as EndpointConfig format for RPCResilience
 */
export function getRPCEndpointConfigs(chain: 'ethereum' | 'base'): { url: string; priority: number; headers?: Record<string, string> }[] {
  const endpoints = getRPCEndpoints(chain);
  return endpoints.map(e => ({
    url: e.url,
    priority: e.priority,
    headers: { 'Content-Type': 'application/json' },
  }));
}
