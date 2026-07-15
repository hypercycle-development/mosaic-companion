---
name: codex
description: "Delegate coding tasks to OpenAI Codex CLI - AI-powered coding assistant for the terminal."
version: 1.0.0
metadata:
  hermes:
    tags: [codex, openai, coding, cli, agentic]
    related_skills: [claude-code, opencode, hermes-agent]
---

# Codex CLI

Codex CLI is OpenAI's official coding assistant for the terminal. It provides agentic coding capabilities powered by OpenAI's models.

## When to Use

Use Codex when you want agentic coding assistance powered by OpenAI models like GPT-4o and o3.

## Prerequisites

- Codex CLI installed: `npm install -g @openai/codex`
- OpenAI API key configured

## Usage

```bash
# Start interactive session
codex

# Run a specific task
codex "fix the bug in src/utils.ts"

# Execute with flags
codex --model gpt-4o "add error handling to all API calls"
```

## Key Features

- **Agentic execution**: Can read files, make edits, run commands
- **Multiple models**: Supports GPT-4o, o3-mini, and more
- **Sandboxed**: Runs commands in a sandbox for safety
- **Approval modes**: Configure auto-approval for safe operations

## Comparison with Other Agents

| Feature | Codex CLI | Claude Code | Hermes Agent |
|---------|-----------|-------------|--------------|
| Provider | OpenAI | Anthropic | Nous Research |
| Sandbox | Yes (default) | Yes | Configurable |
| Skill System | No | No | Yes |
| Multi-platform | Terminal | Terminal | Terminal + Gateways |

## Integration with Hermes

Hermes can spawn Codex CLI as a subprocess for specialized coding tasks using the `codex` command.
