// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat Pool Tools — Stargate Pool awareness for Mosaic Bot
//
// Provides the bot with real-time visibility into:
//   - Pool health (boxes online/offline, utilization)
//   - Revenue & bookings (commissions generated, owner revenue)
//   - Active compute allocations
//   - Fleet health
//
// These are READ-ONLY tools — no mutations, no allowlist needed.
// ─────────────────────────────────────────────────────────────────────────────

import { stargatePoolOrchestrator } from "../../../pool/orchestrator/StargatePoolOrchestrator.ts";
import { listBoards, listTasks } from "./kanban-bridge.js";

// ── Pool Status ─────────────────────────────────────────────────────────────

export interface PoolStatus {
  totalBoxes: number;
  online: number;
  offline: number;
  busy: number;
  maintenance: number;
  utilizationPercent: number;
  totalTenants: number;
  totalCapacity: number;
  regions: Record<string, number>;
  revenue: {
    totalBookings: number;
    pendingPayment: number;
    active: number;
    totalRevenue: number;
    totalCommission: number;
    totalOwnerRevenue: number;
  };
  topBoxes: Array<{
    boxId: string;
    boxName: string;
    status: string;
    tenants: number;
    uptimePercent: number;
    cpuCores: number;
    memoryGb: number;
  }>;
}

export function getPoolStatus(): PoolStatus {
  const boxes = stargatePoolOrchestrator.listBoxes({ status: "all" });
  const bookings = stargatePoolOrchestrator.getBookings();

  const status: PoolStatus = {
    totalBoxes: boxes.length,
    online: boxes.filter((b) => b.status === "online").length,
    offline: boxes.filter((b) => b.status === "offline").length,
    busy: boxes.filter((b) => b.status === "busy").length,
    maintenance: boxes.filter((b) => b.status === "maintenance").length,
    utilizationPercent: 0,
    totalTenants: boxes.reduce((sum, b) => sum + (b.tenantCount || 0), 0),
    totalCapacity: boxes.length * 2, // default 2 tenants per box
    regions: {},
    revenue: {
      totalBookings: bookings.length,
      pendingPayment: bookings.filter((b) => b.status === "pending_payment").length,
      active: bookings.filter((b) => b.status === "active").length,
      totalRevenue: bookings.reduce((sum, b) => sum + b.totalCost, 0),
      totalCommission: bookings.reduce((sum, b) => sum + b.commissionAmount, 0),
      totalOwnerRevenue: bookings.reduce((sum, b) => sum + b.ownerRevenue, 0),
    },
    topBoxes: [],
  };

  // Utilization
  if (status.totalCapacity > 0) {
    status.utilizationPercent = Math.round((status.totalTenants / status.totalCapacity) * 100);
  }

  // Top boxes by tenant count
  status.topBoxes = boxes
    .sort((a, b) => (b.tenantCount || 0) - (a.tenantCount || 0))
    .slice(0, 5)
    .map((b) => ({
      boxId: b.boxId,
      boxName: b.boxName,
      status: b.status,
      tenants: b.tenantCount || 0,
      uptimePercent: b.nodeManager?.uptimePercent || 0,
      cpuCores: b.system?.cpuCores || 0,
      memoryGb: b.system?.memoryTotalGb || 0,
    }));

  return status;
}

// ── Active Allocations ───────────────────────────────────────────────────────

export interface ActiveAllocation {
  allocationId: string;
  boxId: string;
  boxName: string;
  tenantId: string;
  status: string;
  pricePerHour: number;
  totalCost: number;
  ownerRevenue: number;
  commissionAmount: number;
  expiresInMinutes: number;
}

export function getActiveAllocations(): ActiveAllocation[] {
  // Access private allocations map via type assertion
  const allocsMap = (stargatePoolOrchestrator as any).allocations as Map<string, any> | undefined;
  if (!allocsMap) return [];

  const now = Date.now();
  return Array.from(allocsMap.values())
    .filter((a: any) => a.status === "active" || a.status === "provisioning")
    .map((a: any) => ({
      allocationId: String(a.allocationId ?? ""),
      boxId: String(a.boxId ?? ""),
      boxName: String(a.boxName ?? ""),
      tenantId: String(a.tenantId ?? ""),
      status: String(a.status ?? ""),
      pricePerHour: Number(a.pricePerHour ?? 0),
      totalCost: Number(a.totalCost ?? 0),
      ownerRevenue: Number(a.ownerRevenue ?? 0),
      commissionAmount: Number(a.commissionAmount ?? 0),
      expiresInMinutes: Math.max(0, Math.round((Number(a.expiresAt ?? now) - now) / 60_000)),
    }))
    .sort((a, b) => a.expiresInMinutes - b.expiresInMinutes);
}

// ── Fleet Telemetry Summary ─────────────────────────────────────────────────

export interface FleetHealth {
  spoHealthy: boolean;
  spoUrl: string;
  boxesOnline: number;
  boxesOffline: number;
  c3poStatus: { ssh: boolean; hba: boolean; tiller: boolean };
  r2d2Status: { ssh: boolean; hba: boolean; tiller: boolean };
  totalAimSlots: number;
  usedAimSlots: number;
  issues: string[];
}

