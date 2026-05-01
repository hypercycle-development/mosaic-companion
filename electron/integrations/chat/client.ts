import EventEmitter from "events";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "./types";

const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;
const PING_INTERVAL = 25_000;
const PONG_TIMEOUT = 10_000;

interface ChatClientOptions {
  url: string;
  username: string;
  isAgent?: boolean;
}

export class ChatClient extends EventEmitter {
  private url: string;
  private username: string;
  private isAgent: boolean;
  private ws: WebSocket | null = null;
  private reconnectDelay = BASE_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private _connected = false;
  private joinedRooms = new Set<string>();

  constructor(opts: ChatClientOptions) {
    super();
    this.url = opts.url;
    this.username = opts.username;
    this.isAgent = opts.isAgent ?? false;
  }

  connect(): void {
    if (this.destroyed) return;
    this._connect();
  }

  private _connect(): void {
    if (this.destroyed) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.emit("error", e);
      this._scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectDelay = BASE_RECONNECT_DELAY;
      this._connected = true;
      this.send({ type: "auth", username: this.username, isAgent: this.isAgent });
      this._startPing();
    });

    this.ws.on("message", (data) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(data.toString()) as ServerMessage;
      } catch {
        return;
      }

      // Rejoin tracked rooms after re-authentication
      if (msg.type === "auth-ok" && this.joinedRooms.size > 0) {
        for (const roomId of this.joinedRooms) {
          this.send({ type: "join-room", roomId });
        }
      }

      // Track joined/left rooms
      if (msg.type === "joined" && "room" in msg && msg.room) {
        this.joinedRooms.add(msg.room.id);
      } else if (msg.type === "left" && "roomId" in msg) {
        this.joinedRooms.delete(msg.roomId);
      } else if (msg.type === "room-deleted" && "roomId" in msg) {
        this.joinedRooms.delete(msg.roomId);
      }

      // Emit by type for targeted listeners, and also emit "message" for all
      this.emit(msg.type, msg);
      this.emit("server-message", msg);
    });

    this.ws.on("pong", () => {
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });

    this.ws.on("close", () => {
      this._connected = false;
      this._stopPing();
      this.ws = null;
      if (!this.destroyed) {
        this.emit("disconnected");
        this._scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.pongTimer = setTimeout(() => {
          // No pong received — connection is dead, force close to trigger reconnect
          this.ws?.terminate();
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /** Manually track a room as joined (for rooms joined via external send calls). */
  trackRoom(roomId: string): void {
    this.joinedRooms.add(roomId);
  }

  /** Stop tracking a room. */
  untrackRoom(roomId: string): void {
    this.joinedRooms.delete(roomId);
  }

  isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN;
  }

  destroy(): void {
    this.destroyed = true;
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.joinedRooms.clear();
    this.removeAllListeners();
  }
}
