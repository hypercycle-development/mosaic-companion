// kanban-bridge.ts — Mosaic Bot's window into Hermes Kanban (multi-board)
// ─────────────────────────────────────────────────────────────────────────────
// Read: board discovery, task listing, task detail (comments/runs/failures).
// Write (allowlist-gated at the tool layer): comment, unblock.
// Talks directly to the SQLite DBs under ~/.hermes/kanban/boards/<slug>/kanban.db
// using better-sqlite3 (same engine the app already ships).
// ─────────────────────────────────────────────────────────────────────────────

import BetterSqlite3 from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";

const BOARDS_DIR = path.join(homedir(), ".hermes", "kanban", "boards");

function openBoard(slug: string): BetterSqlite3.Database | null {
  const p = path.join(BOARDS_DIR, slug, "kanban.db");
  if (!fs.existsSync(p)) return null;
  try {
    const db = new BetterSqlite3(p, { readonly: false, fileMustExist: true });
    db.pragma("busy_timeout = 3000");
    return db;
  } catch {
    return null;
  }
}

export function listBoards(): Array<{ slug: string; counts: Record<string, number> }> {
  if (!fs.existsSync(BOARDS_DIR)) return [];
  const out: Array<{ slug: string; counts: Record<string, number> }> = [];
  for (const slug of fs.readdirSync(BOARDS_DIR)) {
    const db = openBoard(slug);
    if (!db) continue;
    try {
      const rows = db.prepare("SELECT status, COUNT(*) n FROM tasks GROUP BY status").all() as Array<{ status: string; n: number }>;
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status] = r.n;
      out.push({ slug, counts });
    } catch { /* skip corrupt board */ } finally {
      db.close();
    }
  }
  return out;
}

export interface KanbanTaskSummary {
  id: string;
  board: string;
  title: string;
  assignee: string | null;
  status: string;
  failures: number;
  lastError: string | null;
}

export function listTasks(opts: { board?: string; status?: string } = {}): KanbanTaskSummary[] {
  const boards = opts.board ? [opts.board] : (fs.existsSync(BOARDS_DIR) ? fs.readdirSync(BOARDS_DIR) : []);
  const out: KanbanTaskSummary[] = [];
  for (const slug of boards) {
    const db = openBoard(slug);
    if (!db) continue;
    try {
      const sql = opts.status
        ? "SELECT id, title, assignee, status, consecutive_failures, last_failure_error FROM tasks WHERE status = ?"
        : "SELECT id, title, assignee, status, consecutive_failures, last_failure_error FROM tasks WHERE status NOT IN ('done','archived')";
      const rows = (opts.status ? db.prepare(sql).all(opts.status) : db.prepare(sql).all()) as Array<Record<string, unknown>>;
      for (const r of rows) {
        out.push({
          id: String(r.id),
          board: slug,
          title: String(r.title ?? "").slice(0, 90),
          assignee: (r.assignee as string) ?? null,
          status: String(r.status),
          failures: Number(r.consecutive_failures ?? 0),
          lastError: r.last_failure_error ? String(r.last_failure_error).slice(0, 160) : null,
        });
      }
    } catch { /* skip */ } finally {
      db.close();
    }
  }
  return out;
}

export function getTaskDetail(board: string, taskId: string): string {
  const db = openBoard(board);
  if (!db) return `[board "${board}" not found]`;
  try {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
    if (!task) return `[task ${taskId} not found on board ${board}]`;

    const comments = db.prepare(
      "SELECT author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at DESC LIMIT 5",
    ).all(taskId) as Array<Record<string, unknown>>;
    const runs = db.prepare(
      "SELECT outcome, summary, started_at FROM task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 5",
    ).all(taskId) as Array<Record<string, unknown>>;
    const parents = db.prepare(
      "SELECT parent_id FROM task_links WHERE child_id = ?",
    ).all(taskId) as Array<Record<string, unknown>>;

    const lines: string[] = [];
    lines.push(`# ${task.title}`);
    lines.push(`board=${board} id=${taskId} status=${task.status} assignee=${task.assignee} failures=${task.consecutive_failures}`);
    if (task.last_failure_error) lines.push(`last_error: ${String(task.last_failure_error).slice(0, 200)}`);
    if (parents.length) lines.push(`parents: ${parents.map((p) => p.parent_id).join(", ")}`);
    lines.push(`body: ${String(task.body ?? "").slice(0, 600)}`);
    if (runs.length) {
      lines.push("recent runs:");
      for (const r of runs) lines.push(`  - ${r.outcome}: ${String(r.summary ?? "").slice(0, 120)}`);
    }
    if (comments.length) {
      lines.push("recent comments:");
      for (const c of comments) lines.push(`  - [${c.author}] ${String(c.body ?? "").slice(0, 150)}`);
    }
    return lines.join("\n");
  } catch (e) {
    return `[error: ${(e as Error).message}]`;
  } finally {
    db.close();
  }
}

export function addComment(board: string, taskId: string, body: string): string {
  const db = openBoard(board);
  if (!db) return `[board "${board}" not found]`;
  try {
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
    if (!task) return `[task ${taskId} not found]`;
    db.prepare(
      "INSERT INTO task_comments (task_id, author, body, created_at) VALUES (?, 'mosaic-bot', ?, ?)",
    ).run(taskId, body.slice(0, 2000), Date.now());
    return `Comment added to ${taskId} on ${board} as author 'mosaic-bot'.`;
  } catch (e) {
    return `[error: ${(e as Error).message}]`;
  } finally {
    db.close();
  }
}

export function unblockTask(board: string, taskId: string): string {
  const db = openBoard(board);
  if (!db) return `[board "${board}" not found]`;
  try {
    const task = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
    if (!task) return `[task ${taskId} not found]`;
    if (task.status !== "blocked") return `[task ${taskId} is '${task.status}', not blocked — no action]`;
    db.prepare("UPDATE tasks SET status = 'ready', consecutive_failures = 0 WHERE id = ?").run(taskId);
    db.prepare(
      "INSERT INTO task_events (task_id, event, detail, created_at) VALUES (?, 'unblocked', 'unblocked by mosaic-bot heartbeat', ?)",
    ).run(taskId, Date.now());
    return `Task ${taskId} moved blocked → ready (failures reset). The dispatcher will pick it up next tick.`;
  } catch (e) {
    return `[error: ${(e as Error).message}]`;
  } finally {
    db.close();
  }
}
