import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, CheckCircle, Zap, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Eye, EyeOff, Copy, ExternalLink, AlertCircle, Search, ChevronDown,
  Shield, Unlink, Plus, Loader, Activity, Clock
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────

interface OneAmAsset {
  policyId: string;
  assetName: string;
  quantity: number;
}

interface OneAmBalance {
  lovelace: number;
  nightTokens: number;
  dustTokens: number;
  assets: OneAmAsset[];
  shieldedTokens?: number;
  unshieldedTokens?: number;
  cardanoAda?: number;
}

interface OneAmAgentWallet {
  agentId: string;
  agentName: string;
  delegated: boolean;
  permissions: string[];
}

interface OneAmTx {
  txHash: string;
  timestamp: string;
  method: 'Sent' | 'Received' | 'Generate Dust' | 'Agent Tx' | string;
  chain: string;
  token: string;
  amount: string;
  fee: string;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
}

interface OneAmWalletCardProps {
  connected: boolean;
  address: string | null;
  network: string | null;
  balance: OneAmBalance | null;
  agentWallets: OneAmAgentWallet[];
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onGenerateDust: () => void;
  onSend: () => void;
  onReceive: () => void;
  onYourDust: () => void;
  onCreateAgentWallet: (agentId: string, agentName: string) => void;
  showNotification: (type: 'info' | 'success' | 'error', message: string) => void;
}

// ─── Koios API ───────────────────────────────────────────────────

const KOIOS_BASE = 'https://api.koios.rest/api/v1';

async function koiosGet(endpoint: string): Promise<any> {
  const url = `${KOIOS_BASE}${endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Koios ${endpoint}: HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchTxHistory(address: string): Promise<OneAmTx[]> {
  try {
    // Query address transactions via Koios
    const data = await koiosGet(`/address_txs?address=${encodeURIComponent(address)}&limit=50`);
    if (!Array.isArray(data)) return [];

    return data.map((tx: any, idx: number) => {
      const isOutgoing = tx.out_sum !== undefined;
      const date = tx.block_time ? new Date(tx.block_time * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }) : 'Unknown';

      return {
        txHash: tx.tx_hash || `tx-${idx}`,
        timestamp: date,
        method: isOutgoing ? 'Sent' : 'Received',
        chain: 'CARDANO',
        token: tx.asset_name || 'ADA',
        amount: isOutgoing ? `-${tx.out_sum || 0} ADA` : `+${tx.in_sum || 0} ADA`,
        fee: `${tx.fee ? (tx.fee / 1_000_000).toFixed(4) : '0.0000'} ADA`,
        status: 'CONFIRMED',
      };
    });
  } catch (e) {
    console.warn('Koios tx history failed:', e);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

const shorten = (addr: string) => addr ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : '';

const formatAda = (lovelace: number) => {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(2)}K`;
  return ada.toFixed(2);
};

// ─── Component ───────────────────────────────────────────────────

