import React, { useState, useEffect, useCallback } from "react";
import { Wallet, Copy, ExternalLink, ChevronDown, AlertCircle, CheckCircle, Loader2, QrCode, Key, Eye, EyeOff, RefreshCw, Globe } from "lucide-react";
import { walletService } from "../services/WalletService";
import { SUPPORTED_CHAINS, HYPERCYCLE_CONTRACTS, ChainId } from "../types/wallet";
import { AIAgentConfig } from "../types/ai";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { FactoryStatusCard } from "./FactoryStatusCard";

interface WalletConnectProps {
  agents?: AIAgentConfig[];
  onConnect?: (address: string, chainId: ChainId) => void;
  onDisconnect?: () => void;
  onLinkNode?: (nodeId: string, agentId: string) => void;
  onUnlinkNode?: (nodeId: string) => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  agents = [],
  onConnect,
  onDisconnect,
  onLinkNode,
  onUnlinkNode,
}) => {
  // State
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<ChainId | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<"metamask" | "walletconnect" | "import" | null>(null);

  // Check for stored wallet on mount
  useEffect(() => {
    const checkConnection = async () => {
      const stored = walletService.getStoredWallet();
      if (stored?.address) {
        setAddress(stored.address);
        const bal = await walletService.getBalance(stored.address);
        setBalance(bal);
        onConnect?.(stored.address, 1); // Default to Ethereum
      } else if (walletService.isMetaMaskInstalled()) {
        try {
          const addr = await walletService.getConnectedAddress();
          if (addr) {
            setAddress(addr);
            const chain = await walletService.getChainId();
            setChainId(chain);
            const bal = await walletService.getBalance(addr);
            setBalance(bal);
            onConnect?.(addr, chain || 1);
          }
        } catch {
          // Not connected
        }
      }
    };
    checkConnection();
  }, [onConnect]);

  // Setup event listeners
  useEffect(() => {
    const unsubAccounts = walletService.on("accountsChanged", (data) => {
      const accounts = data as string[];
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        walletService.getBalance(accounts[0]).then(setBalance);
      } else {
        setAddress(null);
        setBalance("0");
        onDisconnect?.();
      }
    });

    const unsubChain = walletService.on("chainChanged", (data) => {
      const newChainId = parseInt(data as string, 16) as ChainId;
      setChainId(newChainId);
      if (address) {
        walletService.getBalance(address).then(setBalance);
      }
    });

    const unsubDisconnect = walletService.on("disconnect", () => {
      setAddress(null);
      setChainId(null);
      setBalance("0");
      onDisconnect?.();
    });

    return () => {
      unsubAccounts();
      unsubChain();
      unsubDisconnect();
    };
  }, [address, onDisconnect]);

  // Connect MetaMask
  const handleMetaMaskConnect = async () => {
    setError(null);
    setIsConnecting(true);
    setConnectionMethod("metamask");

    // Check if running in Electron (no window.ethereum)
    const isElectron = typeof window !== "undefined" && !window.ethereum && typeof (window as unknown as { electronAPI?: unknown }).electronAPI !== "undefined";
    
    if (isElectron) {
      setError("MetaMask extension not available in desktop app. Please use WalletConnect or import your seed phrase.");
      setIsConnecting(false);
      return;
    }

    try {
      const state = await walletService.connectMetaMask();
      setAddress(state.address);
      setChainId(state.chainId);
      setBalance(state.balance);
      onConnect?.(state.address, state.chainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect MetaMask");
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect WalletConnect
  const handleWalletConnect = async () => {
    setError(null);
    setIsConnecting(true);
    setConnectionMethod("walletconnect");

    try {
      const state = await walletService.connectWalletConnect();
      setAddress(state.address);
      setChainId(state.chainId);
      setBalance(state.balance);
      onConnect?.(state.address, state.chainId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Import wallet from seed phrase
  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      setError("Please enter your seed phrase");
      return;
    }

    setError(null);
    setIsConnecting(true);
    setConnectionMethod("import");

    try {
      const state = await walletService.importWallet(mnemonic.trim());
      setAddress(state.address);
      setChainId(state.chainId);
      setBalance(state.balance);
      onConnect?.(state.address, state.chainId);
      setShowImportModal(false);
      setMnemonic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Generate new mnemonic for display
  const handleGenerateMnemonic = () => {
    const newMnemonic = walletService.generateMnemonic();
    setGeneratedMnemonic(newMnemonic);
  };

  // Switch chain
  const handleSwitchChain = async (targetChainId: ChainId) => {
    setError(null);
    console.log(`[WalletConnect] ========== SWITCH CHAIN ==========`);
    console.log(`[WalletConnect] Target chain: ${targetChainId}`);
    console.log(`[WalletConnect] Current chain: ${chainId}`);
    console.log(`[WalletConnect] Address: ${address}`);
    console.log(`[WalletConnect] Wallet type:`, walletService.getWalletType?.());
    
    try {
      const success = await walletService.switchChain(targetChainId);
      
      if (success) {
        console.log(`[WalletConnect] Chain switch successful`);
        setShowDropdown(false);
        
        // Refresh chain ID from wallet
        const newChainId = await walletService.getChainId();
        console.log(`[WalletConnect] New chain ID from wallet:`, newChainId);
        setChainId(newChainId);
        
        // Refresh balance for new chain
        if (address) {
          const newBalance = await walletService.getBalance(address);
          console.log(`[WalletConnect] New balance:`, newBalance);
          setBalance(newBalance);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to switch network";
      console.error(`[WalletConnect] Switch error:`, errorMsg);
      setError(errorMsg);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    await walletService.disconnect();
    setAddress(null);
    setChainId(null);
    setBalance("0");
    onDisconnect?.();
  };

  // Copy address
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Refresh balance
  const refreshBalance = async () => {
    if (address) {
      const bal = await walletService.getBalance(address);
      setBalance(bal);
    }
  };

  // Helpers
  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const getChainName = (id: ChainId | null) => {
    if (!id) return "Unknown";
    return SUPPORTED_CHAINS[id]?.name || "Unknown";
  };
  const getContractForChain = (id: ChainId) => HYPERCYCLE_CONTRACTS.find((c) => c.chainId === id);
  const isSupportedChain = chainId !== null && chainId in SUPPORTED_CHAINS;
  const isMetaMaskInstalled = walletService.isMetaMaskInstalled();
  // Check if running in Electron desktop app
  const isElectronApp = typeof window !== "undefined" && typeof (window as unknown as { electronAPI?: unknown }).electronAPI !== "undefined";
  const canUseMetaMask = isMetaMaskInstalled && !isElectronApp;

  // ===== CONNECTED STATE =====
  if (address) {
    return (
      <div className="space-y-4">
        {/* Wallet Card */}
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-gray-100">Wallet Connected</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-gray-400">{truncateAddress(address)}</code>
                  <button onClick={copyAddress} className="text-gray-500 hover:text-gray-300">
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Network Selector */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  isSupportedChain ? "bg-gray-800 border-gray-700" : "bg-red-900/30 border-red-700"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSupportedChain ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-sm">{getChainName(chainId)}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-gray-800 rounded-lg border border-gray-700 shadow-xl z-50">
                  {Object.entries(SUPPORTED_CHAINS).map(([id, chain]) => {
                    const cId = parseInt(id) as ChainId;
                    const chainConfig = chain as { name: string; rpcUrl: string };
                    const isActive = chainId === cId;
                    const contract = getContractForChain(cId);
                    return (
                      <button
                        key={id}
                        onClick={() => handleSwitchChain(cId)}
                        disabled={isActive}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-700 ${isActive ? "opacity-50" : ""} first:rounded-t-lg last:rounded-b-lg`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-500"}`} />
                          <div>
                            <div className="text-sm">{chainConfig.name}</div>
                            {contract && <div className="text-xs text-gray-500">{contract.name}</div>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg mb-3">
            <div>
              <div className="text-sm text-gray-400">Balance</div>
              <div className="text-xl font-semibold text-gray-100">{parseFloat(balance).toFixed(4)} ETH</div>
            </div>
            <button onClick={refreshBalance} className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href={chainId ? `${SUPPORTED_CHAINS[chainId].blockExplorer}/address/${address}` : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </a>
            <button
              onClick={handleDisconnect}
              className="flex-1 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm"
            >
              Disconnect
            </button>
          </div>

          {/* Wrong Network Warning */}
          {!isSupportedChain && (
            <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Switch to Ethereum or Base to manage nodes</span>
              </div>
            </div>
          )}
        </div>

        {/* Factory Status */}
        {isSupportedChain && chainId && (
          <FactoryStatusCard chainId={chainId} isConnected={!!address} />
        )}

        {/* Node Configuration */}
        {isSupportedChain && chainId && (
          <NodeConfigPanel
            address={address}
            chainId={chainId}
            agents={agents}
            onLinkNode={onLinkNode}
            onUnlinkNode={onUnlinkNode}
          />
        )}
      </div>
    );
  }

  // ===== NOT CONNECTED - SIGN IN SCREEN =====
  return (
    <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-gray-100 mb-2">Connect Your Wallet</h3>
        <p className="text-sm text-gray-400">
          Sign in to manage your Hypercycle nodes and ANFEs on Ethereum and Base
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Connection Options */}
      <div className="space-y-3">
        {/* MetaMask */}
        <button
          onClick={handleMetaMaskConnect}
          disabled={isConnecting && connectionMethod === "metamask"}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all group ${
            canUseMetaMask 
              ? "bg-gray-800 hover:bg-gray-700 border-gray-700" 
              : "bg-gray-800/50 border-gray-700/50 cursor-not-allowed"
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-8 h-8">
              <path fill="#E2761B" d="M36.4 3L22 14l2.7-6.3L36.4 3z"/>
              <path fill="#E4761B" d="M3.6 3l14.3 11.2L15.3 7 3.6 3zM31.2 28.4l-3.8 5.8 8.2 2.3 2.3-8-6.7-.1zM2.1 28.5l2.3 8 8.2-2.3-3.8-5.8-6.7.1z"/>
              <path fill="#E4761B" d="M12.1 17.4L9.9 20.8l8 .4-.3-8.6-5.5 4.8zM27.9 17.4l-5.6-4.9-.2 8.6 8-.4-2.2-3.3z"/>
              <path fill="#E4761B" d="M11.5 28.5l4.4-2.2-3.4-2.6-1 4.8zM24.1 26.3l4.4 2.2-1.1-4.8-3.3 2.6z"/>
              <path fill="#D7C1B3" d="M28.5 28.4l-4.4-2.2.4 3.2.4 1.5 3.6-2.5zM11.5 28.4l3.6 2.5.3-1.5.4-3.2-4.3 2.2z"/>
              <path fill="#233447" d="M15.4 22.3l-3.1-1.2 2.2-1 .9 2.2zM24.6 22.3l.9-2.2 2.2 1-3.1 1.2z"/>
              <path fill="#CD6116" d="M11.5 28.5l1-5-4.4.1 3.4 4.9zM28.5 23.5l-4.4-.1 1 5 3.4-4.9zM28.9 20.8l-8-.4.7 4.4 2.2-1.2 3.1 1.2 2-4zM9.9 20.8l2 4 3.1-1.2 2.2 1.2.7-4.4-8 .4z"/>
              <path fill="#E475B5" d="M9.9 20.8l.4 3.2-.3 1.5 4.3-.1-.3-4.6-4.1 0z"/>
              <path fill="#E475B5" d="M28.9 20.8l-4.1 0-.3 4.6 4.3.1-.3-1.5.4-3.2z"/>
              <path fill="#F6851B" d="M15.4 22.3l-.7 4.4.3-1.5 4.3.1 0 0-3.9-3zM24.6 22.3l-3.9 3 4.3-.1.3 1.5-.7-4.4z"/>
              <path fill="#C0AD9E" d="M15.8 28.4l-.3 1.5 1.5 1.1 6.5 0 1.5-1.1-.3-1.5-8.9 0z"/>
              <path fill="#161616" d="M8.1 35.3l2.5-5.8-8.2-2.3 5.7 8.1zM31.9 35.3l5.7-8.1-8.2 2.3 2.5 5.8z"/>
              <path fill="#161616" d="M30.1 22.3l-2.2 3.3 7.1-.2 2.3-4.6-7.2 1.5zM9.9 20.8l2.3 4.6 7.1.2-2.2-3.3-7.2-1.5z"/>
              <path fill="#161616" d="M15.4 22.3l.7 4.4.3 3.2 4.3.1 4.3-.1.3-3.2.7-4.4-10.6 0z"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-gray-100">
              {isConnecting && connectionMethod === "metamask" ? "Connecting..." : "MetaMask"}
            </div>
            <div className="text-sm text-gray-500">
              {isElectronApp 
                ? "Not available in desktop app" 
                : isMetaMaskInstalled 
                  ? "Browser extension" 
                  : "Install extension first"}
            </div>
          </div>
          {isConnecting && connectionMethod === "metamask" ? (
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-300 -rotate-90" />
          )}
        </button>
        
        {/* Desktop App Notice */}
        {isElectronApp && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <div className="text-sm text-blue-400">
                <strong>Desktop App:</strong> MetaMask extension is not available in Electron apps. Use one of the options below:
              </div>
            </div>
            
            {/* Run in Browser - Opens local dev server */}
            <button
              onClick={() => {
                // Instructions for running in browser
                const instructions = `To use MetaMask:\n\n1. Open PowerShell\n2. cd C:\\Users\\mauri\\mosaic-companion\n3. npm run web\n4. Open Chrome to http://localhost:5173\n\nOr use the production dApp:\nhttps://dapp.hypc.ai`;
                alert(instructions);
              }}
              className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-900/50 to-emerald-900/50 hover:from-green-900/70 hover:to-emerald-900/70 rounded-xl border border-green-700/50 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/30 flex items-center justify-center">
                <Globe className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-100">Run in Browser (MetaMask)</div>
                <div className="text-sm text-gray-400">Use Chrome with MetaMask extension</div>
              </div>
              <ExternalLink className="w-5 h-5 text-green-400" />
            </button>
            
            {/* Open Production DApp */}
            <button
              onClick={() => {
                window.open("https://dapp.hypc.ai", "_blank");
              }}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-100">Open dapp.hypc.ai</div>
                <div className="text-sm text-gray-400">Official Hypercycle dashboard</div>
              </div>
              <ChevronDown className="w-5 h-5 text-gray-500 -rotate-90" />
            </button>
          </div>
        )}

        {/* WalletConnect */}
        <button
          onClick={handleWalletConnect}
          disabled={isConnecting && connectionMethod === "walletconnect"}
          className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-8 h-8">
              <path fill="#3B99D9" d="M10 8c-2.2 0-4 1.8-4 4v16c0 2.2 1.8 4 4 4h20c2.2 0 4-1.8 4-4V12c0-2.2-1.8-4-4-4H10zm2 6h16v2H12v-2zm0 5h16v2H12v-2zm0 5h10v2H12v-2z"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-gray-100">
              {isConnecting && connectionMethod === "walletconnect" ? "Connecting..." : "WalletConnect"}
            </div>
            <div className="text-sm text-gray-500">Scan QR with mobile wallet</div>
          </div>
          {isConnecting && connectionMethod === "walletconnect" ? (
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-300 -rotate-90" />
          )}
        </button>

        {/* Import Wallet */}
        <button
          onClick={() => setShowImportModal(true)}
          disabled={isConnecting}
          className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Key className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-gray-100">Import Wallet</div>
            <div className="text-sm text-gray-500">Enter seed phrase to restore</div>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-300 -rotate-90" />
        </button>

        {/* Create New Wallet */}
        <button
          onClick={() => { handleGenerateMnemonic(); setShowImportModal(true); }}
          disabled={isConnecting}
          className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 hover:from-purple-900/70 hover:to-indigo-900/70 rounded-xl border border-purple-700/50 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-purple-300" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-gray-100">Create New Wallet</div>
            <div className="text-sm text-gray-400">Generate a fresh seed phrase</div>
          </div>
          <ChevronDown className="w-5 h-5 text-purple-400 -rotate-90" />
        </button>
      </div>

      {/* Get MetaMask link */}
      {!isMetaMaskInstalled && (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full mt-4 py-3 text-sm text-purple-400 hover:text-purple-300"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Get MetaMask extension</span>
        </a>
      )}

      {/* Info */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          By connecting, you agree to interact with smart contracts on Ethereum and Base.
        </p>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700">
            <h4 className="text-lg font-semibold text-gray-100 mb-2">
              {generatedMnemonic ? "Your New Wallet" : "Import Wallet"}
            </h4>
            <p className="text-sm text-gray-400 mb-4">
              {generatedMnemonic 
                ? "Save this seed phrase securely. You'll need it to recover your wallet."
                : "Enter your 12 or 24 word seed phrase to restore your wallet."}
            </p>

            {/* Generated Mnemonic Display */}
            {generatedMnemonic && (
              <div className="mb-4 p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-purple-400">Seed Phrase</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedMnemonic); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-gray-100 font-mono text-sm break-words select-all">
                  {generatedMnemonic}
                </p>
              </div>
            )}

            {/* Mnemonic Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Seed Phrase</label>
              <div className="relative">
                <textarea
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                  placeholder="Enter your seed phrase (12 or 24 words)"
                  className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-100 resize-none"
                />
                <button
                  onClick={() => setShowMnemonic(!showMnemonic)}
                  className="absolute right-2 top-2 p-1 text-gray-500 hover:text-gray-300"
                >
                  {showMnemonic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowImportModal(false); setGeneratedMnemonic(null); setMnemonic(""); }}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportWallet}
                disabled={isConnecting || !mnemonic.trim()}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors disabled:opacity-50"
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Import"}
              </button>
            </div>

            {/* Warning */}
            <p className="text-xs text-yellow-500 mt-4">
              ⚠️ Never share your seed phrase. Anyone with it can access your wallet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;