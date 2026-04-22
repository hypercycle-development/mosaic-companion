import React, { useState, useEffect } from 'react';
import { 
  Loader2, RefreshCw, Shield, Zap, Globe, 
  ChevronRight, CheckCircle, XCircle, Crown,
  Server, ArrowRight, Wallet, Hash
} from 'lucide-react';

// Types (mirrored from service)
interface NodeFactory {
  factory_id: string;
  name: string;
  chain: 'ethereum' | 'base' | 'cardano';
  network: string;
  owner_wallet: string;
  collection_access: string[];
  total_capacity: number;
  available_capacity: number;
  skills_supported: string[];
  status: 'active' | 'inactive';
  delegation: {
    is_public: boolean;
    access_type: 'public' | 'nft-gated';
  };
}

interface WalletFactoryResult {
  factory: NodeFactory;
  isEligible: boolean;
  isVerified?: boolean;
  reputation_score?: number;
  leaderboard_rank?: number;
}

interface BridgeStatus {
  available: boolean;
  registered: boolean;
  tier?: string;
  clientId?: string;
}

export function StargatePoolView() {
  const [loading, setLoading] = useState(true);
  const [factories, setFactories] = useState<WalletFactoryResult[]>([]);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ available: false, registered: false });
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    
    try {
      // Check HyperInsight bridge status
      if (window.electronAPI?.hyperinsight) {
        const status = await window.electronAPI.hyperinsight.getStatus();
        setBridgeStatus({
          available: true,
          registered: status.registered || false,
          tier: status.tier,
        });
      }

      // Get connected wallet (from Web3Page or similar)
      const web3Window = window as any;
      if (web3Window.ethereum?.selectedAddress) {
        setWalletAddress(web3Window.ethereum.selectedAddress);
      }

      // Load factories
      await loadFactories();
    } catch (error) {
      console.error('[StargatePool] Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFactories = async () => {
    try {
      // Use localStorage directly since service runs in renderer
      const stored = localStorage.getItem('mosaic_stargate_factories');
      if (stored) {
        const data = JSON.parse(stored) as NodeFactory[];
        const results: WalletFactoryResult[] = data.map(factory => ({
          factory,
          isEligible: true, // Default for demo
        }));
        setFactories(results);
      }
    } catch (e) {
      console.error('[StargatePool] Load error:', e);
    }
  };

  const addDemoFactories = async () => {
    const demos: NodeFactory[] = [
      {
        factory_id: 'demo_alpha',
        name: 'HyperCycle Alpha Node',
        chain: 'base',
        network: 'base-mainnet',
        owner_wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f',
        collection_access: [],
        total_capacity: 100,
        available_capacity: 45,
        skills_supported: ['code-generation', 'smart-contracts', 'reasoning'],
        status: 'active',
        delegation: { is_public: true, access_type: 'public' },
      },
      {
        factory_id: 'demo_beta',
        name: 'HyperCycle Beta Node',
        chain: 'ethereum',
        network: 'mainnet',
        owner_wallet: '0x8Ba1f109551bD432803012645Hc136E7a',
        collection_access: ['0xabc123...'],
        total_capacity: 50,
        available_capacity: 12,
        skills_supported: ['image-generation', 'video-generation'],
        status: 'active',
        delegation: { is_public: false, access_type: 'nft-gated' },
      },
      {
        factory_id: 'demo_gamma',
        name: 'HyperCycle Gamma Node',
        chain: 'cardano',
        network: 'mainnet',
        owner_wallet: 'addr1qx...',
        collection_access: [],
        total_capacity: 200,
        available_capacity: 180,
        skills_supported: ['text-generation', 'analysis'],
        status: 'active',
        delegation: { is_public: true, access_type: 'public' },
      },
    ];

    const stored = localStorage.getItem('mosaic_stargate_factories');
    let existing: NodeFactory[] = [];
    try {
      existing = stored ? JSON.parse(stored) : [];
    } catch {}

    const updated = [...existing, ...demos.filter(d => !existing.find(e => e.factory_id === d.factory_id))];
    localStorage.setItem('mosaic_stargate_factories', JSON.stringify(updated));
    await loadFactories();
  };

  const clearAllFactories = async () => {
    localStorage.removeItem('mosaic_stargate_factories');
    setFactories([]);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadFactories();
    setRefreshing(false);
  };

  const filteredFactories = selectedChain === 'all' 
    ? factories 
    : factories.filter(f => f.factory.chain === selectedChain);

  const getChainIcon = (chain: string) => {
    switch (chain) {
      case 'ethereum': return '⟐';
      case 'base': return '◈';
      case 'cardano': return '◆';
      default: return '●';
    }
  };

  const getChainColor = (chain: string) => {
    switch (chain) {
      case 'ethereum': return '#627eea';
      case 'base': return '#0052ff';
      case 'cardano': return '#0033ad';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#050709]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <div className="text-cyan-200/60 font-mono text-sm">Loading Stargate Pool...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#050709] text-gray-300 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[#0a0e14] border-b border-cyan-900/30 px-5 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-wide">Stargate Pool</h1>
              <p className="text-xs text-cyan-400/60 font-mono">NFT-Gated Node Factories</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Bridge Status */}
            {bridgeStatus.available && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${
                bridgeStatus.registered 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                <Shield className="w-3 h-3" />
                {bridgeStatus.registered ? 'Verified' : 'Unlicensed'}
              </div>
            )}
            
            <button 
              onClick={refresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1117] border border-cyan-900/30">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-300/80">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No wallet connected'}
            </span>
          </div>
          
          <div className="flex-1" />
          
          {/* Chain Filter */}
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-cyan-900/30 text-xs font-mono text-cyan-300 outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Chains</option>
            <option value="ethereum">Ethereum</option>
            <option value="base">Base</option>
            <option value="cardano">Cardano</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Dev Tools */}
        {factories.length === 0 && (
          <div className="mb-4 p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
            <div className="text-sm text-cyan-300 mb-3">No factories registered yet.</div>
            <div className="flex gap-2">
              <button 
                onClick={addDemoFactories}
                className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-mono hover:bg-cyan-500/30 transition-colors"
              >
                + Add Demo Factories
              </button>
            </div>
          </div>
        )}

        {/* Factory Cards */}
        <div className="grid gap-3">
          {filteredFactories.map((result) => {
            const { factory, isEligible, isVerified, reputation_score, leaderboard_rank } = result;
            const usagePercent = ((factory.total_capacity - factory.available_capacity) / factory.total_capacity) * 100;
            
            return (
              <div 
                key={factory.factory_id}
                className={`p-4 rounded-lg bg-[#0d1117] border transition-all hover:border-cyan-500/30 ${
                  !isEligible ? 'border-red-900/30 opacity-60' : 'border-cyan-900/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Chain Icon */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: `${getChainColor(factory.chain)}20`, color: getChainColor(factory.chain) }}
                  >
                    {getChainIcon(factory.chain)}
                  </div>
                  
                  {/* Factory Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{factory.name}</h3>
                      {factory.status === 'active' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {isVerified && (
                        <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      {leaderboard_rank && leaderboard_rank <= 10 && (
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                      <span>{factory.network}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">{factory.owner_wallet.slice(0, 8)}...</span>
                      {leaderboard_rank && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400">Rank #{leaderboard_rank}</span>
                        </>
                      )}
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {factory.skills_supported.slice(0, 4).map((skill, i) => (
                        <span 
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Capacity Bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">Capacity</span>
                        <span className="text-cyan-400 font-mono">
                          {factory.available_capacity}/{factory.total_capacity}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1a1f2e] overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400"
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Eligibility & Access */}
                  <div className="text-right">
                    {factory.delegation.is_public ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400 text-xs font-mono">
                        <Globe className="w-3 h-3" />
                        Public
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-mono">
                        <Shield className="w-3 h-3" />
                        NFT-Gated
                      </div>
                    )}
                    
                    <div className={`mt-2 text-xs font-mono ${isEligible ? 'text-green-400' : 'text-red-400'}`}>
                      {isEligible ? '✓ Eligible' : '✗ Not Eligible'}
                    </div>

                    {reputation_score !== undefined && (
                      <div className="mt-1 text-xs font-mono text-cyan-400">
                        Rep: {reputation_score}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredFactories.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No factories found</div>
            <div className="text-xs mt-1">Connect a wallet or add demo factories</div>
          </div>
        )}
      </div>
    </div>
  );
}