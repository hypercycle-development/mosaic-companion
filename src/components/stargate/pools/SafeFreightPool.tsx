// =============================================================================
// POOL: SAFE Rev Pool
// Sovereign Autonomous Freight Exchange — AI-powered freight marketplace.
// Extracted from AdaPortalPanel renderStargatePool.
// =============================================================================

import React from 'react';
import { BookOpen, Info, ArrowLeft, Truck } from 'lucide-react';
import type { PoolProps } from './types';

// Simple notification shim — in real app this would use the parent's showNotification
function showNotification(_type: string, _msg: string) { /* no-op for now */ }

const SafeFreightPool: React.FC<PoolProps> = ({ onBack }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors">
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-green-400" />
          <div>
            <h2 className="text-sm font-bold text-white">SAFE Rev Pool</h2>
            <p className="text-[10px] text-gray-400">Sovereign Autonomous Freight Exchange</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-lg">🚛</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">SAFE Rev Pool</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">Active</span>
              </div>
              <p className="text-sm text-gray-400">Sovereign Autonomous Freight Exchange</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">0%</div>
            <div className="text-xs text-gray-500">Driver Fees</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-green-500/10">
          <div className="text-center">
            <div className="text-lg font-bold text-white">128</div>
            <div className="text-xs text-gray-500">Tiller Slots</div>
          </div>
          <div className="text-center border-x border-green-500/10">
            <div className="text-lg font-bold text-white">&lt;30s</div>
            <div className="text-xs text-gray-500">Settlement</div>
          </div>
          <div className="text-center border-r border-green-500/10">
            <div className="text-lg font-bold text-white">UK</div>
            <div className="text-xs text-gray-500">Pilot Region</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">100</div>
            <div className="text-xs text-gray-500">Drivers</div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-400 leading-relaxed">
          <strong className="text-green-300">AI-powered freight marketplace</strong> where Driver Digital Twins 
          and Shipper Agents negotiate loads autonomously via A2A protocols. 
          0% driver fees vs AnyVan's 15%. Instant USDC settlement on HyperCycle.
        </div>

        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-gray-500">AIMs:</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-300">Driver Twin</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-300">Shipper Agent</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-300">Matching Engine</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-300">Settlement</span>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button 
            onClick={() => showNotification('info', 'Knowledge base coming soon')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            <BookOpen size={14} /> Knowledge Base
          </button>
          <button 
            onClick={() => showNotification('info', 'SAFE Rev Pool: 0% driver fees, instant USDC settlement, A2A negotiation')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 transition-colors"
          >
            <Info size={14} /> Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafeFreightPool;
