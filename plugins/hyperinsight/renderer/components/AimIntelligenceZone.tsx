import React, { useState, useEffect } from 'react';
import { Server, Zap, Cpu, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { AimNodeInstanceDto, AimStatsDto } from '../types';
import { relativeTime, freshnessStatus, scoreToColourClass } from '../utils';
import { AimTrendChart } from './AimTrendChart';
import { GatedFeature } from './GatedFeature';
import { useNodeConnect } from '../hooks/useNodeConnect';

interface AimIntelligenceZoneProps {
  aimName: string;
  nodes: AimNodeInstanceDto[];
  stats: AimStatsDto | null;
  dataFreshnessUtc: string | null;
  hasUserGeo: boolean;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onNodeSelect: (nodeLicense: number) => void;
}

// Derive health status from the nodes array
function deriveHealth(nodes: AimNodeInstanceDto[]): { label: string; colour: string; dotClass: string } {
  const aliveNodes = nodes.filter(n => n.isAlive);
  if (aliveNodes.length === 0) return { label: 'Offline', colour: 'text-red-400', dotClass: 'bg-red-500' };
  const maxUptime = Math.max(...aliveNodes.map(n => n.uptimePercent));
  if (maxUptime >= 90) return { label: 'Healthy', colour: 'text-[var(--success)]', dotClass: 'bg-[var(--success)]' };
  return { label: 'Degraded', colour: 'text-amber-400', dotClass: 'bg-amber-400' };
}

// Weighted average uptime (weighted by computeTflops)
function weightedUptime(nodes: AimNodeInstanceDto[]): string {
  const alive = nodes.filter(n => n.isAlive);
  if (alive.length === 0) return '0.0%';
  const totalWeight = alive.reduce((sum, n) => sum + (n.computeTflops || 1), 0);
  const weightedSum = alive.reduce((sum, n) => sum + n.uptimePercent * (n.computeTflops || 1), 0);
  return (weightedSum / totalWeight).toFixed(1) + '%';
}

// Per-row connect button with local loading / success / error state
const ConnectButton = ({ node }: { node: AimNodeInstanceDto }) => {
  const { connect, isConnecting, isConnected } = useNodeConnect();
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

interface NodeTableRowProps {
  node: AimNodeInstanceDto;
  hasUserGeo: boolean;
  onSelect: (license: number) => void;
}

const NodeTableRow = ({ node, hasUserGeo, onSelect }: NodeTableRowProps) => {
  const scoreClass = node.compositeScore != null
    ? scoreToColourClass(node.compositeScore)
    : '';

  return (
    <tr
      onClick={() => onSelect(node.nodeLicense)}
      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surfaceAlt)] cursor-pointer transition-colors"
    >
      {/* Status dot */}
      <td className="py-2.5 px-3 w-8">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${node.isAlive ? 'bg-[var(--success)]' : 'bg-[var(--textMuted)]'}`}
          title={node.isAlive ? 'Node is currently alive' : 'Node is offline'}
        />
      </td>
      {/* Name */}
      <td className="py-2.5 px-3 font-mono text-xs text-[var(--text)] max-w-[140px]">
        <span className="truncate block" title={node.nodeName ?? String(node.nodeLicense)}>
          {node.nodeName ? node.nodeName.substring(0, 20) + (node.nodeName.length > 20 ? '…' : '') : `#${node.nodeLicense}`}
        </span>
      </td>
      {/* Region */}
      <td className="py-2.5 px-3 text-xs text-[var(--textMuted)]">{node.region ?? '—'}</td>
      {/* Version */}
      <td className="py-2.5 px-3 font-mono text-xs text-[var(--textMuted)]">{node.tagName}</td>
      {/* Uptime */}
      <td className="py-2.5 px-3 text-xs text-[var(--text)] font-mono">{node.uptimePercent.toFixed(1)}%</td>
      {/* GPU */}
      <td className="py-2.5 px-3 text-xs text-[var(--textMuted)] max-w-[120px]">
        <span className="truncate block" title={node.gpuName ?? undefined}>
          {node.gpuName ? node.gpuName.substring(0, 16) + (node.gpuName.length > 16 ? '…' : '') : '—'}
        </span>
      </td>
      {/* Compute */}
      <td className="py-2.5 px-3 text-xs font-mono text-[var(--text)]">
        {node.computeTflops.toFixed(2)} TF
      </td>
      {/* Score */}
      <td className="py-2.5 px-3">
        {node.compositeScore != null ? (
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${scoreClass}`}>
            {Math.round(node.compositeScore)}
          </span>
        ) : (
          <span className="text-[var(--textMuted)] text-xs">—</span>
        )}
      </td>
      {/* Distance (conditional) */}
      {hasUserGeo && (
        <td className="py-2.5 px-3 text-xs text-[var(--textMuted)]">
          {node.distanceKm != null ? `${Math.round(node.distanceKm)} km` : '—'}
        </td>
      )}
      {/* Connect */}
      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
        <ConnectButton node={node} />
      </td>
    </tr>
  );
};

export const AimIntelligenceZone = ({
  aimName,
  nodes,
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

  const visibleNodes = nodes.slice(0, 3);
  const gatedNodes = nodes.slice(3);

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
        {/* Controls */}
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
            {(['1d', '1w'] as const).map(r => (
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
            <GatedFeature tier="pro" label="Extended history requires Pro" blurContent={false}>
              <div className="flex gap-1.5">
                {(['1m', '1y'] as const).map(r => (
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
            </GatedFeature>
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
          {expanded ? 'Hide node details' : `Show node details (${nodes.length} node${nodes.length !== 1 ? 's' : ''})`}
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
                      {hasUserGeo && <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium">Distance</th>}
                      <th className="py-2 px-3 text-xs text-[var(--textMuted)] font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleNodes.map(node => (
                      <NodeTableRow
                        key={node.nodeLicense}
                        node={node}
                        hasUserGeo={hasUserGeo}
                        onSelect={onNodeSelect}
                      />
                    ))}
                  </tbody>
                </table>

                {gatedNodes.length > 0 && (
                  <>
                    <GatedFeature
                      tier="pro"
                      label={`See all ${nodes.length} nodes with Pro`}
                      minHeight={120}
                    >
                      <table className="w-full text-left border-collapse">
                        <tbody>
                          {gatedNodes.map(node => (
                            <NodeTableRow
                              key={node.nodeLicense}
                              node={node}
                              hasUserGeo={hasUserGeo}
                              onSelect={onNodeSelect}
                            />
                          ))}
                        </tbody>
                      </table>
                    </GatedFeature>
                    <p className="text-xs text-[var(--textMuted)] mt-2 text-center">
                      Showing 3 of {nodes.length} nodes
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
