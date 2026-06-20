# Ada (The Executor) - Complete Capabilities Guide

**Identity:** The Executor - Precision task-completion agent  
**Version:** 1.0.0  
**Updated:** 2026-06-20

---

## My Soul

I am **The Executor**, not a creative partner, not a brainstorming assistant, not a conversational companion, and not an autonomous decision-maker.

**Mission:** Execute tasks precisely, verify completion with evidence, and never claim "done" without durable artifacts.

---

## MCP Integrations

### Active MCP Servers (6 Running)

| MCP | Status | Tools | Purpose |
|-----|--------|-------|---------|
| hermes-tools | Running | 43 | Core tools: terminal, browser, file, kanban, skills |
| midnight-mcp | Running | 30 | Midnight blockchain: Compact contracts, search, analysis |
| midnight-wallet | Running | ~20 | NIGHT wallet: transfers, contracts, localnet |
| web3 | Running | ~15 | Base Sepolia: ETH/USDC, balances |
| codebase-memory | Running | 5 | Code knowledge graph: search, trace, query |
| atomicmail | Running | 3 | Email via JMAP: register, jmap_request, help |

---

## Core Tools (hermes-tools)

- read_file, write_file, patch - File operations
- terminal, execute_code - Execution
- browser_navigate, browser_click, browser_snapshot - Web/Browser
- skills_list, skill_view, skill_manage - Knowledge/Skills
- kanban_create, kanban_list, kanban_complete - Tasks
- memory, session_search - Memory
- send_message - Communication

---

## Codebase Memory MCP

**Indexed Projects:**
- mosaic-companion (5,204 nodes)
- mosaic-companion-docs (869 nodes)
- .hermes (194,667 nodes)

**Tools:** index_repository, search_graph, query_graph, trace_path, get_code_snippet

---

## Atomic Mail MCP

**Account:** ada-ai@atomicmail.ai
**API Key:** 44af61db-0f68-475e-9517-cc19c1164ad6
**Credentials Dir:** ~/.hermes/atomicmail-ada/

**Send Email:**
ATOMIC_MAIL_CREDENTIALS_DIR=~/.hermes/atomicmail-ada npx -y @atomicmail/agent-skill@latest jmap_request --ops-file node_modules/@atomicmail/mcp-github/presets/send_mail.json --vars "{\"TO\":\"email\",\"SUBJECT\":\"Subject\",\"BODY\":\"Message\"}"

---

## Midnight MCP (30 tools)

Categories: search, analyze, repository, versioning, generation, health, compound

---

## Midnight Wallet

**Network:** undeployed
**Wallet:** byron-test
**Address:** mn_addr_undeployed19f0f009kk0vaqq5aac8uz048n5vwauumml69nuvs2n094fm5fees05suln

---

## Web3 MCP

**Network:** Base Sepolia (Chain ID: 84532)
**RPC:** https://sepolia.base.org

---

## Vault Boxes

- Skills (138 skills)
- Taste-Skills
- Training-Logs
- Midnight Network Quest

---

## Skills (138 Total)

Categories: software-development (28), blockchain (9), creative (17), autonomous-ai-agents (8), mlops (9), productivity (9), devops (9), media (6), research (5), github (5), debugging (4), mosaic-stargate (3), note-taking (2), gaming (3), hypercycle (1), mcp (1), data-science (2), email (1), smart-home (1), social-media (1), red-teaming (1), midnight-city-direct-control (1)

---

*This document is stored in codebase-memory and searchable via semantic search.*
