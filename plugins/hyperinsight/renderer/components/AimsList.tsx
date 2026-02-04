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
            className={`px-6 py-3 font-normal cursor-pointer hover:text-indigo-300 transition-colors select-none`}
            onClick={() => handleSort(key)}
        >
            <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
                 <Icon 
                    size={14} 
                    className={`mr-1 text-indigo-400 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`} 
                />
                <span>{label}</span>
            </div>
        </th>
    );
  };

  if (loading && (!data || data.length === 0)) return <div className="text-center py-10 text-gray-500">Loading aims...</div>;
  if (!data || data.length === 0) return <div className="text-center py-10 text-gray-500">No aims found.</div>;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex justify-end mb-4">
        <div className="bg-gray-800 rounded-lg p-1 flex border border-gray-700">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
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
                className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 hover:border-indigo-500/30 transition-colors cursor-pointer"
                onClick={() => onSelect(aim.name)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-gray-200">{aim.name}</h3>
                <span className="text-xs font-mono text-gray-500">ID: {aim.id}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                 <div className="flex justify-between">
                   <span>Nodes:</span>
                   <span className="text-gray-200">{aim.totalNodesActivated || aim.TotalNodesActivated || 0}</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Revenue:</span>
                   <span className="text-emerald-400">{aim.totalRevenue || aim.TotalRevenue || 'N/A'}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden font-mono">
            <table className="w-full text-sm text-left text-gray-300">
                <thead className="bg-gray-800/80 text-gray-400">
                    <tr>
                        <th className="px-6 py-3 font-normal">Rank</th>
                        {renderHeader('AIM Name', 'name', 'left')}
                        {renderHeader('Total Nodes Activated', 'totalNodesActivated')}
                        {renderHeader('First Seen', 'firstSeen')}
                        {renderHeader('Last Seen', 'lastSeen')}
                        {renderHeader('Total Revenue', 'totalRevenue')}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                    {sortedData.map((item) => (
                        <tr 
                            key={item.id} 
                            className="hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => onSelect(item.name)}
                        >
                            <td className="px-6 py-2 text-gray-500">#{item.originalRank}</td>
                            <td className="px-6 py-2 font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                                {item.name}
                            </td>
                            <td className="px-6 py-2 text-right text-gray-200">{item.totalNodesActivated}</td>
                            <td className="px-6 py-2 text-right text-gray-400">{formatDate(item.firstSeen)}</td>
                            <td className="px-6 py-2 text-right text-gray-400">{formatDate(item.lastSeen)}</td>
                            <td className="px-6 py-2 text-right text-gray-400">{item.totalRevenue || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
};
