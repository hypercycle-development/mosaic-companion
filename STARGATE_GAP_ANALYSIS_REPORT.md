# STARGATE-MOSAIC INTEGRATION GAP ANALYSIS REPORT
## Generated: 2026-06-11
## Task: t_916d0339

---

## EXECUTIVE SUMMARY

Analysis of the Mosaic-Companion Stargate module reveals **12 confirmed gaps** across UI wiring,
agent communication, provider routing, and infrastructure integration. The most critical issue is
incomplete tab navigation wiring where several buttons fall back to `onNavigateToChat` instead
of their intended tab destinations.

---

## 1. AGENT COMMUNICATION LAYER ANALYSIS

### 1.1 Agent Runner (`electron/integrations/chat/agent-runner.ts`)

**Location:** Lines 33-116

**How it works:**
- Agents in chat rooms use `ChatClient` WebSocket connections
- LLM calls go through `callActiveLLM()` from `mosaicbot/src/main/llm.ts`
- Agents respond only when @mentioned (line 94: `mentionRegex.test(m.text)`)

**Confirmed Gap #1: Missing Agent ID propagation**
- **File:** `agent-runner.ts:102-106`
- **Issue:** `callActiveLLM()` accepts `agentId` parameter but the LLM resolution
  in `llm.ts:46-52` only finds agents by `isActive` flag, not by ID
- **Code:**
```typescript
const reply = await callActiveLLM(
  conversationContext,
  systemPrompt,
  agentId,  // Passed but not used correctly
);
```
- **Impact:** Agents with specific configurations may not use their assigned LLM
- **Severity:** HIGH

### 1.2 LLM Provider Routing (`electron/integrations/mosaicbot/src/main/llm.ts`)

**Location:** Lines 61-109

**Confirmed Gap #2: Incomplete :cloud suffix handling**
- **File:** `llm.ts:89-91`
- **Issue:** `ollama-cloud` provider exists but doesn't route through `ollama-cloud` provider string
  when called from agent-runner. Instead it falls through to `callOpenAI()` with default OpenAI baseUrl.
- **Expected:** Should route through `AIService.sendToOpenAI` with `ollama-cloud` provider logic
- **Actual:** Direct `callOpenAI()` call that doesn't apply ollama.com URL migration
- **Severity:** MEDIUM

### 1.3 Provider Routing in AIService (`src/services/AIService.ts`)

**Location:** Lines 562-615

**Confirmed Gap #3: TS2339 Static method import issue**
- **File:** `KanbanDashboard.tsx:337-339`
- **Issue:** `AIService.sendToHermesAIM` is called as static method but `AIService` is imported dynamically
- **Code:**
```typescript
const { AIService } = await import('../services/AIService');
const msg = { id: '1', role: 'user' as const, content: globalPrompt, timestamp: Date.now(), agentId: agent.id };
reply = await AIService.sendToHermesAIM(agent, [msg]);
```
- **Risk:** Runtime error if module doesn't export correctly
- **Severity:** MEDIUM

---

## 2. UI TAB WIRING ANALYSIS

### 2.1 AdaPortalPanel Tab Structure

**Location:** `src/components/AdaPortalPanel.tsx`

**Tabs defined (lines 206-218):**
```typescript
const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'start', label: 'Start', icon: <Rocket size={18} /> },
  { id: 'marketplace', label: 'Hire Agents', icon: <Users size={18} /> },
  { id: 'aims', label: 'AI Models', icon: <Bot size={18} /> },
  { id: 'leaderboard', label: 'Rankings', icon: <Trophy size={18} /> },
  { id: 'training', label: 'Train Agents', icon: <GraduationCap size={18} /> },
  { id: 'packages', label: 'Bundles', icon: <Package size={18} /> },
  { id: 'skills', label: 'Skills', icon: <Zap size={18} /> },
  { id: 'compute', label: 'Compute & Nodes', icon: <Cpu size={18} /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'stargate', label: 'Stargate Pool', icon: <Zap size={18} /> },
  { id: 'asp', label: 'Deploy System', icon: <Building2 size={18} /> }
];
```

### 2.2 Tab Wiring Issues

**Confirmed Gap #4: handleHireAgent fallback to chat**
- **File:** `AdaPortalPanel.tsx:1005-1013`
- **Issue:** When `onHireAgent` is not provided, falls back to `onNavigateToChat` instead of proper tab navigation
- **Current Code:**
```typescript
const handleHireAgent = useCallback((listing: MarketplaceListing) => {
  console.log('[AdaPortal] handleHireAgent called:', listing.agentName);
  if (onHireAgent) {
    onHireAgent(listing.agentId, listing.agentName);
  } else if (onNavigateToChat) {
    onNavigateToChat(`Hire agent ${listing.agentName} for my project`);
  }
  showNotification('success', `Hiring ${listing.agentName}...`);
}, [onHireAgent, onNavigateToChat]);
```
- **Expected:** Navigate to marketplace tab within Stargate
- **Severity:** MEDIUM

