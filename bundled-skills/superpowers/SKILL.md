---
name: superpowers
description: "Apply the Superpowers agentic software-development methodology: spec-driven planning, true red/green TDD, subagent-driven implementation, systematic debugging, and code-review workflows."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [software-development, external-repo, integration]
    homepage: https://github.com/
    related_skills: [hermes-agent, native-mcp]
---

# Superpowers Methodology

Superpowers (obra/superpowers) is an agentic skills framework and software-development methodology. It provides composable skills plus session-start instructions so a coding agent does not jump straight into code, but instead: (1) discovers the real goal, (2) writes a readable spec in chunks, (3) produces an implementation plan a junior engineer can follow, (4) executes via subagent-driven development with TDD and code review.

## Core principles

1. **Understand before building** — tease the real requirement out of the conversation.
2. **Readable spec in chunks** — show the design in pieces the human can digest and sign off on.
3. **Junior-engineer plan** — clear red/green TDD steps, YAGNI, DRY.
4. **Subagent-driven development** — delegate engineering tasks, inspect and review, continue forward.
5. **Systematic debugging** — reproduce, isolate, verify, fix, test, prevent.
6. **Code review** — review before declaring done.

## How to apply (independent of harness)

When asked to implement anything non-trivial:

1. Pause and ask clarifying questions until the real goal is clear.
2. Draft a spec with sections: Goal, Context, Decisions, Acceptance Criteria.
3. Break the spec into chunks and get user sign-off.
4. Write an implementation plan with TDD steps.
5. Use `delegate_task` / subagents for parallel engineering tasks.
6. Review each subagent result, run tests, iterate.
7. Final review: security, tests, docs, commit message.

## Agent-specific install formats

- **Claude Code**: `/plugin install superpowers@claude-plugins-official` or marketplace.
- **Cursor**: `/add-plugin superpowers`.
- **Codex CLI/App**: plugin marketplace.
- **OpenCode / Kilo / Kimi / Gemini CLI / Antigravity / Pi**: follow their plugin/skill install commands.
- **Hermes**: use this skill — the methodology is harness-agnostic.

## Pitfalls

- This repo has a very high PR rejection rate; do not submit PRs without reading `CLAUDE.md` and the PR template.
- Never use the methodology as an excuse to skip user confirmation on irreversible actions.
- Do not pad markdown tables (repo style rule).

## Resources

- https://github.com/obra/superpowers

