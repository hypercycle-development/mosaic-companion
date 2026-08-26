import React, { useState, useEffect } from "react";
import {
  Bot,
  BrainCircuit,
  MessageSquare,
  Shield,
  Cpu,
  Plug,
  Globe,
  ChevronRight,
  ChevronLeft,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  AIAgentConfig,
  AIProvider,
  DEFAULT_MODELS,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";
import { explainAIError } from "../services/aiErrorHelp";
import { INTERNAL_CHAT_URL } from "../types/types";

interface OnboardingPageProps {
  onNavigate: (url: string) => void;
  onComplete: () => void;
}

const STEPS = ["welcome", "features", "agent", "ready"] as const;
type Step = (typeof STEPS)[number];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "Configure multiple AI providers (Claude, OpenAI, Gemini, Ollama) and switch between them seamlessly.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: MessageSquare,
    title: "Chat Rooms",
    description:
      "Create multi-user chat rooms and invite AI agents to participate via @mentions.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Shield,
    title: "Vault",
    description:
      "Keep your own data in named boxes and control which agents can read each one. Everything stays on this device.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Plug,
    title: "MCP Servers",
    description:
      "Connect to Model Context Protocol servers to extend agent capabilities with external tools.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Globe,
    title: "Web3 & Browsing",
    description:
      "Built-in web browser with Web3 wallet integration for on-chain interactions.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: Cpu,
    title: "Tool Sandbox",
    description:
      "Install and run WASM-based tools in a sandboxed environment with full lifecycle management.",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
  },
];