**Confirmed Gap #5: handleBookTraining fallback to chat**
- **File:** `AdaPortalPanel.tsx:1015-1022`
- **Same pattern as Gap #4**
- **Severity:** MEDIUM

**Confirmed Gap #6: handleGetPackage fallback to chat**
- **File:** `AdaPortalPanel.tsx:1024-1031`
- **Same pattern as Gap #4**
- **Severity:** MEDIUM

**Confirmed Gap #7: handleSelectCompute fallback to chat**
- **File:** `AdaPortalPanel.tsx:1033-1041`
- **Same pattern as Gap #4**
- **Severity:** MEDIUM

**Confirmed Gap #8: Intent buttons navigate to chat**
- **File:** `AdaPortalPanel.tsx:1448-1456`
- **Issue:** All intent options in Start tab call `onNavigateToChat` after setting active tab
- **Current Code:**
```typescript
<button
  key={intent.id}
  onClick={() => {
    setSelectedIntent(intent.id);
    setActiveTab(intent.tab as TabId);
    if (onNavigateToChat) {
      onNavigateToChat(`I want to ${intent.label.toLowerCase()}. Help me get started.`);
    }
  }}
>
```
- **Expected:** Just set `activeTab`, no chat navigation
- **Severity:** MEDIUM

### 2.3 Callback Prop Wiring Chain

**Location:** `ContentArea.tsx:569-574`

**Issue:** AdaPortalPanel receives `onNavigate` but not `onHireAgent`, `onBookTraining`, etc.
- `AdaPortalPanel` props (line 89-98) define callbacks but parent `ContentArea.tsx` doesn't pass them
- Only `url` and `onNavigate` are passed at line 571
- **Current:**
```typescript
<AdaPortalPanel url={url} onNavigate={onNavigate} />
```
- **Expected:**
```typescript
<AdaPortalPanel
  url={url}
  onNavigate={onNavigate}
  onHireAgent={...}
  onBookTraining={...}
  onGetPackage={...}
  onSelectCompute={...}
  onNavigateToChat={...}
/>
```
- **Result:** All fallback handlers fall through to `onNavigateToChat`

---

## 3. PROVIDER ROUTING ANALYSIS

### 3.1 Provider String Mapping

**From `llm.ts:19-23`:**
```typescript
provider: "claude" | "openai" | "gemini" | "ollama" | "ollama-cloud" |
          "custom" | "hypercycle" | "hermes" | "hermes-aim" | "hermes-api"
```

**Confirmed Gap #9: HermesAIM port inconsistency**
- **AIService.ts:381:** `http://127.0.0.1:9000/chat`
- **KanbanDashboard.ts:197-199:** Dynamic port from AIM slot: `9000 + (aim.slot ?? idx)`
- **Issue:** Port can conflict if multiple AIMs detected
- **Severity:** LOW

### 3.2 :cloud Model Suffix Routing

**Confirmed Gap #10: Missing :cloud suffix detection**
- **File:** `llm.ts:61-109`
- **Expected:** Models with `:cloud` suffix should route through `ollama-cloud` provider
- **Actual:** No suffix parsing; relies on provider field only
- **Impact:** Cloud models may try to hit local ollama
- **Code shows:** Only checks `agent.provider` field, not `agent.model` suffix
- **Severity:** HIGH

---

## 4. INFRASTRUCTURE SERVICES ANALYSIS

### 4.1 Service Port Configuration

| Service | Port | Status | Issue |
|---------|------|--------|-------|
| Skills Marketplace | 3000/13000 | Configured | Hardcoded in MCP server (line 85) |
| Scanner | 8001 | Configured | Hardcoded fallback (line 86) |
| AIM Container | 9000 | Configured | Dynamic port assignment in KanbanDashboard |
| Dashboard | 9119 | **Unknown** | Not found in codebase |
| Gateway | 8642 | Configured | Used in `sendToHermes` (line 334) |
| Local Node Bridge | 8000 | Configured | `localNodeBridge.ts` polling |

**Confirmed Gap #11: Dashboard port 9119 not found**
- **Expected:** Port 9119 for Kanban Dashboard AIM discovery (per task spec)
- **Actual:** No service found listening on 9119
- **File:** KanbanDashboard probes `8000/info` and `9000/health` only (lines 165-183)
- **Severity:** MEDIUM

### 4.2 MCP Integration

**Location:** `electron/integrations/mcp/index.ts`

**Confirmed Gap #12: Missing Hermes Tools MCP server path validation**
- **File:** `mcp/index.ts:103-131`
- **Issue:** Server path is hardcoded: `${home}/mosaic-companion/...`
- **Code:**
```typescript
const hermesToolsPath = path.join(home, "mosaic-companion", "electron", "integrations", "mcp", "servers", "hermes-tools-mcp-server.py");
```
- **Impact:** Fails if repo is not cloned to `~/mosaic-companion`
- **Severity:** LOW

---

## 5. DEPENDENCY GRAPH

