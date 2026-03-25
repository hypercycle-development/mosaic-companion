import { ToolUIBlock } from "../components/tool-ui";
// AI Agent Types and Configuration

export type AIProvider =
  | "claude"
  | "openai"
  | "gemini"
  | "ollama"
  | "custom"
  | "hypercycle";

/** Hypercycle routing: direct TODA node vs hyperpg forward (ports in URL path). */
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
   * Hypercycle: `toda` (default) = direct node, host + ports 8000/8006/4001.
   * `basechain` = hyperpg forward base, e.g. `https://hyperpg.site/forward/54.67.32.117` — ports are path segments.
   */
  hypercycleBackend?: HypercycleBackend;
  /** Hypercycle TODA direct: `currency-type` header (default TDN). Omitted for Basechain. */
  hypercycleCurrencyType?: string;
  /**
   * Hypercycle: AIM request base URL (port 8006), e.g. http://host:8006.
   * If omitted, host is taken from `baseUrl` (nonce URL) with port 8006.
   */
  hypercycleAimBaseUrl?: string;
  /**
   * Hypercycle: optional `tx-signature` override.
   * TODA: placeholder if unset. Basechain: wallet EIP-191 signs the nonce automatically if unset.
   */
  hypercycleTxSignature?: string;
  /** Hypercycle: override `tx-driver` header (default: toda_micropay / basechain). */
  hypercycleTxDriver?: string;
  /**
   * Hypercycle: stream POST base URL (port 4001), e.g. http://host:4001.
   * If omitted, same host as node `baseUrl` with port 4001.
   */
  hypercycleStreamBaseUrl?: string;
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
    color: "#6B7280",
    baseUrl: "",
  },
  hypercycle: {
    name: "Hypercycle Node",
    color: "#22D3EE",
    baseUrl: "http://207.53.252.108",
  },
};
