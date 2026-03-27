/**
 * ETH Wallet Plugin - Renderer
 * React component for Ethereum/BASE wallet connection
 */

import React, { useState, useEffect } from 'react';
import { Wallet, Check, X, RefreshCw, ExternalLink } from 'lucide-react';

const NETWORKS = [
  { id: 'ethereum', name: 'Ethereum Mainnet', chainId: 1 },
  { id: 'base', name: 'Base', chainId: 8453 },
  { id: 'base-sepolia', name: 'Base Sepolia', chainId: 84532 },
];

export function EthWalletView() {
  const [state, setState] = useState({
    connected: false,
    address: null,
    chainId: null,
    balance: '0',
    network: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    if (window.electronAPI?.ethwallet) {
      const result = await window.electronAPI.ethwallet['get-state']();
      if (result) setState(result);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      // In Electron, wallet extensions aren't available
      // Show manual input or WalletConnect
      console.log('[EthWallet] Connect requested');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.electronAPI?.ethwallet) {
      await window.electronAPI.ethwallet.disconnect();
    }
    setState({ connected: false, address: null, chainId: null, balance: '0', network: null });
  };

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (state.connected) {
    return (
      <div className="eth-wallet-connected">
        <div className="connected-header">
          <span className="dot" />
          <span>Connected to {NETWORKS.find(n => n.chainId === state.chainId)?.name || 'Unknown'}</span>
        </div>
        <div className="wallet-info">
          <div className="address">{formatAddress(state.address!)}</div>
          <div className="balance">Ξ {state.balance}</div>
        </div>
        <div className="network-badge">{state.network}</div>
        <button className="disconnect-btn" onClick={handleDisconnect}>
          Disconnect
        </button>
        <style>{`
          .eth-wallet-connected { padding: 20px; background: #1a1a2e; border-radius: 12px; }
          .connected-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
          .dot { width: 8px; height: 8px; background: #00d26a; border-radius: 50%; }
          .wallet-info { background: #333; padding: 12px; border-radius: 8px; margin-bottom: 12px; }
          .address { font-family: monospace; font-size: 14px; margin-bottom: 4px; }
          .balance { font-size: 24px; font-weight: 600; }
          .network-badge { background: #7c3aed; padding: 4px 12px; border-radius: 12px; font-size: 12px; display: inline-block; margin-bottom: 12px; }
          .disconnect-btn { width: 100%; padding: 12px; background: #ff4757; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="eth-wallet-connect">
      <h3><Wallet size={20} /> Connect ETH/BASE Wallet</h3>
      <p>Connect MetaMask, Rabby, or Coinbase Wallet</p>
      {error && <div className="error"><X size={16} /> {error}</div>}
      <button className="connect-btn" onClick={handleConnect} disabled={loading}>
        {loading ? <><RefreshCw className="spinning" size={16} /> Connecting...</> : 'Connect Wallet'}
      </button>
      <div className="networks">
        <span>Supported Networks:</span>
        {NETWORKS.map(n => (
          <span key={n.id} className="network-tag">{n.name}</span>
        ))}
      </div>
      <div className="anfe-info">
        <ExternalLink size={14} />
        <span>ANFE (Advanced Node Factory) on Base</span>
      </div>
      <style>{`
        .eth-wallet-connect { padding: 20px; background: #1a1a2e; border-radius: 12px; }
        h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        p { color: #888; margin-bottom: 16px; }
        .connect-btn { width: 100%; padding: 14px; background: #7c3aed; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .connect-btn:disabled { opacity: 0.5; }
        .networks { margin-top: 16px; font-size: 12px; color: #888; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .network-tag { background: #333; padding: 4px 8px; border-radius: 4px; }
        .anfe-info { margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7c3aed; }
        .error { background: #3d1a1a; border: 1px solid #ff4757; border-radius: 8px; padding: 12px; color: #ff6b81; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default EthWalletView;