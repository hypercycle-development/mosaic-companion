// =============================================================================
// HYPERCYCLE ASSET DISCOVERY — Unified multi-contract, multi-chain scanner
// ---------------------------------------------------------------------------
// Discovers ALL HyperCycle assets for a wallet across Ethereum and Base:
//   ERC-20 : HyPC
//   ERC-721: HyPCL, c_HyPC, ANFE, c_AIMF, c_IAIb, c_IAIf, c_IAIr, c_IAIs, c_OpnAI, c_QntV, c_SpcN
//   ERC-1155: NodeFactory (ETH)
//
// Strategy per contract:
//   ERC-20  : balanceOf(address) → uint256
//   ERC-721 : balanceOf(address) → count; if > 0, try tokenOfOwnerByIndex (Enumerable)
//             OR ownerOf(knownTokenIds from HyperInsight) for non-Enumerable
//   ERC-1155: balanceOf(address, id) → uint256 (for known factory IDs)
// =============================================================================

import {
  ETH_CONTRACTS,
  BASE_CONTRACTS,
  HYPERCYCLE_TOKENS,
  encodeBalanceOf,
  encodeOwnerOf,
  encodeERC1155BalanceOf,
  decodeUint256,
  decodeAddress,
  ERC721_TRANSFER_TOPIC,
} from '../HyperCycleContracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AssetChain = 'ethereum' | 'base';
export type AssetStandard = 'ERC-20' | 'ERC-721' | 'ERC-1155';
export type AssetCategory = 'fungible' | 'identity' | 'license' | 'factory' | 'module';

export interface HyperCycleAsset {
  id: string;                    // contract:tokenId or contract:balance
  contractAddress: string;
  symbol: string;
  name: string;
  chain: AssetChain;
  standard: AssetStandard;
  category: AssetCategory;
  balance: string;               // For ERC-20: human-readable. For ERC-721: "1" or count. For ERC-1155: count.
  tokenId?: string;              // For ERC-721/1155
  decimals: number;
  metadata?: {
    level?: number;
    rarity?: string;
    imageUrl?: string;
    description?: string;
  };
  // Merkelizer / HyperInsight enriched data
  nodeData?: {
    licenseKey?: string;
    network?: string;
    isAlive?: boolean;
    measuredUptime?: number;
    lastContactAt?: string;
  };
}

export interface WalletAssets {
  address: string;
  chain: AssetChain;
  assets: HyperCycleAsset[];
  fetchedAt: number;
}

// ---------------------------------------------------------------------------
// RPC Configuration
// ---------------------------------------------------------------------------
const RPC_URLS: Record<AssetChain, string[]> = {
  ethereum: [
    import.meta.env.VITE_RPC_ETHEREUM || 'https://eth.llamarpc.com',
    'https://1rpc.io/eth',
    'https://rpc.ankr.com/eth',
  ],
  base: [
    import.meta.env.VITE_RPC_BASE || 'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://1rpc.io/base',
  ],
};

// ---------------------------------------------------------------------------
// Contract Registry — All contracts to scan
// ---------------------------------------------------------------------------
interface ContractDef {
  address: string;
  symbol: string;
  name: string;
  chain: AssetChain;
  standard: AssetStandard;
  category: AssetCategory;
  decimals: number;
}

