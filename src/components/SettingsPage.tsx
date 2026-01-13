import React, { useEffect, useState } from "react";
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
}) => {
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
  const [updateSettings, setUpdateSettingsState] = useState({
    autoDownload: false,
  });

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

  // Helper to update a single setting
  const handleUpdateSettingChange = async (
    key: keyof typeof updateSettings,
    value: boolean
  ) => {
    if (window.electronAPI?.setUpdateSettings) {
      const newSettings = await window.electronAPI.setUpdateSettings({
        [key]: value,
      });
      setUpdateSettingsState(newSettings);
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
    }, 5000);
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
      console.log("Agent added!");
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
                            await window.electronAPI.aiAgents.delete(agent.id);
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
    </div>
  );
};
