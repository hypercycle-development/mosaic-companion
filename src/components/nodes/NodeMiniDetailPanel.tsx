import React from "react";
import { X, RefreshCw } from "lucide-react";
import { AddonDeepLinkCTA } from "./AddonDeepLinkCTA";

interface NodeMiniDetailPanelProps {
  licenseKey: string;
  name: string;
  isActive: boolean;
  isLive: boolean;
  checking: boolean;
  lastChecked: Date | null;
  latency: number | null;
  sidebarOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

/**
 * Core's minimal, addon-independent node view (§9.2's `NodeMiniDetailPanel`
 * instance of the generic "minimal core view + addon deep-link" pattern).
 * Deliberately limited to fields Sidebar already computes for the node
 * cards themselves — license/name, active/inactive, live/offline,
 * last-checked, latency — via the existing plain `/info` ping
 * (`checkNodeConnection`). No AIM zones, no scores, no leaderboard data,
 * nothing sourced from HyperInsight's API. Replaces the old, full
 * `NodeDetailPanel` import (§9.2's "Removed from core" list applies once
 * Phase 7 deletes `plugins/hyperinsight/` entirely; this component doesn't
 * depend on it existing).
 */
export const NodeMiniDetailPanel: React.FC<NodeMiniDetailPanelProps> = ({
  licenseKey,
  name,
  isActive,
  isLive,
  checking,
  lastChecked,
  latency,
  sidebarOpen,
  onClose,
  onNavigate,
}) => {
  const statusLabel = !isActive ? "Inactive" : isLive ? "Live" : "Offline";
  const statusColor = !isActive ? "text-gray-500" : isLive ? "text-emerald-400" : "text-red-400";

  return (
    <div
      className="absolute top-0 bottom-0 z-20 w-80 bg-gray-950 border-l border-gray-800 shadow-2xl overflow-y-auto"
      style={{ right: sidebarOpen ? "-20rem" : "0" }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-100">Node Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-xs text-gray-600 uppercase tracking-wide">Name</span>
            <p className="text-gray-200 font-medium truncate">{name}</p>
          </div>

          <div>
            <span className="text-xs text-gray-600 uppercase tracking-wide">License</span>
            <p className="text-gray-400 font-mono text-sm truncate" title={licenseKey}>
              {licenseKey}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Status</span>
            <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Latency</span>
            <span className="text-sm font-mono text-gray-300">
              {checking ? (
                <RefreshCw size={12} className="animate-spin inline" />
              ) : latency !== null ? (
                `${latency}ms`
              ) : (
                "—"
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 uppercase tracking-wide">Last Checked</span>
            <span className="text-sm text-gray-400">
              {lastChecked ? lastChecked.toLocaleTimeString() : "Never"}
            </span>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-gray-800">
          <AddonDeepLinkCTA
            addonId="hyperinsight"
            addonName="HyperInsight"
            deepLinkParam="nodeId"
            deepLinkValue={licenseKey}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
};
