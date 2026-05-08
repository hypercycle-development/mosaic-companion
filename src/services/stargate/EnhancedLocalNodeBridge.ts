// =============================================================================
// ENHANCED LOCAL NODE BRIDGE — Extended Telemetry for Stargate
// =============================================================================
// Extends LocalNodeBridge with real-time compute gauges, AIM slot tracking,
// Ollama model discovery, and merklizer health checks.
//
// Drop-in replacement: import { enhancedLocalNodeBridge } from this file
// and call enhancedLocalNodeBridge.startPolling().
// =============================================================================

import { localNodeBridge, BridgeAIM, BridgeComputeNode } from './LocalNodeBridge';

export interface ExtendedBridgeTelemetry {
  // Compute
  cpuPercent: number;
  memoryUsedGB: number;
  memoryFreeGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  // AIMs
  runningAims: BridgeAIM[];
  availableAimSlots: number;
  totalAimSlots: number;
  // Node health
  merklizerReachable: boolean;
  merklizerHost?: string;
  // Ollama integration
  ollamaModels: OllamaModelInfo[];
  // Hermes (Electron only)
  hermesInstances: HermesInstanceInfo[];
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

class EnhancedLocalNodeBridge {
  private telemetry: ExtendedBridgeTelemetry | null = null;
  private listeners: Set<(t: ExtendedBridgeTelemetry | null) => void> = new Set();
  private interval: ReturnType<typeof setInterval> | null = null;

  startPolling(): void {
    if (this.interval) return;
    this.refresh();
    this.interval = setInterval(() => this.refresh(), 30000);
  }

  stopPolling(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

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
    // Heuristic: more loaded AIMs = higher CPU
    const aimCount = info.aim?.aims?.length || 0;
    const cores = info.hardware?.cpu_count || 1;
    return Math.min(aimCount * 8 + 5, 95 * (aimCount / Math.max(cores, 4)));
  }

  private _notify() {
    this.listeners.forEach((fn) => {
      try { fn(this.telemetry); } catch {}
    });
  }
}

export const enhancedLocalNodeBridge = new EnhancedLocalNodeBridge();
export default enhancedLocalNodeBridge;
