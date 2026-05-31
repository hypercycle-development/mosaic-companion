// Home Assistant plugin — main process.
//
// Owns the connection to a local Home Assistant server (via HaClient), persists
// connection settings (URL + an encrypted long-lived token), exposes namespaced
// IPC handlers ("home-assistant:*"), and pushes live state-change events to the
// renderer. Storage/encryption follows the HyperInsight pattern; event pushing
// follows the chat integration pattern.
import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import { HaClient } from "./HaClient.js";
import { EventStore } from "./EventStore.js";
import { findSuggestions } from "./PatternEngine.js";

const SETTINGS_FILE = "home-assistant.json";
const RETENTION_DAYS = 30;
const SUGGESTION_WINDOW_DAYS = 30;
const BACKFILL_MAX_DAYS = 30; // never reach back further than retention
const BACKFILL_EMPTY_DAYS = 7; // on first ever connect, grab the last week
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // prune old events every 6 hours

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let haClient = null;
let connectionStatus = "disconnected"; // "disconnected" | "connecting" | "connected"
let eventStore = null;
let pruneTimer = null;

// Lazily open the SQLite event store (shared across connect/disconnect cycles).
function getEventStore() {
  if (!eventStore) {
    try {
      eventStore = EventStore.open();
    } catch (e) {
      console.error("[HomeAssistant] Failed to open EventStore:", e.message);
      eventStore = null;
    }
  }
  return eventStore;
}

export function setMainWindow(win) {
  mainWindow = win;
}

function push(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(`home-assistant:${channel}`, data);
  }
}

function setStatus(status) {
  connectionStatus = status;
  push("status", { status });
}

// ── Settings storage (token encrypted via safeStorage) ─────────────────────────
function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

// Raw on-disk JSON (includes the encrypted token). Internal use only.
function rawRead() {
  try {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8")) || {};
  } catch (e) {
    console.error("[HomeAssistant] Failed to read settings:", e);
    return {};
  }
}

// Merge-write: only the fields present in `patch` are changed; everything else
// is preserved. `token` (plaintext) is re-encrypted only when a non-empty value
// is supplied, so a blank token never wipes the saved one.
function writeSettings(patch = {}) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system");
  }
  const existing = rawRead();
  let tokenEncB64 = existing.tokenEncB64 || "";
  if (typeof patch.token === "string" && patch.token.length > 0) {
    tokenEncB64 = safeStorage.encryptString(patch.token).toString("base64");
  }
  const pick = (key, fallback) => (patch[key] !== undefined ? patch[key] : fallback);
  const data = {
    baseUrl: pick("baseUrl", existing.baseUrl || ""),
    tokenEncB64,
    allowControl: Boolean(pick("allowControl", existing.allowControl)),
    autoConnect: Boolean(pick("autoConnect", existing.autoConnect)),
    haAgentId: pick("haAgentId", existing.haAgentId || ""),
    ignoredEntities: pick("ignoredEntities", existing.ignoredEntities || []),
    dashboardEntities: pick("dashboardEntities", existing.dashboardEntities || []),
    entityLabels: pick("entityLabels", existing.entityLabels || {}),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), "utf8");
  return true;
}

// Decrypted view of settings, or null if nothing is stored.
function readSettings() {
  const data = rawRead();
  if (!data || Object.keys(data).length === 0) return null;
  let token = "";
  if (data.tokenEncB64 && safeStorage.isEncryptionAvailable()) {
    try {
      token = safeStorage.decryptString(Buffer.from(data.tokenEncB64, "base64"));
    } catch {
      token = "";
    }
  }
  return {
    baseUrl: data.baseUrl || "",
    token,
    allowControl: Boolean(data.allowControl),
    autoConnect: Boolean(data.autoConnect),
    haAgentId: data.haAgentId || "",
    ignoredEntities: Array.isArray(data.ignoredEntities) ? data.ignoredEntities : [],
    dashboardEntities: Array.isArray(data.dashboardEntities) ? data.dashboardEntities : [],
    entityLabels: data.entityLabels && typeof data.entityLabels === "object" ? data.entityLabels : {},
  };
}

