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
  LayoutDashboard,
  CheckSquare,
  Pin,
  PinOff,
  KeyRound,
  Check,
  X,
} from "lucide-react";
import type { ToolManifest, InstalledTool, ChronicleEntry, ChronicleQuery, ApprovalRecord } from "../../electron/integrations/sandbox/types";
import { INTERNAL_TOOL_PANEL_PREFIX } from "../types/types";
// import { ToolUIDemo } from "./ToolUIDemo"; // kept for reference — will reuse in WASM tool

// =============================================================================
// Types
// =============================================================================

type TabId = "tools" | "chronicle";

interface PendingToolReview {
  manifest: ToolManifest;
  wasmPath: string;
  fileHash: string;
  existingTool?: InstalledTool;
}

interface ListDiff {
  added: string[];
  removed: string[];
}

interface UpdateDiff {
  versionChanged: boolean;
  hashChanged: boolean;
  internetChanged: boolean;
  addedDomains: string[];
  removedDomains: string[];
  addedFiles: string[];
  removedFiles: string[];
  addedServices: string[];
  removedServices: string[];
  addedFunctions: string[];
  removedFunctions: string[];
  changedFunctions: string[];
  addedPanels: string[];
  removedPanels: string[];
  changedPanels: string[];
  memoryChanged: boolean;
  timeoutChanged: boolean;
}

const uniqueSorted = (items: string[] = []): string[] => Array.from(new Set(items)).sort();

const diffLists = (current: string[] = [], incoming: string[] = []): ListDiff => {
  const currentSet = new Set(uniqueSorted(current));
  const incomingSet = new Set(uniqueSorted(incoming));

  return {
    added: Array.from(incomingSet).filter((item) => !currentSet.has(item)),
    removed: Array.from(currentSet).filter((item) => !incomingSet.has(item)),
  };
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
};

const getUpdateDiff = (current: InstalledTool, incoming: PendingToolReview): UpdateDiff => {
  const currentManifest = current.manifest;
  const incomingManifest = incoming.manifest;

  const domains = diffLists(currentManifest.permissions.allowed_domains, incomingManifest.permissions.allowed_domains);
  const files = diffLists(currentManifest.permissions.files, incomingManifest.permissions.files);
  const services = diffLists(currentManifest.permissions.services, incomingManifest.permissions.services);

  const currentTools = currentManifest.tools;
  const incomingTools = incomingManifest.tools;
  const currentToolNames = Object.keys(currentTools);
  const incomingToolNames = Object.keys(incomingTools);
  const toolNames = diffLists(currentToolNames, incomingToolNames);
  const changedFunctions = currentToolNames
    .filter((name) => name in incomingTools)
    .filter((name) => stableSerialize(currentTools[name]) !== stableSerialize(incomingTools[name]))
    .sort();

  const currentPanels = Object.fromEntries((currentManifest.ui?.panels ?? []).map((panel) => [panel.id, panel]));
  const incomingPanels = Object.fromEntries((incomingManifest.ui?.panels ?? []).map((panel) => [panel.id, panel]));
  const currentPanelIds = Object.keys(currentPanels);
  const incomingPanelIds = Object.keys(incomingPanels);
  const panelNames = diffLists(currentPanelIds, incomingPanelIds);
  const changedPanels = currentPanelIds
    .filter((id) => id in incomingPanels)
    .filter((id) => stableSerialize(currentPanels[id]) !== stableSerialize(incomingPanels[id]))
    .sort();

  return {
    versionChanged: currentManifest.version !== incomingManifest.version,
    hashChanged: current.fileHash !== incoming.fileHash,
    internetChanged: currentManifest.permissions.internet !== incomingManifest.permissions.internet,
    addedDomains: domains.added,
    removedDomains: domains.removed,
    addedFiles: files.added,
    removedFiles: files.removed,
    addedServices: services.added,
    removedServices: services.removed,
    addedFunctions: toolNames.added,
    removedFunctions: toolNames.removed,
    changedFunctions,
    addedPanels: panelNames.added,
    removedPanels: panelNames.removed,
    changedPanels,
    memoryChanged: currentManifest.resources.memory !== incomingManifest.resources.memory,
    timeoutChanged: currentManifest.resources.timeout !== incomingManifest.resources.timeout,
  };
};

