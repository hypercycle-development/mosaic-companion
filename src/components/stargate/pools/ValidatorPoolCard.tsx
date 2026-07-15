// =============================================================================
// VALIDATOR POOL CARD — Individual validator health card
// Status dot, block height, peer count, last update timestamp
// =============================================================================

import React from 'react';
import { Server, Layers, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { ValidatorTelemetry } from '../../../types/validator';
import ValidatorStatusBadge from './ValidatorStatusBadge';

export interface ValidatorPoolCardProps {
  validator: ValidatorTelemetry;
  /** Optional click handler for deep-linking to node manager */
  onClick?: (v: ValidatorTelemetry) => void;
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function cardBorderClass(status: ValidatorTelemetry['status']): string {
  switch (status) {
    case 'synced':
      return 'border-green-500/20 bg-green-500/5';
    case 'catching_up':
      return 'border-yellow-500/20 bg-yellow-500/5';
    case 'offline':
      return 'border-red-500/20 bg-red-500/5';
  }
}

const ValidatorPoolCard: React.FC<ValidatorPoolCardProps> = ({ validator, onClick }) => {
  const isOffline = validator.status === 'offline';
  const isSynced = validator.status === 'synced';

  return (
    <div
      className={`relative rounded-xl border p-4 transition-colors ${cardBorderClass(validator.status)} hover:bg-opacity-10`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isSynced ? 'bg-green-500/20 text-green-400' : isOffline ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            <Server size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{validator.name}</div>
            <div className="text-[10px] text-gray-500 font-mono truncate">{validator.id}</div>
          </div>
        </div>
        <ValidatorStatusBadge status={validator.status} size="sm" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox
          icon={<Layers size={12} className="text-cyan-400" />}
          label="Block"
          value={isOffline ? '—' : validator.blockHeight.toLocaleString()}
        />
        <StatBox
          icon={<Server size={12} className="text-purple-400" />}
          label="Peers"
          value={isOffline ? '—' : String(validator.peerCount)}
        />
        <StatBox
          icon={<Clock size={12} className="text-gray-400" />}
          label="Updated"
          value={timeSince(validator.lastUpdate)}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-700/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">
            {validator.network}
          </span>
          {validator.computeGrade && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">
              {validator.computeGrade}
            </span>
          )}
        </div>
        {validator.nodeManagerUrl && (
          <button
            onClick={() => onClick?.(validator)}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Open node manager"
          >
            <ExternalLink size={10} /> Manage
          </button>
        )}
      </div>

      {/* Error banner */}
      {validator.error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-[10px] text-red-300 leading-relaxed">{validator.error}</span>
        </div>
      )}
    </div>
  );
};

// ─── Mini stat box inside card ──────────────────────────────────────────────

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-900/40 rounded-lg p-2 border border-gray-700/20">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      <div className="text-xs font-semibold text-white truncate">{value}</div>
    </div>
  );
}

export default ValidatorPoolCard;
