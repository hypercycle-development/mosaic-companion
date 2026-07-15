// ─────────────────────────────────────────────────────────────────────────────
// AXI EXTENSION SCHEMA for Mosaic Bot SQLite
// Additions to existing schema.ts — new tables for AXI tool tracking
// ─────────────────────────────────────────────────────────────────────────────

export const AXI_SCHEMA_VERSION = 1;

// ── AXI Tool Registry ────────────────────────────────────────────────────────
export const CREATE_AXI_TABLES_SQL = `
  -- Registered AXI tools (built by Mosaic Bot or manually installed)
  CREATE TABLE IF NOT EXISTS axi_tools (
    id           TEXT PRIMARY KEY,            -- e.g. "hbox-axi"
    name         TEXT NOT NULL,               -- display name
    domain       TEXT NOT NULL,               -- e.g. "infra", "github", "browser"
    description  TEXT NOT NULL,
    version      TEXT NOT NULL DEFAULT "0.1.0",
    commands     TEXT NOT NULL DEFAULT "[]",  -- JSON array of command strings
    source_path  TEXT,                        -- local path to source
    npm_package  TEXT,                        -- published package name (if any)
    status       TEXT NOT NULL DEFAULT "draft", -- draft | built | tested | aimified | deployed
    aimified     INTEGER NOT NULL DEFAULT 0,  -- 0 = no, 1 = yes
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  -- AIM Modules (AXI tools wrapped for HyperCycle deployment)
  CREATE TABLE IF NOT EXISTS aim_modules (
    id           TEXT PRIMARY KEY,            -- e.g. "hbox-aim-v1.2"
    tool_id      TEXT NOT NULL,               -- FK → axi_tools.id
    name         TEXT NOT NULL,
    version      TEXT NOT NULL,
    manifest     TEXT NOT NULL,               -- JSON: AIM manifest
    docker_image TEXT,                        -- built image tag
    status       TEXT NOT NULL DEFAULT "draft", -- draft | built | pushed | deployed | deprecated
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    FOREIGN KEY (tool_id) REFERENCES axi_tools(id) ON DELETE CASCADE
  );

  -- Deployments (AIM module → HyperAIBox node)
  CREATE TABLE IF NOT EXISTS axi_deployments (
    id           TEXT PRIMARY KEY,
    module_id    TEXT NOT NULL,               -- FK → aim_modules.id
    node_id      TEXT NOT NULL,               -- e.g. "c3po", "r2d2"
    node_ip      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT "pending", -- pending | deploying | running | stopped | failed
    health       TEXT,                        -- JSON: last health check
    deployed_at  INTEGER,
    stopped_at   INTEGER,
    created_at   INTEGER NOT NULL,
    FOREIGN KEY (module_id) REFERENCES aim_modules(id) ON DELETE CASCADE
  );

  -- Forge Sessions (prompt → tool → aim → deploy history)
  CREATE TABLE IF NOT EXISTS axi_sessions (
    id           TEXT PRIMARY KEY,
    prompt       TEXT NOT NULL,               -- user's original request
    tool_id      TEXT,                        -- FK → axi_tools.id (may be null if failed)
    module_id    TEXT,                        -- FK → aim_modules.id (may be null)
    status       TEXT NOT NULL DEFAULT "pending", -- pending | forging | aimifying | deploying | done | failed
    error        TEXT,                        -- error message if failed
    duration_ms  INTEGER,                     -- total time
    created_at   INTEGER NOT NULL,
    completed_at INTEGER,
    FOREIGN KEY (tool_id) REFERENCES axi_tools(id) ON DELETE SET NULL,
    FOREIGN KEY (module_id) REFERENCES aim_modules(id) ON DELETE SET NULL
  );

  -- Node Telemetry (per-Node Manager snapshot)
  CREATE TABLE IF NOT EXISTS axi_node_telemetry (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id      TEXT NOT NULL,
    node_ip      TEXT NOT NULL,
    cpu_percent  REAL,
    mem_used_mb  INTEGER,
    mem_total_mb INTEGER,
    disk_free_gb INTEGER,
    aims_running INTEGER,
    aims_total   INTEGER,
    hba_status   TEXT,                        -- "ok" | "error" | "unknown"
    tiller_status TEXT,                       -- "ok" | "error" | "unknown"
    timestamp    INTEGER NOT NULL
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_axi_tools_status     ON axi_tools(status);
  CREATE INDEX IF NOT EXISTS idx_aim_modules_tool_id  ON aim_modules(tool_id);
  CREATE INDEX IF NOT EXISTS idx_axi_deployments_mod  ON axi_deployments(module_id);
  CREATE INDEX IF NOT EXISTS idx_axi_deployments_node   ON axi_deployments(node_id);
  CREATE INDEX IF NOT EXISTS idx_axi_sessions_status    ON axi_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_node_telemetry_node    ON axi_node_telemetry(node_id, timestamp DESC);
`;

export const SET_AXI_SCHEMA_VERSION_SQL = `
  INSERT OR REPLACE INTO meta (key, value) VALUES ('axi_schema_version', '${AXI_SCHEMA_VERSION}');
`;
