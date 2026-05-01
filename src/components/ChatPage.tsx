import React, { useState, useEffect, useRef } from "react";
import { Bot, Plus, Send, MessageSquare, Users, X, Lock, Globe } from "lucide-react";
import type { AIAgentConfig } from "../types/ai";
import type {
  ChatSettings,
  ConnectionStatus,
  Room,
  RoomVisibility,
  StoredMessage,
} from "../types/chat";

// =============================================================================
// ChatPage — three-panel multi-user chat room UI
// =============================================================================

export const ChatPage: React.FC = () => {
  // Core state
  const [settings, setSettings] = useState<ChatSettings>({
    serverUrl: "wss://agents-chat.hyperpg.site",
    username: "",
  });
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, StoredMessage[]>>({});
  const [assignedAgents, setAssignedAgents] = useState<Record<string, string[]>>({});
  const [allAgents, setAllAgents] = useState<AIAgentConfig[]>([]);

  // UI state
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomVisibility, setNewRoomVisibility] = useState<RoomVisibility>("public");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [messageInput, setMessageInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoJoinedRef = useRef(false);
  const settingsLoadedRef = useRef(false);
  const shouldAutoConnectRef = useRef(false);
  const autoConnectInFlightRef = useRef(false);
  const lastAutoConnectKeyRef = useRef<string | null>(null);

  // Load settings and agents on mount
  useEffect(() => {
    window.chatAPI?.getSettings().then((s) => {
      if (s) {
        setSettings(s);
        shouldAutoConnectRef.current = Boolean(s.username?.trim());
      }
      settingsLoadedRef.current = true;
    });
    window.electronAPI.aiAgents.get().then(setAllAgents);
    window.chatAPI?.status().then(({ status: s }) => {
      setStatus(s as ConnectionStatus);
      if (s === "connected") {
        autoJoinedRef.current = true;
        window.chatAPI?.listRooms();
      }
    });
  }, []);

  // Register push event listeners
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    cleanups.push(
      window.chatAPI?.onConnectionChanged(({ status: s }) => {
        setStatus(s as ConnectionStatus);
        if (s === "disconnected") {
          setJoinedRoomIds(new Set());
          setActiveRoomId(null);
          autoJoinedRef.current = false;
        } else if (s === "connected") {
          autoJoinedRef.current = false;
          window.chatAPI?.listRooms();
        }
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onRoomsUpdated((updatedRooms) => {
        setRooms(updatedRooms);
        // Auto-join or create the "General" room on first room list after connect
        if (!autoJoinedRef.current && updatedRooms.length >= 0) {
          autoJoinedRef.current = true;
          const general = updatedRooms.find(
            (r) => r.name.toLowerCase() === "general" && (r.visibility === "public" || !r.visibility),
          );
          if (general) {
            window.chatAPI?.joinRoom(general.id);
          } else {
            window.chatAPI?.createRoom("General");
          }
        }
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onJoined(({ room, history }) => {
        setJoinedRoomIds((prev) => new Set([...prev, room.id]));
        setMessages((prev) => ({ ...prev, [room.id]: history }));
        setRooms((prev) => {
          const existing = prev.find((r) => r.id === room.id);
          if (existing) return prev.map((r) => (r.id === room.id ? room : r));
          return [...prev, room];
        });
        setActiveRoomId(room.id);
        // Load assigned agents for this room
        window.chatAPI?.listAssignedAgents(room.id).then((agentIds) => {
          setAssignedAgents((prev) => ({ ...prev, [room.id]: agentIds }));
        });
      }) ?? (() => {}),
    );

    // Auto-join rooms we create (including the default "General")
    cleanups.push(
      window.chatAPI?.onRoomCreated((room) => {
        setRooms((prev) => {
          if (prev.find((r) => r.id === room.id)) return prev;
          return [...prev, room];
        });
        // Auto-join the room we just created
        window.chatAPI?.joinRoom(room.id);
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onLeft(({ roomId }) => {
        setJoinedRoomIds((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
        setActiveRoomId((prev) => (prev === roomId ? null : prev));
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onMessage((message) => {
        setMessages((prev) => ({
          ...prev,
          [message.roomId]: [...(prev[message.roomId] ?? []), message],
        }));
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onMemberJoined(({ roomId, member }) => {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== roomId) return r;
            if (r.members.find((m) => m.id === member.id)) return r;
            return { ...r, members: [...r.members, member] };
          }),
        );
      }) ?? (() => {}),
    );

    cleanups.push(
      window.chatAPI?.onMemberLeft(({ roomId, memberId }) => {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id !== roomId) return r;
            return { ...r, members: r.members.filter((m) => m.id !== memberId) };
          }),
        );
      }) ?? (() => {}),
    );

    return () => cleanups.forEach((c) => c());
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoomId]);

  // Auto-connect once when a cached username is available
  useEffect(() => {
    if (!settingsLoadedRef.current) return;
    if (!shouldAutoConnectRef.current) return;
    if (status !== "disconnected") return;

    const username = settings.username.trim();
    if (!username) return;

    const connectKey = `${settings.serverUrl}|${username}`;
    if (autoConnectInFlightRef.current) return;
    if (lastAutoConnectKeyRef.current === connectKey) return;

    autoConnectInFlightRef.current = true;
    lastAutoConnectKeyRef.current = connectKey;

    const run = async () => {
      try {
        await window.chatAPI?.saveSettings(settings);
        await window.chatAPI?.connect();
      } finally {
        autoConnectInFlightRef.current = false;
      }
    };

    run();
  }, [settings, status]);

  // Reset last attempt after successful connection so future reconnects can happen if needed
  useEffect(() => {
    if (status === "connected") {
      lastAutoConnectKeyRef.current = null;
    }
  }, [status]);

  // Handlers
  const handleConnect = async () => {
    await window.chatAPI?.saveSettings(settings);
    await window.chatAPI?.connect();
  };

  const handleJoin = async (roomId: string) => {
    await window.chatAPI?.joinRoom(roomId);
  };

  const handleLeave = async () => {
    if (!activeRoomId) return;
    await window.chatAPI?.leaveRoom(activeRoomId);
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    await window.chatAPI?.createRoom(
      newRoomName.trim(),
      newRoomVisibility !== "public" ? newRoomVisibility : undefined,
    );
    setNewRoomName("");
    setNewRoomVisibility("public");
    setShowNewRoom(false);
  };

  const handleSend = async () => {
    if (!activeRoomId || !messageInput.trim()) return;
    await window.chatAPI?.sendMessage(activeRoomId, messageInput.trim());
    setMessageInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleToggleAgent = async (agentId: string, agentName: string) => {
    if (!activeRoomId) return;
    const current = assignedAgents[activeRoomId] ?? [];
    if (current.includes(agentId)) {
      await window.chatAPI?.removeAgent(activeRoomId, agentId);
      setAssignedAgents((prev) => ({
        ...prev,
        [activeRoomId]: (prev[activeRoomId] ?? []).filter((id) => id !== agentId),
      }));
    } else {
      await window.chatAPI?.assignAgent(activeRoomId, agentId, agentName);
      setAssignedAgents((prev) => ({
        ...prev,
        [activeRoomId]: [...(prev[activeRoomId] ?? []), agentId],
      }));
    }
  };

  // Derived
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const activeMessages = activeRoomId ? (messages[activeRoomId] ?? []) : [];
  const activeAssigned = activeRoomId ? (assignedAgents[activeRoomId] ?? []) : [];

  const statusColor =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500 animate-pulse"
        : "bg-gray-600";

  const statusLabel =
    status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";

  return (
    <div className="flex h-full bg-gray-950 text-gray-200">
      {/* ====================================================================
          Left panel — Connection + Rooms
          ==================================================================== */}
      <div className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col">
        {/* Connection settings */}
        <div className="p-4 border-b border-gray-800 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Chat Rooms
          </h2>
          {/* input disabled temporarily */}
          {/* <input
            type="text"
            value={settings.serverUrl}
            onChange={(e) => setSettings((s) => ({ ...s, serverUrl: e.target.value }))}
            placeholder="ws://localhost:4242"
            disabled={status !== "disconnected"}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 disabled:opacity-50"
          /> */}
          <label htmlFor="chat-username" className="block text-xs text-gray-500 mt-2">
            Display name
          </label>
          <input
            id="chat-username"
            type="text"
            value={settings.username}
            onChange={(e) => setSettings((s) => ({ ...s, username: e.target.value }))}
            placeholder="Display name"
            disabled={status !== "disconnected"}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600 disabled:opacity-50"
          />
          <div className="flex items-center gap-2 pt-1">
            {/* <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
            <span className="text-xs text-gray-500 flex-1">{statusLabel}</span> */}
            {status === "disconnected" && (
              <button
                  onClick={handleConnect}
                  disabled={!settings.username.trim()}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Connect
                </button>
            )}
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {rooms.length === 0 && status === "connected" && (
            <p className="text-xs text-gray-600 px-2 pt-2">No rooms yet. Create one below.</p>
          )}
          {rooms.length === 0 && status !== "connected" && (
            <p className="text-xs text-gray-600 px-2 pt-2">Connect to see rooms.</p>
          )}
          {rooms.map((room) => {
            const joined = joinedRoomIds.has(room.id);
            const isActive = activeRoomId === room.id;
            return (
              <div
                key={room.id}
                onClick={() => {
                  if (joined) setActiveRoomId(room.id);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-900/30 border border-indigo-500/20"
                    : joined
                      ? "bg-gray-900 hover:bg-gray-800 cursor-pointer"
                      : "bg-gray-900/50 opacity-80"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-200 truncate flex items-center gap-1">
                    {room.visibility === "private" || room.visibility === "invite-only" ? (
                      <Lock size={10} className="text-amber-500 flex-shrink-0" />
                    ) : (
                      <span className="text-gray-500 mr-0.5">#</span>
                    )}
                    {room.name}
                  </p>
                  <p className="text-xs text-gray-600">{room.members.length} members</p>
                </div>
                {!joined && status === "connected" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(room.id);
                    }}
                    className="ml-2 px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors flex-shrink-0"
                  >
                    Join
                  </button>
                )}
                {joined && isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* New room */}
        <div className="p-3 border-t border-gray-800">
          {showNewRoom ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateRoom();
                  if (e.key === "Escape") setShowNewRoom(false);
                }}
                placeholder="Room name…"
                autoFocus
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-600"
              />
              <div className="flex gap-1">
                {(["public", "private", "invite-only"] as RoomVisibility[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNewRoomVisibility(v)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] transition-colors ${
                      newRoomVisibility === v
                        ? v === "public"
                          ? "bg-emerald-900/30 text-emerald-300 border border-emerald-500/20"
                          : "bg-amber-900/30 text-amber-300 border border-amber-500/20"
                        : "bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-700"
                    }`}
                  >
                    {v === "public" ? <Globe size={9} /> : <Lock size={9} />}
                    {v === "public" ? "Public" : v === "private" ? "Private" : "Invite"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg disabled:opacity-40 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewRoom(false);
                    setNewRoomName("");
                    setNewRoomVisibility("public");
                  }}
                  className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewRoom(true)}
              disabled={status !== "connected"}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} />
              New Room
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          Center panel — Active room + messages
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            {/* Room header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <div>
                <h1 className="text-base font-semibold text-white flex items-center gap-1.5">
                  {activeRoom.visibility === "private" || activeRoom.visibility === "invite-only" ? (
                    <Lock size={14} className="text-amber-500" />
                  ) : (
                    <span className="text-gray-500">#</span>
                  )}
                  {activeRoom.name}
                </h1>
                <p className="text-xs text-gray-500">
                  {activeRoom.members.length} members
                  {activeRoom.visibility && activeRoom.visibility !== "public" && ` \u00B7 ${activeRoom.visibility}`}
                </p>
              </div>
              <button
                onClick={handleLeave}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Leave
              </button>
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-40">
                  <MessageSquare size={32} className="mb-2 text-gray-600" />
                  <p className="text-sm text-gray-500">No messages yet. Say hello!</p>
                </div>
              )}
              {activeMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    {msg.isAgent ? (
                      <Bot size={13} className="text-indigo-400 flex-shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-gray-600 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm font-medium ${msg.isAgent ? "text-indigo-400" : "text-gray-300"}`}
                    >
                      {msg.isAgent ? `[AI] ${msg.username}` : msg.username}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div
                    className={`ml-5 text-sm leading-relaxed ${
                      msg.isAgent
                        ? "text-gray-300 bg-indigo-950/30 border border-indigo-900/40 rounded-lg px-3 py-2 mt-0.5"
                        : "text-gray-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0">
              <div className="flex gap-3 items-end">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40">
            <MessageSquare size={48} className="mb-4 text-gray-700" />
            <p className="text-gray-500">
              {status === "connected"
                ? "Join or select a room to start chatting"
                : "Connect to a chat server to get started"}
            </p>
          </div>
        )}
      </div>

      {/* ====================================================================
          Right panel — Members + Agent assignments
          ==================================================================== */}
      <div className="w-48 flex-shrink-0 border-l border-gray-800 flex flex-col p-4 gap-6">
        {/* Members */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Users size={12} className="text-gray-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Members
            </h2>
          </div>
          {activeRoom ? (
            <div className="space-y-1.5">
              {activeRoom.members.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  {member.isAgent ? (
                    <Bot size={11} className="text-indigo-400 flex-shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-green-500/70 flex-shrink-0" />
                  )}
                  <span className="text-xs text-gray-300 truncate">{member.username}</span>
                </div>
              ))}
              {activeRoom.members.length === 0 && (
                <p className="text-xs text-gray-600">No members yet</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600">No room active</p>
          )}
        </div>

        {/* Agents */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Bot size={12} className="text-gray-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Agents
            </h2>
          </div>
          {activeRoom ? (
            <div className="space-y-1">
              {allAgents.map((agent) => {
                const assigned = activeAssigned.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleToggleAgent(agent.id, agent.name)}
                    title={assigned ? "Remove from room" : "Add to room"}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left ${
                      assigned
                        ? "bg-indigo-900/40 text-indigo-300 border border-indigo-500/20"
                        : "bg-gray-900 text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    <Bot size={10} className="flex-shrink-0" />
                    <span className="truncate">{agent.name}</span>
                    {assigned && (
                      <span className="ml-auto text-[9px] text-indigo-500 font-medium flex-shrink-0">
                        ON
                      </span>
                    )}
                  </button>
                );
              })}
              {allAgents.length === 0 && (
                <p className="text-xs text-gray-600">No agents configured</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600">Join a room first</p>
          )}
        </div>
      </div>
    </div>
  );
};
