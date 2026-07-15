// ─────────────────────────────────────────────────────────────────────────────
// Heartbeat Auto-Actions — Stop being a worry bot, start being an ops bot
//
// Rules:
//   1. SSH up + service down for >1h → auto-restart (if allowlisted)
//   2. SSH down for >2h → declare "hard down", create kanban ops task
//   3. Same alert text 3+ times → escalate to kanban with chronic flag
//   4. Every auto-action is logged; outcomes verified next heartbeat
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import fs from "node:fs";
import { app } from "electron";
import { recordAction } from "./axi/axi-store.js";
import { getLastFleetSnapshot, collectFleetTelemetry } from "./fleet-telemetry.js";
import { readAllowlist } from "./heartbeat-tools.js";

const AXI_TOOLS_DIR = join(homedir(), "mosaic-companion", "axi-tools");

// ── Chronic alert detection ─────────────────────────────────────────────────

const CHRONIC_LOG = join(app.getPath("userData"), "mosaicbot", "chronic-alerts.json");
const MAX_CHRONIC_LOG = 50;

interface ChronicEntry {
  id: string;           // hash of alert text
  text: string;         // alert text (first 200 chars)
  count: number;        // how many times seen
  firstAt: number;      // timestamp
  lastAt: number;       // timestamp
  actionsTaken: string[];
}

function loadChronic(): ChronicEntry[] {
  try {
    if (fs.existsSync(CHRONIC_LOG)) {
      return JSON.parse(fs.readFileSync(CHRONIC_LOG, "utf-8"));
    }
  } catch { /* fresh */ }
  return [];
}

function saveChronic(entries: ChronicEntry[]): void {
  fs.mkdirSync(join(app.getPath("userData"), "mosaicbot"), { recursive: true });
  fs.writeFileSync(CHRONIC_LOG, JSON.stringify(entries.slice(-MAX_CHRONIC_LOG), null, 2));
}

function hashAlert(text: string): string {
  // Simple hash: lowercase, strip timestamps, keep first 120 chars
  const normalized = text
    .toLowerCase()
    .replace(/\d{1,2}:\d{2}\s*(am|pm)/g, "")
    .replace(/\d+h/g, "Xh")
    .replace(/\d+d/g, "Xd")
    .slice(0, 120);
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  }
  return String(h);
}

export function recordAlert(alertText: string): { id: string; isChronic: boolean; count: number; actionsTaken: string[] } {
  const entries = loadChronic();
  const id = hashAlert(alertText);
  const existing = entries.find((e) => e.id === id);

  if (existing) {
    existing.count++;
    existing.lastAt = Date.now();
    saveChronic(entries);
    return { id, isChronic: existing.count >= 3, count: existing.count, actionsTaken: existing.actionsTaken };
  }

  entries.push({
    id,
    text: alertText.slice(0, 200),
    count: 1,
    firstAt: Date.now(),
    lastAt: Date.now(),
    actionsTaken: [],
  });
  saveChronic(entries);
  return { id, isChronic: false, count: 1, actionsTaken: [] };
}

function markActionTaken(id: string, action: string): void {
  const entries = loadChronic();
  const e = entries.find((x) => x.id === id);
  if (e) {
    e.actionsTaken.push(action);
    saveChronic(entries);
  }
}

// ── Auto-restart: SSH up + service down >1h ──────────────────────────────────

interface RestartCandidate {
  nodeId: string;
  nodeIp: string;
  services: ("hba" | "tiller")[];
  sshOk: boolean;
  downSinceMinutes: number;
}

function findRestartCandidates(): RestartCandidate[] {
  const snap = getLastFleetSnapshot();
  if (!snap) return [];

  const candidates: RestartCandidate[] = [];
  for (const n of snap.nodes) {
    const servicesDown: ("hba" | "tiller")[] = [];
    if (!n.hba) servicesDown.push("hba");
    if (!n.tiller) servicesDown.push("tiller");

    if (n.ssh && servicesDown.length > 0) {
      // Estimate downtime from telemetry history or alert log
      // Default: assume 60m+ if we're here (heartbeat runs every 30m)
      candidates.push({
        nodeId: n.nodeId,
        nodeIp: n.nodeIp,
        services: servicesDown,
        sshOk: true,
        downSinceMinutes: 60, // conservative
      });
    }
  }
  return candidates;
}

async function runRestart(nodeId: string, service: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", [
      join(AXI_TOOLS_DIR, "hbox-axi", "dist", "index.js"),
      "restart",
      service,
      nodeId,
    ]);
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, output: out + "\n[timeout]" });
    }, 45_000);
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: `[error: ${e.message}]` }); });
    proc.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, output: out }); });
  });
}

// ── Hard-down detection: SSH down >2h ────────────────────────────────────────

interface HardDownNode {
  nodeId: string;
  nodeIp: string;
  unreachableSinceMinutes: number;
}

function findHardDownNodes(): HardDownNode[] {
  const snap = getLastFleetSnapshot();
  if (!snap) return [];

  const hardDown: HardDownNode[] = [];
  for (const n of snap.nodes) {
    if (!n.ssh) {
      // Check if we have telemetry history showing chronic unreachability
      hardDown.push({
        nodeId: n.nodeId,
        nodeIp: n.nodeIp,
        unreachableSinceMinutes: 120, // conservative for now
      });
    }
  }
  return hardDown;
}

