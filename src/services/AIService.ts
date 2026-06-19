// AI Service - Handles API calls to different AI providers

import { AIAgentConfig, ChatMessage, AIProvider } from "../types/ai";
import {
  buildAgentSystemPrompt,
  assembleSystemPrompt,
  getRecommendedCapabilities,
  ensureSoulGrade,
} from "./VaultCapabilityService";
import {
  chatMessagesToHypercycleAimMessages,
  consumeHypercycleStream,
  extractTokenFromAimResponse,
  probeHypercycleStream,
  fetchHypercycleNonce,
  getHypercycleTxDriver,
  getHypercycleAimIndex,
  HYPERCYCLE_STREAM_PATH,
  isHypercycleBasechainConfig,
  postHypercycleAimRequest,
  resolveHypercycleAimBaseUrl,
  resolveHypercycleNonceServiceBaseUrlForConfig,
  resolveHypercycleSender,
  resolveHypercycleStreamBaseUrl,
  resolveHypercycleTxSignature,
  resolveHypercycleAimModel,
  txSenderForHypercycleStream,
  type HypercycleStreamCallbacks,
} from "./hypercycleAgent";

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export class AIService {
  // Send message to Claude API
  static async sendToClaude(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    const response = await fetch(
      `${config.baseUrl || "https://api.anthropic.com"}/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens || 4096,
          messages: messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          stream: !!callbacks,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Claude API error");
    }

    if (callbacks && response.body) {
      return this.handleStream(response.body, callbacks, "claude");
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Send message to OpenAI API
  static async sendToOpenAI(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    // DEBUG: Trace what's happening with the baseUrl
    console.log('[AIService.sendToOpenAI] DEBUG - Input config:', {
      provider: config.provider,
      baseUrl: config.baseUrl,
      name: config.name
    });
    
    // Fix: migrate old ollama.com URLs to api.ollama.com for ollama-cloud provider
    let baseUrl = config.baseUrl || "https://api.openai.com";
    console.log('[AIService.sendToOpenAI] DEBUG - baseUrl after default:', baseUrl);
    
    if (config.provider === "ollama-cloud" && baseUrl.includes("ollama.com") && !baseUrl.includes("api.ollama.com")) {
      console.log('[AIService.sendToOpenAI] Migrating old baseUrl:', baseUrl, '→ https://api.ollama.com');
      baseUrl = "https://api.ollama.com";
    }
    console.log('[AIService.sendToOpenAI] DEBUG - baseUrl after first migration:', baseUrl);

    // For Hermes API Server, default the key if empty
    const actualApiKey =
      config.provider === "hermes-api" && !config.apiKey?.trim()
        ? "mosaic-hermes-2025"
        : config.apiKey?.trim() || config.apiKey;

    // AGGRESSIVE FIX: Final safety check - rewrite ollama.com URLs at request time
    let finalBaseUrl = baseUrl;
    console.log('[AIService.sendToOpenAI] DEBUG - finalBaseUrl before safety check:', finalBaseUrl);
    console.log('[AIService.sendToOpenAI] DEBUG - Checking conditions:', {
      includesOllama: finalBaseUrl.includes("ollama.com"),
      includesApiOllama: finalBaseUrl.includes("api.ollama.com"),
      shouldMigrate: finalBaseUrl.includes("ollama.com") && !finalBaseUrl.includes("api.ollama.com")
    });
    
    if (finalBaseUrl.includes("ollama.com") && !finalBaseUrl.includes("api.ollama.com")) {
      console.warn(`[AIService.sendToOpenAI] FINAL SAFETY: Rewriting ${finalBaseUrl} → https://api.ollama.com`);
      finalBaseUrl = "https://api.ollama.com";
    }
    console.log('[AIService.sendToOpenAI] DEBUG - finalBaseUrl after safety check:', finalBaseUrl);
    
    // Build URL and apply aggressive fix for ollama.com → api.ollama.com
    // NOTE: api.ollama.com redirects to ollama.com, so we use ollama.com directly
    // to avoid 301 redirect that converts POST to GET
    let url;
    if (config.provider === 'ollama-cloud') {
      url = 'https://ollama.com/v1/chat/completions';
      console.log('[AIService.sendToOpenAI] Using ollama.com directly (api.ollama.com redirects here):', url);
    } else {
      url = `${finalBaseUrl}/v1/chat/completions`;
    }
    
    console.log('[AIService.sendToOpenAI] DEBUG - Final URL:', url);
    console.log('[AIService.sendToOpenAI] DEBUG - Request method:', "POST");
    console.log('[AIService.sendToOpenAI] ABOUT TO FETCH:', url);

    // BYPASS: Use XMLHttpRequest instead of fetch to avoid any interception
    const response = await new Promise<{ok: boolean; status: number; url: string; json: () => Promise<any>; text: () => Promise<string>; body: ReadableStream | null}>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${actualApiKey}`);
      
      xhr.onload = () => {
        console.log('[AIService.XHR] Response URL:', xhr.responseURL);
        console.log('[AIService.XHR] Status:', xhr.status);
        console.log('[AIService.XHR] Status Text:', xhr.statusText);
        
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          url: xhr.responseURL || url,
          json: () => Promise.resolve(JSON.parse(xhr.responseText)),
          text: () => Promise.resolve(xhr.responseText),
          body: null,
        });
      };
      
      xhr.onerror = () => reject(new Error('XHR request failed'));
      
      const body = JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      });
      
      console.log('[AIService.XHR] Sending request to:', url);
      xhr.send(body);
    });
    
    console.log('[AIService.sendToOpenAI] Response URL:', response.url);

    if (!response.ok) {
      const error = await response.text().catch(() => null);
      let errorMessage = "OpenAI API error";
      try {
        const parsed = error ? JSON.parse(error) : null;
        errorMessage = parsed?.error?.message || error || `HTTP ${response.status}`;
      } catch {
        errorMessage = error || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (callbacks && response.body) {
      return this.handleStream(response.body, callbacks, "openai");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Send message to Gemini API
  static async sendToGemini(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    console.log("CALLBACK", callbacks);
    const baseUrl =
      config.baseUrl || "https://generativelanguage.googleapis.com";
    const endpoint = callbacks
      ? `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`
      : `${baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    // const endpoint = `${baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: callbacks
        ? {
            "x-goog-api-key": config.apiKey,
            "Content-Type": "application/json",
          }
        : {
            "Content-Type": "application/json",
          },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: config.maxTokens || 4096,
          temperature: config.temperature || 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Gemini API error");
    }

    if (callbacks && response.body) {
      return this.handleStream(response.body, callbacks, "gemini");
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // Send message to Ollama
  static async sendToOllama(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    // Ollama Cloud requires Bearer authentication, local Ollama does not
    const isOllamaCloud = config.baseUrl?.includes("api.ollama.com");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (isOllamaCloud && config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(
      `${config.baseUrl || "http://localhost:11434"}/api/chat`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: !!callbacks,
        }),
      }
    );

    if (!response.ok) {
      let errBody = "";
      try {
        const errData = await response.clone().json();
        errBody = errData.error || JSON.stringify(errData);
      } catch { /* not JSON */ }
      throw new Error(
        `Ollama error (model: ${config.model}): ${errBody || response.statusText || "is Ollama running?"}`
      );
    }

    if (callbacks && response.body) {
      return this.handleOllamaStream(response.body, callbacks);
    }

    const data = await response.json();
    return data.message.content;
  }

  // Handle SSE streams
  private static async handleStream(
    body: ReadableStream<Uint8Array>,
    callbacks: StreamCallbacks,
    provider: AIProvider
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            let token = "";

            if (provider === "claude") {
              if (parsed.type === "content_block_delta") {
                token = parsed.delta?.text || "";
              }
            } else if (provider === "openai") {
              token = parsed.choices?.[0]?.delta?.content || "";
            } else if (provider === "gemini") {
              token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else if (provider === "hermes-api") {
              token = parsed.choices?.[0]?.delta?.content || "";
            }

            if (token) {
              fullResponse += token;
              callbacks.onToken(token);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      callbacks.onComplete(fullResponse);
      return fullResponse;
    } catch (error) {
      callbacks.onError(error as Error);
      throw error;
    }
  }
  // Handle Ollama's NDJSON stream format
  private static async handleOllamaStream(
    body: ReadableStream<Uint8Array>,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const token = parsed.message?.content || "";
            if (token) {
              fullResponse += token;
              callbacks.onToken(token);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      callbacks.onComplete(fullResponse);
      return fullResponse;
    } catch (error) {
      callbacks.onError(error as Error);
      throw error;
    }
  }

  // Send message to Hermes (OpenAI-compatible endpoint)
  static async sendToHermes(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    console.log('[AIService.sendToHermes] start — model:', config.model, 'baseUrl:', config.baseUrl || 'http://localhost:8642');
    const baseUrl = (config.baseUrl || "http://localhost:8642").replace(/\/$/, "");
    // Default port changed from 3000 (old dev default) to 8642 (production standalone API server)
    const url = `${baseUrl}/v1/chat/completions`;
    // The Hermes standalone API server uses a Bearer token for auth.
    // Default key from run_api_server_standalone.py is "mosaic-hermes-2025".
    const apiKey = (config.apiKey && config.apiKey.trim()) ? config.apiKey.trim() : "mosaic-hermes-2025";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model || "default",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: !!callbacks,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('[AIService.sendToHermes] HTTP error:', response.status, txt.slice(0, 200));
      throw new Error(`Hermes error ${response.status}: ${txt}`);
    }

    if (callbacks && response.body) {
      const result = await this.handleStream(response.body, callbacks, "openai");
      console.log('[AIService.sendToHermes] streaming complete — length:', result.length);
      return result;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log('[AIService.sendToHermes] non-streaming response — length:', content.length);
    return content;
  }

  /* ── Hermes AIM (HyperCycle Node) ── */
  static async sendToHermesAIM(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
  ): Promise<string> {
    const url = `${config.baseUrl || "http://127.0.0.1:9000"}/chat`;
    const lastUser = messages.filter((m) => m.role === "user").pop()?.content || "";
    const system = messages.find((m) => m.role === "system")?.content || "";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: lastUser, system_prompt: system }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      throw new Error(`Hermes AIM error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const content = data.response ?? "";

    if (callbacks && content) {
      // emulate streaming by yielding the full response as one token
      for (const token of content.split(/(\s+)/)) {
        if (token) callbacks.onToken(token);
      }
      callbacks.onComplete(content);
      return content;
    }

    return content;
  }

  /** Hypercycle: GET /nonce → POST /api/aim/{index}/request → POST /stream with `{ token }`. */
  static async sendToHypercycle(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
  ): Promise<string> {
    const baseUrl = config.baseUrl?.trim();
    if (!baseUrl) {
      throw new Error(
        isHypercycleBasechainConfig(config)
          ? "Hypercycle Basechain node base URL is required (e.g. http://207.53.252.108 — scheme and host only)."
          : "Hypercycle node base URL is required (e.g. http://host — port 8000 is used for /nonce).",
      );
    }

    const sender = await resolveHypercycleSender(config);
    const nonceServiceBase = resolveHypercycleNonceServiceBaseUrlForConfig(config);
    const { nonce } = await fetchHypercycleNonce({
      nonceServiceBaseUrl: nonceServiceBase,
      sender,
      currencyType: "TDN",
      sendCurrencyType: !isHypercycleBasechainConfig(config),
    });

    const txDriver = getHypercycleTxDriver(config);
    const txSignature = await resolveHypercycleTxSignature(config, nonce);

    const aimBase = resolveHypercycleAimBaseUrl(config);
    const aimMessages = chatMessagesToHypercycleAimMessages(messages);
    if (aimMessages.length === 0) {
      throw new Error("Hypercycle requires at least one user or assistant message.");
    }

    const aim = await postHypercycleAimRequest({
      aimBaseUrl: aimBase,
      aimIndex: getHypercycleAimIndex(config),
      sender,
      nonce,
      messages: aimMessages,
      model: resolveHypercycleAimModel(config),
      txSignature,
      txDriver,
    });

    if (!aim.ok) {
      throw new Error(
        `Hypercycle AIM failed (${aim.status}): ${aim.rawText || "request error"}`,
      );
    }

    const token = extractTokenFromAimResponse(aim.body);
    if (!token) {
      const preview =
        aim.rawText.length > 280 ? `${aim.rawText.slice(0, 280)}…` : aim.rawText;
      throw new Error(
        `Hypercycle AIM did not return a stream token. Response: ${preview}`,
      );
    }

    const streamBase = resolveHypercycleStreamBaseUrl(config);
    const streamSender = txSenderForHypercycleStream(config, sender);

    const streamCallbacks: HypercycleStreamCallbacks = callbacks
      ? {
          onToken: callbacks.onToken,
          onComplete: callbacks.onComplete,
          onError: callbacks.onError,
        }
      : {
          onToken: () => {},
          onComplete: () => {},
          onError: (e) => {
            throw e;
          },
        };

    return consumeHypercycleStream({
      streamBaseUrl: streamBase,
      sender: streamSender,
      nonce,
      token,
      txSignature,
      txDriver,
      callbacks: streamCallbacks,
    });
  }

  // Main send method - routes to appropriate provider
  static async sendMessage(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    // DEBUG: Log the incoming config
    console.log('[AIService.sendMessage] DEBUG - Incoming config:', {
      provider: config.provider,
      baseUrl: config.baseUrl,
      name: config.name,
      id: config.id
    });
    
    // AGGRESSIVE FIX: Any agent with ollama.com URLs gets migrated immediately
    // This catches agents saved with wrong baseUrl regardless of provider
    if (config.baseUrl?.includes("ollama.com") && !config.baseUrl?.includes("api.ollama.com")) {
      console.log(`[AIService] Force-migrating ${config.name} baseUrl: ${config.baseUrl} → https://api.ollama.com`);
      config = { ...config, baseUrl: "https://api.ollama.com" };
    }

    // ─── Skill Injection (v2.6) ─────────────────────────────────────────────
    // If the agent has skills[] configured, load them from ~/.hermes/skills/
    // or Mosaic Vault, and inject their content as a system prompt before
    // the first message. Vault fallback runs in the main process via IPC.
    // ─────────────────────────────────────────────────────────────────────
    let enrichedMessages = messages;
    
    // ─── SOUL + Capability Injection (v3.0) ────────────────────────────────
    // Build comprehensive system prompt from SOUL.md, capabilities, and skills
    // This creates a complete agent identity layer
    // ─────────────────────────────────────────────────────────────────────
    let soulCapabilitySystemPrompt = "";
    try {
      // Ensure capabilities are set up with defaults if missing
      if (!config.capabilities) {
        config.capabilities = {
          enabledCapabilities: getRecommendedCapabilities(config.soulId),
          vaultBoxAccess: config.boxAccess || [],
        };
      }
      
      // Ensure soul grade is current
      if (config.soulId || config.soulOverride) {
        config.soulGrade = await ensureSoulGrade(
          config.soulId,
          config.soulOverride,
          config.soulGrade
        );
      }
      
      // Build agent context for system prompt
      const agentContext = {
        agentId: config.id,
        agentName: config.name,
        soulId: config.soulId,
        soulOverride: config.soulOverride,
        capabilities: config.capabilities,
        vaultAccess: [], // Vault access loaded separately via IPC
      };
      
      // Build system prompt parts
      const promptParts = buildAgentSystemPrompt(agentContext);
      soulCapabilitySystemPrompt = assembleSystemPrompt(promptParts);
      
      if (soulCapabilitySystemPrompt) {
        console.log(`[AIService] SOUL/Capability system prompt built for ${config.name} (${soulCapabilitySystemPrompt.length} chars)`);
      }
    } catch (e) {
      console.error("[AIService] SOUL/Capability system prompt build failed:", e);
      // Continue without SOUL layer — don't break the chat
    }
    
    if (config.skills && config.skills.length > 0) {
      try {
        // Use main-process IPC to build the system prompt (fs only works in Node)
        const result = await (window as any).electronAPI?.skills?.buildSystemPrompt?.({
          baseSystemPrompt: soulCapabilitySystemPrompt, // Include SOUL/capability content
          skillNames: config.skills,
        });

        if (!result || result.loadedSkills.length === 0) {
          // IPC not available or no skills loaded — fallback to local (renderer-safe, no fs)
          console.warn(`[AIService] IPC skill build failed or returned empty for ${config.name}, using local fallback`);
        } else {
          // Prepend a system message containing all loaded skill content
          const skillSystemMsg: ChatMessage = {
            id: `skill-system-${Date.now()}`,
            role: "system",
            content: result.systemPrompt,
            timestamp: Date.now(),
            agentId: config.id,
          };
          // Find if there's already a system message
          const firstSystemIdx = messages.findIndex((m) => m.role === "system");
          if (firstSystemIdx !== -1) {
            // Prepend skills BEFORE the existing system message
            enrichedMessages = [
              skillSystemMsg,
              ...messages.slice(0, firstSystemIdx),
              {
                ...messages[firstSystemIdx],
                content: messages[firstSystemIdx].content + "\n\n" + result.systemPrompt,
              },
              ...messages.slice(firstSystemIdx + 1),
            ];
          } else {
            // Prepend as the first message
            enrichedMessages = [skillSystemMsg, ...messages];
          }
          console.log(`[AIService] Skills injected for ${config.name}: ${result.loadedSkills.join(", ")} (${result.totalTokens}T)`);
        }
        if (result?.failedSkills?.length > 0) {
          console.warn(`[AIService] Failed to load skills for ${config.name}: ${result.failedSkills.join(", ")}`);
        }
      } catch (e) {
        console.error("[AIService] Skill injection failed:", e);
        // Continue without skills — don't break the chat
      }
    }

    switch (config.provider) {
      case "claude":
        return this.sendToClaude(config, enrichedMessages, callbacks);
      case "openai":
      case "custom":
        // AGGRESSIVE: Also check for ollama.com URLs in openai/custom providers
        if (config.baseUrl?.includes("ollama.com") && !config.baseUrl?.includes("api.ollama.com")) {
          console.log(`[AIService] Re-routing ${config.provider} agent with ollama.com URL to ollama-cloud handler`);
          const fixedBaseUrl = "https://api.ollama.com";
          return this.sendToOpenAI(
            { ...config, baseUrl: fixedBaseUrl, provider: "ollama-cloud" },
            enrichedMessages,
            callbacks,
          );
        }
        return this.sendToOpenAI(config, enrichedMessages, callbacks);
      case "gemini":
        return this.sendToGemini(config, enrichedMessages, callbacks);
      case "ollama":
        return this.sendToOllama(config, enrichedMessages, callbacks);
      case "ollama-cloud":
        // Ollama Cloud is OpenAI-compatible at api.ollama.com/v1/chat/completions
        // Use sendToOpenAI with Bearer auth, not native Ollama /api/chat endpoint
        const ollamaCloudBaseUrl = config.baseUrl?.includes("ollama.com") && !config.baseUrl?.includes("api.ollama.com")
          ? "https://api.ollama.com"
          : (config.baseUrl || "https://api.ollama.com");
        return this.sendToOpenAI(
          { ...config, baseUrl: ollamaCloudBaseUrl },
          enrichedMessages,
          callbacks,
        );
      case "hypercycle":
        return this.sendToHypercycle(config, enrichedMessages, callbacks);
      case "hermes":
        return this.sendToHermes(config, enrichedMessages, callbacks);
      case "hermes-aim":
        return this.sendToHermesAIM(config, enrichedMessages, callbacks);
      case "hermes-api":
        // Hermes API Server — OpenAI-compatible with full tool loop
        // AGGRESSIVE: Check for ollama.com URLs
        if (config.baseUrl?.includes("ollama.com") && !config.baseUrl?.includes("api.ollama.com")) {
          console.log(`[AIService] Re-routing hermes-api agent with ollama.com URL to ollama-cloud handler`);
          const fixedBaseUrl = "https://api.ollama.com";
          return this.sendToOpenAI(
            { ...config, baseUrl: fixedBaseUrl, provider: "ollama-cloud" },
            enrichedMessages,
            callbacks,
          );
        }
        return this.sendToOpenAI(config, enrichedMessages, callbacks);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  // Test connection to an AI agent
  static async testConnection(
    config: AIAgentConfig
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (config.provider === "hermes" || config.provider === "hermes-aim" || config.provider === "hermes-api") {
        const defaultPort = config.provider === "hermes-aim" ? "9000" : config.provider === "hermes-api" ? "8000" : "8642";
        const baseUrl = ((config.baseUrl || `http://localhost:${defaultPort}`).trim()).replace(/\/$/, "");
        const healthUrl = `${baseUrl}/health`;
        try {
          const r = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
          if (!r.ok) {
            return {
              success: false,
              message: `Hermes health check failed (${r.status}): ${await r.text()}`,
            };
          }
          const data = await r.json() as { status?: string; version?: string; provider?: string; model?: string };
          return {
            success: true,
            message: `Hermes connected: status=${data.status ?? "unknown"}, version=${data.version ?? "unknown"}, provider=${data.provider ?? data.model ?? config.model}`,
          };
        } catch (e) {
          return {
            success: false,
            message: `Cannot reach Hermes at ${healthUrl}. Is Hermes running? ${e instanceof Error ? e.message : String(e)}`,
          };
        }
      }

      if (config.provider === "hypercycle") {
        const baseUrl = config.baseUrl?.trim();
        if (!baseUrl) {
          return {
            success: false,
            message: isHypercycleBasechainConfig(config)
              ? "Set Basechain node base URL (scheme and host, e.g. http://207.53.252.108)."
              : "Set node base URL (e.g. http://207.53.252.108 — port 8000 is added for /nonce).",
          };
        }
        const sender = await resolveHypercycleSender(config);
        const nonceServiceBase =
          resolveHypercycleNonceServiceBaseUrlForConfig(config);
        const { nonce } = await fetchHypercycleNonce({
          nonceServiceBaseUrl: nonceServiceBase,
          sender,
          currencyType: "TDN",
          sendCurrencyType: !isHypercycleBasechainConfig(config),
        });

        const txDriver = getHypercycleTxDriver(config);
        let txSignature: string;
        try {
          txSignature = await resolveHypercycleTxSignature(config, nonce);
        } catch (e) {
          return {
            success: false,
            message: e instanceof Error ? e.message : String(e),
          };
        }

        const aimBase = resolveHypercycleAimBaseUrl(config);
        const testUserMsg: ChatMessage = {
          id: "hypercycle-test",
          role: "user",
          content: "Connection test from Mosaic.",
          timestamp: Date.now(),
          agentId: config.id,
        };
        const aimMessages = chatMessagesToHypercycleAimMessages([testUserMsg]);
        const aim = await postHypercycleAimRequest({
          aimBaseUrl: aimBase,
          aimIndex: getHypercycleAimIndex(config),
          sender,
          nonce,
          messages: aimMessages,
          model: resolveHypercycleAimModel(config),
          txSignature,
          txDriver,
        });

        if (!aim.ok) {
          const bit =
            aim.rawText.length > 180 ? `${aim.rawText.slice(0, 180)}…` : aim.rawText;
          return {
            success: false,
            message: `Nonce OK, but AIM request failed (${aim.status}): ${bit}`,
          };
        }

        const token = extractTokenFromAimResponse(aim.body);
        if (!token) {
          const bit =
            aim.rawText.length > 160 ? `${aim.rawText.slice(0, 160)}…` : aim.rawText;
          return {
            success: false,
            message: `Nonce + AIM OK, but no stream token in response (POST ${HYPERCYCLE_STREAM_PATH} needs it). Body: ${bit}`,
          };
        }

        const streamBase = resolveHypercycleStreamBaseUrl(config);
        const streamSender = txSenderForHypercycleStream(config, sender);
        try {
          await probeHypercycleStream({
            streamBaseUrl: streamBase,
            sender: streamSender,
            nonce,
            token,
            txSignature,
            txDriver,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            success: false,
            message: `Nonce + AIM OK, stream token parsed, but POST ${streamBase}${HYPERCYCLE_STREAM_PATH} failed: ${msg}`,
          };
        }

        const noncePreview =
          nonce.length > 20 ? `${nonce.slice(0, 20)}…` : nonce;
        return {
          success: true,
          message: `Hypercycle OK: nonce + AIM + stream (${streamBase}${HYPERCYCLE_STREAM_PATH}). Nonce: ${noncePreview}`,
        };
      }

      const testMessages: ChatMessage[] = [
        {
          id: "test",
          role: "user",
          content: 'Say "Connection successful" in exactly those words.',
          timestamp: Date.now(),
          agentId: config.id,
        },
      ];

      await this.sendMessage(config, testMessages);
      return { success: true, message: "Connection established successfully!" };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }
}
