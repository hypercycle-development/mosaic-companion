// =============================================================================
// STARGATE INTEGRATIONS — Fleet-as-Sandbox
// Fleet nodes ARE sandbox containers with Docker isolation + gatekeeper + Chronicle
// =============================================================================

import {
  unifiedOrchestrator,
  type FleetNode,
} from './UnifiedOrchestrator';

// =============================================================================
// Sandbox Types
// =============================================================================

export type SandboxTier = 'isolated' | 'standard' | 'elevated';

export interface FleetSandboxConfig {
  nodeId: string;
  image: string;
  ports: number[];
  env: Record<string, string>;
  volumes: string[];
  networkMode: 'bridge' | 'host' | 'none';
  memoryLimit: string;
  cpuLimit: number;
  tier: SandboxTier;
  allowedDomains: string[];
  allowedPorts: number[];
}

export interface FleetSandboxStatus {
  nodeId: string;
  containerId: string | null;
  status: 'stopped' | 'running' | 'paused' | 'error';
  uptime: number;
  networkPolicy: 'allow' | 'filtered' | 'deny';
  lastAuditHash: string;
}

export interface SandboxPolicy {
  nodeId: string;
  tier: SandboxTier;
  internet: boolean;
  allowedDomains: string[];
  allowedPorts: number[];
  blockOutgoing: boolean;
  auditLevel: 'full' | 'errors' | 'none';
}

// =============================================================================
// FleetSandboxLauncher
// =============================================================================

class FleetSandboxLauncher {
  private sandboxes: Map<string, FleetSandboxConfig> = new Map();
  private statuses: Map<string, FleetSandboxStatus> = new Map();
  private policies: Map<string, SandboxPolicy> = new Map();

  // ---------------------------------------------------------------------------
  // Default sandbox configs per tier
  // ---------------------------------------------------------------------------

