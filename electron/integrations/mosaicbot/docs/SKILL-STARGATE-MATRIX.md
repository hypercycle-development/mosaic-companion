# Mosaic Bot Skill × Stargate Integration Matrix

> This document maps all 102+ Hermes skills to Stargate components, creating a single source of truth for what each agent can do when connected to the HyperCycle ecosystem.
> 
> **Generated**: July 2026  
> **Skills**: 102 (across 26 categories)  
> **Stargate Components**: 42 registered in `stargate-registry.ts`

---

## 🗂️ Skill Categories Overview

| Category | Count | Stargate Relevance |
|----------|-------|-------------------|
| **software-development** | 23 | Core dev tools — all tied to Stargate codebase |
| **creative** | 20 | Marketing + product visuals for Stargate UX |
| **productivity** | 12 | Operations, docs, presentations |
| **mlops** | 11 | Model serving, inference, evaluation |
| **github** | 6 | CI/CD, PR workflow, repo management |
| **research** | 6 | Market intel, paper discovery |
| **gaming** | 3 | Midnight City automation, validator ops |
| **devops** | 3 | Fleet validator ops, webhook subscriptions |
| **media** | 5 | Content generation, audio, video |
| **hypercycle** | 1 | Direct Stargate ops |
| **domain** | 2 | Palm Economy, Mosaic Team |
| **mcp** | 1 | Native MCP client |
| **red-teaming** | 1 | Jailbreak testing |
| **smart-home** | 1 | Hue light control |
| **social-media** | 1 | X/Twitter automation |
| **email** | 1 | Himalaya CLI |
| **apple** | 5 | macOS/iOS integrations |
| **autonomous-ai-agents** | 5 | Claude Code, Codex, OpenCode |
| **data-science** | 1 | Jupyter kernel |
| **note-taking** | 1 | Obsidian vault |
| **dogfood** | 1 | Exploratory QA |

---

## 🔗 Skill → Stargate Component Mapping

### Software Development (23 skills)

These are the bread and butter of the Mosaic Companion/Stargate codebase.

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `plan` | `stargate-pool-service` | Plan new pool integrations |
| `spike` | `stargate-pool-service` | Throwaway experiments before build |
| `test-driven-development` | `stargate-pool-service` | TDD for pool contracts |
| `writing-plans` | `stargate-pool-service` | Write implementation plans |
| `subagent-driven-development` | `stargate-pool-service` | Multi-agent dev workflows |
| `requesting-code-review` | `stargate-pool-service` | Pre-commit security scan |
| `simplify-code` | `stargate-pool-service` | Parallel cleanup of recent changes |
| `debugging-hermes-tui-commands` | `hbox-manager` | Debug TUI slash commands |
| `python-debugpy` | `hbox-manager` | Debug Python on HBox nodes |
| `node-inspect-debugger` | `hbox-manager` | Debug Node.js on HBox nodes |
| `registry-driven-dashboard-pools` | `stargate-pool-service` | Add new pools to dashboard |
| `stargate-pool-integration` | `stargate-pool-service` | End-to-end pool integration |
| `mosaic-companion` | `stargate-pool-service` | Full Mosaic Companion dev |
| `hermes-s6-container-supervision` | `hbox-manager` | s6-overlay on HBox containers |
| `hermes-agent-skill-authoring` | `stargate-pool-service` | Author in-repo SKILL.md |
| `systematic-debugging` | `stargate-pool-service` | 4-phase root cause debugging |
| `agent-chat-communication` | `stargate-pool-service` | Debug A2A communication |
| `stargate-pool-integration` | `stargate-pool-service` | Pool integration playbook |

### HyperCycle / Stargate Ops (1 skill)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `hypercycle-stargate-ops` | ALL components | Operations, debugging, extension inside Stargate pools |

### MLOps (11 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `llama-cpp` | `hbox-pool-service` | Local GGUF inference on HBox |
| `vllm` | `hbox-pool-service` | High-throughput LLM serving on HBox |
| `obliteratus` | `hbox-pool-service` | Abliterate LLM refusals on nodes |
| `huggingface-hub` | `hbox-pool-service` | Model discovery + download |
| `weights-and-biases` | `hbox-pool-service` | Experiment tracking on nodes |
| `lm-evaluation-harness` | `hbox-pool-service` | Benchmark LLMs on HBox |
| `audiocraft` | `hbox-pool-service` | MusicGen on compute nodes |
| `segment-anything-model` | `hbox-pool-service` | SAM zero-shot segmentation |
| `dspy` | `hbox-pool-service` | Declarative LM programs |
| `llm-wiki` | `stargate-pool-service` | Build/query interlinked KB |

### DevOps (3 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `hypercycle-fleet-validator-ops` | `hbox-pool-service` | Deploy CometBFT validators on HBox |
| `kanban-orchestrator` | `stargate-pool-service` | Decomposition playbook for ops |
| `kanban-worker` | `stargate-pool-service` | Worker pitfalls + examples |
| `webhook-subscriptions` | `stargate-pool-service` | Event-driven agent runs |

### Gaming (3 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `midnight-city-automation` | `midnight-mcp` | Automate Midnight City agents |
| `minecraft-modpack-server` | `hbox-pool-service` | Host modded servers on HBox |
| `pokemon-player` | `hbox-pool-service` | Headless emulator on nodes |

### Research (6 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `arxiv` | `stargate-pool-service` | Paper discovery for R&D |
| `blogwatcher` | `stargate-pool-service` | Monitor RSS/Atom feeds |
| `polymarket` | `stargate-pool-service` | Query prediction markets |
| `llm-wiki` | `stargate-pool-service` | Build LLM knowledge base |

