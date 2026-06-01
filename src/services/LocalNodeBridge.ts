// =============================================================================
// LOCAL NODE BRIDGE — Bridge Mosaic to the local Hypercycle Node Manager
// =============================================================================
// Running on the same machine as the node, Mosaic should discover the local
// node at localhost:8006 without requiring blockchain/wallet lookups.
//
// Provides:
//   - normalizeLocalNodeInfo() → ComputeNode, ANFE, AIM, HBoxNode shapes
//   - startPolling() / stopPolling() → auto-refresh every 30s
//   - getLocalANFE() → ANFE object built from /api/info (no wallet needed)
//   - getLocalComputeNode() → ComputeNode enriched with live metrics
//   - getLocalAIMs() → AIM list from /api/info.aims
//
// This is the PRIMARY data source when Mosaic runs on the same host as the NM.
// =============================================================================

// ---------------------------------------------------------------------------
// Types — inline so this file has no cross-import dependencies (safe in Vite)
// ---------------------------------------------------------------------------
export interface LocalNodeInfo {
  status: string;
  name: string;
  address: string;
  node_version: string;
  node_id: string;
  protocol_version: string;
  network: string;
  license: string;
  platform: string;
  hardware: {
    memory: number;
    cpu_count: number;
    cpu_freq: number[];
    disk_space: number;
    disk_space_free: number;
    gpu: any;
  };
  aim: {
    interface_version: string;
    aims: LocalAIMInfo[];
  };
  priority: number;
  accepting_currencies: string[];
  geo_ip?: string;
  uptime_summary?: { heartbeats: number };
}

export interface LocalAIMInfo {
  image_id: string;
  image_name: string;
  image_tag: string;
  status: string;
  whitelisted: boolean;
  tries: number;
  slot: number;
  port: number;
}

export interface LocalNodeConfig {
  node_address: string;
  node_name: string;
  admin_port: number;
  admin_host: string;
  node_port: number;
  node_host: string;
  merklizer_hosts: string[];
  seed_hosts: string[];
  network: string;
  db_host: string;
  db_port: number;
  db_name: string;
}

// Shapes we emit for consumption by AdaPortalPanel / StargatePoolService
export interface BridgeComputeNode {
  nodeId: string;
  address: string;
  uptime: number;           // 0-1
  reliability: number;      // 0-1
  availableCompute: number; // TFLOPs
  pricePerHour: number;
  status: 'online' | 'offline' | 'busy';
  lastChecked: string;
  platform: 'local' | 'hyperinsight' | 'hyperaibox';
  licenseKey: string;
  nodeName: string;
  version: string;
  network: string;
  geoIp?: string;
  hardware: {
    memoryGB: number;
    cpuCount: number;
    diskGB: number;
    diskFreeGB: number;
  };
}

export interface BridgeANFE {
  id: string;
  tokenId: string;
  contractAddress: string;
  owner: string;
  chainId: number;
  chainName: string;
  name: string;
  status: string;
  computeUnits: string;
  level: number;
  rarity: string;
  license?: string;
  aims?: any[];
  attributes: Record<string, any>;
  verification: {
    valid: boolean;
    status: "offline" | "busy" | "alive" | "online" | string;
    nodeFactoryId: string;
    uptime: number;
    lastUpdated: number;
    merkelizer: any;
  };
  isLocal: true;
}

export interface BridgeAIM {
  imageId: string;
  name: string;
  tag: string;
  status: string;
  whitelisted: boolean;
  port: number;
  slot: number;
  nodeAddress: string;
}

// Bridge config
interface BridgeState {
  isAvailable: boolean;
  lastError: string | null;
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// LocalNodeBridge
// ---------------------------------------------------------------------------
const ADMIN_PORT = 8005;
const UI_PORT = 8006;
const POLL_MS = 30000;

class LocalNodeBridge {
  private nodeInfo: LocalNodeInfo | null = null;
  private nodeConfig: LocalNodeConfig | null = null;
  private state: BridgeState = { isAvailable: false, lastError: null, lastUpdated: 0 };
  private interval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<() => void> = new Set();

  // ---- Public API --------------------------------------------------------

