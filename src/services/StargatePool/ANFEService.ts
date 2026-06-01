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
// Config — now pulls from the canonical HyperCycleContracts registry.
// ---------------------------------------------------------------------------
import {
  BASE_CONTRACTS as HYPERCYCLE_BASE,
  ETH_CONTRACTS as HYPERCYCLE_ETH,
  ERC721_TRANSFER_TOPIC,
  decodeUint256,
  decodeAddress,
  encodeOwnerOf,
  encodeBalanceOf,
  encodeERC1155BalanceOf,
  encodeTokenOfOwnerByIndex,
} from '../HyperCycleContracts';

const RPC_CONFIG: Record<SupportedChain, string> = {
  1:    import.meta.env.VITE_RPC_ETHEREUM || 'https://eth.llamarpc.com',
  8453: import.meta.env.VITE_RPC_BASE     || 'https://base.llamarpc.com',
};

const RPC_FALLBACKS: Record<SupportedChain, string[]> = {
  1:    ['https://1rpc.io/eth', 'https://rpc.ankr.com/eth'],
  8453: ['https://1rpc.io/base', 'https://base-mainnet.g.alchemy.com/v2/demo'],
};

// ANFE contract addresses by chain — Base only (ANFE lives on Base)
const ANFE_CONTRACTS: Record<SupportedChain, string> = {
  1:    '',  // No ANFE on Ethereum; use NodeFactory ERC-1155 instead
  8453: HYPERCYCLE_BASE.ANFE,                                           // 0x8c0075D087de9588DdF5c1441dF39828d695bc2f
};

// All c_IoAI module contracts on Base (for metadata enrichment)
const MODULE_CONTRACTS: Record<string, string> = {
  AIMF:  HYPERCYCLE_BASE.c_AIMF,
  IAIb:  HYPERCYCLE_BASE.c_IAIb,
  IAIf:  HYPERCYCLE_BASE.c_IAIf,
  IAIr:  HYPERCYCLE_BASE.c_IAIr,
  IAIs:  HYPERCYCLE_BASE.c_IAIs,
  OpnAI: HYPERCYCLE_BASE.c_OpnAI,
  QntV:  HYPERCYCLE_BASE.c_QntV,
  SpcN:  HYPERCYCLE_BASE.c_SpcN,
};

// HyperInsight API
const HI_BASE   = 'https://api.hyperinsight.app/v1';
const HI_KEY    = 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk';
const HI_HEADERS = {
  'Authorization': `Bearer ${HI_KEY}`,
  'Accept': 'application/json',
  'User-Agent': 'Mosaic-Companion/1.0',
};

