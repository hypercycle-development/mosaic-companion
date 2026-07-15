// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC IP HANDLER — C-3PO Discovery Service
// Handles C-3PO HyperAIBox IP changes after reboot (192.168.0.150 → .100-.160 range)
// ─────────────────────────────────────────────────────────────────────────────

import { HYPERAIBOX_FLEET, HyperAIBox, STARGATE_COMPONENTS, StargateComponent } from "../../main/stargate-registry";

// ── Configuration ─────────────────────────────────────────────────────────────

const DISCOVERY_CONFIG = {
  // C-3PO discovery settings
  C3PO: {
    nodeId: "c-3po",
    originalIp: "192.168.0.150",
    subnet: "192.168.0",
    ipRange: { start: 100, end: 160 },
    hbaPort: 8100,
    nodeManagerPort: 8006,
    healthEndpoint: "/health",
    discoveryTimeoutMs: 2000,
    maxRetries: 3,
  },
  // Node Manager discovery settings (if HBA fails)
  NODE_MANAGER: {
    port: 8006,
    discoveryTimeoutMs: 1500,
  },
};

// ── Telemetry Types ──────────────────────────────────────────────────────────

export interface IPChangeEvent {
  eventId: string;
  timestamp: number;
  nodeId: string;
  nodeName: string;
  oldIp: string | null;
  newIp: string;
  discoveryMethod: "hba_health" | "node_manager" | "fallback";
  rttMs: number;
  notes: string[];
}

export interface FleetTelemetryEntry {
  id: string;
  timestamp: number;
  eventType: "ip_change" | "discovery_success" | "discovery_failure" | "node_offline";
  nodeId: string;
  data: Record<string, unknown>;
}

// In-memory telemetry store (replace with actual DB in production)
const fleetTelemetry: FleetTelemetryEntry[] = [];

// ── Discovery Functions ─────────────────────────────────────────────────────

/**
 * Check if a HyperAIBox responds at a specific IP
 */
