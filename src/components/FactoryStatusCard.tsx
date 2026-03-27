import React, { useState, useEffect, useCallback } from "react";
import { Factory, Activity, Box, Clock, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { ChainId, SUPPORTED_CHAINS, HYPERCYCLE_CONTRACTS } from "../types/wallet";
import { factoryStatusService, FactoryStatus } from "../services/FactoryStatusService";

interface FactoryStatusCardProps {
  chainId: ChainId | null;
  isConnected: boolean;
}

export const FactoryStatusCard: React.FC<FactoryStatusCardProps> = ({
  chainId,
  isConnected,
}) => {
  const [factoryStatuses, setFactoryStatuses] = useState<Map<ChainId, FactoryStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch factory status
  const fetchFactoryStatus = useCallback(async () => {
    if (!isConnected || !chainId || !window.ethereum) return;

    setIsLoading(true);
    setError(null);

    try {
      const status = await factoryStatusService.getFactoryStatus(chainId, window.ethereum);
      setFactoryStatuses((prev) => new Map(prev).set(chainId, status));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch factory status");
    } finally {
      setIsLoading(false);
    }
  }, [chainId, isConnected]);

  useEffect(() => {
    if (chainId && isConnected) {
      fetchFactoryStatus();
    }
  }, [chainId, isConnected, fetchFactoryStatus]);

  // Get current chain's factory status
  const currentFactory = chainId ? factoryStatuses.get(chainId) : null;
  const currentContract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
  const currentChain = chainId ? SUPPORTED_CHAINS[chainId] : null;

  if (!isConnected) {
    return (
      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-2 text-gray-500">
          <Factory className="w-4 h-4" />
          <span>Connect wallet to view factory status</span>
        </div>
      </div>
    );
  }

  if (!chainId || !currentChain || !currentContract) {
    return (
      <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-2 text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          <span>Switch to Ethereum or Base to view factory status</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5 text-purple-400" />
          <span className="font-medium text-gray-100">{currentContract.name}</span>
          {currentFactory?.isResponsive && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button
          onClick={fetchFactoryStatus}
          disabled={isLoading}
          className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !currentFactory && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
        </div>
      )}

      {/* Error state */}
      {error && !currentFactory && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Factory stats */}
      {currentFactory && (
        <div className="grid grid-cols-2 gap-3">
          {/* Total Supply */}
          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Box className="w-4 h-4" />
              <span>Total Nodes</span>
            </div>
            <div className="text-xl font-bold text-gray-100">
              {factoryStatusService.formatNumber(currentFactory.totalSupply)}
            </div>
          </div>

          {/* Network */}
          <div className="bg-gray-900/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              <span>Network</span>
            </div>
            <div className="text-xl font-bold text-gray-100">
              {currentChain.name}
            </div>
          </div>

          {/* Last Block */}
          {currentFactory.lastBlock && (
            <div className="bg-gray-900/50 p-3 rounded-lg col-span-2">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                <span>Block Height</span>
              </div>
              <div className="text-sm text-gray-100 font-mono">
                {currentFactory.lastBlock.toLocaleString()}
              </div>
            </div>
          )}

          {/* Error indicator */}
          {currentFactory.error && (
            <div className="col-span-2 flex items-center gap-2 text-yellow-400 text-sm bg-yellow-900/20 p-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span>{currentFactory.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Contract link */}
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        <a
          href={`${currentChain.blockExplorer}/address/${currentContract.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <span>View Contract on Explorer</span>
          <Activity className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};

export default FactoryStatusCard;