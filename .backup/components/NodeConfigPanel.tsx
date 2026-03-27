import React, { useState, useEffect, useCallback } from "react";
import { Server, Link, Unlink, RefreshCw, AlertCircle, Loader2, ExternalLink, Activity, Clock, Users, Zap, Plus, Trash2, HardDrive } from "lucide-react";
import { AIAgentConfig } from "../types/ai";
import { ChainId, SUPPORTED_CHAINS, HYPERCYCLE_CONTRACTS } from "../types/wallet";
import { NodeModelConfig, HyperAIBOXNode, DEFAULT_HYPERAIBOX_NODES } from "../types/nodeConfig";
import { nodeConfigService } from "../services/NodeConfigService";
import { nodeStatusService, NodeStatus } from "../services/NodeStatusService";
import { walletService } from "../services/WalletService";
import { HyperAIBOXService } from "../services/HyperAIBOXService";

interface LicenseNFT {
  tokenId: string;
  status: number;
  height: number;
}

interface ANFENFT {
  anfeId: string;
  licenseId: string;
  level: number;
  tranche: string;
  chypcId: string;
  status: string;
}

interface NodeConfigPanelProps {
  address: string;
  chainId: ChainId;
  agents: AIAgentConfig[];
  onLinkNode?: (nodeId: string, agentId: string) => void;
  onUnlinkNode?: (nodeId: string) => void;
}

