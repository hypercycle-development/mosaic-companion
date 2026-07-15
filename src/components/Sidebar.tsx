import React, { useState, useEffect, useCallback } from "react";
import {
  Home,
  Settings,
  Star,
  Clock,
  LayoutGrid,
  ChevronLeft,
  Plus,
  Database,
  FileText,
  Monitor,
  Share2,
  Cpu,
  Power,
  Sparkles,
  Bot,
  MessageSquare,
  Server,
  RefreshCw,
  BrainCircuit,
  Plug,
  Lock,
  Activity,
  Zap,
  Trophy,
  BarChart3,
  Globe,
  Layers,
  Box,
  Shield,
  Hash,
  Code2,
  Rocket,
  Store,
  Wallet,
  Network,
  Boxes,
  Telescope,
} from "lucide-react";
import {
  INTERNAL_SETTINGS_URL,
  INTERNAL_CHAT_URL,
  INTERNAL_TOOL_PANEL_PREFIX,
  ADDON_URL_PREFIX,
} from "../types/types";
import { CORE_TABS } from "../tabs/registry";
import { AIAgentConfig, PROVIDER_INFO } from "../types/ai";
import { NodeMiniDetailPanel } from "./nodes/NodeMiniDetailPanel";
import type { InstalledTool } from "../../electron/integrations/sandbox/types";

/** Map manifest icon names → lucide components (shared with ToolPanelView) */
const TOOL_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  server: Server, zap: Zap, cpu: Cpu, activity: Activity, trophy: Trophy,
  chart: BarChart3, globe: Globe, database: Database, layers: Layers,
  box: Box, shield: Shield, hash: Hash,
};

/**
 * Addon tab icons (§6.6) — manifest `tab.icon` uses Lucide PascalCase names
 * (unlike `TOOL_ICON_MAP`'s lowercase WASM-tool-manifest keys). Curated, not
 * a passthrough to all of lucide-react, to keep the bundle small; fallback
 * is LayoutGrid via `renderNavIcon`'s existing default case.
 */
const ADDON_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Server, Zap, Cpu, Activity, Trophy, BarChart3, Globe, Database, Layers, Box,
  Shield, Hash, Rocket, Store, Wallet, Network, Boxes, Telescope, Sparkles,
  Lock, Bot, MessageSquare, Settings, Home, Plug, BrainCircuit, Code2, Star,
  Clock, Power, LayoutGrid,
};

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

