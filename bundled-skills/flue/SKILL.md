---
name: flue
description: "Build, deploy, and integrate Flue agents (TypeScript harness with sandboxes, durable execution, subagents, tools, skills, and channels). Use the CLI to fetch version-matched docs and blueprints."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [autonomous-ai-agents, external-repo, integration]
    homepage: https://github.com/
    related_skills: [hermes-agent, native-mcp]
---

# Flue Agent Harness

Flue is a TypeScript framework for building autonomous agents and AI workflows. It provides a programmable harness: agents, workflows, sandboxes, durable execution, subagents, typed tools, skills, and channels. Projects compile into deployable server artifacts (e.g., Cloudflare Workers).

## When to use

- You want a TypeScript-native agent framework with durable execution and sandboxing.
- You need to expose agents over HTTP with typed tools and skills.
- You want to add provider channels (Discord, Slack, WhatsApp, Stripe, etc.) or persistence adapters via CLI blueprints.

## Installation

```bash
npm create flue@latest my-flue-project
cd my-flue-project
pnpm install
```

Requires Node >= 22 and pnpm >= 11.

## Core concepts

- **Agent profile** — reusable `defineAgentProfile(...)` value.
- **Created agent** — runtime initializer from `createAgent(...)`.
- **Agent module** — `agents/<name>.ts` default-exporting a created agent.
- **Workflow** — `workflows/<name>.ts` exporting `run(...)`.
- **Sandbox** — local (`@flue/runtime/node`), container, or remote providers.
- **Channel** — inbound/outbound provider integration via webhooks/APIs.
- **Skill** — imported `SKILL.md` with `{ type: "skill" }` assertion.

## Minimal agent

```ts
import { createAgent, type AgentRouteHandler } from '@flue/runtime';
import { local } from '@flue/runtime/node';
import triage from '../skills/triage/SKILL.md' with { type: 'skill' };

const instructions = `Triage a bug report end-to-end...`;

export const route: AgentRouteHandler = async (_c, next) => next();

export default createAgent(() => ({
  model: 'anthropic/claude-sonnet-4-6',
  tools: [...],
  skills: [triage],
  sandbox: local(),
  instructions,
}));
```

## CLI commands

```bash
flue dev              # run locally
flue build            # compile/deploy
flue add channel <url>
flue add sandbox <url>
flue add database <url>
flue docs read <path>
flue docs search <query>
```

## Hermes integration patterns

1. **Co-existing agent runtime**: Hermes can spawn Flue agents via `flue dev` or HTTP dispatch.
2. **Skill exchange**: Flue `SKILL.md` files can be imported into Hermes Vault / skill system.
3. **MCP bridge**: Flue runtime exposes `connectMcpServer` for remote MCP tools; Hermes can connect to a deployed Flue agent's HTTP endpoint or vice versa.
4. **Blueprint docs**: `flue add` guides are Markdown implementation guides — useful for agent-driven project scaffolding.

## Pitfalls

- Node 22+ is required; the CLI bin checks version and refuses older Node.
- pnpm workspace with catalog versions; use pnpm, not npm.
- TS `with { type: "skill" }` import assertion requires TypeScript 5.x and Node import attributes support.
- Skill references are runtime metadata; actual skill text is bundled at build time.

## Resources

- https://github.com/withastro/flue
- https://flueframework.com/docs

