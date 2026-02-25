import React, { useEffect, useState, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  Edit3,
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
    <path
      d="M127.962 0L0 212.32L127.962 287.959V154.158V0Z"
      fill="#8C9FEF"
    />
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
    <path
      d="M0 212.32L127.962 287.958V154.159L0 212.32Z"
      fill="#687BDE"
    />
  </svg>
);

// =============================================================================
// Wallet Overview Section
// =============================================================================

const WalletOverview: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setIsLoading(true);
    try {
      // Check if wallet exists
      const existsResult = await window.electronAPI?.trading?.walletExists() as any;
      const exists = existsResult?.exists ?? existsResult?.data?.exists ?? false;
      if (exists) {
        setHasWallet(true);
        // Get the address
        const addrResult = await window.electronAPI?.web3?.getAddress();
        if (addrResult?.success && addrResult?.data?.address) {
          setWalletAddress(addrResult.data.address);
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

  return (
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
              href={`https://etherscan.io/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="View on Etherscan"
              onClick={(e) => {
                e.preventDefault();
                // Open in a new browser view/window
                window.open(
                  `https://etherscan.io/address/${walletAddress}`,
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
          <p className="text-xs text-gray-500 font-mono break-all select-all">
            {walletAddress}
          </p>
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
  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkWallet();
  }, []);

  const checkWallet = async () => {
    if (window.electronAPI?.trading?.walletExists) {
      const result = await window.electronAPI.trading.walletExists() as any;
      setHasWallet(result.exists || result?.data?.exists || false);
    }
  };

  const handleSave = async () => {
    if (!privateKey) return;
    setIsSaving(true);
    if (window.electronAPI?.trading?.saveWallet) {
      const result = await window.electronAPI.trading.saveWallet(privateKey);
      if (result.success) {
        toast.success("Private key saved securely.");
        setPrivateKey("");
        setHasWallet(true);
        onWalletChanged();
      } else {
        toast.error("Failed to save wallet.");
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete the wallet? This cannot be undone.",
      )
    ) {
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
              <p className="text-emerald-400 font-medium">
                Private Key Stored
              </p>
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
          <label className="block">
            <span className="text-sm text-gray-400 mb-1 block">
              Private Key (0x...)
            </span>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full px-4 py-2 pr-10 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                placeholder="0x..."
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <button
            onClick={handleSave}
            disabled={!privateKey || isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Private Key
          </button>
        </div>
      )}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.web3?.getContacts();
      if (result?.success && typeof result.data === "string") {
        // Parse the text response to extract contacts
        // The tool returns formatted text, so we need to fetch raw data
        // Actually, let's use the IPC directly to get raw contacts
        // For now, re-fetch from the address book file via a workaround
        // We'll parse the "• Name: Address" format
        const lines = result.data.split("\n").filter((l: string) => l.startsWith("•"));
        const parsed: WalletContact[] = lines.map((line: string, i: number) => {
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
        }).filter(Boolean) as WalletContact[];
        setContacts(parsed);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error("Failed to load contacts:", error);
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
    if (
      !window.confirm(
        `Delete contact "${contact.name}"?`,
      )
    )
      return;
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
        these by name in the chat (e.g. "send 10 USDC to John").
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
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 text-sm"
              placeholder="e.g. John, My Exchange, DAO Treasury"
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
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
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
              className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newAddress.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1.5"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-gray-800 rounded-lg transition-all text-sm w-full justify-center"
        >
          <Plus size={16} />
          Add Contact
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
    // Load from localStorage
    try {
      const stored = localStorage.getItem("web3_recent_actions");
      if (stored) {
        setActions(JSON.parse(stored));
      }
    } catch {
      // ignore
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
            className={`w-2 h-2 rounded-full shrink-0 ${
              action.success ? "bg-emerald-500" : "bg-red-500"
            }`}
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
  const [walletKey, setWalletKey] = useState(0); // Force re-render key

  const handleWalletChanged = () => {
    setWalletKey((k) => k + 1);
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
          <WalletOverview key={`overview-${walletKey}`} />
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

      <ToastContainer theme="dark" />
    </div>
  );
};
