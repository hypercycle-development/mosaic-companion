// =============================================================================
// STARGATE POOL HUB
// Orchestrator: pool selector grid + detail view. No god files.
// =============================================================================

import React, { useState } from 'react';
import {
  Radio, Server, Truck, Shield, ArrowLeft, LayoutGrid, Settings, Activity
} from 'lucide-react';
import { STARGATE_POOLS } from './pools/registry';
import type { PoolDefinition } from './pools/types';
import PoolConfigModal from './pools/PoolConfigModal';

// Icon map for lucide names
const ICONS: Record<string, React.ReactNode> = {
  Radio: <Radio size={20} />,
  Server: <Server size={20} />,
  Truck: <Truck size={20} />,
  Shield: <Shield size={20} />,
};

const COLOR_MAP: Record<string, string> = {
  emerald: 'from-emerald-900/30 to-cyan-900/30 border-emerald-500/30 text-emerald-400',
  indigo:  'from-indigo-900/30 to-purple-900/30 border-indigo-500/30 text-indigo-400',
  green:   'from-green-900/30 to-emerald-900/30 border-green-500/30 text-green-400',
};

const StargatePoolHub: React.FC = () => {
  const [selected, setSelected] = useState<PoolDefinition | null>(null);
  const [configPool, setConfigPool] = useState<PoolDefinition | null>(null);

  // If a pool is selected, render it full-bleed
  if (selected) {
    const PoolComponent = selected.component;
    return (
      <div className="space-y-4">
        <PoolComponent definition={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  // Otherwise show pool selector grid
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <LayoutGrid size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Stargate Pool</h2>
            <p className="text-[10px] text-gray-400">{STARGATE_POOLS.length} pools active · Select one to manage</p>
          </div>
        </div>
      </div>

      {/* Pool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {STARGATE_POOLS.map((pool) => {
          const LiveBadge = pool.liveBadge;
          return (
            <button
              key={pool.id}
              onClick={() => setSelected(pool)}
              className={`p-4 rounded-xl bg-gradient-to-r ${COLOR_MAP[pool.color] || COLOR_MAP.indigo} border text-left transition-all hover:scale-[1.02] hover:shadow-lg group`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-white">{ICONS[pool.icon] || <Activity size={20} />}</span>
                  <span className="text-sm font-bold text-white">{pool.shortName}</span>
                </div>
                <div className="flex items-center gap-1">
                  {LiveBadge && <LiveBadge definition={pool} />}
                  {pool.isConfigurable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfigPool(pool); }}
                      className="p-0.5 rounded hover:bg-gray-800/50 text-gray-500 group-hover:text-gray-300 transition-colors"
                      title="Settings"
                    >
                      <Settings size={14} />
                    </button>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    pool.status === 'active'
                      ? 'bg-green-500/20 text-green-400'
                      : pool.status === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {pool.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed mb-3">{pool.description}</p>

              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="px-2 py-0.5 rounded bg-gray-800/50 border border-gray-700/30">{pool.category}</span>
                <span className="ml-auto text-gray-500 group-hover:text-gray-300 transition-colors">Click to open →</span>
              </div>
            </button>
          );
        })}
      </div>

      <PoolConfigModal
        pool={configPool}
        isOpen={!!configPool}
        onClose={() => setConfigPool(null)}
        onSave={(id, values) => { console.log('[PoolConfig]', id, values); setConfigPool(null); }}
      />
    </div>
  );
};

export default StargatePoolHub;
