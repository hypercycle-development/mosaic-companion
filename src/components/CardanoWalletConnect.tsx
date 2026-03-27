/**
 * Cardano Wallet Connector - Mosaic Companion UI
 * 
 * Cardano wallet connection with HyperSharePass NFT-gated access
 * Integrates into the Web3/Midnight section of Mosaic Companion
 */

import React, { useState, useEffect } from "react";
import { Wallet, Check, X, RefreshCw, Copy, Shield, Bot, Cpu, QrCode, Link2 } from "lucide-react";
import { cardanoWallet, CardanoWalletName, CardanoWalletState } from "../services/CardanoWalletService";

interface Props {
  onConnect?: (state: CardanoWalletState) => void;
  compact?: boolean;
}

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

const WALLETS = [
  { id: 'eternl', name: 'Eternl', icon: '🔷', color: '#1e3a5f' },
  { id: 'lace', name: 'Lace', icon: '💎', color: '#8b5cf6' },
  { id: 'nami', name: 'Nami', icon: '🌊', color: '#0ea5e9' },
  { id: 'yoroi', name: 'Yoroi', icon: '🧡', color: '#f97316' },
  { id: 'flint', name: 'Flint', icon: '🔥', color: '#ef4444' },
] as const;

export const CardanoWalletConnect: React.FC<Props> = ({ onConnect, compact = false }) => {
  const [state, setState] = useState<CardanoWalletState>(cardanoWallet.getState());
  const [installedWallets, setInstalledWallets] = useState<CardanoWalletName[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Check installed wallets on mount
  useEffect(() => {
    const wallets = cardanoWallet.getInstalledWallets();
    setInstalledWallets(wallets);
    
    // In Electron, show manual input by default since extensions aren't available
    if (isElectron && wallets.length === 0) {
      setShowManualInput(true);
    }
  }, []);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = cardanoWallet.subscribe('stateChange', (newState) => {
      setState(newState);
      onConnect?.(newState);
    });
    return unsubscribe;
  }, [onConnect]);

  const handleConnect = async (walletName: CardanoWalletName) => {
    setLoading(true);
    setError(null);

    try {
      await cardanoWallet.connect(walletName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    cardanoWallet.disconnect();
  };

  const handleRefresh = async () => {
    setLoading(true);
    await cardanoWallet.refresh();
    setLoading(false);
  };

  const handleManualConnect = async () => {
    if (!manualAddress.trim()) {
      setError('Please enter a Cardano address');
      return;
    }
    
    // Validate Cardano address format
    const cardanoRegex = /^(addr1|stake1|addr_test1|stake_test1)[a-zA-Z0-9]+$/;
    if (!cardanoRegex.test(manualAddress.trim())) {
      setError('Invalid Cardano address format. Address should start with addr1 or stake1');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a view-only state
      const viewOnlyState: CardanoWalletState = {
        isConnected: true,
        walletName: 'eternl' as CardanoWalletName, // Default to eternl for view-only
        address: manualAddress.trim(),
        rewardAddress: null,
        balance: '0',
        hyperSharePassCount: 0,
        access: {
          canChat: false,
          canCreateAgents: 0,
          canDelegate: false,
          canRentCompute: false
        }
      };
      
      setState(viewOnlyState);
      onConnect?.(viewOnlyState);
      setShowManualInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (state.address) {
      navigator.clipboard.writeText(state.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Connected state
  if (state.isConnected) {
    if (compact) {
      return (
        <div className="cardano-connected-compact">
          <div className="wallet-badge">
            <span className="icon">🔗</span>
            <span className="name">{state.walletName}</span>
            <span className="nft-count">💎 {state.hyperSharePassCount} HyperSharePass</span>
            <button onClick={handleDisconnect} className="disconnect-btn">×</button>
          </div>
        </div>
      );
    }

    return (
      <div className="cardano-wallet-connected">
        <div className="connected-header">
          <div className="status-badge">
            <span className="dot" />
            Connected to {state.walletName}
          </div>
          <button onClick={handleRefresh} className="refresh-btn" disabled={loading}>
            <RefreshCw className={loading ? 'spinning' : ''} size={16} />
          </button>
        </div>

        <div className="wallet-info">
          <div className="address-row" onClick={copyAddress}>
            <span className="address">
              {state.address?.slice(0, 12)}...{state.address?.slice(-8)}
            </span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </div>
          <div className="balance">💰 {state.balance} ADA</div>
        </div>

        <div className="nft-section">
          <div className="nft-header">
            <Shield size={16} />
            <span>HyperSharePass</span>
          </div>
          <div className="nft-count">{state.hyperSharePassCount}</div>
          <div className="nft-hint">Policy: a222abf06e5...</div>
        </div>

        <div className="access-grid">
          <div className={`access-item ${state.access.canChat ? 'granted' : 'denied'}`}>
            <Bot size={16} />
            <span>AI Chat</span>
            <span className="status">{state.access.canChat ? '✓' : '✗'}</span>
          </div>
          <div className={`access-item ${state.access.canCreateAgents > 0 ? 'granted' : 'denied'}`}>
            <Cpu size={16} />
            <span>AI Agents</span>
            <span className="status">{state.access.canCreateAgents}</span>
          </div>
          <div className={`access-item ${state.access.canDelegate ? 'granted' : 'denied'}`}>
            <Wallet size={16} />
            <span>Delegate</span>
            <span className="status">{state.access.canDelegate ? '✓' : '✗'}</span>
          </div>
          <div className={`access-item ${state.access.canRentCompute ? 'granted' : 'denied'}`}>
            <Cpu size={16} />
            <span>Rent Compute</span>
            <span className="status">{state.access.canRentCompute ? '✓' : '✗'}</span>
          </div>
        </div>

        <button className="disconnect-full" onClick={handleDisconnect}>
          Disconnect Cardano Wallet
        </button>

        <style>{`
          .cardano-wallet-connected {
            background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
            border-radius: 12px;
            padding: 20px;
            color: #fff;
          }
          .connected-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
          }
          .status-badge .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00d26a;
          }
          .refresh-btn {
            background: #333;
            border: none;
            border-radius: 6px;
            padding: 6px;
            color: #fff;
            cursor: pointer;
          }
          .refresh-btn:disabled { opacity: 0.5; }
          .spinning { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          
          .wallet-info {
            background: #12121c;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .address-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            margin-bottom: 8px;
          }
          .address {
            font-family: monospace;
            color: #888;
            font-size: 13px;
          }
          .balance {
            font-size: 18px;
            font-weight: 600;
            color: #00d26a;
          }
          
          .nft-section {
            background: #16213e;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin-bottom: 16px;
          }
          .nft-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: #7c3aed;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .nft-count {
            font-size: 32px;
            font-weight: 700;
            color: #7c3aed;
          }
          .nft-hint {
            font-size: 11px;
            color: #666;
          }
          
          .access-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .access-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            background: #12121c;
            border-radius: 8px;
            font-size: 12px;
          }
          .access-item.granted { color: #00d26a; }
          .access-item.denied { color: #666; }
          .access-item .status { margin-left: auto; }
          
          .disconnect-full {
            width: 100%;
            padding: 12px;
            background: #ff4757;
            border: none;
            border-radius: 8px;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
          }
          
          .cardano-connected-compact {
            display: inline-block;
          }
          .wallet-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #1e1e2e;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
          }
          .nft-count {
            color: #7c3aed;
            font-weight: 600;
          }
          .disconnect-btn {
            background: none;
            border: none;
            color: #666;
            cursor: pointer;
            font-size: 16px;
          }
        `}</style>
      </div>
    );
  }

  // Not connected - show wallet selection
  if (compact) {
    return (
      <div className="cardano-connect-compact">
        <select 
          onChange={(e) => e.target.value && handleConnect(e.target.value as CardanoWalletName)}
          value=""
          disabled={loading}
        >
          <option value="">Connect Cardano</option>
          {WALLETS.map(w => (
            <option key={w.id} value={w.id} disabled={!installedWallets.includes(w.id as CardanoWalletName)}>
              {installedWallets.includes(w.id as CardanoWalletName) ? `${w.icon} ${w.name}` : `${w.name} (not installed)`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="cardano-wallet-connect">
      <div className="header">
        <h3>🔗 Connect Cardano Wallet</h3>
        <p>Connect to access AI agents with HyperSharePass NFTs</p>
      </div>

      {error && (
        <div className="error">
          <X size={16} />
          {error}
        </div>
      )}

      {/* Electron Mode Notice */}
      {isElectron && installedWallets.length === 0 && !showManualInput && (
        <div className="electron-notice">
          <div className="notice-icon">⚠️</div>
          <div className="notice-content">
            <strong>Running in Electron Mode</strong>
            <p>Browser wallet extensions (Eternl, Lace, etc.) are not available in desktop apps.</p>
            <div className="notice-options">
              <button onClick={() => setShowManualInput(true)} className="option-btn">
                <Link2 size={14} /> Enter Address Manually
              </button>
              <button onClick={() => window.open('http://localhost:5173', '_blank')} className="option-btn secondary">
                Open in Browser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Address Input */}
      {showManualInput && (
        <div className="manual-input-section">
          <h4>📝 Enter Cardano Address</h4>
          <p className="hint">View-only mode - you'll need to connect via browser for full access</p>
          
          <div className="input-group">
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              placeholder="addr1..."
              className="address-input"
            />
            <button 
              onClick={handleManualConnect}
              disabled={loading || !manualAddress.trim()}
              className="connect-btn"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          
          <div className="input-hint">
            <span>Address format: addr1... or stake1...</span>
          </div>
          
          <button onClick={() => setShowManualInput(false)} className="back-btn">
            ← Back to wallet selection
          </button>
        </div>
      )}

      {!showManualInput && (
        <>
          <div className="wallet-grid">
            {WALLETS.map(wallet => {
              const isInstalled = installedWallets.includes(wallet.id as CardanoWalletName);
              return (
                <button
                  key={wallet.id}
                  className={`wallet-btn ${isInstalled ? 'installed' : 'missing'}`}
                  onClick={() => isInstalled && handleConnect(wallet.id as CardanoWalletName)}
                  disabled={!isInstalled || loading}
                >
                  <span className="wallet-icon" style={{ background: wallet.color }}>
                    {wallet.icon}
                  </span>
                  <span className="wallet-name">{wallet.name}</span>
                  {!isInstalled && <span className="hint">Not installed</span>}
                </button>
              );
            })}
          </div>

          <div className="info-box">
            <h4>🎫 HyperSharePass Collection</h4>
            <p>Hold HyperSharePass NFTs to unlock:</p>
            <ul>
              <li>🤖 Create AI agents</li>
              <li>💬 Chat with AI</li>
              <li>🔗 Delegate node factories</li>
              <li>💻 Rent compute (10+ NFTs)</li>
            </ul>
            <div className="policy-id">
              Policy ID: <code>a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46</code>
            </div>
          </div>
        </>
      )}

      <style>{`
        .cardano-wallet-connect {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 24px;
          color: #fff;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header h3 { margin: 0 0 8px 0; }
        .header p { color: #888; margin: 0; }
        
        .error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #3d1a1a;
          border: 1px solid #ff4757;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          color: #ff6b81;
          font-size: 14px;
        }
        
        .wallet-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        
        .wallet-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: #16213e;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .wallet-btn.installed:hover {
          border-color: #7c3aed;
          transform: translateY(-2px);
        }
        .wallet-btn.missing { opacity: 0.4; cursor: not-allowed; }
        
        .wallet-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .wallet-name { font-weight: 600; }
        .hint { font-size: 10px; color: #666; }
        
        .info-box {
          background: #16213e;
          border-radius: 12px;
          padding: 16px;
        }
        .info-box h4 { margin: 0 0 8px 0; color: #7c3aed; }
        .info-box p { margin: 0 0 8px 0; font-size: 13px; color: #888; }
        .info-box ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #aaa;
        }
        .info-box li { margin: 4px 0; }
        .policy-id {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #333;
          font-size: 11px;
          color: #666;
        }
        .policy-id code {
          font-family: monospace;
          color: #7c3aed;
        }
        
        .electron-notice {
          background: #3d2e00;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
        }
        .electron-notice .notice-icon { font-size: 24px; }
        .electron-notice .notice-content { flex: 1; }
        .electron-notice strong { color: #ffc107; }
        .electron-notice p { color: #aaa; margin: 8px 0; font-size: 13px; }
        .electron-notice .notice-options { display: flex; gap: 8px; margin-top: 12px; }
        .electron-notice .option-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #333;
          border: 1px solid #555;
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-size: 13px;
        }
        .electron-notice .option-btn:hover { background: #444; }
        .electron-notice .option-btn.secondary { background: transparent; border-color: #7c3aed; color: #7c3aed; }
        
        .manual-input-section {
          background: #16213e;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .manual-input-section h4 { margin: 0 0 8px 0; color: #fff; }
        .manual-input-section .hint { color: #888; font-size: 13px; margin: 0 0 16px 0; }
        .manual-input-section .input-group { display: flex; gap: 8px; }
        .manual-input-section .address-input {
          flex: 1;
          background: #0d0d1a;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 12px;
          color: #fff;
          font-family: monospace;
        }
        .manual-input-section .connect-btn {
          background: #7c3aed;
          border: none;
          border-radius: 6px;
          padding: 12px 24px;
          color: #fff;
          cursor: pointer;
          font-weight: 600;
        }
        .manual-input-section .connect-btn:disabled { opacity: 0.5; }
        .manual-input-section .input-hint { margin-top: 8px; font-size: 11px; color: #666; }
        .manual-input-section .back-btn {
          margin-top: 16px;
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 13px;
        }
        .manual-input-section .back-btn:hover { color: #fff; }
        
        .cardano-connect-compact select {
          background: #1e1e2e;
          border: 1px solid #333;
          border-radius: 6px;
          color: #fff;
          padding: 6px 12px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default CardanoWalletConnect;