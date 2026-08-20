import React, { useEffect, useState } from "react";
import { ArrowRight, Puzzle } from "lucide-react";
import { INTERNAL_SETTINGS_URL, ADDON_URL_PREFIX } from "../../types/types";

interface AddonDeepLinkCTAProps {
  /** The addon's manifest id (e.g. "hyperinsight") — not necessarily installed. */
  addonId: string;
  /** Display name shown in the CTA copy (e.g. "HyperInsight"). */
  addonName: string;
  /** The manifest's `tab.deepLink.param` this addon declares, if any. */
  deepLinkParam?: string;
  /** The value to pass for that param (e.g. a node license key). */
  deepLinkValue?: string;
  onNavigate: (url: string) => void;
}

type AddonState = "loading" | "not-installed" | "inactive" | "hidden" | "ready";

/**
 * Generic "minimal core view + addon deep-link" affordance (used
 * concretely by NodeMiniDetailPanel — but not HyperInsight-specific:
 * any future core-minimal/addon-rich pairing can reuse this unchanged).
 *
 * Reads real installed/activated/visible state via `electronAPI.addons.list()`
 * + `tabPrefs.get()` — never assumes the addon exists. Until the target addon
 * is actually installed (e.g. HyperInsight), this always renders the "not
 * installed" CTA — a deliberate, acceptable interim UX dip, not a bug.
 */
export const AddonDeepLinkCTA: React.FC<AddonDeepLinkCTAProps> = ({
  addonId,
  addonName,
  deepLinkParam,
  deepLinkValue,
  onNavigate,
}) => {
  const [state, setState] = useState<AddonState>("loading");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const addons = (await window.electronAPI?.addons?.list?.()) ?? [];
        const match = addons.find((a) => a.id === addonId);
        if (cancelled) return;

        if (!match) {
          setState("not-installed");
          return;
        }
        if (!match.activated) {
          setState("inactive");
          return;
        }
        const visibility = (await window.electronAPI?.tabPrefs?.get?.()) ?? {};
        if (visibility[`addon:${addonId}`] === false) {
          setState("hidden");
          return;
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("not-installed");
      }
    };
    check();

    // Re-check on every install/uninstall/activate/deactivate and every
    // sidebar-tab-visibility change — this component previously only ever
    // checked once on mount, so e.g. uninstalling the addon while its
    // NodeMiniDetailPanel deep-link CTA was already on screen left it
    // stuck showing stale state until the panel was closed and reopened.
    const cleanupAddons = window.electronAPI?.addons?.onChanged?.(() => check());
    const cleanupTabPrefs = window.electronAPI?.tabPrefs?.onChanged?.(() => check());

    return () => {
      cancelled = true;
      cleanupAddons?.();
      cleanupTabPrefs?.();
    };
  }, [addonId]);

  if (state === "loading") return null;

  const goToAddonsSettings = () => onNavigate(`${INTERNAL_SETTINGS_URL}#addons`);
  const goToTabsSettings = () => onNavigate(`${INTERNAL_SETTINGS_URL}#tabs`);
  const openAddon = () => {
    const query = deepLinkParam && deepLinkValue ? `?${deepLinkParam}=${encodeURIComponent(deepLinkValue)}` : "";
    onNavigate(`${ADDON_URL_PREFIX}${addonId}${query}`);
  };

  if (state === "ready") {
    return (
      <button
        onClick={openAddon}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-300 border border-indigo-500/20 rounded-lg transition-all text-sm font-medium"
      >
        View full details in {addonName} <ArrowRight size={14} />
      </button>
    );
  }

  const copy =
    state === "not-installed"
      ? `Install the ${addonName} addon for full details`
      : state === "inactive"
        ? `Activate ${addonName} to see full details`
        : `${addonName} is hidden — show it in Settings`;

  return (
    <button
      onClick={state === "hidden" ? goToTabsSettings : goToAddonsSettings}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-all text-sm"
    >
      <Puzzle size={14} /> {copy}
    </button>
  );
};
