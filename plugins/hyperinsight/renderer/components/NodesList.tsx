import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Activity, Zap, Cpu, ChevronRight, HardDrive
} from 'lucide-react';
import { NodeSummary, NodeSearchParams } from '../types';
import { cn } from '../utils';

interface NodesListProps {
  data: any[];
  loading: boolean;
  onSelectNode: (licenseKey: string) => void;
}

export const NodesList = ({ data: initialData, loading: initialLoading, onSelectNode }: NodesListProps) => {
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<NodeSearchParams>({
    onlineOnly: true,
    gpuOnly: false,
    gpuName: ''
  });

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.hyperinsight.getNodes(filters);
      if (result && result.data) {
        setNodes(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch nodes", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatUptime = (pct?: number) => {
    if (pct === undefined || pct === null) return '-';
    return `${(pct * 100).toFixed(1)}%`;
  };

  return (
    <div className="relative h-full flex flex-col font-sans">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="text-xl font-bold tracking-tight text-[var(--primary)] font-mono hidden md:block">
              Network Nodes
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative min-w-[250px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--textMuted)]" size={16} />
              <input 
                type="text"
                placeholder="Search GPU..."
                value={filters.gpuName || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, gpuName: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--primary)] text-[var(--text)] placeholder-[var(--textMuted)]"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilters(prev => ({ ...prev, onlineOnly: !prev.onlineOnly }))}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border",
                  filters.onlineOnly 
                    ? "bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]" 
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--textMuted)] hover:text-[var(--text)]"
                )}
              >
                <Activity size={16} />
                Online Only
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, gpuOnly: !prev.gpuOnly }))}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border",
                  filters.gpuOnly 
                    ? "bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)]" 
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--textMuted)] hover:text-[var(--text)]"
                )}
              >
                <Zap size={16} />
                GPU Only
              </button>
            </div>
          </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)] flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surfaceAlt)] text-[var(--textMuted)] font-medium sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 font-normal">Status</th>
              <th className="px-6 py-3 font-normal">Name</th>
              <th className="px-6 py-3 font-normal">Location</th>
              <th className="px-6 py-3 font-normal">Hardware</th>
              <th className="px-6 py-3 font-normal">Uptime</th>
              <th className="px-6 py-3 text-right font-normal">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[var(--textMuted)]">Loading nodes...</td>
              </tr>
            ) : nodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[var(--textMuted)]">No nodes found matching criteria.</td>
              </tr>
            ) : (
              nodes.map((node) => (
                <tr 
                  key={node.licenseKey} 
                  className="cursor-pointer group hover:bg-[var(--surfaceAlt)]/50 transition-colors"
                  onClick={() => onSelectNode(node.licenseKey)}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${node.isAlive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-500'}`} />
                      <span className={node.isAlive ? 'text-emerald-400 font-medium' : 'text-[var(--textMuted)]'}>
                        {node.isAlive ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-sm text-[var(--primary)]">
                    {node.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-3 text-[var(--textMuted)]">
                    {node.region || 'Unknown'}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-1 text-[var(--text)]">
                        {node.gpuCount > 0 ? (
                          <><Zap size={12} className="text-yellow-400" /> {node.gpuCount}x {node.gpuName || 'GPU'}</>
                        ) : (
                          <><Cpu size={12} className="text-blue-400" /> {node.cpuCount} CPU</>
                        )}
                      </span>
                      <span className="text-xs text-[var(--textMuted)] flex items-center gap-1 mt-0.5">
                          <HardDrive size={10} />
                          {formatBytes(node.ramBytes)} RAM
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-[var(--primary)]">
                    {formatUptime(node.uptimePercent)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <ChevronRight size={16} className="text-[var(--textMuted)] group-hover:text-[var(--primary)] transition-colors inline-block" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