async function checkHeartbeat(
  ip: string,
  port: number,
  timeoutMs: number,
  endpoint: string = "/health"
): Promise<{ alive: boolean; rttMs: number; status?: number; error?: string }> {
  const startTime = Date.now();
  const url = `http://${ip}:${port}${endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      method: "GET",
    });

    clearTimeout(timeoutId);
    const rttMs = Date.now() - startTime;

    // Consider 200-299 or 404 as "alive" (service may have different health path)
    const alive = response.ok || response.status === 404;

    return {
      alive,
      rttMs,
      status: response.status,
    };
  } catch (error) {
    const rttMs = Date.now() - startTime;
    return {
      alive: false,
      rttMs,
      error: String(error),
    };
  }
}

/**
 * Scan a range of IPs to find C-3PO
 */
async function scanSubnetForC3PO(): Promise<{
  found: boolean;
  ip: string | null;
  discoveryMethod: "hba_health" | "node_manager" | "fallback" | null;
  rttMs: number;
  notes: string[];
}> {
  const config = DISCOVERY_CONFIG.C3PO;
  const notes: string[] = [];

  console.log(`[DynamicIPHandler] Scanning subnet ${config.subnet}.${config.ipRange.start}-${config.ipRange.end} for C-3PO...`);

  // First: try original IP (might still be there)
  const originalCheck = await checkHeartbeat(
    config.originalIp,
    config.hbaPort,
    config.discoveryTimeoutMs,
    config.healthEndpoint
  );

  if (originalCheck.alive) {
    console.log(`[DynamicIPHandler] C-3PO found at original IP ${config.originalIp}:${config.hbaPort} (${originalCheck.rttMs}ms)`);
    return {
      found: true,
      ip: config.originalIp,
      discoveryMethod: "hba_health",
      rttMs: originalCheck.rttMs,
      notes: ["Found at original IP", `RTT: ${originalCheck.rttMs}ms`, `Status: ${originalCheck.status}`],
    };
  }

  // Second: scan the DHCP range for HBA on port 8100
  console.log(`[DynamicIPHandler] Original IP unreachable, scanning DHCP range...`);

  const scanPromises: Promise<{
    ip: string;
    alive: boolean;
    rttMs: number;
    method: "hba_health" | "node_manager";
  }>[] = [];

  for (let i = config.ipRange.start; i <= config.ipRange.end; i++) {
    const ip = `${config.subnet}.${i}`;

    // Parallel scan for HBA port
    scanPromises.push(
      checkHeartbeat(ip, config.hbaPort, config.discoveryTimeoutMs, config.healthEndpoint).then(
        (result) => ({
          ip,
          alive: result.alive,
          rttMs: result.rttMs,
          method: "hba_health" as const,
        })
      )
    );

    // Parallel scan for Node Manager port
    scanPromises.push(
      checkHeartbeat(ip, config.nodeManagerPort, DISCOVERY_CONFIG.NODE_MANAGER.discoveryTimeoutMs, "/").then(
        (result) => ({
          ip,
          alive: result.alive,
          rttMs: result.rttMs,
          method: "node_manager" as const,
        })
      )
    );
  }

  const results = await Promise.all(scanPromises);

  // Find first successful HBA response (preferred)
  const hbaResult = results.find((r) => r.method === "hba_health" && r.alive);
  if (hbaResult) {
    console.log(`[DynamicIPHandler] C-3PO HBA found at ${hbaResult.ip}:${config.hbaPort} (${hbaResult.rttMs}ms)`);
    return {
      found: true,
      ip: hbaResult.ip,
      discoveryMethod: "hba_health",
      rttMs: hbaResult.rttMs,
      notes: ["Discovered via HBA health endpoint", `RTT: ${hbaResult.rttMs}ms`],
    };
  }

  // Fallback: find Node Manager response
  const nmResult = results.find((r) => r.method === "node_manager" && r.alive);
  if (nmResult) {
    console.log(`[DynamicIPHandler] C-3PO Node Manager found at ${nmResult.ip}:${config.nodeManagerPort} (${nmResult.rttMs}ms)`);
    return {
      found: true,
      ip: nmResult.ip,
      discoveryMethod: "node_manager",
      rttMs: nmResult.rttMs,
      notes: ["Discovered via Node Manager endpoint (HBA not responding)", `RTT: ${nmResult.rttMs}ms`],
    };
  }

  // Not found
  notes.push(`Scanned ${config.subnet}.${config.ipRange.start}-${config.ipRange.end}, no response`);
  console.log(`[DynamicIPHandler] C-3PO not found in subnet ${config.subnet}.${config.ipRange.start}-${config.ipRange.end}`);

  return {
    found: false,
    ip: null,
    discoveryMethod: null,
    rttMs: 0,
    notes,
  };
}

// ── Registry Update Functions ────────────────────────────────────────────────

/**
 * Update the HyperAIBox fleet registry with new IP
 */
export function updateC3PORegistry(
  newIp: string,
  discoveryMethod: "hba_health" | "node_manager" | "fallback"
): { updated: boolean; oldIp: string | null; newIp: string } {
  const c3poIndex = HYPERAIBOX_FLEET.findIndex((box) => box.id === "c-3po");

  if (c3poIndex === -1) {
    console.error("[DynamicIPHandler] C-3PO not found in fleet registry!");
    return { updated: false, oldIp: null, newIp };
  }

  const c3po = HYPERAIBOX_FLEET[c3poIndex];
  const oldIp = c3po.ip;

  if (oldIp === newIp) {
    console.log(`[DynamicIPHandler] C-3PO IP unchanged: ${newIp}`);
    return { updated: false, oldIp, newIp };
  }

  // Update fleet registry
  c3po.ip = newIp;
  c3po.status = "online";
  c3po.lastSeen = Date.now();
  c3po.notes.push(
    `[${new Date().toISOString()}] IP changed: ${oldIp} → ${newIp}`,
    `[${new Date().toISOString()}] Discovered via: ${discoveryMethod}`
  );

  // Update component registry (healthEndpoint)
  const c3poComponent = STARGATE_COMPONENTS.find((c) => c.id === "c3po-hba");
  if (c3poComponent && c3poComponent.healthEndpoint) {
    const oldEndpoint = c3poComponent.healthEndpoint;
    c3poComponent.healthEndpoint = `http://${newIp}:8100/health`;
    c3poComponent.status = "operational";
    console.log(`[DynamicIPHandler] Updated component health endpoint: ${oldEndpoint} → ${c3poComponent.healthEndpoint}`);
  }

  console.log(`[DynamicIPHandler] Registry updated: C-3PO IP ${oldIp} → ${newIp}`);
  return { updated: true, oldIp, newIp };
}

