import { ToolUIBlock } from "../components/tool-ui";
import { SoulGrade, AgentCapabilityConfig } from "./soul";
// AI Agent Types and Configuration

export type AIProvider =
  | "claude"
  | "openai"
  | "gemini"
  | "ollama"
  | "ollama-cloud"
  | "custom"
  | "hypercycle"
  | "hermes"
  | "hermes-aim"
  | "hermes-api"
  | "generic";

/** Hypercycle routing: TODA micropay vs Basechain (EVM) — same direct `host:port` URL shape. */
export type HypercycleBackend = "toda" | "basechain";

export interface AIAgentConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  isActive: boolean;
  createdAt: number;
  boxAccess?: string[];
  richUI?: boolean;
  /**
   * Hermes skills attached to this agent. The skill content (SKILL.md + references/)
   * is injected into the system prompt before each API call.
   * Format: skill names as registered in ~/.hermes/skills/
   */
  skills?: string[];
  hypercycleBackend?: HypercycleBackend;
  /** @deprecated TODA always uses TDN in code; kept for legacy saved agents. */
  hypercycleCurrencyType?: string;
  /**
   * Hypercycle: server port (nonce, GET /info, POST /balance). TODA default 8000; Basechain 8010.
   */
  hypercycleServerPort?: number;
  /**
   * Hypercycle: app port (POST \`/api/aim/{index}/request\`). TODA default 8006; Basechain 8016.
   */
  hypercycleAppPort?: number;
  /**
   * Hypercycle: AIM route index (\`/api/aim/{index}/request\`). Default 0 (TODA) or 2 (Basechain) when unset.
   */
  hypercycleAimIndex?: number;
  /**
   * Hypercycle: stream port (POST /stream). TODA default 4001; Basechain 4102.
   */
  hypercycleStreamPort?: number;
  /**
   * Hypercycle: optional \`tx-signature\` override.
   * TODA: placeholder if unset. Basechain: wallet EIP-191 signs the nonce automatically if unset.
   */
  hypercycleTxSignature?: string;
  /** Hypercycle: override \`tx-driver\` header (default: toda_micropay / basechain). */
  hypercycleTxDriver?: string;
  /**
   * Hypercycle: optional \`tx-sender\` for POST /stream only (e.g. name.hypercycle.biz.todaq.net).
   * If omitted, uses the same TODA address as nonce/AIM steps.
   */
  hypercycleStreamTxSender?: string;
  /** Optional ANFE token ID this agent is deployed to (for Hermes AIM tracking). */
  anfeTokenId?: string;
  /**
   * SOUL.md identity layer — predefined soul archetype ID.
   * One of: executor, researcher, creative, guardian, navigator, fast, custom
   */
  soulId?: string;
  /**
   * Custom SOUL.md content override.
   * Takes precedence over soulId if non-empty.
   */
  soulOverride?: string;
  /**
   * Last SOUL grade from soul-grader.
   * Contains score, verdict, blockers, and recommendations.
   */
  soulGrade?: SoulGrade;
  /**
   * Capability configuration for Hermes tools access.
   * Defines which tools and vault boxes the agent can access.
   */
  capabilities?: AgentCapabilityConfig;
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
  ollama: ["llama3.2:3b", "qwen2.5-coder:7b", "gemma:2b", "qwen2.5:32b", "gpt-oss:20b"],
  "ollama-cloud": ["kimi-k2.6", "kimi-k2.5", "minimax-m2.5", "deepseek-v4-flash", "qwen3-coder:480b"],
  custom: [],
  hypercycle: ["claude-sonnet-4-5-20250929"],
  hermes: ["kimi-k2.6", "minimax", "custom"],
  "hermes-aim": ["kimi-k2.6", "minimax", "custom"],
  "hermes-api": ["hermes-agent"],
  generic: ["custom"],
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
  "ollama-cloud": {
    name: "Ollama Cloud",
    color: "#22D3EE",
    baseUrl: "https://ollama.com",
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
  hermes: {
    name: "Hermes Agent",
    color: "#7C3AED",
    baseUrl: "http://localhost:8642",
  },
  "hermes-aim": {
    name: "Hermes AIM (HyperCycle Node)",
    color: "#A78BFA",
    baseUrl: "http://127.0.0.1:9000",
  },
  "hermes-api": {
    name: "Hermes API Server",
    color: "#00D4AA",
    baseUrl: "http://127.0.0.1:8642",
  },
  generic: {
    name: "Generic AIM",
    color: "#6B7280",
    baseUrl: "",
  },
};
