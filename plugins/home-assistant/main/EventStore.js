// EventStore — persistent capture of Home Assistant state changes.
//
// Writes one row per state_changed event into a local SQLite database
// (userData/home-assistant-events.db) so the home's history can later be mined
// for routine suggestions. Uses better-sqlite3, which is already a dependency
// and externalized in esbuild.config.* — same engine as the agent memory store.
import { app } from "electron";
import path from "path";
import BetterSqlite3 from "better-sqlite3";

const DB_FILE = "home-assistant-events.db";
const DEFAULT_RETENTION_DAYS = 30;

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS home_events (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  old_state TEXT,
  new_state TEXT,
  attrs TEXT,
  context_user TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_entity_ts ON home_events(entity_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_ts ON home_events(ts);
`;

export class EventStore {
  constructor(dbPath) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.exec(CREATE_SQL);

    this._insertStmt = this.db.prepare(
      `INSERT INTO home_events (ts, entity_id, domain, old_state, new_state, attrs, context_user)
       VALUES (@ts, @entity_id, @domain, @old_state, @new_state, @attrs, @context_user)`,
    );
  }

  static open() {
    const dbPath = path.join(app.getPath("userData"), DB_FILE);
    return new EventStore(dbPath);
  }

  // Insert a normalized HaStateChange (from HaClient). Never throws — capture
  // must not break the live connection.
  insert(evt) {
    try {
      this._insertStmt.run({
        ts: evt.ts ?? Date.now(),
        entity_id: evt.entityId || "",
        domain: evt.domain || "",
        old_state: evt.oldState ?? null,
        new_state: evt.newState ?? null,
        attrs: evt.attrs ? JSON.stringify(evt.attrs) : null,
        context_user: evt.contextUser ?? null,
      });
    } catch (e) {
      console.error("[HomeAssistant] EventStore insert failed:", e.message);
    }
  }

  // Most recent events, optionally filtered by entity_id, newest first.
  getHistory({ entityId, sinceMs, limit = 200 } = {}) {
    const clauses = [];
    const params = {};
    if (entityId) { clauses.push("entity_id = @entityId"); params.entityId = entityId; }
    if (sinceMs) { clauses.push("ts >= @sinceMs"); params.sinceMs = sinceMs; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.limit = Math.min(Math.max(1, limit), 2000);
    const rows = this.db
      .prepare(`SELECT * FROM home_events ${where} ORDER BY ts DESC LIMIT @limit`)
      .all(params);
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      entityId: r.entity_id,
      domain: r.domain,
      oldState: r.old_state,
      newState: r.new_state,
      attrs: r.attrs ? safeParse(r.attrs) : {},
      contextUser: r.context_user,
    }));
  }

  // Bulk fetch for pattern mining: all events since a timestamp, ascending,
  // bounded by a sane cap. Returns the same normalized shape as getHistory.
  getAllSince(sinceMs, max = 50000) {
    const rows = this.db
      .prepare(
        `SELECT * FROM home_events WHERE ts >= @sinceMs ORDER BY ts ASC LIMIT @max`,
      )
      .all({ sinceMs: sinceMs ?? 0, max });
    return rows.map((r) => ({
      id: r.id,
      ts: r.ts,
      entityId: r.entity_id,
      domain: r.domain,
      oldState: r.old_state,
      newState: r.new_state,
      attrs: r.attrs ? safeParse(r.attrs) : {},
      contextUser: r.context_user,
    }));
  }

  // Aggregate stats for the History dashboard.
  getStats() {
    const total = this.db.prepare("SELECT COUNT(*) AS c FROM home_events").get().c;
    const oldest = this.db.prepare("SELECT MIN(ts) AS t FROM home_events").get().t;
    const newest = this.db.prepare("SELECT MAX(ts) AS t FROM home_events").get().t;
    const topEntities = this.db
      .prepare(
        `SELECT entity_id AS entityId, COUNT(*) AS count, MAX(ts) AS lastTs
         FROM home_events GROUP BY entity_id ORDER BY count DESC LIMIT 25`,
      )
      .all();
    return { total, oldestTs: oldest, newestTs: newest, topEntities };
  }

  // Delete rows older than the retention window. Returns rows removed.
  prune(retentionDays = DEFAULT_RETENTION_DAYS) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const info = this.db.prepare("DELETE FROM home_events WHERE ts < ?").run(cutoff);
      return info.changes || 0;
    } catch (e) {
      console.error("[HomeAssistant] EventStore prune failed:", e.message);
      return 0;
    }
  }

  close() {
    try { this.db.close(); } catch { /* ignore */ }
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
