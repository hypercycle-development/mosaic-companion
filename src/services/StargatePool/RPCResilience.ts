// =============================================================================
// RPC RESILIENCE — Exponential backoff, fallback rotation, and hot-route caching
// for Stargate Pool services. Prevents cascade failures when public RPCs
// rate-limit or go offline.
// =============================================================================

/**
 * Exponential backoff with jitter: delay = base * 2^attempt + jitter
 * @param baseDelayMs Base delay in milliseconds
 * @param attempt Current attempt number (0-indexed)
 * @param jitterMs Random jitter to add (default: 100ms)
 * @returns Total delay in milliseconds
 */
export function calculateBackoffDelay(
  baseDelayMs: number,
  attempt: number,
  jitterMs: number = 100
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * jitterMs;
  return Math.min(exponential + jitter, 30000); // Cap at 30s
}

/**
 * RPC result with metadata about the successful endpoint
 */
export interface RPCResult<T> {
  data: T;
  endpoint: string;
  timestamp: number;
}

/**
 * Hot-route cache entry
 */
interface HotRouteEntry {
  endpoint: string;
  successCount: number;
  lastSuccessAt: number;
  averageLatencyMs: number;
}

const HOT_ROUTE_CACHE_KEY = 'stargate:rpc:hot-route';
const HOT_ROUTE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const HOT_ROUTE_MIN_SUCCESS = 3;
const LATENCY_DECAY_FACTOR = 0.9;

/**
 * Hot-route cache for per-chain RPC endpoint selection.
 * Stores the most reliable endpoint based on success rate and latency.
 */
class HotRouteCache {
  private cache: Map<string, HotRouteEntry> = new Map();
  private lastPersisted: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get the best endpoint for a chain from cache
   */
  getBestEndpoint(chain: 'ethereum' | 'base', endpoints: string[]): string | null {
    const key = this.cacheKey(chain);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry is still valid and in our current endpoint list
    const now = Date.now();
    const isExpired = now - entry.lastSuccessAt > HOT_ROUTE_TTL_MS;
    const isInList = endpoints.some(e => e === entry.endpoint);

    if (isExpired || !isInList) {
      this.cache.delete(key);
      return null;
    }

    return entry.endpoint;
  }

  /**
   * Record a successful RPC call
   */
  recordSuccess(chain: 'ethereum' | 'base', endpoint: string, latencyMs: number): void {
    const key = this.cacheKey(chain);
    const existing = this.cache.get(key);

    if (existing && existing.endpoint === endpoint) {
      // Update existing entry
      existing.successCount += 1;
      existing.lastSuccessAt = Date.now();
      // Exponential moving average for latency
      existing.averageLatencyMs =
        existing.averageLatencyMs * LATENCY_DECAY_FACTOR +
        latencyMs * (1 - LATENCY_DECAY_FACTOR);
    } else if (!existing || successScore({ successCount: 1, averageLatencyMs: latencyMs, lastSuccessAt: Date.now() }) >
                      successScore(existing)) {
      // New endpoint is better than cached one
      this.cache.set(key, {
        endpoint,
        successCount: 1,
        lastSuccessAt: Date.now(),
        averageLatencyMs: latencyMs,
      });
    }

    // Persist to localStorage every 30 seconds
    const now = Date.now();
    if (now - this.lastPersisted > 30000) {
      this.persistToStorage();
      this.lastPersisted = now;
    }
  }

  /**
   * Clear cache for a chain (e.g., after failures)
   */
  clear(chain: 'ethereum' | 'base'): void {
    this.cache.delete(this.cacheKey(chain));
    this.persistToStorage();
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    this.persistToStorage();
  }

  private cacheKey(chain: string): string {
    return `${HOT_ROUTE_CACHE_KEY}:${chain}`;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(HOT_ROUTE_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          // Convert back to Map, filtering expired entries
          const now = Date.now();
          for (const [key, entry] of Object.entries(parsed)) {
            const hotEntry = entry as HotRouteEntry;
            if (now - hotEntry.lastSuccessAt <= HOT_ROUTE_TTL_MS) {
              this.cache.set(key, hotEntry);
            }
          }
        }
      }
    } catch {
      // localStorage not available or corrupted
    }
  }

  private persistToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const obj: Record<string, HotRouteEntry> = {};
      this.cache.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(HOT_ROUTE_CACHE_KEY, JSON.stringify(obj));
    } catch {
      // localStorage not available
    }
  }
}