const CONTRACT_REGISTRY: ContractDef[] = [
  // Ethereum
  { address: ETH_CONTRACTS.HyPC,       symbol: 'HyPC',    name: 'HyperCycle Token',          chain: 'ethereum', standard: 'ERC-20',  category: 'fungible', decimals: 18 },
  { address: ETH_CONTRACTS.HyPCL,      symbol: 'HyPCL',   name: 'Node Factory Licence',      chain: 'ethereum', standard: 'ERC-721', category: 'license',  decimals: 0 },
  { address: ETH_CONTRACTS.c_HyPC,     symbol: 'c_HyPC',  name: 'CHyPC Identity Collateral', chain: 'ethereum', standard: 'ERC-721', category: 'identity', decimals: 0 },
  { address: ETH_CONTRACTS.NodeFactory, symbol: 'NodeFac', name: 'Node Factory ERC-1155',     chain: 'ethereum', standard: 'ERC-1155', category: 'factory', decimals: 0 },
  // Base
  { address: BASE_CONTRACTS.c_HyPC,    symbol: 'c_HyPCe', name: 'CHyPCe Identity Collateral', chain: 'base', standard: 'ERC-721', category: 'identity', decimals: 0 },
  { address: BASE_CONTRACTS.HyPCL,     symbol: 'HyPCL-B', name: 'ANFE Licence',                 chain: 'base', standard: 'ERC-721', category: 'license',  decimals: 0 },
  { address: BASE_CONTRACTS.ANFE,      symbol: 'ANFE',    name: 'Advanced Node Factory Enclosure', chain: 'base', standard: 'ERC-721', category: 'factory', decimals: 0 },
  { address: BASE_CONTRACTS.c_AIMF,     symbol: 'AIMF',    name: 'Aimifier',                     chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_IAIb,    symbol: 'IAIb',    name: 'IoAI Box',                     chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_IAIf,    symbol: 'IAIf',    name: 'IoAI Federated',               chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_IAIr,    symbol: 'IAIr',    name: 'IoAI Registry',                chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_IAIs,    symbol: 'IAIs',    name: 'IoAI Search',                  chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_OpnAI,   symbol: 'OpnAI',   name: 'Open IoAI',                    chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_QntV,    symbol: 'QntV',    name: 'Quantum Verify',               chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
  { address: BASE_CONTRACTS.c_SpcN,    symbol: 'SpcN',    name: 'Space Nodes',                  chain: 'base', standard: 'ERC-721', category: 'module',   decimals: 0 },
];

// ---------------------------------------------------------------------------
// HyperInsight API (for node enrichment)
// ---------------------------------------------------------------------------
const HI_BASE = 'https://api.hyperinsight.app/v1';
const HI_KEY  = 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk';
const HI_HEADERS = {
  'Authorization': `Bearer ${HI_KEY}`,
  'Accept': 'application/json',
};

async function hiFetch(path: string): Promise<any | null> {
  try {
    const r = await fetch(`${HI_BASE}${path}`, { headers: HI_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn('[AssetDiscovery] HyperInsight fetch error:', path, e);
    return null;
  }
}

async function hiNode(license: string): Promise<any | null> {
  return hiFetch(`/nodes/${license}`);
}

async function hiNodesByWallet(walletAddress: string): Promise<any[]> {
  try {
    const r = await fetch(`${HI_BASE}/nodes?wallet=${walletAddress.toLowerCase()}`, {
      headers: HI_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const json = await r.json();
    if (json.data && Array.isArray(json.data)) return json.data;
    if (Array.isArray(json)) return json;
    return [];
  } catch (e) {
    console.warn('[AssetDiscovery] HyperInsight wallet fetch error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Low-level RPC helpers
// ---------------------------------------------------------------------------
async function rpcCall(chain: AssetChain, payload: object): Promise<any | null> {
  const urls = RPC_URLS[chain];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', ...payload, id: Date.now() }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.error) {
        console.warn('[AssetDiscovery] RPC error:', j.error);
        continue;
      }
      return j.result;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function strip0x(s: string): string {
  return s.replace(/^0x/i, '');
}

function padAddr(addr: string): string {
  return '0x' + addr.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
}

// ---------------------------------------------------------------------------
// Discovery engine
// ---------------------------------------------------------------------------
class HyperCycleAssetDiscovery {
  private cache: Map<string, WalletAssets> = new Map();
  private cacheTTL = 60000; // 1 minute

  private cacheKey(address: string, chain: AssetChain): string {
    return `${address.toLowerCase()}:${chain}`;
  }

  /** Discover ALL HyperCycle assets for a wallet on a given chain */
  async discover(address: string, chain: AssetChain): Promise<WalletAssets> {
    const key = this.cacheKey(address, chain);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTTL) {
      console.log(`[AssetDiscovery] Returning cached assets for ${address.slice(0, 8)}... on ${chain}`);
      return cached;
    }

    console.log(`[AssetDiscovery] Scanning ${chain} for ${address.slice(0, 8)}...`);
    const assets: HyperCycleAsset[] = [];
    const contracts = CONTRACT_REGISTRY.filter(c => c.chain === chain);

    // Pre-fetch HyperInsight nodes for this wallet (parallel)
    const hiNodesPromise = chain === 'base' ? hiNodesByWallet(address) : Promise.resolve([]);

    for (const contract of contracts) {
      try {
        const found = await this.scanContract(address, contract);
        assets.push(...found);
      } catch (e) {
        console.warn(`[AssetDiscovery] Failed to scan ${contract.symbol} (${contract.address.slice(0, 10)}...):`, e);
      }
    }

    // Enrich ANFE / HyPCL / NodeFactory assets with HyperInsight node data
    const hiNodes = await hiNodesPromise;
    if (hiNodes.length > 0) {
      for (const asset of assets) {
        if (asset.standard === 'ERC-721' && asset.tokenId) {
          const node = hiNodes.find((n: any) => String(n.licenseKey || n.tokenId) === asset.tokenId);
          if (node) {
            asset.nodeData = {
              licenseKey: String(node.licenseKey || asset.tokenId),
              network: node.network,
              isAlive: node.isAlive,
              measuredUptime: node.measuredUptime,
              lastContactAt: node.lastContactAt,
            };
          }
        }
      }
    }

    const result: WalletAssets = {
      address,
      chain,
      assets,
      fetchedAt: Date.now(),
    };

    this.cache.set(key, result);
    console.log(`[AssetDiscovery] Found ${assets.length} assets on ${chain}`);
    return result;
  }

  /** Discover on BOTH chains */
  async discoverAll(address: string): Promise<{ ethereum: WalletAssets; base: WalletAssets }> {
    const [eth, base] = await Promise.all([
      this.discover(address, 'ethereum'),
      this.discover(address, 'base'),
    ]);
    return { ethereum: eth, base };
  }

  /** Scan a single contract for holdings */
  private async scanContract(wallet: string, contract: ContractDef): Promise<HyperCycleAsset[]> {
    const assets: HyperCycleAsset[] = [];

    switch (contract.standard) {
      case 'ERC-20': {
        const balance = await this.getERC20Balance(wallet, contract.address, contract.chain);
        if (balance > 0n) {
          // Format with decimals
          const divisor = BigInt(10 ** contract.decimals);
          const whole = balance / divisor;
          const frac = balance % divisor;
          const formatted = `${whole.toString()}.${frac.toString().padStart(contract.decimals, '0')}`.replace(/\.?0+$/, '');
          assets.push({
            id: `${contract.address}:balance`,
            contractAddress: contract.address,
            symbol: contract.symbol,
            name: contract.name,
            chain: contract.chain,
            standard: contract.standard,
            category: contract.category,
            balance: formatted,
            decimals: contract.decimals,
          });
        }
        break;
      }

      case 'ERC-721': {
        const count = await this.getERC721Count(wallet, contract.address, contract.chain);
        if (count > 0) {
          // Try HyperInsight first for known token IDs
          const hiNodes = contract.chain === 'base' ? await hiNodesByWallet(wallet) : [];
          const knownIds = hiNodes
            .filter((n: any) => n.licenseKey)
            .map((n: any) => String(n.licenseKey));

          // Verify ownership via ownerOf for each known ID
          const ownedIds: string[] = [];
          for (const tokenId of knownIds) {
            const owner = await this.getERC721Owner(contract.address, tokenId, contract.chain);
            if (owner && owner.toLowerCase() === wallet.toLowerCase()) {
              ownedIds.push(tokenId);
            }
          }

          // Fallback: try tokenOfOwnerByIndex enumeration
          if (ownedIds.length < count) {
            const enumIds = await this.enumerateERC721(wallet, contract.address, count, contract.chain);
            for (const id of enumIds) {
              if (!ownedIds.includes(id)) ownedIds.push(id);
            }
          }

          // Build asset records
          for (const tokenId of ownedIds) {
            const hiNode = hiNodes.find((n: any) => String(n.licenseKey || n.tokenId) === tokenId);
            assets.push({
              id: `${contract.address}:${tokenId}`,
              contractAddress: contract.address,
              symbol: contract.symbol,
              name: contract.name,
              chain: contract.chain,
              standard: contract.standard,
              category: contract.category,
              balance: '1',
              tokenId,
              decimals: 0,
              nodeData: hiNode ? {
                licenseKey: String(hiNode.licenseKey || tokenId),
                network: hiNode.network,
                isAlive: hiNode.isAlive,
                measuredUptime: hiNode.measuredUptime,
                lastContactAt: hiNode.lastContactAt,
              } : undefined,
            });
          }
        }
        break;
      }

      case 'ERC-1155': {
        // For NodeFactory, we need known token IDs. Use HyperInsight or a static list.
        // For now, check a few common factory IDs
        const knownFactoryIds = ['1', '2', '3', '4', '5'];
        for (const id of knownFactoryIds) {
          const bal = await this.getERC1155Balance(wallet, contract.address, id, contract.chain);
          if (bal > 0n) {
            assets.push({
              id: `${contract.address}:${id}`,
              contractAddress: contract.address,
              symbol: contract.symbol,
              name: `${contract.name} #${id}`,
              chain: contract.chain,
              standard: contract.standard,
              category: contract.category,
              balance: bal.toString(),
              tokenId: id,
              decimals: 0,
            });
          }
        }
        break;
      }
    }

    return assets;
  }

  // -------------------------------------------------------------------------
  // ERC-20
  // -------------------------------------------------------------------------
  private async getERC20Balance(wallet: string, contract: string, chain: AssetChain): Promise<bigint> {
    const data = encodeBalanceOf(wallet);
    const result = await rpcCall(chain, {
      method: 'eth_call',
      params: [{ to: contract, data }, 'latest'],
    });
    if (!result || result === '0x') return 0n;
    return decodeUint256(result);
  }

  // -------------------------------------------------------------------------
  // ERC-721
  // -------------------------------------------------------------------------
  private async getERC721Count(wallet: string, contract: string, chain: AssetChain): Promise<number> {
    const data = encodeBalanceOf(wallet); // balanceOf(address) selector is same as ERC-20
    const result = await rpcCall(chain, {
      method: 'eth_call',
      params: [{ to: contract, data }, 'latest'],
    });
    if (!result || result === '0x') return 0;
    const count = Number(decodeUint256(result));
    return count;
  }

  private async getERC721Owner(contract: string, tokenId: string, chain: AssetChain): Promise<string | null> {
    const data = encodeOwnerOf(tokenId);
    const result = await rpcCall(chain, {
      method: 'eth_call',
      params: [{ to: contract, data }, 'latest'],
    });
    if (!result || result === '0x' || result.length < 42) return null;
    const addr = decodeAddress(result);
    if (addr === '0x0000000000000000000000000000000000000000') return null;
    return addr;
  }

  private async enumerateERC721(wallet: string, contract: string, count: number, chain: AssetChain): Promise<string[]> {
    const ids: string[] = [];
    // Try tokenOfOwnerByIndex for Enumerable contracts
    for (let i = 0; i < Math.min(count, 50); i++) {
      try {
        const paddedOwner = padAddr(wallet);
        const paddedIndex = BigInt(i).toString(16).padStart(64, '0');
        const data = `0x2f745c59${paddedOwner.slice(2)}${paddedIndex}`;
        const result = await rpcCall(chain, {
          method: 'eth_call',
          params: [{ to: contract, data }, 'latest'],
        });
        if (result && result !== '0x') {
          const id = decodeUint256(result).toString();
          ids.push(id);
        }
      } catch (e) {
        // Non-enumerable contract or index out of bounds
        break;
      }
    }
    return ids;
  }

  // -------------------------------------------------------------------------
  // ERC-1155
  // -------------------------------------------------------------------------
  private async getERC1155Balance(wallet: string, contract: string, tokenId: string, chain: AssetChain): Promise<bigint> {
    const data = encodeERC1155BalanceOf(wallet, tokenId);
    const result = await rpcCall(chain, {
      method: 'eth_call',
      params: [{ to: contract, data }, 'latest'],
    });
    if (!result || result === '0x') return 0n;
    return decodeUint256(result);
  }

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------
  invalidateCache(address: string, chain?: AssetChain): void {
    if (chain) {
      this.cache.delete(this.cacheKey(address, chain));
    } else {
      this.cache.delete(this.cacheKey(address, 'ethereum'));
      this.cache.delete(this.cacheKey(address, 'base'));
    }
  }
}

export const assetDiscovery = new HyperCycleAssetDiscovery();
export default assetDiscovery;
