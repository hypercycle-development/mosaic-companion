import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  Search,
  X,
  PanelLeft,
} from "lucide-react";
import { INTERNAL_HOME_URL } from "../types/types";

interface TopBarProps {
  currentUrl: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUrl,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const [inputValue, setInputValue] = useState(currentUrl);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Update input only if not focused to allow typing
    if (!isFocused) {
      setInputValue(currentUrl === INTERNAL_HOME_URL ? "" : currentUrl);
    }
  }, [currentUrl, isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let url = inputValue.trim();
      if (!url) return;

      // Basic URL fixing
      if (!url.startsWith("http") && !url.startsWith("browser://")) {
        // If it looks like a domain, prepend https
        if (url.includes(".") && !url.includes(" ")) {
          url = `https://${url}`;
        } else {
          // Otherwise treat as search (simulated)
          url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
      }
      onNavigate(url);
      e.currentTarget.blur();
    }
  };

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 shrink-0 gap-3 z-10 relative">
      {/* Navigation Controls */}
      <div className="flex items-center gap-1 text-gray-400">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 mr-1 rounded-md hover:bg-gray-800 transition-colors text-indigo-400"
            title="Open Sidebar"
          >
            <PanelLeft size={16} />
          </button>
        )}

        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-md hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          onClick={onForward}
          disabled={!canGoForward}
          className="p-1.5 rounded-md hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ArrowRight size={16} />
        </button>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-md hover:bg-gray-800 text-gray-300 transition-colors"
        >
          <RotateCw size={14} />
        </button>
      </div>

      {/* Address Bar */}
      <div
        className={`
        flex-1 h-8 bg-gray-950 rounded-md flex items-center px-3 border transition-all duration-200
        ${
          isFocused
            ? "border-indigo-500/50 ring-1 ring-indigo-500/20"
            : "border-gray-800 hover:border-gray-700"
        }
      `}
      >
        <div className="text-gray-500 mr-2 shrink-0">
          {inputValue.startsWith("https") ? (
            <Lock size={12} />
          ) : (
            <Search size={12} />
          )}
        </div>
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-xs text-gray-300 placeholder-gray-600 font-mono"
          placeholder="Enter URL or command..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {inputValue && isFocused && (
          <button
            onClick={() => setInputValue("")}
            className="text-gray-500 hover:text-gray-300 ml-2"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </header>
  );
};
