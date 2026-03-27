/**
 * MidnightPage - Midnight Network Integration UI
 * 
 * Provides UI for:
 * - Deploying privacy-preserving nodes
 * - Delegating node management to agents
 * - Viewing node status and network info
 * - Privacy controls
 */

import React, { useEffect, useState } from "react";
import {
  Moon,
  Server,
  Shield,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  AlertTriangle,
  Cpu,
  Globe,
  Lock,
} from "lucide-react";
import { CardanoWalletConnect } from "./CardanoWalletConnect";

// =============================================================================
// Types (use global ElectronAPI interface from electron.d.ts)
// =============================================================================

interface NodeResult {
  nodeId: string;
  endpoint: string;
  privacyKey: string;
  status: "deploying" | "active" | "stopped" | "error";
  createdAt: number;
}

interface NetworkInfo {
  blockHeight: number;
  blockTime: number;
  sessionLength: number;
  validators: number;
  totalNodes: number;
}

// =============================================================================
// Sub-components
// =============================================================================

const StatusDot: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      status === "active"
        ? "bg-green-400"
        : status === "deploying"
        ? "bg-yellow-400"
        : status === "stopped"
        ? "bg-gray-400"
        : "bg-red-400"
    }`}
  />
);

const SectionHeader: React.FC<{ title: string; count?: number }> = ({
  title,
  count,
}) => (
  <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
    <span>{title}</span>
    {count !== undefined && (
      <span className="text-gray-600">({count})</span>
    )}
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const MidnightPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [nodes, setNodes] = useState<NodeResult[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateNode, setShowCreateNode] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Node creation form
  const [nodeType, setNodeType] = useState<"validator" | "full" | "light">("validator");
  const [nodeStake, setNodeStake] = useState(1000);
  const [nodePrivacy, setNodePrivacy] = useState<"public" | "shielded" | "private">("shielded");
  const [nodeDelegation, setNodeDelegation] = useState<"user" | "agent" | "hybrid">("user");

  // Get Midnight API
  const midnightApi = window.electronAPI?.midnight;

  // Initialize connection
  useEffect(() => {
    if (midnightApi) {
      initializeMidnight();
    }
  }, [midnightApi]);

  const initializeMidnight = async () => {
    if (!midnightApi) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await midnightApi.init();
      if (result.success) {
        setIsConnected(true);
        await loadNodes();
        await loadNetworkInfo();
      } else {
        setError(result.error || "Failed to initialize Midnight");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadNodes = async () => {
    if (!midnightApi) return;
    
    try {
      const result = await midnightApi.listNodes();
      if (result.success) {
        setNodes(result.nodes);
      }
    } catch (err) {
      console.error("Failed to load nodes:", err);
    }
  };

  const loadNetworkInfo = async () => {
    if (!midnightApi) return;
    
    try {
      const result = await midnightApi.getNetworkInfo();
      if (result.success && result.info) {
        setNetworkInfo(result.info);
      }
    } catch (err) {
      console.error("Failed to load network info:", err);
    }
  };

  const createNode = async () => {
    if (!midnightApi) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await midnightApi.createNode({
        type: nodeType,
        stake: nodeStake,
        privacy: nodePrivacy,
        delegation: nodeDelegation,
      });
      
      if (result.success && result.node) {
        setNodes([...nodes, result.node]);
        setShowCreateNode(false);
      } else {
        setError(result.error || "Failed to create node");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const stopNode = async (nodeId: string) => {
    if (!midnightApi) return;
    
    try {
      await midnightApi.stopNode(nodeId);
      await loadNodes();
    } catch (err) {
      setError(String(err));
    }
  };

  const restartNode = async (nodeId: string) => {
    if (!midnightApi) return;
    
    try {
      await midnightApi.restartNode(nodeId);
      await loadNodes();
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!midnightApi) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Moon className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <h2 className="text-lg font-semibold mb-2">Midnight Network</h2>
          <p className="text-gray-500">
            Midnight integration requires Electron mode.
            <br />
            Run <code className="bg-gray-100 px-2 py-1 rounded">npm run start</code> to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-3">
          <Moon className="w-5 h-5 text-purple-600" />
          <h1 className="text-lg font-semibold">Midnight Network</h1>
          <StatusDot status={isConnected ? "active" : "error"} />
        </div>
        <button
          onClick={initializeMidnight}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Network Info */}
      {networkInfo && (
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-white border-b">
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase">Block Height</div>
            <div className="text-lg font-semibold">{networkInfo.blockHeight.toLocaleString()}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase">Block Time</div>
            <div className="text-lg font-semibold">{networkInfo.blockTime}s</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase">Session Length</div>
            <div className="text-lg font-semibold">{networkInfo.sessionLength}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase">Validators</div>
            <div className="text-lg font-semibold">{networkInfo.validators}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 uppercase">Total Nodes</div>
            <div className="text-lg font-semibold">{networkInfo.totalNodes}</div>
          </div>
        </div>
      )}


      {/* Cardano Wallet - HyperSharePass */}
      <div className="px-4 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Cardano Access</h2>
          </div>
          <span className="text-xs text-purple-300">HyperSharePass NFT-Gated</span>
        </div>
        <CardanoWalletConnect />
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b">
        <button
          onClick={() => setShowCreateNode(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Create Node
        </button>
      </div>

      {/* Create Node Form */}
      {showCreateNode && (
        <div className="px-4 py-4 bg-white border-b">
          <h3 className="font-semibold mb-4">Create New Node</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Node Type</label>
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="validator">Validator Node</option>
                <option value="full">Full Node</option>
                <option value="light">Light Node</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Stake Amount</label>
              <input
                type="number"
                value={nodeStake}
                onChange={(e) => setNodeStake(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Privacy Level</label>
              <select
                value={nodePrivacy}
                onChange={(e) => setNodePrivacy(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="public">Public</option>
                <option value="shielded">Shielded</option>
                <option value="private">Private</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Delegation</label>
              <select
                value={nodeDelegation}
                onChange={(e) => setNodeDelegation(e.target.value as any)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="user">User Controlled</option>
                <option value="agent">Agent Delegated</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCreateNode(false)}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={createNode}
              disabled={loading}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Node"}
            </button>
          </div>
        </div>
      )}

      {/* Nodes List */}
      <div className="flex-1 overflow-auto">
        <SectionHeader title="Nodes" count={nodes.length} />
        
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Server className="w-12 h-12 mb-4" />
            <p>No nodes created yet</p>
            <button
              onClick={() => setShowCreateNode(true)}
              className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Create Your First Node
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {nodes.map((node) => (
              <div key={node.nodeId} className="bg-white">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleNodeExpanded(node.nodeId)}
                >
                  <div className="flex items-center gap-3">
                    {expandedNodes.has(node.nodeId) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <StatusDot status={node.status} />
                    <div>
                      <div className="font-medium">{node.nodeId.slice(0, 12)}...</div>
                      <div className="text-xs text-gray-500">{node.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restartNode(node.nodeId);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        stopNode(node.nodeId);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {expandedNodes.has(node.nodeId) && (
                  <div className="px-4 py-3 bg-gray-50 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-500">Endpoint</div>
                        <div className="font-mono text-xs">{node.endpoint}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Privacy Key</div>
                        <div className="font-mono text-xs">{node.privacyKey.slice(0, 20)}...</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Created</div>
                        <div>{new Date(node.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MidnightPage;