# Stargate Backend Services Analysis
## API Endpoint Inventory, Integration Architecture & Code Quality

---

## 1. API DESIGN ANALYSIS

### 1.1 LocalNodeBridge Endpoints

**Primary Endpoints (from `LocalNodeBridge.ts` lines 143-144, 359-415):**

| Endpoint | Port | Purpose | Fallback Strategy |
|----------|------|---------|-------------------|
| `GET /api/info` | 8006 (UI_PORT) | Node status, hardware specs, AIMs list | Falls back to `localhost:8005/info` |
| `GET /api/config` | 8006 (UI_PORT) | Node config (addresses, hosts, DB) | Falls back to `localhost:8005/config` |
| `GET /info` | 8005 (ADMIN_PORT) | Admin endpoint for node info | Final fallback |
| `GET /config` | 8005 (ADMIN_PORT) | Admin endpoint for config | Final fallback |

**URL Fallback Logic (lines 361-384):**
```typescript
// In Electron file:// protocol, relative URLs fail → use absolute
const isElectronFileProtocol = typeof window !== 'undefined' && 
  window.location?.protocol === 'file:';

const urls = isElectronFileProtocol
  ? [`http://localhost:${UI_PORT}/api/info`, `http://localhost:${ADMIN_PORT}/info`]
  : [`http://localhost:${UI_PORT}/api/info`, `/api/info`, `http://localhost:${ADMIN_PORT}/info`];

// Sequential fallback: try each URL, skip on error, return null if all fail
```

### 1.2 EnhancedLocalNodeBridge Additional Endpoints

**From `EnhancedLocalNodeBridge.ts` (lines 135-184):**

| Endpoint | Port | Purpose | Timeout |
|----------|------|---------|---------|
| `GET /api/tags` | 11434 | Ollama model discovery | 3000ms |
| `GET /health` | 8003 (merklizer) | Merklizer health check | 3000ms |
| `electronAPI.system.getProcesses` | - | Hermes process detection | - |

### 1.3 MCP Marketplace Server Endpoints

**From `stargate-marketplace-mcp-server.js` (lines 26-27):**

| Endpoint | Port | Purpose |
|----------|------|---------|
| `GET /api/skills` | 13000 | Skills search, filter, sort |
| `GET /api/skills/:slug` | 13000 | Individual skill details |
| `GET /api/categories` | 13000 | Category listing |
| `POST /votes` | 13000 | Skill voting |
| `POST /bookmarks` | 13000 | Skill bookmarking |
| `POST /scan` | 8001 | SkillSpector security scan |
| `POST /admin/discover` | 13000 | Discovery pipeline |

---

## 2. INTEGRATION ARCHITECTURE

### 2.1 Data Flow: Node Manager → Bridge → UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  HyperCycle Node Manager (localhost:8000-8006)                     │
│  ├─ /api/info → Node status, hardware, AIMs                       │
│  ├─ /api/config → Node configuration                               │
│  └─ /health → Health check (returns 405 on v0.5.0)                │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LocalNodeBridge (renderer-side singleton)                         │
│  ├─ startPolling() → 30s interval refresh                        │
│  ├─ _fetchInfo() → Tries 8006/api/info → 8005/info                 │
│  ├─ _fetchConfig() → Tries 8006/api/config → 8005/config            │
│  └─ Normalizers: getLocalANFE(), getLocalComputeNode()             │
│     → BridgeANFE, BridgeComputeNode shapes                          │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EnhancedLocalNodeBridge (extends telemetry)                       │
│  ├─ _fetchOllamaModels() → localhost:11434/api/tags                │
│  ├─ _pingHost() → merklizer_hosts[0]:8003/health                   │
│  ├─ _detectHermesInstances() → electronAPI.system.getProcesses     │
│  └─ getRecommendedIntents() → Intent cards for Start tab            │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AdaPortalPanel / Stargate Pool UI                                   │
│  ├─ localNodeBridge.onUpdate() → Re-render on poll                 │
│  ├─ enhancedLocalNodeBridge.onUpdate() → Telemetry gauges          │
│  └─ Consumes: BridgeComputeNode[], BridgeAIM[], BridgeANFE         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 AIService.sendToHermesAIM Integration

**From `AIService.ts` lines 481-512:**

```typescript
// Native HyperCycle AIM endpoint (port 9000 default)
static async sendToHermesAIM(config, messages, callbacks?): Promise<string> {
  const url = `${config.baseUrl || "http://127.0.0.1:9000"}/chat`;
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content || "";
  const system = messages.find((m) => m.role === "system")?.content || "";
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: lastUser, system_prompt: system }),
    signal: AbortSignal.timeout(120000), // 2 min timeout
  });
  
  const data = await response.json();
  return data.response ?? "";
}
```

**Key distinction:** `sendToHermesAIM` uses native `/chat` endpoint (port 9000), while `sendToHermes` uses OpenAI-compatible `/v1/chat/completions` (port 8642).

### 2.3 MCP Server Tool Architecture

**From `stargate-marketplace-mcp-server.js` (462 lines):**

**9 Tools Exposed:**
1. `search_skills` - Keyword + category + sort
2. `get_skill` - Single skill details
3. `get_categories` - Category listing
4. `scan_skill` - Security scan via SkillSpector
5. `get_security_report` - Retrieve stored report
6. `vote_skill` - Upvote/downvote
7. `bookmark_skill` - Add to collection
8. `attach_skill_to_agent` - Modifies `~/.config/mosaic-companion/ai-agents.json`
9. `discover_skills` - Trigger discovery pipeline

**IPC Handler Mapping (main process):**
```typescript
// electron/preload.ts lines 149-159
stargate: {
  registerAgentTool: (manifest) => ipcRenderer.invoke("stargate:registerAgentTool", manifest),
  unregisterAgentTool: (toolId) => ipcRenderer.invoke("stargate:unregisterAgentTool", toolId),
  listAgentTools: () => ipcRenderer.invoke("stargate:listAgentTools"),
  registerAIM: (config) => ipcRenderer.invoke("stargate:registerAIM", config),
  unregisterAIM: (serverName) => ipcRenderer.invoke("stargate:unregisterAIM", serverName),
}

