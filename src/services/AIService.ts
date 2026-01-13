// AI Service - Handles API calls to different AI providers

import { AIAgentConfig, ChatMessage, AIProvider } from "../types/ai";

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

    const baseUrl =
      config.baseUrl || "https://generativelanguage.googleapis.com";
    const endpoint = callbacks
      ? `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?key=${config.apiKey}`
      : `${baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
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

        const chunk = decoder.decode(value);
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

  // Main send method - routes to appropriate provider
  static async sendMessage(
    config: AIAgentConfig,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks
  ): Promise<string> {
    switch (config.provider) {
      case "claude":
        return this.sendToClaude(config, messages, callbacks);
      case "openai":
        return this.sendToOpenAI(config, messages, callbacks);
      case "gemini":
        return this.sendToGemini(config, messages, callbacks);
      case "ollama":
        return this.sendToOllama(config, messages, callbacks);
      case "custom":
        // Custom endpoints assume OpenAI-compatible API
        return this.sendToOpenAI(config, messages, callbacks);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  // Test connection to an AI agent
  static async testConnection(
    config: AIAgentConfig
  ): Promise<{ success: boolean; message: string }> {
    try {
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
