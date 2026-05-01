/**
 * Built-in Hypercycle agents merged into ai-agents.json when missing (all users).
 * Stable IDs so we do not duplicate on subsequent reads.
 *
 * (No import from `src/` — electron tsconfig rootDir is `electron/` only.)
 */

export const MOSAIC_DEFAULT_TODA_LITELLM_ID = "mosaic-default-hypercycle-toda-litellm";
export const MOSAIC_DEFAULT_BASECHAIN_LITELLM_ID =
  "mosaic-default-hypercycle-basechain-litellm";

const DEFAULT_NODE_BASE = "http://207.53.252.108";
const DEFAULT_HC_MODEL = "claude-sonnet-4-5-20250929";

/** Shape matches renderer `AIAgentConfig` for Hypercycle. */
function builtinHypercycleAgents(now: number): Record<string, unknown>[] {
  return [
    {
      id: MOSAIC_DEFAULT_TODA_LITELLM_ID,
      name: "TODA LiteLLM",
      provider: "hypercycle",
      apiKey: "",
      baseUrl: DEFAULT_NODE_BASE,
      model: DEFAULT_HC_MODEL,
      maxTokens: 4096,
      temperature: 0.7,
      isActive: false,
      createdAt: now,
      hypercycleBackend: "toda",
    },
    {
      id: MOSAIC_DEFAULT_BASECHAIN_LITELLM_ID,
      name: "Basechain LiteLLM",
      provider: "hypercycle",
      apiKey: "",
      baseUrl: DEFAULT_NODE_BASE,
      model: DEFAULT_HC_MODEL,
      maxTokens: 4096,
      temperature: 0.7,
      isActive: false,
      createdAt: now,
      hypercycleBackend: "basechain",
      hypercycleServerPort: 8010,
      hypercycleAppPort: 8016,
      hypercycleStreamPort: 4102,
      hypercycleAimIndex: 2,
    },
  ];
}

/** Append any built-in agents whose IDs are not already present. */
export function mergeBuiltinAgents<T extends { id: string | number }>(agents: T[]): {
  agents: T[];
  changed: boolean;
} {
  const ids = new Set(agents.map((a) => String(a.id)));
  const now = Date.now();
  const builtins = builtinHypercycleAgents(now) as unknown as T[];
  const toAdd: T[] = [];
  for (const b of builtins) {
    if (!ids.has(String(b.id))) {
      toAdd.push(b);
      ids.add(String(b.id));
    }
  }
  if (toAdd.length === 0) return { agents, changed: false };
  return { agents: [...agents, ...toAdd], changed: true };
}
