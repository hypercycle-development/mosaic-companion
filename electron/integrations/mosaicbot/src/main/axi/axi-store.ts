// axi-store.ts — Persistent SQLite store for the AXI Tool Forge
// ─────────────────────────────────────────────────────────────────────────────
// Records the bot's forge history: tools built, AIM modules created, deployments,
// forge sessions, and node telemetry. Lives in its own DB file (axi.sqlite)
// alongside the bot's main memory DB. Uses better-sqlite3 (already a dependency).
// ─────────────────────────────────────────────────────────────────────────────

import BetterSqlite3 from "better-sqlite3";
import type { Database as BetterDatabase } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { CREATE_AXI_TABLES_SQL, AXI_SCHEMA_VERSION } from "./schema.sql.js";

let db: BetterDatabase | null = null;

// ── Init ─────────────────────────────────────────────────────────────────────

export function initAxiStore(appDir: string): BetterDatabase {
  if (db) return db;

  const dbDir = path.join(appDir, "memory");
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, "axi.sqlite");

  db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  // meta table first (schema version tracking)
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  db.exec(CREATE_AXI_TABLES_SQL);
  // Outcome-scoring table (reinforcement layer): every write action the bot
  // takes gets a row; a later heartbeat verifies whether it actually worked.
  db.exec(`
    CREATE TABLE IF NOT EXISTS action_outcomes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      target      TEXT NOT NULL,
      detail      TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failure | unknown
      note        TEXT,
      taken_at    INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_outcomes_status ON action_outcomes(status);
  `);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('axi_schema_version', ?)")
    .run(String(AXI_SCHEMA_VERSION));

  console.log(`[AxiStore] Initialized at ${dbPath} (schema v${AXI_SCHEMA_VERSION})`);
  return db;
}

export function getAxiDb(): BetterDatabase | null {
  return db;
}