const diffCount = (diff: UpdateDiff): number => {
  return [
    diff.versionChanged,
    diff.hashChanged,
    diff.internetChanged,
    diff.memoryChanged,
    diff.timeoutChanged,
  ].filter(Boolean).length +
    diff.addedDomains.length +
    diff.removedDomains.length +
    diff.addedFiles.length +
    diff.removedFiles.length +
    diff.addedServices.length +
    diff.removedServices.length +
    diff.addedFunctions.length +
    diff.removedFunctions.length +
    diff.changedFunctions.length +
    diff.addedPanels.length +
    diff.removedPanels.length +
    diff.changedPanels.length;
};

const ChangeList: React.FC<{ title: string; items: string[]; tone: "added" | "removed" | "changed" }> = ({
  title,
  items,
  tone,
}) => {
  if (items.length === 0) {
    return null;
  }

  const styles = {
    added: "border-emerald-800/60 bg-emerald-950/20 text-emerald-200",
    removed: "border-red-800/60 bg-red-950/20 text-red-200",
    changed: "border-amber-800/60 bg-amber-950/20 text-amber-200",
  };

  return (
    <div className={`rounded-lg border p-3 ${styles[tone]}`}>
      <div className="text-xs uppercase tracking-wider mb-2">{title}</div>
      <ul className="space-y-1 text-xs">
        {items.map((item) => (
          <li key={item} className="font-mono break-all">- {item}</li>
        ))}
      </ul>
    </div>
  );
};

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
  review: PendingToolReview;
  approved: boolean;
  onApprovalChange: (approved: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ review, approved, onApprovalChange, onConfirm, onCancel, loading }) => {
  const { manifest, wasmPath, fileHash, existingTool } = review;
  const toolCount = Object.keys(manifest.tools).length;
  const domains = manifest.permissions.allowed_domains ?? [];
  const fileAccess = manifest.permissions.files ?? [];
  const services = manifest.permissions.services ?? [];
  const hasSpecialPerms =
    manifest.permissions.internet || domains.length > 0 || fileAccess.length > 0 || services.length > 0;
  const isUpdate = Boolean(existingTool);
  const updateDiff = existingTool ? getUpdateDiff(existingTool, review) : null;
  const updateDiffCount = updateDiff ? diffCount(updateDiff) : 0;

  return (
    <div className="p-4 bg-gray-900/50 border border-amber-700/50 rounded-xl space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-800 bg-amber-950/30 text-amber-200 text-sm">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Review requested capabilities before {isUpdate ? "update" : "install"}</p>
          <p className="text-amber-300/80 mt-0.5">
            This tool can run code in the sandbox and call host functions based on this manifest.
            {isUpdate
              ? " Updating will replace the stored binary and relaunch the tool if it is currently running."
              : " Install only if you trust the source."}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {manifest.displayName}
          </h3>
          <p className="text-sm text-gray-400">
            {manifest.id} v{manifest.version}
            {manifest.author && <> &middot; {manifest.author}</>}
          </p>
          <p className="text-xs text-gray-500 mt-1 break-all">{wasmPath}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 uppercase tracking-wider">
          {manifest.runtime.type}
        </span>
      </div>

      <p className="text-sm text-gray-300">{manifest.description}</p>

      {existingTool && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Current</div>
              <div className="text-sm text-gray-200">Version: v{existingTool.manifest.version}</div>
              <div className="text-xs text-gray-400 mt-1 font-mono">
                Hash: {existingTool.fileHash?.slice(0, 12) ?? "unknown"}...
              </div>
            </div>
            <div className="rounded-lg border border-indigo-800 bg-indigo-950/20 p-3">
              <div className="text-xs uppercase tracking-wider text-indigo-300 mb-2">Incoming</div>
              <div className="text-sm text-gray-100">Version: v{manifest.version}</div>
              <div className="text-xs text-gray-300 mt-1 font-mono">
                Hash: {fileHash.slice(0, 12)}...
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium">Update Changes</h4>
                <p className="text-sm text-gray-300 mt-1">
                  {updateDiffCount > 0
                    ? `${updateDiffCount} manifest change${updateDiffCount === 1 ? "" : "s"} detected in this update.`
                    : "No manifest capability changes detected. This looks like a binary-only refresh."}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                {updateDiff?.versionChanged ? "Version changed" : "Same version"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Runtime</div>
                <div className="text-gray-200">
                  Internet: {existingTool.manifest.permissions.internet ? "allowed" : "denied"}
                  {updateDiff?.internetChanged && (
                    <span className="text-amber-300">{" -> "}{manifest.permissions.internet ? "allowed" : "denied"}</span>
                  )}
                </div>
                <div className="text-gray-200 mt-1">
                  Memory: {existingTool.manifest.resources.memory}
                  {updateDiff?.memoryChanged && <span className="text-amber-300">{" -> "}{manifest.resources.memory}</span>}
                </div>
                <div className="text-gray-200 mt-1">
                  Timeout: {existingTool.manifest.resources.timeout}
                  {updateDiff?.timeoutChanged && <span className="text-amber-300">{" -> "}{manifest.resources.timeout}</span>}
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Surface Area</div>
                <div className="text-gray-200">Functions: {Object.keys(existingTool.manifest.tools).length}{" -> "}{toolCount}</div>
                <div className="text-gray-200 mt-1">
                  Panels: {(existingTool.manifest.ui?.panels?.length ?? 0)}{" -> "}{(manifest.ui?.panels?.length ?? 0)}
                </div>
                <div className="text-gray-200 mt-1">
                  Domains: {(existingTool.manifest.permissions.allowed_domains ?? []).length}{" -> "}{domains.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ChangeList title="Domains Added" items={updateDiff?.addedDomains ?? []} tone="added" />
              <ChangeList title="Domains Removed" items={updateDiff?.removedDomains ?? []} tone="removed" />
              <ChangeList title="File Access Added" items={updateDiff?.addedFiles ?? []} tone="added" />
              <ChangeList title="File Access Removed" items={updateDiff?.removedFiles ?? []} tone="removed" />
              <ChangeList title="Services Added" items={updateDiff?.addedServices ?? []} tone="added" />
              <ChangeList title="Services Removed" items={updateDiff?.removedServices ?? []} tone="removed" />
              <ChangeList title="Functions Added" items={updateDiff?.addedFunctions ?? []} tone="added" />
              <ChangeList title="Functions Removed" items={updateDiff?.removedFunctions ?? []} tone="removed" />
              <ChangeList title="Functions Changed" items={updateDiff?.changedFunctions ?? []} tone="changed" />
              <ChangeList title="Panels Added" items={updateDiff?.addedPanels ?? []} tone="added" />
              <ChangeList title="Panels Removed" items={updateDiff?.removedPanels ?? []} tone="removed" />
              <ChangeList title="Panels Changed" items={updateDiff?.changedPanels ?? []} tone="changed" />
            </div>
          </div>
        </>
      )}

      {/* Permissions */}
      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1.5">
          <Shield size={12} /> Requested Permissions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Globe size={12} /> Network Access
            </div>
            <div className="text-sm text-gray-200">
              {manifest.permissions.internet ? "Allowed" : "Denied"}
            </div>
            {manifest.permissions.internet && (
              <div className="mt-2 text-xs text-gray-400">
                {domains.length > 0 ? (
                  <ul className="space-y-1">
                    {domains.map((d) => (
                      <li key={d} className="font-mono text-gray-300">- {d}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-amber-300">No domain allowlist declared (treat as high risk).</span>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText size={12} /> File Access
            </div>
            <div className="text-sm text-gray-200">
              {fileAccess.length > 0 ? `Allowed (${fileAccess.length})` : "None requested"}
            </div>
            {fileAccess.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                <ul className="space-y-1">
                  {fileAccess.map((f) => (
                    <li key={f} className="font-mono text-gray-300 break-all">- {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 md:col-span-2">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Server size={12} /> Services Access
            </div>
            <div className="text-sm text-gray-200">
              {services.length > 0 ? `Allowed (${services.length})` : "None requested"}
            </div>
            {services.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                <ul className="space-y-1">
                  {services.map((s) => (
                    <li key={s} className="font-mono text-gray-300">- {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {!hasSpecialPerms && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Shield size={12} /> No special permissions requested
          </span>
        )}
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

      {/* Declared Inputs — only show required ones (auto-managed inputs are hidden) */}
      {(() => {
        const requiredInputs = manifest.inputs
          ? Object.entries(manifest.inputs).filter(([, input]) => input.required !== false)
          : [];
        return requiredInputs.length > 0 ? (
          <div className="space-y-1">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1.5">
              <KeyRound size={12} /> Required Inputs ({requiredInputs.length})
            </h4>
            <div className="space-y-1">
              {requiredInputs.map(([key, input]) => (
                <div key={key} className="text-sm text-gray-300 bg-gray-800/50 px-3 py-1.5 rounded flex items-center gap-2">
                  <span className="text-amber-400 font-mono">{key}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{input.type}</span>
                  {!input.default && <span className="text-xs text-red-400">required</span>}
                  <span className="text-gray-500 ml-1">{input.description}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">You can configure these values after installation in the tool settings.</p>
          </div>
        ) : null;
      })()}

      <label className="flex items-start gap-2 p-3 rounded-lg border border-gray-700 bg-gray-950/70 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={approved}
          onChange={(e) => onApprovalChange(e.target.checked)}
          disabled={loading}
        />
        <span className="text-sm text-gray-200">
          I reviewed this manifest and approve all requested permissions and capabilities{isUpdate ? " for this update" : ""}.
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onConfirm}
          disabled={loading || !approved}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckSquare size={14} />
          )}
          {isUpdate ? "Approve and Update" : "Approve and Install"}
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
  onTogglePin: (id: string, pinned: boolean) => void;
  onOpenPanel?: (toolId: string) => void;
  busy: boolean;
}> = ({ tool, isRunning, onLaunch, onStop, onUninstall, onTogglePin, onOpenPanel, busy }) => {
  const [expanded, setExpanded] = useState(false);
  const [inputStatus, setInputStatus] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [savingInput, setSavingInput] = useState<string | null>(null);
  const m = tool.manifest;
  const toolCount = Object.keys(m.tools).length;
  const hasPanels = (m.ui?.panels?.length ?? 0) > 0;
  const hasInputs = m.inputs && Object.keys(m.inputs).length > 0;

  useEffect(() => {
    if (expanded && hasInputs) {
      window.electronAPI.toolSandbox.getInputStatus(m.id).then((res) => {
        if (res.success && res.data) setInputStatus(res.data);
      });
    }
  }, [expanded, hasInputs, m.id]);

  const handleSaveInput = async (key: string) => {
    const value = inputValues[key];
    if (!value) return;
    setSavingInput(key);
    try {
      const res = await window.electronAPI.toolSandbox.setInput(m.id, key, value);
      if (res.success) {
        setInputStatus((prev) => ({ ...prev, [key]: true }));
        setInputValues((prev) => { const next = { ...prev }; delete next[key]; return next; });
      }
    } finally {
      setSavingInput(null);
    }
  };

  const handleDeleteInput = async (key: string) => {
    setSavingInput(key);
    try {
      const res = await window.electronAPI.toolSandbox.deleteInput(m.id, key);
      if (res.success) {
        setInputStatus((prev) => ({ ...prev, [key]: false }));
      }
    } finally {
      setSavingInput(null);
    }
  };

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
          {hasPanels && (
            <button
              onClick={() => onTogglePin(m.id, !tool.pinned)}
              disabled={busy}
              className={`p-1.5 rounded disabled:opacity-50 ${tool.pinned ? "hover:bg-indigo-900/40 text-indigo-300" : "hover:bg-gray-700 text-gray-400 hover:text-gray-200"}`}
              title={tool.pinned ? "Unpin from sidebar" : "Pin to sidebar"}
            >
              {tool.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          )}
          {isRunning && hasPanels && (
            <button
              onClick={() => onOpenPanel?.(m.id)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 text-xs font-medium transition-colors"
              title="Open panel in new tab"
            >
              <LayoutDashboard size={14} />
              Open Panel
            </button>
          )}
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
            {tool.fileHash && <> &middot; SHA-256: {tool.fileHash.slice(0, 12)}...</>}
          </div>

          {/* Input Configuration */}
          {hasInputs && (
            <div className="space-y-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={12} /> Inputs
              </span>
              {Object.entries(m.inputs!).map(([key, decl]) => (
                <div key={key} className="bg-gray-800/50 rounded p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400">{key}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{decl.type}</span>
                    {inputStatus[key] ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-0.5"><Check size={10} /> configured</span>
                    ) : decl.default !== undefined ? (
                      <span className="text-xs text-blue-400">using default</span>
                    ) : (
                      <span className="text-xs text-gray-500">not set</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{decl.description}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type={decl.type === "secret" ? "password" : "text"}
                      placeholder={inputStatus[key] ? "••••••••" : `Enter ${key}...`}
                      value={inputValues[key] ?? ""}
                      onChange={(e) => setInputValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => handleSaveInput(key)}
                      disabled={!inputValues[key] || savingInput === key}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs disabled:opacity-50"
                    >
                      {savingInput === key ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                    </button>
                    {inputStatus[key] && (
                      <button
                        onClick={() => handleDeleteInput(key)}
                        disabled={savingInput === key}
                        className="p-1 rounded hover:bg-red-900/40 text-red-400 hover:text-red-300 disabled:opacity-50"
                        title="Remove value"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approval History */}
          {tool.approvals && tool.approvals.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare size={12} /> Approval History
              </span>
              {tool.approvals.slice(0, 3).map((a, i) => (
                <div key={i} className="text-xs bg-gray-800/50 px-3 py-1.5 rounded text-gray-400 flex items-center gap-2">
                  <span className={a.action === "install" ? "text-emerald-400" : "text-indigo-400"}>{a.action}</span>
                  <span>v{a.approvedVersion}</span>
                  <span className="font-mono">{a.approvedFileHash.slice(0, 12)}...</span>
                  <span className="ml-auto">{new Date(a.approvedAt).toLocaleDateString()}</span>
                </div>
              ))}
              {tool.approvals.length > 3 && (
                <span className="text-xs text-gray-600">+ {tool.approvals.length - 3} earlier approval(s)</span>
              )}
            </div>
          )}
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

export const SandboxPage: React.FC<{ onNavigate?: (url: string) => void }> = ({ onNavigate }) => {
  const [tab, setTab] = useState<TabId>("tools");
  const [installed, setInstalled] = useState<InstalledTool[]>([]);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyTools, setBusyTools] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Install flow state
  const [pendingReview, setPendingReview] = useState<PendingToolReview | null>(null);
  const [permissionsApproved, setPermissionsApproved] = useState(false);
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

    setPermissionsApproved(false);

    try {
      const res = await window.electronAPI.toolSandbox.inspectManifest(filePath);
      if (res.success && res.data) {
        const existingTool = installed.find((tool) => tool.manifest.id === res.data!.manifest.id);
        setPendingReview({
          manifest: res.data.manifest,
          wasmPath: filePath,
          fileHash: res.data.fileHash,
          existingTool,
        });
      } else {
        setError(res.error ?? "Failed to read manifest");
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConfirmInstall = async () => {
    if (!pendingReview || !permissionsApproved) return;

    setError(null);
    setInstalling(true);
    try {
      const res = pendingReview.existingTool
        ? await window.electronAPI.toolSandbox.update(pendingReview.wasmPath, { approved: true })
        : await window.electronAPI.toolSandbox.install(pendingReview.wasmPath, { approved: true });
      if (!res.success) {
        setError(res.error ?? `Failed to ${pendingReview.existingTool ? "update" : "install"} tool`);
        return;
      }

      setPendingReview(null);
      setPermissionsApproved(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  const handleCancelInstall = () => {
    if (installing) return;
    setPendingReview(null);
    setPermissionsApproved(false);
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

  const handleTogglePin = async (toolId: string, pinned: boolean) => {
    setError(null);
    setBusyTools((s) => new Set(s).add(toolId));
    try {
      const res = await window.electronAPI.toolSandbox.setPinned(toolId, pinned);
      if (!res.success) setError(res.error ?? "Failed to update pin state");
      await refresh();
      // Notify Sidebar to refresh pinned tools immediately
      window.dispatchEvent(new CustomEvent("pinned-tools-changed"));
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
            disabled={!available || installing || !!pendingReview}
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

      {/* Install approval gate */}
      {pendingReview && (
        <ManifestPreview
          review={pendingReview}
          approved={permissionsApproved}
          onApprovalChange={setPermissionsApproved}
          onConfirm={handleConfirmInstall}
          onCancel={handleCancelInstall}
          loading={installing}
        />
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
                onTogglePin={handleTogglePin}
                onOpenPanel={(toolId) =>
                  onNavigate?.(`${INTERNAL_TOOL_PANEL_PREFIX}${toolId}`)
                }
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