export function getFleetHealth(): FleetHealth {
  const boxes = stargatePoolOrchestrator.listBoxes({ status: "all" });
  const c3po = boxes.find((b) => b.boxId === "c3po" || b.boxId === "c-3po");
  const r2d2 = boxes.find((b) => b.boxId === "r2d2");

  const issues: string[] = [];
  if (!c3po || c3po.status === "offline") issues.push("C3PO offline");
  if (!r2d2 || r2d2.status === "offline") issues.push("R2D2 offline");
  if (c3po && (c3po.tenantCount || 0) >= 2) issues.push("C3PO at capacity");
  if (r2d2 && (r2d2.tenantCount || 0) >= 2) issues.push("R2D2 at capacity");

  return {
    spoHealthy: boxes.some((b) => b.status === "online"),
    spoUrl: "http://127.0.0.1:9100/api/health",
    boxesOnline: boxes.filter((b) => b.status === "online").length,
    boxesOffline: boxes.filter((b) => b.status === "offline").length,
    c3poStatus: {
      ssh: c3po?.nodeManager?.status === "alive" || false,
      hba: c3po?.nodeManager?.status === "alive" || false,
      tiller: (c3po?.tenantCount || 0) > 0,
    },
    r2d2Status: {
      ssh: r2d2?.nodeManager?.status === "alive" || false,
      hba: r2d2?.nodeManager?.status === "alive" || false,
      tiller: (r2d2?.tenantCount || 0) > 0,
    },
    totalAimSlots: boxes.reduce((sum, b) => sum + (b.system?.cpuCores || 0), 0),
    usedAimSlots: boxes.reduce((sum, b) => sum + (b.tenantCount || 0) * 2, 0),
    issues,
  };
}

// ── Prompt Builders ─────────────────────────────────────────────────────────

export function buildPoolStatusPrompt(): string {
  const s = getPoolStatus();
  const lines = [
    "## Stargate Pool Status",
    `Boxes: ${s.totalBoxes} total | ${s.online} online | ${s.offline} offline | ${s.busy} busy | ${s.maintenance} maintenance`,
    `Utilization: ${s.utilizationPercent}% (${s.totalTenants}/${s.totalCapacity} tenants)`,
    `Revenue: $${s.revenue.totalRevenue.toFixed(2)} total | $${s.revenue.totalCommission.toFixed(2)} commission | $${s.revenue.totalOwnerRevenue.toFixed(2)} to owners`,
    `Bookings: ${s.revenue.totalBookings} total | ${s.revenue.pendingPayment} pending | ${s.revenue.active} active`,
    "",
    "Top Boxes:",
    ...s.topBoxes.map((b) =>
      `  ${b.boxName}: ${b.status} | ${b.tenants} tenants | ${b.uptimePercent}% uptime | ${b.cpuCores} cores / ${b.memoryGb}GB`,
    ),
  ];
  if (s.regions && Object.keys(s.regions).length > 0) {
    lines.push("", `Regions: ${Object.entries(s.regions).map(([r, n]) => `${r}=${n}`).join(", ")}`);
  }
  return lines.join("\n");
}

export function buildAllocationsPrompt(): string {
  const allocs = getActiveAllocations();
  if (allocs.length === 0) return "## Active Compute Allocations\nNone currently running.";
  const lines = [
    "## Active Compute Allocations",
    ...allocs.map((a) =>
      `  ${a.allocationId}: ${a.boxName} | ${a.status} | $${a.pricePerHour}/hr | $${a.totalCost} total | expires in ${a.expiresInMinutes}m`,
    ),
    "",
    `Total active revenue: $${allocs.reduce((s, a) => s + a.totalCost, 0).toFixed(2)}`,
  ];
  return lines.join("\n");
}

export function buildFleetHealthPrompt(): string {
  const f = getFleetHealth();
  const lines = [
    "## Fleet Health (HyperAIBox Nodes)",
    `SPO: ${f.spoHealthy ? "✓ healthy" : "✗ down"} (${f.spoUrl})`,
    `Boxes: ${f.boxesOnline} online | ${f.boxesOffline} offline`,
    `AIM Slots: ${f.usedAimSlots}/${f.totalAimSlots} used`,
    "",
    "Node Status:",
    `  C3PO: SSH=${f.c3poStatus.ssh ? "✓" : "✗"} HBA=${f.c3poStatus.hba ? "✓" : "✗"} Tiller=${f.c3poStatus.tiller ? "✓" : "✗"}`,
    `  R2D2: SSH=${f.r2d2Status.ssh ? "✓" : "✗"} HBA=${f.r2d2Status.hba ? "✓" : "✗"} Tiller=${f.r2d2Status.tiller ? "✓" : "✗"}`,
  ];
  if (f.issues.length > 0) {
    lines.push("", "Issues:", ...f.issues.map((i) => `  ⚠️ ${i}`));
  }
  return lines.join("\n");
}

// ── Marketplace / Kanban Analysis ───────────────────────────────────────────

export interface MarketplaceAnalysis {
  kanbanBoards: number;
  activeDelegations: number;
  kanbanGaps: string[];
}

export async function analyzeMarketplace(): Promise<MarketplaceAnalysis> {
  const boards = listBoards();
  let activeDelegations = 0;
  try {
    const tasks = listTasks({ status: "running" });
    activeDelegations = tasks.length;
  } catch { /* ignore */ }

  // Gaps: boards with zero tasks
  const kanbanGaps: string[] = [];
  for (const b of boards) {
    const totalTasks = Object.values(b.counts).reduce((a, c) => a + c, 0);
    if (totalTasks === 0) kanbanGaps.push(`Board "${b.slug}" is empty`);
  }

  return {
    kanbanBoards: boards.length,
    activeDelegations,
    kanbanGaps,
  };
}

export async function buildMarketplacePromptAsync(): Promise<string> {
  const m = await analyzeMarketplace();
  const lines = [
    "## Stargate Marketplace Analysis",
    `Kanban Boards: ${m.kanbanBoards} connected`,
    `Active Delegations: ${m.activeDelegations} tasks running`,
  ];
  if (m.kanbanGaps.length > 0) {
    lines.push("", "Empty Boards:", ...m.kanbanGaps.map((g) => `  ⚠️ ${g}`));
  }
  return lines.join("\n");
}
