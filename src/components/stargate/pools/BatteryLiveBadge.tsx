// =============================================================================
// LIVE BADGE: Battery Validator Pool
// Direct poll to CometBFT /status — same endpoints as useValidatorTelemetry.
// Shows real-time online validator count on the hub card.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { DEFAULT_VALIDATOR_ENDPOINTS } from './useValidatorTelemetry';
import type { PoolDefinition } from './types';

export const BatteryLiveBadge: React.FC<{ definition: PoolDefinition }> = () => {
  const [online, setOnline] = useState(0);
  const [total, setTotal] = useState(DEFAULT_VALIDATOR_ENDPOINTS.length);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const check = async () => {
      let ok = 0;
      await Promise.all(
        DEFAULT_VALIDATOR_ENDPOINTS.map(async (ep) => {
          try {
            const res = await fetch(`http://${ep.host}:${ep.rpcPort}/status`, {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const data = await res.json();
              const sync = data?.result?.sync_info;
              const height = parseInt(sync?.latest_block_height ?? '0', 10);
              if (height >= 0) ok++;        // reachable + responding
            }
          } catch {
            // offline — don't count
          }
        })
      );
      setOnline(ok);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    };

    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 transition-all ${
        pulse ? 'scale-110' : 'scale-100'
      }`}
    >
      <Radio size={10} className={pulse ? 'animate-pulse' : ''} />
      {online}/{total} online
    </span>
  );
};

export default BatteryLiveBadge;
