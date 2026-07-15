import React, { useState, useEffect } from "react";
import { BookOpen, Search, ChevronRight, FileText, Lightbulb, Workflow, Shield, Code } from "lucide-react";

interface VaultEntry {
  id: string;
  label?: string;
  content: string;
  createdAt: number;
}

interface SafePoolVaultPanelProps {
  onClose?: () => void;
}

const ENTRY_ICONS: Record<string, React.ReactNode> = {
  "entry-safe-overview": <BookOpen size={18} />,
  "entry-safe-workflows": <Workflow size={18} />,
  "entry-safe-constraints": <FileText size={18} />,
  "entry-safe-a2a-protocol": <Code size={18} />,
  "entry-safe-settlement": <Shield size={18} />,
  "entry-safe-best-practices": <Lightbulb size={18} />,
  "entry-safe-api-reference": <Code size={18} />,
};

const SafePoolVaultPanel: React.FC<SafePoolVaultPanelProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<VaultEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Load vault entries on mount
  useEffect(() => {
    loadVaultEntries();
  }, []);

  const loadVaultEntries = async () => {
    setLoading(true);
    try {
      // @ts-ignore - electronAPI exposed by preload
      const result = await window.electronAPI?.vault?.getBoxContent?.("safe-rev-pool-operations");
      if (result?.entries) {
        setEntries(result.entries);
      }
    } catch (e) {
      console.warn("[SafePoolVault] Failed to load entries:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = searchQuery
    ? entries.filter(
        (e) =>
          e.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split("\n")
      .map((line, i) => {
        // Headers
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-lg font-bold text-white mb-4 mt-4">
              {line.replace("# ", "")}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-semibold text-cyan-300 mb-2 mt-4">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-medium text-gray-300 mb-1 mt-3">
              {line.replace("### ", "")}
            </h3>
          );
        }
        // List items
        if (line.startsWith("- ") || line.startsWith("1. ") || line.startsWith("2. ")) {
          return (
            <li key={i} className="text-sm text-gray-400 ml-4 mb-1">
              {line.replace(/^(- |\d\. )/, "")}
            </li>
          );
        }
        // Code blocks
        if (line.startsWith("```")) {
          return <div key={i} className="text-xs text-gray-500 italic my-2">Code block...</div>;
        }
        if (line.startsWith("`") && line.endsWith("`")) {
          return (
            <code key={i} className="text-xs bg-gray-800 px-1 rounded text-cyan-300">
              {line.replace(/`/g, "")}
            </code>
          );
        }
        // Empty lines
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        // Regular text
        return (
          <p key={i} className="text-sm text-gray-400 mb-1">
            {line}
          </p>
        );
      });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900/50 rounded-xl border border-green-500/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-green-500/20 bg-gradient-to-r from-green-900/20 to-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚛</span>
            <div>
              <h2 className="text-base font-bold text-white">SAFE Rev Pool Knowledge</h2>
              <p className="text-xs text-gray-500">Agent learning resources</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800"
            >
              Close
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-950 border border-gray-800 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:border-green-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Entry List */}
        <div className="w-64 border-r border-gray-800 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              {searchQuery ? "No matches found" : "No entries available"}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                    selectedEntry?.id === entry.id
                      ? "bg-green-600/20 text-green-300 border border-green-500/30"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {ENTRY_ICONS[entry.id] || <FileText size={16} />}
                    </span>
                    <span className="truncate">{entry.label || entry.id}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry Detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedEntry ? (
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
                <span className="text-gray-500">{ENTRY_ICONS[selectedEntry.id]}</span>
                <h3 className="text-lg font-semibold text-white">{selectedEntry.label}</h3>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                {formatContent(selectedEntry.content)}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
              <BookOpen size={48} className="mb-4 opacity-30" />
              <p className="text-sm">Select an entry to view knowledge</p>
              <p className="text-xs mt-2 max-w-xs">
                This vault contains everything agents need to know about working with the SAFE Rev Pool:
                workflows, protocols, best practices, and API documentation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 bg-gray-950/50 text-xs text-gray-600 flex justify-between">
        <span>SAFE Rev Pool Operations</span>
        <span>{entries.length} knowledge entries</span>
      </div>
    </div>
  );
};

export default SafePoolVaultPanel;