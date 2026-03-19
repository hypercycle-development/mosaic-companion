import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Save,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Wallet,
  Copy,
  Check,
  Plus,
  BookUser,
  Clock,
  ExternalLink,
  AlertTriangle,
  Globe,
  Coins,
  Shield,
  Ban,
  Search,
  Gauge,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface WalletContact {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

interface RecentAction {
  id: string;
  tool: string;
  description: string;
  timestamp: number;
  success: boolean;
}

interface TokenConfig {
  id: string;
  symbol: string;
  name: string;
  contractAddress?: string;
  decimals: number;
  isNative: boolean;
  network: string;
}

interface TransferLimit {
  symbol: string;
  maxPerTx: string;
  maxDaily: string;
}

interface BannedAddress {
  address: string;
  reason?: string;
  addedAt: number;
}

interface SafetySettings {
  requireConfirmation: boolean;
  whitelistOnly: boolean;
  cooldownMs: number;
}

interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  customRpcUrl: string;
}

interface Web3Config {
  activeNetwork: string;
  networks: Record<string, NetworkConfig>;
  tokens: TokenConfig[];
  transferLimits: TransferLimit[];
  bannedAddresses: BannedAddress[];
  safety: SafetySettings;
}

// =============================================================================
// ETH Icon SVG Component
// =============================================================================

export const EthIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 20,
  className = "",
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 417"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z"
      fill="#687BDE"
    />
    <path d="M127.962 0L0 212.32L127.962 287.959V154.158V0Z" fill="#8C9FEF" />
    <path
      d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L255.999 236.587L127.961 312.187Z"
      fill="#687BDE"
    />
    <path
      d="M127.962 416.905V312.187L0 236.587L127.962 416.905Z"
      fill="#8C9FEF"
    />
    <path
      d="M127.961 287.958L255.921 212.32L127.961 154.159V287.958Z"
      fill="#4E63CB"
    />
    <path d="M0 212.32L127.962 287.958V154.159L0 212.32Z" fill="#687BDE" />
  </svg>
);

// =============================================================================
// Wallet Overview Section
// =============================================================================

