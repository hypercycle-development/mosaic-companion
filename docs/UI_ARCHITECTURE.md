# MosAic Companion - UI Architecture Guide

This document specifies where each component belongs in the application structure.

---

## 🗂️ Page/URL Structure

| URL | Page Component | Purpose |
|-----|-----------------|---------|
| `browser://home` | `LandingPage.tsx` | Home/dashboard |
| `browser://settings` | `SettingsPage.tsx` | **All configuration lives here** |
| `browser://web3` | `Web3Page.tsx` | ETH/BASE wallet, ANFE, HyperCycle |
| `browser://midnight` | `MidnightPage.tsx` | Cardano wallet, Midnight Network |
| `browser://mcp` | `MCPPage.tsx` | Model Context Protocol |
| `browser://mosaicbot` | `MosaicBotPanel.tsx` | Bot panel |
| `browser://vault` | `VaultPage.tsx` | Secure storage |
| `browser://sandbox` | `SandboxPage.tsx` | Code sandbox |
| `browser://internal_chat` | `ChatPage.tsx` | Chat with agents |

---

## 🔧 Settings Page Sections

**Location:** `src/components/SettingsPage.tsx`

Settings is the central configuration hub. All user-configurable features go here.

### Section Order (Top to Bottom):

```
┌─────────────────────────────────────────────────────────┐
│  Settings Page                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. General Settings                                    │
│     - Home URL                                         │
│     - Custom Greeting                                  │
│     - URL Bar toggle                                   │
│     - Theme selection                                  │
│     - Auto-update settings                             │
│                                                         │
│  2. AI Agents Section (agentsSectionRef)              │
│     ┌─────────────────────────────────────────────┐   │
│     │  For each agent:                              │   │
│     │  - Name, Model, System Prompt                 │   │
│     │  - Temperature, Max Tokens                    │   │
│     │  - Tools selection                            │   │
│     │  - Agent Soul button → AgentSoulSettings      │   │
│     │  - Ollama Model selector (ModelSelector)      │   │
│     └─────────────────────────────────────────────┘   │
│                                                         │
│  3. Hypercycle Nodes Section (nodesSectionRef)         │
│     - Node list (R2D2, C-3PO, etc.)                    │
│     - Add/Edit/Delete nodes                            │
│     - Connection status indicators                     │
│                                                         │
│  4. Gmail Integration                                   │
│     - Gmail authentication                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Agents Section

**File:** `src/components/SettingsPage.tsx` (lines ~250-400)

### How to Add Agent Components:

```tsx
// Inside SettingsPage.tsx, agents section:

<section ref={agentsSectionRef} className="agents-section">
  <h2>AI Agents</h2>
  
  {aiAgents.map((agent) => (
    <div key={agent.id} className="agent-card">
      {/* Agent Name */}
      <input value={agent.name} onChange={...} />
      
      {/* Model Selection - Uses ModelSelector component */}
      <ModelSelector
        onSelect={(model) => updateAgent(agent.id, { model })}
        defaultModel={agent.model}
      />
      
      {/* System Prompt */}
      <textarea value={agent.systemPrompt} onChange={...} />
      
      {/* Agent Soul Settings - Opens AgentSoulSettings modal */}
      <button onClick={() => setExpandedAgent(agent.id)}>
        <Brain /> Agent Soul
      </button>
      
      {/* Expand to show AgentSoulSettings */}
      {expandedAgent === agent.id && (
        <AgentSoulSettings
          agentId={agent.id}
          agentName={agent.name}
          onSave={() => setExpandedAgent(null)}
        />
      )}
    </div>
  ))}
</section>
```

---

## 🧠 Agent Soul Settings

**File:** `src/components/AgentSoulSettings.tsx`

### Purpose:
Configure agent personality and memory (persisted across sessions).

### Location:
- Opens as expandable panel inside each agent card in Settings
- Triggered by "Agent Soul" button click

### Components:
```
┌─────────────────────────────────────────┐
│  Agent Soul Settings                     │
├─────────────────────────────────────────┤
│  [Personality] [Memory]                  │
│                                         │
│  Personality Tab:                        │
│  - Vibe (text)                          │
│  - Tone (text)                          │
│  - Core Truths (list)                   │
│  - Boundaries (list)                    │
│  - Response Style toggles               │
│  - Personality Templates dropdown       │
│                                         │
│  Memory Tab:                            │
│  - Key Facts (list)                     │
│  - Preferences (list)                   │
│  - Relationships (list)                 │
│  - Decisions (list)                     │
└─────────────────────────────────────────┘
```

### Integration:
```tsx
import { AgentSoulSettings } from './AgentSoulSettings';

