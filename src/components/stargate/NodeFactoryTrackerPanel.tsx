// =============================================================================
// NODE FACTORY TRACKER PANEL — Stargate Operations Center (v1)
// Foundation for future Node Factory Operations Center
// Integrates CBNO Node Factory Tracker into Mosaic-Companion Start tab
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu, FileJson, Globe,
  HeartCrack, Loader, RefreshCw, Search, Server, Settings2, ShieldCheck,
  TrendingUp, XCircle, Zap, ChevronDown, ChevronUp, ExternalLink,
  FolderOpen, Network
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DelegateSignature {
  signature: string;
  key: string;
}

interface DelegateOwner {
  chain?: string;
  address?: string;
}

interface DelegateData {
  owner?: DelegateOwner;
  key?: string;
  block?: number;
  message?: string;
  signature?: DelegateSignature;
  chypc?: number;
  priority?: number;
  did?: string;
}

interface RawLicenseResponse {
  status?: string;
  'status-since'?: number;
  delegate_data?: DelegateData;
  error?: string;
}

export interface LicenseStatus {
  license_id: string;
  expected_chain: string;
  status: 'alive' | 'dead' | 'error' | 'loading';
  status_since_utc: string;
  raw_timestamp: number | null;
  delegate_data?: DelegateData;
  raw_error?: string;
}

interface LicensesJson {
  [network: string]: string[];
}

interface FleetSummary {
  total: number;
  alive: number;
  dead: number;
  error: number;
  loading: number;
  byNetwork: Record<string, { total: number; alive: number; dead: number; error: number }>;
}

interface TrackerSettings {
  licensesJsonPath: string | null;
  apiBase: string;
  autoRefresh: boolean;
  refreshIntervalSeconds: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_API_BASE = 'http://YOUR_HYPERCYCLE_NODE_IP:8003';
const STORAGE_KEY_SETTINGS = 'node_factory_tracker_settings';
const STORAGE_KEY_HISTORY = 'node_factory_tracker_history';

const STATUS_META = {
  alive:   { label: 'ALIVE',   color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20',   icon: CheckCircle2, tone: 'green' },
  dead:    { label: 'DEAD',    color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: HeartCrack,   tone: 'red' },
  error:   { label: 'ERROR',   color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: AlertTriangle, tone: 'orange' },
  loading: { label: 'LOADING', color: 'text-gray-400',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',    icon: Loader,       tone: 'gray' },
};

const NETWORK_META: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  base:     { color: 'text-purple-400',  bg: 'bg-purple-500/10',  icon: <Zap size={12} /> },
  ethereum: { color: 'text-blue-400',    bg: 'bg-blue-500/10',   icon: <Globe size={12} /> },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadSettings(): TrackerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        licensesJsonPath: parsed.licensesJsonPath ?? null,
        apiBase: parsed.apiBase || DEFAULT_API_BASE,
        autoRefresh: parsed.autoRefresh ?? true,
        refreshIntervalSeconds: parsed.refreshIntervalSeconds || 30,
      };
    }
  } catch { /* silent */ }
  return {
    licensesJsonPath: null,
    apiBase: DEFAULT_API_BASE,
    autoRefresh: true,
    refreshIntervalSeconds: 30,
  };
}

function saveSettings(s: TrackerSettings) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s));
}

function utcFromTimestamp(ts: number | null | undefined): string {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch { return 'N/A'; }
}

