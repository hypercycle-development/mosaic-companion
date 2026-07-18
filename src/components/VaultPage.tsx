import React, { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Lock,
  Package,
  Bot,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  FileText,
  AlignLeft,
} from "lucide-react";
import { AIAgentConfig, PROVIDER_INFO } from "../types/ai";

// =============================================================================
// Types (mirrors electron/integrations/vault/types.ts)
// =============================================================================

type BoxSourceType = "manual" | "import" | "connector";

interface VaultBox {
  id: string;
  name: string;
  description?: string;
  sourceType: BoxSourceType;
  createdAt: number;
  updatedAt: number;
}

interface VaultEntry {
  id: string;
  label?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

const SOURCE_LABELS: Record<BoxSourceType, { label: string; color: string }> = {
  manual: { label: "Manual", color: "text-gray-400" },
  import: { label: "Import", color: "text-blue-400" },
  connector: { label: "Connector", color: "text-emerald-400" },
};

// =============================================================================
// Add / Edit Box Form
// =============================================================================

const BoxForm: React.FC<{
  initial?: { name: string; description: string; sourceType: BoxSourceType };
  onSubmit: (data: {
    name: string;
    description: string;
    sourceType: BoxSourceType;
  }) => void;
  onCancel: () => void;
  submitLabel: string;
}> = ({ initial, onSubmit, onCancel, submitLabel }) => {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sourceType, setSourceType] = useState<BoxSourceType>(
    initial?.sourceType ?? "manual",
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), sourceType });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-4"
    >
      <div>
        <label className="block text-sm text-gray-400 mb-1">Box Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 text-sm"
          placeholder="e.g. Alice's Emails"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 text-sm"
          placeholder="What does this box contain?"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Source Type</label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as BoxSourceType)}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="manual">Manual — User-added content</option>
          <option value="import">Import — One-time bulk import</option>
          <option value="connector">Connector — Ongoing input</option>
        </select>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded-lg transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-1.5"
        >
          <Check size={14} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

// =============================================================================
// Agent Access Panel (per-box)
// =============================================================================

