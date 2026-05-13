// =============================================================================
// STARGATE INTEGRATIONS — Gatekeeper Fleet Filter
// Fleet registry inherits gatekeeper policy. Malicious nodes blocked at network level.
// =============================================================================

import { fleetSandboxLauncher, type FleetSandboxConfig } from './FleetSandboxLauncher';

// =============================================================================
// Fleet Gatekeeper Types
// =============================================================================

export type FleetReputation = 'trusted' | 'unknown' | 'suspicious' | 'blocked';

export interface FleetNodePolicy {
  nodeId: string;
  reputation: FleetReputation;
  allowedDomains: string[];
  blockedDomains: string[];
  allowedPorts: number[];
  blockedPorts: number[];
  maxConnectionsPerMin: number;
  maxBandwidthMbps: number;
  requireEncryption: boolean;
  auditLevel: 'full' | 'errors' | 'none';
}

export interface FleetFilterDecision {
  allowed: boolean;
  reason?: string;
  action: 'allow' | 'block' | 'quarantine' | 'rate-limit';
}

export interface FleetThreatReport {
  nodeId: string;
  threatType: 'scan' | 'exfil' | 'unauthorized-domain' | 'port-abuse' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  timestamp: number;
}

// =============================================================================
// FleetGatekeeperFilter
// =============================================================================

class FleetGatekeeperFilter {
  private policies: Map<string, FleetNodePolicy> = new Map();
  private threatLog: FleetThreatReport[] = [];
  private connectionCounters: Map<string, number[]> = new Map(); // nodeId → timestamps

  // ---------------------------------------------------------------------------
  // Default policies per reputation tier
  // ---------------------------------------------------------------------------

