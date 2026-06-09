import React, { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, Trophy, Activity, Server, HelpCircle } from 'lucide-react';
import { ActiveNodesDisplay } from './components/ActiveNodesDisplay';
import { AimProfilePage } from './components/AimProfilePage';
// NOTE: AimDetailView is preserved as dead code — do not delete. See Stage 8A-PRELIM.
import { MetricCard } from './components/MetricCard';
import { LeaderboardTable } from './components/LeaderboardTable';
import { AimsList } from './components/AimsList';
import { NodesList } from './components/NodesList';
import { NodeDetailPanel } from './components/NodeDetailPanel';
import { LivenessBadge } from './components/LivenessBadge';
import { ToolScoreData } from './types';
import { relativeTime, freshnessStatus } from './utils';

const TABS = {
  AIMS: 'aims',
  LEADERBOARD: 'leaderboard',
  NODES: 'nodes'
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const HyperInsightView = () => {
  const [status, setStatus] = useState({ loading: true, registered: false, error: null as string | null });
  const [activeTab, setActiveTab] = useState(TABS.LEADERBOARD);
  const [data, setData] = useState({ aims: [], leaderboard: [], nodes: [], stats: null as any, history: null as any });
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedAim, setSelectedAim] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [toolScores, setToolScores] = useState<Record<string, ToolScoreData>>({});
  const lastManualRefreshAt = useRef<number>(0);
  const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

  // Initial Registration / Key Check
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.electronAPI?.hyperinsight) {
          throw new Error("HyperInsight API not available. Please restart the application.");
        }
        const s = await window.electronAPI.hyperinsight.getStatus();
        if (s.registered) {
          setStatus({ loading: false, registered: true, error: null });
          fetchData();
        } else {
          // Attempt registration
          const reg = await window.electronAPI.hyperinsight.ensureKey();
          if (reg.success) {
            setStatus({ loading: false, registered: true, error: null });
            fetchData();
          } else {
            setStatus({ loading: false, registered: false, error: reg.error || "Registration failed" });
          }
        }
      } catch (err: any) {
        setStatus({ loading: false, registered: false, error: err.message });
      }
    };
    init();
  }, []);

  const handleRefresh = async () => {
    if (dataLoading) return;
    if (Date.now() - lastManualRefreshAt.current < MANUAL_REFRESH_COOLDOWN_MS) return;
    lastManualRefreshAt.current = Date.now();
    await window.electronAPI.hyperinsight.clearCache?.().catch(() => {});
    // Prime the active-tab endpoint in cache so the subsequent Promise.all doesn't
    // cold-start all 6 requests simultaneously.
    if (activeTab === TABS.LEADERBOARD) {
      await window.electronAPI.hyperinsight.getLeaderboard?.().catch(() => {});
    } else if (activeTab === TABS.NODES) {
      await window.electronAPI.hyperinsight.getNodes?.().catch(() => {});
    } else if (activeTab === TABS.AIMS) {
      await window.electronAPI.hyperinsight.getAims?.().catch(() => {});
    }
    fetchData();
  };

  const fetchData = async () => {
    setDataLoading(true);
    try {
      if (!window.electronAPI?.hyperinsight) {
        console.warn("HyperInsight API missing during fetch");
        return;
      }
      const [aims, leaderboard, nodes, stats, history] = await Promise.all([
        window.electronAPI.hyperinsight.getAims().catch(e => []),
        window.electronAPI.hyperinsight.getLeaderboard().catch(e => []),
        window.electronAPI.hyperinsight.getNodes().catch(e => []),
        window.electronAPI.hyperinsight.getNetworkStats ? window.electronAPI.hyperinsight.getNetworkStats().catch(e => null) : Promise.resolve(null),
        window.electronAPI.hyperinsight.getNetworkHistory ? window.electronAPI.hyperinsight.getNetworkHistory().catch(e => null) : Promise.resolve(null)
      ]);
      setData({
          aims: Array.isArray(aims) ? aims : [],
          leaderboard: Array.isArray(leaderboard) ? leaderboard : [],
          nodes: Array.isArray(nodes) ? nodes : [],
          stats: stats,
          history: history
      });

      const scoresRaw: Record<string, ToolScoreData> | null =
        await window.electronAPI.hyperinsight.getAllToolScores().catch(() => null);
      setToolScores(scoresRaw ?? {});
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleAimClick = (aimName: string) => {
    setSelectedAim(aimName);
  };

  // Derive health breakdown from tool scores (24h window)
  const now = Date.now();
  const recentScores = Object.values(toolScores).filter(
    s => s.lastProbedAt && (now - new Date(s.lastProbedAt).getTime()) < TWENTY_FOUR_HOURS_MS
  );
  const healthBreakdown = {
    healthy:  recentScores.filter(s => (s.healthScore ?? 0) >= 80).length,
    degraded: recentScores.filter(s => (s.healthScore ?? 0) >= 50 && (s.healthScore ?? 0) < 80).length,
    unhealthy: recentScores.filter(s => (s.healthScore ?? 0) < 50).length,
    verifiedCount: recentScores.length,
  };
  const scoresLastUpdated = Object.values(toolScores).reduce<string | null>((latest, s) => {
    return !latest || s.updatedAt > latest ? s.updatedAt : latest;
  }, null);

  if (status.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <Loader2 className="animate-spin mr-2" /> Initializing HyperInsight...
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--background)] text-[var(--danger)]">
        <p className="mb-4">Error: {status.error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[var(--surface)] rounded hover:bg-[var(--surfaceAlt)] text-[var(--text)]">Retry</button>
      </div>
    );
  }

  // AIM profile page replaces the entire dashboard view
  if (selectedAim) {
    return (
      <>
        <AimProfilePage
          aimName={selectedAim}
          onBack={() => setSelectedAim(null)}
          onNodeSelect={(license) => setSelectedNode(String(license))}
        />
        {selectedNode && (
          <NodeDetailPanel
            licenseKey={selectedNode}
            onClose={() => setSelectedNode(null)}
            toolScores={toolScores}
          />
        )}
      </>
    );
  }

  const networkFreshnessUtc: string | null = data.stats?.data_freshness_utc ?? null;

  const computeCghzFormatted = data.stats?.totalComputeCghz
    ? (data.stats.totalComputeCghz >= 1000
        ? (data.stats.totalComputeCghz / 1000).toFixed(1) + 'k'
        : data.stats.totalComputeCghz.toFixed(0))
    : '0';

  return (
    <div className="flex h-full w-full flex-col bg-[var(--background)] text-[var(--text)] font-sans overflow-hidden relative">
      {/* Header - Fixed at top */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--overlay)] backdrop-blur z-40 shrink-0">
        <div className="flex items-center gap-2">
            <div className="text-2xl font-bold tracking-tight text-[var(--text)] font-mono">
                Hyper<span className="text-[var(--primary)]">Insight</span>
            </div>
            <div className="relative group/tooltip">
                <div className="p-1 rounded-lg text-[var(--textMuted)] hover:text-[var(--text)] transition-colors cursor-help">
                    <HelpCircle size={14} />
                </div>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 p-2 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl text-xs text-[var(--text)] z-10 opacity-0 group-hover/tooltip:opacity-70 transition-opacity pointer-events-none group-hover/tooltip:pointer-events-auto">
                    Be aware data is currently fuzzy and subject to change while the network continues to improve. 
                </div>
            </div>
        </div>
        <div className="flex items-center space-x-4">
            <ActiveNodesDisplay stats={data.stats} history={data.history} />
            <button
                onClick={handleRefresh}
                disabled={dataLoading}
                className="p-2 rounded-full hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
            >
                <RefreshCw size={18} className={dataLoading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>

      {/* Content Wrapper */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Main Scrollable Content Area */}
          <div className="flex-1 overflow-auto custom-scrollbar">
              <>
                    {/* Metric Cards Section */}
                    <div className="px-6 pt-6 grid gap-4 md:grid-cols-3">
                        <MetricCard
                            title="Active AIMs"
                            value={dataLoading ? '...' : (data.leaderboard?.length || 0)}
                            chartData={data.history?.activeAims}
                            tooltipText="AIMs witnessed as active via OSINT within the previous 24hrs."
                            subtextNode={
                              healthBreakdown.verifiedCount > 0 ? (
                                <span className="inline-flex items-center gap-1 flex-wrap">
                                  <LivenessBadge healthScore={80} size="sm" />
                                  <span>{healthBreakdown.healthy} healthy</span>
                                  <span className="mx-0.5">·</span>
                                  <LivenessBadge healthScore={65} size="sm" />
                                  <span>{healthBreakdown.degraded} degraded</span>
                                  <span className="mx-0.5">·</span>
                                  <LivenessBadge healthScore={0} size="sm" />
                                  <span>{healthBreakdown.unhealthy} unhealthy</span>
                                </span>
                              ) : undefined
                            }
                        />
                        <MetricCard
                            title="Available AIMs"
                            value={dataLoading ? '...' : (data.stats?.totalAimsAvailable || 0)}
                            chartData={data.history?.availableAims}
                            subtext={undefined}
                            tooltipText="Total public AIMs currently available to be deployed."
                        />
                        <MetricCard
                            title="Network Compute (Est.)"
                            value={dataLoading ? '...' : `${data.stats?.totalComputeTflops ? (data.stats.totalComputeTflops >= 1000 ? (data.stats.totalComputeTflops / 1000).toFixed(1) + 'k' : data.stats.totalComputeTflops.toFixed(1)) : '0'} TFLOPS`}
                            chartData={data.history?.computeTflops}
                            tooltipText="TFLOPs is a sum of the feasible current GPU computational capacity of the network. Core-GHZ is an estimation of the current number of cores x avg ghz of cores on the network."
                            subtextNode={
                              <span className="flex flex-col gap-0.5">
                                <span>{computeCghzFormatted} core-GHz</span>
                                <span>From {healthBreakdown.verifiedCount} verified endpoints (24h)</span>
                              </span>
                            }
                        />
                    </div>

                    {/* Data Freshness */}
                    {(networkFreshnessUtc || scoresLastUpdated) && (
                      <div className="px-6 pt-2 pb-1 flex items-center gap-6 text-xs">
                        {networkFreshnessUtc && (() => {
                          const status = freshnessStatus(networkFreshnessUtc);
                          const cls = status === 'fresh' ? 'text-[var(--textMuted)]'
                                    : status === 'stale' ? 'text-amber-400'
                                    : 'text-red-400';
                          return <span className={cls}>Network data as of {relativeTime(networkFreshnessUtc)}</span>;
                        })()}
                        {scoresLastUpdated && (() => {
                          const status = freshnessStatus(scoresLastUpdated);
                          const cls = status === 'fresh' ? 'text-[var(--textMuted)]'
                                    : status === 'stale' ? 'text-amber-400'
                                    : 'text-red-400';
                          return <span className={cls}>Scores updated {relativeTime(scoresLastUpdated)}</span>;
                        })()}
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex px-6 pt-4 border-b border-[var(--border)] gap-6">
                        <TabButton id={TABS.LEADERBOARD} label="Leaderboard" icon={Trophy} active={activeTab === TABS.LEADERBOARD} onClick={setActiveTab} />
                        <TabButton id={TABS.AIMS} label="Aims" icon={Activity} active={activeTab === TABS.AIMS} onClick={setActiveTab} />
                        <TabButton id={TABS.NODES} label="Nodes" icon={Server} active={activeTab === TABS.NODES} onClick={setActiveTab} />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === TABS.AIMS && <AimsList data={data.aims} loading={dataLoading} onSelect={handleAimClick} toolScores={toolScores} />}
                        {activeTab === TABS.LEADERBOARD && <LeaderboardTable data={data.leaderboard} loading={dataLoading} onSelect={handleAimClick} toolScores={toolScores} />}
                        {activeTab === TABS.NODES && <NodesList data={data.nodes} loading={dataLoading} onSelectNode={setSelectedNode} />}
                    </div>
                </>
          </div>

          {/* Node Detail Panel Overlay */}
          {selectedNode && (
              <NodeDetailPanel
                licenseKey={selectedNode}
                onClose={() => setSelectedNode(null)}
                toolScores={toolScores}
              />
          )}
      </div>
    </div>
  );
};

const TabButton = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-all ${
      active 
        ? "border-[var(--primary)] text-[var(--primary)]" 
        : "border-transparent text-[var(--textMuted)] hover:text-[var(--text)]"
    }`}
  >
    <Icon size={16} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);
