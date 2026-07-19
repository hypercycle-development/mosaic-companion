---
name: mosaic-companion
description: |
  Developing, debugging, and extending Mosaic Companion — an Electron-based
  AI-agent dashboard with a dual-runtime architecture (renderer-process Mosaic
  Bot + main-process Hermes Agent). Covers skill injection, IPC bridge tracing,
  vault access wiring, and common pitfall patterns.
triggers:
  - Mosaic Companion
  - mosaic-companion
  - mosaic bot
  - mosaicbot
  - ai chat
  - agent runner
  - skill injection
  - stargate vault
  - electron ipc
  - Mosaic skill not working
  - Mosaic agent no skills
  - mosaic wiki
  - knowledge base
  - persistent memory
  - llm-wiki
---

# Mosaic Companion Development

## Architecture Overview

Mosaic Companion has **two separate AI runtimes** that do NOT share state:

| Runtime | Process | Entry Point | Skill Aware? | API Used |
|---|---|---|---|---|
| **Mosaic Bot (AI Chat)** | Electron renderer | `src/services/AIService.ts` | No — Raw OpenAI/Claude | Direct API calls |
| **Hermes Agent** | Electron main / Node | `electron/integrations/mosaicbot/src/main/orchestrator.ts` | Yes — Full pipeline | Hermes agent core |

**Critical rule:** A fix in one runtime is invisible to the other. Always identify which runtime the user is talking about before proposing a fix.

### How to tell which runtime has the bug
- User says "AI Chat" or "Mosaic Bot" or chat window → **renderer runtime**
- User says "Hermes Agent" or terminal or CLI → **main-process runtime**
- User says "agents claim skills exist but cannot use them" → check both

---

## Skill Injection Pipeline (Renderer to Main to LLM)

### 1. Agent Config (`ai-agents.json`)
```json
{
  "skills": ["kanban-orchestrator", "github-code-review"],
  "boxAccess": ["box-hermes-vault-1783055252550"]
}
```

**Pitfall:** Fake skill names (e.g. `mosaic-skill-bridge`, `mosaic-bot-orchestrator`) do not exist in `~/.hermes/skills/` and produce `failedSkills`.

**Fix:** Use real skill directory names from `~/.hermes/skills/CATEGORY/NAME/`.

### 2. Renderer Side (`src/services/AIService.ts`)
- Loads agent config via IPC (`ai-agents:get`)
- Calls `(window as any).electronAPI?.skills?.buildSystemPrompt(...)`
- **Pitfall (fixed in session):** `vaultAccess: []` was hardcoded, ignoring `config.boxAccess`
- **Fix pattern:** Load vault boxes via `vaultApi.getBox(boxId)` and inject as system messages

### 3. Main Process IPC Handler (`electron/main.ts`)
- Handler: `ipcMain.handle("skill:buildSystemPrompt", ...)`
- Resolution phases:
  1. **Phase A:** `skillInjector.buildSystemPrompt()` → scans `~/.hermes/skills/NAME/SKILL.md`
  2. **Phase B:** Vault skill cache (via `vaultSkillCache.ts`)
  3. **Phase C:** Hermes MCP fallback (`mcpSkillResolver.ts`)
  4. **Phase D:** Stargate Vault index fallback (`stargate-vault/vault-index.json`) — injects stub for vault-registered skills

**Pitfall:** Before Phase D, any skill not found in Phases A-C stayed in `failedSkills` forever.

---

## Key Files and Their Roles

