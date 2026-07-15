// =============================================================================
// ENHANCED LOCAL NODE BRIDGE — Extended Telemetry for Stargate
// =============================================================================
// Extends LocalNodeBridge with real-time compute gauges, AIM slot tracking,
// Ollama model discovery, merklizer health checks, and validator fleet telemetry.
//
// Drop-in replacement: import { enhancedLocalNodeBridge } from this file
// and call enhancedLocalNodeBridge.startPolling().
// =============================================================================

import { localNodeBridge, BridgeAIM, BridgeComputeNode } from './LocalNodeBridge';
import type { ValidatorPoolStatus, ValidatorNode } from '../StargatePool/ANFETypes';

export interface ExtendedBridgeTelemetry {
  cpuPercent: number;
  memoryUsedGB: number;
  memoryFreeGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  runningAims: BridgeAIM[];
  availableAimSlots: number;
  totalAimSlots: number;
  merklizerReachable: boolean;
  merklizerHost?: string;
  ollamaModels: OllamaModelInfo[];
  hermesInstances: HermesInstanceInfo[];
  validatorPool: ValidatorPoolStatus | null;
}

export interface OllamaModelInfo {
  name: string;
  size: string;
  parameterCount: string;
  loaded: boolean;
}

export interface HermesInstanceInfo {
  pid: number;
  profile: string;
  uptime: number;
  status: 'active' | 'idle' | 'error';
}

export interface ValidatorEndpoint {
  nodeId: string;
  moniker: string;
  host: string;
  cometBftPort: number;
  network: string;
}

const DEFAULT_VALIDATOR_ENDPOINTS: ValidatorEndpoint[] = [
  { nodeId: 'r2d2', moniker: 'batteryagi-validator-2', host: '192.168.0.38', cometBftPort: 26657, network: 'batterycoin-1' },
  { nodeId: 'c3po', moniker: 'batteryagi-validator-1', host: '192.168.0.150', cometBftPort: 26657, network: 'batterycoin-1' },
];

class EnhancedLocalNodeBridge {
  private telemetry: ExtendedBridgeTelemetry | null = null;
  private listeners: Set<(t: ExtendedBridgeTelemetry | null) => void> = new Set();
  private interval: ReturnType<typeof setInterval> | null = null;

  // ---------------------------------------------------------------------------
  // Validator telemetry cache + polling
  // ---------------------------------------------------------------------------
  private _telemetryCache: Map<string, ValidatorNode> = new Map();
  private _validatorEndpoints: ValidatorEndpoint[] = [...DEFAULT_VALIDATOR_ENDPOINTS];
  private _validatorInterval: ReturnType<typeof setInterval> | null = null;

  startPolling(): void {
    if (this.interval) return;
    this.refresh();
    this.interval = setInterval(() => this.refresh(), 30000);
    this._startValidatorPolling();
  }