export function closeAxiStore(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ── Tools ────────────────────────────────────────────────────────────────────

export interface AxiToolRecord {
  id: string;
  name: string;
  domain: string;
  description: string;
  version: string;
  commands: string[];
  source_path?: string;
  status: "draft" | "built" | "tested" | "aimified" | "deployed";
  aimified: boolean;
}

export function upsertTool(tool: AxiToolRecord): void {
  if (!db) return;
  const now = Date.now();
  db.prepare(`
    INSERT INTO axi_tools (id, name, domain, description, version, commands, source_path, status, aimified, created_at, updated_at)
    VALUES (@id, @name, @domain, @description, @version, @commands, @source_path, @status, @aimified, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      name = @name, domain = @domain, description = @description, version = @version,
      commands = @commands, source_path = @source_path, status = @status,
      aimified = @aimified, updated_at = @now
  `).run({
    ...tool,
    commands: JSON.stringify(tool.commands),
    source_path: tool.source_path ?? null,
    aimified: tool.aimified ? 1 : 0,
    now,
  });
}

export function listTools(): Array<Record<string, unknown>> {
  if (!db) return [];
  return db.prepare("SELECT * FROM axi_tools ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>;
}

export function setToolStatus(id: string, status: string): void {
  if (!db) return;
  db.prepare("UPDATE axi_tools SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, Date.now(), id);
}

// ── Forge Sessions ───────────────────────────────────────────────────────────

export function startForgeSession(prompt: string): string {
  if (!db) return "";
  const id = `forge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(`
    INSERT INTO axi_sessions (id, prompt, status, created_at)
    VALUES (?, ?, 'pending', ?)
  `).run(id, prompt, Date.now());
  return id;
}

export function completeForgeSession(
  id: string,
  outcome: { status: "done" | "failed"; toolId?: string; moduleId?: string; error?: string },
): void {
  if (!db) return;
  const row = db.prepare("SELECT created_at FROM axi_sessions WHERE id = ?").get(id) as
    | { created_at: number }
    | undefined;
  const duration = row ? Date.now() - row.created_at : null;
  db.prepare(`
    UPDATE axi_sessions
       SET status = ?, tool_id = ?, module_id = ?, error = ?, duration_ms = ?, completed_at = ?
     WHERE id = ?
  `).run(
    outcome.status,
    outcome.toolId ?? null,
    outcome.moduleId ?? null,
    outcome.error ?? null,
    duration,
    Date.now(),
    id,
  );
}

export function listForgeSessions(limit = 20): Array<Record<string, unknown>> {
  if (!db) return [];
  return db
    .prepare("SELECT * FROM axi_sessions ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Array<Record<string, unknown>>;
}

// ── AIM Modules ──────────────────────────────────────────────────────────────

export function recordAimModule(mod: {
  id: string;
  tool_id: string;
  name: string;
  version: string;
  manifest: string;
  docker_image?: string;
  status?: string;
}): void {
  if (!db) return;
  const now = Date.now();
  db.prepare(`
    INSERT INTO aim_modules (id, tool_id, name, version, manifest, docker_image, status, created_at, updated_at)
    VALUES (@id, @tool_id, @name, @version, @manifest, @docker_image, @status, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      manifest = @manifest, docker_image = @docker_image, status = @status, updated_at = @now
  `).run({
    ...mod,
    docker_image: mod.docker_image ?? null,
    status: mod.status ?? "built",
    now,
  });
}

// ── Deployments ──────────────────────────────────────────────────────────────

export function recordDeployment(dep: {
  module_id: string;
  node_id: string;
  node_ip: string;
  status: string;
}): string {
  if (!db) return "";
  const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  db.prepare(`
    INSERT INTO axi_deployments (id, module_id, node_id, node_ip, status, deployed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, dep.module_id, dep.node_id, dep.node_ip, dep.status,
         dep.status === "running" ? now : null, now);
  return id;
}

// ── Node Telemetry ───────────────────────────────────────────────────────────

export function recordNodeTelemetry(t: {
  node_id: string;
  node_ip: string;
  hba_status?: string;
  tiller_status?: string;
  aims_running?: number;
  aims_total?: number;
  disk_free_gb?: number;
}): void {
  if (!db) return;
  db.prepare(`
    INSERT INTO axi_node_telemetry (node_id, node_ip, hba_status, tiller_status, aims_running, aims_total, disk_free_gb, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    t.node_id, t.node_ip, t.hba_status ?? "unknown", t.tiller_status ?? "unknown",
    t.aims_running ?? null, t.aims_total ?? null, t.disk_free_gb ?? null, Date.now(),
  );
  // Keep only the most recent 5000 telemetry rows
  db.exec(`DELETE FROM axi_node_telemetry WHERE id NOT IN
           (SELECT id FROM axi_node_telemetry ORDER BY timestamp DESC LIMIT 5000)`);
}

export function getForgeStats(): { tools: number; modules: number; deployments: number; sessions: number } {
  if (!db) return { tools: 0, modules: 0, deployments: 0, sessions: 0 };
  const c = (sql: string): number =>
    (db!.prepare(sql).get() as { n: number }).n;
  return {
    tools: c("SELECT COUNT(*) AS n FROM axi_tools"),
    modules: c("SELECT COUNT(*) AS n FROM aim_modules"),
    deployments: c("SELECT COUNT(*) AS n FROM axi_deployments"),
    sessions: c("SELECT COUNT(*) AS n FROM axi_sessions"),
  };
}

// ── Outcome Scoring (reinforcement layer) ────────────────────────────────────

export interface PendingAction {
  id: number;
  action_type: string;
  target: string;
  detail: string | null;
  taken_at: number;
}

export function recordAction(actionType: string, target: string, detail = ""): number {
  if (!db) return 0;
  const info = db.prepare(
    "INSERT INTO action_outcomes (action_type, target, detail, status, taken_at) VALUES (?, ?, ?, 'pending', ?)",
  ).run(actionType, target, detail.slice(0, 300), Date.now());
  return Number(info.lastInsertRowid);
}

export function listPendingActions(minAgeMs = 3 * 60_000): PendingAction[] {
  if (!db) return [];
  return db.prepare(
    "SELECT id, action_type, target, detail, taken_at FROM action_outcomes WHERE status = 'pending' AND taken_at < ? ORDER BY taken_at ASC LIMIT 50",
  ).all(Date.now() - minAgeMs) as PendingAction[];
}

export function resolveAction(id: number, outcome: "success" | "failure" | "unknown", note = ""): void {
  if (!db) return;
  db.prepare(
    "UPDATE action_outcomes SET status = ?, note = ?, resolved_at = ? WHERE id = ?",
  ).run(outcome, note.slice(0, 300), Date.now(), id);
}

export function getScorecard(days = 14): Array<{ action_type: string; success: number; failure: number; pending: number }> {
  if (!db) return [];
  const since = Date.now() - days * 86_400_000;
  return db.prepare(`
    SELECT action_type,
           SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS success,
           SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) AS failure,
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
      FROM action_outcomes WHERE taken_at > ?
     GROUP BY action_type
  `).all(since) as Array<{ action_type: string; success: number; failure: number; pending: number }>;
}

export function getRecentFailures(limit = 5): Array<{ action_type: string; target: string; note: string | null }> {
  if (!db) return [];
  return db.prepare(
    "SELECT action_type, target, note FROM action_outcomes WHERE status='failure' ORDER BY resolved_at DESC LIMIT ?",
  ).all(limit) as Array<{ action_type: string; target: string; note: string | null }>;
}
