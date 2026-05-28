import React, { useState, useEffect } from 'react';
import { Server, Zap, Cpu, Activity, ChevronDown, ChevronUp, Lock, Info } from 'lucide-react';
import { AimNodeInstanceDto, AimStatsDto, AimDeploymentDto } from '../types';
import { relativeTime, freshnessStatus, scoreToColourClass, formatUsdcMicro } from '../utils';
import { AimTrendChart } from './AimTrendChart';
import { GatedFeature } from './GatedFeature';
import { CompositeScoreBadge } from './CompositeScoreBadge';
import { LivenessBadge } from './LivenessBadge';
import { PollTierBadge } from './PollTierBadge';
import { UptimeBadge } from './UptimeBadge';
import { Tooltip } from './Tooltip';
import { useNodeConnect } from '../hooks/useNodeConnect';

interface AimIntelligenceZoneProps {
  aimName: string;
  nodes: AimNodeInstanceDto[];
  deployments: AimDeploymentDto[];
  stats: AimStatsDto | null;
  dataFreshnessUtc: string | null;
  hasUserGeo: boolean;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onNodeSelect: (nodeLicense: number) => void;
}

// ── Merged row type ───────────────────────────────────────────────────────────

interface MergedDeploymentRow {
  nodeId: string;
  nodeName: string | null;
  nodeLicense: number;
  region: string | null;
  tagName: string;
  isAlive: boolean;
  uptimePercent: number;
  gpuName: string | null;
  computeTflops: number;
  distanceKm: number | null;
  primaryEndpointUrl: string;
  lastContactAt: string;
  compositeScore: number | null;
  healthScore: number | null;
  latencyScore: number | null;
  uptimeScore: number | null;
  hardwareBonus: number | null;
  pollTier: string | null;
  lastProbedAt: string | null;
  consecutiveFailures: number | null;
  releaseTagName: string | null;
  manifestVersion: string | null;
  measuredUptime7d: number | null;
  costMinMicroUsdc: number | null;
  costMaxMicroUsdc: number | null;
  currency: string | null;
  endpointUrl: string | null;
  hasDeploymentData: boolean;
  isRoutable: boolean;
  isLocalOnly?: boolean;
}

