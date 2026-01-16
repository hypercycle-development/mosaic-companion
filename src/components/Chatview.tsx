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
  AlertCircle,
  Mail,
} from "lucide-react";
import {
  AIAgentConfig,
  ChatMessage,
  ChatSession,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";
import {
  parseAction,
  executeGmailAction,
  buildEmailAnalysisPrompt,
  isGmailAuthenticated,
} from "../services/ActionParser";
import {
  getGmailSystemPrompt,
  mightBeEmailRelated,
} from "../prompts/gmail-tools";
import ReactMarkdown from "react-markdown";

interface ChatViewProps {
  //   agents: AIAgentConfig[];
  //   onNavigateToSettings: () => void;
}

export const ChatView: React.FC<ChatViewProps> = (
  {
    //   onNavigateToSettings,
  }
) => {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentSelectorRef = useRef<HTMLDivElement>(null);

  const activeAgents = agents.filter((a) => a.isActive);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Auto-select first active agent
  useEffect(() => {
    if (!selectedAgentId && activeAgents.length > 0) {
      setSelectedAgentId(activeAgents[0].id);
    }
  }, [activeAgents, selectedAgentId]);

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
  useEffect(() => {
    // Set initial array of agents
    const getAgents = async () => {
      const result = await window.electronAPI.aiAgents.get();
      if (result) {
        setAgents(result);
      } else {
        console.log("No ai agents found");
      }
    };
    getAgents();

    // Check Gmail connection status
    isGmailAuthenticated().then(setGmailConnected);
  }, []);
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

  // Check for pending message from unified input bar and auto-send
  const pendingMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const pendingMessage = sessionStorage.getItem("pendingChatMessage");
    if (pendingMessage) {
      sessionStorage.removeItem("pendingChatMessage");
      pendingMessageRef.current = pendingMessage;
    }
  }, []);

  // Auto-send pending message when agent is ready
  useEffect(() => {
    if (pendingMessageRef.current && selectedAgent && !isGenerating) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      setInput(msg);
      // Trigger send after input is set
      setTimeout(() => {
        // Manually trigger send by simulating the flow
        const submitBtn = document.querySelector(
          "[data-auto-send]"
        ) as HTMLButtonElement;
        if (submitBtn) submitBtn.click();
      }, 100);
    }
  }, [selectedAgent, isGenerating]);

  const createNewSession = useCallback((agentId: string): ChatSession => {
    const session: ChatSession = {
      id: `session-${Date.now()}`,
      agentId,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
    return session;
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || isGenerating) return;

    const messageContent = input.trim();
    setInput("");

    // Get or create session
    let session = activeSession;
    if (!session || session.agentId !== selectedAgent.id) {
      session = createNewSession(selectedAgent.id);
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      agentId: selectedAgent.id,
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
                s.messages.length === 0 ? messageContent.slice(0, 40) : s.title,
            }
          : s
      )
    );

    // Start generating response
    setIsGenerating(true);
    setStreamingContent("");

    try {
      let fullResponse = "";
      await window.electronAPI.logInput(input.trim());

      // Build messages with Gmail system prompt if connected
      const messagesForAI = updatedMessages.filter((m) => m.role !== "system");

      // Add Gmail context if user might be asking about emails
      if (gmailConnected && mightBeEmailRelated(messageContent)) {
        const systemMessage: ChatMessage = {
          id: "gmail-system",
          role: "user" as const, // Inject as user message for better compatibility
          content: `[System Context] ${getGmailSystemPrompt(true)}`,
          timestamp: Date.now(),
          agentId: selectedAgent.id,
        };
        messagesForAI.unshift(systemMessage);
      }

      await AIService.sendMessage(selectedAgent, messagesForAI, {
        onToken: (token) => {
          fullResponse += token;
          setStreamingContent(fullResponse);
        },
        onComplete: async (response) => {
          // Check for Gmail action tags in the response
          const parsedAction = parseAction(response);

          if (parsedAction.type !== "NONE") {
            // Gmail action detected - execute it
            setStreamingContent(
              parsedAction.cleanResponse + "\n\n📧 Fetching emails..."
            );

            const emailData = await executeGmailAction(parsedAction);

            // Send email data back to AI for analysis
            const analysisPrompt = buildEmailAnalysisPrompt(
              messageContent,
              emailData
            );

            // Add the initial response as a message
            const initialMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: parsedAction.cleanResponse,
              timestamp: Date.now(),
              agentId: selectedAgent.id,
            };

            const messagesWithInitial = [...updatedMessages, initialMessage];

            // Create follow-up message with email data
            const dataMessage: ChatMessage = {
              id: `msg-${Date.now() + 1}`,
              role: "user",
              content: analysisPrompt,
              timestamp: Date.now(),
              agentId: selectedAgent.id,
            };

            // Get AI analysis
            let analysisResponse = "";
            setStreamingContent(
              parsedAction.cleanResponse + "\n\n📧 Analyzing emails..."
            );

            await AIService.sendMessage(
              selectedAgent,
              [...messagesWithInitial, dataMessage].filter(
                (m) => m.role !== "system"
              ),
              {
                onToken: (token) => {
                  analysisResponse += token;
                  setStreamingContent(
                    parsedAction.cleanResponse + "\n\n" + analysisResponse
                  );
                },
                onComplete: (analysis) => {
                  const finalMessage: ChatMessage = {
                    id: `msg-${Date.now() + 2}`,
                    role: "assistant",
                    content: parsedAction.cleanResponse + "\n\n" + analysis,
                    timestamp: Date.now(),
                    agentId: selectedAgent.id,
                  };

                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === session!.id
                        ? {
                            ...s,
                            messages: [...updatedMessages, finalMessage],
                            updatedAt: Date.now(),
                          }
                        : s
                    )
                  );
                  setStreamingContent("");
                  setIsGenerating(false);
                },
                onError: (error) => {
                  // Still show the initial response even if analysis fails
                  const errorMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: "assistant",
                    content: `${parsedAction.cleanResponse}\n\n⚠️ Error analyzing emails: ${error.message}`,
                    timestamp: Date.now(),
                    agentId: selectedAgent.id,
                  };
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === session!.id
                        ? {
                            ...s,
                            messages: [...updatedMessages, errorMessage],
                            updatedAt: Date.now(),
                          }
                        : s
                    )
                  );
                  setStreamingContent("");
                  setIsGenerating(false);
                },
              }
            );
          } else {
            // No Gmail action - normal response
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: response,
              timestamp: Date.now(),
              agentId: selectedAgent.id,
            };

            setSessions((prev) =>
              prev.map((s) =>
                s.id === session!.id
                  ? {
                      ...s,
                      messages: [...updatedMessages, assistantMessage],
                      updatedAt: Date.now(),
                    }
                  : s
              )
            );
            setStreamingContent("");
            setIsGenerating(false);
            window.electronAPI.logInput(response.trim());
          }
        },
        onError: (error) => {
          console.error("Stream error:", error);
          // Add error message
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: `⚠️ Error: ${error.message}`,
            timestamp: Date.now(),
            agentId: selectedAgent.id,
          };
          setSessions((prev) =>
            prev.map((s) =>
              s.id === session!.id
                ? {
                    ...s,
                    messages: [...updatedMessages, errorMessage],
                    updatedAt: Date.now(),
                  }
                : s
            )
          );
          setStreamingContent("");
          setIsGenerating(false);
        },
      });
    } catch (error) {
      // Fallback for non-streaming errors
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Error: ${(error as Error).message}`,
        timestamp: Date.now(),
        agentId: selectedAgent.id,
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session!.id
            ? {
                ...s,
                messages: [...updatedMessages, errorMessage],
                updatedAt: Date.now(),
              }
            : s
        )
      );
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

    // Remove last assistant message and resend
    const messagesWithoutLast = activeSession.messages.slice(0, -1);
    const lastUserMessage = messagesWithoutLast[messagesWithoutLast.length - 1];

    if (lastUserMessage?.role === "user") {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: messagesWithoutLast }
            : s
        )
      );
      setInput(lastUserMessage.content);
    }
  };

  const clearChat = () => {
    if (activeSession) {
      setSessions((prev) => prev.filter((s) => s.id !== activeSession.id));
      setActiveSessionId(null);
    }
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
          //   onClick={onNavigateToSettings}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all hover:scale-[1.02] font-medium"
        >
          <Zap size={18} />
          Configure Agents
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
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
                        PROVIDER_INFO[selectedAgent.provider].color,
                      boxShadow: `0 0 8px ${
                        PROVIDER_INFO[selectedAgent.provider].color
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

            {/* Dropdown */}
            {showAgentSelector && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
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
                          backgroundColor: PROVIDER_INFO[agent.provider].color,
                          boxShadow: `0 0 8px ${
                            PROVIDER_INFO[agent.provider].color
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

          {/* Session Actions */}
          <div className="flex items-center gap-2">
            {activeSession && (
              <>
                <button
                  onClick={regenerateLastResponse}
                  disabled={isGenerating || activeSession.messages.length < 2}
                  className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Regenerate last response"
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  onClick={clearChat}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
            <button
              onClick={() => createNewSession(selectedAgentId!)}
              className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MessageSquare size={16} />
              <span className="text-sm">New Chat</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {(!activeSession || activeSession.messages.length === 0) &&
          !streamingContent ? (
            // Empty state
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
            // Messages
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
                      <div className="break-words text-[15px] leading-loose prose prose-invert prose-sm max-w-none prose-p:my-3 prose-headings:my-4 prose-ul:my-3 prose-li:my-2 prose-hr:my-4">
                        {message.role === "assistant" ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {message.content}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message Actions */}
                    <div
                      className={`
                      flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity
                      ${message.role === "user" ? "justify-end" : ""}
                    `}
                    >
                      <button
                        onClick={() => copyMessage(message.id, message.content)}
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
                      <div className="break-words text-[15px] leading-loose prose prose-invert prose-sm max-w-none prose-p:my-3 prose-headings:my-4 prose-ul:my-3 prose-li:my-2 prose-hr:my-4">
                        <ReactMarkdown>{streamingContent}</ReactMarkdown>
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

      {/* Hidden button for auto-send from unified input */}
      <button
        data-auto-send
        onClick={sendMessage}
        style={{ display: "none" }}
      />
    </div>
  );
};
