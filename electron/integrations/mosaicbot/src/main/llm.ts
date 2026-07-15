// ─────────────────────────────────────────────────────────────────────────────
// Main-process LLM caller for MosaicBot
//
// Reads the active AI agent from userData/ai-agents.json and calls the
// configured provider. Mirrors AIService (src/services/AIService.ts) but
// runs in the Electron main process where API keys are safe and there is
// no renderer context.
//
// Usage:
//   const reply = await callActiveLLM(prompt, systemPrompt);
//   if (!reply) // no active agent configured
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "fs";
import path from "path";

// Mirrors AIAgentConfig from src/types/ai.ts
interface AgentConfig {
  id: string;
  name: string;
  provider: "claude" | "openai" | "gemini" | "ollama" | "ollama-cloud" | "custom" | "hypercycle" | "hermes" | "hermes-aim" | "hermes-api";
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
}

type Message = { role: string; content: string };

// ── Agent resolution ──────────────────────────────────────────────────────────

function readAgents(): AgentConfig[] {
  try {
    const agentsPath = path.join(app.getPath("userData"), "ai-agents.json");
    if (!fs.existsSync(agentsPath)) return [];
    return JSON.parse(fs.readFileSync(agentsPath, "utf-8")) as AgentConfig[];
  } catch (e) {
    console.error("[MosaicBot/LLM] Failed to read ai-agents.json:", e);
    return [];
  }
}

function readActiveAgent(): AgentConfig | null {
  return readAgents().find((a) => a.isActive) ?? null;
}

function readAgentById(id: string): AgentConfig | null {
  return readAgents().find((a) => a.id === id) ?? null;
}

// ── Provider detection ───────────────────────────────────────────────────────

