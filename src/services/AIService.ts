// AI Service - Handles API calls to different AI providers

import { AIAgentConfig, ChatMessage, AIProvider } from "../types/ai";
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
    const response = await fetch(
      `${config.baseUrl || "https://api.openai.com"}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens || 4096,
          temperature: config.temperature || 0.7,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: !!callbacks,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "OpenAI API error");
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
    const response = await fetch(
      `${config.baseUrl || "http://localhost:11434"}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      throw new Error("Ollama connection error - is Ollama running?");
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
    console.log('[AIService.sendToHermes] start — model:', config.model, 'baseUrl:', config.baseUrl || 'http://localhost:3000');
    const url = `${config.baseUrl || "http://localhost:3000"}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    // ─── Skill Injection (v2.5) ─────────────────────────────────────────────
    // If the agent has skills[] configured, load them from ~/.hermes/skills/
    // and inject their content as a system prompt before the first message.
    // ─────────────────────────────────────────────────────────────────────
    let enrichedMessages = messages;
    if (config.skills && config.skills.length > 0) {
      try {
        // Lazy import to avoid circular dependency at module load time
        const { skillInjector } = await import("./skillInjector");
        const result = skillInjector.buildSystemPrompt("", config.skills);
        if (result.loadedSkills.length > 0) {
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
        if (result.failedSkills.length > 0) {
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
        return this.sendToOpenAI(config, enrichedMessages, callbacks);
      case "gemini":
        return this.sendToGemini(config, enrichedMessages, callbacks);
      case "ollama":
        return this.sendToOllama(config, enrichedMessages, callbacks);
      case "custom":
        // Custom endpoints assume OpenAI-compatible API
        return this.sendToOpenAI(config, enrichedMessages, callbacks);
      case "hypercycle":
        return this.sendToHypercycle(config, enrichedMessages, callbacks);
      case "hermes":
        return this.sendToHermes(config, enrichedMessages, callbacks);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  // Test connection to an AI agent
  static async testConnection(
    config: AIAgentConfig
  ): Promise<{ success: boolean; message: string }> {
    try {
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
