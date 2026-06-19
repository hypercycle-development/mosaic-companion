import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
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
  Info,
  BookOpen,
  X,
} from "lucide-react";
import {
  AIAgentConfig,
  AIProvider,
  DEFAULT_MODELS,
  HypercycleBackend,
  PROVIDER_INFO,
} from "../types/ai";
import { SoulGrade } from "../types/soul";
import { AIService } from "../services/AIService";
import { SoulSelector } from "./SoulSelector";
import { HypercycleBalancePanel } from "./HypercycleBalancePanel";
import {
  getHypercycleAimIndex,
  getHypercycleAimPath,
  getHypercycleAppPort,
  getHypercycleServerPort,
  getHypercycleStreamPort,
  HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN,
  HYPERCYCLE_AIM_INDEX_DEFAULT_TODA,
  HYPERCYCLE_AIM_PORT,
  HYPERCYCLE_BASECHAIN_APP_PORT,
  HYPERCYCLE_BASECHAIN_SERVER_PORT,
  HYPERCYCLE_BASECHAIN_STREAM_PORT,
  HYPERCYCLE_NONCE_PORT,
  HYPERCYCLE_STREAM_PORT,
} from "../services/hypercycleAgent";

/** Hypercycle: chain wallet / TODA Twin must be configured before activation. */
function hypercycleWalletReady(
  agent: AIAgentConfig,
  evmWallet: boolean,
  todaOk: boolean,
): boolean {
  if (agent.provider !== "hypercycle") return true;
  return agent.hypercycleBackend === "basechain" ? evmWallet : todaOk;
}

/** AIService.testConnection only needs an API key for cloud/custom providers. */
function providerRequiresApiKeyForConnectionTest(p: AIProvider): boolean {
  return p !== "ollama" && p !== "ollama-cloud" && p !== "hypercycle" && p !== "hermes" && p !== "hermes-aim" && p !== "hermes-api";
}

const CUSTOM_MODEL_OPTION = "__custom_model__";

function providerRequiresApiKeyForDynamicModelFetch(p: AIProvider): boolean {
  return p === "openai" || p === "claude" || p === "gemini" || p === "ollama-cloud";
}