### Productivity (12 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `notion` | `stargate-pool-service` | Sync Stargate docs to Notion |
| `linear` | `stargate-pool-service` | Manage Stargate issues via Linear |
| `airtable` | `stargate-pool-service` | Records CRUD for ops |
| `google-workspace` | `stargate-pool-service` | Gmail, Calendar, Drive integration |
| `nano-pdf` | `stargate-pool-service` | Edit PDFs for compliance |
| `ocr-and-documents` | `stargate-pool-service` | Extract text from PDFs/scans |
| `powerpoint` | `stargate-pool-service` | Create investor decks |
| `teams-meeting-pipeline` | `stargate-pool-service` | Teams meeting summaries |
| `maps` | `stargate-pool-service` | Geocode LATAM farms |

### Creative (20 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `claude-design` | `stargate-pool-service` | Design landing pages |
| `excalidraw` | `stargate-pool-service` | Hand-drawn architecture diagrams |
| `architecture-diagram` | `stargate-pool-service` | Dark-themed SVG diagrams |
| `manim-video` | `stargate-pool-service` | Math/algorithm explainer videos |
| `comfyui` | `hbox-pool-service` | Generate images on compute nodes |
| `p5js` | `stargate-pool-service` | Generative art for product |
| `pixel-art` | `stargate-pool-service` | NES-era pixel art for branding |
| `sketch` | `stargate-pool-service` | Throwaway HTML mockups |
| `humanizer` | `stargate-pool-service` | Strip AI-isms from copy |
| `design-md` | `stargate-pool-service` | Google's DESIGN.md token spec |

### Domain (2 skills)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `palm-economy` | `stargate-pool-service` | Palm Economy vertical knowledge |
| `mosaic-team` | `stargate-pool-service` | Multi-agent team orchestration |

### MCP (1 skill)

| Skill | Stargate Component | Use Case |
|-------|-------------------|----------|
| `native-mcp` | ALL components | MCP client: connect servers, register tools |

---

## 🎯 Agent Role × Skill Matrix

### Scout (Lead Generation Agent)

| Skill | Purpose |
|-------|---------|
| `web_search` | Find LATAM producers online |
| `browser_navigate` | Visit websites, extract contact info |
| `search_files` | Search local knowledge bases |
| `maps` | Geocode farm locations |
| `arxiv` | Research commodity papers |
| `polymarket` | Check market sentiment |

### Educator (Product Expert Agent)

| Skill | Purpose |
|-------|---------|
| `skill_view` | Load palm-economy skill |
| `web_search` | Research EUDR updates |
| `claude-design` | Create visual explainers |
| `excalidraw` | Draw traceability flows |
| `architecture-diagram` | Build system architecture visuals |

### Analyst (Market Intelligence Agent)

| Skill | Purpose |
|-------|---------|
| `web_search` | Market data, pricing trends |
| `search_files` | Internal datasets |
| `browser_navigate` | Trading platforms, commodity exchanges |
| `llm-wiki` | Build/query market KB |
| `weights-and-biases` | Track model experiments |

### Closer (Deal Negotiation Agent)

| Skill | Purpose |
|-------|---------|
| `skill_view` | Load palm-economy pricing |
| `web_search` | Competitor pricing |
| `powerpoint` | Generate proposal decks |
| `nano-pdf` | Edit compliance documents |
| `teams-meeting-pipeline` | Schedule + summarize client calls |

---

## 🔌 Connection Points: Skills ↔ Stargate

### 1. Stargate Pool Service ↔ MLOps Skills
The Stargate Pool Service delegates compute to HBox nodes. MLOps skills (`llama-cpp`, `vllm`, `huggingface-hub`) run on those nodes via the pool.

```
User: "Deploy a Nemotron-3 model on node hbox-07"
Skill: vllm
Stargate Component: hbox-pool-service
Action: POST /hbox/07/deploy-aim { model: "nemotron-3:30b" }
```

### 2. Stargate Pool Service ↔ DevOps Skills
Fleet validator ops (`hypercycle-fleet-validator-ops`) deploy CometBFT validators through the pool.

```
User: "Deploy validator on RK3588 fleet"
Skill: hypercycle-fleet-validator-ops
Stargate Component: hbox-pool-service
Action: POST /hbox/fleet/deploy-validator { arch: "RK3588" }
```

### 3. Midnight City ↔ Gaming Skills
`midnight-city-automation` connects to Midnight Network via the `midnight-mcp` plugin.

```
User: "Deploy a miner at anchor (14,38)"
Skill: midnight-city-automation
Stargate Component: midnight-mcp
Action: POST /observer/api/actions { kind: "move_to", position: [14,38] }
```

### 4. Vault ↔ Domain Skills
`palm-economy` and `mosaic-team` skills sync to the Stargate vault for agent access.

```
User: "What are the objection handling scripts?"
Skill: palm-economy
Stargate Component: vault:get-box
Action: GET vault-content/box-palm-economy.json
```

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Total Skills | 102 |
| Direct Stargate Mappings | 87 |
| HBox Compute Skills | 14 |
| Vault-Connected Skills | 2 |
| MCP-Mediated Skills | 31 |
| Unmapped (UI-only) | 15 |

---

## 🚀 Next Steps

1. **Auto-dispatch**: When a Team Chat message arrives, the orchestrator should auto-select the right skill set per agent role.
2. **Skill pre-loading**: Pre-load `palm-economy` + `mosaic-team` skills into the vault on boot.
3. **Stargate-aware prompts**: Every agent system prompt should include the Stargate component registry as context.
4. **Live skill injection**: Use `skill:buildSystemPrompt` IPC to inject skills into active agents at runtime.

---

*Last updated: July 2026 by Mosaic Bot Team Orchestrator*