  isAvailable(): boolean {
    return this.state.isAvailable;
  }

  getState(): BridgeState {
    return { ...this.state };
  }

  getRawInfo(): LocalNodeInfo | null {
    return this.nodeInfo;
  }

  getRawConfig(): LocalNodeConfig | null {
    return this.nodeConfig;
  }

  onUpdate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Start background polling — call once on app mount */
  startPolling(): void {
    if (this.interval) return;
    this.refresh();
    this.interval = setInterval(() => this.refresh(), POLL_MS);
  }

  stopPolling(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Manual refresh — returns whether node is alive */
  async refresh(): Promise<boolean> {
    const info = await this._fetchInfo();
    if (info) {
      this.nodeInfo = info;
      const config = await this._fetchConfig();
      this.nodeConfig = config;
      this.state = {
        isAvailable: true,
        lastError: null,
        lastUpdated: Date.now(),
      };
      this._notify();
      return true;
    } else {
      this.state.isAvailable = false;
      this._notify();
      return false;
    }
  }

  // ---- Normalized outputs --------------------------------------------------

    // Build an ANFE from the local node info (no wallet / blockchain needed)
  getLocalANFE(): any | null {
    if (!this.nodeInfo) return null;
    const info = this.nodeInfo;
    const heartbeats = info.uptime_summary?.heartbeats ?? 0;
    const uptime = Math.min(heartbeats / 25000, 0.999);
    const memGB = Math.round(info.hardware.memory / 1024 / 1024 / 1024);
    const diskGB = Math.round(info.hardware.disk_space / 1024 / 1024 / 1024);

    return {
      id: `local:${info.license}`,
      tokenId: info.license,
      license: info.license,
      contractAddress: '0x8c0075D087de9588DdF5c1441dF39828d695bc2f', // HyperCycle BASE ANFE
      owner: info.address || 'local-node',
      chainId: 8453,
      chainName: 'Base',
      blockNumber: 0,
      blockTimestamp: Date.now(),
      transactionHash: '',
      name: info.name || `HyperAIBox ${info.node_id?.slice(0, 8)}`,
      level: 11,
      rarity: memGB >= 16 ? 'epic' : memGB >= 8 ? 'rare' : 'common',
      status: 'active',
      computeUnits: this._computeUnitsLabel(info),
      attributes: {
        core: {
          primaryLicense: { trait_type: 'primaryLicense', value: info.license },
          level: { trait_type: 'level', value: 1 },
          computeToken: { trait_type: 'computeToken', value: diskGB },
        },
        ai: {
          aiModules: (info.aim?.aims ?? []).map((a) => ({
            trait_type: `c_${a.image_name}`,
            value: a.status,
          })),
        },
        raw: [
          { trait_type: 'nodeVersion', value: info.node_version },
          { trait_type: 'protocolVersion', value: info.protocol_version },
          { trait_type: 'platform', value: info.platform },
          { trait_type: 'cpuCount', value: info.hardware.cpu_count },
          { trait_type: 'memoryGB', value: memGB },
        ],
      },
      verification: {
        valid: true,
        anfeId: `local:${info.license}`,
        lastUpdated: Date.now(),
        nodeFactoryId: info.license,
        tranche: info.network || 'mainnet',
        uptime,
        reliability: uptime,
        status: uptime > 0.8 ? 'online' : 'offline',
        lastVerified: Date.now(),
        registeredAt: Date.now(),
      },
      metadata: {
        name: info.name || `HyperAIBox ${info.node_id?.slice(0, 8)}`,
        description: `HyperAIBox on ${info.platform} | ${info.hardware.cpu_count} cores | ${memGB}GB RAM`,
        image: '',
        attributes: [
          { trait_type: 'Node ID', value: info.node_id },
          { trait_type: 'Version', value: info.node_version },
          { trait_type: 'License', value: info.license },
          { trait_type: 'AIMs', value: info.aim?.aims?.length || 0 },
        ],
      },
      isLocal: true,
    };
  }
  /** Build a ComputeNode from local node info */
  getLocalComputeNode(): BridgeComputeNode | null {
    if (!this.nodeInfo) return null;
    const info = this.nodeInfo;
    const heartbeats = info.uptime_summary?.heartbeats ?? 0;
    const uptime = Math.min(heartbeats / 25000, 0.999);

    const memGB = Math.round(info.hardware.memory / 1024 / 1024 / 1024);
    const diskGB = Math.round(info.hardware.disk_space / 1024 / 1024 / 1024);
    const diskFreeGB = Math.round(info.hardware.disk_space_free / 1024 / 1024 / 1024);

    return {
      nodeId: info.node_id,
      address: info.address,
      uptime,
      reliability: uptime,
      availableCompute: diskFreeGB, // heuristic: free disk as compute proxy
      pricePerHour: 0.15,
      status: uptime > 0.8 ? 'online' : 'offline',
      lastChecked: new Date().toISOString(),
      platform: 'local',
      licenseKey: info.license,
      nodeName: info.name || 'Hypercycle Node',
      version: info.node_version,
      network: info.network,
      geoIp: info.geo_ip,
      hardware: {
        memoryGB: memGB,
        cpuCount: info.hardware.cpu_count,
        diskGB,
        diskFreeGB,
      },
    };
  }

  /** Get AIMs from the local node */
  getLocalAIMs(): BridgeAIM[] {
    if (!this.nodeInfo) return [];
    return (this.nodeInfo.aim?.aims ?? []).map((a) => ({
      imageId: a.image_id,
      name: a.image_name,
      tag: a.image_tag,
      status: a.status,
      whitelisted: a.whitelisted,
      port: a.port,
      slot: a.slot,
      nodeAddress: this.nodeInfo!.address,
    }));
  }

  /** Build an HBox-style node for the local node */
  getLocalHBoxNode() {
    const compute = this.getLocalComputeNode();
    if (!compute) return null;
    return {
      nodeId: compute.nodeId,
      address: compute.nodeName,
      uptime: compute.uptime,
      reliability: compute.reliability,
      availableCompute: compute.availableCompute,
      pricePerHour: compute.pricePerHour,
      status: compute.status === 'online' ? 'active' : compute.status,
      lastChecked: compute.lastChecked,
      platform: 'hyperaibox' as const,
      apiHost: 'localhost',
      apiPort: this.nodeConfig?.node_port || 8000,
      licenseKey: compute.licenseKey,
      isDelegated: false,
      hasHermes: false,
    };
  }

  // ---- Internal fetchers ---------------------------------------------------

  private async _fetchInfo(): Promise<LocalNodeInfo | null> {
    // Try through Vite proxy first, then direct backend
    // In Electron renderer with file:// protocol, relative URLs fail.
    const isElectronFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
    const urls = isElectronFileProtocol
      ? [
          `http://localhost:${UI_PORT}/api/info`,
          `http://localhost:${ADMIN_PORT}/info`,
        ]
      : [
          `http://localhost:${UI_PORT}/api/info`,
          `/api/info`,
          `http://localhost:${ADMIN_PORT}/info`,
        ];
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.status === 'alive') return json as LocalNodeInfo;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async _fetchConfig(): Promise<LocalNodeConfig | null> {
    // In Electron renderer, relative URLs resolve to file:// protocol and always fail.
    // Skip the relative URL and go straight to absolute localhost URLs.
    const isElectronFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
    const urls = isElectronFileProtocol
      ? [
          `http://localhost:${UI_PORT}/api/config`,
          `http://localhost:${ADMIN_PORT}/config`,
        ]
      : [
          `/api/config`,
          `http://localhost:${UI_PORT}/api/config`,
          `http://localhost:${ADMIN_PORT}/config`,
        ];
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.node_address) return json as LocalNodeConfig;
      } catch {
        continue;
      }
    }
    return null;
  }

  private _notify() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }

  private _computeUnitsLabel(info: LocalNodeInfo): string {
    const memGB = Math.round(info.hardware.memory / 1024 / 1024 / 1024);
    const cores = info.hardware.cpu_count;
    if (memGB >= 16 && cores >= 8) return 'High';
    if (memGB >= 8 && cores >= 4) return 'Medium';
    return 'Standard';
  }
}

export const localNodeBridge = new LocalNodeBridge();
export default localNodeBridge;