function normalizeGeminiModelId(modelId: string): string {
  return modelId.replace(/^models\//, "").trim();
}

function normalizeModelList(models: string[]): string[] {
  return Array.from(new Set(models.map((m) => m.trim()).filter(Boolean)));
}

interface AIAgentsSettingsProps {
  aiAgents?: AIAgentConfig[];
  setAiAgents?: (agents: AIAgentConfig[]) => void;
  sectionRef?: React.RefObject<HTMLElement | null>;
}

export const AIAgentsSettings: React.FC<AIAgentsSettingsProps> = ({
  aiAgents: externalAgents,
  setAiAgents: externalSetAiAgents,
  sectionRef,
}) => {
  const [internalAgents, setInternalAgents] = useState<AIAgentConfig[]>([]);

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
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  const [fetchedModelsByAgent, setFetchedModelsByAgent] = useState<
    Record<string, string[]>
  >({});
  const [isFetchingModelsByAgent, setIsFetchingModelsByAgent] = useState<
    Record<string, boolean>
  >({});
  const [customModelSelectionByAgent, setCustomModelSelectionByAgent] =
    useState<Record<string, boolean>>({});
  const [customModelInputByAgent, setCustomModelInputByAgent] = useState<
    Record<string, string>
  >({});
  const [customModelValidationByAgent, setCustomModelValidationByAgent] =
    useState<Record<string, "idle" | "loading" | "ok" | "error">>({});
  const [
    customModelValidationErrorByAgent,
    setCustomModelValidationErrorByAgent,
  ] = useState<Record<string, string>>({});
  const lastModelFetchSignatureRef = useRef<Record<string, string>>({});

  const [web3EvmWallet, setWeb3EvmWallet] = useState(false);
  const [web3TodaOk, setWeb3TodaOk] = useState(false);

  const refreshWeb3WalletGate = useCallback(async () => {
    try {
      const w = await window.electronAPI.trading.walletExists();
      const data = w as {
        success?: boolean;
        data?: { exists?: boolean };
        exists?: boolean;
      };
      const exists =
        typeof data.exists === "boolean"
          ? data.exists
          : !!(data.success && data.data?.exists);
      setWeb3EvmWallet(exists);
    } catch {
      setWeb3EvmWallet(false);
    }
    try {
      const t = await window.electronAPI.web3.todaHasConfig();
      setWeb3TodaOk(!!t?.configured);
    } catch {
      setWeb3TodaOk(false);
    }
  }, []);

  useEffect(() => {
    void refreshWeb3WalletGate();
    const unsub = window.electronAPI.web3.onWalletImported(() => {
      void refreshWeb3WalletGate();
    });
    return () => unsub();
  }, [refreshWeb3WalletGate]);

  const getBaseModelList = (provider: AIProvider): string[] =>
    DEFAULT_MODELS[provider] || [];

  const getModelOptions = (agent: AIAgentConfig): string[] => {
    const fetched = fetchedModelsByAgent[agent.id];
    if (fetched && fetched.length > 0) {
      return fetched;
    }
    return getBaseModelList(agent.provider);
  };

  const fetchProviderModels = async (
    agent: AIAgentConfig,
  ): Promise<string[]> => {
    const provider = agent.provider;
    const apiKey = agent.apiKey?.trim();
    if (!providerRequiresApiKeyForDynamicModelFetch(provider) || !apiKey) {
      return getBaseModelList(provider);
    }

    if (provider === "openai") {
      const response = await fetch(
        `${agent.baseUrl || "https://api.openai.com"}/v1/models`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`OpenAI model listing failed (${response.status})`);
      }
      const payload = await response.json();
      const ids = Array.isArray(payload?.data)
        ? payload.data.map((item: { id?: string }) => item.id || "")
        : [];
      return normalizeModelList(ids);
    }

    if (provider === "claude") {
      const response = await fetch(
        `${agent.baseUrl || "https://api.anthropic.com"}/v1/models`,
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        },
      );
      if (!response.ok) {
        throw new Error(`Anthropic model listing failed (${response.status})`);
      }
      const payload = await response.json();
      const ids = Array.isArray(payload?.data)
        ? payload.data.map((item: { id?: string }) => item.id || "")
        : [];
      return normalizeModelList(ids);
    }

    if (provider === "gemini") {
      const response = await fetch(
        `${
          agent.baseUrl || "https://generativelanguage.googleapis.com"
        }/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!response.ok) {
        throw new Error(`Gemini model listing failed (${response.status})`);
      }
      const payload = await response.json();
      const ids = Array.isArray(payload?.models)
        ? payload.models.map((item: { name?: string; id?: string }) =>
            normalizeGeminiModelId(item.name || item.id || ""),
          )
        : [];
      return normalizeModelList(ids);
    }

    if (provider === "ollama") {
      const baseUrl = agent.baseUrl || "http://localhost:11434";
      try {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          const ids = Array.isArray(data?.models)
            ? data.models.map((item: { name?: string; model?: string }) => item.name || item.model || "")
            : [];
          const dynamic = normalizeModelList(ids);
          if (dynamic.length > 0) return dynamic;
        }
      } catch (e) {
        console.warn("[AIAgentsSettings] Could not fetch Ollama models:", e);
      }
      return getBaseModelList(provider);
    }

    if (provider === "ollama-cloud") {
      // For cloud, try fetching from the cloud API if a key is set, otherwise use defaults
      const baseUrl = (agent.baseUrl || "https://ollama.com").replace(/\/$/, "");
      const apiKey = agent.apiKey?.trim();
      if (apiKey) {
        try {
          const response = await fetch(`${baseUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (response.ok) {
            const data = await response.json();
            const ids = Array.isArray(data?.data)
              ? data.data.map((item: { id?: string }) => item.id || "")
              : [];
            const dynamic = normalizeModelList(ids);
            if (dynamic.length > 0) return dynamic;
          }
        } catch (e) {
          console.warn("[AIAgentsSettings] Could not fetch Ollama Cloud models:", e);
        }
      }
      return getBaseModelList(provider);
    }

    return getBaseModelList(provider);
  };

  const validateCustomModel = async (agent: AIAgentConfig, modelId: string) => {
    const cleanedModelId = modelId.trim();
    setCustomModelValidationErrorByAgent((prev) => ({
      ...prev,
      [agent.id]: "",
    }));

    if (!cleanedModelId) {
      setCustomModelValidationByAgent((prev) => ({
        ...prev,
        [agent.id]: "idle",
      }));
      return;
    }

    if (
      !providerRequiresApiKeyForDynamicModelFetch(agent.provider) ||
      !agent.apiKey?.trim()
    ) {
      setCustomModelValidationByAgent((prev) => ({
        ...prev,
        [agent.id]: "idle",
      }));
      return;
    }

    setCustomModelValidationByAgent((prev) => ({
      ...prev,
      [agent.id]: "loading",
    }));
    try {
      const availableModels = await fetchProviderModels(agent);
      const found = availableModels.includes(cleanedModelId);
      setCustomModelValidationByAgent((prev) => ({
        ...prev,
        [agent.id]: found ? "ok" : "error",
      }));
      if (!found) {
        setCustomModelValidationErrorByAgent((prev) => ({
          ...prev,
          [agent.id]: "Model ID not found for this API key.",
        }));
      }
    } catch (error) {
      setCustomModelValidationByAgent((prev) => ({
        ...prev,
        [agent.id]: "error",
      }));
      setCustomModelValidationErrorByAgent((prev) => ({
        ...prev,
        [agent.id]: "Could not validate model ID right now.",
      }));
      console.warn(
        `[AIAgentsSettings] Could not validate custom model for ${agent.name}:`,
        error,
      );
    }
  };

  const addAgent = async () => {
    let baseName = "New AI Agent";
    let uniqueName = baseName;
    let counter = 2;

    while (
      aiAgents.some(
        (agent) => agent.name.toLowerCase() === uniqueName.toLowerCase(),
      )
    ) {
      uniqueName = `${baseName} ${counter}`;
      counter++;
    }

    const newAgent: AIAgentConfig = {
      id: `agent-${Date.now()}`,
      name: uniqueName,
      provider: "claude",
      apiKey: "",
      model: DEFAULT_MODELS.claude[0],
      maxTokens: 4096,
      temperature: 0.7,
      isActive: false,
      createdAt: Date.now(),
      // Default SOUL configuration
      soulId: "executor",
      soulOverride: "",
      capabilities: {
        enabledCapabilities: ["file_read", "memory_management", "session_search"],
        vaultBoxAccess: [],
      },
    };

    try {
      const result = await window.electronAPI.aiAgents.add(newAgent);
      if (result.success) {
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
          setExpandedAgent(newAgent.id);
          toast.success("Agent created");
        }
      } else {
        toast.error(result.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      toast.error("Failed to create agent");
    }
  };

  const updateAgent = async (id: string, updates: Partial<AIAgentConfig>) => {
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();

      if (trimmedName === "") {
        setNameErrors((prev) => ({
          ...prev,
          [id]: "Agent name is required",
        }));
        return;
      }

      const isDuplicate = aiAgents.some(
        (agent) =>
          agent.id !== id &&
          agent.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (isDuplicate) {
        setNameErrors((prev) => ({
          ...prev,
          [id]: "An agent with this name already exists",
        }));
        return;
      } else {
        setNameErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[id];
          return newErrors;
        });
      }
    }

    setAiAgents(
      aiAgents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent,
      ),
    );

    try {
      const result = await window.electronAPI.aiAgents.update(id, updates);
      if (!result.success) {
        console.error("Failed to update agent:", result.error);
        toast.error(result.error || "Failed to update agent");
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
        }
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent");
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const result = await window.electronAPI.aiAgents.delete(id);
      if (result.success) {
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
        }
        if (expandedAgent === id) setExpandedAgent(null);
        toast.success("Agent deleted");
      } else {
        toast.error(result.error || "Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    }
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const testConnection = async (agent: AIAgentConfig) => {
    setTestResults((prev) => ({ ...prev, [agent.id]: { status: "testing" } }));

    try {
      const result = await AIService.testConnection(agent);
      setTestResults((prev) => ({
        ...prev,
        [agent.id]: {
          status: result.success ? "success" : "error",
          message: result.message,
        },
      }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [agent.id]: {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        },
      }));
    }

    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [agent.id]: { status: "idle" } }));
    }, 15000);
  };

  const handleProviderChange = (agentId: string, provider: AIProvider) => {
    const defaultModel = DEFAULT_MODELS[provider][0] || "";
    const info = PROVIDER_INFO[provider];
    const patch: Partial<AIAgentConfig> = {
      provider,
      model: provider === "hypercycle" ? "" : defaultModel,
      baseUrl: provider === "custom" ? "" : info.baseUrl,
    };
    if (provider === "hypercycle") {
      patch.hypercycleBackend = "toda";
      patch.hypercycleCurrencyType = "TDN";
    }
    setFetchedModelsByAgent((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    setIsFetchingModelsByAgent((prev) => ({ ...prev, [agentId]: false }));
    setCustomModelSelectionByAgent((prev) => ({ ...prev, [agentId]: false }));
    setCustomModelInputByAgent((prev) => ({ ...prev, [agentId]: "" }));
    setCustomModelValidationByAgent((prev) => ({
      ...prev,
      [agentId]: "idle",
    }));
    setCustomModelValidationErrorByAgent((prev) => ({
      ...prev,
      [agentId]: "",
    }));
    delete lastModelFetchSignatureRef.current[agentId];
    updateAgent(agentId, patch);
  };

  useEffect(() => {
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

  useEffect(() => {
    aiAgents.forEach((agent) => {
      if (!providerRequiresApiKeyForDynamicModelFetch(agent.provider)) {
        return;
      }

      const apiKey = agent.apiKey?.trim();
      if (!apiKey) {
        setIsFetchingModelsByAgent((prev) => ({
          ...prev,
          [agent.id]: false,
        }));
        return;
      }

      const signature = `${agent.provider}|${apiKey}|${agent.baseUrl || ""}`;
      if (lastModelFetchSignatureRef.current[agent.id] === signature) {
        return;
      }
      lastModelFetchSignatureRef.current[agent.id] = signature;

      setIsFetchingModelsByAgent((prev) => ({
        ...prev,
        [agent.id]: true,
      }));

      void fetchProviderModels(agent)
        .then((models) => {
          const cleaned =
            models.length > 0 ? models : getBaseModelList(agent.provider);
          setFetchedModelsByAgent((prev) => ({
            ...prev,
            [agent.id]: cleaned,
          }));
        })
        .catch((error) => {
          setFetchedModelsByAgent((prev) => ({
            ...prev,
            [agent.id]: getBaseModelList(agent.provider),
          }));
          const providerName = PROVIDER_INFO[agent.provider]?.name ?? "Unknown";
          const warningMessage = `Could not fetch ${providerName} models with the current key. Using default model list.`;
          console.warn(`[AIAgentsSettings] ${warningMessage}`, error);
          toast.warn(warningMessage);
        })
        .finally(() => {
          setIsFetchingModelsByAgent((prev) => ({
            ...prev,
            [agent.id]: false,
          }));
        });
    });
  }, [aiAgents]);

  return (
    <section
      className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm"
      id="agents"
      ref={sectionRef}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
          <Bot size={20} />
          AI Agents
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
            const providerColor = PROVIDER_INFO[agent.provider]?.color ?? "#6B7280";

            return (
              <div
                key={agent.id}
                className={`
                  border rounded-xl transition-all duration-300 overflow-hidden
                  ${
                    isExpanded
                      ? "border-indigo-500/50 bg-gray-950/50 glow-primary"
                      : "border-gray-800 bg-gray-900/30 hover:border-gray-700"
                  }
                `}
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
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
                        {PROVIDER_INFO[agent.provider]?.name ?? "Unknown"} • {agent.model}
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

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-5 border-t border-gray-800 pt-4 animate-in slide-in-from-top-2 duration-200">
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
                          className={`w-full px-3 py-2 bg-gray-950 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100 ${
                            nameErrors[agent.id]
                              ? "border-red-500 focus:border-red-500"
                              : "border-gray-700 focus:border-indigo-500"
                          }`}
                        />
                        {nameErrors[agent.id] && (
                          <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                            <XCircle size={12} />
                            {nameErrors[agent.id]}
                          </p>
                        )}
                      </label>

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
                              e.target.value as AIProvider,
                            )
                          }
                          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                        >
                          {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                            <option key={key} value={key}>
                              {info.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {agent.provider !== "hypercycle" && agent.provider !== "hermes-aim" && agent.provider !== "hermes-api" && (
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
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                          <Cpu size={12} />
                          Model
                        </span>
                        {agent.provider === "custom" ||
                        agent.provider === "hypercycle" ? (
                          <>
                            <input
                              type="text"
                              value={agent.model}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  model: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                              placeholder={
                                agent.provider === "hypercycle"
                                  ? "Model id for AIM request body"
                                  : "model-name"
                              }
                            />
                            {agent.provider === "hypercycle" && (
                              <p className="text-xs text-gray-600 mt-1">
                                Sent as{" "}
                                <code className="text-gray-500">model</code> in{" "}
                                <code className="text-gray-500">
                                  POST …/api/aim/…/request
                                </code>{" "}
                                JSON.
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {(() => {
                              const options = getModelOptions(agent);
                              const providerNeedsKey =
                                providerRequiresApiKeyForDynamicModelFetch(
                                  agent.provider,
                                );
                              const hasApiKey = !!agent.apiKey?.trim();
                              const isLoadingModels =
                                !!isFetchingModelsByAgent[agent.id];
                              const isCustomSelected =
                                !!customModelSelectionByAgent[agent.id] ||
                                (agent.model
                                  ? !options.includes(agent.model)
                                  : false);
                              const selectedValue = isCustomSelected
                                ? CUSTOM_MODEL_OPTION
                                : agent.model;
                              const validationState =
                                customModelValidationByAgent[agent.id] ||
                                "idle";
                              const validationError =
                                customModelValidationErrorByAgent[agent.id];

                              return (
                                <>
                                  <select
                                    value={selectedValue}
                                    onChange={(e) => {
                                      const selected = e.target.value;
                                      if (selected === CUSTOM_MODEL_OPTION) {
                                        setCustomModelSelectionByAgent(
                                          (prev) => ({
                                            ...prev,
                                            [agent.id]: true,
                                          }),
                                        );
                                        setCustomModelInputByAgent((prev) => ({
                                          ...prev,
                                          [agent.id]:
                                            agent.model &&
                                            !options.includes(agent.model)
                                              ? agent.model
                                              : "",
                                        }));
                                        setCustomModelValidationByAgent(
                                          (prev) => ({
                                            ...prev,
                                            [agent.id]: "idle",
                                          }),
                                        );
                                        setCustomModelValidationErrorByAgent(
                                          (prev) => ({
                                            ...prev,
                                            [agent.id]: "",
                                          }),
                                        );
                                        return;
                                      }

                                      setCustomModelSelectionByAgent(
                                        (prev) => ({
                                          ...prev,
                                          [agent.id]: false,
                                        }),
                                      );
                                      setCustomModelValidationByAgent(
                                        (prev) => ({
                                          ...prev,
                                          [agent.id]: "idle",
                                        }),
                                      );
                                      setCustomModelValidationErrorByAgent(
                                        (prev) => ({
                                          ...prev,
                                          [agent.id]: "",
                                        }),
                                      );
                                      updateAgent(agent.id, {
                                        model: selected,
                                      });
                                    }}
                                    disabled={providerNeedsKey && !hasApiKey}
                                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isLoadingModels && (
                                      <option value="" disabled>
                                        Loading...
                                      </option>
                                    )}
                                    {options.map((model) => (
                                      <option key={model} value={model}>
                                        {model}
                                      </option>
                                    ))}
                                    <option value={CUSTOM_MODEL_OPTION}>
                                      Other / Custom
                                    </option>
                                  </select>

                                  {isLoadingModels && (
                                    <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                      Fetching models...
                                    </p>
                                  )}

                                  {providerNeedsKey && !hasApiKey && (
                                    <p className="mt-1 text-xs text-gray-500">
                                      Add an API key to fetch and select models.
                                    </p>
                                  )}

                                  {isCustomSelected && (
                                    <div className="mt-2 space-y-1.5">
                                      <input
                                        type="text"
                                        value={
                                          customModelInputByAgent[agent.id] ??
                                          agent.model ??
                                          ""
                                        }
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setCustomModelInputByAgent(
                                            (prev) => ({
                                              ...prev,
                                              [agent.id]: value,
                                            }),
                                          );
                                          setCustomModelValidationByAgent(
                                            (prev) => ({
                                              ...prev,
                                              [agent.id]: "idle",
                                            }),
                                          );
                                          setCustomModelValidationErrorByAgent(
                                            (prev) => ({
                                              ...prev,
                                              [agent.id]: "",
                                            }),
                                          );
                                          updateAgent(agent.id, {
                                            model: value,
                                          });
                                        }}
                                        onBlur={() =>
                                          validateCustomModel(
                                            agent,
                                            customModelInputByAgent[agent.id] ??
                                              agent.model ??
                                              "",
                                          )
                                        }
                                        className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                        placeholder="Enter model ID"
                                      />

                                      {validationState === "loading" && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                          <Loader2
                                            size={12}
                                            className="animate-spin"
                                          />
                                          Checking model ID...
                                        </p>
                                      )}

                                      {validationState === "ok" && (
                                        <p className="text-xs text-emerald-400">
                                          Model ID is valid for this provider
                                          key.
                                        </p>
                                      )}

                                      {(validationState === "error" ||
                                        !!validationError) && (
                                        <p className="text-xs text-red-400">
                                          {validationError ||
                                            "Model validation failed."}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </label>

                    {(agent.provider === "custom" ||
                        agent.provider === "ollama" ||
                        agent.provider === "ollama-cloud" ||
                        agent.provider === "hermes" ||
                        agent.provider === "hermes-aim" ||
                        agent.provider === "hermes-api" ||
                        agent.provider === "hypercycle") && (
                        <label className="block">
                          <span className="text-sm text-gray-400 mb-1 block">
                            {agent.provider === "hypercycle"
                              ? "Node base URL"
                              : agent.provider === "hermes" ||
                                  agent.provider === "hermes-aim" ||
                                  agent.provider === "hermes-api"
                                ? "Hermes Base URL"
                                : "Base URL"}
                          </span>
                          {agent.provider === "hypercycle" &&
                            agent.hypercycleBackend !== "basechain" && (
                              <p className="text-xs text-gray-600 mb-1.5">
                                Scheme and host only (no port). Nonce uses port
                                8000, AIM 8006, stream 4001 — added
                                automatically unless you override AIM/stream
                                URLs below.
                              </p>
                            )}
                          <input
                            type="text"
                            value={agent.baseUrl || ""}
                            onChange={(e) =>
                              updateAgent(agent.id, {
                                baseUrl: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                            placeholder={
                              agent.provider === "hypercycle"
                                ? agent.hypercycleBackend === "basechain"
                                  ? "http://207.53.252.108 or https://hyperpg.site/forward/…"
                                  : "http://207.53.252.108"
                                : agent.provider === "hermes-aim"
                                  ? "http://127.0.0.1:9000"
                                  : agent.provider === "hermes-api"
                                    ? "http://127.0.0.1:8000"
                                    : agent.provider === "hermes"
                                      ? "http://127.0.0.1:8642"
                                      : "http://localhost:11434"
                            }
                          />
                        </label>
                      )}
                    </div>

                    {agent.provider === "hypercycle" && (
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            Chain
                          </span>
                          <select
                            value={agent.hypercycleBackend || "toda"}
                            onChange={(e) =>
                              updateAgent(agent.id, {
                                hypercycleBackend: e.target
                                  .value as HypercycleBackend,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 text-sm"
                          >
                            <option value="toda">TODA</option>
                            <option value="basechain">Basechain</option>
                          </select>
                        </label>
                        {agent.hypercycleBackend !== "basechain" && (
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block">
                              Currency type
                            </span>
                            <input
                              type="text"
                              value={agent.hypercycleCurrencyType || "TDN"}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  hypercycleCurrencyType:
                                    e.target.value.trim() || "TDN",
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                              placeholder="TDN"
                            />
                          </label>
                        )}
                        <label className="block">
                          <span className="text-sm text-gray-400 mb-1 block">
                            Server port
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={getHypercycleServerPort(agent)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const fb =
                                agent.hypercycleBackend === "basechain"
                                  ? HYPERCYCLE_BASECHAIN_SERVER_PORT
                                  : HYPERCYCLE_NONCE_PORT;
                              updateAgent(agent.id, {
                                hypercycleServerPort: Number.isFinite(v)
                                  ? v
                                  : fb,
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm text-gray-400 mb-1 block">
                            App port
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={getHypercycleAppPort(agent)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const fb =
                                agent.hypercycleBackend === "basechain"
                                  ? HYPERCYCLE_BASECHAIN_APP_PORT
                                  : HYPERCYCLE_AIM_PORT;
                              updateAgent(agent.id, {
                                hypercycleAppPort: Number.isFinite(v)
                                  ? v
                                  : fb,
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                          />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            AIM index
                          </span>
                          <p className="text-xs text-gray-600 mb-1">
                            Second connection step calls{" "}
                            <code className="text-gray-500">
                              POST {getHypercycleAimPath(agent)}
                            </code>{" "}
                            on the app port (defaults: TODA{" "}
                            <code className="text-gray-500">0</code>, Basechain{" "}
                            <code className="text-gray-500">2</code>).
                          </p>
                          <input
                            type="number"
                            min={0}
                            max={999}
                            value={getHypercycleAimIndex(agent)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const fb =
                                agent.hypercycleBackend === "basechain"
                                  ? HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN
                                  : HYPERCYCLE_AIM_INDEX_DEFAULT_TODA;
                              updateAgent(agent.id, {
                                hypercycleAimIndex: Number.isFinite(v)
                                  ? Math.max(0, Math.min(999, v))
                                  : fb,
                              });
                            }}
                            className="w-full max-w-[12rem] px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                          />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            Stream port
                          </span>
                          <p className="text-xs text-gray-600 mb-1">
                            <code className="text-gray-500">POST /stream</code>
                          </p>
                          <input
                            type="number"
                            min={1}
                            max={65535}
                            value={getHypercycleStreamPort(agent)}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const fb =
                                agent.hypercycleBackend === "basechain"
                                  ? HYPERCYCLE_BASECHAIN_STREAM_PORT
                                  : HYPERCYCLE_STREAM_PORT;
                              updateAgent(agent.id, {
                                hypercycleStreamPort: Number.isFinite(v)
                                  ? v
                                  : fb,
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                          />
                        </label>
                        <div className="col-span-2">
                          <HypercycleBalancePanel
                            key={agent.id}
                            agent={agent}
                          />
                        </div>
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            Stream tx-sender override (optional)
                          </span>
                          <p className="text-xs text-gray-600 mb-1">
                            If POST /stream must use a different{" "}
                            <code className="text-gray-500">tx-sender</code>{" "}
                            than nonce/AIM (e.g.{" "}
                            <code className="text-gray-500">
                              *.hypercycle.biz.todaq.net
                            </code>
                            ), set it here. Leave empty to reuse the TODA
                            address above.
                          </p>
                          <input
                            type="text"
                            value={agent.hypercycleStreamTxSender || ""}
                            onChange={(e) =>
                              updateAgent(agent.id, {
                                hypercycleStreamTxSender: e.target.value.trim(),
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                            placeholder="Leave empty — same as nonce/AIM sender"
                          />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            tx-signature (optional)
                          </span>
                          {agent.hypercycleBackend === "basechain" ? (
                            <p className="text-xs text-gray-600 mb-1">
                              Default: EIP-191 signature of the nonce with your
                              Mosaic wallet private key. Set this field only to
                              override (e.g. debugging).
                            </p>
                          ) : (
                            <p className="text-xs text-gray-600 mb-1">
                              TODA micropay: placeholder until gateway requires
                              real signing; default is a stub value.
                            </p>
                          )}
                          <input
                            type="text"
                            value={agent.hypercycleTxSignature || ""}
                            onChange={(e) =>
                              updateAgent(agent.id, {
                                hypercycleTxSignature: e.target.value.trim(),
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                            placeholder={
                              agent.hypercycleBackend === "basechain"
                                ? "Leave empty — wallet signs nonce"
                                : "Leave empty for built-in placeholder"
                            }
                          />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-sm text-gray-400 mb-1 block">
                            tx-driver (optional)
                          </span>
                          <p className="text-xs text-gray-600 mb-1">
                            Default:{" "}
                            <code className="text-gray-500">toda_micropay</code>{" "}
                            (TODA) or{" "}
                            <code className="text-gray-500">basechain</code>{" "}
                            (Basechain). Override if your gateway expects a
                            different value.
                          </p>
                          <input
                            type="text"
                            value={agent.hypercycleTxDriver || ""}
                            onChange={(e) =>
                              updateAgent(agent.id, {
                                hypercycleTxDriver: e.target.value.trim(),
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                            placeholder="Leave empty for default"
                          />
                        </label>
                      </div>
                    )}

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

                    <div className="flex items-center justify-between py-3 px-1">
                      <div>
                        <span className="text-sm text-gray-300 flex items-center gap-1.5">
                          Rich Visual Responses
                          <span className="relative group">
                            <Info
                              size={13}
                              className="text-gray-500 cursor-help"
                            />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-lg">
                              Enables the agent to display data using visual
                              elements like charts, tables, and cards instead of
                              plain text. This may increase token usage per
                              response. Enable on models where richer output is
                              worth the cost.
                            </span>
                          </span>
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Render charts, tables, and cards inline in chat
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          updateAgent(agent.id, {
                            richUI: !agent.richUI,
                          })
                        }
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
                          ${agent.richUI ? "bg-indigo-600" : "bg-gray-700"}
                        `}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                            ${agent.richUI ? "translate-x-6" : "translate-x-1"}
                          `}
                        />
                      </button>
                    </div>

                    {/* ─── Attached Skills ─────────────────────────── */}
                    <div className="pt-4 border-t border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300 flex items-center gap-1.5">
                          <BookOpen size={14} />
                          Attached Skills
                          <span className="relative group">
                            <Info size={13} className="text-gray-500 cursor-help" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-lg"
                            >
                              Skill files from ~/.hermes/skills/ are injected into the
                              agent's system prompt before every API call. The agent
                              acquires the full skill context during conversation.
                            </span>
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {agent.skills?.length || 0} attached
                        </span>
                      </div>

                      {/* Skill chips */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(agent.skills || []).map((skillName) => (
                          <span
                            key={skillName}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-900/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-400"
                          >
                            {skillName}
                            <button
                              onClick={() =>
                                updateAgent(agent.id, {
                                  skills: (agent.skills || []).filter((s) => s !== skillName),
                                })
                              }
                              className="hover:text-cyan-200 transition-colors"
                              title={`Remove ${skillName}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        {(agent.skills || []).length === 0 && (
                          <span className="text-xs text-gray-600 italic">
                            No skills attached. Add skills to enhance this agent.
                          </span>
                        )}
                      </div>

                        {/* Add skill dropdown */}
                      <div className="flex items-center gap-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const skillName = e.target.value;
                            if (!skillName) return;
                            if (agent.skills?.includes(skillName)) {
                              toast.info(`Skill "${skillName}" is already attached`);
                              return;
                            }
                            updateAgent(agent.id, {
                              skills: [...(agent.skills || []), skillName],
                            });
                            toast.success(`Attached skill: ${skillName}`);
                          }}
                          className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all text-gray-100 text-sm"
                        >
                          <option value="">+ Add a skill...</option>
                          {/* Dynamically loaded from StargateSkillRegistry */}
                          {(() => {
                            try {
                              const registry = require("../services/StargateSkillRegistry").stargateRegistry;
                              const allSkills = registry.getSkills();
                              const available = allSkills
                                .filter((s: any) => !(agent.skills || []).includes(s.name))
                                .sort((a: any, b: any) => (b.usageCount || 0) - (a.usageCount || 0));
                              return available.map((s: any) => (
                                <option key={s.name} value={s.name}>
                                  {s.name} — {s.description?.slice(0, 40) || s.category}
                                </option>
                              ));
                            } catch {
                              // Fallback if registry not yet initialized
                              return null;
                            }
                          })()}
                        </select>
                      </div>

                      {/* Skill preload status */}
                      {agent.skills && agent.skills.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          💡 When you chat with {agent.name}, the full skill content from{" "}
                          <code className="text-gray-400">~/.hermes/skills/...</code>
                          will be injected into the system prompt before each API call.
                        </div>
                      )}
                    </div>

                    {/* ─── Agent Soul / Identity ───────────────────── */}
                    <div className="pt-4 border-t border-gray-800">
                      <SoulSelector
                        selectedSoulId={agent.soulId || null}
                        customSoulMarkdown={agent.soulOverride || null}
                        soulGrade={agent.soulGrade}
                        onSelectSoul={(soulId) =>
                          updateAgent(agent.id, {
                            soulId,
                            soulOverride: "", // Clear override when selecting predefined
                          })
                        }
                        onCustomizeSoul={(customMarkdown) =>
                          updateAgent(agent.id, {
                            soulOverride: customMarkdown,
                          })
                        }
                        onGradeChange={(grade) =>
                          updateAgent(agent.id, {
                            soulGrade: grade,
                          })
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-4 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400">Active</span>
                          <button
                            type="button"
                            disabled={
                              !agent.isActive &&
                              agent.provider === "hypercycle" &&
                              !hypercycleWalletReady(
                                agent,
                                web3EvmWallet,
                                web3TodaOk,
                              )
                            }
                            title={
                              !agent.isActive &&
                              agent.provider === "hypercycle" &&
                              !hypercycleWalletReady(
                                agent,
                                web3EvmWallet,
                                web3TodaOk,
                              )
                                ? agent.hypercycleBackend === "basechain"
                                  ? "Import an EVM wallet in Web3 (Base) first."
                                  : "Configure TODA Twin (hostname + API key) in Web3 first."
                                : undefined
                            }
                            onClick={() => {
                              if (
                                !agent.isActive &&
                                agent.provider === "hypercycle" &&
                                !hypercycleWalletReady(
                                  agent,
                                  web3EvmWallet,
                                  web3TodaOk,
                                )
                              ) {
                                toast.warning(
                                  agent.hypercycleBackend === "basechain"
                                    ? "Import an EVM wallet in Web3 (Base) before activating this agent."
                                    : "Configure TODA Twin in Web3 before activating this agent.",
                                );
                                return;
                              }
                              updateAgent(agent.id, {
                                isActive: !agent.isActive,
                              });
                            }}
                            className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            disabled:opacity-40 disabled:cursor-not-allowed
                            ${
                              agent.isActive ? "bg-emerald-600" : "bg-gray-700"
                            }
                          `}
                          >
                            <span
                              className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                            ${
                              agent.isActive ? "translate-x-6" : "translate-x-1"
                            }
                          `}
                            />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => testConnection(agent)}
                          disabled={
                            testResult.status === "testing" ||
                            (providerRequiresApiKeyForConnectionTest(
                              agent.provider,
                            ) &&
                              !agent.apiKey?.trim())
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
                      {agent.provider === "hypercycle" &&
                        !agent.isActive &&
                        !hypercycleWalletReady(
                          agent,
                          web3EvmWallet,
                          web3TodaOk,
                        ) && (
                          <p className="text-xs text-amber-600/90">
                            {agent.hypercycleBackend === "basechain"
                              ? "Import an EVM wallet in Web3 (Base) to activate this agent."
                              : "Configure TODA Twin (hostname + API key) in Web3 to activate this agent."}
                          </p>
                        )}
                    </div>

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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
