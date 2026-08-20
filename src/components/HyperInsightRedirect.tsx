import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ADDON_URL_PREFIX, INTERNAL_SETTINGS_URL } from "../types/types";

interface HyperInsightRedirectProps {
  onNavigate: (url: string) => void;
}

/**
 * Old browser://hyperinsight URLs must redirect sensibly — HyperInsight
 * moved entirely into an addon; `plugins/hyperinsight/` no longer
 * exists in core to route to directly. A bookmark/history entry still
 * pointing at the old `browser://hyperinsight` URL lands here instead:
 * if the addon is installed, activated, and visible (the same "would
 * actually render something" bar AddonHostView itself uses), forward to
 * `addon://hyperinsight`; otherwise forward to the Addons catalogue with
 * that entry highlighted, since the addon isn't present for essentially
 * all upgrading users per the auto-install migration, and Settings is
 * the only place a fresh-install user could go get it.
 */
export const HyperInsightRedirect: React.FC<HyperInsightRedirectProps> = ({ onNavigate }) => {
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.addons
      .listTabs()
      .then((tabs) => {
        if (cancelled) return;
        const available = tabs.some((t) => t.addonId === "hyperinsight");
        onNavigate(available ? `${ADDON_URL_PREFIX}hyperinsight` : `${INTERNAL_SETTINGS_URL}#addons`);
      })
      .catch(() => {
        if (!cancelled) onNavigate(`${INTERNAL_SETTINGS_URL}#addons`);
      });
    return () => {
      cancelled = true;
    };
  }, [onNavigate]);

  return (
    <div className="h-full flex items-center justify-center bg-gray-950 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  );
};
