/**
 * Cardano Wallet Plugin - Renderer
 * React component for Cardano wallet connection
 */

import React, { useState, useEffect } from 'react';
import { Wallet, Check, X, RefreshCw, Copy, Shield } from 'lucide-react';

const WALLETS = [
  { id: 'eternl', name: 'Eternl', icon: '🔷' },
  { id: 'lace', name: 'Lace', icon: '💎' },
  { id: 'nami', name: 'Nami', icon: '🌊' },
  { id: 'yoroi', name: 'Yoroi', icon: '🧡' },
  { id: 'flint', name: 'Flint', icon: '🔥' },
];

export function CardanoWalletView() {
  const [state, setState] = useState({
    isConnected: false,
    address: null,
    balance: '0',
    hyperSharePassCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    if (window.electronAPI?.cardano) {
      const result = await window.electronAPI.cardano['get-state']();
      if (result) setState(result);
    }
  };

  const handleConnect = async (walletId: string) => {
    setLoading(true);
    setError(null);
    try {
      // In Electron, show manual input dialog
      // In browser, use window.cardano
      console.log('[CardanoWallet] Connect:', walletId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.electronAPI?.cardano) {
      await window.electronAPI.cardano.disconnect();
    }
    setState({ isConnected: false, address: null, balance: '0', hyperSharePassCount: 0 });
  };

  if (state.isConnected) {
    return (
      <div className="cardano-wallet-connected">
        <div className="connected-header">
          <span className="dot" />
          Connected
        </div>
        <div className="wallet-info">
          <div className="address">{state.address?.slice(0, 12)}...{state.address?.slice(-8)}</div>
          <div className="balance">💰 {state.balance} ADA</div>
        </div>
        <div className="nft-section">
          <Shield size={16} />
          <div className="nft-count">{state.hyperSharePassCount} HyperSharePass</div>
        </div>
        <button className="disconnect-btn" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="cardano-wallet-connect">
      <h3>🔗 Connect Cardano Wallet</h3>
      <p>Connect to access AI agents with HyperSharePass NFTs</p>
      {error && <div className="error"><X size={16} /> {error}</div>}
      <div className="wallet-grid">
        {WALLETS.map(wallet => (
          <button key={wallet.id} className="wallet-btn" onClick={() => handleConnect(wallet.id)}>
            <span className="icon">{wallet.icon}</span>
            <span className="name">{wallet.name}</span>
          </button>
        ))}
      </div>
      <div className="policy-id">
        Policy ID: <code>a222abf06e5...</code>
      </div>
    </div>
  );
}

export default CardanoWalletView;