function timeSince(ts: number | null): string {
  if (!ts) return 'N/A';
  const seconds = Math.floor((Date.now() / 1000) - ts);
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NodeFactoryTrackerPanel() {
  // Settings
  const [settings, setSettings] = useState<TrackerSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  // Data
  const [licensesMap, setLicensesMap] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<LicenseStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // UI
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set(['base', 'ethereum']));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Persistence ──────────────────────────────────────────────────────────
  useEffect(() => { saveSettings(settings); }, [settings]);

  // ── Auto refresh ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (settings.autoRefresh && licensesMap && Object.keys(licensesMap).length > 0) {
      intervalRef.current = setInterval(() => { refreshAll(); }, settings.refreshIntervalSeconds * 1000);
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [settings.autoRefresh, settings.refreshIntervalSeconds, licensesMap]);

  // ── File Picker ──────────────────────────────────────────────────────────
  const pickLicenseFile = useCallback(async () => {
    setLoadError(null);
    try {
      const picked = await window.electronAPI?.dialog?.openFile?.({
        filters: [{ name: 'JSON Licenses', extensions: ['json'] }],
      });
      if (!picked) return;
      setSettings(prev => ({ ...prev, licensesJsonPath: picked as string }));
      await loadLicensesFromPath(picked as string);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to pick file');
    }
  }, []);

  // ── Clear / Disconnect File ──────────────────────────────────────────────
  const clearLicenseFile = useCallback(() => {
    setLicensesMap({});
    setResults([]);
    setLastUpdated(null);
    setLoadError(null);
    setSettings(prev => ({ ...prev, licensesJsonPath: null }));
  }, []);

  // ── Load Licenses JSON ───────────────────────────────────────────────────
  const loadLicensesFromPath = useCallback(async (filePath: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await window.electronAPI?.nodeFactory?.loadJsonFile(filePath);
      if (!res?.success) throw new Error(res?.error || 'Failed to load licenses JSON');
      const data: LicensesJson = res.data;
      // Normalize and deduplicate
      const normalized: Record<string, string[]> = {};
      for (const [network, list] of Object.entries(data)) {
        const clean = list.map(id => String(id).replace(/[^0-9a-zA-Z]/g, '').trim()).filter(Boolean);
        // Dedup within network
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const id of clean) {
          if (!seen.has(id)) { seen.add(id); deduped.push(id); }
        }
        normalized[network.toLowerCase()] = deduped;
      }
      setLicensesMap(normalized);
      // Initial fetch
      await checkFleet(normalized);
    } catch (e: any) {
      setLoadError(e.message);
      setLicensesMap({});
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Check Single License ─────────────────────────────────────────────────
  const checkLicense = useCallback(async (licenseId: string, expectedNetwork: string): Promise<LicenseStatus> => {
    try {
      const res = await window.electronAPI?.nodeFactory?.checkLicense(licenseId, settings.apiBase);
      if (!res) throw new Error('IPC returned null');

      if (res.error) {
        return {
          license_id: licenseId,
          expected_chain: expectedNetwork,
          status: 'error',
          status_since_utc: 'N/A',
          raw_timestamp: null,
          raw_error: res.error,
        };
      }

      const raw: RawLicenseResponse = res.data;
      const statusLower = (raw.status || 'dead').toLowerCase();
      const delegate = raw.delegate_data;

      // Prefer chain from delegate owner, fallback to expected network
      const resolvedChain = (delegate?.owner?.chain || expectedNetwork).toLowerCase();
      const ts = raw['status-since'] ?? null;

      return {
        license_id: licenseId,
        expected_chain: expectedNetwork,
        status: statusLower === 'alive' ? 'alive' : 'dead',
        status_since_utc: utcFromTimestamp(ts),
        raw_timestamp: ts,
        delegate_data: delegate,
        raw_error: raw.error,
      };
    } catch (e: any) {
      return {
        license_id: licenseId,
        expected_chain: expectedNetwork,
        status: 'error',
        status_since_utc: 'N/A',
        raw_timestamp: null,
        raw_error: e.message,
      };
    }
  }, [settings.apiBase]);

  // ── Check Fleet ──────────────────────────────────────────────────────────
  const checkFleet = useCallback(async (map: Record<string, string[]>) => {
    const allEntries: { id: string; network: string }[] = [];
    for (const [network, ids] of Object.entries(map)) {
      for (const id of ids) { allEntries.push({ id, network }); }
    }

    if (allEntries.length === 0) { setResults([]); return; }

    setLoading(true);
    setLoadError(null);
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    try {
      // Start with loading states
      const initial: LicenseStatus[] = allEntries.map(e => ({
        license_id: e.id,
        expected_chain: e.network,
        status: 'loading',
        status_since_utc: 'N/A',
        raw_timestamp: null,
      }));
      setResults(initial);

      // Check individually (sequential with early abort)
      const checked: LicenseStatus[] = [];
      for (const { id, network } of allEntries) {
        if (ac.signal.aborted) break;
        const result = await checkLicense(id, network);
        checked.push(result);
        // Update incrementally
        setResults(prev => {
          const next = [...prev];
          const idx = next.findIndex(r => r.license_id === id);
          if (idx !== -1) next[idx] = result;
          return next;
        });
      }
      setLastUpdated(new Date());

      // Persist to history
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify({
          timestamp: Date.now(),
          results: checked,
        }));
      } catch { /* silent */ }
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [checkLicense]);

  // ── Refresh All ──────────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (Object.keys(licensesMap).length === 0) return;
    await checkFleet(licensesMap);
  }, [licensesMap, checkFleet]);

  // ── Restore on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const savedPath = settings.licensesJsonPath;
    if (savedPath) {
      loadLicensesFromPath(savedPath).catch(() => {
        // If file gone, clear
        setSettings(prev => ({ ...prev, licensesJsonPath: null }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────
  const fleet = React.useMemo((): FleetSummary => {
    const out: FleetSummary = {
      total: 0, alive: 0, dead: 0, error: 0, loading: 0,
      byNetwork: {},
    };
    for (const r of results) {
      out.total++;
      out[r.status]++;
      const net = r.expected_chain;
      if (!out.byNetwork[net]) out.byNetwork[net] = { total: 0, alive: 0, dead: 0, error: 0 };
      out.byNetwork[net].total++;
      if (r.status !== 'loading') out.byNetwork[net][r.status]++;
    }
    return out;
  }, [results]);

  const alerts = React.useMemo(() => results.filter(r => r.status === 'dead' || r.status === 'error'), [results]);

  const filteredResults = React.useMemo(() => {
    let out = results;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      out = out.filter(r => r.license_id.toLowerCase().includes(q) || r.expected_chain.toLowerCase().includes(q));
    }
    if (selectedStatuses.size > 0) {
      out = out.filter(r => selectedStatuses.has(r.status));
    }
    return out;
  }, [results, searchQuery, selectedStatuses]);

  const groupedByNetwork = React.useMemo(() => {
    const groups: Record<string, LicenseStatus[]> = {};
    for (const r of filteredResults) {
      const net = r.expected_chain;
      if (!groups[net]) groups[net] = [];
      groups[net].push(r);
    }
    return groups;
  }, [filteredResults]);

  const toggleNetworkExpand = (network: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev);
      if (next.has(network)) next.delete(network); else next.add(network);
      return next;
    });
  };

  const toggleStatusFilter = (status: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: keyof typeof STATUS_META }) => {
    const meta = STATUS_META[status] || STATUS_META.loading;
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
        <Icon size={12} /> {meta.label}
      </span>
    );
  };

  const NetworkBadge = ({ network }: { network: string }) => {
    const meta = NETWORK_META[network.toLowerCase()] || { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <Globe size={12} /> };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.color}`}>
        {meta.icon} {network.charAt(0).toUpperCase() + network.slice(1)}
      </span>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 mt-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
            <Network size={20} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Node Factory Ops</h3>
            <p className="text-xs text-gray-400">
              {fleet.total > 0
                ? `${fleet.alive} alive · ${fleet.dead} dead · ${fleet.error} error · ${fleet.total} total`
                : 'CBNO license fleet health monitoring'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <Clock size={10} />
              {timeSince(lastUpdated.getTime() / 1000)}
            </span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-gray-800 text-gray-400'}`}
            title="Settings"
          >
            <Settings2 size={16} />
          </button>
          <button
            onClick={refreshAll}
            disabled={loading || fleet.total === 0}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-30 text-gray-400"
            title="Refresh fleet"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── Settings Panel ───────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="p-4 rounded-xl bg-gray-800/50 border border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto Refresh */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Auto Refresh</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSettings(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    settings.autoRefresh
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'bg-gray-700/30 text-gray-400 border-gray-600/30'
                  }`}
                >
                  {settings.autoRefresh ? 'ON' : 'OFF'}
                </button>
                <select
                  value={settings.refreshIntervalSeconds}
                  onChange={e => setSettings(prev => ({ ...prev, refreshIntervalSeconds: Number(e.target.value) }))}
                  disabled={!settings.autoRefresh}
                  className="px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-30"
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={300}>5m</option>
                </select>
              </div>
            </div>
          </div>
          {/* File Path Display */}
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Licenses JSON Path</label>
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-gray-500 shrink-0" />
              <span className="flex-1 text-sm text-gray-300 truncate">
                {settings.licensesJsonPath || 'No file selected'}
              </span>
              <button
                onClick={pickLicenseFile}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Browse…
              </button>
              {settings.licensesJsonPath && (
                <button
                  onClick={clearLicenseFile}
                  className="px-2 py-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                  title="Disconnect file"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File Picker (when no file set) ──────────────────────────────────── */}
      {!settings.licensesJsonPath && (
        <div className="p-8 rounded-xl border border-dashed border-gray-700 bg-gray-800/30 text-center">
          <FileJson size={32} className="mx-auto mb-3 text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-300 mb-1">Select Licenses JSON</h4>
          <p className="text-xs text-gray-500 mb-4">Load your CBNO license registry to begin fleet monitoring</p>
          <button
            onClick={pickLicenseFile}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <FolderOpen size={14} /> Browse for licenses.json
          </button>
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <span className="text-sm text-red-300">{loadError}</span>
        </div>
      )}

      {/* ── Alerts Banner ──────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-sm font-semibold text-red-300">Fleet Alerts ({alerts.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.slice(0, 8).map(a => (
              <button
                key={a.license_id}
                onClick={() => setSearchQuery(a.license_id)}
                className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
              >
                {a.license_id.slice(0, 12)}… — {a.status.toUpperCase()}
              </button>
            ))}
            {alerts.length > 8 && (
              <span className="px-2 py-1 rounded bg-gray-700/30 text-xs text-gray-400">
                +{alerts.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Fleet Summary Cards ────────────────────────────────────────────── */}
      {fleet.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Nodes', value: fleet.total, color: 'text-white', icon: Server },
            { label: 'Alive', value: fleet.alive, color: 'text-green-400', icon: Activity },
            { label: 'Dead', value: fleet.dead, color: 'text-red-400', icon: HeartCrack },
            { label: 'Error', value: fleet.error, color: 'text-orange-400', icon: AlertTriangle },
          ].map(card => (
            <div key={card.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{card.label}</span>
                <card.icon size={14} className={card.color} />
              </div>
              <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      {fleet.total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by license ID or network…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {(['alive', 'dead', 'error', 'loading'] as const).map(s => (
            <button
              key={s}
              onClick={() => toggleStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                selectedStatuses.has(s)
                  ? `${STATUS_META[s].bg} ${STATUS_META[s].color} ${STATUS_META[s].border}`
                  : 'bg-gray-800/50 text-gray-500 border-gray-700 hover:border-gray-600'
              }`}
            >
              {STATUS_META[s].label} ({fleet[s]})
            </button>
          ))}
          {selectedStatuses.size > 0 && (
            <button
              onClick={() => setSelectedStatuses(new Set())}
              className="text-xs text-gray-400 hover:text-gray-300 underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Network Sections ───────────────────────────────────────────────── */}
      {Object.keys(groupedByNetwork).length > 0 ? (
        Object.entries(groupedByNetwork).map(([network, networkResults]) => {
          const isExpanded = expandedNetworks.has(network);
          const netMeta = NETWORK_META[network.toLowerCase()] || { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <Globe size={12} /> };
          const netFleet = fleet.byNetwork[network] || { total: 0, alive: 0, dead: 0, error: 0 };
          return (
            <div key={network} className="rounded-xl border border-gray-700 overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleNetworkExpand(network)}
                className="w-full px-4 py-3 bg-gray-800/70 flex items-center justify-between hover:bg-gray-800/90 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${netMeta.bg} ${netMeta.color} border border-gray-700`}>
                    {netMeta.icon} {network.charAt(0).toUpperCase() + network.slice(1)}
                  </span>
                  <span className="text-xs text-gray-400">{networkResults.length} nodes</span>
                  {netFleet.alive > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                      {netFleet.alive} online
                    </span>
                  )}
                  {netFleet.dead > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      {netFleet.dead} down
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {/* Section Body */}
              {isExpanded && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {networkResults.map(result => (
                    <NodeCard key={result.license_id} data={result} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : settings.licensesJsonPath && !loading ? (
        <div className="text-center py-8 text-gray-500">
          <Search size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No results match your filters</p>
        </div>
      ) : null}

      {/* ── Empty / Not Configured ─────────────────────────────────────────── */}
      {!settings.licensesJsonPath && !loadError && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-sm">Pick a licenses.json file above to load your fleet</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function NodeCard({ data }: { data: LicenseStatus }) {
  const [showDetails, setShowDetails] = useState(false);
  const meta = STATUS_META[data.status] || STATUS_META.loading;
  const StatusIcon = meta.icon;

  const owner = data.delegate_data?.owner;
  const keyPreview = data.delegate_data?.key ? data.delegate_data.key.slice(0, 20) + '…' : '—';
  const blockNum = data.delegate_data?.block ?? '—';
  const priority = data.delegate_data?.priority ?? '—';
  const chypc = data.delegate_data?.chypc ?? '—';

  return (
    <div className={`relative p-4 rounded-xl border transition-all hover:border-opacity-50 ${
      data.status === 'alive' ? 'bg-gray-800/40 border-green-500/10 hover:border-green-500/30' :
      data.status === 'dead' ? 'bg-red-950/20 border-red-500/10 hover:border-red-500/30' :
      'bg-orange-950/10 border-orange-500/10 hover:border-orange-500/30'
    }`}>
      {/* Status dot */}
      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${
        data.status === 'alive' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' :
        data.status === 'dead' ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' :
        'bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]'
      }`} />

      {/* License ID */}
      <div className="flex items-start gap-2 mb-3">
        <ShieldCheck size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-mono text-sm text-white font-medium">{data.license_id}</div>
          <NetworkBadgeCompact network={data.expected_chain} />
        </div>
      </div>

      {/* Status + Timestamp */}
      <div className="flex items-center justify-between mb-3">
        <StatusBadgeTiny status={data.status} />
        <span className="text-[10px] text-gray-500">{data.status_since_utc === 'N/A' ? '—' : timeSince(data.raw_timestamp)}</span>
      </div>

      {/* Quick stats row */}
      {data.delegate_data && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <QuickStat label="Block" value={String(blockNum)} />
          <QuickStat label="Priority" value={String(priority)} />
          <QuickStat label="Chypc" value={String(chypc)} />
        </div>
      )}

      {/* Expand / Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
      >
        {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showDetails ? 'Hide delegate data' : 'Show delegate data'}
      </button>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2 text-xs">
          {owner?.address && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-16">Owner</span>
              <span className="font-mono text-gray-300 truncate" title={owner.address}>
                {owner.address.slice(0, 8)}…{owner.address.slice(-6)}
              </span>
            </div>
          )}
          {data.delegate_data?.key && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-16">Key</span>
              <span className="font-mono text-gray-400 break-all">{keyPreview}</span>
            </div>
          )}
          {data.delegate_data?.did && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-16">DID</span>
              <span className="font-mono text-gray-400">{data.delegate_data.did}</span>
            </div>
          )}
          {data.raw_error && (
            <div className="flex items-start gap-2">
              <span className="text-red-500 shrink-0 w-16">Error</span>
              <span className="text-red-300 break-all">{data.raw_error}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <span className="text-gray-500 shrink-0 w-16">Since</span>
            <span className="text-gray-400">{data.status_since_utc}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 rounded-md px-2 py-1.5 text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-mono text-gray-300 mt-0.5 truncate">{value}</div>
    </div>
  );
}

function NetworkBadgeCompact({ network }: { network: string }) {
  const meta = NETWORK_META[network.toLowerCase()] || { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <Globe size={10} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${meta.bg} ${meta.color} mt-1`}>
      {meta.icon} {network.charAt(0).toUpperCase() + network.slice(1)}
    </span>
  );
}

function StatusBadgeTiny({ status }: { status: keyof typeof STATUS_META }) {
  const meta = STATUS_META[status] || STATUS_META.loading;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${meta.bg} ${meta.color} ${meta.border}`}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}
