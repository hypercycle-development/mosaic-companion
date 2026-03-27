/**
 * Creator Portal - Node Factory Delegation Interface
 * midnight.city/hpec-dao/creator-portal
 * 
 * Allows HyperSharePass holders to delegate node factories for AI agent use
 */

import React, { useState, useEffect, useCallback } from 'react';

interface NodeFactory {
  id: number;
  type: 'eth' | 'anfe';
  owner: string;
  delegatedTo: string | null;
  isAvailable: boolean;
  specs: {
    cpu: string;
    memory: string;
    storage: string;
    gpu?: string;
    aiModel?: string;
  };
}

interface Delegation {
  walletAddress: string;
  hyperSharePassCount: number;
  nodeFactoryIds: number[];
  anfeIds: number[];
  totalWeight: number;
  access: {
    canChat: boolean;
    canCreateAgents: number;
    canDelegate: boolean;
    canRentCompute: boolean;
  };
}

interface Props {
  apiBase?: string;
}

const API_BASE = 'http://localhost:3001';

export function CreatorPortal({ apiBase = API_BASE }: Props) {
  // State
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [nodeFactories, setNodeFactories] = useState<NodeFactory[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'delegate' | 'agents' | 'stats'>('delegate');
  const [delegationStatus, setDelegationStatus] = useState<'idle' | 'delegating' | 'success'>('idle');

  // Connect wallet
  const connectWallet = async (walletId: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!window.cardano?.[walletId]) {
        throw new Error('Wallet not installed');
      }

      const api = await window.cardano[walletId].enable();
      const addresses = await api.getUsedAddresses();
      const address = addresses[0] || await api.getChangeAddress();

      setWalletAddress(address);
      setWalletName(walletId);
      setWalletConnected(true);

      // Verify with API
      const response = await fetch(`${apiBase}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, wallet: walletId })
      });

      const data = await response.json();
      
      if (data.hyperSharePassCount > 0) {
        setDelegation({
          walletAddress: address,
          hyperSharePassCount: data.hyperSharePassCount,
          nodeFactoryIds: [],
          anfeIds: [],
          totalWeight: data.hyperSharePassCount,
          access: data.access
        });
      } else {
        setError('No HyperSharePass NFTs found in wallet');
      }

      // Load node factories
      const nfResponse = await fetch(`${apiBase}/api/node-factories?available=true`);
      const factories = await nfResponse.json();
      setNodeFactories(factories);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  // Toggle node selection
  const toggleNodeSelection = (nodeId: number) => {
    setSelectedNodes(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  // Delegate node factories
  const delegateNodes = async () => {
    if (!walletAddress || selectedNodes.length === 0) return;

    setDelegationStatus('delegating');
    setError(null);

    try {
      const response = await fetch(`${apiBase}/api/delegation/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          nodeFactoryIds: selectedNodes
        })
      });

      const data = await response.json();

      if (data.success) {
        setDelegationStatus('success');
        setSelectedNodes([]);
        
        // Refresh data
        const nfResponse = await fetch(`${apiBase}/api/node-factories?available=true`);
        setNodeFactories(await nfResponse.json());
        
        // Update local delegation
        if (delegation) {
          setDelegation({
            ...delegation,
            nodeFactoryIds: [...delegation.nodeFactoryIds, ...selectedNodes]
          });
        }

        setTimeout(() => setDelegationStatus('idle'), 3000);
      } else {
        setError(data.errors?.join(', ') || 'Delegation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delegation failed');
    } finally {
      setDelegationStatus('idle');
    }
  };

  // Sign message for verification
  const signVerification = async () => {
    if (!window.cardano?.[walletName]) return;

    try {
      const api = await window.cardano[walletName].enable();
      const addresses = await api.getUsedAddresses();
      const address = addresses[0] || await api.getChangeAddress();
      
      const message = `midnight.city:verify:${Date.now()}`;
      const signature = await api.signData(address, message);
      
      // Send to API for verification
      const response = await fetch(`${apiBase}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, wallet: walletName, signature, message })
      });

      return await response.json();
    } catch (err) {
      setError('Verification failed');
    }
  };

  // Render
  return (
    <div className="creator-portal">
      <header className="portal-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">HPEC DAO</span>
          <span className="badge">Creator Portal</span>
        </div>
        
        {!walletConnected ? (
          <div className="wallet-buttons">
            {['eternl', 'lace', 'nami'].map(w => (
              <button
                key={w}
                onClick={() => connectWallet(w)}
                disabled={loading || !window.cardano?.[w]}
                className="wallet-btn"
              >
                {w === 'eternl' ? '🔷' : w === 'lace' ? '💎' : '🌊'} {w}
              </button>
            ))}
          </div>
        ) : (
          <div className="connected-wallet">
            <span className="status">● Connected</span>
            <span className="wallet-name">{walletName}</span>
            <span className="address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {walletConnected && delegation && (
        <>
          {/* Stats Bar */}
          <div className="stats-bar">
            <div className="stat">
              <span className="value">{delegation.hyperSharePassCount}</span>
              <span className="label">HyperSharePass</span>
            </div>
            <div className="stat">
              <span className="value">{delegation.nodeFactoryIds.length}</span>
              <span className="label">Delegated</span>
            </div>
            <div className="stat">
              <span className="value">{delegation.access.canCreateAgents}</span>
              <span className="label">AI Agents</span>
            </div>
            <div className="stat">
              <span className="value">{nodeFactories.length}</span>
              <span className="label">Available</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button 
              className={activeTab === 'delegate' ? 'active' : ''}
              onClick={() => setActiveTab('delegate')}
            >
              🔗 Delegate Nodes
            </button>
            <button 
              className={activeTab === 'agents' ? 'active' : ''}
              onClick={() => setActiveTab('agents')}
            >
              🤖 My Agents
            </button>
            <button 
              className={activeTab === 'stats' ? 'active' : ''}
              onClick={() => setActiveTab('stats')}
            >
              📊 Stats
            </button>
          </div>

          {/* Delegate Tab */}
          {activeTab === 'delegate' && (
            <div className="delegate-panel">
              <div className="panel-header">
                <h3>Delegate Node Factories</h3>
                <p>Select node factories to delegate. Users with HyperSharePass can use these for AI agents.</p>
              </div>

              <div className="node-filters">
                <button className="filter-btn active">All Available</button>
                <button className="filter-btn">ETH Nodes</button>
                <button className="filter-btn">ANFEs</button>
              </div>

              <div className="node-grid">
                {nodeFactories.map(node => (
                  <div 
                    key={node.id}
                    className={`node-card ${selectedNodes.includes(node.id) ? 'selected' : ''}`}
                    onClick={() => toggleNodeSelection(node.id)}
                  >
                    <div className="node-header">
                      <span className={`node-type ${node.type}`}>
                        {node.type === 'eth' ? '⚡ ETH' : '🔒 ANFE'}
                      </span>
                      <span className="node-id">#{node.id}</span>
                    </div>
                    <div className="node-specs">
                      <div className="spec">🖥️ {node.specs.cpu}</div>
                      <div className="spec">💾 {node.specs.memory}</div>
                      <div className="spec">💿 {node.specs.storage}</div>
                      {node.specs.gpu && <div className="spec">🎮 {node.specs.gpu}</div>}
                      <div className="spec">🧠 {node.specs.aiModel}</div>
                    </div>
                    <div className="node-status">
                      {selectedNodes.includes(node.id) ? '✓ Selected' : 'Click to select'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="delegate-actions">
                <div className="selection-summary">
                  {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
                </div>
                <button 
                  className={`delegate-btn ${delegationStatus}`}
                  onClick={delegateNodes}
                  disabled={selectedNodes.length === 0 || delegationStatus === 'delegating'}
                >
                  {delegationStatus === 'delegating' ? '⏳ Delegating...' : 
                   delegationStatus === 'success' ? '✅ Delegated!' :
                   '🔗 Delegate Selected Nodes'}
                </button>
              </div>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="agents-panel">
              <div className="panel-header">
                <h3>My AI Agents</h3>
                <p>Manage your active AI agents running on delegated node factories.</p>
              </div>
              
              <div className="create-agent-form">
                <input type="text" placeholder="Agent name" />
                <select>
                  <option value="">Select node factory</option>
                  {delegation.nodeFactoryIds.map(id => (
                    <option key={id} value={id}>Node #{id}</option>
                  ))}
                </select>
                <button>➕ Create Agent</button>
              </div>

              <div className="empty-state">
                <span className="icon">🤖</span>
                <p>No AI agents yet</p>
                <span className="hint">Delegate node factories first, then create agents</span>
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="stats-panel">
              <div className="panel-header">
                <h3>Network Statistics</h3>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-value">150</span>
                  <span className="stat-label">Total Node Factories</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">100</span>
                  <span className="stat-label">ETH Nodes</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">50</span>
                  <span className="stat-label">ANFEs</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{nodeFactories.length}</span>
                  <span className="stat-label">Available Now</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!walletConnected && (
        <div className="connect-prompt">
          <div className="prompt-content">
            <h2>🔗 Connect to Creator Portal</h2>
            <p>Connect your Cardano wallet with HyperSharePass NFTs to delegate node factories and manage AI agents.</p>
            <div className="requirements">
              <h4>Requirements:</h4>
              <ul>
                <li>✅ Cardano wallet (Eternl, Lace, or Nami)</li>
                <li>✅ HyperSharePass NFT (a222abf06e562a5...)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .creator-portal {
          min-height: 100vh;
          background: #0a0a12;
          color: #fff;
          font-family: 'Inter', system-ui, sans-serif;
        }
        
        .portal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #12121c;
          border-bottom: 1px solid #222;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .logo-icon { font-size: 24px; }
        .logo-text { font-size: 18px; font-weight: 700; }
        .badge {
          background: #7c3aed;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          text-transform: uppercase;
        }
        
        .wallet-buttons {
          display: flex;
          gap: 8px;
        }
        
        .wallet-btn {
          padding: 8px 16px;
          background: #1e1e2e;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .wallet-btn:hover:not(:disabled) {
          background: #2a2a3e;
          border-color: #7c3aed;
        }
        
        .wallet-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        
        .connected-wallet {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .status { color: #00d26a; font-size: 12px; }
        .wallet-name { text-transform: capitalize; font-weight: 600; }
        .address { color: #666; font-family: monospace; font-size: 12px; }
        
        .error-banner {
          background: #3d1a1a;
          border: 1px solid #ff4757;
          padding: 12px 16px;
          margin: 16px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .error-banner button {
          background: none;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
        }
        
        .stats-bar {
          display: flex;
          gap: 16px;
          padding: 16px 24px;
          background: #12121c;
        }
        
        .stat {
          flex: 1;
          text-align: center;
          padding: 12px;
          background: #1a1a28;
          border-radius: 8px;
        }
        
        .stat .value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #7c3aed;
        }
        
        .stat .label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
        }
        
        .tabs {
          display: flex;
          padding: 0 24px;
          border-bottom: 1px solid #222;
        }
        
        .tabs button {
          padding: 12px 20px;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        
        .tabs button.active {
          color: #fff;
          border-bottom-color: #7c3aed;
        }
        
        .delegate-panel, .agents-panel, .stats-panel {
          padding: 24px;
        }
        
        .panel-header {
          margin-bottom: 20px;
        }
        
        .panel-header h3 {
          margin: 0 0 8px 0;
        }
        
        .panel-header p {
          color: #666;
          margin: 0;
        }
        
        .node-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        
        .filter-btn {
          padding: 8px 16px;
          background: #1a1a28;
          border: 1px solid #333;
          border-radius: 20px;
          color: #888;
          cursor: pointer;
        }
        
        .filter-btn.active {
          background: #7c3aed;
          border-color: #7c3aed;
          color: #fff;
        }
        
        .node-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .node-card {
          background: #1a1a28;
          border: 2px solid #333;
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .node-card:hover {
          border-color: #444;
        }
        
        .node-card.selected {
          border-color: #7c3aed;
          background: #1f1a2e;
        }
        
        .node-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        
        .node-type {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .node-type.eth { background: #1e3a5f; color: #60a5fa; }
        .node-type.anfe { background: #3b1e5f; color: #a78bfa; }
        
        .node-id { color: #666; font-family: monospace; font-size: 12px; }
        
        .node-specs {
          font-size: 12px;
          color: #888;
          margin-bottom: 12px;
        }
        
        .node-specs .spec { margin: 4px 0; }
        
        .node-status {
          font-size: 11px;
          color: #666;
          text-align: center;
          padding-top: 8px;
          border-top: 1px solid #333;
        }
        
        .node-card.selected .node-status {
          color: #7c3aed;
        }
        
        .delegate-actions {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .selection-summary { color: #888; }
        
        .delegate-btn {
          padding: 12px 24px;
          background: #7c3aed;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .delegate-btn:hover:not(:disabled) {
          background: #8b5cf6;
        }
        
        .delegate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .delegate-btn.success {
          background: #00d26a;
        }
        
        .create-agent-form {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .create-agent-form input,
        .create-agent-form select {
          flex: 1;
          padding: 10px 14px;
          background: #1a1a28;
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
        }
        
        .create-agent-form button {
          padding: 10px 20px;
          background: #00d26a;
          border: none;
          border-radius: 8px;
          color: #000;
          font-weight: 600;
          cursor: pointer;
        }
        
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        
        .empty-state .icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }
        
        .empty-state .hint {
          font-size: 12px;
          color: #444;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        .stat-card {
          background: #1a1a28;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
        }
        
        .stat-value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #7c3aed;
        }
        
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        
        .connect-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          padding: 24px;
        }
        
        .prompt-content {
          max-width: 500px;
          text-align: center;
        }
        
        .prompt-content h2 {
          margin-bottom: 12px;
        }
        
        .prompt-content > p {
          color: #666;
          margin-bottom: 24px;
        }
        
        .requirements {
          text-align: left;
          background: #12121c;
          padding: 20px;
          border-radius: 12px;
        }
        
        .requirements h4 {
          margin: 0 0 12px 0;
          color: #888;
        }
        
        .requirements ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .requirements li {
          margin: 8px 0;
          color: #aaa;
        }
      `}</style>
    </div>
  );
}

export default CreatorPortal;