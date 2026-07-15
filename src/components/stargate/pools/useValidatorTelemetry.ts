// =============================================================================
// useValidatorTelemetry — DIRECT polling to CometBFT validator nodes
// The EnhancedLocalNodeBridge only monitors the local Node Manager; it does NOT
// know about remote batteryagi-validator containers. This hook polls each
// validator's RPC port directly from AtomMan and maps the JSON into our
// ValidatorTelemetry type.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { ValidatorTelemetry, ValidatorSyncStatus } from '../../../types/validator';

export interface ValidatorEndpoint {
  id: string;
  name: string;
  host: string;
  rpcPort: number;
  network: string;
}

export interface UseValidatorTelemetryResult {
  telemetry: ValidatorTelemetry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastPollAt: number | null;
}

// =============================================================================
// KNOWN BATTERY VALIDATOR NODES — hardwired from fleet discovery
// These are the 2 currently-deployed HyperAIBox validators on the LAN.
// When validators 3–5 come online, append entries here.
// =============================================================================
export const DEFAULT_VALIDATOR_ENDPOINTS: ValidatorEndpoint[] = [
  {
    id: 'c3po',
    name: 'C-3PO — Validator-1',
    host: '100.92.116.49',
    rpcPort: 26657,
    network: 'batterycoin-1',
  },
  {
    id: 'r2d2',
    name: 'R2-D2 — Validator-2',
    host: '100.94.115.120',
    rpcPort: 26657,
    network: 'batterycoin-1',
  },
  {
    id: 'mike',
    name: 'Mike — Validator-3',
    host: '100.72.251.124',
    rpcPort: 26657,
    network: 'batterycoin-1',
  },
  {
    id: 'hyperion',
    name: 'Adgas — Hyperion (Validator-4)',
    host: '100.87.82.106',
    rpcPort: 26657,
    network: 'batterycoin-1',
  },
  {
    id: 'maia',
    name: 'Adgas — Maia (Validator-5)',
    host: '100.74.4.51',
    rpcPort: 26657,
    network: 'batterycoin-1',
  },
];

const POLL_INTERVAL_MS = 5000;

async function fetchStatus(endpoint: ValidatorEndpoint): Promise<ValidatorTelemetry> {
  const base = `http://${endpoint.host}:${endpoint.rpcPort}`;
  try {
    // ── 1. /status ── moniker, height, sync state
    const statusRes = await fetch(`${base}/status`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
    const statusData = await statusRes.json();
    const result = statusData?.result;
    const nodeInfo = result?.node_info ?? {};
    const syncInfo = result?.sync_info ?? {};
    const validatorInfo = result?.validator_info ?? {};

    const moniker = nodeInfo.moniker || endpoint.name;
    const height = parseInt(syncInfo.latest_block_height ?? '0', 10);
    const catchingUp = syncInfo.catching_up ?? false;

    // ── 2. /net_info ── peer count (not in /status)
    let nPeers = 0;
    try {
      const netRes = await fetch(`${base}/net_info`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (netRes.ok) {
        const netData = await netRes.json();
        nPeers = netData?.result?.n_peers ?? 0;
      }
    } catch {
      // net_info optional — don't fail the whole card
    }

    const status: ValidatorSyncStatus =
      catchingUp ? 'catching_up' : height >= 0 ? 'synced' : 'offline';

    return {
      id: endpoint.id,
      name: moniker,
      status,
      blockHeight: height,
      peerCount: nPeers,
      network: endpoint.network,
      lastUpdate: Date.now(),
      nodeManagerUrl: base,
      // enrichments not in ValidatorTelemetry type but useful for display
      // @ts-ignore
      validatorAddress: validatorInfo.address,
      // @ts-ignore
      votingPower: validatorInfo.voting_power,
    };
  } catch (err: any) {
    return {
      id: endpoint.id,
      name: endpoint.name,
      status: 'offline',
      blockHeight: 0,
      peerCount: 0,
      network: endpoint.network,
      lastUpdate: Date.now(),
      error: err?.message || 'Unreachable',
    };
  }
}

/**
 * Polls CometBFT /status directly from each validator endpoint.
 * This is the ONLY source of truth for remote validator health.
 */
export function useValidatorTelemetry(
  endpoints: ValidatorEndpoint[] = DEFAULT_VALIDATOR_ENDPOINTS
): UseValidatorTelemetryResult {
  const [telemetry, setTelemetry] = useState<ValidatorTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const endpointsRef = useRef(endpoints);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(endpointsRef.current.map(fetchStatus));
      setTelemetry(results);
      setLastPollAt(Date.now());
      const offlineCount = results.filter((r) => r.status === 'offline').length;
      setError(offlineCount > 0 ? `${offlineCount}/${results.length} validators offline` : null);
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

export default useValidatorTelemetry;
