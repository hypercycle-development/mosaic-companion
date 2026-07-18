// =============================================================================
// LIVE BADGE: Community Compute Pool
// Shows real-time active tilling sessions / slot utilization
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import type { PoolDefinition } from './types';

// Lightweight direct poll — no bridge dependency, keeps badge standalone
export const ComputeLiveBadge: React.FC<{ definition: PoolDefinition }> = () => {
  const [active, setActive] = useState(0);
  const [slots, setSlots] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        // @ts-ignore
        const result = await window.electronAPI?.stargate?.tilling?.getSessions?.();
        const sessions = result?.sessions || [];
        const act = sessions.filter((s: any) => s.status === 'active').length;
        setActive(act);
        // fetch boxes for slot count
        try {
          const res = await fetch('http://localhost:9100/api/v1/boxes');
          const data = await res.json();
          const boxes = data?.boxes || [];
          const online = boxes.filter((b: any) => b.status === 'online');
          const totalSlots = online.reduce((sum: number, b: any) => sum + (b.maxConcurrentTenants || 2), 0);
          setSlots(totalSlots);
        } catch {
          setSlots(0);
        }
      } catch {
        setActive(0); setSlots(0);
      }
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  const pct = slots > 0 ? Math.round((active / slots) * 100) : 0;
  const color = pct > 90 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-indigo-400';
  const bg = pct > 90 ? 'bg-red-500/10 border-red-500/20' : 'bg-indigo-500/10 border-indigo-500/20';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${bg} ${color}`}>
      <Server size={10} />
      {active}/{slots} slots
    </span>
  );
};

export default ComputeLiveBadge;
