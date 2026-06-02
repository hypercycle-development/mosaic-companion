import { app, ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { ChatClient } from "./client";
import {
  startAgentInRoom,
  stopAgentInRoom,
  stopAllAgents,
  listAgentsInRoom,
} from "./agent-runner";
import type { ChatSettings, RoomAgentAssignments, ServerMessage } from "./types";

// =============================================================================
// Persistence helpers
// =============================================================================

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "chat-settings.json");
}

function getAgentsPath(): string {
  return path.join(app.getPath("userData"), "chat-room-agents.json");
}

function readSettings(): ChatSettings {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as ChatSettings;
      if (!parsed.username?.trim()) parsed.username = "Mauricio P";
      return parsed;
    }
  } catch {}
  return { serverUrl: "ws://localhost:4242", username: "Mauricio P" };
}

function writeSettings(s: ChatSettings): void {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), "utf8");
}

function readAssignments(): RoomAgentAssignments {
  try {
    const p = getAgentsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as RoomAgentAssignments;
    }
  } catch {}
  return {};
}

function writeAssignments(a: RoomAgentAssignments): void {
  fs.writeFileSync(getAgentsPath(), JSON.stringify(a, null, 2), "utf8");
}

// =============================================================================
// State
// =============================================================================

let mainWindow: BrowserWindow | null = null;
let chatClient: ChatClient | null = null;
let connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

function push(channel: string, data?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(`chat:${channel}`, data);
  }
}

function setupClientListeners(client: ChatClient): void {
  client.on("auth-ok", () => {
    connectionStatus = "connected";
    push("connection-changed", { status: "connected" });
  });

  client.on("disconnected", () => {
    if (connectionStatus !== "disconnected") {
      connectionStatus = "connecting";
      push("connection-changed", { status: "connecting" });
    }
  });

  client.on("server-message", (msg: ServerMessage) => {
    switch (msg.type) {
      case "rooms":
        push("rooms-updated", msg.rooms);
        break;
      case "rooms-updated":
        push("rooms-updated", msg.rooms);
        break;
      case "room-created":
        push("room-created", msg.room);
        break;
      case "joined":
        push("joined", { room: msg.room, history: msg.history });
        break;
      case "left":
        push("left", { roomId: msg.roomId });
        break;
      case "message":
        push("message", msg.message);
        break;
      case "member-joined":
        push("member-joined", { roomId: msg.roomId, member: msg.member });
        break;
      case "member-left":
        push("member-left", {
          roomId: msg.roomId,
          memberId: msg.memberId,
          username: msg.username,
        });
        break;
      case "error":
        push("error", { message: msg.message });
        break;
    }
  });

  client.on("error", (err: Error) => {
    push("error", { message: err?.message ?? "Unknown error" });
  });
}

// =============================================================================
// Public API
// =============================================================================

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export function initChat(): void {
  // Settings
  ipcMain.handle("chat:get-settings", async () => readSettings());

  ipcMain.handle(
    "chat:save-settings",
    async (_e: IpcMainInvokeEvent, s: ChatSettings) => {
      writeSettings(s);
      return { success: true };
    },
  );

  // Status
  ipcMain.handle("chat:status", async () => ({ status: connectionStatus }));

  // Connection
  ipcMain.handle("chat:connect", async () => {
    const settings = readSettings();
    if (!settings.username) return { success: false, error: "Username required" };

    if (chatClient) {
      chatClient.destroy();
      chatClient = null;
    }

    connectionStatus = "connecting";
    push("connection-changed", { status: "connecting" });

    chatClient = new ChatClient({
      url: settings.serverUrl,
      username: settings.username,
    });
    setupClientListeners(chatClient);
    chatClient.connect();
    return { success: true };
  });

  ipcMain.handle("chat:disconnect", async () => {
    if (chatClient) {
      chatClient.destroy();
      chatClient = null;
    }
    connectionStatus = "disconnected";
    push("connection-changed", { status: "disconnected" });
    return { success: true };
  });

  // Rooms
  ipcMain.handle("chat:list-rooms", async () => {
    if (!chatClient?.isConnected()) return { success: false, error: "Not connected" };
    chatClient.send({ type: "list-rooms" });
    return { success: true };
  });

  ipcMain.handle("chat:create-room", async (_e: IpcMainInvokeEvent, name: string, visibility?: string) => {
    if (!chatClient?.isConnected()) return { success: false, error: "Not connected" };
    chatClient.send({ type: "create-room", name, visibility: visibility as any });
    return { success: true };
  });

  ipcMain.handle("chat:join-room", async (_e: IpcMainInvokeEvent, roomId: string) => {
    if (!chatClient?.isConnected()) return { success: false, error: "Not connected" };
    chatClient.trackRoom(roomId);
    chatClient.send({ type: "join-room", roomId });
    return { success: true };
  });

  ipcMain.handle("chat:leave-room", async (_e: IpcMainInvokeEvent, roomId: string) => {
    if (!chatClient?.isConnected()) return { success: false, error: "Not connected" };
    chatClient.untrackRoom(roomId);
    chatClient.send({ type: "leave-room", roomId });
    return { success: true };
  });

  ipcMain.handle(
    "chat:send-message",
    async (_e: IpcMainInvokeEvent, roomId: string, text: string) => {
      if (!chatClient?.isConnected()) return { success: false, error: "Not connected" };
      chatClient.send({ type: "send-message", roomId, text });
      return { success: true };
    },
  );

  // Agent assignments
  ipcMain.handle(
    "chat:assign-agent",
    async (_e: IpcMainInvokeEvent, roomId: string, agentId: string, agentName: string, trainingContext?: any) => {
      const settings = readSettings();
      const assignments = readAssignments();
      if (!assignments[roomId]) assignments[roomId] = [];
      if (!assignments[roomId].includes(agentId)) {
        assignments[roomId].push(agentId);
      }
      writeAssignments(assignments);
      if (settings.serverUrl) {
        startAgentInRoom(settings.serverUrl, roomId, agentId, agentName, trainingContext);
      }
      return { success: true };
    },
  );

  ipcMain.handle(
    "chat:remove-agent",
    async (_e: IpcMainInvokeEvent, roomId: string, agentId: string) => {
      const assignments = readAssignments();
      if (assignments[roomId]) {
        assignments[roomId] = assignments[roomId].filter((id) => id !== agentId);
        if (assignments[roomId].length === 0) delete assignments[roomId];
      }
      writeAssignments(assignments);
      stopAgentInRoom(roomId, agentId);
      return { success: true };
    },
  );

  ipcMain.handle(
    "chat:list-assigned-agents",
    async (_e: IpcMainInvokeEvent, roomId: string) => {
      return listAgentsInRoom(roomId);
    },
  );
}

export function stopChat(): void {
  if (chatClient) {
    chatClient.destroy();
    chatClient = null;
  }
  stopAllAgents();
  connectionStatus = "disconnected";
}
