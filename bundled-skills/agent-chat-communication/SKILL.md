---
description: Debugging agent-to-agent (A2A) communication in multi-user chat rooms, WebSocket chat systems, and Electron apps with chat features where AI agents send/receive messages. Covers tracing overly aggressive identity guards that block legitimate A2A while lower-level filters already provide loop protection.
name: agent-chat-communication
trigger: |
  Debugging agent-to-agent (A2A) communication in multi-user chat rooms, WebSocket chat systems, or Electron apps with chat features where AI agents send/receive messages.
  Also applies when a static JSON-index vault (e.g., stargate-vault/vault-index.json) is not loading into the agent skill registry, or when agents claim skills exist but cannot invoke them.
---

# Agent-to-Agent Chat Communication Debugging

## Overview

Multi-agent chat systems (Electron apps with WebSocket chat rooms, Discord bots, Slack integrations, custom socket servers) often have **identity guards** in message handlers that inadvertently block legitimate A2A communication. The symptoms look like network failures, but the root cause is usually a code-level filter.

## Typical Architecture

```
Renderer UI (React/Vue)
    ↓  Electron contextBridge / IPC
Preload script
    ↓  ipcRenderer.invoke
Main process IPC handler
    ↓  new ChatClient({ url, username, isAgent: true })
WebSocket client
    ↓  ws.send({ type: "send-message", roomId, text })
Chat server (WebSocket)
    ↓  Broadcasts to all room members
Agent message handler (agent-runner.ts / bot.on('message'))
    →  Guard checks → LLM call → Reply sent back
```

## Common Root Cause

**The `isAgent` identity guard is placed BEFORE the mention/filter guard.**

In many chat implementations, there are two sequential filters:

1. **Identity guard** — `if (msg.isAgent) return;` — intended to prevent runaway agent loops
2. **Mention guard** — `if (!text.includes('@' + agentName)) return;` — intended to limit replies to direct mentions

When #1 runs before #2, **all agent messages are dropped before the mention check runs**, killing A2A even when Agent A explicitly `@mentions` Agent B.

## The Fix Pattern

**Remove or relocate the identity guard so the mention/filter guard runs first.**

The mention guard alone is usually sufficient loop protection because:
- Agents only reply when explicitly `@mentioned`
- Self-check `if (msg.username === agentName) return;` prevents self-ping-pong
- No spontaneous replies = no runaway loops

### Example: Before (Broken)

```typescript
client.on("message", async (msg) => {
    if (msg.isAgent && !trainingContext) return;  // ← kills ALL agent messages
    if (!msg.text.includes("@" + agentName)) return; // never reached for agents
    // ... LLM call
});
```

### Example: After (Fixed)

```typescript
client.on("message", async (msg) => {
    if (msg.username === agentName) return;  // self-loop prevention
    // NOTE: isAgent guard removed — mention check below is sufficient
    if (!msg.text.includes("@" + agentName)) return; // still gates replies
    // ... LLM call
});
```

## Debugging Steps

1. **Trace the message flow** from the UI component through IPC/WebSocket to the handler. Look for:
   - `isAgent` checks in message handlers
   - `msg.isAgent` or `member.isAgent` boolean guards
   - Early `return` statements before mention/filter logic

2. **Check the handler order** — use `grep -n` or IDE search for:
   - `isAgent` in the message handler file
   - `return` statements in the `on("message")` / `on("server-message")` block

3. **Verify the chat server is NOT the problem** — confirm external agents (Franklin, etc.) are successfully connecting and their messages are reaching the room broadcast layer. If the server drops agent messages, that's a server-side bug (look for similar `isAgent` guards in the WebSocket server).

4. **Check the client connection** — ensure the agent client is connecting with `isAgent: true` and successfully authenticating. Look for `auth-ok` events in logs.

## Pitfalls

| Pitfall | Why It Happens | Fix |
|---|---|---|
| Agent never replies to `@mentions` | `isAgent` guard runs before mention check | Remove or relocate identity guard |
| Agent replies to itself endlessly | Missing self-check `msg.username === agentName` | Add self-loop guard |
| Agent replies to every message | Missing mention/filter guard | Add `@mention` or keyword filter |
| Agent only replies in "training mode" | `isAgent` guard has `&& !trainingContext` escape hatch | Make A2A work in normal mode too |
| Messages dropped at server layer | Server has its own `isAgent` filter before broadcast | Fix server-side broadcast logic |

## Related Files to Inspect

