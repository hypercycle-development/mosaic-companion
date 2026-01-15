import React, { useEffect, useState, useRef, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  Save,
  Layout,
  Bot,
  Plus,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Cpu,
  Key,
  Server,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  AIAgentConfig,
  AIProvider,
  DEFAULT_MODELS,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";

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
}) => {
  // Ref for scrolling to sections
  const nodesSectionRef = useRef<HTMLElement>(null);

  // Scroll to section when scrollSection prop is set
  useEffect(() => {
    if (scrollSection === "nodes" && nodesSectionRef.current) {
      nodesSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [scrollSection]);

  // Internal state for when external state isn't provided
  const [internalAgents, setInternalAgents] = useState<AIAgentConfig[]>([]);

  // Use external state if provided, otherwise use internal state
  const aiAgents = externalAgents ?? internalAgents;
  const setAiAgents = externalSetAiAgents ?? setInternalAgents;
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<
    Record<
      string,
      { status: "idle" | "testing" | "success" | "error"; message?: string }
    >
  >({});

  // Update settings state for auto-updater
  const [updateSettings, setUpdateSettingsState] = useState<{
    autoDownload: boolean;
    titleBarStyle?: string;
  }>({
    autoDownload: false,
    titleBarStyle: "hidden",
  });

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
    value: boolean | string
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
    updates: Partial<HypercycleNode>
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

  // Create new agent with default values
  const createNewAgent = (): AIAgentConfig => ({
    id: `agent-${Date.now()}`,
    name: "New AI Agent",
    provider: "claude",
    apiKey: "",
    model: DEFAULT_MODELS.claude[0],
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    createdAt: Date.now(),
  });

  const addAgent = () => {
    const newAgent = createNewAgent();
    setAiAgents([...aiAgents, newAgent]);
    setExpandedAgent(newAgent.id);
  };

  const updateAgent = (id: string, updates: Partial<AIAgentConfig>) => {
    setAiAgents(
      aiAgents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent
      )
    );
  };

  const deleteAgent = (id: string) => {
    setAiAgents(aiAgents.filter((agent) => agent.id !== id));
    if (expandedAgent === id) setExpandedAgent(null);
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const testConnection = async (agent: AIAgentConfig) => {
    setTestResults((prev) => ({ ...prev, [agent.id]: { status: "testing" } }));

    const result = await AIService.testConnection(agent);

    setTestResults((prev) => ({
      ...prev,
      [agent.id]: {
        status: result.success ? "success" : "error",
        message: result.message,
      },
    }));

    // Clear result after 5 seconds
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [agent.id]: { status: "idle" } }));
    }, 15000);
  };

  const handleProviderChange = (agentId: string, provider: AIProvider) => {
    const defaultModel = DEFAULT_MODELS[provider][0] || "";
    const baseUrl = PROVIDER_INFO[provider].baseUrl;
    updateAgent(agentId, {
      provider,
      model: defaultModel,
      baseUrl: provider === "custom" ? "" : baseUrl,
    });
  };
  const saveAgent = async (agent: AIAgentConfig) => {
    const result = await window.electronAPI.aiAgents.add(agent);
    if (result.success) {
      // Reload the agents list to sync with database
      const updatedAgents = await window.electronAPI.aiAgents.get();
      if (updatedAgents) {
        setAiAgents(updatedAgents);
      }
      // Collapse the form and show success toast
      setExpandedAgent(null);
      toast.success("Agent saved successfully");
      console.log("agent saved");
    } else {
      toast.error(result.error || "Failed to save agent");
    }
  };
  useEffect(() => {
    // Set initial array of agents
    const getAgents = async () => {
      const result = await window.electronAPI.aiAgents.get();
      if (result) {
        setAiAgents(result);
      } else {
        console.log("No ai agents found");
      }
    };
    getAgents();
  }, []);
  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 animate-in slide-in-from-bottom-4 duration-300 text-gray-100 font-sans">
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-800 pb-4 tracking-tight">
        System Configuration
      </h1>

      <div className="space-y-8">
        {/* Interface Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Layout size={20} />
            Interface Settings
          </h2>
          <div className="space-y-4">
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
                  Choose "Default" for system window controls (min/max/close).
                </p>
              </div>
              <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "hidden") return;

                    // Show 3-button dialog: Apply Now (0), Apply Later (1), Cancel (2)
                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return; // Cancel

                    // Save the setting
                    await handleUpdateSettingChange("titleBarStyle", "hidden");

                    // Apply Now triggers restart, Apply Later just saves
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
                        ? "bg-gray-800 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }
                  `}
                >
                  Hidden
                </button>
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "default") return;

                    // Show 3-button dialog: Apply Now (0), Apply Later (1), Cancel (2)
                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return; // Cancel

                    // Save the setting
                    await handleUpdateSettingChange("titleBarStyle", "default");

                    // Apply Now triggers restart, Apply Later just saves
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
                        ? "bg-indigo-600 text-white shadow-sm"
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
          </div>
        </section>

        {/* AI Agents Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
              <Bot size={20} />
              AI Neural Agents
            </h2>
            <button
              onClick={addAgent}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all hover:scale-[1.02]"
            >
              <Plus size={16} />
              <span className="text-xs font-bold tracking-wider uppercase">
                Add Agent
              </span>
            </button>
          </div>

          {aiAgents.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
              <Cpu className="mx-auto size-12 text-gray-600 mb-4" />
              <p className="text-gray-500 mb-2">No AI agents configured</p>
              <p className="text-sm text-gray-600">
                Add an agent to start chatting with AI models
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aiAgents.map((agent) => {
                const isExpanded = expandedAgent === agent.id;
                const testResult = testResults[agent.id] || { status: "idle" };
                const providerColor = PROVIDER_INFO[agent.provider].color;

                return (
                  <div
                    key={agent.id}
                    className={`
                      border rounded-xl transition-all duration-300 overflow-hidden
                      ${
                        isExpanded
                          ? "border-indigo-500/50 bg-gray-950/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700"
                      }
                    `}
                  >
                    {/* Agent Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedAgent(isExpanded ? null : agent.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: agent.isActive
                              ? providerColor
                              : "#4B5563",
                            boxShadow: agent.isActive
                              ? `0 0 10px ${providerColor}`
                              : "none",
                          }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-200">
                            {agent.name}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">
                            {PROVIDER_INFO[agent.provider].name} • {agent.model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {testResult.status === "success" && (
                          <CheckCircle className="size-5 text-emerald-500" />
                        )}
                        {testResult.status === "error" && (
                          <XCircle className="size-5 text-red-500" />
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            deleteAgent(agent.id);
                            const result =
                              await window.electronAPI.aiAgents.delete(
                                agent.id
                              );
                            if (result?.success) {
                              toast.success("Agent deleted successfully");
                            } else {
                              toast.error("Failed to delete agent");
                            }
                          }}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Configuration */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-5 border-t border-gray-800 pt-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Agent Name */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Sparkles size={12} />
                              Agent Name
                            </span>
                            <input
                              type="text"
                              value={agent.name}
                              onChange={(e) =>
                                updateAgent(agent.id, { name: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                            />
                          </label>

                          {/* Provider Selection */}
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Server size={12} />
                              Provider
                            </span>
                            <select
                              value={agent.provider}
                              onChange={(e) =>
                                handleProviderChange(
                                  agent.id,
                                  e.target.value as AIProvider
                                )
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                            >
                              {Object.entries(PROVIDER_INFO).map(
                                ([key, info]) => (
                                  <option key={key} value={key}>
                                    {info.name}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>

                        {/* API Key */}
                        <label className="block">
                          <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                            <Key size={12} />
                            API Key
                          </span>
                          <div className="relative">
                            <input
                              type={showApiKeys[agent.id] ? "text" : "password"}
                              value={agent.apiKey}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  apiKey: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 pr-10 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                              placeholder="sk-... or API key"
                            />
                            <button
                              type="button"
                              onClick={() => toggleApiKeyVisibility(agent.id)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                            >
                              {showApiKeys[agent.id] ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </label>

                        {/* Model & Base URL */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Cpu size={12} />
                              Model
                            </span>
                            {agent.provider === "custom" ? (
                              <input
                                type="text"
                                value={agent.model}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    model: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                placeholder="model-name"
                              />
                            ) : (
                              <select
                                value={agent.model}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    model: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                              >
                                {DEFAULT_MODELS[agent.provider].map((model) => (
                                  <option key={model} value={model}>
                                    {model}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>

                          {(agent.provider === "custom" ||
                            agent.provider === "ollama") && (
                            <label className="block">
                              <span className="text-sm text-gray-400 mb-1 block">
                                Base URL
                              </span>
                              <input
                                type="text"
                                value={agent.baseUrl || ""}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    baseUrl: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                placeholder="http://localhost:11434"
                              />
                            </label>
                          )}
                        </div>

                        {/* Advanced Settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Zap size={12} />
                              Max Tokens
                            </span>
                            <input
                              type="number"
                              value={agent.maxTokens || 4096}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  maxTokens: parseInt(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                              min={1}
                              max={128000}
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Thermometer size={12} />
                              Temperature
                            </span>
                            <input
                              type="number"
                              value={agent.temperature || 0.7}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  temperature: parseFloat(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                              min={0}
                              max={2}
                              step={0.1}
                            />
                          </label>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">
                              Active
                            </span>
                            <button
                              onClick={() =>
                                updateAgent(agent.id, {
                                  isActive: !agent.isActive,
                                })
                              }
                              className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                ${
                                  agent.isActive
                                    ? "bg-emerald-600"
                                    : "bg-gray-700"
                                }
                              `}
                            >
                              <span
                                className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                                ${
                                  agent.isActive
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }
                              `}
                              />
                            </button>
                          </div>

                          <button
                            onClick={() => testConnection(agent)}
                            disabled={
                              !agent.apiKey || testResult.status === "testing"
                            }
                            className={`
                              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium
                              ${
                                testResult.status === "testing"
                                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                                  : testResult.status === "success"
                                  ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/30"
                                  : testResult.status === "error"
                                  ? "bg-red-900/30 text-red-400 border border-red-500/30"
                                  : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                              }
                            `}
                          >
                            {testResult.status === "testing" ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <TestTube size={14} />
                                Test Connection
                              </>
                            )}
                          </button>
                        </div>

                        {/* Test Result Message */}
                        {testResult.message && (
                          <p
                            className={`text-sm ${
                              testResult.status === "success"
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {testResult.message}
                          </p>
                        )}
                        <div className="w-full flex justify-end">
                          <button
                            onClick={() => saveAgent(agent)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all hover:scale-[1.02]"
                          >
                            <span className="text-xs font-bold tracking-wider uppercase">
                              Save
                            </span>
                          </button>{" "}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

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
                          ? "border-indigo-500/50 bg-gray-950/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:border-gray-700 "
                      }`}
                  >
                    {/* Node Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:border-gray-700 transition-colors"
                      onClick={() =>
                        setExpandedNode(
                          expandedNode === node.id ? null : node.id
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
                  Check if a new version of Mosaic Browser is available.
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
                    !updateSettings.autoDownload
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
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-8">
          <button className="flex items-center gap-2 px-6 py-2 bg-green-600/10 text-green-400 border border-green-600/30 rounded-lg font-mono text-xs tracking-widest hover:bg-green-600/20 transition-colors">
            <Save size={14} />
            CONFIGURATION_SYNCED
          </button>
        </div>
      </div>

      <ToastContainer theme="dark" />
    </div>
  );
};