export const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  address,
  chainId,
  agents,
  onLinkNode,
  onUnlinkNode,
}) => {
  const [ownedLicenses, setOwnedLicenses] = useState<LicenseNFT[]>([]);
  const [ownedANFEs, setOwnedANFEs] = useState<ANFENFT[]>([]);
  const [configs, setConfigs] = useState<NodeModelConfig[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [nodeEndpoints, setNodeEndpoints] = useState<Record<string, { host: string; port: number }>>({});
  
  // HyperAIBOX nodes state
  const [hyperboxNodes, setHyperboxNodes] = useState<HyperAIBOXNode[]>([]);
  const [isLoadingHyperbox, setIsLoadingHyperbox] = useState(false);
  const [showAddHyperbox, setShowAddHyperbox] = useState(false);
  const [newHyperbox, setNewHyperbox] = useState({ name: '', ip: '', user: '' });

  const activeAgents = agents.filter((a) => a.isActive);
  
  // Get contract info for current chain
  const currentContract = HYPERCYCLE_CONTRACTS.find(c => c.chainId === chainId);
  const isBaseChain = chainId === 8453;

  // Load owned licenses/ANFEs and configs
  const loadData = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      if (isBaseChain) {
        // Load ANFEs on Base
        const anfes = await walletService.getANFEData(address);
        console.log("[NodeConfigPanel] Owned ANFEs:", anfes);
        setOwnedANFEs(anfes);
        setOwnedLicenses([]);
      } else {
        // Load Licenses on Ethereum
        const licenses = await walletService.getOwnedLicenses(address, chainId);
        console.log("[NodeConfigPanel] Owned licenses:", licenses);
        setOwnedLicenses(licenses);
        setOwnedANFEs([]);
      }

      // Load configs from storage
      const chainConfigs = nodeConfigService.getConfigsForChain(chainId);
      setConfigs(chainConfigs);

      // Load saved endpoints from localStorage
      const savedEndpoints = localStorage.getItem(`node_endpoints_${chainId}`);
      if (savedEndpoints) {
        setNodeEndpoints(JSON.parse(savedEndpoints));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, isBaseChain]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load HyperAIBOX nodes
  useEffect(() => {
    const loadHyperboxNodes = async () => {
      setIsLoadingHyperbox(true);
      try {
        const nodes = await HyperAIBOXService.getNodes();
        setHyperboxNodes(nodes);
        console.log("[NodeConfigPanel] HyperAIBOX nodes:", nodes);
      } catch (err) {
        console.error("[NodeConfigPanel] Error loading HyperAIBOX nodes:", err);
      } finally {
        setIsLoadingHyperbox(false);
      }
    };
    loadHyperboxNodes();
  }, []);

  // Add new HyperAIBOX node
  const handleAddHyperbox = async () => {
    if (!newHyperbox.name || !newHyperbox.ip || !newHyperbox.user) return;
    
    try {
      const node = await HyperAIBOXService.addNode({
        name: newHyperbox.name,
        ip: newHyperbox.ip,
        user: newHyperbox.user,
        role: 'field-operator',
        status: 'unknown',
        capabilities: ['ollama', 'storage'],
        storage: { available: 100, used: 0, path: `/home/${newHyperbox.user}/storage` },
        linkedAgents: [],
      });
      setHyperboxNodes(prev => [...prev, node]);
      setNewHyperbox({ name: '', ip: '', user: '' });
      setShowAddHyperbox(false);
    } catch (err) {
      console.error("[NodeConfigPanel] Error adding HyperAIBOX node:", err);
    }
  };

  // Remove HyperAIBOX node
  const handleRemoveHyperbox = async (nodeId: string) => {
    try {
      await HyperAIBOXService.removeNode(nodeId);
      setHyperboxNodes(prev => prev.filter(n => n.id !== nodeId));
    } catch (err) {
      console.error("[NodeConfigPanel] Error removing HyperAIBOX node:", err);
    }
  };

  // Link agent to HyperAIBOX node
  const handleLinkHyperbox = async (nodeId: string, agentId: string) => {
    try {
      await HyperAIBOXService.linkAgentToNode(agentId, nodeId);
      const nodes = await HyperAIBOXService.getNodes();
      setHyperboxNodes(nodes);
    } catch (err) {
      console.error("[NodeConfigPanel] Error linking agent:", err);
    }
  };

  // Check status of all licenses
  const checkNodesStatus = async () => {
    setIsCheckingStatus(true);
    const statuses = new Map<string, NodeStatus>();
    const items = isBaseChain ? ownedANFEs : ownedLicenses;

    for (const item of items) {
      const tokenId = isBaseChain ? (item as ANFENFT).anfeId : (item as LicenseNFT).tokenId;
      const endpoint = nodeEndpoints[tokenId];
      if (endpoint?.host) {
        const status = await nodeStatusService.checkNodeStatus(endpoint.host, endpoint.port);
        statuses.set(tokenId, status);
      }
    }

    setNodeStatuses(statuses);
    setIsCheckingStatus(false);
  };

  // Save endpoint configuration
  const saveNodeEndpoint = (tokenId: string, host: string, port: number) => {
    const updated = { ...nodeEndpoints, [tokenId]: { host, port } };
    setNodeEndpoints(updated);
    localStorage.setItem(`node_endpoints_${chainId}`, JSON.stringify(updated));
  };

  // Link node to AI model
  const handleLinkNode = (tokenId: string, agentId: string) => {
    const contract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
    if (!contract) return;

    const config = nodeConfigService.setConfig(tokenId, chainId, contract.address, agentId);
    setConfigs(nodeConfigService.getConfigsForChain(chainId));
    onLinkNode?.(config.id, agentId);
  };

  // Unlink node from AI model
  const handleUnlinkNode = (nodeId: string) => {
    nodeConfigService.removeConfig(nodeId);
    setConfigs(nodeConfigService.getConfigsForChain(chainId));
    onUnlinkNode?.(nodeId);
  };

  // Get config for a node
  const getConfigForNode = (tokenId: string): NodeModelConfig | undefined => {
    const contract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);
    return configs.find((c) => c.tokenId === tokenId && c.contractAddress === contract?.address);
  };

  // Get agent for a config
  const getAgentForConfig = (config: NodeModelConfig): AIAgentConfig | undefined => {
    return agents.find((a) => a.id === config.agentId);
  };

  const chain = SUPPORTED_CHAINS[chainId];
  const contract = HYPERCYCLE_CONTRACTS.find((c) => c.chainId === chainId);

  if (!chain || !contract) {
    return (
      <div className="bg-gray-800/50 p-4 rounded-lg border border-yellow-700/50">
        <div className="flex items-center gap-2 text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          <span>Switch to Ethereum or Base to view your nodes</span>
        </div>
      </div>
    );
  }

  // Count items based on chain
  const itemCount = isBaseChain ? ownedANFEs.length : ownedLicenses.length;
  const itemType = isBaseChain ? "ANFE" : "License";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-100">
            {contract.name}
          </h3>
          <p className="text-sm text-gray-400">
            {itemCount} {itemType.toLowerCase()}{itemCount !== 1 ? "s" : ""} owned on {chain.name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkNodesStatus}
            disabled={isCheckingStatus || itemCount === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${isCheckingStatus ? "animate-pulse" : ""}`} />
            Check Status
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          <span className="ml-2 text-gray-400">Loading {itemType.toLowerCase()}s...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && itemCount === 0 && (
        <div className="text-center py-8 border border-dashed border-gray-700 rounded-lg">
          <Server className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500 mb-1">No {itemType.toLowerCase()}s found</p>
          <p className="text-sm text-gray-600">
            You don't own any {contract.name} tokens on {chain.name}
          </p>
        </div>
      )}

      {/* ANFE List (Base chain) */}
      {!isLoading && !error && isBaseChain && ownedANFEs.length > 0 && (
        <div className="space-y-3">
          {ownedANFEs.map((anfe) => {
            const config = getConfigForNode(anfe.anfeId);
            const linkedAgent = config ? getAgentForConfig(config) : undefined;
            const status = nodeStatuses.get(anfe.anfeId);
            const endpoint = nodeEndpoints[anfe.anfeId];

            return (
              <div
                key={anfe.anfeId}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* ANFE header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-100 flex items-center gap-2">
                        ANFE #{anfe.anfeId}
                        {anfe.status && (
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                            anfe.status === "ALIVE"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-red-900/50 text-red-400"
                          }`}>
                            {anfe.status}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        License: {anfe.licenseId} • Level: {anfe.level} • Tranche: {anfe.tranche}
                      </div>
                    </div>
                  </div>
                  
                  {linkedAgent && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 rounded-lg border border-purple-500/30">
                      <Link className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-300">{linkedAgent.name}</span>
                    </div>
                  )}
                </div>

                {/* ANFE details table */}
                <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-700/50">
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">ANFE ID</div>
                      <div className="text-gray-200 font-mono text-xs">{anfe.anfeId}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">License ID</div>
                      <div className="text-gray-200 font-mono text-xs">{anfe.licenseId}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Level</div>
                      <div className="text-gray-200">{anfe.level}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Tranche</div>
                      <div className="text-gray-200">{anfe.tranche}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">CHyPC ID</div>
                      <div className="text-gray-200 font-mono text-xs">{anfe.chypcId || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Endpoint config */}
                <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                  <label className="block text-sm text-gray-400 mb-2">
                    Node Endpoint (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={endpoint?.host || ""}
                      onChange={(e) => {
                        const newEndpoint = { host: e.target.value, port: endpoint?.port || 8000 };
                        setNodeEndpoints(prev => ({ ...prev, [anfe.anfeId]: newEndpoint }));
                      }}
                      onBlur={(e) => saveNodeEndpoint(anfe.anfeId, e.target.value, endpoint?.port || 8000)}
                      placeholder="e.g., 192.168.1.100"
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100 text-sm"
                    />
                    <input
                      type="number"
                      value={endpoint?.port || 8000}
                      onChange={(e) => {
                        const newEndpoint = { host: endpoint?.host || "", port: parseInt(e.target.value) || 8000 };
                        setNodeEndpoints(prev => ({ ...prev, [anfe.anfeId]: newEndpoint }));
                      }}
                      onBlur={(e) => saveNodeEndpoint(anfe.anfeId, endpoint?.host || "", parseInt(e.target.value) || 8000)}
                      placeholder="8000"
                      className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100 text-sm"
                    />
                  </div>
                </div>

                {/* Link to agent */}
                {!config && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                    <label className="block text-sm text-gray-400 mb-2">
                      Link to AI Agent
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedAgent[anfe.anfeId] || ""}
                        onChange={(e) =>
                          setSelectedAgent((prev) => ({
                            ...prev,
                            [anfe.anfeId]: e.target.value,
                          }))
                        }
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100"
                      >
                        <option value="">Select an agent...</option>
                        {activeAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.provider} • {agent.model})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const agentId = selectedAgent[anfe.anfeId];
                          if (agentId) {
                            handleLinkNode(anfe.anfeId, agentId);
                          }
                        }}
                        disabled={!selectedAgent[anfe.anfeId]}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Link
                      </button>
                    </div>
                  </div>
                )}

                {/* Change linked agent */}
                {config && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                    <label className="block text-sm text-gray-400 mb-2">
                      Change Agent
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={config.agentId}
                        onChange={(e) => handleLinkNode(anfe.anfeId, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100"
                      >
                        {activeAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.provider} • {agent.model})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUnlinkNode(config.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Unlink"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* License List (Ethereum chain) */}
      {!isLoading && !error && !isBaseChain && ownedLicenses.length > 0 && (
        <div className="space-y-3">
          {ownedLicenses.map((license) => {
            const config = getConfigForNode(license.tokenId);
            const linkedAgent = config ? getAgentForConfig(config) : undefined;
            const status = nodeStatuses.get(license.tokenId);
            const endpoint = nodeEndpoints[license.tokenId];

            return (
              <div
                key={license.tokenId}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* License header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Server className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-100">
                        License #{license.tokenId}
                      </div>
                      <div className="text-sm text-gray-400">
                        {contract.name} • Height: {license.height}
                      </div>
                    </div>
                  </div>
                  
                  {linkedAgent && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/30 rounded-lg border border-purple-500/30">
                      <Link className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-300">{linkedAgent.name}</span>
                    </div>
                  )}
                </div>

                {/* Link to agent */}
                {!config && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                    <label className="block text-sm text-gray-400 mb-2">
                      Link to AI Agent
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedAgent[license.tokenId] || ""}
                        onChange={(e) =>
                          setSelectedAgent((prev) => ({
                            ...prev,
                            [license.tokenId]: e.target.value,
                          }))
                        }
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100"
                      >
                        <option value="">Select an agent...</option>
                        {activeAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.provider} • {agent.model})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const agentId = selectedAgent[license.tokenId];
                          if (agentId) {
                            handleLinkNode(license.tokenId, agentId);
                          }
                        }}
                        disabled={!selectedAgent[license.tokenId]}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Link
                      </button>
                    </div>
                  </div>
                )}

                {/* Change linked agent */}
                {config && (
                  <div className="px-4 pb-4 border-t border-gray-700/50 pt-3">
                    <label className="block text-sm text-gray-400 mb-2">
                      Change Agent
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={config.agentId}
                        onChange={(e) => handleLinkNode(license.tokenId, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100"
                      >
                        {activeAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.provider} • {agent.model})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUnlinkNode(config.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        title="Unlink"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 mt-4">
        <p>
          <strong>How it works:</strong> Link your {itemType}s to AI agents for intelligent routing.
          {isBaseChain ? " ANFEs are on Base network." : " Licenses are on Ethereum mainnet."}
        </p>
        <p className="mt-1">
          <a
            href={`${chain.blockExplorer}/token/${contract.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300"
          >
            View contract on {chain.blockExplorer.replace("https://", "")} ↗
          </a>
        </p>
      </div>

      {/* HyperAIBOX Nodes Section */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-medium text-gray-100">HyperAIBOX Nodes</h3>
          </div>
          <button
            onClick={() => setShowAddHyperbox(!showAddHyperbox)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Node
          </button>
        </div>

        {/* Add Node Form */}
        {showAddHyperbox && (
          <div className="mb-4 p-4 bg-gray-800/50 border border-cyan-500/30 rounded-lg">
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={newHyperbox.name}
                onChange={(e) => setNewHyperbox(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Name (e.g., R2D2)"
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
              <input
                type="text"
                value={newHyperbox.ip}
                onChange={(e) => setNewHyperbox(prev => ({ ...prev, ip: e.target.value }))}
                placeholder="IP (e.g., 192.168.0.10)"
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
              <input
                type="text"
                value={newHyperbox.user}
                onChange={(e) => setNewHyperbox(prev => ({ ...prev, user: e.target.value }))}
                placeholder="User (e.g., molt)"
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAddHyperbox}
                disabled={!newHyperbox.name || !newHyperbox.ip || !newHyperbox.user}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Node
              </button>
              <button
                onClick={() => setShowAddHyperbox(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* HyperAIBOX Nodes List */}
        {isLoadingHyperbox ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="ml-2 text-gray-400">Loading nodes...</span>
          </div>
        ) : hyperboxNodes.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-gray-700 rounded-lg">
            <HardDrive className="w-10 h-10 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-500">No HyperAIBOX nodes configured</p>
            <p className="text-xs text-gray-600 mt-1">Add your local AI boxes for agent toolkits</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hyperboxNodes.map((node) => (
              <div
                key={node.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Node Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-100 flex items-center gap-2">
                        {node.name}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          node.status === 'online' ? 'bg-green-900/50 text-green-400' :
                          node.status === 'offline' ? 'bg-red-900/50 text-red-400' :
                          'bg-gray-700 text-gray-400'
                        }`}>
                          {node.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {node.ip} • {node.user}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveHyperbox(node.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Node Details */}
                <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-700/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">Role</div>
                      <div className="text-gray-200 capitalize">{node.role.replace('-', ' ')}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Storage</div>
                      <div className="text-gray-200">{HyperAIBOXService.formatStorage(node)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Capabilities</div>
                      <div className="text-gray-200 text-xs">{node.capabilities.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Linked Agents</div>
                      <div className="text-gray-200">{node.linkedAgents.length || 'None'}</div>
                    </div>
                  </div>
                </div>

                {/* Link Agent */}
                <div className="px-4 pb-4 pt-3 border-t border-gray-700/50">
                  <label className="block text-sm text-gray-400 mb-2">
                    Link to AI Agent
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedAgent[node.id] || ""}
                      onChange={(e) => setSelectedAgent(prev => ({ ...prev, [node.id]: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-gray-100"
                    >
                      <option value="">Select an agent...</option>
                      {activeAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.provider} • {agent.model})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const agentId = selectedAgent[node.id];
                        if (agentId) {
                          handleLinkHyperbox(node.id, agentId);
                        }
                      }}
                      disabled={!selectedAgent[node.id]}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Link
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 mt-4">
          <p>
            <strong>HyperAIBOX Nodes:</strong> Physical AI boxes on your network that provide storage, compute, and skills for agents.
          </p>
        </div>
      </div>
    </div>
  );
};