const AgentAccessPanel: React.FC<{
  box: VaultBox;
  agents: AIAgentConfig[];
  onToggleAccess: (agentId: string, hasAccess: boolean) => void;
}> = ({ box, agents, onToggleAccess }) => {
  if (agents.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500 italic">
        No agents configured. Add agents in AI Chat settings first.
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 pb-3">
      {agents.map((agent) => {
        const hasAccess = agent.boxAccess?.includes(box.id) ?? false;
        const providerColor = PROVIDER_INFO[agent.provider]?.color ?? "#6B7280";

        return (
          <button
            key={agent.id}
            onClick={() => onToggleAccess(agent.id, hasAccess)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
              hasAccess
                ? "bg-indigo-900/15 border border-indigo-500/20"
                : "hover:bg-gray-800/50 border border-transparent"
            }`}
          >
            {/* Agent color dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: providerColor,
                boxShadow: hasAccess ? `0 0 6px ${providerColor}` : "none",
              }}
            />

            {/* Agent name & model */}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-200 block truncate">
                {agent.name}
              </span>
              <span className="text-[10px] text-gray-500 font-mono truncate block">
                {agent.model}
              </span>
            </div>

            {/* Access toggle */}
            <div
              className={`w-8 h-1.5 rounded-full transition-colors duration-200 relative shrink-0 ${
                hasAccess ? "bg-indigo-900" : "bg-gray-800"
              }`}
            >
              <div
                className={`absolute -top-1 w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200 ${
                  hasAccess
                    ? "left-[18px] bg-indigo-500"
                    : "left-0 bg-gray-600"
                }`}
                style={
                  hasAccess
                    ? {
                        boxShadow:
                          "0 0 8px color-mix(in srgb, var(--primary, #6366f1) 60%, transparent)",
                      }
                    : {}
                }
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// =============================================================================
// Box Content Panel
// =============================================================================

const BoxContentPanel: React.FC<{ box: VaultBox; onEntryCountChange: (count: number) => void }> = ({
  box,
  onEntryCountChange,
}) => {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    const loaded = await window.electronAPI?.vault?.getBoxContent(box.id) ?? [];
    setEntries(loaded);
    onEntryCountChange(loaded.length);
    setIsLoading(false);
  }, [box.id, onEntryCountChange]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSaving(true);
    setError(null);
    const result = await window.electronAPI?.vault?.addEntry(box.id, {
      content: content.trim(),
      label: label.trim() || undefined,
    });
    if (result?.success) {
      setContent("");
      setLabel("");
      setShowForm(false);
      loadEntries();
    } else {
      setError(result?.error ?? "Failed to add entry");
    }
    setIsSaving(false);
  };

  const handleDelete = async (entryId: string) => {
    const result = await window.electronAPI?.vault?.deleteEntry(box.id, entryId);
    if (result?.success) loadEntries();
  };

  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 size={18} className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 space-y-2">
      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border border-red-900/40 rounded-lg flex items-center gap-2">
          <X size={12} className="text-red-400 cursor-pointer" onClick={() => setError(null)} />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Entry list */}
      {entries.length === 0 && !showForm ? (
        <div className="text-center py-6 text-gray-600">
          <AlignLeft size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">No entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group p-3 bg-gray-950/60 border border-gray-800 rounded-lg relative"
            >
              {entry.label && (
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {entry.label}
                </p>
              )}
              <p className="text-xs text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                {entry.content}
              </p>
              <p className="text-[9px] text-gray-600 mt-1.5">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
              <button
                onClick={() => handleDelete(entry.id)}
                className="absolute top-2 right-2 p-1 text-gray-700 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                title="Delete entry"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add entry form */}
      {showForm ? (
        <form onSubmit={handleAdd} className="space-y-2 p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-gray-100 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Label (optional)"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-gray-100 text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            placeholder="Enter content..."
            rows={4}
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowForm(false); setLabel(""); setContent(""); setError(null); }}
              className="px-2.5 py-1 text-gray-400 hover:text-gray-200 rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isSaving}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-xs font-medium flex items-center gap-1"
            >
              {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Add
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-200 hover:bg-gray-800/50 border border-dashed border-gray-800 rounded-lg text-xs transition-all"
        >
          <Plus size={12} />
          Add Entry
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Single Box Card
// =============================================================================

const BoxCard: React.FC<{
  box: VaultBox;
  agents: AIAgentConfig[];
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    updates: { name?: string; description?: string; sourceType?: BoxSourceType },
  ) => void;
  onToggleAgentAccess: (agentId: string, boxId: string, hasAccess: boolean) => void;
}> = ({ box, agents, onDelete, onUpdate, onToggleAgentAccess }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "access">("content");
  const [entryCount, setEntryCount] = useState(0);

  const sourceInfo = SOURCE_LABELS[box.sourceType] ?? {
    label: "Unknown",
    color: "text-gray-500",
  };
  const accessCount = agents.filter(
    (a) => a.boxAccess?.includes(box.id),
  ).length;

  if (isEditing) {
    return (
      <BoxForm
        initial={{
          name: box.name,
          description: box.description ?? "",
          sourceType: box.sourceType,
        }}
        submitLabel="Save"
        onCancel={() => setIsEditing(false)}
        onSubmit={(data) => {
          onUpdate(box.id, data);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden transition-all">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Package size={20} className="text-indigo-400" />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">
            {box.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-mono ${sourceInfo.color}`}>
              {sourceInfo.label}
            </span>
            <span className="text-[10px] text-gray-600">·</span>
            <span className="text-[10px] text-gray-500">
              {new Date(box.createdAt).toLocaleDateString()}
            </span>
            {accessCount > 0 && (
              <>
                <span className="text-[10px] text-gray-600">·</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Bot size={10} />
                  {accessCount} agent{accessCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {entryCount > 0 && (
              <>
                <span className="text-[10px] text-gray-600">·</span>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <FileText size={10} />
                  {entryCount} entr{entryCount !== 1 ? "ies" : "y"}
                </span>
              </>
            )}
          </div>
          {box.description && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {box.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            title="Agent access"
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
            title="Edit box"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => onDelete(box.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete box"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expandable panel */}
      {isExpanded && (
        <div className="border-t border-gray-800">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === "content"
                  ? "text-indigo-400 border-b-2 border-indigo-500"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <FileText size={10} />
              Content
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === "access"
                  ? "text-indigo-400 border-b-2 border-indigo-500"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <Shield size={10} />
              Agent Access
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "content" ? (
            <BoxContentPanel box={box} onEntryCountChange={setEntryCount} />
          ) : (
            <AgentAccessPanel
              box={box}
              agents={agents}
              onToggleAccess={(agentId, hasAccess) =>
                onToggleAgentAccess(agentId, box.id, hasAccess)
              }
            />
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Vault Page
// =============================================================================

export const VaultPage: React.FC = () => {
  const [boxes, setBoxes] = useState<VaultBox[]>([]);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [loadedBoxes, loadedAgents] = await Promise.all([
        window.electronAPI?.vault?.getBoxes() ?? [],
        window.electronAPI?.aiAgents?.get() ?? [],
      ]);
      setBoxes(loadedBoxes);
      setAgents(loadedAgents);
    } catch (err) {
      console.error("[VaultPage] Failed to load:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleAddBox = async (data: {
    name: string;
    description: string;
    sourceType: BoxSourceType;
  }) => {
    setError(null);
    const result = await window.electronAPI?.vault?.addBox(data);
    if (result?.success) {
      setShowAddForm(false);
      loadData();
    } else {
      setError(result?.error ?? "Failed to create box");
    }
  };

  const handleUpdateBox = async (
    id: string,
    updates: { name?: string; description?: string; sourceType?: BoxSourceType },
  ) => {
    setError(null);
    const result = await window.electronAPI?.vault?.updateBox(id, updates);
    if (result?.success) {
      loadData();
    } else {
      setError(result?.error ?? "Failed to update box");
    }
  };

  const handleDeleteBox = async (id: string) => {
    const box = boxes.find((b) => b.id === id);
    if (
      !window.confirm(
        `Delete box "${box?.name}"? This cannot be undone.`,
      )
    )
      return;

    setError(null);
    const result = await window.electronAPI?.vault?.deleteBox(id);
    if (result?.success) {
      loadData();
    } else {
      setError(result?.error ?? "Failed to delete box");
    }
  };

  // ── Agent access toggle ────────────────────────────────────────────────────
  const handleToggleAgentAccess = async (
    agentId: string,
    boxId: string,
    currentlyHasAccess: boolean,
  ) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;

    const currentAccess = agent.boxAccess ?? [];
    const newAccess = currentlyHasAccess
      ? currentAccess.filter((id) => id !== boxId)
      : [...currentAccess, boxId];

    const result = await window.electronAPI?.aiAgents?.update(agentId, {
      boxAccess: newAccess,
    });
    if (result?.success) {
      loadData();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-gray-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Lock size={22} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Vault
            </h1>
            <p className="text-sm text-gray-500">
              Organize your data into named boxes and control agent access
            </p>
          </div>
        </div>

        {!showAddForm && (
          <button
            onClick={() => {
              setShowAddForm(true);
              setError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors text-sm"
          >
            <Plus size={16} />
            New Box
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-900/40 rounded-lg flex items-center gap-2">
          <X
            size={14}
            className="text-red-400 cursor-pointer shrink-0"
            onClick={() => setError(null)}
          />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Add Box Form */}
      {showAddForm && (
        <BoxForm
          submitLabel="Create Box"
          onCancel={() => {
            setShowAddForm(false);
            setError(null);
          }}
          onSubmit={handleAddBox}
        />
      )}

      {/* Boxes List */}
      {boxes.length === 0 && !showAddForm ? (
        <div className="text-center py-16 border border-dashed border-gray-700 rounded-xl">
          <Package className="mx-auto size-14 text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">
            No boxes yet
          </h3>
          <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
            Boxes are named containers for your data. Create one and then assign
            agent access to control what each AI agent can see.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg transition-colors text-sm"
          >
            <Plus size={16} />
            Create your first box
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {boxes.map((box) => (
            <BoxCard
              key={box.id}
              box={box}
              agents={agents}
              onDelete={handleDeleteBox}
              onUpdate={handleUpdateBox}
              onToggleAgentAccess={handleToggleAgentAccess}
            />
          ))}
        </div>
      )}

      {/* Info footer */}
      {boxes.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-gray-600">
            {boxes.length} box{boxes.length !== 1 ? "es" : ""} · Click the arrow on any box to manage agent access
          </p>
        </div>
      )}
    </div>
  );
};