function successScore(entry: { successCount: number; averageLatencyMs: number; lastSuccessAt: number } | undefined): number {
  if (!entry) return 0;
  // Score = successCount * recency_factor / latency
  const recencyFactor = Math.exp(-(Date.now() - entry.lastSuccessAt) / HOT_ROUTE_TTL_MS);
  return (entry.successCount * recencyFactor) / Math.max(entry.averageLatencyMs, 1);
}

export const hotRouteCache = new HotRouteCache();

/**
 * RPC Endpoint selector with fallback rotation
 */
export interface EndpointConfig {
  url: string;
  priority: number; // Lower = higher priority
  headers?: Record<string, string>;
}

/**
 * Execute RPC call with exponential backoff and fallback rotation.
 * Tries each endpoint with increasing delays until one succeeds.
 */
export async function executeWithFallback<T>(
  endpoints: EndpointConfig[],
  executor: (url: string, headers?: Record<string, string>) => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    chain?: 'ethereum' | 'base';
  } = {}
): Promise<RPCResult<T>> {
  const { maxRetries = 3, baseDelayMs = 1000, timeoutMs = 10000, chain } = options;

  if (endpoints.length === 0) {
    throw new Error('No RPC endpoints configured');
  }

  // Sort by priority (lower first)
  const sortedEndpoints = [...endpoints].sort((a, b) => a.priority - b.priority);

  // Check hot-route cache first
  if (chain) {
    const hotRoute = hotRouteCache.getBestEndpoint(
      chain,
      sortedEndpoints.map(e => e.url)
    );
    if (hotRoute) {
      // Move hot route to front
      const idx = sortedEndpoints.findIndex(e => e.url === hotRoute);
      if (idx > 0) {
        const [hot] = sortedEndpoints.splice(idx, 1);
        sortedEndpoints.unshift(hot);
      }
    }
  }

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let endpointIdx = 0; endpointIdx < sortedEndpoints.length; endpointIdx++) {
    const endpoint = sortedEndpoints[endpointIdx];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const callStart = Date.now();
        const result = await Promise.race([
          executor(endpoint.url, endpoint.headers),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RPC timeout after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

        const latency = Date.now() - callStart;

        // Record success in hot-route cache
        if (chain) {
          hotRouteCache.recordSuccess(chain, endpoint.url, latency);
        }

        return {
          data: result,
          endpoint: endpoint.url,
          timestamp: Date.now(),
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        const status = (err as any)?.status || (err as any)?.response?.status;
        const isRetryable = status === 429 || status === 403 || status === 502 ||
                            status === 503 || status === 504 || status === 0 ||
                            lastError.message?.includes('timeout') ||
                            lastError.message?.includes('network');

        if (!isRetryable && attempt === 0) {
          // Non-retryable error, try next endpoint immediately
          break;
        }

        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(baseDelayMs, attempt);
          console.warn(
            `[RPCResilience] Endpoint ${endpoint.url} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
            `retrying after ${Math.round(delay)}ms: ${lastError.message}`
          );
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted for this endpoint, try next one
    if (endpointIdx < sortedEndpoints.length - 1) {
      const delay = calculateBackoffDelay(baseDelayMs, endpointIdx + 1);
      console.warn(
        `[RPCResilience] Endpoint ${endpoint.url} exhausted, ` +
        `trying next after ${Math.round(delay)}ms delay`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error(
    `[RPCResilience] All ${endpoints.length} endpoints exhausted. Last error: ${lastError?.message}`
  );
}

/**
 * Generic retry wrapper for any async function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: any, attempt: number) => boolean;
    onRetry?: (error: any, attempt: number, delayMs: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, shouldRetry, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries) throw err;

      const retryable = shouldRetry ? shouldRetry(err, attempt) : true;
      if (!retryable) throw err;

      const delay = calculateBackoffDelay(baseDelayMs, attempt);
      if (onRetry) {
        onRetry(err, attempt + 1, delay);
      }
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error('withRetry exhausted');
}

/**
 * Circuit breaker state
 */
interface CircuitState {
  failures: number;
  lastFailure: number;
  openUntil: number;
  consecutiveSuccesses: number;
}

const circuits: Map<string, CircuitState> = new Map();

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_SUCCESS = 3;
const CIRCUIT_COOLDOWN_MS = 30000;

/**
 * Execute with circuit breaker pattern
 */
export async function withCircuitBreaker<T>(
  endpoint: string,
  fn: () => Promise<T>,
  options: {
    threshold?: number;
    cooldownMs?: number;
    resetSuccesses?: number;
  } = {}
): Promise<T> {
  const { threshold = CIRCUIT_THRESHOLD, cooldownMs = CIRCUIT_COOLDOWN_MS, resetSuccesses = CIRCUIT_RESET_SUCCESS } = options;

  const state = circuits.get(endpoint) || {
    failures: 0,
    lastFailure: 0,
    openUntil: 0,
    consecutiveSuccesses: 0,
  };

  // Check if circuit is open
  if (Date.now() < state.openUntil) {
    throw new Error(`Circuit breaker OPEN for ${endpoint} until ${new Date(state.openUntil).toISOString()}`);
  }

  try {
    const result = await fn();

    // Record success
    state.consecutiveSuccesses += 1;
    if (state.consecutiveSuccesses >= resetSuccesses) {
      state.failures = 0;
      state.consecutiveSuccesses = 0;
    }
    circuits.set(endpoint, state);

    return result;
  } catch (err) {
    // Record failure
    state.failures += 1;
    state.lastFailure = Date.now();
    state.consecutiveSuccesses = 0;

    if (state.failures >= threshold) {
      state.openUntil = Date.now() + cooldownMs;
      console.warn(`[RPCResilience] Circuit breaker OPENED for ${endpoint} — ${state.failures} failures`);
    }

    circuits.set(endpoint, state);
    throw err;
  }
}

/**
 * Check circuit breaker state for an endpoint
 */
export function getCircuitState(endpoint: string): { open: boolean; failures: number; openUntil?: number } {
  const state = circuits.get(endpoint);
  if (!state) return { open: false, failures: 0 };

  const now = Date.now();
  if (state.openUntil > now) {
    return { open: true, failures: state.failures, openUntil: state.openUntil };
  }
  return { open: false, failures: state.failures };
}

/**
 * Reset all circuit breakers (useful for testing or manual recovery)
 */
export function resetAllCircuits(): void {
  circuits.clear();
  hotRouteCache.clearAll();
}

/**
 * Health check for RPC endpoints
 */
export async function checkRPCEndpoint(
  url: string,
  options: { timeoutMs?: number; method?: string; params?: any[] } = {}
): Promise<{ healthy: boolean; latencyMs: number; blockNumber?: number; error?: string }> {
  const { timeoutMs = 5000, method = 'eth_blockNumber', params = [] } = options;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    if (data.error) {
      return {
        healthy: false,
        latencyMs,
        error: `RPC error: ${data.error.message || data.error}`,
      };
    }

    return {
      healthy: true,
      latencyMs,
      blockNumber: data.result ? parseInt(data.result, 16) : undefined,
    };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Health check all configured endpoints
 */
export async function checkAllEndpoints(
  endpoints: Record<string, string[]>
): Promise<Record<string, { healthy: boolean; latencyMs: number; error?: string; blockNumber?: number }[]>> {
  const results: Record<string, { healthy: boolean; latencyMs: number; error?: string; blockNumber?: number }[]> = {};

  for (const [chain, urls] of Object.entries(endpoints)) {
    results[chain] = await Promise.all(
      urls.map(async (url) => {
        const check = await checkRPCEndpoint(url);
        return { url, ...check };
      })
    );
  }

  return results;
}
