// world-state.ts — STATE.md: the bot's reconciled world state (loop-engineering)
// ─────────────────────────────────────────────────────────────────────────────
// One durable file the loop reconciles every heartbeat:
//   - current infra truth (from live telemetry, never stale claims)
//   - open issues with first-seen / last-seen timestamps
//   - recent actions taken (from forge sessions)
//   - kanban attention items
// The bot reads it at beat start (injected into prompt), and the RUNTIME
// (not the LLM) reconciles the facts after each telemetry cycle — so the
// state can never drift into hallucination.
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { getLastFleetSnapshot } from "./fleet-telemetry.js";
import { listForgeSessions } from "./axi/axi-store.js";
import { listBoards, listTasks } from "./kanban-bridge.js";

interface OpenIssue {
  key: string;
  description: string;
  firstSeen: number;
  lastSeen: number;
}

interface WorldState {
  updatedAt: number;
  openIssues: OpenIssue[];
}

function statePath(): string {
  return path.join(app.getPath("userData"), "mosaicbot", "STATE.json");
}

function stateMdPath(): string {
  return path.join(process.cwd(), "memory", "STATE.md");
}

function loadState(): WorldState {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf-8")) as WorldState;
  } catch {
    return { updatedAt: 0, openIssues: [] };
  }
}

function saveState(s: WorldState): void {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(s, null, 2));
}

// ── Reconcile: compute current issues from LIVE sources, merge timestamps ────

export function reconcileWorldState(): string {
  const now = Date.now();
  const prev = loadState();
  const currentIssues = new Map<string, string>();

  // Source 1: live fleet telemetry
  const snap = getLastFleetSnapshot();
  if (snap) {
    if (!snap.spoHealthy) currentIssues.set("spo-down", "SPO (localhost:9100) not responding");
    for (const n of snap.nodes) {
      if (!n.ssh) currentIssues.set(`${n.nodeId}-ssh`, `${n.nodeId.toUpperCase()} unreachable via SSH`);
      else {
        if (!n.hba) currentIssues.set(`${n.nodeId}-hba`, `${n.nodeId.toUpperCase()} HBA agent down`);
        if (!n.tiller) currentIssues.set(`${n.nodeId}-tiller`, `${n.nodeId.toUpperCase()} Tiller down`);
      }
    }
  }

  // Source 2: kanban attention items (blocked tasks + repeat failures)
  try {
    for (const t of listTasks({ status: "blocked" })) {
      currentIssues.set(
        `kanban-${t.id}`,
        `[${t.board}] "${t.title}" blocked (assignee=${t.assignee}, ${t.failures} consecutive failures${t.lastError ? `, last: ${t.lastError.slice(0, 80)}` : ""})`,
      );
    }
  } catch { /* kanban unavailable — not an issue itself */ }

  // Merge: keep firstSeen for persisting issues, drop resolved ones
  const merged: OpenIssue[] = [];
  for (const [key, description] of currentIssues) {
    const existing = prev.openIssues.find((i) => i.key === key);
    merged.push({
      key,
      description,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    });
  }

  const state: WorldState = { updatedAt: now, openIssues: merged };
  saveState(state);

  // Render STATE.md (human + bot readable)
  const md = renderStateMd(state, snap);
  try {
    fs.mkdirSync(path.dirname(stateMdPath()), { recursive: true });
    fs.writeFileSync(stateMdPath(), md);
  } catch { /* memory dir may not exist yet */ }
  return md;
}

function ageStr(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

function renderStateMd(state: WorldState, snap: ReturnType<typeof getLastFleetSnapshot>): string {
  const lines: string[] = [];
  lines.push("# STATE.md — Reconciled World State (runtime-verified, trust this)");
  lines.push(`Updated: ${new Date(state.updatedAt).toISOString()}`);
  lines.push("");

  lines.push("## Infrastructure (from live telemetry)");
  if (snap) {
    lines.push(`- SPO: ${snap.spoHealthy ? "✓ healthy" : "✗ DOWN"}`);
    for (const n of snap.nodes) {
      lines.push(`- ${n.nodeId.toUpperCase()} (${n.nodeIp}): ssh=${n.ssh ? "✓" : "✗"} hba=${n.hba ? "✓" : "✗"} tiller=${n.tiller ? "✓" : "✗"} slots=${n.slots}`);
    }
  } else {
    lines.push("- No telemetry collected yet this session");
  }
  lines.push("");

  lines.push("## Open Issues (auto-reconciled — resolved issues are REMOVED, never linger)");
  if (state.openIssues.length === 0) {
    lines.push("- None. All systems nominal.");
  } else {
    for (const i of state.openIssues) {
      lines.push(`- [open ${ageStr(i.firstSeen)}] ${i.description}`);
    }
  }
  lines.push("");

  lines.push("## Kanban Boards Overview");
  try {
    for (const b of listBoards()) {
      const parts = Object.entries(b.counts).map(([s, n]) => `${s}:${n}`).join(" ");
      lines.push(`- ${b.slug}: ${parts || "empty"}`);
    }
  } catch {
    lines.push("- kanban unavailable");
  }
  lines.push("");

  lines.push("## My Recent Actions (forge sessions)");
  try {
    const sessions = listForgeSessions(5);
    if (sessions.length === 0) lines.push("- No recorded actions yet");
    for (const s of sessions) {
      lines.push(`- [${s.status}] ${String(s.prompt).slice(0, 80)}`);
    }
  } catch {
    lines.push("- forge store unavailable");
  }

  return lines.join("\n");
}

export function getWorldStateMd(): string {
  try {
    return fs.readFileSync(stateMdPath(), "utf-8");
  } catch {
    return reconcileWorldState();
  }
}
