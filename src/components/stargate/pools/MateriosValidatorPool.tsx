// =============================================================================
// POOL: Materios Attestor Pool
// Substrate-based certificate attestor fleet monitoring for Materios partner chain.
// =============================================================================

import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import useMateriosTelemetry from './useMateriosTelemetry';
import MateriosPoolCard from './MateriosPoolCard';
import type { PoolProps } from './types';

const MateriosValidatorPool: React.FC<PoolProps> = ({ onBack }) => {
  const { telemetry, loading, error, refresh } = useMateriosTelemetry();

  const online = telemetry.filter((t) => t.status === 'online');
  const offline = telemetry.filter((t) => t.status === 'offline');
  const committee = telemetry.filter((t) => t.committeeStatus === 'active');
  const totalSubmitted = telemetry.reduce((sum, t) => sum + (t.certsSubmitted || 0), 0);
  const totalStored = telemetry.reduce((sum, t) => sum + (t.storedCerts || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-green-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Materios Attestor Pool</h2>
            <p className="text-[10px] text-gray-400">Materios Preprod · Certificate Attestation</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Online" value={String(online.length)} color="green" icon={<Shield size={14} className="text-green-400" />} />
        <StatCard label="Committee" value={String(committee.length)} color="cyan" icon={<Shield size={14} className="text-cyan-400" />} />
        <StatCard label="Submitted" value={totalSubmitted.toLocaleString()} color="purple" icon={<Shield size={14} className="text-purple-400" />} />
        <StatCard label="Stored" value={totalStored.toLocaleString()} color="amber" icon={<Shield size={14} className="text-amber-400" />} />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {loading && telemetry.length === 0 ? (
        <div className="p-8 text-center">
          <Shield size={24} className="text-green-400 animate-pulse mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading attestor fleet…</p>
        </div>
      ) : telemetry.length === 0 ? (
        <div className="p-8 text-center space-y-3 rounded-xl border border-gray-800 bg-gray-900/30">
          <Shield size={48} className="mx-auto text-gray-700" />
          <h3 className="text-lg font-medium text-gray-500">No Attestors</h3>
          <p className="text-sm text-gray-600">Add Materios attestor endpoints in Settings to start monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {telemetry.map((t) => (
            <MateriosPoolCard key={t.id} attestor={t} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <div className={`p-2.5 rounded-lg border ${colorMap[color] || 'bg-gray-900/30 border-gray-700/30'}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-gray-500">{label}</span></div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

export default MateriosValidatorPool;
