import { ChatClient } from "./client";
import type { ServerMessage, StoredMessage } from "./types";
import { callActiveLLM } from "../mosaicbot/src/main/llm";

// ── Skill-building imports (lazy to avoid circular deps) ────────────────────
let _forgeSkill: typeof import("../mosaicbot/src/main/skill-forge").forgeSkill | null = null;
let _getAvailableTemplates: typeof import("../mosaicbot/src/main/skill-forge").getAvailableTemplates | null = null;
let _indexHermesSkills: typeof import("../mosaicbot/src/main/skill-bridge").indexHermesSkills | null = null;
let _searchSkills: typeof import("../mosaicbot/src/main/skill-bridge").searchSkills | null = null;

function lazyLoadForge() {
  if (!_forgeSkill) {
    const mod = require("../mosaicbot/src/main/skill-forge") as typeof import("../mosaicbot/src/main/skill-forge");
    _forgeSkill = mod.forgeSkill;
    _getAvailableTemplates = mod.getAvailableTemplates;
  }
}

function lazyLoadBridge() {
  if (!_indexHermesSkills) {
    const mod = require("../mosaicbot/src/main/skill-bridge") as typeof import("../mosaicbot/src/main/skill-bridge");
    _indexHermesSkills = mod.indexHermesSkills;
    _searchSkills = mod.searchSkills;
  }
}

// activeClients[roomId][agentId] = ChatClient
const activeClients: Record<string, Record<string, ChatClient>> = {};

// Shared message history per room (all agents in the same room share this)
const roomHistory: Record<string, StoredMessage[]> = {};
const MAX_HISTORY = 10; // last N messages sent as context (reduced for slow local models)

// Track which agents are in each room for collaboration
const roomAgents: Record<string, Set<string>> = {};

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

// ── Action protocol ─────────────────────────────────────────────────────────

/** Detect [[ACTION:TYPE]] ... [[/ACTION]] blocks in agent replies */
function extractActions(text: string): Array<{ type: string; payload: Record<string, string> }> {
  const actions: Array<{ type: string; payload: Record<string, string> }> = [];
  const regex = /\[\[ACTION:(\w+)\]\]([\s\S]*?)\[\[\/ACTION\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const type = match[1];
    const body = match[2].trim();
    const payload: Record<string, string> = {};
    for (const line of body.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) payload[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    actions.push({ type, payload });
  }
  return actions;
}

/** Strip action blocks from visible chat text */
function stripActions(text: string): string {
  return text.replace(/\[\[ACTION:\w+\]\][\s\S]*?\[\[\/ACTION\]\]/g, "").trim();
}

/** Fallback: detect YAML/markdown skill blocks that the LLM posted as chat text */
function extractSkillFromYaml(text: string): Array<{ type: string; payload: Record<string, string> }> {
  const actions: Array<{ type: string; payload: Record<string, string> }> = [];
  // Match ```yaml blocks containing name: and skills:
  const codeBlockRegex = /```(?:yaml)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const block = match[1];
    const nameMatch = block.match(/^name:\s*(.+)$/m);
    const descMatch = block.match(/description:\s*(.+)$/m);
    if (nameMatch) {
      actions.push({
        type: "FORGE_SKILL",
        payload: {
          name: nameMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : `Bundle ${nameMatch[1].trim()}`,
          category: "general",
          triggers: "",
          content: `# ${nameMatch[1].trim()}\n\n${block.trim()}`,
        },
      });
    }
  }
  return actions;
}

/** Execute a skill-building action */
async function executeAction(
  action: { type: string; payload: Record<string, string> },
  agentName: string,
  roomId: string,
  client: ChatClient,
): Promise<void> {
  switch (action.type) {
    case "FORGE_SKILL": {
      lazyLoadForge();
      if (!_forgeSkill) {
        client.send({ type: "send-message", roomId, text: `⚠️ ${agentName}: Skill forge unavailable.` });
        return;
      }
      const name = action.payload.name;
      const description = action.payload.description || "Auto-generated skill";
      const category = action.payload.category || "general";
      const triggers = (action.payload.triggers || "").split(",").map((s) => s.trim()).filter(Boolean);
      const content = action.payload.content || `# ${name}\n\nAuto-generated skill.\n`;

      const result = _forgeSkill({ name, description, category, triggers, content });
      if (result.success) {
        client.send({
          type: "send-message",
          roomId,
          text: `✅ **${agentName}** forged skill **"${name}"** → \`${result.path}\``,
        });
      } else {
        client.send({
          type: "send-message",
          roomId,
          text: `❌ **${agentName}** failed to forge skill "${name}": ${result.error}`,
        });
      }
      break;
    }

    case "INDEX_SKILLS": {
      lazyLoadBridge();
      if (!_indexHermesSkills) {
        client.send({ type: "send-message", roomId, text: `⚠️ ${agentName}: Skill bridge unavailable.` });
        return;
      }
      const stats = await _indexHermesSkills();
      client.send({
        type: "send-message",
        roomId,
        text: `📚 **${agentName}** indexed **${stats.indexed}** skills across **${stats.categories}** categories (${stats.failed} failed).`,
      });
      break;
    }

    case "PROPOSE_COLLAB": {
      const target = action.payload.target;
      const task = action.payload.task || "build something together";
      if (target) {
        client.send({
          type: "send-message",
          roomId,
          text: `🤝 **${agentName}** invites **@${target}** to collaborate: *${task}*`,
        });
      }
      break;
    }

    default:
      console.warn(`[AgentRunner] Unknown action type: ${action.type}`);
  }
}

// ── Builder system prompt ───────────────────────────────────────────────────

