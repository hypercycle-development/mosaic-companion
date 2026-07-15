// =============================================================================
// VALIDATOR FLEET GRID — Responsive grid layout for all validators
// Wraps ValidatorPoolCard cards in a responsive grid with pool-level stats
// =============================================================================

import React from 'react';
import { Server, Activity, CheckCircle2, Loader, XCircle, RefreshCw } from 'lucide-react';
import { ValidatorTelemetry } from '../../../types/validator';
import ValidatorPoolCard from './ValidatorPoolCard';
import ValidatorStatusBadge from './ValidatorStatusBadge';

export interface ValidatorFleetGridProps {
  validators: ValidatorTelemetry[];
  /** Pool-level display name */
  poolName?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  /** Optional click handler passed down to cards */
  onCardClick?: (v: ValidatorTelemetry) => void;
  /** Number of columns at various breakpoints */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

function computeFleetSummary(validators: ValidatorTelemetry[]) {
  const total = validators.length;
  const synced = validators.filter((v) => v.status === 'synced').length;
  const catchingUp = validators.filter((v) => v.status === 'catching_up').length;
  const offline = validators.filter((v) => v.status === 'offline').length;
  return { total, synced, catchingUp, offline };
}

const DEFAULT_COLS = { sm: 1, md: 2, lg: 3, xl: 4 };

const ValidatorFleetGrid: React.FC<ValidatorFleetGridProps> = ({
  validators,
  poolName = 'Validator Fleet',
  loading = false,
  error = null,
  onRefresh,
  onCardClick,
  columns = DEFAULT_COLS,
}) => {
  const { total, synced, catchingUp, offline } = computeFleetSummary(validators);

  const gridClass = `
    grid
    grid-cols-${columns.sm || 1}
    md:grid-cols-${columns.md || 2}
    lg:grid-cols-${columns.lg || 3}
    xl:grid-cols-${columns.xl || 4}
    gap-4
  `.trim();

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Server size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{poolName}</h2>
            <p className="text-[10px] text-gray-400">{total} validator{total !== 1 ? 's' : ''} monitored</p>
          </div>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
            title="Refresh fleet status"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* ── Fleet Summary Row ─────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Active"
            value={String(synced)}
            icon={<CheckCircle2 size={14} className="text-green-400" />}
            color="green"
          />
          <StatCard
            label="Catching Up"
            value={String(catchingUp)}
            icon={<Loader size={14} className="text-yellow-400" />}
            color="yellow"
          />
          <StatCard
            label="Offline"
            value={String(offline)}
            icon={<XCircle size={14} className="text-red-400" />}
            color="red"
          />
          <StatCard
            label="Total"
            value={String(total)}
            icon={<Activity size={14} className="text-cyan-400" />}
            color="cyan"
          />
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <XCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* ── Loading Skeleton ──────────────────────────────────────────────── */}
      {loading && validators.length === 0 && (
        <div className="p-8 text-center">
          <Loader size={24} className="text-indigo-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading validator fleet…</p>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────────── */}
      {!loading && validators.length === 0 && !error && (
        <div className="p-8 text-center space-y-3 rounded-xl border border-gray-800 bg-gray-900/30">
          <Server size={48} className="mx-auto text-gray-700" />
          <h3 className="text-lg font-medium text-gray-500">No Validators</h3>
          <p className="text-sm text-gray-600">Add validator endpoints in Settings to start monitoring.</p>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {validators.length > 0 && (
        <div className={gridClass}>
          {validators.map((v) => (
            <ValidatorPoolCard key={v.id} validator={v} onClick={onCardClick} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── StatCard helper ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  return (
    <div className={`p-2.5 rounded-lg border ${colorMap[color] || 'bg-gray-900/30 border-gray-700/30'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

export default ValidatorFleetGrid;