// Inside agent card:
{expandedAgent === agent.id && (
  <AgentSoulSettings
    agentId={agent.id}
    agentName={agent.name}
    onSave={() => loadAgents()}
  />
)}
```

---

## 🧠 Ollama Model Selector

**File:** `src/components/ModelSelector.tsx`

### Purpose:
Select local Ollama models or cloud models for agents.

### Location:
- Inside each agent card in Settings
- Can also be used in ChatPage for model selection

### Props:
```tsx
interface ModelSelectorProps {
  onSelect: (model: string) => void;      // Called when model selected
  defaultModel?: string;                  // Current model
  onApiKeyChange?: (hasKey: boolean) => void;  // For cloud models
}
```

### Usage:
```tsx
import { ModelSelector } from './ModelSelector';

<ModelSelector
  onSelect={(model) => updateAgent(agentId, { model })}
  defaultModel={agent.model}
/>
```

### Features:
- Lists installed Ollama models
- Pull new models from Ollama
- Cloud model support (requires API key)
- Model size display

---

## 💳 Wallet Components

### ETH/BASE Wallet (ANFE + HyperCycle)

**Page:** `browser://web3` → `Web3Page.tsx`

**Files:**
- `src/components/WalletConnect.tsx` - Main wallet UI
- `src/services/WalletService.ts` - Wallet logic
- `src/services/EthWalletService.ts` - ETH/BASE specific
- `src/types/wallet.ts` - Types and ABIs

**Features:**
- MetaMask connection
- BASE network support
- ANFE (Advanced Node Factory) detection
- HyperCycle License NFT balance
- Address book

### Cardano Wallet (Midnight)

**Page:** `browser://midnight` → `MidnightPage.tsx`

**Files:**
- `src/components/CardanoWalletConnect.tsx` - Cardano wallet UI
- `src/services/CardanoWalletService.ts` - Cardano logic
- `src/types/cardano.ts` - Cardano types

**Location in MidnightPage:**
```tsx
// Inside MidnightPage.tsx, Cardano Access section:

<div className="px-4 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 border-b">
  <div className="flex items-center justify-between mb-4">
    <Shield /> Cardano Access
  </div>
  <CardanoWalletConnect />
</div>
```

**Features:**
- Eternl, Lace, Nami, Yoroi, Flint wallets
- HyperSharePass NFT detection
- Access levels based on NFT count:
  - 1+ NFT → Chat + 1 Agent
  - 10+ NFTs → Rent Compute

---

## 🔌 HyperAIBOX Nodes

**File:** `src/services/HyperAIBOXService.ts`

**Types:** `src/types/nodeConfig.ts`

### Location:
- Settings Page → Hypercycle Nodes section
- Also in Sidebar for quick status

### Default Nodes (from TOOLS.md):
```typescript
// In nodeConfig.ts:
export const DEFAULT_HYPERAIBOX_NODES: HyperAIBOXNode[] = [
  {
    id: 'r2d2',
    name: 'R2D2',
    ip: '192.168.0.10',
    user: 'molt',
    role: 'field-operator',
    capabilities: ['scraping', 'ollama', 'storage', 'python'],
  },
  {
    id: 'c3po',
    name: 'C-3PO',
    ip: '192.168.0.14',
    user: 'hpecagent',
    role: 'strategic-intelligence',
    capabilities: ['ollama', 'storage', 'analysis', 'leads'],
  }
];
```

### Adding More Nodes:
```tsx
// In SettingsPage, nodes section:
const addNewNode = async () => {
  const result = await window.electronAPI.nodes.add({
    name: 'New Node',
    apiHost: 'http://192.168.0.X:8080',
    isActive: true,
  });
};
```

---

## 🎨 Multi-Agent Panel

**File:** `src/components/MultiAgentPanel.tsx`

### Purpose:
Select agents and orchestration mode (Parallel, Sequential, Collaborative, Orchestrator).

### Location:
- Inside Chatview (`Chatview.tsx`) - Below input
- Standalone in ChatPage

### Integration:
```tsx
import { MultiAgentPanel } from './MultiAgentPanel';

// In Chatview, below input:
<div className="agent-status-bar">
  <MultiAgentPanel
    agents={activeAgents}
    selectedAgentIds={selectedMultiAgentIds}
    orchestrationMode={orchestrationMode}
    isActive={isMultiAgentMode}
    isRunning={isOrchestrating}
    currentAgentName={currentOrchestratingAgent}
  />
</div>
```

---

## 📁 File Structure Summary

