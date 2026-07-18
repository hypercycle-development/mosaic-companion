# Privacy-Preserving AI — Proof of Concept

> **Arduino TinyML Hackathon — AI Track**
> **Thesis:** Build AI applications that process sensitive user data without ever exposing the underlying information to the model provider or the network.

---

## What We Built

**MosAIc Companion** is an Electron desktop app that acts as a personal AI companion with a built-in **Vault** (named data boxes) and **granular agent access control**. This PoC demonstrates that powerful, capable AI doesn't require surrendering personal privacy.

We solve this through **three architectural layers**:

| Layer | Mechanism | Privacy Guarantee |
|---|---|---|
| **1. Local Inference** | Ollama runs LLMs directly on the user's machine (localhost:11434) | Data never leaves the device. No API keys, no cloud logging, no telemetry. |
| **2. Vault Access Control** | Each AI agent has a `boxAccess[]` list. The vault enforces read boundaries at the OS level. | An agent can only see boxes explicitly granted to it. Other agents' data remains invisible. |
| **3. Sandboxed Tools** | WASM tools run zero-trust. MCP skills declare permissions upfront. No runtime escalation. | Even if a tool is compromised, it cannot access filesystem, network, or secrets outside its manifest. |

---

## Live Demo — PrivacyVaultDemo.tsx

Navigate to **Privacy Demo** in the MosAIc sidebar to see an interactive walkthrough:

### What the Demo Shows

1. **Five Vault Boxes** containing realistic sensitive data:
   - Health Records (heart rate, blood pressure, sleep scores)
   - Financial Data (bank balances, crypto wallets, spending)
   - Private Journal (therapy notes, dream logs)
   - Midnight City Skills (ZK contract tools)
   - Calendar & Travel (flights, hotel confirmations)

2. **Four AI Agents** with different access profiles:
   - **Dr. Ada (Health Coach)** — Local Ollama model, granted Health + Calendar only
   - **FinBot (Wealth Advisor)** — Local Ollama model, granted Finance + Calendar only
   - **Mosaic Assistant** — Cloud OpenAI model, granted only public Midnight skills
   - **Zero-Knight (ZK Dev)** — Local Ollama model, granted Midnight skills + Journal

3. **Live Simulation** — Select any agent + box, click "Run Simulation", and watch the vault enforce access:
   - If **granted** → the agent receives all box entries and can process them
   - If **denied** → the vault returns zero data. The agent cannot even know the box exists.

4. **Privacy Comparison Table** — Side-by-side against standard cloud AI and Apple Intelligence.

---

## Architecture Deep Dive

### 1. Vault Module (`electron/integrations/vault/`)

```
~/.config/mosaic-companion/vault.json          # Box metadata (name, description, sourceType)
~/.config/mosaic-companion/vault-content/      # Per-box JSON files (entries)
```

**Key APIs:**
- `getAgentBoxes(agentId)` — reads the agent's `boxAccess` from `ai-agents.json`, returns only granted boxes
- `canAgentAccessBox(agentId, boxId)` — boolean check used by tool handlers
- `getBoxContent(boxId)` — returns entries only after access verification

**Renderer UI:** `src/components/VaultPage.tsx` — users can toggle per-agent access with visual toggles.

### 2. Vault ToolModule (`electron/integrations/tools/modules/vault-tools.ts`)

Agents call these tools via `<use_tool>`:

| Tool | What it does | Access check |
|---|---|---|
| `vault.list_boxes` | Lists boxes the agent is allowed to see | `getAgentBoxes(context.agentId)` |
| `vault.read_box` | Returns entries from one box | `canAgentAccessBox(context.agentId, boxId)` |

**Critical:** If an agent tries to read a box it doesn't have access to, the handler returns:
```json
{ "success": false, "error": "Access denied — you do not have access to this box" }
```

### 3. Local Inference (`src/types/ai.ts`)

MosAIc supports **Ollama (Local)** as a first-class provider:

```typescript
ollama: {
  name: "Ollama (Local)",
  color: "#8B5CF6",
  baseUrl: "http://localhost:11434",
}
```

Default models include `llama3.2:3b`, `qwen2.5-coder:7b`, `qwen2.5:32b` — all runnable on consumer hardware with zero network egress.

When a user configures an agent with provider `"ollama"`, all inference happens via localhost. The Vault data never touches the internet.

### 4. MCP Skills with Privacy (`electron/integrations/tools/modules/midnight.ts`)

Midnight Network tools (21 total) are bridged via MCP servers. They run under the same vault rules:

- Agents must have vault access to Midnight skills to invoke them
- Tools like `midnight_generate_contract`, `midnight_compile_contract`, and `midnight_expert_contract_review` process sensitive code without uploading it to external services
- The MCP server runs locally; the Compact compiler validates code on-device

---

## Battle Testing with Midnight City

This isn't theoretical. The MosAIc codebase already contains:

- **Midnight City Command Panel** — Autonomous agent simulation with privacy-sensitive state (agent positions, inventory, conversations)
- **Stargate Pool Dashboard** — Validator fleet management where node credentials live in vault boxes
- **SAFE Rev Pool Operations** — Freight marketplace data stored in vault entries with agent-scoped access

All of these use the vault to compartmentalize data so that:
- The health-coach agent cannot see financial data
- The freight-matching agent cannot see private journals
- The ZK developer agent sees only Midnight skills + relevant context

---

## How This Wins the Arduino TinyML Challenge

| Challenge Requirement | MosAIc Solution |
|---|---|
| **Process sensitive data** | Vault boxes store health, finance, journal entries |
| **Without exposing underlying info** | `canAgentAccessBox()` enforces zero-leak boundaries |
| **Highly capable AI** | Local models up to 32B params + MCP skill augmentation |
| **No cost to personal privacy** | Ollama local inference → data never leaves device |

---

## Quick Start for Judges

1. **Install dependencies:** `npm install`
2. **Start the app:** `npm run dev`
3. **Navigate:** Click **Privacy Demo** in the left sidebar
4. **Interact:** Select agents and boxes, toggle access, run the simulation
5. **Verify:** Open DevTools → Console to see the simulated access logs

---

## Code Locations

| File | Purpose |
|---|---|
| `src/components/PrivacyVaultDemo.tsx` | Interactive demo page (this PoC) |
| `electron/integrations/vault/index.ts` | Vault CRUD + access control |
| `electron/integrations/vault/types.ts` | Box, Entry, TasteSkillMetadata types |
| `electron/integrations/tools/modules/vault-tools.ts` | Agent-facing vault tools |
| `src/components/VaultPage.tsx` | UI for box management + access toggles |
| `src/types/ai.ts` | AIProvider config including Ollama local |
| `electron/integrations/tools/modules/midnight.ts` | Midnight MCP tool bridge |
| `electron/integrations/tools/modules/midnight-expert.ts` | Midnight Expert tool bridge |

---

## Conclusion

MosAIc proves that **privacy-preserving AI is production-ready today**, not a future aspiration. By combining local inference, vault-based access control, and sandboxed tool execution, users retain full ownership of their data while AI agents become genuinely helpful — because they only see what they're supposed to.

**The vault is the boundary. The user holds the key.**
