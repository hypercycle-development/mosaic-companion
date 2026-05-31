/**
 * Built-in agents merged into ai-agents.json when missing (all users).
 * Stable IDs so we do not duplicate on subsequent reads.
 *
 * (No import from `src/` — electron tsconfig rootDir is `electron/` only.)
 */

export const MOSAIC_DEFAULT_TODA_LITELLM_ID = "mosaic-default-hypercycle-toda-litellm";
export const MOSAIC_DEFAULT_BASECHAIN_LITELLM_ID =
  "mosaic-default-hypercycle-basechain-litellm";
export const MOSAIC_DEFAULT_HERMES_ID = "mosaic-default-hermes-aim";

const DEFAULT_NODE_BASE = "http://207.53.252.108";
const DEFAULT_HC_MODEL = "claude-sonnet-4-5-20250929";

/** Shape matches renderer `AIAgentConfig` for all built-in providers. */
function builtinAgents(now: number): Record<string, unknown>[] {
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
    {
      id: MOSAIC_DEFAULT_HERMES_ID,
      name: "Hermes Master Agent",
      provider: "hermes",
      apiKey: "",
      baseUrl: "http://127.0.0.1:8642",
      model: "kimi-k2.6",
      maxTokens: 4096,
      temperature: 0.7,
      isActive: false,
      createdAt: now,
      skills: ["kanban-orchestrator"],
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
  const builtins = builtinAgents(now) as unknown as T[];
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