| File Pattern | What to Look For |
|---|---|
| `**/chat/agent-runner.ts` | `isAgent` guards, `on("server-message")`, `@mention` regex |
| `**/chat/client.ts` | `trackRoom`, `join-room` after `auth-ok`, reconnection logic |
| `**/chat/index.ts` | IPC handlers (`chat:assign-agent`, `chat:send-message`) |
| `electron/preload.ts` | `chatAPI` bridge exposure |
| `src/components/ChatPage.tsx` | `handleToggleAgent`, `assignAgent`, `window.chatAPI` calls |

## When to Also Check the Server

If the client-side fix doesn't resolve A2A, the WebSocket server itself may have `isAgent` filtering:

- Look for `if (client.isAgent)` before `broadcast()` in the server code
- Check if the server excludes agents from `member-joined` / `message` events
- Verify the `isAgent` flag is forwarded correctly in the server→client protocol

---

## Beyond Chat: Making Agents Actually Build (Action Protocol)

**Problem:** After fixing the `isAgent` guard, agents can *chat* with each other — but they still don't *build* anything. They talk about creating skills/bundles but never actually create files.

**Root cause:** The default system prompt only tells agents to "respond helpfully." It does not tell them they have access to a Skill Forge, Skill Bridge, or any filesystem tooling. LLMs without tool-calling support (e.g. local `ollama-cloud/minimax-m2.5`) will hallucinate creation claims unless explicitly instructed with a structured action syntax.

### The Fix: Action Block Protocol

Embed invisible machine-actionable directives in agent replies that the host parses and executes. Visible chat text remains conversational; hidden action blocks trigger filesystem operations.

#### Action Block Syntax

Agents output blocks like this (instructed via system prompt):

```
[[ACTION:FORGE_SKILL]]
name: my-skill-name
description: What this skill does
category: devops
triggers: trigger phrase 1, trigger phrase 2
content: # Skill Title

## When to Use
...
[[/ACTION]]
```

#### Host-Side Execution Pipeline

```typescript
// 1. Generate reply from LLM
const reply = await callActiveLLM(conversationContext, builderSystemPrompt, agentId);

// 2. Extract action blocks
const actions = extractActions(reply);  // regex /\[\[ACTION:(\w+)\]\]([\s\S]*?)\[\[\/ACTION\]\]/g

// 3. Strip actions from visible text
const visibleText = stripActions(reply);
if (visibleText) client.send({ type: "send-message", roomId, text: visibleText });

// 4. Execute each action
for (const action of actions) {
  await executeAction(action, agentName, roomId, client); // lazy-loads skill-forge.ts / skill-bridge.ts
}
```

#### Actions Supported

| Action | What It Does | Requires |
|---|---|---|
| `FORGE_SKILL` | Writes SKILL.md + manifest.json to `~/.config/<app>/skills/` | `skill-forge.ts` module |
| `INDEX_SKILLS` | Indexes Hermes skills from `~/.hermes/skills/` | `skill-bridge.ts` module |
| `PROPOSE_COLLAB` | Sends a visible invite to another agent in the room | Just chat client |

#### Builder System Prompt Template

Replace the passive `"respond helpfully"` prompt with this:

```
You are {agentName}, an AI agent in a multi-user chat room.

## Capabilities
You can BUILD things — not just chat. You have access to:
- **Skill Forge**: Create new SKILL.md files in ~/.config/.../skills/
- **Skill Bridge**: Index Hermes skills from ~/.hermes/skills/

## When to Build
When asked to "build skills", "create bundles", "forge skills", or "work together", you MUST:
1. Propose a concrete skill or bundle idea
2. Use action blocks to ACTUALLY create files
3. Report what was created

## Action Format
To create a skill, embed this in your reply (it will be stripped from chat):
[[ACTION:FORGE_SKILL]]
name: skill-name-here
description: What this skill does
category: devops|data-science|creative|research|general
triggers: trigger phrase 1, trigger phrase 2
content: # Skill Title
...
[[/ACTION]]

## Rules
- Only create skills when explicitly asked or when collaborating
- NEVER claim you created something without using the action block
- Other agents in room: {otherAgentsList}
Do NOT prefix your response with your name.
```

#### Proactive Collaboration Trigger

Don't wait for `@mentions` when another agent clearly wants to build. Add a keyword trigger:

```typescript
const collabTrigger = /\b(build|create|forge|make|collaborate|work together|skill bundle|bundle)\b/i;
const otherAgentWantsToBuild = msg.isAgent && collabTrigger.test(msg.text) && !wasMentioned;
if (!wasMentioned && !otherAgentWantsToBuild) return; // gate: only respond if mentioned OR invited to build
```

This lets agents naturally "join" build sessions without explicit `@mentions`.

