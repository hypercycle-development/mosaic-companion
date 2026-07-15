// =============================================================================
// STARGATE POOL DASHBOARD — Community Node Factory Compute Pool
// Simplified for non-technical users: one-click activate, lock to stay running
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Activity, Clock, Server, Pause, Play, Lock, Unlock,
  StopCircle, RefreshCw, CheckCircle2, AlertTriangle,
  ChevronRight, Box, HardDrive, Layers, Info, Loader,
  Shield, Power, Radio
} from 'lucide-react';
import { ValidatorFleetGrid } from './pools';
import { useValidatorTelemetry } from './pools';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TillingSession {
  tenantId: string;
  licenseId: string;
  ownerWallet: string;
  boxId: string;
  boxName: string;
  network: string;
  status: 'active' | 'paused' | 'stopped' | 'failed';
  startedAt: number;
  expiresAt: number;
  uptimeSeconds: number;
  requestsServed: number;
  lastHeartbeat: number;
  nodeManagerAlive?: boolean;
  aimAlive?: boolean;
  nodeManagerUrl?: string;
  locked?: boolean;
  // ── Tiller fields from hyperbox-tiller ──
  tillerPort?: number;
  availableSlots?: number;
  activeTillersCount?: number;
  tillingActive?: boolean;
  activeTillers?: Array<{
    number: number;
    license: number;
    priority: number;
    address: string;
    timeLeft: number;
  }>;
}

interface PoolBox {
  boxId: string;
  boxName: string;
  status: string;
  localIp: string;
  system?: {
    cpuPercent: number;
    ramPercent: number;
    gpuPercent: number;
    uptimeHours: number;
    temperatureC: number;
  };
  tenantCount?: number;
  maxConcurrentTenants?: number;
}

