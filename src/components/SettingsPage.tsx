// @ts-nocheck
import React, { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import {
  Save,
  Layout,
  Plus,
  Trash2,
  Server,
} from "lucide-react";
import { AIAgentConfig } from "../types/ai";
import GmailClient from "./GmailClient";
import { AIAgentsSettings } from "./AIAgentsSettings";
import { useTheme } from "../ThemeProvider";
import { ThemeKey } from "../themes";

interface SettingsPageProps {
  homeUrl: string;
  setHomeUrl: (url: string) => void;
  customGreeting: string;
  setCustomGreeting: (text: string) => void;
  showUrlBar?: boolean;
  setShowUrlBar?: (show: boolean) => void;
  aiAgents?: AIAgentConfig[];
  setAiAgents?: (agents: AIAgentConfig[]) => void;
  scrollSection?: string;
  onReopenOnboarding?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  homeUrl,
  setHomeUrl,
  customGreeting,
  setCustomGreeting,
  showUrlBar,
  setShowUrlBar,
  aiAgents: externalAgents,
  setAiAgents: externalSetAiAgents,
  scrollSection,
  onReopenOnboarding,
}) => {
  // Ref for scrolling to sections
  const agentsSectionRef = useRef<HTMLElement>(null);
  const nodesSectionRef = useRef<HTMLElement>(null);

  // Scroll to section when scrollSection prop is set
  useEffect(() => {
    const sectionMap: Record<string, React.RefObject<HTMLElement | null>> = {
      agents: agentsSectionRef,
      nodes: nodesSectionRef,
    };

    const targetSection = scrollSection ? sectionMap[scrollSection] : undefined;

    if (targetSection?.current) {
      targetSection.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [scrollSection]);

  const { themes, themeKey, setThemeKey } = useTheme();

  // Update settings state for auto-updater
  const [updateSettings, setUpdateSettingsState] = useState<{
    autoDownload: boolean;
    titleBarStyle?: string;
  }>({
    autoDownload: false,
    titleBarStyle: "hidden",
  });

  // Media auto-display setting
  const [autoDisplayMedia, setAutoDisplayMediaState] = useState(false);

  // Toast feedback for settings changes
  const [settingsToast, setSettingsToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Hypercycle Nodes state
  const [nodes, setNodes] = useState<HypercycleNode[]>([]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const MAX_NODES = 3;

  // Live status tracking for nodes
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<
      string,
      { isLive: boolean; checking: boolean; lastChecked: Date | null }
    >
  >({});

  // Check if a node is reachable
  const checkNodeConnection = useCallback(async (node: HypercycleNode) => {
    if (!node.apiHost || !node.isActive) return;

    setNodeStatuses((prev) => ({
      ...prev,
      [node.id]: { ...prev[node.id], checking: true },
    }));

    try {
      const url = `http://${node.apiHost}:${node.apiPort || "8000"}/info`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const isLive = response.ok || response.status < 500;

      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: { isLive, checking: false, lastChecked: new Date() },
      }));
    } catch {
      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: { isLive: false, checking: false, lastChecked: new Date() },
      }));
    }
  }, []);

  // Load update settings on mount
  useEffect(() => {
    const loadUpdateSettings = async () => {
      if (window.electronAPI?.getUpdateSettings) {
        const settings = await window.electronAPI.getUpdateSettings();
        setUpdateSettingsState(settings);
      }
    };
    loadUpdateSettings();
  }, []);

  // Load auto-display-media setting on mount
  useEffect(() => {
    const loadMediaSetting = async () => {
      try {
        const result = await (window as any).electronAPI?.media?.getAutoDisplay?.();
        if (result?.enabled !== undefined) {
          setAutoDisplayMediaState(result.enabled);
        }
      } catch (e) {
        console.warn("[Settings] Failed to load autoDisplayMedia setting:", e);
      }
    };
    loadMediaSetting();
  }, []);

  // Load nodes on mount
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

  // Check all active nodes when they change
  useEffect(() => {
    nodes.filter((n) => n.isActive && n.apiHost).forEach(checkNodeConnection);
  }, [nodes, checkNodeConnection]);

  // Helper to update a single setting with feedback
  const handleUpdateSettingChange = async (
    key: keyof typeof updateSettings,
    value: boolean | string,
  ) => {
    if (window.electronAPI?.setUpdateSettings) {
      const result = await window.electronAPI.setUpdateSettings({
        [key]: value,
      });

      if (result.success) {
        setUpdateSettingsState(result.settings);
        toast.success("Settings saved");
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    }
  };

  // Node handlers
  const addNewNode = async () => {
    if (nodes.length >= MAX_NODES) return;

    if (window.electronAPI?.nodes?.add) {
      const result = await window.electronAPI.nodes.add({
        name: `Node ${nodes.length + 1}`,
        apiHost: "",
        apiPort: "8000",
        hasAdminPanel: false,
        adminHost: "",
        adminPort: "8006",
        isActive: true,
      });

      if (result.success && result.nodes) {
        setNodes(result.nodes);
        // Expand the newly added node
        const newNode = result.nodes[result.nodes.length - 1];
        setExpandedNode(newNode.id);
        setSettingsToast({ type: "success", message: "Node added" });
      } else {
        setSettingsToast({
          type: "error",
          message: result.error || "Failed to add node",
        });
      }
      setTimeout(() => setSettingsToast(null), 3000);
    }
  };

  const updateNodeHandler = async (
    id: string,
    updates: Partial<HypercycleNode>,
  ) => {
    if (window.electronAPI?.nodes?.update) {
      const result = await window.electronAPI.nodes.update(id, updates);
      if (result.success && result.nodes) {
        setNodes(result.nodes);
      }
    }
  };

  const deleteNodeHandler = async (id: string) => {
    if (window.electronAPI?.nodes?.delete) {
      const result = await window.electronAPI.nodes.delete(id);
      if (result.success && result.nodes) {
        setNodes(result.nodes);
        if (expandedNode === id) setExpandedNode(null);
        setSettingsToast({ type: "success", message: "Node deleted" });
      } else {
        setSettingsToast({
          type: "error",
          message: result.error || "Failed to delete node",
        });
      }
      setTimeout(() => setSettingsToast(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 animate-in slide-in-from-bottom-4 duration-300 text-gray-100 font-sans">
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-800 pb-4 tracking-tight">
        System Configuration
      </h1>

      <div className="space-y-8">

        <AIAgentsSettings
          aiAgents={externalAgents}
          setAiAgents={externalSetAiAgents}
          sectionRef={agentsSectionRef}
        />

        {/* Hypercycle Nodes Section */}
        <section
          id="nodes"
          ref={nodesSectionRef}
          className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
              <Server size={20} />
              Hypercycle Nodes
            </h2>
            <button
              onClick={addNewNode}
              disabled={nodes.length >= MAX_NODES}
              className={`flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all hover:scale-[1.02] ${
                nodes.length >= MAX_NODES ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Plus size={16} />
              <span className="text-xs font-bold tracking-wider uppercase">
                Add Node
              </span>
            </button>
          </div>

          {nodes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
              <Server className="mx-auto size-12 text-gray-600 mb-4" />
              <p className="text-gray-500 mb-2">No nodes configured</p>
              <p className="text-sm text-gray-600">
                Add a Hypercycle Node to manage your network
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {nodes.map((node) => {
                const status = nodeStatuses[node.id];
                const isLive = status?.isLive ?? false;

                // Determine status color (same as sidebar)
                let statusColor = "bg-gray-500"; // Inactive/default
                if (node.isActive) {
                  if (!node.apiHost) {
                    statusColor = "bg-yellow-500"; // Not configured
                  } else if (isLive) {
                    statusColor = "bg-emerald-500"; // Live
                  } else if (status?.lastChecked) {
                    statusColor = "bg-red-500"; // Offline
                  } else {
                    statusColor = "bg-yellow-500"; // Pending check
                  }
                }

                return (
                  <div
                    key={node.id}
                    className={`bg-gray-900/30 border rounded-xl overflow-hidden 
                      ${
                        expandedNode === node.id
                          ? "border-indigo-500/50 bg-gray-950/50 glow-primary"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:border-gray-700 "
                      }`}
                  >
                    {/* Node Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:border-gray-700 transition-colors"
                      onClick={() =>
                        setExpandedNode(
                          expandedNode === node.id ? null : node.id,
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${statusColor}`}
                        />
                        <span className="text-gray-200 font-medium">
                          {node.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {node.apiHost
                            ? `${node.apiHost}:${node.apiPort || "8000"}`
                            : "Not configured"}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNodeHandler(node.id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Expanded Node Form */}
                    {expandedNode === node.id && (
                      <div className="p-4 border-t border-gray-700 space-y-4">
                        {/* Node Name */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Node Name
                          </label>
                          <input
                            type="text"
                            value={node.name}
                            onChange={(e) =>
                              updateNodeHandler(node.id, {
                                name: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                            placeholder="My Node"
                          />
                        </div>

                        {/* Main API */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Main API (Port 8000)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={node.apiHost}
                              onChange={(e) =>
                                updateNodeHandler(node.id, {
                                  apiHost: e.target.value,
                                })
                              }
                              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                              placeholder="192.168.1.100 or localhost"
                            />
                            <input
                              type="text"
                              value={node.apiPort || ""}
                              onChange={(e) =>
                                updateNodeHandler(node.id, {
                                  apiPort: e.target.value,
                                })
                              }
                              className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                              placeholder="8000"
                            />
                          </div>
                        </div>

                        {/* Admin Panel Toggle */}
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-gray-200 font-medium block">
                              Enable Admin Panel
                            </span>
                            <p className="text-sm text-gray-500">
                              Configure admin panel access (Port 8006)
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateNodeHandler(node.id, {
                                hasAdminPanel: !node.hasAdminPanel,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              node.hasAdminPanel
                                ? "bg-indigo-600"
                                : "bg-gray-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                node.hasAdminPanel
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Admin Panel URL (if enabled) */}
                        {node.hasAdminPanel && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">
                              Admin Panel (Port 8006)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={node.adminHost || ""}
                                onChange={(e) =>
                                  updateNodeHandler(node.id, {
                                    adminHost: e.target.value,
                                  })
                                }
                                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                                placeholder="192.168.1.100 or localhost"
                              />
                              <input
                                type="text"
                                value={node.adminPort || ""}
                                onChange={(e) =>
                                  updateNodeHandler(node.id, {
                                    adminPort: e.target.value,
                                  })
                                }
                                className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                                placeholder="8006"
                              />
                            </div>
                          </div>
                        )}

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between py-2 border-t border-gray-700 pt-4">
                          <div>
                            <span className="text-gray-200 font-medium block">
                              Node Active
                            </span>
                            <p className="text-sm text-gray-500">
                              Enable or disable this node
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateNodeHandler(node.id, {
                                isActive: !node.isActive,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              node.isActive ? "bg-emerald-600" : "bg-gray-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                node.isActive
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Interface Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Layout size={20} />
            Interface Settings
          </h2>
          <div className="space-y-4">
            <div>
              <span className="text-gray-200 font-medium block">Theme</span>
              <p className="text-sm text-gray-500 mb-3">
                Choose a color theme. Changes apply instantly and persist across
                restarts.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {themes.map((theme) => (
                  <button
                    key={theme.key}
                    onClick={() => setThemeKey(theme.key as ThemeKey)}
                    className={`w-full text-left rounded-lg p-4 border transition-all backdrop-blur-sm hover:scale-[1.01]
                      ${
                        themeKey === theme.key
                          ? "border-indigo-500/50 ring-2 ring-indigo-500/30"
                          : "border-gray-800"
                      }
                    `}
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold">
                          {theme.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {theme.description}
                        </div>
                      </div>
                      {themeKey === theme.key && (
                        <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(
                        [
                          "background",
                          "surface",
                          "accent",
                          "primary",
                          "warning",
                          "success",
                        ] as const
                      ).map((token) => (
                        <span
                          key={token}
                          className="h-8 w-8 rounded-lg border border-white/10"
                          style={{ backgroundColor: theme.colors[token] }}
                          title={token}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium block">
                  Classic Navigation Bar
                </span>
                <p className="text-sm text-gray-500">
                  Show the traditional top address bar. Disabled by default for
                  immersion.
                </p>
              </div>
              <button
                onClick={() => setShowUrlBar && setShowUrlBar(!showUrlBar)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  ${showUrlBar ? "bg-indigo-600" : "bg-gray-700"}
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${showUrlBar ? "translate-x-6" : "translate-x-1"}
                `}
                />
              </button>
            </div>

            {/* Title Bar Style Setting */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Window Title Bar
                </span>
                <p className="text-sm text-gray-500">
                  Hidden shows styled controls. Default uses native OS title
                  bar.
                </p>
              </div>
              <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "hidden") return;

                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return;

                    await handleUpdateSettingChange("titleBarStyle", "hidden");

                    if (result.buttonIndex === 0) {
                      window.electronAPI?.restartWindow?.();
                    } else {
                      toast.info("Change will apply on next restart");
                    }
                  }}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${
                      updateSettings.titleBarStyle !== "default"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }
                  `}
                >
                  Hidden
                </button>
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "default") return;

                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return;

                    await handleUpdateSettingChange("titleBarStyle", "default");

                    if (result.buttonIndex === 0) {
                      window.electronAPI?.restartWindow?.();
                    } else {
                      toast.info("Change will apply on next restart");
                    }
                  }}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${
                      updateSettings.titleBarStyle === "default"
                        ? "bg-gray-800 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }
                  `}
                >
                  Default
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Startup Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            On Startup
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-gray-200 font-medium">
                Default Landing URL
              </span>
              <p className="text-sm text-gray-500 mb-2">
                The page that opens when you click Home or open a new tab.
              </p>
              <input
                type="text"
                value={homeUrl}
                onChange={(e) => setHomeUrl(e.target.value)}
                className="w-full max-w-lg px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 placeholder-gray-600"
                placeholder="browser://home"
              />
            </label>

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Replay Onboarding
                </span>
                <p className="text-sm text-gray-500">
                  Open the welcome flow again to review features and setup.
                </p>
              </div>
              <button
                onClick={() => onReopenOnboarding?.()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Open Onboarding
              </button>
            </div>
          </div>
        </section>

        {/* Updates Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            Updates
          </h2>
          <div className="space-y-4">
            {/* Check for Updates Button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium block">
                  Software Updates
                </span>
                <p className="text-sm text-gray-500">
                  Check if a new version of Mosaic Companion is available.
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.electronAPI?.checkForUpdates) {
                    window.electronAPI.checkForUpdates();
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Check for Updates
              </button>
            </div>

            {/* Auto-download Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Download updates automatically
                </span>
                <p className="text-sm text-gray-500">
                  Download new versions in the background without asking.
                </p>
              </div>
              <button
                onClick={() =>
                  handleUpdateSettingChange(
                    "autoDownload",
                    !updateSettings.autoDownload,
                  )
                }
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  ${
                    updateSettings.autoDownload
                      ? "bg-indigo-600"
                      : "bg-gray-700"
                  }
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${
                    updateSettings.autoDownload
                      ? "translate-x-6"
                      : "translate-x-1"
                  }
                `}
                />
              </button>
            </div>

            {/* Auto-display media Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Auto-display tool media
                </span>
                <p className="text-sm text-gray-500">
                  When enabled, images generated by AI tools (e.g. HyperInsight, AIM nodes) are shown
                  inline immediately. When disabled (default), a confirmation prompt appears first.
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !autoDisplayMedia;
                  try {
                    const result = await (window as any).electronAPI?.media?.setAutoDisplay?.(next);
                    if (result?.success !== false) {
                      setAutoDisplayMediaState(next);
                      toast.success("Settings saved");
                    } else {
                      toast.error(result?.error || "Failed to save media setting");
                    }
                  } catch (e) {
                    toast.error("Failed to save media setting");
                  }
                }}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 shrink-0
                  ${autoDisplayMedia ? "bg-indigo-600" : "bg-gray-700"}
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${autoDisplayMedia ? "translate-x-6" : "translate-x-1"}
                `}
                />
              </button>
            </div>
          </div>
        </section>


        <section>
          <GmailClient />
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-8">
          <button className="flex items-center gap-2 px-6 py-2 bg-green-600/10 text-green-400 border border-green-600/30 rounded-lg font-mono text-xs tracking-widest hover:bg-green-600/20 transition-colors">
            <Save size={14} />
            CONFIGURATION_SYNCED
          </button>
        </div>
      </div>
    </div>
  );
};

