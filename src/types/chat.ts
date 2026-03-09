// Renderer-side chat types (mirrored from chat-server and electron integration)

export interface ChatSettings {
  serverUrl: string;
  username: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface Member {
  id: string;
  username: string;
  isAgent: boolean;
}

export interface StoredMessage {
  id: string;
  roomId: string;
  memberId: string;
  username: string;
  isAgent: boolean;
  text: string;
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  members: Member[];
}

export interface RoomDetail extends Room {
  history: StoredMessage[];
}
