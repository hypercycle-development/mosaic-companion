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
  Mail,
  Wrench,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import {
  AIAgentConfig,
  ChatMessage,
  ChatSession,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";
import { ExecutionBridge } from "../services/ExecutionBridge";
import { builderService } from "../services/BuilderService";
import {
  parseAction,
  executeGmailAction,
  buildEmailAnalysisPrompt,
  buildSingleEmailAnalysisPrompt,
  isGmailAuthenticated,
  getGmailSystemPrompt,
  mightBeEmailRelated,
  detectEmailReadRequest,
} from "../services/ActionParser";
import ReactMarkdown from "react-markdown";
import { INTERNAL_SETTINGS_URL } from "../types/types";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { MultiAgentSelector } from "./MultiAgentSelector";
import { MultiAgentPanel } from "./MultiAgentPanel";
import {
  OrchestrationMode,
  AggregationStrategy,
  AgentResponse,
  OrchestrationResult,
  OrchestrationCallbacks,
} from "../types/agentOrchestration";
import { AgentOrchestrationService } from "../services/AgentOrchestrationService";

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
  const [gmailConnected, setGmailConnected] = useState(false);
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

  useEffect(() => {
    // Check Gmail connection status
    isGmailAuthenticated().then(setGmailConnected);
  }, []);

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

    // TODO: Verify this is needed
    // Check Gmail connection status
    // isGmailAuthenticated().then(setGmailConnected);
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

    // Add user message
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
        prev.map((s) => (s.id === session!.id ? updatedSession : s)),
      );
    }

    // Save to disk
    await saveSession(updatedSession);

    // Start generating response
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

            // Send email data back to AI for analysis
            // Use single email prompt for GMAIL_READ, list prompt for others
            const analysisPrompt =
              parsedAction.type === "GMAIL_READ"
                ? buildSingleEmailAnalysisPrompt(messageContent, emailData)
                : buildEmailAnalysisPrompt(messageContent, emailData);

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
              parsedAction.cleanResponse + "\n\n📧 Analyzing emails...",
            );

            await AIService.sendMessage(
              selectedAgent,
              [...messagesWithInitial, dataMessage].filter(
                (m) => m.role !== "system",
              ),
              {
                onToken: (token) => {
                  analysisResponse += token;
                  setStreamingContent(
                    parsedAction.cleanResponse + "\n\n" + analysisResponse,
                  );
                },
                onComplete: async (analysis) => {
                  const finalMessage: ChatMessage = {
                    id: `msg-${Date.now() + 2}`,
                    role: "assistant",
                    content: parsedAction.cleanResponse + "\n\n" + analysis,
                    timestamp: Date.now(),
                    agentId: selectedAgent.id,
                  };

                  const finalSession: ChatSession = {
                    ...session!,
                    messages: [...updatedMessages, finalMessage],
                    updatedAt: Date.now(),
                  };

                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === finalSession.id ? finalSession : s,
                    ),
                  );
                  await saveSession(finalSession);
                  setStreamingContent("");
                  setIsGenerating(false);
                },
                onError: async (error) => {
                  // Still show the initial response even if analysis fails
                  const errorMessage: ChatMessage = {
                    id: `msg-${Date.now()}`,
                    role: "assistant",
                    content: `${parsedAction.cleanResponse}\n\n⚠️ Error analyzing emails: ${error.message}`,
                    timestamp: Date.now(),
                    agentId: selectedAgent.id,
                  };

                  const errorSession: ChatSession = {
                    ...session!,
                    messages: [...updatedMessages, errorMessage],
                    updatedAt: Date.now(),
                  };

                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === errorSession.id ? errorSession : s,
                    ),
                  );
                  await saveSession(errorSession);
                  setStreamingContent("");
                  setIsGenerating(false);
                },
              }, isBuilderMode);
          } else {
            // No Gmail action in AI response - check if user was asking to read an email
            // and auto-execute if so (fallback for when AI doesn't output the tag)
            const requestedEmailNum = detectEmailReadRequest(messageContent);

            if (requestedEmailNum !== null && gmailConnected) {
              // User asked to read an email but AI didn't output the tag - auto-execute
              setStreamingContent(
                response + "\n\n📧 Fetching email content...",
              );

              const readAction = {
                type: "GMAIL_READ" as const,
                params: { index: requestedEmailNum },
                cleanResponse: response,
              };

              const emailData = await executeGmailAction(readAction);

              // Send email data back to AI for analysis/summarization
              // Use the single email prompt for better TL;DR format
              const analysisPrompt = buildSingleEmailAnalysisPrompt(
                messageContent,
                emailData,
              );

              const initialMessage: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: response,
                timestamp: Date.now(),
                agentId: selectedAgent.id,
              };

              const messagesWithInitial = [...updatedMessages, initialMessage];

              const dataMessage: ChatMessage = {
                id: `msg-${Date.now() + 1}`,
                role: "user",
                content: analysisPrompt,
                timestamp: Date.now(),
                agentId: selectedAgent.id,
              };

              let analysisResponse = "";

              await AIService.sendMessage(
                selectedAgent,
                [...messagesWithInitial, dataMessage].filter(
                  (m) => m.role !== "system",
                ),
                {
                  onToken: (token) => {
                    analysisResponse += token;
                    setStreamingContent(response + "\n\n" + analysisResponse);
                  },
                  onComplete: async (analysis) => {
                    const finalMessage: ChatMessage = {
                      id: `msg-${Date.now() + 2}`,
                      role: "assistant",
                      content: response + "\n\n" + analysis,
                      timestamp: Date.now(),
                      agentId: selectedAgent.id,
                    };

                    const finalSession: ChatSession = {
                      ...updatedSession,
                      messages: [...updatedMessages, finalMessage],
                      updatedAt: Date.now(),
                    };

                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === finalSession.id ? finalSession : s,
                      ),
                    );
                    await saveSession(finalSession);
                    setStreamingContent("");
                    setIsGenerating(false);
                  },
                  onError: async (error) => {
                    const errorMessage: ChatMessage = {
                      id: `msg-${Date.now()}`,
                      role: "assistant",
                      content: `${response}\n\n⚠️ Error analyzing email: ${error.message}`,
                      timestamp: Date.now(),
                      agentId: selectedAgent.id,
                    };
                    const errorSession: ChatSession = {
                      ...updatedSession,
                      messages: [...updatedMessages, errorMessage],
                      updatedAt: Date.now(),
                    };
                    setSessions((prev) =>
                      prev.map((s) =>
                        s.id === errorSession.id ? errorSession : s,
                      ),
                    );
                    await saveSession(errorSession);
                    setStreamingContent("");
                    setIsGenerating(false);
                  },
                }, isBuilderMode);
            } else {
              // Normal response - check for Builder mode execution
              let finalResponse = response;
              
              // If Builder mode is enabled, process execution commands
              if (isBuilderMode) {
                console.log('[Builder] Processing response for execution commands...');
                try {
                  finalResponse = await ExecutionBridge.processResponse(response, true);
                } catch (execError) {
                  console.error('[Builder] Execution error:', execError);
                }
              }
              
              const assistantMessage: ChatMessage = {
                id: `msg-${Date.now()}`,
                role: "assistant",
                content: finalResponse,
                timestamp: Date.now(),
                agentId: selectedAgent.id,
              };

              const finalSession: ChatSession = {
                ...updatedSession,
                messages: [...updatedMessages, assistantMessage],
                updatedAt: Date.now(),
              };

              setSessions((prev) =>
                prev.map((s) => (s.id === finalSession.id ? finalSession : s)),
              );

              await saveSession(finalSession);

              setStreamingContent("");
              setIsGenerating(false);
              window.electronAPI.logInput(finalResponse.trim());
            }
          }
        },
        onError: async (error) => {
          console.error("Stream error:", error);
          // Add error message
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
            prev.map((s) => (s.id === errorSession.id ? errorSession : s)),
          );

          await saveSession(errorSession);
          setStreamingContent("");
          setIsGenerating(false);
        },
      }, isBuilderMode);
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
        prev.map((s) => (s.id === errorSession.id ? errorSession : s)),
      );
      await saveSession(errorSession);
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isMultiAgentMode) {
        sendMultiAgentMessage();
      } else {
        sendMessage();
      }
    }
  };

  // Multi-agent orchestration send
  const sendMultiAgentMessage = async () => {
    if (!input.trim() || selectedMultiAgentIds.length === 0 || isOrchestrating) return;

    const messageContent = input.trim();
    setInput("");
    setIsOrchestrating(true);
    setMultiAgentResponses([]);
    setStreamingContent("");

    // Get selected agents
    const selectedAgents = activeAgents.filter((a) =>
      selectedMultiAgentIds.includes(a.id)
    );

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
      agentId: "multi",
    };

    // Create new session for multi-agent
    const session: ChatSession = {
      id: `session-${Date.now()}`,
      agentId: "multi",
      title: messageContent.slice(0, 40),
      messages: [userMessage],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);

    // Build callbacks for orchestration
    const callbacks: OrchestrationCallbacks = {
      onAgentStart: (agentId, agentName, order, total) => {
        setCurrentOrchestratingAgent(agentName);
        setStreamingContent(`[${order}/${total}] ${agentName} is thinking...`);
      },
      onAgentProgress: (agentId, token) => {
        // Could stream tokens here but keep it simple for now
      },
      onAgentComplete: (agentId, response, duration) => {
        setMultiAgentResponses((prev) => [
          ...prev,
          {
            agentId,
            agentName: activeAgents.find((a) => a.id === agentId)?.name || agentId,
            response,
            timestamp: Date.now(),
            duration,
          },
        ]);
      },
      onAgentError: (agentId, error) => {
        setMultiAgentResponses((prev) => [
          ...prev,
          {
            agentId,
            agentName: activeAgents.find((a) => a.id === agentId)?.name || agentId,
            response: `⚠️ Error: ${error}`,
            timestamp: Date.now(),
            duration: 0,
            error,
          },
        ]);
      },
      onAllComplete: async (result) => {
        // Build combined response
        let combinedContent = "";
        if (result.responses.length > 1) {
          combinedContent = result.responses
            .map((r) => {
              const agent = activeAgents.find((a) => a.id === r.agentId);
              const color = agent ? PROVIDER_INFO[agent.provider]?.color : "#6B7280";
              return `### ${r.agentName}\n\n${r.response}`;
            })
            .join("\n\n---\n\n");
        } else {
          combinedContent = result.responses[0]?.response || "";
        }

        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: combinedContent,
          timestamp: Date.now(),
          agentId: "multi",
        };

        const finalSession: ChatSession = {
          ...session,
          messages: [...session.messages, assistantMessage],
          updatedAt: Date.now(),
        };

        setSessions((prev) =>
          prev.map((s) => (s.id === finalSession.id ? finalSession : s))
        );
        await saveSession(finalSession);

        setStreamingContent("");
        setIsOrchestrating(false);
        setCurrentOrchestratingAgent(null);
      },
      onSynthesisStart: (agentId) => {
        setStreamingContent(`Synthesizing results...`);
      },
    };

    try {
      if (orchestrationMode === "sequential") {
        await AgentOrchestrationService.runSequential(
          selectedAgents,
          messageContent,
          callbacks
        );
      } else if (orchestrationMode === "parallel") {
        await AgentOrchestrationService.runParallel(
          selectedAgents,
          messageContent,
          callbacks
        );
      } else if (orchestrationMode === "collaborative") {
        await AgentOrchestrationService.runCollaborative(
          selectedAgents,
          messageContent,
          3,
          callbacks
        );
      } else if (orchestrationMode === "orchestrator") {
        const [orchestrator, ...workers] = selectedAgents;
        await AgentOrchestrationService.runOrchestrated(
          orchestrator,
          workers,
          messageContent,
          callbacks
        );
      }
    } catch (error) {
      console.error("Orchestration error:", error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: `⚠️ Orchestration error: ${(error as Error).message}`,
        timestamp: Date.now(),
        agentId: "multi",
      };

      const errorSession: ChatSession = {
        ...session,
        messages: [...session.messages, errorMessage],
        updatedAt: Date.now(),
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === errorSession.id ? errorSession : s))
      );
      await saveSession(errorSession);
      setIsOrchestrating(false);
      setCurrentOrchestratingAgent(null);
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
      {/* Main Chat Area - Full height with proper flex layout */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP BAR - Agent selector + Multi + Run buttons */}
        <div className="shrink-0 border-b border-gray-800/50 bg-gray-950/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* Left: Agent Selector */}
            <div className="relative" ref={agentSelectorRef}>
              <button
                onClick={() => setShowAgentSelector(!showAgentSelector)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 rounded-lg transition-colors"
              >
                {selectedAgent && (
                  <>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          PROVIDER_INFO[selectedAgent.provider]?.color || "#6B7280",
                      }}
                    />
                    <span className="text-sm text-gray-200 truncate max-w-[150px]">
                      {selectedAgent.name}
                    </span>
                  </>
                )}
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {/* Agent Dropdown */}
              {showAgentSelector && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                  <div className="p-2">
                    {activeAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setShowAgentSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          selectedAgentId === agent.id
                            ? "bg-indigo-600/20 border border-indigo-500/30"
                            : "hover:bg-gray-800"
                        }`}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: PROVIDER_INFO[agent.provider]?.color || "#6B7280",
                          }}
                        />
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">
                            {agent.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {agent.model}
                          </p>
                        </div>
                        {selectedAgentId === agent.id && (
                          <Check size={14} className="text-indigo-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Center: Multi + Run buttons */}
            <div className="flex items-center gap-2">
              {/* Multi-Agent Toggle */}
              <button
                onClick={() => {
                  if (isMultiAgentMode) {
                    setShowMultiAgentPanel(!showMultiAgentPanel);
                  } else {
                    setIsMultiAgentMode(true);
                    setShowMultiAgentPanel(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isMultiAgentMode
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                }`}
              >
                <Users size={16} />
                <span>Multi</span>
              </button>

              {/* Run Button */}
              <button
                onClick={() => {
                  if (isMultiAgentMode && selectedMultiAgentIds.length > 0) {
                    setShowMultiAgentPanel(false);
                    setTimeout(() => textareaRef.current?.focus(), 100);
                  } else if (isMultiAgentMode) {
                    setShowMultiAgentPanel(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  !isMultiAgentMode
                    ? "bg-gray-800/30 text-gray-500 cursor-not-allowed"
                    : selectedMultiAgentIds.length > 0
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg"
                      : "bg-gray-700/50 text-gray-400 border border-gray-600/50"
                }`}
              >
                <Play size={16} />
                <span>{isMultiAgentMode && selectedMultiAgentIds.length > 0 ? `Run (${selectedMultiAgentIds.length})` : "Run"}</span>
              </button>

              {/* Mode indicator */}
              {isMultiAgentMode && selectedMultiAgentIds.length > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30">
                  <Zap size={12} className="text-purple-400" />
                  <span className="text-xs text-purple-300 font-medium">
                    {orchestrationMode}
                  </span>
                </div>
              )}

              {/* Builder Mode Toggle - Enables system execution capabilities */}
              <button
                onClick={() => {
                  const newMode = !isBuilderMode;
                  setIsBuilderMode(newMode);
                  if (newMode) {
                    builderService.enable();
                    console.log('[Builder] Enabled - system execution active');
                  } else {
                    builderService.disable();
                    console.log('[Builder] Disabled - chat only mode');
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isBuilderMode
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                    : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50"
                }`}
                title={isBuilderMode ? "Builder Mode: ON - System actions enabled" : "Builder Mode: OFF - Chat only"}
              >
                <Settings size={16} className={isBuilderMode ? "animate-spin" : ""} />
                <span>Builder</span>
              </button>
            </div>

            {/* Right: History button */}
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className={`p-2 rounded-lg transition-colors ${
                showHistorySidebar
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <History size={18} />
            </button>
          </div>
        </div>

        {/* MULTI-AGENT SELECTOR BAR - Horizontal panel below top bar */}
        {isMultiAgentMode && (
          <div className="shrink-0 border-b border-gray-800/50 bg-gray-900/95 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="max-w-4xl mx-auto px-4 py-3">
              {/* Agent selection row */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Agents</span>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  {activeAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        if (selectedMultiAgentIds.includes(agent.id)) {
                          setSelectedMultiAgentIds(selectedMultiAgentIds.filter(id => id !== agent.id));
                        } else {
                          setSelectedMultiAgentIds([...selectedMultiAgentIds, agent.id]);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selectedMultiAgentIds.includes(agent.id)
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                          : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: PROVIDER_INFO[agent.provider]?.color || '#6B7280',
                        }}
                      />
                      <span>{agent.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode and Aggregation row */}
              {selectedMultiAgentIds.length > 1 && (
                <div className="flex items-center gap-4">
                  {/* Mode buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Mode</span>
                    <div className="flex gap-1">
                      {(['parallel', 'sequential', 'collaborative', 'orchestrator'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setOrchestrationMode(mode)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            orchestrationMode === mode
                              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                              : 'bg-gray-800/50 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aggregation buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Output</span>
                    <div className="flex gap-1">
                      {([
                        { value: 'concatenate', label: 'Combine' },
                        { value: 'lastWins', label: 'Last' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setAggregationStrategy(opt.value)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            aggregationStrategy === opt.value
                              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                              : 'bg-gray-800/50 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Status row */}
              {selectedMultiAgentIds.length > 0 && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-sm text-purple-300 font-medium">
                      {selectedMultiAgentIds.length} agent{selectedMultiAgentIds.length > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  {selectedMultiAgentIds.length > 1 && (
                    <span className="text-xs text-gray-500">
                      • {orchestrationMode} mode
                    </span>
                  )}
                </div>
              )}

              {/* Builder mode status row */}
              {isBuilderMode && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-orange-500/30">
                  <div className="flex items-center gap-1.5">
                    <Settings size={12} className="text-orange-400 animate-spin" />
                    <span className="text-sm text-orange-300 font-medium">Builder Mode Active</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    • Shell execution enabled
                  </span>
                  <span className="text-xs text-gray-500">
                    • File system access
                  </span>
                  <span className="text-xs text-gray-500">
                    • Network requests
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN CHAT AREA - Centered messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-8 px-6">
            {/* Empty state */}
            {(!activeSession || activeSession.messages.length === 0) && !streamingContent ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-6">
                  {isMultiAgentMode ? (
                    <Users className="size-8 text-purple-400" />
                  ) : (
                    <Bot className="size-8 text-indigo-400" />
                  )}
                </div>
                
                {isMultiAgentMode ? (
                  <>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      Multi-Agent Mode
                    </h2>
                    <p className="text-gray-400 mb-4">
                      {selectedMultiAgentIds.length > 0
                        ? `${selectedMultiAgentIds.length} agents ready in ${orchestrationMode} mode`
                        : "Select agents to begin"}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {selectedAgent?.name || "AI Assistant"}
                    </h2>
                    <p className="text-gray-400 mb-4">
                      {selectedAgent?.model || "Ready to help"}
                    </p>
                  </>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  {["Ask a question", "Write code", "Analyze data", "Create content"].map(
                    (suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(suggestion + "... ")}
                        className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 rounded-lg text-sm transition-colors border border-gray-700/50"
                      >
                        {suggestion}
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : (
              /* Messages */
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
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role !== "user" && (
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Bot size={16} className="text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-800 text-gray-100"
                      }`}
                    >
                      <div className="prose prose-sm prose-invert max-w-none">
                        {message.content}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                        <User size={16} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming content */}
                {streamingContent && (
                  <div className="flex gap-4 justify-start">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Bot size={16} className="text-white" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-800 text-gray-100">
                      <div className="prose prose-sm prose-invert max-w-none">
                        {streamingContent}
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-agent responses */}
                {multiAgentResponses.length > 0 && (
                  <div className="space-y-4">
                    {multiAgentResponses.map((response, index) => (
                      <div key={index} className="flex gap-4 justify-start">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                          <Users size={16} className="text-white" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-800 text-gray-100">
                          <div className="text-xs text-purple-400 mb-1 font-medium">
                            {response.agentName}
                          </div>
                          <div className="prose prose-sm prose-invert max-w-none">
                            {response.response}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loading indicator */}
                {(isGenerating || isOrchestrating) && !streamingContent && multiAgentResponses.length === 0 && (
                  <div className="flex gap-4 justify-start">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-gray-800">
                      <div className="flex items-center gap-2">
                        {isOrchestrating && currentOrchestratingAgent ? (
                          <span className="text-gray-400 text-sm">
                            {currentOrchestratingAgent} is thinking...
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Thinking...</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION - Input + Agent Status */}
        <div className="shrink-0 border-t border-gray-800/50 bg-gray-950/90 backdrop-blur-md">
          {/* Message Input */}
          <div className="max-w-3xl mx-auto p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isMultiAgentMode
                      ? `Message ${selectedMultiAgentIds.length} agents...`
                      : `Message ${selectedAgent?.name || "AI"}...`
                  }
                  className="w-full bg-transparent text-gray-100 placeholder-gray-500 resize-none min-h-[24px] max-h-[150px] px-3 py-2 focus:outline-none"
                  rows={1}
                  disabled={isGenerating || isOrchestrating}
                />
              </div>
              <button
                onClick={isMultiAgentMode ? sendMultiAgentMessage : sendMessage}
                disabled={
                  isMultiAgentMode
                    ? !input.trim() || isOrchestrating || selectedMultiAgentIds.length === 0
                    : !input.trim() || isGenerating
                }
                className={`p-3 rounded-xl transition-all ${
                  isMultiAgentMode
                    ? input.trim() && !isOrchestrating && selectedMultiAgentIds.length > 0
                      ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : input.trim() && !isGenerating
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isGenerating || isOrchestrating ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isMultiAgentMode ? (
                  <Users size={20} />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </div>

          {/* Agent Status Bar - Below input */}
          <MultiAgentPanel
            agents={activeAgents}
            selectedAgentIds={selectedMultiAgentIds}
            orchestrationMode={orchestrationMode}
            isActive={isMultiAgentMode}
            isRunning={isOrchestrating}
            currentAgentName={currentOrchestratingAgent}
          />
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
