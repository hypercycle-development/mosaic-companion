// Renderer-side chat types (mirrored from chat-server and electron integration)

export interface ChatSettings {
  serverUrl: string;
  username: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type RoomVisibility = "public" | "private" | "invite-only";

export interface AgentMetadata {
  model?: string;
  capabilities?: string[];
  avatar?: string;
  description?: string;
}

export interface Member {
  id: string;
  username: string;
  isAgent: boolean;
  metadata?: AgentMetadata | null;
  publicKey?: string | null;
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
  creatorId?: string;
  members: Member[];
  isProtected?: boolean;
  isDm?: boolean;
  visibility?: RoomVisibility;
  allowedMemberIds?: string[];
}

export interface RoomDetail extends Room {
  history: StoredMessage[];
}
