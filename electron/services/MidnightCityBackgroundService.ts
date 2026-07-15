/**
 * MidnightCityBackgroundService.ts
 *
 * Lives in the Electron MAIN PROCESS. Manages the agent WebSocket/session
 * connection independently of any renderer tab. When the user "locks" an
 * agent, the session persists even if the Stargate panel is unmounted or
 * the user switches to AI Chat, Settings, etc.
 *
 * Architecture:
 *   Renderer ──IPC──► Main Process (this service) ──HTTP/WebSocket──► midnight.city
 *
 * The renderer only holds UI state. The actual lease token, heartbeat, and
 * auto-reconnect logic live here.
 */

import { BrowserWindow } from "electron";

interface SessionState {
  connected: boolean;
  agentId: string;
  leaseToken: string | null;
  sessionId: string | null;
  lastHeartbeat: number;
  lockActive: boolean;
  autoMine: boolean;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  detail?: string;
}

const MIDNIGHT_BASE = "https://midnight.city/observer";
const HEARTBEAT_INTERVAL_MS = 15000;
const RECONNECT_BACKOFF_MS = [2000, 5000, 10000, 30000];

class MidnightCityBackgroundService {
  private state: SessionState = {
    connected: false,
    agentId: "",
    leaseToken: null,
    sessionId: null,
    lastHeartbeat: 0,
    lockActive: false,
    autoMine: false,
  };

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private logs: LogEntry[] = [];
  private apiToken = "midnight_Wf8zoml4Wkf9RvvQf-mqNbK2LklC8h2WtmdIfOrE";

  // ── Logging ────────────────────────────────────────────────────────────────
  private addLog(level: LogEntry["level"], message: string, detail?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      detail,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    console.log(`[MidnightCityBG] ${level}: ${message}${detail ? ` — ${detail}` : ""}`);
  }

  // ── Public getters ───────────────────────────────────────────────────────
  getStatus(): SessionState {
    return { ...this.state };
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  isLocked(): boolean {
    return this.state.lockActive;
  }

  // ── Connect ───────────────────────────────────────────────────────────────
  async connect(agentId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    this.state.agentId = agentId;
    try {
      this.addLog("info", "Connecting...", agentId);
      const res = await fetch(`${MIDNIGHT_BASE}/api/local-control/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          clientInstanceId: `mosaic-bg-${Date.now()}`,
          modelId: "default",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sessionId && data.token) {
        this.state.connected = true;
        this.state.sessionId = data.sessionId;
        this.state.leaseToken = data.token;
        this.state.lastHeartbeat = Date.now();
        this.reconnectAttempt = 0;
        this.addLog("success", "Connected", `Session ${data.sessionId}`);
        this.startHeartbeat();
        return { success: true, token: data.token };
      }
      throw new Error(data.error || `HTTP ${res.status}`);
    } catch (err: any) {
      this.addLog("error", "Connect failed", err.message);
      return { success: false, error: err.message };
    }
  }

  // ── Disconnect (only if NOT locked) ──────────────────────────────────────
  async disconnect(force = false): Promise<{ success: boolean; error?: string }> {
    if (this.state.lockActive && !force) {
      this.addLog("info", "Disconnect blocked — agent is locked");
      return { success: false, error: "Agent is locked. Unlock first." };
    }

    this.stopHeartbeat();
    this.stopReconnect();

    if (this.state.leaseToken) {
      try {
        await fetch(`${MIDNIGHT_BASE}/api/local-control/session/release`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: this.state.leaseToken }),
        });
      } catch (e) {
        // Best-effort release
      }
    }

    this.state.connected = false;
    this.state.leaseToken = null;
    this.state.sessionId = null;
    this.addLog("success", "Disconnected");
    return { success: true };
  }

  // ── Lock / Unlock ────────────────────────────────────────────────────────
  setLock(locked: boolean) {
    this.state.lockActive = locked;
    this.addLog("info", locked ? "🔒 Agent LOCKED — will survive tab switches" : "🔓 Agent UNLOCKED — normal disconnect on unmount");
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.doHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async doHeartbeat() {
    if (!this.state.connected || !this.state.leaseToken) return;
    try {
      // Lightweight ping to keep session alive
      const res = await fetch(`${MIDNIGHT_BASE}/api/skill/agents/${encodeURIComponent(this.state.agentId)}/context`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      if (res.ok) {
        this.state.lastHeartbeat = Date.now();
        return;
      }
      // Session expired — trigger reconnect
      throw new Error(`Heartbeat failed: ${res.status}`);
    } catch (err: any) {
      this.addLog("warn", "Heartbeat failed", err.message);
      this.state.connected = false;
      this.scheduleReconnect();
    }
  }

  // ── Auto-reconnect ───────────────────────────────────────────────────────
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.state.lockActive) return;
    const delay = RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.addLog("info", `Reconnecting in ${delay}ms...`, `Attempt ${this.reconnectAttempt + 1}`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      const result = await this.connect(this.state.agentId);
      if (!result.success) {
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ── Generic API call (proxied from renderer) ───────────────────────────
  async apiCall(params: { endpoint: string; method: "GET" | "POST"; body?: any }): Promise<any> {
    if (!this.state.connected) {
      return { error: "Not connected", data: null };
    }
    const url = `${MIDNIGHT_BASE}${params.endpoint}`;
    // All authenticated requests AFTER connect use leaseToken (same as mcity-control.mjs)
    const tokenForAuth = this.state.leaseToken || this.apiToken;
    this.addLog("info", `API call ${params.method} ${params.endpoint}`, `auth=${tokenForAuth === this.state.leaseToken ? "lease" : "api"}`);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokenForAuth}`,
      "Content-Type": "application/json",
    };
    // Some endpoints additionally verify X-Lease-Token
    if (this.state.leaseToken) {
      headers["X-Lease-Token"] = this.state.leaseToken;
    }
    try {
      const res = await fetch(url, {
        method: params.method,
        headers,
        body: params.body ? JSON.stringify(params.body) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) {
        return { error: `${res.status} ${res.statusText}${data?.error ? ` — ${data.error}` : ""}`, data: null };
      }
      return { error: null, data };
    } catch (err: any) {
      return { error: err.message || String(err), data: null };
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  destroy() {
    this.stopHeartbeat();
    this.stopReconnect();
    this.disconnect(true);
  }
}

export const midnightCityService = new MidnightCityBackgroundService();
