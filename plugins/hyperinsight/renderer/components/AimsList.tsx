import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, LayoutList, LayoutGrid } from 'lucide-react';

export const AimsList = ({ data, loading, onSelect }: { data: any[], loading: boolean, onSelect: (name: string) => void }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); 
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

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
        
        // Handle nulls
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
            if (current.direction === 'desc') {
                return { key, direction: 'asc' };
            }
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

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex justify-end mb-4">
        <div className="bg-[var(--surface)] rounded-lg p-1 flex border border-[var(--border)]">
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
          {sortedData.map((aim, idx) => (
            <div 
                key={aim.id || idx} 
                className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                onClick={() => onSelect(aim.name)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[var(--text)]">{aim.name}</h3>
                <span className="text-xs font-mono text-[var(--textMuted)]">ID: {aim.id}</span>
              </div>
              <div className="space-y-1 text-sm text-[var(--textMuted)]">
                 <div className="flex justify-between">
                   <span>Nodes:</span>
                   <span className="text-[var(--text)]">{aim.totalNodesActivated || aim.TotalNodesActivated || 0}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Revenue:</span>
                   <span className="text-[var(--success)]">{aim.totalRevenue || aim.TotalRevenue || 'N/A'}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden font-mono">
            <table className="w-full text-sm text-left text-[var(--textMuted)]">
                <thead className="bg-[var(--background)] text-[var(--textMuted)]">
                    <tr>
                        <th className="px-6 py-3 font-normal">Rank</th>
                        {renderHeader('AIM Name', 'name', 'left')}
                        {renderHeader('Total Nodes Activated', 'totalNodesActivated')}
                        {renderHeader('First Seen', 'firstSeen')}
                        {renderHeader('Last Seen', 'lastSeen')}
                        {renderHeader('Total Revenue', 'totalRevenue')}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {sortedData.map((item) => (
                        <tr 
                            key={item.id} 
                            className="hover:bg-[var(--surfaceAlt)] transition-colors cursor-pointer"
                            onClick={() => onSelect(item.name)}
                        >
                            <td className="px-6 py-2 text-[var(--muted)]">#{item.originalRank}</td>
                            <td className="px-6 py-2 font-bold text-[var(--primary)] hover:text-[var(--primaryStrong)] transition-colors">
                                {item.name}
                            </td>
                            <td className="px-6 py-2 text-right text-[var(--text)]">{item.totalNodesActivated}</td>
                            <td className="px-6 py-2 text-right text-[var(--textMuted)]">{formatDate(item.firstSeen)}</td>
                            <td className="px-6 py-2 text-right text-[var(--textMuted)]">{formatDate(item.lastSeen)}</td>
                            <td className="px-6 py-2 text-right text-[var(--textMuted)]">{item.totalRevenue || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
};