// ── Connection lifecycle ───────────────────────────────────────────────────────
function teardownClient() {
  if (haClient) {
    haClient.destroy();
    haClient = null;
  }
}

async function connect() {
  const settings = readSettings();
  if (!settings || !settings.baseUrl) return { success: false, error: "Server URL not set" };
  if (!settings.token) return { success: false, error: "Access token not set" };

  teardownClient();
  setStatus("connecting");

  // Validate token + reachability up front so the user gets an immediate, clear
  // error instead of a silent reconnect loop against a bad URL/token.
  try {
    const probe = new HaClient({ baseUrl: settings.baseUrl, token: settings.token });
    await probe.fetchConfig();
    probe.destroy();
  } catch (e) {
    setStatus("disconnected");
    return { success: false, error: `Could not reach Home Assistant: ${e.message}` };
  }

  // Ensure the capture store is open and pruning runs while connected.
  getEventStore();
  startPruneTimer();

  haClient = new HaClient({ baseUrl: settings.baseUrl, token: settings.token });
  haClient.on("status", (status) => {
    setStatus(status);
    // On (re)connect, fill any gap from HA's recorder for events missed while
    // Mosaic was closed — HA is the always-on collector, we just sync.
    if (status === "connected") backfillGap().catch((e) => console.error("[HomeAssistant] Backfill failed:", e?.message || e));
  });
  haClient.on("state-changed", (evt) => {
    push("event", evt); // live UI
    const store = getEventStore();
    if (store) store.insert(evt); // persistent capture
  });
  haClient.on("auth-failed", (message) => push("error", { message }));
  haClient.on("error", (err) => console.error("[HomeAssistant] client error:", err?.message || err));
  haClient.connect();

  return { success: true };
}

// Backfill events from HA's recorder for the window between our newest stored
// event and now (capped to retention). Inserts only samples strictly newer than
// what we already have, so it can run safely on every reconnect.
async function backfillGap() {
  const store = getEventStore();
  if (!store || !haClient) return;

  const stats = store.getStats();
  const now = Date.now();
  const minMs = now - BACKFILL_MAX_DAYS * 24 * 60 * 60 * 1000;
  const startMs = stats.newestTs
    ? Math.max(stats.newestTs, minMs)
    : now - BACKFILL_EMPTY_DAYS * 24 * 60 * 60 * 1000;

  let series;
  try {
    series = await haClient.fetchHistory(new Date(startMs).toISOString());
  } catch (e) {
    console.error("[HomeAssistant] fetchHistory failed:", e.message);
    return;
  }
  if (!Array.isArray(series)) return;

  let inserted = 0;
  for (const arr of series) {
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const entityId = arr[0].entity_id;
    if (!entityId) continue;
    const domain = entityId.split(".")[0] || "";
    let prev = null;
    for (const s of arr) {
      const ts = Date.parse(s.last_changed || s.last_updated);
      // Skip the leading sample (state valid AT startMs) and anything we already
      // have; only insert transitions strictly newer than our newest event.
      if (!ts || ts <= startMs) {
        prev = s;
        continue;
      }
      store.insert({
        ts,
        entityId,
        domain,
        oldState: prev ? prev.state : null,
        newState: s.state,
        attrs: s.attributes || {},
        contextUser: null,
      });
      inserted++;
      prev = s;
    }
  }
  if (inserted > 0) {
    console.log(`[HomeAssistant] Backfilled ${inserted} events since ${new Date(startMs).toISOString()}`);
    push("backfilled", { count: inserted });
  }
}

function disconnect() {
  teardownClient();
  setStatus("disconnected");
  return { success: true };
}

function startPruneTimer() {
  if (pruneTimer) return;
  const runPrune = () => {
    const store = getEventStore();
    if (store) {
      const removed = store.prune(RETENTION_DAYS);
      if (removed > 0) console.log(`[HomeAssistant] Pruned ${removed} events older than ${RETENTION_DAYS}d`);
    }
  };
  runPrune(); // prune once at startup
  pruneTimer = setInterval(runPrune, PRUNE_INTERVAL_MS);
}

