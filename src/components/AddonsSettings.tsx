import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Puzzle,
  Store,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  FolderOpen,
  Sparkles,
} from "lucide-react";

// =============================================================================
// Types (mirroring global.d.ts's electronAPI.addons shapes)
// =============================================================================

interface AddonSummary {
  id: string;
  name: string;
  description?: string;
  version: string;
  activated: boolean;
  lastError?: string;
  source:
    | { type: "registry"; tarballUrl: string; sha256: string; registrySignatureVerified: boolean; verifiedKeyId: string }
    | { type: "dev"; path: string }
    | { type: "bundled"; bundledFromVersion: string };
  permissions: string[];
  linkVisibilityToActivation: boolean;
  updateCheckMode: "manual" | "automatic";
  updateAvailable?: string;
}

interface CatalogueEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  minAppVersion?: string;
  tarballUrl: string;
  sha256: string;
  permissions: string[];
  icon?: string;
  homepage?: string;
}

const PERMISSION_WORDING: Record<string, string> = {
  "wallet:read": "See your wallet address, balances, and network",
  "agents:read": "See your configured AI agents",
  "agents:write": "Create and modify AI agents",
  "mcp:read": "See connected MCP servers and their tools",
  "mcp:call": "Run tools on your connected MCP servers",
  "nodes:read": "See your HyperCycle nodes and their AIM data",
  "shell:open-external": "Open links in your browser",
};

function describePermission(p: string): string {
  return PERMISSION_WORDING[p] ?? p;
}

interface AddonsSettingsProps {
  sectionRef?: React.RefObject<HTMLElement | null>;
}

