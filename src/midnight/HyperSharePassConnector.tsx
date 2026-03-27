/**
 * HyperSharePass Connector Component
 * For midnight.city - Cardano wallet connection with NFT-gated access
 * 
 * Usage: <HyperSharePassConnector onConnect={handleConnect} />
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface WalletState {
  isConnected: boolean;
  walletName: string | null;
  address: string;
  hyperSharePassCount: number;
  access: AccessRights;
  loading: boolean;
  error: string | null;
}

interface AccessRights {
  canChat: boolean;
  canCreateAgents: boolean;
  maxAgents: number;
  canDelegate: boolean;
  canRentCompute: boolean;
  totalWeight: number;
}

interface Props {
  onConnect?: (state: WalletState) => void;
  children?: React.ReactNode;
}

// Supported wallets with metadata
const SUPPORTED_WALLETS = [
  { id: 'eternl', name: 'Eternl', icon: '🔷', installed: false },
  { id: 'lace', name: 'Lace', icon: '💎', installed: false },
  { id: 'nami', name: 'Nami', icon: '🌊', installed: false },
  { id: 'yoroi', name: 'Yoroi', icon: '🧡', installed: false },
  { id: 'flint', name: 'Flint', icon: '🔥', installed: false },
] as const;

type WalletId = typeof SUPPORTED_WALLETS[number]['id'];

// Initial state
const initialState: WalletState = {
  isConnected: false,
  walletName: null,
  address: '',
  hyperSharePassCount: 0,
  access: {
    canChat: false,
    canCreateAgents: false,
    maxAgents: 0,
    canDelegate: false,
    canRentCompute: false,
    totalWeight: 0
  },
  loading: false,
  error: null
};

export function HyperSharePassConnector({ onConnect, children }: Props) {
  const [state, setState] = useState<WalletState>(initialState);
  const [wallets, setWallets] = useState(SUPPORTED_WALLETS);

  // Check which wallets are installed
  useEffect(() => {
    const checkWallets = () => {
      setWallets(wallets.map(w => ({
        ...w,
        installed: typeof window !== 'undefined' && 
                   !!window.cardano && 
                   !!window.cardano[w.id]
      })));
    };
    checkWallets();
  }, []);

  // Connect to wallet
  const connect = useCallback(async (walletId: WalletId) => {
    setState(s => ({ ...s, loading: true, error: null }));

    try {
      // Check if wallet is installed
      if (!window.cardano?.[walletId]) {
        throw new Error(`${walletId} wallet not installed`);
      }

      // Enable wallet (CIP-30)
      const wallet = window.cardano[walletId];
      const api = await wallet.enable();

      // Get address
      const addresses = await api.getUsedAddresses();
      const address = addresses[0] || await api.getChangeAddress();

      // Get UTXOs
      const utxos = await api.getUtxos();

      // Parse HyperSharePass NFTs
      const HYPER_SHARE_POLICY_ID = 'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46';
      
      let hyperSharePassCount = 0;
      if (utxos) {
        for (const utxo of utxos) {
          for (const asset of utxo.assets || []) {
            if (asset.policyId === HYPER_SHARE_POLICY_ID && asset.quantity === '1') {
              hyperSharePassCount++;
            }
          }
        }
      }

      // Calculate access rights
      const access: AccessRights = {
        canChat: hyperSharePassCount > 0,
        canCreateAgents: hyperSharePassCount > 0,
        maxAgents: hyperSharePassCount,
        canDelegate: hyperSharePassCount > 0,
        canRentCompute: hyperSharePassCount >= 10, // Need 10+ for compute rental
        totalWeight: hyperSharePassCount
      };

      const newState: WalletState = {
        isConnected: true,
        walletName: walletId,
        address,
        hyperSharePassCount,
        access,
        loading: false,
        error: null
      };

      setState(newState);
      onConnect?.(newState);

    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Connection failed'
      }));
    }
  }, [onConnect]);

  // Disconnect
  const disconnect = useCallback(() => {
    setState(initialState);
    onConnect?.(initialState);
  }, [onConnect]);

  // Render
  if (state.isConnected) {
    return (
      <div className="hypershare-connected">
        <div className="connection-status">
          <span className="status-badge connected">✅ Connected</span>
          <span className="wallet-name">{state.walletName}</span>
        </div>
        
        <div className="wallet-address">
          {state.address.slice(0, 8)}...{state.address.slice(-8)}
        </div>

        <div className="nft-count">
          <span className="count">{state.hyperSharePassCount}</span>
          <span className="label">HyperSharePass NFTs</span>
        </div>

        <div className="access-rights">
          <h4>Your Access</h4>
          <ul>
            <li className={state.access.canChat ? 'granted' : 'denied'}>
              💬 Chat {state.access.canChat ? '✅' : '❌'}
            </li>
            <li className={state.access.canCreateAgents ? 'granted' : 'denied'}>
              🤖 AI Agents: {state.access.maxAgents} {state.access.canCreateAgents ? '✅' : '❌'}
            </li>
            <li className={state.access.canDelegate ? 'granted' : 'denied'}>
              🔗 Delegate {state.access.canDelegate ? '✅' : '❌'}
            </li>
            <li className={state.access.canRentCompute ? 'granted' : 'denied'}>
              💻 Rent Compute {state.access.canRentCompute ? '✅' : '❌'}
            </li>
          </ul>
        </div>

        {children}

        <button className="disconnect-btn" onClick={disconnect}>
          Disconnect Wallet
        </button>

        <style>{`
          .hypershare-connected {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 20px;
            color: #fff;
            font-family: system-ui, sans-serif;
          }
          .connection-status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
          }
          .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
          }
          .status-badge.connected {
            background: #00d26a;
            color: #000;
          }
          .wallet-name {
            text-transform: capitalize;
            font-weight: 600;
          }
          .wallet-address {
            font-family: monospace;
            font-size: 12px;
            color: #888;
            margin-bottom: 16px;
          }
          .nft-count {
            background: #16213e;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 16px;
          }
          .nft-count .count {
            display: block;
            font-size: 32px;
            font-weight: 700;
            color: #00d26a;
          }
          .nft-count .label {
            font-size: 12px;
            color: #888;
          }
          .access-rights h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #888;
          }
          .access-rights ul {
            list-style: none;
            padding: 0;
            margin: 0 0 16px 0;
          }
          .access-rights li {
            padding: 8px 0;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
          }
          .access-rights li.granted {
            color: #00d26a;
          }
          .access-rights li.denied {
            color: #666;
          }
          .disconnect-btn {
            width: 100%;
            padding: 12px;
            background: #ff4757;
            border: none;
            border-radius: 8px;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }
          .disconnect-btn:hover {
            background: #ff6b81;
          }
        `}</style>
      </div>
    );
  }

  // Not connected - show wallet selection
  return (
    <div className="hypershare-connector">
      <div className="header">
        <h3>🔗 Connect Wallet</h3>
        <p>Connect your Cardano wallet to access midnight.city</p>
      </div>

      <div className="wallets">
        {wallets.map(wallet => (
          <button
            key={wallet.id}
            className={`wallet-btn ${wallet.installed ? 'installed' : 'missing'}`}
            onClick={() => wallet.installed && connect(wallet.id)}
            disabled={!wallet.installed || state.loading}
          >
            <span className="icon">{wallet.icon}</span>
            <span className="name">{wallet.name}</span>
            {!wallet.installed && <span className="hint">Not installed</span>}
          </button>
        ))}
      </div>

      {state.error && (
        <div className="error">
          ⚠️ {state.error}
        </div>
      )}

      <div className="hyper-share-info">
        <h4>HyperSharePass Collection</h4>
        <p>Hold HyperSharePass NFTs to access:</p>
        <ul>
          <li>💬 Chat with AI agents</li>
          <li>🤖 Create AI agents</li>
          <li>🔗 Delegate to node factories</li>
          <li>💻 Rent compute (10+ NFTs)</li>
        </ul>
      </div>

      <style>{`
        .hypershare-connector {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 24px;
          color: #fff;
          font-family: system-ui, sans-serif;
          max-width: 400px;
          margin: 0 auto;
        }
        .header h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
        }
        .header p {
          margin: 0 0 20px 0;
          color: #888;
          font-size: 14px;
        }
        .wallets {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
        }
        .wallet-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #16213e;
          border: 2px solid transparent;
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .wallet-btn.installed:hover {
          border-color: #00d26a;
          background: #1f2f4d;
        }
        .wallet-btn.missing {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .wallet-btn .icon {
          font-size: 24px;
        }
        .wallet-btn .name {
          font-weight: 600;
        }
        .wallet-btn .hint {
          margin-left: auto;
          font-size: 12px;
          color: #666;
        }
        .error {
          background: #3d1a1a;
          border: 1px solid #ff4757;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          color: #ff6b81;
          font-size: 14px;
        }
        .hyper-share-info {
          background: #16213e;
          border-radius: 8px;
          padding: 16px;
        }
        .hyper-share-info h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #00d26a;
        }
        .hyper-share-info p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #888;
        }
        .hyper-share-info ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #aaa;
        }
        .hyper-share-info li {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}

export default HyperSharePassConnector;