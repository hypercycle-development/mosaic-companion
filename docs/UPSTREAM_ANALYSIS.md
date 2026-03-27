# Upstream Analysis: hypercycle-development/mosaic-companion

## Executive Summary

The upstream repository has **significantly diverged** from our integrations. They've moved to a **plugin architecture** and **removed** most of the components we added.

---

## 🔴 Our Components That Were REMOVED by Upstream

### Services (REMOVED):
- `AgentOrchestrationService.ts` - Multi-agent orchestration
- `AgentSoulService.ts` - Agent memory/personality
- `BuilderService.ts` - Builder mode
- `CardanoWalletService.ts` - Cardano wallet
- `EthWalletService.ts` - ETH/BASE wallet
- `ExecutionBridge.ts` - Execution bridge
- `FactoryStatusService.ts` - Factory status
- `HyperAIBOXService.ts` - Physical nodes
- `MemoryService.ts` - Memory service
- `MultiAgentService.ts` - Multi-agent
- `NodeConfigService.ts` - Node config
- `NodeStatusService.ts` - Node status
- `OllamaService.ts` - Ollama models
- `WalletService.ts` - Wallet service
- `WalletConnectBridge.ts` - WalletConnect

### Components (REMOVED):
- `AgentSoulSettings.tsx` - Agent soul UI
- `CardanoWalletConnect.tsx` - Cardano wallet UI
- `EthWalletConnect.tsx` - ETH wallet UI
- `FactoryStatusCard.tsx` - Factory card
- `MidnightPage.tsx` - Midnight page
- `ModelSelector.tsx` - Model selector
- `MultiAgentPanel.tsx` - Multi-agent panel
- `MultiAgentSelector.tsx` - Agent selector
- `NodeConfigPanel.tsx` - Node config
- `WalletConnect.tsx` - Wallet connect

### Types (REMOVED):
- `agentOrchestration.ts`
- `agentSoul.ts`
- `builderMode.ts`
- `cardano.ts`
- `midnight.ts`
- `nodeConfig.ts`
- `wallet.ts`

---

## 🟢 NEW Features Added by Upstream

### 1. Plugins System
New `plugins/` folder with plugin architecture:

```
plugins/
├── aim-nodes/           # AIM nodes with MCP server
│   ├── main/
│   │   ├── index.js
│   │   └── mcp-server.js
│   └── shared/
│       └── nodeManagerClient/
├── hyperinsight/        # HyperInsight dashboard
│   ├── main/index.js
│   ├── manifest.json
│   └── renderer/
│       ├── HyperInsightView.tsx
│       └── components/
├── payments-jit/        # Just-in-time payments
│   ├── main/
│   │   ├── index.ts
│   │   └── web3Tools.ts
│   └── shared/
└── dependency-setup-guide.md
```

### 2. New Services
- `hypercycleAgent.ts` - Hypercycle agent service
- `TTSService.ts` - Text-to-speech

### 3. Web3 Enhancements
- `toda.ts` - TODA integration
- `hypercycleSign.ts` - Hypercycle signing
- Updated `web3/index.ts` with payments

### 4. Electron Updates
- Updated `main.ts` and `preload.ts` for plugin system
- New `secure-wallet-import-preload.ts`

---

## 📊 Comparison Table

| Feature | Our Branch | Upstream |
|---------|------------|----------|
| Multi-agent orchestration | ✅ MultiAgentService | ❌ Removed |
| Agent soul/memory | ✅ AgentSoulService | ❌ Removed |
| Ollama models | ✅ OllamaService | ❌ Removed |
| Cardano wallet | ✅ CardanoWalletService | ❌ Removed |
| ETH/BASE wallet | ✅ EthWalletService | ❌ Removed |
| HyperAIBOX nodes | ✅ HyperAIBOXService | ❌ Removed |
| Plugin system | ❌ Not present | ✅ plugins/ |
| HyperInsight | ❌ Not present | ✅ hyperinsight plugin |
| AIM nodes | ❌ Not present | ✅ aim-nodes plugin |
| JIT payments | ❌ Not present | ✅ payments-jit plugin |
| TTS | ❌ Not present | ✅ TTSService |

---

## 🤔 Decision Points

### Option 1: Fork (Keep Our Stack)
**Pros:**
- Keep all our Cardano, multi-agent, Ollama integrations
- Full control over features
- No breaking changes

**Cons:**
- No upstream updates
- Manual security patches
- Duplicate maintenance

### Option 2: Merge & Adapt (Plugin Architecture)
**Pros:**
- Get upstream updates
- Plugin architecture is cleaner
- HyperInsight, AIM nodes, payments

**Cons:**
- Need to rewrite our features as plugins
- Breaking changes
- Significant work

### Option 3: Hybrid (Both)
**Pros:**
- Get upstream plugin system
- Keep our integrations as separate plugins
- Best of both worlds

**Cons:**
- Complex merge
- Potential conflicts

---

## 🛠️ Recommended Approach: Hybrid

1. **Merge upstream** to get:
   - Plugin system
   - HyperInsight plugin
   - AIM nodes plugin
   - JIT payments
   - TTS service

2. **Convert our features to plugins:**
   - `plugins/cardano-wallet/` - Cardano integration
   - `plugins/ollama-models/` - Ollama integration
   - `plugins/multi-agent/` - Multi-agent orchestration
   - `plugins/hyperaibox/` - Physical nodes

3. **Keep shared services:**
   - Services that multiple plugins use
   - Types definitions

---

## 📋 Merge Strategy

```bash
# 1. Create integration branch
git checkout -b upstream-merge

# 2. Merge with strategy
git merge upstream/main -X theirs --no-commit

# 3. Re-add our services in plugins/ folder
# 4. Re-add our components
# 5. Update imports and references
# 6. Test and commit
```

---

## 🔗 Key Upstream Changes to Understand

### Plugin Architecture
```typescript
// manifest.json
{
  "id": "hyperinsight",
  "version": "1.0.0",
  "name": "HyperInsight",
  "ipcNamespace": "hyperinsight",
  "route": "mosaic://hyperinsight"
}

// main/index.js
export function registerHyperInsightIpc(ipcMain) {
  ipcMain.handle('hyperinsight:get-status', async () => {...});
}

// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  hyperinsight: {
    getStatus: () => ipcRenderer.invoke('hyperinsight:get-status'),
  }
});
```

### HypercycleAgent Service
```typescript
// src/services/hypercycleAgent.ts
// New unified agent service for Hypercycle
// Replaces: AgentOrchestrationService, MultiAgentService
```

---

## ⏭️ Next Steps

1. **Decision**: Choose merge strategy (fork/merge/hybrid)
2. **If hybrid**: Create plugin scaffolding for our features
3. **Migration**: Move Cardano, ETH, Ollama, Multi-agent to plugins
4. **Testing**: Verify all features work together
5. **Documentation**: Update UI_ARCHITECTURE.md

---

*Analysis Date: March 26, 2026*
*Branch: mosaic-integrations vs upstream/main*