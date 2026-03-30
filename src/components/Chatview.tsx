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
  AlertTriangle,
  Mail,
  Wrench,
  ChevronRight,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import {
  AIAgentConfig,
  ChatMessage,
  ChatSession,
  PROVIDER_INFO,
} from "../types/ai";
import { MultiAgentPanel, toPanelAgent } from "./MultiAgentPanel";
import { AgentOrchestrationService } from "../services/AgentOrchestrationService";
import { AIService } from "../services/AIService";
import {
  parseAction,
  executeToolCall,
  getMCPSystemPrompt,
  parseMosaicUI,
  getRichUISystemPrompt,
} from "../services/ActionParser";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { INTERNAL_SETTINGS_URL } from "../types/types";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ToolUIRenderer } from "./tool-ui";
import type { ConfirmModalBlock } from "./tool-ui/types";
import { fireToolToasts } from "./tool-ui/fireToolToasts";
import { ToolConfirmModal } from "./tool-ui/blocks/ToolConfirmModal";

interface ChatViewProps {
  onNavigate?: (url: string) => void;
  onCreateNewChatTab?: () => void;
  tabId?: string;
}

// =============================================================================
// Tool Message Helpers
// =============================================================================

/** Collapsible chip for tool calls and tool outputs */
const ToolChip: React.FC<{ label: string; detail: string }> = ({ label, detail }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 rounded-lg text-[11px] text-gray-400 hover:text-gray-300 transition-all"
      >
        <Wrench size={11} className="shrink-0" />
        <span className="font-medium">{label}</span>
        <ChevronRight
          size={10}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <pre className="mt-1.5 px-3 py-2 bg-gray-950/80 border border-gray-800 rounded-lg text-[10px] text-gray-500 overflow-x-auto max-h-40 whitespace-pre-wrap break-words">
          {detail}
        </pre>
      )}
    </div>
  );
};