```
Gap #10 (:cloud suffix)
  → Blocks Gap #2 (ollama-cloud routing)
  → Affects Agent Communication

Gap #8 (Intent buttons)
  → Blocks Gap #4-7 (fallback handlers)
  → Affects User Experience

Gap #3 (TS2339 import)
  → Could cause runtime errors in Kanban

Gap #1 (Agent ID propagation)
  → Affects all agent-specific configurations
```

---

## 6. PRIORITIZED FIX LIST

### P0 - Blocking (Fix First)
| Rank | Gap | Description | File |
|------|-----|-------------|------|
| 1 | #10 | Implement `:cloud` suffix detection | `llm.ts:61-109` |
| 2 | #1 | Fix agent ID resolution | `llm.ts:46-52` |

### P1 - High Impact
| Rank | Gap | Description | File |
|------|-----|-------------|------|
| 3 | #8 | Remove `onNavigateToChat` from Intent buttons | `AdaPortalPanel.tsx:1453-1455` |
| 4 | #2 | Add ollama-cloud provider case | `llm.ts:89` |
| 5 | #4-7 | Wire up callback props in ContentArea | `ContentArea.tsx:571` |

### P2 - Medium Impact
| Rank | Gap | Description | File |
|------|-----|-------------|------|
| 6 | #3 | Fix dynamic import of AIService | `KanbanDashboard.tsx:337-339` |
| 7 | #11 | Verify Dashboard port 9119 | Documentation |

### P3 - Low Impact
| Rank | Gap | Description | File |
|------|-----|-------------|------|
| 8 | #9 | Standardize HermesAIM port | `AIService.ts:381`, `KanbanDashboard.tsx:197` |
| 9 | #12 | Make MCP paths configurable | `mcp/index.ts:103-131` |

---

## 7. FILE LOCATIONS SUMMARY

| File | Purpose | Key Lines |
|------|---------|-----------|
| `AdaPortalPanel.tsx` | Main Stargate UI | 89-98 (props), 1005-1455 (handlers), 206-218 (tabs) |
| `ContentArea.tsx` | Content router | 560-574 (Stargate routing) |
| `AIService.ts` | LLM provider routing | 376-406 (HermesAIM), 562-615 (sendMessage) |
| `agent-runner.ts` | Chat agent execution | 33-116 (startAgentInRoom), 102-106 (LLM call) |
| `llm.ts` | MosaicBot LLM caller | 61-109 (callActiveLLM), 46-52 (agent resolution) |
| `KanbanDashboard.tsx` | Multi-agent orchestration | 330-339 (agent execution), 165-183 (AIM discovery) |
| `mcp/index.ts` | MCP server integration | 103-131 (Hermes Tools server) |

---

## 8. RECOMMENDATIONS

### For Backend Engineering:
1. **Add `:cloud` suffix parsing** to provider detection in `llm.ts`
2. **Standardize port configuration** across all services (use config file)
3. **Implement proper agent ID resolution** in MosaicBot LLM caller (don't just use `isActive`)

### For Frontend Engineering:
1. **Wire up missing callback props** in ContentArea → AdaPortalPanel chain
2. **Remove chat fallback** from intent buttons in Start tab
3. **Fix dynamic import pattern** for AIService in KanbanDashboard

### For Operations:
1. **Document service port requirements** in README
2. **Verify Dashboard service** deployment on port 9119
3. **Make MCP server paths** environment-configurable

---

## 9. VERIFICATION CHECKLIST

- [ ] All 11 tabs render without chat fallback
- [ ] Agent communication works with ollama-cloud provider
- [ ] `:cloud` suffix correctly routes to cloud endpoints
- [ ] Kanban Dashboard AIM discovery on port 8000
- [ ] Skills Marketplace accessible on port 3000/13000
- [ ] MCP servers load from configurable paths
- [ ] Agent ID is properly resolved (not just isActive)
- [ ] AIService imports work without runtime errors

---

## APPENDIX: KEY CODE SNIPPETS

### A1. Agent ID Not Used (llm.ts)
```typescript
function readAgentById(id: string): AgentConfig | null {
  return readAgents().find((a) => a.id === id) ?? null;
}
// Called from callActiveLLM, but agent lookup by isActive is primary
```

### A2. Intent Button Double Navigation (AdaPortalPanel.tsx)
```typescript
onClick={() => {
  setSelectedIntent(intent.id);
  setActiveTab(intent.tab as TabId);  // Sets tab correctly
  if (onNavigateToChat) {              // But ALSO goes to chat
    onNavigateToChat(`I want to ${intent.label.toLowerCase()}. Help me get started.`);
  }
}}
```

### A3. Missing Props (ContentArea.tsx)
```typescript
// Line 571 - Only passes url and onNavigate
<AdaPortalPanel url={url} onNavigate={onNavigate} />

// Should also pass:
// onHireAgent, onBookTraining, onGetPackage, onSelectCompute, onNavigateToChat
```

---

*Report generated by Hermes Kanban Worker for task t_916d0339*
