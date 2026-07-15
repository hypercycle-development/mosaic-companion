import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Send,
  Paperclip,
  Sparkles,
  StopCircle,
  Bot,
  Users,
} from "lucide-react";
import { INTERNAL_MOSAICBOT_URL } from "../types/types";

interface BottomBarProps {
  onSubmit: (text: string) => void;
  hasAgents: boolean;
  currentUrl?: string; // NEW: active tab URL for context-aware routing
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onSubmit,
  hasAgents,
  currentUrl,
}) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);



  const handleSubmit = async () => {
    if (!input.trim()) return;

    // Log to CSV via Electron IPC
    try {
      await window.electronAPI.logInput(input.trim());
    } catch (error) {
      console.error("Failed to log input:", error);
    }

    // CONTEXT-AWARE DISPATCH:
    // If user is on Mosaic Bot tab → fire CustomEvent for team orchestrator
    // Otherwise → fall back to AI Chat routing (handled by App.tsx)
    const isMosaicBotTab = currentUrl?.startsWith(INTERNAL_MOSAICBOT_URL);
    if (isMosaicBotTab) {
      window.dispatchEvent(
        new CustomEvent("team-message", {
          detail: { text: input.trim(), timestamp: Date.now() },
        })
      );
      setInput("");
      return;
    }

    onSubmit(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const simulateSpeechToText = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    setInput("");
    const phrase =
      "Hey Mosaic, analyze the current webpage for privacy leaks and summarize the key findings for me.";
    let i = 0;

    const interval = setInterval(() => {
      if (i < phrase.length) {
        setInput((prev) => prev + phrase.charAt(i));
        i++;
      } else {
        clearInterval(interval);
        setIsListening(false);
      }
    }, 50); // Typing speed
  };

  return (
    <div className="w-full bg-gray-950 border-t border-gray-800 p-4 shrink-0 z-20">
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        {/* Main AI Indicator */}
        <div className="p-3 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <Bot size={20} />
        </div>

        {/* Main Input Container */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex items-end p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all shadow-lg shadow-black/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MosAIc anything..."
            className="w-full bg-transparent border-none text-gray-100 placeholder-gray-500 resize-none max-h-32 min-h-[24px] p-2 focus:ring-0 outline-none font-sans"
            rows={1}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Big Mic Button - Speech to Text Trigger */}
          <button
            onClick={simulateSpeechToText}
            className={`
                    p-4 rounded-full transition-all duration-300 shadow-lg flex items-center justify-center relative group overflow-hidden
                    ${
                      isListening
                        ? "bg-red-500/20 text-red-500 border border-red-500/50"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105"
                    }
                `}
            title="Talk to Mosaic"
          >
            {/* Ping animation behind mic */}
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></span>
            )}
            {isListening ? <StopCircle size={24} /> : <Mic size={24} />}
          </button>

          {input.length > 0 && (
            <button
              onClick={handleSubmit}
              className="p-3 bg-gray-800 hover:bg-gray-700 text-indigo-400 rounded-full transition-all animate-in zoom-in duration-200 border border-gray-700"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
      <div className="text-center mt-2 flex items-center justify-center gap-2 opacity-50">
        <Sparkles size={10} className="text-indigo-400" />
        <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
          Mosaic AI Engine Active
        </span>
      </div>
    </div>
  );
};