// Helper to detect effective provider from agent config
// Handles :cloud suffix in model names (e.g., "llama3.1:cloud" -> ollama-cloud)
function getEffectiveProvider(agent: AgentConfig): AgentConfig["provider"] {
  if (agent.model?.endsWith(":cloud")) {
    return "ollama-cloud";
  }
  return agent.provider;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call a specific agent by ID with the given prompt.
 * Unlike callActiveLLM which always resolves to the first active agent,
 * this allows per-agent dispatch for team orchestration.
 */
export async function callAgentLLM(
  agentId: string,
  prompt: string,
  systemPrompt?: string,
): Promise<string | null> {
  const agent = readAgentById(agentId);
  if (!agent) {
    console.warn(`[MosaicBot/LLM] Agent "${agentId}" not found in ai-agents.json`);
    return null;
  }
  if (!agent.isActive) {
    console.warn(`[MosaicBot/LLM] Agent "${agent.name}" (${agentId}) is not active.`);
    return null;
  }

  const effectiveProvider = getEffectiveProvider(agent);
  const effectiveModel = agent.model?.endsWith(":cloud")
    ? agent.model.replace(/:cloud$/, "")
    : agent.model;

  console.log(`[MosaicBot/LLM] Team dispatch to "${agent.name}" (${effectiveProvider}/${effectiveModel})`);

  return await _callProvider(agent, effectiveProvider, effectiveModel, prompt, systemPrompt);
}

/**
 * Call the first active AI agent with the given prompt.
 * Returns null (and logs a warning) when no active agent is configured.
 * The caller is responsible for falling back to HEARTBEAT_OK.
 */
export async function callActiveLLM(
  prompt: string,
  systemPrompt?: string,
  agentId?: string,
): Promise<string | null> {
  // Prefer the named agent; fall back to the active agent when the id is a
  // MosaicBot profile name (main/coder/local) with no matching ai-agents entry.
  let agent = agentId ? readAgentById(agentId) : readActiveAgent();
  if (!agent && agentId) {
    agent = readActiveAgent();
    if (agent) {
      console.log(`[MosaicBot/LLM] Agent "${agentId}" not in ai-agents.json — falling back to active agent "${agent.name}".`);
    }
  }
  if (!agent) {
    console.warn(
      "[MosaicBot/LLM] No active AI agent configured. Open Settings → AI Agents and set one as active.",
    );
    return null;
  }

  // Determine effective provider (handles :cloud suffix)
  const effectiveProvider = getEffectiveProvider(agent);
  const effectiveModel = agent.model?.endsWith(":cloud")
    ? agent.model.replace(/:cloud$/, "")
    : agent.model;

  console.log(`[MosaicBot/LLM] Using agent "${agent.name}" (${effectiveProvider}/${effectiveModel})`);

  return await _callProvider(agent, effectiveProvider, effectiveModel, prompt, systemPrompt);
}

// ── Unified provider dispatcher ───────────────────────────────────────────────

async function _callProvider(
  agent: AgentConfig,
  effectiveProvider: AgentConfig["provider"],
  _effectiveModel: string,
  prompt: string,
  systemPrompt?: string,
): Promise<string | null> {
  try {
    switch (effectiveProvider) {
      case "claude":
        return await callClaude(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "openai":
      case "custom":
        return await callOpenAI(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "gemini":
        return await callGemini(agent, [{ role: "user", content: prompt }]);
      case "ollama":
        return await callOllama(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "ollama-cloud":
        return await callOllamaCloud(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "hypercycle":
        console.warn(
          "[MosaicBot/LLM] Hypercycle provider needs token + stream steps; skipping LLM call.",
        );
        return null;
      case "hermes":
        return await callHermes(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "hermes-aim":
        return await callHermesAIM(agent, [{ role: "user", content: prompt }], systemPrompt);
      case "hermes-api":
        return await callHermes(agent, [{ role: "user", content: prompt }], systemPrompt);
      default:
        throw new Error(`Unknown provider: ${effectiveProvider}`);
    }
  } catch (e) {
    console.error(`[MosaicBot/LLM] Call failed (${effectiveProvider}):`, e);
    return null;
  }
}

// ── Provider implementations ──────────────────────────────────────────────────

async function callClaude(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: agent.model,
    max_tokens: agent.maxTokens ?? 1024,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(
    `${agent.baseUrl ?? "https://api.anthropic.com"}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": agent.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: Array<{ text: string }> };
  return data.content[0].text;
}

async function callOpenAI(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const allMessages: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(
    `${agent.baseUrl ?? "https://api.openai.com"}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agent.apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model,
        max_tokens: agent.maxTokens ?? 1024,
        temperature: agent.temperature ?? 0.7,
        messages: allMessages,
      }),
    },
  );

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}

async function callGemini(agent: AgentConfig, messages: Message[]): Promise<string> {
  const baseUrl = agent.baseUrl ?? "https://generativelanguage.googleapis.com";
  const url = `${baseUrl}/v1beta/models/${agent.model}:generateContent?key=${agent.apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: agent.maxTokens ?? 1024,
        temperature: agent.temperature ?? 0.7,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  return data.candidates[0].content.parts[0].text;
}

async function callOllama(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const allMessages: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(
    `${agent.baseUrl ?? "http://localhost:11434"}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: agent.model,
        messages: allMessages,
        stream: false,
      }),
    },
  );

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message: { content: string } };
  return data.message.content;
}

async function callOllamaCloud(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const allMessages: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  // Strip :cloud suffix from model name if present
  const effectiveModel = agent.model?.endsWith(":cloud")
    ? agent.model.replace(/:cloud$/, "")
    : agent.model;

  // CRITICAL FIX: Use ollama.com directly, NOT api.ollama.com (which 301 redirects)
  // The 301 redirect from Cloudflare converts POST to GET, causing "Method not allowed"
  const res = await fetch(
    "https://ollama.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agent.apiKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: allMessages,
        max_tokens: agent.maxTokens ?? 1024,
        temperature: agent.temperature ?? 0.7,
      }),
    },
  );

  if (!res.ok) throw new Error(`OllamaCloud ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}

// ── Hermes Agent caller ──────────────────────────────────────────────────────

async function callHermesAIM(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content || "";
  const system = systemPrompt || messages.find((m) => m.role === "system")?.content || "";

  const res = await fetch(
    `${agent.baseUrl || "http://127.0.0.1:9000"}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: lastUser,
        system_prompt: system,
      }),
    },
  );

  if (!res.ok) throw new Error(`HermesAIM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { response?: string };
  return data.response || "";
}

async function callHermes(
  agent: AgentConfig,
  messages: Message[],
  systemPrompt?: string,
): Promise<string> {
  const allMessages: Message[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const baseUrl = (agent.baseUrl || "http://localhost:8642").trim();
  const apiKey = agent.apiKey?.trim() || "mosaic-hermes-2025";

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: agent.model || "default",
      messages: allMessages,
      max_tokens: agent.maxTokens ?? 4096,
      temperature: agent.temperature ?? 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Hermes ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0].message.content;
}
