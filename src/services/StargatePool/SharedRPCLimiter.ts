// =============================================================================
// SHARED RPC LIMITER — Global throttle + circuit breaker for ALL Stargate Pool
// services that hit public RPC endpoints. Prevents cascade hammering when
// AssetDiscovery, ANFEService, and AdaPortalPanel all scan simultaneously.
// =============================================================================

import {
  executeWithFallback,
  hotRouteCache,
  withRetry,
  withCircuitBreaker,
  getCircuitState,
  resetAllCircuits,
  checkRPCEndpoint,
  EndpointConfig,
} from './RPCResilience';
import {
  getRPCEndpointConfigs,
  alchemyKeyManager,
} from './AlchemyKeyManager';

export interface RPCCircuitState {
  failures: number;
  trippedUntil: number;
  lastStatus?: number;
}

// Legacy circuit state kept for backwards compatibility
const globalCircuit: Map<string, RPCCircuitState> = new Map();
let inFlightRequests = 0;
const MAX_CONCURRENT = 2;
const MIN_DELAY_BETWEEN_REQUESTS_MS = 400;
let lastRequestTime = 0;

/** How many failures before tripping an endpoint */
export const RPC_FAILURE_THRESHOLD = 3;
/** How long a tripped endpoint stays offline */
export const RPC_COOLDOWN_MS = 60000; // 60 seconds (was 30s — not enough)

/** URL mappings for each chain */
const RPC_URLS: Record<'ethereum' | 'base', string[]> = {
  ethereum: [
    import.meta.env?.VITE_RPC_ETHEREUM || 'https://cloudflare-eth.com',
    'https://ethereum.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://1rpc.io/eth',
  ],
  base: [
    import.meta.env?.VITE_RPC_BASE || 'https://base.publicnode.com',
    'https://base-rpc.publicnode.com',
    'https://rpc.ankr.com/base',
    'https://1rpc.io/base',
  ],
};

/** Track degraded mode per chain */
interface DegradedModeState {
  active: boolean;
  since: number;
  lastError?: string;
}

const degradedModes: Map<'ethereum' | 'base', DegradedModeState> = new Map();

/**
 * Check if a chain is in degraded mode (all RPCs unavailable)
 */
export function isDegradedMode(chain: 'ethereum' | 'base'): boolean {
  const state = degradedModes.get(chain);
  if (!state) return false;
  // Reset degraded mode after 5 minutes
  if (Date.now() - state.since > 5 * 60 * 1000) {
    degradedModes.delete(chain);
    return false;
  }
  return state.active;
}

/**
 * Enter degraded mode for a chain
 */
export function enterDegradedMode(chain: 'ethereum' | 'base', error?: string): void {
  degradedModes.set(chain, { active: true, since: Date.now(), lastError: error });
  console.warn(`[SharedLimiter] Entering degraded mode for ${chain}: ${error || 'Unknown error'}`);
}

/**
 * Exit degraded mode for a chain
 */
export function exitDegradedMode(chain: 'ethereum' | 'base'): void {
  degradedModes.delete(chain);
  console.log(`[SharedLimiter] Exiting degraded mode for ${chain}`);
}

/**
 * Get degraded mode status for UI display
 */
export function getDegradedModeStatus(chain: 'ethereum' | 'base'): { active: boolean; since?: number; message?: string } {
  const state = degradedModes.get(chain);
  if (!state || !state.active) return { active: false };
  return {
    active: true,
    since: state.since,
    message: state.lastError || 'Network unavailable',
  };
}

export function isEndpointTripped(url: string): boolean {
  const state = globalCircuit.get(url);
  if (!state) return false;
  if (Date.now() < state.trippedUntil) return true;
  // Cooldown expired — reset and allow one probe
  globalCircuit.delete(url);
  return false;
}

export function recordRpcFailure(url: string, status?: number): void {
  const state = globalCircuit.get(url) || { failures: 0, trippedUntil: 0 };
  state.failures += 1;
  state.lastStatus = status;
  // Trip immediately on 403/429 (client rate-limit / forbidden)
  const threshold = status && (status === 403 || status === 429) ? 2 : RPC_FAILURE_THRESHOLD;
  if (state.failures >= threshold) {
    state.trippedUntil = Date.now() + RPC_COOLDOWN_MS;
    console.warn(`[SharedLimiter] RPC endpoint TRIPPED: ${url} — cooling off for ${RPC_COOLDOWN_MS}ms (failures=${state.failures}, status=${status || 'unknown'})`);
  }
  globalCircuit.set(url, state);
}