const WalletOverview: React.FC<{ config: Web3Config | null }> = ({
  config,
}) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [balances, setBalances] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setIsLoading(true);
    try {
      const existsResult =
        (await window.electronAPI?.trading?.walletExists()) as any;
      const exists =
        existsResult?.exists ?? existsResult?.data?.exists ?? false;
      if (exists) {
        setHasWallet(true);
        const addrResult = await window.electronAPI?.web3?.getAddress();
        if (addrResult?.success && addrResult?.data?.address) {
          setWalletAddress(addrResult.data.address);
          // Fetch all token balances
          try {
            const balResult = await window.electronAPI?.web3?.getBalance();
            if (balResult?.success && balResult?.data) {
              setBalances(balResult.data as string);
            }
          } catch {
            /* balance is optional */
          }
        }
      } else {
        setHasWallet(false);
        setWalletAddress(null);
      }
    } catch (error) {
      console.error("Failed to load wallet:", error);
    }
    setIsLoading(false);
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-gray-500" size={24} />
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-700 rounded-xl">
        <Wallet className="mx-auto size-12 text-gray-600 mb-4" />
        <p className="text-gray-500 mb-2">No wallet configured</p>
        <p className="text-sm text-gray-600">
          Add a private key below to get started
        </p>
      </div>
    );
  }

  const network = config?.networks?.[config.activeNetwork];
  const explorerUrl = network?.explorerUrl || "https://basescan.org";

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <EthIcon size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-400">Wallet Address</p>
              <p className="text-white font-mono text-sm">
                {walletAddress
                  ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
                  : "Deriving..."}
              </p>
              {network && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {network.name} · Chain ID {network.chainId}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAddress}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check size={16} className="text-emerald-400" />
              ) : (
                <Copy size={16} />
              )}
            </button>
            {walletAddress && (
              <a
                href={`${explorerUrl}/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="View on Explorer"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(
                    `${explorerUrl}/address/${walletAddress}`,
                    "_blank",
                  );
                }}
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
        {walletAddress && (
          <div className="mt-3 px-3 py-2 bg-gray-950/50 rounded-lg">
            <p className="text-xs text-gray-500 font-mono break-all select-all" data-testid="user-wallet-address">
              {walletAddress}
            </p>
          </div>
        )}
      </div>

      {/* Token Balances */}
      {balances && (
        <div className="p-4 bg-gray-950/50 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
            Balances
          </p>
          {balances
            .split("\n")
            .filter(
              (l) => !l.startsWith("Address:") && !l.startsWith("Network:"),
            )
            .map((line, i) => {
              const [symbol, ...rest] = line.split(": ");
              return (
                <div
                  key={i}
                  className="flex justify-between items-center py-1.5 border-b border-gray-800/50 last:border-0"
                >
                  <span className="text-sm text-gray-300 font-medium">
                    {symbol}
                  </span>
                  <span className="text-sm text-gray-400 font-mono">
                    {rest.join(": ")}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Private Key Manager
// =============================================================================

const PrivateKeyManager: React.FC<{ onWalletChanged: () => void }> = ({
  onWalletChanged,
}) => {
  const [hasWallet, setHasWallet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    if (window.electronAPI?.trading?.walletExists) {
      const result = (await window.electronAPI.trading.walletExists()) as any;
      setHasWallet(result.exists || result?.data?.exists || false);
    }
  };

  const handleGenerate = async () => {
    setIsSaving(true);
    try {
      const result = (await window.electronAPI?.trading?.saveWallet?.(
        "PRIVATE_KEY_TO_BE_GENERATED",
      )) as { success?: boolean };
      if (result?.success) {
        toast.success("New wallet generated and saved securely.");
        setHasWallet(true);
        onWalletChanged();
      } else {
        toast.error("Failed to generate wallet.");
      }
    } catch {
      toast.error("Failed to generate wallet.");
    }
    setIsSaving(false);
  };

  const handleImportFromClipboard = async () => {
    setIsSaving(true);
    try {
      const result = (await window.electronAPI?.web3?.importFromClipboard?.()) as {
        success?: boolean;
        error?: string;
      };
      if (result?.success) {
        toast.success("Wallet imported. Clipboard cleared.");
        setHasWallet(true);
        onWalletChanged();
      } else {
        toast.error(result?.error ?? "Failed to import. Copy a valid private key (0x + 64 hex chars) first.");
      }
    } catch {
      toast.error("Failed to import from clipboard.");
    }
    setIsSaving(false);
  };

  const handleOpenSecureImport = () => {
    window.electronAPI?.web3?.openSecureImportWindow?.();
    toast.info("Paste your key in the secure window.");
  };

  useEffect(() => {
    const unsub = window.electronAPI?.web3?.onWalletImported?.(() => {
      checkWallet();
      onWalletChanged();
      toast.success("Wallet imported.");
    });
    return () => unsub?.();
  }, [onWalletChanged]);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete the wallet? This cannot be undone.",
      )
    )
      return;
    if (window.electronAPI?.trading?.deleteWallet) {
      const result = await window.electronAPI.trading.deleteWallet();
      if (result.success) {
        toast.success("Wallet deleted.");
        setHasWallet(false);
        onWalletChanged();
      } else {
        toast.error("Failed to delete wallet.");
      }
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Securely store an Ethereum private key using system keychain encryption.
        <br />
        <span className="text-yellow-500 font-medium flex items-center gap-1 mt-1">
          <AlertTriangle size={12} />
          Only use a dedicated wallet with limited funds.
        </span>
      </p>

      {hasWallet ? (
        <div className="flex items-center justify-between p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Wallet className="text-emerald-500" size={24} />
            <div>
              <p className="text-emerald-400 font-medium">Private Key Stored</p>
              <p className="text-xs text-emerald-600">
                Encrypted with system keychain
              </p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete Wallet"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Create a new wallet or import an existing one. Keys never pass through the main app UI.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGenerate}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Generate new wallet
            </button>
            <button
              onClick={handleImportFromClipboard}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              Import from clipboard
            </button>
            <button
              onClick={handleOpenSecureImport}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              Import in secure window
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Network Settings Section
// =============================================================================

const NetworkSettings: React.FC<{
  config: Web3Config | null;
  onConfigChanged: () => void;
}> = ({ config, onConfigChanged }) => {
  const [customRpc, setCustomRpc] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (config) {
      const net = config.networks[config.activeNetwork];
      setCustomRpc(net?.customRpcUrl || "");
    }
  }, [config]);

  const handleNetworkSwitch = async (networkId: string) => {
    setIsSwitching(true);
    try {
      const updated = { ...config!, activeNetwork: networkId };
      await window.electronAPI?.web3?.updateConfig(updated as any);
      toast.success(
        `Switched to ${config?.networks[networkId]?.name || networkId}`,
      );
      onConfigChanged();
    } catch {
      toast.error("Failed to switch network.");
    }
    setIsSwitching(false);
  };

  const handleSaveRpc = async () => {
    if (!config) return;
    try {
      const networks = { ...config.networks };
      networks[config.activeNetwork] = {
        ...networks[config.activeNetwork],
        customRpcUrl: customRpc.trim(),
      };
      await window.electronAPI?.web3?.updateConfig({
        ...config,
        networks,
      } as any);
      toast.success("Custom RPC saved.");
      onConfigChanged();
    } catch {
      toast.error("Failed to save RPC.");
    }
  };

  if (!config) return null;

  const activeNet = config.networks[config.activeNetwork];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Select your Base chain network. Use testnet for development and testing.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(config.networks).map(([id, net]) => (
          <button
            key={id}
            onClick={() => handleNetworkSwitch(id)}
            disabled={isSwitching}
            className={`p-4 rounded-lg border transition-all text-left ${
              config.activeNetwork === id
                ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            }`}
          >
            <p className="font-medium text-sm text-gray-200">{net.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              Chain ID: {net.chainId}
            </p>
            {config.activeNetwork === id && (
              <span className="inline-block mt-2 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-400">
          Custom RPC URL (optional, overrides default for {activeNet.name})
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customRpc}
            onChange={(e) => setCustomRpc(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
            placeholder={activeNet.rpcUrl}
          />
          <button
            onClick={handleSaveRpc}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-gray-600">Default: {activeNet.rpcUrl}</p>
      </div>
    </div>
  );
};

// =============================================================================
// Currency / Token Manager
// =============================================================================

const CurrencyManager: React.FC<{
  config: Web3Config | null;
  onConfigChanged: () => void;
}> = ({ config, onConfigChanged }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [contractInput, setContractInput] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    name: string;
    symbol: string;
    decimals: number;
  } | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");

  if (!config) return null;

  const activeTokens = config.tokens.filter(
    (t) => t.network === config.activeNetwork,
  );

  const handleLookup = async () => {
    if (!contractInput.trim()) return;
    setIsLooking(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const result = await window.electronAPI?.web3?.lookupToken(
        contractInput.trim(),
      );
      if (result?.success && result.data) {
        // Parse the data string to extract token info
        const lines = (result.data as string).split("\n");
        const name =
          lines
            .find((l) => l.includes("Name:"))
            ?.split("Name:")[1]
            ?.trim() || "";
        const symbol =
          lines
            .find((l) => l.includes("Symbol:"))
            ?.split("Symbol:")[1]
            ?.trim() || "";
        const decimalsStr =
          lines
            .find((l) => l.includes("Decimals:"))
            ?.split("Decimals:")[1]
            ?.trim() || "18";
        setLookupResult({ name, symbol, decimals: parseInt(decimalsStr) });
      } else {
        setLookupError(
          result?.error ||
            "Could not read token data. Is this a valid ERC20 contract?",
        );
      }
    } catch {
      setLookupError("Failed to look up token.");
    }
    setIsLooking(false);
  };

  const handleAddToken = async () => {
    if (!lookupResult || !contractInput) return;
    try {
      const newToken: TokenConfig = {
        id: `${lookupResult.symbol.toLowerCase()}-${config.activeNetwork}-${Date.now()}`,
        symbol: lookupResult.symbol,
        name: lookupResult.name,
        contractAddress: contractInput.trim(),
        decimals: lookupResult.decimals,
        isNative: false,
        network: config.activeNetwork,
      };
      const updatedTokens = [...config.tokens, newToken];
      await window.electronAPI?.web3?.updateConfig({
        ...config,
        tokens: updatedTokens,
      } as any);
      toast.success(`Token ${lookupResult.symbol} added!`);
      setContractInput("");
      setLookupResult(null);
      setShowAddForm(false);
      onConfigChanged();
    } catch {
      toast.error("Failed to add token.");
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    const token = config.tokens.find((t) => t.id === tokenId);
    if (!token || token.isNative) return;
    if (!window.confirm(`Remove ${token.symbol}?`)) return;

    const updatedTokens = config.tokens.filter((t) => t.id !== tokenId);
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      tokens: updatedTokens,
    } as any);
    toast.success(`${token.symbol} removed.`);
    onConfigChanged();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Manage ERC20 tokens on {config.networks[config.activeNetwork]?.name}.
        Token info is fetched from the blockchain automatically.
      </p>

      {/* Token List */}
      <div className="space-y-2">
        {activeTokens.map((token) => (
          <div
            key={token.id}
            className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-indigo-400">
                  {token.symbol.slice(0, 3)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {token.symbol}{" "}
                  <span className="text-gray-500 font-normal">
                    · {token.name}
                  </span>
                </p>
                {token.contractAddress ? (
                  <p className="text-xs text-gray-600 font-mono">
                    {token.contractAddress.slice(0, 8)}...
                    {token.contractAddress.slice(-6)} · {token.decimals}{" "}
                    decimals
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">
                    Native token · {token.decimals} decimals
                  </p>
                )}
              </div>
            </div>
            {!token.isNative && (
              <button
                onClick={() => handleDeleteToken(token.id)}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove token"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Token Form */}
      {showAddForm ? (
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
          <div className="p-3 bg-yellow-900/10 border border-yellow-800/30 rounded-lg">
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              Always verify the contract address on the block explorer before
              adding a token.
            </p>
          </div>

          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">
              Contract Address
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={contractInput}
                onChange={(e) => {
                  setContractInput(e.target.value);
                  setLookupResult(null);
                  setLookupError("");
                }}
                className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                placeholder="0x..."
              />
              <button
                onClick={handleLookup}
                disabled={!contractInput.trim() || isLooking}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-1.5"
              >
                {isLooking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                Lookup
              </button>
            </div>
          </label>

          {lookupError && <p className="text-sm text-red-400">{lookupError}</p>}

          {lookupResult && (
            <div className="p-3 bg-emerald-900/10 border border-emerald-800/30 rounded-lg space-y-2">
              <p className="text-sm text-emerald-400 font-medium">
                Token found on-chain:
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Name</p>
                  <p className="text-gray-200">{lookupResult.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Symbol</p>
                  <p className="text-gray-200">{lookupResult.symbol}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Decimals</p>
                  <p className="text-gray-200">{lookupResult.decimals}</p>
                </div>
              </div>
              <button
                onClick={handleAddToken}
                className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add {lookupResult.symbol}
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => {
                setShowAddForm(false);
                setContractInput("");
                setLookupResult(null);
                setLookupError("");
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-800 rounded-lg transition-all text-sm w-full justify-center"
        >
          <Plus size={16} />
          Add ERC20 Token
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Transfer Limits Section
// =============================================================================

const TransferLimitsSection: React.FC<{
  config: Web3Config | null;
  onConfigChanged: () => void;
}> = ({ config, onConfigChanged }) => {
  const [editSymbol, setEditSymbol] = useState("");
  const [editMaxPerTx, setEditMaxPerTx] = useState("");
  const [editMaxDaily, setEditMaxDaily] = useState("");
  const [showForm, setShowForm] = useState(false);

  if (!config) return null;

  const activeTokens = config.tokens.filter(
    (t) => t.network === config.activeNetwork,
  );

  const handleSave = async () => {
    if (!editSymbol) return;
    const newLimit: TransferLimit = {
      symbol: editSymbol,
      maxPerTx: editMaxPerTx || "0",
      maxDaily: editMaxDaily || "0",
    };
    const existingIdx = config.transferLimits.findIndex(
      (l) => l.symbol === editSymbol,
    );
    const updatedLimits = [...config.transferLimits];
    if (existingIdx >= 0) {
      updatedLimits[existingIdx] = newLimit;
    } else {
      updatedLimits.push(newLimit);
    }
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      transferLimits: updatedLimits,
    } as any);
    toast.success(`Limit for ${editSymbol} saved.`);
    setShowForm(false);
    setEditSymbol("");
    setEditMaxPerTx("");
    setEditMaxDaily("");
    onConfigChanged();
  };

  const handleDelete = async (symbol: string) => {
    const updatedLimits = config.transferLimits.filter(
      (l) => l.symbol !== symbol,
    );
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      transferLimits: updatedLimits,
    } as any);
    toast.success(`Limit for ${symbol} removed.`);
    onConfigChanged();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Set maximum amounts per transaction and daily limits for each token. Use
        "*" to set a global limit for all tokens.
      </p>

      {config.transferLimits.length > 0 && (
        <div className="space-y-2">
          {config.transferLimits.map((limit) => (
            <div
              key={limit.symbol}
              className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {limit.symbol === "*" ? "All tokens" : limit.symbol}
                </p>
                <p className="text-xs text-gray-500">
                  Max/tx:{" "}
                  {parseFloat(limit.maxPerTx) > 0 ? limit.maxPerTx : "No limit"}
                  {" · "}
                  Daily:{" "}
                  {parseFloat(limit.maxDaily) > 0 ? limit.maxDaily : "No limit"}
                </p>
              </div>
              <button
                onClick={() => handleDelete(limit.symbol)}
                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Token</label>
            <select
              value={editSymbol}
              onChange={(e) => setEditSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none"
            >
              <option value="">Select token...</option>
              <option value="*">All tokens (*)</option>
              {activeTokens.map((t) => (
                <option key={t.id} value={t.symbol}>
                  {t.symbol} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-400 mb-1 block">
                Max per transaction
              </span>
              <input
                type="text"
                value={editMaxPerTx}
                onChange={(e) => setEditMaxPerTx(e.target.value)}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none"
                placeholder="0 = no limit"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-400 mb-1 block">
                Max daily aggregate
              </span>
              <input
                type="text"
                value={editMaxDaily}
                onChange={(e) => setEditMaxDaily(e.target.value)}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none"
                placeholder="0 = no limit"
              />
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setEditSymbol("");
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!editSymbol}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save Limit
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-800 rounded-lg transition-all text-sm w-full justify-center"
        >
          <Plus size={16} />
          Add Transfer Limit
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Banned Addresses Section
// =============================================================================

const BannedAddressesSection: React.FC<{
  config: Web3Config | null;
  onConfigChanged: () => void;
}> = ({ config, onConfigChanged }) => {
  const [showForm, setShowForm] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newReason, setNewReason] = useState("");

  if (!config) return null;

  const handleAdd = async () => {
    if (!newAddress.trim()) return;
    const updatedBans = [
      ...config.bannedAddresses,
      {
        address: newAddress.trim(),
        reason: newReason.trim() || undefined,
        addedAt: Date.now(),
      },
    ];
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      bannedAddresses: updatedBans,
    } as any);
    toast.success("Address banned.");
    setNewAddress("");
    setNewReason("");
    setShowForm(false);
    onConfigChanged();
  };

  const handleRemove = async (address: string) => {
    const updatedBans = config.bannedAddresses.filter(
      (b) => b.address.toLowerCase() !== address.toLowerCase(),
    );
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      bannedAddresses: updatedBans,
    } as any);
    toast.success("Address unbanned.");
    onConfigChanged();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Block transfers to specific addresses. Any transfer attempt to a banned
        address will be rejected.
      </p>

      {config.bannedAddresses.length > 0 && (
        <div className="space-y-2">
          {config.bannedAddresses.map((ban) => (
            <div
              key={ban.address}
              className="flex items-center justify-between p-3 bg-red-950/10 border border-red-900/30 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-200 font-mono truncate">
                  {ban.address}
                </p>
                {ban.reason && (
                  <p className="text-xs text-gray-500">{ban.reason}</p>
                )}
              </div>
              <button
                onClick={() => handleRemove(ban.address)}
                className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors shrink-0 ml-2"
                title="Unban"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">
              Address to ban
            </span>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm outline-none"
              placeholder="0x..."
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">
              Reason (optional)
            </span>
            <input
              type="text"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none"
              placeholder="e.g. Known scam, Suspicious, etc."
            />
          </label>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setNewAddress("");
                setNewReason("");
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newAddress.trim()}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Ban Address
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-800 rounded-lg transition-all text-sm w-full justify-center"
        >
          <Plus size={16} />
          Ban Address
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Safety Settings Section
// =============================================================================

const SafetySettingsSection: React.FC<{
  config: Web3Config | null;
  onConfigChanged: () => void;
}> = ({ config, onConfigChanged }) => {
  if (!config) return null;

  const toggleSetting = async (key: keyof SafetySettings, value: boolean) => {
    const updated = { ...config.safety, [key]: value };
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      safety: updated,
    } as any);
    onConfigChanged();
  };

  const setCooldown = async (valueStr: string) => {
    const secs = parseInt(valueStr) || 0;
    const updated = { ...config.safety, cooldownMs: secs * 1000 };
    await window.electronAPI?.web3?.updateConfig({
      ...config,
      safety: updated,
    } as any);
    onConfigChanged();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Control how transfers are executed. These safety rails protect you from
        accidental or malicious transactions.
      </p>

      <div className="space-y-3">
        {/* Require Confirmation */}
        <label className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer hover:border-gray-700 transition-colors">
          <div>
            <p className="text-sm font-medium text-gray-200">
              Require confirmation
            </p>
            <p className="text-xs text-gray-500">
              Transfers need explicit approval before executing
            </p>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={config.safety.requireConfirmation}
              onChange={(e) =>
                toggleSetting("requireConfirmation", e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </div>
        </label>

        {/* Whitelist Only */}
        <label className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg cursor-pointer hover:border-gray-700 transition-colors">
          <div>
            <p className="text-sm font-medium text-gray-200">
              Whitelist-only transfers
            </p>
            <p className="text-xs text-gray-500">
              Only allow transfers to saved contacts
            </p>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={config.safety.whitelistOnly}
              onChange={(e) => toggleSetting("whitelistOnly", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] peer-checked:after:translate-x-full after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </div>
        </label>

        {/* Cooldown */}
        <div className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-200">
                Transaction cooldown
              </p>
              <p className="text-xs text-gray-500">
                Minimum wait between transactions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={Math.round(config.safety.cooldownMs / 1000)}
              onChange={(e) => setCooldown(e.target.value)}
              className="w-24 px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none"
            />
            <span className="text-sm text-gray-500">seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Address Book Section
// =============================================================================

const AddressBook: React.FC = () => {
  const [contacts, setContacts] = useState<WalletContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.web3?.getContacts();
      if (result?.success && typeof result.data === "string") {
        const lines = result.data
          .split("\n")
          .filter((l: string) => l.startsWith("•"));
        const parsed: WalletContact[] = lines
          .map((line: string, i: number) => {
            const match = line.match(/• (.+?): (0x[a-fA-F0-9]+)/);
            if (match) {
              return {
                id: `contact-${i}`,
                name: match[1],
                address: match[2],
                createdAt: Date.now(),
              };
            }
            return null;
          })
          .filter(Boolean) as WalletContact[];
        setContacts(parsed);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleAdd = async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    try {
      const result = await window.electronAPI?.web3?.saveContact(
        newName.trim(),
        newAddress.trim(),
      );
      if (result?.success) {
        toast.success(`Contact "${newName}" saved!`);
        setNewName("");
        setNewAddress("");
        setShowAddForm(false);
        loadContacts();
      } else {
        toast.error(result?.error || "Failed to save contact.");
      }
    } catch {
      toast.error("Failed to save contact.");
    }
  };

  const handleDelete = async (contact: WalletContact) => {
    if (!window.confirm(`Delete contact "${contact.name}"?`)) return;
    try {
      await window.electronAPI?.web3?.deleteContact(contact.id);
      toast.success(`Contact "${contact.name}" deleted.`);
      loadContacts();
    } catch {
      toast.error("Failed to delete contact.");
    }
  };

  const copyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="animate-spin text-gray-500" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Save frequently used wallet addresses with a label. You can reference
        these by name in the chat (e.g. &quot;send 10 USDC to John&quot;).
      </p>

      {contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-indigo-400">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200">
                    {contact.name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {contact.address}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => copyAddress(contact.id, contact.address)}
                  className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
                  title="Copy address"
                >
                  {copiedId === contact.id ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(contact)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete contact"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-3">
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 text-sm"
              placeholder="e.g. John, My Exchange"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">
              Wallet Address
            </span>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
              placeholder="0x..."
            />
          </label>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
                setNewAddress("");
              }}
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newAddress.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm flex items-center gap-1.5"
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-800 rounded-lg transition-all text-sm w-full justify-center"
        >
          <Plus size={16} /> Add Contact
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Recent Actions Section
// =============================================================================

const RecentActions: React.FC = () => {
  const [actions, setActions] = useState<RecentAction[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("web3_recent_actions");
      if (stored) setActions(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-700 rounded-xl">
        <Clock className="mx-auto size-10 text-gray-600 mb-3" />
        <p className="text-gray-500 text-sm">No recent actions yet</p>
        <p className="text-xs text-gray-600 mt-1">
          Actions from chat and Web3 tools will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {actions.slice(0, 20).map((action) => (
        <div
          key={action.id}
          className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg"
        >
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${action.success ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate">
              {action.description}
            </p>
            <p className="text-xs text-gray-600 font-mono">{action.tool}</p>
          </div>
          <span className="text-xs text-gray-600 shrink-0">
            {new Date(action.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Web3 Page
// =============================================================================

export const Web3Page: React.FC = () => {
  const [walletKey, setWalletKey] = useState(0);
  const [config, setConfig] = useState<Web3Config | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await window.electronAPI?.web3?.getConfig();
      if (cfg) setConfig(cfg);
    } catch (err) {
      console.error("Failed to load Web3 config:", err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleWalletChanged = () => {
    setWalletKey((k) => k + 1);
  };

  const handleConfigChanged = () => {
    loadConfig();
  };

  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 animate-in slide-in-from-bottom-4 duration-300 text-gray-100 font-sans">
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-800 pb-4 tracking-tight flex items-center gap-3">
        <EthIcon size={32} />
        Web3
      </h1>

      <div className="space-y-8">
        {/* Wallet Overview */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Wallet size={20} />
            Wallet
          </h2>
          <WalletOverview key={`overview-${walletKey}`} config={config} />
        </section>

        {/* Network */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Globe size={20} />
            Network
          </h2>
          <NetworkSettings
            config={config}
            onConfigChanged={handleConfigChanged}
          />
        </section>

        {/* Private Key Management */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Eye size={20} />
            Private Key
          </h2>
          <PrivateKeyManager
            key={`key-${walletKey}`}
            onWalletChanged={handleWalletChanged}
          />
        </section>

        {/* Currencies */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Coins size={20} />
            Currencies
          </h2>
          <CurrencyManager
            config={config}
            onConfigChanged={handleConfigChanged}
          />
        </section>

        {/* Transfer Limits */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Gauge size={20} />
            Transfer Limits
          </h2>
          <TransferLimitsSection
            config={config}
            onConfigChanged={handleConfigChanged}
          />
        </section>

        {/* Banned Addresses */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Ban size={20} />
            Banned Addresses
          </h2>
          <BannedAddressesSection
            config={config}
            onConfigChanged={handleConfigChanged}
          />
        </section>

        {/* Safety Settings */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Shield size={20} />
            Safety
          </h2>
          <SafetySettingsSection
            config={config}
            onConfigChanged={handleConfigChanged}
          />
        </section>

        {/* Address Book */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <BookUser size={20} />
            Address Book
          </h2>
          <AddressBook key={`book-${walletKey}`} />
        </section>

        {/* Recent Actions */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Clock size={20} />
            Recent Actions
          </h2>
          <RecentActions />
        </section>
      </div>
    </div>
  );
};
