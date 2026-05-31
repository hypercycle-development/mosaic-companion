import { ToolUIBlock } from "../components/tool-ui";
// AI Agent Types and Configuration

export type AIProvider =
  | "claude"
  | "openai"
  | "gemini"
  | "ollama"
  | "custom"
  | "hypercycle";

/** Hypercycle routing: TODA micropay vs Basechain (EVM) — same direct `host:port` URL shape. */
export type HypercycleBackend = "toda" | "basechain";

export interface AIAgentConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string; // Custom/Ollama endpoint, or Hypercycle node base (see hypercycleBackend)
  model: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
  createdAt: number;
  boxAccess?: string[]; // IDs of vault boxes this agent can access
  richUI?: boolean; // Allow agent to render charts, tables, cards inline via <mosaic_ui>
  /**
   * Hypercycle: `toda` (default) or `basechain` — node base is scheme + host; ports are configured separately.
   */
  hypercycleBackend?: HypercycleBackend;
  /** @deprecated TODA always uses TDN in code; kept for legacy saved agents. */
  hypercycleCurrencyType?: string;
  /**
   * Hypercycle: server port (nonce, GET /info, POST /balance). TODA default 8000; Basechain 8010.
   */
  hypercycleServerPort?: number;
  /**
   * Hypercycle: app port (POST `/api/aim/{index}/request`). TODA default 8006; Basechain 8016.
   */
  hypercycleAppPort?: number;
  /**
   * Hypercycle: AIM route index (`/api/aim/{index}/request`). Default 0 (TODA) or 2 (Basechain) when unset.
   */
  hypercycleAimIndex?: number;
  /**
   * Hypercycle: stream port (POST /stream). TODA default 4001; Basechain 4102.
   */
  hypercycleStreamPort?: number;
  /**
   * Hypercycle: optional `tx-signature` override.
   * TODA: placeholder if unset. Basechain: wallet EIP-191 signs the nonce automatically if unset.
   */
  hypercycleTxSignature?: string;
  /** Hypercycle: override `tx-driver` header (default: toda_micropay / basechain). */
  hypercycleTxDriver?: string;
  /**
   * Hypercycle: optional `tx-sender` for POST /stream only (e.g. name.hypercycle.biz.todaq.net).
   * If omitted, uses the same TODA address as nonce/AIM steps.
   */
  hypercycleStreamTxSender?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  agentId: string;
  isStreaming?: boolean;
  /** UI blocks returned by a tool call (rendered by ToolUIRenderer) */
  uiBlocks?: ToolUIBlock[];
  /** "display" = UI was the answer (agent didn't analyze), "analyze" = agent commented */
  displayHint?: "display" | "analyze";
  /** Number of <mosaic_ui> blocks that failed validation (for user feedback) */
  failedUIBlockCount?: number;
  /** Raw JSON snippets of failed blocks (for collapsed debug view) */
  failedUIRawSnippets?: string[];
  /**
   * mosaic-media:// URLs from tool results that need user approval before rendering.
   * Stored so the blocked-media chip persists when sessions are reloaded.
   */
  mediaUrls?: string[];
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
  hypercycle: ["claude-sonnet-4-5-20250929"],
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
    color: "#F97316",
    baseUrl: "",
  },
  hypercycle: {
    name: "Hypercycle Node",
    color: "#22D3EE",
    baseUrl: "http://207.53.252.108",
  },
};