// ── Telemetry Functions ─────────────────────────────────────────────────────

/**
 * Log IP change event to fleet telemetry
 */
export function logIPChangeEvent(event: Omit<IPChangeEvent, "eventId">): FleetTelemetryEntry {
  const eventId = `ip-change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const entry: FleetTelemetryEntry = {
    id: eventId,
    timestamp: event.timestamp,
    eventType: "ip_change",
    nodeId: event.nodeId,
    data: {
      eventId,
      ...event,
      notes: event.notes,
    },
  };

  fleetTelemetry.push(entry);

  // Log to console for visibility
  console.log(`[FleetTelemetry] IP Change Event:`, {
    eventId,
    node: event.nodeName,
    oldIp: event.oldIp || "unknown",
    newIp: event.newIp,
    method: event.discoveryMethod,
    rtt: `${event.rttMs}ms`,
  });

  return entry;
}

/**
 * Get all telemetry entries (for querying/reporting)
 */
export function getFleetTelemetry(
  nodeId?: string,
  eventType?: FleetTelemetryEntry["eventType"],
  since?: number
): FleetTelemetryEntry[] {
  return fleetTelemetry.filter((entry) => {
    if (nodeId && entry.nodeId !== nodeId) return false;
    if (eventType && entry.eventType !== eventType) return false;
    if (since && entry.timestamp < since) return false;
    return true;
  });
}

/**
 * Get recent IP changes for a specific node
 */
export function getIPChangeHistory(nodeId: string, limit: number = 10): IPChangeEvent[] {
  const entries = getFleetTelemetry(nodeId, "ip_change")
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return entries.map((e) => e.data as unknown as IPChangeEvent);
}

// ── Main Discovery Handler ────────────────────────────────────────────────────

export interface DiscoveryResult {
  success: boolean;
  found: boolean;
  ip: string | null;
  updated: boolean;
  oldIp: string | null;
  discoveryMethod: "hba_health" | "node_manager" | "fallback" | null;
  event?: FleetTelemetryEntry;
  error?: string;
}

/**
 * Main entry point: Discover C-3PO and update registry
 */
export async function discoverAndUpdateC3PO(): Promise<DiscoveryResult> {
  console.log("[DynamicIPHandler] Starting C-3PO discovery...");

  const scanResult = await scanSubnetForC3PO();

  if (!scanResult.found || !scanResult.ip) {
    // Log failure
    const failureEntry: FleetTelemetryEntry = {
      id: `discovery-fail-${Date.now()}`,
      timestamp: Date.now(),
      eventType: "discovery_failure",
      nodeId: "c-3po",
      data: {
        subnet: DISCOVERY_CONFIG.C3PO.subnet,
        range: `${DISCOVERY_CONFIG.C3PO.ipRange.start}-${DISCOVERY_CONFIG.C3PO.ipRange.end}`,
        notes: scanResult.notes,
      },
    };
    fleetTelemetry.push(failureEntry);

    return {
      success: false,
      found: false,
      ip: null,
      updated: false,
      oldIp: null,
      discoveryMethod: null,
      error: `C-3PO not found in ${DISCOVERY_CONFIG.C3PO.subnet}.${DISCOVERY_CONFIG.C3PO.ipRange.start}-${DISCOVERY_CONFIG.C3PO.ipRange.end}`,
    };
  }

  // Update registry
  const { updated, oldIp, newIp } = updateC3PORegistry(
    scanResult.ip,
    scanResult.discoveryMethod || "hba_health"
  );

  // Log event
  const event = logIPChangeEvent({
    timestamp: Date.now(),
    nodeId: "c-3po",
    nodeName: "C-3PO (Primary)",
    oldIp,
    newIp,
    discoveryMethod: scanResult.discoveryMethod!,
    rttMs: scanResult.rttMs,
    notes: scanResult.notes,
  });

  return {
    success: true,
    found: true,
    ip: newIp,
    updated,
    oldIp,
    discoveryMethod: scanResult.discoveryMethod,
    event,
  };
}

/**
 * Check if C-3PO is at expected IP, rediscover if not
 */
export async function ensureC3POReachable(): Promise<DiscoveryResult> {
  const c3po = HYPERAIBOX_FLEET.find((b) => b.id === "c-3po");

  if (!c3po) {
    return {
      success: false,
      found: false,
      ip: null,
      updated: false,
      oldIp: null,
      discoveryMethod: null,
      error: "C-3PO not found in fleet registry",
    };
  }

  // Quick check at current IP
  const check = await checkHeartbeat(
    c3po.ip,
    DISCOVERY_CONFIG.C3PO.hbaPort,
    3000,
    "/health"
  );

  if (check.alive) {
    c3po.status = "online";
    c3po.lastSeen = Date.now();
    return {
      success: true,
      found: true,
      ip: c3po.ip,
      updated: false,
      oldIp: c3po.ip,
      discoveryMethod: "hba_health",
    };
  }

  // Not reachable - trigger discovery
  console.log(`[DynamicIPHandler] C-3PO not reachable at ${c3po.ip}, triggering rediscovery...`);
  return discoverAndUpdateC3PO();
}

// ── Scheduled Discovery ────────────────────────────────────────────────────────

let discoveryIntervalId: NodeJS.Timeout | null = null;

/**
 * Start periodic discovery checks
 */
export function startPeriodicDiscovery(intervalMinutes: number = 5): void {
  if (discoveryIntervalId) {
    console.log("[DynamicIPHandler] Discovery already running");
    return;
  }

  console.log(`[DynamicIPHandler] Starting periodic discovery every ${intervalMinutes} minutes`);

  discoveryIntervalId = setInterval(async () => {
    const result = await ensureC3POReachable();
    if (result.updated) {
      console.log(`[DynamicIPHandler] Periodic check: IP updated to ${result.ip}`);
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * Stop periodic discovery
 */
export function stopPeriodicDiscovery(): void {
  if (discoveryIntervalId) {
    clearInterval(discoveryIntervalId);
    discoveryIntervalId = null;
    console.log("[DynamicIPHandler] Periodic discovery stopped");
  }
}

/**
 * Run discovery once (startup use)
 */
export async function runDiscoveryOnStartup(): Promise<DiscoveryResult> {
  console.log("[DynamicIPHandler] Running startup discovery...");
  return discoverAndUpdateC3PO();
}

// ── Export Configuration ─────────────────────────────────────────────────────

export { DISCOVERY_CONFIG };
export default {
  discoverAndUpdateC3PO,
  ensureC3POReachable,
  runDiscoveryOnStartup,
  startPeriodicDiscovery,
  stopPeriodicDiscovery,
  logIPChangeEvent,
  getFleetTelemetry,
  getIPChangeHistory,
  updateC3PORegistry,
  scanSubnetForC3PO,
};
