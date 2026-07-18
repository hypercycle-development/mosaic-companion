// =============================================================================
// FLEET DISCOVERY SERVICE — Discover DAO fleet nodes for Stargate
// =============================================================================
// HyperAIBox nodes have no SSH/LAN reachability. Discovery uses a public
// fleet registry (Gist or similar) that each node updates with its status.
//
// Usage:
//   const fleet = new FleetDiscoveryService();
//   const nodes = await fleet.loadFleetRegistry();
//   const online = await fleet.pollFleetStatus(nodes);
// =============================================================================

export interface FleetNode {
  nodeId: string;
  name: string;
  apiHost: string;
  apiPort: number;
  anfeLicense: string;
  hasHermes: boolean;
  lastSeen: number;
  computeGrade: 'standard' | 'high' | 'dedicated';
  hermesProfile?: string;
  gatewayChannel?: string; // e.g., "telegram:12345678"
}

export interface FleetRegistry {
  updatedAt: number;
  nodes: FleetNode[];
}

export interface FleetNodeStatus {
  node: FleetNode;
  online: boolean;
  latencyMs: number;
  info?: any;
}

export interface EnrichedFleetNode extends FleetNode {
  hyperinsight?: {
    licenseKey: string;
    name: string | null;
    region: string | null;
    isAlive: boolean;
    uptimePercent: number;
    gpuName: string | null;
    gpuCount: number;
    cpuCount: number;
    ramBytes: number;
    aimsCount: number;
    platform: string;
    lastContactAt: string | null;
    compatibleAims?: number;
  };
}

// SECURITY: No hard-coded default registry. Each user must configure their own
// fleet registry URL via setRegistryUrl() or add nodes in Settings -> Hypercycle Nodes
// so that personal node IPs / ANFE licenses never leak into shared git history.
const DEFAULT_REGISTRY_URL = '';

class FleetDiscoveryService {
  private registryUrl: string;
  private cache: FleetNode[] = [];
  private lastFetch = 0;
  private cacheTTL = 5 * 60 * 1000; // 5 min

  constructor(registryUrl?: string) {
    this.registryUrl = registryUrl || localStorage.getItem('fleet_registry_url') || DEFAULT_REGISTRY_URL;
  }

  setRegistryUrl(url: string): void {
    this.registryUrl = url;
    localStorage.setItem('fleet_registry_url', url);
    this.cache = [];
    this.lastFetch = 0;
  }

  /** True when an explicit registry URL has been configured. */
  isConfigured(): boolean {
    return !!(this.registryUrl && this.registryUrl.trim().startsWith('http'));
  }

  /**
   * Load fleet nodes. Priority:
   *   1. Explicit fleet registry URL (if configured)
   *   2. User's locally-configured Hypercycle Nodes from Settings
   *
   * Returns empty array if neither source is available — this ensures a fresh
   * install never accidentally displays another user's private infrastructure.
   */
  async loadFleetRegistry(): Promise<FleetNode[]> {
    // ── 1. Explicit registry URL ─────────────────────────────────────────────
    if (this.registryUrl) {
      if (this.cache.length > 0 && Date.now() - this.lastFetch < this.cacheTTL) {
        return this.cache;
      }
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(this.registryUrl, { signal: ctrl.signal });
        clearTimeout(to);
        if (!res.ok) throw new Error(`Registry HTTP ${res.status}`);
        const data: FleetRegistry = await res.json();
        this.cache = data.nodes || [];
        this.lastFetch = Date.now();
        // Persist for SSH dispatch lookups
        localStorage.setItem('fleet_registry_nodes', JSON.stringify(this.cache));
        return this.cache;
      } catch (err: any) {
        console.error('[FleetDiscovery] Registry fetch failed:', err.message);
        return this.cache.length > 0 ? this.cache : [];
      }
    }