// electron/integrations/sandbox/index.ts lines 701-706
ipcMain.handle("stargate:registerAgentTool", async (_event, manifest) => {
  const installed = this.installManifest(manifest, true);
  // ...
});

// electron/integrations/mcp/index.ts lines 824-828
ipcMain.handle("stargate:registerAIM", async (_event, config) => {
  const aimServerName = `aim-${mcpConfig.name}`;
  // ...
});
```

---

## 3. CODE QUALITY ANALYSIS

### 3.1 Hardcoded Values Catalog

**Critical Hardcoded Values Found:**

| File | Line | Value | Risk |
|------|------|-------|------|
| `LocalNodeBridge.ts` | 143-144 | `ADMIN_PORT=8005`, `UI_PORT=8006` | Medium - Standard HyperCycle ports |
| `LocalNodeBridge.ts` | 145 | `POLL_MS=30000` (30s) | Low - Reasonable default |
| `LocalNodeBridge.ts` | 227 | `contractAddress='0x8c0075D087de9588DdF5c1441dF39828d695bc2f'` | **HIGH** - Base ANFE contract |
| `LocalNodeBridge.ts` | 229 | `chainId=8453`, `chainName='Base'` | Medium - Hardcoded to Base L2 |
| `LocalNodeBridge.ts` | 235 | `level=11` (arbitrary) | Low - Fallback only |
| `LocalNodeBridge.ts` | 302 | `pricePerHour=0.15` | Low - Placeholder pricing |
| `LocalNodeBridge.ts` | 289-290 | `uptime=heartbeats/25000` (magic number) | Medium - Heuristic |
| `EnhancedLocalNodeBridge.ts` | 139 | `ollama:11434` | Low - Standard port |
| `EnhancedLocalNodeBridge.ts` | 175 | `merklizer:8003` port parsing | Medium - Fallback parsing |
| `MCPAIMService.ts` | 206 | `api.hypercycle.io/v1/aim/` | Low - Production endpoint |
| `AgentToolService.ts` | 115-116 | `docker` runtime, `hypercycle/aim-node:latest` | Low - Container image |
| `AgentToolService.ts` | 389-398 | Multiple RPC domains hardcoded | Medium - Chain-specific |
| `stargate-marketplace-mcp-server.js` | 26-27 | `MARKETPLACE_API=13000`, `SCANNER_API=8001` | Low - Configurable via env |
| `AIService.ts` | 440 | `hermesPort=8642` | Low - Standard port |
| `AIService.ts` | 487 | `hermesAimPort=9000` | Low - Standard AIM port |

### 3.2 Error Handling Assessment

**LocalNodeBridge Error Handling (lines 192-209, 359-415):**
```typescript
// GOOD: Graceful degradation with try/catch per URL
for (const url of urls) {
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) continue;  // Skip failed URLs
    // ...
  } catch {
    continue;  // Silent skip on network error
  }
}
return null;  // Return null if ALL fail
```
**Assessment:** ✅ GOOD - Sequential fallback, silent failure, null return

**MCPAIMService Error Handling (lines 57-84):**
```typescript
async registerAIM(aim: AIMInfo): Promise<MCPRegisterResult> {
  try {
    const ipc = (window as any).electronAPI?.stargate;
    if (!ipc?.registerAIM) {
      throw new Error('electronAPI.stargate.registerAIM not available');
    }
    const result = await ipc.registerAIM(config);
    return { success: result.success, serverName: config.name, error: result.error };
  } catch (e: any) {
    return { success: false, serverName: this.sanitizeName(aim.name), error: e.message };
  }
}
```
**Assessment:** ✅ GOOD - Structured error return, no throwing

**AgentToolService Error Handling (lines 215-253):**
```typescript
async registerManifest(manifest: AgentToolManifest): Promise<AgentToolRegistrationResult> {
  try {
    if (this.registeredManifests.has(toolId)) {
      return { success: true, toolId, manifest: existing };  // Deduplication
    }
    const ipc = (window as any).electronAPI?.stargate;
    if (!ipc?.registerAgentTool) {
      throw new Error('electronAPI.stargate.registerAgentTool not available');
    }
    // ...
  } catch (e: any) {
    return { success: false, toolId: manifest.id, manifest, error: e.message };
  }
}
```
**Assessment:** ✅ GOOD - Deduplication check, structured errors

**MCP Server Error Handling (lines 420-426):**
```typescript
try {
  const result = await execTool(toolName, toolArgs);
  sendResponse(id, result);
} catch (err) {
  const code = err.code || -32600;
  sendError(id, code, err.message || String(err));
}
```
**Assessment:** ✅ GOOD - JSON-RPC error codes, consistent response format

### 3.3 Async/Await Patterns

**Promise Handling Review:**

| Pattern | File | Line | Status |
|---------|------|------|--------|
| `async/await` with `try/catch` | `LocalNodeBridge.ts` | 192-209 | ✅ |
| `Promise.all()` for parallel | `EnhancedLocalNodeBridge.ts` | 84-87 | ✅ |
| `AbortController` with timeout | `LocalNodeBridge.ts` | 374-377 | ✅ |
| Sequential loop (no Promise.all) | `MCPAIMService.ts` | 87-93 | ⚠️ Suboptimal - Could parallelize |
| Sequential loop | `AgentToolService.ts` | 257-265 | ⚠️ Suboptimal - Could parallelize |
| Event listener cleanup | `LocalNodeBridge.ts` | 184-188 | ✅ |

**Potential Promise Leak (minor):**
- `LocalNodeBridge._notify()` (lines 417-420) catches listener errors but swallows them silently
- No risk of unhandled rejections since all async calls are awaited or fire-and-forget with catch

---

## 4. SUMMARY & RECOMMENDATIONS

### Strengths:
1. **Graceful degradation** - LocalNodeBridge tries multiple URLs before failing
2. **Structured error returns** - All services return `{ success, error }` shapes
3. **AbortController timeouts** - Prevents hanging requests (3-5s for health, 15s for API, 120s for AIM)
4. **Singleton pattern** - `localNodeBridge` and `enhancedLocalNodeBridge` prevent duplicate polling

### Concerns:
1. **Hardcoded contract address** - Base ANFE contract in `LocalNodeBridge.ts:227` should be configurable
2. **Sequential loops** - `MCPAIMService.registerAIMs()` and `AgentToolService.registerWalletAgents()` could use `Promise.all()` for parallel registration
3. **No health check for 8005 port** - If 8006 fails but 8005 works, no visibility
4. **Magic number** - `heartbeats/25000` for uptime calc (line 289-290) needs documentation

### Cross-Cutting Questions for Parent Task:
- Should `ANFE_CONTRACT_ADDRESS` and `CHAIN_ID` be moved to a config file?
- Is the 30s polling interval configurable, or should it adapt based on user activity?
- Should `registerAIMs()` and `registerWalletAgents()` be parallelized for batch operations?