  private getDefaultPolicy(reputation: FleetReputation): FleetNodePolicy {
    switch (reputation) {
      case 'trusted':
        return {
          nodeId: '',
          reputation: 'trusted',
          allowedDomains: ['*'],
          blockedDomains: [],
          allowedPorts: [443, 80, 22, 8000, 8005, 8006],
          blockedPorts: [],
          maxConnectionsPerMin: 1000,
          maxBandwidthMbps: 100,
          requireEncryption: true,
          auditLevel: 'errors',
        };
      case 'unknown':
        return {
          nodeId: '',
          reputation: 'unknown',
          allowedDomains: ['*.hypercycle.io', '*.blockfrost.io'],
          blockedDomains: ['*.tor', '*.onion'],
          allowedPorts: [443, 80],
          blockedPorts: [22, 23, 25, 53],
          maxConnectionsPerMin: 60,
          maxBandwidthMbps: 10,
          requireEncryption: true,
          auditLevel: 'full',
        };
      case 'suspicious':
        return {
          nodeId: '',
          reputation: 'suspicious',
          allowedDomains: [],
          blockedDomains: ['*'],
          allowedPorts: [],
          blockedPorts: ['*'] as any,
          maxConnectionsPerMin: 0,
          maxBandwidthMbps: 0,
          requireEncryption: true,
          auditLevel: 'full',
        };
      case 'blocked':
        return {
          nodeId: '',
          reputation: 'blocked',
          allowedDomains: [],
          blockedDomains: ['*'],
          allowedPorts: [],
          blockedPorts: ['*'] as any,
          maxConnectionsPerMin: 0,
          maxBandwidthMbps: 0,
          requireEncryption: true,
          auditLevel: 'full',
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Policy management
  // ---------------------------------------------------------------------------

  registerNode(nodeId: string, reputation: FleetReputation = 'unknown'): FleetNodePolicy {
    const defaults = this.getDefaultPolicy(reputation);
    const policy: FleetNodePolicy = { ...defaults, nodeId };
    this.policies.set(nodeId, policy);

    this.logToChronicle(nodeId, 'filter:register', 'success', `reputation=${reputation}`);
    return policy;
  }

  setNodePolicy(nodeId: string, overrides: Partial<FleetNodePolicy>): void {
    const existing = this.policies.get(nodeId);
    if (!existing) {
      this.registerNode(nodeId, overrides.reputation || 'unknown');
      return;
    }
    this.policies.set(nodeId, { ...existing, ...overrides });
    this.logToChronicle(nodeId, 'filter:policy-update', 'success');
  }

  getPolicy(nodeId: string): FleetNodePolicy | undefined {
    return this.policies.get(nodeId);
  }

  // ---------------------------------------------------------------------------
  // Traffic filtering
  // ---------------------------------------------------------------------------

  checkOutbound(
    nodeId: string,
    domain: string,
    port: number,
  ): FleetFilterDecision {
    const policy = this.policies.get(nodeId);
    if (!policy) {
      return { allowed: false, action: 'block', reason: 'No policy registered for node' };
    }

    // Check reputation-based block
    if (policy.reputation === 'blocked') {
      this.logThreat(nodeId, 'unauthorized-domain', 'high', `Blocked node attempted outbound to ${domain}`);
      return { allowed: false, action: 'block', reason: 'Node reputation: BLOCKED' };
    }

    if (policy.reputation === 'suspicious') {
      this.logThreat(nodeId, 'anomaly', 'medium', `Suspicious node attempted outbound to ${domain}`);
      return { allowed: false, action: 'quarantine', reason: 'Node reputation: SUSPICIOUS' };
    }

    // Check domain allowlist
    const isDomainAllowed = policy.allowedDomains.some((d) => {
      if (d === '*') return true;
      if (d.startsWith('*.')) {
        const suffix = d.slice(2);
        return domain.endsWith(suffix);
      }
      return d === domain;
    });

    if (!isDomainAllowed) {
      this.logThreat(nodeId, 'unauthorized-domain', 'medium', `Domain ${domain} not in allowlist`);
      return {
        allowed: false,
        action: 'block',
        reason: `Domain "${domain}" not in node allowlist`,
      };
    }

    // Check port allowlist
    const isPortAllowed = policy.allowedPorts.includes(port);
    if (!isPortAllowed) {
      this.logThreat(nodeId, 'port-abuse', 'low', `Port ${port} not allowed`);
      return {
        allowed: false,
        action: 'block',
        reason: `Port ${port} not in node allowlist`,
      };
    }

    // Rate limiting
    const now = Date.now();
    const window = 60000; // 1 minute
    const counters = this.connectionCounters.get(nodeId) || [];
    const recent = counters.filter((t) => now - t < window);
    recent.push(now);
    this.connectionCounters.set(nodeId, recent);

    if (recent.length > policy.maxConnectionsPerMin) {
      this.logThreat(nodeId, 'scan', 'medium', `Rate limit exceeded: ${recent.length} conn/min`);
      return {
        allowed: false,
        action: 'rate-limit',
        reason: `Rate limit exceeded: ${recent.length} connections/min (max: ${policy.maxConnectionsPerMin})`,
      };
    }

    this.logToChronicle(nodeId, 'filter:allow', 'success', `${domain}:${port}`);
    return { allowed: true, action: 'allow' };
  }

  // ---------------------------------------------------------------------------
  // Threat detection
  // ---------------------------------------------------------------------------

  reportThreat(report: FleetThreatReport): void {
    this.threatLog.push(report);

    // Auto-escalate reputation on critical threats
    if (report.severity === 'critical') {
      this.setNodePolicy(report.nodeId, { reputation: 'blocked' });
    } else if (report.severity === 'high') {
      const current = this.policies.get(report.nodeId)?.reputation;
      if (current === 'unknown') {
        this.setNodePolicy(report.nodeId, { reputation: 'suspicious' });
      }
    }

    this.logToChronicle(report.nodeId, 'filter:threat', report.severity, report.details);
  }

  getThreats(nodeId?: string): FleetThreatReport[] {
    if (!nodeId) return [...this.threatLog];
    return this.threatLog.filter((t) => t.nodeId === nodeId);
  }

  // ---------------------------------------------------------------------------
  // Integration with FleetSandbox
  // ---------------------------------------------------------------------------

  applySandboxPolicy(nodeId: string): void {
    const sandbox = fleetSandboxLauncher.getSandboxConfig(nodeId);
    const policy = this.policies.get(nodeId);
    if (!sandbox || !policy) return;

    // Sync sandbox allowedDomains with gatekeeper policy
    sandbox.allowedDomains = policy.allowedDomains;
    sandbox.allowedPorts = policy.allowedPorts.filter((p) => typeof p === 'number') as number[];
  }

  // ---------------------------------------------------------------------------
  // Batch operations
  // ---------------------------------------------------------------------------

  batchRegister(nodeIds: string[], reputation: FleetReputation = 'unknown'): FleetNodePolicy[] {
    return nodeIds.map((id) => this.registerNode(id, reputation));
  }

  batchCheck(
    requests: Array<{ nodeId: string; domain: string; port: number }>,
  ): FleetFilterDecision[] {
    return requests.map((req) => this.checkOutbound(req.nodeId, req.domain, req.port));
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private logThreat(
    nodeId: string,
    threatType: FleetThreatReport['threatType'],
    severity: FleetThreatReport['severity'],
    details: string,
  ): void {
    this.reportThreat({
      nodeId,
      threatType,
      severity,
      details,
      timestamp: Date.now(),
    });
  }

  private logToChronicle(
    nodeId: string,
    event: string,
    status: string,
    detail?: string,
  ): void {
    const chronicle = (window as any).electronAPI?.chronicle;
    if (chronicle?.write) {
      chronicle.write('fleet-gatekeeper', {
        nodeId,
        event,
        status,
        detail,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const fleetGatekeeperFilter = new FleetGatekeeperFilter();
export default FleetGatekeeperFilter;
