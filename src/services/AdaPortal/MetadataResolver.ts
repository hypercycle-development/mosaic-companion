/** ============================================================
 * CARDANO NFT METADATA RESOLVER SERVICE
 * ============================================================
 * Resolves on-chain CIP-25 metadata for Cardano assets via Koios,
 * with IPFS gateway conversion and local caching.
 *
 * Supports:
 *   - CIP-25 standard metadata
 *   - IPFS → HTTPS gateway URL conversion
 *   - Arweave URLs (pass-through)
 *   - On-chain metadata fallback via Koios /asset_info
 *   - Local per-session cache (Map)
 *
 * Phase: 2 of NFT Collection Card System
 * ============================================================ */

import type { StargateCollectionConfig } from './CollectionRegistry';
import { getVerifiedCollection } from './CollectionRegistry';

// ─── Types ──────────────────────────────────────────────────

export interface CIP25Metadata {
  name?: string;
  description?: string;
  image?: string;
  mediaType?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  files?: Array<{ name?: string; mediaType?: string; src: string }>;
  project?: string;
  version?: string;
  [key: string]: any;
}

export interface ResolvedNFTAsset {
  // Identity
  policyId: string;
  assetName: string;
  fingerprint: string;
  quantity: number;
  unit: string;                 // policyId + assetName (hex)
  // Metadata (CIP-25)
  metadata: CIP25Metadata | null;
  // Media
  imageUrl: string | null;
  mediaType: string | null;
  animationUrl: string | null;
  // Collection context
  collectionConfig?: StargateCollectionConfig;
  isVerified: boolean;
  // Raw
  rawOnChainMetadata?: any;
}

export interface ResolvedCollectionGroup {
  policyId: string;
  collectionName: string;
  collectionConfig?: StargateCollectionConfig;
  isVerified: boolean;
  accentColor: string;
  assets: ResolvedNFTAsset[];
  totalQuantity: number;
  // Merged metadata (first asset's metadata as representative)
  representativeMetadata?: CIP25Metadata | null;
}

// ─── IPFS Gateway ─────────────────────────────────────────────

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.blockfrost.dev/ipfs/',
];

export function resolveIPFSUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', IPFS_GATEWAYS[0]);
  }
  if (url.startsWith('ar://')) {
    return url.replace('ar://', 'https://arweave.net/');
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Bare CID (Q... or bafy...)
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-zA-Z0-9]{55,})/.test(url)) {
    return IPFS_GATEWAYS[0] + url;
  }
  return null;
}

// ─── Koios Client ─────────────────────────────────────────────

const KOIOS_BASE = 'https://api.koios.rest/api/v1';

