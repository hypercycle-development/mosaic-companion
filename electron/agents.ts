/**
 * AI agent storage (`ai-agents.json`) and Hypercycle-agent activation
 * validation. Moved here from `electron/main.ts` so
 * `electron/addons/api/agents.ts` can reuse the exact same
 * read/write/validation path the core `ai-agents:*` IPC handlers use,
 * without `electron/addons/*` reaching back into `main.ts` — mirrors the
 * earlier precedent of moving theme settings into `electron/settings.ts`
 * for the same reason.
 *
 * API keys are encrypted at rest via safeStorage (see agentKeyCrypto.ts).
 * `readAgentsStored()` returns agents with keys in stored (encrypted) form —
 * use it when merging partial updates back into the file so undecryptable
 * blobs are preserved verbatim. `readAgents()` returns decrypted keys for use.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getWalletKey } from "./integrations/web3/index";
import { hasTodaConfig } from "./integrations/web3/toda";
import { mergeBuiltinAgents } from "./defaultAiAgents";
import { getErrorMessage } from "./utils";
import { canEncrypt, decryptKey, encryptKey, isEncryptedKey } from "./agentKeyCrypto";

export interface AIAgent {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

const aiAgentsPath = path.join(app.getPath("userData"), "ai-agents.json");
export const agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");

export function validateActiveHypercycleAgent(agent: AIAgent): string | null {
  if (agent.provider !== "hypercycle") return null;
  if (agent.isActive !== true) return null;
  const basechain = agent.hypercycleBackend === "basechain";
  if (basechain) {
    if (!getWalletKey()) {
      return "Import an EVM wallet in Web3 settings (Base) before activating this Basechain Hypercycle agent.";
    }
  } else if (!hasTodaConfig()) {
    return "Configure TODA Twin (hostname + API key) in Web3 settings before activating this TODA Hypercycle agent.";
  }
  return null;
}

export function validateAgentsListForActivation(agents: AIAgent[]): string | null {
  for (const a of agents) {
    const err = validateActiveHypercycleAgent(a);
    if (err) return err;
  }
  return null;
}

/**
 * Read agents with API keys in stored (encrypted) form. Also migrates any
 * plaintext keys on disk to encrypted form once encryption is available.
 */
export function readAgentsStored(): AIAgent[] {
  let raw: AIAgent[] = [];
  try {
    if (fs.existsSync(aiAgentsPath)) {
      const data = fs.readFileSync(aiAgentsPath, "utf8");
      raw = JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read AI agents:", getErrorMessage(error));
  }
  const { agents, changed } = mergeBuiltinAgents(raw);
  const needsMigration =
    canEncrypt() &&
    agents.some(
      (a) => typeof a.apiKey === "string" && a.apiKey !== "" && !isEncryptedKey(a.apiKey),
    );
  if (changed || needsMigration) {
    writeAgents(agents);
  }
  return agents;
}

/**
 * Read agents with API keys decrypted for use. When a stored key cannot be
 * decrypted on this machine, `apiKey` is emptied and the transient
 * `apiKeyUnavailable` flag is set (stripped again on write).
 */
export function readAgents(): AIAgent[] {
  return readAgentsStored().map((agent) => {
    if (typeof agent.apiKey !== "string") return agent;
    const { value, failed } = decryptKey(agent.apiKey);
    if (failed) return { ...agent, apiKey: "", apiKeyUnavailable: true };
    return { ...agent, apiKey: value };
  });
}

/**
 * Persist agents, encrypting API keys at rest. encryptKey is idempotent, so
 * both stored-form (already encrypted) and plaintext keys are safe inputs.
 */
export function writeAgents(agents: AIAgent[]): boolean {
  const stored = agents.map((agent) => {
    const { apiKeyUnavailable: _apiKeyUnavailable, ...rest } = agent;
    if (typeof rest.apiKey !== "string") return rest;
    return { ...rest, apiKey: encryptKey(rest.apiKey) };
  });
  try {
    fs.writeFileSync(aiAgentsPath, JSON.stringify(stored, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", getErrorMessage(error));
    return false;
  }
}

/** Same per-agent history directory `ai-agents:add` creates. */
export function ensureAgentHistoryDir(agentId: string | number): void {
  const agentPath = path.join(agentsHistoryPath, agentId.toString());
  fs.mkdirSync(agentPath, { recursive: true });
}
