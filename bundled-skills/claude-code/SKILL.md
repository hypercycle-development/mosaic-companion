---
name: claude-code
description: "Delegate coding tasks to Claude Code CLI - Anthropic's agentic coding tool that lives in your terminal."
version: 1.0.0
metadata:
  hermes:
    tags: [claude-code, anthropic, coding, agentic, cli]
    related_skills: [codex, opencode, hermes-agent]
---

# Claude Code

Claude Code is Anthropic's agentic coding tool that lives in your terminal. It understands your codebase and helps you code faster.

## When to Use

Use Claude Code when you need deep codebase understanding and agentic coding assistance within the Anthropic ecosystem.

## Prerequisites

- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`
- Anthropic API key configured

## Usage

```bash
# Start interactive session
claude

# Ask a question about your codebase
claude "explain how authentication works in this project"

# Execute a coding task
claude "refactor the UserService to use dependency injection"
```

## Key Features

- **Codebase-aware**: Understands your project's structure and conventions
- **Agentic execution**: Can make edits, run tests, and iterate
- **Multi-file changes**: Handles complex refactors across many files
- **Safe by default**: Shows diffs before applying changes

## Comparison with Other Agents

| Feature | Claude Code | Codex CLI | Hermes Agent |
|---------|-------------|-----------|--------------|
| Provider | Anthropic | OpenAI | Nous Research |
| Terminal UI | Rich TUI | CLI | Terminal + Gateways |
| Skill System | No | No | Yes |
| Multi-platform | Terminal only | Terminal | Terminal + Discord/Slack/etc |

## Integration with Hermes

Hermes can spawn Claude Code as a subprocess for specialized coding tasks using the `claude` command.