| File | Runtime | Purpose |
|---|---|---|
| `src/services/AIService.ts` | Renderer | Mosaic Bot LLM calls; message thread assembly; skill/vault injection |
| `src/services/skillInjector.ts` | Renderer | Local skill loading (renderer-safe, no fs); injects into user messages |
| `src/services/StargateSkillRegistry.ts` | Renderer | Vault skill registry (orphaned; not wired into AIService) |
| `src/services/vaultSkillCache.ts` | Renderer | Caches vault skills for quick lookup |
| `electron/main.ts` | Main | IPC handlers including `skill:buildSystemPrompt` |
| `electron/integrations/mosaicbot/src/main/llm.ts` | Main | Hermes Agent LLM layer |
| `electron/integrations/mosaicbot/src/main/orchestrator.ts` | Main | Hermes Agent orchestrator; reads vault summaries |
| `electron/integrations/mosaicbot/src/main/skills/loader.ts` | Main | Loads `SKILL.md` files + `loadStargateVaultSkills()` |
| `electron/integrations/mosaicbot/src/main/wiki-engine.ts` | Main | **NEW:** Persistent markdown wiki (Hermes PR #5100 adaptation) |
| `electron/integrations/mosaicbot/src/main/heartbeat-auto-actions.ts` | Main | **NEW:** Chronic detection + auto-restart + hard-down + kanban escalation |
| `electron/integrations/mosaicbot/src/main/heartbeat-pool-tools.ts` | Main | **NEW:** Pool status, fleet health, allocations, marketplace analysis |
| `electron/integrations/chat/agent-runner.ts` | Main | A2A chat room agent runner; message dispatch |
| `electron/defaultAiAgents.ts` | Main | Built-in agent defaults merged into `ai-agents.json` |
| `stargate-vault/vault-index.json` | Repo data | 283 skills across 24 categories (no `SKILL.md` files inside) |
| `~/.config/mosaic-companion/ai-agents.json` | User data | Runtime agent config with `skills`, `boxAccess`, etc. |

---

## Common Pitfalls

### Pitfall 1: "I have no skills" despite config having `skills`
**Diagnosis:**
1. Check if skill names are real directories under `~/.hermes/skills/`
2. Check renderer console for `[AIService] Skills injected for NAME: ...`
3. Check main console for `[main.ts] Skill "X" resolved via ...`

**Fix:** Replace fake names with real skill names. Add Stargate Vault fallback if needed.

### Pitfall 2: Vault access configured but agent sees nothing
**Diagnosis:** `AIService.ts` hardcodes `vaultAccess: []` instead of reading `config.boxAccess`.

**Fix:** Inject vault boxes via IPC before the skill build step. See the Vault Box Access Injection pattern in `AIService.ts`.

### Pitfall 3: Hermes Agent sees skills but Mosaic Bot does not
**Root cause:** Two separate runtimes. Hermes Agent fixes in `orchestrator.ts`/`loader.ts` do NOT affect Mosaic Bot.

**Fix:** Target `src/services/AIService.ts` (renderer) with the same vault/skill wiring.

### Pitfall 4: Stargate Vault skills exist but are not loaded
**Root cause:** Vault is index-only (`vault-index.json`). No `SKILL.md` files exist inside `stargate-vault/`.

**Fix:** Parse `vault-index.json` into `SkillEntry` stubs with `source: "vault"`. Inject stubs into system prompt so the LLM knows the skills exist and can reference them.

### Pitfall 5: Hermes-tools MCP server exposes 0 tools
**Symptom:** `[MCP] hermes-tools` connects but logs `Exposing 0 Hermes tools via MCP`.

**Root causes (check in order):**
1. **`mcp` Python package missing** — The `mcp` package is NOT installed by default on Debian/Ubuntu. Install with:
   ```bash
   python3 -m pip install mcp
   # Or if system packages are protected:
   python3 -m pip install mcp --break-system-packages
   ```
   Verify: `python3 -c "import mcp; print(mcp.__version__)"`
2. **`PYTHONPATH` not pointing to Hermes repo** — The server must find `model_tools.py` from the Hermes checkout. Set `PYTHONPATH` to include the Hermes directory (e.g. `/home/user/hermes`).
3. **Missing optional Python deps** — Some Hermes tool modules need `httpx`, `websockets`, etc. These are not fatal but reduce the available tool count.

**Verification script:**
```bash
PYTHONPATH=/home/user/hermes timeout 5 python3 \
  /path/to/hermes-tools-mcp-server.py --verbose 2>&1 | grep "Exposing"
```
Expected: `Exposing N Hermes tools via MCP` where N > 0.

**Node.js integration test (runs outside Electron):**
```bash
cd /path/to/mosaic-companion
NODE_PATH=./node_modules node -e "
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const transport = new StdioClientTransport({
  command: 'python3',
  args: ['/path/to/hermes-tools-mcp-server.py'],
  env: { PYTHONPATH: '/home/user/hermes', ...process.env },
});
const client = new Client({ name: 'test', version: '1.0.0' });
client.connect(transport).then(async () => {
  const tools = await client.listTools();
  console.log('Tools:', tools.tools.length);
  await client.close();
});
"
```

**Fix pattern in Mosaic registration (`electron/integrations/mcp/index.ts`):**
```typescript
const hermesEnv = {
  HERMES_HOME: process.env.HERMES_HOME || `${home}/.hermes`,
  PYTHONPATH: [
    path.join(home, "hermes"),        // ← Hermes repo checkout
    process.env.PYTHONPATH || "",
  ].filter(Boolean).join(path.delimiter),
};
```

### Pitfall 6: Hermes skills not visible inside Mosaic Vault
**Symptom:** Agents claim skills exist but cannot reference vault content.

**Root cause:** `~/.hermes/skills/` files are on disk but never bridged into Mosaic's vault storage (`~/.config/mosaic-companion/vault-content/`).

**Fix — Automatic sync script:**
Create `sync-skills-to-vault.py` (see `references/sync-skills-to-vault.py` in this skill) that:
1. Recursively scans `~/.hermes/skills/` for `SKILL.md`
2. Reads each skill's content
3. Creates/updates entries in the `Hermes Vault` box (`box-hermes-vault-*`)
4. Removes stale entries

**Run after every skill install/update:**
```bash
python3 ~/.config/mosaic-companion/sync-skills-to-vault.py
```

**What the vault box should look like after sync:**
- `vault.json` contains a box named `"Hermes Vault"`
- `vault-content/box-hermes-vault-{timestamp}.json` contains one entry per skill with `label: "category-skill-name"` and `content: <SKILL.md body>`

### Pitfall 7: New vault box created but agents cannot access it
**Symptom:** Box appears in Mosaic UI but agents get empty responses.

**Root cause:** Box declared in `vault.json` but no `vault-content/box-{id}.json` file exists, or entries are malformed.

**Correct structure:**
```json
// vault.json
{
  "boxes": [
    {
      "id": "box-palm-economy",
      "name": "Palm Economy",
      "description": "...",
      "sourceType": "manual",
      "createdAt": 1752284400000,
      "updatedAt": 1752284400000
    }
  ]
}
```

```json
// vault-content/box-palm-economy.json
{
  "boxId": "box-palm-economy",
  "entries": [
    {
      "id": "entry-welcome",
      "label": "Welcome",
      "content": "...",
      "metadata": { "category": "overview", "priority": 1 },
      "createdAt": 1752284400000,
      "updatedAt": 1752284400000
    }
  ]
}
```

**Pitfall:** Missing comma between box objects in `vault.json` causes JSON parse errors and the entire vault fails to load.

### Pitfall 8: Vault JSON parse error after adding new box
**Symptom:** After editing `vault.json` to add a new box, the entire vault fails to load. Mosaic shows no boxes or throws JSON errors.

**Root cause:** Missing comma between box objects in the JSON array.

**Broken (missing comma after closing brace):**
```json
{
  "boxes": [
    {
      "id": "box-old",
      ...
    }    // ← NO COMMA HERE
    {
      "id": "box-new",
      ...
    }
  ]
}
```

**Fixed:**
```json
{
  "boxes": [
    {
      "id": "box-old",
      ...
    },   // ← COMMA REQUIRED
    {
      "id": "box-new",
      ...
    }
  ]
}
```

**Prevention:** Always validate vault.json after manual edits:
```bash
python3 -m json.tool ~/.config/mosaic-companion/vault.json > /dev/null \
  && echo "Valid JSON" || echo "INVALID JSON"
```

### Pitfall 9: Chat path is bare — no system prompt, no memory, no skills
**Root cause:** `agent:send` IPC handler calls `callActiveLLM(text)` with only raw user text. The heartbeat builds `buildOrchestratorContext()` + `buildSystemPrompt()` + `memory.search()` but chat gets none of it.

**Fix:** Wire the full heartbeat pipeline into `agent:send`:
```typescript
// Before (broken):
const reply = await callActiveLLM(text);

// After (fixed):
const orchCtx = await buildOrchestratorContext();
const systemPrompt = buildSystemPrompt(orchCtx);
const memResults = await memory.search(text, { maxResults: 3 });
const reply = await callActiveLLM(enrichedPrompt, systemPrompt);
```

**Pattern A — Standalone Sidebar Tab (4 files):**

Use when the page needs its own browser tab and sidebar entry.

1. **`src/types/types.ts`** — Add the URL constant:
   ```typescript
   export const INTERNAL_MY_PAGE_URL = "browser://my-page";
   ```

2. **`src/components/ContentArea.tsx`** — Wire the route (import constant, import component, add `if` block):
   ```typescript
   import { INTERNAL_MY_PAGE_URL } from "../types/types";
   import { MyPagePanel } from "./MyPagePanel";
   
   if (url.startsWith(INTERNAL_MY_PAGE_URL)) {
     useEffect(() => { onUpdateTab({ title: "My Page", isLoading: false }); }, [url]);
     return (
       <div className="h-full overflow-hidden bg-gray-950 text-gray-100">
         <MyPagePanel onNavigate={onNavigate} />
       </div>
     );
   }
   ```

3. **`src/components/Sidebar.tsx`** — Add navigation item + icon case:
   ```typescript
   import { INTERNAL_MY_PAGE_URL } from "../types/types";
   
   const navItems: SidebarItem[] = [
     // ...existing items...
     { id: "my-page", label: "My Page", icon: "MyIcon", url: INTERNAL_MY_PAGE_URL },
   ];
   
   // In renderNavIcon() switch statement:
   case "MyIcon": return <MyIcon className={className} />;
   ```

4. **Create `src/components/MyPagePanel.tsx`** — New React component

**Pattern B — Tab Inside Existing Panel (1 file, host panel only):**

Use when the feature is a sub-view of an existing panel (e.g., "Team" tab inside "Mosaic Bot").

1. **In the host panel component** (e.g., `MosaicBotPanel.tsx`):
   - Add tab ID to the active tab union type:
     ```typescript
     const [activeTab, setActiveTab] = useState<"overview" | "..." | "team">("overview");
     ```
   - Add the tab button to the tab strip map/array:
     ```typescript
     {(["overview", "...", "team"] as const).map((tab) => (
       <button key={tab} onClick={() => setActiveTab(tab)}>
         {tab === "team" && <span>Team</span>}
       </button>
     ))}
     ```
   - Add the conditional render block:
     ```typescript
     {activeTab === "team" && <MosaicTeamPanel onNavigate={onNavigate} />}
     ```
   - Import the sub-panel component:
     ```typescript
     import { MosaicTeamPanel } from "./MosaicTeamPanel";
     ```

2. **Pass `onNavigate` through the host panel** if the sub-panel needs to open vault/chat URLs:
   ```typescript
   // ContentArea.tsx:
   <MosaicBotPanel onNavigate={onNavigate} />
   
   // MosaicBotPanel.tsx:
   interface MosaicBotPanelProps {
     onNavigate?: (url: string) => void;
   }
   export const MosaicBotPanel: React.FC<MosaicBotPanelProps> = ({ onNavigate }) => {
     // ...
     {activeTab === "team" && <MosaicTeamPanel onNavigate={onNavigate} />}
   }
   ```

**Pattern C — Moving from Standalone Tab to Panel Sub-Tab (6 files):**

When moving a feature from standalone sidebar to sub-tab inside an existing panel:

1. **Host panel component** — Add tab ID, tab button, conditional render (Pattern B)
2. **ContentArea.tsx** — Remove standalone route `if` block + imports
3. **Sidebar.tsx** — Remove nav item from `navItems[]` + remove import
4. **types.ts** — Optionally remove URL constant (can keep for backward compat)
5. **Verify no orphans** — Search for old URL constant and component name across codebase
6. **Pass onNavigate** — If sub-panel needs navigation, ensure host panel receives and forwards it

**Important:** If the sub-panel was previously a standalone sidebar tab, you must ALSO remove its entries from:
- `Sidebar.tsx` navItems array
- `ContentArea.tsx` route `if` block and imports
- `types.ts` URL constant (optional — can keep for backward compat)

**Verification after all changes:**
```bash
cd /path/to/mosaic-companion && npm run typecheck
# Must pass with zero errors.
```

### Pitfall 11: Multiple agents marked `isActive: true` causes unpredictable routing
**Symptom:** "Method not allowed" errors, wrong model selected, or responses from unexpected provider.

**Root cause:** `electron/integrations/mosaicbot/src/main/llm.ts:readActiveAgent()` uses `agents.find((a) => a.isActive)` — returns the **first** match. When multiple agents have `isActive: true`, selection is arbitrary based on array order.

**Detection:**
```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.config/mosaic-companion/ai-agents.json')
with open(path) as f:
    agents = json.load(f)
active = [a for a in agents if a.get('isActive')]
print(f'Active agents: {len(active)} (should be 1)')
for a in active:
    print(f'  - {a[\"name\"]}: {a[\"provider\"]} / {a[\"model\"]}')
"
```

**Fix:** Set exactly ONE agent to `isActive: true`. Either via Settings UI or by editing `ai-agents.json` directly:
```json
[
  { "id": "agent-ada", "isActive": true, ... },
  { "id": "agent-hermes", "isActive": false, ... },
  { "id": "agent-meshell", "isActive": false, ... }
]
```

### Pitfall 12: Global bottom bar always redirects to AI Chat regardless of active tab
**Symptom:** When typing in the bottom bar on any non-AI-Chat tab (e.g., Mosaic Bot, Vault, Web3), hitting Enter navigates away to AI Chat.

**Root cause:** `App.tsx:handleBottomBarSubmit()` hardcodes `navigateTo(INTERNAL_CHAT_URL)` with no tab context check.

**Fix — Context-aware dispatch via CustomEvent:**

1. **BottomBar receives `currentUrl` prop:**
   ```typescript
   interface BottomBarProps {
     onSubmit: (text: string) => void;
     hasAgents: boolean;
     currentUrl?: string;  // ← NEW
   }
   ```

2. **BottomBar checks URL before dispatching:**
   ```typescript
   const isMosaicBotTab = currentUrl?.startsWith(INTERNAL_MOSAICBOT_URL);
   if (isMosaicBotTab) {
     window.dispatchEvent(
       new CustomEvent("team-message", {
         detail: { text: input.trim(), timestamp: Date.now() },
       })
     );
     setInput("");
     return;
   }
   // Else: fall through to existing onSubmit(input) → AI Chat
   ```

3. **Target component listens for the event:**
   ```typescript
   // Inside MosaicTeamPanel or TeamChatThread:
   useEffect(() => {
     const handleTeamMessage = async (e: CustomEvent) => {
       const { text } = e.detail;
       // Handle the message locally — do NOT navigate away
     };
     window.addEventListener("team-message", handleTeamMessage as any);
     return () => window.removeEventListener("team-message", handleTeamMessage as any);
   }, [/* deps */]);
   ```

4. **App.tsx passes the current URL:**
   ```typescript
   <BottomBar
     onSubmit={handleBottomBarSubmit}
     hasAgents={hasAgents}
     currentUrl={activeTab.history.present}  // ← NEW
   />
   ```

**Why CustomEvent?** BottomBar and MosaicTeamPanel are siblings (both rendered by App), not parent/child. CustomEvent is the cleanest sibling communication pattern when React props drilling through ContentArea → Panel → SubPanel is impractical.

**Tab-specific dispatch channels:**
- Mosaic Bot → `CustomEvent("team-message")` → TeamChatThread handles locally
- AI Chat → `onSubmit()` → `navigateTo(INTERNAL_CHAT_URL)` (existing behavior)
- Other tabs → `onSubmit()` → existing global handler

### Pitfall 13: Team chat thread needs parallel agent dispatch with role-specific prompts
**Symptom:** After fixing the bottom bar routing, the team chat shows user messages but no agent replies, or all agents reply identically.

**Root cause:** The team chat needs to (a) call multiple LLMs in parallel, (b) inject role-specific system prompts per agent, (c) stream status per agent.

**MVP implementation (simulated responses):**
```typescript
const dispatchToAgents = async (text: string) => {
  const targetAgents = agents.filter(a => selectedAgentIds.has(a.id));
  
  // 1. Create pending messages (one per agent, status="sending")
  const pendingMsgs = targetAgents.map(agent => ({
    id: `a-${agent.id}-${Date.now()}`,
    role: "agent",
    agentId: agent.id,
    agentName: agent.name,
    teamRole: agent.teamRole,
    content: "",
    status: "sending",
    timestamp: Date.now(),
  }));
  setMessages(prev => [...prev, ...pendingMsgs]);
  
  // 2. Parallel execution
  await Promise.all(targetAgents.map(async (agent, idx) => {
    const pendingId = pendingMsgs[idx].id;
    try {
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, status: "streaming" } : m));
      
      // Role-specific prompt injection
      const rolePrompts: Record<string, string> = {
        scout: `You are a LATAM market scout. Find and qualify leads.\n\nUser request: ${text}`,
        educator: `You are a product educator. Explain compliance and traceability.\n\nUser request: ${text}`,
        analyst: `You are a commodity analyst. Research market data and pricing.\n\nUser request: ${text}`,
        closer: `You are a deal closer. Negotiate terms and close proposals.\n\nUser request: ${text}`,
      };
      
      // Production: await callActiveLLM(rolePrompts[agent.teamRole], systemPrompt);
      // MVP: Simulate with realistic canned responses + delay
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
      
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, content, status: "complete" } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, content: `❌ Error: ${err.message}`, status: "error" } : m));
    }
  }));
};
```

**Production hardening needed:**
1. Wire real LLM dispatch via IPC → `electron/integrations/mosaicbot/src/main/llm.ts:callActiveLLM()`
2. Add `window.electronAPI.team.dispatch()` to preload bridge
3. Persist chat history (SQLite or JSONL in `userData/team-chat/`)
4. Streaming tokens (individual async generators instead of Promise.all)
5. Mission creation from chat replies ("Create Mission" button → Pipeline)

**UI elements per agent reply:**
- 🔄 **Escalate** → handoff to next role (scout→educator→analyst→closer)
- 💬 **Chat 1:1** → navigate to AI Chat with that agent
- Status indicators: ⏳ sending → ✍️ streaming → ✓ complete → ⚠️ error

### Pitfall 14: Stale MCP plugin entry pointing to old Hermes CLI causes `Connection closed`
**Symptom:** `[MCP] hermes-tools` connects then immediately disconnects with `MCP error -32000: Connection closed`. Server stderr shows:
```
hermes mcp: error: argument mcp_action: invalid choice: 'serve-tools'
```

**Root cause:** `mcp-plugins.json` (at `~/.config/mosaic-companion/mcp-plugins.json`) contains a stale `hermes-tools` entry that invokes the old Hermes CLI (`hermes_cli/main.py mcp serve-tools`). The old CLI doesn't have a `serve-tools` subcommand — it exits immediately, closing the stdio transport.

**Why the bundled script never gets registered:** `index.ts` sees `hasHermesTools = true` from the stale JSON entry and **skips** registering the correct bundled script (`electron/integrations/mcp/servers/hermes-tools-mcp-server.py`).

**Detection:**
```bash
cat ~/.config/mosaic-companion/mcp-plugins.json | python3 -m json.tool | grep -A 10 '"name": "hermes-tools"'
# Look for args containing "hermes_cli/main.py" — that's stale
```

**Fix — Auto-removal in `index.ts`:**
Detect stale entries by checking if the command points to the old CLI or the script file no longer exists. Remove and re-register with the bundled script:

```typescript
const hermesToolsPlugin = existing.find((p) => p.name === "hermes-tools");
const bundledHermesPath = process.env.HERMES_TOOLS_MCP_PATH
  || path.join(home, "mosaic-companion", "electron", "integrations", "mcp", "servers", "hermes-tools-mcp-server.py");

if (hermesToolsPlugin) {
  const isStale =
    hermesToolsPlugin.args?.some((a) => a.includes("hermes_cli/main.py")) ||
    !fs.existsSync(hermesToolsPlugin.args?.[0] || "");
  if (isStale) {
    console.log(`[MCP] Removing stale hermes-tools plugin (${hermesToolsPlugin.id})`);
    pluginManager.remove(hermesToolsPlugin.id);
  }
}

if (!pluginManager.list().some((p) => p.name === "hermes-tools")) {
  // Register bundled script here
}
```

**Verification after fix:**
```bash
# 1. Check mcp-plugins.json now has correct entry:
cat ~/.config/mosaic-companion/mcp-plugins.json | python3 -m json.tool | grep -A 10 '"name": "hermes-tools"'
# Expected: args[0] ends with "hermes-tools-mcp-server.py", NOT "hermes_cli/main.py"

# 2. Test the server standalone:
PYTHONPATH=/home/user/hermes timeout 5 python3 \
  /path/to/hermes-tools-mcp-server.py --verbose 2>&1 | grep "Exposing"
# Expected: "Exposing N Hermes tools via MCP" where N > 0
```

### Pitfall 15: Context-aware bottom bar always redirects to AI Chat regardless of active tab
**Symptom:** When typing in the bottom bar on any non-AI-Chat tab (e.g., Mosaic Bot Team tab), hitting Enter navigates away to AI Chat.

**Root cause:** `App.tsx:handleBottomBarSubmit()` hardcodes `navigateTo(INTERNAL_CHAT_URL)` with no tab context check.

**Fix — Context-aware dispatch via CustomEvent:**

1. **BottomBar receives `currentUrl` prop:**
   ```typescript
   interface BottomBarProps {
     onSubmit: (text: string) => void;
     hasAgents: boolean;
     currentUrl?: string;  // ← NEW
   }
   ```

2. **BottomBar checks URL before dispatching:**
   ```typescript
   const isMosaicBotTab = currentUrl?.startsWith(INTERNAL_MOSAICBOT_URL);
   if (isMosaicBotTab) {
     window.dispatchEvent(
       new CustomEvent("team-message", {
         detail: { text: input.trim(), timestamp: Date.now() },
       })
     );
     setInput("");
     return;
   }
   // Else: fall through to existing onSubmit(input) → AI Chat
   ```

3. **Target component listens for the event:**
   ```typescript
   // Inside MosaicTeamPanel or TeamChatThread:
   useEffect(() => {
     const handleTeamMessage = async (e: CustomEvent) => {
       const { text } = e.detail;
       // Handle the message locally — do NOT navigate away
     };
     window.addEventListener("team-message", handleTeamMessage as any);
     return () => window.removeEventListener("team-message", handleTeamMessage as any);
   }, [/* deps */]);
   ```

4. **App.tsx passes the current URL:**
   ```typescript
   <BottomBar
     onSubmit={handleBottomBarSubmit}
     hasAgents={hasAgents}
     currentUrl={activeTab.history.present}  // ← NEW
   />
   ```

**Why CustomEvent?** BottomBar and MosaicTeamPanel are siblings (both rendered by App), not parent/child. CustomEvent is the cleanest sibling communication pattern when React props drilling through ContentArea → Panel → SubPanel is impractical.

**Tab-specific dispatch channels:**
- Mosaic Bot → `CustomEvent("team-message")` → TeamChatThread handles locally
- AI Chat → `onSubmit()` → `navigateTo(INTERNAL_CHAT_URL)` (existing behavior)
- Other tabs → `onSubmit()` → existing global handler

### Pitfall 16: Team chat thread needs parallel agent dispatch with role-specific prompts
**Symptom:** After fixing the bottom bar routing, the team chat shows user messages but no agent replies, or all agents reply identically.

**Root cause:** The team chat needs to (a) call multiple LLMs in parallel, (b) inject role-specific system prompts per agent, (c) stream status per agent.

**MVP implementation (simulated responses):**
```typescript
const dispatchToAgents = async (text: string) => {
  const targetAgents = agents.filter(a => selectedAgentIds.has(a.id));
  
  // 1. Create pending messages (one per agent, status="sending")
  const pendingMsgs = targetAgents.map(agent => ({
    id: `a-${agent.id}-${Date.now()}`,
    role: "agent",
    agentId: agent.id,
    agentName: agent.name,
    teamRole: agent.teamRole,
    content: "",
    status: "sending",
    timestamp: Date.now(),
  }));
  setMessages(prev => [...prev, ...pendingMsgs]);
  
  // 2. Parallel execution
  await Promise.all(targetAgents.map(async (agent, idx) => {
    const pendingId = pendingMsgs[idx].id;
    try {
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, status: "streaming" } : m));
      
      // Role-specific prompt injection
      const rolePrompts: Record<string, string> = {
        scout: `You are a LATAM market scout. Find and qualify leads.\n\nUser request: ${text}`,
        educator: `You are a product educator. Explain compliance and traceability.\n\nUser request: ${text}`,
        analyst: `You are a commodity analyst. Research market data and pricing.\n\nUser request: ${text}`,
        closer: `You are a deal closer. Negotiate terms and close proposals.\n\nUser request: ${text}`,
      };
      
      // Production: await callActiveLLM(rolePrompts[agent.teamRole], systemPrompt);
      // MVP: Simulate with realistic canned responses + delay
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1500));
      
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, content, status: "complete" } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === pendingId ? { ...m, content: `❌ Error: ${err.message}`, status: "error" } : m));
    }
  }));
};
```

**Production hardening needed:**
1. Wire real LLM dispatch via IPC → `electron/integrations/mosaicbot/src/main/llm.ts:callActiveLLM()`
2. Add `window.electronAPI.team.dispatch()` to preload bridge
3. Persist chat history (SQLite or JSONL in `userData/team-chat/`)
4. Streaming tokens (individual async generators instead of Promise.all)
5. Mission creation from chat replies ("Create Mission" button → Pipeline)

**UI elements per agent reply:**
- 🔄 **Escalate** → handoff to next role (scout→educator→analyst→closer)
- 💬 **Chat 1:1** → navigate to AI Chat with that agent
- Status indicators: ⏳ sending → ✍️ streaming → ✓ complete → ⚠️ error
**Root cause:** `MemorySearchManager` interface only exposes `search`, `sync`, `readFile`, `status`, `close`. No API to insert a single text entry.

**Fix:** Write to a chat log file under `APP_DIR/chat-logs/` and trigger `memory.sync()` to pick it up:
```typescript
const chatLogDir = path.join(APP_DIR, "chat-logs");
const fsm = await import("node:fs");
fsm.appendFileSync(chatLogFile, logEntry, "utf-8");
await memory.sync({ reason: "chat-turn", force: false });
```

### Pitfall 8: No persistent knowledge compounding across sessions
**Root cause:** SQLite memory provides search but no structured wiki. Knowledge is chunked and flattened — no entities, concepts, or cross-references.

**Fix:** Add a markdown wiki engine (adapted from Hermes PR #5100):
- `initWiki(wikiDir)` — Creates three-layer structure (raw/ + entities/ + concepts/) + SCHEMA.md + index.md + log.md
- `ingestSource(wikiDir, source)` — Saves chat turn to `raw/sessions/`, updates entity/concept pages, updates `index.md` + `log.md`
- `queryWiki(wikiDir, query)` — Searches `index.md` for relevant pages
- `buildWikiContext(wikiDir, query, maxPages)` — Builds LLM-injectable context

Wire into `agent:send`:
1. **Before LLM call:** `buildWikiContext(wikiDir, text, 3)` → inject into enriched prompt
2. **After LLM response:** `ingestSource(wikiDir, {type: "session", title: ..., content: ...})` → compound knowledge

### Pitfall 9: "Worry Bot" — diagnoses the same problem repeatedly but never acts
**Root cause:** Three failures stack together:
1. **Allowlist default:** `restart_service: false` in `axi-allowlist.json` — the bot can SEE the tool but is blocked from using it
2. **No chronic escalation:** After 3 identical alerts, no kanban task is created — the bot just repeats the same diagnosis
3. **No "hard down" declaration:** Nodes unreachable >2h never get declared "physical ops required" — the bot keeps suggesting SSH forever

**Files involved:**
- `electron/integrations/mosaicbot/src/main/heartbeat-tools.ts` — `WriteAllowlist` defaults
- `electron/integrations/mosaicbot/src/main/heartbeat-auto-actions.ts` — chronic detection + auto-restart + hard-down + kanban escalation
- `~/.config/mosaic-companion/mosaicbot/axi-allowlist.json` — runtime allowlist (user-configurable)

**Fix pattern:**
1. Enable the action in the allowlist:
   ```json
   { "restart_service": true }
   ```
2. Add `heartbeat-auto-actions.ts` with three rules:
   - **Chronic escalation:** Same alert 3+ times → auto-create kanban ops task
   - **Auto-restart:** SSH up + service down >1h → auto-call `restart_service` (if allowlisted)
   - **Hard down:** SSH down >2h → declare "physical ops required", create kanban ops task
3. Wire into heartbeat `onReply` BEFORE the LLM call so the bot knows what already happened:
   ```typescript
   const autoResult = await runAutoActions(alertText);
   if (autoResult.tookAction) {
     const autoPrompt = buildAutoActionPrompt(autoResult);
     const updatedPrompt = `${enrichedPrompt}\n${autoPrompt}`;
     const followUp = await runHeartbeatToolLoop(updatedPrompt, finalSystem, agentId);
     alertText = followUp.finalText || alertText;
   }
   ```

**Verification after restart:** Look for logs like:
```
[Heartbeat] main auto-actions: Auto-restarted hba on c3po: ✓ sent
[Heartbeat] main auto-actions: Escalated to kanban ops:t_xxxx (chronic ×3)
```

---

## New Components (Post-Stargate-Module)

These components were added after the initial Stargate module landed. They extend the architecture significantly — SOUL identity, AIM generation, fleet telemetry, MCP bridges, and payments.

### SOUL Identity Layer

**Files:** `src/types/soul.ts`, `src/components/SoulSelector.tsx`, `src/services/SoulGraderService.ts`, `src/services/SoulVaultConnector.ts`, `src/data/predefined-souls.ts`

- **7 archetypes:** `executor`, `researcher`, `creative`, `guardian`, `navigator`, `fast`, `custom`
- Each archetype maps to recommended capabilities, vault box access, and AIM deployment configs
- **Soul Grader Service:** 100-point rubric grading SOUL.md on mission clarity, identity negations, hard constraints, voice truthfulness, success artifacts
- **Soul Vault Connector:** Auto-configures vault box access per archetype (guardian → security+audit; executor → credentials+deployment)
- **UI:** `SoulSelector.tsx` — card gallery + inline SOUL.md editor with live grading badge (color-coded: emerald ≥90, cyan ≥75, amber ≥60, red <60)
- **Pattern:** Agents without explicit SOUL default to `executor` archetype, enforcing tool-first, evidence-based behavior

### AIM Forge — Guided Tree-Based AIM Builder

**Files:** `src/services/stargate/AIMForgeService.ts`, `src/services/stargate/StargateSoulIntegration.ts`, `src/components/stargate/AIMForgePanel.tsx`

- **Tree-nav builder** (7 steps): Project Identity → Model Source → Endpoints → Shims → Container Config → Manifest → Generated Files
- **Two model types:**
  - **Generic Model:** pip package + class instantiation (e.g., `transformers.AutoModelForCausalLM`)
  - **Hermes Agent Wrapper:** Embeds full Hermes AI Agent inside AIM container via `HermesAIMWrapper`
- **Auto-generates:** `config.yml`, `app/main.py`, `Dockerfile`, `requirements.txt`, `manifest.json`, `test.py`
- **Shim catalog:** `text`, `map.text`, `file_to_text`, `file_to_base64`, `base64_to_jpg`, `text_and_cost`, etc.
- **IPC bridge:** `writeProjectToDisk`, `pickDirectory`, `buildDocker`, `deployToNode`
- **Key architectural note:** Hermes wrapper auto-detects repo path inside container (`/container_mount`, `/opt/hermes-agent`, `/hermes`) and bootstraps `AIAgent` with toolsets `["terminal","file","code_execution","web","search","browser","vision","skills"]`

### Fleet Telemetry & Skill Forge (Mosaic Bot Team)

**Files:** `electron/integrations/mosaicbot/src/main/fleet-telemetry.ts`, `electron/integrations/mosaicbot/src/main/skill-forge.ts`

#### Fleet Telemetry
- Runs `hbox-axi status` + SPO health probe every 15 minutes
- Parses TOON table rows (`│ C-3PO │ ✓ │ ✓ │ ✓ │ ... │`)
- Records into `axi.sqlite` via `recordNodeTelemetry()`
- Exposes `buildLiveFleetSummary()` for heartbeat prompts — **live data overrides static registry**
- **Pattern:** Use actual AXI tool execution, not static registry, for fleet health

#### Skill Forge
- **Filesystem-first skill creation** — `forgeSkill()` writes `SKILL.md` + `manifest.json` to `~/.config/mosaic-companion/mosaicbot/skills/mosaicbot-authored/`
- **Anti-hallucination:** Never claim "created" without fs verification
- Pre-built templates: `dynamic-ip-handler`, `health-endpoint-troubleshooter`, `evolution-accelerator`

### Hermes Capability Registry & External Skill Importer

**Files:** `src/services/HermesCapabilityRegistry.ts`, `src/services/externalSkillImporter.ts`, `src/services/VaultCapabilityService.ts`

#### HermesCapabilityRegistry
- Maps **17 Hermes tools** to Mosaic agent capabilities: `web_search`, `browser_navigation`, `file_read/write/search/patch`, `terminal`, `process_management`, `code_execution`, `skill_management`, `memory_management`, `session_search`, `task_delegation`, `vision`, `kanban`, `cronjob`, `text_to_speech`
- **5 capability sets:** `developer` (15 tools), `researcher` (8), `ops` (9), `creative` (7), `minimal` (2)
- `buildCapabilitySystemPrompt()` injects tool usage instructions into agent prompts

#### External Skill Importer
- Imports `SKILL.md` from public GitHub repos into Vault boxes
- Supports frontmatter parsing, Taste-Skill dial detection (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`)
- **Default presets:** kilocode, superpowers, codebase-memory-mcp, timesfm-forecasting, flue

#### VaultCapabilityService
- Bridges Vault + Capabilities + SOUL into unified system prompts
- `buildAgentSystemPrompt()` → `AgentSystemPromptParts` → `assembleSystemPrompt()`
- Handles vault knowledge injection, SOUL content resolution, capability gating

### MCP Integrations

#### Atomic Mail (`electron/integrations/tools/modules/atomicmail.ts`)
- Wraps `@atomicmail/mcp-github` as native `ToolModule`
- **6 tools:** `registerInbox` (PoW signup), `sendEmail`, `readInbox`, `searchEmails`, `emailHelp`, `getStatus`
- JMAP batch builder for `Email/set` + `EmailSubmission/create`
- Auto-registered in MCP plugin manager with `autoConnect: true`
- **Credential isolation:** Each agent should use unique inbox username; credentials written to `~/.atomicmail/` by MCP server

#### Midnight Network (`electron/integrations/tools/modules/midnight.ts`)
- Bridges `midnight-mcp` server into ToolRegistry
- **14 tools:** contract generation, compilation, review, analysis, circuit explanation, Compact/TS/docs search, example listing, health checks
- **System prompt rules:** Always call `midnight_get_latest_syntax` before writing Compact; always compile before claiming success
- **Key concepts:** NIGHT (native token), DUST (gas token), Compact (ZK language), dual-state ledger

### Ada Portal Payment Service

**Files:** `src/services/AdaPortal/PaymentService.ts`

- **USDC on Base** payments for agent hire and bundle purchase
- **Dual wallet path:** browser injected (`window.ethereum`) + Mosaic Electron stored wallet (`electronAPI.web3`)
- `viem`-based balance checking, chain switching (`wallet_switchEthereumChain`), tx broadcast
- Receipt tracking with `txHash`, `status`, `chainId: 8453`, `token: 'USDC'`
- **Path A:** Browser MetaMask → `eth_sendTransaction` → `publicClient.waitForTransactionReceipt`
- **Path B:** Electron stored wallet → `web3:transfer_token` tool → same confirmation flow

### Video Editor Agent

**Files:** `video-editor-agent/video-editor-agent.sh`, `video-editor-agent/README.md`

- Bash-based pipeline for AI avatar marketing videos
- **3 video types:** Intro (30-45s), Demo (60s), Stargate (30-45s)
- Script pattern: Hook → Value Props → Steps → Reinforcement → Objections → CTA
- Generates HeyGen API payloads with avatar/voice selection
- Reverse-engineered from Julian Goldie's viral video workflow
- **Cost:** HeyGen Creator Plan $29/mo, ~$0.50-2.00/min generation

---

## Session References

For per-session deep-dive notes, see the `references/` directory in this skill. Notable entries:
- `references/session-2026-07-15-new-components-analysis.md` — Complete analysis of SOUL layer, AIM Forge, SPO orchestrator, fleet telemetry, MCP integrations, payment service, capability registry, and video editor agent added post-stargate-module.

---

## Debugging Checklist

When a feature works in one runtime but not the other:

- [ ] Identify which runtime the user is testing (AI Chat vs Hermes Agent)
- [ ] Check if IPC bridge exists for that feature (`electronAPI?.skills?.buildSystemPrompt`)
- [ ] Trace the data flow: renderer → IPC payload → main handler → response → renderer injection
- [ ] Verify config file has real skill names (not fake/internal codenames)
- [ ] Verify vault boxes are actually loaded (not hardcoded empty)
- [ ] Check both `src/services/` (renderer) AND `electron/integrations/` (main) for the same feature
- [ ] Look for hardcoded `[]` or `null` where dynamic config should flow
