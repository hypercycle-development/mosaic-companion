/**
 * Ollama Service - Local LLM Model Management
 * API: http://localhost:11434
 * 
 * Cloud Models Support:
 * - MiniMax-M2.5:cloud (requires OLLAMA_API_KEY env var)
 * - All other cloud models via Ollama's API
 * 
 * Configuration:
 *   Set OLLAMA_API_KEY in your environment to enable cloud models
 *   Ollama handles the authentication with providers (MiniMax, OpenAI, etc.)
 */

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaListResponse {
  models: OllamaModel[];
}

const OLLAMA_BASE_URL = 'http://localhost:11434';

class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      
      const data: OllamaListResponse = await response.json();
      return data.models;
    } catch (error) {
      console.error('Ollama list models error:', error);
      return [];
    }
  }

  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Generate failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async chat(messages: { role: string; content: string }[], model: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  async pullModel(modelName: string, onProgress?: (progress: string) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.status && onProgress) {
            onProgress(data.status);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  async getModelInfo(modelName: string): Promise<OllamaModel | null> {
    const models = await this.listModels();
    return models.find(m => m.name === modelName || m.model === modelName) || null;
  }

  isAvailable(): Promise<boolean> {
    return this.listModels()
      .then(() => true)
      .catch(() => false);
  }

  // Popular models ready to use
  static POPULAR_MODELS = [
    { name: 'llama2', description: 'Meta Llama 2 - General purpose' },
    { name: 'llama2:13b', description: 'Llama 2 13B - More capable' },
    { name: 'llama3', description: 'Meta Llama 3 - Latest' },
    { name: 'llama3:8b', description: 'Llama 3 8B - Fast' },
    { name: 'mistral', description: 'Mistral 7B - Efficient' },
    { name: 'codellama', description: 'Code Llama - Code generation' },
    { name: 'codellama:13b', description: 'Code Llama 13B' },
    { name: 'neural-chat', description: 'Neural Chat - conversational' },
    { name: 'orca-mini', description: 'Orca Mini - Lightweight' },
    { name: 'phi3', description: 'Microsoft Phi-3 - Small & capable' },
    { name: 'qwen', description: 'Qwen - Alibaba' },
    { name: 'aya', description: 'Aya - Cohere' },
    { name: 'solar', description: 'Solar - Upstage' },
    { name: 'wizardlm2', description: 'WizardLM 2 - Microsoft' }
  ];

  // ============================================================
  // CLOUD MODELS - Via Ollama API (OLLAMA_API_KEY)
  // ============================================================

  /**
   * Configure Ollama API key for cloud models
   * Set OLLAMA_API_KEY environment variable to enable cloud models
   * 
   * Cloud models are accessed via standard Ollama API:
   * - minimax-m2.5:cloud
   * - Other providers through Ollama's gateway
   */
  setApiKey(key: string): void {
    process.env.OLLAMA_API_KEY = key;
  }

  /**
   * Check if Ollama is configured for cloud models
   */
  hasApiKey(): boolean {
    return !!process.env.OLLAMA_API_KEY;
  }

  /**
   * Cloud models available through Ollama
   * Requires OLLAMA_API_KEY to be set
   */
  static CLOUD_MODELS = [
    { 
      name: 'minimax-m2.5:cloud', 
      provider: 'MiniMax',
      description: 'MiniMax M2.5 - High performance cloud inference'
    },
    { 
      name: 'openai/gpt-4', 
      provider: 'OpenAI via Ollama',
      description: 'OpenAI GPT-4 (via Ollama gateway)'
    },
    { 
      name: 'openai/gpt-3.5-turbo', 
      provider: 'OpenAI via Ollama',
      description: 'OpenAI GPT-3.5 Turbo (via Ollama gateway)'
    }
  ];

  /**
   * Generate text using cloud model via Ollama API
   * Ollama handles the authentication via OLLAMA_API_KEY env var
   */
  async generateCloud(
    model: string, 
    prompt: string, 
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    // Use standard Ollama API - it handles cloud auth internally
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 401 || error.includes('api key')) {
        throw new Error('API key not configured. Set OLLAMA_API_KEY environment variable.');
      }
      
      throw new Error(`Generation failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Chat using cloud model via Ollama API
   */
  async chatCloud(
    messages: { role: string; content: string }[],
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 401 || error.includes('api key')) {
        throw new Error('API key not configured. Set OLLAMA_API_KEY environment variable.');
      }
      
      throw new Error(`Chat failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  /**
   * Auto-detect if model is a cloud model
   */
  isCloudModel(modelName: string): boolean {
    return modelName.includes(':cloud') || 
           modelName.includes('/') ||
           OllamaService.CLOUD_MODELS.some(m => m.name === modelName);
  }

  /**
   * Check if cloud model access works
   */
  async testCloudAccess(): Promise<boolean> {
    try {
      await this.generateCloud('minimax-m2.5:cloud', 'hi', { maxTokens: 5 });
      return true;
    } catch (error: any) {
      if (error.message.includes('api key')) {
        return false;
      }
      return false;
    }
  }
}

export const ollamaService = new OllamaService();
export default ollamaService;