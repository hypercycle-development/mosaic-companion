import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, LayoutList, LayoutGrid } from 'lucide-react';
import { cn } from '../utils';
import { LivenessBadge } from './LivenessBadge';
import { CompositeScoreBadge } from './CompositeScoreBadge';
import { PollTierBadge } from './PollTierBadge';
import { ToolScoreData } from '../types';

type HealthFilter = 'all' | 'healthy' | 'degraded';
type MinScore = 0 | 50 | 70 | 80;
type SortOrder = 'default' | 'score' | 'nodes' | 'name';

interface AimsListProps {
  data: any[];
  loading: boolean;
  onSelect: (name: string) => void;
  toolScores?: Record<string, ToolScoreData>;
}

export const AimsList = ({ data, loading, onSelect, toolScores = {} }: AimsListProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [minScore, setMinScore] = useState<MinScore>(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const getBestScore = useMemo(() => (aim: any): ToolScoreData | null => {
    const key = aim.namespace ? `${aim.namespace}/${aim.name}` : aim.name;
    const entries = Object.entries(toolScores).filter(([url]) => url.includes(key));
    return entries.reduce<ToolScoreData | null>((best, [, s]) =>
      (s.compositeScore ?? 0) > (best?.compositeScore ?? 0) ? s : best, null);
  }, [toolScores]);

  const processedData = useMemo(() => {
    if (!data) return [];
    return data.map((item, index) => ({
      ...item,
      originalRank: index + 1,
    }));
  }, [data]);

  const filteredSortedData = useMemo(() => {
    let result = processedData.map(aim => ({ ...aim, _bestScore: getBestScore(aim) }));

    if (healthFilter === 'healthy') {
      result = result.filter(a => (a._bestScore?.healthScore ?? 0) >= 80);
    } else if (healthFilter === 'degraded') {
      result = result.filter(a => {
        const h = a._bestScore?.healthScore ?? 0;
        return h >= 50 && h < 80;
      });
    }

    if (minScore > 0) {
      result = result.filter(a => (a._bestScore?.compositeScore ?? 0) >= minScore);
    }

    if (sortOrder === 'score') {
      return [...result].sort((a, b) => (b._bestScore?.compositeScore ?? 0) - (a._bestScore?.compositeScore ?? 0));
    } else if (sortOrder === 'nodes') {
      return [...result].sort((a, b) => (b.totalNodesActivated || 0) - (a.totalNodesActivated || 0));
    } else if (sortOrder === 'name') {
      return [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortConfig) {
      return [...result].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [processedData, getBestScore, healthFilter, minScore, sortOrder, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        if (current.direction === 'desc') return { key, direction: 'asc' };
        return null;
      }
      return { key, direction: 'desc' };
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const renderHeader = (label: string, key?: string, align = 'right') => {
    if (!key) return <th className={`px-6 py-3 font-normal text-${align}`}>{label}</th>;

    const isActive = sortConfig?.key === key;
    const direction = isActive ? sortConfig.direction : 'desc';
    const Icon = direction === 'asc' ? ArrowUp : ArrowDown;

    return (
      <th
        className={`px-6 py-3 font-normal cursor-pointer hover:text-[var(--primary)] transition-colors select-none`}
        onClick={() => handleSort(key)}
      >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <Icon
            size={14}
            className={`mr-1 text-[var(--primary)] transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`}
          />
          <span>{label}</span>
        </div>
      </th>
    );
  };

  if (loading && (!data || data.length === 0)) return <div className="text-center py-10 text-[var(--textMuted)]">Loading aims...</div>;
  if (!data || data.length === 0) return <div className="text-center py-10 text-[var(--textMuted)]">No aims found.</div>;

  const filterBtnClass = (active: boolean) =>
    `px-2 py-1 rounded text-xs border transition-colors ${
      active
        ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
        : 'border-[var(--border)] text-[var(--textMuted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => setHealthFilter('all')} className={filterBtnClass(healthFilter === 'all')}>All</button>
          <button onClick={() => setHealthFilter('healthy')} className={filterBtnClass(healthFilter === 'healthy')}>Healthy</button>
          <button onClick={() => setHealthFilter('degraded')} className={filterBtnClass(healthFilter === 'degraded')}>Degraded</button>
        </div>
        <select
          value={minScore}
          onChange={e => setMinScore(Number(e.target.value) as MinScore)}
          className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-[var(--textMuted)] cursor-pointer"
        >
          <option value={0}>Any score</option>
          <option value={50}>50+</option>
          <option value={70}>70+</option>
          <option value={80}>80+</option>
        </select>
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as SortOrder)}
          className="text-xs bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-[var(--textMuted)] cursor-pointer"
        >
          <option value="default">Default order</option>
          <option value="score">Score (high → low)</option>
          <option value="nodes">Active Nodes</option>
          <option value="name">Name</option>
        </select>
        {/* View toggle */}
        <div className="ml-auto bg-[var(--surface)] rounded-lg p-1 flex border border-[var(--border)]">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[var(--primary)] text-white' : 'text-[var(--textMuted)] hover:text-[var(--text)]'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--primary)] text-white' : 'text-[var(--textMuted)] hover:text-[var(--text)]'}`}
            title="List View"
          >
            <LayoutList size={18} />
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSortedData.map((aim, idx) => {
            const pullCount = aim.pullCount || aim.PullCount || 0;
            const best: ToolScoreData | null = aim._bestScore;
            return (
              <div
                key={aim.id || idx}
                className="relative bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                onClick={() => onSelect(aim.name)}
              >
                {/* LivenessBadge — top right */}
                <span className="absolute top-3 right-3">
                  <LivenessBadge healthScore={best?.healthScore ?? null} consecutiveFailures={best?.consecutiveFailures} size="md" />
                </span>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-[var(--text)] pr-4">{aim.name}</h3>
                  <span className="text-xs font-mono text-[var(--textMuted)]">ID: {aim.id}</span>
                </div>
                <div className="space-y-1 text-sm text-[var(--textMuted)]">
                  <div className="flex justify-between items-center">
                    <span>Nodes:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text)]">{aim.totalNodesActivated || aim.TotalNodesActivated || 0}</span>
                      <CompositeScoreBadge
                        score={best?.compositeScore ?? null}
                        healthScore={best?.healthScore}
                        latencyScore={best?.latencyScore}
                        uptimeScore={best?.uptimeScore}
                      />
                    </div>
                  </div>
                </div>
                {/* Footer */}
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--textMuted)]">
                  <span>{pullCount > 0 ? `${pullCount.toLocaleString()} pulls` : ''}</span>
                  {best !== null && <PollTierBadge tier={best.pollTier} />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden font-mono">
          <table className="w-full text-sm text-left text-[var(--textMuted)]">
            <thead className="bg-[var(--background)] text-[var(--textMuted)]">
              <tr>
                <th className="px-6 py-3 font-normal">Rank</th>
                {renderHeader('AIM Name', 'name', 'left')}
                {renderHeader('Active Nodes', 'totalNodesActivated')}
                <th className="px-6 py-3 font-normal text-center">Health</th>
                <th className="px-6 py-3 font-normal text-right">Score</th>
                <th className="px-6 py-3 font-normal text-center">Tier</th>
                {renderHeader('Pull Count', 'pullCount')}
                {renderHeader('First Seen', 'firstSeen')}
                {renderHeader('Last Seen', 'lastSeen')}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredSortedData.map((item) => {
                const pullCount = item.pullCount || item.PullCount || 0;
                const best: ToolScoreData | null = item._bestScore;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--surfaceAlt)] transition-colors cursor-pointer"
                    onClick={() => onSelect(item.name)}
                  >
                    <td className="px-6 py-2 text-[var(--muted)]">#{item.originalRank}</td>
                    <td className="px-6 py-2 font-bold text-[var(--primary)] hover:text-[var(--primaryStrong)] transition-colors">
                      {item.name}
                    </td>
                    <td className="px-6 py-2 text-right text-[var(--text)]">{item.totalNodesActivated || item.TotalNodesActivated || 0}</td>
                    <td className="px-6 py-2 text-center">
                      <LivenessBadge healthScore={best?.healthScore ?? null} consecutiveFailures={best?.consecutiveFailures} />
                    </td>
                    <td className="px-6 py-2 text-right">
                      <CompositeScoreBadge
                        score={best?.compositeScore ?? null}
                        healthScore={best?.healthScore}
                        latencyScore={best?.latencyScore}
                        uptimeScore={best?.uptimeScore}
                      />
                    </td>
                    <td className="px-6 py-2 text-center">
                      <PollTierBadge tier={best?.pollTier ?? null} />
                    </td>
                    <td className="px-6 py-2 text-right text-[var(--textMuted)]">
                      {pullCount > 0 ? pullCount.toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-2 text-right text-[var(--textMuted)]">{formatDate(item.firstSeen)}</td>
                    <td className="px-6 py-2 text-right text-[var(--textMuted)]">{formatDate(item.lastSeen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
