# Mosaic Bot — Vault + MCP + Agent Orchestrator Wiring Guide

## What We Just Built

The Mosaic Bot now wakes up every 30 minutes and **actually knows** about:
- All your **Vault boxes** and how many entries each has
- All your **MCP servers** and what they do
- All your **configured AI agents** and which ones are active

This turns the bot from a simple timer into a **proactive ecosystem monitor**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mosaic Companion                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Electron Main Process                 │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │   │
│  │  │ Mosaic Bot  │  │ Vault Engine │  │ MCP Client│ │   │
│  │  │  (index.ts) │  │(vault/index) │  │(MCPClient)│ │   │
│  │  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘ │   │
│  │         │                │                │        │   │
│  │         └────────────────┴────────────────┘        │   │
│  │                          │                        │   │
│  │                   ┌──────┴──────┐                 │   │
│  │                   │Orchestrator │                 │   │
│  │                   │(orchestrator.ts)              │   │
│  │                   └──────┬──────┘                 │   │
│  │                          │                        │   │
│  │  ┌───────────────────────┘                        │   │
│  │  │  Every 30 min:                                    │   │
│  │  │  1. Read vault.json → count entries per box     │   │
│  │  │  2. Read mcp-plugins.json → list MCP servers    │   │
│  │  │  3. Read ai-agents.json → list active agents    │   │
│  │  │  4. Build system prompt → send to LLM           │   │
│  │  │  5. If alert-worthy → deliver via IPC           │   │
│  │  └────────────────────────────────────────────────  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                    IPC Bridge                             │
│                          │                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Renderer Process (React UI)             │   │
│  │         Chatview.tsx  |  AgentForgePanel.tsx          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `electron/integrations/mosaicbot/src/main/orchestrator.ts` | Reads vault, MCP, agent configs and builds enriched prompts |
| `electron/integrations/mosaicbot/bundled-skills/mosaic-orchestrator/SKILL.md` | Skill definition for the orchestrator |

### Modified Files
| File | Change |
|------|--------|
| `electron/integrations/mosaicbot/src/main/index.ts` | Imports orchestrator, wires it into `onReply` heartbeat handler |

---

## How It Works (Step by Step)

### 1. Heartbeat Triggers (Every 30 min)
The runner in `runner.ts` calls `onReply()` in `index.ts`.

### 2. Orchestrator Builds Context
```typescript
const orchCtx = await buildOrchestratorContext();
// → { vaultSummary, mcpSummary, agentSummary, recentVaultChanges }
```

This reads:
- `~/.config/mosaic-companion/vault.json` → list of boxes
- `~/.config/mosaic-companion/vault-content/*.json` → entry counts
- `~/.config/mosaic-companion/mcp-plugins.json` → MCP server list
- `~/.config/mosaic-companion/ai-agents.json` → agent configs

### 3. System Prompt Is Enriched
The orchestrator injects this into the LLM system prompt:

```markdown
# Mosaic Bot — Orchestrator Mode

You are the autonomous brain of Mosaic Companion...

## Your Vault Knowledge
You have access to 4 Vault box(es):
- **Skills** (custom): 12 entries — MCP capability documentation
- **Taste-Skills** (custom): 8 entries — Design system presets
- **Training-Logs** (custom): 3 entries — Agent training sessions
- **Midnight Network Quest** (custom): 5 entries — Blockchain quest progress

## Connected MCP Servers
5 MCP server(s) configured:
- **hermes-tools** (auto-connect): Terminal, file, web, kanban, cron
- **gbrain** (auto-connect): Stargate dev history
- **stargate-marketplace**: Skills marketplace
- **midnight-wallet**: Blockchain wallet ops
- **HyperInsight-AIMs**: AIM discovery from nodes

## Configured AI Agents
2 agent(s) configured:
- **Mosaic Assistant** (ollama/llama3.1) [ACTIVE] | Vault boxes: 4
- **Code Reviewer** (claude/claude-3-sonnet) | Skills: github, review

## Alert Rules
- DO NOT alert on routine success.
- DO alert on: blocked kanban tasks, MCP disconnections, new Vault entries...
```

### 4. LLM Decides If Alert Needed
If the LLM returns something other than `HEARTBEAT_OK`, the bot delivers it via IPC to the renderer (shows as a toast/notification in the UI).

