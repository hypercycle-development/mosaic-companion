// ============================================
// 1AM WALLET SERVICE — Webview Bridge Edition
// Midnight Network DApp Connector via Electron webview
// ============================================
//
// IMPORTANT: Browser wallet extensions (1AM Wallet) CANNOT inject into
// Electron's main renderer window. They only inject into actual web
// pages loaded via <webview> or BrowserView.
//
// Architecture:
//   Renderer (React) <--postMessage-->  Webview (loads bridge HTML)
//                                      <--injected API-->  1AM Extension
//
// The bridge HTML is bundled into the app. A hidden webview element
// loads the bridge, which detects window.oneam and proxies all calls.

// ============================================
// TYPES
// ============================================

export type OneAmNetwork = 'preview' | 'preprod' | 'mainnet';

export interface OneAmWalletInfo {
  walletName: string;
  displayName: string;
  version?: string;
}

export interface OneAmAsset {
  policyId: string;
  assetName: string;
  quantity: number;
  decimals?: number;
}

export interface OneAmBalance {
  lovelace: number;
  nightTokens: number;
  dustTokens: number;
  shieldedTokens: number;
  unshieldedTokens: number;
  cardanoAda: number;
  assets: OneAmAsset[];
}

export interface OneAmSession {
  connected: boolean;
  address: string | null;
  network: OneAmNetwork | null;
  balance: OneAmBalance | null;
  assets: OneAmAsset[];
  connectedAt: number | null;
}

export interface OneAmAgentWallet {
  agentId: string;
  agentName: string;
  address: string | null;
  delegated: boolean;
  permissions: string[];
  nightBalance: number;
  dustBalance: number;
}

// ============================================
// BRIDGE HTML (injected into webview)
// ============================================