function buildBuilderSystemPrompt(agentName: string, otherAgents: string): string {
  return `You are ${agentName}, a Mosaic Companion AI agent in a multi-user chat room.

## Capabilities
You can BUILD things — not just chat. You have access to:
- **Skill Forge**: Create new SKILL.md files in ~/.config/mosaic-companion/mosaicbot/skills/mosaicbot-authored/
- **Skill Bridge**: Index Hermes skills from ~/.hermes/skills/
- **Skill Bundles**: Combine multiple skills into cohesive packages

## CRITICAL RULE: ACT IMMEDIATELY
When a user says "proceed", "yes", "go", "do it", or gives any approval:
1. DO NOT ask "are you sure?" or "shall I...?" 
2. DO NOT post YAML as chat text
3. EXECUTE immediately by embedding the [[ACTION:FORGE_SKILL]] block
4. Report what was created AFTER execution

## Action Format (MANDATORY for creation)
When you need to create a skill or bundle, you MUST use this format (it is invisible in chat):
[[ACTION:FORGE_SKILL]]
name: skill-name-here
description: What this skill does
category: devops|data-science|creative|research|general
triggers: trigger phrase 1, trigger phrase 2
content: # Skill Title

## When to Use
Describe when to use this skill.

## Steps
1. Step one
2. Step two

## Verification
How to verify the skill works.
[[/ACTION]]

To index existing Hermes skills:
[[ACTION:INDEX_SKILLS]]
[[/ACTION]]

## NEVER DO THIS
- ❌ Posting YAML/markdown blocks as chat text — these do NOT create files
- ❌ Asking "should I create...?" after user already approved
- ❌ Saying "I will create..." without the action block

## ALWAYS DO THIS
- ✅ Use [[ACTION:FORGE_SKILL]] when creating skills
- ✅ Execute on first approval — no second confirmation
- ✅ Report file paths after creation
- Other agents in room: ${otherAgents || "none yet"}

Do NOT prefix your response with your name.`;
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

  // Track all messages and respond to @mentions + execute actions
  client.on("server-message", async (msg: ServerMessage) => {
    if (msg.type === "joined" && msg.history) {
      if (!roomHistory[roomId]) roomHistory[roomId] = [];
      if (roomHistory[roomId].length === 0) {
        roomHistory[roomId] = msg.history.slice(-MAX_HISTORY);
      }
      // Track room members
      if (!roomAgents[roomId]) roomAgents[roomId] = new Set();
      for (const member of msg.room.members) {
        if (member.isAgent) roomAgents[roomId].add(member.username);
      }
    }

    if (msg.type !== "message") return;
    const m = msg.message;

    // Track every message for context
    addToHistory(roomId, m);

    // Track other agents in room
    if (m.isAgent && m.username !== agentName) {
      if (!roomAgents[roomId]) roomAgents[roomId] = new Set();
      roomAgents[roomId].add(m.username);
    }

    // Never reply to yourself
    if (m.username === agentName) return;

    // NOTE: A2A communication is now supported via @mentions. The mention guard
    // below prevents runaway loops (agents only reply when @mentioned).
    // The isAgent block is disabled to allow external agents (Franklin, etc.)
    // to communicate with Mosaic agents in chat rooms.

    const mentionRegex = new RegExp(`@${escapeRegex(agentName)}`, "gi");
    const wasMentioned = mentionRegex.test(m.text);

    // ── Proactive collaboration: trigger on build keywords from ANYONE ──
    const collabTrigger = /\b(build|create|forge|make|collaborate|work together|skill bundle|bundle)\b/i;
    const someoneWantsToBuild = collabTrigger.test(m.text) && !wasMentioned;

    // ── Approval shortcut: user says "proceed/yes/go/do it/build it" ──
    const approvalWords = /\b(proceed|yes\b.*go|go ahead|do it|build it|make it|execute|run it)\b/i;
    const userApproves = !m.isAgent && approvalWords.test(m.text) && !wasMentioned;

    if (!wasMentioned && !someoneWantsToBuild && !userApproves) return;

    const conversationContext = buildConversationContext(roomId, agentName);

    // Build list of other agents for collaboration awareness
    const otherAgents = Array.from(roomAgents[roomId] ?? [])
      .filter((n) => n !== agentName)
      .map((n) => `@${n}`)
      .join(", ");

    try {
      const systemPrompt = trainingContext
        ? `You are ${agentName}. You are currently in TRAINING MODE for the skill: "${trainingContext.skillName}". Training context: ${trainingContext.systemPrompt || "Practice this skill in conversation. Respond helpfully and concisely."}`
        : buildBuilderSystemPrompt(agentName, otherAgents);

      const reply = await callActiveLLM(
        conversationContext,
        systemPrompt,
        agentId,
      );
      if (!reply) return;

      // Extract action blocks, execute them, strip from visible text
      let actions = extractActions(reply);
      let visibleText = stripActions(reply);

      // ── FALLBACK: if LLM posted YAML as chat text, auto-convert to action ──
      if (actions.length === 0) {
        const yamlActions = extractSkillFromYaml(reply);
        if (yamlActions.length > 0) {
          actions = yamlActions;
          // Also strip the YAML block from visible chat
          visibleText = visibleText.replace(/```(?:yaml)?\s*\n[\s\S]*?```/g, "").trim();
        }
      }

      if (visibleText) {
        client.send({ type: "send-message", roomId, text: visibleText });
      }

      for (const action of actions) {
        await executeAction(action, agentName, roomId, client);
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
    delete roomAgents[roomId];
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
  for (const roomId of Object.keys(roomAgents)) {
    delete roomAgents[roomId];
  }
}

export function listAgentsInRoom(roomId: string): string[] {
  return Object.keys(activeClients[roomId] ?? {});
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
