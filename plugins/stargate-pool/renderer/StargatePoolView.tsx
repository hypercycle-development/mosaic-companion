import React, { useState, useEffect } from 'react';
import { 
  Loader2, RefreshCw, Shield, Zap, Globe, 
  ChevronRight, CheckCircle, XCircle, Crown,
  Server, ArrowRight, Wallet, Hash, Clock, Activity
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

// Merkelizer-verified ANFE info
interface VerifiedANFE {
  id: string;
  tokenId: string;
  contractAddress: string;
  owner: string;
  chainId: number;
  chainName: string;
  level?: number;
  verification: {
    valid: boolean;
    anfeId: string;
    nodeFactoryId?: string;
    tranche?: string;
    uptime?: number;
    reliability?: number;
    status?: 'online' | 'offline' | 'busy';
    registeredAt?: number;
    lastVerified?: number;
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
  const [anfes, setAnfes] = useState<VerifiedANFE[]>([]);
  const [merkelizerAvailable, setMerkelizerAvailable] = useState<boolean>(false);

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
      const resolvedAddress = web3Window.ethereum?.selectedAddress 
        || web3Window.mosaic?.wallet?.address 
        || web3Window.electronAPI?.web3?.getAddress?.()
        || '';
      
      if (resolvedAddress) {
        setWalletAddress(resolvedAddress);
      }

      // Load factories
      await loadFactories();

      // Load ANFEs from Graph/Merkelizer if wallet connected
      if (resolvedAddress) {
        await loadANFEs(resolvedAddress);
      }
    } catch (error) {
      console.error('[StargatePool] Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load ANFEs via Graph + Merkelizer
  const loadANFEs = async (address: string) => {
    try {
      // Check if ANFEService is available (exposed via window)
      const anfeService = (window as any).anfeService;
      if (anfeService) {
        const walletANFEs = await anfeService.loadWalletANFEs(address);
        
        // Transform to VerifiedANFE format
        const verified: VerifiedANFE[] = walletANFEs.anfes.map((anfe: any) => ({
          id: anfe.id,
          tokenId: anfe.tokenId,
          contractAddress: anfe.contractAddress,
          owner: anfe.owner,
          chainId: anfe.chainId,
          chainName: anfe.chainName,
          level: anfe.attributes?.core?.level?.value || anfe.attributes?.raw?.find((a: any) => a.trait_type === 'Level')?.value,
          verification: {
            valid: anfe.verification?.valid || false,
            anfeId: anfe.verification?.anfeId || anfe.id,
            nodeFactoryId: anfe.verification?.nodeFactoryId,
            tranche: anfe.verification?.tranche,
            uptime: anfe.verification?.uptime,
            reliability: anfe.verification?.reliability,
            status: anfe.verification?.status,
            registeredAt: anfe.verification?.registeredAt,
            lastVerified: anfe.verification?.lastVerified,
          },
        }));
        setAnfes(verified);
        
        // Check if ANFEs loaded (indicates Graph/Merkelizer is reachable)
        // Show verification data if we have any ANFEs
        setMerkelizerAvailable(verified.length > 0);
        console.log('[StargatePool] Loaded', verified.length, 'ANFEs, verification valid:', verified.filter(a => a.verification.valid).length);
      } else {
        console.warn('[StargatePool] ANFEService not available on window');
      }
    } catch (error) {
      console.error('[StargatePool] Failed to load ANFEs:', error);
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
          isEligible: true,
        }));
        setFactories(results);
      }
    } catch (e) {
      console.error('[StargatePool] Load error:', e);
    }
  };

  // Format uptime as percentage
  const formatUptime = (uptime?: number): string => {
    if (uptime === undefined) return '—';
    return `${(uptime * 100).toFixed(1)}%`;
  };

  // Format reliability as percentage
  const formatReliability = (reliability?: number): string => {
    if (reliability === undefined) return '—';
    return `${(reliability * 100).toFixed(1)}%`;
  };

  // Format timestamp to relative time
  const formatTimeAgo = (timestamp?: number): string => {
    if (!timestamp) return '—';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  const clearAllFactories = async () => {
    localStorage.removeItem('mosaic_stargate_factories');
    setFactories([]);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadFactories();
    if (walletAddress) {
      await loadANFEs(walletAddress);
    }
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
        {/* ANFE Section - Show Merkelizer-verified ANFEs */}
        {anfes.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Your ANFEs (Verified via Merkelizer)</h2>
              {merkelizerAvailable && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-green-500/20 text-green-400 border border-green-500/30">
                  VERIFIED
                </span>
              )}
            </div>
            
            <div className="grid gap-3">
              {anfes.map((anfe) => (
                <div 
                  key={anfe.id}
                  className="p-4 rounded-lg bg-[#0d1117] border border-cyan-900/30"
                >
                  <div className="flex items-start gap-3">
                    {/* Chain Icon */}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                      style={{ 
                        backgroundColor: `${getChainColor(anfe.chainName?.toLowerCase() || 'ethereum')}20`, 
                        color: getChainColor(anfe.chainName?.toLowerCase() || 'ethereum') 
                      }}
                    >
                      {getChainIcon(anfe.chainName?.toLowerCase() || 'ethereum')}
                    </div>
                    
                    {/* ANFE Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          ANFE #{anfe.tokenId}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          Level {anfe.level || 1}
                        </span>
                        {anfe.verification.valid ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                        <span>{anfe.chainName}</span>
                        <span>•</span>
                        <span className="truncate max-w-[160px]">{anfe.contractAddress.slice(0, 10)}...</span>
                      </div>

                      {/* Merkelizer Data - show if we have any verification data */}
                      {merkelizerAvailable && (anfe.verification.valid || anfe.verification.status || anfe.verification.uptime) && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {/* Node Factory ID */}
                          {anfe.verification.nodeFactoryId ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                              <Hash className="w-3 h-3 text-cyan-400" />
                              <span className="text-gray-500">Node Factory:</span>
                              <span className="text-cyan-300 font-mono truncate">
                                {anfe.verification.nodeFactoryId}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                              <Hash className="w-3 h-3 text-gray-600" />
                              <span className="text-gray-500">Node Factory:</span>
                              <span className="text-gray-600 font-mono">Pending...</span>
                            </div>
                          )}
                          
                          {/* Tranche */}
                          {anfe.verification.tranche ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                              <Globe className="w-3 h-3 text-purple-400" />
                              <span className="text-gray-500">Tranche:</span>
                              <span className="text-purple-300 font-mono">
                                {anfe.verification.tranche}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                              <Globe className="w-3 h-3 text-gray-600" />
                              <span className="text-gray-500">Tranche:</span>
                              <span className="text-gray-600 font-mono">Pending...</span>
                            </div>
                          )}
                          
                          {/* Uptime */}
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                            <Activity className="w-3 h-3 text-green-400" />
                            <span className="text-gray-500">Uptime:</span>
                            <span className="text-green-300 font-mono">
                              {formatUptime(anfe.verification.uptime)}
                            </span>
                          </div>
                          
                          {/* Reliability */}
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span className="text-gray-500">Reliability:</span>
                            <span className="text-amber-300 font-mono">
                              {formatReliability(anfe.verification.reliability)}
                            </span>
                          </div>
                          
                          {/* Status */}
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-mono ${
                              anfe.verification.status === 'online' ? 'text-green-400' :
                              anfe.verification.status === 'busy' ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {anfe.verification.status || 'unknown'}
                            </span>
                          </div>
                          
                          {/* Last Verified */}
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#151a24]">
                            <RefreshCw className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500">Verified:</span>
                            <span className="text-gray-300 font-mono">
                              {formatTimeAgo(anfe.verification.lastVerified)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Show what Merkelizer provides when not available */}
                      {!merkelizerAvailable && (
                        <div className="mt-2 text-xs text-amber-400/60 font-mono">
                          {(() => {
                            const configured = import.meta.env.VITE_MERKELIZER_URL_MAINNET?.trim();
                            if (configured) return `Connecting to Merkelizer: ${configured}`;
                            return 'Merkelizer URL not configured. Set VITE_MERKELIZER_URL_MAINNET in your .env file.';
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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

        {filteredFactories.length === 0 && !loading && anfes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div className="text-sm">No factories or ANFEs found</div>
            <div className="text-xs mt-1">Connect a wallet to view your ANFEs</div>
          </div>
        )}
      </div>
    </div>
  );
}