interface PoolCapacity {
  totalBoxes: number;
  onlineBoxes: number;
  totalSlots: number;
  usedSlots: number;
  totalLicenses: number;
  activeLicenses: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeSince(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

const StargatePoolDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<TillingSession[]>([]);
  const [boxes, setBoxes] = useState<PoolBox[]>([]);
  const [capacity, setCapacity] = useState<PoolCapacity>({
    totalBoxes: 0, onlineBoxes: 0, totalSlots: 0, usedSlots: 0,
    totalLicenses: 0, activeLicenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore
      const sessionsResult = await window.electronAPI?.stargate?.tilling?.getSessions?.();
      const loadedSessions: TillingSession[] = sessionsResult?.sessions || [];
      setSessions(loadedSessions);

      try {
        const res = await fetch('http://localhost:9100/api/v1/boxes');
        const boxesData = await res.json();
        const loadedBoxes: PoolBox[] = boxesData?.boxes || [];
        setBoxes(loadedBoxes);

        const onlineBoxes = loadedBoxes.filter((b: PoolBox) => b.status === 'online');
        const totalSlots = onlineBoxes.reduce((sum: number, b: PoolBox) =>
          sum + (b.maxConcurrentTenants || 2), 0);
        const usedSlots = onlineBoxes.reduce((sum: number, b: PoolBox) =>
          sum + (b.tenantCount || 0), 0);

        setCapacity({
          totalBoxes: loadedBoxes.length,
          onlineBoxes: onlineBoxes.length,
          totalSlots,
          usedSlots,
          totalLicenses: loadedSessions.length,
          activeLicenses: loadedSessions.filter((s: TillingSession) => s.status === 'active').length,
        });
      } catch (e) {
        // Boxes endpoint might not be available
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStop = async (tenantId: string) => {
    setActionId(tenantId);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.stop?.(tenantId);
      if (result?.success) {
        setSessions(prev => prev.map(s =>
          s.tenantId === tenantId ? { ...s, status: 'stopped' } : s
        ));
      } else {
        setError(result?.error || 'Failed to stop');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setActionId(null);
    }
  };

  const handleResume = async (tenantId: string) => {
    setActionId(tenantId);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.resume?.(tenantId);
      if (result?.success) {
        setSessions(prev => prev.map(s =>
          s.tenantId === tenantId ? { ...s, status: 'active', nodeManagerAlive: true } : s
        ));
      } else {
        setError(result?.error || 'Failed to resume');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setActionId(null);
    }
  };

  const handleLockToggle = async (tenantId: string, currentlyLocked: boolean) => {
    setActionId(tenantId);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.lock?.(tenantId, !currentlyLocked);
      if (result?.success) {
        setSessions(prev => prev.map(s =>
          s.tenantId === tenantId ? { ...s, locked: !currentlyLocked } : s
        ));
      } else {
        setError(result?.error || 'Failed to update lock');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setActionId(null);
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pausedSessions = sessions.filter(s => s.status === 'paused');
  const stoppedSessions = sessions.filter(s => s.status === 'stopped');
  const totalUptime = sessions.reduce((sum, s) => sum + (s.uptimeSeconds || 0), 0);

  const capacityPercent = capacity.totalSlots > 0
    ? Math.round((capacity.usedSlots / capacity.totalSlots) * 100)
    : 0;
  const capacityColor = capacityPercent > 90 ? 'bg-red-500' : capacityPercent > 70 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Server size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Stargate Pool</h2>
            <p className="text-[10px] text-gray-400">Community Node Factory Compute</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Validator Fleet ──────────────────────────────────────────────── */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-900/20 to-cyan-900/20 border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={14} className="text-emerald-400" />
          <h3 className="text-xs font-bold text-white">Battery Validator Fleet</h3>
          <span className="text-[10px] text-emerald-400 ml-auto">Powered by CometBFT</span>
        </div>
        <ValidatorFleetDashboard />
      </div>

      {/* ── Pool Capacity ──────────────────────────────────────────────────── */}
      {capacity.totalBoxes > 0 && (
        <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-white">Pool Capacity</span>
            </div>
            <span className="text-[10px] text-gray-500">
              {capacity.onlineBoxes}/{capacity.totalBoxes} boxes online
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full ${capacityColor} transition-all`} style={{ width: `${capacityPercent}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-500">{capacity.usedSlots} / {capacity.totalSlots} slots</span>
            <span className={`text-[10px] font-medium ${capacityPercent > 90 ? 'text-red-400' : 'text-gray-400'}`}>{capacityPercent}%</span>
          </div>
          {capacityPercent >= 90 && (
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Pool near capacity. Add more HyperAIBoxes.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Info Banner ───────────────────────────────────────────────────── */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300 leading-relaxed">
          <strong className="text-blue-200">Pool Status ≠ On-chain Status:</strong>{' '}
          "Active" here means compute is allocated. Your Node Factory may still need
          on-chain activation via Merkelizer.{' '}
          <strong className="text-blue-200">Lock</strong> a session to keep it running even if
          the monitor misses a heartbeat.
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active" value={String(activeSessions.length)} icon={<Activity size={14} className="text-green-400" />} color="green" />
        <StatCard label="Paused" value={String(pausedSessions.length)} icon={<Pause size={14} className="text-amber-400" />} color="amber" />
        <StatCard label="Licenses" value={String(sessions.length)} icon={<Layers size={14} className="text-cyan-400" />} color="cyan" />
        <StatCard label="Uptime" value={`${Math.floor(totalUptime / 3600)}h`} icon={<Clock size={14} className="text-violet-400" />} color="violet" />
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-[10px] text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* ── Sessions List ────────────────────────────────────────────────── */}
      {loading && sessions.length === 0 ? (
        <div className="p-8 text-center">
          <Loader size={24} className="text-indigo-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading pool sessions…</p>
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckCircle2 size={10} /> Active — Compute Running
              </h4>
              <div className="space-y-2">
                {activeSessions.map(s => (
                  <SessionCard key={s.tenantId} session={s} onStop={handleStop} onLockToggle={handleLockToggle} actionId={actionId} />
                ))}
              </div>
            </div>
          )}

          {/* Paused Sessions */}
          {pausedSessions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Pause size={10} /> Paused — Click Activate to Resume
              </h4>
              <div className="space-y-2">
                {pausedSessions.map(s => (
                  <PausedCard key={s.tenantId} session={s} onResume={handleResume} onLockToggle={handleLockToggle} actionId={actionId} />
                ))}
              </div>
            </div>
          )}

          {/* Stopped Sessions */}
          {stoppedSessions.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <StopCircle size={10} /> Stopped
              </h4>
              <div className="space-y-2 opacity-60">
                {stoppedSessions.map(s => (
                  <SessionCard key={s.tenantId} session={s} onStop={() => {}} onLockToggle={() => {}} actionId={actionId} />
                ))}
              </div>
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

// ─── Active Session Card ────────────────────────────────────────────────────

function SessionCard({ session, onStop, onLockToggle, actionId }: {
  session: TillingSession; onStop: (id: string) => void; onLockToggle: (id: string, locked: boolean) => void; actionId: string | null;
}) {
  const isBusy = actionId === session.tenantId;
  const isLocked = session.locked;

  return (
    <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-400" />
          <div>
            <div className="text-xs font-semibold text-white">{session.licenseId.slice(0, 16)}…</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <Box size={10} />{session.boxName}<span>•</span><span className="font-mono">{session.network}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isLocked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Lock size={8} /> Locked
            </span>
          )}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">Compute: active</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">On-chain: check Merkelizer</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Lock Toggle */}
        <button
          onClick={() => onLockToggle(session.tenantId, !!isLocked)}
          disabled={isBusy}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isLocked
              ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70 border border-gray-600/30'
          } disabled:opacity-50`}
          title={isLocked ? 'Unlock to allow auto-pause' : 'Lock to prevent auto-pause'}
        >
          {isBusy ? <RefreshCw size={12} className="animate-spin" /> : isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          {isLocked ? 'Locked' : 'Lock'}
        </button>

        {/* Stop (only if not locked) */}
        {!isLocked && (
          <button
            onClick={() => onStop(session.tenantId)}
            disabled={isBusy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
          >
            {isBusy ? <RefreshCw size={12} className="animate-spin" /> : <Power size={12} />}
            Stop
          </button>
        )}

        {isLocked && (
          <span className="text-[10px] text-indigo-300/60 italic">Unlock to stop</span>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-4 gap-2 text-[10px] mt-2 pt-2 border-t border-green-500/10">
        <div><span className="text-gray-500">Started</span><div className="font-medium">{timeSince(session.startedAt)} ago</div></div>
        <div><span className="text-gray-500">Heartbeat</span><div className={`font-medium ${session.lastHeartbeat > Date.now() - 300000 ? 'text-green-400' : 'text-amber-400'}`}>{timeSince(session.lastHeartbeat)} ago</div></div>
        <div><span className="text-gray-500">Uptime</span><div className="font-medium">{Math.floor((session.uptimeSeconds || 0) / 60)}m</div></div>
        <div><span className="text-gray-500">Node Mgr</span><div className={`font-medium ${session.nodeManagerAlive ? 'text-green-400' : 'text-amber-400'}`}>{session.nodeManagerAlive === undefined ? '…' : session.nodeManagerAlive ? 'Up' : 'Down'}</div></div>
      </div>

      {/* Tiller Status & Activation */}
      <TillerSection session={session} />
    </div>
  );
}

// ─── Tiller Section (shows hyperbox-tiller status + activation flow) ───────

function TillerSection({ session }: { session: TillingSession }) {
  const [tillingState, setTillingState] = useState<'idle' | 'creating' | 'signing' | 'submitting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const hasTiller = session.aimAlive === true;
  const tillingActive = session.tillingActive === true || (session.activeTillersCount || 0) > 0;
  const availableSlots = session.availableSlots ?? 0;
  const activeTillers = session.activeTillersCount ?? 0;

  const handleCreate = async () => {
    setTillingState('creating');
    setError(null);
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.create?.(session.tenantId);
      if (result?.success) {
        setTillingState('signing');
        // Now get the signing message
        await handleGetMessage();
      } else {
        setError(result?.error || 'Create failed');
        setTillingState('error');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      setTillingState('error');
    }
  };

  const handleGetMessage = async () => {
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.getMessage?.(
        session.tenantId, 1, session.licenseId, '17735637771'
      );
      if (result?.message) {
        setMessage(result.message);
        setTillingState('signing');
      } else {
        setError(result?.error || 'Failed to get signing message');
        setTillingState('error');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      setTillingState('error');
    }
  };

  const handleSignAndUpdate = async (signedPayload: any) => {
    setTillingState('submitting');
    try {
      // @ts-ignore
      const result = await window.electronAPI?.stargate?.tilling?.update?.(
        session.tenantId, signedPayload
      );
      if (result?.success) {
        setTillingState('done');
      } else {
        setError(result?.error || 'Update failed');
        setTillingState('error');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
      setTillingState('error');
    }
  };

  if (!hasTiller) {
    return (
      <div className="mt-2 pt-2 border-t border-gray-700/30">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <AlertTriangle size={10} />
          <span>Tiller not available on this box</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-700/30">
      {/* Tiller status row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${tillingActive ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-medium text-gray-300">
            {tillingActive ? 'Tilling Active' : 'Tiller Ready — Not Activated'}
          </span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[10px] text-gray-500 hover:text-gray-300"
        >
          {showDetails ? 'Hide' : 'Details'}
        </button>
      </div>

      {showDetails && (
        <div className="text-[10px] text-gray-400 mb-2 space-y-0.5">
          <div className="flex justify-between"><span>Available Slots:</span><span className="font-mono text-gray-300">{availableSlots}</span></div>
          <div className="flex justify-between"><span>Active Tillers:</span><span className="font-mono text-gray-300">{activeTillers}</span></div>
          <div className="flex justify-between"><span>Tiller Port:</span><span className="font-mono text-gray-300">{session.tillerPort || '9000'}</span></div>
          {session.activeTillers && session.activeTillers.length > 0 && (
            <div className="mt-1 pt-1 border-t border-gray-700/30">
              <span className="text-gray-500">Active tillers:</span>
              {session.activeTillers.map((t) => (
                <div key={t.number} className="font-mono text-[9px] text-gray-400 ml-2">
                  #{t.number} | lic:{t.license} | pri:{t.priority} | addr:{t.address.slice(0, 12)}…
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activation flow */}
      {!tillingActive && (
        <div className="space-y-2">
          {tillingState === 'idle' && (
            <button
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Play size={12} /> Activate Tilling
            </button>
          )}

          {tillingState === 'creating' && (
            <div className="flex items-center gap-2 text-[10px] text-indigo-300">
              <RefreshCw size={12} className="animate-spin" />
              Creating tiller slot…
            </div>
          )}

          {tillingState === 'signing' && (
            <div className="space-y-2">
              <p className="text-[10px] text-amber-300">
                Sign this message with your wallet to activate tilling:
              </p>
              <div className="p-2 rounded bg-gray-900/50 border border-gray-700/30">
                <code className="text-[9px] font-mono text-gray-300 break-all">{message || 'Fetching message…'}</code>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // In a real implementation, this would open a wallet modal
                    // For now, we show instructions
                    alert('Please sign the message shown above with your wallet (MetaMask, etc.) and paste the signature here.\n\nThis is a NON-CUSTODIAL operation — we never hold your private keys.');
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white"
                >
                  Sign with Wallet
                </button>
                <button
                  onClick={() => setTillingState('idle')}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-700/50 text-gray-400 hover:bg-gray-700/70"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[9px] text-gray-500 italic">
                Non-custodial: Your private keys stay in your wallet. We only relay the signed transaction.
              </p>
            </div>
          )}

          {tillingState === 'submitting' && (
            <div className="flex items-center gap-2 text-[10px] text-indigo-300">
              <RefreshCw size={12} className="animate-spin" />
              Submitting signed transaction…
            </div>
          )}

          {tillingState === 'done' && (
            <div className="flex items-center gap-2 text-[10px] text-green-400">
              <CheckCircle2 size={12} />
              Tilling activated! Refresh to see updated status.
            </div>
          )}

          {tillingState === 'error' && error && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-red-400">
                <AlertTriangle size={12} />
                {error}
              </div>
              <button
                onClick={() => setTillingState('idle')}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-gray-700/50 text-gray-400 hover:bg-gray-700/70"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {tillingActive && (
        <div className="flex items-center gap-2 text-[10px] text-green-400">
          <CheckCircle2 size={12} />
          <span>Tilling active — {activeTillers} tiller{activeTillers === 1 ? '' : 's'} running</span>
        </div>
      )}
    </div>
  );
}

// ─── Paused Card (Big Activate Button) ─────────────────────────────────────

function PausedCard({ session, onResume, onLockToggle, actionId }: {
  session: TillingSession; onResume: (id: string) => void; onLockToggle: (id: string, locked: boolean) => void; actionId: string | null;
}) {
  const isBusy = actionId === session.tenantId;
  const isLocked = session.locked;

  return (
    <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pause size={14} className="text-amber-400" />
          <div>
            <div className="text-xs font-semibold text-white">{session.licenseId.slice(0, 16)}…</div>
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <Box size={10} />{session.boxName}<span>•</span><span className="font-mono">{session.network}</span>
            </div>
          </div>
        </div>
        {isLocked && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <Lock size={8} /> Locked
          </span>
        )}
      </div>

      {/* Explanation */}
      <p className="text-[10px] text-amber-300/70 mb-3">
        This Node Factory is paused — compute was deallocated. Click <strong>Activate</strong> to re-provision.
      </p>

      {/* Big Actions */}
      <div className="flex items-center gap-2">
        {/* PRIMARY: Activate */}
        <button
          onClick={() => onResume(session.tenantId)}
          disabled={isBusy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 shadow-lg shadow-green-900/20"
        >
          {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {isBusy ? 'Activating…' : 'Activate'}
        </button>

        {/* Lock Toggle */}
        <button
          onClick={() => onLockToggle(session.tenantId, !!isLocked)}
          disabled={isBusy}
          className={`flex items-center gap-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
            isLocked
              ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70 border border-gray-600/30'
          } disabled:opacity-50`}
          title={isLocked ? 'Unlock to allow auto-pause' : 'Lock to prevent auto-pause'}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-2 text-[10px] mt-3 pt-2 border-t border-amber-500/10">
        <div><span className="text-gray-500">Started</span><div className="font-medium">{timeSince(session.startedAt)} ago</div></div>
        <div><span className="text-gray-500">Paused</span><div className="font-medium text-amber-400">{timeSince(session.lastHeartbeat)} ago</div></div>
        <div><span className="text-gray-500">Uptime</span><div className="font-medium">{Math.floor((session.uptimeSeconds || 0) / 60)}m</div></div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="p-6 text-center rounded-lg bg-gray-900/30 border border-gray-700/30">
      <Layers size={24} className="text-indigo-400 mx-auto mb-2 opacity-50" />
      <p className="text-xs text-gray-400 mb-1">No licenses in Stargate Pool</p>
      <p className="text-[10px] text-gray-500">
        Click <span className="px-1 rounded bg-indigo-500/20 text-indigo-300">🌌 Delegate to Pool</span> on any Node Factory card to add it here.
      </p>
    </div>
  );
}

// ─── Validator Fleet Dashboard (embedded in Stargate Pool) ─────────────────

function ValidatorFleetDashboard() {
  const { telemetry, loading, error, refresh } = useValidatorTelemetry();

  return (
    <ValidatorFleetGrid
      validators={telemetry}
      poolName="Battery Coin (batterycoin-1)"
      loading={loading}
      error={error}
      onRefresh={refresh}
      columns={{ sm: 1, md: 1, lg: 2, xl: 2 }}
    />
  );
}

export default StargatePoolDashboard;