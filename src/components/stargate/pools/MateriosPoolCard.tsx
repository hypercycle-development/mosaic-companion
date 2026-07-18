// =============================================================================
// MATERIOS POOL CARD — Individual attestor health card
// Shows verified operator address, real block/cert counts, and explorer link.
// =============================================================================

import React from 'react';
import { Shield, Layers, Clock, ExternalLink, AlertTriangle, Fingerprint } from 'lucide-react';
import { MateriosAttestorTelemetry } from './useMateriosTelemetry';

export interface MateriosPoolCardProps {
  attestor: MateriosAttestorTelemetry;
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortenSs58(addr?: string): string {
  if (!addr || addr.length < 16) return addr || '—';
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function cardBorderClass(status: MateriosAttestorTelemetry['status']): string {
  switch (status) {
    case 'online':
      return 'border-green-500/20 bg-green-500/5';
    case 'error':
      return 'border-red-500/20 bg-red-500/5';
    case 'offline':
      return 'border-red-500/20 bg-red-500/5';
    case 'pending':
      return 'border-yellow-500/20 bg-yellow-500/5';
  }
}

const EXPLORER_URL = 'https://fluxpointstudios.com/materios/explorer#committee';

const MateriosPoolCard: React.FC<MateriosPoolCardProps> = ({ attestor }) => {
  const isOnline = attestor.status === 'online';
  const isCommittee = attestor.committeeStatus === 'active';
  const operator = attestor.endpoint.operatorAddress;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-colors ${cardBorderClass(attestor.status)} hover:bg-opacity-10`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{attestor.name}</div>
            <div className="text-[10px] text-gray-500 font-mono truncate">{attestor.id}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
          isCommittee && isOnline
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : isOnline
            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {isCommittee && isOnline ? 'Committee Active' : isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Operator Address (wallet differentiation) */}
      {operator && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-gray-900/60 border border-gray-700/30 px-3 py-2">
          <Fingerprint size={12} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-gray-500">Operator (SS58)</div>
            <div className="text-[10px] font-mono text-gray-300 truncate" title={operator}>{shortenSs58(operator)}</div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatBox
          icon={<Layers size={12} className="text-cyan-400" />}
          label="Submitted"
          value={isOnline ? attestor.certsSubmitted.toLocaleString() : '—'}
        />
        <StatBox
          icon={<Layers size={12} className="text-purple-400" />}
          label="Stored"
          value={isOnline ? attestor.storedCerts.toLocaleString() : '—'}
        />
        <StatBox
          icon={<Clock size={12} className="text-gray-400" />}
          label="Updated"
          value={timeSince(attestor.lastHeartbeat)}
        />
      </div>

      {/* Block row */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatBox
          icon={<Layers size={12} className="text-emerald-400" />}
          label="Best Block"
          value={isOnline ? attestor.bestBlock.toLocaleString() : '—'}
        />
        <StatBox
          icon={<Layers size={12} className="text-amber-400" />}
          label="Finalized"
          value={isOnline ? attestor.finalizedBlock.toLocaleString() : '—'}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-700/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">{attestor.chain}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">v{attestor.version}</span>
          {attestor.latencyMs != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/30">{attestor.latencyMs}ms</span>
          )}
        </div>
        {isOnline && (
          <a
            href={EXPLORER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Open Materios Explorer (Committee view)"
          >
            <ExternalLink size={10} /> Explorer
          </a>
        )}
      </div>

      {attestor.error && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
          <span className="text-[10px] text-red-300 leading-relaxed">{attestor.error}</span>
        </div>
      )}
    </div>
  );
};

// ─── Mini stat box ─────────────────────────────────────────────────────────

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

export default MateriosPoolCard;
