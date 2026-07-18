// =============================================================================
// LIVE BADGE: Materios Attestor Pool
// Direct poll to Materios attestor /health endpoints.
// Shows real-time online attestor count on the hub card.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { DEFAULT_MATERIOS_ENDPOINTS } from './useMateriosTelemetry';
import type { PoolDefinition } from './types';

export const MateriosLiveBadge: React.FC<{ definition: PoolDefinition }> = () => {
  const [online, setOnline] = useState(0);
  const [total, setTotal] = useState(DEFAULT_MATERIOS_ENDPOINTS.length);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const check = async () => {
      let ok = 0;
      await Promise.all(
        DEFAULT_MATERIOS_ENDPOINTS.map(async (ep) => {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 3000);
            const res = await fetch(`http://${ep.host}:${ep.healthPort}/health`, {
              method: 'GET',
              signal: ctrl.signal,
            });
            clearTimeout(t);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'ok') ok++;
            }
          } catch {
            // offline
          }
        })
      );
      setOnline(ok);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    };

    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 transition-all ${
        pulse ? 'scale-110' : 'scale-100'
      }`}
    >
      <Shield size={10} className={pulse ? 'animate-pulse' : ''} />
      {online}/{total} online
    </span>
  );
};

export default MateriosLiveBadge;
