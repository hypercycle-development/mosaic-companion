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

const DEFAULT_REGISTRY_URL = 'YOUR_FLEET_REGISTRY_URL';

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

  async loadFleetRegistry(): Promise<FleetNode[]> {
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