function padAddr(addr: string): string {
  return '0x' + addr.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

function strip0x(s: string): string {
  return s.replace(/^0x/i, '');
}

// ---------------------------------------------------------------------------
// Paginated eth_getLogs to stay within RPC block-range limits (~2k blocks)
// ---------------------------------------------------------------------------
async function getLogsPaginated(
  rpcUrl: string,
  contract: string,
  topics: (string | null)[],
  fromBlock: bigint | string = '0x0',
  toBlock: bigint | string = 'latest',
  step: number = 2000,
): Promise<any[]> {
  let end = toBlock === 'latest' ? null : BigInt(toBlock);
  let start = BigInt(fromBlock);
  const allLogs: any[] = [];
  let lastKnownBlock: bigint | null = null;

  // Fetch latest block number once if toBlock is 'latest'
  if (!end) {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: Date.now() }),
    });
    const j = await resp.json();
    end = j.result ? BigInt(j.result) : null;
  }

  // Estimate Base mainnet launched ~Aug 2023. For ANFE discovery we don't
  // need to scan from genesis. A recent range (last ~30 days ≈ 2M blocks)
  // catches all transfers for actively-held NFTs and avoids RPC rate limits.
  if (!end) return allLogs;

  // Limit scan to last ~30 days (≈2M blocks) to avoid RPC timeouts
  if (fromBlock === '0x0' || fromBlock === BigInt(0)) {
    start = end - BigInt(2_000_000);
    if (start < BigInt(0)) start = BigInt(0);
  }

  for (let cur = end; cur >= start; cur -= BigInt(step)) {
    const s = cur - BigInt(step - 1) < start ? start : cur - BigInt(step - 1);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{
        address: contract,
        topics,
        fromBlock: `0x${s.toString(16)}`,
        toBlock: `0x${cur.toString(16)}`,
      }],
      id: Number(cur),
    });

    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const j = await resp.json();
    if (!j.result || !Array.isArray(j.result)) continue;
    // Reverse so earliest-first
    for (let i = j.result.length - 1; i >= 0; i--) allLogs.push(j.result[i]);
  }

  return allLogs;
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

  getANFEContract(chainId: SupportedChain): string {
    return ANFE_CONTRACTS[chainId] || '';
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

    // --- PRIMARY: HyperInsight node discovery (API-first, avoids RPC downtime)
    try {
      const hiANFEs = await this.discoverANFEsViaHyperInsight(walletAddress, 8453);
      if (hiANFEs.length) {
        console.log(`[ANFEService] HyperInsight discovered ${hiANFEs.length} ANFEs`);
        anfes.push(...hiANFEs);
      }
    } catch (e) {
      console.warn('[ANFEService] HyperInsight discovery failed:', e);
    }

    // --- SECONDARY: On-chain ERC-721 enumeration (fills gaps if HI is stale)
    if (contract) {
      try {
        const enumANFEs = await this.discoverANFEsViaERC721Enumeration(walletAddress, 8453);
        if (enumANFEs.length) {
          console.log(`[ANFEService] ERC-721 enumeration discovered ${enumANFEs.length} ANFEs`);
          for (const a of enumANFEs) {
            if (!anfes.find(x => x.tokenId === a.tokenId)) anfes.push(a);
          }
        }
      } catch (e) {
        console.warn('[ANFEService] ERC-721 enumeration failed:', e);
      }
    }

    // --- TERTIARY: On-chain ERC-721 event-log discovery (fills remaining gaps)
    if (contract) {
      try {
        const logANFEs = await this.discoverANFEsViaEventLogs(walletAddress, 8453);
        if (logANFEs.length) {
          console.log(`[ANFEService] Event logs discovered ${logANFEs.length} ANFEs`);
          for (const a of logANFEs) {
            if (!anfes.find(x => x.tokenId === a.tokenId)) anfes.push(a);
          }
        }
      } catch (e) {
        console.warn('[ANFEService] Event log discovery failed:', e);
      }
    }

    // --- TERTIARY: HyperInsight enrichment (node uptime, compute stats)
    // Only enriches what on-chain already found; does NOT replace on-chain discovery.
    if (contract && anfes.length > 0) {
      try {
        for (const anfe of anfes) {
          const nodeData = await hiNode(anfe.tokenId);
          if (nodeData) {
            const merkelizerData = await this.fetchMerkelizerData(anfe.tokenId, walletAddress);
            anfe.verification.status = nodeData.isAlive ? 'online' : (merkelizerData?.status || 'offline');
            anfe.verification.uptime = nodeData.measuredUptime ?? merkelizerData?.uptime ?? anfe.verification.uptime;
            anfe.verification.reliability = nodeData.measuredUptime ?? merkelizerData?.uptime ?? anfe.verification.reliability;
            anfe.verification.merkelizer = {
              uptime: merkelizerData?.uptime ?? null,
              compute: merkelizerData?.compute ?? null,
              nodeInfo: merkelizerData?.nodeInfo ?? null,
            };
          }
        }
      } catch (e) {
        console.warn('[ANFEService] HyperInsight enrichment failed:', e);
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
  // BUILD ANFE (ERC-721 compatible) — with HyperInsight + Merkelizer data
  // ========================================================================
  private async buildANFE(contract: string, tokenId: string, chainId: SupportedChain, walletAddress: string): Promise<ANFE> {
    const attributes = await this.fetchAttributes(contract, tokenId, chainId);

    // Fetch HyperInsight node data
    const nodeData = await hiNode(tokenId);

    // Fetch Merkelizer data (parallel)
    const merkelizerData = await this.fetchMerkelizerData(tokenId, walletAddress);

    const verification: any = {
      valid: true,
      anfeId: `${contract}:${tokenId}`,
      lastUpdated: Date.now(),
      status: nodeData?.isAlive ? 'online' : (merkelizerData?.status || 'offline'),
      nodeFactoryId: nodeData?.licenseKey ? String(nodeData.licenseKey) : tokenId,
      tranche: nodeData?.network || CHAIN_NAMES[chainId] || 'BASE',
      uptime: nodeData?.measuredUptime ?? merkelizerData?.uptime ?? null,
      reliability: nodeData?.measuredUptime ?? merkelizerData?.uptime ?? null,
      registeredAt: nodeData?.lastContactAt ? new Date(nodeData.lastContactAt).getTime() : undefined,
      lastVerified: Date.now(),
      // Merkelizer-enriched fields
      merkelizer: {
        uptime: merkelizerData?.uptime ?? null,
        compute: merkelizerData?.compute ?? null,
        nodeInfo: merkelizerData?.nodeInfo ?? null,
      },
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
  // MERKELIZER DATA FETCH
  // ========================================================================
  private async fetchMerkelizerData(
    tokenId: string,
    _walletAddress: string
  ): Promise<{ status: string; uptime: number | null; compute: any | null; nodeInfo: any | null } | null> {
    // PRIMARY: HyperInsight API (legacy merkelizer IP is dead)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${HI_BASE}/nodes/${tokenId}`, {
        headers: HI_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const node = await res.json();
      return {
        status: node.isAlive ? 'online' : 'offline',
        uptime: node.measuredUptime ?? node.uptimePercent ?? null,
        compute: node.compute ?? null,
        nodeInfo: node.licenseKey
          ? { licenseKey: node.licenseKey, network: node.network, lastContactAt: node.lastContactAt }
          : null,
      };
    } catch {
      return null;
    }
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
        const logs = await getLogsPaginated(
          rpcUrl,
          contract,
          [ERC721_TRANSFER_TOPIC, null, walletPad, null],
          '0x0',
          'latest',
          2000,
        );
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

  // ========================================================================
  // HyperInsight-first ANFE discovery (fallback when RPCs are down)
  // ========================================================================
  private async discoverANFEsViaHyperInsight(
    walletAddress: string,
    chainId: SupportedChain
  ): Promise<ANFE[]> {
    const contract = ANFE_CONTRACTS[chainId];
    if (!contract) return [];

    try {
      const nodes = await hiNodesByWallet(walletAddress);
      if (!nodes || nodes.length === 0) return [];

      const anfes: ANFE[] = [];
      
      // Build all ANFEs in parallel — individual ownerOf/attribute calls dead-RPC safe
      const promises = nodes
        .map((node) => ({
          tokenId: String(node.licenseKey || node.id || node.tokenId || node.anfeId || ''),
          node,
        }))
        .filter(({ tokenId }) =>
          tokenId && tokenId !== 'undefined' && tokenId !== 'null'
        )
        .filter(({ tokenId }) =>
          !anfes.some((a) => a.tokenId === tokenId)
        )
        .map(async ({ tokenId, node }) => {
          // Fast-path ownerOf with timeout — if RPCs are dead, treat as owned
          const ownerOfPromise = this.ownerOf(contract, tokenId, chainId);
          const owner = await Promise.race([
            ownerOfPromise,
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
          if (owner && owner.toLowerCase() !== walletAddress.toLowerCase()) return null;

          const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress);
          // Enrich with HyperInsight node fields if present
          if (node.status) anfe.verification.status = node.status;
          if (node.measuredUptime != null) anfe.verification.uptime = node.measuredUptime;
          if (node.network) anfe.verification.tranche = node.network;
          if (node.lastContactAt) anfe.verification.registeredAt = new Date(node.lastContactAt).getTime();
          if (node.compute) anfe.verification.merkelizer.compute = node.compute;

          return anfe;
        });

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) anfes.push(r);
      }

      return anfes;
    } catch (e) {
      console.warn('[ANFEService] HyperInsight fallback discovery failed:', e);
      return [];
    }
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

  // ========================================================================
  // RPC / eth_call — prefers wallet provider (no CORS), falls back to HTTP RPC
  // ========================================================================
  private async callContract(
    contractAddress: string,
    data: string,
    chainId: SupportedChain
  ): Promise<string | null> {
    const provider = this.getProvider();

    // --- PRIORITY 1: window.ethereum / mosaic.wallet (no CORS, wallet's connected chain) ---
    if (provider && provider.request) {
      try {
        // Check chain matches before using wallet provider
        const currentChain = await provider.request({ method: 'eth_chainId' }).catch(() => null);
        const targetChain = '0x' + chainId.toString(16);
        if (currentChain && currentChain.toLowerCase() === targetChain.toLowerCase()) {
          const result = await provider.request({
            method: 'eth_call',
            params: [{ to: contractAddress, data }, 'latest'],
          });
          if (result && result !== '0x') {
            return result as string;
          }
        }
      } catch { /* fall through */ }
    }

    // --- PRIORITY 2: Direct HTTP RPC (works in Electron, may CORS-block in browser) ---
    const rpcUrls = [RPC_CONFIG[chainId], ...(RPC_FALLBACKS[chainId] || [])];
    for (const rpcUrl of rpcUrls) {
      try {
        const r = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ to: contractAddress, data }, 'latest'],
            id: 1,
          }),
        });
        if (!r.ok) continue;
        const j = await r.json();
        if (j.error) continue;
        if (j.result && j.result !== '0x') return j.result;
      } catch { continue; }
    }

    return null;
  }

  private getProvider(): any {
    return (window as any).mosaic?.wallet || (window as any).ethereum;
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
  async getANFE(anfeId: string, walletAddress?: string): Promise<ANFE | null> {
    const cached = this.anfeCache.get(anfeId);
    if (cached) return cached;
    const parts = anfeId.split(':');
    if (parts.length < 2) return null;
    const [contract, tokenId] = [parts[0], parts[1]];
    const chainId = contract.toLowerCase() === (ANFE_CONTRACTS[8453] || '').toLowerCase() ? 8453 : 1;
    // Use passed walletAddress instead of hardcoded ''
    const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress || '');
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

  /**
   * ERC-721 enumeration-based discovery: balanceOf → tokenOfOwnerByIndex.
   * This is the most reliable method for ERC-721 contracts that support
   * the optional enumeration extension. We iterate all token indices for
   * each contract and verify ownerOf before accepting.
   */
  async discoverANFEsViaERC721Enumeration(
    walletAddress: string,
    chainId: SupportedChain
  ): Promise<ANFE[]> {
    const contract = ANFE_CONTRACTS[chainId];
    if (!contract) return [];

    // 1. Get ERC-721 balanceOf(wallet)
    let balance = 0;
    const balanceData = encodeBalanceOf(walletAddress);
    const balanceResult = await this.callContract(contract, balanceData, chainId);
    if (balanceResult && balanceResult !== '0x') {
      balance = Number(BigInt(balanceResult));
    }
    if (balance === 0) return [];

    console.log(`[ANFEService] ERC-721 balanceOf = ${balance} on ${CHAIN_NAMES[chainId]}`);

    // 2. Enumerate each token index → tokenId via tokenOfOwnerByIndex
    const tokenIds: string[] = [];
    for (let i = 0; i < balance; i++) {
      const data = encodeTokenOfOwnerByIndex(walletAddress, i);
      const result = await this.callContract(contract, data, chainId);
      if (result && result !== '0x') {
        const tokenId = String(BigInt(result));
        tokenIds.push(tokenId);
      }
    }

    console.log(`[ANFEService] Enumerated ${tokenIds.length} tokenIds from ERC-721`);

    // 3. Verify each token via ownerOf and build ANFE
    const anfes: ANFE[] = [];
    for (const tokenId of tokenIds) {
      const owner = await this.ownerOf(contract, tokenId, chainId);
      if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) continue;
      const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress);
      anfes.push(anfe);
    }

    return anfes;
  }

  getBaseContractAddress(): string | undefined {
    return ANFE_CONTRACTS[8453];
  }
  clearCache(): void {
    this.walletANFEsCache.clear();
    this.anfeCache.clear();
    console.log('[ANFEService] All caches cleared');
  }

  /**
   * Query HyperCycle ERC-20 token balances (HyPC, etc.) for a wallet.
   * Called from Stargate Pool to show fungible assets alongside ANFEs.
   * Uses this.callContract() to prefer wallet provider (no CORS).
   */
  async getHyperCycleBalances(
    walletAddress: string
  ): Promise<
    { symbol: string; name: string; balance: string; rawBalance: bigint; decimals: number; chain: string }[]
  > {
    const { HYPERCYCLE_TOKENS } = await import('../HyperCycleContracts');
    const results: {
      symbol: string; name: string; balance: string; rawBalance: bigint; decimals: number; chain: string
    }[] = [];

    for (const token of HYPERCYCLE_TOKENS) {
      // Support ERC-20, ERC-721, and ERC-1155 balances
      const chainId = token.chain === 'ethereum' ? 1 : 8453;
      let raw: bigint | null = null;

      try {
        if (token.standard === 'ERC-20') {
          const data = encodeBalanceOf(walletAddress);
          const result = await this.callContract(token.contract, data, chainId);
          if (result && result !== '0x') raw = BigInt(result);
        } else if (token.standard === 'ERC-721') {
          // ERC-721: use balanceOf(address) if available, else owner-count
          try {
            const data = encodeBalanceOf(walletAddress);
            const result = await this.callContract(token.contract, data, chainId);
            if (result && result !== '0x') raw = BigInt(result);
          } catch {
            // Non-standard ERC-721 without balanceOf — skip numeric balance
            raw = null;
          }
        } else if (token.standard === 'ERC-1155') {
          // ERC-1155 balanceOf(address, tokenId)
          const tokenId = token.tokenId || '0x1';
          const data = encodeERC1155BalanceOf(walletAddress, tokenId);
          const result = await this.callContract(token.contract, data, chainId);
          if (result && result !== '0x') raw = BigInt(result);
        }
      } catch {
        // ignore RPC errors for this token
      }

      if (raw !== null && raw >= 0n) {
        const formatted = Number(raw) / Math.pow(10, token.decimals);
        results.push({
          symbol: token.symbol,
          name: token.name,
          balance: token.standard === 'ERC-721' && raw > 0n
            ? `${raw.toString()} NFT(s)`
            : formatted.toLocaleString('en-US', { maximumFractionDigits: token.decimals }),
          rawBalance: raw,
          decimals: token.decimals,
          chain: token.chain,
        });
      }
    }
    return results;
  }

  async healthCheck(): Promise<{ hyperinsight: boolean; rpc: boolean; wallet: boolean }> {
    const [hi, rpc] = await Promise.all([
      fetch(`${HI_BASE}/auth/me`, { headers: HI_HEADERS }).then(r => r.ok).catch(() => false),
      fetch(RPC_CONFIG[8453], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }) }).then(r => r.ok).catch(() => false),
    ]);
    return { hyperinsight: hi, rpc, wallet: walletAdapter.isAvailable() };
  }

  /**
   * Query HyperCycle NFT balances (ERC-721 + ERC-1155) for a wallet.
   * Shows identity, licence, factory, and module tokens across Ethereum + Base.
   */
  /**
   * ERC-721 enumeration for ANY contract (not just ANFE).
   * Returns full ANFE objects with metadata and Merkelizer data per token.
   */
  async discoverANFEsForContract(
    contract: string,
    walletAddress: string,
    chainId: SupportedChain
  ): Promise<ANFE[]> {
    // 1. Get ERC-721 balanceOf(wallet)
    let balance = 0;
    const balanceData = encodeBalanceOf(walletAddress);
    const balanceResult = await this.callContract(contract, balanceData, chainId);
    if (balanceResult && balanceResult !== '0x') {
      balance = Number(BigInt(balanceResult));
    }
    if (balance === 0) return [];

    console.log(`[ANFEService] balanceOf = ${balance} on contract ${contract.slice(0, 10)}... chain ${chainId}`);

    // 2. Enumerate each token index → tokenId via tokenOfOwnerByIndex
    const tokenIds: string[] = [];
    for (let i = 0; i < balance; i++) {
      const data = encodeTokenOfOwnerByIndex(walletAddress, i);
      const result = await this.callContract(contract, data, chainId);
      if (result && result !== '0x') {
        const tokenId = String(BigInt(result));
        tokenIds.push(tokenId);
      }
    }

    // 2b. FALLBACK: If enumeration returned nothing but balance > 0,
    // the contract likely does NOT implement ERC-721Enumerable.
    // Use event-log discovery (Transfer events) instead.
    if (tokenIds.length === 0 && balance > 0) {
      console.log(`[ANFEService] Contract ${contract.slice(0, 10)}... lacks enumeration — falling back to event logs`);
      const walletPad = walletAddress.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
      const rpcUrls = [RPC_CONFIG[chainId], ...(RPC_FALLBACKS[chainId] || [])];
      for (const rpcUrl of rpcUrls) {
        try {
          const logs = await getLogsPaginated(
            rpcUrl,
            contract,
            [ERC721_TRANSFER_TOPIC, null, `0x${walletPad}`, null],
            '0x0',
            'latest',
            2000,
          );
          for (const log of logs) {
            try {
              const topic3 = log.topics?.[3];
              if (!topic3) continue;
              const tid = String(BigInt(topic3));
              if (!tokenIds.includes(tid)) tokenIds.push(tid);
            } catch {}
          }
          console.log(`[ANFEService] Event logs found ${tokenIds.length} tokenIds on ${contract.slice(0, 10)}...`);
          if (tokenIds.length > 0) break;
        } catch (e) {
          console.warn('[ANFEService] Event log RPC failed:', rpcUrl, e);
        }
      }
    }

    console.log(`[ANFEService] Enumerated ${tokenIds.length} tokenIds from ${contract.slice(0, 10)}...`);

    // 3. Build ANFE for each token (fetches tokenURI, metadata, Merkelizer)
    const anfes: ANFE[] = [];
    for (const tokenId of tokenIds) {
      const owner = await this.ownerOf(contract, tokenId, chainId);
      if (!owner || owner.toLowerCase() !== walletAddress.toLowerCase()) continue;
      const anfe = await this.buildANFE(contract, tokenId, chainId, walletAddress);
      anfes.push(anfe);
    }

    return anfes;
  }

  /**
   * DETAILED HyperCycle NFT discovery.
   * Scans ALL HyperCycle contracts (ERC-721 + ERC-1155), enumerates individual
   * token IDs, and returns full ANFE objects with Merkelizer data per token.
   * Replaces getHyperCycleNFTBalances() which only returned aggregated counts.
   */
  async getHyperCycleNFTsDetailed(
    walletAddress: string
  ): Promise<{ symbol: string; name: string; chain: string; standard: string; nfts: ANFE[] }[]> {
    const { HYPERCYCLE_TOKENS } = await import('../HyperCycleContracts');
    const results: { symbol: string; name: string; chain: string; standard: string; nfts: ANFE[] }[] = [];

    for (const token of HYPERCYCLE_TOKENS) {
      if (token.standard === 'ERC-20') continue;
      const chainId = token.chain === 'ethereum' ? 1 : 8453;

      if (token.standard === 'ERC-721') {
        // Enumerate individual tokens and build ANFEs
        const nfts = await this.discoverANFEsForContract(token.contract, walletAddress, chainId);
        if (nfts.length > 0) {
          results.push({ symbol: token.symbol, name: token.name, chain: token.chain, standard: token.standard, nfts });
        }
      } else if (token.standard === 'ERC-1155') {
        // ERC-1155: check per-token-ID balanceOf
        // The HyperCycle Ethereum NodeFactory (0x4BFbA79CF...) uses tokenId=1 for Node Factory
        let totalCount = 0;
        const nfts: ANFE[] = [];
        // Scan token IDs 1-5 (NodeFactory uses ID 1; IDs 2+ are reserved/extended)
        for (let tokenId = 1; tokenId <= 5; tokenId++) {
          const data = encodeERC1155BalanceOf(walletAddress, String(tokenId));
          const result = await this.callContract(token.contract, data, chainId);
          if (result && result !== '0x') {
            const count = Number(BigInt(result));
            totalCount += count;
            if (count > 0) {
              // Build a lightweight ANFE for ERC-1155 (no tokenOfOwnerByIndex)
              nfts.push({
                id: `${token.contract}:${tokenId}`,
                tokenId: String(tokenId),
                contractAddress: token.contract,
                owner: walletAddress,
                chainId,
                chainName: CHAIN_NAMES[chainId],
                blockNumber: 0,
                blockTimestamp: Date.now(),
                transactionHash: '',
                attributes: this.emptyAttributes(),
                verification: {
                  valid: true,
                  anfeId: `${token.contract}:${tokenId}`,
                  lastUpdated: Date.now(),
                  status: 'online',
                  nodeFactoryId: undefined,
                  tranche: token.chain,
                  lastVerified: Date.now(),
                },
              });
            }
          }
        }
        if (totalCount > 0) {
          results.push({ symbol: token.symbol, name: token.name, chain: token.chain, standard: token.standard, nfts });
        }
      }
    }
    return results;
  }

  /**
   * LEGACY: Aggregate-only NFT count. Kept for backwards compatibility.
   * Use getHyperCycleNFTsDetailed() for per-token ANFE data.
   */
  async getHyperCycleNFTBalances(
    walletAddress: string
  ): Promise<{ symbol: string; name: string; count: number; chain: string; standard: string }[]> {
    const detailed = await this.getHyperCycleNFTsDetailed(walletAddress);
    return detailed.map(d => ({ symbol: d.symbol, name: d.name, count: d.nfts.length, chain: d.chain, standard: d.standard }));
  }
}

export const anfeService = new ANFEService();
export default anfeService;
