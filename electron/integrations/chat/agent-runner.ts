import { ChatClient } from "./client";
import type { ServerMessage } from "./types";
import { callActiveLLM } from "../mosaicbot/src/main/llm";

// activeClients[roomId][agentId] = ChatClient
const activeClients: Record<string, Record<string, ChatClient>> = {};

export function startAgentInRoom(
  serverUrl: string,
  roomId: string,
  agentId: string,
  agentName: string,
): void {
  if (activeClients[roomId]?.[agentId]) return; // already running

  const client = new ChatClient({
    url: serverUrl,
    username: agentName,
    isAgent: true,
  });

  if (!activeClients[roomId]) activeClients[roomId] = {};
  activeClients[roomId][agentId] = client;

  // Join room after auth
  client.on("auth-ok", () => {
    client.send({ type: "join-room", roomId });
  });

  // Respond to @mentions
  client.on("server-message", async (msg: ServerMessage) => {
    if (msg.type !== "message") return;
    const m = msg.message;
    if (m.isAgent) return; // ignore messages from other agents

    const mention = `@${agentName}`;
    if (!m.text.includes(mention)) return;

    const prompt = m.text.replace(new RegExp(`@${escapeRegex(agentName)}`, "g"), "").trim();

    try {
      const reply = await callActiveLLM(
        prompt || "Hello!",
        `You are ${agentName}, an AI assistant in a multi-user chat room. Be helpful and concise.`,
      );
      if (reply) {
        client.send({ type: "send-message", roomId, text: reply });
      }
    } catch (e) {
      console.error(`[AgentRunner] LLM call failed for ${agentName}:`, e);
    }
  });

  client.connect();
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