  private getTierDefaults(tier: SandboxTier): Partial<FleetSandboxConfig> {
    switch (tier) {
      case 'isolated':
        return {
          networkMode: 'none',
          memoryLimit: '512m',
          cpuLimit: 0.5,
          allowedDomains: [],
          allowedPorts: [],
        };
      case 'standard':
        return {
          networkMode: 'bridge',
          memoryLimit: '2g',
          cpuLimit: 1.0,
          allowedDomains: ['*.hypercycle.io', '*.blockfrost.io'],
          allowedPorts: [443, 80],
        };
      case 'elevated':
        return {
          networkMode: 'bridge',
          memoryLimit: '8g',
          cpuLimit: 2.0,
          allowedDomains: ['*'],
          allowedPorts: [443, 80, 22, 8000, 8005, 8006],
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Sandbox lifecycle
  // ---------------------------------------------------------------------------

  createSandbox(nodeId: string, tier: SandboxTier = 'standard'): FleetSandboxConfig {
    const defaults = this.getTierDefaults(tier);
    const config: FleetSandboxConfig = {
      nodeId,
      image: 'hypercycle/fleet-node:latest',
      ports: defaults.allowedPorts || [443],
      env: {
        NODE_ID: nodeId,
        TIER: tier,
        SANDBOX: 'true',
      },
      volumes: [`/var/lib/stargate/${nodeId}:/data`],
      networkMode: defaults.networkMode || 'bridge',
      memoryLimit: defaults.memoryLimit || '2g',
      cpuLimit: defaults.cpuLimit || 1.0,
      tier,
      allowedDomains: defaults.allowedDomains || [],
      allowedPorts: defaults.allowedPorts || [443],
    };

    this.sandboxes.set(nodeId, config);

    // Derive policy from tier
    this.policies.set(nodeId, {
      nodeId,
      tier,
      internet: tier !== 'isolated',
      allowedDomains: config.allowedDomains,
      allowedPorts: config.allowedPorts,
      blockOutgoing: tier === 'isolated',
      auditLevel: tier === 'elevated' ? 'full' : 'errors',
    });

    this.statuses.set(nodeId, {
      nodeId,
      containerId: null,
      status: 'stopped',
      uptime: 0,
      networkPolicy: tier === 'isolated' ? 'deny' : 'filtered',
      lastAuditHash: '',
    });

    return config;
  }

  async launchSandbox(nodeId: string): Promise<{ success: boolean; error?: string }> {
    const config = this.sandboxes.get(nodeId);
    const status = this.statuses.get(nodeId);
    if (!config || !status) {
      return { success: false, error: `No sandbox config for ${nodeId}` };
    }

    try {
      const ipc = (window as any).electronAPI?.stargate;
      if (!ipc?.launchSandbox) {
        // Fallback: dispatch Docker run command via SSH
        const dockerCmd = this.buildDockerRunCommand(config);
        const result = await unifiedOrchestrator.dispatchToFleet(
          dockerCmd,
          [nodeId],
          'parallel',
        );

        const nodeResult = result.nodeResults[0];
        if (nodeResult?.status === 'completed') {
          status.status = 'running';
          status.containerId = `stargate-${nodeId}`;
          status.uptime = 0;
          this.logToChronicle(nodeId, 'sandbox:launch', 'success');
          return { success: true };
        }

        this.logToChronicle(nodeId, 'sandbox:launch', 'failed', nodeResult?.error);
        return { success: false, error: nodeResult?.error || 'Launch failed' };
      }

      // Native Electron sandbox launcher
      const result = await ipc.launchSandbox(config);
      if (result.success) {
        status.status = 'running';
        status.containerId = result.containerId;
      }
      return result;
    } catch (e: any) {
      this.logToChronicle(nodeId, 'sandbox:launch', 'error', e.message);
      return { success: false, error: e.message };
    }
  }

  async stopSandbox(nodeId: string): Promise<{ success: boolean }> {
    const status = this.statuses.get(nodeId);
    if (!status || status.status === 'stopped') {
      return { success: true };
    }

    try {
      const ipc = (window as any).electronAPI?.stargate;
      if (ipc?.stopSandbox) {
        await ipc.stopSandbox(nodeId);
      } else {
        // Fallback SSH
        await unifiedOrchestrator.dispatchToFleet(
          `docker stop stargate-${nodeId}`,
          [nodeId],
          'parallel',
        );
      }

      status.status = 'stopped';
      status.uptime = 0;
      this.logToChronicle(nodeId, 'sandbox:stop', 'success');
      return { success: true };
    } catch (e: any) {
      this.logToChronicle(nodeId, 'sandbox:stop', 'error', e.message);
      return { success: false };
    }
  }

  getSandboxConfig(nodeId: string): FleetSandboxConfig | undefined {
    return this.sandboxes.get(nodeId);
  }

  getSandboxStatus(nodeId: string): FleetSandboxStatus | undefined {
    return this.statuses.get(nodeId);
  }

  getPolicy(nodeId: string): SandboxPolicy | undefined {
    return this.policies.get(nodeId);
  }

  getAllSandboxes(): FleetSandboxConfig[] {
    return Array.from(this.sandboxes.values());
  }

  getAllStatuses(): FleetSandboxStatus[] {
    return Array.from(this.statuses.values());
  }

  // ---------------------------------------------------------------------------
  // Tier migration
  // ---------------------------------------------------------------------------

  async upgradeTier(nodeId: string, newTier: SandboxTier): Promise<{ success: boolean }> {
    const current = this.sandboxes.get(nodeId);
    if (!current) return { success: false };

    // Stop → recreate with new tier → restart
    await this.stopSandbox(nodeId);
    this.createSandbox(nodeId, newTier);
    const result = await this.launchSandbox(nodeId);

    if (result.success) {
      this.logToChronicle(nodeId, 'sandbox:upgrade-tier', 'success', `→ ${newTier}`);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Batch operations
  // ---------------------------------------------------------------------------

  async batchLaunch(nodeIds: string[], tier: SandboxTier = 'standard'): Promise<
    Array<{ nodeId: string; success: boolean; error?: string }>
  > {
    // First, create configs
    for (const nodeId of nodeIds) {
      this.createSandbox(nodeId, tier);
    }

    // Then, parallel launch
    const results = await Promise.all(
      nodeIds.map(async (nodeId) => {
        const result = await this.launchSandbox(nodeId);
        return { nodeId, ...result };
      }),
    );

    return results;
  }

  async batchStop(nodeIds: string[]): Promise<Array<{ nodeId: string; success: boolean }>> {
    const results = await Promise.all(
      nodeIds.map(async (nodeId) => {
        const result = await this.stopSandbox(nodeId);
        return { nodeId, ...result };
      }),
    );
    return results;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private buildDockerRunCommand(config: FleetSandboxConfig): string {
    const envFlags = Object.entries(config.env)
      .map(([k, v]) => `-e ${k}=${v}`)
      .join(' ');
    const portFlags = config.ports.map((p) => `-p ${p}:${p}`).join(' ');
    const volFlags = config.volumes.map((v) => `-v ${v}`).join(' ');
    const netFlag = `--network ${config.networkMode}`;
    const memFlag = `--memory=${config.memoryLimit}`;
    const cpuFlag = `--cpus=${config.cpuLimit}`;

    return `docker run -d --name stargate-${config.nodeId} ${netFlag} ${memFlag} ${cpuFlag} ${envFlags} ${portFlags} ${volFlags} ${config.image}`;
  }

  private logToChronicle(
    nodeId: string,
    event: string,
    status: string,
    detail?: string,
  ): void {
    const chronicle = (window as any).electronAPI?.chronicle;
    if (chronicle?.write) {
      chronicle.write('fleet-sandbox', {
        nodeId,
        event,
        status,
        detail,
        timestamp: Date.now(),
        policyHash: this.policies.get(nodeId)?.tier || 'unknown',
      });
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const fleetSandboxLauncher = new FleetSandboxLauncher();
export default FleetSandboxLauncher;
