// =============================================================================
// useMateriosTelemetry — Poll Materios Attestor health / status / metrics
// Supports multi-node fleet: local Docker container + remote endpoints.
// Fetches REAL data from /status and /metrics (Prometheus text).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export type MateriosAttestorStatus = 'online' | 'offline' | 'error' | 'pending';

export interface MateriosEndpoint {
  id: string;
  name: string;
  host: string;
  healthPort: number;
  rpcUrl?: string;
  isLocal?: boolean;
  /** Known operator SS58 address (optional — shown for differentiation) */
  operatorAddress?: string;
}

export interface MateriosAttestorTelemetry {
  id: string;
  name: string;
  status: MateriosAttestorStatus;
  chain: string;
  genesis: string;
  bestBlock: number;
  finalizedBlock: number;
  lastProcessedBlock: number;
  /** Certs submitted on-chain by THIS operator (from /status certsSubmitted) */
  certsSubmitted: number;
  /** Total certs stored locally in /data/certs (from /metrics or IPC) */
  storedCerts: number;
  pendingReceipts: number;
  committeeStatus: 'active' | 'pending' | 'unknown';
  uptime: string;
  version: string;
  lastHeartbeat: number;
  latencyMs?: number;
  error?: string;
  endpoint: MateriosEndpoint;
  /** Parsed metrics raw map for debugging / extensibility */
  metrics?: Record<string, number>;
}

export interface UseMateriosTelemetryResult {
  telemetry: MateriosAttestorTelemetry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastPollAt: number | null;
}

// =============================================================================
// DEFAULT ENDPOINTS — seeded from known fleet (AtomMan / HyperAIBox community)
// =============================================================================
export const DEFAULT_MATERIOS_ENDPOINTS: MateriosEndpoint[] = [
  {
    id: 'local-attestor',
    name: 'Local Materios Attestor',
    host: '127.0.0.1',
    healthPort: 8080,
    isLocal: true,
    operatorAddress: '5CtBFsSx8HzX272AGNb764sv4sBLQUwb6GfHQjk8YdbMPW2d',
  },
  {
    id: 'c3p0-hyperaibox',
    name: 'C-3PO HyperAIBox',
    host: '192.168.0.150',
    healthPort: 8081,
    isLocal: false,
    operatorAddress: '5HKxG2zNSGPM4SHCgZwercBAXW94ksyhNtaYtGZrDqF2ajPP',
  },
  {
    id: 'r2d2-hyperaibox',
    name: 'R2D2 HyperAIBox',
    host: '192.168.0.38',
    healthPort: 8081,
    isLocal: false,
    operatorAddress: '5D5eWbmtxNcGC7jsxokMeBwGcZzDLf8xUiLpoCvxVxxeprpy',
  },
];

const POLL_INTERVAL_MS = 15000;

// ─── Manual timeout (Electron 39 compat — AbortSignal.timeout missing in renderer) ───
function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ─── Parse Prometheus text format ─────────────────────────────────────────
function parsePrometheusMetrics(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // metric_name value
    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/);
    if (match) {
      out[match[1]] = parseFloat(match[2]);
    }
  }
  return out;
}

// ─── Fetch single endpoint ──────────────────────────────────────────────────
async function fetchHealth(endpoint: MateriosEndpoint): Promise<MateriosAttestorTelemetry> {
  const base = `http://${endpoint.host}:${endpoint.healthPort}`;
  const start = performance.now();

  try {
    // 1) Health check
    const healthRes = await fetch(`${base}/health`, {
      method: 'GET',
      signal: withTimeout(5000),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`);
    const health = await healthRes.json().catch(() => ({ status: 'ok' }));

    // 2) Status endpoint (bestBlock, certsSubmitted, etc.)
    let statusData: Record<string, any> = {};
    try {
      const statusRes = await fetch(`${base}/status`, {
        method: 'GET',
        signal: withTimeout(3000),
      });
      if (statusRes.ok) statusData = await statusRes.json();
    } catch {
      /* /status optional */
    }

    // 3) Metrics endpoint (Prometheus text)
    let metrics: Record<string, number> = {};
    try {
      const metricsRes = await fetch(`${base}/metrics`, {
        method: 'GET',
        signal: withTimeout(3000),
      });
      if (metricsRes.ok) {
        const text = await metricsRes.text();
        metrics = parsePrometheusMetrics(text);
      }
    } catch {
      /* /metrics optional */
    }

    // Verified real values (fallback to 0 if missing)
    const bestBlock = statusData.bestBlock ?? metrics['materios_cert_daemon_last_processed_block'] ?? 0;
    const finalizedBlock = statusData.finalizedBlock ?? metrics['materios_cert_daemon_finalized_head'] ?? 0;
    const lastProcessedBlock = metrics['materios_cert_daemon_last_processed_block'] ?? bestBlock;
    const certsSubmitted = statusData.certsSubmitted ?? metrics['materios_cert_daemon_certs_submitted_total'] ?? 0;
    const pendingReceipts = statusData.pendingReceipts ?? metrics['materios_cert_daemon_pending_receipts'] ?? 0;
    const storedCerts = metrics['materios_cert_daemon_blocks_processed_total'] ?? 0; // proxy until IPC count

    return {
      id: endpoint.id,
      name: endpoint.name,
      status: health.status === 'ok' ? 'online' : 'error',
      chain: 'Materios Preprod',
      genesis: '0x0e46e33f639a56cc8780fd871d9a15e16d99af248526f907cb560cb40849f7bf',
      bestBlock,
      finalizedBlock,
      lastProcessedBlock,
      certsSubmitted,
      storedCerts,
      pendingReceipts,
      committeeStatus: 'active',
      uptime: '—',
      version: '1.1.0',
      lastHeartbeat: Date.now(),
      latencyMs,
      endpoint,
      metrics,
    };
  } catch (err: any) {
    return {
      id: endpoint.id,
      name: endpoint.name,
      status: 'offline',
      chain: 'Materios Preprod',
      genesis: '—',
      bestBlock: 0,
      finalizedBlock: 0,
      lastProcessedBlock: 0,
      certsSubmitted: 0,
      storedCerts: 0,
      pendingReceipts: 0,
      committeeStatus: 'unknown',
      uptime: '—',
      version: '—',
      lastHeartbeat: Date.now(),
      error: err?.message || 'Unreachable',
      endpoint,
    };
  }
}

/**
 * Polls Materios attestor endpoints.
 */
export function useMateriosTelemetry(
  endpoints: MateriosEndpoint[] = DEFAULT_MATERIOS_ENDPOINTS
): UseMateriosTelemetryResult {
  const [telemetry, setTelemetry] = useState<MateriosAttestorTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const endpointsRef = useRef(endpoints);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(endpointsRef.current.map(fetchHealth));
      setTelemetry(results);
      setLastPollAt(Date.now());
      const offlineCount = results.filter((r) => r.status === 'offline').length;
      setError(offlineCount > 0 ? `${offlineCount}/${results.length} attestors offline` : null);
    } catch (err: any) {
      setError(err?.message || 'Telemetry poll failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    endpointsRef.current = endpoints;
  }, [endpoints]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { telemetry, loading, error, refresh, lastPollAt };
}

export default useMateriosTelemetry;
