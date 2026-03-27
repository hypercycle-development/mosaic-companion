export interface ChatSettings {
  serverUrl: string;
  username: string;
}

// roomId -> agentId[]
export type RoomAgentAssignments = Record<string, string[]>;

export type RoomVisibility = "public" | "private" | "invite-only";

// Wire protocol types (mirrored from chat-server — renderer can't import server source)

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

export type ClientMessage =
  | { type: "auth"; username: string; isAgent?: boolean; metadata?: AgentMetadata; publicKey?: string }
  | { type: "create-room"; name: string; password?: string; visibility?: RoomVisibility }
  | { type: "join-room"; roomId: string; password?: string }
  | { type: "leave-room"; roomId: string }
  | { type: "delete-room"; roomId: string }
  | { type: "send-message"; roomId: string; text: string }
  | { type: "direct-message"; targetMemberId: string; text: string }
  | { type: "set-visibility"; roomId: string; visibility: RoomVisibility }
  | { type: "invite-member"; roomId: string; targetMemberId: string }
  | { type: "revoke-invite"; roomId: string; targetMemberId: string }
  | { type: "typing"; roomId: string; isTyping: boolean }
  | { type: "list-rooms" };

export type ServerMessage =
  | { type: "auth-ok"; memberId: string }
  | { type: "rooms"; rooms: Room[] }
  | { type: "room-created"; room: Room }
  | { type: "joined"; room: Room; history: StoredMessage[] }
  | { type: "left"; roomId: string }
  | { type: "room-deleted"; roomId: string }
  | { type: "message"; message: StoredMessage }
  | { type: "member-joined"; roomId: string; member: Member }
  | { type: "member-left"; roomId: string; memberId: string; username: string }
  | { type: "rooms-updated"; rooms: Room[] }
  | { type: "visibility-changed"; roomId: string; visibility: RoomVisibility }
  | { type: "member-invited"; roomId: string; memberId: string }
  | { type: "invite-revoked"; roomId: string; memberId: string }
  | { type: "typing"; roomId: string; memberId: string; username: string; isTyping: boolean }
  | { type: "error"; message: string };
