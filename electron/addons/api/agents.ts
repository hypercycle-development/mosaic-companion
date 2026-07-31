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
      // The id reaches path.join via ensureAgentHistoryDir below, so an
      // addon-supplied "../.." would create directories outside the history
      // root. Constrain it to the same shape the app generates.
      const requestedId = typeof input.id === "string" || typeof input.id === "number" ? String(input.id) : "";
      if (requestedId && !/^[A-Za-z0-9._-]{1,64}$/.test(requestedId)) {
        throw new ApiValidationError("agent.id may only contain letters, numbers, dot, underscore or hyphen");
      }
      const id = requestedId || `addon-agent-${Date.now()}`;
      if (readAgentsStored().some((a) => String(a.id) === id)) {
        throw new ApiValidationError(`Agent "${id}" already exists`);
      }

      // Same allowlist as `update`, for the same reason: `baseUrl` decides
      // where an API key is sent and `boxAccess` grants vault boxes, so a
      // spread of caller input would let an addon plant an agent that
      // exfiltrates keys or reaches vault content that `vault:read` is
      // reserved to prevent.
      //
      // The property being protected is "an addon cannot choose where the
      // user's credentials go" — NOT "addons may not create useful agents".
      // What an addon can create today is a stub the user completes in
      // Configuration, which is the cheapest way to hold that property, not
      // the intended end state. An addon that spawns agents as its core
      // purpose needs better, and this filter is deliberately additive so it
      // can get better without a schema change or a migration. Options, when
      // that conversation happens: user-consented creation showing the
      // destination (same shape as the install consent dialog); a reference
      // to a provider the user has already configured, so the addon picks the
      // model and prompt but never the endpoint or key; or agents that run on
      // the addon's own credentials rather than the user's.
      const agent = {
        id,
        name: input.name,
        provider: "custom",
        model: typeof input.model === "string" ? input.model : "",
        isActive: false,
        createdAt: Date.now(),
        ...(typeof input.maxTokens === "number" ? { maxTokens: input.maxTokens } : {}),
        ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
        ...(typeof input.richUI === "boolean" ? { richUI: input.richUI } : {}),
      } as AIAgent;

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
