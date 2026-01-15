// AI Agent Types and Configuration

export type AIProvider = "claude" | "openai" | "gemini" | "ollama" | "custom";

export interface AIAgentConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // For custom endpoints or Ollama
  model: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  agentId: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  agentId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  claude: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-0-20250514",
    "claude-haiku-4-0-20250514",
    "claude-3-5-sonnet-20241022",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "o1-preview",
    "o1-mini",
  ],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ollama: ["llama3.2", "mistral", "codellama", "deepseek-coder"],
  custom: [],
};

export const PROVIDER_INFO: Record<
  AIProvider,
  { name: string; color: string; baseUrl: string }
> = {
  claude: {
    name: "Anthropic Claude",
    color: "#D97706",
    baseUrl: "https://api.anthropic.com",
  },
  openai: {
    name: "OpenAI",
    color: "#10B981",
    baseUrl: "https://api.openai.com",
  },
  gemini: {
    name: "Google Gemini",
    color: "#3B82F6",
    baseUrl: "https://generativelanguage.googleapis.com",
  },
  ollama: {
    name: "Ollama (Local)",
    color: "#8B5CF6",
    baseUrl: "http://localhost:11434",
  },
  custom: {
    name: "Custom Endpoint",
    color: "#6B7280",
    baseUrl: "",
  },
};
