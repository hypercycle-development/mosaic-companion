import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Bot, User, Loader2, X } from "lucide-react";
import type { AIAgentConfig } from "../../types/ai";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIAssistPanelProps {
  activeFilePath: string | null;
  activeFileContent: string | null;
  projectPath: string | null;
  onClose: () => void;
}

export default function AIAssistPanel({
  activeFilePath,
  activeFileContent,
  projectPath,
  onClose,
}: AIAssistPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.electronAPI.aiAgents.get().then((a) => {
      setAgents(a);
      const active = a.find((ag: AIAgentConfig) => ag.isActive);
      if (active) setSelectedAgentId(active.id);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildSystemPrompt = useCallback(() => {
    let prompt =
      "You are a coding assistant integrated into an IDE. Be concise. When showing code, use fenced code blocks with the language.";
    if (activeFilePath) {
      prompt += `\n\nThe user currently has open: ${activeFilePath}`;
    }
    if (activeFileContent) {
      const truncated =
        activeFileContent.length > 4000
          ? activeFileContent.slice(0, 4000) + "\n... (truncated)"
          : activeFileContent;
      prompt += `\n\nFile content:\n\`\`\`\n${truncated}\n\`\`\``;
    }
    return prompt;
  }, [activeFilePath, activeFileContent]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const agent = agents.find((a) => a.id === selectedAgentId) ?? agents.find((a) => a.isActive);
      if (!agent) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No AI agent configured. Please add one in Settings." },
        ]);
        setLoading(false);
        return;
      }

      // Use the renderer-side AIService approach: call via agent send or direct IPC
      // For simplicity, use the MosaicBot agent:send IPC which calls callActiveLLM in main process
      const allMessages = [...messages, userMsg];
      const conversationText = allMessages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const systemPrompt = buildSystemPrompt();
      const fullPrompt = `${systemPrompt}\n\nConversation:\n${conversationText}\n\nRespond to the user's latest message.`;

      const result = await window.agent?.send(fullPrompt);
      const reply = result?.text ?? "No response from agent.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err?.message ?? "Failed to get response"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, agents, selectedAgentId, buildSystemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            AI Assist
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300"
        >
          <X size={12} />
        </button>
      </div>

      {/* Agent selector */}
      {agents.length > 1 && (
        <div className="px-3 py-1.5 border-b border-gray-800">
          <select
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
            value={selectedAgentId ?? ""}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isActive ? "(active)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-gray-600 text-center mt-8">
            Ask about the code, request changes, or get explanations.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-shrink-0 mt-0.5">
              {msg.role === "user" ? (
                <User size={14} className="text-gray-500" />
              ) : (
                <Bot size={14} className="text-blue-400" />
              )}
            </div>
            <div
              className={`text-sm whitespace-pre-wrap break-words ${
                msg.role === "user" ? "text-gray-300" : "text-gray-200"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 items-center text-gray-500 text-sm">
            <Loader2 size={14} className="animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500"
            placeholder="Ask about code..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