export const OneAmWalletCard: React.FC<OneAmWalletCardProps> = ({
  connected, address, network, balance, agentWallets,
  isConnecting, onConnect, onDisconnect, onGenerateDust,
  onSend, onReceive, onYourDust, onCreateAgentWallet,
  showNotification,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'assets' | 'nfts' | 'transactions' | 'apps'>('transactions');
  const [hideShielded, setHideShielded] = useState(false);
  const [hideUnshielded, setHideUnshielded] = useState(false);
  const [hideCardano, setHideCardano] = useState(false);
  const [txHistory, setTxHistory] = useState<OneAmTx[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentForm, setAgentForm] = useState({ id: '', name: '' });

  // Fetch tx history when connected
  useEffect(() => {
    if (!connected || !address) { setTxHistory([]); return; }
    setTxLoading(true);
    fetchTxHistory(address)
      .then(setTxHistory)
      .finally(() => setTxLoading(false));
  }, [connected, address]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    showNotification('success', 'Address copied to clipboard');
  }, [address, showNotification]);

  const filteredTx = txHistory.filter(tx =>
    txSearch === '' ||
    tx.txHash.toLowerCase().includes(txSearch.toLowerCase()) ||
    tx.method.toLowerCase().includes(txSearch.toLowerCase()) ||
    tx.token.toLowerCase().includes(txSearch.toLowerCase())
  );

  // ── Not Connected State ────────────────────────────────────────
  if (!connected) {
    return (
      <div className="rounded-xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-pink-900/40 border border-indigo-500/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Wallet size={20} className="text-indigo-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">1AM Wallet</h4>
              <p className="text-xs text-gray-400">Midnight Network — NIGHT · DUST · Agent Identity</p>
            </div>
          </div>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isConnecting ? <Loader size={16} className="animate-spin" /> : <Zap size={16} />}
            {isConnecting ? 'Connecting...' : 'Connect 1AM'}
          </button>
        </div>

        {/* Placeholder cards */}
        <div className="p-4 grid grid-cols-3 gap-3">
          {['Shielded Holdings', 'Unshielded Balance', 'Cardano Balance'].map((label, i) => (
            <div key={label} className="rounded-lg bg-gray-900/40 border border-gray-700/30 p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</div>
              <div className="text-2xl font-bold text-gray-600">—</div>
              <div className="text-xs text-gray-600 mt-1">Connect to view</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Connected Dashboard ───────────────────────────────────────
  return (
    <div className="rounded-xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 overflow-hidden shadow-2xl">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-900/80">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Wallet size={16} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">1AM</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30">MAINNET</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-400">
                <CheckCircle size={10} className="text-green-400" /> SYNCED
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-500">DUST: {(balance?.dustTokens || 0).toLocaleString()}</span>
              <span className="text-[10px] text-green-400">● DUST SPONSORED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Address + Copy */}
          <button onClick={copyAddress} className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 hover:text-white transition-colors">
            <span className="font-mono">{shorten(address || '')}</span>
            <Copy size={12} />
          </button>
          {/* Disconnect */}
          <button
            onClick={onDisconnect}
            className="p-1.5 rounded bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <Unlink size={14} />
          </button>
        </div>
      </div>

      {/* ═══ BALANCE CARDS ═══ */}
      <div className="grid grid-cols-3 divide-x divide-gray-700/30 border-b border-gray-700/30">
        {/* Shielded */}
        <div className="p-4 bg-gradient-to-br from-gray-900/60 to-gray-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Shield size={12} className="text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Shielded Holdings</span>
            </div>
            <button onClick={() => setHideShielded(!hideShielded)} className="text-gray-500 hover:text-gray-300">
              {hideShielded ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {hideShielded ? '****' : (balance?.shieldedTokens || 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Shielded tokens in this wallet</div>
        </div>

        {/* Unshielded */}
        <div className="p-4 bg-gradient-to-br from-gray-900/60 to-gray-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Unshielded Balance</span>
            </div>
            <button onClick={() => setHideUnshielded(!hideUnshielded)} className="text-gray-500 hover:text-gray-300">
              {hideUnshielded ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {hideUnshielded ? '****' : (balance?.unshieldedTokens || balance?.nightTokens || 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Sum of all unshielded NIGHT tokens · + {(balance?.assets?.length || 0)} asset(s) in Assets / NFTs
          </div>
        </div>

        {/* Cardano */}
        <div className="p-4 bg-gradient-to-br from-gray-900/60 to-gray-800/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-gray-500" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Cardano Balance</span>
            </div>
            <button onClick={() => setHideCardano(!hideCardano)} className="text-gray-500 hover:text-gray-300">
              {hideCardano ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <div className="text-3xl font-bold text-white tracking-tight">
            {hideCardano ? '****' : formatAda(balance?.lovelace || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ADA: {((balance?.lovelace || 0) / 1_000_000).toFixed(2)}
          </div>
          {/* Generate Dust button */}
          <button
            onClick={onGenerateDust}
            className="mt-3 w-full py-2 rounded border border-gray-600 hover:border-amber-500/50 bg-gray-800/50 hover:bg-amber-500/10 text-xs text-gray-300 hover:text-amber-400 transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw size={12} />
            GENERATE DUST
          </button>
        </div>
      </div>

      {/* ═══ ACTION BAR ═══ */}
      <div className="grid grid-cols-3 divide-x divide-gray-700/30 border-b border-gray-700/30">
        <button onClick={onSend} className="py-4 flex flex-col items-center gap-1.5 hover:bg-gray-800/50 transition-colors group">
          <ArrowUpRight size={20} className="text-gray-400 group-hover:text-indigo-400" />
          <span className="text-xs text-gray-400 group-hover:text-white font-medium">SEND</span>
        </button>
        <button onClick={onReceive} className="py-4 flex flex-col items-center gap-1.5 hover:bg-gray-800/50 transition-colors group">
          <ArrowDownLeft size={20} className="text-gray-400 group-hover:text-green-400" />
          <span className="text-xs text-gray-400 group-hover:text-white font-medium">RECEIVE</span>
        </button>
        <button onClick={onYourDust} className="py-4 flex flex-col items-center gap-1.5 hover:bg-gray-800/50 transition-colors group">
          <RefreshCw size={20} className="text-gray-400 group-hover:text-amber-400" />
          <span className="text-xs text-gray-400 group-hover:text-white font-medium">YOUR DUST</span>
        </button>
      </div>

      {/* ═══ SUB TABS ═══ */}
      <div className="flex items-center border-b border-gray-700/30 bg-gray-900/40">
        {([
          { id: 'assets' as const, label: 'ASSETS' },
          { id: 'nfts' as const, label: 'NFTs' },
          { id: 'transactions' as const, label: 'TRANSACTIONS' },
          { id: 'apps' as const, label: 'APPS' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold tracking-wider transition-colors border-b-2 ${
              activeSubTab === tab.id
                ? 'text-white border-indigo-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="p-4 min-h-[200px]">
        {/* ── Assets Tab ── */}
        {activeSubTab === 'assets' && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Tokens & Assets</div>
            {balance?.assets && balance.assets.length > 0 ? (
              <div className="space-y-1.5">
                {balance.assets.map((a, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-gray-800/40 border border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-[10px] text-indigo-400 font-mono">
                        {a.assetName?.slice(0, 2) || 'TK'}
                      </div>
                      <div>
                        <div className="text-xs text-white">{a.assetName || a.policyId.slice(0, 8)}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{a.policyId.slice(0, 16)}...</div>
                      </div>
                    </div>
                    <div className="text-xs text-white font-medium">×{a.quantity.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">No assets found</div>
            )}
          </div>
        )}

        {/* ── NFTs Tab ── */}
        {activeSubTab === 'nfts' && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="w-12 h-12 rounded-full bg-gray-800 mx-auto mb-3 flex items-center justify-center">
              <Shield size={20} className="text-gray-600" />
            </div>
            No NFTs in this wallet
          </div>
        )}

        {/* ── Transactions Tab ── */}
        {activeSubTab === 'transactions' && (
          <div>
            {/* Search */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by hash, method, token..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/30 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-700/30">
              <div className="col-span-5">Transaction</div>
              <div className="col-span-3">Method</div>
              <div className="col-span-2 text-right">Status</div>
              <div className="col-span-2 text-right">Amount / Fee</div>
            </div>

            {/* Tx list */}
            {txLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-500 text-sm">
                <Loader size={16} className="animate-spin" />
                Loading transactions from Koios...
              </div>
            ) : filteredTx.length > 0 ? (
              <div className="space-y-0">
                {filteredTx.map(tx => (
                  <div
                    key={tx.txHash}
                    className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-gray-800/30 transition-colors border-b border-gray-800/30 items-center"
                  >
                    {/* Transaction */}
                    <div className="col-span-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center">
                          <Clock size={12} className="text-gray-500" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-300">{tx.timestamp}</div>
                          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                            {tx.txHash.slice(0, 18)}...
                            <button onClick={() => { navigator.clipboard.writeText(tx.txHash); showNotification('success', 'Hash copied'); }}>
                              <Copy size={10} className="hover:text-gray-300" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Method */}
                    <div className="col-span-3 flex items-center gap-1.5">
                      <span className={`text-xs font-medium ${tx.method === 'Sent' ? 'text-red-400' : tx.method === 'Received' ? 'text-green-400' : 'text-gray-300'}`}>
                        {tx.method}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-800 text-gray-400 border border-gray-700">{tx.chain}</span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        tx.status === 'CONFIRMED'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : tx.status === 'PENDING'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}>
                        {tx.status}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="col-span-2 text-right">
                      <div className={`text-xs font-medium ${tx.amount.startsWith('-') ? 'text-red-400' : 'text-green-400'}`}>
                        {tx.amount}
                      </div>
                      <div className="text-[10px] text-gray-500">fee: {tx.fee}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                {txSearch ? 'No transactions match your search' : 'No transactions found for this address'}
              </div>
            )}
          </div>
        )}

        {/* ── Apps Tab ── */}
        {activeSubTab === 'apps' && (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="w-12 h-12 rounded-full bg-gray-800 mx-auto mb-3 flex items-center justify-center">
              <Zap size={20} className="text-gray-600" />
            </div>
            No connected apps
          </div>
        )}
      </div>

      {/* ═══ AGENT WALLETS ═══ */}
      {agentWallets.length > 0 && (
        <div className="border-t border-gray-700/30 p-4 bg-gray-900/40">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent Wallets ({agentWallets.length})</h5>
            <button
              onClick={() => setShowAgentModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-[10px] transition-colors"
            >
              <Plus size={10} /> Add Agent
            </button>
          </div>
          <div className="space-y-1.5">
            {agentWallets.map(aw => (
              <div key={aw.agentId} className="flex items-center justify-between px-3 py-2 rounded bg-gray-800/40 border border-gray-700/20">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${aw.delegated ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <span className="text-xs text-gray-300 font-medium">{aw.agentName}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{aw.agentId.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                    aw.delegated
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {aw.delegated ? 'Delegated' : 'Read-only'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {aw.permissions.slice(0, 2).join(', ')}
                    {aw.permissions.length > 2 && ` +${aw.permissions.length - 2}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ADD AGENT MODAL ═══ */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-4">Create Agent Wallet</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Agent ID</label>
                <input
                  type="text"
                  value={agentForm.id}
                  onChange={e => setAgentForm(f => ({ ...f, id: e.target.value }))}
                  placeholder="e.g. agent-001"
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Agent Name</label>
                <input
                  type="text"
                  value={agentForm.name}
                  onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Trading Bot Alpha"
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAgentModal(false)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (agentForm.id && agentForm.name) {
                    onCreateAgentWallet(agentForm.id, agentForm.name);
                    setAgentForm({ id: '', name: '' });
                    setShowAgentModal(false);
                    showNotification('success', `Agent wallet created for ${agentForm.name}`);
                  }
                }}
                disabled={!agentForm.id || !agentForm.name}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OneAmWalletCard;
