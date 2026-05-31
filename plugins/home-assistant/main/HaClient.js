// HaClient — WebSocket + REST client for a local Home Assistant server.
//
// Connection model mirrors electron/integrations/chat/client.ts: a small
// EventEmitter that owns one WebSocket, authenticates, subscribes to the
// state_changed event firehose, pings to detect dead sockets, and reconnects
// with exponential backoff. REST helpers piggy-back on the same base URL/token.
import EventEmitter from "events";
import WebSocket from "ws";

const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;
const PING_INTERVAL = 25_000;
const PONG_TIMEOUT = 10_000;

// Normalize a user-entered base URL into { httpBase, wsUrl }.
// Accepts "http://homeassistant.local:8123", "https://ha.example.com",
// "homeassistant.local:8123" (defaults to http), with or without trailing slash.
function normalizeBaseUrl(input) {
  let raw = (input || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) raw = "http://" + raw;
  const u = new URL(raw);
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  return {
    httpBase: `${u.protocol}//${u.host}`,
    wsUrl: `${wsProto}//${u.host}/api/websocket`,
  };
}

export class HaClient extends EventEmitter {
  constructor({ baseUrl, token }) {
    super();
    const { httpBase, wsUrl } = normalizeBaseUrl(baseUrl);
    this.httpBase = httpBase;
    this.wsUrl = wsUrl;
    this.token = token;

    this.ws = null;
    this.reconnectDelay = BASE_RECONNECT_DELAY;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.pongTimer = null;
    this.destroyed = false;
    this.authed = false;
    this._msgId = 1; // HA requires monotonically increasing command ids
  }

  connect() {
    if (this.destroyed) return;
    this._connect();
  }

  _connect() {
    if (this.destroyed) return;
    this.authed = false;

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      this.emit("error", e);
      this._scheduleReconnect();
      return;
    }

    this.ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      this._handleMessage(msg);
    });

    this.ws.on("pong", () => {
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });

    this.ws.on("close", () => {
      this.authed = false;
      this._stopPing();
      this.ws = null;
      if (!this.destroyed) {
        this.emit("status", "connecting");
        this._scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      // Surface but let 'close' drive reconnection.
      this.emit("error", err);
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case "auth_required":
        this._send({ type: "auth", access_token: this.token });
        break;

      case "auth_ok":
        this.authed = true;
        this.reconnectDelay = BASE_RECONNECT_DELAY;
        this._startPing();
        this.emit("status", "connected");
        // Subscribe to the live state-change firehose.
        this._send({ id: this._nextId(), type: "subscribe_events", event_type: "state_changed" });
        break;

      case "auth_invalid":
        // Bad token — do not hammer reconnect; report and stop.
        this.destroyed = true;
        this._stopPing();
        if (this.ws) { try { this.ws.close(); } catch { /* ignore */ } }
        this.emit("auth-failed", msg.message || "Invalid access token");
        this.emit("status", "disconnected");
        break;

      case "event":
        if (msg.event && msg.event.event_type === "state_changed") {
          this.emit("state-changed", this._normalizeStateChanged(msg.event));
        }
        break;

      default:
        // result/pong/etc. — ignored for Phase 1.
        break;
    }
  }

  _normalizeStateChanged(event) {
    const d = event.data || {};
    const oldS = d.old_state || null;
    const newS = d.new_state || null;
    return {
      ts: Date.parse(event.time_fired) || Date.now(),
      entityId: d.entity_id,
      domain: (d.entity_id || "").split(".")[0] || "",
      oldState: oldS ? oldS.state : null,
      newState: newS ? newS.state : null,
      attrs: newS ? newS.attributes || {} : {},
      contextUser: (event.context && event.context.user_id) || null,
    };
  }

  _nextId() {
    return this._msgId++;
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.pongTimer = setTimeout(() => {
          // No pong — force the socket closed to trigger reconnect.
          try { this.ws.terminate(); } catch { /* ignore */ }
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  _stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
  }

  _scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  isConnected() {
    return this.authed && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  destroy() {
    this.destroyed = true;
    this._stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { try { this.ws.close(); } catch { /* ignore */ } this.ws = null; }
    this.removeAllListeners();
  }

  // ── REST helpers ──────────────────────────────────────────────────────────

  async _rest(path, { method = "GET", body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.httpBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Validate token + reachability without opening a socket. Returns HA config.
  async fetchConfig() {
    return this._rest("/api/config");
  }

  // Current state of every entity.
  async fetchStates() {
    return this._rest("/api/states");
  }

  // All available services, grouped by domain.
  async fetchServices() {
    return this._rest("/api/services");
  }

  // Historical state changes from HA's recorder between two ISO timestamps.
  // Returns an array of per-entity series: [[{entity_id, state, last_changed,
  // attributes}, ...], ...]. Used to backfill events missed while Mosaic was
  // closed (HA's recorder is the always-on source of truth).
  async fetchHistory(startIso, endIso) {
    let path = `/api/history/period/${encodeURIComponent(startIso)}`;
    if (endIso) path += `?end_time=${encodeURIComponent(endIso)}`;
    return this._rest(path);
  }

  // Call a service, e.g. callService("light", "turn_on", { entity_id: "light.x" }).
  // Returns the array of states that changed.
  async callService(domain, service, data = {}) {
    return this._rest(`/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
      method: "POST",
      body: data,
    });
  }

  // Create or update an automation via the config integration, then reload so
  // it takes effect immediately. `config` is a standard HA automation object
  // ({ alias, trigger, condition, action, mode }). Returns the new id.
  async createAutomation(id, config) {
    const automationId = id || `mosaic_${Date.now()}`;
    await this._rest(`/api/config/automation/config/${encodeURIComponent(automationId)}`, {
      method: "POST",
      body: config,
    });
    await this.callService("automation", "reload", {});
    return automationId;
  }
}
