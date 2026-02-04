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
              className={`mr-1 text-indigo-400 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`} 
          />
      );
  };

  const renderHeader = (label: string, key?: string, align = 'right') => {
      if (!key) return <th className={`px-6 py-3 font-normal text-${align}`}>{label}</th>;

      return (
          <th 
              className={`px-6 py-3 font-normal cursor-pointer hover:text-indigo-300 transition-colors select-none`}
              onClick={() => handleSort(key)}
          >
              <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                  <SortIcon columnKey={key} />
                  <span>{label}</span>
              </div>
          </th>
      );
  };

  if (loading && (!data || data.length === 0)) return <div className="text-center py-10 text-gray-500">Loading leaderboard...</div>;
  if (!data || data.length === 0) return <div className="text-center py-10 text-gray-500">No leaderboard data.</div>;

  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden font-mono">
      <table className="w-full text-sm text-left text-gray-300">
          <thead className="bg-gray-800/80 text-gray-400">
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
          <tbody className="divide-y divide-gray-800">
              {sortedData.map((item) => (
                  <tr 
                      key={item.aimId} 
                      className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => onSelect(item.aimName)}
                  >
                      <td className="px-6 py-2 text-gray-500">#{item.originalRank}</td>
                      <td className="px-6 py-2 font-bold text-indigo-400 hover:text-indigo-300 transition-colors">{item.aimName}</td>
                      <td className="px-6 py-2 text-right text-gray-200">{item.activeNodes}</td>
                      <td className="px-6 py-2 text-right text-emerald-400 font-bold">{item.computeTflops ? item.computeTflops.toFixed(1) : '0.0'}</td>
                      <td className="px-6 py-2 text-right text-gray-400">{item.computeCghz ? item.computeCghz.toFixed(0) : '0'}</td>
                      {/* Convert Bytes to GB: bytes / 1024^3 */}
                      <td className="px-6 py-2 text-right text-gray-400">{(item.totalRamBytes / (1024**3)).toFixed(1)}</td>
                      <td className="px-6 py-2 text-right text-green-400">{(item.totalVramBytes / (1024**3)).toFixed(1)}</td>
                  </tr>
              ))}
          </tbody>
      </table>
    </div>
  );
};