function buildMergedRows(
  nodes: AimNodeInstanceDto[],
  deployments: AimDeploymentDto[],
): MergedDeploymentRow[] {
  // Index deployments by nodeLicense — keep highest compositeScore on collision
  const deployMap = new Map<number, AimDeploymentDto>();
  for (const d of deployments) {
    const existing = deployMap.get(d.nodeLicense);
    if (!existing || d.compositeScore > existing.compositeScore) {
      deployMap.set(d.nodeLicense, d);
    }
  }

  const rows: MergedDeploymentRow[] = nodes.map(node => {
    const dep = deployMap.get(node.nodeLicense);
    return {
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeLicense: node.nodeLicense,
      region: dep?.nodeRegion ?? node.region,
      tagName: node.tagName,
      isAlive: node.isAlive,
      uptimePercent: node.uptimePercent,
      gpuName: node.gpuName,
      computeTflops: node.computeTflops,
      distanceKm: node.distanceKm,
      primaryEndpointUrl: node.primaryEndpointUrl,
      lastContactAt: node.lastContactAt,
      compositeScore: dep != null ? dep.compositeScore : node.compositeScore,
      healthScore: dep?.healthScore ?? null,
      latencyScore: dep?.latencyScore ?? null,
      uptimeScore: dep?.uptimeScore ?? null,
      hardwareBonus: dep?.hardwareBonus ?? null,
      pollTier: dep?.pollTier ?? null,
      lastProbedAt: dep?.lastProbedAt ?? null,
      consecutiveFailures: dep?.consecutiveFailures ?? null,
      releaseTagName: dep?.releaseTagName ?? null,
      manifestVersion: dep?.manifestVersion ?? null,
      measuredUptime7d: dep?.measuredUptime7d ?? null,
      costMinMicroUsdc: dep?.costMinMicroUsdc ?? null,
      costMaxMicroUsdc: dep?.costMaxMicroUsdc ?? null,
      currency: dep?.currency ?? null,
      endpointUrl: dep?.endpointUrl ?? null,
      hasDeploymentData: dep !== undefined,
      isRoutable: dep != null ? dep.isRoutable : (node.isRoutable !== undefined ? node.isRoutable : true),
      isLocalOnly: node.isLocalOnly,
    };
  });

  rows.sort((a, b) => {
    if (a.compositeScore == null && b.compositeScore == null) return 0;
    if (a.compositeScore == null) return 1;
    if (b.compositeScore == null) return -1;
    return b.compositeScore - a.compositeScore;
  });

  return rows;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function deriveHealth(nodes: AimNodeInstanceDto[]): { label: string; colour: string; dotClass: string } {
  const aliveNodes = nodes.filter(n => n.isAlive);
  if (aliveNodes.length === 0) return { label: 'Offline', colour: 'text-red-400', dotClass: 'bg-red-500' };
  const maxUptime = Math.max(...aliveNodes.map(n => n.uptimePercent));
  if (maxUptime >= 90) return { label: 'Healthy', colour: 'text-[var(--success)]', dotClass: 'bg-[var(--success)]' };
  return { label: 'Degraded', colour: 'text-amber-400', dotClass: 'bg-amber-400' };
}

function weightedUptime(nodes: AimNodeInstanceDto[]): string {
  const alive = nodes.filter(n => n.isAlive);
  if (alive.length === 0) return '0.0%';
  const totalWeight = alive.reduce((sum, n) => sum + (n.computeTflops || 1), 0);
  const weightedSum = alive.reduce((sum, n) => sum + n.uptimePercent * (n.computeTflops || 1), 0);
  return (weightedSum / totalWeight).toFixed(1) + '%';
}

// ── ConnectButton ─────────────────────────────────────────────────────────────

const ConnectButton = ({ node }: { node: AimNodeInstanceDto }) => {
  const { connect, isConnecting, isConnected, error } = useNodeConnect();
  const connected = isConnected(node.primaryEndpointUrl);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    connect(node.primaryEndpointUrl, {
      licenseKey: String(node.nodeLicense),
      nodeName: node.nodeName ?? undefined,
    });
  };

  if (connected) {
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-[color-mix(in_srgb,var(--success),transparent_85%)] text-[var(--success)] font-medium">
        Connected
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className="px-2 py-0.5 rounded text-xs bg-[var(--primary)] text-white hover:opacity-80 transition-opacity disabled:opacity-50"
    >
      {isConnecting ? '...' : 'Connect'}
    </button>
  );
};

// ── ScoreBreakdownPanel ───────────────────────────────────────────────────────

interface ScoreBreakdownPanelProps {
  deployments: AimDeploymentDto[];
}

