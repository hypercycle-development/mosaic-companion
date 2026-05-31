// =============================================================================
// HERMES AGENT SERVICE — Mosaic Bridge
// Wraps the Hermes CLI agent as a LiteLLM/OpenAI-compatible provider.
// Every HyperCycle Node Factory owner gets their own Hermes companion.
// =============================================================================

import type { AIAgentConfig, ChatMessage } from '../types/ai';

/**
 * Hermes can run in two modes:
 *  1. "local"    — Hermes CLI on this machine (or Docker container)    baseUrl: http://localhost:8642
 *  2. "anfe"     — Hermes inside a HyperCycle ANFE (AIMified)        baseUrl: http://<node-ip>:<aim-port>
 */
export type HermesMode = 'local' | 'anfe';

export interface HermesConfig {
  mode: HermesMode;
  /** The underlying model provider Hermes will use (cloud or local) */
  innerProvider: 'ollama' | 'minimax' | 'kimi' | 'custom';
  /** Override the inner model ID that Hermes sends to its backend */
  innerModel?: string;
  /** Docker image tag when mode === 'anfe' */
  dockerTag?: string;
  /** True if this Hermes instance is managed by a HyperCycle Node Factory */
  isAimified: boolean;
  /** ANFE tokenId that owns this instance (empty if local) */
  anfeTokenId?: string;
}

/** Status returned by GET /health */
export interface HermesHealth {
  status: 'healthy' | 'busy' | 'error' | 'initializing';
  provider: string;
  model: string;
  uptime: number;
  sessions: number;
  version: string;
}

const HERMES_DEFAULT_PORT = 8642;

function getBaseUrl(agent: AIAgentConfig): string {
  return (agent.baseUrl || `http://localhost:${HERMES_DEFAULT_PORT}`).replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if Hermes is alive and ready to serve requests.
 */
export async function checkHermesHealth(agent: AIAgentConfig): Promise<HermesHealth | null> {
  try {
    const url = `${getBaseUrl(agent)}/health`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return await r.json() as HermesHealth;
  } catch {
    return null;
  }
}

/**
 * Send a chat completion request to Hermes.
 *
 * Body shape: OpenAI-compatible
 * {
 *   model: string,
 *   messages: [{ role: string, content: string }],
 *   stream?: boolean,
 *   max_tokens?: number,
 *   temperature?: number
 * }
 */
export async function chatWithHermes(
  agent: AIAgentConfig,
  messages: ChatMessage[],
  options?: {
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<Response> {
  const url = `${getBaseUrl(agent)}/v1/chat/completions`;

  const body = {
    model: agent.model || 'kimi-k2.6',
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: options?.stream ?? false,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  };

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mosaic-hermes-2025',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
}

/**
 * One-shot non-streaming completion.
 */
export async function completeWithHermes(
  agent: AIAgentConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const r = await chatWithHermes(agent, messages, { ...options, stream: false });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Hermes error ${r.status}: ${txt}`);
  }
  const j = await r.json() as any;
  return j.choices?.[0]?.message?.content || '';
}

// =============================================================================
// HyperCycle AIM Integration
// =============================================================================

/**
 * When Hermes is Aimified, it registers as a LiteLLM-compatible model on the
 * HyperCycle node.  This function builds the `/api/aim/{index}/request`
 * payload that the node expects.
 */
export function buildAimPayload(
  messages: ChatMessage[],
  model: string,
  options?: { maxTokens?: number; temperature?: number }
): Record<string, any> {
  return {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  };
}

/**
 * Hermes Docker image metadata for Aimification.
 */
export const HERMES_AIM_IMAGE = {
  /** Default image name when pushed to a registry */
  name: 'mosaic/hermes-agent',
  /** Tag used for AIM registration */
  tag: 'latest',
  /** Standard port for Hermes HTTP API */
  port: 3000,
  /** HyperCycle AIM index this image registers under (slot on the node) */
  defaultAimIndex: 0,
  /**
   * AIM manifest — tells the HyperCycle node what this module provides.
   * The node reads this to populate its model list.
   */
  manifest: {
    name: 'Hermes Agent',
    description: 'AI companion with tools, skills and chain awareness',
    version: '1.0.0',
    capabilities: ['chat', 'tools', 'code', 'analysis', 'chain-watching'],
    models: ['kimi-k2.6', 'minimax', 'custom'],
    hardware: { minRam: '4GB', minCpu: '2 cores', gpu: 'optional' },
  },
};

export default {
  checkHermesHealth,
  chatWithHermes,
  completeWithHermes,
  buildAimPayload,
  HERMES_AIM_IMAGE,
};
