// =============================================================================
// STARGATE RANKINGS VIEW — Unified on-chain + off-chain leaderboard
// =============================================================================
// Replaces the static "Rankings" tab with live data from Merkelizer, HyperInsight,
// local node telemetry, and skill registry.
// =============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Star, Flame, Medal, RefreshCw, Server, Bot, Shield, Zap } from 'lucide-react';
import { unifiedLeaderboardService, UnifiedRankEntry } from '../../services/stargate/UnifiedLeaderboardService';

type TabValue = 'all' | 'nodes' | 'aims' | 'anfes' | 'skills';

const badgeIcon = (badge?: string) => {
  switch (badge) {
    case 'legendary': return <Flame size={14} className="text-yellow-400" />;
    case 'epic': return <Star size={14} className="text-purple-400" />;
    case 'rare': return <Medal size={14} className="text-cyan-400" />;
    default: return <Medal size={14} className="text-gray-500" />;
  }
};

const typeIcon = (type: string) => {
  switch (type) {
    case 'node': return <Server size={14} className="text-blue-400" />;
    case 'aim': return <Bot size={14} className="text-green-400" />;
    case 'anfe': return <Shield size={14} className="text-yellow-400" />;
    case 'skill': return <Zap size={14} className="text-purple-400" />;
    default: return <Star size={14} className="text-gray-400" />;
  }
};

const badgeClass = (badge?: string) => {
  switch (badge) {
    case 'legendary': return 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10';
    case 'epic': return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
    case 'rare': return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10';
    default: return 'border-gray-600 text-gray-400 bg-gray-800';
  }
};

const StargateRankingsView: React.FC = () => {
  const [entries, setEntries] = useState<UnifiedRankEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const data = await unifiedLeaderboardService.refresh();
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return entries;
    return entries.filter((e) => {
      if (activeTab === 'nodes') return e.type === 'node' || e.type === 'anfe';
      if (activeTab === 'aims') return e.type === 'aim';
      if (activeTab === 'anfes') return e.type === 'anfe';
      if (activeTab === 'skills') return e.type === 'skill';
      return true;
    });
  }, [entries, activeTab]);

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  const tabs: { id: TabValue; label: string }[] = [
    { id: 'all', label: 'Global' },
    { id: 'nodes', label: 'Nodes' },
    { id: 'aims', label: 'AIMs' },
    { id: 'anfes', label: 'ANFEs' },
    { id: 'skills', label: 'Skills' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Rankings</h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && entries.length === 0 && (
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      )}

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {top3.map((e, i) => (
            <div
              key={e.id}
              className="p-3 rounded-xl text-center bg-gradient-to-b from-gray-900 to-gray-800 border"
              style={{ borderColor: i === 0 ? '#ffd70040' : i === 1 ? '#c0c0c040' : '#cd7f3240' }}
            >
              <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                i === 0 ? 'bg-yellow-500/20' : i === 1 ? 'bg-gray-400/20' : 'bg-orange-700/20'
              }`}>
                <Trophy size={20} className={
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'
                } />
              </div>
              <p className="text-sm font-medium text-white truncate">{e.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{e.type.toUpperCase()}</p>
              <p className="text-xl font-bold text-cyan-400 mt-1">{e.score.toFixed(1)}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border mt-2 inline-block ${badgeClass(e.badge)}`}>
                {e.badge || 'common'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Full Table */}
      <div className="border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/80 text-gray-500">
              <th className="px-3 py-2 text-left font-medium">Rank</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Uptime</th>
              <th className="px-3 py-2 text-left font-medium">Reliability</th>
              <th className="px-3 py-2 text-left font-medium">{activeTab === 'aims' ? 'Active Nodes' : 'Compute'}</th>
              <th className="px-3 py-2 text-left font-medium">Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rest.map((e) => (
              <tr key={e.id} className="hover:bg-gray-900/50 transition-colors">
                <td className="px-3 py-2.5 font-bold text-gray-300">{e.rank}</td>
                <td className="px-3 py-2.5 text-white truncate max-w-[200px]">{e.name}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    {typeIcon(e.type)}
                    {e.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-cyan-400">{e.score.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-gray-400">{Math.round(e.uptime * 100)}%</td>
                <td className="px-3 py-2.5 text-gray-400">{Math.round(e.reliability * 100)}%</td>
                <td className="px-3 py-2.5 text-gray-400">
                  {activeTab === 'aims' ? e.activeNodes || 0 : `${e.computeTFLOPS?.toFixed(1) || 0} TFLOPS`}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${badgeClass(e.badge)}`}>
                    {badgeIcon(e.badge)}
                    {e.badge || 'common'}
                  </span>
                </td>
              </tr>
            ))}
            {rest.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">No entries for this filter</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StargateRankingsView;
