// components/ChatHistorySidebar.tsx
import React from "react";
import {
  MessageSquare,
  Trash2,
  Loader2,
  X,
  Clock,
  ChevronRight,
} from "lucide-react";
import { ChatSession } from "../types/ai";

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (agentId: string, sessionId: string) => void;
  onNewChat: () => void;
  agentName?: string;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  sessions,
  activeSessionId,
  isLoading,
  isOpen,
  onClose,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  agentName,
}) => {
  // Group sessions by date
  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const groups: { [key: string]: ChatSession[] } = {};

    sessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;

      if (date.toDateString() === today.toDateString()) {
        groupKey = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = "Yesterday";
      } else if (date > new Date(today.setDate(today.getDate() - 7))) {
        groupKey = "This Week";
      } else if (date > new Date(today.setDate(today.getDate() - 30))) {
        groupKey = "This Month";
      } else {
        groupKey = "Older";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(session);
    });

    return groups;
  };

  const groupedSessions = groupSessionsByDate(sessions);
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPreviewText = (session: ChatSession) => {
    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage) return "No messages yet";
    const text = lastMessage.content;
    return text.length > 60 ? text.slice(0, 60) + "..." : text;
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-950 flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            Chat History
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {agentName && (
          <p className="text-xs text-gray-500">
            {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}{" "}
            with <span className="text-indigo-400">{agentName}</span>
          </p>
        )}
      </div>

      {/* New Chat Button */}
      <div className="shrink-0 p-3 border-b border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all hover:scale-[1.02] font-medium text-sm"
        >
          <MessageSquare size={16} />
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="animate-spin text-indigo-400 mb-3" size={24} />
            <p className="text-sm text-gray-500">Loading history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-3">
              <MessageSquare size={20} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-400 mb-1">No conversations yet</p>
            <p className="text-xs text-gray-600">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="p-2">
            {groupOrder.map((groupName) => {
              const groupSessions = groupedSessions[groupName];
              if (!groupSessions || groupSessions.length === 0) return null;

              return (
                <div key={groupName} className="mb-4">
                  {/* Group Label */}
                  <div className="px-3 py-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {groupName}
                    </span>
                  </div>

                  {/* Sessions in Group */}
                  <div className="space-y-1">
                    {groupSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`
                          group relative rounded-xl transition-all cursor-pointer
                          ${
                            activeSessionId === session.id
                              ? "bg-indigo-600/20 border border-indigo-500/30"
                              : "hover:bg-gray-900 border border-transparent"
                          }
                        `}
                      >
                        <button
                          onClick={() => onSelectSession(session.id)}
                          className="w-full text-left px-3 py-3"
                        >
                          {/* Title */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p
                              className={`text-sm font-medium truncate flex-1 ${
                                activeSessionId === session.id
                                  ? "text-white"
                                  : "text-gray-300"
                              }`}
                            >
                              {session.title || "Untitled Chat"}
                            </p>
                            {activeSessionId === session.id && (
                              <ChevronRight
                                size={14}
                                className="text-indigo-400 shrink-0 mt-0.5"
                              />
                            )}
                          </div>

                          {/* Preview */}
                          <p className="text-xs text-gray-500 truncate mb-1.5">
                            {getPreviewText(session)}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center gap-2 text-[10px] text-gray-600">
                            <span>{formatTime(session.updatedAt)}</span>
                            <span>•</span>
                            <span>
                              {session.messages.length} message
                              {session.messages.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.agentId, session.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="Delete chat"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {sessions.length > 0 && (
        <div className="shrink-0 p-3 border-t border-gray-800">
          <p className="text-[10px] text-gray-600 text-center">
            Chats are stored locally on your device
          </p>
        </div>
      )}
    </div>
  );
};
