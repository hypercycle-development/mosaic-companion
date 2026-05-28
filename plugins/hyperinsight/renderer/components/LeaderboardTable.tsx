import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { LivenessBadge } from './LivenessBadge';
import { CompositeScoreBadge } from './CompositeScoreBadge';
import { ToolScoreData } from '../types';

interface LeaderboardRow {
  aimId: number;
  aimName: string;
  activeNodes: number;
  computeTflops: number;
  computeCghz: number;
  totalRamBytes: number;
  totalVramBytes: number;
  trendDirection?: 'up' | 'stable' | 'down' | null;
  activeNodes7d?: number | null;
  originalRank?: number;
  _compositeScore?: number | null;
  _healthScore?: number | null;
  _latencyScore?: number | null;
  _uptimeScore?: number | null;
  _consecutiveFailures?: number;
}

interface LeaderboardTableProps {
  data: any[];
  loading: boolean;
  onSelect: (name: string) => void;
  toolScores?: Record<string, ToolScoreData>;
}

export const LeaderboardTable = ({ data, loading, onSelect, toolScores = {} }: LeaderboardTableProps) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const getBestScore = useMemo(() => (aimName: string): ToolScoreData | null => {
    const entries = Object.entries(toolScores).filter(([url]) => url.includes(aimName));
    return entries.reduce<ToolScoreData | null>((best, [, s]) =>
      (s.compositeScore ?? 0) > (best?.compositeScore ?? 0) ? s : best, null);
  }, [toolScores]);

  const processedData = useMemo<LeaderboardRow[]>(() => {
    if (!data) return [];
    return data.map((item, index) => {
      const best = getBestScore(item.aimName);
      return {
        ...item,
        originalRank: index + 1,
        _compositeScore: best?.compositeScore ?? null,
        _healthScore: best?.healthScore ?? null,
        _latencyScore: best?.latencyScore ?? null,
        _uptimeScore: best?.uptimeScore ?? null,
        _consecutiveFailures: best?.consecutiveFailures,
      };
    });
  }, [data, getBestScore]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return processedData;

    return [...processedData].sort((a, b) => {
      const aValue = (a as any)[sortConfig.key];
      const bValue = (b as any)[sortConfig.key];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedData, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'desc') return { key, direction: 'asc' };
        return null;
      }
      return { key, direction: 'desc' };
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    const isActive = sortConfig?.key === columnKey;
    const direction = isActive ? sortConfig.direction : 'desc';
    const Icon = direction === 'asc' ? ArrowUp : ArrowDown;
    return (
      <Icon
        size={14}
        className={`mr-1 text-[var(--primary)] transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}
      />
    );
  };

  const renderHeader = (label: string, key?: string, align = 'right') => {
    if (!key) return <th className={`px-6 py-3 font-normal text-${align}`}>{label}</th>;
    return (
      <th
        className={`px-6 py-3 font-normal cursor-pointer hover:text-[var(--primary)] transition-colors select-none`}
        onClick={() => handleSort(key)}
      >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <SortIcon columnKey={key} />
          <span>{label}</span>
        </div>
      </th>
    );
  };

  const TrendCell = ({ direction }: { direction: 'up' | 'stable' | 'down' | null | undefined }) => {
    if (direction === 'up') {
      return (
        <span className="text-green-500 font-bold" title="Growing — active nodes increased >10% vs 7 days ago">↑</span>
      );
    }
    if (direction === 'down') {
      return (
        <span className="text-red-500 font-bold" title="Declining — active nodes decreased >10% vs 7 days ago">↓</span>
      );
    }
    if (direction === 'stable') {
      return (
        <span className="text-gray-400" title="Stable — active nodes within 10% of 7 days ago">→</span>
      );
    }
    return <span className="text-[var(--textMuted)]">—</span>;
  };

  if (loading && (!data || data.length === 0)) return <div className="text-center py-10 text-[var(--textMuted)]">Loading leaderboard...</div>;
  if (!data || data.length === 0) return <div className="text-center py-10 text-[var(--textMuted)]">No leaderboard data.</div>;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden font-mono">
      <table className="w-full text-sm text-left text-[var(--textMuted)]">
        <thead className="bg-[var(--background)] text-[var(--textMuted)]">
          <tr>
            <th className="px-6 py-3 font-normal">Rank</th>
            <th className="px-6 py-3 font-normal">AIM Name</th>
            <th className="px-6 py-3 font-normal text-center">Health</th>
            {renderHeader('Score', '_compositeScore', 'right')}
            <th className="px-6 py-3 font-normal text-center">Trend</th>
            {renderHeader('Active Nodes (7d)', 'activeNodes')}
            {renderHeader('Compute (TFLOPS)', 'computeTflops')}
            {renderHeader('CPU (cGHz)', 'computeCghz')}
            {renderHeader('RAM (GB)', 'totalRamBytes')}
            {renderHeader('VRAM (GB)', 'totalVramBytes')}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {sortedData.map((item) => (
            <tr
              key={item.aimId}
              className="hover:bg-[var(--surfaceAlt)] transition-colors cursor-pointer"
              onClick={() => onSelect(item.aimName)}
            >
              <td className="px-6 py-2 text-[var(--muted)]">#{item.originalRank}</td>
              <td className="px-6 py-2 font-bold text-[var(--primary)] hover:text-[var(--primaryStrong)] transition-colors">{item.aimName}</td>
              <td className="px-6 py-2 text-center">
                <LivenessBadge healthScore={item._healthScore ?? null} consecutiveFailures={item._consecutiveFailures} />
              </td>
              <td className="px-6 py-2 text-right">
                <CompositeScoreBadge
                  score={item._compositeScore ?? null}
                  healthScore={item._healthScore}
                  latencyScore={item._latencyScore}
                  uptimeScore={item._uptimeScore}
                />
              </td>
              <td className="px-6 py-2 text-center">
                <TrendCell direction={item.trendDirection} />
              </td>
              <td className="px-6 py-2 text-right text-[var(--text)]">
                {item.activeNodes7d ?? item.activeNodes}
              </td>
              <td className="px-6 py-2 text-right text-[var(--success)] font-bold">{item.computeTflops ? item.computeTflops.toFixed(1) : '0.0'}</td>
              <td className="px-6 py-2 text-right text-[var(--textMuted)]">{item.computeCghz ? item.computeCghz.toFixed(0) : '0'}</td>
              <td className="px-6 py-2 text-right text-[var(--textMuted)]">{(item.totalRamBytes / (1024**3)).toFixed(1)}</td>
              <td className="px-6 py-2 text-right text-[var(--success)]">{(item.totalVramBytes / (1024**3)).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