async function koiosPost(endpoint: string, body: any): Promise<any> {
  const url = `${KOIOS_BASE}${endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`Koios ${endpoint}: HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── Metadata Resolver ─────────────────────────────────────────

class MetadataResolver {
  private cache = new Map<string, CIP25Metadata | null>(); // key: fingerprint

  async resolveAssets(
    assets: Array<{ policyId: string; assetName: string; fingerprint: string; quantity: number; unit: string }>
  ): Promise<ResolvedNFTAsset[]> {
    // Batch fetch metadata from Koios
    const fingerprints = assets.map(a => a.fingerprint).filter(Boolean);
    const metadataMap = await this._fetchBatchMetadata(fingerprints);

    return assets.map(asset => {
      const rawMeta = metadataMap.get(asset.fingerprint) || null;
      const meta = rawMeta ? this._normalizeCIP25(rawMeta) : null;
      const collectionConfig = getVerifiedCollection(asset.policyId);

      const imageUrl = resolveIPFSUrl(meta?.image) || collectionConfig?.logoImage || null;
      const mediaType = meta?.mediaType || 'image/png';
      const animationUrl = meta?.files?.find((f: any) =>
        f.mediaType?.startsWith('video/') || f.mediaType?.startsWith('audio/')
      )?.src
        ? resolveIPFSUrl(meta?.files?.find((f: any) =>
            f.mediaType?.startsWith('video/') || f.mediaType?.startsWith('audio/')
          )?.src)
        : null;

      return {
        ...asset,
        metadata: meta,
        imageUrl,
        mediaType,
        animationUrl,
        collectionConfig,
        isVerified: !!collectionConfig?.verified,
        rawOnChainMetadata: rawMeta,
      };
    });
  }

  async resolveCollectionGroups(
    assets: Array<{ policyId: string; assetName: string; fingerprint: string; quantity: number; unit: string }>
  ): Promise<ResolvedCollectionGroup[]> {
    const resolved = await this.resolveAssets(assets);

    // Group by policyId
    const groupMap = new Map<string, ResolvedNFTAsset[]>();
    for (const a of resolved) {
      const list = groupMap.get(a.policyId) || [];
      list.push(a);
      groupMap.set(a.policyId, list);
    }

    return Array.from(groupMap.entries()).map(([policyId, assets]) => {
      const collectionConfig = getVerifiedCollection(policyId);
      const totalQty = assets.reduce((s, a) => s + a.quantity, 0);
      const repMeta = assets.find(a => a.metadata)?.metadata || null;

      return {
        policyId,
        collectionName: collectionConfig?.collectionName || repMeta?.project || repMeta?.name || `Policy ${policyId.slice(0, 8)}...`,
        collectionConfig,
        isVerified: !!collectionConfig?.verified,
        accentColor: collectionConfig?.display.accentColor || '#3b82f6',
        assets,
        totalQuantity: totalQty,
        representativeMetadata: repMeta,
      };
    });
  }

  // ─── Internal ─────────────────────────────────────────────

  private async _fetchBatchMetadata(fingerprints: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const uncached: string[] = [];

    for (const fp of fingerprints) {
      const cached = this.cache.get(fp);
      if (cached !== undefined) {
        result.set(fp, cached);
      } else {
        uncached.push(fp);
      }
    }

    if (uncached.length === 0) return result;

    // Koios accepts max ~100 per batch; chunk if needed
    const CHUNK = 100;
    for (let i = 0; i < uncached.length; i += CHUNK) {
      const chunk = uncached.slice(i, i + CHUNK);
      try {
        const rows = await koiosPost('/asset_info', { _asset_list: chunk.map(fp => ({ asset_name: fp })) });
        for (const row of rows || []) {
          const fp = row.asset_name || row.fingerprint;
          const meta = row.minting_tx_metadata || row.onchain_metadata || row.metadata || null;
          if (fp) {
            this.cache.set(fp, meta);
            result.set(fp, meta);
          }
        }
      } catch (e) {
        console.warn('[MetadataResolver] Koios batch fetch failed:', e);
        // Mark as null so we don't retry within session
        for (const fp of chunk) {
          this.cache.set(fp, null);
          result.set(fp, null);
        }
      }
    }

    return result;
  }

  private _normalizeCIP25(raw: any): CIP25Metadata | null {
    if (!raw || typeof raw !== 'object') return null;

    // Koios may return metadata nested under "721" key (CIP-25 label)
    const data = raw['721'] || raw;

    return {
      name: data.name || data.title || null,
      description: data.description || data.desc || null,
      image: data.image || data.img || data.media || null,
      mediaType: data.mediaType || data.media_type || data.fileType || null,
      website: data.website || data.url || data.homepage || null,
      twitter: data.twitter || data.x || data.Twitter || null,
      discord: data.discord || data.Discord || null,
      telegram: data.telegram || data.Telegram || null,
      attributes: Array.isArray(data.attributes) ? data.attributes : data.traits || null,
      files: Array.isArray(data.files) ? data.files : null,
      project: data.project || data.collection || data.Project || null,
      version: data.version || data.schema || null,
    };
  }
}

export const metadataResolver = new MetadataResolver();
export default metadataResolver;
