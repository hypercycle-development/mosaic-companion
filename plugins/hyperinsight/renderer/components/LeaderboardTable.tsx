import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export const LeaderboardTable = ({ data, loading, onSelect }: { data: any[], loading: boolean, onSelect: (name: string) => void }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Attach original rank
  const processedData = useMemo(() => {
      if (!data) return [];
      return data.map((item, index) => ({
          ...item,
          originalRank: index + 1
      }));
  }, [data]);

  const sortedData = useMemo(() => {
      if (!sortConfig) return processedData;

      return [...processedData].sort((a, b) => {
          const aValue = a[sortConfig.key];
          const bValue = b[sortConfig.key];

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [processedData, sortConfig]);

  const handleSort = (key: string) => {
      setSortConfig((current) => {
          if (current?.key === key) {
              if (current.direction === 'desc') {
                  return { key, direction: 'asc' };
              }
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

  if (loading && (!data || data.length === 0)) return <div className="text-center py-10 text-[var(--textMuted)]">Loading leaderboard...</div>;
  if (!data || data.length === 0) return <div className="text-center py-10 text-[var(--textMuted)]">No leaderboard data.</div>;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden font-mono">
      <table className="w-full text-sm text-left text-[var(--textMuted)]">
          <thead className="bg-[var(--background)] text-[var(--textMuted)]">
              <tr>
                  <th className="px-6 py-3 font-normal">Rank</th>
                  <th className="px-6 py-3 font-normal">AIM Name</th>
                  {renderHeader('Active Nodes', 'activeNodes')}
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
                      <td className="px-6 py-2 text-right text-[var(--text)]">{item.activeNodes}</td>
                      <td className="px-6 py-2 text-right text-[var(--success)] font-bold">{item.computeTflops ? item.computeTflops.toFixed(1) : '0.0'}</td>
                      <td className="px-6 py-2 text-right text-[var(--textMuted)]">{item.computeCghz ? item.computeCghz.toFixed(0) : '0'}</td>
                      {/* Convert Bytes to GB: bytes / 1024^3 */}
                      <td className="px-6 py-2 text-right text-[var(--textMuted)]">{(item.totalRamBytes / (1024**3)).toFixed(1)}</td>
                      <td className="px-6 py-2 text-right text-[var(--success)]">{(item.totalVramBytes / (1024**3)).toFixed(1)}</td>
                  </tr>
              ))}
          </tbody>
      </table>
    </div>
  );
};
