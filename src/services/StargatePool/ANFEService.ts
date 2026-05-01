// @ts-nocheck
// =============================================================================
// STARGATE POOL - ANFE Service
// HyperInsight-first + On-chain Verification (ERC-721)
// =============================================================================

import { WalletState, walletAdapter } from './WalletAdapter';
import {
  ANFE,
  ANFEAttributes,
  SupportedChain,
  CHAIN_NAMES,
  parseAttributes,
  WalletANFEs,
} from './ANFETypes';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RPC_CONFIG: Record<SupportedChain, string> = {
  1:    import.meta.env.VITE_RPC_ETHEREUM || 'https://eth.llamarpc.com',
  8453: import.meta.env.VITE_RPC_BASE     || 'https://mainnet.base.org',
};

const RPC_FALLBACKS: Record<SupportedChain, string[]> = {
  1:    ['https://1rpc.io/eth', 'https://rpc.ankr.com/eth'],
  8453: ['https://base.llamarpc.com', 'https://1rpc.io/base'],
};

const ANFE_CONTRACTS: Record<SupportedChain, string> = {
  1:    import.meta.env.VITE_ANFE_CONTRACT_ETHEREUM || '',
  8453: import.meta.env.VITE_ANFE_CONTRACT_BASE  || '0x8c0075D087de9588DdF5c1441dF39828d695bc2f',
};

// ERC-721 Transfer topic — keccak256('Transfer(address,address,uint256)')
const ERC721_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// HyperInsight API
const HI_BASE   = 'https://api.hyperinsight.app/v1';
const HI_KEY    = 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk';
const HI_HEADERS = {
  'Authorization': `Bearer ${HI_KEY}`,
  'Accept': 'application/json',
};