export function stopHomeAssistant() {
  teardownClient();
  connectionStatus = "disconnected";
  if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; }
  if (eventStore) { eventStore.close(); eventStore = null; }
}

// ── IPC registration ───────────────────────────────────────────────────────────
export function registerHomeAssistantIpc(ipcMain) {
  // Never return the token to the renderer — only whether one is stored.
  ipcMain.handle("home-assistant:get-settings", async () => {
    const s = readSettings();
    return {
      baseUrl: s?.baseUrl || "",
      hasToken: Boolean(s?.token),
      allowControl: Boolean(s?.allowControl),
      autoConnect: Boolean(s?.autoConnect),
      haAgentId: s?.haAgentId || "",
      ignoredEntities: s?.ignoredEntities || [],
      dashboardEntities: s?.dashboardEntities || [],
      entityLabels: s?.entityLabels || {},
    };
  });

  // Merge-write: a blank token keeps the saved one; omitted flags are preserved.
  ipcMain.handle("home-assistant:save-settings", async (_e, settings) => {
    try {
      writeSettings(settings || {});
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("home-assistant:set-auto-connect", async (_e, enabled) => {
    try {
      writeSettings({ autoConnect: Boolean(enabled) });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Toggle whether the AI agent is allowed to control the home / write
  // automations. Off by default — the home-mutating tools refuse while false.
  ipcMain.handle("home-assistant:set-control-allowed", async (_e, allowed) => {
    try {
      writeSettings({ allowControl: Boolean(allowed) });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Which configured AI agent supports Home Assistant tasks (suggestion design).
  ipcMain.handle("home-assistant:set-ha-agent", async (_e, agentId) => {
    try {
      writeSettings({ haAgentId: agentId || "" });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Entities excluded from the pattern-analysis algorithm.
  ipcMain.handle("home-assistant:set-ignored-entities", async (_e, entities) => {
    try {
      writeSettings({ ignoredEntities: Array.isArray(entities) ? entities : [] });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Entities curated for the dashboard (empty = auto-select via heuristics).
  ipcMain.handle("home-assistant:set-dashboard-entities", async (_e, entities) => {
    try {
      writeSettings({ dashboardEntities: Array.isArray(entities) ? entities : [] });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Custom display labels per entity (entity_id -> label).
  ipcMain.handle("home-assistant:set-entity-labels", async (_e, labels) => {
    try {
      writeSettings({ entityLabels: labels && typeof labels === "object" ? labels : {} });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("home-assistant:connect", async () => {
    try {
      return await connect();
    } catch (e) {
      setStatus("disconnected");
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("home-assistant:disconnect", async () => disconnect());

  ipcMain.handle("home-assistant:status", async () => ({ status: connectionStatus }));

  ipcMain.handle("home-assistant:get-states", async () => {
    if (!haClient || !haClient.isConnected()) {
      // Fall back to a one-shot REST read if settings exist but WS isn't up.
      const s = readSettings();
      if (!s?.baseUrl || !s?.token) return { success: false, error: "Not connected" };
      try {
        const c = new HaClient({ baseUrl: s.baseUrl, token: s.token });
        const states = await c.fetchStates();
        c.destroy();
        return { success: true, data: states };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    try {
      const states = await haClient.fetchStates();
      return { success: true, data: states };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Captured-history queries (read from SQLite — work even when disconnected).
  ipcMain.handle("home-assistant:get-history", async (_e, opts) => {
    try {
      const store = getEventStore();
      if (!store) return { success: false, error: "Event store unavailable" };
      return { success: true, data: store.getHistory(opts || {}) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("home-assistant:get-event-stats", async () => {
    try {
      const store = getEventStore();
      if (!store) return { success: false, error: "Event store unavailable" };
      return { success: true, data: store.getStats() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Per-entity captured event counts (for the History entity manager).
  ipcMain.handle("home-assistant:get-entity-counts", async () => {
    try {
      const store = getEventStore();
      if (!store) return { success: false, error: "Event store unavailable" };
      return { success: true, data: store.getEntityCounts() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Delete all captured events for one entity.
  ipcMain.handle("home-assistant:delete-entity-events", async (_e, entityId) => {
    try {
      const store = getEventStore();
      if (!store) return { success: false, error: "Event store unavailable" };
      return { success: true, removed: store.deleteEntity(entityId) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Mine captured events for candidate routines (PatternEngine).
  ipcMain.handle("home-assistant:get-suggestions", async (_e, opts) => {
    try {
      return { success: true, data: haGetSuggestionsData(opts) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Create an automation from the UI (gated by allowControl).
  ipcMain.handle("home-assistant:create-automation", async (_e, payload) => {
    try {
      if (!haIsControlAllowed()) {
        return {
          success: false,
          error: "Agent control is disabled. Enable it on the Connect page to create automations.",
        };
      }
      const id = await haCreateAutomationData(payload?.id || null, payload?.config || payload);
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Auto-connect on startup if the user enabled it and a server is configured.
  const startup = readSettings();
  if (startup?.autoConnect && startup.baseUrl && startup.token) {
    connect().catch((e) => console.error("[HomeAssistant] Auto-connect failed:", e?.message || e));
  }
}

// =============================================================================
// Tool-module helpers
//
// These let the AI tool module (electron/integrations/tools/modules/
// home-assistant.ts) use the SAME connection/storage as the plugin UI, instead
// of opening its own. Read helpers work whether or not the live WebSocket is up
// (they fall back to one-shot REST); write helpers are gated by allowControl.
// =============================================================================

// Returns a REST-capable client: the live one if connected, otherwise a
// short-lived client built from saved settings. Caller must destroy temp ones.
function getRestClient() {
  if (haClient && haClient.isConnected()) return { client: haClient, temp: false };
  const s = readSettings();
  if (!s?.baseUrl || !s?.token) return null;
  return { client: new HaClient({ baseUrl: s.baseUrl, token: s.token }), temp: true };
}

export function haGetConnectionInfo() {
  const s = readSettings();
  return {
    configured: Boolean(s?.baseUrl && s?.token),
    connected: Boolean(haClient && haClient.isConnected()),
    baseUrl: s?.baseUrl || "",
    allowControl: Boolean(s?.allowControl),
  };
}

export function haIsControlAllowed() {
  const s = readSettings();
  return Boolean(s?.allowControl);
}

export async function haGetStatesData() {
  const r = getRestClient();
  if (!r) throw new Error("Home Assistant is not configured");
  try {
    return await r.client.fetchStates();
  } finally {
    if (r.temp) r.client.destroy();
  }
}

export function haGetHistoryData(opts) {
  const store = getEventStore();
  if (!store) throw new Error("Event store unavailable");
  return store.getHistory(opts || {});
}

export function haGetEventStatsData() {
  const store = getEventStore();
  if (!store) throw new Error("Event store unavailable");
  return store.getStats();
}

export function haGetSuggestionsData(opts) {
  const store = getEventStore();
  if (!store) throw new Error("Event store unavailable");
  const since = Date.now() - SUGGESTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let events = store.getAllSince(since);
  // Exclude entities the user marked as ignored for analysis.
  const ignored = readSettings()?.ignoredEntities || [];
  if (ignored.length) {
    const set = new Set(ignored);
    events = events.filter((e) => !set.has(e.entityId));
  }
  return findSuggestions(events, opts || {});
}

export async function haCallServiceData(domain, service, data) {
  const r = getRestClient();
  if (!r) throw new Error("Home Assistant is not configured");
  try {
    return await r.client.callService(domain, service, data || {});
  } finally {
    if (r.temp) r.client.destroy();
  }
}

export async function haCreateAutomationData(id, config) {
  const r = getRestClient();
  if (!r) throw new Error("Home Assistant is not configured");
  try {
    return await r.client.createAutomation(id, config);
  } finally {
    if (r.temp) r.client.destroy();
  }
}