// HypercycleNode is declared globally in global.d.ts — no local duplicate needed.

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (url: string) => void;
  currentUrl: string;
  aiAgents?: AIAgentConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNavigate,
  currentUrl,
  aiAgents = [],
}) => {
  // Hypercycle nodes state
  const [nodes, setNodes] = useState<HypercycleNode[]>([]);
  const [pinnedTools, setPinnedTools] = useState<InstalledTool[]>([]);

  // Per-tab sidebar visibility (absent key = visible). Only toggleable tabs
  // can ever be hidden; at launch no core tab is toggleable so this stays empty.
  const [tabVisibility, setTabVisibility] = useState<Record<string, boolean>>({});

  // Addon-contributed tabs (§6.3) — installed && activated addons only;
  // listTabs() already excludes anything not currently live.
  const [addonTabs, setAddonTabs] = useState<AddonTabInfo[]>([]);

  // Node detail panel state — when set, the NodeDetailPanel slides in
  const [selectedNodeLicense, setSelectedNodeLicense] = useState<string | null>(null);

  // Live status tracking: { [nodeId]: { isLive, checking, lastChecked, latency } }
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<
      string,
      {
        isLive: boolean;
        checking: boolean;
        lastChecked: Date | null;
        latency: number | null;
      }
    >
  >({});

  // Check if a node is reachable by calling /info endpoint and measure latency
  const checkNodeConnection = useCallback(async (node: HypercycleNode) => {
    if (!node.apiHost || !node.isActive) return;

    setNodeStatuses((prev) => ({
      ...prev,
      [node.id]: { ...prev[node.id], checking: true },
    }));

    const startTime = performance.now();

    try {
      // Check main API at /info endpoint
      const url = `http://${node.apiHost}:${node.apiPort || "8000"}/info`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);

      // Consider live if we get any response (even error JSON)
      const isLive = response.ok || response.status < 500;

      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: {
          isLive,
          checking: false,
          lastChecked: new Date(),
          latency,
        },
      }));
    } catch {
      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: {
          isLive: false,
          checking: false,
          lastChecked: new Date(),
          latency: null,
        },
      }));
    }
  }, []);

  // Load nodes on mount and subscribe to changes
  useEffect(() => {
    const loadNodes = async () => {
      if (window.electronAPI?.nodes?.get) {
        const loadedNodes = await window.electronAPI.nodes.get();
        setNodes(loadedNodes);
      }
    };
    loadNodes();

    // Subscribe to node changes
    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.nodes?.onChanged) {
      cleanup = window.electronAPI.nodes.onChanged((updatedNodes) => {
        setNodes(updatedNodes);
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Check all active nodes on mount and every 5 minutes
  useEffect(() => {
    const checkAllNodes = () => {
      nodes.filter((n) => n.isActive && n.apiHost).forEach(checkNodeConnection);
    };

    // Initial check
    if (nodes.length > 0) {
      checkAllNodes();
    }

    // Set up interval (5 minutes)
    const interval = setInterval(checkAllNodes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [nodes, checkNodeConnection]);

  // Load tab visibility on mount and subscribe to changes
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const loadVisibility = async () => {
      if (window.electronAPI?.tabPrefs?.get) {
        const visibility = await window.electronAPI.tabPrefs.get();
        setTabVisibility(visibility || {});
      }
    };
    loadVisibility();

    if (window.electronAPI?.tabPrefs?.onChanged) {
      cleanup = window.electronAPI.tabPrefs.onChanged((visibility) => {
        setTabVisibility(visibility || {});
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Load addon tabs on mount and subscribe to changes (activate/deactivate/
  // install/uninstall all funnel through the same addons:changed broadcast)
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const loadAddonTabs = async () => {
      if (window.electronAPI?.addons?.listTabs) {
        const tabs = await window.electronAPI.addons.listTabs();
        setAddonTabs(tabs || []);
      }
    };
    loadAddonTabs();

    if (window.electronAPI?.addons?.onChanged) {
      cleanup = window.electronAPI.addons.onChanged((tabs) => {
        setAddonTabs((tabs as AddonTabInfo[]) || []);
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Load pinned sandbox tools (refresh periodically to reflect pin changes)
  useEffect(() => {
    let cancelled = false;

    const loadPinnedTools = async () => {
      try {
        const res = await window.electronAPI.toolSandbox.listInstalled();
        if (!cancelled && res.success && res.data) {
          setPinnedTools(
            res.data.filter(
              (tool) => Boolean(tool.pinned) && (tool.manifest.ui?.panels?.length ?? 0) > 0,
            ),
          );
        }
      } catch {
        if (!cancelled) setPinnedTools([]);
      }
    };

    loadPinnedTools();
    const interval = setInterval(loadPinnedTools, 15_000);

    // Refresh immediately when pin state changes (dispatched by SandboxPage)
    const onPinChange = () => loadPinnedTools();
    window.addEventListener("pinned-tools-changed", onPinChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("pinned-tools-changed", onPinChange);
    };
  }, []);

  // Navigation Items — sourced from the tab registry (single source of
  // truth) merged with addon tabs (§6.3). Only toggleable tabs can ever be
  // hidden; a non-toggleable core tab never has a `false` entry, so it
  // always shows. Ordering: core tabs in registry order, addon tabs after
  // IDE/Sandbox and before Configuration, sorted by (order, label).
  const visibleCoreTabs = CORE_TABS.filter((tab) => tabVisibility[tab.id] !== false);
  const coreTabsBeforeSettings = visibleCoreTabs
    .filter((tab) => tab.id !== "settings")
    .sort((a, b) => a.order - b.order);
  const settingsTab = visibleCoreTabs.find((tab) => tab.id === "settings");
  const visibleAddonTabs = addonTabs
    .filter((tab) => tab.visible)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const navItems: { id: string; label: string; icon: string; url: string }[] = [
    ...coreTabsBeforeSettings,
    ...visibleAddonTabs.map((tab) => ({
      id: tab.tabId,
      label: tab.label,
      icon: tab.icon,
      url: `${ADDON_URL_PREFIX}${tab.addonId}`,
    })),
    ...(settingsTab ? [settingsTab] : []),
  ];

  // --- UI State for New Sections ---
  const [aiContexts, setAiContexts] = useState([
    { id: "rag", label: "Local Neural Index", icon: Database, active: true },
    { id: "files", label: "File System Bridge", icon: FileText, active: false },
    { id: "screen", label: "Visual Cortex", icon: Monitor, active: false },
  ]);

  const toggleContext = (id: string) => {
    setAiContexts((prev) =>
      prev.map((ctx) =>
        ctx.id === id ? { ...ctx, active: !ctx.active } : ctx,
      ),
    );
  };

  const activeNodes = nodes.filter((n) => n.isActive);

  const activeAgents = aiAgents.filter((a) => a.isActive);

  const renderNavIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case "Home":
        return <Home className={className} />;
      case "Settings":
        return <Settings className={className} />;
      case "Star":
        return <Star className={className} />;
      case "Clock":
        return <Clock className={className} />;
      case "Bot":
        return <Bot className={className} />;
      case "BrainCircuit":
        return <BrainCircuit className={className} />;
      case "Plug":
        return <Plug className={className} />;
      case "MessageSquare":
        return <MessageSquare className={className} />;
      case "Eth":
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 256 417"
            className={className}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z"
              opacity="0.8"
            />
            <path d="M127.962 0L0 212.32L127.962 287.959V154.158V0Z" />
            <path
              d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L255.999 236.587L127.961 312.187Z"
              opacity="0.8"
            />
            <path d="M127.962 416.905V312.187L0 236.587L127.962 416.905Z" />
          </svg>
        );
      case "Lock":
        return <Lock className={className} />;
      case "Activity":
        return <Activity className={className} />;
      case "Cpu":
        return <Cpu className={className} />;
      case "Code2":
        return <Code2 className={className} />;
      default: {
        // Addon tab icons (§6.6) — curated PascalCase Lucide name lookup,
        // falling back to LayoutGrid for anything unrecognized.
        const AddonIcon = ADDON_ICON_MAP[iconName];
        if (AddonIcon) return <AddonIcon className={className} />;
        return <LayoutGrid className={className} />;
      }
    }
  };

  return (
    <aside
      className={`
        relative h-full bg-black text-gray-300 flex flex-col border-r border-gray-900
        transition-all duration-300 ease-in-out select-none overflow-hidden font-sans
        ${isOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-900 shrink-0 min-w-[18rem]">
        <div className="flex items-center gap-2 text-gray-200">
          <Sparkles size={20} />
          <span className="font-bold text-white tracking-widest text-lg">
            MOSAIC
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-900 rounded-md transition-colors text-gray-500 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent min-w-[18rem]">
        {/* 1. Main Navigation */}
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = currentUrl === item.url;
            const isChat = item.id === "chat";
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.url)}
                className={`
                  w-full flex items-center px-3 py-3 rounded-lg transition-all relative group
                  ${
                    isActive
                      ? "bg-indigo-900/20 text-gray-100 border border-indigo-500/10"
                      : "hover-surface-accent text-gray-400 hover:text-gray-200 border border-transparent"
                  }
                `}
              >
                {renderNavIcon(item.icon, `size-5 mr-3`)}
                <span className="text-sm font-medium tracking-wide">
                  {item.label}
                </span>
                {isActive && (
                  <div
                    className="absolute right-2 w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: "var(--primary)",
                      boxShadow:
                        "0 0 8px color-mix(in srgb, var(--primary) 60%, transparent)",
                    }}
                  />
                )}
                {isChat && activeAgents.length > 0 && !isActive && (
                  <div className="absolute right-2 flex items-center gap-1">
                    <span className="text-[10px] text-gray-300 font-mono">
                      {activeAgents.length}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: "var(--success)",
                        boxShadow:
                          "0 0 6px color-mix(in srgb, var(--success) 60%, transparent)",
                      }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* 1b. Pinned Tools */}
        {pinnedTools.length > 0 && (
          <div className="space-y-2 px-3">
            <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              <span>Pinned Tools</span>
              <Cpu size={12} />
            </div>

            {pinnedTools.map((tool) => {
              const url = `${INTERNAL_TOOL_PANEL_PREFIX}${tool.manifest.id}`;
              const isActive = currentUrl === url;

              return (
                <button
                  key={tool.manifest.id}
                  onClick={() => onNavigate(url)}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all relative group border ${
                    isActive
                      ? "bg-indigo-900/20 text-gray-100 border-indigo-500/20"
                      : "hover-surface-accent text-gray-400 hover:text-gray-200 border-transparent"
                  }`}
                >
                  {(() => {
                    const IconComp = TOOL_ICON_MAP[tool.manifest.icon ?? ""] ?? Cpu;
                    return <IconComp size={16} className="mr-3 text-indigo-400" />;
                  })()}
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm block truncate">{tool.manifest.displayName}</span>
                    <span className="text-[10px] text-gray-600 font-mono block truncate">
                      v{tool.manifest.version}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Active AI Agents */}
        {activeAgents.length > 0 && (
          <div className="space-y-2 px-3">
            <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              <span>Active Agents</span>
              <Bot size={12} />
            </div>

            {activeAgents.map((agent) => {
              const providerColor = PROVIDER_INFO[agent.provider].color;
              return (
                <button
                  key={agent.id}
                  onClick={() => onNavigate(INTERNAL_CHAT_URL)}
                  className="w-full flex items-center px-3 py-2.5 rounded-lg relative group cursor-pointer hover-surface-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full mr-3"
                    style={{
                      backgroundColor: providerColor,
                      boxShadow: `0 0 8px ${providerColor}`,
                    }}
                  />
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm text-gray-300 block truncate">
                      {agent.name}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono truncate block">
                      {agent.model}
                    </span>
                  </div>
                  <MessageSquare
                    size={14}
                    className="text-gray-600 group-hover:text-gray-200 transition-colors"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* 3. AI Context / Neural Bridges */}
        <div className="space-y-2 px-3">
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span>Neural Bridges</span>
            <Cpu size={12} />
          </div>

          {aiContexts.map((ctx) => (
            <div
              key={ctx.id}
              className="w-full flex items-center px-3 py-2.5 rounded-lg relative group cursor-pointer hover-surface-accent transition-colors"
              onClick={() => toggleContext(ctx.id)}
            >
              <ctx.icon
                className={`size-4 transition-colors mr-3 ${
                  ctx.active ? "text-gray-100" : "text-gray-600"
                }`}
              />

              <div className="flex-1 flex items-center justify-between">
                <span
                  className={`text-sm ${
                    ctx.active ? "text-gray-200" : "text-gray-500"
                  }`}
                >
                  {ctx.label}
                </span>

                {/* Techy Toggle */}
                <div
                  className={`w-8 h-1.5 rounded-full transition-colors duration-200 relative ${
                    ctx.active ? "bg-indigo-900" : "bg-gray-800"
                  }`}
                >
                  <div
                    className={`absolute -top-1 w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200 ${
                      ctx.active
                        ? "left-[18px] bg-indigo-500 glow-primary"
                        : "left-0 bg-gray-600"
                    }`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Hypercycle Grid - Nodes */}
        <div className="space-y-2 px-3">
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span>Hypercycle Grid</span>
            <button
              onClick={() => onNavigate(INTERNAL_SETTINGS_URL + "#nodes")}
              className="p-1 hover-surface-accent rounded text-gray-500 hover:text-indigo-400 transition-colors"
              title="Node Settings"
            >
              <Settings size={12} />
            </button>
          </div>

          {nodes.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-600">No nodes configured</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nodes.map((node) => {
                const status = nodeStatuses[node.id];
                const isLive = status?.isLive ?? false;
                const isChecking = status?.checking ?? false;
                const latency = status?.latency;

                // Determine status color
                let statusColor = "var(--muted)"; // Inactive
                let statusShadow = "";
                if (node.isActive) {
                  if (isLive) {
                    statusColor = "var(--success)";
                    statusShadow =
                      "0 0 8px color-mix(in srgb, var(--success) 60%, transparent)";
                  } else if (status?.lastChecked) {
                    statusColor = "var(--danger)";
                    statusShadow =
                      "0 0 8px color-mix(in srgb, var(--danger) 60%, transparent)";
                  } else {
                    statusColor = "var(--warning)";
                    statusShadow =
                      "0 0 8px color-mix(in srgb, var(--warning) 60%, transparent)";
                  }
                }

                return (
                  <div
                    key={node.id}
                    className={`bg-gray-900/50 rounded-xl p-3 border border-gray-800 transition-colors ${
                      node.licenseKey ? "cursor-pointer hover:border-gray-600 hover:bg-gray-800/50" : ""
                    }`}
                    onClick={() => {
                      if (node.licenseKey) {
                        setSelectedNodeLicense(node.licenseKey);
                      }
                    }}
                  >
                    {/* Header row: status dot + name + toggle */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: statusColor,
                            boxShadow: statusShadow,
                          }}
                        />
                        <span
                          className={`text-xs font-mono ${
                            node.isActive
                              ? isLive
                                ? "text-emerald-400"
                                : "text-gray-400"
                              : "text-gray-500"
                          }`}
                        >
                          {node.isActive
                            ? isLive
                              ? "LIVE"
                              : "OFFLINE"
                            : "INACTIVE"}
                        </span>
                      </div>
                      {/* Toggle button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.electronAPI?.nodes?.update) {
                            await window.electronAPI.nodes.update(node.id, {
                              isActive: !node.isActive,
                            });
                          }
                        }}
                        className="text-gray-500 hover:text-white transition-colors"
                        title={node.isActive ? "Deactivate" : "Activate"}
                      >
                        <Power size={14} />
                      </button>
                    </div>

                    {/* Node name */}
                    <div className="text-sm text-gray-300 mb-2 truncate">
                      {node.name}
                    </div>

                    {/* Stats row */}
                    {node.isActive && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Latency</span>
                          <span className="font-mono text-gray-200">
                            {isChecking ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : latency !== null && latency !== undefined ? (
                              `${latency}ms`
                            ) : (
                              "--"
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 h-0.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isLive ? "bg-indigo-500" : "bg-gray-700"
                            }`}
                            style={{ width: isLive ? "100%" : "0%" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-900 shrink-0 bg-black min-w-[18rem]">
        <button
          onClick={() => onNavigate(INTERNAL_SETTINGS_URL + "#agents")}
          className="flex items-center justify-center w-full bg-indigo-900/20 hover:bg-indigo-900/40 text-gray-100 border border-indigo-500/20 rounded-lg p-3 transition-all hover:scale-[1.02]"
        >
          <Plus size={16} />
          <span className="ml-2 text-xs font-bold tracking-wider uppercase">
            Add AI Agent
          </span>
        </button>
      </div>

      {/* Node Mini Detail Panel — slides in when a node card with a licenseKey
          is clicked. Deliberately minimal (§9.2) — only what Sidebar already
          computes for the node cards themselves; the deep-link CTA inside
          points to the HyperInsight addon for anything richer. */}
      {selectedNodeLicense &&
        (() => {
          const selectedNode = nodes.find((n) => n.licenseKey === selectedNodeLicense);
          if (!selectedNode) return null;
          const status = nodeStatuses[selectedNode.id];
          return (
            <NodeMiniDetailPanel
              licenseKey={selectedNodeLicense}
              name={selectedNode.name}
              isActive={selectedNode.isActive}
              isLive={status?.isLive ?? false}
              checking={status?.checking ?? false}
              lastChecked={status?.lastChecked ?? null}
              latency={status?.latency ?? null}
              sidebarOpen={isOpen}
              onClose={() => setSelectedNodeLicense(null)}
              onNavigate={onNavigate}
            />
          );
        })()}
    </aside>
  );
};