function padAddr(addr: string): string {
  return '0x' + addr.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

function strip0x(s: string): string {
  return s.replace(/^0x/i, '');
}

// ---------------------------------------------------------------------------
// HyperInsight direct fetch helpers (renderer-side; key already in codebase)
// ---------------------------------------------------------------------------
async function hiFetch(path: string): Promise<any | null> {
  try {
    const r = await fetch(`${HI_BASE}${path}`, { headers: HI_HEADERS });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn('[ANFEService] HyperInsight fetch error:', path, e);
    return null;
  }
}

async function hiNode(license: string): Promise<any | null> {
  return hiFetch(`/nodes/${license}`);
}

async function hiNodesByWallet(walletAddress: string): Promise<any[]> {
  try {
    const cleanWallet = walletAddress.toLowerCase();
    const r = await fetch(`${HI_BASE}/nodes?wallet=${cleanWallet}`, { headers: HI_HEADERS });
    if (!r.ok) return [];
    const json = await r.json();
    if (json.data && Array.isArray(json.data)) return json.data;
    if (Array.isArray(json)) return json;
    return [];
  } catch (e) {
    console.warn('[ANFEService] HyperInsight wallet fetch error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// ANFE Service
// ---------------------------------------------------------------------------
class ANFEService {
  private walletANFEsCache: Map<string, WalletANFEs> = new Map();
  private anfeCache:      Map<string, ANFE>         = new Map();
  private pollInterval:   number | null              = null;

  async connectWallet(): Promise<string> {
    return walletAdapter.connect();
  }
  getWalletState(): WalletState {
    return walletAdapter.getState();
  }
  isWalletConnected(): boolean {
    return walletAdapter.isConnected();
  }

  /** Main entry: load ANFEs for a wallet */
  async loadWalletANFEs(walletAddress: string): Promise<WalletANFEs> {
    const cached = this.walletANFEsCache.get(walletAddress);
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      console.log('[ANFEService] Returning cached ANFEs');
      return cached;
    }

    console.log('[ANFEService] Loading ANFEs for:', walletAddress.slice(0, 8) + '...');
    let anfes: ANFE[] = [];
    const contract = ANFE_CONTRACTS[8453];

    // --- PRIMARY: Known ANFE IDs from HyperInsight ---
    // HyperInsight /nodes/{licenseKey} knows these tokenIDs even if
    // /nodes?wallet returns a different license namespace.
    const knownTokenIds = [
      '2324779898006116',
      '2324779898048044',
    ];

    if (contract) {
      for (const tokenId of knownTokenIds) {
        try {
          const owner = await this.ownerOf(contract, tokenId, 8453);
          if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) {
            console.log(`[ANFEService] Token ${tokenId} owner mismatch or not found`);
            continue;
          }
          console.log(`[ANFEService] Owner match for token ${tokenId}`);
          const anfe = await this.buildANFE(contract, tokenId, 8453, walletAddress);
          anfes.push(anfe);
        } catch (e) {
          console.warn(`[ANFEService] Failed to verify token ${tokenId}:`, e);
        }
      }
    }

    // --- SECONDARY: HyperInsight /nodes?wallet (for CHyPCe compute nodes) ---
    if (anfes.length === 0) {
      try {
        const hiNodes = await hiNodesByWallet(walletAddress);
        if (hiNodes.length > 0) {
          console.log(`[ANFEService] HyperInsight found ${hiNodes.length} nodes for wallet`);
          // These are compute nodes; map to ANFEs if possible
          for (const node of hiNodes) {
            const licenseKey = String(node.licenseKey || '');
            if (!licenseKey) continue;
            // Check if this license corresponds to an ANFE token
            const isKnown = knownTokenIds.some(id => id === licenseKey);
            if (!isKnown) {
              // Try to verify on-chain anyway
              const owner = contract ? await this.ownerOf(contract, licenseKey, 8453).catch(() => null) : null;
              if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) continue;
            }
            const anfe = await this.buildANFE(contract || ANFE_CONTRACTS[8453] || '', licenseKey, 8453, walletAddress);
            if (!anfes.find(a => a.tokenId === licenseKey)) anfes.push(anfe);
          }
        }
      } catch (e) {
        console.warn('[ANFEService] HyperInsight wallet lookup failed:', e);
      }
    }

    // --- TERTIARY: ERC-721 event-log discovery (for any unknown ANFEs) ---
    if (anfes.length === 0 && contract) {
      try {
        const logANFEs = await this.discoverANFEsViaEventLogs(walletAddress, 8453);
        if (logANFEs.length) anfes.push(...logANFEs);
      } catch (e) {
        console.warn('[ANFEService] Event log discovery failed:', e);
      }
    }

    const byChain: Record<SupportedChain, ANFE[]> = {
      1:    anfes.filter(a => a.chainId === 1),
      8453: anfes.filter(a => a.chainId === 8453),
    };

    const result: WalletANFEs = {
      address: walletAddress,
      anfes,
      totalCount: anfes.length,
      fetchedAt: Date.now(),
      byChain,
    };
    this.walletANFEsCache.set(walletAddress, result);
    console.log(`[ANFEService] Loaded ${anfes.length} ANFEs total`);
    return result;
  }

  // ========================================================================
  // BUILD ANFE (ERC-721 compatible)
  // ========================================================================
  private async buildANFE(contract: string, tokenId: string, chainId: SupportedChain, walletAddress: string): Promise<ANFE> {
    const attributes = await this.fetchAttributes(contract, tokenId, chainId);
    const nodeData = await hiNode(tokenId);

    const verification: any = {
      valid: true,
      anfeId: `${contract}:${tokenId}`,
      lastUpdated: Date.now(),
      status:       nodeData?.isAlive ? 'online' : 'offline',
      nodeFactoryId: nodeData?.licenseKey ? String(nodeData.licenseKey) : undefined,
      tranche:       nodeData?.network   || 'BASE',
      uptime:        nodeData?.measuredUptime ?? nodeData?.uptimePercent ?? null,
      reliability:   nodeData?.measuredUptime ?? null,
      registeredAt:  nodeData?.lastContactAt ? new Date(nodeData.lastContactAt).getTime() : undefined,
      lastVerified:  Date.now(),
    };

    return {
      id: `${contract}:${tokenId}`,
      tokenId,
      contractAddress: contract,
      owner: walletAddress,
      chainId,
      chainName: CHAIN_NAMES[chainId],
      blockNumber: 0,
      blockTimestamp: Date.now(),
      transactionHash: '',
      attributes,
      verification,
    };
  }

  // ========================================================================
  // ERC-721 ownerOf(uint256) => address
  // ========================================================================
  private async ownerOf(contract: string, tokenId: string, chainId: SupportedChain): Promise<string | null> {
    // selector for ownerOf(uint256) = 0x6352211e
    const data = '0x6352211e' + BigInt(tokenId).toString(16).padStart(64, '0');
    const result = await this.callContract(contract, data, chainId);
    if (!result || result === '0x' || result.length < 42) return null;
    // Result is a 32-byte padded address
    const addr = '0x' + strip0x(result).slice(-40);
    if (addr === '0x0000000000000000000000000000000000000000') return null;
    return addr;
  }

  // ========================================================================
  // ERC-721 event-log discovery (Transfer events)
  // ========================================================================
  private async discoverANFEsViaEventLogs(
    walletAddress: string,
    chainId: SupportedChain
  ): Promise<ANFE[]> {
    const contract = ANFE_CONTRACTS[chainId];
    const walletPad = padAddr(walletAddress);
    const rpcUrls = [RPC_CONFIG[chainId], ...(RPC_FALLBACKS[chainId] || [])];

    for (const rpcUrl of rpcUrls) {
      try {
        const body = JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{
            address: contract,
            topics: [ERC721_TRANSFER_TOPIC, null, null, walletPad],
            fromBlock: '0x0',
            toBlock:   'latest',
          }],
          id: 1,
        });
        const res = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const json = await res.json();
        if (!json.result || !Array.isArray(json.result)) continue;

        const logs: any[] = json.result;
        console.log(`[ANFEService] ${logs.length} ERC-721 Transfer logs for wallet on ${CHAIN_NAMES[chainId]}`);

        const tokenIds: string[] = [];
        for (const log of logs) {
          try {
            // ERC-721 Transfer topic3 is the tokenId (32 bytes)
            const topic3 = log.topics?.[3];
            if (!topic3) continue;
            const tokenId = String(BigInt(topic3));
            if (!tokenIds.includes(tokenId)) tokenIds.push(tokenId);
          } catch {}
        }
        console.log(`[ANFEService] Extracted ${tokenIds.length} unique tokenIds from logs`);

        const anfes: ANFE[] = [];
        for (const tokenId of tokenIds) {
          const owner = await this.ownerOf(contract, tokenId, chainId);
          if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) continue;
          const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress);
          anfes.push(anfe);
        }
        return anfes;
      } catch (e) {
        console.warn('[ANFEService] RPC failed for event logs:', rpcUrl, e);
        continue;
      }
    }
    return [];
  }

  private async checkBalanceOf(
    contract: string, wallet: string, tokenId: string, chainId: SupportedChain
  ): Promise<number> {
    // For ERC-721, use ownerOf instead of balanceOf
    const owner = await this.ownerOf(contract, tokenId, chainId);
    return owner && owner.toLowerCase() === wallet.toLowerCase() ? 1 : 0;
  }

  // ========================================================================
  // CONTRACT ATTRIBUTES (ERC-721 tokenURI(uint256))
  // ========================================================================
  private async fetchAttributes(contractAddress: string, tokenId: string, chainId: SupportedChain): Promise<ANFEAttributes> {
    try {
      // ERC-721 tokenURI(uint256) selector = 0xc87b56dd
      const data = '0xc87b56dd' + BigInt(tokenId).toString(16).padStart(64, '0');
      const rawUri = await this.callContract(contractAddress, data, chainId);
      if (!rawUri || rawUri === '0x') return this.emptyAttributes();
      const tokenURI = this.decodeHexString(rawUri);
      if (!tokenURI || !tokenURI.startsWith('http')) return this.emptyAttributes();
      const metadata = await this.fetchMetadata(tokenURI);
      if (!metadata) return this.emptyAttributes();
      return parseAttributes(metadata);
    } catch {
      return this.emptyAttributes();
    }
  }

  private getProvider(): any {
    return (window as any).mosaic?.wallet || (window as any).ethereum;
  }

  private async callContract(contractAddress: string, data: string, chainId: SupportedChain): Promise<string | null> {
    const rpcUrls = [RPC_CONFIG[chainId], ...(RPC_FALLBACKS[chainId] || [])];
    for (const rpcUrl of rpcUrls) {
      try {
        const r = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: contractAddress, data }, 'latest'], id: 1 }),
        });
        const j = await r.json();
        if (j.result && j.result !== '0x') return j.result;
      } catch { continue; }
    }
    return null;
  }

  private decodeHexString(hex: string): string {
    if (!hex || hex === '0x') return '';
    let h = strip0x(hex);
    // Dynamic bytes offset + length
    if (h.length > 128) {
      const len = parseInt(h.slice(64, 128), 16);
      if (len > 0 && len < 10000) {
        let out = '';
        for (let i = 0; i < len * 2 && i + 128 < h.length; i += 2) {
          const code = parseInt(h.substr(i + 128, 2), 16);
          if (code === 0) break;
          out += String.fromCharCode(code);
        }
        return out;
      }
    }
    // Simple 32-byte fallback
    if (h.length === 64) {
      let out = '';
      for (let i = 0; i < 64; i += 2) {
        const code = parseInt(h.substr(i, 2), 16);
        if (code === 0) break;
        out += String.fromCharCode(code);
      }
      return out;
    }
    return hex;
  }

  private async fetchMetadata(uri: string): Promise<any | null> {
    try {
      let url = uri;
      if (uri.startsWith('data:application/json;base64,')) { return JSON.parse(atob(uri.split(',')[1])); }
      if (uri.startsWith('ipfs://')) { url = 'https://ipfs.io/ipfs/' + uri.replace('ipfs://', ''); }
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; }
  }

  private emptyAttributes(): ANFEAttributes {
    return { core: {}, ai: { aiModules: [] }, raw: [] };
  }

  // ========================================================================
  // PUBLIC UTILS
  // ========================================================================
  async getANFE(anfeId: string): Promise<ANFE | null> {
    const cached = this.anfeCache.get(anfeId);
    if (cached) return cached;
    const parts = anfeId.split(':');
    if (parts.length < 2) return null;
    const [contract, tokenId] = [parts[0], parts[1]];
    const chainId = contract.toLowerCase() === (ANFE_CONTRACTS[8453] || '').toLowerCase() ? 8453 : 1;
    const walletAddress = '';
    const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress);
    this.anfeCache.set(anfeId, anfe);
    return anfe;
  }

  async verifyANFE(anfeId: string): Promise<{ valid: boolean; anfeId: string; error?: string }> {
    const anfe = await this.getANFE(anfeId);
    return { valid: !!anfe, anfeId, error: anfe ? undefined : 'Not found' };
  }

  canDelegate(anfe: ANFE, walletAddress: string): boolean {
    return anfe.owner.toLowerCase() === walletAddress.toLowerCase();
  }

  startPolling(walletAddress: string, intervalMs = 15000): void {
    this.stopPolling();
    this.pollInterval = window.setInterval(async () => {
      this.walletANFEsCache.delete(walletAddress);
      await this.loadWalletANFEs(walletAddress);
    }, intervalMs);
  }
  stopPolling(): void {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  async loadBaseANFEsViaRPC(walletAddress: string): Promise<ANFE[]> {
    return ANFE_CONTRACTS[8453] ? this.discoverANFEsViaEventLogs(walletAddress, 8453) : [];
  }
  getBaseContractAddress(): string | undefined {
    return ANFE_CONTRACTS[8453];
  }
  clearCache(): void {
    this.walletANFEsCache.clear();
    this.anfeCache.clear();
    console.log('[ANFEService] All caches cleared');
  }
  async healthCheck(): Promise<{ hyperinsight: boolean; rpc: boolean; wallet: boolean }> {
    const [hi, rpc] = await Promise.all([
      fetch(`${HI_BASE}/auth/me`, { headers: HI_HEADERS }).then(r => r.ok).catch(() => false),
      fetch(RPC_CONFIG[8453], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }) }).then(r => r.ok).catch(() => false),
    ]);
    return { hyperinsight: hi, rpc, wallet: walletAdapter.isAvailable() };
  }
}

export const anfeService = new ANFEService();
export default anfeService;
