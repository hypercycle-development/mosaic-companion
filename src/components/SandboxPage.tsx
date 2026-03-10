import React, { useEffect, useState, useCallback } from "react";
import {
  Package,
  Play,
  Square,
  Trash2,
  Upload,
  Loader2,
  Shield,
  Globe,
  FileText,
  Server,
  Cpu,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ScrollText,
} from "lucide-react";
import type { ToolManifest, InstalledTool, ChronicleEntry, ChronicleQuery } from "../../electron/integrations/sandbox/types";

// =============================================================================
// Types
// =============================================================================

type TabId = "tools" | "chronicle";

// =============================================================================
// Permission Badge
// =============================================================================

const PermBadge: React.FC<{ label: string; icon: React.ReactNode; items?: string[] }> = ({
  label,
  icon,
  items,
}) => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800 text-xs text-gray-300">
    {icon}
    <span>{label}</span>
    {items && items.length > 0 && (
      <span className="text-gray-500 ml-1">({items.join(", ")})</span>
    )}
  </div>
);

// =============================================================================
// Manifest Preview (shown before install confirmation)
// =============================================================================

const ManifestPreview: React.FC<{
  manifest: ToolManifest;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ manifest, onConfirm, onCancel, loading }) => {
  const toolCount = Object.keys(manifest.tools).length;

  return (
    <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {manifest.displayName}
          </h3>
          <p className="text-sm text-gray-400">
            {manifest.id} v{manifest.version}
            {manifest.author && <> &middot; {manifest.author}</>}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 uppercase tracking-wider">
          {manifest.runtime.type}
        </span>
      </div>

      <p className="text-sm text-gray-300">{manifest.description}</p>

      {/* Permissions */}
      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
          Requested Permissions
        </h4>
        <div className="flex flex-wrap gap-2">
          {manifest.permissions.internet && (
            <PermBadge
              label="Internet"
              icon={<Globe size={12} />}
              items={manifest.permissions.allowed_domains}
            />
          )}
          {manifest.permissions.files.length > 0 && (
            <PermBadge
              label="Files"
              icon={<FileText size={12} />}
              items={manifest.permissions.files}
            />
          )}
          {manifest.permissions.services.length > 0 && (
            <PermBadge
              label="Services"
              icon={<Server size={12} />}
              items={manifest.permissions.services}
            />
          )}
          {!manifest.permissions.internet &&
            manifest.permissions.files.length === 0 &&
            manifest.permissions.services.length === 0 && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Shield size={12} /> No special permissions required
              </span>
            )}
        </div>
      </div>

      {/* Tools */}
      <div className="space-y-1">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium">
          Functions ({toolCount})
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {Object.entries(manifest.tools).map(([name, tool]) => (
            <div
              key={name}
              className="text-sm text-gray-300 bg-gray-800/50 px-3 py-1.5 rounded"
            >
              <span className="text-indigo-400 font-mono">{name}</span>
              <span className="text-gray-500 ml-2">{tool.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div className="text-xs text-gray-500">
        Memory limit: {manifest.resources.memory} &middot; Timeout:{" "}
        {manifest.resources.timeout}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Package size={14} />
          )}
          Install Tool
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Tool Card (installed tool)
// =============================================================================

const ToolCard: React.FC<{
  tool: InstalledTool;
  isRunning: boolean;
  onLaunch: (id: string) => void;
  onStop: (id: string) => void;
  onUninstall: (id: string) => void;
  busy: boolean;
}> = ({ tool, isRunning, onLaunch, onStop, onUninstall, busy }) => {
  const [expanded, setExpanded] = useState(false);
  const m = tool.manifest;
  const toolCount = Object.keys(m.tools).length;

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-white"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <Cpu size={20} className="text-indigo-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {m.displayName}
            </h3>
            <span className="text-xs text-gray-500">v{m.version}</span>
            {isRunning && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300">
                Running
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{m.description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isRunning ? (
            <button
              onClick={() => onStop(m.id)}
              disabled={busy}
              className="p-1.5 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 disabled:opacity-50"
              title="Stop"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Square size={16} />
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => onLaunch(m.id)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-emerald-900/40 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                title="Launch"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
              </button>
              <button
                onClick={() => onUninstall(m.id)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 disabled:opacity-50"
                title="Uninstall"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-3">
          {/* Permissions */}
          <div className="flex flex-wrap gap-2">
            {m.permissions.internet && (
              <PermBadge
                label="Internet"
                icon={<Globe size={12} />}
                items={m.permissions.allowed_domains}
              />
            )}
            {m.permissions.files.length > 0 && (
              <PermBadge label="Files" icon={<FileText size={12} />} items={m.permissions.files} />
            )}
            {m.permissions.services.length > 0 && (
              <PermBadge label="Services" icon={<Server size={12} />} items={m.permissions.services} />
            )}
            {!m.permissions.internet &&
              m.permissions.files.length === 0 &&
              m.permissions.services.length === 0 && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Shield size={12} /> No special permissions
                </span>
              )}
          </div>

          {/* Functions */}
          <div className="space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Functions ({toolCount})
            </span>
            {Object.entries(m.tools).map(([name, fn]) => (
              <div
                key={name}
                className="text-xs bg-gray-800/50 px-3 py-1.5 rounded text-gray-300"
              >
                <span className="text-indigo-400 font-mono">{name}</span>
                <span className="text-gray-500 ml-2">{fn.description}</span>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-600">
            Installed {new Date(tool.installedAt).toLocaleDateString()} &middot;
            Memory: {m.resources.memory} &middot; Timeout: {m.resources.timeout}
            {m.author && <> &middot; Author: {m.author}</>}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Chronicle Viewer
// =============================================================================

const ChronicleViewer: React.FC<{ tools: InstalledTool[] }> = ({ tools }) => {
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [entries, setEntries] = useState<ChronicleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasEntries, setHasEntries] = useState<Record<string, boolean>>({});

  // Check which tools have chronicle entries
  useEffect(() => {
    const check = async () => {
      const results: Record<string, boolean> = {};
      for (const t of tools) {
        const res = await window.electronAPI.chronicle.hasEntries(t.manifest.id);
        if (res.success && res.data) results[t.manifest.id] = true;
      }
      setHasEntries(results);
    };
    check();
  }, [tools]);

  const loadEntries = useCallback(async (toolId: string) => {
    setSelectedTool(toolId);
    setLoading(true);
    try {
      const res = await window.electronAPI.chronicle.read(toolId, { limit: 200 });
      if (res.success && res.data) {
        setEntries(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const typeColors: Record<string, string> = {
    log: "text-blue-400",
    output: "text-emerald-400",
    audit: "text-amber-400",
    lifecycle: "text-purple-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={selectedTool}
          onChange={(e) => e.target.value && loadEntries(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Select a tool…</option>
          {tools.map((t) => (
            <option key={t.manifest.id} value={t.manifest.id}>
              {t.manifest.displayName}
              {hasEntries[t.manifest.id] ? " ●" : ""}
            </option>
          ))}
        </select>
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>

      {selectedTool && entries.length === 0 && !loading && (
        <p className="text-sm text-gray-500">No chronicle entries for this tool.</p>
      )}

      {entries.length > 0 && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-gray-800/50 rounded px-3 py-2 text-xs font-mono border border-gray-800"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-600">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className={typeColors[entry.type] ?? "text-gray-400"}>
                  [{entry.type}]
                </span>
                <span className="text-gray-500">{entry.source}</span>
              </div>
              <pre className="text-gray-300 whitespace-pre-wrap break-all">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main SandboxPage
// =============================================================================

export const SandboxPage: React.FC = () => {
  const [tab, setTab] = useState<TabId>("tools");
  const [installed, setInstalled] = useState<InstalledTool[]>([]);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyTools, setBusyTools] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Install flow state
  const [pendingManifest, setPendingManifest] = useState<ToolManifest | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  // WASM runtime availability
  const [available, setAvailable] = useState(true);

  // ─── Data Loading ────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const [installedRes, runningRes] = await Promise.all([
        window.electronAPI.toolSandbox.listInstalled(),
        window.electronAPI.toolSandbox.listRunning(),
      ]);
      if (installedRes.success && installedRes.data) {
        setInstalled(installedRes.data);
      }
      if (runningRes.success && runningRes.data) {
        setRunningIds(new Set(runningRes.data.map((r: RunningToolInfo) => r.toolId)));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAvail = async () => {
      const res = await window.electronAPI.toolSandbox.isAvailable();
      if (res.success) setAvailable(res.data ?? false);
    };
    checkAvail();
    refresh();
  }, [refresh]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const handlePickFile = async () => {
    setError(null);
    const filePath = await window.electronAPI.dialog.openFile({
      filters: [{ name: "WebAssembly", extensions: ["wasm"] }],
    });
    if (!filePath) return;

    // For now we install directly — manifest preview requires extractManifest IPC
    // which we'll get from the install result
    setPendingPath(filePath);
    setInstalling(true);
    try {
      const res = await window.electronAPI.toolSandbox.install(filePath);
      if (res.success && res.data) {
        setPendingManifest(res.data.manifest);
        setPendingPath(null);
        setInstalling(false);
        await refresh();
      } else {
        setError(res.error ?? "Failed to install tool");
        setInstalling(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setInstalling(false);
    }
    setPendingManifest(null);
  };

  const handleLaunch = async (toolId: string) => {
    setError(null);
    setBusyTools((s) => new Set(s).add(toolId));
    try {
      const res = await window.electronAPI.toolSandbox.launch(toolId);
      if (!res.success) setError(res.error ?? "Failed to launch tool");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTools((s) => {
        const next = new Set(s);
        next.delete(toolId);
        return next;
      });
    }
  };

  const handleStop = async (toolId: string) => {
    setError(null);
    setBusyTools((s) => new Set(s).add(toolId));
    try {
      const res = await window.electronAPI.toolSandbox.stop(toolId);
      if (!res.success) setError(res.error ?? "Failed to stop tool");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTools((s) => {
        const next = new Set(s);
        next.delete(toolId);
        return next;
      });
    }
  };

  const handleUninstall = async (toolId: string) => {
    setError(null);
    setBusyTools((s) => new Set(s).add(toolId));
    try {
      const res = await window.electronAPI.toolSandbox.uninstall(toolId);
      if (!res.success) setError(res.error ?? "Failed to uninstall tool");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTools((s) => {
        const next = new Set(s);
        next.delete(toolId);
        return next;
      });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu size={24} className="text-indigo-400" />
            Tool Sandbox
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Install, manage, and monitor WASM-sandboxed tools
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!available && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle size={14} /> WASM runtime unavailable
            </span>
          )}
          <button
            onClick={handlePickFile}
            disabled={!available || installing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {installing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Install .wasm Tool
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 border border-red-800 bg-red-950/50 rounded-lg text-sm text-red-300">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        <button
          onClick={() => setTab("tools")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "tools"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <Package size={14} className="inline mr-1.5 -mt-0.5" />
          Installed Tools ({installed.length})
        </button>
        <button
          onClick={() => setTab("chronicle")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "chronicle"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-300"
          }`}
        >
          <ScrollText size={14} className="inline mr-1.5 -mt-0.5" />
          Chronicle
        </button>
      </div>

      {/* Tab Content */}
      {tab === "tools" && (
        <div className="space-y-3">
          {installed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Package size={48} className="mb-4 text-gray-700" />
              <p className="text-lg">No tools installed yet</p>
              <p className="text-sm mt-1">
                Click &quot;Install .wasm Tool&quot; to add your first sandboxed tool.
              </p>
            </div>
          ) : (
            installed.map((tool) => (
              <ToolCard
                key={tool.manifest.id}
                tool={tool}
                isRunning={runningIds.has(tool.manifest.id)}
                onLaunch={handleLaunch}
                onStop={handleStop}
                onUninstall={handleUninstall}
                busy={busyTools.has(tool.manifest.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "chronicle" && <ChronicleViewer tools={installed} />}
    </div>
  );
};
