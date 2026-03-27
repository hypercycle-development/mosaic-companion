/**
 * ETH Wallet Connect Component
 * React component for Ethereum/BASE wallet connection
 */

import React, { useState } from 'react';
import { ethWalletService, EthNetwork, ETH_NETWORKS } from '../services/EthWalletService';

interface EthWalletConnectProps {
  onConnect?: (address: string, network: string) => void;
  onDisconnect?: () => void;
  defaultNetwork?: EthNetwork;
}

export const EthWalletConnect: React.FC<EthWalletConnectProps> = ({
  onConnect,
  onDisconnect,
  defaultNetwork = 'base'
}) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<EthNetwork | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await ethWalletService.connect();
      setConnected(state.connected);
      setAddress(state.address);
      setNetwork(state.network);
      setBalance(state.balance);
      if (state.address && state.network) {
        onConnect?.(state.address, state.network);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    await ethWalletService.disconnect();
    setConnected(false);
    setAddress(null);
    setNetwork(null);
    setBalance(null);
    onDisconnect?.();
  };

  const handleSwitchNetwork = async (newNetwork: EthNetwork) => {
    setLoading(true);
    try {
      await ethWalletService.switchNetwork(newNetwork);
      setNetwork(newNetwork);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="eth-wallet-connect">
      {!connected ? (
        <div className="connect-section">
          <button 
            className="connect-btn"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Connect ETH Wallet'}
          </button>
          {error && <div className="error-message">{error}</div>}
          
          <div className="network-selector">
            <label>Network:</label>
            <select 
              value={defaultNetwork} 
              onChange={(e) => handleSwitchNetwork(e.target.value as EthNetwork)}
            >
              {(Object.entries(ETH_NETWORKS) as [string, { chainId: number; rpc: string; name: string }][]).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="connected-section">
          <div className="wallet-info">
            <span className="label">Address:</span>
            <span className="address">{address && formatAddress(address)}</span>
          </div>
          <div className="wallet-info">
            <span className="label">Network:</span>
            <span className="network">{network}</span>
          </div>
          <div className="wallet-info">
            <span className="label">Balance:</span>
            <span className="balance">{balance ? parseFloat(balance).toFixed(4) : '0'} ETH</span>
          </div>
          
          <button className="disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default EthWalletConnect;