export function recordRpcSuccess(url: string): void {
  globalCircuit.delete(url);
}

export function areAllEndpointsTripped(urls: string[]): boolean {
  return urls.every(url => isEndpointTripped(url));
}

/** Convenience: pass a chain name and we'll resolve the URLs internally */
export function areAllEndpointsTrippedForChain(chain: 'ethereum' | 'base'): boolean {
  return RPC_URLS[chain].every(url => isEndpointTripped(url));
}

/** Global semaphore: wait until a slot is available */
export async function acquireRPCToken(): Promise<void> {
  while (inFlightRequests >= MAX_CONCURRENT) {
    await new Promise(r => setTimeout(r, 50));
  }
  inFlightRequests += 1;
}

export function releaseRPCToken(): void {
  inFlightRequests = Math.max(0, inFlightRequests - 1);
}

/** Global inter-request throttle */
export async function throttleNextRequest(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_DELAY_BETWEEN_REQUESTS_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_BETWEEN_REQUESTS_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/** Convenience wrapper: acquire + throttle + execute + release */
export async function withGlobalRateLimit<T>(
  fn: () => Promise<T>
): Promise<T> {
  await acquireRPCToken();
  await throttleNextRequest();
  try {
    return await fn();
  } finally {
    releaseRPCToken();
  }
}

/**
 * Unified RPC call with global rate limiting + circuit breaker.
 * All Stargate Pool services MUST use this instead of raw fetch.
 * 
 * Now with:
 * - Hot-route caching (remembers working endpoints)
 * - Fallback rotation with exponential backoff
 * - Degraded mode handling
 */
export async function rpcCall(
  chain: 'ethereum' | 'base',
  payload: object
): Promise<any | null> {
  // Get endpoints with Alchemy priority if configured
  const endpoints = getRPCEndpointConfigs(chain);

  // Filter out tripped endpoints (legacy circuit breaker)
  const availableEndpoints = endpoints.filter(e => !isEndpointTripped(e.url));

  // If all endpoints are tripped, try anyway but we'll be in degraded mode
  const endpointsToTry = availableEndpoints.length > 0 ? availableEndpoints : endpoints;

  try {
    const result = await executeWithFallback(
      endpointsToTry.map(e => ({ url: e.url, priority: e.priority, headers: e.headers })),
      async (url, headers) => {
        // Use circuit breaker for individual endpoint
        return await withCircuitBreaker(url, async () => {
          // Legacy rate limiting
          await acquireRPCToken();
          await throttleNextRequest();
          
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers: headers || { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', ...payload, id: Date.now() }),
              signal: AbortSignal.timeout(10000),
            });

            if (!r.ok) {
              // Record legacy failure
              recordRpcFailure(url, r.status);
              throw new Error(`HTTP ${r.status}`);
            }

            const j = await r.json();
            if (j.error) {
              recordRpcFailure(url);
              throw new Error(`RPC error: ${j.error.message || j.error}`);
            }

            recordRpcSuccess(url);
            return j.result;
          } finally {
            releaseRPCToken();
          }
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        timeoutMs: 15000,
        chain,
      }
    );

    // Success! Exit degraded mode if we were in it
    if (isDegradedMode(chain)) {
      exitDegradedMode(chain);
    }

    return result.data;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    
    // All endpoints exhausted — enter degraded mode
    enterDegradedMode(chain, error.message);
    
    // Clear hot-route cache for this chain so next time we try fresh
    hotRouteCache.clear(chain);
    
    // Throw with degraded mode context
    throw new Error(
      `[SharedLimiter] All ${chain} RPC endpoints exhausted or tripped. ` +
      `Degraded mode active: ${error.message}`
    );
  }
}

/**
 * New: RPC call with retry wrapper
 */
export async function rpcCallWithRetry(
  chain: 'ethereum' | 'base',
  payload: object,
  options?: { maxRetries?: number; baseDelayMs?: number }
): Promise<any | null> {
  return await withRetry(
    () => rpcCall(chain, payload),
    {
      maxRetries: options?.maxRetries ?? 2,
      baseDelayMs: options?.baseDelayMs ?? 1000,
      shouldRetry: (err, attempt) => {
        // Only retry on network/rate-limit errors
        const msg = String(err);
        return msg.includes('429') || msg.includes('503') || 
               msg.includes('timeout') || msg.includes('network') ||
               msg.includes('exhausted') || attempt < 2;
      },
      onRetry: (err, attempt, delay) => {
        console.warn(
          `[SharedLimiter] RPC retry ${attempt}/3 after ${Math.round(delay)}ms: ${err}`
        );
      },
    }
  );
}

/** Reset all global state (useful for testing or manual recovery) */
export function resetGlobalCircuit(): void {
  globalCircuit.clear();
  inFlightRequests = 0;
  lastRequestTime = 0;
  resetAllCircuits();
  degradedModes.clear();
}

/** Debug: dump current circuit state */
export function debugCircuitState(): string {
  const entries: string[] = [];
  globalCircuit.forEach((v, k) => {
    const remaining = Math.max(0, v.trippedUntil - Date.now());
    entries.push(`${k}: failures=${v.failures}, tripped=${remaining > 0 ? `${remaining}ms remaining` : 'expired'}, lastStatus=${v.lastStatus || '?'}`);
  });
  
  // Add new circuit breaker states
  entries.push('\n--- Circuit Breaker States ---');
  // Note: circuits are private in RPCResilience, so we expose via getCircuitState
  
  // Add degraded mode status
  entries.push('\n--- Degraded Mode Status ---');
  degradedModes.forEach((v, k) => {
    entries.push(`${k}: ${v.active ? 'ACTIVE' : 'inactive'} since ${new Date(v.since).toISOString()}, error: ${v.lastError || 'none'}`);
  });
  
  return entries.join('\n') || 'All clear';
}

/**
 * Doctor check: comprehensive health check for RPC endpoints
 * Returns detailed status for each endpoint
 */
export async function doctorCheck(): Promise<{
  timestamp: number;
  chains: {
    chain: 'ethereum' | 'base';
    endpoints: { url: string; healthy: boolean; latencyMs: number; error?: string; blockNumber?: number }[];
    degraded: boolean;
    degradedMessage?: string;
  }[];
  alchemy: {
    usingDemoKey: boolean;
    ethereumKeyValid: boolean | null;
    baseKeyValid: boolean | null;
    validationMessage?: string;
  };
  summary: {
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}> {
  const timestamp = Date.now();
  const chains: { chain: 'ethereum' | 'base'; endpoints: { url: string; healthy: boolean; latencyMs: number; error?: string; blockNumber?: number }[]; degraded: boolean; degradedMessage?: string }[] = [];
  
  let healthy = 0;
  let unhealthy = 0;

  for (const chain of ['ethereum', 'base'] as const) {
    const endpoints = getRPCEndpointConfigs(chain);
    const endpointStatus: { url: string; healthy: boolean; latencyMs: number; error?: string; blockNumber?: number }[] = [];
    
    for (const endpoint of endpoints) {
      const check = await checkRPCEndpoint(endpoint.url, { timeoutMs: 5000 });
      endpointStatus.push({
        url: endpoint.url,
        healthy: check.healthy,
        latencyMs: check.latencyMs,
        error: check.error,
        blockNumber: check.blockNumber,
      });
      
      if (check.healthy) healthy++;
      else unhealthy++;
    }
    
    const degraded = isDegradedMode(chain);
    const degradedStatus = getDegradedModeStatus(chain);
    
    chains.push({
      chain,
      endpoints: endpointStatus,
      degraded,
      degradedMessage: degradedStatus.message,
    });
  }

  // Check Alchemy keys
  const alchemyStatus = alchemyKeyManager.getMigrationStatus();
  let ethereumKeyValid: boolean | null = null;
  let baseKeyValid: boolean | null = null;
  
  if (alchemyStatus.hasEthereumKey) {
    const result = await alchemyKeyManager.validateKey(
      alchemyKeyManager.getConfig()?.ethereumKey || '',
      'ethereum'
    );
    ethereumKeyValid = result.valid;
  }
  
  if (alchemyStatus.hasBaseKey) {
    const result = await alchemyKeyManager.validateKey(
      alchemyKeyManager.getConfig()?.baseKey || '',
      'base'
    );
    baseKeyValid = result.valid;
  }

  return {
    timestamp,
    chains,
    alchemy: {
      usingDemoKey: alchemyStatus.usingDemo,
      ethereumKeyValid,
      baseKeyValid,
      validationMessage: alchemyStatus.validationStatus !== 'unknown' 
        ? `Last validation: ${alchemyStatus.validationStatus}` 
        : undefined,
    },
    summary: {
      healthy,
      unhealthy,
      degraded: chains.filter(c => c.degraded).length,
    },
  };
}
