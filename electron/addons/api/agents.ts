/**
 * `addonAPI.agents` (§5.3) — `agents:read` for list/get, `agents:write` for
 * add/update. Reuses the exact same storage + Hypercycle-activation
 * validation (`validateActiveHypercycleAgent`) the core `ai-agents:*` IPC
 * handlers use (`electron/agents.ts`). Credentials are stripped from every
 * read, and `update` cannot touch credential fields.
 */

import {
  readAgents,
  readAgentsStored,
  writeAgents,
  validateActiveHypercycleAgent,
  ensureAgentHistoryDir,
  type AIAgent,
} from "../../agents";
import { assertPlainObject, ApiValidationError, type ApiNamespace } from "./types";

interface AgentSummary {
  id: string | number;
  name: string;
  provider?: unknown;
  model?: unknown;
  isActive?: unknown;
}

function toSummary(agent: AIAgent): AgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    isActive: agent.isActive,
  };
}

function findIndexById(agents: AIAgent[], id: unknown): number {
  return agents.findIndex((a) => String(a.id) === String(id));
}

export const methods: ApiNamespace = {
  list: {
    permission: "agents:read",
    handler: () => readAgents().map(toSummary),
  },
  get: {
    permission: "agents:read",
    handler: (_ctx, id) => {
      const agents = readAgents();
      const index = findIndexById(agents, id);
      return index === -1 ? null : toSummary(agents[index]);
    },
  },
  add: {
    permission: "agents:write",
    handler: (_ctx, agentInput) => {
      const input = assertPlainObject(agentInput, "agent");
      if (typeof input.name !== "string" || input.name.length === 0) {
        throw new ApiValidationError("agent.name is required and must be a non-empty string");
      }
      const id =
        typeof input.id === "string" || typeof input.id === "number" ? input.id : `addon-agent-${Date.now()}`;
      const agent = { ...input, id } as AIAgent;

      const validationError = validateActiveHypercycleAgent(agent);
      if (validationError) throw new Error(validationError);

      // Stored form on the read-modify-write path (same as main.ts's
      // `ai-agents:*` handlers) so a key this machine can't decrypt is
      // preserved verbatim rather than blanked on write.
      const agents = readAgentsStored();
      agents.push(agent);
      writeAgents(agents);
      ensureAgentHistoryDir(id);
      return { id };
    },
  },
  update: {
    permission: "agents:write",
    handler: (_ctx, id, patch) => {
      const patchObj = assertPlainObject(patch, "patch");
      // Allowlist, not a denylist. Stripping `apiKey` is not sufficient: several
      // non-credential fields decide what happens to the credential.
      //   - `baseUrl` is the host the key is sent to (AIService builds every
      //     request URL from it, and for Gemini the key travels in the query
      //     string) — writable baseUrl is key exfiltration.
      //   - `provider` selects which of those request paths runs.
      //   - `boxAccess` grants an agent vault boxes, which would route around
      //     `vault:read`/`vault:write` being reserved from addons entirely.
      //   - `hypercycleBackend` moves the node base.
      // So enumerate what is safe to change rather than what isn't; a new field
      // on AIAgentConfig is then un-patchable by default instead of exposed by
      // default.
      const PATCHABLE = ["name", "model", "maxTokens", "temperature", "isActive", "richUI"] as const;
      const safePatch: Record<string, unknown> = {};
      for (const key of PATCHABLE) {
        if (key in patchObj) safePatch[key] = patchObj[key];
      }

      const agents = readAgentsStored();
      const index = findIndexById(agents, id);
      if (index === -1) throw new ApiValidationError(`Agent "${id}" not found`);

      const merged = { ...agents[index], ...safePatch };
      const validationError = validateActiveHypercycleAgent(merged);
      if (validationError) throw new Error(validationError);

      agents[index] = merged;
      writeAgents(agents);
      return null;
    },
  },
};