export const AddonsSettings: React.FC<AddonsSettingsProps> = ({ sectionRef }) => {
  const [addons, setAddons] = useState<AddonSummary[]>([]);
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set());
  const [uninstallDialog, setUninstallDialog] = useState<{
    id: string;
    name: string;
    dataSize: number | null;
    keepSettings: boolean;
    keepData: boolean;
  } | null>(null);
  const [consentDialog, setConsentDialog] = useState<{
    id: string;
    name: string;
    permissions: string[];
    hasMainEntry?: boolean;
    mode: "install" | "upgrade";
  } | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [catalogue, setCatalogue] = useState<CatalogueEntry[] | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  // "Nothing published yet" is a normal state, not a failure — kept separate
  // from catalogueError so it doesn't render as a red error with a Retry.
  const [catalogueUnavailable, setCatalogueUnavailable] = useState(false);

  const isDevBuild = true; // The real gate is !app.isPackaged / MOSAIC_ADDON_DEV — enforced main-side; UI just always offers the entry point and lets the main process reject if not a dev build.
  const [devPathInput, setDevPathInput] = useState<string | null>(null);

  const loadAddons = useCallback(async () => {
    const list = await window.electronAPI?.addons?.list?.();
    setAddons(list ?? []);
  }, []);

  useEffect(() => {
    loadAddons();
    const cleanup = window.electronAPI?.addons?.onChanged?.(() => {
      loadAddons();
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [loadAddons]);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── Combined on/off (linked) vs decoupled controls ───────────────────────
  const handleSetEnabled = (addon: AddonSummary, enabled: boolean) =>
    withBusy(addon.id, async () => {
      const result = await window.electronAPI.addons.setEnabled(addon.id, enabled);
      if (!result.success) toast.error(result.error || "Failed to update addon");
      await loadAddons();
    });

  const handleActivateToggle = (addon: AddonSummary) =>
    withBusy(addon.id, async () => {
      const result = addon.activated
        ? await window.electronAPI.addons.deactivate(addon.id)
        : await window.electronAPI.addons.activate(addon.id);
      if (!result.success) toast.error(result.error || "Failed to update addon");
      await loadAddons();
    });

  const handleVisibilityToggle = (addon: AddonSummary, visible: boolean) =>
    withBusy(addon.id, async () => {
      const result = await window.electronAPI.tabPrefs.setVisibility(`addon:${addon.id}`, visible);
      if (!result.success) toast.error(result.error || "Failed to update tab visibility");
    });

  const handleAdvancedToggle = (addon: AddonSummary, linked: boolean) =>
    withBusy(addon.id, async () => {
      const result = await window.electronAPI.addons.setVisibilityLink(addon.id, linked);
      if (!result.success) toast.error(result.error || "Failed to update setting");
      await loadAddons();
    });

  const handleUpdateCheckModeChange = (addon: AddonSummary, mode: "manual" | "automatic") =>
    withBusy(addon.id, async () => {
      const result = await window.electronAPI.addons.setUpdateCheckMode(addon.id, mode);
      if (!result.success) toast.error(result.error || "Failed to update setting");
      await loadAddons();
    });

  const handleUpdate = (addon: AddonSummary) =>
    withBusy(addon.id, async () => {
      const result = await window.electronAPI.addons.upgrade(addon.id);
      if (result.needsConsent) {
        setConsentDialog({ id: addon.id, name: addon.name, permissions: result.needsConsent, mode: "upgrade" });
        return;
      }
      if (!result.success) {
        toast.error(result.error || "Update failed");
      } else {
        toast.success(`${addon.name} updated`);
      }
      await loadAddons();
    });

  const confirmUpgradeConsent = () =>
    withBusy(consentDialog!.id, async () => {
      const { id, permissions } = consentDialog!;
      setConsentDialog(null);
      const result = await window.electronAPI.addons.upgrade(id, permissions);
      if (!result.success) toast.error(result.error || "Update failed");
      else toast.success("Addon updated");
      await loadAddons();
    });

  // ── Uninstall ─────────────────────────────────────────────────────────
  const openUninstallDialog = async (addon: AddonSummary) => {
    const dataSize = await window.electronAPI.addons.getDataSize(addon.id);
    setUninstallDialog({ id: addon.id, name: addon.name, dataSize, keepSettings: true, keepData: true });
  };

  const confirmUninstall = () =>
    withBusy(uninstallDialog!.id, async () => {
      const { id, keepSettings, keepData } = uninstallDialog!;
      setUninstallDialog(null);
      const result = await window.electronAPI.addons.uninstall(id, { keepSettings, keepData });
      if (!result.success) toast.error(result.error || "Uninstall failed");
      else toast.success("Addon uninstalled");
      await loadAddons();
    });

  // ── Catalogue ──────────────────────────────────────────────────────────
  const browseAddons = async () => {
    setCatalogueLoading(true);
    setCatalogueError(null);
    setCatalogueUnavailable(false);
    try {
      const result = await window.electronAPI.addons.fetchCatalogue();
      if (result.unavailable) {
        setCatalogueUnavailable(true);
        setCatalogue(null);
      } else if (!result.success) {
        setCatalogueError(result.error || "Failed to fetch the addon catalogue");
        setCatalogue(null);
      } else {
        setCatalogue(result.addons ?? []);
      }
    } finally {
      setCatalogueLoading(false);
    }
  };

  const beginInstall = async (entry: CatalogueEntry) => {
    const result = await window.electronAPI.addons.install(entry.id);
    if (!result.success) {
      toast.error(result.error || "Failed to start install");
      return;
    }
    setConsentDialog({
      id: entry.id,
      name: entry.name,
      permissions: result.needsConsent ?? [],
      hasMainEntry: result.hasMainEntry ?? false,
      mode: "install",
    });
  };

  const confirmInstallConsent = () =>
    withBusy(consentDialog!.id, async () => {
      const { id, permissions } = consentDialog!;
      setConsentDialog(null);
      const result = await window.electronAPI.addons.installConfirm(id, permissions);
      if (!result.success) toast.error(result.error || "Install failed");
      else toast.success("Addon installed");
      await loadAddons();
    });

  // ── Dev corner ─────────────────────────────────────────────────────────
  const loadUnpackedAddon = async () => {
    const dirPath = await window.electronAPI.dialog.openDirectory();
    if (!dirPath) return;
    setDevPathInput(dirPath);
    const result = await window.electronAPI.addons.installDev(dirPath);
    if (!result.success) {
      toast.error(result.error || "Failed to load unpacked addon");
      return;
    }
    toast.success(`Loaded "${result.id}" — activating…`);
    if (result.id) {
      await window.electronAPI.addons.activate(result.id);
    }
    await loadAddons();
  };

  const reloadDevAddon = (addon: AddonSummary) =>
    withBusy(addon.id, async () => {
      await window.electronAPI.addons.deactivate(addon.id);
      const result = await window.electronAPI.addons.activate(addon.id);
      if (!result.success) toast.error(result.error || "Reload failed");
      else toast.success(`${addon.name} reloaded`);
      await loadAddons();
    });

  const togglePermissions = (id: string) => {
    setExpandedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section
      id="addons"
      ref={sectionRef}
      className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm"
    >
      <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
        <Puzzle size={20} />
        Addons
      </h2>

      {/* Installed list */}
      {addons.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-700 rounded-xl mb-6">
          <Puzzle className="mx-auto size-10 text-gray-600 mb-3" />
          <p className="text-gray-500">No addons installed</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {addons.map((addon) => {
            const isBusy = busyIds.has(addon.id);
            const isDev = addon.source.type === "dev";
            const isBundled = addon.source.type === "bundled";
            const stateBadge = addon.lastError
              ? { label: "Error", color: "text-red-400 border-red-500/30 bg-red-900/20" }
              : addon.activated
                ? { label: "Active", color: "text-emerald-400 border-emerald-500/30 bg-emerald-900/20" }
                : { label: "Deactivated", color: "text-gray-400 border-gray-600 bg-gray-800/50" };
            const combinedOn = addon.linkVisibilityToActivation ? addon.activated : undefined;

            return (
              <div key={addon.id} className="bg-gray-900/70 rounded-lg border border-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-100 font-medium">{addon.name}</span>
                      <span className="text-xs text-gray-500 font-mono">v{addon.version}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${stateBadge.color}`}>
                        {stateBadge.label}
                      </span>
                      {isDev && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-900/20 text-amber-400">
                          DEV
                        </span>
                      )}
                      {isBundled && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-900/20 text-sky-300"
                          title="Carried over automatically from your previous Mosaic version"
                        >
                          Built-in
                        </span>
                      )}
                      {addon.updateAvailable && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-900/20 text-indigo-300">
                          Update available: v{addon.updateAvailable}
                        </span>
                      )}
                    </div>
                    {addon.description && <p className="text-sm text-gray-500 mt-1">{addon.description}</p>}
                    {addon.lastError && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> {addon.lastError}
                      </p>
                    )}
                  </div>

                  {/* Primary control: combined switch (linked) or Activate/Deactivate (decoupled) */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isBusy && <Loader2 size={14} className="animate-spin text-gray-500" />}
                    {addon.linkVisibilityToActivation ? (
                      <button
                        onClick={() => handleSetEnabled(addon, !combinedOn)}
                        disabled={isBusy}
                        title={combinedOn ? "Turn off (deactivates + hides)" : "Turn on (activates + shows)"}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 shrink-0 ${combinedOn ? "bg-indigo-600 border-indigo-500" : "bg-gray-600 border-gray-500"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${combinedOn ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivateToggle(addon)}
                        disabled={isBusy}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300"
                      >
                        {addon.activated ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Decoupled-only: Show-in-sidebar */}
                {!addon.linkVisibilityToActivation && (
                  <DecoupledVisibilityRow addonId={addon.id} activated={addon.activated} onToggle={(v) => handleVisibilityToggle(addon, v)} />
                )}

                {/* Permissions (expandable) */}
                {addon.permissions.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => togglePermissions(addon.id)}
                      className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                    >
                      {expandedPermissions.has(addon.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Permissions ({addon.permissions.length})
                    </button>
                    {expandedPermissions.has(addon.id) && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {addon.permissions.map((p) => (
                          <li key={p} className="text-xs text-gray-500">
                            <span className="font-mono text-gray-400">{p}</span> — {describePermission(p)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Advanced + update-check controls */}
                <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!addon.linkVisibilityToActivation}
                      onChange={(e) => handleAdvancedToggle(addon, !e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Control activation and visibility independently
                  </label>

                  {!isDev && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Update check:</span>
                      <select
                        value={addon.updateCheckMode}
                        onChange={(e) => handleUpdateCheckModeChange(addon, e.target.value as "manual" | "automatic")}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                      >
                        <option value="manual">Manual</option>
                        <option value="automatic">Automatic</option>
                      </select>
                    </div>
                  )}
                  {isDev && <span className="text-gray-600">DEV — no update checks</span>}

                  <div className="flex items-center gap-2 ml-auto">
                    {isDev ? (
                      <button
                        onClick={() => reloadDevAddon(addon)}
                        disabled={isBusy}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300"
                      >
                        <RefreshCw size={12} /> Reload
                      </button>
                    ) : (
                      addon.updateAvailable && (
                        <button
                          onClick={() => handleUpdate(addon)}
                          disabled={isBusy}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30"
                        >
                          <RefreshCw size={12} /> Update
                        </button>
                      )
                    )}
                    <button
                      onClick={() => openUninstallDialog(addon)}
                      disabled={isBusy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-900/40 hover:bg-red-900/20 text-red-400"
                    >
                      <Trash2 size={12} /> Uninstall
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Catalogue */}
      <div className="border-t border-gray-800 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Store size={16} /> Browse addons
          </h3>
          <button
            onClick={browseAddons}
            disabled={catalogueLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30"
          >
            {catalogueLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {catalogue ? "Refresh" : "Browse"}
          </button>
        </div>

        {catalogueError && (
          <div className="text-sm text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg p-3 mb-3 flex items-center justify-between">
            <span>{catalogueError}</span>
            <button onClick={browseAddons} className="text-red-300 hover:underline">
              Retry
            </button>
          </div>
        )}

        {catalogueUnavailable && (
          <div className="text-sm text-gray-400 bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 mb-3">
            <p className="mb-1 text-gray-300">No addon catalogue is published yet.</p>
            <p className="text-gray-500">
              One-click install arrives with the signed catalogue. Until then, addons are installed
              manually — see the Dev corner below, or the addon repository for what's available.
            </p>
          </div>
        )}

        {catalogue && catalogue.length === 0 && !catalogueError && (
          <p className="text-sm text-gray-600">No addons published yet.</p>
        )}

        {catalogue && catalogue.length > 0 && (
          <div className="space-y-2">
            {catalogue.map((entry) => {
              const alreadyInstalled = addons.some((a) => a.id === entry.id);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 bg-gray-900/70 rounded-lg border border-gray-800 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-200 font-medium">{entry.name}</span>
                      <span className="text-xs text-gray-500 font-mono">v{entry.version}</span>
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-900/20 text-emerald-400">
                        <Sparkles size={10} /> Verified publisher
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{entry.description}</p>
                  </div>
                  <button
                    onClick={() => beginInstall(entry)}
                    disabled={alreadyInstalled}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white"
                  >
                    {alreadyInstalled ? "Installed" : "Install"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dev corner */}
      {isDevBuild && (
        <div className="border-t border-gray-800 pt-6 mt-6">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
            <FolderOpen size={16} /> Dev corner
          </h3>
          <button
            onClick={loadUnpackedAddon}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300"
          >
            <FolderOpen size={12} /> Load unpacked addon…
          </button>
          {devPathInput && <p className="text-xs text-gray-600 mt-2 font-mono">{devPathInput}</p>}
        </div>
      )}

      {/* Consent dialog — install or upgrade */}
      {consentDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              {consentDialog.mode === "upgrade" ? "New permissions requested" : `Install ${consentDialog.name}?`}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {consentDialog.mode === "upgrade"
                ? `The updated version of ${consentDialog.name} requests additional permissions:`
                : "This addon requests the following permissions:"}
            </p>
            {/* Permissions describe what the addon's *page* may ask the app to
                do. An addon that also ships main-process code is not bound by
                them at all, so saying "no special permissions" without this
                would be actively misleading. main.entry is restricted to
                first-party addons (MAIN_ENTRY_ALLOWLIST), which is what makes
                the sentence below true rather than reassuring. */}
            {consentDialog.hasMainEntry && (
              <div className="text-sm rounded-lg border border-amber-600/40 bg-amber-900/15 p-3 mb-4">
                <p className="text-amber-200 font-medium mb-1">This addon runs privileged code.</p>
                <p className="text-amber-200/70">
                  It includes a main-process component, which runs with the same access as Mosaic
                  itself — the permissions below do not restrict it. Only addons published by the
                  Mosaic team are allowed to do this.
                </p>
              </div>
            )}
            {consentDialog.permissions.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No special permissions requested.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {consentDialog.permissions.map((p) => (
                  <li key={p} className="text-sm text-gray-300">
                    <span className="font-mono text-xs text-gray-500 block">{p}</span>
                    {describePermission(p)}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConsentDialog(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={consentDialog.mode === "upgrade" ? confirmUpgradeConsent : confirmInstallConsent}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {consentDialog.mode === "upgrade" ? "Approve & Update" : "Install"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uninstall dialog */}
      {uninstallDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Uninstall {uninstallDialog.name}?</h3>
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uninstallDialog.keepSettings}
                  onChange={(e) => setUninstallDialog({ ...uninstallDialog, keepSettings: e.target.checked })}
                  className="accent-indigo-500"
                />
                Keep settings so a future reinstall is pre-configured
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uninstallDialog.keepData}
                  onChange={(e) => setUninstallDialog({ ...uninstallDialog, keepData: e.target.checked })}
                  className="accent-indigo-500"
                />
                Keep data
                {uninstallDialog.dataSize !== null && (
                  <span className="text-gray-500">({formatBytes(uninstallDialog.dataSize)})</span>
                )}
              </label>
            </div>
            {!uninstallDialog.keepSettings && !uninstallDialog.keepData ? (
              <p className="text-sm text-red-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={14} /> This permanently deletes everything for this addon.
              </p>
            ) : (
              <p className="text-xs text-gray-600 mb-4">
                Addon code is always removed; a reinstall unpacks it fresh.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUninstallDialog(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmUninstall}
                className={`px-4 py-2 text-sm rounded-lg text-white ${
                  !uninstallDialog.keepSettings && !uninstallDialog.keepData
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                Uninstall
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

/** Decoupled-mode "Show in sidebar" toggle — loads its own current value
 * from tabPrefs since AddonsSettings' parent list doesn't carry visibility. */
const DecoupledVisibilityRow: React.FC<{
  addonId: string;
  activated: boolean;
  onToggle: (visible: boolean) => void;
}> = ({ addonId, activated, onToggle }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI?.tabPrefs?.get?.().then((v) => {
      if (!cancelled) setVisible(v?.[`addon:${addonId}`] !== false);
    });
    const cleanup = window.electronAPI?.tabPrefs?.onChanged?.((v) => {
      if (!cancelled) setVisible(v?.[`addon:${addonId}`] !== false);
    });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [addonId]);

  return (
    <div className="mt-3 flex items-center justify-between text-xs">
      <span className={activated ? "text-gray-400" : "text-gray-600"}>
        Show in sidebar {!activated && "(activate to show)"}
      </span>
      <button
        onClick={() => {
          const next = !visible;
          setVisible(next);
          onToggle(next);
        }}
        disabled={!activated}
        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors disabled:opacity-40 ${visible ? "bg-indigo-600 border-indigo-500" : "bg-gray-600 border-gray-500"}`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${visible ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
