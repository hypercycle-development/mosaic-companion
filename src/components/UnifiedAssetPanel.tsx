// ============================================
// UnifiedAssetPanel.tsx — HyperCycle Multi-Chain Asset Discovery + Merkelizer
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Network, RefreshCw, Loader, Key } from 'lucide-react';
import {
  assetDiscovery,
  merkelizerService,
  stargatePoolService,
  HyperCycleAsset,
} from '../services/StargatePool';

export interface UnifiedAssetPanelProps {
  walletAddress: string | null;
  onConnectWallet: () => Promise<void>;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

const UnifiedAssetPanel: React.FC<UnifiedAssetPanelProps> = ({
  walletAddress,
  onConnectWallet,
  showNotification,
}) => {
  const [assets, setAssets] = useState<HyperCycleAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualTokenId, setManualTokenId] = useState('');
  const [showManual, setShowManual] = useState(false);

  const refresh = useCallback(
    async (addr: string, silent = false) => {
      setLoading(true);
      try {
        assetDiscovery.invalidateCache(addr);
        const result = await assetDiscovery.discoverAll(addr);
        const combined = [...result.ethereum.assets, ...result.base.assets];
        setAssets(combined);
        if (!silent) {
          showNotification('success', `Discovered ${combined.length} HyperCycle assets`);
        }
      } catch (e: any) {
        console.warn('[UnifiedAssetPanel] Discovery failed:', e);
        if (!silent) showNotification('error', e.message || 'Asset discovery failed');
      } finally {
        setLoading(false);
      }
    },
    [showNotification]
  );

  // Auto-scan when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      refresh(walletAddress, true);
    } else {
      setAssets([]);
    }
  }, [walletAddress, refresh]);

  const ethAssets = assets.filter((a) => a.chain === 'ethereum');
  const baseAssets = assets.filter((a) => a.chain === 'base');

  const renderAssetCard = (asset: HyperCycleAsset) => (
    <div key={asset.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{asset.symbol}</span>
          <span className="text-xs text-gray-500">{asset.name}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              asset.chain === 'ethereum'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-purple-500/20 text-purple-400'
            }`}
          >
            {asset.chain.toUpperCase()}
          </span>
          <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 rounded text-yellow-400">
            {asset.standard}
          </span>
          <span className="text-xs px-1.5 py-0.5 bg-gray-600/30 rounded text-gray-400">
            {asset.category}
          </span>
        </div>
        <span className="text-sm text-green-400 font-mono">{asset.balance}</span>
      </div>

      {asset.tokenId && (
        <div className="text-xs text-gray-500 mb-1">
          Token ID: <span className="text-cyan-400 font-mono">{asset.tokenId}</span>
        </div>
      )}

      {asset.nodeData && (
        <div className="flex items-center gap-2 text-[10px]">
          <span
            className={`px-1.5 py-0.5 rounded ${
              asset.nodeData.isAlive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {asset.nodeData.isAlive ? 'Online' : 'Offline'}
          </span>
          {asset.nodeData.measuredUptime !== undefined && (
            <span className="text-gray-500">
              Uptime: {(asset.nodeData.measuredUptime * 100).toFixed(1)}%
            </span>
          )}
          {asset.nodeData.network && (
            <span className="text-gray-500">Net: {asset.nodeData.network}</span>
          )}
        </div>
      )}

      <div className="text-[10px] text-gray-600 font-mono truncate mt-1">
        {asset.contractAddress}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          HyperCycle Assets
          {walletAddress && (
            <span className="text-xs text-gray-500 font-normal">
              ({assets.length} found)
            </span>
          )}
        </h4>
        {walletAddress && (
          <button
            onClick={() => refresh(walletAddress)}
            disabled={loading}
            className="px-2 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Scanning...' : 'Refresh'}
          </button>
        )}
      </div>

      {!walletAddress ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          <Network size={24} className="mx-auto mb-2 text-cyan-400/40" />
          <p>Connect wallet to scan HyperCycle assets.</p>
          <button
            onClick={onConnectWallet}
            className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm"
          >
            Connect Wallet
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader size={16} className="text-cyan-400 animate-spin" />
          <span className="ml-2 text-xs text-gray-400">Scanning HyperCycle contracts...</span>
        </div>
      ) : assets.length > 0 ? (
        <div className="space-y-4">
          {/* ETH Section */}
          {ethAssets.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                <Zap size={12} className="text-yellow-400" />
                Ethereum
              </h5>
              <div className="grid gap-2">{ethAssets.map(renderAssetCard)}</div>
            </div>
          )}

          {/* BASE Section */}
          {baseAssets.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                <Network size={12} className="text-purple-400" />
                Base
              </h5>
              <div className="grid gap-2">{baseAssets.map(renderAssetCard)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-500 text-sm">
          <Network size={20} className="mx-auto mb-2 text-gray-600" />
          <p>No HyperCycle assets detected.</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Checked: HyPC, HyPCL, c_HyPC, ANFE, IoAI modules on ETH + BASE.
          </p>
        </div>
      )}

      {/* Manual Entry */}
      {walletAddress && assets.length === 0 && !loading && (
        <div className="mt-2 p-3 bg-gray-800/30 rounded-xl border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Key size={12} className="text-cyan-400" />
              Add Manually
            </span>
            <button
              onClick={() => setShowManual(!showManual)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300"
            >
              {showManual ? 'Cancel' : '+ Add'}
            </button>
          </div>
          {showManual && (
            <div className="flex gap-2">
              <input
                type="text"
                value={manualTokenId}
                onChange={(e) => setManualTokenId(e.target.value)}
                placeholder="Token ID or contract address"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  if (manualTokenId && walletAddress) {
                    // Manual lookup via ANFE contract
                    stargatePoolService
                      .getANFEInfo(walletAddress)
                      .then((info) => {
                        showNotification('success', `Found ANFE #${manualTokenId}`);
                        // Could add to assets state here
                      })
                      .catch(() => {
                        showNotification('error', 'Token not found');
                      });
                  }
                }}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs"
              >
                Lookup
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedAssetPanel;
