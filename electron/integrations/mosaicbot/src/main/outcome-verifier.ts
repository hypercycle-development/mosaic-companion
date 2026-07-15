// outcome-verifier.ts — Reinforcement layer: verify whether past actions worked
// ─────────────────────────────────────────────────────────────────────────────
// Every write action the bot takes is recorded as 'pending' in action_outcomes.
// Each heartbeat, this verifier checks reality (kanban DBs, fleet telemetry,
// skill dirs) and resolves pending → success/failure. The scorecard is then
// injected into the prompt so the bot LEARNS which actions actually work.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { app } from "electron";
import BetterSqlite3 from "better-sqlite3";
import {
  listPendingActions,
  resolveAction,
  getScorecard,
  getRecentFailures,
} from "./axi/axi-store.js";
import { getLastFleetSnapshot } from "./fleet-telemetry.js";

const BOARDS_DIR = path.join(homedir(), ".hermes", "kanban", "boards");

function taskStatus(board: string, taskId: string): { status: string; failures: number } | null {
  const p = path.join(BOARDS_DIR, board, "kanban.db");
  if (!fs.existsSync(p)) return null;
  try {
    const db = new BetterSqlite3(p, { readonly: true, fileMustExist: true });
    const r = db.prepare("SELECT status, consecutive_failures FROM tasks WHERE id = ?").get(taskId) as
      | { status: string; consecutive_failures: number }
      | undefined;
    db.close();
    return r ? { status: r.status, failures: r.consecutive_failures } : null;
  } catch {
    return null;
  }
}

// ── Verification rules per action type ───────────────────────────────────────

export function verifyPendingActions(): { resolved: number; details: string[] } {
  const pending = listPendingActions(3 * 60_000); // only actions ≥3min old
  const details: string[] = [];
  let resolved = 0;

  for (const a of pending) {
    const ageMin = Math.round((Date.now() - a.taken_at) / 60_000);

    try {
      if (a.action_type === "kanban_unblock" || a.action_type === "kanban_create") {
        // target format: "board:taskId"
        const [board, taskId] = a.target.split(":");
        const t = board && taskId ? taskStatus(board, taskId) : null;
        if (!t) {
          if (ageMin > 60) { resolveAction(a.id, "unknown", "task not found after 1h"); resolved++; }
          continue;
        }
        if (t.status === "done") {
          resolveAction(a.id, "success", "task reached done");
          details.push(`✓ ${a.action_type} ${a.target} → done`);
          resolved++;
        } else if (t.status === "blocked" && t.failures > 0) {
          resolveAction(a.id, "failure", `re-blocked with ${t.failures} failures`);
          details.push(`✗ ${a.action_type} ${a.target} → re-blocked`);
          resolved++;
        } else if (ageMin > 240) {
          // running/ready for 4h+ — call it unknown, don't wait forever
          resolveAction(a.id, "unknown", `still ${t.status} after ${ageMin}m`);
          resolved++;
        }
        // else still in-flight — keep pending
      } else if (a.action_type === "restart_service") {
        // target format: "node:service" — verify via latest fleet snapshot
        const [nodeId, service] = a.target.split(":");
        const snap = getLastFleetSnapshot();
        const node = snap?.nodes.find((n) => n.nodeId === nodeId);
        if (!node) continue; // no telemetry yet — keep pending
        const healthy = service === "hba" ? node.hba : service === "tiller" ? node.tiller : node.ssh;
        resolveAction(a.id, healthy ? "success" : "failure", `${service} on ${nodeId}: ${healthy ? "healthy" : "still down"} in telemetry`);
        details.push(`${healthy ? "✓" : "✗"} restart ${a.target}`);
        resolved++;
      } else if (a.action_type === "create_skill") {
        // target = skill name; success if the SKILL.md exists in Mosaic's managed dir
        const skillPath = path.join(
          app.getPath("userData"), "mosaicbot", "skills", "mosaicbot-authored", a.target, "SKILL.md",
        );
        if (fs.existsSync(skillPath) && fs.statSync(skillPath).size > 200) {
          resolveAction(a.id, "success", "SKILL.md exists");
          resolved++;
        } else if (ageMin > 30) {
          resolveAction(a.id, "failure", "SKILL.md missing/empty after 30m");
          resolved++;
        }
      } else if (ageMin > 240) {
        resolveAction(a.id, "unknown", "no verifier for this action type");
        resolved++;
      }
    } catch (e) {
      details.push(`verify error for #${a.id}: ${(e as Error).message}`);
    }
  }

  return { resolved, details };
}

// ── Scorecard prompt section ─────────────────────────────────────────────────

export function buildScorecardPrompt(): string {
  const lines: string[] = [];
  lines.push("## My Action Scorecard (verified outcomes, last 14 days — LEARN FROM THIS)");
  try {
    const rows = getScorecard(14);
    if (rows.length === 0) {
      lines.push("No scored actions yet. Every write action I take gets verified next heartbeat.");
      return lines.join("\n");
    }
    for (const r of rows) {
      const total = r.success + r.failure;
      const rate = total > 0 ? Math.round((r.success / total) * 100) : null;
      lines.push(`- ${r.action_type}: ${r.success}✓ ${r.failure}✗ ${r.pending} pending${rate !== null ? ` → ${rate}% success rate` : ""}`);
    }
    const fails = getRecentFailures(3);
    if (fails.length > 0) {
      lines.push("Recent failures (avoid repeating these):");
      for (const f of fails) lines.push(`  ✗ ${f.action_type} on ${f.target}: ${f.note ?? "?"}`);
    }
    lines.push("RULE: If an action type has <50% success rate over 4+ attempts, STOP using it for that situation and either try a different approach or escalate to the user.");
  } catch {
    lines.push("Scorecard unavailable this beat.");
  }
  return lines.join("\n");
}
