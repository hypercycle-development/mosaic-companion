/**
 * `addonAPI.agents` (§5.3) — `agents:read` for list/get, `agents:write` for
 * add/update. Reuses the exact same storage + Hypercycle-activation
 * validation (`validateActiveHypercycleAgent`) the core `ai-agents:*` IPC
 * handlers use (`electron/agents.ts`). Credentials are stripped from every
 * read, and `update` cannot touch credential fields.
 */

import { readAgents, writeAgents, validateActiveHypercycleAgent, ensureAgentHistoryDir, type AIAgent } from "../../agents";
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

      const agents = readAgents();
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
      // Cannot touch credential fields (§5.3) — apiKey is the only credential
      // field on AIAgentConfig; id is also protected so identity can't drift.
      const { apiKey: _apiKey, id: _id, ...safePatch } = patchObj;

      const agents = readAgents();
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