```
src/
├── components/
│   ├── SettingsPage.tsx         ← MAIN CONFIG (agents, nodes, etc.)
│   ├── AgentSoulSettings.tsx    ← Agent personality/memory
│   ├── ModelSelector.tsx         ← Ollama model picker
│   ├── MultiAgentPanel.tsx      ← Multi-agent orchestration
│   ├── MultiAgentSelector.tsx   ← Agent selection UI
│   ├── WalletConnect.tsx        ← ETH/BASE wallet UI
│   ├── CardanoWalletConnect.tsx ← Cardano wallet UI
│   ├── Web3Page.tsx             ← ETH/BASE/ANFE page
│   ├── MidnightPage.tsx         ← Cardano/Midnight page
│   ├── ContentArea.tsx          ← Page router
│   └── Sidebar.tsx              ← Navigation
│
├── services/
│   ├── MultiAgentService.ts     ← Multi-agent orchestration logic
│   ├── AgentOrchestrationService.ts ← Agent coordination
│   ├── AgentSoulService.ts      ← Agent memory persistence
│   ├── OllamaService.ts         ← Ollama API client
│   ├── WalletService.ts         ← ETH/BASE/ANFE logic
│   ├── EthWalletService.ts      ← ETH wallet logic
│   ├── CardanoWalletService.ts  ← Cardano wallet logic
│   ├── HyperAIBOXService.ts     ← Physical node management
│   └── WalletConnectBridge.ts   ← Mobile wallet support
│
├── types/
│   ├── ai.ts                    ← AIAgentConfig, AIProvider
│   ├── agentOrchestration.ts    ← Orchestration types
│   ├── agentSoul.ts             ← Agent personality types
│   ├── nodeConfig.ts            ← HyperAIBOX node types
│   ├── wallet.ts                 ← ETH/ANFE types
│   └── cardano.ts                ← Cardano wallet types
│
└── electron/
    └── integrations/
        ├── web3/                 ← Web3 tools for agents
        └── midnight/             ← Midnight integration
```

---

## 🔑 Key Integration Points

### Adding a New Agent Feature:

1. **Define types** in `src/types/ai.ts`:
   ```tsx
   interface AIAgentConfig {
     id: string;
     name: string;
     model: string;
     systemPrompt: string;
     tools?: string[];
     skills?: string[];  // Add new skill array
   }
   ```

2. **Add UI** in `SettingsPage.tsx`:
   ```tsx
   // Inside agent card:
   <div className="skills-section">
     <label>Skills</label>
     {availableSkills.map(skill => (
       <checkbox checked={agent.skills?.includes(skill)} />
     ))}
   </div>
   ```

3. **Persist** via `window.electronAPI.aiAgents.update(agent)`

### Adding a New Wallet:

1. **Create service** in `src/services/NewWalletService.ts`
2. **Create types** in `src/types/newwallet.ts`
3. **Create UI** in `src/components/NewWalletConnect.tsx`
4. **Add page** or integrate into existing page:
   - ETH-like → `Web3Page.tsx`
   - Cardano-like → `MidnightPage.tsx`
5. **Add to sidebar** in `Sidebar.tsx` if new page

### Adding a New Node Type:

1. **Extend types** in `src/types/nodeConfig.ts`
2. **Add service** in `src/services/NewNodeService.ts`
3. **Add UI** in Settings → Hypercycle Nodes section
4. **Update `DEFAULT_HYPERAIBOX_NODES`** if default

---

## 🚀 Quick Reference

| What | Where | File |
|------|-------|------|
| Agent config | Settings → AI Agents | `SettingsPage.tsx` |
| Agent personality | Agent card → Soul button | `AgentSoulSettings.tsx` |
| Ollama models | Agent card → Model dropdown | `ModelSelector.tsx` |
| ETH/BASE wallet | Web3 Page | `Web3Page.tsx` |
| Cardano wallet | Midnight Page | `MidnightPage.tsx` |
| HyperAIBOX nodes | Settings → Hypercycle Nodes | `SettingsPage.tsx` |
| Multi-agent mode | Chat → Below input | `MultiAgentPanel.tsx` |
| 15-agent skills | Agent config → Tools | `SettingsPage.tsx` |

---

## 📝 Notes for Contributors

1. **All configuration goes in SettingsPage** - Don't scatter config across pages
2. **Use electronAPI for persistence** - `window.electronAPI.*`
3. **Follow the URL pattern** - `browser://page-name`
4. **Add new pages to ContentArea routing**
5. **Add new nav items to Sidebar**
6. **Services should be stateless** - Use electronAPI for storage
7. **Types go in `src/types/`** - Keep types separate from services

---

*Last updated: March 2026*
*Author: MosAic Integration Team*