/** "Where everything lives" orientation cards for the ready step. */
const ORIENTATION = [
  {
    icon: Bot,
    title: "AI Chat",
    description:
      "One-on-one chat with your configured agents — this is the main chat.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: MessageSquare,
    title: "Chat Rooms",
    description:
      "Shared rooms where several people and agents talk together. Different from AI Chat.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: BrainCircuit,
    title: "MosAIc Bot",
    description:
      "A built-in background assistant with long-term memory and skills.",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
  {
    icon: Plug,
    title: "MCP Servers",
    description:
      "Optional plug-ins that give your agents extra tools. You can ignore this to start.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Lock,
    title: "Vault",
    description:
      "Named boxes for your own data; you choose which agents can read them.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Cpu,
    title: "Tool Sandbox",
    description:
      "Install small sandboxed tools that agents can run. Optional.",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
  },
];

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  onNavigate,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [showApiKey, setShowApiKey] = useState(false);
  /** User skipped agent setup — the ready step becomes an orientation-only page. */
  const [skipped, setSkipped] = useState(false);
  /** Non-builtin agents already configured (e.g. onboarding replayed). */
  const [existingAgentCount, setExistingAgentCount] = useState(0);
  const [testStatus, setTestStatus] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // Replay guard: if onboarding is reopened after agents were already
  // configured, let the user know they can skip the agent step.
  useEffect(() => {
    const checkExistingAgents = async () => {
      try {
        const agents = await window.electronAPI.aiAgents.get();
        if (agents) {
          setExistingAgentCount(
            agents.filter((a) => !a.id.startsWith("mosaic-default-")).length,
          );
        }
      } catch (error) {
        console.warn("[Onboarding] Failed to check existing agents:", error);
      }
    };
    checkExistingAgents();
  }, []);

  const [agentConfig, setAgentConfig] = useState<Partial<AIAgentConfig>>({
    name: "My First Agent",
    provider: "claude",
    apiKey: "",
    model: DEFAULT_MODELS.claude[0],
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true,
  });

  const stepIndex = STEPS.indexOf(currentStep);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1]);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setAgentConfig({
      ...agentConfig,
      provider,
      model:
        provider === "hypercycle"
          ? ""
          : DEFAULT_MODELS[provider][0] || "",
      baseUrl: provider === "custom" ? "" : PROVIDER_INFO[provider].baseUrl,
    });
    setTestStatus({ status: "idle" });
  };

  const handleTestConnection = async () => {
    if (
      !agentConfig.apiKey &&
      agentConfig.provider !== "ollama" &&
      agentConfig.provider !== "hypercycle"
    ) {
      return;
    }
    setTestStatus({ status: "testing" });
    try {
      const config: AIAgentConfig = {
        id: "onboarding-test",
        name: agentConfig.name || "Test",
        provider: agentConfig.provider as AIProvider,
        apiKey: agentConfig.apiKey || "",
        baseUrl: agentConfig.baseUrl,
        model: agentConfig.model || "",
        maxTokens: agentConfig.maxTokens,
        temperature: agentConfig.temperature,
        isActive: true,
        createdAt: Date.now(),
      };
      const result = await AIService.testConnection(config);
      setTestStatus({
        status: result.success ? "success" : "error",
        message: result.success
          ? result.message
          : explainAIError(config.provider, result.message, config.baseUrl),
      });
    } catch (error) {
      setTestStatus({
        status: "error",
        message: explainAIError(
          agentConfig.provider as AIProvider,
          (error as Error).message,
          agentConfig.baseUrl,
        ),
      });
    }
  };

  const handleFinish = async () => {
    if (!skipped) {
      // Save agent
      const agent: AIAgentConfig = {
        id: `agent-${Date.now()}`,
        name: agentConfig.name || "My First Agent",
        provider: agentConfig.provider as AIProvider,
        apiKey: agentConfig.apiKey || "",
        baseUrl: agentConfig.baseUrl,
        model: agentConfig.model || "",
        maxTokens: agentConfig.maxTokens ?? 4096,
        temperature: agentConfig.temperature ?? 0.7,
        isActive: true,
        createdAt: Date.now(),
      };

      try {
        await window.electronAPI.aiAgents.add(agent);
      } catch (error) {
        console.error("Failed to save agent:", error);
      }
    }

    onComplete();
    onNavigate(INTERNAL_CHAT_URL);
  };

  // Skipping still lands on the orientation page — users who skip agent
  // setup need the "where everything lives" overview the most.
  const handleSkipToChat = () => {
    setSkipped(true);
    setCurrentStep("ready");
  };

  return (
    <div className="h-full flex items-center justify-center bg-gray-950 text-gray-100 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto p-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex
                  ? "bg-indigo-500 w-8"
                  : "bg-gray-700 w-4"
              }`}
            />
          ))}
        </div>

        {/* Step: Welcome */}
        {currentStep === "welcome" && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Welcome to MosAIc
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
              Your AI-powered companion browser. Let's get you set up in just a
              few steps.
            </p>
            <button
              onClick={goNext}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all flex items-center gap-2 mx-auto"
            >
              Get Started
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Step: Features */}
        {currentStep === "features" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-center mb-2">
              What MosAIc Can Do
            </h2>
            <p className="text-gray-400 text-center mb-8">
              Here's a quick overview of the key features
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-3`}
                  >
                    <feature.icon size={20} className={feature.color} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={goBack}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={goNext}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all flex items-center gap-2"
              >
                Configure Your Agent
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step: Agent Configuration */}
        {currentStep === "agent" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-center mb-2">
              Set Up Your First AI Agent
            </h2>
            <p
              className={`text-gray-400 text-center ${
                existingAgentCount > 0 ? "mb-3" : "mb-8"
              }`}
            >
              Connect an AI provider to start chatting. Your key stays on this
              device and is only sent to the provider you choose.
            </p>
            {existingAgentCount > 0 && (
              <p className="text-xs text-indigo-300/80 text-center mb-8">
                You already have {existingAgentCount} agent
                {existingAgentCount === 1 ? "" : "s"} configured — you can skip
                this step.
              </p>
            )}

            <div className="space-y-5 bg-gray-900/50 p-6 rounded-xl border border-gray-800">
              {/* Agent Name */}
              <label className="block">
                <span className="text-sm text-gray-400 mb-1 block">
                  Agent Name
                </span>
                <input
                  type="text"
                  value={agentConfig.name}
                  onChange={(e) =>
                    setAgentConfig({ ...agentConfig, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                  placeholder="My First Agent"
                />
              </label>

              {/* Provider */}
              <label className="block">
                <span className="text-sm text-gray-400 mb-1 block">
                  Provider
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(
                    Object.entries(PROVIDER_INFO) as [
                      AIProvider,
                      (typeof PROVIDER_INFO)[AIProvider],
                    ][]
                  ).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => handleProviderChange(key)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        agentConfig.provider === key
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <div
                        className="w-2 h-2 rounded-full mx-auto mb-1"
                        style={{ backgroundColor: info.color }}
                      />
                      {key === "claude"
                        ? "Claude"
                        : key === "openai"
                          ? "OpenAI"
                          : key === "gemini"
                            ? "Gemini"
                            : key === "ollama"
                              ? "Ollama"
                              : key === "hypercycle"
                                ? "Hypercycle"
                                : "Custom"}
                    </button>
                  ))}
                </div>
              </label>

              {/* API Key */}
              {agentConfig.provider !== "ollama" &&
                agentConfig.provider !== "hypercycle" && (
                <label className="block">
                  <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                    <Key size={12} />
                    API Key
                  </span>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={agentConfig.apiKey}
                      onChange={(e) => {
                        setAgentConfig({
                          ...agentConfig,
                          apiKey: e.target.value,
                        });
                        setTestStatus({ status: "idle" });
                      }}
                      className="w-full px-3 py-2 pr-10 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100 font-mono text-sm"
                      placeholder="sk-... or API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* TODO: update copy to mention OS-keychain encryption once agent key encryption (safeStorage) lands */}
                  <p className="text-xs text-gray-600 mt-1">
                    Stored locally on this device — never sent anywhere except{" "}
                    {PROVIDER_INFO[agentConfig.provider as AIProvider].name}.
                  </p>
                </label>
              )}

              {/* Model */}
              <label className="block">
                <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                  <Cpu size={12} />
                  Model
                </span>
                {agentConfig.provider === "custom" ||
                agentConfig.provider === "hypercycle" ? (
                  <>
                    <input
                      type="text"
                      value={agentConfig.model}
                      onChange={(e) =>
                        setAgentConfig({ ...agentConfig, model: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100 text-sm"
                      placeholder={
                        agentConfig.provider === "hypercycle"
                          ? "Model id for AIM request body"
                          : "model-name"
                      }
                    />
                    {agentConfig.provider === "hypercycle" && (
                      <p className="text-xs text-gray-600 mt-1">
                        Sent as <code className="text-gray-500">model</code> in{" "}
                        <code className="text-gray-500">
                          POST …/api/aim/…/request
                        </code>{" "}
                        JSON.
                      </p>
                    )}
                  </>
                ) : (
                  <select
                    value={agentConfig.model}
                    onChange={(e) =>
                      setAgentConfig({ ...agentConfig, model: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100 text-sm"
                  >
                    {DEFAULT_MODELS[agentConfig.provider as AIProvider]?.map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </label>

              {/* Base URL for custom/ollama/hypercycle */}
              {(agentConfig.provider === "custom" ||
                agentConfig.provider === "ollama" ||
                agentConfig.provider === "hypercycle") && (
                <label className="block">
                  <span className="text-sm text-gray-400 mb-1 block">
                    {agentConfig.provider === "hypercycle"
                      ? "Node base URL"
                      : "Base URL"}
                  </span>
                  {agentConfig.provider === "hypercycle" && (
                    <p className="text-xs text-gray-600 mb-1">
                      Host only (no :8000). Nonce, AIM, and stream ports are added automatically.
                    </p>
                  )}
                  <input
                    type="text"
                    value={
                      agentConfig.baseUrl ??
                      PROVIDER_INFO[agentConfig.provider as AIProvider]?.baseUrl ??
                      ""
                    }
                    onChange={(e) =>
                      setAgentConfig({
                        ...agentConfig,
                        baseUrl: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100 text-sm"
                    placeholder={
                      agentConfig.provider === "hypercycle"
                        ? "http://207.53.252.108"
                        : "http://localhost:11434"
                    }
                  />
                </label>
              )}

              {/* Test Connection */}
              <div>
                <button
                  onClick={handleTestConnection}
                  disabled={
                    testStatus.status === "testing" ||
                    (!agentConfig.apiKey &&
                      agentConfig.provider !== "ollama" &&
                      agentConfig.provider !== "hypercycle")
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    testStatus.status === "success"
                      ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/30"
                      : testStatus.status === "error"
                        ? "bg-red-900/30 text-red-400 border border-red-500/30"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                  }`}
                >
                  {testStatus.status === "testing" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Testing...
                    </>
                  ) : testStatus.status === "success" ? (
                    <>
                      <CheckCircle size={14} />
                      Connected
                    </>
                  ) : testStatus.status === "error" ? (
                    <>
                      <XCircle size={14} />
                      Failed
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </button>
                {testStatus.message && testStatus.status !== "idle" && (
                  <p
                    className={`text-xs mt-2 leading-relaxed ${testStatus.status === "success" ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {testStatus.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goBack}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipToChat}
                  className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => {
                    setSkipped(false);
                    goNext();
                  }}
                  disabled={
                    !agentConfig.apiKey &&
                    agentConfig.provider !== "ollama" &&
                    agentConfig.provider !== "hypercycle"
                  }
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-xl text-white font-medium transition-all flex items-center gap-2"
                >
                  Continue
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Ready */}
        {currentStep === "ready" && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-4">
              {skipped ? "You can set up an agent anytime" : "You're All Set!"}
            </h2>
            {skipped ? (
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Add one later via the sidebar's Add AI Agent button or
                Configuration → AI Agents
              </p>
            ) : (
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Your agent{" "}
                <strong className="text-white">{agentConfig.name}</strong> is
                configured and ready to go.
              </p>
            )}

            {/* Where everything lives */}
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Where everything lives
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4 text-left">
              {ORIENTATION.map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}
                    >
                      <item.icon size={14} className={item.color} />
                    </div>
                    <h4 className="font-semibold text-xs">{item.title}</h4>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-8 max-w-md mx-auto">
              Tip: everything opens in tabs — press + in the tab strip to open
              a new one, just like a browser.
            </p>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={goBack}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleFinish}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-all flex items-center gap-2"
              >
                {skipped ? "Explore MosAIc" : "Start Chatting"}
                <MessageSquare size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