const BRIDGE_HTML = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>1AM Bridge</title>
<script>
let api = null;
function post(type, payload) {
  if (window.opener) window.opener.postMessage({source:'1am-bridge',type,payload},'*');
  try { const {ipcRenderer} = require('electron'); ipcRenderer.sendToHost('1am-bridge',{type,payload}); } catch(e){}
}
async function cmdDetect() {
  const p = window.oneam || window.midnight;
  post(p ? 'detected' : 'not-detected', p ? {name:'1AM Wallet',is1AM:!!p.is1AM} : {});
}
async function cmdConnect() {
  try {
    const provider = window.oneam || window.midnight;
    if (!provider) { post('connect-error',{error:'Wallet not detected'}); return; }
    api = await provider.enable();
    let address = null;
    let addressError = null;
    try {
      const addrs = await api.getUsedAddresses();
      address = addrs?.[0] || null;
    } catch (e) { addressError = e.message || String(e); }
    const network = await api.getNetworkId().catch(()=>'unknown');
    post('connected',{address,network,addressError});
  } catch(err) { post('connect-error',{error:err.message||'Failed'}); }
}
async function cmdFetch() {
  if (!api) { post('data-error',{error:'Not connected'}); return; }
  try {
    const bal = await api.getBalance();
    let night=0,dust=0;
    try{night=await api.getNightBalance()}catch(e){}
    try{dust=await api.getDustBalance()}catch(e){}
    post('data',{lovelace:bal.lovelace||0,night,dust,assets:bal.tokens||[]});
  } catch(err) { post('data-error',{error:err.message}); }
}
async function cmdSign(txHex,partial){ if(!api){post('sign-error',{error:'Not connected'});return;} try{const s=await api.signTx(txHex,partial);post('signed',{signedTx:s});}catch(err){post('sign-error',{error:err.message});} }
async function cmdSubmit(txHex){ if(!api){post('submit-error',{error:'Not connected'});return;} try{const h=await api.submitTx(txHex);post('submitted',{txHash:h});}catch(err){post('submit-error',{error:err.message});} }
window.addEventListener('message',(e)=>{
  const d=e.data; if(!d||d.source!=='1am-parent')return;
  switch(d.command){ case'detect':cmdDetect();break; case'connect':cmdConnect();break; case'disconnect':api=null;post('disconnected',{});break; case'fetchData':cmdFetch();break; case'signTx':cmdSign(d.txHex,d.partialSign);break; case'submitTx':cmdSubmit(d.txHex);break; }
});
window.addEventListener('DOMContentLoaded',()=>setTimeout(cmdDetect,500));
</script></body></body></html>
`;

// ============================================
// SERVICE CLASS
// ============================================

class OneAmWalletService {
  private session: OneAmSession = {
    connected: false,
    address: null,
    network: null,
    balance: null,
    assets: [],
    connectedAt: null,
  };

  private bridgeWindow: Window | null = null;
  private bridgeReady = false;
  private pendingCommands: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private agentWallets = new Map<string, OneAmAgentWallet>();
  private listeners: Array<(s: OneAmSession) => void> = [];

  // --- Bridge Lifecycle ---

  /**
   * Create and inject the bridge into the page.
   * Call this once from a React useEffect in AdaPortalPanel.
   */
  mountBridge(container: HTMLElement | null): boolean {
    if (!container) return false;
    if (this.bridgeWindow) return true;

    // Create a hidden iframe that loads the bridge HTML
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:none;';
    iframe.srcdoc = BRIDGE_HTML;

    container.appendChild(iframe);

    // Wait for bridge to be ready
    return new Promise((resolve) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.source !== '1am-bridge') return;
        this.bridgeWindow = iframe.contentWindow;
        this.bridgeReady = true;
        window.removeEventListener('message', onMessage);
        resolve(true);
      };
      window.addEventListener('message', onMessage);
      setTimeout(() => {
        if (!this.bridgeReady) {
          window.removeEventListener('message', onMessage);
          resolve(false);
        }
      }, 3000);
    }) as any;
  }

  /**
   * Send a command to the bridge and await response
   */
  private sendCommand(command: string, args?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.bridgeWindow) {
        reject(new Error('Bridge not mounted'));
        return;
      }

      const id = `${command}_${Date.now()}_${Math.random()}`;
      const handler = (e: MessageEvent) => {
        const data = e.data;
        if (!data || data.source !== '1am-bridge' || data._id !== id) return;
        window.removeEventListener('message', handler);
        if (data.type?.endsWith('-error')) {
          reject(new Error(data.payload?.error || 'Bridge error'));
        } else {
          resolve(data.payload);
        }
      };

      window.addEventListener('message', handler);
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Bridge command timeout'));
      }, 15000);

      this.bridgeWindow.postMessage(
        { source: '1am-parent', command, ...args, _id: id },
        '*'
      );
    });
  }

  // --- Public API ---

  async detect(): Promise<OneAmWalletInfo | null> {
    try {
      const result = await this.sendCommand('detect');
      if (result?.name) {
        return { walletName: 'oneam', displayName: result.name, version: result.version };
      }
      return null;
    } catch {
      return null;
    }
  }

  isAvailable(): boolean {
    return this.bridgeReady;
  }

  async connect(): Promise<{ success: boolean; error?: string; session?: OneAmSession }> {
    try {
      const result = await this.sendCommand('connect');
      // 1AM may connect successfully but refuse to expose addresses (code -2).
      // We still treat it as connected so the UI reflects the real wallet state.
      this.session = {
        connected: true,
        address: result?.address || null,
        network: this.parseNetwork(result?.network),
        balance: null,
        assets: [],
        connectedAt: Date.now(),
      };
      await this.fetchWalletData();
      this.notifyListeners();
      return { success: true, session: this.session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  disconnect(): void {
    this.sendCommand('disconnect').catch(() => {});
    this.session = {
      connected: false,
      address: null,
      network: null,
      balance: null,
      assets: [],
      connectedAt: null,
    };
    this.notifyListeners();
  }

  async fetchWalletData(): Promise<{ success: boolean; error?: string }> {
    if (!this.session.connected) return { success: false, error: 'Not connected' };
    try {
      const data = await this.sendCommand('fetchData');
      this.session.balance = {
        lovelace: data.lovelace || 0,
        nightTokens: data.night || 0,
        dustTokens: data.dust || 0,
        shieldedTokens: data.shieldedTokens || 0,
        unshieldedTokens: data.unshieldedTokens || 0,
        cardanoAda: data.cardanoAda || 0,
        assets: (data.assets || []).map((a: any) => ({
          policyId: a.policyId,
          assetName: a.assetName,
          quantity: a.quantity,
        })),
      };
      this.session.assets = this.session.balance.assets;
      this.notifyListeners();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async signTx(txHex: string, partialSign = false): Promise<{ success: boolean; signedTx?: string; error?: string }> {
    if (!this.session.connected) return { success: false, error: 'Not connected' };
    try {
      const result = await this.sendCommand('signTx', { txHex, partialSign });
      return { success: true, signedTx: result.signedTx };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async submitTx(txHex: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (!this.session.connected) return { success: false, error: 'Not connected' };
    try {
      const result = await this.sendCommand('submitTx', { txHex });
      return { success: true, txHash: result.txHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // --- Agent Wallets ---

  createAgentWallet(agentId: string, agentName: string): OneAmAgentWallet {
    const wallet: OneAmAgentWallet = {
      agentId,
      agentName,
      address: this.session.address,
      delegated: false,
      permissions: ['read'],
      nightBalance: 0,
      dustBalance: 0,
    };
    this.agentWallets.set(agentId, wallet);
    return wallet;
  }

  delegateAgent(agentId: string, permissions: string[]): boolean {
    const wallet = this.agentWallets.get(agentId);
    if (!wallet) return false;
    wallet.delegated = true;
    wallet.permissions = permissions;
    return true;
  }

  revokeAgent(agentId: string): boolean {
    const wallet = this.agentWallets.get(agentId);
    if (!wallet) return false;
    wallet.delegated = false;
    wallet.permissions = [];
    return true;
  }

  getAgentWallets(): OneAmAgentWallet[] {
    return Array.from(this.agentWallets.values());
  }

  getSession(): OneAmSession {
    return { ...this.session };
  }

  // --- Dust Generation ---

  async generateDust(): Promise<{ success: boolean; dustAmount?: number; txHash?: string; error?: string }> {
    if (!this.session.connected) return { success: false, error: 'Not connected' };
    try {
      const result = await this.sendCommand('generateDust');
      // Refresh balance after generation
      await this.fetchWalletData();
      return {
        success: true,
        dustAmount: result.dustAmount || 0,
        txHash: result.txHash,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // --- Transaction History via Koios ---

  async getTransactions(address?: string): Promise<Array<{
    txHash: string;
    timestamp: string;
    method: string;
    chain: string;
    token: string;
    amount: string;
    fee: string;
    status: string;
  }>> {
    const addr = address || this.session.address;
    if (!addr) return [];
    try {
      const data = await this.koiosGet(`/address_txs?address=${encodeURIComponent(addr)}&limit=50`);
      if (!Array.isArray(data)) return [];
      return data.map((tx: any) => {
        const isOutgoing = tx.out_sum !== undefined && tx.out_sum > 0;
        const date = tx.block_time
          ? new Date(tx.block_time * 1000).toLocaleDateString('en-US', {
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit',
            })
          : 'Unknown';
        return {
          txHash: tx.tx_hash || 'unknown',
          timestamp: date,
          method: isOutgoing ? 'Sent' : 'Received',
          chain: 'CARDANO',
          token: tx.asset_name || 'ADA',
          amount: isOutgoing
            ? `-${tx.out_sum || 0} ADA`
            : `+${tx.in_sum || 0} ADA`,
          fee: `${tx.fee ? (tx.fee / 1_000_000).toFixed(4) : '0.0000'} ADA`,
          status: 'CONFIRMED',
        };
      });
    } catch (e: any) {
      console.warn('[1AM] Koios tx query failed:', e.message);
      return [];
    }
  }

  private async koiosGet(endpoint: string): Promise<any> {
    const KOIOS_BASE = 'https://api.koios.rest/api/v1';
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

  onSessionChange(cb: (s: OneAmSession) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const i = this.listeners.indexOf(cb);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  private notifyListeners() {
    for (const cb of this.listeners) {
      try { cb(this.getSession()); } catch (e) { console.error('[1AM] listener error:', e); }
    }
  }

  private parseNetwork(id: string): OneAmNetwork {
    if (id === '1' || id === 'mainnet') return 'mainnet';
    if (id === '0' || id === 'preview') return 'preview';
    if (id === 'preprod') return 'preprod';
    return 'preview';
  }
}

export const oneAmWallet = new OneAmWalletService();
