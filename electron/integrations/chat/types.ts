export interface ChatSettings {
  serverUrl: string;
  username: string;
}

// roomId -> agentId[]
export type RoomAgentAssignments = Record<string, string[]>;

// Wire protocol types (mirrored from chat-server — renderer can't import server source)
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
  isPrivate?: boolean;
  createdBy?: string;
}

export interface RoomDetail extends Room {
  history: StoredMessage[];
}

export type ClientMessage =
  | { type: "auth"; username: string; isAgent?: boolean }
  | { type: "create-room"; name: string; isPrivate?: boolean }
  | { type: "join-room"; roomId: string }
  | { type: "leave-room"; roomId: string }
  | { type: "send-message"; roomId: string; text: string }
  | { type: "list-rooms" };

export type ServerMessage =
  | { type: "auth-ok"; memberId: string }
  | { type: "rooms"; rooms: Room[] }
  | { type: "room-created"; room: Room }
  | { type: "joined"; room: Room; history: StoredMessage[] }
  | { type: "left"; roomId: string }
  | { type: "message"; message: StoredMessage }
  | { type: "member-joined"; roomId: string; member: Member }
  | { type: "member-left"; roomId: string; memberId: string; username: string }
  | { type: "rooms-updated"; rooms: Room[] }
  | { type: "error"; message: string };