const ScoreBreakdownPanel = ({ deployments }: ScoreBreakdownPanelProps) => {
  if (deployments.length === 0) return null;

  const bestDeployment = deployments.reduce(
    (best, d) => (d.compositeScore > best.compositeScore ? d : best),
    deployments[0],
  );
  const avgScore = Math.round(
    deployments.reduce((sum, d) => sum + d.compositeScore, 0) / deployments.length,
  );

  interface SubScoreBar {
    label: string;
    score: number | null;
    tooltip: string;
    isMissing?: boolean;
  }

  const bars: SubScoreBar[] = [
    {
      label: 'Health',
      score: bestDeployment.healthScore,
      tooltip: 'Pass rate of health probes in the last 24h',
    },
    {
      label: 'Latency',
      score: bestDeployment.latencyScore,
      tooltip: 'Response latency score — 100 at 0ms, 0 at 5000ms (measured from HyperInsight servers)',
    },
    {
      label: 'Uptime',
      score: bestDeployment.uptimeScore,
      tooltip: '7-day uptime from HyperInsight probe data',
    },
    {
      // TODO: capabilityScore not yet exposed by API — show placeholder
      label: 'Capability',
      score: null,
      tooltip: 'Manifest completeness — documentation, input/output schemas, cost data',
      isMissing: true,
    },
    {
      // TODO: costScore not yet exposed by API — show placeholder
      label: 'Cost',
      score: null,
      tooltip: 'Cost data present and parseable',
      isMissing: true,
    },
  ];

  return (
    <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="text-xs text-[var(--textMuted)] mb-1">Best available</div>
          <div className="flex items-center gap-2">
            <CompositeScoreBadge
              score={bestDeployment.compositeScore}
              healthScore={bestDeployment.healthScore}
              latencyScore={bestDeployment.latencyScore}
              uptimeScore={bestDeployment.uptimeScore}
              hardwareBonus={bestDeployment.hardwareBonus}
              size="md"
            />
            <span className="text-xs text-[var(--textMuted)]">
              / 100
            </span>
          </div>
        </div>
        <div className="text-xs text-[var(--textMuted)]">
          Network average:{' '}
          <span className="font-mono text-[var(--text)]">{avgScore}/100</span>
          {' · '}
          <span className="font-mono">{deployments.length}</span>{' '}
          deployment{deployments.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-2">
        <div className="text-xs text-[var(--textMuted)] font-medium">Score Breakdown (best deployment)</div>
        {bars.map(({ label, score, tooltip, isMissing }) => {
          const barWidth = isMissing || score == null ? 0 : score;
          const colorClass = !isMissing && score != null ? scoreToColourClass(score) : 'bg-gray-600';
          return (
            <div key={label} className="flex items-center gap-2">
              <Tooltip content={tooltip}>
                <span className="text-xs text-[var(--textMuted)] w-20 shrink-0 cursor-default">
                  {label}
                </span>
              </Tooltip>
              <div className="flex-1 h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                {!isMissing && score != null ? (
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${barWidth}%` }}
                  />
                ) : null}
              </div>
              <span className="text-xs font-mono text-[var(--textMuted)] w-8 text-right shrink-0">
                {isMissing || score == null ? '—' : score}
              </span>
            </div>
          );
        })}
        {/* Hardware bonus row */}
        <div className="flex items-center gap-2">
          <Tooltip content="Additive bonus for verified GPU compute (HyperCycle nodes only)">
            <span className="text-xs text-[var(--textMuted)] w-20 shrink-0 cursor-default">
              Hardware
            </span>
          </Tooltip>
          <div className="flex-1" />
          <span className="text-xs font-mono text-[var(--textMuted)] w-8 text-right shrink-0">
            +{bestDeployment.hardwareBonus}
          </span>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[10px] text-[var(--textMuted)]">
        Latency measured from HyperInsight servers (Canada Central) — relative comparison only
      </p>
    </div>
  );
};

// ── MergedNodeRow ─────────────────────────────────────────────────────────────

interface MergedNodeRowProps {
  row: MergedDeploymentRow;
  hasUserGeo: boolean;
  onSelect: (license: number) => void;
}

const MergedNodeRow = ({ row, hasUserGeo, onSelect }: MergedNodeRowProps) => {
  // Reconstruct AimNodeInstanceDto shape for ConnectButton (uses primaryEndpointUrl)
  const nodeForConnect: AimNodeInstanceDto = {
    nodeId: row.nodeId,
    nodeName: row.nodeName,
    nodeLicense: row.nodeLicense,
    region: row.region,
    tagName: row.tagName,
    isAlive: row.isAlive,
    uptimePercent: row.uptimePercent,
    gpuName: row.gpuName,
    computeTflops: row.computeTflops,
    compositeScore: row.compositeScore,
    distanceKm: row.distanceKm,
    primaryEndpointUrl: row.primaryEndpointUrl,
    lastContactAt: row.lastContactAt,
    isRoutable: row.isRoutable,
    isLocalOnly: row.isLocalOnly,
  };

  const versionLabel = row.releaseTagName ?? row.tagName;
  const costLabel = row.hasDeploymentData ? formatUsdcMicro(row.costMinMicroUsdc) : '—';

  return (
    <tr
      onClick={() => onSelect(row.nodeLicense)}
      className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--surfaceAlt)] cursor-pointer transition-colors${!row.isRoutable ? ' opacity-60' : ''}`}
    >
      {/* Liveness */}
      <td className="py-2.5 px-3 w-8">
        {row.isRoutable ? (
          <LivenessBadge
            healthScore={row.healthScore}
            consecutiveFailures={row.consecutiveFailures ?? undefined}
            size="sm"
          />
        ) : (
          <Tooltip content="Private node — not publicly accessible. This node is behind a NAT or firewall and cannot be connected to.">
            <span className="flex items-center gap-1 text-gray-500">
              <Lock size={12} />
            </span>
          </Tooltip>
        )}
      </td>
      {/* Name */}
      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text)] max-w-[140px]">
        <span className="truncate block" title={row.nodeName ?? String(row.nodeLicense)}>
          {row.nodeName
            ? row.nodeName.substring(0, 20) + (row.nodeName.length > 20 ? '…' : '')
            : `#${row.nodeLicense}`}
        </span>
      </td>
      {/* Region */}
      <td className="py-2.5 px-3 text-xs text-[var(--textMuted)]">{row.region ?? '—'}</td>
      {/* Version */}
      <td className="py-2.5 px-3 font-mono text-xs text-[var(--textMuted)]">{versionLabel}</td>
      {/* Uptime */}
      <td className="py-2.5 px-3">
        <UptimeBadge
          measuredUptime7d={row.measuredUptime7d}
          nodeReportedUptime={row.uptimePercent}
        />
      </td>
      {/* GPU */}
      <td className="py-2.5 px-3 text-xs text-[var(--textMuted)] max-w-[120px]">
        <span className="truncate block" title={row.gpuName ?? undefined}>
          {row.gpuName
            ? row.gpuName.substring(0, 16) + (row.gpuName.length > 16 ? '…' : '')
            : '—'}
        </span>
      </td>
      {/* Compute */}
      <td className="py-2.5 px-3 text-xs font-mono text-[var(--text)]">
        {row.computeTflops.toFixed(2)} TF
      </td>
      {/* Composite score */}
      <td className="py-2.5 px-3">
        {row.compositeScore != null ? (
          <CompositeScoreBadge
            score={row.compositeScore}
            healthScore={row.healthScore}
            latencyScore={row.latencyScore}
            uptimeScore={row.uptimeScore}
            hardwareBonus={row.hardwareBonus}
            size="sm"
          />
        ) : (
          <span className="text-[var(--textMuted)] text-xs">—</span>
        )}
      </td>
      {/* Cost */}
      <td className="py-2.5 px-3 text-xs font-mono text-[var(--textMuted)]">{costLabel}</td>
      {/* Poll tier */}
      <td className="py-2.5 px-3">
        {row.pollTier
          ? <PollTierBadge tier={row.pollTier} />
          : <span className="text-xs text-[var(--textMuted)]">—</span>}
      </td>
      {/* Distance (conditional) */}
      {hasUserGeo && (
        <td className="py-2.5 px-3 text-xs text-[var(--textMuted)]">
          {row.distanceKm != null ? `${Math.round(row.distanceKm)} km` : '—'}
        </td>
      )}
      {/* Connect */}
      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
        {row.isRoutable ? (
          <div className="flex items-center gap-1">
            <ConnectButton node={nodeForConnect} />
            {row.isLocalOnly && (
              <Tooltip content="Private IP — reachable via port forwarding. Connectivity depends on your network.">
                <span className="text-yellow-500 cursor-help"><Info size={11} /></span>
              </Tooltip>
            )}
          </div>
        ) : (
          <Tooltip content="Node is not publicly accessible">
            <button
              disabled
              className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-500 cursor-not-allowed"
            >
              Unreachable
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  );
};

// ── AimIntelligenceZone ───────────────────────────────────────────────────────

export const AimIntelligenceZone = ({
  aimName,
  nodes,
  deployments,
  stats,
  dataFreshnessUtc,
  hasUserGeo,
  expanded,
  onExpandChange,
  onNodeSelect,
}: AimIntelligenceZoneProps) => {
  const [range, setRange] = useState('1d');
  const [metric, setMetric] = useState('activeNodes');
  const [historicalStats, setHistoricalStats] = useState<unknown[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const data = await window.electronAPI.hyperinsight.getAimStats(aimName, range);
        setHistoricalStats(Array.isArray(data) ? data : []);
      } catch {
        setHistoricalStats([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [aimName, range]);

  const health = deriveHealth(nodes);
  const aliveCount = nodes.filter(n => n.isAlive).length;
  const wUptime = weightedUptime(nodes);
  const totalCompute = stats?.totalComputeTflops != null
    ? stats.totalComputeTflops.toFixed(1) + ' TFLOPS'
    : '—';

  const mergedRows = buildMergedRows(nodes, deployments);
  const visibleRows = mergedRows.slice(0, 3);
  const gatedRows = mergedRows.slice(3);

  return (
    <div className="aim-intelligence-zone space-y-4 bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
      <h2 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">Network Intelligence</h2>

      {/* Section A: Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Health */}
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3">
          <div className="text-xs text-[var(--textMuted)] mb-1">Health</div>
          <div className={`flex items-center gap-1.5 font-semibold text-sm ${health.colour}`}>
            <span className={`w-2 h-2 rounded-full ${health.dotClass}`} />
            {health.label}
          </div>
          <div className="text-xs text-[var(--textMuted)] mt-0.5">{aliveCount} alive</div>
        </div>

        {/* Active nodes */}
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--textMuted)] mb-1">
            <Server size={12} /> Active Nodes
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text)]">{aliveCount}</div>
        </div>

        {/* Weighted uptime */}
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--textMuted)] mb-1">
            <Activity size={12} /> Avg Uptime
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text)]">{wUptime}</div>
        </div>

        {/* Total compute */}
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--textMuted)] mb-1">
            <Zap size={12} /> Compute
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text)]">{totalCompute}</div>
        </div>
      </div>

      {/* Score breakdown panel (only when deployment data is present) */}
      {deployments.length > 0 && <ScoreBreakdownPanel deployments={deployments} />}

      {/* Freshness row */}
      {dataFreshnessUtc && (() => {
        const fStatus = freshnessStatus(dataFreshnessUtc);
        const textClass = fStatus === 'fresh' ? 'text-[var(--textMuted)]' : fStatus === 'stale' ? 'text-amber-400' : 'text-red-400';
        const dotClass = fStatus === 'stale' ? 'bg-amber-400' : fStatus === 'very-stale' ? 'bg-red-500' : '';
        return (
          <div className={`flex items-center gap-1.5 text-xs ${textClass}`}>
            {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
            Last synced {relativeTime(dataFreshnessUtc)}
          </div>
        );
      })()}

      {/* Section B: Historical trend chart */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          {/* Metric toggle */}
          <div className="flex space-x-1 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
            {[
              { key: 'activeNodes', icon: Server, label: 'Nodes' },
              { key: 'totalComputeTflops', icon: Zap, label: 'TFLOPS' },
              { key: 'totalComputeCghz', icon: Cpu, label: 'cGHz' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  metric === key
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow'
                    : 'text-[var(--textMuted)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Range selector */}
          <div className="flex gap-1.5">
            {(['1d', '1w', '1m', '1y'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                  range === r
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                    : 'bg-[var(--background)] border-[var(--border)] text-[var(--textMuted)] hover:border-[var(--text)]'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <AimTrendChart data={historicalStats} isLoading={loadingHistory} metric={metric} />
      </div>

      {/* Section C: Node breakdown table */}
      <div>
        <button
          onClick={() => onExpandChange(!expanded)}
          className="flex items-center gap-2 text-sm text-[var(--textMuted)] hover:text-[var(--text)] transition-colors"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded
            ? 'Hide node details'
            : `Show node details (${nodes.length} node${nodes.length !== 1 ? 's' : ''})`}
        </button>

        {expanded && (
          <div className="mt-3 overflow-x-auto">
            {nodes.length === 0 ? (
              <p className="text-sm text-[var(--textMuted)] italic py-4 text-center">
                No nodes are currently running this AIM.
              </p>
            ) : (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium w-8" />
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Node</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Region</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Version</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Uptime</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">GPU</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Compute</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Score</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Cost</th>
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Tier</th>
                      {hasUserGeo && (
                        <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Distance</th>
                      )}
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(row => (
                      <MergedNodeRow
                        key={row.nodeLicense}
                        row={row}
                        hasUserGeo={hasUserGeo}
                        onSelect={onNodeSelect}
                      />
                    ))}
                  </tbody>
                </table>

                {gatedRows.length > 0 && (
                  <>
                    <table className="w-full text-left border-collapse">
                      <tbody>
                        {gatedRows.map(row => (
                          <MergedNodeRow
                            key={row.nodeLicense}
                            row={row}
                            hasUserGeo={hasUserGeo}
                            onSelect={onNodeSelect}
                          />
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {expanded && mergedRows.some(r => !r.isRoutable) && (
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <Lock size={11} />
            Nodes marked with a lock icon are behind a firewall or NAT and cannot be directly connected to.
          </p>
        )}
      </div>
    </div>
  );
};
