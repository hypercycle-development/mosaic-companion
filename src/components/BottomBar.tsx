import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Send,
  Paperclip,
  Sparkles,
  StopCircle,
  Bot,
  Globe,
  ChevronDown,
} from "lucide-react";

export type InputMode = "agent" | "normal";

interface BottomBarProps {
  onSubmit: (text: string) => void;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  hasAgents: boolean;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onSubmit,
  mode,
  onModeChange,
  hasAgents,
}) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    // Log to CSV via Electron IPC
    try {
      await window.electronAPI.logInput(input.trim());
    } catch (error) {
      console.error("Failed to log input:", error);
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
        {/* Mode Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className={`p-3 rounded-full transition-colors flex items-center gap-1 ${
              mode === "agent"
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-300"
            }`}
            title={mode === "agent" ? "AI Agent Mode" : "Normal Mode"}
          >
            {mode === "agent" ? <Bot size={20} /> : <Globe size={20} />}
            <ChevronDown size={14} />
          </button>

          {showModeDropdown && (
            <div className="absolute bottom-full left-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
              <button
                onClick={() => {
                  if (hasAgents) {
                    onModeChange("agent");
                  }
                  setShowModeDropdown(false);
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                  mode === "agent"
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-gray-300 hover:bg-gray-800"
                } ${!hasAgents ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={!hasAgents}
              >
                <Bot size={18} />
                <div className="text-left">
                  <div className="text-sm font-medium">AI Agent</div>
                  {!hasAgents && (
                    <div className="text-xs text-gray-500">
                      No agents configured
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() => {
                  onModeChange("normal");
                  setShowModeDropdown(false);
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                  mode === "normal"
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <Globe size={18} />
                <div className="text-sm font-medium">Normal</div>
              </button>
            </div>
          )}
        </div>

        {/* Main Input Container */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex items-end p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all shadow-lg shadow-black/20">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "agent" ? "Ask AI Agent..." : "Ask Mosaic anything..."
            }
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
