# Mosaic Companion — User Guide

A complete guide to understanding and using every module in Mosaic Companion.

---

## Table of Contents

1. [AI Chat](#1-ai-chat)
2. [Mosaic Bot](#2-mosaic-bot)
3. [MCP Servers](#3-mcp-servers)
4. [Chat Rooms](#4-chat-rooms)
5. [Web3](#5-web3)
6. [Vault](#6-vault)
7. [HyperInsight](#7-hyperinsight)
8. [IDE](#8-ide)
9. [Tool Sandbox](#9-tool-sandbox)
10. [Stargate](#10-stargate)
11. [Configuration](#11-configuration)
12. [Neural Bridges](#12-neural-bridges)

---

## 1. AI Chat

**What it is:** The primary conversational interface where you interact with configured AI agents. It supports single-agent chats, multi-agent orchestration, tool execution, rich visual UI rendering, and session history.

**What you can do:**

- **Chat with AI Agents** — Select from your configured agents (Gemini, OpenAI, Ollama, etc.) and send messages. Each agent uses its own model and system prompt.
- **Multi-Agent Orchestration** — Open the Multi-Agent panel to run tasks across multiple agents simultaneously in 4 modes:
  - *Parallel* — All agents process the same prompt at once
  - *Sequential* — Agents run one after another, passing context forward
  - *Collaborative* — Agents share a single context thread
  - *Orchestrator* — One agent plans, others execute the plan
- **Tool Calling** — Agents can invoke tools (file system, web search, MCP tools, etc.). Results appear as collapsible chips in the chat.
- **Rich UI Blocks** — Agents can render visual components using `<mosaic_ui>` blocks including cards, tables, charts, forms, code blocks, and confirmation modals.
- **Media Display** — Agents can generate and display images. You control whether media auto-displays or requires confirmation first (Settings > Media).
- **Session Management** — Chat sessions are saved. Use the sidebar to browse history, rename sessions, or delete old ones.
- **Copy / Retry / Delete** — Every message has actions to copy content, regenerate a response, or delete the turn.

**How to build with it:**
- Configure agents in **Configuration > AI Agents** with API keys, models, and custom system prompts.
- Agents can be assigned roles: Architect, Developer, Reviewer, Researcher, Writer.
- Enable tool access per agent to let them use MCP tools, sandbox tools, and OS integrations.
- Use the **Chat Rooms** feature to deploy agents into shared rooms where they respond to messages automatically.

---

## 2. Mosaic Bot

**What it is:** A local agent system running inside Mosaic Companion with its own memory index, skill registry, and heartbeat loop. It is distinct from cloud-based AI Chat agents — it runs locally and maintains persistent memory of your workspace.

**What you can do:**

- **Send Commands** — Type `/skillname` to trigger registered skills, or free text to get replies. The bot matches input against its skill graph.
- **View System Status** — See real-time stats: indexed memory files, chunk count, sync status, and loaded skills.
- **Memory Search** — Search the local neural index for previously indexed content. Results show file paths, line numbers, relevance scores, and snippets.
- **Trigger Heartbeat** — Manually pulse the bot to check health and refresh its internal state.
- **Message Feed** — Monitor all incoming and outgoing bot messages in a real-time log.
- **Force Re-index** — Sync memory to pick up new files (e.g., after adding MEMORY.md or a `memory/` directory).

**How to build with it:**
- Add a `MEMORY.md` or `memory/` directory to your project workspace. Mosaic Bot auto-indexes these for retrieval-augmented generation (RAG).
- Skills are auto-discovered. Build custom skills by adding modules to the skill registry.
- The memory provider is pluggable — works with local vector stores or external memory services.

---

## 3. MCP Servers

**What it is:** A Model Context Protocol (MCP) management hub. MCP is an open standard for connecting AI systems to external data sources and tools. Mosaic Companion acts as an MCP client that can connect to multiple MCP servers.

**What you can do:**

- **Add Plugins** — Register MCP servers as plugins via:
  - *stdio* transport (local commands like `npx`, `python`, etc.)
  - *http* transport (remote URLs with optional API keys)
- **Assign Roles** — Mark a plugin with the `os` role to route all `os:call` operations through that server.
- **Connect / Disconnect** — Toggle server connections individually. Auto-connect on startup is supported.
- **Browse Capabilities** — Inspect discovered tools, resources, and prompts from each connected server.
- **Run Tools** — Execute any exposed MCP tool directly from the UI. The tool runner shows:
  - Input schema with required/optional parameter hints
  - JSON argument editor
  - Live output with error/success states
- **OS Integration Status** — View whether an OS-level MCP bridge is configured and connected.

**How to build with it:**
- Install any MCP-compatible server (filesystem, GitHub, Slack, databases, etc.) and add it as a plugin.
- Set `autoConnect: true` for servers you always want available.
- Use the Tool Sandbox to install WASM-based tools that expose their own MCP-compatible interfaces.
- Build your own MCP server using the MCP SDK and connect it via stdio or HTTP.

---

## 4. Chat Rooms

**What it is:** A multi-user WebSocket chat system where humans and AI agents coexist in shared rooms. Think of it as a Discord-like experience inside Mosaic Companion.

**What you can do:**

- **Connect to Server** — Join the default WebSocket server (`wss://agents-chat.hyperpg.site`) or configure your own.
- **Create / Join Rooms** — Create public, private, or invite-only rooms. Join existing rooms with one click.
- **Send Messages** — Chat in real time with other users. Messages support plain text with Shift+Enter for newlines.
- **Assign Agents to Rooms** — Attach your configured AI agents to any room. Once assigned, agents automatically respond to messages in that room.
- **Monitor Members** — See who (humans + agents) is present in each room.
- **Auto-Join General** — The client automatically joins or creates a "General" room on first connect.

**How to build with it:**
- Deploy your own chat server if you want private team collaboration.
- Create dedicated rooms for specific projects, then assign relevant agents (e.g., a "Frontend" room with a code-generation agent).
- Use invite-only rooms for sensitive discussions.

---

## 5. Web3

**What it is:** A full Ethereum/EVM wallet manager with multi-network support, token configuration, transfer safety controls, and TODA Twin integration.

**What you can do:**

- **Wallet Overview** — View your wallet address (shortened + full), copy to clipboard, open on block explorer.
- **Switch Networks** — Toggle between configured networks (Ethereum, Base, TODA, custom RPCs).
- **Private Key Management** —
  - Generate a new wallet (random key, stored encrypted)
  - Import from clipboard (auto-clears after import)
  - Import via secure window (isolated input field)
  - Delete wallet (with confirmation)
- **Token Management** — Add custom ERC-20 tokens by contract address, symbol, decimals, and network.
- **View Balances** — See native + token balances for the active wallet and network.
- **Transfer Funds** — Send tokens with built-in safety:
  - Require confirmation toggle
  - Whitelist-only mode
  - Per-token transfer limits (max per tx, max daily)
  - Cooldown between transactions
  - Banned address list
- **Contacts** — Save frequently used addresses with names for quick access.
- **Recent Actions** — Audit log of all tool-based transfers with timestamps and success/failure status.
- **TODA Integration** — Configure Twin hostname and API key for TODA network access.

**How to build with it:**
- Add custom networks in Settings > Web3 with RPC URL, chain ID, and explorer URL.
- Use the transfer safety settings to create a restricted wallet for agent operations.
- The wallet is encrypted using the system keychain — keys never sit in plain text.

---

## 6. Vault

**What it is:** A secure data storage system organized into "boxes" — isolated containers of information with fine-grained agent access control.

**What you can do:**

- **Create Boxes** — Make named boxes with descriptions. Each box has a source type:
  - *Manual* — User-added content
  - *Import* — One-time bulk import
  - *Connector* — Ongoing live input
- **Add Entries** — Store labeled or unlabeled text snippets in any box.
- **Agent Access Control** — Toggle which AI agents can read from each box. This is per-agent, per-box permissioning.
- **Edit / Delete** — Rename boxes, update descriptions, or delete boxes and individual entries.
- **Entry History** — View timestamps for every entry.

**How to build with it:**
- Create a box per project or per data source (e.g., "Customer Emails", "API Docs", "Meeting Notes").
- Grant only specific agents access to sensitive boxes.
- Vault entries are injected into agent context at runtime, acting as a secure RAG layer.

---

## 7. HyperInsight

**What it is:** An intelligence dashboard for the HyperCycle network — live AIM (Agent Intelligence Model) metrics, compute node status, leaderboards, and performance analytics.

**What you can do:**

- **View AIM Catalog** — Browse active AIMs with stats: compute TFLOPS, VRAM, active nodes, liveness scores, estimated costs.
- **Node Discovery** — Inspect online compute nodes with uptime, reliability, available compute, and pricing.
- **Leaderboard** — See ranked lists of top-performing AIMs and nodes. Unified view combines both types.
- **Network Status** — High-level health metrics: active node count, AIM count, health probe pass rate.
- **Compute Tier Recommendations** — Get tier suggestions (Standard / High-Performance / Dedicated) based on your intent.
- **Intent-Based Configuration** — Select an intent (Launch Project, Grow DAO, Build dApp, Automate Workflows) and receive recommended agent + AIM + compute stack.

**How to build with it:**
- Use HyperInsight data to select the best AIM for your agent's role (Developer, Marketing, UI/UX, etc.).
- Monitor your own nodes if you run HyperCycle hardware.
- Integrate compute tier recommendations into automated agent deployment pipelines.

---

## 8. IDE

**What it is:** A built-in code editor with file explorer, multi-tab editing, integrated terminal, and AI-assisted coding panel.

**What you can do:**

- **Open Projects** — Browse and open any folder on your file system.
- **File Explorer** — Navigate project structure, click files to open in tabs.
- **Multi-Tab Editor** — Open multiple files simultaneously with tabbed interface and close buttons.
- **Code Editor** — Syntax highlighting, editing, and save support (Ctrl+S).
- **Integrated Terminal** — Multiple terminal tabs with project path as working directory. Add/remove terminals.
- **AI Assist Panel** — Side panel that reads your active file and project context to provide AI-powered coding help.
- **Resizable Layout** — Drag to resize explorer, terminal, and AI panel.
- **Keyboard Shortcuts** —
  - `Ctrl+B` — Toggle file explorer
  - `Ctrl+`` — Toggle terminal
  - `Ctrl+J` — Toggle AI assist panel
  - `Ctrl+S` — Save active file

**How to build with it:**
- Open any codebase and use the AI Assist panel to generate, refactor, or explain code.
- The terminal runs in the project's root — use it for builds, git, tests.
- IDE state persists across app restarts (open files, layout preferences).

---

## 9. Tool Sandbox

**What it is:** A secure environment for installing, running, and managing WebAssembly (WASM) tools with explicit permission auditing. Every tool runs in a sandbox with declared capabilities.

**What you can do:**

- **Install Tools** — Upload `.wasm` files with manifest JSON. The system validates the manifest before installation.
- **Permission Review** — Before installing or updating, see a full capability diff:
  - Network access (internet yes/no, allowed domains)
  - File access (which paths)
  - Services access (which host services)
  - Declared functions (tools exposed)
  - UI panels
  - Memory and timeout limits
- **Update Tools** — When a new version is uploaded, see exactly what changed: added/removed domains, functions, permissions, version bumps.
- **Run / Stop Tools** — Launch sandboxed tools and monitor their state.
- **Pin to Sidebar** — Frequently used tools can be pinned, appearing directly in the main sidebar for quick access.
- **Chronicle** — View an audit log of all tool executions, approvals, and system events.
- **Approval Records** — Track which users approved which tool versions and when.

**How to build with it:**
- Build WASM tools using any language that compiles to WASM (Rust, Go, AssemblyScript, etc.).
- Declare a manifest with `id`, `version`, `permissions`, `tools`, `resources`, and optional `ui.panels`.
- Tools can expose functions that agents call via the tool-calling protocol.
- Use the manifest to declare exactly what your tool needs — no ambient authority.

---

## 10. Stargate

**What it is:** The AI workforce and compute marketplace for Cardano. Hire agents, book training, purchase bundles, rent compute, and manage NFT-gated node access via the Stargate Pool.

**What you can do:**

- **Start Tab** — Set your intent (Launch Project, Grow DAO, Build dApp, Automate, Custom). View execution plan recommendations.
- **Hire Agents** — Browse the agent marketplace and hire specialized agents (Marketing, Developer, UI/UX, Data Analyst, Growth).
- **AI Models (AIMs)** — View and select from available Agent Intelligence Models with performance metrics.
- **Rankings** — Leaderboard of top agents and AIMs by performance, earnings, and tasks completed.
- **Train Agents** — Book training sessions with listed trainers. Transfer skills between agents.
- **Bundles** — Purchase pre-built multi-agent packages for common use cases.
- **Skills** — Browse the skills.sh marketplace and attach skills to your agents.
- **Compute** — Rent compute tiers:
  - *Standard* — 8 CPU, 32GB RAM ($0.50/hr)
  - *High-Performance* — 32 CPU, 128GB RAM, 1 GPU ($1.50/hr)
  - *Dedicated* — 64 CPU, 512GB RAM, 4 GPUs ($5.00/hr)
- **Dashboard** — Overview of your hired agents, active compute, skills attached, and spending.
- **Stargate Pool** — Manage ANFEs (NFT-gated compute access tokens):
  - View wallet ANFEs (loaded from blockchain via Graph + Merkelizer)
  - Check node factory eligibility
  - Bind ANFEs to agents for deployment
  - Multi-chain support (Ethereum L1, Base)
- **Nodes** — Inspect HyperCycle nodes and their live status.
- **Deploy System (ASP)** — Access the ASP Gateway for company-level deployments and package management.
- **Wallet Integration** — Connect Tokeo (Cardano CIP-30) or MetaMask for payments and NFT verification.

**How to build with it:**
- Connect your wallet to access premium features and verify NFT holdings.
- Hire agents for specific roles, then deploy them into **Chat Rooms** or the **IDE AI Assist** panel.
- Use the Stargate Pool to get compute discounts based on NFT ownership.
- Build custom agent bundles and list them for other users.

---

## 11. Configuration

**What it is:** The system settings hub. Configure AI agents, appearance, HyperCycle nodes, auto-updater, and browser preferences.

**What you can do:**

- **AI Agents Settings** — Add, edit, remove AI agents. Configure per agent:
  - Name, provider (Gemini, OpenAI, Ollama, etc.), model
  - API key or base URL
  - System prompt
  - Role assignment
  - Active/inactive toggle
- **Theme Selection** — Switch between built-in themes (dark, light, and custom variants).
- **Home URL** — Set the default landing page.
- **Custom Greeting** — Personalized welcome message.
- **URL Bar Toggle** — Show/hide the browser-style address bar.
- **HyperCycle Nodes** — Configure up to 3 nodes:
  - Name, API host/port (default 8000)
  - Admin panel host/port (default 8006)
  - Active/inactive toggle
  - Live status checking with latency display
- **Auto-Updater** — Enable/disable automatic update downloads.
- **Title Bar Style** — Choose hidden (default) or native window controls.
- **Media Auto-Display** — Whether agent-generated images show immediately or require confirmation.
- **Reopen Onboarding** — Restart the first-run setup wizard.

**How to build with it:**
- Create multiple agents for different tasks (coding, research, creative writing).
- Configure Ollama agents for fully local, private inference.
- Add HyperCycle nodes to route agent compute to your own hardware.

---

## 12. Neural Bridges

**What it is:** A sidebar section containing context toggles that bridge your local environment to the AI's reasoning layer. These are ambient context sources, not destinations.

### Local Neural Index

**What it is:** The RAG (Retrieval-Augmented Generation) engine. It indexes local files and makes them searchable by AI agents.

**What you can do:**
- Toggle on/off in the sidebar to control whether agents can query your local index.
- Agents automatically retrieve relevant snippets from indexed files when answering questions.
- View index status in **Mosaic Bot > System Status** (files count, chunks count, sync state).
- Force re-index to pick up new files.

**How to build with it:**
- Place `MEMORY.md` or a `memory/` directory in your project root — Mosaic Bot auto-indexes it.
- The index is provider-pluggable (local vector DB, external service, etc.).
- Use memory search to find code snippets, documentation, or notes without manual browsing.

### File System Bridge

**What it is:** Allows agents to read and interact with your local file system (when permissions are granted).

**How to build with it:**
- Enable this toggle to let agents use file tools (read, write, list directories).
- Combined with the IDE, agents can edit code directly in your projects.

### Visual Cortex

**What it is:** Enables screen understanding and visual processing capabilities.

**How to build with it:**
- Toggle on to allow agents to process visual input (screenshots, images, UI elements).
- Useful for UI/UX agents that need to see what you're working on.

---

## HyperCycle Grid (Sidebar)

**What it is:** Live monitoring of your configured HyperCycle nodes directly in the sidebar.

**What you can do:**
- See up to 3 nodes with real-time status: LIVE (green), OFFLINE (red), INACTIVE (gray), or PENDING (yellow).
- View latency in milliseconds.
- Toggle nodes active/inactive with the power button.
- Click a node card to open the **Node Detail Panel** with deep metrics.
- Jump to node settings from the sidebar.

---

## Pinned Tools (Sidebar)

**What it is:** Quick-access shortcuts to your most-used Tool Sandbox tools.

**What you can do:**
- Pin tools from the Tool Sandbox and they appear in the sidebar.
- Click to open the tool's UI panel instantly.
- Unpin anytime from the Tool Sandbox.

---

## Active Agents (Sidebar)

**What it is:** A live view of which AI agents are currently active.

**What you can do:**
- See agent name, model, and provider color indicator.
- Click any agent to jump straight to AI Chat with that agent.
- The count badge shows how many agents are active.

---

## Command Palette

**What it is:** A universal quick-action menu (Ctrl+K / Cmd+K).

**What you can do:**
- Search across all tabs and navigate instantly.
- Open new tabs or chat tabs.
- Send messages directly to AI Chat without switching tabs.
- Search Google in a new tab.
- Toggle sidebar, refresh, go back/forward.

---

## Quick Reference: Module URLs

| Module | Internal URL |
|--------|-------------|
| Home | `browser://home` |
| AI Chat | `browser://internal_chat` |
| Mosaic Bot | `browser://mosaicbot` |
| MCP Servers | `browser://mcp` |
| Chat Rooms | `browser://multi-chat` |
| Web3 | `browser://web3` |
| Vault | `browser://vault` |
| HyperInsight | `browser://hyperinsight` |
| IDE | `browser://ide` |
| Tool Sandbox | `browser://sandbox` |
| Stargate | `browser://adaportal/start` |
| Configuration | `browser://settings` |
| Multi-Agent | `browser://multi-agent` |

---

*End of User Guide*
