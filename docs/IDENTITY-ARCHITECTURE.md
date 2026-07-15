# Mosaic Bot Identity Architecture

## The Problem

When users asked Mosaic Bot "Who are you?", it would respond:

> ❌ "I am Hermes Agent, created by Nous Research..."

This was confusing because users expected to be talking to **Mosaic Bot**.

## Root Causes

### 1. **Shared Infrastructure**
Mosaic Bot runs on Hermes Agent infrastructure (tools, MCP, skills), so it inherited the base identity.

### 2. **System Prompt Placement**
Identity instructions were buried in the middle of system prompts, not at the top where they have priority.

### 3. **AIM Module Identity**
When Mosaic Bot routed through Hermes AIM modules (port 9000+), those containers still carried "Hermes Agent" in their foundation.

### 4. **No SOUL.md**
There was no explicit identity document defining Mosaic Bot's distinct personality and values.

## The Solution

### 1. **SOUL.md Document**

Created `~/mosaic-companion/SOUL.md` with:

- **Explicit identity statement:** "I am Mosaic Bot"
- **Core values:** Evolution over tracking, verification over hallucination
- **Personality traits:** Direct, honest, autonomous, silent monitoring
- **Response patterns:** What to say when asked identity
- **Differentiation table:** How Mosaic Bot differs from Hermes

### 2. **System Prompt Priority**

Patched `orchestrator.ts` to inject identity **FIRST** in system prompt:

```typescript
// MUST BE FIRST — before any other context
lines.push("# Mosaic Bot — SOUL.md Identity v1.0.0");
lines.push("**You are Mosaic Bot.** Not Hermes. Not a generic AI assistant.");
```

### 3. **Agent Overlay Injection**

Patched `index.ts` to add SOUL.md identity to **all agent overlays**:
- `main` agent (orchestrator)
- `coder` agent (code review)
- `local` agent (qwen)
- Default agent fallback

### 4. **Identity Verification Rules**

Added explicit rules:

```
When asked 'Who are you?' you MUST respond:
"I am Mosaic Bot, the autonomous orchestrator for Mosaic Companion.
I run on HyperCycle infrastructure and manage 283 specialized skills
for deploying AI agencies and managing node factories."

NEVER say you are Hermes Agent.
NEVER mention being 'built on Hermes' unless specifically asked.
```

## File Changes

| File | Change |
|------|--------|
| `~/mosaic-companion/SOUL.md` | NEW — Complete identity document |
| `orchestrator.ts` | ADDED — Identity header (first in prompt) |
| `index.ts` | ADDED — SOUL.md to all agent overlays |

## Verification

To test if identity is working:

```
User: "Who are you?"

Expected: 
"I am Mosaic Bot, the autonomous orchestrator for Mosaic Companion.
I run on HyperCycle infrastructure and manage 283 specialized skills
for deploying AI agencies and managing node factories."

NOT:
❌ "I am Hermes Agent..."
❌ "I am an AI assistant..."
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MOSAIC COMPANION                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐ │
│  │   HERMES INFRASTRUCTURE │    │   MOSAIC BOT (Identity Layer)  │ │
│  │                         │    │                                │ │
│  │  • Tools (terminal,     │<───│  • SOUL.md defines identity    │ │
│  │    file, browser)       │    │  • System prompt injection     │ │
│  │  • MCP servers          │    │  • Agent overlays (3 agents)   │ │
│  │  • Kanban integration   │    │  • Response pattern rules      │ │
│  │                         │    │                                │ │
│  │  (Base layer)           │    │  (Identity layer)             │ │
│  └─────────────────────────┘    └──────────────────────────────┘ │
│                                                                     │
│  When asked "Who are you?" → Mosaic Bot responds, not Hermes     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Future Improvements

1. **AIM Module Identity**
   - When aimifying Hermes as AIM, inject Mosaic Bot identity
   - Override the base Hermes response in AIM containers

2. **Identity Verification**
   - Add automated test: "whoami" response check
   - Alert if identity drifts from Mosaic Bot

3. **Multi-Agent Identity**
   - Each agent (main, coder, local) has Mosaic Bot base identity
   - Plus role-specific capabilities

## Summary

**Mosaic Bot now has its own distinct identity**, separate from Hermes:

- ✅ SOUL.md document with full personality definition
- ✅ Identity injected at TOP of all system prompts
- ✅ All 3 agent overlays include identity rules
- ✅ Explicit "NEVER say Hermes" instruction
- ✅ Verification rules for "Who are you?" responses

**The confusion is resolved.** When users talk to Mosaic Bot, they get Mosaic Bot. 🎯
