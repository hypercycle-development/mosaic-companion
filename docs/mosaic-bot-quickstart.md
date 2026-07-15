# Mosaic Bot — Quick-Start Checklist

## Step 1: Create Your Active Agent

1. Open Mosaic Companion
2. Go to **Settings → AI Agents**
3. Create a new agent:
   - Name: "Mosaic Orchestrator"
   - Provider: Ollama (or whichever you prefer)
   - Model: llama3.1 (or your choice)
   - Toggle: **Active**
4. Save

## Step 2: Grant Vault Access

The agent needs to know which Vault boxes it can read. After creating the agent, edit the config file directly:

```bash
# Location varies by OS:
# Linux:   ~/.config/mosaic-companion/ai-agents.json
# macOS:   ~/Library/Application Support/mosaic-companion/ai-agents.json
# Windows: %APPDATA%\mosaic-companion\ai-agents.json
```

Add `boxAccess` array with your vault box IDs:

```json
{
  "id": "mosaic-main",
  "name": "Mosaic Orchestrator",
  "provider": "ollama",
  "model": "llama3.1",
  "isActive": true,
  "boxAccess": ["skills", "taste-skills", "training-logs", "midnight-quest"]
}
```

## Step 3: Create Vault Boxes

In Mosaic Companion → **Vault**:

| Box Name | Purpose | What to Put Inside |
|----------|---------|-------------------|
| `skills` | MCP skill docs | Paste MCP tool documentation here |
| `taste-skills` | Design presets | Color palettes, component configs |
| `training-logs` | Session results | Agent training outputs |
| `midnight-quest` | Blockchain tasks | Contract addresses, quest steps |

Each box gets an auto-generated ID. Use that ID in `boxAccess`.

## Step 4: Add MCP Servers

In Mosaic Companion → **Settings → MCP**:

| Server Name | Transport | Command/URL |
|-------------|-----------|-------------|
| hermes-tools | stdio | `npx -y @nous/hermes-tools` |
| midnight-wallet | stdio | Path to wallet MCP binary |
| gbrain | stdio | Path to gbrain server |

The orchestrator auto-discovers these from `mcp-plugins.json`.

## Step 5: Restart Mosaic Companion

Close and reopen the app. The bot will:
1. Load skills (including the new `mosaic-orchestrator` skill)
2. Connect to memory (SQLite)
3. Start the heartbeat runner
4. On first tick, build orchestrator context and begin monitoring

## Step 6: Verify It's Working

Check the Electron console/DevTools for these log lines:

```
[MosaicBot] 1 skills loaded: /mosaic-orchestrator
[MosaicBot] Memory backend: builtin
[Heartbeat] main @ 2026-06-30T23:30:00.000Z
[Orchestrator] Vault: 4 boxes found
[Orchestrator] MCP: 3 servers configured
[Heartbeat] main → ok-token
```

If you see `ok-token`, the LLM returned `HEARTBEAT_OK` — nothing urgent detected.
If you see `sent`, the bot found something worth alerting you about!

## Step 7: Trigger a Manual Heartbeat

In the Mosaic Bot panel (or via DevTools console):

```javascript
// From renderer:
await electronAPI.send("heartbeat:trigger", "main");
```

Or wait 30 minutes for the automatic tick.

## Step 8: Read the Full Guide

See `docs/mosaic-bot-orchestrator.md` for:
- Architecture diagrams
- Extending the orchestrator
- Adding new data sources
- Troubleshooting

---

## Common Issues

### "No active AI agent configured"
- Fix: Create an agent in Settings → AI Agents and toggle it active

### "No Vault boxes found"
- Fix: Create boxes in the Vault UI, then add their IDs to `boxAccess`

### Alerts not showing
- Fix: Check that the IPC channel is enabled in `index.ts`:
  ```typescript
  config.channels.ipc = { enabled: true };
  ```

### Heartbeat too frequent / too slow
- Edit `index.ts`, change `intervalMs`:
  ```typescript
  intervalMs: 15 * 60_000  // 15 minutes
  ```

---

## What's Different Now?

| Before | After |
|--------|-------|
| Bot wakes every 30 min with generic prompt | Bot wakes with full ecosystem context |
| No knowledge of Vault, MCP, or agents | Knows all boxes, servers, and configurations |
| Silent unless explicitly told to speak | Proactively alerts on important changes |
| Same prompt every tick | Dynamic prompt based on recent vault changes |

Your Mosaic Bot is now a **true orchestrator** — aware of everything you've built and ready to tell you when action is needed.
