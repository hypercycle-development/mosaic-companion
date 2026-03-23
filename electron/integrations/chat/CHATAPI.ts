/**
 * Chat API — Renderer Bridge
 *
 * Exposes chat operations to the renderer process via Electron IPC.
 * Used in the preload script (contextBridge.exposeInMainWorld).
 */

import { ipcRenderer, IpcRendererEvent } from "electron";
import type { ChatSettings, Room, StoredMessage, Member } from "./types";

export const chatAPI = {
  // ===========================================================================
  // Settings
  // ===========================================================================

  getSettings: (): Promise<ChatSettings> =>
    ipcRenderer.invoke("chat:get-settings"),

  saveSettings: (s: ChatSettings): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:save-settings", s),

  // ===========================================================================
  // Connection
  // ===========================================================================

  connect: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:connect"),

  disconnect: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("chat:disconnect"),

  status: (): Promise<{ status: string }> =>
    ipcRenderer.invoke("chat:status"),

  // ===========================================================================
  // Rooms
  // ===========================================================================

  listRooms: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:list-rooms"),

  createRoom: (name: string, isPrivate?: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:create-room", name, isPrivate),

  joinRoom: (roomId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:join-room", roomId),

  leaveRoom: (roomId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:leave-room", roomId),

  sendMessage: (
    roomId: string,
    text: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("chat:send-message", roomId, text),

  // ===========================================================================
  // Agent assignments
  // ===========================================================================

  assignAgent: (
    roomId: string,
    agentId: string,
    agentName: string,
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("chat:assign-agent", roomId, agentId, agentName),

  removeAgent: (
    roomId: string,
    agentId: string,
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("chat:remove-agent", roomId, agentId),

  listAssignedAgents: (roomId: string): Promise<string[]> =>
    ipcRenderer.invoke("chat:list-assigned-agents", roomId),

  // ===========================================================================
  // Push events (server → renderer)
  // ===========================================================================

  onConnectionChanged: (cb: (data: { status: string }) => void) => {
    const listener = (_e: IpcRendererEvent, data: { status: string }) => cb(data);
    ipcRenderer.on("chat:connection-changed", listener);
    return () => ipcRenderer.removeListener("chat:connection-changed", listener);
  },

  onRoomsUpdated: (cb: (rooms: Room[]) => void) => {
    const listener = (_e: IpcRendererEvent, rooms: Room[]) => cb(rooms);
    ipcRenderer.on("chat:rooms-updated", listener);
    return () => ipcRenderer.removeListener("chat:rooms-updated", listener);
  },

  onRoomCreated: (cb: (room: Room) => void) => {
    const listener = (_e: IpcRendererEvent, room: Room) => cb(room);
    ipcRenderer.on("chat:room-created", listener);
    return () => ipcRenderer.removeListener("chat:room-created", listener);
  },

  onJoined: (cb: (data: { room: Room; history: StoredMessage[] }) => void) => {
    const listener = (
      _e: IpcRendererEvent,
      data: { room: Room; history: StoredMessage[] },
    ) => cb(data);
    ipcRenderer.on("chat:joined", listener);
    return () => ipcRenderer.removeListener("chat:joined", listener);
  },

  onLeft: (cb: (data: { roomId: string }) => void) => {
    const listener = (_e: IpcRendererEvent, data: { roomId: string }) => cb(data);
    ipcRenderer.on("chat:left", listener);
    return () => ipcRenderer.removeListener("chat:left", listener);
  },

  onMessage: (cb: (message: StoredMessage) => void) => {
    const listener = (_e: IpcRendererEvent, message: StoredMessage) => cb(message);
    ipcRenderer.on("chat:message", listener);
    return () => ipcRenderer.removeListener("chat:message", listener);
  },

  onMemberJoined: (cb: (data: { roomId: string; member: Member }) => void) => {
    const listener = (
      _e: IpcRendererEvent,
      data: { roomId: string; member: Member },
    ) => cb(data);
    ipcRenderer.on("chat:member-joined", listener);
    return () => ipcRenderer.removeListener("chat:member-joined", listener);
  },

  onMemberLeft: (
    cb: (data: { roomId: string; memberId: string; username: string }) => void,
  ) => {
    const listener = (
      _e: IpcRendererEvent,
      data: { roomId: string; memberId: string; username: string },
    ) => cb(data);
    ipcRenderer.on("chat:member-left", listener);
    return () => ipcRenderer.removeListener("chat:member-left", listener);
  },

  onError: (cb: (data: { message: string }) => void) => {
    const listener = (_e: IpcRendererEvent, data: { message: string }) => cb(data);
    ipcRenderer.on("chat:error", listener);
    return () => ipcRenderer.removeListener("chat:error", listener);
  },
};