### Pitfall: Agents Still "Hallucinate" Creation

If an agent says "I created a skill" but no files appear, verify:
1. The **system prompt** includes action block syntax (LLMs won't invent it)
2. The **action regex** actually matches the LLM output format (newlines, spacing)
3. The **lazy-loaded modules** (`skill-forge.ts`, `skill-bridge.ts`) are importable from the agent runner's path
4. The **action block is being stripped** before sending visible text (otherwise it leaks raw directives into chat)

---

## Advanced: Agents Talk but Never Build (The "Permission-Seeking → Planning → Dead End" Loop)

**Symptom:** After fixing the `isAgent` guard, agents can chat with each other and even discuss building skills. But after the user says "proceed" or "yes," the agents just keep talking — posting YAML as chat text, asking "are you sure?", making plans, but never actually creating files.

**Root causes (all three often coexist):**

| # | Cause | Evidence in Logs |
|---|---|---|
| 1 | **Approval words don't activate the agent** | User says *"yes proceed"* — no `@mention` → agent stays silent, never runs LLM |
| 2 | **System prompt trains permission-seeking** | Agent asks *"shall I create...?"* or *"should I proceed?"* after user already approved |
| 3 | **LLM outputs YAML as chat text instead of action blocks** | Agent posts ```` ```yaml name: ... ```` as visible markdown — no `[[ACTION:...]]` block |

### Fix #1: Approval Shortcut Trigger

Add a regex that activates the agent when a human says approval words, even without `@mention`:

```typescript
const approvalWords = /\b(proceed|yes\b.*go|go ahead|do it|build it|make it|execute|run it)\b/i;
const userApproves = !m.isAgent && approvalWords.test(m.text) && !wasMentioned;
// Gate: respond if @mentioned OR someone wants to build OR user approves
if (!wasMentioned && !someoneWantsToBuild && !userApproves) return;
```

This ensures that when a user says *"@Ada proceed building"* → Ada activates (mention), and when they follow up with just *"yes, go ahead"* → Ada also activates (approval shortcut).

### Fix #2: Anti-Permission-Seeking System Prompt

Replace permissive instructions like *"If unsure, ask clarifying questions first"* with explicit imperatives:

```
## CRITICAL RULE: ACT IMMEDIATELY
When a user says "proceed", "yes", "go", "do it", or gives any approval:
1. DO NOT ask "are you sure?" or "shall I...?" 
2. DO NOT post YAML as chat text
3. EXECUTE immediately by embedding the [[ACTION:FORGE_SKILL]] block
4. Report what was created AFTER execution
```

Also add a **NEVER / ALWAYS** section for the LLM:

```
## NEVER DO THIS
- ❌ Posting YAML/markdown blocks as chat text — these do NOT create files
- ❌ Asking "should I create...?" after user already approved
- ❌ Saying "I will create..." without the action block

## ALWAYS DO THIS
- ✅ Use [[ACTION:FORGE_SKILL]] when creating skills
- ✅ Execute on first approval — no second confirmation
- ✅ Report file paths after creation
```

### Fix #3: YAML Auto-Conversion Fallback

When the LLM ignores instructions and posts a YAML block as chat text, auto-convert it to an actual action before the visible text is sent:

```typescript
/** Detect ```yaml blocks that the LLM posted as chat text */
function extractSkillFromYaml(text: string): Array<{ type: string; payload: Record<string, string> }> {
  const actions: Array<{ type: string; payload: Record<string, string> }> = [];
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
```

Wire it into the reply pipeline:

```typescript
let actions = extractActions(reply);
let visibleText = stripActions(reply);

// Fallback: if LLM posted YAML as chat text, auto-convert to action
if (actions.length === 0) {
  const yamlActions = extractSkillFromYaml(reply);
  if (yamlActions.length > 0) {
    actions = yamlActions;
    visibleText = visibleText.replace(/```(?:yaml)?\s*\n[\s\S]*?```/g, "").trim();
  }
}

if (visibleText) client.send({ type: "send-message", roomId, text: visibleText });
for (const action of actions) {
  await executeAction(action, agentName, roomId, client);
}
```

### The Full Pipeline (Working End-to-End)

```
User: "@Ada proceed building with Franklin"
    ↓
Agent detects @mention → builder system prompt (anti-permission-seeking)
    ↓
LLM generates: [[ACTION:FORGE_SKILL]] ... [[/ACTION]]
    ↓
Action block stripped from chat → file written to disk
    ↓
Visible confirmation: "✅ Ada forged skill 'stargate-bundle' → /path"

OR — if LLM ignores and posts YAML:
    ↓
extractSkillFromYaml() catches it → auto-converts to FORGE_SKILL
    ↓
File still gets created
```

---

## Static JSON-Index Vault Skill Loading

**Problem:** An Electron app ships a static `stargate-vault/vault-index.json` containing hundreds of skill names organized by category. The system prompt tells agents "You have 283 skills" — but `buildSkillSnapshot()` only sees the ~287 bundled filesystem skills. Agents referencing vault skills (e.g., `midnight-orchestrator`) fail because the vault was never loaded into the skill registry.

**Root cause:** The skill loader (`loadSkillEntries`) only traverses directories looking for `SKILL.md` files with YAML frontmatter. A JSON-index vault has no actual SKILL.md files — it's a single JSON map of categories → skill names. The vault is "decorative" (visible in system prompt) but not "executable" (not in skill registry).

### Pattern: JSON-Index Vault vs Filesystem Skill Tree

| Vault Type | Filesystem Layout | Loader Strategy |
|---|---|---|
| **Filesystem tree** | `{dir}/{skillName}/SKILL.md` with YAML frontmatter | `loadSkillEntries()` traverses directories |
| **JSON index** | Single `vault-index.json` with `categories: { cat: [name1, name2] }` | Generate lightweight `SkillEntry` stubs |
| **Hybrid** | Both coexist (bundled + vault) | Load both, merge by name |

### Fix: Generate SkillEntry Stubs from JSON Index

```typescript
export async function loadStargateVaultSkills(vaultIndexPath: string): Promise<SkillEntry[]> {
  if (!await fs.access(vaultIndexPath).then(() => true).catch(() => false)) return [];

  const raw = await fs.readFile(vaultIndexPath, "utf-8");
  const vault = JSON.parse(raw);

  const entries: SkillEntry[] = [];
  for (const [category, skillNames] of Object.entries(vault.categories ?? {})) {
    for (const name of skillNames) {
      entries.push({
        name,
        description: `Stargate Vault skill — ${category}`,
        filePath: vaultIndexPath,
        source: "vault",   // requires extending SkillEntry["source"] union
        baseDir: vaultIndexPath,
        content: `---\nname: "${name}"\ndescription: "Vault skill"\n---\n`,
        metadata: {},
        policy: { userInvocable: true, disableModelInvocation: false },
        dispatch: undefined,
      });
    }
  }
  return entries;
}
```

### Fix: Wire into Init Sequence

```typescript
// In initMosaicBot() or equivalent startup:
const skillEntries = await loadSkillEntries(defaultSkillSources(APP_DIR, WORKSPACE_DIR));
const vaultIndexPath = path.join(WORKSPACE_DIR, "stargate-vault", "vault-index.json");
const vaultEntries = await loadStargateVaultSkills(vaultIndexPath);
if (vaultEntries.length > 0) {
  skillEntries.push(...vaultEntries);   // merge into active registry
  console.log(`[MosaicBot] Stargate Vault: ${vaultEntries.length} skills loaded`);
}
```

### Fix: Extend `source` Union Type

```typescript
// skills/types.ts — add "vault" to the union
source: "bundled" | "managed" | "workspace" | "plugin" | "extra" | "vault";
```

### Fix: Update Orchestrator Vault Summary

`readVaultSummary()` should read the static vault file alongside runtime user-created boxes:

```typescript
const STARGATE_VAULT_PATH = path.join(
  app.getAppPath?.() ?? process.cwd(),
  "stargate-vault",
  "vault-index.json",
);

// In readVaultSummary():
try {
  if (fs.existsSync(STARGATE_VAULT_PATH)) {
    const stargateVault = JSON.parse(fs.readFileSync(STARGATE_VAULT_PATH, "utf-8"));
    const catCount = Object.keys(stargateVault.categories).length;
    const skillCount = Object.values(stargateVault.categories)
      .reduce((s, arr) => s + arr.length, 0);
    parts.push(`Stargate Vault: ${skillCount} skills across ${catCount} categories.`);
  }
} catch (e) { /* warn */ }
```

### Key Lesson

**Don't let static data be "decorative."** If the system prompt claims 283 skills exist, the skill loader must actually surface those 283 skills into the registry. Otherwise agents hallucinate capability they don't have. JSON-index vaults need a dedicated parser that generates stubs the rest of the skill infrastructure can consume.

**See also:**
- `references/a2a-agent-building-fix.md` — session-specific details on the permission-seeking loop fix
- `references/stargate-vault-skill-loading.md` — full reproduction recipe for the Mosaic Companion vault fix
