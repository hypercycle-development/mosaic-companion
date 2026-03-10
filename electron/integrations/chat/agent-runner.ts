import { ChatClient } from "./client";
import type { ServerMessage } from "./types";
import { callActiveLLM } from "../mosaicbot/src/main/llm";
import { getAgentBoxes, getBoxContent } from "../vault/index";

// activeClients[roomId][agentId] = ChatClient
const activeClients: Record<string, Record<string, ChatClient>> = {};

/**
 * Resolve an agent's API key from its vault boxes.
 * Looks for an entry labeled "api-key" (case-insensitive) in any accessible box.
 * Returns null if no vault credential is found.
 */
function resolveVaultApiKey(agentId: string): string | null {
  const boxes = getAgentBoxes(agentId);
  for (const box of boxes) {
    const entries = getBoxContent(box.id);
    const keyEntry = entries.find(
      (e) => e.label && e.label.toLowerCase() === "api-key",
    );
    if (keyEntry && keyEntry.content.trim()) {
      return keyEntry.content.trim();
    }
  }
  return null;
}

export function startAgentInRoom(
  serverUrl: string,
  roomId: string,
  agentId: string,
  agentName: string,
): { success: boolean; error?: string } {
  if (activeClients[roomId]?.[agentId]) return { success: true }; // already running

  // Vault gate: agents in chat rooms MUST have their API key in a vault box
  const vaultApiKey = resolveVaultApiKey(agentId);
  if (!vaultApiKey) {
    const msg =
      `Agent "${agentName}" has no API key in the vault. ` +
      `Create a vault box with an entry labeled "api-key", then grant this agent access to that box.`;
    console.error(`[AgentRunner] ${msg}`);
    return { success: false, error: msg };
  }

  const client = new ChatClient({
    url: serverUrl,
    username: agentName,
    isAgent: true,
  });

  if (!activeClients[roomId]) activeClients[roomId] = {};
  activeClients[roomId][agentId] = client;

  // Join room after auth
  client.on("auth-ok", () => {
    console.log(`[AgentRunner] ${agentName} authenticated, joining room ${roomId}`);
    client.send({ type: "join-room", roomId });
  });

  client.on("error", (err: Error) => {
    console.error(`[AgentRunner] ${agentName} connection error:`, err?.message);
  });

  client.on("disconnected", () => {
    console.warn(`[AgentRunner] ${agentName} disconnected, will reconnect`);
  });

  // Respond to @mentions
  client.on("server-message", async (msg: ServerMessage) => {
    if (msg.type !== "message") return;
    const m = msg.message;
    if (m.isAgent) return; // ignore messages from other agents

    const mentionRegex = new RegExp(`@${escapeRegex(agentName)}`, "gi");
    if (!mentionRegex.test(m.text)) return;

    const prompt = m.text.replace(mentionRegex, "").trim();

    try {
      const reply = await callActiveLLM(
        prompt || "Hello!",
        `You are ${agentName}, an AI assistant in a multi-user chat room. Be helpful and concise.`,
        agentId,
        vaultApiKey,
      );
      if (reply) {
        client.send({ type: "send-message", roomId, text: reply });
      }
    } catch (e) {
      console.error(`[AgentRunner] LLM call failed for ${agentName}:`, e);
    }
  });

  client.connect();
  console.log(`[AgentRunner] ${agentName} starting with vault-secured API key`);
  return { success: true };
}

export function stopAgentInRoom(roomId: string, agentId: string): void {
  const client = activeClients[roomId]?.[agentId];
  if (!client) return;
  client.destroy();
  delete activeClients[roomId][agentId];
  if (Object.keys(activeClients[roomId]).length === 0) {
    delete activeClients[roomId];
  }
}

export function stopAllAgents(): void {
  for (const roomId of Object.keys(activeClients)) {
    for (const agentId of Object.keys(activeClients[roomId])) {
      activeClients[roomId][agentId].destroy();
    }
  }
  for (const roomId of Object.keys(activeClients)) {
    delete activeClients[roomId];
  }
}

export function listAgentsInRoom(roomId: string): string[] {
  return Object.keys(activeClients[roomId] ?? {});
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