  stopPolling(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this._validatorInterval) {
      clearInterval(this._validatorInterval);
      this._validatorInterval = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Validator endpoint management
  // ---------------------------------------------------------------------------
  setValidatorEndpoints(endpoints: ValidatorEndpoint[]): void {
    this._validatorEndpoints = endpoints;
    // Restart validator polling with new endpoints
    if (this._validatorInterval) {
      clearInterval(this._validatorInterval);
      this._validatorInterval = null;
      this._startValidatorPolling();
    }
  }

  getValidatorEndpoints(): ValidatorEndpoint[] {
    return [...this._validatorEndpoints];
  }

  addValidatorEndpoint(ep: ValidatorEndpoint): void {
    if (!this._validatorEndpoints.find(e => e.nodeId === ep.nodeId)) {
      this._validatorEndpoints.push(ep);
    }
  }

  removeValidatorEndpoint(nodeId: string): void {
    this._validatorEndpoints = this._validatorEndpoints.filter(e => e.nodeId !== nodeId);
    this._telemetryCache.delete(nodeId);
  }

  // ---------------------------------------------------------------------------
  // Main telemetry refresh (30s)
  // ---------------------------------------------------------------------------
  async refresh(): Promise<ExtendedBridgeTelemetry | null> {
    const info = localNodeBridge.getRawInfo();
    const config = localNodeBridge.getRawConfig();
    if (!info) {
      this.telemetry = null;
      this._notify();
      return null;
    }

    const memGB = info.hardware.memory / 1024 / 1024 / 1024;
    const diskGB = info.hardware.disk_space / 1024 / 1024 / 1024;
    const diskFreeGB = info.hardware.disk_space_free / 1024 / 1024 / 1024;
    const aims = localNodeBridge.getLocalAIMs();

    const merklizerHost = config?.merklizer_hosts?.[0];
    const merklizerReachable = merklizerHost
      ? await this._pingHost(merklizerHost)
      : false;

    const [ollamaModels, hermesInstances] = await Promise.all([
      this._fetchOllamaModels(),
      this._detectHermesInstances(),
    ]);

    const validatorPool = this.getValidatorPoolStatus();

    this.telemetry = {
      cpuPercent: this._estimateCpu(info),
      memoryUsedGB: +(memGB * 0.3).toFixed(1),
      memoryFreeGB: +(memGB * 0.7).toFixed(1),
      diskUsedGB: +(diskGB - diskFreeGB).toFixed(1),
      diskFreeGB: +diskFreeGB.toFixed(1),
      runningAims: aims,
      availableAimSlots: Math.max(0, 8 - aims.length),
      totalAimSlots: 8,
      merklizerReachable,
      merklizerHost,
      ollamaModels,
      hermesInstances,
      validatorPool,
    };

    this._notify();
    return this.telemetry;
  }

  getTelemetry(): ExtendedBridgeTelemetry | null {
    return this.telemetry;
  }

  onUpdate(fn: (t: ExtendedBridgeTelemetry | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------------------------------------------------------------------------
  // Validator pool status — assembled from the 5s cache
  // ---------------------------------------------------------------------------
  getValidatorPoolStatus(): ValidatorPoolStatus | null {
    const nodes = Array.from(this._telemetryCache.values());
    if (nodes.length === 0) return null;
    const highest = nodes.reduce((m, n) => Math.max(m, n.blockHeight), 0);
    return {
      validators: nodes,
      totalValidators: nodes.length,
      onlineValidators: nodes.filter(n => n.isOnline).length,
      syncedValidators: nodes.filter(n => n.syncStatus === 'synced').length,
      highestBlock: highest,
      lastUpdated: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Telemetry-driven recommendations (Start tab)
  // ---------------------------------------------------------------------------
  getRecommendedIntents(): string[] {
    const t = this.telemetry;
    if (!t) return ['launch_project', 'build_dapp', 'automate_workflows', 'grow_dao'];
    const recs: string[] = [];
    if (t.availableAimSlots >= 4) recs.push('launch_project', 'build_dapp');
    if (t.memoryFreeGB >= 8) recs.push('automate_workflows');
    if (t.ollamaModels.length > 0) recs.push('train_agents');
    if (t.merklizerReachable) recs.push('grow_dao');
    if (recs.length === 0) recs.push('automate_workflows');
    return [...new Set(recs)];
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------
  private async _fetchOllamaModels(): Promise<OllamaModelInfo[]> {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch('http://localhost:11434/api/tags', { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        name: m.name || 'unknown',
        size: m.size ? `${(m.size / 1e9).toFixed(1)}GB` : 'unknown',
        parameterCount: m.details?.parameter_size || 'unknown',
        loaded: !!m.loaded,
      }));
    } catch {
      return [];
    }
  }

  private async _detectHermesInstances(): Promise<HermesInstanceInfo[]> {
    try {
      const api = (window as any).electronAPI?.system?.getProcesses;
      if (!api) return [];
      const procs = await api('hermes');
      return (procs || [])
        .filter((p: any) => p.command && p.command.includes('hermes'))
        .map((p: any) => ({
          pid: p.pid || 0,
          profile: p.command.match(/--profile\s+(\w+)/)?.[1] || 'default',
          uptime: p.uptime || 0,
          status: p.cpu > 0.1 ? 'active' : 'idle',
        }));
    } catch {
      return [];
    }
  }

  private async _pingHost(hostWithPort: string): Promise<boolean> {
    try {
      const [host, portStr] = hostWithPort.split(':');
      const port = parseInt(portStr || '8003', 10);
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`http://${host}:${port}/health`, { signal: ctrl.signal });
      clearTimeout(to);
      return res.ok;
    } catch {
      return false;
    }
  }

  private _estimateCpu(info: any): number {
    const aimCount = info.aim?.aims?.length || 0;
    const cores = info.hardware?.cpu_count || 1;
    return Math.min(aimCount * 8 + 5, 95 * (aimCount / Math.max(cores, 4)));
  }

  // ---------------------------------------------------------------------------
  // Validator polling — every 5s via http.request (Node main-process path)
  // ---------------------------------------------------------------------------
  private _startValidatorPolling(): void {
    if (this._validatorInterval) return;
    this._pollAllValidators();
    this._validatorInterval = setInterval(() => this._pollAllValidators(), 5000);
  }

  private async _pollAllValidators(): Promise<void> {
    await Promise.all(this._validatorEndpoints.map(ep => this._pollValidatorStatus(ep)));
  }

  private async _pollValidatorStatus(ep: ValidatorEndpoint): Promise<void> {
    const url = `http://${ep.host}:${ep.cometBftPort}/status`;
    try {
      const data = await this._httpGetJson(url, 3000);
      const si = data?.result?.node_info;
      const sync = data?.result?.sync_info;
      if (si && sync) {
        const catchingUp = sync.catching_up === true;
        const now = Date.now();
        const node: ValidatorNode = {
          moniker: si.moniker || ep.moniker,
          nodeId: si.id || ep.nodeId,
          address: `${ep.host}:${ep.cometBftPort}`,
          blockHeight: parseInt(sync.latest_block_height || '0', 10),
          maxBlockHeight: parseInt(sync.latest_block_height || '0', 10),
          peerCount: data?.result?.peers ?? 0, // not in /status; placeholder
          syncStatus: catchingUp ? 'catching_up' : 'synced',
          lastSeen: now,
          isOnline: true,
          cometBftVersion: si.version,
          network: si.network || ep.network,
          earliestBlockHeight: parseInt(sync.earliest_block_height || '0', 10),
        };
        this._telemetryCache.set(ep.nodeId, node);
      }
    } catch {
      // Mark offline on any failure
      const cached = this._telemetryCache.get(ep.nodeId);
      const now = Date.now();
      if (cached) {
        this._telemetryCache.set(ep.nodeId, {
          ...cached,
          isOnline: false,
          syncStatus: 'offline',
          lastSeen: now,
        });
      } else {
        this._telemetryCache.set(ep.nodeId, {
          moniker: ep.moniker,
          nodeId: ep.nodeId,
          address: `${ep.host}:${ep.cometBftPort}`,
          blockHeight: 0,
          maxBlockHeight: 0,
          peerCount: 0,
          syncStatus: 'offline',
          lastSeen: now,
          isOnline: false,
          network: ep.network,
        });
      }
    }
  }

  /** Lightweight http.request wrapper that works in both Electron main and renderer */
  private _httpGetJson(url: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      // Renderer path: fetch is always available
      if (typeof fetch !== 'undefined') {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        fetch(url, { signal: ctrl.signal })
          .then(async (res) => {
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            resolve(await res.json());
          })
          .catch(reject);
        return;
      }

      // Main-process / Node path: http.request
      try {
        const http = require('http');
        const parsed = new URL(url);
        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: { Accept: 'application/json' },
          timeout: timeoutMs,
        };
        const req = http.request(options, (res: any) => {
          let body = '';
          res.on('data', (chunk: any) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private _notify() {
    this.listeners.forEach((fn) => {
      try { fn(this.telemetry); } catch {}
    });
  }
}

export const enhancedLocalNodeBridge = new EnhancedLocalNodeBridge();
export default enhancedLocalNodeBridge;