/** Collapsed indicator for <mosaic_ui> blocks that failed validation */
const FailedBlockChip: React.FC<{ count: number; snippets?: string[] }> = ({ count, snippets }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/30 hover:bg-amber-800/30 border border-amber-700/40 rounded-lg text-[11px] text-amber-400/80 hover:text-amber-300 transition-all"
      >
        <AlertTriangle size={11} className="shrink-0" />
        <span className="font-medium">
          {count === 1 ? "1 visual block failed to render" : `${count} visual blocks failed to render`}
        </span>
        <ChevronRight
          size={10}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-1.5 px-3 py-2 bg-amber-950/40 border border-amber-800/30 rounded-lg text-[10px] text-amber-500/60 overflow-x-auto max-h-40">
          <p className="mb-1 text-amber-400/60">The agent tried to render UI blocks but they didn't pass validation.</p>
          {snippets && snippets.length > 0 && (
            <pre className="whitespace-pre-wrap break-words text-amber-600/50">{snippets.join("\n---\n")}</pre>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Renders tool-generated media (images) with a security gate.
 * When autoDisplay is false (default), shows a confirmation chip before revealing.
 * When autoDisplay is true, loads and shows the image immediately.
 * Images are always loaded as data: URIs via IPC — never rendered as mosaic-media:// directly.
 */
const MediaDisplay: React.FC<{ mediaUrls: string[]; autoDisplay: boolean }> = ({
  mediaUrls,
  autoDisplay,
}) => {
  const [dataUris, setDataUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    const uris: string[] = [];
    for (const url of mediaUrls) {
      try {
        const result = await (window as any).electronAPI?.media?.readAsDataUri?.(url);
        if (result?.success && result.dataUri) {
          uris.push(result.dataUri);
        }
      } catch (e) {
        console.error("[MediaDisplay] Failed to load media:", e);
      }
    }
    setDataUris(uris);
    setLoading(false);
  }, [mediaUrls]);

  useEffect(() => {
    if (autoDisplay) {
      setRevealed(true);
      loadMedia();
    }
  }, [autoDisplay, loadMedia]);

  if (dataUris.length > 0) {
    return (
      <div className="mt-2 space-y-2">
        {dataUris.map((uri, i) => (
          <img
            key={i}
            src={uri}
            alt="Generated media"
            className="rounded-lg max-w-full max-h-96 object-contain border border-gray-700"
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <Loader2 size={12} className="animate-spin" />
        <span>Loading generated media...</span>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className="my-2">
        <div className="inline-flex flex-wrap items-start gap-2 px-3 py-2 bg-amber-900/20 border border-amber-700/30 rounded-lg text-xs text-amber-400/80 max-w-full">
          <ImageIcon size={12} className="shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            Media from tool is blocked from displaying by default. You can change this in your configuration settings tab.
          </span>
          <button
            onClick={() => { setRevealed(true); loadMedia(); }}
            className="shrink-0 px-2.5 py-1 bg-amber-700/40 hover:bg-amber-600/40 text-amber-200 rounded text-xs font-medium transition-colors whitespace-nowrap"
          >
            Display generated media?
          </button>
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Renders message content with smart detection of tool artifacts.
 * - Assistant messages: strips <use_tool> XML, shows clean text + collapsed chip
 * - If raw <mosaic_ui> tags remain in content (old sessions), parses and shows blocks/feedback
 * - User messages: collapses [Tool Output for ...] into a chip
 */
const RenderMessageContent: React.FC<{ content: string; role: "assistant" | "user" }> = ({
  content,
  role,
}) => {
  if (role === "assistant") {
    // Check if content has leftover <mosaic_ui> tags (old saved sessions or edge cases)
    const hasMosaicTags = /<mosaic_ui>[\s\S]*?<\/mosaic_ui>/.test(content);
    let displayContent = content;
    let recoveredBlocks: import("../components/tool-ui/types").ToolUIBlock[] | null = null;
    let inlineFailed: { count: number; snippets: string[] } | null = null;

    if (hasMosaicTags) {
      const uiResult = parseMosaicUI(content);
      displayContent = uiResult.cleanContent;
      if (uiResult.blocks.length > 0) {
        recoveredBlocks = uiResult.blocks;
      }
      if (uiResult.failedBlockCount > 0) {
        inlineFailed = {
          count: uiResult.failedBlockCount,
          snippets: uiResult.failedRawSnippets,
        };
      }
    }

    // Check for <use_tool server="..." tool="...">...</use_tool>
    const toolMatch = displayContent.match(
      /<use_tool\s+server="([^"]+)"\s+tool="([^"]+)">([\s\S]*?)<\/use_tool>/
    );
    if (toolMatch) {
      const cleanText = displayContent.replace(/<use_tool[\s\S]*?<\/use_tool>/, "").trim();
      const toolLabel = `${toolMatch[1]}:${toolMatch[2]}`;
      const toolArgs = toolMatch[3].trim();
      return (
        <>
          {cleanText && <ReactMarkdown remarkPlugins={[remarkBreaks]}>{cleanText}</ReactMarkdown>}
          <ToolChip label={`Called ${toolLabel}`} detail={toolArgs || "{}"} />
          {recoveredBlocks && <ToolUIRenderer blocks={recoveredBlocks} />}
          {inlineFailed && <FailedBlockChip count={inlineFailed.count} snippets={inlineFailed.snippets} />}
        </>
      );
    }
    return (
      <>
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{displayContent}</ReactMarkdown>
        {recoveredBlocks && <ToolUIRenderer blocks={recoveredBlocks} />}
        {inlineFailed && <FailedBlockChip count={inlineFailed.count} snippets={inlineFailed.snippets} />}
      </>
    );
  }

  // User messages — check for [Tool Output for ...]
  const toolOutputMatch = content.match(/^\[Tool Output for ([^\]]+)\]\n?([\s\S]*)$/);
  if (toolOutputMatch) {
    const toolName = toolOutputMatch[1];
    // Strip the [Instruction: ...] tag — it's for the AI, not the user
    const outputBody = toolOutputMatch[2].replace(/\n*\[Instruction:[^\]]*\]$/, "").trim();
    return <ToolChip label={`Output from ${toolName}`} detail={outputBody || "(empty)"} />;
  }

  // Also check for [System Context] injections
  if (content.startsWith("[System Context]")) {
    return <ToolChip label="System context" detail={content.replace("[System Context]\n", "")} />;
  }

  return <span className="whitespace-pre-wrap">{content}</span>;
};

/** Filter out ephemeral [System Context] messages — they should never be persisted */
const stripSystemContext = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.filter(m => !m.content.startsWith("[System Context]"));

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
  
  // Multi-agent panel state
  const [showMultiAgentPanel, setShowMultiAgentPanel] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  /** Confirmation modal triggered by a tool response in chat */
  const [chatConfirmModal, setChatConfirmModal] = useState<ConfirmModalBlock | null>(null);
  /** Whether to auto-display media from tool calls (loaded from settings) */
  const [autoDisplayMedia, setAutoDisplayMedia] = useState(false);

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

  // Load autoDisplayMedia setting on mount
  useEffect(() => {
    const loadMediaSetting = async () => {
      try {
        const result = await (window as any).electronAPI?.media?.getAutoDisplay?.();
        if (result?.enabled !== undefined) {
          setAutoDisplayMedia(result.enabled);
        }
      } catch (e) {
        console.warn("[ChatView] Failed to load autoDisplayMedia setting:", e);
      }
    };
    loadMediaSetting();
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
          "[data-auto-send]",
        ) as HTMLButtonElement;
        if (submitBtn) submitBtn.click();
      }, 100);
    }
  }, [selectedAgent, isGenerating]);

  // Create new session (for New Chat button)
  const createNewSession = useCallback((): ChatSession => {
    if (!selectedAgentId) return null as any;

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
            remainingSessions.length > 0 ? remainingSessions[0].id : null,
          );
        }
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [activeSessionId, sessions],
  );

  // Check for pending message from command palette
  useEffect(() => {
    // Wait for agents to be loaded and selected
    if (!tabId || !selectedAgent || isGenerating || activeAgents.length === 0)
      return;

    // Check if we've already processed this pending message
    const pendingMessageKey = `chat_pending_message_${tabId}`;
    if (pendingMessageProcessedRef.current === pendingMessageKey) return;

    const pendingMessage = localStorage.getItem(pendingMessageKey);

    if (pendingMessage && pendingMessage.trim()) {
      // Mark as processed immediately to prevent duplicate sends
      pendingMessageProcessedRef.current = pendingMessageKey;
      localStorage.removeItem(pendingMessageKey);

      // Set the input and trigger send after a short delay to ensure component is ready
      const timeoutId = setTimeout(() => {
        // Double-check agent is still available
        if (!selectedAgent || isGenerating) {
          pendingMessageProcessedRef.current = null;
          return;
        }

        // Create session if needed
        if (!activeSession || activeSession.agentId !== selectedAgent.id) {
          createNewSession();
        }

        // Set the input and trigger send via the main sendMessage function
        setInput(pendingMessage.trim());
        // Use setTimeout to ensure input state is updated before triggering send
        setTimeout(() => {
          const sendBtn = document.querySelector(
            "[data-auto-send]",
          ) as HTMLButtonElement;
          if (sendBtn) sendBtn.click();
        }, 100);
      }, 300);

      return () => {
        clearTimeout(timeoutId);
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
    sessions,
    saveSession,
    isGenerating,
    activeAgents.length,
  ]);

  // Fetch MCP Servers
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  useEffect(() => {
    const loadServers = async () => {
        try {
            const servers = await window.electronAPI.mcpAPI.listServers();
            setMcpServers(servers || []);
        } catch (e) {
            console.error(e);
        }
    };
    loadServers();
  }, []);

  // Recursive handler for AI conversation flow
  const processAIResponse = async (
    currentSession: ChatSession,
    currentMessages: ChatMessage[],
    depth: number = 0
  ) => {
    if (depth > 10) {
      console.warn("Max recursion depth reached");
      setIsGenerating(false);
      return;
    }

    let fullResponse = "";

    try {
      await AIService.sendMessage(selectedAgent!, currentMessages, {
        onToken: (token) => {
          fullResponse += token;

          // Detect <use_tool> during streaming so the UI transitions smoothly
          // instead of flashing the raw XML + hallucinated data then replacing it.
          const tagStart = fullResponse.indexOf('<use_tool');
          if (tagStart >= 0) {
            const preamble = fullResponse.substring(0, tagStart).trim();
            const nameMatch = fullResponse.match(/<use_tool\s+server="[^"]*"\s+tool="([^"]*)"/);
            const toolName = nameMatch ? nameMatch[1].replace(/_/g, ' ') : '';
            const indicator = toolName ? `🛠️ Calling ${toolName}...` : '🛠️ Preparing tool call...';

            // Hide preamble if it contains suspected hallucinated numbers
            const hasNumbers = /\$[\d,.]+|\d+\.\d+%|\d{2,}[,.]\d/.test(preamble);
            if (hasNumbers || !preamble) {
              setStreamingContent(indicator);
            } else {
              const cleanLines = preamble.split('\n').filter(l => l.trim()).slice(0, 2).join('\n');
              setStreamingContent(cleanLines ? `${cleanLines}\n\n${indicator}` : indicator);
            }
          } else if (selectedAgent?.richUI && fullResponse.indexOf('<mosaic_ui') >= 0) {
            // Hide <mosaic_ui> JSON during streaming — only show text before the tag.
            // The blocks will be parsed and rendered properly in onComplete.
            const uiTagStart = fullResponse.indexOf('<mosaic_ui');
            const textBefore = fullResponse.substring(0, uiTagStart).trim();
            setStreamingContent(textBefore || '');
          } else {
            setStreamingContent(fullResponse);
          }
        },
        onComplete: async (response) => {
          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: "assistant",
            content: response,
            timestamp: Date.now(),
            agentId: selectedAgent!.id,
          };

          // Check for tool call BEFORE committing — avoids the flash caused by
          // committing the raw response then immediately replacing it.
          const action = parseAction(response);

          if (action.type === "TOOL_CALL") {
             const toolLabel = action.params?.tool?.replace(/_/g, ' ') || 'tool';

             // Use only text BEFORE the <use_tool> tag as preamble.
             // cleanResponse includes text AFTER </use_tool> which often contains
             // hallucinated data (e.g. "$97,336") that would poison the number check.
             const tagIndex = response.indexOf('<use_tool');
             const preToolText = tagIndex >= 0 ? response.substring(0, tagIndex).trim() : '';
             const preambleLines = preToolText
               .split('\n').filter(line => line.trim().length > 0).slice(0, 3).join('\n');
             const hasHallucinatedData = /\$[\d,.]+|\d+\.\d+%|\d{2,}[,.]\d/.test(preambleLines);
             const safeContent = hasHallucinatedData
               ? `Checking ${toolLabel}...`
               : (preambleLines || `Checking ${toolLabel}...`);

             const cleanedAssistantMsg: ChatMessage = {
               ...assistantMsg,
               content: safeContent + '\n' + (action.rawTag || ''),
             };

             // Keep streaming indicator while tool executes
             setStreamingContent(`🛠️ Executing ${toolLabel}...`);

             const result = await executeToolCall(action, selectedAgent!.id);

             // Fire any toast blocks from the tool response
             const blocksAfterToast = result.uiBlocks
               ? fireToolToasts(result.uiBlocks as import("./tool-ui/types").ToolUIBlock[])
               : undefined;

             // Check if the tool returned a confirm-modal block
             const modalBlock = blocksAfterToast?.find(
               (b: { type: string }) => b.type === "confirm-modal",
             ) as ConfirmModalBlock | undefined;
             if (modalBlock) {
               setChatConfirmModal(modalBlock);
             }

             // Filter overlay blocks from inline rendering
             const inlineBlocks = blocksAfterToast?.filter(
               (b: { type: string }) => b.type !== "confirm-modal" && b.type !== "detail-panel",
             );

             // Create Tool Output message
             const toolMsg: ChatMessage = {
                 id: `msg-${Date.now() + 1}`,
                 role: "user",
                 content: `[Tool Output for ${action.params?.server}:${action.params?.tool}]\n${result.text}\n\n[Instruction: Use ONLY the data above. Respond in 1-2 sentences. Do not add data from your training — only from this tool output.]`,
                 timestamp: Date.now(),
                 agentId: selectedAgent!.id,
                 uiBlocks: inlineBlocks,
                 displayHint: result.displayHint,
                 mediaUrls: result.mediaUrls,
             };

             // Commit cleaned assistant message + tool output together (single render)
             const persistMessages = stripSystemContext(currentMessages);
             const nextMessages = [...persistMessages, cleanedAssistantMsg, toolMsg];
             const nextSession = {
                 ...currentSession,
                 messages: nextMessages,
                 updatedAt: Date.now()
             };

             setSessions((prev) => prev.map(s => s.id === currentSession.id ? nextSession : s));
             await saveSession(nextSession);

             // "display" hint = UI is the answer, no agent follow-up needed
             if (result.displayHint === "display") {
               setStreamingContent("");
               setIsGenerating(false);
               return;
             }

             // "analyze" (default) = send data back to agent for commentary
             // Keep system context for the AI on the recursive call
             const aiMessages = [...currentMessages, cleanedAssistantMsg, toolMsg];
             await processAIResponse(nextSession, aiMessages, depth + 1);
             return;
          }

          // No tool call → check for <mosaic_ui> blocks if rich UI is enabled
          let uiBlocks: import("../components/tool-ui/types").ToolUIBlock[] | undefined;
          let finalContent = response;
          let failedUIBlockCount: number | undefined;
          let failedUIRawSnippets: string[] | undefined;

          if (selectedAgent?.richUI) {
            const uiResult = parseMosaicUI(response);
            // Always use cleaned content — never show raw <mosaic_ui> tags
            finalContent = uiResult.cleanContent;
            if (uiResult.blocks.length > 0) {
              uiBlocks = uiResult.blocks;
            }
            if (uiResult.failedBlockCount > 0) {
              failedUIBlockCount = uiResult.failedBlockCount;
              failedUIRawSnippets = uiResult.failedRawSnippets;
            }
          }

          const persistMessages = stripSystemContext(currentMessages);
          const messagesWithAssistant = [...persistMessages, {
            ...assistantMsg,
            content: finalContent,
            uiBlocks,
            failedUIBlockCount,
            failedUIRawSnippets,
          }];
          const sessionWithAssistant = {
            ...currentSession,
            messages: messagesWithAssistant,
            updatedAt: Date.now(),
          };
          setSessions((prev) =>
            prev.map((s) => (s.id === currentSession.id ? sessionWithAssistant : s))
          );
          await saveSession(sessionWithAssistant);
          setStreamingContent("");
          setIsGenerating(false);
          window.electronAPI.logInput(response.trim());
        },
        onError: async (error) => {
            console.error("Stream error:", error);
            const errorMsg: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: `⚠️ Error: ${error.message}`,
                timestamp: Date.now(),
                agentId: selectedAgent!.id
            };
            const errorSession = { ...currentSession, messages: [...currentMessages, errorMsg], updatedAt: Date.now() };
            setSessions(prev => prev.map(s => s.id === currentSession.id ? errorSession : s));
            await saveSession(errorSession);
            setStreamingContent("");
            setIsGenerating(false);
        }
      });
    } catch (error) {
       // Handle sync errors in sendMessage
       console.error("Sync error in sendMessage:", error);
       setIsGenerating(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || isGenerating) return;

    const messageContent = input.trim();
    setInput("");

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

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      agentId: selectedAgent.id,
    };

    const updatedMessages = [...session.messages, userMessage];
    const updatedSession: ChatSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
      title: session.messages.length === 0 ? messageContent.slice(0, 40) : session.title,
    };

    if (isNewSession) {
      setSessions((prev) => [updatedSession, ...prev]);
      setActiveSessionId(updatedSession.id);
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === session!.id ? updatedSession : s)),
      );
    }

    await saveSession(updatedSession);
    setIsGenerating(true);
    setStreamingContent("");

    try {
        await window.electronAPI.logInput(messageContent);
        
        // Prepare context — strip any previously-persisted system context
        const messagesForAI = updatedMessages.filter(m => m.role !== "system" && !m.content.startsWith("[System Context]"));
        
        // Inject System Prompts (Mosaic tool/MCP/vault context).
        // Hypercycle agents talk to a remote gateway with plain chat — same as curl without our
        // prompts. If we inject Web3 + "must use tools / say if none" rules, the model refuses
        // general questions (e.g. weather) because no weather tool exists.
        let idCounter = 0;
        const systemPrompts: string[] = [];
        const useMosaicAgentContext = selectedAgent.provider !== "hypercycle";

        if (useMosaicAgentContext) {
          // 0. Universal anti-hallucination header
          systemPrompts.push(
            `IMPORTANT: Your training data is OUTDATED. For ANY question involving prices, balances, ` +
              `exchange rates, availability, status, or any real-time/time-sensitive data, you MUST call ` +
              `a tool FIRST. NEVER answer from memory or training data for factual claims. ` +
              `If no tool is available for the request, say so — do not guess.`,
          );

          // 1. MCP Context
          const mcpPrompt = getMCPSystemPrompt(mcpServers);
          if (mcpPrompt) {
            systemPrompts.push(mcpPrompt);
          }

          // 2. Built-in tools context (Gmail, Web3, Vault, WASM) — the ToolRegistry
          //    aggregates system prompts from all available modules.
          try {
            const toolsPrompt = await window.electronAPI?.tools?.getSystemPrompt?.();
            if (toolsPrompt) {
              systemPrompts.push(toolsPrompt);
            }
          } catch (e) {
            console.error("Failed to get tools system prompt:", e);
          }

          // 3. Vault context — tell the agent which boxes it can access
          try {
            const agentBoxes = await window.electronAPI?.vault?.getAgentBoxes(selectedAgent!.id);
            if (agentBoxes && agentBoxes.length > 0) {
              const boxList = agentBoxes
                .map(
                  (b: any) =>
                    `- "${b.name}" (ID: ${b.id})${b.description ? ` — ${b.description}` : ""}`,
                )
                .join("\n");
              systemPrompts.push(
                `You have access to the following Vault boxes:\n${boxList}\n\n` +
                  `Use the vault tools (vault:list_boxes, vault:read_box) to retrieve data from these boxes when relevant to the user's query.`,
              );
            }
          } catch (e) {
            console.error("Failed to get vault context:", e);
          }

          // 4. Agent Rich UI — teach agent about <mosaic_ui> if enabled
          if (selectedAgent!.richUI) {
            systemPrompts.push(getRichUISystemPrompt());
          }
        }

        if (systemPrompts.length > 0) {
            const systemMessage: ChatMessage = {
                id: `system-${Date.now()}-${idCounter++}`,
                role: "user", // Inject as user for compatibility
                content: `[System Context]\n${systemPrompts.join("\n\n")}`,
                timestamp: Date.now(),
                agentId: selectedAgent.id
            };
            messagesForAI.unshift(systemMessage);
        }

        // Start Recursive Loop
        await processAIResponse(updatedSession, messagesForAI);

    } catch (e) {
        console.error(e);
        setIsGenerating(false);
    }
  };

  const handleMultiAgentRun = async (
    agentIds: string[],
    prompt: string,
    mode: "sequential" | "parallel" | "collaborative" | "orchestrator"
  ) => {
    if (agentIds.length === 0 || !prompt.trim()) return;

    console.log(`[Multi-Agent] Starting ${agentIds.length} agents in ${mode} mode`);

    // Create session for multi-agent run
    const sessionId = `multi-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      agentId: "multi-agent",
    };

    // Add user message to chat immediately
    setInput("");
    setIsGenerating(true);

    try {
      // Get selected agents
      const selectedAgents = agents.filter((a) => agentIds.includes(a.id));

      let result: { finalOutput: string };
      switch (mode) {
        case "sequential":
          result = await AgentOrchestrationService.runSequential(selectedAgents, prompt);
          break;
        case "parallel":
          result = await AgentOrchestrationService.runParallel(selectedAgents, prompt);
          break;
        case "collaborative":
          result = await AgentOrchestrationService.runCollaborative(selectedAgents, prompt);
          break;
        case "orchestrator":
          const [orchestrator, ...workers] = selectedAgents;
          result = await AgentOrchestrationService.runOrchestrated(orchestrator, workers, prompt);
          break;
        default:
          result = { finalOutput: "Unknown orchestration mode" };
      }

      // Create session
      const session: ChatSession = {
        id: sessionId,
        agentId: "multi-agent",
        title: prompt.slice(0, 40),
        messages: [userMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: result.finalOutput,
        timestamp: Date.now(),
        agentId: "multi-agent",
      };

      session.messages.push(assistantMessage);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch (e) {
      console.error("[Multi-Agent] Error:", e);
    } finally {
      setIsGenerating(false);
      setShowMultiAgentPanel(false);
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
        prev.map((s) => (s.id === activeSession.id ? updatedSession : s)),
      );
      saveSession(updatedSession);
      setInput(lastUserMessage.content);
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
                          <Check
                            size={16}
                            className="text-indigo-400 shrink-0"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Multi-Agent Panel Toggle */}
              <button
                onClick={() => setShowMultiAgentPanel(!showMultiAgentPanel)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showMultiAgentPanel
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                }`}
                title="Multi-Agent Panel"
              >
                <Users size={18} />
              </button>
              
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
              <button
                onClick={createNewSession}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <MessageSquare size={16} />
                <span className="text-sm">New Chat</span>
              </button>
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
                {activeSession?.messages.map((message) => {
                  // Detect tool-related messages (output or system context)
                  const isToolOutput =
                    message.role === "user" &&
                    (message.content.startsWith("[Tool Output for ") ||
                     message.content.startsWith("[System Context]"));

                  // Tool output → centered system row (no avatar, no bubble)
                  if (isToolOutput) {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="max-w-[90%]">
                          <RenderMessageContent content={message.content} role="user" />
                          {message.uiBlocks && message.uiBlocks.length > 0 && (
                            <ToolUIRenderer blocks={message.uiBlocks} />
                          )}
                          {message.mediaUrls && message.mediaUrls.length > 0 && (
                            <MediaDisplay mediaUrls={message.mediaUrls} autoDisplay={autoDisplayMedia} />
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Normal user/assistant message
                  return (
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
                            <RenderMessageContent content={message.content} role="assistant" />
                          ) : (
                            <RenderMessageContent content={message.content} role="user" />
                          )}
                        </div>
                        {message.role === "assistant" && message.uiBlocks && message.uiBlocks.length > 0 && (
                          <ToolUIRenderer blocks={message.uiBlocks} />
                        )}
                        {message.role === "assistant" && message.failedUIBlockCount && message.failedUIBlockCount > 0 && !message.uiBlocks?.length && (
                          <FailedBlockChip count={message.failedUIBlockCount} snippets={message.failedUIRawSnippets} />
                        )}
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
                  );
                })}

                {/* Streaming Response */}
                {streamingContent && (
                  <div className="flex gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <Bot size={18} className="text-gray-400" />
                    </div>

                    <div className="flex-1 max-w-[80%]">
                      <div className="inline-block px-4 py-3 rounded-2xl rounded-bl-md bg-gray-900 text-gray-200 border border-gray-800">
                        <div className="break-words text-[15px] leading-loose prose prose-invert prose-sm max-w-none prose-p:my-3 prose-headings:my-4 prose-ul:my-3 prose-li:my-2 prose-hr:my-4">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>{streamingContent}</ReactMarkdown>
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

        {/* Multi-Agent Panel */}
        {showMultiAgentPanel && (
          <div className="shrink-0 border-b border-gray-800">
            <MultiAgentPanel
              agents={activeAgents.map(toPanelAgent)}
              onCollapse={() => setShowMultiAgentPanel(false)}
              onRun={handleMultiAgentRun}
            />
          </div>
        )}

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
                data-auto-send
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
            <div className="flex items-center justify-center gap-2 mt-3 opacity-50">
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

      {/* Tool Confirmation Modal (triggered by tool responses in chat) */}
      {chatConfirmModal && (
        <ToolConfirmModal
          modal={chatConfirmModal}
          onClose={() => setChatConfirmModal(null)}
        />
      )}
    </div>
  );
};
