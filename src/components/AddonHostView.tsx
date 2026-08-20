import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Puzzle } from "lucide-react";
import { INTERNAL_SETTINGS_URL, Tab } from "../types/types";

interface AddonTabInfo {
  tabId: string;
  addonId: string;
  label: string;
  icon: string;
  order: number;
  activated: boolean;
  visible: boolean;
  rendererEntry: string;
  deepLinkParam?: string;
}

interface AddonHostViewProps {
  addonId: string;
  /** The incoming tab URL's query string (including "?"), if any — carries
   * any deep-link param through unmodified (§6.5, §9's deep-link contract). */
  deepLinkQuery?: string;
  onUpdateTab: (updates: Partial<Tab>) => void;
  onNavigate: (url: string) => void;
}

/** Fetched once and reused for every addon webview in this session (§6.5). */
let cachedPreloadPath: string | null = null;
async function getPreloadPath(): Promise<string | null> {
  if (cachedPreloadPath) return cachedPreloadPath;
  const path = await window.electronAPI?.addons?.getPreloadPath?.();
  if (path) cachedPreloadPath = path;
  return path ?? null;
}

/**
 * Hosts one addon's `mosaic-addon://` webview, or a friendly panel when the
 * addon is unknown/deactivated. Rule 1 (§3.2): the sidebar only ever links
 * here for an addon that's installed && activated && visible, so "not found
 * in listTabs()" is unambiguously the not-available case, including the
 * moment an open addon tab gets deactivated out from under it — `onChanged`
 * fires, this re-fetches, and the webview unmounts (destroying the guest).
 */
export const AddonHostView: React.FC<AddonHostViewProps> = ({
  addonId,
  deepLinkQuery,
  onUpdateTab,
  onNavigate,
}) => {
  const [tabInfo, setTabInfo] = useState<AddonTabInfo | null | undefined>(undefined); // undefined = loading
  const [preloadPath, setPreloadPath] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const tabs: AddonTabInfo[] = (await window.electronAPI?.addons?.listTabs?.()) ?? [];
      if (cancelled) return;
      setTabInfo(tabs.find((t) => t.addonId === addonId) ?? null);
    };
    load();

    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.addons?.onChanged) {
      cleanup = window.electronAPI.addons.onChanged((tabs) => {
        if (cancelled) return;
        setTabInfo(((tabs as AddonTabInfo[]) ?? []).find((t) => t.addonId === addonId) ?? null);
      });
    }

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [addonId]);

  useEffect(() => {
    getPreloadPath().then((p) => setPreloadPath(p));
  }, []);

  useEffect(() => {
    if (tabInfo) {
      onUpdateTab({ title: tabInfo.label, isLoading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabInfo?.tabId, tabInfo?.label]);

  // Tab title pushed live via addonAPI.ui.setTitle (§5.3)
  useEffect(() => {
    if (!window.electronAPI?.addons?.onTitleChanged) return;
    return window.electronAPI.addons.onTitleChanged(({ addonId: fromId, title }) => {
      if (fromId === addonId) onUpdateTab({ title });
    });
  }, [addonId, onUpdateTab]);

  // Loading state (waiting on the first listTabs() answer)
  if (tabInfo === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <Loader2 size={32} className="animate-spin text-gray-500" />
      </div>
    );
  }

  // Unknown / not installed / deactivated / hidden — the friendly panel (§4.2, §6.5)
  if (!tabInfo) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
        <Puzzle size={48} className="mb-4 text-gray-700" />
        <p className="mb-1">This addon isn't available right now.</p>
        <p className="text-sm text-gray-600 mb-4">
          It may be deactivated, uninstalled, or still starting up.
        </p>
        <button
          onClick={() => onNavigate(INTERNAL_SETTINGS_URL + "#addons")}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Open Addon Settings
        </button>
      </div>
    );
  }

  if (!preloadPath) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <Loader2 size={32} className="animate-spin text-gray-500" />
      </div>
    );
  }

  // manifest.renderer.entry is a path within the addon dir (e.g.
  // "renderer/index.html"); the protocol already serves from that renderer/
  // directory, so strip the redundant leading segment.
  const entryFile = tabInfo.rendererEntry.replace(/^renderer\/?/, "") || "index.html";
  const src = `mosaic-addon://${addonId}/${entryFile}${deepLinkQuery ?? ""}`;

  return (
    <div className="relative w-full h-full bg-gray-900 flex flex-col">
      <ErrorBoundaryPanel>
        <webview
          key={addonId}
          ref={webviewRef}
          src={src}
          preload={preloadPath}
          partition={`persist:addon:${addonId}`}
          webpreferences="contextIsolation=yes,sandbox=yes,nodeIntegration=no"
          className="flex-1 w-full h-full border-none bg-gray-900"
          style={{ width: "100%", height: "100%" }}
        />
      </ErrorBoundaryPanel>
    </div>
  );
};

/** Minimal load-failure fallback so a broken addon renderer doesn't leave a
 * blank pane — mirrors BrowserView's error panel shape, scoped down. */
const ErrorBoundaryPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const webview = container.querySelector("webview") as any;
    if (!webview) return;

    const onFail = (e: any) => {
      if (e.errorCode === -3 || e.errorCode === 0) return; // harmless aborts
      setHasError(true);
    };
    const onStart = () => setHasError(false);
    webview.addEventListener("did-fail-load", onFail);
    webview.addEventListener("did-start-loading", onStart);
    return () => {
      webview.removeEventListener("did-fail-load", onFail);
      webview.removeEventListener("did-start-loading", onStart);
    };
  }, []);

  return (
    <div ref={ref} className="relative w-full h-full">
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="max-w-md text-center p-6 bg-gray-800 rounded-xl shadow-lg border border-red-900/30">
            <div className="w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Addon Failed to Load</h3>
            <p className="text-gray-400">Its renderer could not be reached.</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
