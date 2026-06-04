import { ChatClient } from "./client";
import type { ServerMessage, StoredMessage } from "./types";
import { callActiveLLM } from "../mosaicbot/src/main/llm";

// activeClients[roomId][agentId] = ChatClient
const activeClients: Record<string, Record<string, ChatClient>> = {};

// Shared message history per room (all agents in the same room share this)
const roomHistory: Record<string, StoredMessage[]> = {};
const MAX_HISTORY = 10; // last N messages sent as context (reduced for slow local models)

function addToHistory(roomId: string, msg: StoredMessage): void {
  if (!roomHistory[roomId]) roomHistory[roomId] = [];
  roomHistory[roomId].push(msg);
  if (roomHistory[roomId].length > MAX_HISTORY) {
    roomHistory[roomId] = roomHistory[roomId].slice(-MAX_HISTORY);
  }
}

function buildConversationContext(roomId: string, agentName: string): string {
  const history = roomHistory[roomId] ?? [];
  if (history.length === 0) return "";
  const lines = history.map((m) => {
    const tag = m.isAgent ? `[AI] ${m.username}` : m.username;
    return `${tag}: ${m.text}`;
  });
  return (
    "Here is the recent conversation in the chat room. Respond to the latest message that mentions you.\n\n" +
    lines.join("\n")
  );
}

export function startAgentInRoom(
  serverUrl: string,
  roomId: string,
  agentId: string,
  agentName: string,
  trainingContext?: { skillName: string; systemPrompt?: string },
): void {
  if (activeClients[roomId]?.[agentId]) return; // already running

  const client = new ChatClient({
    url: serverUrl,
    username: agentName,
    isAgent: true,
  });

  if (!activeClients[roomId]) activeClients[roomId] = {};
  activeClients[roomId][agentId] = client;

  // Track room so reconnects auto-rejoin
  client.trackRoom(roomId);

  // Join room after auth (initial connect — reconnects are handled by the client)
  client.on("auth-ok", () => {
    console.log(`[AgentRunner] ${agentName} authenticated, joining room ${roomId}`);
  });

  // Seed history from room join
  client.on("server-message", (msg: ServerMessage) => {
    if (msg.type === "joined" && msg.history) {
      if (!roomHistory[roomId]) roomHistory[roomId] = [];
      // Only seed if empty (first agent to join)
      if (roomHistory[roomId].length === 0) {
        roomHistory[roomId] = msg.history.slice(-MAX_HISTORY);
      }
    }
  });

  client.on("error", (err: Error) => {
    console.error(`[AgentRunner] ${agentName} connection error:`, err?.message);
  });

  client.on("disconnected", () => {
    console.warn(`[AgentRunner] ${agentName} disconnected, will reconnect`);
  });

  // Track all messages and respond to @mentions
  client.on("server-message", async (msg: ServerMessage) => {
    if (msg.type !== "message") return;
    const m = msg.message;

    // Track every message for context (including agent messages)
    addToHistory(roomId, m);

    // Never reply to yourself (prevents self-loop)
    if (m.username === agentName) return;

    // In normal mode, ignore other agents to prevent chaos.
    // In training mode, allow agent-to-agent interaction.
    if (m.isAgent && !trainingContext) return;

    const mentionRegex = new RegExp(`@${escapeRegex(agentName)}`, "gi");
    if (!mentionRegex.test(m.text)) return;

    const conversationContext = buildConversationContext(roomId, agentName);

    try {
      const systemPrompt = trainingContext
        ? `You are ${agentName}. You are currently in TRAINING MODE for the skill: "${trainingContext.skillName}". Training context: ${trainingContext.systemPrompt || "Practice this skill in conversation. Respond helpfully and concisely."}`
        : `You are ${agentName}, an AI assistant in a multi-user chat room. You can see the full conversation history above. The latest message mentions you — respond to it helpfully and concisely. Do NOT prefix your response with your name.`;
      const reply = await callActiveLLM(
        conversationContext,
        systemPrompt,
        agentId,
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
    delete roomHistory[roomId];
  }
}

export function stopAllAgents(): void {
  for (const roomId of Object.keys(activeClients)) {
    for (const agentId of Object.keys(activeClients[roomId])) {
      activeClients[roomId][agentId].destroy();
    }
    delete activeClients[roomId];
  }
  for (const roomId of Object.keys(roomHistory)) {
    delete roomHistory[roomId];
  }
}

export function listAgentsInRoom(roomId: string): string[] {
  return Object.keys(activeClients[roomId] ?? {});
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
