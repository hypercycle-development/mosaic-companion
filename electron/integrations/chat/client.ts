import EventEmitter from "events";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "./types";

const BASE_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;

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
  private destroyed = false;
  private _connected = false;

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
    });

    this.ws.on("message", (data) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(data.toString()) as ServerMessage;
      } catch {
        return;
      }
      // Emit by type for targeted listeners, and also emit "message" for all
      this.emit(msg.type, msg);
      this.emit("server-message", msg);
    });

    this.ws.on("close", () => {
      this._connected = false;
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

  isConnected(): boolean {
    return this._connected && this.ws?.readyState === WebSocket.OPEN;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.removeAllListeners();
  }
}
