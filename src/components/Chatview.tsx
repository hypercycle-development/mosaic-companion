// components/ChatView.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  User,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  MessageSquare,
  Zap,
  History,
  AlertCircle,
} from "lucide-react";
import {
  AIAgentConfig,
  ChatMessage,
  ChatSession,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";
import { INTERNAL_SETTINGS_URL } from "../types/types";
import { useScreenpipe } from "../hooks/useScreenpipe";
import { ChatHistorySidebar } from "./ChatHistorySidebar";

interface ChatViewProps {
  onNavigate?: (url: string) => void;
  onCreateNewChatTab?: () => void;
  tabId?: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  onNavigate,
  onCreateNewChatTab,
  tabId,
}) => {
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [screenpipeContext, setScreenpipeContext] = useState<string>("");

  // Screenpipe hook
  const { enabled: screenpipeEnabled, getContextSummary } = useScreenpipe();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentSelectorRef = useRef<HTMLDivElement>(null);

  const activeAgents = agents.filter((a) => a.isActive);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Load agents on mount
  useEffect(() => {
    const getAgents = async () => {
      const result = await window.electronAPI.aiAgents.get();
      if (result) {
        setAgents(result);
      }
    };
    getAgents();
  }, []);

  // Auto-select first active agent
  useEffect(() => {
    if (!selectedAgentId && activeAgents.length > 0) {
      setSelectedAgentId(activeAgents[0].id);
    }
  }, [activeAgents, selectedAgentId]);

  // Load chat history when agent changes
  useEffect(() => {
    if (selectedAgentId) {
      loadAgentHistory(selectedAgentId);
    }
  }, [selectedAgentId]);

  // Load chat history for an agent
  const loadAgentHistory = async (agentId: string) => {
    setIsLoadingHistory(true);
    try {
      const history = await window.electronAPI.aiAgentsHistory.getAll(agentId);
      if (history && Array.isArray(history)) {
        setSessions(history);
        if (history.length > 0) {
          setActiveSessionId(history[0].id);
        } else {
          setActiveSessionId(null);
        }
      } else {
        setSessions([]);
        setActiveSessionId(null);
      }
    } catch (error) {
      console.error("Failed to load agent history:", error);
      setSessions([]);
    }
    setIsLoadingHistory(false);
  };

  // Save session to backend
  const saveSession = useCallback(async (session: ChatSession) => {
    try {
      await window.electronAPI.aiAgentsHistory.save(session);
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [input]);

  // Track if we've processed the pending message to avoid duplicate sends
  const pendingMessageProcessedRef = useRef<string | null>(null);

  // Reset processed flag when tabId changes
  useEffect(() => {
    pendingMessageProcessedRef.current = null;
  }, [tabId]);

  // Close agent selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        agentSelectorRef.current &&
        !agentSelectorRef.current.contains(e.target as Node)
      ) {
        setShowAgentSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create new session (for New Chat button)
  const createNewSession = useCallback(() => {
    if (!selectedAgentId) return;

    const session: ChatSession = {
      id: `session-${Date.now()}`,
      agentId: selectedAgentId,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session;
  }, [selectedAgentId]);

  // Select a session from sidebar
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  // Delete a session
  const handleDeleteSession = useCallback(
    async (agentId: string, sessionId: string) => {
      try {
        await window.electronAPI.aiAgentsHistory.delete(agentId, sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // If we deleted the active session, select the next one
        if (activeSessionId === sessionId) {
          const remainingSessions = sessions.filter((s) => s.id !== sessionId);
          setActiveSessionId(
            remainingSessions.length > 0 ? remainingSessions[0].id : null
          );
        }
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [activeSessionId, sessions]
  );

    // Check for pending message from command palette
    useEffect(() => {
        // Wait for agents to be loaded and selected
        if (
            !tabId ||
            !selectedAgent ||
            isGenerating ||
            activeAgents.length === 0
        )
            return;

        // Check if we've already processed this pending message
        const pendingMessageKey = `chat_pending_message_${tabId}`;
        if (pendingMessageProcessedRef.current === pendingMessageKey) return;

        const pendingMessage = localStorage.getItem(pendingMessageKey);

        if (pendingMessage && pendingMessage.trim()) {
            // Mark as processed immediately to prevent duplicate sends
            pendingMessageProcessedRef.current = pendingMessageKey;
            localStorage.removeItem(pendingMessageKey);

            // Auto-send the message after a short delay to ensure component is ready
            const timeoutId = setTimeout(() => {
                // Double-check agent is still available
                if (!selectedAgent || isGenerating) {
                    pendingMessageProcessedRef.current = null;
                    return;
                }

                // Get or create session
                let session = activeSession;
                if (!session || session.agentId !== selectedAgent.id) {
                    session = createNewSession()!;
                }

                // Add user message
                const messageContent = pendingMessage.trim();
                const userMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: 'user',
                    content: messageContent,
                    timestamp: Date.now(),
                    agentId: selectedAgent.id
                };

                const updatedMessages = [...session.messages, userMessage];

                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === session!.id
                            ? {
                                  ...s,
                                  messages: updatedMessages,
                                  updatedAt: Date.now(),
                                  title:
                                      s.messages.length === 0
                                          ? messageContent.slice(0, 40)
                                          : s.title
                              }
                            : s
                    )
                );

                // Start generating response
                setIsGenerating(true);
                setStreamingContent('');

                // Send message to AI
                AIService.sendMessage(
                    selectedAgent,
                    updatedMessages.filter((m) => m.role !== 'system'),
                    {
                        onToken: (token) => {
                            setStreamingContent((prev) => prev + token);
                        },
                        onComplete: async (response) => {
                            const assistantMessage: ChatMessage = {
                                id: `msg-${Date.now()}`,
                                role: 'assistant',
                                content: response,
                                timestamp: Date.now(),
                                agentId: selectedAgent.id
                            };

                            const finalSession: ChatSession = {
                              ...session!,
                              messages: [...updatedMessages, assistantMessage],
                              updatedAt: Date.now(),
                            };
                            setSessions((prev) =>
                              prev.map((s) =>
                                s.id === finalSession.id ? finalSession : s
                              )
                            );
                            await saveSession(finalSession);
                            setStreamingContent("");
                            setIsGenerating(false);
                            pendingMessageProcessedRef.current = null;
                        },
                        onError: async (error) => {
                            console.error('Stream error:', error);
                            const errorMessage: ChatMessage = {
                                id: `msg-${Date.now()}`,
                                role: 'assistant',
                                content: `⚠️ Error: ${error.message}`,
                                timestamp: Date.now(),
                                agentId: selectedAgent.id
                            };
                            const errorSession: ChatSession = {
                              ...session!,
                              messages: [...updatedMessages, errorMessage],
                              updatedAt: Date.now(),
                            };
                            setSessions((prev) =>
                              prev.map((s) =>
                                s.id === errorSession.id ? errorSession : s
                              )
                            );
                            await saveSession(errorSession);
                            setStreamingContent("");
                            setIsGenerating(false);
                            pendingMessageProcessedRef.current = null;
                        }
                    }
                ).catch((error) => {
                    console.error('Error sending message:', error);
                    setIsGenerating(false);
                    pendingMessageProcessedRef.current = null;
                });
            }, 800);

            return () => {
                clearTimeout(timeoutId);
                // Reset processed flag if component unmounts before timeout
                if (pendingMessageProcessedRef.current === pendingMessageKey) {
                    pendingMessageProcessedRef.current = null;
                }
            };
        }
  }, [
    tabId,
    selectedAgent,
    activeSession,
    createNewSession,
    isGenerating,
    activeAgents.length,
    saveSession,
  ]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || isGenerating) return;

    const messageContent = input.trim();
    setInput("");

    // Get Screenpipe context if enabled (últimas 5 capturas)
    let contextPrefix = "";
    console.log({screenpipeEnabled});
    if (screenpipeEnabled) {
      
      const summary = await getContextSummary(3, 400, { excludeApp: "Electron" });
      console.log({summary});
      
      if (summary) {
        contextPrefix = `${summary}\n\n`;
        setScreenpipeContext(summary);
        console.log("📸 Screenpipe context added:", summary);
      }
    }

    // Get or create session
    let session = activeSession;
    let isNewSession = false;

    if (!session || session.agentId !== selectedAgent.id) {
      session = {
        id: `session-${Date.now()}`,
        agentId: selectedAgent.id,
        title: "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      isNewSession = true;
    }

    // Add user message (with context prefix if available)
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: contextPrefix + messageContent,
      timestamp: Date.now(),
      agentId: selectedAgent.id,
    };

    const updatedMessages = [...session.messages, userMessage];
    const updatedSession: ChatSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title:
        session.messages.length === 0
          ? messageContent.slice(0, 40)
          : session.title,
    };

    // Update state
    if (isNewSession) {
      setSessions((prev) => [updatedSession, ...prev]);
      setActiveSessionId(updatedSession.id);
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === session!.id ? updatedSession : s))
      );
    }

    // Save to disk
    await saveSession(updatedSession);

    // Start generating response
    setIsGenerating(true);
    setStreamingContent("");

    try {
      let fullResponse = "";
      await window.electronAPI.logInput(messageContent);

      await AIService.sendMessage(
        selectedAgent,
        updatedMessages.filter((m) => m.role !== "system"),
        {
          onToken: (token) => {
            fullResponse += token;
            setStreamingContent(fullResponse);
          },
          onComplete: async (response) => {
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: response,
              timestamp: Date.now(),
              agentId: selectedAgent.id,
            };

            const finalSession: ChatSession = {
              ...updatedSession,
              messages: [...updatedMessages, assistantMessage],
              updatedAt: Date.now(),
            };

            setSessions((prev) =>
              prev.map((s) => (s.id === finalSession.id ? finalSession : s))
            );

            await saveSession(finalSession);

            setStreamingContent("");
            setIsGenerating(false);
            window.electronAPI.logInput(response.trim());
          },
          onError: async (error) => {
            console.error("Stream error:", error);
            const errorMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: `⚠️ Error: ${error.message}`,
              timestamp: Date.now(),
              agentId: selectedAgent.id,
            };

            const errorSession: ChatSession = {
              ...updatedSession,
              messages: [...updatedMessages, errorMessage],
              updatedAt: Date.now(),
            };

            setSessions((prev) =>
              prev.map((s) => (s.id === errorSession.id ? errorSession : s))
            );
            await saveSession(errorSession);
            setStreamingContent("");
            setIsGenerating(false);
          },
        }
      );
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Error: ${(error as Error).message}`,
        timestamp: Date.now(),
        agentId: selectedAgent.id,
      };

      const errorSession: ChatSession = {
        ...updatedSession,
        messages: [...updatedMessages, errorMessage],
        updatedAt: Date.now(),
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === errorSession.id ? errorSession : s))
      );
      await saveSession(errorSession);
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateLastResponse = () => {
    if (!activeSession || activeSession.messages.length < 2) return;

    const messagesWithoutLast = activeSession.messages.slice(0, -1);
    const lastUserMessage = messagesWithoutLast[messagesWithoutLast.length - 1];

    if (lastUserMessage?.role === "user") {
      const updatedSession = {
        ...activeSession,
        messages: messagesWithoutLast,
        updatedAt: Date.now(),
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s))
      );
      saveSession(updatedSession);
      setInput(lastUserMessage.content);
    }
  };

  // Helper to parse message content and separate screenpipe context
  const parseMessageContent = (content: string) => {
    const contextMatch = content.match(/^\[Screenpipe Context\](.+?)\n\n(.+)$/s);
    if (contextMatch) {
      return {
        hasContext: true,
        context: `[Screenpipe Context]${contextMatch[1]}`,
        message: contextMatch[2],
      };
    }
    return {
      hasContext: false,
      context: "",
      message: content,
    };
  };

  // No active agents view
  if (activeAgents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gray-900/50 border border-gray-800 flex items-center justify-center mb-6">
          <Bot className="size-10 text-gray-600" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Active Agents</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Configure and activate at least one AI agent in settings to start
          chatting.
        </p>
        <button
          onClick={() => onNavigate?.(INTERNAL_SETTINGS_URL)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all hover:scale-[1.02] font-medium"
        >
          <Zap size={18} />
          Configure Agents
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-black">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {/* Agent Selector */}
            <div className="relative" ref={agentSelectorRef}>
              <button
                onClick={() => setShowAgentSelector(!showAgentSelector)}
                className="flex items-center gap-3 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl transition-colors"
              >
                {selectedAgent && (
                <>
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        PROVIDER_INFO[selectedAgent.provider]?.color ||
                        "#6B7280",
                      boxShadow: `0 0 8px ${
                        PROVIDER_INFO[selectedAgent.provider]?.color ||
                        "#6B7280"
                      }`,
                    }}
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">
                      {selectedAgent.name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {selectedAgent.model}
                    </p>
                  </div>
                </>
              )}
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${
                  showAgentSelector ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Agent Dropdown */}
            {showAgentSelector && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="p-2">
                  {activeAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setShowAgentSelector(false);
                      }}
                      className={`
                          w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors
                          ${
                            selectedAgentId === agent.id
                              ? "bg-indigo-900/30 border border-indigo-500/30"
                              : "hover:bg-gray-800"
                          }
                        `}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            PROVIDER_INFO[agent.provider]?.color || "#6B7280",
                          boxShadow: `0 0 8px ${
                            PROVIDER_INFO[agent.provider]?.color || "#6B7280"
                          }`,
                        }}
                      />
                      <div className="text-left flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {agent.model}
                        </p>
                      </div>
                      {selectedAgentId === agent.id && (
                        <Check size={16} className="text-indigo-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {activeSession && activeSession.messages.length >= 2 && (
              <button
                onClick={regenerateLastResponse}
                disabled={isGenerating}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Regenerate last response"
              >
                <RefreshCw size={18} />
              </button>
            )}
            {onCreateNewChatTab ? (
              <button
                onClick={onCreateNewChatTab}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <MessageSquare size={16} />
                <span className="text-sm">New Chat</span>
              </button>
            ) : (
              <button
                onClick={createNewSession}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <MessageSquare size={16} />
                <span className="text-sm">New Chat</span>
              </button>
            )}
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className={`p-2 rounded-lg transition-colors ${
                showHistorySidebar
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
              title="Toggle history"
            >
              <History size={18} />
            </button>
            {activeSession && (
              <button
                onClick={() =>
                  handleDeleteSession(activeSession.agentId, activeSession.id)
                }
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete chat"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {(!activeSession || activeSession.messages.length === 0) &&
          !streamingContent ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                <Sparkles className="size-8 text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Chat with {selectedAgent?.name || "AI"}
              </h2>
              <p className="text-gray-500 max-w-md">
                Start a conversation by typing a message below. Your chat will
                be powered by{" "}
                <span className="text-indigo-400 font-mono">
                  {selectedAgent?.model}
                </span>
              </p>
            </div>
          ) : (
              <div className="space-y-6">
                {activeSession?.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`
                        shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                        ${
                          message.role === "user"
                            ? "bg-indigo-600"
                            : "bg-gray-800 border border-gray-700"
                        }
                      `}
                    >
                      {message.role === "user" ? (
                        <User size={18} className="text-white" />
                      ) : (
                        <Bot size={18} className="text-gray-400" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={`
                        flex-1 max-w-[80%] group
                        ${message.role === "user" ? "text-right" : ""}
                      `}
                    >
                      <div
                        className={`
                          inline-block px-4 py-3 rounded-2xl text-left
                          ${
                            message.role === "user"
                              ? "bg-indigo-600 text-white rounded-br-md"
                              : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-md"
                          }
                        `}
                      >
                        {(() => {
                          const parsed = parseMessageContent(message.content);
                          return (
                            <>
                              {/* DEBUG: */}
                              {/* {parsed.hasContext && (
                                <div className="mb-2 pb-2 border-b border-white/10">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Zap size={12} className="text-emerald-300" />
                                    <span className="text-[10px] text-emerald-300 font-mono">
                                      Screenpipe Context
                                    </span>
                                  </div>
                                  <div className="text-xs opacity-70 font-mono whitespace-pre-wrap break-words">
                                    {parsed.context.replace('[Screenpipe Context]', '').trim()}
                                  </div>
                                </div>
                              )} */}
                              <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                                {parsed.message}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Message Actions */}
                      <div
                        className={`
                          flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity
                          ${message.role === "user" ? "justify-end" : ""}
                        `}
                      >
                        <button
                          onClick={() =>
                            copyMessage(message.id, message.content)
                          }
                          className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          {copiedId === message.id ? (
                            <Check size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        <span className="text-xs text-gray-600 font-mono">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Streaming Response */}
                {streamingContent && (
                  <div className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <Bot size={18} className="text-gray-400" />
                    </div>
                    <div className="flex-1 max-w-[80%]">
                      <div className="inline-block px-4 py-3 rounded-2xl rounded-bl-md bg-gray-900 text-gray-200 border border-gray-800">
                        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                          {streamingContent}
                          <span className="inline-block w-2 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isGenerating && !streamingContent && (
                  <div className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <Bot size={18} className="text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded-2xl rounded-bl-md">
                      <Loader2
                        size={16}
                        className="animate-spin text-indigo-400"
                      />
                      <span className="text-sm text-gray-400">Thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-gray-800 bg-gray-950/80 backdrop-blur-md p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedAgent?.name || "AI"}...`}
                  className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none min-h-[24px] max-h-[150px] px-3 py-2 focus:outline-none"
                  rows={1}
                  disabled={isGenerating}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isGenerating}
                className={`
                  p-4 rounded-xl transition-all flex items-center justify-center
                  ${
                    input.trim() && !isGenerating
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 shadow-lg shadow-indigo-500/25"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                  }
                `}
              >
                {isGenerating ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between mt-3">
              {/* DEBUG: Screenpipe Context Indicator */}
              {/* {screenpipeContext && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
                  <Zap size={12} className="text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-mono tracking-wider">
                    Screenpipe Context Active
                  </span>
                  <button
                    onClick={() => setScreenpipeContext("")}
                    className="ml-1 text-emerald-400/60 hover:text-emerald-400"
                    title="Clear context"
                  >
                    ×
                  </button>
                </div>
              )} */}
              
              {/* Model Info */}
              <div className="flex items-center justify-center gap-2 opacity-50 ml-auto">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: selectedAgent
                      ? PROVIDER_INFO[selectedAgent.provider]?.color || "#6B7280"
                      : "#6B7280",
                    boxShadow: selectedAgent
                      ? `0 0 6px ${
                          PROVIDER_INFO[selectedAgent.provider]?.color ||
                          "#6B7280"
                        }`
                      : "none",
                  }}
                />
                <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                  {selectedAgent?.model || "No model selected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Chat History */}
      <ChatHistorySidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoading={isLoadingHistory}
        isOpen={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={createNewSession}
        agentName={selectedAgent?.name}
      />
    </div>
  );
};
