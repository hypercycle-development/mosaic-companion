# Mosaic Bot — Activation Guide

> This guide explains why the panel was empty and how to activate everything.

---

## Why Was It Empty?

The Mosaic Bot **main process** (backend) was already wired with all the orchestrator code, but the **renderer process** (UI) had two problems:

1. **Preload script** didn't expose the new APIs (orchestrator status, skill importer)
2. **UI panel** only showed Memory + Skills — no orchestrator, no infrastructure, no agent profiles

Both are now fixed.

---

## What Changed

### Preload Script (`electron/integrations/mosaicbot/src/preload.ts`)
Added new APIs:
- `agent.getOrchestratorStatus()` — reads vault, MCPs, agents, infrastructure
- `agent.getAgentProfiles()` — lists main/coder/local agents
- `agent.getImportLog()` — shows imported Hermes skills
- `agent.getPendingImports()` — skills awaiting approval
- `agent.approveSkill(name)` — approve a pending skill
- `agent.removeSkill(name)` — remove an imported skill
- `agent.forceScan()` — trigger immediate skill scan

### UI Panel (`src/components/MosaicBotPanel.tsx`)
Complete rewrite with 4 tabs:

| Tab | What You See |
|-----|-------------|
| **Overview** | Memory status, Skills count, Orchestrator status, Importer status, Agent profiles, Message feed, Send input |
| **Skills** | All loaded skills with descriptions |
| **Importer** | Pending skills (awaiting approval), Import log with status |
| **Infrastructure** | SPO host, C-3PO, R2D2 health status with indicators |

---

## How to Activate

### Step 1: Restart Mosaic Companion

**Close the app completely** (not just minimize) and reopen it.

This loads:
- New preload script (renderer IPC bridge)
- New main process code (orchestrator + skill importer)
- New UI panel (tabs, status cards, infrastructure view)

### Step 2: Verify in Console

Open DevTools (Ctrl+Shift+I or Cmd+Option+I) and look for:
```
[MosaicBot] 4 skills loaded: /mosaic_orchestrator, /stargate_doctor, /auto_skill_importer
[MosaicBot] Skill importer started — watching ~/.hermes/skills
[Heartbeat] main @ 2026-06-30T...
```

### Step 3: Open Mosaic Bot Panel

In the Mosaic Companion UI, navigate to the **Mosaic Bot** panel.

You should now see:
- **Header**: "MOSAIC BOT — Orchestrator · 3 agents · 4 skills"
- **Tabs**: Overview | Skills (4) | Importer (0) | Infrastructure
- **Status Cards**: Memory, Skills, Orchestrator, Importer
- **Agent Profiles**: main (30 min), coder (60 min), local (15 min)
- **Infrastructure**: SPO, C-3PO, R2D2 with health indicators

---

## Tab Breakdown

### Overview Tab
```
┌─────────────────────────────────────────────┐
│ System Status                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │ Memory   │ │ Skills   │ │ Orch.    │   │
│ │ 0 files  │ │ 4        │ │ 4 boxes  │   │
│ │ synced   │ │ active   │ │ 10 MCPs  │   │
│ └──────────┘ └──────────┘ └──────────┘   │
│ ┌──────────┐                              │
│ │ Importer │                              │
│ │ 0        │                              │
│ │ up to    │                              │
│ │ date     │                              │
│ └──────────┘                              │
├─────────────────────────────────────────────┤
│ Agent Profiles                            │
│ ┌─────────────────────────────────────┐     │
│ │ main · 30 min · 09:00 → 22:00    │     │
│ │ Orchestrator...                     │     │
│ ├─────────────────────────────────────┤     │
│ │ coder · 60 min · 10:00 → 20:00   │     │
│ │ Code Review...                     │     │
│ ├─────────────────────────────────────┤     │
│ │ local · 15 min · 00:00 → 23:59   │     │
│ │ Lightweight qwen...                │     │
│ └─────────────────────────────────────┘     │
├─────────────────────────────────────────────┤
│ Message Feed                                │
│ Waiting for bot messages...                 │
├─────────────────────────────────────────────┤
│ Send to Agent                               │
│ [ /skill or free text...    ] [Send]        │
└─────────────────────────────────────────────┘
```

### Skills Tab
Shows all 4 loaded skills:
- `/mosaic_orchestrator`
- `/stargate_doctor`
- `/auto_skill_importer`
- Any skills imported from Hermes

### Importer Tab
Shows:
- **Pending Approval**: Skills detected in ~/.hermes/skills that need manual approval
- **Import Log**: History of all imported/removed skills with timestamps
- **Force Scan**: Button to trigger immediate scan

### Infrastructure Tab
Shows HyperAIBox fleet:
- **SPO Host** — 192.168.0.112:9100 (status indicator)
- **C-3PO** — 192.168.0.151:8100, 128 slots, arm64
- **R2D2** — 192.168.0.38:8100, 8 slots, arm64

Status indicators:
- 🟢 Green = healthy
- 🟠 Amber = unhealthy/down
- ⚪ Gray = unknown/not checked yet

---

## Troubleshooting

### "Still showing 0 skills"
→ The preload script isn't loading. Make sure you fully restarted the app (quit + reopen, not just close window).

### "Infrastructure tab shows 'Orchestrator not available'"
→ The main process hasn't initialized yet. Wait 5-10 seconds after app start, or check console for `[MosaicBot]` logs.

### "Skills tab is empty"
→ Skills are loaded from `electron/integrations/mosaicbot/bundled-skills/`. Verify the directory has SKILL.md files.

### "Pending imports not showing"
→ The importer watches `~/.hermes/skills/`. If you have no new skills there, nothing will show as pending.

### "Can't approve skills"
→ The `skills:approve` IPC handler requires the skill name (directory name). Make sure you're clicking the correct approve button.

---

## Next Actions

1. **Restart Mosaic Companion now**
2. **Open Mosaic Bot panel** — verify all 4 tabs appear
3. **Trigger Heartbeat** — click the Zap button, verify console logs
4. **Check Infrastructure** — see if SPO/C-3PO/R2D2 show status
5. **Add a skill to ~/.hermes/skills/** — watch the Importer tab detect it

---

## Architecture Reminder

```
Mosaic Companion Window (Renderer)
    ↓
Preload Script (electron/preload.ts)
    ↓
Main Process (electron/main.ts)
    ↓
Mosaic Bot (electron/integrations/mosaicbot/src/main/index.ts)
    ↓
Orchestrator + Importer + Heartbeat + Skills
```

The preload script is the **bridge** between UI and backend. Without the new preload, the UI couldn't call `getOrchestratorStatus()` or `getPendingImports()`.

---

**Restart the app now and your Mosaic Bot will be fully visible.** 🎯