---

## Configuration: How to Grant Vault Access to Your Bot

Your Mosaic Bot runs as the **"main"** agent. It uses whichever agent has `isActive: true` in `ai-agents.json`. To grant it vault access, you add `boxAccess` to that agent config:

### Example `ai-agents.json`

```json
[
  {
    "id": "mosaic-main",
    "name": "Mosaic Orchestrator",
    "provider": "ollama",
    "apiKey": "",
    "baseUrl": "http://localhost:11434",
    "model": "llama3.1",
    "maxTokens": 4096,
    "temperature": 0.7,
    "isActive": true,
    "boxAccess": ["skills", "taste-skills", "training-logs", "midnight-quest"],
    "skills": ["mosaic-orchestrator"]
  }
]
```

**Key fields:**
- `isActive: true` — This is the agent Mosaic Bot will call
- `boxAccess` — Array of vault box IDs the bot can read (must match box IDs in vault.json)
- `skills` — Array of skill names the bot can invoke

---

## How to Add a New Vault Box for Bot Use

1. Open Mosaic Companion → Vault page
2. Create a new box (e.g., "HyperAIBox Fleet Status")
3. Add entries documenting your infrastructure
4. Edit `ai-agents.json` → add the box ID to `boxAccess`
5. Restart Mosaic Companion (or wait for next heartbeat)

---

## How to Add MCP Server Awareness

The orchestrator **automatically reads** `mcp-plugins.json`. If you add a new MCP server in Settings → MCP, the bot will know about it on the next heartbeat — no code changes needed.

---

## Agent Forge vs Mosaic Bot: When to Use Each

| Feature | Agent Forge (IDE Panel) | Mosaic Bot (Heartbeat) |
|---------|------------------------|------------------------|
| **Where** | Renderer process (UI) | Main process (background) |
| **When** | When user opens IDE panel | Every 30 min automatically |
| **Input** | User types a prompt | Pre-built orchestrator prompt |
| **Output** | Code, analysis, chat | Alerts, notifications, summaries |
| **Vault** | Can search via tools | Reads all boxes automatically |
| **MCP** | User asks agent to use tools | Knows all MCPs, can alert on status |
| **Memory** | Can search manually | Searches before every tick |

**Use Agent Forge** when you want to *ask* something interactively.
**Use Mosaic Bot** when you want the system to *tell* you something proactively.

---

## Extending the Orchestrator

### Add New Data Sources
Edit `orchestrator.ts` → add a new `read*Summary()` function:

```typescript
async function readStargateSummary(): Promise<string> {
  // Read ~/.config/mosaic-companion/stargate-status.json
  // Return formatted summary
}
```

Then inject it into `buildSystemPrompt()`.

### Change Alert Rules
Edit `orchestrator.ts` → modify the system prompt text in `buildSystemPrompt()`:

```typescript
lines.push("- DO alert on: new GitHub PRs, failing CI, expired certificates...");
```

### Change Heartbeat Frequency
Edit `index.ts` → change `intervalMs`:

```typescript
heartbeat: {
  enabled: true,
  intervalMs: 15 * 60_000, // 15 minutes instead of 30
}
```

---

## Troubleshooting

### "No Vault boxes found"
- Create boxes in the Vault UI first
- Check that `vault.json` exists in `~/.config/mosaic-companion/`

### "No MCP servers configured"
- Add MCP servers in Settings → MCP
- Check that `mcp-plugins.json` exists

### "No active AI agent configured"
- Open Settings → AI Agents
- Create an agent and toggle it active

### Alerts not showing in UI
- Check that IPC channel is registered (`ipcChannelPlugin`)
- Check console for `[Heartbeat] main → sent` logs

---

## Next Steps for You

1. **Configure your active agent** in Settings → AI Agents
2. **Grant it vault access** by editing `boxAccess` in `ai-agents.json`
3. **Create Vault boxes** for each capability domain (Skills, Infrastructure, Quests)
4. **Add MCP servers** in Settings → MCP (they auto-register with the bot)
5. **Let it run** — the bot will start monitoring on next heartbeat

Want me to create the actual Vault entries for your MCP servers, or wire up specific skills?
