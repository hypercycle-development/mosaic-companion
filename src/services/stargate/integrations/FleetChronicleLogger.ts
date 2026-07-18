// =============================================================================
// STARGATE INTEGRATIONS — Chronicle Fleet Log
// All fleet events append to Chronicle. Immutable audit trail + replay capability.
// =============================================================================

// =============================================================================
// Fleet Chronicle Types
// =============================================================================

export type FleetEventCategory =
  | 'agent'      // AgentToolService events
  | 'mcp'        // MCPAIMService events
  | 'orch'       // UnifiedOrchestrator events
  | 'sandbox'    // FleetSandboxLauncher events
  | 'gatekeeper' // FleetGatekeeperFilter events
  | 'asp'        // SecureAspGateway events
  | 'ide'        // IDEAgentForge events
  | 'system';    // Generic system events

export interface FleetEvent {
  id: string;
  timestamp: number;
  category: FleetEventCategory;
  nodeId?: string;
  event: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  detail?: string;
  metadata?: Record<string, unknown>;
  hash?: string; // integrity hash for tamper detection
}

export interface FleetEventQuery {
  category?: FleetEventCategory;
  nodeId?: string;
  event?: string;
  status?: FleetEvent['status'];
  from?: number;
  to?: number;
  limit?: number;
}

export interface FleetEventReplay {
  startTime: number;
  events: FleetEvent[];
  playbackSpeed: number;
  currentIndex: number;
}

// =============================================================================
// FleetChronicleLogger
// =============================================================================

class FleetChronicleLogger {
  private localBuffer: FleetEvent[] = [];
  private maxBufferSize = 1000;

  // ---------------------------------------------------------------------------
  // Write API — all fleet services call this
  // ---------------------------------------------------------------------------

  async log(event: Omit<FleetEvent, 'id' | 'timestamp' | 'hash'>): Promise<void> {
    const fullEvent: FleetEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
      hash: '', // computed below
    };

    // Compute integrity hash (simple chain hash)
    const prevHash = this.localBuffer.length > 0
      ? this.localBuffer[this.localBuffer.length - 1].hash
      : 'genesis';
    fullEvent.hash = this.computeHash(fullEvent, prevHash);

    // Append to local buffer
    this.localBuffer.push(fullEvent);
    if (this.localBuffer.length > this.maxBufferSize) {
      this.localBuffer.shift();
    }