    // ── 2. Fallback: user's locally-configured Hypercycle Nodes ────────────
    try {
      const api = (window as any).electronAPI?.nodes?.get;
      if (!api) { console.warn('[FleetDiscovery] No fleet registry configured and electronAPI.nodes unavailable'); return []; }
      const rawNodes: any[] = await api();
      const nodes: FleetNode[] = rawNodes
        .filter((n: any) => n.isActive && n.apiHost)
        .map((n: any) => ({
          nodeId: String(n.id || n.nodeId || crypto.randomUUID()),
          name: n.name || n.id || 'Unnamed Node',
          apiHost: n.apiHost,
          apiPort: Number(n.apiPort || 8000),
          anfeLicense: n.licenseKey || n.anfeLicense || '',
          hasHermes: n.hasHermes === true,
          lastSeen: Date.now(),
          computeGrade: n.computeGrade || 'standard',
        }));
      this.cache = nodes;
      this.lastFetch = Date.now();
      return nodes;
    } catch (err: any) {
      console.warn('[FleetDiscovery] No fleet registry configured and local nodes unreadable:', err.message);
      return [];
    }
  }

  async pollFleetStatus(nodes: FleetNode[]): Promise<FleetNodeStatus[]> {
    const results = await Promise.all(
      nodes.map(async (node) => {
        const start = performance.now();
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(`http://${node.apiHost}:${node.apiPort}/api/info`, { signal: ctrl.signal });
          clearTimeout(to);
          const info = res.ok ? await res.json() : undefined;
          return {
            node,
            online: res.ok && info?.status === 'alive',
            latencyMs: Math.round(performance.now() - start),
            info,
          };
        } catch {
          return { node, online: false, latencyMs: 5000 };
        }
      })
    );
    return results;
  }

  async enrichWithHyperInsight(nodes: FleetNode[]): Promise<EnrichedFleetNode[]> {
    try {
      const api = (window as any).electronAPI?.hyperinsight;
      if (!api) return nodes as EnrichedFleetNode[];

      const hiNodesRes = await api.getNodes({ pageSize: '500' }).catch(() => null);
      const hiNodesData = hiNodesRes?.data || [];
      const hiMap = new Map<string, any>();
      for (const n of hiNodesData) {
        const key = String(n.licenseKey || n.license || '');
        if (key) hiMap.set(key, n);
      }

      return nodes.map((node) => {
        const hi = hiMap.get(String(node.anfeLicense));
        if (!hi) return node as EnrichedFleetNode;
        return {
          ...node,
          hyperinsight: {
            licenseKey: String(hi.licenseKey || hi.license || ''),
            name: hi.name || null,
            region: hi.region || null,
            isAlive: hi.isAlive !== false,
            uptimePercent: hi.uptimePercent || 0,
            gpuName: hi.gpuName || null,
            gpuCount: hi.gpuCount || 0,
            cpuCount: hi.cpuCount || 0,
            ramBytes: hi.ramBytes || 0,
            aimsCount: hi.aimsCount || 0,
            platform: hi.platform || '',
            lastContactAt: hi.lastContactAt || null,
          },
        };
      });
    } catch (e: any) {
      console.error('[FleetDiscovery] HyperInsight enrichment failed:', e.message);
      return nodes as EnrichedFleetNode[];
    }
  }

  async discoverLocalPeers(): Promise<FleetNode[]> {
    // mDNS / Bonjour discovery if available (Electron only)
    try {
      const api = (window as any).electronAPI?.system?.mdnsDiscover;
      if (!api) return [];
      const peers = await api('_hyperaibox._tcp');
      return (peers || []).map((p: any) => ({
        nodeId: p.txt?.nodeId || p.name,
        name: p.name,
        apiHost: p.address,
        apiPort: p.port,
        anfeLicense: p.txt?.license || '',
        hasHermes: p.txt?.hasHermes === 'true',
        lastSeen: Date.now(),
        computeGrade: p.txt?.grade || 'standard',
      }));
    } catch {
      return [];
    }
  }

  getCachedFleet(): FleetNode[] {
    return this.cache;
  }
}

export const fleetDiscoveryService = new FleetDiscoveryService();
export default FleetDiscoveryService;