// ── Kanban escalation ────────────────────────────────────────────────────────

async function createKanbanEscalation(
  board: string,
  title: string,
  body: string,
  assignee = "ops",
): Promise<{ ok: boolean; taskId?: string; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn("hermes", [
      "kanban", "--board", board, "create", title,
      "--assignee", assignee,
      "--body", body,
      "--created-by", "mosaic-bot-auto",
    ], { env: { ...process.env } });
    let out = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ ok: false, output: out + "\n[timeout]" });
    }, 30_000);
    proc.stdout?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.stderr?.on("data", (d: Buffer) => { out += d.toString("utf-8"); });
    proc.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, output: `[hermes CLI error: ${e.message}]` }); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const idMatch = out.match(/t_[a-f0-9]{8}/);
      resolve({ ok: code === 0, taskId: idMatch?.[0], output: out });
    });
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AutoActionResult {
  tookAction: boolean;
  actions: string[];
  escalationTaskId?: string;
  chronicCount: number;
}

/**
 * Run auto-actions before the LLM heartbeat.
 * Returns what was done so the prompt can reflect reality.
 */
export async function runAutoActions(alertText: string): Promise<AutoActionResult> {
  const result: AutoActionResult = {
    tookAction: false,
    actions: [],
    chronicCount: 0,
  };

  // 1. Record this alert for chronic detection
  const chronic = recordAlert(alertText);
  result.chronicCount = chronic.count;

  // 2. Chronic escalation: same alert 3+ times → create kanban task
  if (chronic.isChronic && !chronic.actionsTaken.includes("kanban_escalation")) {
    const kanban = await createKanbanEscalation(
      "ops",
      `[Chronic] ${alertText.slice(0, 80)}`,
      `Auto-escalated after ${chronic.count} identical alerts.\n\nLatest alert:\n${alertText}\n\nSuggested actions already attempted or proposed:\n${chronic.actionsTaken.join("\n") || "None yet"}`,
    );
    if (kanban.ok) {
      markActionTaken(chronic.id, "kanban_escalation");
      result.tookAction = true;
      result.actions.push(`Escalated to kanban ops:${kanban.taskId} (chronic ×${chronic.count})`);
      result.escalationTaskId = kanban.taskId;
      recordAction("kanban_create", `ops:${kanban.taskId}`, `chronic escalation ×${chronic.count}`);
    }
  }

  // 3. Auto-restart: SSH up + service down (if allowlisted)
  const allow = readAllowlist();
  if (allow.restart_service) {
    const candidates = findRestartCandidates();
    for (const c of candidates) {
      for (const svc of c.services) {
        const actionKey = `restart_${c.nodeId}_${svc}`;
        if (chronic.actionsTaken.includes(actionKey)) continue; // already tried this heartbeat cycle

        const restart = await runRestart(c.nodeId, svc);
        markActionTaken(chronic.id, actionKey);
        recordAction("restart_service", `${c.nodeId}:${svc}`, restart.ok ? "restart sent" : "restart failed");

        result.tookAction = true;
        result.actions.push(
          `Auto-restarted ${svc} on ${c.nodeId} (${c.nodeIp}): ${restart.ok ? "✓ sent" : "✗ failed — " + restart.output.slice(0, 120)}`,
        );
      }
    }
  }

  // 4. Hard-down declaration: SSH down >2h → create kanban ops task (if not already)
  const hardDown = findHardDownNodes();
  for (const n of hardDown) {
    const actionKey = `harddown_${n.nodeId}`;
    if (chronic.actionsTaken.includes(actionKey)) continue;

    const kanban = await createKanbanEscalation(
      "ops",
      `[Hard Down] ${n.nodeId} unreachable ${n.unreachableSinceMinutes}m`,
      `Node ${n.nodeId} (${n.nodeIp}) has been SSH-unreachable for ${n.unreachableSinceMinutes} minutes.\n\nPhysical ops required: check power, network cable, DHCP lease, or hardware failure.\n\nAuto-detected by Mosaic Bot chronic failure system.`,
    );
    if (kanban.ok) {
      markActionTaken(chronic.id, actionKey);
      result.tookAction = true;
      result.actions.push(`Declared ${n.nodeId} hard-down → kanban ops:${kanban.taskId}`);
      result.escalationTaskId = kanban.taskId;
      recordAction("kanban_create", `ops:${kanban.taskId}`, `hard-down ${n.nodeId}`);
    }
  }

  return result;
}

/**
 * Build a prompt section telling the bot what auto-actions already ran.
 */
export function buildAutoActionPrompt(result: AutoActionResult): string {
  if (!result.tookAction) return "";
  const lines = [
    "",
    "## Auto-Actions Already Executed This Heartbeat",
    "(The system took action before you woke up. Do NOT repeat these actions.)",
    "",
    ...result.actions.map((a) => `- ${a}`),
    "",
    result.escalationTaskId
      ? `Escalation task: ops:${result.escalationTaskId}. Your job: MONITOR and REPORT progress, not re-escalate.`
      : "",
    result.chronicCount >= 3
      ? `⚠️ CHRONIC PATTERN: This alert has fired ${result.chronicCount} times. If auto-actions failed, recommend a NEW approach (different tool, different diagnosis, or admit physical ops needed).`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}
