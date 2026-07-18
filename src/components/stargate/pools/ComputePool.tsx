// =============================================================================
// POOL: Community Compute Pool
// HyperAIBox node factory compute allocation and tilling sessions.
// Extracted from the monolithic StargatePoolDashboard.
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Activity, Clock, Server, Pause, Play, Lock, Unlock,
  StopCircle, RefreshCw, CheckCircle2, AlertTriangle,
  Box, HardDrive, Layers, Info, Loader, Power, ArrowLeft
} from 'lucide-react';
import type { PoolProps } from './types';

// ─── Types (mirror from StargatePoolDashboard) ──────────────────────────────

interface TillingSession {
  tenantId: string; licenseId: string; ownerWallet: string; boxId: string;
  boxName: string; network: string;
  status: 'active' | 'paused' | 'stopped' | 'failed';
  startedAt: number; expiresAt: number; uptimeSeconds: number;
  requestsServed: number; lastHeartbeat: number;
  nodeManagerAlive?: boolean; aimAlive?: boolean; nodeManagerUrl?: string;
  locked?: boolean;
  tillerPort?: number; availableSlots?: number;
  activeTillersCount?: number; tillingActive?: boolean;
  activeTillers?: Array<{ number: number; license: number; priority: number; address: string; timeLeft: number }>;
}

interface PoolBox {
  boxId: string; boxName: string; status: string; localIp: string;
  system?: { cpuPercent: number; ramPercent: number; gpuPercent: number; uptimeHours: number; temperatureC: number };
  tenantCount?: number; maxConcurrentTenants?: number;
}

