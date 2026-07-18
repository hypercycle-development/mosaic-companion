// @ts-nocheck
// =============================================================================
// STARGATE POOL - Merkelizer Service (v2 — HyperInsight bridge)
// =============================================================================
// The old IP-based Merkelizer is dead. This service:
// - Verifies/enriches ANFE metadata via HyperInsight API
// - Provides node uptime, tranche, status from live network data
// =============================================================================

export interface VerificationResult {
  valid: boolean;
  anfeId: string;
  merkleRoot?: string;
  proof?: string;
  lastUpdated?: number;
  error?: string;
  nodeFactoryId?: string;
  tranche?: string;
  uptime?: number;
  reliability?: number;
  lastVerified?: number;
  status?: 'online' | 'offline' | 'busy';
  registeredAt?: number;
}

export interface NodeInfo {
  nodeId: string;
  address: string;
  uptime: number;
  status: 'online' | 'offline' | 'busy';
  lastVerified: number;
  nodeFactoryId?: string;
  tranche?: string;
  reliability?: number;
  registeredAt?: number;
}

export interface UptimeInfo {
  totalNodes: number;
  onlineNodes: number;
  avgUptime: number;
}

interface MerkelizerVerifyResponse {
  valid: boolean;
  anfeId: string;
  merkleRoot?: string;
  proof?: string;
}

interface MerkelizerNodesResponse {
  nodes: Array<{ id: string; address: string; uptime: string; status: string; lastVerified: string }>;
}

// Legacy fallback URL (now points to HyperInsight bridge; old IP-based Merkelizer is dead)
const FALLBACK_MERKELIZER_URL = 'https://api.hyperinsight.app/v1';

// Primary: HyperInsight API
const HI_BASE   = 'https://api.hyperinsight.app/v1';
const HI_KEY    = 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk';
const HI_HEADERS: Record<string,string> = {
  'Authorization': `Bearer ${HI_KEY}`,
  'Accept': 'application/json',
};

async function hiFetch(path: string): Promise<any|null> {
  try {
    const r = await fetch(`${HI_BASE}${path}`, { headers: HI_HEADERS });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

class MerkelizerService {
  private baseUrl: string;
  private cache: Map<string, { data: VerificationResult; timestamp: number }> = new Map();
  private cacheTTL = 60000;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || FALLBACK_MERKELIZER_URL;
    console.log('[MerkelizerService] Initialized — primary HyperInsight, legacy fallback:', this.baseUrl);
  }

  /** Verify ANFE — PRIMARY: HyperInsight node detail */
  async verifyANFE(anfeId: string): Promise<VerificationResult> {
    const cacheKey = `verify:${anfeId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) return cached.data;

    try {
      const node = await hiFetch(`/nodes/${anfeId}`);
      if (node && (node.licenseKey || node.isAlive !== undefined)) {
        const result: VerificationResult = {
          valid: node.isAlive === true || node.isAlive === undefined,
          anfeId,
          lastUpdated: Date.now(),
          nodeFactoryId: node.licenseKey ? String(node.licenseKey) : undefined,
          tranche: node.network || 'BASE',
          uptime: node.measuredUptime ?? node.uptimePercent ?? undefined,
          reliability: node.measuredUptime ?? undefined,
          lastVerified: Date.now(),
          status: node.isAlive ? 'online' : 'offline',
          registeredAt: node.lastContactAt ? new Date(node.lastContactAt).getTime() : undefined,
        };
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    } catch (e) { console.warn('[MerkelizerService] HyperInsight verifyANFE failed:', e); }

    // LEGACY FALLBACK (dead, but safe)
    try {
      const r = await fetch(`${this.baseUrl}/verify`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ anfeId }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: VerificationResult = await r.json();
      data.lastUpdated = Date.now(); data.anfeId = anfeId;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.warn('[MerkelizerService] Legacy verify also failed:', error);
      return { valid: false, anfeId, error: 'HyperInsight unreachable' };
    }
  }

  /** Node details — PRIMARY: HyperInsight */
  async getNodeDetails(anfeId: string): Promise<NodeInfo|null> {
    try {
      const node = await hiFetch(`/nodes/${anfeId}`);
      if (!node) return null;
      return {
        nodeId: String(node.licenseKey || anfeId),
        address: node.coldWalletAddress || node.hotWalletAddress || '',
        uptime: node.measuredUptime ?? node.uptimePercent ?? 0,
        status: node.isAlive ? 'online' : 'offline',
        lastVerified: node.lastContactAt ? new Date(node.lastContactAt).getTime() : Date.now(),
        nodeFactoryId: node.licenseKey ? String(node.licenseKey) : undefined,
        tranche: node.network || 'BASE',
        reliability: node.measuredUptime ?? 0,
        registeredAt: node.lastContactAt ? new Date(node.lastContactAt).getTime() : undefined,
      };
    } catch (e) { console.warn('[MerkelizerService] HyperInsight getNodeDetails failed:', e); return null; }
  }

  /** Not available on HyperInsight as a wallet mapping endpoint */
  async getANFEsByOwner(_walletAddress: string): Promise<VerificationResult[]> { return []; }
  async getAllANFEs(): Promise<VerificationResult[]> { return []; }

  clearCache(): void { this.cache.clear(); }

  async healthCheck(): Promise<boolean> {
    try {
      const r = await fetch(`${HI_BASE}/auth/me`, { headers: HI_HEADERS });
      return r.ok;
    } catch { return false; }
  }
}

export const merkelizerService = new MerkelizerService();
