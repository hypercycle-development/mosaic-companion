/**
 * AI agent storage (`ai-agents.json`) and Hypercycle-agent activation
 * validation. Moved here from `electron/main.ts` (Phase 3 of the addon
 * architecture) so `electron/addons/api/agents.ts` can reuse the exact same
 * read/write/validation path the core `ai-agents:*` IPC handlers use,
 * without `electron/addons/*` reaching back into `main.ts` — mirrors the
 * Phase 2 precedent of moving theme settings into `electron/settings.ts`
 * for the same reason.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getWalletKey } from "./integrations/web3/index";
import { hasTodaConfig } from "./integrations/web3/toda";
import { mergeBuiltinAgents } from "./defaultAiAgents";
import { getErrorMessage } from "./utils";

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

export function readAgents(): AIAgent[] {
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
  if (changed) {
    writeAgents(agents);
  }
  return agents;
}

export function writeAgents(agents: AIAgent[]): boolean {
  try {
    fs.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
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
