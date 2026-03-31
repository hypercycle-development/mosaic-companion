// ============================================
// ADA PORTAL - Main UI Panel
// AI Workforce + Compute + Intelligence Platform for Cardano
// ============================================

import React, { useState, useEffect } from 'react';
import { 
  initializeAdaPortal,
  agentMarketplace,
  leaderboard,
  trainingMarketplace,
  agentPackages,
  nodeIntelligence,
  mcpIntegration,
  AgentMarketplaceService
} from '../services/AdaPortal';
import { MarketplaceListing, LeaderboardEntry, TrainingListing, AgentPackage, ComputeNode } from '../services/AdaPortal/types';
import { Users, Trophy, GraduationCap, Package, Cpu, Zap, Star, ArrowRight, Search, Filter, RefreshCw } from 'lucide-react';

interface AdaPortalPanelProps {
  onClose?: () => void;
}

type TabId = 'marketplace' | 'leaderboard' | 'training' | 'packages' | 'compute' | 'nodes';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'marketplace', label: 'Hire Agents', icon: <Users size={18} /> },
  { id: 'leaderboard', label: 'Rankings', icon: <Trophy size={18} /> },
  { id: 'training', label: 'Train Agents', icon: <GraduationCap size={18} /> },
  { id: 'packages', label: 'Bundles', icon: <Package size={18} /> },
  { id: 'compute', label: 'Compute', icon: <Cpu size={18} /> },
  { id: 'nodes', label: 'Nodes', icon: <Zap size={18} /> }
];

export const AdaPortalPanel: React.FC<AdaPortalPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabId>('marketplace');
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [trainingListings, setTrainingListings] = useState<TrainingListing[]>([]);
  const [packages, setPackages] = useState<AgentPackage[]>([]);
  const [nodes, setNodes] = useState<ComputeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAdaPortal();
    loadData();
  }, []);

  const loadData = () => {
    setIsLoading(true);
    setListings(agentMarketplace.getListings());
    setLeaderboardData(leaderboard.getLeaderboard('overall', 'all_time').entries);
    setTrainingListings(trainingMarketplace.getListings());
    setPackages(agentPackages.getPackages());
    setNodes(nodeIntelligence.getNodes());
    setIsLoading(false);
  };

  const renderMarketplace = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Hire AI Agents</h3>
        <span className="text-sm text-gray-400">{listings.length} agents available</span>
      </div>
      
      <div className="grid gap-3">
        {listings.map(listing => (
          <div key={listing.listingId} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-cyan-500/50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">{listing.agentName}</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  {listing.roles.map(role => (
                    <span key={role} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300 capitalize">
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3 mt-2 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Star size={14} className="text-yellow-500" />
                    {listing.rating.toFixed(1)}
                  </span>
                  <span>{listing.successRate * 100}% success</span>
                  <span className="capitalize">{listing.availability}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-cyan-400">${listing.pricing.perTaskMin}+</div>
                <div className="text-xs text-gray-500">per task</div>
              </div>
            </div>
            <button className="mt-3 w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-sm font-medium transition-colors">
              Hire Agent
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Rankings</h3>
        <div className="flex gap-2">
          {['daily', 'weekly', 'all_time'].map(period => (
            <button key={period} className="px-3 py-1 text-xs bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
              {period.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {leaderboardData.slice(0, 10).map((entry, index) => (
          <div key={entry.agentId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
              index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
              index === 1 ? 'bg-gray-400/20 text-gray-300' :
              index === 2 ? 'bg-amber-600/20 text-amber-500' :
              'bg-gray-700 text-gray-400'
            }`}>
              {entry.rank}
            </div>
            <div className="flex-1">
              <div className="font-medium text-white">{entry.agentName}</div>
              <div className="text-xs text-gray-500">
                Skill: {entry.skillScore} | Success: {entry.successScore}% | Rating: {entry.ratingScore}
              </div>
            </div>
            <div className="text-xl font-bold text-cyan-400">{entry.score}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTraining = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Train Your Agents</h3>
        <span className="text-sm text-gray-400">{trainingListings.length} trainers available</span>
      </div>

      <div className="grid gap-3">
        {trainingListings.map(listing => (
          <div key={listing.listingId} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">{listing.trainerName}</h4>
                <p className="text-sm text-gray-400 mt-1">{listing.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {listing.specializations.map(skill => (
                    <span key={skill} className="text-xs px-2 py-0.5 bg-purple-900/50 rounded-full text-purple-300">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-400">${listing.pricePerSession}</div>
                <div className="text-xs text-gray-500">per session</div>
              </div>
            </div>
            <button className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium transition-colors">
              Book Training
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPackages = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Agent Bundles</h3>
        <span className="text-sm text-gray-400">{packages.length} packages</span>
      </div>

      <div className="grid gap-3">
        {packages.map(pkg => (
          <div key={pkg.packageId} className={`bg-gray-800/50 rounded-lg p-4 border ${pkg.popular ? 'border-green-500/50' : 'border-gray-700'}`}>
            {pkg.popular && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Popular</span>
            )}
            <h4 className="font-semibold text-white mt-2">{pkg.name}</h4>
            <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {pkg.agents.map(agent => (
                <span key={agent.agentId} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                  {agent.name}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div>
                <div className="text-xl font-bold text-green-400">${pkg.price}</div>
                {pkg.computeAllocation && (
                  <div className="text-xs text-gray-500">{pkg.computeAllocation}h compute included</div>
                )}
              </div>
              <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">
                Get Package
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompute = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Compute Access</h3>
        <button className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors">
          Allocate Compute
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-cyan-400">{nodes.length}</div>
          <div className="text-sm text-gray-400">Total Nodes</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">
            {nodes.filter(n => n.status === 'online').length}
          </div>
          <div className="text-sm text-gray-400">Online</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-yellow-400">
            {nodes.filter(n => n.reliability >= 0.9).length}
          </div>
          <div className="text-sm text-gray-400">Reliable</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="text-2xl font-bold text-purple-400">
            {nodes.reduce((sum, n) => sum + n.availableCompute, 0)}
          </div>
          <div className="text-sm text-gray-400">Available Units</div>
        </div>
      </div>
    </div>
  );

  const renderNodes = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Compute Nodes</h3>
        <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <RefreshCw size={18} className="text-gray-400" />
        </button>
      </div>

      <div className="space-y-2">
        {nodes.map(node => (
          <div key={node.nodeId} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className={`w-3 h-3 rounded-full ${node.status === 'online' ? 'bg-green-500' : node.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <div className="flex-1">
              <div className="font-mono text-sm text-white">{node.address.slice(0, 10)}...</div>
              <div className="text-xs text-gray-500">
                Uptime: {(node.uptime * 100).toFixed(1)}% | Reliability: {(node.reliability * 100).toFixed(0)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white">{node.availableCompute} units</div>
              <div className="text-xs text-gray-500">${node.pricePerHour}/hr</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Ada Portal
            </h2>
            <p className="text-xs text-gray-500">AI Workforce + Compute for Cardano</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-cyan-600/20 text-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {activeTab === 'marketplace' && renderMarketplace()}
            {activeTab === 'leaderboard' && renderLeaderboard()}
            {activeTab === 'training' && renderTraining()}
            {activeTab === 'packages' && renderPackages()}
            {activeTab === 'compute' && renderCompute()}
            {activeTab === 'nodes' && renderNodes()}
          </>
        )}
      </div>
    </div>
  );
};

export default AdaPortalPanel;