    // Write to main-process Chronicle
    await this.writeToChronicle(fullEvent);
  }

  // Convenience loggers for each service

  logAgent(nodeId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'agent', nodeId, event, status, detail });
  }

  logMCP(nodeId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'mcp', nodeId, event, status, detail });
  }

  logOrch(nodeId: string | undefined, event: string, status: FleetEvent['status'], detail?: string, metadata?: Record<string, unknown>): void {
    this.log({ category: 'orch', nodeId, event, status, detail, metadata });
  }

  logSandbox(nodeId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'sandbox', nodeId, event, status, detail });
  }

  logGatekeeper(nodeId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'gatekeeper', nodeId, event, status, detail });
  }

  logASP(companyId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'asp', nodeId: companyId, event, status, detail });
  }

  logIDE(sessionId: string, event: string, status: FleetEvent['status'], detail?: string): void {
    this.log({ category: 'ide', nodeId: sessionId, event, status, detail });
  }

  // ---------------------------------------------------------------------------
  // Read API — query with filters
  // ---------------------------------------------------------------------------

  queryLocal(q: FleetEventQuery): FleetEvent[] {
    let results = [...this.localBuffer];

    if (q.category) {
      results = results.filter((e) => e.category === q.category);
    }
    if (q.nodeId) {
      results = results.filter((e) => e.nodeId === q.nodeId);
    }
    if (q.event) {
      results = results.filter((e) => e.event.includes(q.event));
    }
    if (q.status) {
      results = results.filter((e) => e.status === q.status);
    }
    if (q.from) {
      results = results.filter((e) => e.timestamp >= q.from!);
    }
    if (q.to) {
      results = results.filter((e) => e.timestamp <= q.to!);
    }

    // Sort newest first, then limit
    results.sort((a, b) => b.timestamp - a.timestamp);

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  async queryChronicle(q: FleetEventQuery): Promise<FleetEvent[]> {
    try {
      const chronicle = (window as any).electronAPI?.chronicle;
      if (!chronicle?.read) return this.queryLocal(q);

      const entries = await chronicle.read('fleet', {
        from: q.from,
        to: q.to,
        limit: q.limit || 100,
      });

      // Filter in renderer for categories not natively supported by Chronicle
      let results: FleetEvent[] = entries.map((e: any) => ({
        id: e.id || this.generateId(),
        timestamp: e.timestamp,
        category: e.category || 'system',
        nodeId: e.nodeId,
        event: e.event,
        status: e.status || 'info',
        detail: e.detail,
        metadata: e.metadata,
        hash: e.hash || '',
      }));

      if (q.category) results = results.filter((e) => e.category === q.category);
      if (q.nodeId) results = results.filter((e) => e.nodeId === q.nodeId);
      if (q.event) results = results.filter((e) => e.event.includes(q.event));
      if (q.status) results = results.filter((e) => e.status === q.status);

      return results;
    } catch {
      return this.queryLocal(q);
    }
  }

  // ---------------------------------------------------------------------------
  // Replay API
  // ---------------------------------------------------------------------------

  createReplay(q: FleetEventQuery): FleetEventReplay {
    const events = this.queryLocal(q).sort((a, b) => a.timestamp - b.timestamp);
    return {
      startTime: events[0]?.timestamp || Date.now(),
      events,
      playbackSpeed: 1.0,
      currentIndex: 0,
    };
  }

  stepReplay(replay: FleetEventReplay): FleetEvent | null {
    if (replay.currentIndex >= replay.events.length) return null;
    const event = replay.events[replay.currentIndex];
    replay.currentIndex++;
    return event;
  }

  // ---------------------------------------------------------------------------
  // Integrity
  // ---------------------------------------------------------------------------

  verifyIntegrity(): { valid: boolean; firstInvalid?: string } {
    for (let i = 1; i < this.localBuffer.length; i++) {
      const prev = this.localBuffer[i - 1];
      const curr = this.localBuffer[i];
      const expectedHash = this.computeHash(curr, prev.hash);
      if (curr.hash !== expectedHash) {
        return { valid: false, firstInvalid: curr.id };
      }
    }
    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Export / backup
  // ---------------------------------------------------------------------------

  exportJSON(): string {
    return JSON.stringify({
      exportedAt: Date.now(),
      eventCount: this.localBuffer.length,
      events: this.localBuffer,
      integrity: this.verifyIntegrity(),
    }, null, 2);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async writeToChronicle(event: FleetEvent): Promise<void> {
    try {
      const chronicle = (window as any).electronAPI?.chronicle;
      if (chronicle?.write) {
        await chronicle.write('fleet', {
          id: event.id,
          timestamp: event.timestamp,
          category: event.category,
          nodeId: event.nodeId,
          event: event.event,
          status: event.status,
          detail: event.detail,
          metadata: event.metadata,
          hash: event.hash,
        });
      }
    } catch {
      // Silently fail — local buffer is the source of truth
    }
  }

  private generateId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private computeHash(event: FleetEvent, prevHash: string): string {
    const data = `${prevHash}:${event.timestamp}:${event.category}:${event.nodeId || ''}:${event.event}:${event.status}:${event.detail || ''}`;
    // Simple hash for browser environment (not crypto-secure, but tamper-evident)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash.toString(16);
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const fleetChronicleLogger = new FleetChronicleLogger();
export default FleetChronicleLogger;