interface PoolCapacity {
  totalBoxes: number; onlineBoxes: number; totalSlots: number; usedSlots: number;
  totalLicenses: number; activeLicenses: number;
}

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ComputePool: React.FC<PoolProps> = ({ onBack }) => {
  const [sessions, setSessions] = useState<TillingSession[]>([]);
  const [capacity, setCapacity] = useState<PoolCapacity>({
    totalBoxes: 0, onlineBoxes: 0, totalSlots: 0, usedSlots: 0,
    totalLicenses: 0, activeLicenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.getSessions?.();
      const loaded: TillingSession[] = result?.sessions || [];
      setSessions(loaded);
      try {
        const res = await fetch('http://localhost:9100/api/v1/boxes');
        const data = await res.json();
        const boxes: PoolBox[] = data?.boxes || [];
        const online = boxes.filter((b: PoolBox) => b.status === 'online');
        const totalSlots = online.reduce((sum: number, b: PoolBox) => sum + (b.maxConcurrentTenants || 2), 0);
        const usedSlots = online.reduce((sum: number, b: PoolBox) => sum + (b.tenantCount || 0), 0);
        setCapacity({
          totalBoxes: boxes.length, onlineBoxes: online.length,
          totalSlots, usedSlots,
          totalLicenses: loaded.length,
          activeLicenses: loaded.filter((s: TillingSession) => s.status === 'active').length,
        });
      } catch { /* boxes endpoint might be down */ }
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); const i = setInterval(loadData, 30000); return () => clearInterval(i); }, []);

  const handleStop = async (id: string) => {
    setActionId(id);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.stop?.(id);
      if (result?.success) setSessions(prev => prev.map(s => s.tenantId === id ? { ...s, status: 'stopped' } : s));
      else setError(result?.error || 'Failed to stop');
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setActionId(null); }
  };

  const handleResume = async (id: string) => {
    setActionId(id);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.resume?.(id);
      if (result?.success) setSessions(prev => prev.map(s => s.tenantId === id ? { ...s, status: 'active', nodeManagerAlive: true } : s));
      else setError(result?.error || 'Failed to resume');
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setActionId(null); }
  };

  const handleLockToggle = async (id: string, currentlyLocked: boolean) => {
    setActionId(id);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.lock?.(id, !currentlyLocked);
      if (result?.success) setSessions(prev => prev.map(s => s.tenantId === id ? { ...s, locked: !currentlyLocked } : s));
      else setError(result?.error || 'Failed to update lock');
    } catch (e: any) { setError(e.message || 'Network error'); }
    finally { setActionId(null); }
  };

  const active = sessions.filter(s => s.status === 'active');
  const paused = sessions.filter(s => s.status === 'paused');
  const stopped = sessions.filter(s => s.status === 'stopped');
  const totalUptime = sessions.reduce((sum, s) => sum + (s.uptimeSeconds || 0), 0);
  const capPct = capacity.totalSlots > 0 ? Math.round((capacity.usedSlots / capacity.totalSlots) * 100) : 0;
  const capColor = capPct > 90 ? 'bg-red-500' : capPct > 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors">
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Server size={16} className="text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white">Community Compute Pool</h2>
            <p className="text-[10px] text-gray-400">HyperAIBox compute allocation · tilling sessions</p>
          </div>
        </div>
        <button onClick={loadData} disabled={loading} className="ml-auto p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {capacity.totalBoxes > 0 && (
        <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-white">Pool Capacity</span>
            </div>
            <span className="text-[10px] text-gray-500">{capacity.onlineBoxes}/{capacity.totalBoxes} boxes online</span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full ${capColor} transition-all`} style={{ width: `${capPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-500">{capacity.usedSlots} / {capacity.totalSlots} slots</span>
            <span className={`text-[10px] font-medium ${capPct > 90 ? 'text-red-400' : 'text-gray-400'}`}>{capPct}%</span>
          </div>
          {capPct >= 90 && (
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Pool near capacity. Add more HyperAIBoxes.</span>
            </div>
          )}
        </div>
      )}

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300 leading-relaxed">
          <strong className="text-blue-200">Pool Status ≠ On-chain Status:</strong> Active here means compute is allocated.
          Your Node Factory may still need on-chain activation via Merkelizer.
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active" value={String(active.length)} icon={<Activity size={14} className="text-green-400" />} color="green" />
        <StatCard label="Paused" value={String(paused.length)} icon={<Pause size={14} className="text-amber-400" />} color="amber" />
        <StatCard label="Licenses" value={String(sessions.length)} icon={<Layers size={14} className="text-cyan-400" />} color="cyan" />
        <StatCard label="Uptime" value={`${Math.floor(totalUptime / 3600)}h`} icon={<Clock size={14} className="text-violet-400" />} color="violet" />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="p-8 text-center">
          <Loader size={24} className="text-indigo-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading pool sessions…</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-6 text-center rounded-lg bg-gray-900/30 border border-gray-700/30">
          <Layers size={24} className="text-indigo-400 mx-auto mb-2 opacity-50" />
          <p className="text-xs text-gray-400 mb-1">No licenses in Compute Pool</p>
          <p className="text-[10px] text-gray-500">Click <span className="px-1 rounded bg-indigo-500/20 text-indigo-300">🌌 Delegate to Pool</span> on any Node Factory card to add it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 size={10} /> Active — Compute Running</h4>
              <div className="space-y-2">{active.map(s => <SessionCard key={s.tenantId} s={s} onStop={handleStop} onLock={handleLockToggle} actionId={actionId} />)}</div>
            </div>
          )}
          {paused.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Pause size={10} /> Paused — Click Activate to Resume</h4>
              <div className="space-y-2">{paused.map(s => <PausedCard key={s.tenantId} s={s} onResume={handleResume} onLock={handleLockToggle} actionId={actionId} />)}</div>
            </div>
          )}
          {stopped.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><StopCircle size={10} /> Stopped</h4>
              <div className="space-y-2 opacity-60">{stopped.map(s => <SessionCard key={s.tenantId} s={s} onStop={() => {}} onLock={() => {}} actionId={actionId} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400', amber: 'bg-amber-500/10 text-amber-400',
    cyan: 'bg-cyan-500/10 text-cyan-400', violet: 'bg-violet-500/10 text-violet-400',
  };
  return (
    <div className={`p-2.5 rounded-lg border border-gray-700/30 ${colorMap[color] || 'bg-gray-900/30'}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-gray-500">{label}</span></div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

// ─── Session Card ───────────────────────────────────────────────────────────

function SessionCard({ s, onStop, onLock, actionId }: { s: TillingSession; onStop: (id: string) => void; onLock: (id: string, locked: boolean) => void; actionId: string | null }) {
  const busy = actionId === s.tenantId;
  return (
    <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-400" />
          <div>
            <div className="text-xs font-semibold text-white">{s.licenseId.slice(0, 16)}…</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1"><Box size={10} />{s.boxName}<span>•</span><span className="font-mono">{s.network}</span></div>
          </div>
        </div>
        {s.locked && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"><Lock size={8} /> Locked</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onLock(s.tenantId, !!s.locked)} disabled={busy}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            s.locked ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70 border border-gray-600/30'
          } disabled:opacity-50`}
        >
          {busy ? <RefreshCw size={12} className="animate-spin" /> : s.locked ? <Lock size={12} /> : <Unlock size={12} />}
          {s.locked ? 'Locked' : 'Lock'}
        </button>
        {!s.locked && (
          <button onClick={() => onStop(s.tenantId)} disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
          >
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <Power size={12} />} Stop
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[10px] mt-2 pt-2 border-t border-green-500/10">
        <div><span className="text-gray-500">Started</span><div className="font-medium">{timeSince(s.startedAt)} ago</div></div>
        <div><span className="text-gray-500">Heartbeat</span><div className={`font-medium ${s.lastHeartbeat > Date.now() - 300000 ? 'text-green-400' : 'text-amber-400'}`}>{timeSince(s.lastHeartbeat)} ago</div></div>
        <div><span className="text-gray-500">Uptime</span><div className="font-medium">{Math.floor((s.uptimeSeconds || 0) / 60)}m</div></div>
        <div><span className="text-gray-500">Node Mgr</span><div className={`font-medium ${s.nodeManagerAlive ? 'text-green-400' : 'text-amber-400'}`}>{s.nodeManagerAlive === undefined ? '…' : s.nodeManagerAlive ? 'Up' : 'Down'}</div></div>
      </div>
    </div>
  );
}

// ─── Paused Card ────────────────────────────────────────────────────────────

function PausedCard({ s, onResume, onLock, actionId }: { s: TillingSession; onResume: (id: string) => void; onLock: (id: string, locked: boolean) => void; actionId: string | null }) {
  const busy = actionId === s.tenantId;
  return (
    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pause size={14} className="text-amber-400" />
          <div>
            <div className="text-xs font-semibold text-white">{s.licenseId.slice(0, 16)}…</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1"><Box size={10} />{s.boxName}<span>•</span><span className="font-mono">{s.network}</span></div>
          </div>
        </div>
        {s.locked && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"><Lock size={8} /> Locked</span>
        )}
      </div>
      <p className="text-[10px] text-amber-300/70 mb-3">This Node Factory is paused — compute was deallocated. Click <strong>Activate</strong> to re-provision.</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onResume(s.tenantId)} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-green-900/20"
        >
          {busy ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {busy ? 'Activating…' : 'Activate'}
        </button>
        <button onClick={() => onLock(s.tenantId, !!s.locked)} disabled={busy}
          className={`flex items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
            s.locked ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70 border border-gray-600/30'
          } disabled:opacity-50`}
        >
          {s.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] mt-3 pt-2 border-t border-amber-500/10">
        <div><span className="text-gray-500">Started</span><div className="font-medium">{timeSince(s.startedAt)} ago</div></div>
        <div><span className="text-gray-500">Paused</span><div className="font-medium text-amber-400">{timeSince(s.lastHeartbeat)} ago</div></div>
        <div><span className="text-gray-500">Uptime</span><div className="font-medium">{Math.floor((s.uptimeSeconds || 0) / 60)}m</div></div>
      </div>
    </div>
  );
}

export default ComputePool;
